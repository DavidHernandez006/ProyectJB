// src/store/pipeline-store.ts
//
// Estado optimista del Kanban: al arrastrar una tarjeta a otra columna, el
// cambio se refleja de inmediato en la UI y luego se confirma contra
// PATCH /api/applications/[id]. Si el request falla, se revierte al estado
// anterior y se muestra un error.
//
// Requiere `zustand` como dependencia (npm install zustand).

import { create } from 'zustand'
import type {
  ApplicationCardData,
  PipelineStage,
} from '@/types/application.types'

interface PipelineState {
  applications: ApplicationCardData[]
  isLoading: boolean
  error: string | null

  setApplications: (apps: ApplicationCardData[]) => void
  setLoading: (loading: boolean) => void
  clearError: () => void

  moveApplication: (id: string, stage: PipelineStage) => Promise<void>
  updateNotes: (id: string, notes: string) => Promise<void>
  removeApplication: (id: string) => Promise<void>
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  applications: [],
  isLoading: false,
  error: null,

  setApplications: (applications) => set({ applications }),
  setLoading: (isLoading) => set({ isLoading }),
  clearError: () => set({ error: null }),

  moveApplication: async (id, stage) => {
    const previous = get().applications
    const target = previous.find((a) => a.id === id)
    if (!target || target.pipelineStage === stage) return

    // 1. Actualización optimista
    set({
      applications: previous.map((a) =>
        a.id === id ? { ...a, pipelineStage: stage } : a
      ),
      error: null,
    })

    // 2. Confirmar contra el backend
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStage: stage }),
      })
      if (!res.ok) throw new Error('No se pudo mover la postulación')
    } catch {
      // 3. Rollback si falla
      set({
        applications: previous,
        error: 'No se pudo mover la postulación. Intenta de nuevo.',
      })
    }
  },

  updateNotes: async (id, notes) => {
    const previous = get().applications
    set({
      applications: previous.map((a) => (a.id === id ? { ...a, notes } : a)),
    })

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar las notas')
    } catch {
      set({
        applications: previous,
        error: 'No se pudieron guardar las notas. Intenta de nuevo.',
      })
    }
  },

  removeApplication: async (id) => {
    const previous = get().applications
    set({ applications: previous.filter((a) => a.id !== id) })

    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar la postulación')
    } catch {
      set({
        applications: previous,
        error: 'No se pudo eliminar la postulación. Intenta de nuevo.',
      })
    }
  },
}))
