# KataGo Integrator Memory

## Project Structure
- **Specs**: `outputs/step-02-katago-ipc-spec.md` (IPC protocol), `src/core/interfaces.ts` (IKatagoBridge interface)
- **TS module**: `src/katago-bridge/` (7 files + test + index)
- **Rust backend**: `src-tauri/src/katago.rs` (types), `src-tauri/src/commands/katago.rs` (commands)
- **Tests**: `npx vitest run`, `cargo check` in src-tauri/

## Key Architecture Decisions
- TS side: query building, response parsing, difficulty mapping, circuit breaker state, visits calibration
- Rust side: process lifecycle (spawn/shutdown), stdin/stdout IPC, stderr monitoring, response dispatch via oneshot channels
- TS calls Rust via Tauri `invoke()` — no Node.js APIs (no worker_threads, no child_process)

## Rust Gotchas (Confirmed)
- `std::sync::MutexGuard` is `!Send` — cannot hold across `.await` in async Tauri commands
- Solution: extract values while holding lock, drop guard, then await
- `tokio::sync::Mutex` (TokioMutex) used for async-safe shared state in background tasks
- `blocking_lock()` used when calling from sync context into TokioMutex

## Testing Patterns
- Mock Tauri invoke via constructor injection: `createKatagoBridge(mockInvoke)`
- Dynamic imports in tests avoid module-level side effects
- 127 tests covering: query builder (15), response parser (15), difficulty (10), visits (5), GPU (10), service (10+)

## Biome Linter
- Auto-formats on file write. Sorts imports alphabetically. Expands compact object literals.
- No need to pre-format — linter handles it automatically.
