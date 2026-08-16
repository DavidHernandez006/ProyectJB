// src/components/ofertas/skills-comparison.tsx
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SkillsComparisonProps {
  matchingSkills: string[]
  missingSkills: string[]
  maxVisible?: number
  className?: string
}

export function SkillsComparison({
  matchingSkills,
  missingSkills,
  maxVisible = 4,
  className,
}: SkillsComparisonProps) {
  const visibleMatching = matchingSkills.slice(0, maxVisible)
  const extraMatching = matchingSkills.length - visibleMatching.length
  const visibleMissing = missingSkills.slice(0, maxVisible)
  const extraMissing = missingSkills.length - visibleMissing.length

  if (matchingSkills.length === 0 && missingSkills.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {visibleMatching.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleMatching.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-4xl bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            >
              <Check className="size-3" />
              {skill}
            </span>
          ))}
          {extraMatching > 0 && (
            <span className="text-xs text-muted-foreground">
              +{extraMatching} más
            </span>
          )}
        </div>
      )}

      {visibleMissing.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleMissing.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-4xl bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              <X className="size-3" />
              {skill}
            </span>
          ))}
          {extraMissing > 0 && (
            <span className="text-xs text-muted-foreground">
              +{extraMissing} más
            </span>
          )}
        </div>
      )}
    </div>
  )
}
