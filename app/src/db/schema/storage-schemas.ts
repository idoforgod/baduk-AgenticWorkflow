// =============================================================================
// db/schema/storage-schemas.ts — Zod schemas for Tauri Storage boundary
// =============================================================================
// These schemas are the TypeScript mirror of Rust structs in
// src-tauri/src/commands/storage.rs.
//
// Rust uses #[serde(rename_all = "camelCase")], so all field names here
// match the JSON-serialized camelCase form, NOT the Rust snake_case form.
//
// Purpose: Anti-Hallucination Layer 1 — Runtime boundary validation.
// Pattern: Same as KataGo response-parser.ts + Zod validation.
//
// Contract:
//   Rust SaveGamePayload  ↔  SaveGamePayloadSchema
//   Rust MovePayload      ↔  MovePayloadSchema
//   Rust GameSummary      ↔  GameSummarySchema
//   Rust GameRecord       ↔  GameRecordSchema
//   Rust GameFilter       ↔  GameFilterSchema
//
// Verification: validate_storage_contract.py cross-checks these against
// the Rust source at build time.
// =============================================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// MovePayload — mirrors Rust MovePayload (storage.rs:43-50)
// ---------------------------------------------------------------------------
// Rust fields (snake_case → camelCase via serde):
//   move_number → moveNumber (i64 → number int)
//   player      → player     (String → string)
//   coordinate  → coordinate (Option<String> → string nullable)
//   timestamp   → timestamp  (i64 → number int)
// ---------------------------------------------------------------------------

export const MovePayloadSchema = z.object({
  moveNumber: z.number().int(),
  player: z.string(),
  coordinate: z.string().nullable(),
  timestamp: z.number().int(),
})

export type MovePayloadDTO = z.infer<typeof MovePayloadSchema>

// ---------------------------------------------------------------------------
// SaveGamePayload — mirrors Rust SaveGamePayload (storage.rs:28-41)
// ---------------------------------------------------------------------------
// Rust fields (snake_case → camelCase via serde):
//   id         → id         (String → string)
//   user_id    → userId     (String → string)
//   board_size → boardSize  (i64 → number int)
//   rules      → rules      (String → string)
//   komi       → komi       (f64 → number)
//   mode       → mode       (String → string)
//   result     → result     (Option<String> → string nullable)
//   started_at → startedAt  (i64 → number int)
//   ended_at   → endedAt    (Option<i64> → number int nullable)
//   moves      → moves      (Vec<MovePayload> → MovePayloadSchema array)
// ---------------------------------------------------------------------------

export const SaveGamePayloadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  boardSize: z.number().int(),
  rules: z.string(),
  komi: z.number(),
  mode: z.string(),
  result: z.string().nullable(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
  moves: z.array(MovePayloadSchema),
})

export type SaveGamePayloadDTO = z.infer<typeof SaveGamePayloadSchema>

// ---------------------------------------------------------------------------
// GameFilter — mirrors Rust GameFilter (storage.rs:67-74)
// ---------------------------------------------------------------------------
// Rust fields (snake_case → camelCase via serde):
//   user_id → userId (Option<String> → string optional)
//   mode    → mode   (Option<String> → string optional)
//   limit   → limit  (Option<i64> → number int optional)
//   offset  → offset (Option<i64> → number int optional)
// ---------------------------------------------------------------------------

export const GameFilterSchema = z.object({
  userId: z.string().optional(),
  mode: z.string().optional(),
  limit: z.number().int().optional(),
  offset: z.number().int().optional(),
})

export type GameFilterDTO = z.infer<typeof GameFilterSchema>

// ---------------------------------------------------------------------------
// GameSummary — mirrors Rust GameSummary (storage.rs:76-87)
// ---------------------------------------------------------------------------
// Rust fields (snake_case → camelCase via serde):
//   id         → id         (String → string)
//   board_size → boardSize  (i64 → number int)
//   rules      → rules      (String → string)
//   mode       → mode       (String → string)
//   result     → result     (Option<String> → string nullable)
//   started_at → startedAt  (i64 → number int)
//   ended_at   → endedAt    (Option<i64> → number int nullable)
//   move_count → moveCount  (i64 → number int)
// ---------------------------------------------------------------------------

export const GameSummarySchema = z.object({
  id: z.string(),
  boardSize: z.number().int(),
  rules: z.string(),
  mode: z.string(),
  result: z.string().nullable(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
  moveCount: z.number().int(),
})

export type GameSummaryDTO = z.infer<typeof GameSummarySchema>

// ---------------------------------------------------------------------------
// GameRecord — mirrors Rust GameRecord (storage.rs:52-65)
// ---------------------------------------------------------------------------
// Rust fields (snake_case → camelCase via serde):
//   id         → id         (String → string)
//   user_id    → userId     (String → string)
//   board_size → boardSize  (i64 → number int)
//   rules      → rules      (String → string)
//   komi       → komi       (f64 → number)
//   mode       → mode       (String → string)
//   result     → result     (Option<String> → string nullable)
//   started_at → startedAt  (i64 → number int)
//   ended_at   → endedAt    (Option<i64> → number int nullable)
//   moves      → moves      (Vec<MovePayload> → MovePayloadSchema array)
// ---------------------------------------------------------------------------

export const GameRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  boardSize: z.number().int(),
  rules: z.string(),
  komi: z.number(),
  mode: z.string(),
  result: z.string().nullable(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
  moves: z.array(MovePayloadSchema),
})

export type GameRecordDTO = z.infer<typeof GameRecordSchema>

// ---------------------------------------------------------------------------
// Save response — matches the JSON returned by storage_save_game
// ---------------------------------------------------------------------------

export const SaveGameResponseSchema = z.object({
  gameId: z.string(),
})

export type SaveGameResponseDTO = z.infer<typeof SaveGameResponseSchema>
