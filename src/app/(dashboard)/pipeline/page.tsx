// src/app/(dashboard)/pipeline/page.tsx
import { KanbanBoard } from "@/components/pipeline/kanban-board"

export default function PipelinePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Pipeline de postulaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Arrastra las tarjetas entre columnas para actualizar el estado de
          cada postulación.
        </p>
      </header>

      <KanbanBoard />
    </div>
  )
}
