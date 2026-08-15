/**
 * robots-checker.js
 *
 * Versión CommonJS de src/lib/scraping/robots-checker.ts, para usarse desde
 * scripts standalone que corren con `node scrape-computrabajo.js` fuera del
 * runtime de Next.js. Mantener ambas en sync si cambia la lógica.
 */

const cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

async function fetchRobotsTxt(baseUrl) {
  const cached = cache.get(baseUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rules;
  }

  const robotsUrl = new URL('/robots.txt', baseUrl).toString();
  const rules = {};

  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'JobMatchCOBot/1.0' },
    });
    if (!res.ok) {
      cache.set(baseUrl, { rules, fetchedAt: Date.now() });
      return rules;
    }

    const text = await res.text();
    let currentAgents = [];

    for (const rawLine of text.split('\n')) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const [rawKey, ...rest] = line.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();

      if (key === 'user-agent') {
        currentAgents = [value.toLowerCase()];
        rules[value.toLowerCase()] = rules[value.toLowerCase()] || [];
        continue;
      }
      if (key === 'disallow' && value) {
        for (const agent of currentAgents) {
          rules[agent] = rules[agent] || [];
          rules[agent].push({ path: value, allow: false });
        }
        continue;
      }
      if (key === 'allow' && value) {
        for (const agent of currentAgents) {
          rules[agent] = rules[agent] || [];
          rules[agent].push({ path: value, allow: true });
        }
      }
    }
  } catch (err) {
    console.warn(`No se pudo leer robots.txt de ${baseUrl}:`, err.message);
  }

  cache.set(baseUrl, { rules, fetchedAt: Date.now() });
  return rules;
}

async function isAllowedByRobots(baseUrl, path, userAgent) {
  userAgent = userAgent || 'jobmatchcobot';
  const rules = await fetchRobotsTxt(baseUrl);
  const agentKey = Object.keys(rules).find((a) =>
    userAgent.toLowerCase().includes(a)
  );
  const applicable = [...(rules[agentKey || ''] || []), ...(rules['*'] || [])];

  if (applicable.length === 0) return true;

  let bestMatch = null;
  for (const rule of applicable) {
    if (path.startsWith(rule.path)) {
      if (!bestMatch || rule.path.length > bestMatch.path.length) {
        bestMatch = rule;
      }
    }
  }

  return bestMatch ? bestMatch.allow : true;
}

module.exports = { isAllowedByRobots };
