import "server-only"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool, type PoolClient, type QueryConfig } from "pg"
import * as schema from "./schema"

type Database = NodePgDatabase<typeof schema>

const globalForDb = globalThis as unknown as { pgPool?: Pool; db?: Database }

/** Errors that mean "this socket is dead", not "this query is wrong". Safe to retry once on a fresh connection. */
const TRANSIENT = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "57P01", "57P02", "57P03", "08006", "08003", "08001"])
function isTransient(e: unknown) {
  const err = e as { code?: string; message?: string }
  return (err?.code && TRANSIENT.has(err.code)) || /Connection terminated|connection closed|Client has encountered a connection error/i.test(err?.message ?? "")
}

/**
 * Pool tuned for a serverless database that scales to zero (Neon free tier):
 * idle sockets are closed quickly and recycled, so a sleeping database never
 * hands us a dead connection. Single queries get one retry on a transient
 * connection error. Transactions are never replayed automatically.
 */
function createPool(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 15_000,
    maxLifetimeSeconds: 60,
    keepAlive: true,
  })
  // An idle client losing its socket must not crash the process.
  pool.on("error", (e) => console.warn("[db] idle connection closed:", e.message))

  const query = pool.query.bind(pool) as (...args: unknown[]) => Promise<unknown>
  ;(pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = async (...args: unknown[]) => {
    try {
      return await query(...args)
    } catch (e) {
      if (!isTransient(e)) throw e
      return query(...args)
    }
  }

  // Promise-style connect (used by transactions): probe the socket and retry once if it is dead.
  // Callback-style connect is what pool.query uses internally; it passes straight through.
  const connect = pool.connect.bind(pool) as (cb?: (...a: unknown[]) => void) => Promise<PoolClient> | void
  ;(pool as unknown as { connect: (cb?: (...a: unknown[]) => void) => unknown }).connect = (cb?: (...a: unknown[]) => void) => {
    if (typeof cb === "function") return connect(cb)
    return (async () => {
      const c = (await connect()) as PoolClient
      try {
        await c.query({ text: "select 1" } as QueryConfig)
        return c
      } catch (e) {
        c.release(true)
        if (!isTransient(e)) throw e
        return (await connect()) as PoolClient
      }
    })()
  }
  return pool
}

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
  const pool = globalForDb.pgPool ?? createPool(connectionString)
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
