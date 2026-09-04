import { useEffect, useMemo, useRef, useState } from 'react'
import { useContent } from '../lib/content'
import { slug } from '../lib/slug'

/**
 * Consola.
 *
 * Ya no es una lista de comandos sueltos: hay un árbol de archivos de verdad
 * construido a partir de `src/data/content.js`, y se recorre con cd/ls/pwd/cat
 * como en cualquier terminal. El prompt muestra dónde estás, Tab completa
 * comandos y rutas, y mientras escribes se ve en gris lo que falta por teclear.
 *
 * `cat` sobre una foto dibuja su miniatura con bloques de color.
 */

/* ── árbol ─────────────────────────────────────────────────────────── */

const dir = (children) => ({ type: 'dir', children })

/** Minúsculas y sin tildes: buscar «gijon» tiene que encontrar «Gijón». */
const fold = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function buildTree({ owner, photos, projects, tracks }) {
  const years = {}
  for (const p of photos) {
    years[p.year] ??= {}
    years[p.year][`${slug(p.title)}.jpg`] = { type: 'photo', photo: p }
  }

  return dir({
    fotos: dir(Object.fromEntries(Object.entries(years).sort().map(([y, f]) => [y, dir(f)]))),
    proyectos: dir(
      Object.fromEntries(projects.map((p) => [`${slug(p.title)}.md`, { type: 'project', project: p }]))
    ),
    musica: dir(Object.fromEntries(tracks.map((t) => [`${slug(t.title)}.mp3`, { type: 'track', track: t }]))),
    'sobre-mi.txt': { type: 'text', body: () => owner.bio.join('\n\n') },
    'leeme.txt': {
      type: 'text',
      body: () =>
        [
          'Todo el contenido del sitio sale de src/data/content.js.',
          'Abre la app «Léeme» (7) para el detalle, o escribe «ayuda» aquí.',
        ].join('\n'),
    },
  })
}

/** Resuelve una ruta (absoluta, relativa, con . y .. y ~) sobre el árbol. */
function resolve(tree, cwd, path) {
  const parts = (path ?? '').split('/')
  let segs = path?.startsWith('/') || path?.startsWith('~') ? [] : [...cwd]
  for (const raw of parts) {
    const s = raw.trim()
    if (!s || s === '.' || s === '~') continue
    if (s === '..') segs.pop()
    else segs.push(s)
  }
  let node = tree
  for (const s of segs) {
    if (node.type !== 'dir' || !node.children[s]) return null
    node = node.children[s]
  }
  return { node, segs }
}

const nodeLabel = (name, node) =>
  node.type === 'dir' ? `${name}/` : name

function describe(node) {
  if (node.type === 'dir') return `${Object.keys(node.children).length} elementos`
  if (node.type === 'photo') return `${node.photo.place} · ${node.photo.year}`
  if (node.type === 'project') return `${node.project.kind} · ${node.project.year}`
  if (node.type === 'track') return `${Math.floor(node.track.dur / 60)}:${String(node.track.dur % 60).padStart(2, '0')}`
  return 'texto'
}

/* ── miniatura en bloques ──────────────────────────────────────────── */

function photoBlocks(photo, cols = 26, rows = 11) {
  const [a, b] = photo.placeholder ?? ['#241f19', '#8d7346']
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const A = hex(a)
  const B = hex(b)

  let h = 2166136261
  for (const ch of photo.id + photo.title) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }

  // dos manchas suaves, como el marcador de la galería
  const blobs = Array.from({ length: 3 }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.18 + rnd() * 0.3,
    w: rnd(),
  }))

  const grid = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1)
      const v = r / (rows - 1)
      let t = v * 0.75 + u * 0.25
      for (const bl of blobs) {
        const d = Math.hypot(u - bl.x, (v - bl.y) * 0.8)
        if (d < bl.r) t += (1 - d / bl.r) * (bl.w - 0.5) * 0.5
      }
      t = Math.max(0, Math.min(1, t))
      row.push(
        `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(
          A[2] + (B[2] - A[2]) * t
        )})`
      )
    }
    grid.push(row)
  }
  return grid
}

/* ── componente ────────────────────────────────────────────────────── */

export default function Terminal({ sys }) {
  const content = useContent()
  const { owner, photos } = content
  const tree = useMemo(() => buildTree(content), [content])
  const [cwd, setCwd] = useState([])
  const [lines, setLines] = useState(() => [
    { k: 'sys', t: `escritorio de ${owner.name.split(' ')[0].toLowerCase()} · consola` },
    { k: 'sys', t: 'prueba con «ls», «cd fotos» o «ayuda». Tab completa.' },
  ])
  const [value, setValue] = useState('')
  const [hist, setHist] = useState([])
  const [hi, setHi] = useState(-1)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const push = (...items) => setLines((ls) => [...ls.slice(-260), ...items])

  const api = useMemo(
    () => ({ tree, cwd, setCwd, push, setLines, sys, owner, photos }),
    // `cwd` entra a propósito: los comandos resuelven rutas contra él
    [tree, cwd, sys, owner, photos]
  )
  const commands = useMemo(() => buildCommands(api), [api])
  const names = useMemo(() => Object.keys(commands).filter((n) => commands[n].help), [commands])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [])

  const prompt = `~${cwd.length ? '/' + cwd.join('/') : ''}`

  /* — completado — */
  const completion = useMemo(() => {
    const m = /^(\s*)(\S*)(\s+)?(.*)$/.exec(value)
    if (!m) return ''
    const [, , cmd, gap, rest] = m
    // primera palabra: nombres de comando
    if (!gap) {
      if (!cmd) return ''
      const hit = names.filter((n) => n.startsWith(cmd))
      return hit.length ? common(hit).slice(cmd.length) : ''
    }
    // argumento: rutas
    if (!commands[cmd]?.paths) return ''
    const at = rest.lastIndexOf('/')
    const base = at >= 0 ? rest.slice(0, at + 1) : ''
    const frag = at >= 0 ? rest.slice(at + 1) : rest
    const here = resolve(tree, cwd, base || '.')
    if (!here || here.node.type !== 'dir') return ''
    const hit = Object.keys(here.node.children).filter((n) => n.startsWith(frag))
    if (!hit.length) return ''
    const c = common(hit)
    const only = hit.length === 1 ? (here.node.children[hit[0]].type === 'dir' ? '/' : '') : ''
    return c.slice(frag.length) + only
  }, [value, names, commands, tree, cwd])

  const submit = (raw) => {
    const input = raw.trim()
    push({ k: 'in', t: input, prompt })
    setValue('')
    if (!input) return
    setHist((h) => [input, ...h].slice(0, 80))
    setHi(-1)

    const [name, ...args] = input.split(/\s+/)
    const cmd = commands[name.toLowerCase()]
    if (!cmd) {
      const near = names.find((n) => n.startsWith(name[0]) && Math.abs(n.length - name.length) < 3)
      push({ k: 'err', t: `no conozco «${name}».${near ? ` ¿querías decir «${near}»?` : ' prueba con «ayuda».'}` })
      return
    }
    cmd.run(args)
  }

  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit(value)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (completion) setValue(value + completion)
      else listMatches()
    } else if (e.key === 'ArrowRight' && completion && e.currentTarget.selectionStart === value.length) {
      e.preventDefault()
      setValue(value + completion)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((n) => {
        const next = Math.min(hist.length - 1, n + 1)
        if (hist[next] != null) setValue(hist[next])
        return next
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((n) => {
        const next = Math.max(-1, n - 1)
        setValue(next === -1 ? '' : (hist[next] ?? ''))
        return next
      })
    } else if (e.key.toLowerCase() === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setLines([])
    } else if (e.key.toLowerCase() === 'c' && e.ctrlKey) {
      e.preventDefault()
      push({ k: 'in', t: value + ' ^C', prompt })
      setValue('')
    }
  }

  const listMatches = () => {
    const parts = value.trim().split(/\s+/)
    if (parts.length <= 1) {
      push({ k: 'out', t: names.join('  ') })
      return
    }
    const here = resolve(tree, cwd, '.')
    if (here?.node.type === 'dir') push({ k: 'out', t: Object.keys(here.node.children).join('  ') })
  }

  return (
    <div
      className="scroll-thin h-full overflow-auto px-4 py-3 text-[12.5px] leading-[1.62]"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: 'var(--bg-deep)' }}
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((l, i) => (
        <Line key={i} l={l} />
      ))}

      <div className="relative flex items-center gap-1.5">
        <span className="shrink-0 whitespace-pre" style={{ color: 'var(--accent-2)' }}>
          {prompt}
        </span>
        <span className="shrink-0" style={{ color: 'var(--accent)' }}>
          ❯
        </span>
        <span className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            spellCheck="false"
            autoComplete="off"
            autoCapitalize="off"
            aria-label="Línea de comandos"
            className="w-full bg-transparent outline-none focus-visible:outline-none"
            style={{ color: 'var(--tx)', font: 'inherit', caretColor: 'var(--accent)' }}
          />
          {/* lo que falta por escribir, en gris, alineado bajo el campo */}
          {completion && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 whitespace-pre"
              style={{ font: 'inherit', color: 'transparent' }}
            >
              {value}
              <span style={{ color: 'var(--tx-3)' }}>{completion}</span>
            </span>
          )}
        </span>
      </div>
      <div ref={endRef} />
    </div>
  )
}

function Line({ l }) {
  if (l.k === 'img') {
    const grid = photoBlocks(l.photo)
    // cada fila es un solo degradado de saltos duros: sin costuras entre celdas
    return (
      <div className="my-1.5 inline-block overflow-hidden rounded-[3px]" style={{ border: '1px solid var(--line)' }}>
        {grid.map((row, r) => (
          <div
            key={r}
            style={{
              height: 9,
              width: row.length * 8,
              background: `linear-gradient(90deg, ${row
                .map((c, i) => `${c} ${(i / row.length) * 100}% ${((i + 1) / row.length) * 100}%`)
                .join(', ')})`,
            }}
          />
        ))}
      </div>
    )
  }

  if (l.k === 'ls') {
    return (
      <div className="my-0.5 grid gap-x-6" style={{ gridTemplateColumns: 'max-content 1fr' }}>
        {l.entries.map((e, i) => (
          <div key={i} className="contents">
            <span style={{ color: e.dir ? 'var(--accent-2)' : 'var(--tx)' }}>{e.name}</span>
            <span style={{ color: 'var(--tx-3)' }}>{e.meta}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <p
      className="break-words whitespace-pre-wrap"
      style={{
        color:
          l.k === 'err' ? '#d98b7f' : l.k === 'sys' ? 'var(--tx-3)' : l.k === 'in' ? 'var(--tx)' : 'var(--tx-2)',
      }}
    >
      {l.k === 'in' && (
        <>
          <span style={{ color: 'var(--accent-2)' }}>{l.prompt}</span>
          <span style={{ color: 'var(--accent)' }}> ❯ </span>
        </>
      )}
      {l.t}
    </p>
  )
}

const common = (list) => {
  let p = list[0] ?? ''
  for (const s of list) {
    while (!s.startsWith(p)) p = p.slice(0, -1)
  }
  return p
}

/* ── comandos ──────────────────────────────────────────────────────── */

function buildCommands({ tree, cwd, setCwd, push, setLines, sys, owner, photos }) {
  const apps = {
    fotos: 'gallery',
    galeria: 'gallery',
    'sobre-mi': 'about',
    proyectos: 'projects',
    musica: 'music',
    juego: 'game',
    consola: 'terminal',
    leeme: 'notes',
  }

  const c = {}
  const def = (name, help, run, opts = {}) => {
    c[name] = { help, run, paths: opts.paths }
    for (const a of opts.alias ?? []) c[a] = { help: null, run, paths: opts.paths }
  }

  const at = (path) => resolve(tree, cwd, path ?? '.')

  def(
    'ayuda',
    'esto',
    () => {
      push({
        k: 'ls',
        entries: Object.entries(c)
          .filter(([, v]) => v.help)
          .map(([k, v]) => ({ name: k, meta: v.help })),
      })
      push({ k: 'sys', t: 'Tab completa · ↑↓ historial · ^L limpia' })
    },
    { alias: ['help', '?'] }
  )

  def(
    'ls',
    'lista lo que hay aquí',
    (args) => {
      const r = at(args[0])
      if (!r) return push({ k: 'err', t: `no existe «${args[0]}».` })
      if (r.node.type !== 'dir') return push({ k: 'ls', entries: [{ name: args[0], meta: describe(r.node) }] })
      const entries = Object.entries(r.node.children).map(([name, n]) => ({
        name: nodeLabel(name, n),
        meta: describe(n),
        dir: n.type === 'dir',
      }))
      push(entries.length ? { k: 'ls', entries } : { k: 'sys', t: 'vacío' })
    },
    { alias: ['dir'], paths: true }
  )

  def(
    'cd',
    'entra en una carpeta',
    (args) => {
      const r = at(args[0] ?? '~')
      if (!r) return push({ k: 'err', t: `no existe «${args[0]}».` })
      if (r.node.type !== 'dir') return push({ k: 'err', t: `«${args[0]}» no es una carpeta.` })
      setCwd(r.segs)
    },
    { paths: true }
  )

  def('pwd', 'dónde estoy', () => push({ k: 'out', t: '/' + cwd.join('/') }))

  def(
    'cat',
    'abre un archivo aquí mismo',
    (args) => {
      if (!args[0]) return push({ k: 'err', t: 'dime qué archivo.' })
      const r = at(args[0])
      if (!r) return push({ k: 'err', t: `no existe «${args[0]}».` })
      const n = r.node
      if (n.type === 'dir') return push({ k: 'err', t: `«${args[0]}» es una carpeta. prueba «ls ${args[0]}».` })
      if (n.type === 'text') return push({ k: 'out', t: n.body() })
      if (n.type === 'project')
        return push({
          k: 'out',
          t: `${n.project.title}\n${n.project.kind} · ${n.project.year}\n\n${n.project.blurb}${
            n.project.href ? `\n\n${n.project.href}` : ''
          }`,
        })
      if (n.type === 'track')
        return push({ k: 'out', t: `${n.track.title} — ${n.track.artist} (${describe(n)})` })
      if (n.type === 'photo') {
        push({ k: 'img', photo: n.photo })
        push({
          k: 'out',
          t: `${n.photo.title} · ${n.photo.place}, ${n.photo.year} · ${
            n.photo.ratio >= 1.05 ? 'vertical' : n.photo.ratio <= 0.95 ? 'apaisada' : 'cuadrada'
          }`,
        })
        push({ k: 'sys', t: `«abrir ${args[0]}» para verla en grande` })
      }
    },
    { alias: ['ver'], paths: true }
  )

  def(
    'abrir',
    'abre una app o una foto',
    (args) => {
      const key = (args[0] ?? '').toLowerCase()
      if (!key) return push({ k: 'err', t: 'dime qué abrir.' })

      if (apps[key]) {
        sys.open(apps[key])
        return push({ k: 'out', t: `abriendo ${key}…` })
      }
      const r = at(args[0])
      if (r?.node.type === 'photo') {
        sys.openPhoto(photos.indexOf(r.node.photo))
        return push({ k: 'out', t: `${r.node.photo.title}` })
      }
      if (r?.node.type === 'project' && r.node.project.href) {
        window.open(r.node.project.href, '_blank', 'noreferrer')
        return push({ k: 'out', t: r.node.project.href })
      }
      if (r?.node.type === 'track') {
        sys.open('music')
        return push({ k: 'out', t: `${r.node.track.title} — abre el reproductor` })
      }
      push({ k: 'err', t: `«${args[0]}» no se puede abrir. apps: ${Object.keys(apps).join(', ')}` })
    },
    { alias: ['open'], paths: true }
  )

  def(
    'find',
    'busca por todo el árbol',
    (args) => {
      const q = fold(args.join(' ') || '')
      if (!q) return push({ k: 'err', t: 'dime qué buscar.' })
      const hits = []
      const walk = (node, path) => {
        for (const [name, n] of Object.entries(node.children)) {
          const p = `${path}/${name}`
          const hay = fold(
            `${p} ${n.type === 'photo' ? `${n.photo.title} ${n.photo.place} ${n.photo.year}` : ''} ${
              n.type === 'project' ? `${n.project.title} ${n.project.blurb}` : ''
            }`
          )
          if (hay.includes(q)) hits.push({ name: p, meta: describe(n), dir: n.type === 'dir' })
          if (n.type === 'dir') walk(n, p)
        }
      }
      walk(tree, '')
      push(hits.length ? { k: 'ls', entries: hits } : { k: 'sys', t: `nada con «${q}»` })
    },
    { alias: ['buscar'] }
  )

  def(
    'quien',
    'quién soy',
    () =>
      push({
        k: 'out',
        t: [owner.name, owner.role, owner.location, '', ...owner.links.map((l) => `  ${l.label.padEnd(10)}${l.href}`)].join(
          '\n'
        ),
      }),
    { alias: ['whoami'] }
  )

  def(
    'tema',
    'claro u oscuro',
    (args) => {
      const t = (args[0] ?? '').toLowerCase()
      const next = ['claro', 'light'].includes(t) ? 'light' : ['oscuro', 'dark'].includes(t) ? 'dark' : null
      const applied = next ?? (sys.theme === 'dark' ? 'light' : 'dark')
      sys.setTheme(applied)
      push({ k: 'out', t: `tema ${applied === 'dark' ? 'oscuro' : 'claro'}.` })
    },
    { alias: ['theme'] }
  )

  def(
    'gato',
    'sácalo o guárdalo',
    (args) => {
      const t = (args[0] ?? '').toLowerCase()
      const on = ['on', 'si', 'sí'].includes(t) ? true : ['off', 'no'].includes(t) ? false : !sys.catOn
      sys.setCat(on)
      push({ k: 'out', t: on ? 'ahí va.' : 'se ha ido a dormir.' })
    },
    { alias: ['neko'] }
  )

  def(
    'fecha',
    'qué hora es aquí',
    () =>
      push({
        k: 'out',
        t: new Intl.DateTimeFormat('es-ES', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'Europe/Madrid',
        }).format(new Date()),
      }),
    { alias: ['date'] }
  )

  def('limpiar', 'vacía la pantalla', () => setLines([]), { alias: ['clear', 'cls'] })

  def('sudo', null, () => push({ k: 'err', t: 'aquí mandas tú igualmente.' }))

  return c
}
