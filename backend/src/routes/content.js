import { asc } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { publicUrl } from '../lib/storage.js'

/**
 * API pública: un solo GET con todo lo que el escritorio necesita para
 * arrancar. Una petición, cacheable, sin cascadas.
 */
export default async function contentRoutes(app) {
  app.get('/api/content', async (req, reply) => {
    const [ph, vars, pr, tr, st] = await Promise.all([
      db.select().from(schema.photos).orderBy(asc(schema.photos.sort)),
      db.select().from(schema.photoVariants),
      db.select().from(schema.projects).orderBy(asc(schema.projects.sort)),
      db.select().from(schema.tracks).orderBy(asc(schema.tracks.sort)),
      db.select().from(schema.settings),
    ])

    const byPhoto = new Map()
    for (const v of vars) {
      if (!byPhoto.has(v.photoId)) byPhoto.set(v.photoId, [])
      byPhoto.get(v.photoId).push(v)
    }

    const settings = Object.fromEntries(st.map((s) => [s.key, s.value]))

    const photos = ph.map((p) => {
      const list = (byPhoto.get(p.id) ?? []).sort((a, b) => a.width - b.width)
      // agrupado por formato: el frontend monta un <picture> con un <source>
      // por formato y deja que el navegador coja el primero que entienda
      const sources = {}
      for (const v of list) {
        sources[v.format] ??= []
        sources[v.format].push({ w: v.width, url: publicUrl(v.key) })
      }
      const jpeg = sources.jpeg ?? []
      return {
        id: p.id,
        title: p.title,
        place: p.place,
        year: p.year,
        ratio: p.ratio,
        width: p.width,
        height: p.height,
        lqip: p.lqip,
        sources,
        // la mayor en JPEG hace de `src` de respaldo
        src: jpeg.length ? jpeg[jpeg.length - 1].url : null,
      }
    })

    // 5 min en el navegador y una hora en el CDN, revalidando por detrás
    reply.header('cache-control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')

    return {
      owner: settings.owner ?? null,
      clocks: settings.clocks ?? [],
      photos,
      projects: pr.map(({ sort, ...p }) => p),
      tracks: tr.map(({ sort, id, ...t }) => t),
    }
  })

  app.get('/api/health', async () => ({ ok: true, at: new Date().toISOString() }))
}
