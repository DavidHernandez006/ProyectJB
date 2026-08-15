// src/lib/scraping/robots-checker.ts
//
// Verificación mínima de robots.txt antes de scrapear un portal desde una
// ruta API de Next.js (ej. /api/scraping/computrabajo/route.ts).
// No es un parser completo de la spec (no soporta wildcards avanzados ni
// crawl-delay por grupo), pero cubre los casos comunes: Disallow/Allow por
// User-agent, con fallback al grupo "*".
//
// Para el script standalone (node scrape-computrabajo.js, fuera del runtime
// de Next.js) existe una copia equivalente en CommonJS:
// scraper/robots-checker.js — mantener ambas en sync si cambia la lógica.

interface RobotsRule {
  path: string
  allow: boolean
}

type RobotsRules = Record<string, RobotsRule[]>

const cache = new Map<string, { rules: RobotsRules; fetchedAt: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora

async function fetchRobotsTxt(baseUrl: string): Promise<RobotsRules> {
  const cached = cache.get(baseUrl)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rules
  }

  const robotsUrl = new URL('/robots.txt', baseUrl).toString()
  const rules: RobotsRules = {}

  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'JobMatchCOBot/1.0' },
    })
    if (!res.ok) {
      // Sin robots.txt -> se asume que todo está permitido.
      cache.set(baseUrl, { rules, fetchedAt: Date.now() })
      return rules
    }

    const text = await res.text()
    let currentAgents: string[] = []

    for (const rawLine of text.split('\n')) {
      const line = rawLine.split('#')[0].trim()
      if (!line) continue

      const [rawKey, ...rest] = line.split(':')
      const key = rawKey.trim().toLowerCase()
      const value = rest.join(':').trim()

      if (key === 'user-agent') {
        currentAgents = [value.toLowerCase()]
        rules[value.toLowerCase()] ??= []
        continue
      }

      if (key === 'disallow' && value) {
        for (const agent of currentAgents) {
          rules[agent] ??= []
          rules[agent].push({ path: value, allow: false })
        }
        continue
      }

      if (key === 'allow' && value) {
        for (const agent of currentAgents) {
          rules[agent] ??= []
          rules[agent].push({ path: value, allow: true })
        }
      }
    }
  } catch (err) {
    console.warn(`No se pudo leer robots.txt de ${baseUrl}:`, err)
  }

  cache.set(baseUrl, { rules, fetchedAt: Date.now() })
  return rules
}

/**
 * Determina si `path` puede ser scrapeado según robots.txt de `baseUrl`
 * para el `userAgent` dado (o el grupo "*" si no hay reglas específicas).
 * Ante reglas contradictorias, gana la más específica (path más largo).
 */
export async function isAllowedByRobots(
  baseUrl: string,
  path: string,
  userAgent = 'jobmatchcobot'
): Promise<boolean> {
  const rules = await fetchRobotsTxt(baseUrl)

  const agentKey = Object.keys(rules).find((a) =>
    userAgent.toLowerCase().includes(a)
  )
  const applicable = [...(rules[agentKey ?? ''] ?? []), ...(rules['*'] ?? [])]

  if (applicable.length === 0) return true

  let bestMatch: RobotsRule | null = null
  for (const rule of applicable) {
    if (path.startsWith(rule.path)) {
      if (!bestMatch || rule.path.length > bestMatch.path.length) {
        bestMatch = rule
      }
    }
  }

  return bestMatch ? bestMatch.allow : true
}
