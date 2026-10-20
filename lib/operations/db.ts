import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cachedSql: NeonQueryFunction<false, false> | null = null;

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Operations database is not configured. Set DATABASE_URL to the RR Neon PostgreSQL connection string in Vercel.");
  }
  if (!cachedSql) cachedSql = neon(connectionString);
  return cachedSql;
}

export function safeDatabaseError(error: unknown): string {
  if (error instanceof Error && error.message.includes("Operations database is not configured")) return error.message;
  // Never echo SQL, connection URLs, credentials or provider internals to clients.
  return "The operations database is temporarily unavailable. No changes were confirmed. Retry or use the recovery checklist.";
}
