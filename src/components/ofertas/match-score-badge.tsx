// src/components/ofertas/match-score-badge.tsx
"use client"

import { cn } from "@/lib/utils"

interface MatchScoreBadgeProps {
  score: number // 0-100
  size?: "sm" | "default"
  showLabel?: boolean
  className?: string
}

/**
 * Devuelve la paleta según el rango del score.
 * >= 80: alto match (verde)
 * 50-79: match medio (ámbar)
 * < 50: match bajo (rojo)
 */
function getScoreTier(score: number) {
  if (score >= 80) {
    return {
      label: "Alto",
      text: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-500/15",
      bar: "bg-emerald-500",
    }
  }
  if (score >= 50) {
    return {
      label: "Medio",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/15",
      bar: "bg-amber-500",
    }
  }
  return {
    label: "Bajo",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-500/15",
    bar: "bg-red-500",
  }
}

export function MatchScoreBadge({
  score,
  size = "default",
  showLabel = true,
  className,
}: MatchScoreBadgeProps) {
  const tier = getScoreTier(score)
  const clamped = Math.max(0, Math.min(100, Math.round(score)))

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-4xl px-2 py-0.5 font-semibold tabular-nums",
            tier.bg,
            tier.text,
            size === "sm" ? "text-xs" : "text-sm"
          )}
        >
          {clamped}% match
        </span>
        {showLabel && (
          <span className={cn("text-xs font-medium", tier.text)}>
            {tier.label}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tier.bar)}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
