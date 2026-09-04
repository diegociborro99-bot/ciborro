import { sql } from 'drizzle-orm'
import { db } from './index.js'

/**
 * Crea el esquema si no está.
 *
 * Se ejecuta al arrancar el servidor, así que desplegar en Railway con una base
 * de datos recién creada no pide ningún paso manual. Es idempotente: `IF NOT
 * EXISTS` en todo, así que arrancar mil veces no rompe nada ni pierde datos.
 *
 * Para cambios de esquema más serios está `npm run db:push` (drizzle-kit), que
 * compara `schema.js` con la base real.
 */
export async function migrate() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS photos (
      id          text PRIMARY KEY,
      title       text NOT NULL,
      place       text NOT NULL DEFAULT '',
      year        text NOT NULL DEFAULT '',
      ratio       real NOT NULL DEFAULT 1,
      width       integer NOT NULL DEFAULT 0,
      height      integer NOT NULL DEFAULT 0,
      lqip        text,
      sort        integer NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS photos_sort_idx ON photos (sort)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS photo_variants (
      id        text PRIMARY KEY,
      photo_id  text NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      width     integer NOT NULL,
      format    text NOT NULL,
      key       text NOT NULL,
      bytes     integer NOT NULL DEFAULT 0
    )`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS variants_photo_idx ON photo_variants (photo_id)`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS projects (
      id     text PRIMARY KEY,
      title  text NOT NULL,
      kind   text NOT NULL DEFAULT '',
      year   text NOT NULL DEFAULT '',
      blurb  text NOT NULL DEFAULT '',
      href   text,
      sort   integer NOT NULL DEFAULT 0
    )`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tracks (
      id      text PRIMARY KEY,
      title   text NOT NULL,
      artist  text NOT NULL DEFAULT '',
      dur     integer NOT NULL DEFAULT 0,
      src     text,
      sort    integer NOT NULL DEFAULT 0
    )`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key    text PRIMARY KEY,
      value  jsonb NOT NULL
    )`)
}
