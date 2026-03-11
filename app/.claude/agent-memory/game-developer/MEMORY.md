# Game Developer Agent Memory

## Project: Baduk Platform — Step 11 Implementation

### Architecture Decisions
- Tauri invoke is dynamically imported inside repository methods so vi.mock('@tauri-apps/api/core') works in Vitest without modification
- GameReducer (Zustand) uses module-level `_rulesEngine` variable for DI; call `configureGameStore()` before any store actions in tests and at app boot
- IRulesEngine DI: store.ts does NOT import rules-engine; engine is injected via `configureGameStore(rulesEngine)`

### File Paths (Step 11 outputs)
- `src/db/repositories/game-repository.ts` — GameRepository CRUD
- `src/db/repositories/settings-repository.ts` — SettingsRepository CRUD
- `src/db/repositories/index.ts` — re-exports
- `src/game-engine/types.ts` — GameStoreState, GameStoreActions, SGFExportInput
- `src/game-engine/store.ts` — useGameStore, configureGameStore, indexToGTP, gtpToIndex
- `src/game-engine/sgf.ts` — exportSGF, gtpToSGF, sgfToGTP, parseSGF
- `src/game-engine/index.ts` — barrel export (updated)
- `src/db/db.test.ts` — 25 tests (GameRepository + SettingsRepository)
- `src/game-engine/game-engine.test.ts` — 43 tests (GameReducer)
- `src/game-engine/sgf.test.ts` — 30 tests (SGF)

### Test Pattern: Mocking Tauri invoke
```typescript
vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvokeFn }))
// MUST be before any import that transitively uses invoke
```

### Coordinate System
- Board index 0 = top-left = A{size} in GTP (e.g., A9 on 9x9)
- GTP skips letter I; indexToGTP uses 'ABCDEFGHJKLMNOPQRST'
- SGF coordinate: lowercase a-s, col then row (both from top-left, 0-based)
- Round-trip verified: indexToGTP -> gtpToSGF -> sgfToGTP -> gtpToIndex

### Test Results (Step 11)
- Total: 105 tests pass (98 new + 7 pre-existing core tests)
- db.test.ts: 25 tests (GameRepository 15, SettingsRepository 10)
- game-engine.test.ts: 43 tests
- sgf.test.ts: 30 tests
- All pass in 413ms with Vitest v4.0.18

### Key Patterns
- Repository methods return `Result<T, StorageError>` — never throw
- All Tauri command errors are caught and returned as `Err({ module: 'storage', code: 'READ_FAILED'|'WRITE_FAILED'|'NOT_FOUND', ... })`
- Zustand store: use `useGameStore.getState().reset()` in `beforeEach` to clear state between tests
- SGF pass moves: encoded as `B[]` or `W[]` (empty coordinate string)

### localStorage in Vitest/jsdom (Tauri env)
- `global.localStorage` is overridden by Tauri plugins and is NOT a real Storage object (methods throw).
- Use `vi.stubGlobal('localStorage', makeLocalStorageStub())` with an in-memory stub object.
- Always call `vi.unstubAllGlobals()` in `afterEach` to restore.
- Never call `localStorage.setItem/clear/getItem` directly in tests — always stub first.

### Quick Go File Paths (Step 18 — Quick Go MVP)
- `src/features/quick-go/types.ts` — All Quick Go types (config, phases, timer, AI, analysis)
- `src/features/quick-go/QuickGoController.ts` — Main controller orchestrating rules, AI, timer
- `src/features/quick-go/QuickGoTimer.ts` — Timer state machine (main time + byoyomi)
- `src/features/quick-go/QuickGoDifficulty.ts` — Preset mapping to 30-level difficulty system
- `src/features/quick-go/QuickGoAnalyzer.ts` — Post-game blunder detection + explanations
- `src/features/quick-go/QuickGoStore.ts` — Zustand store wrapping controller for UI
- `src/features/quick-go/index.ts` — Barrel exports
- `src/features/quick-go/quick-go.test.ts` — 84 tests (all pass)

### Quick Go Architecture Notes
- QuickGoController is the "brain" — pure class, no React dependency, testable
- QuickGoStore wraps controller in Zustand for reactive UI (same DI pattern as game-engine)
- Timer is a pure state machine — no setInterval inside, tick() called externally
- Difficulty: NEVER creates own system, delegates to katago-bridge/difficulty.ts getDifficultyConfig()
- Analysis normalizes all winrates to Black's perspective for consistent comparison
- KataGoService.setDifficulty() is used via type assertion (extended API beyond IKatagoBridge)

### Quick Go Test Results (Step 18)
- Total: 777 tests pass (84 new + 693 pre-existing) across 12 test files
- quick-go.test.ts: 84 tests (timer 23, difficulty 14, config 6, controller 22, analyzer 7, integration 6 + misc)
- All pass in 1.70s with Vitest v4.0.18

### Onboarding File Paths (Step 23 — Interactive Tutorial)
- `src/features/onboarding/types.ts` — Tutorial step types, progress, analytics, board scenarios
- `src/features/onboarding/TutorialScenarios.ts` — Pre-configured board positions (first stone, capture)
- `src/features/onboarding/OnboardingController.ts` — Tutorial state machine (7 steps, DI, persistence)
- `src/features/onboarding/OnboardingStore.ts` — Zustand store wrapping controller for UI
- `src/features/onboarding/index.ts` — Barrel exports
- `src/features/onboarding/onboarding.test.ts` — 58 tests (all pass)

### Onboarding Architecture Notes
- OnboardingController is pure class, same DI pattern as QuickGoController
- StorageAdapter interface abstracts localStorage for testability — no vi.stubGlobal needed
- Board interaction uses IRulesEngine.isLegalMove() + internal flood-fill for captures
- Tutorial steps: welcome -> rules_explanation -> first_stone -> capture_experience -> quick_go_transition -> ai_explanation_demo -> complete
- Progress persisted to localStorage (not DB) — anonymous-first, no signup required
- Analytics events emitted as typed objects (OnboardingAnalyticsEvent) stored in controller

### Onboarding Test Results (Step 23)
- Total: 981 tests pass (58 new + 923 pre-existing) across 18 test files
- onboarding.test.ts: 58 tests (flow 5, validation 6, persistence 8, scenarios 11, edge cases 9, analytics 7, integration 4, defaults 1, board state 5, time tracking 2)
- All pass in 1.88s with Vitest v4.0.18

### Optimization File Paths (Step 23 — Performance Optimization)
- `src/features/optimization/types.ts` — All optimization types (lazy loading, warmup, render, DB, bundle)
- `src/features/optimization/LazyModules.ts` — Module lazy loading registry, preload functions, dynamic import factories
- `src/features/optimization/KataGoWarmup.ts` — KataGo background startup state machine (cold→warming→ready|error)
- `src/features/optimization/RenderOptimization.ts` — shallowEqual, createMemoizedSelector, diffBoardState, createThrottledCallback, createBoardTracker
- `src/features/optimization/DbOptimization.ts` — WalCheckpointTracker, optimizeForBulkInsert, computeLruEviction, buildAnalysisCacheKey
- `src/features/optimization/BundleConfig.ts` — CHUNK_BUDGETS, BUNDLE_BUDGET, createManualChunks, validateChunkBudgets
- `src/features/optimization/index.ts` — Barrel exports
- `src/features/optimization/optimization.test.ts` — 113 tests (all pass)

### Optimization Architecture Notes
- KataGoWarmup is pure class with DI (accepts IKatagoBridge) — same pattern as QuickGoController
- RenderOptimization has zero React imports — pure TS utilities consumed by hooks/components
- diffBoardState: compare Uint8Array prev/next, returns IntersectionDiff[] for selective re-render
- createThrottledCallback: leading-edge throttle (first call fires, window drops extras)
- computeLruEviction: pure function — sorts by lastAccessedAt, returns keys to delete (caller runs DELETE)
- WalCheckpointTracker: write counter, triggers invokeCheckpoint(mode) at N writes
- BUNDLE_BUDGET: 100MB total = JS(<5MB) + KataGo binary(~50MB) + model(~30MB)
- createManualChunks(): returns Vite rollup manualChunks function; handles Windows backslash paths

### Optimization Test Results (Step 23)
- Total: 1223 tests pass (113 new + 1110 pre-existing) across 20 test files
- optimization.test.ts: 113 tests (LazyModules 13, KataGoWarmup 20, RenderOptimization 36, DbOptimization 26, BundleConfig 18)
- All pass in 1.91s with Vitest v4.0.18

### Gamification File Paths (Step 23 — Daily Quests, XP, Streaks, Badges)
- `src/features/gamification/types.ts` — All types + Zod schemas + pure math functions (levelFromXP, xpInCurrentLevel, xpToNextLevel)
- `src/features/gamification/QuestSystem.ts` — Daily quest generation, progress, completion, reset
- `src/features/gamification/LevelSystem.ts` — XP calculation, level progression, level-up detection
- `src/features/gamification/StreakTracker.ts` — Consecutive day tracking, bonus calculation
- `src/features/gamification/BadgeManager.ts` — Badge unlock conditions, idempotent merge
- `src/features/gamification/GamificationService.ts` — Unified service orchestrating all subsystems
- `src/features/gamification/GamificationStore.ts` — Zustand store wrapping service for UI
- `src/features/gamification/index.ts` — Barrel exports
- `src/features/gamification/gamification.test.ts` — 129 tests (all pass)

### Gamification Architecture Notes
- levelFromXP formula: `floor(totalXP / 100) + 1`, clamped to [1, MAX_LEVEL]
  - Level 1: 0-99 XP. Level 2: 100-199. Level N: starts at (N-1)*100.
- DI via IGamificationPersistence (load/save interface); in-memory impl in tests
- nowFn injectable for deterministic date testing
- Badge unlock via checkBadgeUnlocks() is IDEMPOTENT — already-earned badges skipped
- GamificationService._repairState() heals corrupted state: recomputes level from XP, clamps negatives
- Quest reset: needsQuestReset() compares stored quest date vs today (local time via formatDateLocal)
- GamificationService.load() is idempotent — safe to call multiple times

### Gamification Test Results (Step 23)
- gamification.test.ts: 129 tests (all pass, 0 biome errors)
- Total suite after addition: 1223 tests pass across 20 test files (0 regressions from pre-existing)

### i18n File Paths (Step 18 / m2-ui)
- `src/i18n/config.ts` — i18next init, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, resources
- `src/i18n/locales/en.json` — English (reference locale, all keys)
- `src/i18n/locales/ko.json` — Korean
- `src/i18n/locales/ja.json` — Japanese
- `src/i18n/useLanguage.ts` — useLanguage hook + detectInitialLanguage()
- `src/i18n/index.ts` — barrel export
- `src/i18n/i18n.test.ts` — 35 tests (all pass)
