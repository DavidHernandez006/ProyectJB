// src/components/pipeline/kanban-column.tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { KanbanCard } from "@/components/pipeline/kanban-card"
import {
  PIPELINE_STAGE_LABELS,
  type ApplicationCardData,
  type PipelineStage,
} from "@/types/application.types"

// Progresión neutra (gris claro -> oscuro) para reflejar avance en el
// pipeline, con verde para el desenlace positivo y rojo para el negativo —
// consistente con los tokens que ya usa MatchScoreBadge en el resto de la app.
const STAGE_DOT: Record<PipelineStage, string> = {
  interesado: "bg-chart-1",
  aplicado: "bg-chart-2",
  en_proceso: "bg-chart-3",
  entrevista: "bg-chart-4",
  oferta: "bg-chart-5",
  contratado: "bg-emerald-500",
  rechazado: "bg-destructive",
}

interface KanbanColumnProps {
  stage: PipelineStage
  applications: ApplicationCardData[]
  draggingId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (id: string, stage: PipelineStage) => void
  onOpenNotes: (application: ApplicationCardData) => void
}

export function KanbanColumn({
  stage,
  applications,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onOpenNotes,
}: KanbanColumnProps) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsOver(false)
        const id = e.dataTransfer.getData("text/plain")
        if (id) onDrop(id, stage)
      }}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-3 rounded-3xl border border-transparent p-2 transition-colors",
        isOver && "border-ring/40 bg-ring/5"
      )}
    >
      <div className="flex items-center gap-2 px-2 pt-1">
        <span className={cn("size-2 rounded-full", STAGE_DOT[stage])} />
        <h3 className="text-sm font-semibold text-foreground">
          {PIPELINE_STAGE_LABELS[stage]}
        </h3>
        <span className="ml-auto rounded-4xl bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {applications.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {applications.length === 0 && (
          <div
            className={cn(
              "rounded-3xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground",
              isOver && "border-ring/40"
            )}
          >
            Sin postulaciones
          </div>
        )}
        {applications.map((application) => (
          <KanbanCard
            key={application.id}
            application={application}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpenNotes={onOpenNotes}
            isDragging={draggingId === application.id}
          />
        ))}
      </div>
    </div>
  )
}
