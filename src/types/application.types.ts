// src/types/application.types.ts

export type PipelineStage =
  | 'interesado'
  | 'aplicado'
  | 'en_proceso'
  | 'entrevista'
  | 'oferta'
  | 'contratado'
  | 'rechazado'

export const PIPELINE_STAGES: PipelineStage[] = [
  'interesado',
  'aplicado',
  'en_proceso',
  'entrevista',
  'oferta',
  'contratado',
  'rechazado',
]

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  interesado: 'Interesado',
  aplicado: 'Aplicado',
  en_proceso: 'En proceso',
  entrevista: 'Entrevista',
  oferta: 'Oferta',
  contratado: 'Contratado',
  rechazado: 'Rechazado',
}

/** Fila de la tabla `applications` ya combinada con datos de la oferta y el match score. */
export interface ApplicationCardData {
  id: string
  offerId: string
  savedOfferId: string | null
  title: string
  company: string | null
  locationCity: string | null
  isRemote: boolean
  pipelineStage: PipelineStage
  appliedAt: string | null
  followUpDate: string | null
  recruiterName: string | null
  recruiterContact: string | null
  notes: string | null
  matchScore: number | null
  createdAt: string
}

/** Body de PATCH /api/applications/[id] */
export interface UpdateApplicationInput {
  pipelineStage?: PipelineStage
  notes?: string | null
  followUpDate?: string | null
  recruiterName?: string | null
  recruiterContact?: string | null
  appliedAt?: string | null
}

/** Body de POST /api/applications */
export interface CreateApplicationInput {
  offerId: string
  savedOfferId?: string | null
}
