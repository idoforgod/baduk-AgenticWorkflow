# Step 8: Parallel Execution Plan — Baduk Platform

**Version**: 1.0.0
**Author**: @strategy-planner (Step 8)
**Date**: 2026-03-11
**Consumers**: Step 10 (scaffold), Step 11 (rules-engineer, data-engineer), Step 12 (katago-integrator), Step 13 (template-engineer), Step 14-20 (all implementation teams)
**Inputs**: Step 6 (Architecture DAG), Step 7 (Interface Contracts)

---

## Table of Contents

1. [Dependency DAG and Parallelism Analysis](#1-dependency-dag-and-parallelism-analysis)
2. [Branch Strategy](#2-branch-strategy)
3. [Shared File Conflict Prevention](#3-shared-file-conflict-prevention)
4. [Team Ownership Map](#4-team-ownership-map)
5. [Step 11 Team: Rules-Engineer + Data-Engineer](#5-step-11-team-rules-engineer--data-engineer)
6. [Step 17 Team: Integration Phase](#6-step-17-team-integration-phase)
7. [Integration Schedule](#7-integration-schedule)
8. [CI/CD Pipeline Design](#8-cicd-pipeline-design)
9. [Merge Conflict Prevention Protocol](#9-merge-conflict-prevention-protocol)
10. [Milestone Gates](#10-milestone-gates)
11. [Risk Register](#11-risk-register)

---

## 1. Dependency DAG and Parallelism Analysis

### 1.1 Module Dependency DAG (from Step 6)

```
Level 0 (no dependencies — parallelizable immediately):
  [core]

Level 1 (depends only on core — all parallelizable):
  [storage]    [board-ui]    [i18n]
  [rules-engine]    [katago-bridge]    [explanation-engine]    [analytics]

Level 2 (depends on Level 1 — parallelizable after Level 1 complete):
  [game-engine]    (depends on: core, rules-engine, storage)

Level 3 (depends on Level 2 — sequential after Level 2 complete):
  [gamification]    (depends on: core, storage, game-engine)
```

### 1.2 Topological Sort and Critical Path

```
Critical Path (longest dependency chain):
  core → rules-engine → game-engine → gamification

Total critical path length: 4 stages

Non-critical parallel paths (can run concurrently with critical path):
  - core → storage → [game-engine uses storage]
  - core → katago-bridge (standalone at Level 1)
  - core → explanation-engine (standalone at Level 1)
  - core → board-ui (standalone at Level 1)
  - core → i18n (standalone at Level 1)
  - core → analytics (standalone at Level 1)
```

### 1.3 Maximum Parallelism Points

| Development Phase | Modules Being Built Simultaneously | Max Team Size |
|------------------|------------------------------------|:------------:|
| Phase 1 (Week 1) | core + rules-engine + katago-bridge + storage + board-ui + i18n | 6 agents |
| Phase 1 (Week 1) | explanation-engine + analytics (additional parallel) | +2 agents |
| Phase 2 (Week 2) | game-engine (integrates Level 1 outputs) | 1-2 agents |
| Phase 3 (Week 3) | gamification (integrates Level 2 outputs) | 1 agent |
| Integration | All modules merge into integration branch | 1 integration agent |

**Maximum concurrent development**: 8 agents in Phase 1, decreasing to 1 in Phase 3.

---

## 2. Branch Strategy

### 2.1 Branch Naming Convention

All feature branches follow this pattern:

```
feat/{module-name}

Examples:
  feat/core
  feat/rules-engine
  feat/katago-bridge
  feat/storage
  feat/board-ui
  feat/i18n
  feat/game-engine
  feat/explanation-engine
  feat/analytics
  feat/gamification
```

**One branch per module.** No agent works across two module branches simultaneously.

### 2.2 Branch Hierarchy

```
main (protected, release-only)
  |
  └── integration (protected, weekly merge target)
        |
        ├── feat/core
        ├── feat/rules-engine
        ├── feat/katago-bridge
        ├── feat/storage
        ├── feat/board-ui
        ├── feat/i18n
        ├── feat/game-engine
        ├── feat/explanation-engine
        ├── feat/analytics
        └── feat/gamification
```

### 2.3 Branch Protection Rules

| Branch | Protection Level | Rule |
|--------|:---:|------|
| `main` | LOCKED | No direct pushes ever. PR from `integration` only. Requires passing CI. |
| `integration` | PROTECTED | No direct pushes. PR from feature branches only. Requires passing integration test suite. |
| `feat/*` | STANDARD | Direct push allowed for the owning agent. No cross-agent pushes. |

**NEVER DO: Push directly to main or integration.** All changes flow: `feat/X` → PR → `integration` → PR → `main`.

### 2.4 Feature Branch Lifecycle

```
Step 1: Agent creates feat/module-name from integration HEAD
Step 2: Agent develops module (TDD: tests first, then implementation)
Step 3: Agent runs local test suite (all tests pass)
Step 4: Agent opens PR to integration
Step 5: CI runs per-module test suite
Step 6: PR merged to integration on Monday or Thursday merge window
Step 7: Integration test suite runs post-merge
Step 8: If integration tests fail, agent reverts PR and fixes in feat/ branch
Step 9: feat/ branch may continue receiving updates during integration
Step 10: At milestone completion, integration merged to main (release)
```

---

## 3. Shared File Conflict Prevention

### 3.1 The Interface Contracts Firewall

**`outputs/step-07-interfaces.ts` is READ-ONLY for all feature branches.**

This is the single most important conflict prevention rule. The interfaces file defines the contracts between all modules. If two agents modify it simultaneously, every other module breaks.

**Enforcement**:
- `outputs/step-07-interfaces.ts` is NOT copied into any feature branch directory
- All modules import types from `src/core/types/` (the production copy)
- The production copy of types is populated by the **@rules-engineer scaffold step** which runs before any module work begins
- After initial scaffolding, type files are read-only unless a migration PR is created

### 3.2 Shared Files — Ownership and Modification Protocol

| Shared File | Owner | Modification Protocol |
|-------------|-------|----------------------|
| `package.json` | @scaffold-agent (Step 10) | Modified ONLY during initial scaffold. All dependency additions go through a dedicated `chore/add-dependency-{name}` branch and sequential merge. |
| `tsconfig.json` | @scaffold-agent (Step 10) | Frozen after initial setup. Path alias changes require team coordination. |
| `src/core/types/` | @rules-engineer (Step 11) | Core types defined once. Interface changes require a breaking-change PR process. |
| `src/core/constants.ts` | @rules-engineer (Step 11) | Threshold constants from Step 4. Read-only after scaffold. |
| `vite.config.ts` | @scaffold-agent (Step 10) | Frozen after initial setup. |
| `src-tauri/tauri.conf.json` | @devops-engineer | Frozen after initial setup. Sidecar permissions pre-configured. |
| `drizzle.config.ts` | @data-engineer (Step 11) | Frozen after schema definition. |
| `src/storage/schema/tables.ts` | @data-engineer (Step 11) | Migrations via additive-only changes. No column renames without coordination. |

### 3.3 Dependency Addition Protocol

When any agent needs a new npm dependency:

```
Step 1: Agent opens issue: "Request: add {package}@{version}"
Step 2: @scaffold-agent reviews for conflicts with existing dependencies
Step 3: Approved: @scaffold-agent creates chore/add-{package} branch
Step 4: Modifies package.json, runs npm install, commits lock file
Step 5: Sequential merge to integration (not parallel with other chore branches)
Step 6: All feature branches rebase from integration after dependency lands
```

**This protocol prevents package.json merge conflicts**, which are the most common and time-consuming conflicts in parallel development.

---

## 4. Team Ownership Map

### 4.1 Directory Ownership

Each agent owns a non-overlapping set of directories. **No two agents write to the same directory.**

| Agent | Owned Directories | Shared (Read-Only) |
|-------|------------------|-------------------|
| @rules-engineer | `src/engine/rules/` | `src/core/` (reads only) |
| @data-engineer | `src/storage/`, `src-tauri/src/storage/` | `src/core/` (reads only) |
| @katago-integrator | `src/engine/katago/`, `src-tauri/src/katago/` | `src/core/` (reads only) |
| @template-engineer | `src/engine/explanation/` | `src/core/` (reads only) |
| @game-developer | `src/engine/game/` | `src/core/`, `src/engine/rules/` (reads only) |
| @ui-developer | `src/board-ui/`, `src/i18n/` | `src/core/` (reads only) |
| @integration-developer | `src/features/gamification/`, `src/app/` | All modules (reads only) |
| @devops-engineer | `.github/`, `src-tauri/`, `scripts/` | `src/` (reads only) |

### 4.2 Conflict Zone Analysis

```
HIGH CONFLICT RISK (multiple agents writing):
  None — directory ownership is strictly non-overlapping

MEDIUM CONFLICT RISK (read-write by one agent, read by many):
  src/core/types/   — @rules-engineer writes, all others read
  src/core/constants.ts — @rules-engineer writes, all others read

LOW CONFLICT RISK (configuration, written once):
  package.json
  tsconfig.json
  tauri.conf.json
```

---

## 5. Step 11 Team: Rules-Engineer + Data-Engineer

### 5.1 Overview

Step 11 deploys two parallel agents:
- **@rules-engineer**: Implements `rules-engine` module (`src/engine/rules/`)
- **@data-engineer**: Implements `storage` module (`src/storage/` + Rust side)

These two agents are **completely independent** — they own non-overlapping directories and their interface contracts are already defined in Step 7.

### 5.2 Rules-Engineer Branch Strategy

**Branch**: `feat/rules-engine`
**Base**: `integration` HEAD (after Step 10 scaffold completes)

```
feat/rules-engine/
  Work sequence (TDD-first):
    Week 1, Day 1: Write all 178 test stubs (failing)
    Week 1, Day 2-3: Implement Stage 1 (Place) — tests pass for Category 1-2
    Week 1, Day 4: Implement Stage 2 (Capture) — tests pass for Category 3-4
    Week 1, Day 5: Implement Stage 3 (Ko) — tests pass for Category 5-6
    Week 2, Day 1-2: Implement Stage 4 (Scoring) — tests pass for Category 8
    Week 2, Day 3: Implement Stage 5 (Superko) — tests pass for Category 7
    Week 2, Day 4-5: Implement Stage 6 (Game Flow) — tests pass for Category 9-11
    Week 3, Day 1: Edge case tests pass (Category 11 all 40 tests)
    Week 3, Day 2: 100% branch coverage verified
    Week 3, Day 3: PR to integration

Commit conventions:
  feat(rules): add board creation and adjacency table [Stage 1]
  feat(rules): implement capture mechanics [Stage 2]
  feat(rules): add simple ko detection [Stage 3]
  feat(rules): implement Chinese scoring algorithm [Stage 4]
  feat(rules): add Zobrist hashing and superko [Stage 5]
  feat(rules): complete game flow and edge cases [Stage 6]
  test(rules): 178 test cases all passing
```

**TDD Guard Protocol for @rules-engineer**:
- TDD guard hook (`block_test_file_edit.py`) is ACTIVATED during Stages 1-3
- Test files in `__tests__/` cannot be modified without explicit `.tdd-guard` toggle
- This prevents the common error of "fixing the test to make it pass" instead of "fixing the implementation"

**Pre-PR Checklist for @rules-engineer**:
- [ ] 178 tests defined and passing
- [ ] 100% branch coverage on all rule implementations
- [ ] All 20 edge cases from DKS EC-01 through EC-20 have passing tests
- [ ] Zobrist hash collision test (verify hash uniqueness across 1000 random positions)
- [ ] Performance test: `getLegalMoves()` on 19x19 board executes in < 5ms
- [ ] No `any` types anywhere in `src/engine/rules/`
- [ ] All exports from `index.ts` match `IRulesEngine` interface

### 5.3 Data-Engineer Branch Strategy

**Branch**: `feat/storage`
**Base**: `integration` HEAD (after Step 10 scaffold completes)

```
feat/storage/
  Work sequence (TDD-first):
    Week 1, Day 1: Write all storage test stubs (23 tests)
    Week 1, Day 2-3: Implement MemoryStorageAdapter (in-memory tests pass)
    Week 1, Day 4: Implement TauriStorageAdapter (Tauri command wrappers)
    Week 1, Day 5: Implement settings CRUD with Zod validation
    Week 2, Day 1-2: Implement move log (append-only, composite PK enforcement)
    Week 2, Day 3: Implement SGF export
    Week 2, Day 4: Implement gamification data (quests, badges, streaks)
    Week 2, Day 5: Integration tests with MemoryStorageAdapter
    Week 3, Day 1-2: Rust-side Tauri command implementation
    Week 3, Day 3: PR to integration

Commit conventions:
  feat(storage): add Drizzle ORM schema (7 tables)
  feat(storage): implement MemoryStorageAdapter for testing
  feat(storage): add TauriStorageAdapter production implementation
  feat(storage): add settings CRUD with per-key Zod validation
  feat(storage): implement append-only move log
  feat(storage): add SGF export utility
  feat(storage): add Rust-side Tauri commands (storage_*)
  test(storage): all 23 storage tests passing
```

**Rust Side Coordination**:
The `@data-engineer` works in `src-tauri/src/storage/` for the Rust implementation of the 6 storage Tauri commands. The `@devops-engineer` pre-configures the Tauri plugin declarations in `tauri.conf.json` so the `@data-engineer` only needs to implement command handlers.

**Pre-PR Checklist for @data-engineer**:
- [ ] All 23 storage tests defined and passing
- [ ] MemoryStorageAdapter passes all tests (used by all other modules in testing)
- [ ] TauriStorageAdapter type-matches IStoragePort exactly
- [ ] SQLite WAL mode confirmed in INIT_PRAGMAS
- [ ] Foreign key cascade rules verified (deleteGame cascades to moves, analysis)
- [ ] 95%+ line coverage on storage module
- [ ] SGF export produces @sabaki/sgf-parseable output
- [ ] No direct SQLite access from TypeScript (all via Tauri commands)

### 5.4 Coordination Between Rules-Engineer and Data-Engineer

**Interaction points**: None during implementation. The two agents share no code.

**Post-implementation sync** (at integration merge):
- @data-engineer's `MemoryStorageAdapter` is used by @rules-engineer's test suite indirectly (via game-engine tests in Step 12)
- @rules-engineer's `IRulesEngine` output types (`GameState`, `BoardState`, `ScoreResult`) are stored by @data-engineer's storage layer
- Type compatibility verified at compile time after both PRs merge to integration

**No direct communication required during Week 1-2 development.**

---

## 6. Step 17 Team: Integration Phase

### 6.1 Overview

Step 17 is the integration phase where all feature modules are connected. This step deploys:
- **@integration-developer**: Assembles the feature layer (`gamification`, app routing, composition root)
- **@integration-tester**: Runs the full E2E suite and oracle validation

### 6.2 Integration Developer Branch Strategy

**Branch**: `feat/integration`
**Base**: `integration` (after all module PRs merged)

```
feat/integration/ work sequence:
  Day 1: Scaffold src/app/bootstrap.ts (composition root, adapter injection)
  Day 2: Implement gamification module using game-engine event subscriptions
  Day 3: Connect board-ui → game-engine → katago-bridge event flow
  Day 4: Wire explanation-engine output to board-ui ExplanationCard component
  Day 5: Connect i18n to all UI text points
  Day 6: Implement onboarding flow (tutorial → first game)
  Day 7: Run full integration test suite
  Day 8: Fix integration failures
  Day 9: PR to integration → oracle validation → E2E tests
  Day 10: Final integration PR approved

Commit conventions:
  feat(integration): add composition root with adapter injection
  feat(integration): wire game-engine → board-ui event flow
  feat(integration): connect explanation-engine to move analysis
  feat(integration): integrate gamification with game events
  feat(integration): complete onboarding tutorial flow
```

### 6.3 Integration Tester Branch Strategy

**Branch**: `feat/e2e-tests`
**Base**: `integration` (runs against built Tauri application)

```
feat/e2e-tests/ work sequence:
  Day 1: Scaffold Playwright configuration for Tauri
  Day 2: Implement E2E Scenarios 1-4 (first-game, quick-go, AI difficulty, explanation)
  Day 3: Implement E2E Scenarios 5-8 (SGF export, onboarding, gamification, settings)
  Day 4: Implement E2E Scenarios 9-12 (language, offline, review, timer)
  Day 5: Run oracle validation script (20 positions vs. KataGo)
  Day 6: Fix failing E2E tests
  Day 7: PR e2e tests to integration

Merge order: feat/e2e-tests merges AFTER feat/integration (tests require the wired app)
```

### 6.4 Step 17 Dependency on All Prior Steps

The integration phase cannot begin until ALL of the following are merged to `integration`:

```
Required merged PRs before Step 17:
  ✓ feat/core (Step 10 scaffold output)
  ✓ feat/rules-engine (Step 11)
  ✓ feat/storage (Step 11)
  ✓ feat/katago-bridge (Step 12)
  ✓ feat/explanation-engine (Step 13)
  ✓ feat/game-engine (Step 14)
  ✓ feat/board-ui (Step 15)
  ✓ feat/i18n (Step 15)
  ✓ feat/analytics (Step 16)
```

**Integration cannot start until the milestone gate for Step 16 passes.**

---

## 7. Integration Schedule

### 7.1 Weekly Merge Windows

Merges to the `integration` branch occur ONLY on **Monday and Thursday** during designated merge windows (10:00-12:00 and 14:00-16:00 local time).

**Rationale**: Scheduled merges prevent the "merge chaos" of multiple PRs landing simultaneously, which makes it impossible to attribute integration failures to a specific change.

```
Monday merge window:
  - Week 1: feat/core, feat/storage (first PRs; foundation must land together)
  - Week 2: feat/rules-engine, feat/katago-bridge (domain layer)
  - Week 3: feat/explanation-engine, feat/board-ui, feat/i18n
  - Week 4: feat/game-engine (requires rules-engine + storage)

Thursday merge window:
  - Week 1: feat/analytics (independent, can land early)
  - Week 2: Any fixes from Monday merge failures
  - Week 3: Any fixes from Monday merge failures
  - Week 4: feat/gamification (requires game-engine)
  - Week 5: feat/integration, feat/e2e-tests
```

### 7.2 Full Integration Schedule (5-Week Timeline)

```
WEEK 1 — Foundation Layer
  Monday:
    - [MERGE] feat/core → integration
    - [MERGE] feat/storage → integration
    - Integration test: TypeScript types consistent (tsc --noEmit)
    - Integration test: MemoryStorageAdapter basic CRUD

  Thursday:
    - [MERGE] feat/analytics → integration
    - Integration test: Analytics adapter swappable (NoOpAdapter in tests)
    - [DEV ACTIVE] feat/rules-engine, feat/katago-bridge, feat/explanation-engine
    - [DEV ACTIVE] feat/board-ui, feat/i18n, feat/game-engine

  Status gate: Week 1 ends with core + storage + analytics in integration

WEEK 2 — Domain Layer
  Monday:
    - [MERGE] feat/rules-engine → integration
    - Integration test: ALL 178 rules engine tests pass in CI
    - Integration test: IRulesEngine type exported correctly from index.ts

  Thursday:
    - [MERGE] feat/katago-bridge → integration
    - Integration test: MockKataGoAdapter IKatagoBridge contract compliance
    - Integration test: Circuit breaker state machine
    - [DEV ACTIVE] feat/explanation-engine, feat/board-ui, feat/game-engine

  Status gate: Week 2 ends with rules-engine + katago-bridge in integration

WEEK 3 — Application Layer Part 1
  Monday:
    - [MERGE] feat/explanation-engine → integration
    - Integration test: explain() with fixture AnalysisResponse produces non-empty output
    - Integration test: All 90 patterns exercised in coverage test
    - [MERGE] feat/i18n → integration
    - Integration test: All three locales load without missing keys

  Thursday:
    - [MERGE] feat/board-ui → integration
    - Integration test: React component renders 9x9 board without error
    - Integration test: Click interaction fires onMove callback

  Status gate: Week 3 ends with explanation + board-ui + i18n in integration

WEEK 4 — Application Layer Part 2
  Monday:
    - [MERGE] feat/game-engine → integration
    - Integration test: createGame() + playMove() + isGameOver() full sequence
    - Integration test: IRulesEngine.applyMove() called correctly from game-engine
    - Integration test: IStoragePort.appendMove() called on every move
    - **ORACLE VALIDATION RUNS** (first full oracle run)

  Thursday:
    - [MERGE] feat/gamification → integration
    - Integration test: completeQuest() + addXP() sequence
    - Integration test: Achievement unlock triggered by game event
    - Integration test: Streak tracking with MemoryStorageAdapter

  Status gate: Week 4 ends with ALL feature modules in integration
               Oracle validation: 20/20 positions match KataGo

WEEK 5 — Integration and E2E
  Monday:
    - [MERGE] feat/integration → integration
    - Full Tauri build produced
    - Integration test: App starts without error
    - Integration test: New game → play 3 moves → analysis appears

  Thursday:
    - [MERGE] feat/e2e-tests → integration
    - E2E: All 12 Playwright scenarios pass
    - Oracle validation: Re-run against integrated app
    - **INTEGRATION → MAIN PR opened**
    - Main PR: requires all CI green + team review

  Status gate: Week 5 ends with first release candidate on main
```

### 7.3 Integration Test Suite (Post-Merge Required)

After every merge to `integration`, the following automated checks run:

```
Integration Test Suite (runs on integration branch after each merge):

1. TypeScript compilation
   - tsc --noEmit across all modules
   - No type errors across module boundaries

2. Cross-module type compatibility
   - IRulesEngine methods accept and return correct types
   - IStoragePort accepts GameState from IRulesEngine output
   - IExplanationEngine accepts AnalysisResponse from IKatagoBridge

3. Module interface contract compliance
   - Each module's index.ts exports match interface definition
   - No missing methods
   - No extra public methods not in interface (interface segregation)

4. Regression suite
   - All unit tests for all merged modules pass
   - No previously-passing test now fails

5. Dependency rule verification
   - No Layer N importing from Layer N+1 (checked by eslint-plugin-import-order)
   - No circular imports (checked by madge)

6. Coverage regression
   - rules-engine: must not drop below 100% branch
   - All modules: must not drop below their target coverage
```

---

## 8. CI/CD Pipeline Design

### 8.1 Feature Branch CI (Fast Feedback)

Triggered on: every push to `feat/*`

```yaml
feature-branch-ci:
  timeout: 5 minutes
  jobs:
    lint-typecheck:
      - eslint src/{module}/
      - tsc --noEmit --module {module}
      duration: ~30s

    unit-tests:
      - vitest run src/{module}/__tests__/
      duration: ~60s

    coverage:
      - vitest run --coverage src/{module}/
      - check coverage threshold for this module
      duration: ~90s
```

**No integration tests, no KataGo, no Tauri build** on feature branch CI. Fast feedback loop (< 5 min).

### 8.2 Integration Branch CI (Full Verification)

Triggered on: every merge to `integration`

```yaml
integration-ci:
  timeout: 30 minutes
  jobs:
    typecheck-all:
      - tsc --noEmit (entire project)
      duration: ~60s

    unit-tests-all:
      - vitest run src/
      duration: ~120s

    coverage-all:
      - vitest run --coverage
      - enforce all module coverage thresholds
      duration: ~180s

    dependency-audit:
      - madge --circular (no circular imports)
      - eslint import/no-cycle
      duration: ~30s

    integration-tests:
      - vitest run tests/integration/
      duration: ~120s

    oracle-validation:  # Only if KataGo available
      - Build oracle validation script
      - Run against all 20 positions
      - Report: 0 Type A discrepancies required
      duration: ~300s

    tauri-build:  # Only on Thursday merge windows
      - cargo build (Rust backend)
      - vite build (Frontend)
      - tauri build --target {host}
      duration: ~600s

    e2e-tests:  # Only after tauri-build
      - playwright test e2e/
      - All 12 scenarios must pass
      duration: ~900s
```

### 8.3 Main Branch CI (Release Verification)

Triggered on: PR from `integration` to `main`

```yaml
main-ci:
  timeout: 60 minutes
  jobs:
    all-integration-ci-jobs  # All of the above

    release-build:
      - tauri build --release
      - Creates distributable: .dmg (macOS), .msi (Windows), .AppImage (Linux)

    smoke-test:
      - Install release build
      - Run E2E scenarios 1, 5, 10 (subset)
      - All pass required for merge to main
```

---

## 9. Merge Conflict Prevention Protocol

### 9.1 The Three Laws of Parallel Development

**Law 1: No agent writes to another agent's directory.**
Directory ownership is absolute (Section 4.1). If Agent A needs to call a function owned by Agent B, Agent A creates a mock in its own test directory, not in Agent B's source.

**Law 2: The interface contract file is sacred.**
`outputs/step-07-interfaces.ts` is the single source of truth. Feature branches do not modify it. If an interface needs to change, a breaking-change RFC is opened and the entire team pauses until the change is ratified.

**Law 3: Package.json is sequential.**
No two agents add npm dependencies simultaneously. The dependency addition protocol (Section 3.3) enforces sequential package.json modifications, preventing the most common merge conflict type.

### 9.2 Rebase Protocol

Before opening a PR to `integration`, every agent runs:

```bash
# Sync with latest integration
git fetch origin
git rebase origin/integration

# Resolve any conflicts (should be minimal — directory ownership prevents most)
# Run local tests to confirm rebase didn't break anything
npm run test

# Then open PR
```

**Force-push is allowed only on feat/* branches** (never on integration or main).

### 9.3 Conflict Resolution Priority

When a conflict does occur:

| Conflict Type | Resolution |
|--------------|------------|
| `package.json` conflict | @scaffold-agent or @devops-engineer resolves. Their version wins. |
| `tsconfig.json` conflict | @devops-engineer resolves. |
| `src/core/types/*.ts` conflict | @rules-engineer resolves. |
| Any other conflict | The PR author resolves. If unclear, pause and escalate to team lead. |

### 9.4 Interface Change Protocol

If a breaking change to any interface in `step-07-interfaces.ts` is required:

```
Step 1: Agent identifies the required change and opens an RFC (reason + proposed change)
Step 2: All affected agents review (any agent whose module uses this interface)
Step 3: Change ratified by majority (or blocked by any affected agent with justification)
Step 4: @rules-engineer implements the change in src/core/types/
Step 5: ALL feature branches rebase from integration
Step 6: Each affected agent updates their implementation to match new interface
Step 7: Sequential merges resume
```

**This process should be rare.** The Step 7 interface design was thorough specifically to avoid runtime interface changes.

---

## 10. Milestone Gates

### 10.1 Gate Definitions

Before each phase transition, specific quality gates must pass. CI failure at a gate blocks ALL subsequent work until the gate passes.

### Gate G1: Foundation Layer Complete (End of Week 1)

| Check | Required |
|-------|:--------:|
| `feat/core` merged to integration | YES |
| `feat/storage` merged to integration | YES |
| `feat/analytics` merged to integration | YES |
| TypeScript compilation: 0 errors | YES |
| MemoryStorageAdapter: all tests pass | YES |
| No circular imports | YES |

**Blocking**: Without G1, Level 1 module development cannot begin meaningfully (agents would lack the `core` types they depend on).

### Gate G2: Domain Layer Complete (End of Week 2)

| Check | Required |
|-------|:--------:|
| `feat/rules-engine` merged to integration | YES |
| `feat/katago-bridge` merged to integration | YES |
| Rules engine: 178 tests passing | YES |
| Rules engine: 100% branch coverage | YES |
| KataGo bridge: state machine tests passing | YES |
| Cross-module types: IRulesEngine compatible with core types | YES |

**Blocking**: Without G2, game-engine cannot be implemented (it directly depends on rules-engine).

### Gate G3: Application Layer Complete (End of Week 3-4)

| Check | Required |
|-------|:--------:|
| `feat/explanation-engine` merged | YES |
| `feat/board-ui` merged | YES |
| `feat/i18n` merged | YES |
| `feat/game-engine` merged | YES |
| `feat/gamification` merged | YES |
| Oracle validation: 0 Type A discrepancies | YES |
| Integration test suite: 100% pass | YES |

**Blocking**: Without G3, integration phase cannot begin.

### Gate G4: Integration Complete (End of Week 5)

| Check | Required |
|-------|:--------:|
| `feat/integration` merged | YES |
| Tauri release build succeeds | YES |
| All 12 E2E scenarios pass | YES |
| Oracle validation re-run: 0 discrepancies | YES |
| All coverage targets met | YES |
| No TypeScript errors | YES |
| No eslint errors | YES |

**Unlocks**: PR from integration → main (release candidate).

---

## 11. Risk Register

### 11.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| KataGo oracle discrepancy discovered | Medium | High | Pre-agreed discrepancy handling (Section 9.4 of test-strategy). Type A discrepancies block gate G3 until resolved. Human review required. |
| rules-engine performance on 19x19 | Low | Medium | Performance test (`getLegalMoves() < 5ms`) in CI. If violated, Zobrist hash computation moved to Rust Tauri command (transparent to IRulesEngine interface). |
| Tauri build failure on CI | Medium | High | @devops-engineer owns CI configuration and resolves Rust build issues. Feature agents never modify build configuration. |
| Interface change required mid-development | Low | High | RFC process (Section 9.4) ensures team-wide coordination. Interface was designed to be stable (Step 7 pACS=91). |
| KataGo binary unavailable in CI | Medium | Medium | Oracle validation is a separate CI job with `if: env.KATAGO_BINARY != ''` guard. Non-oracle tests run without KataGo. Oracle gate is required only for integration → main merge. |

### 11.2 Coordination Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|------------|
| Two agents accidentally modifying the same file | Low | High | Directory ownership map (Section 4.1) enforced by team. Pre-PR diff review required for any file outside agent's owned directories. |
| Feature branch diverges too far from integration | Medium | Medium | Agents rebase from integration every Monday (minimum). Rebase protocol (Section 9.2) is mandatory. |
| Gate G2 delay blocks game-engine development | Low | High | game-engine agent begins implementation with a `MockRulesEngine` stub (hardcoded responses). Real IRulesEngine swapped in after G2 passes. Game-engine tests pass with mock; integration tests use real engine. |
| Agent misunderstands interface contract | Low | Medium | Step 7 interfaces.ts includes JSDoc on every method. Before starting implementation, agent must read and acknowledge all interface contracts for their module. |

### 11.3 Schedule Buffer

Each gate has a 2-day buffer built into the 5-week timeline:

```
Week 1 target: G1 (2-day buffer for unexpected foundation issues)
Week 2 target: G2 (2-day buffer for rules-engine edge case complexity)
Week 3-4 target: G3 (2-day buffer for oracle validation fixing)
Week 5 target: G4 (2-day buffer for E2E scenario debugging)
```

If the critical path falls more than 3 days behind, the integration scope is negotiated (defer analytics integration to post-release, not core game flow).
