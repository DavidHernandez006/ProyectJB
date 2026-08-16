// src/components/pipeline/application-notes-dialog.tsx
"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ApplicationCardData } from "@/types/application.types"

interface ApplicationNotesDialogProps {
  application: ApplicationCardData | null
  onClose: () => void
  onSave: (id: string, notes: string) => void | Promise<void>
}

export function ApplicationNotesDialog({
  application,
  onClose,
  onSave,
}: ApplicationNotesDialogProps) {
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setNotes(application?.notes ?? "")
  }, [application])

  if (!application) return null

  async function handleSave() {
    if (!application) return
    setIsSaving(true)
    await onSave(application.id, notes)
    setIsSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notas-dialog-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="notas-dialog-title" className="text-sm font-semibold text-card-foreground">
              {application.title}
            </h2>
            {application.company && (
              <p className="text-xs text-muted-foreground">{application.company}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="notas-textarea"
            className="text-xs font-medium text-muted-foreground"
          >
            Notas
          </label>
          <textarea
            id="notas-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Contacto del reclutador, feedback de la entrevista, próximos pasos..."
            className="resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar notas"}
          </Button>
        </div>
      </div>
    </div>
  )
}
