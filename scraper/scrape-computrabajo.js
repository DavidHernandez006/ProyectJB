/**
 * scrape-computrabajo.js
 *
 * Scraper de ofertas de empleo en co.computrabajo.com para JobMatch CO.
 * Busca "desarrollador software" en Bogotá, recorre las primeras 3 páginas
 * de resultados y extrae: titulo, empresa, ubicacion, salario, descripcion,
 * url y fecha de publicación.
 *
 * NUEVO: antes de scrapear, verifica robots.txt con robots-checker.js.
 * Si la ruta de búsqueda está bloqueada, el script aborta sin hacer ningún
 * request adicional al portal.
 *
 * IMPORTANTE ANTES DE USARLO:
 * 1. Este script ya verifica robots.txt automáticamente (ver robots-checker.js).
 *    Aun así, revisa también los Términos de Uso del portal.
 * 2. Los selectores CSS de abajo son un punto de partida razonable para la
 *    estructura típica de Computrabajo, pero los portales cambian su HTML
 *    frecuentemente. Antes de confiar en los resultados, corre el script
 *    una vez con `headless: false`, abre el DevTools y confirma/ajusta los
 *    selectores marcados con "// AJUSTAR SI CAMBIA EL HTML".
 * 3. Este scraper es solo para fines informativos/personales de búsqueda de
 *    empleo. No lo uses para republicar contenido de terceros ni a una
 *    frecuencia que sobrecargue el portal.
 *
 * Uso:
 *   npm install puppeteer
 *   node scrape-computrabajo.js
 *
 * Salida:
 *   ./output/computrabajo-ofertas-<timestamp>.json
 *
 * Luego, para sincronizar con Supabase:
 *   node upsert-offers.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { isAllowedByRobots } = require('./robots-checker');

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------
const CONFIG = {
  baseUrl: 'https://co.computrabajo.com',
  searchTerm: 'desarrollador software',
  city: 'Bogotá',
  maxPages: 3,
  minDelayMs: 2000, // rate limit: mínimo 2s entre navegaciones
  maxDelayMs: 4500, // jitter aleatorio para no ser demasiado predecible
  navigationTimeoutMs: 30000,
  maxRetriesPerPage: 3,
  outputDir: path.join(__dirname, 'output'),
  userAgent: 'JobMatchCOBot/1.0',
};

// Rotación básica de user-agents (navegadores/versiones reales y comunes)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function buildSearchUrl(page) {
  // Estructura típica de búsqueda de Computrabajo:
  // https://co.computrabajo.com/trabajo-de-<termino>-en-<ciudad>
  // con paginación vía ?p=<n>
  const slugTerm = slugify(CONFIG.searchTerm);
  const slugCity = slugify(CONFIG.city);
  const path_ = `/trabajo-de-${slugTerm}-en-${slugCity}`;
  const url = new URL(path_, CONFIG.baseUrl);
  if (page > 1) {
    url.searchParams.set('p', String(page));
  }
  return url.toString();
}

async function withRetries(fn, retries, label) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`[retry ${attempt}/${retries}] ${label} falló: ${err.message}`);
      if (attempt < retries) {
        await sleep(randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs));
      }
    }
  }
  throw lastError;
}

// ------------------------------------------------------------------
// Extracción de una página de resultados
// ------------------------------------------------------------------
async function extractOffersFromPage(page) {
  // AJUSTAR SI CAMBIA EL HTML: contenedor de cada tarjeta de oferta.
  // Computrabajo suele usar artículos con clase "box_offer" dentro de
  // un contenedor de resultados.
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll(
        'article.box_offer, div.box_offer, article[data-id]'
      )
    );

    return cards
      .map((card) => {
        const titleEl = card.querySelector('h2 a, h1 a, a.js-o-link');
        const companyEl = card.querySelector('.dFlex a, .fs16, p.fs16 a, a.fc_base');
        const locationEl = card.querySelector('.fs13.mt5, p.fs13, .icon-location + span');
        const salaryEl = card.querySelector('.fs13.icon-money, span.icon-money');
        const descriptionEl = card.querySelector('p.fs16.mt15, p.mt10, .fs16.mb10');
        const dateEl = card.querySelector('.fs13.fc_aux, span.fs13.dIB');

        const title = titleEl ? titleEl.textContent.trim() : null;
        const relativeUrl = titleEl ? titleEl.getAttribute('href') : null;
        const url = relativeUrl
          ? new URL(relativeUrl, window.location.origin).toString()
          : null;

        return {
          titulo: title,
          empresa: companyEl ? companyEl.textContent.trim() : null,
          ubicacion: locationEl ? locationEl.textContent.trim() : null,
          salario: salaryEl ? salaryEl.textContent.trim() : null,
          descripcion: descriptionEl ? descriptionEl.textContent.trim() : null,
          url,
          fecha: dateEl ? dateEl.textContent.trim() : null,
        };
      })
      .filter((offer) => offer.titulo && offer.url); // descarta tarjetas vacías/rotas
  });
}

// ------------------------------------------------------------------
// Scraping de una página con reintentos y verificación de bloqueo
// ------------------------------------------------------------------
async function scrapePage(browser, pageNumber) {
  const url = buildSearchUrl(pageNumber);
  console.log(`\n[página ${pageNumber}] Navegando a: ${url}`);

  return withRetries(
    async () => {
      const page = await browser.newPage();
      try {
        await page.setUserAgent(pickUserAgent());
        await page.setViewport({ width: 1366, height: 900 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-CO,es;q=0.9' });

        // Bloquea recursos pesados para acelerar y reducir huella de red
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const type = req.resourceType();
          if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
            req.abort();
          } else {
            req.continue();
          }
        });

        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.navigationTimeoutMs,
        });

        if (!response || !response.ok()) {
          throw new Error(
            `Respuesta HTTP no válida: ${response ? response.status() : 'sin respuesta'}`
          );
        }

        // Detección básica de bloqueo / captcha / rate limit
        const blocked = await page.evaluate(() => {
          const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
          return (
            bodyText.includes('captcha') ||
            bodyText.includes('acceso denegado') ||
            bodyText.includes('too many requests')
          );
        });

        if (blocked) {
          throw new Error('Posible bloqueo/captcha detectado en la respuesta.');
        }

        // Espera a que haya al menos una tarjeta de oferta o se agote el timeout
        await page
          .waitForSelector('article.box_offer, div.box_offer, article[data-id]', {
            timeout: 10000,
          })
          .catch(() => {
            console.warn(
              `[página ${pageNumber}] No se encontraron tarjetas con los selectores esperados (revisa el HTML actual).`
            );
          });

        const offers = await extractOffersFromPage(page);
        console.log(`[página ${pageNumber}] Ofertas extraídas: ${offers.length}`);
        return offers;
      } finally {
        await page.close();
      }
    },
    CONFIG.maxRetriesPerPage,
    `scrape página ${pageNumber}`
  );
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  console.log('=== Scraper Computrabajo — JobMatch CO ===');
  console.log(`Búsqueda: "${CONFIG.searchTerm}" en ${CONFIG.city}`);
  console.log(`Páginas a recorrer: ${CONFIG.maxPages}`);

  // Verificación de robots.txt ANTES de lanzar el navegador.
  const searchPath = new URL(buildSearchUrl(1)).pathname;
  console.log(`\nVerificando robots.txt para ${CONFIG.baseUrl}${searchPath} ...`);
  const permitido = await isAllowedByRobots(CONFIG.baseUrl, searchPath, CONFIG.userAgent);

  if (!permitido) {
    console.error(
      `\nrobots.txt de ${CONFIG.baseUrl} NO permite scrapear "${searchPath}". Abortando sin hacer requests adicionales.`
    );
    process.exit(1);
  }
  console.log('robots.txt permite esta ruta. Continuando...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const allOffers = [];
  const errors = [];

  try {
    for (let pageNumber = 1; pageNumber <= CONFIG.maxPages; pageNumber++) {
      try {
        const offers = await scrapePage(browser, pageNumber);
        allOffers.push(...offers);
      } catch (err) {
        console.error(`[página ${pageNumber}] Falló tras reintentos: ${err.message}`);
        errors.push({ page: pageNumber, error: err.message });
        // Continúa con la siguiente página en vez de abortar todo el proceso
      }

      // Rate limiting: espera entre requests, incluso después de la última página
      if (pageNumber < CONFIG.maxPages) {
        const delay = randomDelay(CONFIG.minDelayMs, CONFIG.maxDelayMs);
        console.log(`Esperando ${delay}ms antes de la siguiente página...`);
        await sleep(delay);
      }
    }
  } finally {
    await browser.close();
  }

  // Deduplicar por URL (por si una oferta aparece repetida entre páginas)
  const seen = new Set();
  const uniqueOffers = allOffers.filter((offer) => {
    if (!offer.url || seen.has(offer.url)) return false;
    seen.add(offer.url);
    return true;
  });

  const result = {
    metadata: {
      fuente: 'co.computrabajo.com',
      termino_busqueda: CONFIG.searchTerm,
      ciudad: CONFIG.city,
      paginas_recorridas: CONFIG.maxPages,
      total_ofertas: uniqueOffers.length,
      errores: errors,
      generado_en: new Date().toISOString(),
    },
    ofertas: uniqueOffers,
  };

  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(
    CONFIG.outputDir,
    `computrabajo-ofertas-${timestamp}.json`
  );

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

  console.log(`\n=== Resumen ===`);
  console.log(`Ofertas únicas extraídas: ${uniqueOffers.length}`);
  console.log(`Errores: ${errors.length}`);
  console.log(`Guardado en: ${outputPath}`);
  console.log(`\nSiguiente paso: node upsert-offers.js`);
}

main().catch((err) => {
  console.error('Error fatal en el scraper:', err);
  process.exit(1);
});
