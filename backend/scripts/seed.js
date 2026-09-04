import 'dotenv/config'
import { db, schema } from '../src/db/index.js'

/**
 * Siembra la base con el contenido que trae el frontend por defecto.
 * Es idempotente: se puede volver a lanzar sin duplicar nada.
 *
 *   node scripts/seed.js
 */

const { owner, photos, projects, tracks, clocks } = await import(
  '../../frontend/src/data/content.js'
)

for (const [key, value] of Object.entries({ owner, clocks })) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } })
}

// Las fotos se siembran sin variantes: son los marcadores del frontend. Al
// subir las de verdad por el panel, se sustituyen.
for (const [i, p] of photos.entries()) {
  await db
    .insert(schema.photos)
    .values({
      id: p.id,
      title: p.title,
      place: p.place,
      year: p.year,
      ratio: p.ratio,
      sort: i,
    })
    .onConflictDoNothing()
}

for (const [i, p] of projects.entries()) {
  await db.insert(schema.projects).values({ ...p, sort: i }).onConflictDoNothing()
}

for (const [i, t] of tracks.entries()) {
  await db
    .insert(schema.tracks)
    .values({ id: `t${i + 1}`, title: t.title, artist: t.artist, dur: t.dur, src: t.src, sort: i })
    .onConflictDoNothing()
}

console.log(`Sembrado: ${photos.length} fotos, ${projects.length} proyectos, ${tracks.length} pistas.`)
process.exit(0)
