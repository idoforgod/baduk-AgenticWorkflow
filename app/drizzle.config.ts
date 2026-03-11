// =============================================================================
// drizzle.config.ts — Drizzle Kit Configuration
// =============================================================================
// Used by:
//   - `drizzle-kit generate` → generate SQL migration files in src/db/migrations/
//   - `drizzle-kit push` → apply schema directly (for local dev)
//   - `drizzle-kit studio` → browser-based DB inspector
//
// Note on architecture (from Step 7 decision log):
// The Drizzle schema is used for:
//   1. Type generation (TypeScript types exported from schema)
//   2. Migration SQL generation (drizzle-kit generate)
// Runtime DB access goes through rusqlite Tauri commands (not Drizzle at runtime).
// This matches Step 6 Module 2 design: storage module wraps Tauri commands.
// =============================================================================

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Schema file that defines all 7 tables
  schema: './src/db/schema/tables.ts',

  // Output directory for generated migration files
  out: './src/db/migrations',

  // SQLite dialect — matches Step 7 and Step 1 (rusqlite/better-sqlite3)
  dialect: 'sqlite',

  // DB file path — used by drizzle-kit for push/studio commands.
  // Production DB is in the Tauri app data directory, managed by Rust.
  // This path is for local development tooling only.
  dbCredentials: {
    url: './dev-baduk.db',
  },

  // Verbose output for migration generation
  verbose: true,

  // Strict mode: fail if schema and DB are out of sync
  strict: true,
})
