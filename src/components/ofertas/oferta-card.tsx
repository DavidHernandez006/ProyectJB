// src/components/ofertas/oferta-card.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, MapPin, Wifi, Bookmark, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MatchScoreBadge } from "@/components/ofertas/match-score-badge"
import { SkillsComparison } from "@/components/ofertas/skills-comparison"
import { cn } from "@/lib/utils"

export interface OfertaCardData {
  id: string
  title: string
  company: string | null
  locationCity: string | null
  isRemote: boolean
  modality: "presencial" | "remoto" | "hibrido" | null
  salaryMin: number | null
  salaryMax: number | null
  salaryIsVisible: boolean
  matchScore: number | null
  matchingSkills: string[]
  missingSkills: string[]
  publishedAt: string | null
  url: string
  /** Presente si el usuario ya guardó esta oferta (para enlazarla al crear la postulación). */
  savedOfferId?: string | null
  /** Presente si el usuario ya la aplicó; oculta el botón "Aplicar". */
  applicationId?: string | null
}

interface OfertaCardProps {
  oferta: OfertaCardData
  onGuardar?: (id: string) => void
  onAplicar?: (offerId: string) => void
  className?: string
}

function formatSalario(min: number | null, max: number | null) {
  if (min == null && max == null) return null
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n)
  if (min != null && max != null) return `${fmt(min)} - ${fmt(max)}`
  return fmt((min ?? max)!)
}

type EstadoAplicacion = "idle" | "aplicando" | "aplicado" | "error"

export function OfertaCard({ oferta, onGuardar, onAplicar, className }: OfertaCardProps) {
  const [estadoAplicacion, setEstadoAplicacion] = useState<EstadoAplicacion>(
    oferta.applicationId ? "aplicado" : "idle"
  )

  const salario = oferta.salaryIsVisible
    ? formatSalario(oferta.salaryMin, oferta.salaryMax)
    : null

  async function handleAplicar() {
    if (estadoAplicacion === "aplicando" || estadoAplicacion === "aplicado") return

    setEstadoAplicacion("aplicando")
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: oferta.id,
          savedOfferId: oferta.savedOfferId ?? null,
        }),
      })

      // 409 = ya existía una postulación para esta oferta (unique user_id+offer_id).
      // Lo tratamos igual que un éxito: la oferta ya está en el pipeline.
      if (!res.ok && res.status !== 409) {
        throw new Error("No se pudo crear la postulación")
      }

      setEstadoAplicacion("aplicado")
      onAplicar?.(oferta.id)
    } catch {
      setEstadoAplicacion("error")
    }
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-foreground/20",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-card-foreground">
            {oferta.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {oferta.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {oferta.company}
              </span>
            )}
            {(oferta.locationCity || oferta.isRemote) && (
              <span className="inline-flex items-center gap-1">
                {oferta.isRemote ? (
                  <Wifi className="size-3.5" />
                ) : (
                  <MapPin className="size-3.5" />
                )}
                {oferta.isRemote ? "Remoto" : oferta.locationCity}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onGuardar?.(oferta.id)}
          aria-label="Guardar oferta"
          className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bookmark className="size-4" />
        </button>
      </div>

      {oferta.matchScore != null && (
        <MatchScoreBadge score={oferta.matchScore} size="sm" />
      )}

      <SkillsComparison
        matchingSkills={oferta.matchingSkills}
        missingSkills={oferta.missingSkills}
      />

      <div className="mt-auto flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between gap-3">
          {salario ? (
            <span className="text-sm font-medium text-card-foreground">
              {salario}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Salario no publicado
            </span>
          )}

          <Button asChild size="sm" variant="outline">
            <Link href={`/ofertas/${oferta.id}`}>Ver oferta</Link>
          </Button>
        </div>

        <Button
          size="sm"
          onClick={handleAplicar}
          disabled={estadoAplicacion === "aplicando" || estadoAplicacion === "aplicado"}
          className="w-full"
        >
          {estadoAplicacion === "aplicando" && (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          )}
          {estadoAplicacion === "aplicado" && (
            <Check className="size-4" data-icon="inline-start" />
          )}
          {estadoAplicacion === "aplicando" && "Aplicando..."}
          {estadoAplicacion === "aplicado" && "En tu pipeline"}
          {(estadoAplicacion === "idle" || estadoAplicacion === "error") && "Aplicar"}
        </Button>

        {estadoAplicacion === "error" && (
          <p className="text-xs text-destructive">
            No se pudo aplicar. Intenta de nuevo.
          </p>
        )}
      </div>
    </article>
  )
}
