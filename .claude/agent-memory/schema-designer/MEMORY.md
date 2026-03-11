# Schema Designer Agent Memory

## Project: Baduk Platform

### Key File Paths
- Schema: `outputs/step-07-schema.ts` (7 tables, Drizzle ORM)
- Interfaces: `outputs/step-07-interfaces.ts` (6 module interfaces, KataGo IPC types, 24+ Zod schemas)
- Data Model Doc: `outputs/step-07-data-model.md`

### Design Decisions Made
1. TEXT UUID primary keys (not INTEGER AUTOINCREMENT) for offline-first
2. JSON-in-TEXT for KataGo analysis data (validated by Zod, never queried by SQL)
3. Append-only moves table with composite PK (game_id, move_number)
4. WAL mode for concurrent reads during async analysis writes
5. Drizzle push (not migrate) for desktop app schema management
6. Result<T, E> pattern with discriminated union errors, Ok/Err constructors
7. analysis_cache table keyed by Zobrist hash for cross-game position caching

### Architecture Constraints (Step 6)
- 10 modules, 4 layers, 29 Tauri commands
- SQLite accessed via Rust-side rusqlite (not better-sqlite3 in webview)
- Rules engine runs in TypeScript webview (pure functions, no Rust)
- KataGo is a Tauri sidecar process (stdin/stdout JSON-line IPC)

### KataGo IPC Key Facts (Step 2)
- Backend is compile-time, not runtime (ship multiple binaries)
- MoveInfo has 17 always-present + 7 conditional fields
- RootInfo has 18 always-present + 5 conditional fields
- Response types: AnalysisResponse, NoResult, Error, Warning, Version, Models

### DKS Coverage Notes
- 85 entities in DKS, most are runtime-only (not persisted)
- 27 constraints mapped to enforcement mechanisms
- Tromp-Taylor with Positional Superko, suicide configurable
