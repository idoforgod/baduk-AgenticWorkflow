// =============================================================================
// Module: core — Public API Barrel Export
// =============================================================================
// Layer 1 (Infrastructure) — zero dependencies.
// Every other module imports from here; this module imports from nothing.
//
// RULE: Only export types and pure utility functions from this barrel.
//       No React, no Zustand, no Tauri — this module must be environment-agnostic.
// =============================================================================

// All interface contracts, domain types, and error types from Step 7
export * from './interfaces'

// Drizzle ORM schema (for storage module use only — do not import in UI components)
export * from './schema'
