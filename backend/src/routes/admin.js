import { randomUUID } from 'node:crypto'
import { eq, asc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db/index.js'
import { put, removeMany, publicUrl, mode, usingR2 } from '../lib/storage.js'
import { probe, makeLqip, makeVariants } from '../lib/images.js'

/**
 * Panel de administración.
 *
 * Una sola contraseña (ADMIN_PASSWORD) a cambio de un JWT en cookie. Es un
 * portfolio personal: no hay usuarios, no hay roles, y meter todo el aparato
 * de un SaaS aquí sería ceremonia sin dueño.
 */

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)

const photoMeta = z.object({
  title: z.string().min(1).max(120).optional(),
  place: z.string().max(120).optional(),
  year: z.string().max(20).optional(),
  sort: z.number().int().optional(),
})

export default async function adminRoutes(app) {
  const auth = async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'No autorizado' })
    }
  }

  /* — sesión — */

  app.post(
    '/api/admin/login',
    { config: { rateLimit: { max: 8, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const { password } = z.object({ password: z.string() }).parse(req.body ?? {})
      if (!process.env.ADMIN_PASSWORD) return reply.code(500).send({ error: 'Falta ADMIN_PASSWORD' })
      if (password !== process.env.ADMIN_PASSWORD) {
        // un respiro fijo: no da pistas por tiempo de respuesta
        await new Promise((r) => setTimeout(r, 600))
        return reply.code(401).send({ error: 'Contraseña incorrecta' })
      }
      const token = app.jwt.sign({ admin: true }, { expiresIn: '30d' })
      reply.setCookie('sess', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
      return { ok: true }
    }
  )

  app.post('/api/admin/logout', async (req, reply) => {
    reply.clearCookie('sess', { path: '/' })
    return { ok: true }
  })

  app.get('/api/admin/me', { preHandler: auth }, async () => ({
    admin: true,
    // para que el panel avise si las fotos están yendo a un disco efímero
    storage: mode,
    bucket: usingR2 ? process.env.R2_BUCKET : (process.env.STORAGE_DIR ?? 'data/fotos'),
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 60),
  }))

  /* — fotos — */

  app.get('/api/admin/photos', { preHandler: auth }, async () => {
    const rows = await db.select().from(schema.photos).orderBy(asc(schema.photos.sort))
    const vars = await db.select().from(schema.photoVariants)
    return rows.map((p) => ({
      ...p,
      variants: vars.filter((v) => v.photoId === p.id).length,
      thumb:
        vars
          .filter((v) => v.photoId === p.id && v.format === 'webp')
          .sort((a, b) => a.width - b.width)
          .map((v) => publicUrl(v.key))[0] ?? null,
    }))
  })

  /**
   * Subida. Se procesa en memoria y se escribe directo a R2; el disco de
   * Railway ni se toca, que es efímero.
   */
  app.post('/api/admin/photos', { preHandler: auth }, async (req, reply) => {
    const parts = req.parts()
    const meta = {}
    let buffer = null
    let filename = ''

    for await (const part of parts) {
      if (part.type === 'file') {
        filename = part.filename ?? 'foto.jpg'
        buffer = await part.toBuffer()
      } else {
        meta[part.fieldname] = part.value
      }
    }
    if (!buffer) return reply.code(400).send({ error: 'No llegó ningún archivo' })

    let info
    try {
      info = await probe(buffer)
    } catch {
      return reply.code(400).send({ error: 'Eso no parece una imagen' })
    }

    const title = (meta.title || filename.replace(/\.[^.]+$/, '')).trim()
    const id = `${slug(title) || 'foto'}-${randomUUID().slice(0, 6)}`

    const lqip = await makeLqip(buffer)
    const rows = []
    await makeVariants(buffer, info, async (v) => {
      const key = `photos/${id}/${v.width}.${v.format}`
      await put(key, v.body, v.mime)
      rows.push({ id: randomUUID(), photoId: id, width: v.width, format: v.format, key, bytes: v.bytes })
    })

    const [{ next } = { next: 0 }] = await db
      .select({ next: sql`coalesce(max(${schema.photos.sort}), -1) + 1` })
      .from(schema.photos)

    await db.insert(schema.photos).values({
      id,
      title,
      place: meta.place ?? '',
      year: meta.year ?? String(new Date().getFullYear()),
      ratio: info.ratio,
      width: info.width,
      height: info.height,
      lqip,
      sort: Number(next) || 0,
    })
    await db.insert(schema.photoVariants).values(rows)

    return { id, variants: rows.length, width: info.width, height: info.height }
  })

  app.patch('/api/admin/photos/:id', { preHandler: auth }, async (req, reply) => {
    const patch = photoMeta.parse(req.body ?? {})
    if (!Object.keys(patch).length) return reply.code(400).send({ error: 'Nada que cambiar' })
    await db.update(schema.photos).set(patch).where(eq(schema.photos.id, req.params.id))
    return { ok: true }
  })

  app.delete('/api/admin/photos/:id', { preHandler: auth }, async (req) => {
    const vars = await db
      .select()
      .from(schema.photoVariants)
      .where(eq(schema.photoVariants.photoId, req.params.id))
    await removeMany(vars.map((v) => v.key))
    await db.delete(schema.photos).where(eq(schema.photos.id, req.params.id))
    return { ok: true, removed: vars.length }
  })

  /** Reordenar: llega la lista de ids en el orden nuevo. */
  app.post('/api/admin/photos/order', { preHandler: auth }, async (req) => {
    const ids = z.array(z.string()).parse(req.body?.ids ?? [])
    await Promise.all(
      ids.map((id, i) => db.update(schema.photos).set({ sort: i }).where(eq(schema.photos.id, id)))
    )
    return { ok: true }
  })

  /* — el resto del contenido — */

  app.put('/api/admin/settings/:key', { preHandler: auth }, async (req) => {
    const { key } = req.params
    await db
      .insert(schema.settings)
      .values({ key, value: req.body })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: req.body } })
    return { ok: true }
  })
}
