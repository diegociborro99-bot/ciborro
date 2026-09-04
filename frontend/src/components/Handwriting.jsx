import { useEffect, useRef, useState } from 'react'

/**
 * Saludo escrito a mano: un trazo cursivo continuo que se dibuja solo,
 * con una plumilla que recorre la punta del trazo mientras escribe.
 *
 * La técnica (stroke-dasharray + dashoffset animado) es de dominio
 * común; el trazo de aquí lo he dibujado yo, letra a letra, y escribe
 * la palabra que pongas en `owner.greeting`.
 */

/**
 * Trazos cursivos propios, dibujados en una caja de 340 × 200:
 * línea base y = 150, altura de x y = 92, altura de asta y = 34.
 * Un trazo por letra — así el dibujado va letra a letra, como al escribir.
 */
const WORDS = {
  hola: [
    // h — asta con lazo + hombro
    'M32 150 C34 116 42 66 54 42 C60 30 72 32 70 48 C68 64 56 100 52 124 C49 144 54 152 62 148 C68 144 70 112 78 100 C86 88 102 92 100 110 C98 124 94 138 96 146 C98 153 106 151 112 144',
    // o — cuenco cerrado con salida a la altura de x
    'M112 144 C122 138 128 100 140 93 C124 96 114 112 116 126 C118 142 130 152 142 149 C156 146 163 130 160 114 C158 100 148 92 140 94 C150 104 158 110 172 106',
    // l — asta con lazo
    'M172 106 C180 100 190 70 198 46 C202 34 212 34 210 48 C208 62 196 116 192 134 C189 148 198 154 208 147',
    // a — cuenco + asta descendente
    'M270 108 C264 94 244 93 236 108 C228 123 234 146 250 148 C264 150 272 137 270 120 C269 112 268 108 270 108 C270 122 269 138 273 148 C277 155 285 153 295 146',
  ],
}

/** Alternativa cuando la palabra no está dibujada: una rúbrica genérica. */
const FALLBACK = [
  'M30 150 C34 118 44 66 58 44 C64 32 76 34 74 50 C72 66 58 104 54 128 C51 146 58 154 68 148',
  'M100 144 C110 138 118 100 130 94 C114 97 104 113 106 127 C108 143 120 152 134 149 C148 146 155 130 152 114',
  'M180 146 C190 142 198 122 196 110 C194 98 180 100 178 116 C176 134 190 152 208 147 C222 143 232 140 246 146',
]

export default function Handwriting({
  text = 'hola',
  height = 92,
  duration = 2.6,
  color = 'var(--tx)',
  strokeWidth = 8,
  loop = false,
  delay = 0.25,
}) {
  const key = String(text).toLowerCase().trim()
  const strokes = WORDS[key] ?? FALLBACK
  const [run, setRun] = useState(0)
  const [done, setDone] = useState(false)
  const pathRefs = useRef([])

  // longitudes reales de cada trazo → reparto proporcional del tiempo
  const [lens, setLens] = useState(null)
  useEffect(() => {
    const l = pathRefs.current.filter(Boolean).map((p) => p.getTotalLength())
    setLens(l)
  }, [key])

  useEffect(() => {
    if (!loop || !done) return
    const t = setTimeout(() => {
      setDone(false)
      setRun((r) => r + 1)
    }, 1400)
    return () => clearTimeout(t)
  }, [loop, done])

  const total = lens?.reduce((a, b) => a + b, 0) ?? 1
  let acc = 0

  return (
    <svg
      key={run}
      viewBox="0 0 340 200"
      height={height}
      width={height * 1.7}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={text}
      style={{ overflow: 'visible' }}
    >
      <title>{text}</title>
      {strokes.map((d, i) => {
        const len = lens?.[i] ?? 400
        const dur = ((lens ? len / total : 1 / strokes.length) * duration).toFixed(3)
        const start = (lens ? (acc / total) * duration : (i / strokes.length) * duration) + delay
        acc += len
        return (
          <path
            key={i}
            ref={(el) => (pathRefs.current[i] = el)}
            d={d}
            style={
              lens
                ? {
                    strokeDasharray: len,
                    strokeDashoffset: len,
                    animation: `drawStroke ${dur}s cubic-bezier(.55,.1,.45,.9) ${start}s forwards`,
                  }
                : { opacity: 0 }
            }
            onAnimationEnd={i === strokes.length - 1 ? () => setDone(true) : undefined}
          />
        )
      })}
    </svg>
  )
}
