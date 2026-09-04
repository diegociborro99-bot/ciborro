import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. Railway la inyecta al enlazar el Postgres.')
}

// Railway sirve Postgres con TLS; `prepare: false` va mejor tras el pooler.
const client = postgres(process.env.DATABASE_URL, {
  max: Number(process.env.PG_POOL ?? 5),
  prepare: false,
})

export const db = drizzle(client, { schema })
export { schema }
