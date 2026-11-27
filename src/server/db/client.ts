import "server-only"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

type Database = NodePgDatabase<typeof schema>

const globalForDb = globalThis as unknown as { pgPool?: Pool; db?: Database }

/**
 * Lazily created: importing this module never touches the environment or the
 * network, so `next build` (which imports every route to collect page data)
 * works without DATABASE_URL. The first real query creates the pool and fails
 * with a clear message if the variable is missing at runtime.
 */
function getDb(): Database {
  if (globalForDb.db) return globalForDb.db
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set. Add it to .env.local or the hosting environment variables.")
  const pool = globalForDb.pgPool ?? new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 })
  globalForDb.pgPool = pool
  globalForDb.db = drizzle(pool, { schema })
  return globalForDb.db
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb()
    const value = Reflect.get(real, prop, real)
    return typeof value === "function" ? value.bind(real) : value
  },
})

export type Db = Database
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0]
