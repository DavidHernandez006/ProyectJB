// src/app/api/cv/parse/route.ts
//
// POST /api/cv/parse
// multipart/form-data:
//   - file: PDF o DOCX (requerido)
//   - versionLabel: string (opcional, default "general")
//   - isPrimary: "true" | "false" (opcional, default "false")
//
// Flujo: sube el archivo a Supabase Storage -> crea la fila en `cvs` (status=processing)
// -> extrae texto -> llama a GPT-4o -> valida el JSON con Zod -> actualiza la fila
// (status=completed) o la marca como failed con error_message si algo falla.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import {
  CV_EXTRACTION_SYSTEM_PROMPT,
  buildCvExtractionUserPrompt,
} from '@/lib/openai/prompts';
import type { CvParsedData } from '@/types/cv.types';

// pdf-parse / mammoth tocan el filesystem y APIs de Node -> runtime nodejs, no edge.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

// ------------------------------------------------------------------
// Validación del JSON que devuelve el modelo (defensa contra alucinaciones
// de formato / campos faltantes antes de tocar la base de datos).
// ------------------------------------------------------------------
const experienciaSchema = z.object({
  cargo: z.string(),
  empresa: z.string(),
  ubicacion: z.string().nullable(),
  fecha_inicio: z.string().nullable(),
  fecha_fin: z.string().nullable(),
  trabajo_actual: z.boolean(),
  descripcion: z.string().nullable(),
  logros: z.array(z.string()).default([]),
});

const educacionSchema = z.object({
  institucion: z.string(),
  titulo: z.string(),
  nivel_educativo: z
    .enum([
      'bachillerato',
      'tecnico',
      'tecnologo',
      'pregrado',
      'especializacion',
      'maestria',
      'doctorado',
      'certificacion',
      'otro',
    ])
    .nullable(),
  fecha_inicio: z.string().nullable(),
  fecha_fin: z.string().nullable(),
  en_curso: z.boolean(),
});

const idiomaSchema = z.object({
  idioma: z.string(),
  nivel: z.enum(['basico', 'intermedio', 'avanzado', 'nativo']).nullable(),
});

const cvParsedDataSchema = z.object({
  nombre: z.string().nullable(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  titulo: z.string().nullable(),
  resumen_perfil: z.string().nullable(),
  anios_experiencia_total: z.number().nullable(),
  experiencia: z.array(experienciaSchema).default([]),
  educacion: z.array(educacionSchema).default([]),
  skills: z.array(z.string()).default([]),
  idiomas: z.array(idiomaSchema).default([]),
  certificaciones: z.array(z.string()).default([]),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  // FIX: createClient() ahora es async porque cookies() de next/headers
  // es async en Next.js 15+. Antes esto rompía la autenticación silenciosamente
  // porque `supabase` era una Promise en vez del cliente real.
  const supabase = await createClient();

  // 1. Autenticación
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // 2. Leer el multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'No se pudo leer el form-data' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  const versionLabel = (formData.get('versionLabel') as string | null) ?? 'general';
  const isPrimary = formData.get('isPrimary') === 'true';

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Falta el archivo (campo "file")' },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Formato no soportado. Sube un PDF o DOCX.' },
      { status: 415 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'El archivo supera el límite de 8MB.' },
      { status: 413 },
    );
  }

  const fileType: 'pdf' | 'docx' = file.type === 'application/pdf' ? 'pdf' : 'docx';
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // 3. Subir a Supabase Storage
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CVS ?? 'cvs';
  const storagePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Error subiendo el archivo: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // 4. Crear la fila en `cvs` con status=processing
  const { data: cvRow, error: insertError } = await supabase
    .from('cvs')
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_url: storagePath,
      file_type: fileType,
      version_label: versionLabel,
      is_primary: isPrimary,
      status: 'processing',
    })
    .select('id')
    .single();

  if (insertError || !cvRow) {
    return NextResponse.json(
      { error: `Error creando el registro de CV: ${insertError?.message}` },
      { status: 500 },
    );
  }

  const cvId = cvRow.id as string;

  // A partir de aquí, cualquier fallo debe marcar la fila como failed en vez
  // de dejarla colgada en "processing".
  try {
    // 5. Extraer texto plano
    const rawText = await extractText(fileBuffer, fileType);

    if (!rawText || rawText.trim().length < 30) {
      // Texto insuficiente -> probablemente un PDF escaneado sin capa de texto.
      // Aquí es donde engancharías el fallback de OCR (lib/parsing/ocr.ts / Tesseract).
      throw new Error(
        'No se pudo extraer texto del documento (posible escaneo sin OCR).',
      );
    }

    // 6. Llamar a GPT-4o con salida forzada a JSON
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CV_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildCvExtractionUserPrompt(rawText) },
      ],
    });

    const rawJson = completion.choices[0]?.message?.content;
    if (!rawJson) {
      throw new Error('OpenAI no devolvió contenido.');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawJson);
    } catch {
      throw new Error('La respuesta del modelo no es JSON válido.');
    }

    const validation = cvParsedDataSchema.safeParse(parsedJson);
    if (!validation.success) {
      throw new Error(
        `JSON del modelo no cumple el esquema esperado: ${validation.error.message}`,
      );
    }

    const parsedData: CvParsedData = validation.data;

    // 7. Guardar el resultado en Supabase
    const { error: updateError } = await supabase
      .from('cvs')
      .update({
        status: 'completed',
        parsed_data: parsedData,
        skills: parsedData.skills,
        experience_years: parsedData.anios_experiencia_total,
        error_message: null,
      })
      .eq('id', cvId);

    if (updateError) {
      throw new Error(`Error guardando el resultado: ${updateError.message}`);
    }

    return NextResponse.json(
      { cvId, status: 'completed', parsedData },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';

    await supabase
      .from('cvs')
      .update({ status: 'failed', error_message: message })
      .eq('id', cvId);

    return NextResponse.json({ error: message, cvId }, { status: 422 });
  }
}

// ------------------------------------------------------------------
// Extracción de texto. Import dinámico para evitar que pdf-parse/mammoth
// se evalúen en tiempo de build (ambos tocan el filesystem al cargar).
// ------------------------------------------------------------------
async function extractText(buffer: Buffer, fileType: 'pdf' | 'docx'): Promise<string> {
  if (fileType === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
