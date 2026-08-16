// src/components/pipeline/kanban-card.tsx
"use client"

import { Building2, MapPin, Wifi, Calendar, StickyNote } from "lucide-react"
import { MatchScoreBadge } from "@/components/ofertas/match-score-badge"
import { cn } from "@/lib/utils"
import type { ApplicationCardData } from "@/types/application.types"

interface KanbanCardProps {
  application: ApplicationCardData
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onOpenNotes: (application: ApplicationCardData) => void
  isDragging: boolean
}

function formatFollowUp(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)

  if (diffDays < 0) return { label: "Seguimiento vencido", overdue: true }
  if (diffDays === 0) return { label: "Seguimiento hoy", overdue: true }
  if (diffDays === 1) return { label: "Seguimiento mañana", overdue: false }
  return {
    label: `Seguimiento en ${diffDays} días`,
    overdue: false,
  }
}

export function KanbanCard({
  application,
  onDragStart,
  onDragEnd,
  onOpenNotes,
  isDragging,
}: KanbanCardProps) {
  const followUp = formatFollowUp(application.followUpDate)

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", application.id)
        e.dataTransfer.effectAllowed = "move"
        onDragStart(application.id)
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex cursor-grab flex-col gap-2.5 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-all active:cursor-grabbing",
        "hover:border-foreground/20",
        isDragging && "opacity-40"
      )}
    >
      <div>
        <h4 className="text-sm font-semibold leading-snug text-card-foreground">
          {application.title}
        </h4>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {application.company && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" />
              {application.company}
            </span>
          )}
          {(application.locationCity || application.isRemote) && (
            <span className="inline-flex items-center gap-1">
              {application.isRemote ? (
                <Wifi className="size-3" />
              ) : (
                <MapPin className="size-3" />
              )}
              {application.isRemote ? "Remoto" : application.locationCity}
            </span>
          )}
        </div>
      </div>

      {application.matchScore != null && (
        <MatchScoreBadge score={application.matchScore} size="sm" showLabel={false} />
      )}

      {followUp && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-4xl px-2 py-0.5 text-xs font-medium",
            followUp.overdue
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Calendar className="size-3" />
          {followUp.label}
        </span>
      )}

      <button
        type="button"
        onClick={() => onOpenNotes(application)}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <StickyNote className="size-3.5" />
        {application.notes ? "Ver notas" : "Agregar notas"}
      </button>
    </article>
  )
}
