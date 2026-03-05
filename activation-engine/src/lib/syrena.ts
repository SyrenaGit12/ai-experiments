import { neon } from "@neondatabase/serverless"
import { env } from "./env"

/**
 * Syrena DB — read-only via @neondatabase/serverless (HTTP).
 * Never run writes against this connection.
 *
 * Usage:
 *   const founders = await sql`SELECT * FROM "Founder" LIMIT 10`
 */
export const sql = neon(env.SYRENA_DATABASE_URL)
