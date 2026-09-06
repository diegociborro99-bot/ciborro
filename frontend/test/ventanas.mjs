/**
 * Pruebas del gestor de ventanas, contra el sitio construido y en un navegador
 * de verdad.
 *
 * Sólo se prueba esto y no el resto del sitio a propósito: el gestor es la
 * pieza con más estado del proyecto —posición, tamaño, foco, anclaje,
 * maximizado, minimizado, memoria entre visitas— y es de donde han salido
 * todos los fallos que han llegado a producción. Lo demás se ve mirándolo; esto
 * no: se rompe en la sexta interacción, con una ventana concreta y en el orden
 * concreto en que abriste las cosas.
 *
 *   npm run build && npm test
 *
 * Levanta el `preview` por su cuenta, prueba y lo apaga. En CI, Playwright
 * encuentra su Chromium solo; aquí se le puede señalar otro con CHROME_PATH.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUERTO = Number(process.env.PORT ?? 4173)
const URL = `http://127.0.0.1:${PUERTO}/`

if (!existsSync(path.join(raiz, 'dist', 'index.html'))) {
  console.error('No hay dist/. Ejecuta antes:  npm run build')
  process.exit(1)
}

/* ── el servidor ────────────────────────────────────────────────────── */

const servidor = spawn('npm', ['run', 'preview', '--', '--port', String(PUERTO)], {
  cwd: raiz,
  stdio: 'ignore',
})
const apagar = () => servidor.kill('SIGTERM')
process.on('exit', apagar)
process.on('SIGINT', () => process.exit(130))

// esperar a que conteste, en vez de dormir una cifra al azar
for (let i = 0; ; i++) {
  try {
    const r = await fetch(URL)
    if (r.ok) break
  } catch {
    /* todavía no */
  }
  if (i > 60) {
    console.error('El servidor de preview no arrancó')
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 250))
}

/* ── utilidades ─────────────────────────────────────────────────────── */

let bien = 0
let mal = 0
const fallos = []
const comprobar = (nombre, cond, detalle = '') => {
  if (cond) {
    bien++
    console.log(`  ✓ ${nombre}`)
  } else {
    mal++
    fallos.push(`${nombre} ${detalle}`.trim())
    console.log(`  ✗ ${nombre} ${detalle}`)
  }
}
const grupo = (t) => console.log(`\n— ${t} —`)

const navegador = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
})

/** Pestaña nueva, ya arrancada (el telón de inicio dura ~3 s). */
const pestana = async (ancho = 1440, alto = 900, hash = '') => {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } })
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => fallos.push('ERROR DE PÁGINA: ' + e.message))
  await pg.goto(URL + hash, { waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  return { ctx, pg }
}

/* Idempotente a propósito: el dock alterna, y al recargar la URL (#consola)
   puede haber reabierto ya esa ventana. Pulsar a ciegas la cerraría. */
const abrir = async (pg, titulo) => {
  const abierta = await pg.evaluate(
    (t) => [...document.querySelectorAll('[role="dialog"]')].some((n) => n.getAttribute('aria-label') === t),
    titulo
  )
  if (abierta) return
  await pg.locator(`.dock-slot[aria-label^="${titulo}"]`).first().click()
  await pg.waitForTimeout(320)
}

const donde = (pg, titulo) =>
  pg.evaluate((t) => {
    const e = [...document.querySelectorAll('[role="dialog"]')].find((n) => n.getAttribute('aria-label') === t)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  }, titulo)

const arrastrarBarra = async (pg, g, x, y, pasos = 12) => {
  await pg.mouse.move(g.x + g.w / 2, g.y + 18)
  await pg.mouse.down()
  await pg.mouse.move(x, y, { steps: pasos })
  await pg.mouse.up()
  await pg.waitForTimeout(500)
}

/* ── dónde nacen ────────────────────────────────────────────────────── */

grupo('nacen centradas, y sin enterrarse unas a otras')
{
  const TODAS = ['Fotos', 'Sobre mí', 'Otras cosas', 'Música', 'Pastorea a los gatos', 'Consola', 'Léeme']
  const ORDENES = [TODAS, [...TODAS].reverse(), ['Léeme', 'Consola', 'Pastorea a los gatos', 'Música', 'Otras cosas', 'Sobre mí', 'Fotos']]

  for (const [ancho, alto] of [[1440, 900], [1280, 800], [1024, 700]]) {
    for (const [n, orden] of ORDENES.entries()) {
      const { ctx, pg } = await pestana(ancho, alto)
      for (const t of orden) await abrir(pg, t)
      const wins = await pg.evaluate(() =>
        [...document.querySelectorAll('[role="dialog"]')].map((e) => {
          const r = e.getBoundingClientRect()
          return {
            t: e.getAttribute('aria-label'),
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
            z: +getComputedStyle(e).zIndex || 0,
          }
        })
      )
      const problemas = []
      for (const a of wins) {
        for (const c of wins) {
          if (c === a || c.z <= a.z) continue
          // una barra de título sólo se puede tapar desde arriba
          if (c.x <= a.x && c.x + c.w >= a.x + a.w && c.y < a.y + 14 && c.y + c.h > a.y) {
            problemas.push(`«${c.t}» entierra la barra de «${a.t}»`)
          }
        }
        for (const o of wins) {
          if (o !== a && Math.abs(o.x - a.x) < 8 && Math.abs(o.y - a.y) < 8) {
            problemas.push(`«${a.t}» y «${o.t}» en el mismo punto`)
          }
        }
        if (a.x < -2 || a.x + a.w > ancho + 2) problemas.push(`«${a.t}» se sale por el lado`)
      }
      const centro = wins.reduce((s, w) => s + w.x + w.w / 2, 0) / wins.length
      comprobar(
        `${ancho}x${alto} orden ${n}: ${wins.length} ventanas, ninguna enterrada`,
        problemas.length === 0,
        [...new Set(problemas)].join(' · ')
      )
      comprobar(`${ancho}x${alto} orden ${n}: el conjunto queda centrado`, Math.abs(centro - ancho / 2) < 2, `centro ${Math.round(centro)} de ${ancho / 2}`)
      await ctx.close()
    }
  }
}

grupo('una sola sale centrada exacta')
{
  for (const t of ['Fotos', 'Música']) {
    const { ctx, pg } = await pestana()
    await abrir(pg, t)
    const g = await donde(pg, t)
    comprobar(`«${t}» centrada`, Math.abs(g.x + g.w / 2 - 720) < 2, `centro ${g.x + g.w / 2}`)
    await ctx.close()
  }
}

/* ── estados ────────────────────────────────────────────────────────── */

grupo('minimizar y restaurar')
{
  const { ctx, pg } = await pestana()
  await abrir(pg, 'Fotos')
  const antes = await donde(pg, 'Fotos')
  await pg.locator('[role="dialog"] [aria-label="Minimizar"]').first().click()
  await pg.waitForTimeout(500)
  comprobar('desaparece al minimizar', (await donde(pg, 'Fotos')) === null)
  await abrir(pg, 'Fotos')
  comprobar('vuelve al mismo sitio', JSON.stringify(antes) === JSON.stringify(await donde(pg, 'Fotos')))
  await ctx.close()
}

grupo('maximizar, restaurar y recargar')
{
  const { ctx, pg } = await pestana()
  await abrir(pg, 'Consola')
  const antes = await donde(pg, 'Consola')
  await pg.locator('[role="dialog"] [aria-label="Maximizar"]').first().click()
  await pg.waitForTimeout(500)
  comprobar('maximiza de verdad', (await donde(pg, 'Consola')).w > antes.w + 200)
  await pg.locator('[role="dialog"] [aria-label="Restaurar"]').first().click()
  await pg.waitForTimeout(500)
  comprobar('restaura al tamaño de antes', JSON.stringify(await donde(pg, 'Consola')) === JSON.stringify(antes))

  /* Maximizada + recarga. El estado «maximizada» no se persiste, así que si se
     guardara su geometría volvería con el tamaño de la pantalla pero sin serlo,
     y sin nada a lo que restaurar. */
  await pg.locator('[role="dialog"] [aria-label="Maximizar"]').first().click()
  await pg.waitForTimeout(500)
  await pg.reload({ waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  await abrir(pg, 'Consola')
  const tras = await donde(pg, 'Consola')
  comprobar('tras recargar no vuelve gigante', tras && tras.w <= antes.w + 40, `ancho ${tras && tras.w}`)
  await ctx.close()
}

grupo('anclar arrastrando a un borde')
{
  const { ctx, pg } = await pestana()
  await abrir(pg, 'Léeme')
  const g = await donde(pg, 'Léeme')
  await pg.mouse.move(g.x + g.w / 2, g.y + 18)
  await pg.mouse.down()
  await pg.mouse.move(40, 400, { steps: 12 })
  await pg.mouse.move(3, 400, { steps: 6 })
  await pg.mouse.up()
  await pg.waitForTimeout(600)
  const anclada = await donde(pg, 'Léeme')
  comprobar('se ancla a media pantalla', anclada.x <= 12 && Math.abs(anclada.w - 720) < 60, JSON.stringify(anclada))
  await pg.reload({ waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  await abrir(pg, 'Léeme')
  const vuelta = await donde(pg, 'Léeme')
  comprobar('y el anclaje se recuerda', Math.abs(vuelta.x - anclada.x) < 12 && Math.abs(vuelta.w - anclada.w) < 12)
  await ctx.close()
}

/* ── memoria ────────────────────────────────────────────────────────── */

grupo('lo que coloca el visitante se recuerda; lo demás no')
{
  const { ctx, pg } = await pestana()
  await abrir(pg, 'Música')
  const inicial = await donde(pg, 'Música')
  await arrastrarBarra(pg, inicial, 300, 300)
  const movida = await donde(pg, 'Música')
  comprobar('se mueve al arrastrar', Math.abs(movida.x - inicial.x) > 50)
  await pg.reload({ waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  await abrir(pg, 'Música')
  const recordada = await donde(pg, 'Música')
  comprobar('vuelve donde se dejó', Math.abs(recordada.x - movida.x) < 6 && Math.abs(recordada.y - movida.y) < 6)
  await ctx.close()
}
{
  /* Si la posición de estreno se guardara, dos apps estrenadas por separado
     —cada una centrada en su momento— volverían al mismo punto exacto, una
     tapando a la otra. */
  const { ctx, pg } = await pestana()
  await abrir(pg, 'Fotos')
  const fotos = await donde(pg, 'Fotos')
  await abrir(pg, 'Sobre mí')
  await pg.reload({ waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  await abrir(pg, 'Sobre mí')
  const sola = await donde(pg, 'Sobre mí')
  comprobar('la que no se tocó vuelve a centrarse', Math.abs(sola.x + sola.w / 2 - 720) < 4)
  comprobar('y no hereda el sitio de estreno de otra', !(sola.x === fotos.x && sola.y === fotos.y))
  await ctx.close()
}

grupo('un almacén corrupto no deja el sitio inservible')
{
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => fallos.push('ERROR DE PÁGINA: ' + e.message))
  await pg.goto(URL, { waitUntil: 'domcontentloaded' })
  await pg.evaluate(() =>
    localStorage.setItem('win-layout-v3', JSON.stringify({ gallery: { x: 10, y: null, w: 'x' }, about: 'basura' }))
  )
  await pg.reload({ waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  await abrir(pg, 'Fotos')
  const g = await donde(pg, 'Fotos')
  comprobar('nada de ventanas de NaN', g && Number.isFinite(g.w) && g.w > 100 && Number.isFinite(g.x), JSON.stringify(g))
  comprobar('y sale centrada, ignorando la basura', g && Math.abs(g.x + g.w / 2 - 720) < 6)
  await ctx.close()
}

/* ── pantalla ───────────────────────────────────────────────────────── */

grupo('vista general (F) y vuelta')
{
  const { ctx, pg } = await pestana()
  for (const t of ['Fotos', 'Consola', 'Música']) await abrir(pg, t)
  const antes = await donde(pg, 'Consola')
  await pg.keyboard.press('f')
  await pg.waitForTimeout(700)
  comprobar('reparte las ventanas', JSON.stringify(await donde(pg, 'Consola')) !== JSON.stringify(antes))
  await pg.keyboard.press('Escape')
  await pg.waitForTimeout(800)
  comprobar('al salir vuelven exactamente donde estaban', JSON.stringify(await donde(pg, 'Consola')) === JSON.stringify(antes))
  await ctx.close()
}

grupo('móvil, y volver al escritorio')
{
  const ctx = await navegador.newContext({ viewport: { width: 500, height: 800 } })
  const pg = await ctx.newPage()
  pg.on('pageerror', (e) => fallos.push('ERROR DE PÁGINA: ' + e.message))
  await pg.goto(URL, { waitUntil: 'networkidle' })
  await pg.waitForTimeout(4300)
  await abrir(pg, 'Fotos')
  comprobar('en móvil ocupa casi toda la pantalla', (await donde(pg, 'Fotos')).w > 440)
  /* Sin rehacer el reparto al cruzar el umbral, una ventana abierta en el móvil
     volvía al escritorio como una tira pegada al canto izquierdo, para siempre. */
  await pg.setViewportSize({ width: 1440, height: 900 })
  await pg.waitForTimeout(800)
  const g = await donde(pg, 'Fotos')
  comprobar('al volver al escritorio se recentra', Math.abs(g.x + g.w / 2 - 720) < 40, `centro ${g.x + g.w / 2}`)
  await ctx.close()
}
{
  const { ctx, pg } = await pestana(360, 740)
  for (const t of ['Pastorea a los gatos', 'Música']) await abrir(pg, t)
  const wins = await pg.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"]')].map((e) => {
      const r = e.getBoundingClientRect()
      return { t: e.getAttribute('aria-label'), der: Math.round(r.right), abajo: Math.round(r.bottom) }
    })
  )
  // el mínimo de estas dos (380 de ancho, 500 de alto) no cabe en 360x740
  comprobar('a 360 px ninguna se sale ni se mete bajo el dock', wins.every((w) => w.der <= 360 && w.abajo <= 740 - 70), JSON.stringify(wins))
  await ctx.close()
}

/* ── enlaces ────────────────────────────────────────────────────────── */

grupo('enlaces profundos')
{
  const { ctx, pg } = await pestana(1440, 900, '#fotos/5')
  const contador = await pg.evaluate(() =>
    [...document.querySelectorAll('.tnum')].map((e) => e.textContent.trim()).find((t) => /^\d\d \/ \d\d$/.test(t))
  )
  comprobar('#fotos/5 abre el visor en la quinta', contador === '05 / 12', String(contador))
  await ctx.close()
}
{
  const { ctx, pg } = await pestana(1440, 900, '#consola')
  const wins = await pg.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((e) => e.getAttribute('aria-label')))
  comprobar('#consola abre sólo la consola', wins.length === 1 && wins[0] === 'Consola', JSON.stringify(wins))
  await ctx.close()
}
{
  const { ctx, pg } = await pestana()
  const wins = await pg.evaluate(() => document.querySelectorAll('[role="dialog"]').length)
  comprobar('sin hash, el escritorio arranca vacío', wins === 0, String(wins))
  await ctx.close()
}

/* ── final ──────────────────────────────────────────────────────────── */

await navegador.close()
apagar()

console.log(`\n${bien} pasan · ${mal} fallan`)
if (fallos.length) console.log('\n- ' + fallos.join('\n- '))
process.exit(mal || fallos.length ? 1 : 0)
