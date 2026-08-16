// src/app/api/applications/[id]/route.ts
//
// PATCH  /api/applications/[id]  -> mueve de columna, edita notas, fecha de
//                                    seguimiento o datos del reclutador.
// DELETE /api/applications/[id]  -> saca una oferta del pipeline.
//
// RLS ya restringe todo a `user_id = auth.uid()` (ver applications_update_own
// / applications_delete_own en schema.sql), así que no hace falta validar
// ownership manualmente: si la fila no es del usuario, Supabase no la
// actualiza y `data` vuelve vacío.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const PIPELINE_STAGES = [
  'interesado',
  'aplicado',
  'en_proceso',
  'entrevista',
  'oferta',
  'contratado',
  'rechazado',
] as const

const updateApplicationSchema = z.object({
  pipelineStage: z.enum(PIPELINE_STAGES).optional(),
  notes: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  recruiterName: z.string().nullable().optional(),
  recruiterContact: z.string().nullable().optional(),
  appliedAt: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = updateApplicationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.pipelineStage !== undefined) {
    patch.pipeline_stage = parsed.data.pipelineStage
    // Si se marca como "aplicado" y no había fecha, la registramos.
    if (parsed.data.pipelineStage === 'aplicado' && parsed.data.appliedAt === undefined) {
      patch.applied_at = new Date().toISOString()
    }
  }
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
  if (parsed.data.followUpDate !== undefined) patch.follow_up_date = parsed.data.followUpDate
  if (parsed.data.recruiterName !== undefined) patch.recruiter_name = parsed.data.recruiterName
  if (parsed.data.recruiterContact !== undefined)
    patch.recruiter_contact = parsed.data.recruiterContact
  if (parsed.data.appliedAt !== undefined) patch.applied_at = parsed.data.appliedAt

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('applications')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Postulación no encontrada' },
      { status: error ? 500 : 404 }
    )
  }

  return NextResponse.json({ id: data.id })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
