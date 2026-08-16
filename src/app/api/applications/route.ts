// src/app/api/applications/route.ts
//
// GET  /api/applications  -> lista el pipeline del usuario autenticado,
//                             combinando applications + job_offers + el
//                             match_score guardado en saved_offers.
// POST /api/applications  -> crea una postulación a partir de una oferta
//                             (mueve una oferta guardada a "interesado").

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ApplicationCardData } from '@/types/application.types'

export const runtime = 'nodejs'

const createApplicationSchema = z.object({
  offerId: z.string().uuid(),
  savedOfferId: z.string().uuid().nullish(),
})

// Tipo mínimo de lo que devuelve el select anidado de Supabase.
interface ApplicationRow {
  id: string
  offer_id: string
  saved_offer_id: string | null
  pipeline_stage: ApplicationCardData['pipelineStage']
  applied_at: string | null
  follow_up_date: string | null
  recruiter_name: string | null
  recruiter_contact: string | null
  notes: string | null
  created_at: string
  job_offers: {
    title: string
    company: string | null
    location_city: string | null
    is_remote: boolean
  } | null
  saved_offers: { match_score: number | null } | null
}

function toCardData(row: ApplicationRow): ApplicationCardData {
  return {
    id: row.id,
    offerId: row.offer_id,
    savedOfferId: row.saved_offer_id,
    title: row.job_offers?.title ?? 'Oferta eliminada',
    company: row.job_offers?.company ?? null,
    locationCity: row.job_offers?.location_city ?? null,
    isRemote: row.job_offers?.is_remote ?? false,
    pipelineStage: row.pipeline_stage,
    appliedAt: row.applied_at,
    followUpDate: row.follow_up_date,
    recruiterName: row.recruiter_name,
    recruiterContact: row.recruiter_contact,
    notes: row.notes,
    matchScore: row.saved_offers?.match_score ?? null,
    createdAt: row.created_at,
  }
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('applications')
    .select(
      `
      id,
      offer_id,
      saved_offer_id,
      pipeline_stage,
      applied_at,
      follow_up_date,
      recruiter_name,
      recruiter_contact,
      notes,
      created_at,
      job_offers ( title, company, location_city, is_remote ),
      saved_offers ( match_score )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const applications = ((data ?? []) as unknown as ApplicationRow[]).map(toCardData)
  return NextResponse.json(applications)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = createApplicationSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
      offer_id: parsed.data.offerId,
      saved_offer_id: parsed.data.savedOfferId ?? null,
      pipeline_stage: 'interesado',
    })
    .select('id')
    .single()

  if (error) {
    // unique(user_id, offer_id): ya existe una postulación para esta oferta.
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
