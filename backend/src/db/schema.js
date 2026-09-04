import { pgTable, text, integer, real, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/**
 * Esquema.
 *
 * Las fotos se guardan una vez y sus derivados (cada ancho y formato) en una
 * tabla aparte: así el frontend puede montar el `srcset` sin adivinar qué
 * versiones existen, que con originales en 4K es justo lo que hay que evitar.
 *
 * `lqip` es una miniatura de ~20 px en base64: pesa menos que una petición y
 * permite enseñar la foto borrosa al instante mientras carga la buena.
 */

export const photos = pgTable(
  'photos',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    place: text('place').notNull().default(''),
    year: text('year').notNull().default(''),
    // alto/ancho: reserva el hueco antes de cargar y evita saltos de maquetación
    ratio: real('ratio').notNull().default(1),
    width: integer('width').notNull().default(0),
    height: integer('height').notNull().default(0),
    lqip: text('lqip'),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ bySort: index('photos_sort_idx').on(t.sort) })
)

export const photoVariants = pgTable(
  'photo_variants',
  {
    id: text('id').primaryKey(),
    photoId: text('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    width: integer('width').notNull(),
    format: text('format').notNull(), // avif | webp | jpeg
    key: text('key').notNull(), // ruta dentro del bucket
    bytes: integer('bytes').notNull().default(0),
  },
  (t) => ({ byPhoto: index('variants_photo_idx').on(t.photoId) })
)

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default(''),
  year: text('year').notNull().default(''),
  blurb: text('blurb').notNull().default(''),
  href: text('href'),
  sort: integer('sort').notNull().default(0),
})

export const tracks = pgTable('tracks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull().default(''),
  dur: integer('dur').notNull().default(0),
  src: text('src'),
  sort: integer('sort').notNull().default(0),
})

/** Todo lo demás (owner, escritorio, relojes) vive aquí como JSON. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
})
