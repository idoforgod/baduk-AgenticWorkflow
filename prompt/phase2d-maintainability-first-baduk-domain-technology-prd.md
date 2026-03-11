# PHASE 2-D: Maintainability First — Baduk Domain Technology PRD

## Perspective: Code Quality & Long-Term Maintainability Expert

**Research Context**: Research 3 of 3-research series for AI Go (baduk) app service
**Prior Decisions**: Balanced Scenario (MAU 8K, MRR $5K), Balanced-Tech Stack v1.0 (Node.js 22, Next.js 15, PG 16, Redis 7.2, Drizzle, Biome, Coolify+Hetzner)
**Evaluator Lens**: 3-5 year maintainability, AI-agent readability, modularity, testability
**Date**: 2026-03-10

---

## Executive Summary

This PRD synthesizes all 10 PHASE 1 branch results through the lens of **long-term maintainability**. The central thesis: for a codebase built and maintained entirely by AI agents (Claude Code), maintainability is not a nice-to-have — it is the primary constraint that determines whether the system survives past Year 1.

Research evidence is stark. A 2025 GitClear study of 211 million changed lines found AI-assisted codebases exhibit 34% greater cyclomatic complexity and 2.1x code duplication compared to human-written code. A 2025 Springer study of open-source game engines found most score "poorly maintainable" under static analysis. These findings demand we design every module with explicit complexity budgets, mandatory test coverage, and AI-readability as a first-class architectural constraint.

**Recommendation Summary**: Evolutionary approaches win across all 5 domains. Event sourcing for the game server is the sole exception where upfront architectural investment pays compound maintainability dividends. LLM explanations require the most defensive architecture due to model volatility.

---

## Table of Contents

1. [Area 1: KataGo Integration](#area-1-katago-integration)
2. [Area 2: Go Rules Engine](#area-2-go-rules-engine)
3. [Area 3: LLM Explanation Pipeline](#area-3-llm-explanation-pipeline)
4. [Area 4: Real-time Game Server](#area-4-real-time-game-server)
5. [Area 5: Baduk UI/UX](#area-5-baduk-uiux)
6. [Maintainability Scorecard](#maintainability-scorecard)
7. [Module Dependency Graph](#module-dependency-graph)
8. [Anti-Patterns to Avoid](#anti-patterns-to-avoid-top-10)
9. [Future-Proof Analysis](#future-proof-analysis)
10. [AI Agent Maintainability Factors](#ai-agent-maintainability-factors)
11. [Development Timeline](#development-timeline)
12. [Maintenance Cost Projection](#maintenance-cost-projection)

---

## Area 1: KataGo Integration

### Branch Selection Rationale

**Selected: Branch 2 (Conservative) as foundation, with Branch 1 (Aggressive) abstractions as upgrade path.**

Branch 2's single-process child_process.spawn() with BullMQ is the correct starting point. Branch 1's process pool (2-4 processes) is premature optimization for MAU 8K. However, Branch 1's abstraction ideas (Analysis Engine Mode, model swappability) are critical for long-term maintainability and MUST be designed in from day one, even if the initial implementation is simple.

The key insight: KataGo is an **external black-box dependency** with its own release cycle, breaking changes, and model evolution. The #1 maintainability risk is tight coupling to a specific KataGo version or communication protocol.

### Maintainability Score: 8/10

KataGo's JSON stdin/stdout analysis mode is inherently well-structured for abstraction. The protocol is stable and documented. The main risk is process lifecycle management complexity.

### Module Complexity Budget

| Module | Max LOC | Max Cyclomatic Complexity | Responsibility |
|--------|---------|--------------------------|----------------|
| `katago-client.ts` | 200 | 8 | JSON protocol encoding/decoding, request/response typing |
| `katago-process.ts` | 150 | 6 | Process spawn, health check, restart logic |
| `katago-queue.ts` | 120 | 5 | BullMQ job creation, priority, timeout handling |
| `katago-config.ts` | 80 | 3 | Config schema validation, environment-based config |
| `analysis-service.ts` | 180 | 7 | Orchestration: accepts domain requests, translates to KataGo queries, returns domain results |

**Total budget: ~730 LOC** for the entire KataGo integration layer.

### Test Coverage Requirements

| Level | Coverage Target | What to Test |
|-------|----------------|--------------|
| Unit | 95% | JSON protocol encoding/decoding, config validation, response parsing |
| Integration | 85% | Process lifecycle (spawn, crash, restart), BullMQ job flow |
| E2E | 70% | Full analysis request → KataGo → parsed result, with real KataGo binary |

**Critical test cases**:
- KataGo process crash and auto-restart (3s backoff per Branch 2)
- Malformed JSON response handling
- Queue timeout (analysis takes >30s)
- Model file not found at startup
- Concurrent analysis requests serialization
- KataGo version mismatch detection

### Key Abstractions and Interfaces

```typescript
// The adapter boundary — KataGo never leaks beyond this interface
interface AnalysisEngine {
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
  getStatus(): EngineStatus;
  shutdown(): Promise<void>;
}

interface AnalysisRequest {
  readonly boardState: ReadonlyBoardState;
  readonly rules: RulesetId;
  readonly komi: number;
  readonly maxVisits: number;          // 5 | 50 | 500 per Branch 1 tiering
  readonly analysisMode: 'quick' | 'standard' | 'deep';
}

interface AnalysisResult {
  readonly topMoves: ReadonlyArray<ScoredMove>;
  readonly winRate: number;
  readonly scoreEstimate: number;
  readonly visits: number;
  readonly analysisTimeMs: number;
}

// Engine factory enables model/backend swappability
type EngineFactory = (config: EngineConfig) => AnalysisEngine;
```

**Design principle**: The `AnalysisEngine` interface is the **sole contract** between the application and KataGo. The rest of the application never knows it is talking to KataGo specifically. This enables:
- Swapping KataGo for another engine (e.g., Leela Zero, future engines)
- Mocking the entire engine for testing
- Running a "replay" engine that returns pre-computed results for demos

### AI Agent Readability Score: 9/10

KataGo integration is highly AI-readable because:
- JSON stdin/stdout is a well-understood pattern
- Process management is a standard Node.js pattern
- BullMQ has extensive documentation and examples
- The adapter pattern is one of the most common patterns in software engineering

### Dependency Coupling Analysis

```
External:  KataGo binary (loosely coupled via process boundary)
Internal:  BullMQ (queue abstraction — replaceable)
           Node.js child_process (stable API, zero risk)
Domain:    BoardState, RulesetId (shared types only — no logic coupling)
```

**Coupling risk**: LOW. The process boundary is a natural decoupling point. KataGo version upgrades only affect `katago-client.ts` (protocol layer).

### Recommended Refactoring Cadence

- **Month 6**: Review process management — consider pool if queue depth consistently >10
- **Month 12**: Evaluate KataGo version upgrades, update protocol layer if needed
- **Month 18**: Assess whether GPU upgrade path (Branch 1) is needed based on actual MAU growth
- **Year 2**: Consider extracting KataGo integration to a standalone microservice if analysis load warrants it

---

## Area 2: Go Rules Engine

### Branch Selection Rationale

**Selected: Branch 3 (Evolutionary) with disciplined test-first approach.**

Branch 4 (Big Bang) proposes 4-5K LOC + 6-8K LOC tests covering 6 rulesets and 45 edge cases in 10 weeks. This is a maintainability anti-pattern: building for requirements that don't yet exist. The 2025 Springer game engine study found that larger codebases correlate with *worse* maintainability scores, not better.

Branch 3's Tromp-Taylor base with Chinese scoring in 200-400 lines is the correct approach, but with a critical enhancement: **the code must be designed from day one to accept additional rulesets without modifying existing code** (Open/Closed Principle). This is the difference between "evolutionary" and "ad hoc."

The Tromp-Taylor rules are specifically designed for computer implementation — they are complete, unambiguous, and concise. Research from the University of Alberta confirms these rules map directly to algorithmic primitives (connectivity, liberties, scoring via reachability).

### Maintainability Score: 9/10

A Go rules engine is one of the most naturally testable, pure-functional domains in all of software engineering. Every function is deterministic: given a board state and a move, the output is completely determined. No I/O, no side effects, no timing dependencies.

### Module Complexity Budget

| Module | Max LOC | Max Cyclomatic Complexity | Responsibility |
|--------|---------|--------------------------|----------------|
| `board.ts` | 150 | 5 | Board representation (1D Uint8Array), stone placement, adjacency |
| `rules.ts` | 120 | 6 | Move legality, capture logic, ko detection |
| `scoring.ts` | 100 | 5 | Territory counting, Chinese scoring, dead stone detection |
| `zobrist.ts` | 60 | 2 | Hash computation for superko detection |
| `types.ts` | 50 | 1 | Shared type definitions, enums, readonly interfaces |
| `ruleset-registry.ts` | 40 | 2 | Strategy pattern for ruleset selection |

**Total budget: ~520 LOC** for core rules engine. Per the empirical study on Java method sizes (785,000 methods analyzed), individual functions should target ≤24 lines for optimal maintainability.

### Test Coverage Requirements

| Level | Coverage Target | What to Test |
|-------|----------------|--------------|
| Unit | 100% | Every function, every branch. No exceptions. |
| Property-based | 90% | Board symmetry invariants, capture reversibility, scoring consistency |
| Regression | 100% | Known edge cases: snapback, seki, bent-four-in-corner, thousand-year ko |

**Critical test strategy — the "Golden SGF" approach**:
- Curate 50+ SGF files covering known edge cases from professional games
- Each SGF becomes a regression test: replay moves, verify board state at each step
- This creates a living specification that is both human-readable and machine-executable
- Any new ruleset must pass the entire Golden SGF suite plus ruleset-specific cases

**Property-based test examples**:
```
Property: play(undo(state, move), move) ≡ state
Property: score(state) is invariant under board rotation/reflection
Property: if move is legal, the resulting board has no groups with zero liberties (except captured stones are removed)
Property: Zobrist hash of two identical board positions must be equal
```

### Key Abstractions and Interfaces

```typescript
// Immutable board state — the core data structure
interface BoardState {
  readonly size: 9 | 13 | 19;
  readonly stones: Uint8Array;          // 1D array, row-major
  readonly koPoint: number | null;
  readonly zobristHash: bigint;
  readonly captureCount: Readonly<{ black: number; white: number }>;
  readonly moveNumber: number;
}

// Pure function signatures — no side effects, no mutations
type PlayMove = (state: BoardState, move: Move) => BoardState | IllegalMoveError;
type GetLegalMoves = (state: BoardState, color: Color) => ReadonlyArray<Point>;
type CalculateScore = (state: BoardState, ruleset: Ruleset) => ScoreResult;
type DetectCaptures = (state: BoardState, point: Point) => ReadonlyArray<Point>;

// Ruleset as a strategy — enables OCP
interface Ruleset {
  readonly id: RulesetId;
  readonly name: string;
  isLegal(state: BoardState, move: Move): boolean;
  score(state: BoardState): ScoreResult;
  isSuperko(history: ReadonlyArray<bigint>, hash: bigint): boolean;
}
```

**Design principle**: The board is **always immutable**. `PlayMove` returns a new `BoardState`, never mutates the old one. This enables:
- Trivial undo/redo (just keep an array of states)
- Safe concurrent reads (no locking needed)
- Deterministic testing (no setup/teardown, no test order dependency)
- AI agents can reason about any function in isolation

The `Ruleset` strategy pattern means adding Japanese scoring later requires ZERO changes to existing code — just a new implementation of the `Ruleset` interface.

### AI Agent Readability Score: 10/10

This is the highest-scoring module for AI readability:
- Pure functions with explicit input/output types
- No hidden state, no side effects, no I/O
- Mathematical domain with well-defined terminology
- Existing open-source implementations (weiqi.js uses immutable data structures) provide training data
- Tests serve as executable specifications

### Dependency Coupling Analysis

```
External:  NONE (zero external dependencies)
Internal:  types.ts only (shared type definitions)
Domain:    Self-contained — does not depend on any other module
```

**Coupling risk**: ZERO. This is the most decoupled module in the entire system. It should stay that way. The rules engine should never import from the game server, the UI, or KataGo.

### Recommended Refactoring Cadence

- **Month 3**: Review after MVP — assess whether function sizes are within 24-line guideline
- **Month 6**: Add Japanese scoring ruleset if user demand warrants it
- **Month 12**: Evaluate property-based test coverage, add new properties as edge cases are discovered
- **Year 2**: Consider WASM compilation if client-side rules validation becomes a performance bottleneck

---

## Area 3: LLM Explanation Pipeline

### Branch Selection Rationale

**Selected: Branch 6 (Robust) as architecture, with Branch 5 (Rapid) V1 template system as initial implementation.**

This is the most critical maintainability decision in the entire PRD. The evidence is unambiguous:

1. **LLMs have ZERO understanding of Go** (Branch 6's core finding). They cannot reliably evaluate positions, calculate liberties, or assess territorial influence. Research on LLMs playing chess found hallucination rates in move selection, line-of-sight errors, and state tracking failures — and chess is *simpler* than Go for LLMs due to more training data.

2. **Model churn is the highest external risk**. Unlike KataGo (stable, version-controlled), LLM APIs change pricing, capabilities, and behavior with every model update. An architecture that tightly couples to Claude Haiku or GPT-4 will require rewriting every 6-12 months.

3. **Cost volatility is real**. Branch 5 projects $1,200-2,200/mo at MAU 8K. A model price increase or usage spike could make this unsustainable.

Therefore: **Build the template system first (Branch 5 V1, 10 days), design the LLM integration architecture per Branch 6 (validation pipeline, golden dataset, fallback), but defer full LLM integration to V2.**

### Maintainability Score: 6/10

This is the lowest-scoring area because:
- LLM behavior is non-deterministic — tests are probabilistic, not deterministic
- Prompt engineering is inherently fragile (model updates break prompts)
- Validation logic for Go explanations requires domain expertise that is hard to encode
- Cost management adds operational complexity

### Module Complexity Budget

| Module | Max LOC | Max Cyclomatic Complexity | Responsibility |
|--------|---------|--------------------------|----------------|
| `explanation-templates.ts` | 200 | 5 | Template registry, pattern matching for position types |
| `explanation-service.ts` | 150 | 6 | Orchestration: decide template vs LLM, assemble context |
| `llm-client.ts` | 120 | 4 | Model-agnostic LLM API wrapper (provider pattern) |
| `prompt-registry.ts` | 100 | 3 | Versioned prompts with metadata, A/B test support |
| `explanation-validator.ts` | 180 | 7 | 4-layer validation: structural → numerical → domain → coherence |
| `context-builder.ts` | 150 | 5 | Translate KataGo analysis into LLM-consumable context |
| `fallback-chain.ts` | 80 | 4 | Template fallback when LLM confidence is low |

**Total budget: ~980 LOC** for the entire explanation pipeline.

### Test Coverage Requirements

| Level | Coverage Target | What to Test |
|-------|----------------|--------------|
| Unit | 90% | Template rendering, prompt assembly, context building, validation rules |
| Integration | 80% | LLM API calls (mocked), fallback chain behavior, caching |
| Golden Dataset | 200 positions | Accuracy benchmark per Branch 6: target 75-80% |
| Regression | 100% | Every reported incorrect explanation becomes a permanent test case |

**Critical test strategy — the "Explanation Snapshot" approach**:
- For template-based explanations: deterministic snapshot tests (exact output matching)
- For LLM-based explanations: structural validation tests (has required fields, numbers are plausible, references correct move coordinates)
- For the validation pipeline: adversarial tests with deliberately wrong explanations to verify detection

### Key Abstractions and Interfaces

```typescript
// Provider-agnostic LLM interface
interface LLMProvider {
  readonly providerId: string;
  readonly modelId: string;
  complete(prompt: VersionedPrompt, context: ExplanationContext): Promise<RawExplanation>;
  estimateCost(prompt: VersionedPrompt): CostEstimate;
}

// Versioned prompts — never edit in place, always create new version
interface VersionedPrompt {
  readonly id: string;
  readonly version: number;
  readonly template: string;
  readonly requiredContextFields: ReadonlyArray<string>;
  readonly createdAt: Date;
  readonly deprecated: boolean;
}

// Validation pipeline — composable, ordered
interface ExplanationValidator {
  readonly validatorId: string;
  readonly severity: 'block' | 'warn' | 'info';
  validate(explanation: RawExplanation, context: ExplanationContext): ValidationResult;
}

// The main service interface — consumers never see the internals
interface ExplanationService {
  explain(
    position: BoardState,
    analysis: AnalysisResult,
    options: ExplanationOptions
  ): Promise<ExplanationResult>;
}

// Explanation result includes confidence and source transparency
interface ExplanationResult {
  readonly text: string;
  readonly source: 'template' | 'llm' | 'hybrid';
  readonly confidence: number;            // 0.0 - 1.0
  readonly modelVersion?: string;
  readonly promptVersion?: number;
  readonly validationWarnings: ReadonlyArray<string>;
}
```

**Design principle**: Explanations carry **provenance metadata**. The consumer always knows whether an explanation came from a template or an LLM, what model version generated it, and what confidence level it has. This transparency is critical for debugging, cost tracking, and trust.

### AI Agent Readability Score: 7/10

Lower than other modules because:
- Prompt engineering has no formal specification — it's closer to art than engineering
- Validation logic embeds domain knowledge that AI agents may not fully understand
- A/B testing and cost tracking add accidental complexity

Mitigations:
- Explicit JSDoc on every prompt explaining *why* each instruction exists
- Validation rules expressed as data (JSON schema-like) rather than imperative code
- Clear naming: `validateMoveCoordinatesExist`, not `validate`

### Dependency Coupling Analysis

```
External:  LLM API (high volatility — mitigated by provider pattern)
           Token pricing APIs (medium volatility)
Internal:  AnalysisResult from KataGo module (readonly data only)
           BoardState from rules engine (readonly data only)
Domain:    Deep domain coupling in validation logic (unavoidable)
```

**Coupling risk**: MEDIUM-HIGH. The LLM provider dependency is inherently volatile. Mitigation: the `LLMProvider` interface + provider registry pattern. Swapping from Haiku to a new model should require only a new implementation file, not changes to existing code.

### Recommended Refactoring Cadence

- **Month 3**: Review template coverage — are templates handling 80%+ of explanation requests?
- **Month 6**: Evaluate LLM V2 integration based on model improvements and cost trends
- **Month 9**: Review golden dataset — add 50 more positions based on user feedback
- **Month 12**: Major prompt audit — all prompts tested against latest model versions
- **Every model update**: Run golden dataset benchmark, flag regressions
- **Year 2**: Consider fine-tuned model if template+LLM hybrid doesn't reach 85% accuracy

---

## Area 4: Real-time Game Server

### Branch Selection Rationale

**Selected: Branch 7 (Debt Minimized) — event sourcing with pure core.**

This is the one area where the "build more upfront" approach wins on maintainability grounds:

1. **Event sourcing is a natural fit for board games.** Every Go game is already a sequence of events (moves). Replaying an identical stream of events always produces the same board state. This is not an architectural choice — it is recognizing the domain's inherent structure. The Martin Fowler event sourcing reference and multiple industry analyses confirm this is a canonical use case.

2. **Immutable GameState eliminates entire bug categories.** No race conditions on shared mutable state. No "who modified this field?" debugging sessions. No test flakiness from state leakage between tests. For AI agents maintaining this code, immutable state means every function can be understood in isolation.

3. **The upfront cost is justified by maintenance savings.** Branch 8 (Practical) ships in 10-14 days but tracks 8 known shortcuts. Each shortcut is a future maintenance task with unknown cost. Branch 7's 5-6 weeks includes building those correctly the first time.

4. **Event sourcing simplifies future features.** Game replay, undo/redo, spectator mode, post-game analysis — all are trivial with event sourcing. With mutable state, each requires separate implementation.

**However**: We explicitly avoid "pure" event sourcing. Per the research, real-world event sourcing systems always require snapshots for performance and projections for queries. We design for this hybrid from day one.

### Maintainability Score: 8/10

Event sourcing's natural fit with the domain, combined with immutable state, yields high maintainability. Deducting points for the inherent complexity of the event store + projection + snapshot trio.

### Module Complexity Budget

| Module | Max LOC | Max Cyclomatic Complexity | Responsibility |
|--------|---------|--------------------------|----------------|
| `game-events.ts` | 100 | 2 | Event type definitions (discriminated union) |
| `game-state.ts` | 180 | 6 | Pure reducer: GameState × Event → GameState |
| `game-aggregate.ts` | 150 | 7 | Command validation, event emission |
| `event-store.ts` | 120 | 4 | Append-only event persistence (PG-backed) |
| `game-projections.ts` | 150 | 5 | Read-model builders for queries |
| `snapshot-manager.ts` | 80 | 3 | Periodic state snapshots for rehydration performance |
| `game-clock.ts` | 120 | 5 | Time control logic (byoyomi, Fischer) |
| `matchmaking.ts` | 100 | 4 | Player pairing, rating-based matching |
| `ws-gateway.ts` | 150 | 5 | WebSocket connection management, message routing |
| `game-commands.ts` | 80 | 3 | Command definitions and basic validation |

**Total budget: ~1,230 LOC** for the entire game server.

### Test Coverage Requirements

| Level | Coverage Target | What to Test |
|-------|----------------|--------------|
| Unit | 95% | Reducer (state transitions), command validation, clock logic |
| Integration | 85% | Event store persistence, projection building, snapshot/rehydration |
| E2E | 75% | Complete game flow: matchmake → play → resign/score → store |

**Critical test strategy — the "Event Replay" approach**:
- Record event streams from actual games during development
- Replay tests: given event stream S, verify `fold(initialState, S) === expectedFinalState`
- Snapshot tests: verify `rehydrate(snapshot, remainingEvents) === fold(initialState, allEvents)`
- Clock tests: use deterministic time injection (no `Date.now()` in production code)

### Key Abstractions and Interfaces

```typescript
// Discriminated union of all game events — exhaustive pattern matching
type GameEvent =
  | { type: 'GAME_CREATED'; gameId: string; players: PlayerPair; rules: RulesetId; timestamp: number }
  | { type: 'MOVE_PLAYED'; player: Color; point: Point; moveNumber: number; timestamp: number }
  | { type: 'PASS'; player: Color; moveNumber: number; timestamp: number }
  | { type: 'RESIGN'; player: Color; timestamp: number }
  | { type: 'SCORING_STARTED'; timestamp: number }
  | { type: 'DEAD_STONE_MARKED'; point: Point; markedBy: Color; timestamp: number }
  | { type: 'SCORE_AGREED'; result: GameResult; timestamp: number }
  | { type: 'TIMEOUT'; player: Color; timestamp: number };

// Pure reducer — the heart of the system
type GameReducer = (state: GameState, event: GameEvent) => GameState;

// Command interface — validates and produces events
interface GameCommandHandler {
  handle(state: GameState, command: GameCommand): GameEvent[] | CommandError;
}

// Event store — append-only
interface EventStore {
  append(gameId: string, events: GameEvent[], expectedVersion: number): Promise<void>;
  getEvents(gameId: string, fromVersion?: number): Promise<GameEvent[]>;
  getSnapshot(gameId: string): Promise<{ state: GameState; version: number } | null>;
  saveSnapshot(gameId: string, state: GameState, version: number): Promise<void>;
}
```

**Design principle**: The `GameReducer` is a **pure function** with zero dependencies. It imports nothing except type definitions. It can be tested with no setup, no database, no network. The entire game logic lives in this function and the rules engine it delegates to.

### AI Agent Readability Score: 8/10

Event sourcing patterns are well-documented and AI agents have extensive training data on them. The discriminated union pattern for events enables exhaustive switch/case matching that AI agents handle well. Deducting points for snapshot/projection complexity which requires understanding the full lifecycle.

### Dependency Coupling Analysis

```
External:  PostgreSQL (via Drizzle — event store persistence)
           Redis (via BullMQ — matchmaking queue, optional pub/sub)
           WebSocket library (ws or Socket.io)
Internal:  Rules engine (pure function calls — tight but appropriate coupling)
           KataGo module (for post-game analysis, loosely coupled via queue)
Domain:    GameState, GameEvent types shared with UI (serializable)
```

**Coupling risk**: LOW-MEDIUM. The pure core (reducer + commands) has zero external dependencies. The infrastructure layer (event store, WebSocket gateway) has normal database/network coupling. The key discipline: **never let infrastructure concerns leak into the pure core**.

### Recommended Refactoring Cadence

- **Month 3**: Review event schema — are there events we defined but never emit?
- **Month 6**: Evaluate projection performance — do we need materialized views?
- **Month 12**: Snapshot strategy review — are snapshots happening at the right frequency?
- **Month 18**: Assess whether event store needs partitioning based on game volume
- **Year 2**: Consider event versioning strategy if schema evolution is needed

---

## Area 5: Baduk UI/UX

### Branch Selection Rationale

**Selected: Branch 10 (Classical) as component foundation, with select modern patterns from Branch 9.**

Branch 10's 18 minimal components in 4-5 weeks beats Branch 9's 30 components in 6 weeks on every maintainability metric:
- Fewer components = smaller surface area for bugs
- 20+ years of proven Go board UI patterns = battle-tested design decisions
- Minimal component count reduces inter-component coupling

However, Branch 9 contributes critical UX patterns that Branch 10 underspecifies:
- **Tap-Preview-Confirm** (mobile): essential for touch-based play, proven UX pattern
- **Zustand** for state management: simpler than Redux, better than prop drilling
- **Recharts** for game statistics: lightweight, composable, well-maintained

**Shudan fork**: Both branches recommend forking Shudan (SabakiHQ's Preact Goban component). This is correct. Shudan uses only `<div>`, `<span>`, `<svg>`, `<rect>`, and `<circle>` with CSS classes — maximally simple DOM structure. However, a fork creates a maintenance obligation. We should contribute upstream where possible and minimize fork divergence.

### Maintainability Score: 7/10

UI code is inherently harder to maintain than pure logic code because:
- Visual correctness requires human judgment (AI agents can't visually verify)
- Browser compatibility introduces non-determinism
- CSS specificity and layout interactions create subtle coupling
- User interaction flows create complex state machines

### Module Complexity Budget

| Module | Max LOC | Max Cyclomatic Complexity | Responsibility |
|--------|---------|--------------------------|----------------|
| `Goban.tsx` | 200 | 6 | SVG board rendering, stone placement, grid lines |
| `Stone.tsx` | 60 | 3 | Individual stone rendering (black/white/ghost) |
| `BoardOverlay.tsx` | 120 | 5 | Territory markers, move numbers, annotations |
| `GameControls.tsx` | 100 | 4 | Pass, resign, undo, score buttons |
| `MoveTree.tsx` | 150 | 6 | Variation tree navigation |
| `PlayerInfo.tsx` | 80 | 3 | Name, rank, captures, clock |
| `GameClock.tsx` | 100 | 5 | Countdown timer with byoyomi display |
| `AnalysisPanel.tsx` | 150 | 5 | KataGo results display, win rate graph |
| `ExplanationCard.tsx` | 80 | 3 | LLM explanation display with confidence indicator |
| `ChatPanel.tsx` | 100 | 4 | In-game messaging |
| `useGameState.ts` | 120 | 5 | Zustand store: game state subscription and updates |
| `useWebSocket.ts` | 100 | 4 | WebSocket connection lifecycle hook |
| `useBoardInteraction.ts` | 80 | 4 | Touch/mouse event handling, preview stone placement |

**Total budget: ~1,440 LOC** across 13 core modules (vs. Branch 9's ~30 or Branch 10's ~18). Target: fewer modules with clear boundaries.

### Test Coverage Requirements

| Level | Coverage Target | What to Test |
|-------|----------------|--------------|
| Unit | 85% | Zustand stores, utility functions, data transformations |
| Component | 80% | Render tests with React Testing Library — structure and props |
| Visual Regression | Key screens | Chromatic/Percy snapshots for Goban rendering |
| E2E | 60% | Critical user flows: start game, play move, resign, review |
| Accessibility | 100% critical paths | Screen reader navigation, keyboard-only play, ARIA labels |

**Critical test strategy**:
- Goban rendering: snapshot tests for 9x9, 13x13, 19x19 boards in empty, mid-game, and end-game states
- Interaction: unit tests for the `useBoardInteraction` hook in isolation
- State: test Zustand stores independently of components (Zustand stores are just functions)
- WebSocket: mock WebSocket and test reconnection, message ordering, error handling

### Key Abstractions and Interfaces

```typescript
// Board display state — decoupled from game logic
interface BoardDisplayState {
  readonly size: 9 | 13 | 19;
  readonly stones: ReadonlyArray<ReadonlyArray<StoneColor | null>>;
  readonly markers: ReadonlyArray<BoardMarker>;
  readonly ghostStone: { point: Point; color: StoneColor } | null;
  readonly lastMove: Point | null;
}

// Component props follow "render props" pattern for customization
interface GobanProps {
  readonly board: BoardDisplayState;
  readonly onIntersectionClick?: (point: Point) => void;
  readonly onIntersectionHover?: (point: Point | null) => void;
  readonly interactive: boolean;
  readonly theme?: GobanTheme;
}

// Zustand store — thin, predictable
interface GameStore {
  // State
  readonly boardDisplay: BoardDisplayState;
  readonly gamePhase: 'playing' | 'scoring' | 'finished';
  readonly playerInfo: { black: PlayerInfo; white: PlayerInfo };

  // Actions (not async — WS messages are fire-and-forget)
  playMove: (point: Point) => void;
  pass: () => void;
  resign: () => void;
  markDeadStone: (point: Point) => void;
}
```

**Design principle**: The UI layer never contains game logic. It receives `BoardDisplayState` (a read-only view model) and emits user intentions (click, pass, resign). The Zustand store translates between WebSocket messages and display state. This ensures:
- Components are testable with static props
- Game logic changes never require UI changes
- UI redesigns never risk breaking game rules

### AI Agent Readability Score: 7/10

Lower than backend modules because:
- JSX mixing logic and markup is harder to parse than pure functions
- CSS interactions create implicit coupling that doesn't show up in imports
- SVG coordinate math requires spatial reasoning

Mitigations:
- Extract all coordinate math into pure utility functions
- Use CSS Modules or Tailwind (explicit, local styles)
- Keep components under 200 LOC — split rendering from logic hooks

### Dependency Coupling Analysis

```
External:  React/Next.js (stable, low risk)
           Zustand (minimal API, easy to replace)
           Shudan fork (medium risk — fork maintenance burden)
           Recharts (optional, isolated to analysis panel)
Internal:  WebSocket gateway (message protocol)
           Shared types (BoardState, GameEvent — serializable)
Domain:    Board display is a PROJECTION of game state, never the source of truth
```

**Coupling risk**: MEDIUM. The Shudan fork is the highest-risk dependency. Mitigation: wrap Shudan in our own `<Goban>` component so that replacing the rendering engine only affects one file.

### Recommended Refactoring Cadence

- **Month 3**: Accessibility audit — verify screen reader support, keyboard navigation
- **Month 6**: Performance audit — React Profiler for unnecessary re-renders
- **Month 9**: Mobile UX review — touch targets, gesture handling
- **Month 12**: Visual refresh — update theme without changing component structure
- **Year 2**: Consider migrating from Shudan fork to custom renderer if fork drift becomes unsustainable

---

## Maintainability Scorecard

All 5 areas rated across 5 dimensions (1-10 scale, 10 = best):

| Area | Readability | Testability | Modularity | Extensibility | AI-Friendliness | **Overall** |
|------|:-----------:|:-----------:|:----------:|:------------:|:---------------:|:-----------:|
| **KataGo Integration** | 9 | 8 | 9 | 8 | 9 | **8.6** |
| **Go Rules Engine** | 10 | 10 | 10 | 9 | 10 | **9.8** |
| **LLM Explanation** | 6 | 5 | 7 | 8 | 7 | **6.6** |
| **Game Server** | 8 | 9 | 8 | 9 | 8 | **8.4** |
| **Baduk UI/UX** | 7 | 6 | 7 | 7 | 7 | **6.8** |
| **System Average** | 8.0 | 7.6 | 8.2 | 8.2 | 8.2 | **8.0** |

**Analysis**: The Go Rules Engine is the crown jewel — pure functions with perfect testability. The LLM Explanation Pipeline is the weakest link due to inherent non-determinism and external dependency volatility. The system average of 8.0 is achievable and defensible.

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SHARED TYPES LAYER                          │
│  types.ts (BoardState, Point, Color, Move, GameEvent, RulesetId)   │
│  ← Zero logic, only readonly interfaces and type aliases           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ (imported by all modules)
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  GO RULES ENGINE │ │  KATAGO MODULE   │ │  LLM EXPLANATION │
│                  │ │                  │ │                  │
│  board.ts        │ │  katago-client   │ │  templates       │
│  rules.ts        │ │  katago-process  │ │  llm-client      │
│  scoring.ts      │ │  katago-queue    │ │  prompt-registry │
│  zobrist.ts      │ │  katago-config   │ │  validator       │
│  ruleset-registry│ │  analysis-svc    │ │  context-builder │
│                  │ │                  │ │  fallback-chain  │
│  ← ZERO external │ │  ← KataGo binary │ │  ← LLM API      │
│    dependencies  │ │    + BullMQ      │ │    + KataGo out  │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                     │
         │            ┌──────┴──────┐               │
         │            │             │               │
         ▼            ▼             │               ▼
┌──────────────────────────────┐   │  ┌──────────────────────────────┐
│       GAME SERVER            │   │  │          UI LAYER            │
│                              │   │  │                              │
│  game-events.ts              │   │  │  Goban.tsx                   │
│  game-state.ts (uses rules)  │───┘  │  GameControls.tsx            │
│  game-aggregate.ts           │      │  AnalysisPanel.tsx           │
│  event-store.ts              │      │  ExplanationCard.tsx         │
│  game-projections.ts         │      │  useGameState.ts (Zustand)   │
│  snapshot-manager.ts         │      │  useWebSocket.ts             │
│  game-clock.ts               │      │                              │
│  matchmaking.ts              │      │  ← React, Zustand, Shudan   │
│  ws-gateway.ts               │      │    fork, Recharts            │
│                              │      │                              │
│  ← PG (Drizzle), Redis,     │◄────►│  ← WebSocket messages only   │
│    WebSocket, BullMQ         │      │    (no direct imports)        │
└──────────────────────────────┘      └──────────────────────────────┘

COUPLING RULES:
  ← Rules Engine depends on: NOTHING (only shared types)
  ← KataGo Module depends on: NOTHING (only shared types + external binary)
  ← LLM Explanation depends on: KataGo output types (readonly), Rules types (readonly)
  ← Game Server depends on: Rules Engine (function calls)
  ← UI depends on: NOTHING server-side (WebSocket protocol only)

DATA FLOW:
  Rules Engine → Game Server (function calls, synchronous)
  KataGo Module → Game Server (async via BullMQ queue)
  KataGo Module → LLM Explanation (analysis results as data)
  Game Server ↔ UI (WebSocket, serialized events)
  LLM Explanation → UI (HTTP API, JSON responses)
```

---

## Anti-Patterns to Avoid (Top 10)

### 1. The "Omniscient Board" Anti-Pattern
**What**: Putting game logic, rendering logic, network logic, and AI analysis into a single Board class.
**Why it's tempting**: "The board is the center of everything."
**Why it's fatal**: A single Board class with >500 LOC becomes the module everyone modifies. Every change risks breaking unrelated functionality. AI agents can't reason about the class because its responsibilities are unbounded.
**Prevention**: Strict separation — `BoardState` (data), `Rules` (logic), `Goban` (rendering), `GameAggregate` (state machine) are 4 separate modules that never know about each other.

### 2. The "KataGo Knows Best" Anti-Pattern
**What**: Passing raw KataGo JSON responses directly to the UI or LLM.
**Why it's tempting**: "KataGo already computed everything we need."
**Why it's fatal**: KataGo's response format is an implementation detail. When KataGo updates its JSON schema, every consumer breaks. KataGo's `moveInfos` array contains 50+ fields — the UI needs 5 of them.
**Prevention**: The `AnalysisResult` interface is the boundary. KataGo responses are parsed and mapped to domain types in `katago-client.ts` and nowhere else.

### 3. The "Prompt Hardcoding" Anti-Pattern
**What**: Embedding LLM prompts as string literals inside business logic functions.
**Why it's tempting**: "It's just one prompt, I'll refactor later."
**Why it's fatal**: Prompt changes require modifying business logic files. No version history. No A/B testing. No rollback capability. When the model changes and the prompt breaks, you can't quickly revert to the previous version.
**Prevention**: All prompts live in the `prompt-registry.ts` with explicit versioning. Prompts are data, not code.

### 4. The "Mutable Game State" Anti-Pattern
**What**: Using `board[x][y] = stone` instead of creating a new board state.
**Why it's tempting**: "Mutation is faster and simpler."
**Why it's fatal**: Mutable state creates temporal coupling — the order in which functions are called matters. Tests become flaky. Undo requires manual state tracking. AI agents can't reason about a function's behavior without knowing the entire call chain that preceded it.
**Prevention**: `Readonly<>` on every state interface. `Object.freeze()` in development mode. ESLint rule `no-param-reassign`.

### 5. The "WebSocket Spaghetti" Anti-Pattern
**What**: Handling game logic directly in WebSocket message handlers.
**Why it's tempting**: "The message handler already has access to the socket and the game."
**Why it's fatal**: WebSocket handlers accumulate game logic, validation, error handling, and broadcasting into a single callback. Untestable without a live WebSocket connection.
**Prevention**: WebSocket handlers ONLY deserialize messages and call `GameCommandHandler.handle()`. The command handler returns events. The gateway broadcasts events. Zero logic in the handler itself.

### 6. The "Ruleset If-Else Chain" Anti-Pattern
**What**: `if (rules === 'chinese') { ... } else if (rules === 'japanese') { ... } else if ...`
**Why it's tempting**: "There are only 2 rulesets now."
**Why it's fatal**: Every new ruleset modifies existing code. The function grows linearly. Branch coverage becomes combinatorial.
**Prevention**: Strategy pattern with `Ruleset` interface. Adding a ruleset means adding a file, not modifying one.

### 7. The "God Component" Anti-Pattern
**What**: A `<GamePage>` component with 500+ lines managing board rendering, chat, clock, analysis, and WebSocket connection.
**Why it's tempting**: "It's all one page."
**Why it's fatal**: Any change to any feature requires reading and understanding the entire component. React re-renders the entire component tree on any state change.
**Prevention**: Composition. `<GamePage>` composes `<Goban>`, `<PlayerInfo>`, `<GameClock>`, `<ChatPanel>`, `<AnalysisPanel>`. Each gets exactly the props it needs.

### 8. The "Untested Edge Case" Anti-Pattern
**What**: Skipping tests for Go edge cases (seki, bent-four, thousand-year ko, moonshine life) because "they rarely happen."
**Why it's tempting**: "99% of games never encounter these."
**Why it's fatal**: When they do happen, the bug is catastrophic (incorrect game result). The fix is complex and risky because the edge case code was never tested. AI agents will be unable to fix these bugs without extensive domain knowledge.
**Prevention**: Golden SGF test suite with 50+ edge case positions, run on every commit.

### 9. The "Synchronous KataGo" Anti-Pattern
**What**: `await katago.analyze(position)` directly in the API handler, blocking the response until KataGo finishes.
**Why it's tempting**: "The user is waiting for the analysis anyway."
**Why it's fatal**: KataGo analysis takes 100ms-10s depending on visits. Blocking an API handler for 10s means that handler's thread is unavailable. Under load, the server runs out of handlers. Node.js event loop is blocked by waiting for the external process.
**Prevention**: Queue-based architecture. API handler enqueues a BullMQ job, returns a job ID. Client polls or subscribes via WebSocket for the result.

### 10. The "Missing Provenance" Anti-Pattern
**What**: Returning an LLM explanation without metadata about which model, prompt version, or confidence level generated it.
**Why it's tempting**: "The user just wants the explanation text."
**Why it's fatal**: When an explanation is wrong, you can't diagnose why. When a model changes and quality drops, you can't identify which explanations are affected. When costs spike, you can't attribute them.
**Prevention**: Every `ExplanationResult` includes `source`, `modelVersion`, `promptVersion`, `confidence`, and `validationWarnings`. Provenance is not optional.

---

## Future-Proof Analysis

### Year 1: What Changes

| Change | Likelihood | Architecture Impact | Readiness |
|--------|:----------:|:-------------------:|:---------:|
| KataGo minor version update | 95% | LOW — protocol layer absorbs | HIGH |
| Add Japanese scoring rules | 80% | NONE — new `Ruleset` implementation | HIGH |
| LLM model upgrade (Haiku → newer) | 90% | LOW — swap `LLMProvider` implementation | HIGH |
| Mobile app demand increases | 70% | LOW — responsive SVG already handles this | MEDIUM |
| User request for 13×13 rated games | 85% | NONE — board size is already parameterized | HIGH |
| Analysis queue scaling needs | 40% | LOW — BullMQ supports horizontal scaling | HIGH |

### Year 2: What Changes

| Change | Likelihood | Architecture Impact | Readiness |
|--------|:----------:|:-------------------:|:---------:|
| KataGo major version or alternative engine | 50% | LOW — `AnalysisEngine` interface absorbs | HIGH |
| Add Korean/AGA rulesets | 60% | NONE — add new `Ruleset` implementations | HIGH |
| Fine-tuned LLM for Go explanations | 40% | MEDIUM — new provider + updated validation | MEDIUM |
| Real-time spectating at scale (>1000 concurrent) | 30% | MEDIUM — may need pub/sub scaling | MEDIUM |
| Integration with external tournament systems | 50% | LOW — event sourcing provides clean API | HIGH |
| Client-side rules validation (WASM) | 35% | MEDIUM — rules engine needs compilation target | MEDIUM |

### Year 3: What Changes

| Change | Likelihood | Architecture Impact | Readiness |
|--------|:----------:|:-------------------:|:---------:|
| Next-generation AI engine (post-KataGo) | 30% | LOW — `AnalysisEngine` interface absorbs | HIGH |
| Multi-modal explanations (voice, diagram) | 40% | MEDIUM — new explanation renderers needed | MEDIUM |
| Social features (clubs, leagues) | 60% | LOW — game server event stream is extensible | HIGH |
| React framework migration (Next.js → ?) | 20% | HIGH — but Goban/logic layer survives | LOW |
| Regulatory requirements (data residency) | 25% | MEDIUM — event store partitioning needed | MEDIUM |
| AI teaching mode (interactive lessons) | 70% | MEDIUM — new game mode, but uses existing engine | HIGH |

### Summary

The architecture handles **Year 1 changes with zero structural modifications** in 90% of cases. Year 2 introduces modest pressure on the LLM pipeline and scaling layer. Year 3's highest-likelihood item (AI teaching mode) is well-served by the event sourcing foundation. The riskiest long-term change is a React framework migration, but the pure core modules (rules, game server logic, KataGo client) are framework-independent.

---

## AI Agent Maintainability Factors

### Max File Size for Effective AI Editing

Based on empirical data and the 2025 GitClear study showing AI agents produce 34% higher cyclomatic complexity in larger files:

| File Type | Max LOC | Rationale |
|-----------|---------|-----------|
| Pure logic (rules, reducers) | 200 | AI agents handle pure functions perfectly up to this size |
| Infrastructure (DB, WebSocket) | 150 | I/O code needs more context per line |
| React components | 150 | JSX mixing logic and markup is harder to parse |
| Test files | 300 | Tests can be longer because each test is independent |
| Type definitions | 100 | Types should be minimal and self-documenting |
| Configuration | 80 | Config files should be flat and obvious |

**Hard rule**: No file exceeds 300 LOC (excluding tests). If a file approaches 250 LOC, it must be split before the next feature is added. This is non-negotiable because research shows maintainability degrades sharply above this threshold, especially for AI-assisted codebases.

### Naming Conventions That Help AI Understanding

**Files**:
- `{domain}-{responsibility}.ts` — e.g., `game-reducer.ts`, `katago-client.ts`, `explanation-validator.ts`
- Avoid generic names: `utils.ts`, `helpers.ts`, `common.ts` — these become dump files
- Test files mirror source: `game-reducer.test.ts` tests `game-reducer.ts`

**Functions**:
- Verb-first: `calculateScore()`, `detectCaptures()`, `validateExplanation()`
- Boolean functions: `is-` or `has-` prefix: `isLegalMove()`, `hasLiberties()`
- Factory functions: `create-` prefix: `createGameState()`, `createAnalysisRequest()`
- Avoid abbreviations: `getAdjacentPoints()` not `getAdjPts()`

**Types**:
- Interfaces: noun, PascalCase: `BoardState`, `AnalysisResult`, `GameEvent`
- Enums: singular PascalCase: `Color`, `GamePhase`, `RulesetId`
- Discriminated unions: `type GameEvent = { type: 'MOVE_PLAYED'; ... } | { type: 'PASS'; ... }`
- Always use `readonly` for interface properties — AI agents should never need to ask "can this be mutated?"

**Constants**:
- `UPPER_SNAKE_CASE` for configuration: `MAX_VISITS`, `DEFAULT_KOMI`, `RESTART_BACKOFF_MS`
- Group related constants in namespaces: `KataGoConfig.DEFAULT_VISITS`, not `KATAGO_DEFAULT_VISITS`

### Test Patterns That Enable AI-Driven Refactoring

**Pattern 1: Arrange-Act-Assert with explicit state construction**
```typescript
// GOOD — AI can modify this test without understanding the test framework
test('capturing a group removes all stones in the group', () => {
  // Arrange
  const board = createBoardFromDiagram(`
    . B .
    B W B
    . B .
  `);

  // Act
  const result = playMove(board, { x: 0, y: 0, color: 'black' });

  // Assert
  expect(getStoneAt(result, { x: 1, y: 1 })).toBe(null);
  expect(result.captureCount.black).toBe(1);
});
```

**Pattern 2: Table-driven tests for exhaustive coverage**
```typescript
// GOOD — AI can add rows without understanding the test structure
const legalityTestCases = [
  { name: 'empty point is legal', board: '...', move: {x:1,y:0}, expected: true },
  { name: 'occupied point is illegal', board: '.B.', move: {x:1,y:0}, expected: false },
  { name: 'suicide is illegal', board: 'BWB', move: {x:0,y:0}, expected: false },
  // ... AI agent adds new row here
];

test.each(legalityTestCases)('$name', ({ board, move, expected }) => {
  expect(isLegalMove(parseBoardString(board), move)).toBe(expected);
});
```

**Pattern 3: Golden file tests for complex outputs**
```typescript
// GOOD — AI can update the golden file without understanding rendering logic
test('goban renders mid-game position correctly', () => {
  const board = loadSGF('fixtures/pro-game-move-42.sgf');
  const rendered = renderBoardToString(board);
  expect(rendered).toMatchSnapshot(); // or toMatchFileSnapshot('fixtures/expected/move-42.txt')
});
```

**Pattern 4: Contract tests for interfaces**
```typescript
// GOOD — any new Ruleset implementation automatically runs these tests
function rulesetContractTests(createRuleset: () => Ruleset) {
  test('empty board has at least 1 legal move', () => {
    const rules = createRuleset();
    const emptyBoard = createEmptyBoard(19);
    const legalMoves = rules.getLegalMoves(emptyBoard, 'black');
    expect(legalMoves.length).toBeGreaterThan(0);
  });

  test('passing is always legal', () => {
    const rules = createRuleset();
    const board = createEmptyBoard(19);
    expect(rules.isLegal(board, PASS_MOVE)).toBe(true);
  });

  // ... more universal Go rules contracts
}

// Each ruleset file runs the contract:
describe('Chinese Rules', () => rulesetContractTests(() => new ChineseRuleset()));
describe('Japanese Rules', () => rulesetContractTests(() => new JapaneseRuleset()));
```

---

## Development Timeline

### Phase 1: Foundation (Weeks 1-4)

| Week | Module | Deliverable | LOC Budget | Tests |
|------|--------|-------------|:----------:|:-----:|
| 1 | Shared Types | `types.ts` — all domain types | 50 | Type-level only |
| 1-2 | Rules Engine | Board, Tromp-Taylor rules, Chinese scoring | 400 | 200+ assertions |
| 2-3 | KataGo Integration | Process management, JSON protocol, BullMQ queue | 550 | 150+ assertions |
| 3-4 | Explanation Templates | V1 template system, 10 position patterns | 350 | 100+ assertions |

### Phase 2: Game Server Core (Weeks 5-8)

| Week | Module | Deliverable | LOC Budget | Tests |
|------|--------|-------------|:----------:|:-----:|
| 5-6 | Event Sourcing | Events, reducer, event store, commands | 600 | 200+ assertions |
| 6-7 | Game Clock | Byoyomi, Fischer, timeout handling | 120 | 50+ assertions |
| 7-8 | WebSocket Gateway | Connection management, message protocol | 250 | 80+ assertions |
| 8 | Matchmaking | Rating-based pairing, queue management | 100 | 40+ assertions |

### Phase 3: UI Layer (Weeks 7-11)

| Week | Module | Deliverable | LOC Budget | Tests |
|------|--------|-------------|:----------:|:-----:|
| 7-8 | Goban Component | SVG board, stone rendering, interaction | 400 | 60+ assertions |
| 9 | Game Page | Composition of all game components | 300 | 40+ assertions |
| 10 | Analysis Panel | KataGo results display, win rate graph | 230 | 30+ assertions |
| 11 | Polish | Mobile responsiveness, accessibility audit | - | A11y tests |

### Phase 4: Integration & Hardening (Weeks 10-13)

| Week | Module | Deliverable | LOC Budget | Tests |
|------|--------|-------------|:----------:|:-----:|
| 10-11 | E2E Integration | Full game flow, KataGo integration | - | 50+ E2E tests |
| 12 | LLM V2 Prep | LLM client, validation pipeline, prompt registry | 450 | 80+ assertions |
| 13 | Load Testing | Queue performance, WebSocket scaling | - | Benchmarks |

**Total timeline: 13 weeks** (3.25 months)
**Total production LOC budget: ~4,900 LOC** (excluding tests)
**Total test assertions: ~1,080+**

Note: Weeks overlap because UI development (Phase 3) begins while game server work (Phase 2) continues. This is safe because the dependency graph shows UI depends on the game server only via WebSocket protocol, which can be mocked.

---

## Maintenance Cost Projection

### Year 1: Establishment

| Category | Hours/Month | Monthly Cost (AI agent compute) | Notes |
|----------|:-----------:|:------------------------------:|-------|
| Bug fixes | 8 | $40 | Low — immutable state + high test coverage |
| KataGo updates | 2 | $10 | Version bumps, config tuning |
| LLM prompt tuning | 6 | $30 | Model updates require prompt adjustments |
| Dependency updates | 4 | $20 | Node.js, Next.js, library patches |
| New ruleset (Japanese) | 20 (one-time) | $100 | New `Ruleset` implementation + tests |
| Performance monitoring | 4 | $20 | Queue depth, response times, error rates |
| **Monthly total** | **24** | **$120** | Excluding one-time features |
| **LLM API costs** | - | **$1,200-1,800** | Templates handle 70-80% of requests |
| **Infrastructure** | - | **$60-80** | Hetzner CCX33 per Branch 2 |

**Year 1 total maintenance cost**: ~$17,000 (compute + LLM API + infrastructure)

### Year 2: Evolution

| Category | Hours/Month | Monthly Cost | Notes |
|----------|:-----------:|:------------:|-------|
| Bug fixes | 6 | $30 | Decreasing — mature codebase |
| Feature additions | 16 | $80 | Korean rules, teaching mode, social features |
| LLM pipeline evolution | 8 | $40 | Model evaluation, golden dataset expansion |
| Dependency updates | 6 | $30 | Next.js major version, library updates |
| Event store maintenance | 4 | $20 | Snapshot optimization, projection tuning |
| Performance optimization | 4 | $20 | Based on actual usage patterns |
| **Monthly total** | **44** | **$220** | Higher due to feature development |
| **LLM API costs** | - | **$1,500-2,500** | Growing usage, potentially cheaper models |
| **Infrastructure** | - | **$80-120** | Possible GPU addition for KataGo |

**Year 2 total maintenance cost**: ~$25,000

### Year 3: Maturity

| Category | Hours/Month | Monthly Cost | Notes |
|----------|:-----------:|:------------:|-------|
| Bug fixes | 4 | $20 | Minimal — stable codebase |
| Feature additions | 12 | $60 | New game modes, tournament support |
| Technical debt paydown | 8 | $40 | Proactive refactoring per cadence |
| Security & compliance | 4 | $20 | Dependency audits, vulnerability patches |
| Architecture evolution | 8 | $40 | Scaling decisions based on 2 years of data |
| **Monthly total** | **36** | **$180** | Steady state |
| **LLM API costs** | - | **$1,000-2,000** | Cheaper models, better templates |
| **Infrastructure** | - | **$100-150** | Scaled to actual usage |

**Year 3 total maintenance cost**: ~$20,000

### Cost Trajectory Summary

```
Year 1: $17,000  ████████████████░░░░  (Establishment — investment in test coverage pays off)
Year 2: $25,000  ████████████████████████░  (Peak — feature development + scaling)
Year 3: $20,000  ████████████████████░  (Maturity — steady state)

3-Year Total: ~$62,000
```

The cost curve peaks in Year 2 (feature additions) then declines as the architecture proves itself. The critical insight: **Year 1's investment in test coverage and immutable architecture directly reduces Year 2-3 bug fix costs.** Without that investment, bug fix costs would grow exponentially as the codebase scales.

---

## Appendix A: Research Sources

- [Analyzing maintainability factors in open-source game engines (Springer 2025)](https://link.springer.com/article/10.1007/s11042-025-20899-8)
- [AI Copilot Code Quality: 2025 Data (GitClear)](https://www.gitclear.com/ai_assistant_code_quality_2025_research)
- [State of AI code quality in 2025 (Qodo)](https://www.qodo.ai/reports/state-of-ai-code-quality/)
- [Event Sourcing Explained: Pros, Cons & Strategic Use Cases (BayTech 2025)](https://www.baytechconsulting.com/blog/event-sourcing-explained-2025)
- [Event Sourcing with Event Stores and Versioning in 2026](https://www.johal.in/event-sourcing-with-event-stores-and-versioning-in-2026/)
- [KataGo Analysis Engine Documentation](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [Shudan — Preact Goban Component (SabakiHQ)](https://github.com/SabakiHQ/Shudan)
- [weiqi.js — Immutable Go Implementation](https://github.com/cjlarose/weiqi.js/)
- [Empirical Study on Maintainable Method Size in Java (arXiv)](https://arxiv.org/pdf/2205.01842)
- [Event-driven design for gaming applications (epifab)](https://www.epifab.solutions/posts/event-driven-design-for-gaming-applications)
- [Martin Fowler — Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [OGS Online-Go GitHub](https://github.com/online-go)
- [AI-Generated Code Quality Metrics and Statistics for 2026 (Second Talent)](https://www.secondtalent.com/resources/ai-generated-code-quality-metrics-and-statistics-for-2026/)
- [The inevitable rise of poor code quality in AI-accelerated codebases (Sonar)](https://www.sonarsource.com/blog/the-inevitable-rise-of-poor-code-quality-in-ai-accelerated-codebases/)
- [LLMs and Chess — Why LLMs Can't Play Chess](https://www.nicowesterdale.com/blog/why-llms-cant-play-chess)
- [Tromp-Taylor Concise Rules of Go](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html)
