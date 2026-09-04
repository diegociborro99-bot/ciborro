import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Gestor de ventanas: apertura, foco, minimizado, maximizado, cierre,
 * movimiento, redimensionado por cualquier borde, anclaje a los lados y
 * memoria de la posición entre visitas. Sin dependencias.
 */

export const MENUBAR_H = 34
export const DOCK_H = 96
/* En compacto el dock mide menos (medido: 70 px desde abajo). Sin distinguirlo,
   una ventana alta nace metida bajo él y tapa justo su propio pie. */
export const DOCK_H_COMPACT = 70
const dockH = () => (window.innerWidth < 640 ? DOCK_H_COMPACT : DOCK_H)
/* v3 porque cambia lo que se guarda: hasta ahora se grababa la posición de
   estreno de cada app la primera vez que se abría y ya no se soltaba nunca.
   Subir la versión borra de un golpe esas posiciones heredadas; si no, quien ya
   ha pasado por aquí seguiría abriendo las ventanas donde las abría el mes
   pasado y juraría que esto no ha cambiado. */
const STORE = 'win-layout-v3'

/* Abanico horizontal: cuánto se mueve cada peldaño y cuántos hay. Siete, uno
   por app, que es el máximo de ventanas que pueden estar abiertas a la vez. */
const CASCADE_X = 30
const FAN = 7
/* Escalera vertical: lo que se separan dos anchuras distintas. GRIP es lo
   mínimo de barra de título que hay que dejar asomando para poder agarrarla,
   así que el peldaño nunca baja de ahí. TITLE_H es el alto de la barra en
   escritorio (el sm:h-9 de Window.jsx): es lo único de este fichero que sabe de
   otro, y si allí cambia la altura, hay que cambiarlo aquí. */
const RUNG = 18
const TITLE_H = 36
const GRIP = 14

function bounds() {
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    top: MENUBAR_H + 6,
    bottom: window.innerHeight - 8,
  }
}

function clampToViewport(win) {
  const { vw, vh } = bounds()
  const compact = vw < 780
  const maxW = vw - (compact ? 20 : 16)
  const maxH = vh - MENUBAR_H - (compact ? dockH() + 18 : 16)
  /* El orden importa y antes estaba al revés: con el mínimo aplicado el último,
     ganaba siempre, y en un móvil de 360 px «Pastorea a los gatos» (minW 380)
     nacía 30 px fuera de una pantalla sin scroll. Así el mínimo manda mientras
     quepa, y cuando no cabe el que cede es el mínimo, no la pantalla. */
  const w = Math.min(Math.max(win.w, win.minW), maxW)
  const h = Math.min(Math.max(win.h, win.minH), maxH)
  return {
    ...win,
    w,
    h,
    // siempre queda barra de título alcanzable dentro de la pantalla
    x: Math.min(Math.max(win.x, -w + 110), vw - 110),
    y: Math.min(Math.max(win.y, MENUBAR_H + 2), vh - 44),
  }
}

/** Zona de anclaje según dónde se suelte la ventana. */
export function snapZone(x, y) {
  const { vw } = bounds()
  if (y < MENUBAR_H + 8) return 'top'
  if (x < 12) return 'left'
  if (x > vw - 12) return 'right'
  return null
}

export function snapRect(zone) {
  const { vw, vh, top } = bounds()
  const h = vh - top - DOCK_H
  if (zone === 'top') return { x: 8, y: top, w: vw - 16, h }
  if (zone === 'left') return { x: 8, y: top, w: vw / 2 - 12, h }
  if (zone === 'right') return { x: vw / 2 + 4, y: top, w: vw / 2 - 12, h }
  return null
}

export function useWindows(defs, initiallyOpen = []) {
  const saved = useRef(readStore())

  const [wins, setWins] = useState(() =>
    /* de una en una, para que cada ventana vea a las anteriores y elija su
       peldaño; con el escritorio vacío este bucle no da ni una vuelta */
    initiallyOpen.reduce((ws, id, i) => [...ws, spawn(defs, id, ws, i + 1, saved.current[id])], [])
  )
  const [topZ, setTopZ] = useState(initiallyOpen.length + 1)

  /* Guarda la disposición para la próxima visita, pero SÓLO la de las ventanas
     que ha colocado el visitante. La posición de estreno la decide el gestor
     cada vez que se abre: si también se guardara, quedaría grabada la primera
     vez y mandaría para siempre, y dos apps estrenadas por separado —cada una
     en su momento, cada una en el mismo sitio de honor— volverían juntas al
     mismo punto exacto, una tapando a la otra. Lo que no se toca, no se
     recuerda. */
  useEffect(() => {
    const layout = {}
    for (const w of wins) {
      if (!w.placed) continue
      /* De una maximizada se guarda el tamaño de antes: el estado «maximizada»
         no se persiste, así que sin esto volvería con el tamaño de la pantalla
         pero sin serlo, y sin nada a lo que restaurar. */
      const r = w.maximized && w.restore ? w.restore : w
      layout[w.id] = { x: r.x, y: r.y, w: r.w, h: r.h }
    }
    // también en memoria: cerrar y reabrir en la misma visita respeta el sitio
    saved.current = { ...saved.current, ...layout }
    try {
      localStorage.setItem(STORE, JSON.stringify(saved.current))
    } catch {
      /* modo privado: da igual */
    }
  }, [wins])

  /* Recolocar al cambiar el tamaño de la ventana del navegador. Acotar es lo de
     siempre; lo nuevo es que al CRUZAR el umbral de compacto —en los dos
     sentidos— se rehace el reparto de las que colocó la máquina. Sin esto, una
     ventana abierta en el móvil volvía al escritorio convertida en una tira de
     340 px pegada al canto izquierdo, que es justo lo contrario de nacer
     centrada. Las que colocó el visitante no se mueven: ahí manda él, y una
     ventana que salta sola de sitio molesta más que una mal puesta. */
  useEffect(() => {
    let eraCompacto = window.innerWidth < 780
    const onResize = () => {
      const compacto = window.innerWidth < 780
      const cruce = compacto !== eraCompacto
      eraCompacto = compacto
      setWins((ws) => {
        const acotadas = ws.map((w) => (w.maximized ? maximize(w) : clampToViewport(w)))
        if (!cruce) return acotadas
        const quieta = (w) => w.placed || w.maximized || w.closing || w.minimizing || !defs[w.id]
        const puestas = acotadas.filter(quieta)
        return acotadas.map((w) => {
          if (quieta(w)) return w
          const nueva = spawn(defs, w.id, puestas, w.z, null)
          puestas.push(nueva)
          return { ...w, x: nueva.x, y: nueva.y, w: nueva.w, h: nueva.h, step: nueva.step }
        })
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [defs])

  const focus = useCallback((id) => {
    setTopZ((z) => {
      const next = z + 1
      setWins((ws) => ws.map((w) => (w.id === id ? { ...w, z: next, minimized: false } : w)))
      return next
    })
  }, [])

  const open = useCallback(
    (id) => {
      setWins((ws) => {
        if (ws.some((w) => w.id === id)) return ws
        return [...ws, spawn(defs, id, ws, topZ + 1, saved.current[id])]
      })
      focus(id)
    },
    [defs, topZ, focus]
  )

  const close = useCallback((id) => {
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, closing: true } : w)))
    setTimeout(() => setWins((ws) => ws.filter((w) => w.id !== id)), 170)
  }, [])

  const closeAll = useCallback(() => {
    setWins((ws) => ws.map((w) => ({ ...w, closing: true })))
    setTimeout(() => setWins([]), 170)
  }, [])

  // se encoge hacia el dock antes de desaparecer
  const minimize = useCallback((id) => {
    setWins((ws) => ws.map((w) => (w.id === id ? { ...w, minimizing: true } : w)))
    setTimeout(
      () => setWins((ws) => ws.map((w) => (w.id === id ? { ...w, minimizing: false, minimized: true } : w))),
      210
    )
  }, [])

  const toggleMaximize = useCallback((id) => {
    /* Ojo: maximizar no marca `placed`. No es colocar una ventana, es un estado
       de ida y vuelta, y lo que hay debajo sigue siendo la posición que decidió
       la máquina, que no queremos grabar. */
    setWins((ws) =>
      ws.map((w) => {
        if (w.id !== id) return w
        if (w.maximized) return clampToViewport({ ...w, maximized: false, ...w.restore })
        return maximize(w)
      })
    )
  }, [])

  const setGeometry = useCallback((id, geo) => {
    /* Llega al soltar, nunca durante el gesto (Window.jsx pinta a mano y sólo
       confirma en onEnd): esto es colocación del visitante, y desde aquí manda
       ella y no el gestor. */
    setWins((ws) => ws.map((w) => (w.id === id ? clampToViewport({ ...w, ...geo, placed: true }) : w)))
  }, [])

  /** Ancla la ventana a un lado, guardando su tamaño anterior. */
  const snap = useCallback((id, zone) => {
    const rect = snapRect(zone)
    if (!rect) return
    setWins((ws) =>
      ws.map((w) =>
        w.id === id
          ? {
              ...w,
              ...rect,
              // anclar también es colocar
              placed: true,
              maximized: zone === 'top',
              restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h },
            }
          : w
      )
    )
  }, [])

  const toggle = useCallback(
    (id) => {
      setWins((ws) => {
        const w = ws.find((x) => x.id === id)
        if (!w) {
          setTimeout(() => open(id), 0)
          return ws
        }
        if (w.minimized) {
          setTimeout(() => focus(id), 0)
          return ws
        }
        // si ya está delante, la esconde; si está detrás, la trae al frente
        const front = ws.filter((x) => !x.minimized).sort((a, b) => b.z - a.z)[0]
        if (front?.id === id) return ws.map((x) => (x.id === id ? { ...x, minimized: true } : x))
        setTimeout(() => focus(id), 0)
        return ws
      })
    },
    [open, focus]
  )

  return { wins, open, close, closeAll, focus, minimize, toggleMaximize, setGeometry, snap, toggle }
}

/* ── auxiliares ─────────────────────────────────────────────────────── */

function maximize(w) {
  const rect = snapRect('top')
  return { ...w, maximized: true, restore: w.restore ?? { x: w.x, y: w.y, w: w.w, h: w.h }, ...rect }
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}')
  } catch {
    return {}
  }
}

function spawn(defs, id, ws, z, remembered) {
  const def = defs[id]
  const vw = window.innerWidth
  const vh = window.innerHeight
  const compact = vw < 780

  const base = {
    id,
    title: def.title,
    z,
    minimized: false,
    minimizing: false,
    maximized: false,
    closing: false,
    restore: null,
    /* la ha puesto ahí el visitante: mientras sea falso, la posición es cosa
       del gestor y no se guarda */
    placed: false,
    /* peldaño del abanico que ocupa, o null si no la coloca el abanico */
    step: null,
    resizable: def.resizable !== false,
    minW: def.minW ?? 300,
    minH: def.minH ?? 220,
  }

  if (compact) {
    return clampToViewport({
      ...base,
      w: vw - 20,
      h: vh - MENUBAR_H - dockH() - 18,
      x: 10,
      y: MENUBAR_H + 10,
    })
  }

  /* Lo que colocó el visitante manda, como antes; pero ahora se mira antes de
     creérselo. Un rectángulo a medias en el almacén —una escritura cortada,
     alguien toqueteando localStorage— entraba tal cual y salía una ventana de
     NaN×NaN: invisible, imposible de agarrar y para siempre, porque al volver a
     guardarse se perpetuaba sola. */
  if (esRect(remembered)) return clampToViewport({ ...base, ...remembered, placed: true })

  /* Primero el tamaño que de verdad cabe y después el sitio. Al revés —colocar
     con el tamaño pedido y recortar luego— la ventana queda descentrada justo
     en las pantallas donde no cabe entera, que es donde más se nota. */
  const cabida = clampToViewport({ ...base, w: def.w, h: def.h, x: 0, y: 0 })
  return clampToViewport({ ...cabida, ...asiento(cabida, defs, ws) })
}

/* ── dónde nace una ventana ─────────────────────────────────────────────
   Dos reglas, una por eje.

   En horizontal, el abanico: la primera al centro exacto —que es lo que se
   pidió— y las siguientes alternando lado (+1, −1, +2, −2, +3, −3) en vez de
   bajar siempre hacia la derecha, que con siete ventanas termina en la esquina.
   El peldaño vive en el objeto ventana, así que al cerrar una del medio su
   hueco se libera y lo reutiliza la siguiente que se abra.

   En vertical, la escalera por anchura, y esto no es adorno: es lo único que
   impide perder ventanas. Una ventana sólo puede tragarse la barra de título de
   otra si la cubre entera a lo ancho —y para cubrirla entera tiene que ser
   igual o más ancha— y además está por encima. Luego basta con que la más ancha
   nazca siempre un peldaño MÁS ABAJO que la más estrecha para que enterrar una
   barra sea imposible; no por suerte ni según el orden de apertura, sino porque
   la geometría no da para otra cosa. Hace falta de verdad: Fotos mide 640 y
   Música 318, y el abanico entero (±90 px) no da para que Música asome por un
   lado de Fotos, así que sin escalera Fotos se la traga entera y sólo se
   rescata desde el dock. */

/**
 * La escalera: a cada anchura distinta de la tabla de apps le toca un peldaño,
 * y la más ancha va abajo. Se calcula con la tabla entera y no con lo que haya
 * abierto, porque el sitio de una ventana no puede depender de en qué orden se
 * abran las demás: cualquiera de las siete puede llegar en cualquier momento y
 * las que ya están no se mueven de donde estén.
 */
function escalera(defs, vh) {
  const top = MENUBAR_H + 6
  const band = vh - top - DOCK_H
  const suelo = MENUBAR_H + 2
  const apps = Object.values(defs)
  const anchos = [...new Set(apps.map((d) => d.w))].sort((a, b) => a - b)
  const nivel = (w) => anchos.filter((a) => a < w).length
  const alto = (w) => Math.max(...apps.filter((d) => d.w === w).map((d) => d.h))

  /* Hasta dónde puede arrancar la escalera para que el último peldaño siga
     cabiendo encima del dock. Si no cabe, se estrecha el peldaño; y si ni así
     —pantallas muy bajas—, se deja que los pies asomen bajo el dock antes que
     renunciar al orden: un pie tapado se arregla moviendo la ventana, una barra
     de título enterrada no se arregla con el ratón. */
  const arranque = (peldano, apurando) =>
    Math.min(...anchos.map((w, i) => (apurando ? vh - alto(w) - 8 : top + band - alto(w)) - i * peldano))

  let peldano = RUNG
  let tope = arranque(peldano, false)
  while (tope < suelo && peldano > GRIP) {
    peldano -= 2
    tope = arranque(peldano, false)
  }
  if (tope < suelo) {
    peldano = RUNG
    tope = arranque(peldano, true)
    while (tope < suelo && peldano > GRIP) {
      peldano -= 2
      tope = arranque(peldano, true)
    }
  }

  /* Y dónde arranca: en el punto que deja a cada ventana lo más cerca posible
     de su propio centro óptico. Es la media de lo que pediría cada una, que es
     lo que menos desvío deja en total; así el número sale de la tabla de apps y
     de la pantalla, y no de un valor puesto a ojo que habría que retocar cada
     vez que cambie el tamaño de una app. */
  const media =
    apps.reduce((s, d) => s + (top + (band - d.h) * 0.42 - nivel(d.w) * peldano), 0) / apps.length
  const inicio = Math.round(Math.min(Math.max(media, suelo), Math.max(suelo, tope)))
  return (w) => inicio + nivel(w) * peldano
}

/** El sitio de estreno: peldaño del abanico en x, escalera por anchura en y. */
function asiento(win, defs, ws) {
  const vw = window.innerWidth
  const cx = (vw - win.w) / 2
  const y = escalera(defs, window.innerHeight)(win.w)
  const vivas = ws.filter((w) => !w.closing)

  /* el abanico nunca saca la ventana por un lado: en una pantalla justa se
     comprime solo en vez de irse al canto */
  const margen = Math.max(0, cx - 12)
  const en = (k) => {
    const salto = Math.ceil(k / 2)
    const lado = k % 2 ? 1 : -1
    const d = lado * salto * CASCADE_X
    return { ...win, y, x: Math.round(cx + Math.min(Math.max(d, -margen), margen)) }
  }

  const ocupados = new Set(vivas.map((w) => w.step).filter((s) => s != null))
  const libres = []
  for (let k = 0; k < FAN; k++) if (!ocupados.has(k)) libres.push(k)
  /* Se reutiliza el peldaño libre más bajo, así que al cerrar una del medio su
     hueco vuelve a usarse antes de alargar el abanico. Durante los 170 ms de la
     animación de cierre la ventana sigue en la lista con su peldaño, así que
     nadie nace justo encima de una que se está desvaneciendo. */
  const candidatos = libres.length ? libres : [0]

  // dos ventanas en el mismo punto se leen como una sola
  const encimaDe = (p) => vivas.some((w) => Math.abs(p.x - w.x) < 8 && Math.abs(p.y - w.y) < 8)
  /* La escalera ya impide enterrar barras entre las que coloca ella, pero una
     que haya movido el visitante puede estar en cualquier parte. Si hay un
     peldaño libre que la respete, ese; si no lo hay, manda el visitante y la
     nueva nace igual: no se le va a negar la apertura a nadie. */
  const estorbaA = (p) => vivas.some((w) => tapa(p, w) || tapa(w, p))

  const step =
    candidatos.find((k) => !encimaDe(en(k)) && !estorbaA(en(k))) ??
    candidatos.find((k) => !encimaDe(en(k))) ??
    candidatos[0]
  const p = en(step)
  return { step, x: p.x, y: p.y }
}

/** ¿`a`, puesta ahí, se traga entera la barra de título de `b`? */
function tapa(a, b) {
  return a.x <= b.x && a.x + a.w >= b.x + b.w && a.y < b.y + GRIP && a.y + a.h > b.y + TITLE_H - GRIP
}

/** Un rectángulo guardado sólo vale si viene entero y con números de verdad. */
function esRect(r) {
  return !!r && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(r[k]))
}
