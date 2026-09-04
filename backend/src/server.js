import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile, mkdir } from 'node:fs/promises'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'

import { localDir, usingR2, mode } from './lib/storage.js'
import contentRoutes from './routes/content.js'
import adminRoutes from './routes/admin.js'
import { migrate } from './db/migrate.js'

/**
 * Un solo servicio sirve la API y el escritorio ya construido.
 *
 * Para un portfolio es lo sensato: un dominio, cero CORS, un despliegue. Las
 * fotos no pasan por aquí — las sirve R2 por su CDN.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '../public')

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true, // Railway va detrás de proxy
  bodyLimit: 1024 * 1024, // el JSON es pequeño; los archivos van por multipart
})

await app.register(cookie)
await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'cambia-esto-en-produccion',
  cookie: { cookieName: 'sess', signed: false },
})
await app.register(rateLimit, { global: false, max: 200, timeWindow: '1 minute' })
await app.register(multipart, {
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB ?? 60) * 1024 * 1024, files: 1 },
})

await app.register(contentRoutes)
await app.register(adminRoutes)

/* — panel de admin: una página suelta, fuera del bundle público —
   Así el visitante no se descarga ni un byte del panel. Se lee del disco
   directamente para no depender del plugin de estáticos. */
const adminHtml = await readFile(path.join(here, 'admin/index.html'), 'utf8')
app.get('/admin', (req, reply) =>
  reply.type('text/html').header('cache-control', 'no-store').header('x-robots-tag', 'noindex').send(adminHtml)
)

/* — fotos en disco —
   Sólo cuando no hay R2. En producción con R2 esto no se registra siquiera:
   los bytes de una foto no vuelven a pasar por Node después de subirla. */
if (!usingR2) {
  try {
    await mkdir(localDir, { recursive: true })
    await app.register(fastifyStatic, {
      root: localDir,
      prefix: '/fotos/',
      decorateReply: false,
      setHeaders: (res) => res.setHeader('cache-control', 'public, max-age=31536000, immutable'),
    })
    app.log.warn(`Fotos en disco (${localDir}). Sin volumen, un despliegue se las lleva.`)
  } catch (e) {
    /* Que no se pueda escribir aquí no es motivo para tirar el sitio entero:
       sin R2 sólo se caen las fotos en disco, y el escritorio se sirve igual.
       Antes esto reventaba el arranque y dejaba el contenedor en bucle. */
    app.log.error(
      { err: e },
      `No se puede escribir en ${localDir}: las fotos en disco quedan desactivadas. ` +
        `Configura R2, o da permiso de escritura a ese directorio (o apunta STORAGE_DIR a uno que lo tenga).`
    )
  }
}

/* — el escritorio, ya compilado — */
if (existsSync(webRoot)) {
  await app.register(fastifyStatic, {
    root: webRoot,
    // los assets llevan hash en el nombre: caché eterna. El index no.
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('cache-control', 'public, max-age=31536000, immutable')
      } else if (filePath.endsWith('index.html')) {
        res.setHeader('cache-control', 'no-cache')
      }
    },
  })

  // SPA: cualquier ruta que no sea API devuelve el index
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'No existe' })
    return reply.sendFile('index.html')
  })
} else {
  app.log.warn(`Sin frontend compilado en ${webRoot}: sólo API.`)
}

/* — esquema —
   Se crea al arrancar si no está, para que desplegar sea sólo desplegar.
   Poner RUN_MIGRATIONS=0 lo desactiva. */
if (process.env.RUN_MIGRATIONS !== '0') {
  try {
    await migrate()
    app.log.info('esquema al día')
  } catch (e) {
    app.log.error({ err: e }, 'no se pudo preparar el esquema')
  }
}

const port = Number(process.env.PORT ?? 3000)
await app.listen({ port, host: '0.0.0.0' })
app.log.info(`escritorio en :${port} · fotos en ${mode}`)
