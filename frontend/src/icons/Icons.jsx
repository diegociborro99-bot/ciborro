/**
 * Iconografía propia — todas las formas están dibujadas a mano en SVG,
 * con el mismo grosor de trazo (1.4) y el mismo lenguaje geométrico:
 * esquinas redondeadas, sin relleno salvo acentos puntuales.
 * Nada de emojis ni packs de terceros.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 20, children, ...rest }) {
  return (
    <svg width={size} height={size} {...base} {...rest} aria-hidden="true">
      {children}
    </svg>
  )
}

/* — apps ————————————————————————————————————————————— */

// Galería: diafragma de objetivo
export const IconGallery = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.4" />
    <path d="M12 3.6 15.6 9.8M20.4 12l-7.2 0.1M17.4 18.8l-3.5-6.3M12 20.4 8.4 14.2M3.6 12l7.2-.1M6.6 5.2l3.5 6.3" />
  </Svg>
)

// Sobre mí: tarjeta con retrato
export const IconAbout = (p) => (
  <Svg {...p}>
    <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3" />
    <circle cx="9" cy="10.6" r="2.1" />
    <path d="M5.6 16.4c.7-1.8 2-2.7 3.4-2.7s2.7.9 3.4 2.7M15.2 9.8h3.4M15.2 13h3.4" />
  </Svg>
)

// Proyectos: capas
export const IconProjects = (p) => (
  <Svg {...p}>
    <path d="m12 3.4 8.2 4.3-8.2 4.3-8.2-4.3z" />
    <path d="m4.4 12 7.6 4 7.6-4M4.4 16.2l7.6 4 7.6-4" />
  </Svg>
)

// Contacto: avión de papel
export const IconContact = (p) => (
  <Svg {...p}>
    <path d="M20.6 3.8 3.6 10.4l6.2 2.6 2.5 6.4z" />
    <path d="m9.8 13-.1 5.1 2.6-2.6M20.6 3.8 9.8 13" />
  </Svg>
)

// Música: onda
export const IconMusic = (p) => (
  <Svg {...p}>
    <path d="M4 12v0M7.4 8.6v6.8M10.8 5.6v12.8M14.2 9.4v5.2M17.6 7.2v9.6M21 10.8v2.4" />
  </Svg>
)

// Juego: huella de gato
export const IconGame = (p) => (
  <Svg {...p}>
    <path d="M12 13.4c2.5 0 4.4 1.7 4.4 3.6 0 1.6-1.3 2.6-3 2.3l-1.4-.3-1.4.3c-1.7.3-3-.7-3-2.3 0-1.9 1.9-3.6 4.4-3.6Z" />
    <ellipse cx="7.4" cy="10.4" rx="1.7" ry="2.2" transform="rotate(-14 7.4 10.4)" />
    <ellipse cx="16.6" cy="10.4" rx="1.7" ry="2.2" transform="rotate(14 16.6 10.4)" />
    <ellipse cx="10.6" cy="6.6" rx="1.5" ry="2" transform="rotate(-6 10.6 6.6)" />
    <ellipse cx="14.6" cy="7" rx="1.4" ry="1.9" transform="rotate(8 14.6 7)" />
  </Svg>
)

// Notas / colofón
export const IconNotes = (p) => (
  <Svg {...p}>
    <path d="M5.4 3.8h9.2l4 4v12.4H5.4z" />
    <path d="M14.4 3.8v4.2h4M8.4 12.4h7.2M8.4 15.8h5" />
  </Svg>
)

// Terminal: símbolo de intérprete
export const IconTerminal = (p) => (
  <Svg {...p}>
    <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="3" />
    <path d="m7.4 9.6 3 2.6-3 2.6M13 15h4" />
  </Svg>
)

/* — chrome / UI ————————————————————————————————————— */

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.6" />
    <path d="m16 16 4.4 4.4" />
  </Svg>
)

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="m6.8 6.8 10.4 10.4M17.2 6.8 6.8 17.2" />
  </Svg>
)

export const IconMinimize = (p) => (
  <Svg {...p}>
    <path d="M6 12h12" />
  </Svg>
)

export const IconMaximize = (p) => (
  <Svg {...p}>
    <path d="M9.2 4.6H4.6v4.6M14.8 4.6h4.6v4.6M9.2 19.4H4.6v-4.6M14.8 19.4h4.6v-4.6" />
  </Svg>
)

export const IconRestore = (p) => (
  <Svg {...p}>
    <path d="M4.6 9.2h4.6V4.6M19.4 9.2h-4.6V4.6M4.6 14.8h4.6v4.6M19.4 14.8h-4.6v4.6" />
  </Svg>
)

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
)

export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4" />
  </Svg>
)

export const IconMoon = (p) => (
  <Svg {...p}>
    <path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.4 8.4 0 1 0 9.4 9.4Z" />
  </Svg>
)

export const IconPlay = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M8.4 5.6a.9.9 0 0 1 1.36-.77l9 6.4a.9.9 0 0 1 0 1.54l-9 6.4A.9.9 0 0 1 8.4 18.4Z" />
  </Svg>
)

export const IconPause = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <rect x="8" y="5.6" width="2.8" height="12.8" rx="1.1" />
    <rect x="13.2" y="5.6" width="2.8" height="12.8" rx="1.1" />
  </Svg>
)

export const IconSkip = (p) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M6.6 6.4a.8.8 0 0 1 1.22-.68l8 5.6a.8.8 0 0 1 0 1.36l-8 5.6A.8.8 0 0 1 6.6 17.6Z" />
    <rect x="16.4" y="5.8" width="2.2" height="12.4" rx="1.1" />
  </Svg>
)

export const IconVolume = (p) => (
  <Svg {...p}>
    <path d="M5 9.4h3l4-3.2v11.6l-4-3.2H5z" />
    <path d="M15.4 9.6a3.4 3.4 0 0 1 0 4.8M18 7a7 7 0 0 1 0 10" />
  </Svg>
)

export const IconGrid = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6.4" height="6.4" rx="1.6" />
    <rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6" />
    <rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6" />
    <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6" />
  </Svg>
)

export const IconRows = (p) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="4.4" rx="1.6" />
    <rect x="4" y="14.6" width="16" height="4.4" rx="1.6" />
  </Svg>
)
