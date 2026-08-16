// src/components/ofertas/oferta-filtros.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface OfertaFiltrosState {
  ciudad: string | null
  modalidades: Array<"presencial" | "remoto" | "hibrido">
  salarioMin: number | null
  fechaPublicacion: "cualquiera" | "24h" | "7d" | "30d"
}

interface OfertaFiltrosProps {
  ciudades: string[]
  value: OfertaFiltrosState
  onChange: (value: OfertaFiltrosState) => void
  className?: string
}

const MODALIDADES: Array<{ value: OfertaFiltrosState["modalidades"][number]; label: string }> = [
  { value: "remoto", label: "Remoto" },
  { value: "hibrido", label: "Híbrido" },
  { value: "presencial", label: "Presencial" },
]

const FECHAS: Array<{ value: OfertaFiltrosState["fechaPublicacion"]; label: string }> = [
  { value: "cualquiera", label: "Cualquier fecha" },
  { value: "24h", label: "Últimas 24 horas" },
  { value: "7d", label: "Última semana" },
  { value: "30d", label: "Último mes" },
]

export function OfertaFiltros({
  ciudades,
  value,
  onChange,
  className,
}: OfertaFiltrosProps) {
  const [salarioInput, setSalarioInput] = useState(
    value.salarioMin?.toString() ?? ""
  )

  function toggleModalidad(m: OfertaFiltrosState["modalidades"][number]) {
    const next = value.modalidades.includes(m)
      ? value.modalidades.filter((x) => x !== m)
      : [...value.modalidades, m]
    onChange({ ...value, modalidades: next })
  }

  function limpiarFiltros() {
    setSalarioInput("")
    onChange({
      ciudad: null,
      modalidades: [],
      salarioMin: null,
      fechaPublicacion: "cualquiera",
    })
  }

  return (
    <aside
      className={cn(
        "flex w-full flex-col gap-6 rounded-3xl border border-border bg-card p-5 lg:w-64",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground">Filtros</h2>
        <button
          type="button"
          onClick={limpiarFiltros}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="filtro-ciudad" className="text-xs font-medium text-muted-foreground">
          Ciudad
        </label>
        <select
          id="filtro-ciudad"
          value={value.ciudad ?? ""}
          onChange={(e) =>
            onChange({ ...value, ciudad: e.target.value || null })
          }
          className="h-9 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <option value="">Todas las ciudades</option>
          {ciudades.map((ciudad) => (
            <option key={ciudad} value={ciudad}>
              {ciudad}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Modalidad
        </span>
        <div className="flex flex-col gap-1.5">
          {MODALIDADES.map((m) => (
            <label
              key={m.value}
              className="flex items-center gap-2 text-sm text-card-foreground"
            >
              <input
                type="checkbox"
                checked={value.modalidades.includes(m.value)}
                onChange={() => toggleModalidad(m.value)}
                className="size-4 rounded border-border accent-primary"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="filtro-salario" className="text-xs font-medium text-muted-foreground">
          Salario mínimo (COP)
        </label>
        <input
          id="filtro-salario"
          type="number"
          inputMode="numeric"
          placeholder="Ej: 3000000"
          value={salarioInput}
          onChange={(e) => setSalarioInput(e.target.value)}
          onBlur={() =>
            onChange({
              ...value,
              salarioMin: salarioInput ? Number(salarioInput) : null,
            })
          }
          className="h-9 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="filtro-fecha" className="text-xs font-medium text-muted-foreground">
          Publicada
        </label>
        <select
          id="filtro-fecha"
          value={value.fechaPublicacion}
          onChange={(e) =>
            onChange({
              ...value,
              fechaPublicacion: e.target.value as OfertaFiltrosState["fechaPublicacion"],
            })
          }
          className="h-9 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {FECHAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <Button variant="outline" size="sm" onClick={limpiarFiltros}>
        Restablecer filtros
      </Button>
    </aside>
  )
}
