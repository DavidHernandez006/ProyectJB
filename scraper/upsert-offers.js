/**
 * upsert-offers.js
 *
 * Toma el JSON más reciente generado por scrape-computrabajo.js (o cualquier
 * scraper con el mismo formato: { metadata, ofertas: [...] } ) y lo
 * sincroniza con la tabla public.job_offers de Supabase, usando
 * (portal, external_id) como llave de upsert (ver unique constraint en
 * schema.sql). Usa la service role key porque escribir en job_offers está
 * reservado al backend (RLS solo permite lectura a usuarios autenticados).
 *
 * Requiere en tu entorno (se carga automáticamente desde .env.local si existe):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   node upsert-offers.js                  # usa el JSON más reciente de ./output
 *   node upsert-offers.js ./output/x.json   # usa un archivo específico
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ------------------------------------------------------------------
// Cargar .env.local sin depender de un paquete externo (dotenv)
// ------------------------------------------------------------------
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    value = value.replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Ponlos en scraper/.env.local (copia de tu .env.local raíz) o en variables de entorno.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------------
// Utilidades de parseo
// ------------------------------------------------------------------

/** Extrae min/max de textos como "$ 3.000.000 - $ 4.500.000" o "$3.500.000". */
function parseSalario(texto) {
  if (!texto) return { min: null, max: null, visible: false };

  const numeros = (texto.match(/[\d.,]+/g) || [])
    .map((n) => Number(n.replace(/\./g, '').replace(',', '.')))
    .filter((n) => !Number.isNaN(n) && n > 0);

  if (numeros.length === 0) return { min: null, max: null, visible: false };
  if (numeros.length === 1) return { min: numeros[0], max: numeros[0], visible: true };
  return { min: Math.min(...numeros), max: Math.max(...numeros), visible: true };
}

function inferModality(offer) {
  const texto = `${offer.ubicacion || ''} ${offer.descripcion || ''}`.toLowerCase();
  if (texto.includes('remoto') || texto.includes('remote') || texto.includes('teletrabajo')) {
    return 'remoto';
  }
  if (texto.includes('híbrido') || texto.includes('hibrido')) {
    return 'hibrido';
  }
  return 'presencial';
}

/**
 * Usa el pathname de la URL como external_id. Es estable (no cambia si
 * scrapeamos la misma oferta de nuevo) y único por oferta, sin depender de
 * adivinar el formato interno de IDs de cada portal.
 */
function externalIdFromUrl(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '');
  } catch {
    return url;
  }
}

function detectPortal(metadata) {
  const fuente = (metadata && metadata.fuente) || '';
  if (fuente.includes('elempleo')) return 'elempleo';
  if (fuente.includes('linkedin')) return 'linkedin';
  if (fuente.includes('indeed')) return 'indeed';
  return 'computrabajo';
}

function findLatestOutputFile() {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    throw new Error(`No existe ${outputDir}. Corre primero el scraper correspondiente.`);
  }
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(outputDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error(`No hay archivos JSON en ${outputDir}`);
  }
  return path.join(outputDir, files[0].f);
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  const inputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : findLatestOutputFile();

  console.log(`Leyendo ofertas de: ${inputPath}`);
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const ofertas = raw.ofertas || [];
  const portal = detectPortal(raw.metadata);

  console.log(`Portal detectado: ${portal}`);
  console.log(`Ofertas a sincronizar: ${ofertas.length}\n`);

  let sincronizadas = 0;
  let omitidas = 0;
  let errores = 0;

  for (const oferta of ofertas) {
    if (!oferta.url || !oferta.titulo) {
      omitidas++;
      continue;
    }

    const salario = parseSalario(oferta.salario);
    const modality = inferModality(oferta);

    const row = {
      portal,
      external_id: externalIdFromUrl(oferta.url),
      title: oferta.titulo,
      company: oferta.empresa || null,
      location_city: oferta.ubicacion || null,
      location_country: 'Colombia',
      is_remote: modality === 'remoto',
      modality,
      salary_min: salario.min,
      salary_max: salario.max,
      salary_is_visible: salario.visible,
      description: oferta.descripcion || null,
      url: oferta.url,
      apply_url: oferta.url,
      scraped_at: new Date().toISOString(),
      is_active: true,
    };

    const { error } = await supabase
      .from('job_offers')
      .upsert(row, { onConflict: 'portal,external_id' });

    if (error) {
      errores++;
      console.error(`Error en "${oferta.titulo}": ${error.message}`);
    } else {
      sincronizadas++;
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Sincronizadas: ${sincronizadas}`);
  console.log(`Omitidas (sin url/titulo): ${omitidas}`);
  console.log(`Errores: ${errores}`);
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
