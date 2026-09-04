import { useEffect, useRef } from 'react'
import onekoSprite from '../assets/oneko.gif'

/**
 * Gato de escritorio — oneko.
 *
 * El sprite (src/assets/oneko.gif), el reparto de fotogramas y la máquina de
 * estados vienen de oneko.js de adryd, bajo licencia MIT — el texto completo
 * está en src/assets/oneko-LICENSE.txt y debe acompañar al código:
 *
 *   Copyright © 2022 adryd — https://github.com/adryd325/oneko.js
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the "Software"),
 *   to deal in the Software without restriction… (ver el archivo de licencia)
 *
 * A su vez es un port del "neko" japonés de 1989.
 *
 * Para cambiar de gato: sustituye src/assets/oneko.gif por cualquier otra
 * hoja de oneko (256×128, 8 columnas × 4 filas de 32 px). Hay decenas.
 */

const F = 32 // lado del fotograma
const SPEED = 110 // px por segundo
const TICK = 0.1 // s — cadencia de la animación y de la máquina de estados
const STOP = 44 // se planta a esta distancia: acaba al lado, no encima
const ALERT = 0.12 // s de sobresalto antes de arrancar

/** Reparto de fotogramas de la hoja: [columna, fila] en negativo. */
const spriteSets = {
  idle: [[-3, -3]],
  alert: [[-7, -3]],
  scratchSelf: [
    [-5, 0],
    [-6, 0],
    [-7, 0],
  ],
  scratchWallN: [
    [0, 0],
    [0, -1],
  ],
  scratchWallS: [
    [-7, -1],
    [-6, -2],
  ],
  scratchWallE: [
    [-2, -2],
    [-2, -3],
  ],
  scratchWallW: [
    [-4, 0],
    [-4, -1],
  ],
  tired: [[-3, -2]],
  sleeping: [
    [-2, 0],
    [-2, -1],
  ],
  N: [
    [-1, -2],
    [-1, -3],
  ],
  NE: [
    [0, -2],
    [0, -3],
  ],
  E: [
    [-3, 0],
    [-3, -1],
  ],
  SE: [
    [-5, -1],
    [-5, -2],
  ],
  S: [
    [-6, -3],
    [-7, -2],
  ],
  SW: [
    [-5, -3],
    [-6, -1],
  ],
  W: [
    [-4, -2],
    [-4, -3],
  ],
  NW: [
    [-1, 0],
    [-1, -1],
  ],
}

export default function Cat({ enabled = true, scale = 1, speed = SPEED }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const size = F * scale

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let mouseX = x
    let mouseY = y

    let frameCount = 0
    let idleTime = 0
    let idleAnimation = null
    let idleAnimationFrame = 0

    const setSprite = (name, frame) => {
      const sets = spriteSets[name]
      const [sx, sy] = sets[frame % sets.length]
      el.style.backgroundPosition = `${sx * size}px ${sy * size}px`
    }

    const resetIdle = () => {
      idleAnimation = null
      idleAnimationFrame = 0
    }

    const idle = () => {
      idleTime += 1

      // de vez en cuando se pone a hacer algo por su cuenta
      if (idleTime > 10 && Math.floor(Math.random() * 200) === 0 && idleAnimation == null) {
        const options = ['sleeping', 'scratchSelf']
        if (x < 32) options.push('scratchWallW')
        if (y < 32) options.push('scratchWallN')
        if (x > window.innerWidth - 32) options.push('scratchWallE')
        if (y > window.innerHeight - 32) options.push('scratchWallS')
        idleAnimation = options[Math.floor(Math.random() * options.length)]
      }

      switch (idleAnimation) {
        case 'sleeping':
          if (idleAnimationFrame < 8) {
            setSprite('tired', 0)
            break
          }
          setSprite('sleeping', Math.floor(idleAnimationFrame / 4))
          if (idleAnimationFrame > 192) resetIdle()
          break
        case 'scratchWallN':
        case 'scratchWallS':
        case 'scratchWallE':
        case 'scratchWallW':
        case 'scratchSelf':
          setSprite(idleAnimation, idleAnimationFrame)
          if (idleAnimationFrame > 9) resetIdle()
          break
        default:
          setSprite('idle', 0)
          return
      }
      idleAnimationFrame += 1
    }

    /**
     * Dos relojes distintos:
     *  · la POSICIÓN se recalcula en cada fotograma (rAF), así que el
     *    movimiento es continuo a los hercios que dé la pantalla;
     *  · la ANIMACIÓN y la máquina de estados siguen yendo a 100 ms, que es
     *    lo que le da al oneko su andar a saltitos de dos fotogramas.
     * El original movía también la posición cada 100 ms y por eso iba a
     * tirones. Se pinta con `translate` para que lo lleve el compositor.
     */
    const place = () => {
      el.style.translate = `${Math.round(x - size / 2)}px ${Math.round(y - size / 2)}px`
    }

    let acc = 0 // acumulador hasta completar un tick de 100 ms
    let last = performance.now()
    let wasIdle = true
    let alertUntil = 0
    let stuck = 0 // segundos intentando avanzar sin conseguirlo (bordes)
    let raf = 0

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      acc += dt

      // cuántos ticks de animación han pasado en este fotograma (0 ó 1)
      let ticks = 0
      while (acc >= TICK) {
        acc -= TICK
        ticks += 1
      }

      const diffX = x - mouseX
      const diffY = y - mouseY
      const distance = Math.hypot(diffX, diffY)

      // Lo que le queda por andar. El paso se recorta a este mismo valor, así
      // que al llegar queda en cero y la comparación de abajo se cumple. Antes
      // el test era `distancia < STOP` mientras el paso frenaba justo EN STOP:
      // se quedaba clavado a esa distancia exacta, nunca entraba en reposo y
      // seguía corriendo sin moverse del sitio.
      const remaining = distance - STOP

      // ya está al lado: a lo suyo
      if (remaining <= 0.5) {
        wasIdle = true
        stuck = 0
        for (let i = 0; i < ticks; i++) idle()
        return
      }

      resetIdle()
      idleTime = 0

      // sobresalto corto al arrancar, no los 700 ms del original
      if (wasIdle) {
        wasIdle = false
        alertUntil = now + ALERT * 1000
      }
      if (now < alertUntil) {
        setSprite('alert', 0)
        return
      }

      let direction = ''
      direction += diffY / distance > 0.5 ? 'N' : ''
      direction += diffY / distance < -0.5 ? 'S' : ''
      direction += diffX / distance > 0.5 ? 'W' : ''
      direction += diffX / distance < -0.5 ? 'E' : ''

      // si está topando con un borde y el destino queda fuera, no puede
      // avanzar: se planta en vez de correr sin moverse del sitio
      if (stuck > 0.25) {
        for (let i = 0; i < ticks; i++) idle()
        return
      }

      if (ticks > 0) {
        frameCount += ticks
        setSprite(direction, frameCount)
      }

      // frena al acercarse, para no clavar el frenazo justo en el destino
      const eased = Math.min(1, remaining / 90)
      const step = Math.min(speed * (0.4 + 0.6 * eased) * dt, remaining)
      const px = x
      const py = y
      x -= (diffX / distance) * step
      y -= (diffY / distance) * step
      x = Math.min(Math.max(size / 2, x), window.innerWidth - size / 2)
      y = Math.min(Math.max(size / 2, y), window.innerHeight - size / 2)

      stuck = Math.hypot(x - px, y - py) < 0.05 ? stuck + dt : 0
      place()
    }

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    /**
     * En táctil no hay cursor que seguir: `pointermove` sólo llega mientras el
     * dedo está apoyado, así que un toque suelto no movía al gato. Con
     * `pointerdown` el destino se fija en cuanto tocas — y sin filtrar por
     * dónde has tocado, porque en móvil la ventana ocupa casi toda la pantalla
     * y entonces casi ningún toque contaba.
     */
    place()
    setSprite('idle', 0)

    /* Con movimiento reducido el gato se echa a dormir en una esquina en vez de
       perseguir el cursor. Salir arriba, antes, dejaba el div montado sin
       colocar: un cuadro clavado en 0,0 con el primer fotograma de la hoja (un
       gato arañando una pared) medio tapado por la barra. Y no se puede salir
       antes de aquí: size, x, y, place y setSprite se declaran más abajo. */
    if (reducido) {
      x = size
      y = window.innerHeight - size
      place()
      setSprite('sleeping', 0)
      return
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerdown', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerdown', onMove)
      cancelAnimationFrame(raf)
    }
  }, [enabled, scale, speed])

  if (!enabled) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[7500]"
      style={{
        width: F * scale,
        height: F * scale,
        willChange: 'translate',
        imageRendering: 'pixelated',
        backgroundImage: `url(${onekoSprite})`,
        backgroundSize: `${F * scale * 8}px ${F * scale * 4}px`,
        backgroundRepeat: 'no-repeat',
        // el sprite es blanco con contorno negro: una sombra corta lo despega
        // del fondo para que no se pierda sobre superficies claras
        filter: 'drop-shadow(0 1.5px 1.5px rgba(0,0,0,.4))',
      }}
    />
  )
}
