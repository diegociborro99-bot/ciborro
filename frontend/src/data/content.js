/**
 * ─────────────────────────────────────────────────────────────
 *  ESTE ES EL ÚNICO ARCHIVO QUE TIENES QUE TOCAR PARA TU CONTENIDO.
 *  Cambia textos, fotos y enlaces aquí. El resto del código no
 *  necesita tocarse.
 * ─────────────────────────────────────────────────────────────
 */

export const owner = {
  name: 'Diego Ciborro',
  handle: 'diego',
  role: 'Fotografía · Producto · Cosas mías',
  location: 'Asturias, España',
  email: 'diegociborro99@gmail.com',
  // La animación de escritura a mano de la pantalla de inicio escribe esto:
  greeting: 'hola',
  bio: [
    'Hago fotos y construyo cosas. Este sitio es mi escritorio: abre las ventanas, muévelas, cierra lo que no te interese.',
    'La mayor parte de lo que ves aquí lo disparé en calle y en viaje, con luz que no controlaba. Me interesa más el momento raro que la composición perfecta.',
  ],
  links: [
    { label: 'Instagram', href: 'https://instagram.com/' },
    { label: 'GitHub', href: 'https://github.com/' },
    { label: 'LinkedIn', href: 'https://linkedin.com/' },
    { label: 'Email', href: 'mailto:diegociborro99@gmail.com' },
  ],
}

/**
 * FOTOS
 * ─────
 * Para usar tus fotos reales:
 *   1. Mete los archivos en  public/photos/
 *   2. Pon  src: '/photos/nombre-del-archivo.jpg'
 *   3. Borra la propiedad  placeholder  de esa entrada.
 *
 * Mientras no haya `src`, se dibuja un marcador procedural (no una
 * imagen externa) para que el sitio se vea completo desde el minuto uno.
 *
 * ratio: alto/ancho. 1 = cuadrada, 1.25 = vertical, 0.66 = apaisada.
 */
export const photos = [
  { id: 'p1',  title: 'Cruce, 7:40',        year: '2025', place: 'Gijón',      ratio: 1.25, placeholder: ['#2b2620', '#7a5c39'], src: null },
  { id: 'p2',  title: 'Niebla baja',        year: '2025', place: 'Somiedo',    ratio: 0.7,  placeholder: ['#1d2224', '#4f6168'], src: null },
  { id: 'p3',  title: 'Ventana 4B',         year: '2024', place: 'Oviedo',     ratio: 1,    placeholder: ['#2a1f1c', '#8a5a3c'], src: null },
  { id: 'p4',  title: 'Marea muerta',       year: '2024', place: 'Tazones',    ratio: 0.66, placeholder: ['#171d21', '#3f5a63'], src: null },
  { id: 'p5',  title: 'El del sombrero',    year: '2025', place: 'Lisboa',     ratio: 1.3,  placeholder: ['#231d18', '#9a6b3a'], src: null },
  { id: 'p6',  title: 'Escalera sin salida',year: '2023', place: 'Porto',      ratio: 1.4,  placeholder: ['#1c1a1f', '#5d4f6b'], src: null },
  { id: 'p7',  title: 'Domingo largo',      year: '2025', place: 'Avilés',     ratio: 0.75, placeholder: ['#241f19', '#8d7346'], src: null },
  { id: 'p8',  title: 'Rojo de fondo',      year: '2024', place: 'Madrid',     ratio: 1,    placeholder: ['#2a1618', '#93413c'], src: null },
  { id: 'p9',  title: 'Sal en el cristal',  year: '2024', place: 'Cudillero',  ratio: 1.2,  placeholder: ['#161e1e', '#436058'], src: null },
  { id: 'p10', title: 'Tres perros',        year: '2023', place: 'Sevilla',    ratio: 0.68, placeholder: ['#231e15', '#a07c3c'], src: null },
  { id: 'p11', title: 'Sin título',         year: '2025', place: 'Gijón',      ratio: 1.35, placeholder: ['#1a1b20', '#4a5570'], src: null },
  { id: 'p12', title: 'Última luz',         year: '2025', place: 'Ribadesella',ratio: 0.72, placeholder: ['#2b1f1a', '#b07040'], src: null },
]

/** OTRAS COSAS MÍAS — proyectos, escritos, lo que sea. */
export const projects = [
  {
    id: 'shiftia',
    title: 'ShiftIA',
    kind: 'Producto',
    year: '2026',
    blurb: 'Planificación de turnos para equipos sanitarios. Diseño, producto y buena parte del código.',
    href: null,
  },
  {
    id: 'vibeboxes',
    title: 'Vibeboxes',
    kind: 'Juego',
    year: '2025',
    blurb: 'Un experimento que se me fue de las manos y acabó desplegado.',
    href: 'https://vibeboxes.xyz',
  },
  {
    id: 'cuaderno',
    title: 'Cuaderno de campo',
    kind: 'Escritos',
    year: 'En curso',
    blurb: 'Notas sueltas sobre fotografía, herramientas y trabajo.',
    href: null,
  },
]

/** Reproductor: pistas de ejemplo. Pon `src` a un mp3 en public/audio/ para que suene de verdad. */
export const tracks = [
  { title: 'Cinta A, lado 1', artist: 'Sin acreditar', dur: 214, src: null },
  { title: 'Tarde de martes', artist: 'Sin acreditar', dur: 186, src: null },
  { title: 'Ruido de fondo',  artist: 'Sin acreditar', dur: 251, src: null },
  { title: 'Vuelta a casa',   artist: 'Sin acreditar', dur: 198, src: null },
]

/**
 * ESCRITORIO
 * ──────────
 * Lo que aparece suelto en el escritorio, a la izquierda. Son *documentos*,
 * no aplicaciones: las apps ya están en el dock, y repetirlas ahí sobra.
 *   { kind: 'doc',   name, opens }  → abre esa app
 *   { kind: 'photo', id }           → abre esa foto en el visor
 */
export const desktop = [
  { kind: 'doc', name: 'sobre-mi.txt', opens: 'about' },
  { kind: 'doc', name: 'leeme.txt', opens: 'notes' },
  { kind: 'photo', id: 'p1' },
  { kind: 'photo', id: 'p5' },
]

/** Relojes de la barra superior. El primero es el tuyo. */
export const clocks = [
  { label: 'Gijón',      tz: 'Europe/Madrid' },
  { label: 'Nueva York', tz: 'America/New_York' },
  { label: 'Tokio',      tz: 'Asia/Tokyo' },
  { label: 'UTC',        tz: 'UTC' },
]
