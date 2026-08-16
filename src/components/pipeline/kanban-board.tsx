// src/components/pipeline/kanban-board.tsx
"use client"

import { useEffect, useState } from "react"
import { usePipelineStore } from "@/store/pipeline-store"
import { KanbanColumn } from "@/components/pipeline/kanban-column"
import { ApplicationNotesDialog } from "@/components/pipeline/application-notes-dialog"
import { PIPELINE_STAGES, type ApplicationCardData } from "@/types/application.types"

export function KanbanBoard() {
  const {
    applications,
    isLoading,
    error,
    setApplications,
    setLoading,
    clearError,
    moveApplication,
    updateNotes,
  } = usePipelineStore()

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [notesTarget, setNotesTarget] = useState<ApplicationCardData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function cargar() {
      setLoading(true)
      try {
        const res = await fetch("/api/applications", { signal: controller.signal })
        if (!res.ok) throw new Error("No se pudo cargar el pipeline")
        const data: ApplicationCardData[] = await res.json()
        setApplications(data)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err)
        }
      } finally {
        setLoading(false)
      }
    }

    cargar()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <div
            key={stage}
            className="h-96 w-72 shrink-0 animate-pulse rounded-3xl border border-border bg-muted/40"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-xs font-medium underline underline-offset-2"
          >
            Descartar
          </button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            applications={applications.filter((a) => a.pipelineStage === stage)}
            draggingId={draggingId}
            onDragStart={setDraggingId}
            onDragEnd={() => setDraggingId(null)}
            onDrop={(id, targetStage) => {
              setDraggingId(null)
              void moveApplication(id, targetStage)
            }}
            onOpenNotes={setNotesTarget}
          />
        ))}
      </div>

      <ApplicationNotesDialog
        application={notesTarget}
        onClose={() => setNotesTarget(null)}
        onSave={(id, notes) => updateNotes(id, notes)}
      />
    </div>
  )
}
