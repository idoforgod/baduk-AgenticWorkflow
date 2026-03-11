# Baduk Domain Technology PRD — Proven Stack (Most Conservative)

**Research**: 3 of 3 (Domain Technology Deep-Dive)
**Perspective**: Conservative, Reliability-Focused Technology Leader
**Date**: 2026-03-10
**Prior Context**: Balanced Scenario (MAU 8K, MRR $5K), Tech Stack v1.0 decided
**Builder**: AI Agents (Claude Code) — no human developers
**Philosophy**: "Slow is smooth, smooth is fast. Use what works. Every edge case must be handled. Zero surprises."

---

## Executive Summary

This PRD defines the **most conservative, most proven** version of the baduk domain technology stack. Every single choice has been made by asking one question: **"Has this exact pattern been running in production for 3+ years without major incident?"** Where the answer is no, the technology is deferred.

The Proven Stack is not the Stability stack (2.B) with a different label. It goes further in three critical ways:

1. **Templates ONLY for LLM explanations at launch.** No LLM API calls in v1.0. The LLM pipeline is the single largest source of unpredictable behavior in the entire stack. The Stability stack mitigates LLM risk with a 4-layer validation pipeline. The Proven Stack eliminates it entirely for launch. Templates are added first; LLM integration is a Phase 2 feature gated behind 60 days of template performance data.

2. **No BullMQ queue for KataGo.** The Stability stack uses BullMQ for job queuing. The Proven Stack uses a simple in-memory FIFO queue with overflow rejection. BullMQ is excellent software, but it introduces a Redis dependency for KataGo analysis that is unnecessary at MAU 8K (~200 concurrent users). A 50-slot in-memory queue is simpler, has zero external dependencies, and is trivially debuggable. BullMQ is added when the queue consistently reaches 80% capacity.

3. **ws WebSocket library instead of Socket.IO, with manual reconnection.** Both the Stability and Cutting Edge stacks agree on ws. The Proven Stack uses ws with a hand-written reconnection protocol that is fully testable and has zero magic. No auto-negotiation, no fallback transports, no rooms abstraction. Just raw WebSocket frames with JSON payloads and a 4-state connection state machine.

**Core thesis**: At MAU 8K, the winning strategy is not "build the most resilient system" but "build the simplest system that cannot fail." Simplicity is the ultimate reliability.

**Proven Score: 9.1 / 10** (highest achievable — the 0.9 deduction is for the inherent complexity of Go rules edge cases that no amount of conservatism can eliminate)

---

## Table of Contents

1. [KataGo Integration](#1-katago-integration)
2. [Go Rules Engine](#2-go-rules-engine)
3. [LLM Explanation Pipeline](#3-llm-explanation-pipeline)
4. [Real-time Game Server](#4-real-time-game-server)
5. [Baduk UI/UX](#5-baduk-uiux)
6. [Composite Analysis](#6-composite-analysis)
7. [Development Timeline](#7-development-timeline)
8. [Cost Estimate](#8-cost-estimate)
9. [Proven Score Methodology](#9-proven-score-methodology)
10. [What Proven Stack Sacrifices vs. What It Guarantees](#10-what-proven-stack-sacrifices-vs-what-it-guarantees)

---

## 1. KataGo Integration

### Most Conservative Viable Choice: Single CPU Process, In-Memory Queue, Watchdog

**Proven Score: 9.0 / 10**

### Justification

KataGo has been in active production use since 2019. The Analysis Engine JSON protocol has been stable since v1.3 (2020). The Eigen CPU backend has been available since v1.6.0 (2020) — **6 years of production history**. The b18c384nbt neural network is the recommended default, used by KaTrain, ZBaduk, BadukAI, and thousands of desktop users worldwide.

**What is proven**:
- KataGo Analysis Engine Mode: used by KaTrain (2020, 1000+ GitHub stars, actively maintained), ZBaduk (commercial service since ~2020), BadukAI, and dozens of Go tools
- Eigen CPU backend: zero GPU dependency, no TensorRT NaN crash risk (documented in v1.16.0), deterministic behavior across platforms
- child_process.spawn() in Node.js: Stability 2 API, unchanged since Node.js 0.12 (2015) — **11 years**
- JSON stdin/stdout IPC: the most basic, most debuggable inter-process communication pattern in existence

**What is NOT proven at our scale**: Process pool management, HumanSL model (v1.15.0+, only ~1 year old), TensorRT backend on Hetzner, BullMQ with KataGo-specific workloads.

### Architecture Decision

```
┌─────────────────────────────────────────────────────┐
│               Node.js Application                    │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  KataGo Service (singleton module)           │   │
│  │                                              │   │
│  │  ┌────────────────┐  ┌────────────────────┐  │   │
│  │  │  In-Memory FIFO │  │  KataGo Process    │  │   │
│  │  │  Queue          │  │  (single, Eigen)   │  │   │
│  │  │  max: 50 slots  │  │  b18c384nbt model  │  │   │
│  │  │  overflow: 429  │  │  stdin/stdout JSON  │  │   │
│  │  └────────────────┘  └────────────────────┘  │   │
│  │                                              │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │  Watchdog Timer (setInterval, 30s)     │  │   │
│  │  │  - Check: process.alive? (pid check)   │  │   │
│  │  │  - Check: RSS < 512MB? (process.memoryUsage) │
│  │  │  - Check: last response < 60s ago?     │  │   │
│  │  │  - Action: kill(SIGTERM) + respawn     │  │   │
│  │  │  - Backoff: 3s, 6s, 12s, max 30s      │  │   │
│  │  │  - Circuit: 5 restarts/10min → HALT    │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  No Redis dependency for analysis.                  │
│  No BullMQ. No process pool.                        │
│  No GPU. No TensorRT. No HumanSL.                   │
└─────────────────────────────────────────────────────┘
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| KataGo Version | v1.16.4 (Oct 2025) | Latest stable; includes bugfixes for v1.16.0 NaN issues and eval cache |
| Backend | Eigen (CPU, AVX2) | Zero GPU dependencies; AMD EPYC Genoa on Hetzner supports AVX2/AVX-512 |
| Neural Network | b18c384nbt (latest kata1) | Recommended default; strongest per-evaluation even on CPU |
| Process Model | Single process | No coordination, no load balancing, no process-to-process communication |
| IPC | child_process.spawn() + line-delimited JSON | Node.js Stability 2 API; pipe-based, no sockets, no shared memory |
| Queue | In-memory FIFO array, max 50 | Array.push() + Array.shift(); overflow returns HTTP 429 "AI busy" |
| Processing | Sequential (one query at a time) | Deterministic resource usage; no thread contention; no batching bugs |
| Visits (interactive) | 10 visits (~0.5-1s on b18, CPU) | Fast enough for move hint during play |
| Visits (review) | 100 visits (~3-5s on b18, CPU) | Adequate for amateur game review |
| Visits (deep) | 300 visits (~8-15s on b18, CPU) | Maximum useful depth for dan-level review on CPU |
| Config: nnCacheSizePowerOfTwo | 19 (512K entries, ~128MB) | Conservative memory; clear on watchdog restart |
| Config: numSearchThreads | 4 | Half of 8 vCPU; leaves headroom for Node.js + OS |
| Config: numAnalysisThreads | 1 | Sequential processing; no concurrent analysis |
| Server | Hetzner CCX33 (8 vCPU AMD, 32GB RAM, dedicated) | ~€60/mo; dedicated CPU guarantees consistent KataGo performance |

### Precedents Supporting This Choice

| System | Architecture | Years in Production | Relevance |
|--------|-------------|-------------------|-----------|
| KaTrain | Single KataGo process, Eigen, stdin/stdout | 2020-present (6 years) | Identical pattern; used by thousands daily |
| ZBaduk | KataGo backend, server-hosted | ~2020-present | Commercial service proving the model works |
| BadukAI | KataGo web interface | 2021-present | Similar web wrapper around KataGo |
| IGS (Pandanet) | Single-process game engine | 1992-present (34 years) | Proof that single-process game servers scale for Go |
| OGS | Django + WebSocket + AI server | 2014-present (12 years) | Production Go server with AI integration |

### Maximum Safety Margins

1. **Memory ceiling at 512MB** (KataGo documents ~4MB/game growth; at 512MB, that is ~100 games before forced restart — well within safe range for MAU 8K where peak concurrent games are ~50-100)
2. **Queue max at 50** (at 5s/query average, 50 slots = ~4 minutes max wait; at MAU 8K peak, expect 10-20 concurrent analysis requests)
3. **Watchdog circuit breaker** (5 crashes in 10 minutes = manual intervention required; prevents restart loops that consume resources)
4. **Model file SHA256 checksum** verified at startup (prevents silent corruption)
5. **Heartbeat via ping query** every 30s (simple 1x1 board analysis; detects hung process)

### What We Explicitly DEFER to Phase 2+

| Feature | Why Deferred | Trigger to Add |
|---------|-------------|----------------|
| BullMQ queue | Unnecessary complexity at MAU 8K; in-memory FIFO is sufficient | Queue overflow rate > 5% of requests |
| Process pool (2-4 KataGo) | Single process handles the load; pool adds coordination complexity | Average queue wait > 10s consistently |
| GPU/TensorRT backend | CPU is sufficient; TensorRT has documented crash bugs | Average queue wait > 15s AND user complaints |
| HumanSL model | Only ~1 year old; insufficient production track record | 2+ years of stable deployment in KaTrain/ZBaduk |
| b28c512nbt network | Requires GPU; b18 is adequate for amateur review | GPU backend already deployed |
| KataGo eval cache (useEvalCache) | Experimental feature in v1.16.4; not enabled by default | Feature graduates to stable (non-experimental) |

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| KataGo segfault | Low | High — queue stalls | process.on('exit') | Watchdog auto-restart; queue drains when process respawns | 3-15s |
| Memory growth → OOM | Medium over days | High | RSS check every 30s | Proactive restart at 512MB; clear nnCache | 5-10s |
| Hung process (no response) | Low | High | last-response timestamp > 60s | Kill + restart | 3-15s |
| Malformed JSON response | Very Low | None | JSON.parse try/catch | Log error, skip query, return error to caller | 0s |
| Queue full (50 slots) | Low-Medium at peak | Low — user sees "busy" | queue.length check | Return HTTP 429 with "AI analysis is busy, try again in 30 seconds" | 0s |
| Model file corrupted | Very Low | Critical — won't start | SHA256 check at startup | Keep backup model file; alert on mismatch | 30s |
| stdin pipe broken | Low | High | write() error callback | Kill + restart | 3-15s |
| Node.js event loop blocked | Very Low | Medium | setInterval drift detection | JSON parsing is async-safe; no CPU-bound JS code in main thread | N/A |

### Minimum Test Coverage

| Test Category | Count | Description |
|--------------|-------|-------------|
| Unit: Query construction | 12 | All visit levels, all board sizes (9/13/19), handicap positions |
| Unit: Response parsing | 8 | Valid response, error response, partial response, empty response |
| Unit: Queue management | 8 | Enqueue, dequeue, overflow rejection, drain, clear |
| Integration: Process lifecycle | 10 | Start, query, crash-restart, memory-restart, hung-restart, circuit-breaker |
| Integration: Watchdog | 6 | Timer fires, RSS check, heartbeat check, backoff escalation |
| Stress: Sequential queries | 3 | 100, 500, 1000 queries — measure memory growth and response times |
| E2E: HTTP to analysis result | 5 | Quick/review/deep analysis from API endpoint to JSON response |
| **Total** | **52** | |

### Differences from Cutting Edge / Balanced

| Aspect | Cutting Edge (2.A) | Stability (2.B) | **Proven Stack** |
|--------|-------------------|-----------------|-----------------|
| Process count | 2-4 pool | 1 + BullMQ | **1, no queue infra** |
| Queue | BullMQ (Redis) | BullMQ (Redis) | **In-memory FIFO** |
| GPU plan | Phase 1 CPU, Phase 2 GPU | CPU only, GPU if needed | **CPU only, GPU is Phase 3** |
| HumanSL | Yes | No | **No** |
| External dependencies | Redis, BullMQ | Redis, BullMQ | **None** |
| Why conservative is better HERE | Pool adds 3 failure modes (process selection, load balance, crash-of-one) | BullMQ is proven but Redis dependency for analysis is unnecessary at MAU 8K | **Fewest moving parts = fewest failure modes** |

---

## 2. Go Rules Engine

### Most Conservative Viable Choice: Tromp-Taylor + Chinese Scoring, Exhaustive Testing

**Proven Score: 9.5 / 10**

### Justification

The Go rules engine is the **crown jewel** of the domain stack. Every other component can degrade gracefully — the rules engine cannot. A single rules bug (missed capture, wrong ko detection, scoring error) directly corrupts game integrity and is immediately visible to experienced players. There is zero tolerance for rules bugs.

**What is proven**:
- Tromp-Taylor rules: formalized in 1996 by John Tromp and Bill Taylor — **30 years** of mathematical precision. The most precisely defined ruleset in Go, with zero ambiguity. Every computer Go program since GNU Go has used Tromp-Taylor or a close variant.
- Chinese scoring (area counting): used by the Chinese Weiqi Association since 1949 — **77 years** of competitive use.
- 1D array board representation: used by virtually every Go program since the 1990s.
- Zobrist hashing for superko: published by Albert Zobrist in 1970 — **56 years** of use in game programming, used in every modern chess and Go engine.
- Flood-fill for liberty counting: computer science fundamental, O(N) on 361-point board.

**What is NOT proven at our scale**: Japanese scoring (requires life-and-death judgment, the single hardest problem in Go programming), AGA rules (rarely used outside the US), NZ rules (almost never used).

### Architecture Decision

```
┌───────────────────────────────────────────────────────────┐
│                    Rules Engine (Pure Functions)            │
│                    ~300-400 lines TypeScript                │
│                    Zero external dependencies              │
│                    Zero runtime state                      │
│                                                           │
│  Module 1: Board (board.ts, ~80 lines)                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  createBoard(size: 9|13|19) → Uint8Array            │  │
│  │  getStone(board, x, y) → Empty|Black|White          │  │
│  │  setStone(board, x, y, color) → newBoard            │  │
│  │  getNeighbors(size, index) → number[]               │  │
│  │  boardToString(board) → string (for debugging)      │  │
│  │                                                     │  │
│  │  Invariant: board is always immutable (copy-on-set) │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Module 2: Groups (groups.ts, ~60 lines)                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  findGroup(board, index) → Set<number>              │  │
│  │  countLiberties(board, group) → number              │  │
│  │  getGroupLiberties(board, group) → Set<number>      │  │
│  │                                                     │  │
│  │  Implementation: iterative flood-fill (no recursion)│  │
│  │  Reason: recursion could stack-overflow on large    │  │
│  │  chains (361 stones theoretical max on 19x19)       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Module 3: Moves (moves.ts, ~100 lines)                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  isLegalMove(state, x, y) → boolean                 │  │
│  │  applyMove(state, x, y) → newState                  │  │
│  │  applyPass(state) → newState                        │  │
│  │  applyResign(state) → newState                      │  │
│  │                                                     │  │
│  │  Move order (Tromp-Taylor):                         │  │
│  │  1. Place stone                                     │  │
│  │  2. Remove opponent groups with 0 liberties         │  │
│  │  3. Remove own groups with 0 liberties (suicide)    │  │
│  │  4. Check superko (positional)                      │  │
│  │  5. If superko violation → reject move              │  │
│  │                                                     │  │
│  │  Suicide: ALLOWED (Tromp-Taylor default)            │  │
│  │  Superko: POSITIONAL (simplest correct rule)        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Module 4: Scoring (scoring.ts, ~80 lines)                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  scoreGame(state) → {black: n, white: n, result: s}│  │
│  │                                                     │  │
│  │  Chinese scoring (area):                            │  │
│  │  - Count stones on board                            │  │
│  │  - Count empty intersections reachable only by one  │  │
│  │    color (territory)                                │  │
│  │  - Empty intersections reachable by both colors     │  │
│  │    (dame) = 0 points                                │  │
│  │  - Apply komi (6.5 default)                         │  │
│  │                                                     │  │
│  │  Seki: handled correctly by area scoring            │  │
│  │  (stones in seki count, territory in seki = 0)      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Module 5: Hash (hash.ts, ~40 lines)                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  initZobrist(size) → zobristTable                   │  │
│  │  hashBoard(board, table) → bigint                   │  │
│  │  hashUpdate(hash, index, oldColor, newColor) → hash │  │
│  │                                                     │  │
│  │  Uses BigInt for 64-bit hashes                      │  │
│  │  Collision probability: ~5.4 × 10⁻²⁰ per pair      │  │
│  │  Pre-generated random values, seeded for            │  │
│  │  deterministic testing                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Module 6: State (state.ts, ~50 lines)                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  GameState {                                        │  │
│  │    board: Uint8Array                                │  │
│  │    size: 9 | 13 | 19                                │  │
│  │    currentPlayer: Black | White                     │  │
│  │    moveHistory: Move[]       // append-only         │  │
│  │    hashHistory: Set<bigint>  // for superko         │  │
│  │    captures: {black: n, white: n}                   │  │
│  │    consecutivePasses: 0 | 1 | 2                     │  │
│  │    status: 'playing' | 'scoring' | 'finished'       │  │
│  │    komi: number              // default 6.5         │  │
│  │  }                                                  │  │
│  │                                                     │  │
│  │  All state transitions produce NEW state objects    │  │
│  │  No mutation. No side effects. Pure functions.      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Total: ~410 lines. Zero dependencies. Zero runtime state.│
│  Every function is pure: same input → same output, always.│
└───────────────────────────────────────────────────────────┘
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| Language | TypeScript (strict mode, noUncheckedIndexedAccess) | Compile-time type safety; indexed access checks prevent array OOB |
| Board representation | 1D Uint8Array (N*N) | Cache-friendly, zero object allocation, GC-free |
| Cell values | 0=Empty, 1=Black, 2=White | Uint8 sufficient; no sentinel values needed |
| Hash | Zobrist hashing via BigInt (64-bit) | O(1) incremental update; collision probability negligible |
| Ruleset | Tromp-Taylor + Chinese scoring ONLY | 30 years of mathematical rigor; zero ambiguity |
| Suicide | Allowed (Tromp-Taylor default) | Simpler implementation; rarely occurs in real games |
| Superko | Positional (PSK) | Simpler than situational; difference matters in ~0.001% of games |
| Board sizes | 9x9, 13x13, 19x19 | The three standard sizes; no 5x5, no 25x25 |
| Komi | 6.5 (configurable) | Chinese standard; half-point prevents ties |
| Handicap | Fixed star-point placement (2-9 stones) | Standard positions, Phase 1 |
| Group-finding | Iterative flood-fill with explicit stack | No recursion risk; O(N) where N=361 max |
| Immutability | Copy-on-write for all state transitions | Eliminates mutation bugs; enables trivial undo/redo |
| Code budget | 300-410 lines | Small enough for complete human or AI review |

### Precedents Supporting This Choice

| System | Approach | Years | Relevance |
|--------|----------|-------|-----------|
| GNU Go | Tromp-Taylor variant | 1999-present (27 years) | First major open-source Go engine |
| KataGo | Tromp-Taylor compatible | 2019-present (7 years) | All analysis defaults to Tromp-Taylor/Chinese |
| OGS | Chinese scoring as default | 2014-present (12 years) | Production online server, millions of games |
| Fuego | Tromp-Taylor rules engine | 2008-present (18 years) | Academic Go engine, exhaustively tested |
| Sensei's Library | Tromp-Taylor rules documentation | 2000-present (26 years) | Community reference for rules |

### Maximum Safety Margins

1. **Cross-validation against KataGo** for 500 positions: play the game in our engine AND in KataGo, compare final board state and score. Any discrepancy is a blocking bug.
2. **Property-based testing** (fast-check): generate 10,000 random valid game sequences; verify that every intermediate state satisfies board invariants (stone counts, capture counts, hash consistency).
3. **Regression test suite from known games**: replay 50 professional game SGF records through the engine; verify every move is accepted and final score matches the recorded result.
4. **Edge case test suite**: explicit tests for every known Go edge case:
   - Simple ko (basic retake prevention)
   - Snapback (capture that looks like ko but isn't)
   - Double ko (two ko fights simultaneously)
   - Triple ko (three simultaneous ko fights — game should not hang)
   - Sending-two-returning-one
   - Eternal life (moonshine life)
   - Bent four in the corner (Chinese scoring handles this correctly by area)
   - Seki (mutual life — area scoring counts stones, not territory)
   - Multi-stone suicide (Tromp-Taylor allows; must remove all stones of the group)
   - 1-1 corner placement (smallest possible group)
   - Full board (all 361 intersections occupied — should not crash)
   - Empty board scoring (0-0 result)

### What We Explicitly DEFER to Phase 2+

| Feature | Why Deferred | Trigger to Add |
|---------|-------------|----------------|
| Japanese scoring | Requires dead stone removal agreement, life-and-death analysis — the single hardest problem in Go programming | User surveys show >20% demand for Japanese rules |
| AGA rules | Rarely used; Chinese scoring covers 95%+ of use cases | US market expansion requires it |
| NZ rules | Almost never used outside New Zealand | No foreseeable trigger |
| Configurable superko variants (SSK) | PSK is simpler and differs from SSK in ~0.001% of games | Tournament organizer requests |
| Free handicap placement | Star-point placement covers all standard handicap games | Advanced players request it |

### Minimum Test Coverage

| Test Category | Count | Description |
|--------------|-------|-------------|
| Unit: Board operations | 20 | Create, get, set, neighbors, bounds checking |
| Unit: Group finding | 15 | Single stone, chain, large group, edge, corner, full-board group |
| Unit: Liberty counting | 15 | 1-liberty, multi-liberty, edge liberties, corner liberties, surrounded |
| Unit: Capture logic | 25 | Single capture, multi-stone capture, snapback, multi-group capture, suicide |
| Unit: Ko detection | 12 | Simple ko, no-ko (different hash), ko with surrounding captures |
| Unit: Superko | 8 | Triple ko, sending-two-returning-one, positional superko enforcement |
| Unit: Scoring | 20 | Empty board, full board, partial territories, seki, dame, komi, various endgames |
| Unit: State transitions | 10 | Immutability check, hash consistency, move history append |
| Property-based | 10 | Random valid games → invariant checks (10,000 iterations each) |
| Regression: Pro games | 50 | 50 professional game SGF replays with verified scores |
| Cross-validation: KataGo | 20 | Complex positions compared against KataGo scoring |
| Edge cases | 15 | All 12 documented edge cases above + 3 adversarial positions |
| **Total** | **220** | |

### Differences from Cutting Edge / Balanced

| Aspect | Cutting Edge (2.A) | Stability (2.B) | **Proven Stack** |
|--------|-------------------|-----------------|-----------------|
| Test count | ~90 | 130 | **220** |
| Pro game replays | ~10 | 20 | **50** |
| Cross-validation | None explicit | 10 positions | **20 positions + 500 property-based** |
| Code lines | ~400 | 200-400 | **300-410 (quality over brevity)** |
| Rulesets at launch | Tromp-Taylor + Chinese | Tromp-Taylor + Chinese | **Tromp-Taylor + Chinese (identical — unanimous)** |
| Why conservative is better HERE | Same | Same | **220 tests vs 130: the difference between "probably correct" and "provably correct for known cases"** |

---

## 3. LLM Explanation Pipeline

### Most Conservative Viable Choice: Templates ONLY at Launch, LLM Deferred to Phase 2

**Proven Score: 9.5 / 10** (templates are deterministic — the score reflects template reliability, not LLM reliability)

### Justification

This is where the Proven Stack makes its most radical departure from all other scenarios. Every other scenario includes LLM API calls in v1.0, with varying levels of validation and fallback. The Proven Stack says: **No LLM calls at launch. Zero. None.**

Why? Because every piece of evidence shows that LLMs are the single highest-risk component:

1. **LLMs have zero understanding of Go.** GPT-4 miscounts liberties, places stones on occupied points, and hallucinates strategic assessments. This is not a prompt engineering problem — it is a fundamental limitation of the technology in 2026.

2. **Validation cannot catch semantic hallucinations.** The Stability stack's 4-layer validation catches coordinate errors and win% mismatches. But "This move controls the center" when the move is on the edge? "This is a brilliant tesuji" when it is a blunder? Semantic hallucination is undetectable by automated validation.

3. **Templates are a proven pattern.** KaTrain uses template-style feedback ("This move lost X points. The AI suggests Y instead."). ZBaduk shows numerical data with minimal narration. Lichess's analysis uses structured patterns ("Blunder. Best was Nf3."). Template-based feedback is the **industry standard** for game analysis tools.

4. **The LLM adds cost and latency.** At MAU 8K with 1 explanation/user/day, Claude Haiku costs $30-90/month. Templates cost $0/month. The user experience difference between "Black's move at D4 lost 3.2 points. The AI suggests Q16 instead, which maintains a 4.1-point lead." (template) and a more natural-language version is marginal.

5. **60 days of template data de-risks LLM integration.** By running templates for 60 days before adding the LLM, we collect real user data on which positions users analyze, which explanations they find helpful, and what the actual failure modes are. This makes the LLM integration in Phase 2 dramatically safer.

### Architecture Decision

```
┌─────────────────────────────────────────────────────────┐
│           Explanation Pipeline (v1.0 — Templates Only)    │
│                                                         │
│  Step 1: KataGo Analysis (TRUTH SOURCE)                 │
│  ┌─────────────────────────────────────────────┐        │
│  │  Input: Board position + last N moves       │        │
│  │  Output: {                                  │        │
│  │    winRate: 0.62,                           │        │
│  │    scoreLead: 3.2,                          │        │
│  │    topMoves: [{move, visits, winRate, ...}], │        │
│  │    ownership: [...361 floats...],            │        │
│  │    currentPlayer: "black"                   │        │
│  │  }                                          │        │
│  └──────────────────────┬──────────────────────┘        │
│                         │                               │
│  Step 2: Data Classification (DETERMINISTIC)            │
│  ┌──────────────────────▼──────────────────────┐        │
│  │  classifyMoveQuality(delta_winRate):         │        │
│  │    |delta| > 0.15 → "blunder"               │        │
│  │    |delta| > 0.08 → "mistake"               │        │
│  │    |delta| > 0.03 → "inaccuracy"            │        │
│  │    |delta| <= 0.03 → "good"                 │        │
│  │    move == topMove → "excellent"             │        │
│  │                                              │        │
│  │  classifyPhase(moveNumber, boardOccupancy):  │        │
│  │    < 40 moves → "opening"                   │        │
│  │    < 60% occupied → "middlegame"            │        │
│  │    else → "endgame"                         │        │
│  │                                              │        │
│  │  classifyRegion(move_coordinates):           │        │
│  │    row/col in [0,2] or [16,18] → "corner"   │        │
│  │    row/col in [3,5] or [13,15] → "side"     │        │
│  │    else → "center"                          │        │
│  └──────────────────────┬──────────────────────┘        │
│                         │                               │
│  Step 3: Template Selection + Rendering (DETERMINISTIC) │
│  ┌──────────────────────▼──────────────────────┐        │
│  │  select template by:                        │        │
│  │    (quality, phase, level) → template_id     │        │
│  │                                              │        │
│  │  render template with variables:             │        │
│  │    {winRate, scoreLead, topMove, delta,       │        │
│  │     region, phase, captures_diff}            │        │
│  │                                              │        │
│  │  Output: plain text explanation              │        │
│  │  Deterministic: same input → same output     │        │
│  └─────────────────────────────────────────────┘        │
│                                                         │
│  NO LLM API CALLS. NO NETWORK DEPENDENCIES.             │
│  NO HALLUCINATION. NO LATENCY VARIANCE.                 │
│  ZERO COST PER EXPLANATION.                             │
└─────────────────────────────────────────────────────────┘
```

### Template Design

**3 explanation levels × 5 quality categories × 3 game phases = 45 template slots**

Not all 45 need unique templates. Many share structure with different vocabulary. Practical count: **35-40 unique templates**.

Example templates by level:

**Beginner (20-15 kyu)**:
```
[blunder, middlegame]
"This move lost a lot of ground — Black's advantage dropped from
{{scoreLead_before}} to {{scoreLead_after}} points. The AI suggests
playing at {{topMove}} instead, which would keep a {{topMove_scoreLead}}-point lead."

[excellent, opening]
"Great move! This matches what the AI recommends. {{currentPlayer}}
has a {{scoreLead}}-point advantage."
```

**Intermediate (14-5 kyu)**:
```
[mistake, middlegame]
"This move is an inaccuracy that shifts the balance by {{delta_score}}
points. The AI's top choice was {{topMove}} ({{topMove_winRate}}% win rate,
{{topMove_visits}} visits). The current move plays in the {{region}},
while the AI prefers the {{topMove_region}}."

[good, endgame]
"Solid endgame move. Win rate stays stable at {{winRate}}% for
{{currentPlayer}}. Score lead: {{scoreLead}} points."
```

**Advanced (4-1 dan)**:
```
[any_quality, any_phase]
"Win rate: {{currentPlayer}} {{winRate_before}}% → {{winRate_after}}%
({{delta_sign}}{{delta_winRate}}%). Score: {{scoreLead_before}} →
{{scoreLead_after}}. Top engine move: {{topMove}} ({{topMove_winRate}}%,
{{topMove_scoreLead}}, {{topMove_visits}} visits)."
```

### Phase 2 LLM Integration Plan (After 60 Days of Template Data)

When templates have been running for 60 days, we will have:
- Data on which positions users actually analyze
- "Was this helpful?" ratings on template explanations
- A golden dataset of 200+ real-world positions with verified template outputs

Phase 2 LLM integration architecture (identical to Stability stack's 4-layer pipeline, but with 60 days of de-risking data):

1. KataGo analysis (unchanged)
2. Data classification (unchanged — reuse from templates)
3. LLM generation (Claude Haiku 4.5, temperature 0.3, max 150 tokens)
4. Output validation (check coordinates, win%, length — plus comparison against template output for sanity)
5. Fallback to template if any validation fails

**Key difference from Stability stack**: Phase 2 LLM starts with a golden dataset built from 60 days of real usage, not synthetic test data. This makes validation dramatically more effective.

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| v1.0 approach | Templates only | Zero LLM risk; zero cost; zero latency variance |
| Template count | 35-40 unique | 3 levels × 5 qualities × 3 phases, with shared structures |
| Template engine | String interpolation (native JS) | No template library dependency; no injection risk |
| Input sanitization | Strip all non-alphanumeric from user-facing data | Prevents XSS via template injection |
| Caching | Not needed (templates are instantaneous) | Computation is O(1) |
| Latency | <1ms (classification + rendering) | No network call, no API wait |
| Cost per explanation | $0 | No LLM API calls |
| LLM integration (Phase 2) | Claude Haiku 4.5, after 60 days | De-risked by real usage data |
| Fallback in Phase 2 | Template (always available) | LLM is enhancement, template is baseline |
| User feedback | "Was this helpful?" button | Collects data for Phase 2 LLM training |

### Precedents Supporting This Choice

| System | Approach | Years | Relevance |
|--------|----------|-------|-----------|
| Lichess analysis | Template-style ("Blunder. Best was Nf3.") | 2010-present (16 years) | Most popular chess analysis, purely template |
| KaTrain | Numerical + color-coded markers | 2020-present (6 years) | No natural language at all — just numbers and colors |
| ZBaduk | Score chart + AI table + win rate graph | ~2020-present | Numerical data, no NLP |
| Chess.com game review | Structured categories + fixed phrases | 2007-present (19 years) | "Brilliant!", "Blunder", "Best move" — templated |
| Stockfish evaluation | Centipawn + classification | 2008-present (18 years) | Pure numerical, no NLP |

### Maximum Safety Margins

1. **Templates are deterministic**: same KataGo output → same explanation. Always. No randomness, no API calls, no network dependencies.
2. **All templates reviewed before launch**: every template is a string literal in the codebase, reviewed line-by-line. No dynamically generated text.
3. **Classification thresholds calibrated against KaTrain**: use the same delta thresholds that KaTrain uses for move quality (proven by 6 years of use).
4. **"Was this helpful?" data collection from day 1**: builds the golden dataset that makes Phase 2 LLM integration safe.

### What We Explicitly DEFER to Phase 2+

| Feature | Why Deferred | Trigger to Add |
|---------|-------------|----------------|
| LLM-generated explanations | Highest risk component; templates prove the concept first | 60 days of template usage data + golden dataset of 200+ positions |
| Multi-language explanations | English templates first; Korean/Japanese later | User base >30% non-English speakers |
| Position-specific strategic commentary | Requires Go domain expertise that LLMs lack | LLM + fine-tuned Go vocabulary after Phase 2 validation |
| Voice narration | Unnecessary for v1.0 | Accessibility compliance requirement |

### Minimum Test Coverage

| Test Category | Count | Description |
|--------------|-------|-------------|
| Unit: Move classification | 15 | Every quality threshold, boundary values, edge cases |
| Unit: Phase classification | 8 | Opening/middle/endgame boundary values |
| Unit: Region classification | 9 | Corner/side/center for all board sizes |
| Unit: Template rendering | 40 | Every template with varied input data |
| Unit: Input sanitization | 5 | XSS attempts, special characters, unicode |
| Integration: KataGo data → explanation | 15 | Real KataGo outputs → template selection → rendered text |
| Snapshot: Golden dataset | 50 | 50 known positions with verified expected output |
| **Total** | **142** | |

### Differences from Cutting Edge / Balanced

| Aspect | Cutting Edge (2.A) | Stability (2.B) | **Proven Stack** |
|--------|-------------------|-----------------|-----------------|
| LLM at launch | Yes (Claude Haiku) | Yes (Claude Haiku + fallback) | **No** |
| Monthly LLM cost | $30-90 | $30-90 | **$0** |
| Hallucination risk | High (mitigated by validation) | Medium (4-layer validation) | **Zero (no LLM)** |
| Template count | 15-20 (backup) | 30 | **35-40 (primary)** |
| Time to implement | 3 weeks | 3 weeks | **1.5 weeks** |
| Why conservative is better HERE | LLM explanations are the competitive moat — but the moat doesn't matter if it's full of hallucinated crocodiles | Validation catches 80% of hallucinations — but the 20% that slip through are the ones users remember | **Templates are boring but they never lie. Build the moat with proven bricks first, add the LLM drawbridge when you have data to validate it.** |

---

## 4. Real-time Game Server

### Most Conservative Viable Choice: Simple State + Move History, ws WebSocket, PostgreSQL SOT

**Proven Score: 8.5 / 10**

### Justification

The game server is the second most critical component after the rules engine. It must:
1. Never lose a move
2. Never allow an illegal move
3. Handle disconnections gracefully
4. Keep both players synchronized

These requirements have been solved by online Go servers for **34 years** (IGS started in 1992). The patterns are well-established:

**What is proven**:
- Server-authoritative game state: used by every competitive game server since Quake (1996) — **30 years**.
- WebSocket for real-time game updates: used by Lichess, OGS, KGS-web, and every modern game server since ~2012 — **14 years**.
- Move history as append-only log: this is literally what SGF (Smart Game Format) is, standardized in 1987 — **39 years**.
- PostgreSQL as game record store: Lichess uses MongoDB, OGS uses Django/PostgreSQL. PG is the most conservative choice.
- Simple state machine for game lifecycle: create → play → score → finish. Four states, four transitions.

**What is NOT proven at our scale**: Event sourcing for game state (adds replay complexity), Socket.IO's abstraction layer (unnecessary for Go's low message rate), multi-process WebSocket with sticky sessions.

### Architecture Decision

```
┌────────────────────────────────────────────────────────────┐
│                    Game Server                              │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WebSocket Server (ws library)                       │  │
│  │  - Protocol: JSON over WebSocket                     │  │
│  │  - Heartbeat: 30s ping/pong (ws built-in)           │  │
│  │  - Max connections: 5,000 (far above MAU 8K need)   │  │
│  │  - No rooms abstraction (manual Map<gameId, Set>)   │  │
│  │  - No binary protocol (JSON is adequate for ~1 msg/ │  │
│  │    30 seconds per game — Go is a slow game)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Game State Manager                                  │  │
│  │                                                      │  │
│  │  activeGames: Map<string, GameState>                 │  │
│  │  playerConnections: Map<string, WebSocket>           │  │
│  │  gamesByPlayer: Map<string, string>  // player→game  │  │
│  │                                                      │  │
│  │  handleMove(gameId, playerId, x, y):                │  │
│  │    1. Verify it's this player's turn                 │  │
│  │    2. Verify move is legal (Rules Engine)            │  │
│  │    3. Apply move → new GameState                     │  │
│  │    4. Persist move to PostgreSQL (async, no wait)    │  │
│  │    5. Update in-memory state                         │  │
│  │    6. Broadcast new state to both players            │  │
│  │    7. If error at step 4 → retry 3x → flag game     │  │
│  │                                                      │  │
│  │  handleDisconnect(playerId):                         │  │
│  │    1. Mark player as disconnected                    │  │
│  │    2. Start 5-minute reconnection timer              │  │
│  │    3. Notify opponent: "Opponent disconnected"       │  │
│  │    4. Pause clock for disconnected player            │  │
│  │                                                      │  │
│  │  handleReconnect(playerId, gameId):                  │  │
│  │    1. Verify identity (session token)                │  │
│  │    2. Send full game state (board + moves + clocks)  │  │
│  │    3. Resume clock                                   │  │
│  │    4. Notify opponent: "Opponent reconnected"        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌────────────────┐  ┌─────────────────────────────────┐  │
│  │  PostgreSQL 16  │  │  Redis 7.2                      │  │
│  │  (SOT for all   │  │  (Session tokens only)          │  │
│  │  game data)     │  │  (Matchmaking queue)            │  │
│  │                 │  │  (NO game state cache —          │  │
│  │  Tables:        │  │   in-memory Map is sufficient   │  │
│  │  - games        │  │   at MAU 8K)                    │  │
│  │  - moves        │  │                                 │  │
│  │  - users        │  │  Redis failure = matchmaking    │  │
│  │  - ratings      │  │  pauses, sessions require       │  │
│  └────────────────┘  │  PG fallback. Games continue.   │  │
│                       └─────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Matchmaking (Simple)                                │  │
│  │  - Redis sorted set by ELO                           │  │
│  │  - Match: ELO ±200                                  │  │
│  │  - Expand: ±50 every 30s, max ±500                  │  │
│  │  - Timeout: 5 minutes → notify "no match found"     │  │
│  │  - Board size + time control must match exactly      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Clock Management (Server-Authoritative)             │  │
│  │  - Server tracks remaining time per player           │  │
│  │  - Client displays server time ± estimated latency   │  │
│  │  - Time deducted only after move validated            │  │
│  │  - Byo-yomi: 3 periods × 30s (configurable)         │  │
│  │  - Timeout → automatic forfeit (server decides)      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Connection State Machine

```
             ┌──────────┐
             │  INIT     │
             └─────┬─────┘
                   │ WebSocket connect + auth
             ┌─────▼─────┐
        ┌───▶│  ACTIVE    │◀───┐
        │    └─────┬─────┘    │
        │          │          │
  pong  │   3 missed│    move  │
received│    pings │  received│
        │          │          │
        │    ┌─────▼─────┐    │
        └────│  STALE     │────┘
             └─────┬─────┘
                   │ 30s no response
             ┌─────▼─────┐
             │  AWAY      │
             └─────┬─────┘
                   │ 5 min timeout
             ┌─────▼─────┐
             │  FORFEIT   │
             └────────────┘

At any state except FORFEIT:
  reconnect + valid session → send full state → ACTIVE
```

### Message Protocol (Simple JSON)

```typescript
// Client → Server
{ type: "move", gameId: "abc", x: 3, y: 15, moveNumber: 42 }
{ type: "pass", gameId: "abc", moveNumber: 42 }
{ type: "resign", gameId: "abc" }
{ type: "requestUndo", gameId: "abc" }
{ type: "acceptUndo", gameId: "abc" }

// Server → Client
{ type: "gameState", gameId: "abc", board: [...], moves: [...],
  clocks: {...}, currentPlayer: "B", moveNumber: 42, status: "playing" }
{ type: "moveResult", gameId: "abc", valid: true, moveNumber: 43 }
{ type: "moveResult", gameId: "abc", valid: false, reason: "ko violation" }
{ type: "opponentDisconnected", gameId: "abc" }
{ type: "opponentReconnected", gameId: "abc" }
{ type: "gameOver", gameId: "abc", result: "B+3.5", method: "score" }
{ type: "error", message: "Not your turn" }
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| WebSocket library | ws (npm) | Fastest, lowest-level, most proven Node.js WS library; no unnecessary abstraction |
| Heartbeat | 30s ping/pong (ws built-in) | Standard interval; detects dead connections reliably |
| Reconnect window | 5 minutes | Generous for mobile users (tunnel, WiFi switch, sleep/wake) |
| Message format | JSON | Human-readable; adequate for Go's ~1 message per 30 seconds |
| State authority | Server-only | Client sends moves; server validates, applies, broadcasts |
| Move validation | Server-side via Rules Engine | Client can pre-validate for UX; server is authoritative |
| Persistence | Every move → PostgreSQL (async) | Append-only moves table; PG is source of truth |
| Active game state | In-memory Map<gameId, GameState> | At MAU 8K, max ~200 concurrent games = ~200 objects in memory |
| Matchmaking | Redis sorted set, ELO ±200 | Simple, deterministic, O(log N) |
| Time control | Server-side clock, byo-yomi | Client clock is display-only |
| Concurrency | Single Node.js process | Handles 50K+ WebSocket connections; MAU 8K needs ~400-800 at peak |
| SGF generation | Generate only (no external SGF import in v1.0) | We control the format; eliminates all parsing edge cases |
| SGF format | FF[4], UTF-8, validate after generation | Most widely supported format version |

### Precedents Supporting This Choice

| System | Architecture | Years | Relevance |
|--------|-------------|-------|-----------|
| IGS (Pandanet) | Client-server, single process, move-by-move | 1992-present (34 years) | Oldest online Go server still operating |
| KGS | Java server, WebSocket (Java applet → web) | 2000-present (26 years) | Long-running Go server with robust reconnection |
| OGS | Django + Socket.IO, server-authoritative | 2014-present (12 years) | Modern Go server with 450+ concurrent players |
| Lichess | Scala + WebSocket, server-authoritative | 2010-present (16 years) | Largest open-source game server; proves the pattern at scale |
| WBaduk | Server-authoritative, large Korean user base | 2005-present (21 years) | Commercial Go server handling high concurrent load |

### Maximum Safety Margins

1. **Every move persisted to PostgreSQL before ACK**: even if the server crashes immediately after, the move is saved. On restart, rebuild game state from moves table.
2. **moveNumber monotonic check**: server rejects any move where client's moveNumber does not equal server's moveNumber. Prevents desync, duplicate moves, and race conditions.
3. **Full state sync on reconnect**: client never merges — it replaces its entire local state with the server's authoritative state. Zero merge conflicts.
4. **Graceful shutdown on SIGTERM**: broadcast "server restarting" to all clients, wait 2s for in-flight DB writes, then exit. Clients auto-reconnect after restart.
5. **Game state reconstruction from PostgreSQL**: on process restart, load all active games (status='playing') from the moves table, replay moves through the Rules Engine to reconstruct current board state. This is our "event replay" — but using the existing moves table, not a separate event store.

### What We Explicitly DEFER to Phase 2+

| Feature | Why Deferred | Trigger to Add |
|---------|-------------|----------------|
| Event sourcing | Over-engineering for MAU 8K; moves table provides 90% of the benefit | Architecture review at MAU 25K+ |
| Redis game state cache | In-memory Map is sufficient for ~200 concurrent games | Concurrent games > 1000 |
| Socket.IO | ws provides everything needed; Socket.IO abstraction is unnecessary overhead | Never (ws is strictly better for this use case) |
| Multi-process WebSocket (cluster mode) | Single process handles 50K+ connections | Concurrent connections > 10K |
| External SGF import | Parsing external SGF has documented edge cases (encoding, escaping) | User demand for game import |
| Spectator mode | Adds connection management complexity | Post-launch feature based on user requests |
| Bot/AI opponent play | Adds KataGo coordination with game server | After KataGo analysis pipeline is proven stable |

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| Player disconnects (network) | High (normal) | None | Ping/pong miss | 5-min reconnect window; clock paused; opponent notified | 0s |
| Invalid move from client | Medium | None | Rules Engine rejects | Return error; do not mutate state | 0s |
| State desync | Low | Medium | moveNumber mismatch | Server sends full state; client replaces local state entirely | <1s |
| Server process crash | Very Low | High — all games pause | PM2 / systemd watchdog | Auto-restart; reconstruct from PG; clients reconnect | 15-30s |
| PostgreSQL write failure | Very Low | High — move not persisted | DB error handler | Retry 3x (1s, 2s, 4s); hold in memory; flag game for audit | 1-10s |
| Redis failure | Low | Medium — matchmaking pauses | Connection error event | Games continue (in-memory); matchmaking falls back to PG query | 10-30s |
| Simultaneous move race | Very Low | Medium | currentPlayer + moveNumber check | Second move rejected with "not your turn" | 0s |
| Time control dispute | Low | Medium | Server is authoritative | Server calculates; client displays; no negotiation | 0s |
| WebSocket memory leak | Low | Medium — slow degradation | RSS monitoring | Periodic audit of connection Map; close orphaned connections | 0s |
| Full server RAM exhaustion | Very Low | Critical | OS OOM killer | Graceful shutdown before OOM; restart; reconstruct from PG | 30-60s |

### Minimum Test Coverage

| Test Category | Count | Description |
|--------------|-------|-------------|
| Unit: Game state transitions | 20 | Create, move, capture, pass, resign, score, all transitions |
| Unit: WebSocket messages | 12 | All message types, malformed messages, auth failures |
| Unit: Matchmaking | 8 | Match, expand, timeout, cancel, edge ELO values |
| Unit: Clock management | 10 | Decrement, timeout, pause, resume, byo-yomi transitions |
| Unit: Connection state machine | 8 | All 4 states, all transitions, edge cases |
| Integration: Full game lifecycle | 8 | Create → match → play → resign/score → persist → SGF |
| Integration: Reconnection | 6 | Disconnect → reconnect → state sync → resume play |
| Integration: Server restart | 4 | Crash → restart → reconstruct from PG → clients reconnect |
| Integration: Database | 8 | Save move, load game, save result, query history, failure+retry |
| Stress: Concurrent games | 3 | 50, 200, 500 simultaneous games |
| E2E: Two-player game | 4 | Full game on each board size + 1 reconnection scenario |
| **Total** | **91** | |

### Differences from Cutting Edge / Balanced

| Aspect | Cutting Edge (2.A) | Stability (2.B) | **Proven Stack** |
|--------|-------------------|-----------------|-----------------|
| Game state pattern | Event sourcing | Simple state + history | **Simple state + history (same as 2.B)** |
| Game state cache | Redis | Redis | **In-memory Map (no Redis for games)** |
| WebSocket library | ws | ws | **ws (unanimous)** |
| SGF import | Phase 1 | Phase 2 | **Phase 2+** |
| Spectator mode | Phase 1 | Not mentioned | **Phase 2+** |
| State reconstruction | From event store | From Redis | **From PostgreSQL moves table** |
| Why conservative is better HERE | Event sourcing adds schema evolution risk, replay performance risk, infinite loop risk | Redis game cache adds a dependency that is unnecessary for ~200 concurrent games | **In-memory Map is faster, simpler, and has zero external dependencies for game state. PG is the safety net.** |

---

## 5. Baduk UI/UX

### Most Conservative Viable Choice: 15 Components, Pure SVG, No Animation Library

**Proven Score: 9.0 / 10**

### Justification

The Go board UI is a **solved problem**. CGoban was released in 1999. Every Go board since then has used the same layout: grid, stones, coordinates, capture count, clock. Innovation on the board itself provides zero functional benefit and introduces risk.

**What is proven**:
- SVG for Go board rendering: used by OGS (new SVG renderer 2023), Sabaki/Shudan (2015+), multiple web-based Go tools — **11+ years**.
- Grid + circles for stones: literally every Go interface since the 1990s.
- System font stack: no web font loading delay; consistent across platforms.
- Zustand for React state: released 2019, 40K+ GitHub stars — **7 years** of production use.

**What is NOT proven**: Canvas/WebGL rendering for Go boards (unnecessary for 361 static circles), gesture libraries (use-gesture adds complexity for mobile), Recharts (proven but unnecessary for v1.0 — defer chart to Phase 2).

### Architecture Decision

```
┌────────────────────────────────────────────────────────┐
│                  UI Component Tree                      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  GamePage (route: /game/:id)                     │  │
│  │                                                  │  │
│  │  ┌─────────────┐  ┌──────────────────────────┐  │  │
│  │  │  BoardPanel  │  │  InfoPanel               │  │  │
│  │  │             │  │  ┌──────────────────────┐ │  │  │
│  │  │  ┌────────┐ │  │  │ PlayerInfo (×2)      │ │  │  │
│  │  │  │GoBoard │ │  │  │ - Name, rank         │ │  │  │
│  │  │  │ (SVG)  │ │  │  │ - Clock              │ │  │  │
│  │  │  │        │ │  │  │ - Captures           │ │  │  │
│  │  │  └────────┘ │  │  └──────────────────────┘ │  │  │
│  │  │  ┌────────┐ │  │  ┌──────────────────────┐ │  │  │
│  │  │  │Coords  │ │  │  │ GameControls         │ │  │  │
│  │  │  └────────┘ │  │  │ - Pass, Resign       │ │  │  │
│  │  │             │  │  │ - Undo request       │ │  │  │
│  │  └─────────────┘  │  └──────────────────────┘ │  │  │
│  │                    │  ┌──────────────────────┐ │  │  │
│  │                    │  │ MoveList             │ │  │  │
│  │                    │  │ - Scrollable list    │ │  │  │
│  │                    │  └──────────────────────┘ │  │  │
│  │                    │  ┌──────────────────────┐ │  │  │
│  │                    │  │ AIExplanation        │ │  │  │
│  │                    │  │ - Template text      │ │  │  │
│  │                    │  │ - Loading skeleton   │ │  │  │
│  │                    │  └──────────────────────┘ │  │  │
│  │                    └──────────────────────────────┘  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Total components: 15                                  │
│  External UI deps: Zustand                             │
│  No Recharts (Phase 2). No animation library.          │
│  No gesture library. No Canvas. No WebGL.              │
└────────────────────────────────────────────────────────┘
```

### Component Inventory (15 Components)

| # | Component | Type | Complexity | Notes |
|---|-----------|------|-----------|-------|
| 1 | GoBoard | SVG container | Medium | Grid lines, star points (hoshi), click handler, viewBox responsive |
| 2 | Stone | SVG circle | Low | Black/white fill; last-move marker (small dot or triangle) |
| 3 | GhostStone | SVG circle | Low | Semi-transparent preview on hover (desktop) or tap (mobile) |
| 4 | Coordinates | SVG text | Low | A-T (skip I), 1-19 |
| 5 | PlayerInfo | React div | Low | Name, rank, captures count |
| 6 | Clock | React div | Medium | Countdown, byo-yomi display, synced from server on each move |
| 7 | MoveList | React div | Medium | Scrollable, clickable (for review mode), current move highlight |
| 8 | GameControls | React div | Low | Pass, resign, undo-request buttons |
| 9 | AIExplanation | React div | Low | Template text, loading skeleton |
| 10 | MatchmakingDialog | React dialog | Medium | Board size, time control, rank range |
| 11 | ScorePanel | React div | Low | Final score, territory count (shown at game end) |
| 12 | NavigationBar | React nav | Low | Home, games, profile links |
| 13 | ConnectionStatus | React span | Low | Green dot / "Reconnecting..." / red dot |
| 14 | GameReviewBar | React div | Medium | Forward/back/start/end buttons for reviewing completed games |
| 15 | ErrorBoundary | React class | Low | Catch render errors, show "Something went wrong. Refresh." |

**What is NOT in the 15 components** (deferred to Phase 2):
- WinRateGraph (Recharts) — adds dependency; template text provides win rate info
- MoveQualityOverlay — colored circles on board showing move quality; Phase 2 analysis feature
- TerritoryMarker — territory visualization; Phase 2 with scoring enhancement

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| Board rendering | Pure SVG (<svg>, <circle>, <line>, <text>, <rect>) | Universal support, resolution-independent, zero library needed |
| Board sizes | 9x9, 13x13, 19x19 | Standard; responsive via SVG viewBox |
| Stone rendering | SVG <circle> with CSS fill | Simplest possible; no gradients (add in Phase 2 for aesthetics) |
| Last-move marker | SVG <circle> with contrasting color | Standard Go convention |
| State management | Zustand | 2KB gzipped, minimal API, proven |
| Charts | None in v1.0 | Deferred to Phase 2 (Recharts) |
| Animations | None | No CSS transitions, no JS animation. Stones appear instantly. |
| Mobile interaction | Tap to select → confirm button | No pinch-to-zoom (Phase 2); 9x9 and 13x13 work without zoom; 19x19 shows confirm dialog |
| Mobile breakpoint | 768px | Board fills width, info panel stacks below |
| Accessibility | ARIA labels on interactive elements | Screen reader announces moves |
| Font | System font stack | Zero loading delay |
| CSS | CSS Modules or Tailwind (minimal) | Scoped styles, no runtime CSS-in-JS |
| Color scheme | High contrast (black stone on beige board) | Matches traditional Go aesthetics; maximizes readability |

### Precedents Supporting This Choice

| System | Component Count | Technology | Years |
|--------|----------------|-----------|-------|
| Sabaki | ~15 core components | Preact/Shudan, SVG | 2015-present (11 years) |
| OGS web | ~20 core components | React, SVG (new renderer) | 2014-present (12 years) |
| KGS web | ~10 core components | Java applet → web | 2000-present (26 years) |
| Lichess (board) | ~12 board components | Mithril.js + SVG/Canvas | 2010-present (16 years) |
| CGoban | ~8 components (AWT) | Java AWT | 1999-present (27 years) |

### Maximum Safety Margins

1. **No animation = no animation bugs.** Stones appear and disappear instantly. This is how physical Go works. No requestAnimationFrame, no CSS transition glitches, no animation state machine.
2. **No gesture library = no gesture bugs.** Tap events via standard DOM addEventListener. On desktop, click to place. On mobile, tap to select + confirm button. The confirm button eliminates fat-finger misplacement (a real problem on 19x19 mobile).
3. **ErrorBoundary on every route.** If any component crashes, the user sees "Something went wrong. Your game is safe — refresh the page." with the game ID for support.
4. **SVG viewBox for responsiveness.** No media queries for the board itself. The board scales perfectly to any container size via SVG's built-in viewBox attribute.
5. **Server state is truth.** The UI never computes game state. It receives full state from the server and renders it. If the UI and server ever disagree, the user can refresh and get the correct state.

### What We Explicitly DEFER to Phase 2+

| Feature | Why Deferred | Trigger to Add |
|---------|-------------|----------------|
| WinRateGraph (Recharts) | Adds dependency; template text provides win rate data | Phase 2 analysis enhancement |
| MoveQualityOverlay | Colored circles require KaTrain-style classification calibration | Phase 2 after template explanations are validated |
| TerritoryMarker | Territory visualization requires scoring accuracy | After scoring is cross-validated against KataGo |
| Stone gradients | Aesthetic enhancement; flat circles are functionally complete | Phase 2 visual polish |
| Pinch-to-zoom (mobile 19x19) | Complex gesture handling; 9x9 and 13x13 work without zoom | User feedback indicates mobile 19x19 demand |
| Dark mode | Adds CSS complexity; light mode with high contrast is the safe default | User requests exceed 20% |
| Sound effects | Adds audio loading, autoplay policy handling | Phase 2 enhancement |

### Minimum Test Coverage

| Test Category | Count | Description |
|--------------|-------|-------------|
| Unit: Component render | 15 | Each component renders without crash |
| Unit: Board click handling | 8 | Click-to-coordinate mapping for all 3 board sizes |
| Unit: State management | 8 | Move applied, game end, reconnect state restore |
| Visual regression | 3 | Board screenshot for 9x9, 13x13, 19x19 |
| Accessibility | 4 | ARIA labels present, keyboard navigation works |
| Cross-browser | 4 | Chrome, Firefox, Safari, Edge — board renders correctly |
| Mobile | 4 | Tap-to-place on mobile, confirm dialog, responsive layout |
| E2E: Full game | 3 | Play full game on desktop, tablet, phone |
| **Total** | **49** | |

### Differences from Cutting Edge / Balanced

| Aspect | Cutting Edge (2.A) | Stability (2.B) | **Proven Stack** |
|--------|-------------------|-----------------|-----------------|
| Component count | ~25 | 18 | **15** |
| Animation | CSS transitions | CSS transitions | **None** |
| Charts | Recharts | Recharts | **None (Phase 2)** |
| Gesture library | use-gesture | None | **None** |
| Mobile strategy | Tap-Preview-Confirm | Pinch-to-zoom | **Tap + confirm button** |
| External UI deps | Zustand + Recharts + use-gesture | Zustand + Recharts | **Zustand only** |
| Why conservative is better HERE | 25 components = 25 potential bug surfaces | 18 is good; 15 is better | **Every component removed is a bug that can never happen. The 3 deferred components (chart, overlay, territory) are visual enhancements, not core functionality.** |

---

## 6. Composite Analysis

### Composite Proven Score

| Area | Score | Weight | Weighted Score | Justification |
|------|-------|--------|---------------|---------------|
| KataGo Integration | 9.0 | 0.20 | 1.80 | Single process + in-memory queue = minimal failure surface |
| Go Rules Engine | 9.5 | 0.25 | 2.375 | Pure functions, 220 tests, cross-validated, 30-year-old algorithm |
| LLM Explanation Pipeline | 9.5 | 0.15 | 1.425 | Templates only = deterministic, zero external dependency |
| Real-time Game Server | 8.5 | 0.25 | 2.125 | Proven patterns, but server restart cliff exists |
| Baduk UI/UX | 9.0 | 0.15 | 1.35 | 15 minimal components, SVG, no animation, no extras |
| **Composite** | | **1.00** | **9.075** | |

**Composite Proven Score: 9.1 / 10**

The Proven Stack achieves the highest composite score by eliminating the LLM risk entirely (9.5 vs 6.5 in Stability stack) and reducing KataGo complexity (in-memory queue vs BullMQ). The remaining 0.9 deduction comes from:
- Game server restart cliff (0.4) — inherent to any single-process server
- Rules engine edge cases in seki/superko (0.3) — inherent to Go's complexity
- Mobile 19x19 interaction challenge (0.2) — inherent to the board size

### Comparison of Composite Scores

| Scenario | Composite Score | Lowest Single Area | Key Vulnerability |
|----------|----------------|-------------------|-------------------|
| Cutting Edge (2.A) | ~7.5 | LLM (5.5) | LLM hallucination + GPU complexity |
| Speed First (2.C) | ~7.0 | LLM (5.0) | Tech debt + rushed testing |
| Stability (2.B) | 8.2 | LLM (6.5) | LLM hallucination (mitigated) |
| Maintainability (2.D) | ~8.0 | LLM (6.0) | Event sourcing complexity |
| **Proven Stack** | **9.1** | **Server (8.5)** | Server restart cliff (well-mitigated) |

The Proven Stack has no component below 8.5. This is achieved by deferring every component that would score below 8.5 (LLM, advanced UI features, GPU integration) to Phase 2.

### Top 5 Failure Scenarios

#### Scenario 1: KataGo Process Dies During Analysis
**Probability**: Medium over months | **Impact**: Medium — analysis delayed 5-15s

| Aspect | Detail |
|--------|--------|
| Trigger | Memory growth hits 512MB threshold, or rare segfault on edge position |
| User experience | "AI analysis is temporarily unavailable. Please try again in a few seconds." |
| Detection | Watchdog timer (30s interval) or process.on('exit') |
| Recovery | Automatic restart in 3-15s; user retries manually or queue processes next query |
| Data loss | Zero — in-memory queue is lost, but user can re-request |
| Prevention | Proactive restart at 512MB; heartbeat ping every 30s |

#### Scenario 2: Server Process Crash During Active Games
**Probability**: Low | **Impact**: High — all games interrupted for 15-30s

| Aspect | Detail |
|--------|--------|
| Trigger | Unhandled exception, OOM, or deployment |
| User experience | "Reconnecting..." banner for 15-30s, then game resumes exactly |
| Detection | PM2 / systemd restarts process |
| Recovery | Process starts, loads active games from PG, reconstructs state via Rules Engine, clients reconnect |
| Data loss | Zero — every move is in PostgreSQL |
| Prevention | Graceful shutdown on SIGTERM; keep process memory lean |

#### Scenario 3: Rules Engine Scoring Bug in Production
**Probability**: Very Low (after 220 tests) | **Impact**: Critical

| Aspect | Detail |
|--------|--------|
| Trigger | Undiscovered seki or superko edge case |
| User experience | Wrong score displayed at game end |
| Detection | User report; or post-game KataGo scoring comparison (Phase 2 feature) |
| Recovery | Hotfix code change; affected games flagged |
| Data loss | Zero — move history is preserved; score can be recalculated |
| Prevention | 220 tests, 50 pro game replays, 20 KataGo cross-validations |

#### Scenario 4: PostgreSQL Write Failure
**Probability**: Very Low | **Impact**: High — moves not persisted

| Aspect | Detail |
|--------|--------|
| Trigger | Disk full, PG crash, connection pool exhausted |
| User experience | Game continues (in-memory state), but moves not saved |
| Detection | DB error handler fires; 3 retries with backoff |
| Recovery | PG restarts; queued writes flush; or manual game reconstruction from client-reported moves |
| Data loss | Potentially 1-3 moves if PG is down for extended period |
| Prevention | PG disk monitoring; connection pool limit alerts; WAL backup |

#### Scenario 5: All Template Explanations Unhelpful
**Probability**: Low-Medium | **Impact**: Low — users can still play, analysis data still shown

| Aspect | Detail |
|--------|--------|
| Trigger | Template language is too formulaic; users want more nuanced explanations |
| User experience | Explanations are accurate but feel robotic |
| Detection | "Was this helpful?" ratings below 50% average |
| Recovery | Accelerate Phase 2 LLM integration with collected feedback data |
| Data loss | None |
| Prevention | Calibrate templates against KaTrain's proven patterns; 3 explanation levels |

---

## 7. Development Timeline

**Total: 16 weeks** (fastest of conservative scenarios — because fewer features means less to build)

The Proven Stack is paradoxically the fastest conservative scenario to build because it defers the most complex features (LLM integration, advanced UI, process pool) to Phase 2. Fewer features = fewer bugs = less testing time = faster ship.

```
Phase 1: Rules Engine (Weeks 1-4)
├── Week 1: Board + Groups + Liberty counting
│   Deliverables: board.ts, groups.ts, hash.ts
│   Tests: 50+ (board ops, group finding, liberty counting)
│   Gate: All tests pass; property-based tests confirm invariants
│
├── Week 2: Move logic + Ko + Suicide
│   Deliverables: moves.ts, state.ts
│   Tests: 40+ (captures, ko, suicide, superko)
│   Gate: All tests pass; replay 10 pro games successfully
│
├── Week 3: Scoring + Edge case hardening
│   Deliverables: scoring.ts
│   Tests: 35+ (scoring, seki, dame, edge cases)
│   Gate: 50 pro game replays match; KataGo cross-validation (20 positions)
│
├── Week 4: Integration testing + bug fixing
│   Tests: Property-based (10,000 random games), fuzz testing
│   Gate: 220 total tests pass; zero known bugs; code review complete
│   Total Rules Engine LOC: ~410
│   Total Rules Engine Tests: 220

Phase 2: KataGo + Explanation Templates (Weeks 5-7)
├── Week 5: KataGo process management
│   Deliverables: katago-service.ts (spawn, query, parse, restart)
│   Tests: 22+ (lifecycle, watchdog, error handling)
│   Gate: 1000-query stress test passes; memory stays < 512MB
│
├── Week 6: In-memory queue + API endpoints
│   Deliverables: analysis-queue.ts, /api/analysis route
│   Tests: 16+ (queue ops, overflow, drain, API responses)
│   Gate: HTTP-to-analysis-result flow works end-to-end
│
├── Week 7: Template engine + explanation pipeline
│   Deliverables: templates.ts, classifier.ts, 35-40 templates
│   Tests: 77+ (classification, rendering, sanitization)
│   Gate: All templates render correctly; golden dataset of 50 positions verified

Phase 3: Game Server (Weeks 8-11)
├── Week 8: WebSocket server + connection management
│   Deliverables: ws-server.ts, connection-manager.ts
│   Tests: 20+ (connect, disconnect, reconnect, state machine)
│   Gate: Two browsers can connect and exchange messages
│
├── Week 9: Game state manager + move handling
│   Deliverables: game-manager.ts (uses Rules Engine)
│   Tests: 20+ (create, move, validate, broadcast)
│   Gate: Two players can play a full game via WebSocket
│
├── Week 10: Matchmaking + Clock + Persistence
│   Deliverables: matchmaking.ts, clock.ts, game-repo.ts
│   Tests: 26+ (match, clock, DB operations)
│   Gate: Full game lifecycle from matchmaking to SGF export
│
├── Week 11: Reconnection + crash recovery + SGF
│   Deliverables: reconnection logic, sgf-generator.ts
│   Tests: 18+ (reconnect, server restart, SGF output)
│   Gate: Kill server mid-game → restart → game continues

Phase 4: UI (Weeks 12-14)
├── Week 12: Board component + game page layout
│   Deliverables: GoBoard (SVG), Stone, GhostStone, Coordinates
│   Tests: 15+ (render, click-to-coordinate, responsive)
│   Gate: Board renders correctly on 3 sizes, clicks produce moves
│
├── Week 13: Game UI + info panels
│   Deliverables: PlayerInfo, Clock, MoveList, GameControls,
│                 AIExplanation, ScorePanel, MatchmakingDialog
│   Tests: 15+ (all components render, state updates)
│   Gate: Full game UI functional on desktop
│
├── Week 14: Mobile + cross-browser + accessibility
│   Deliverables: Responsive layout, NavigationBar,
│                 ConnectionStatus, ErrorBoundary, GameReviewBar
│   Tests: 19+ (mobile, cross-browser, accessibility, E2E)
│   Gate: Full game playable on mobile; cross-browser verified

Phase 5: Integration & Hardening (Weeks 15-16)
├── Week 15: End-to-end testing + failure injection
│   Tests: Full scenarios:
│     - 2 players: matchmaking → play → score → review → SGF
│     - Kill KataGo mid-analysis → recovery
│     - Kill server mid-game → recovery
│     - Kill PostgreSQL mid-write → recovery
│     - 200 concurrent games stress test
│   Gate: All scenarios pass; all RTOs met
│
├── Week 16: Performance tuning + monitoring + deploy
│   Deliverables: Health check endpoint, structured logging,
│                 Sentry integration, PM2 config, Coolify deploy
│   Tests: Smoke tests on production environment
│   Gate: Production deployment verified; monitoring active

Total: 16 weeks
Total Tests: ~554
Total LOC (domain): ~2,800-3,200
```

### Quality Gates Summary

| Gate | Week | Criteria | Enforcement |
|------|------|----------|-------------|
| G1: Rules Engine Core | 2 | 90+ tests, 10 pro game replays | CI blocks merge |
| G2: Rules Engine Full | 4 | 220 tests, 50 replays, 20 cross-validations | CI + manual review |
| G3: KataGo | 6 | 52 tests, 1000-query stress, memory < 512MB | CI + stress test |
| G4: Templates | 7 | 142 tests (combined KataGo + templates), 50 golden positions | CI |
| G5: Game Server | 11 | 91 tests, crash recovery verified, concurrent game test | CI + chaos test |
| G6: UI | 14 | 49 tests, cross-browser, mobile, accessibility | CI + visual review |
| G7: Integration | 16 | All E2E scenarios pass, all RTOs met, monitoring active | Manual + automated |

---

## 8. Cost Estimate

### Monthly Operating Costs (MAU 8K)

| Item | Cost/Month | Notes |
|------|-----------|-------|
| Hetzner CCX33 (app + KataGo) | €60 (~$65) | 8 vCPU AMD EPYC, 32GB RAM, dedicated CPU |
| Hetzner CX22 (PostgreSQL + Redis) | €5 (~$5.50) | 2 vCPU, 4GB RAM; or colocate on CCX33 |
| Domain + DNS (Cloudflare) | $15 | Standard |
| Monitoring (Sentry free tier) | $0 | Free for <5K events/month |
| Backup storage (Hetzner) | $3 | PG WAL backups, snapshots |
| LLM API | **$0** | Templates only in v1.0 |
| **Total** | **$89-93/month** | |

### Cost Comparison

| Scenario | Monthly Cost | Key Drivers |
|----------|-------------|-------------|
| Cutting Edge (2.A) | $170-250 | GPU path, LLM API ($30-90), more infra |
| Speed First (2.C) | ~$100-130 | LLM API, basic infra |
| Stability (2.B) | $137-197 | LLM API ($30-90), Redis for BullMQ |
| Maintainability (2.D) | $130-180 | LLM API, event store infrastructure |
| **Proven Stack** | **$89-93** | **No LLM API, no extra Redis, minimal infra** |

The Proven Stack has the lowest monthly cost by $44-157 compared to all other scenarios, primarily because:
1. No LLM API calls ($0 vs $30-90/month)
2. No separate Redis instance for BullMQ (in-memory queue)
3. Minimal monitoring (free tier sufficient at MAU 8K)

### Development Cost (AI Agent Sessions)

| Phase | Weeks | Agent Sessions | Notes |
|-------|-------|---------------|-------|
| Phase 1: Rules Engine | 4 | 35-50 | High-test, high-care; 220 tests |
| Phase 2: KataGo + Templates | 3 | 25-35 | Process management + template writing |
| Phase 3: Game Server | 4 | 30-45 | WebSocket + persistence |
| Phase 4: UI | 3 | 20-30 | 15 components, SVG board |
| Phase 5: Hardening | 2 | 15-20 | Integration + monitoring |
| **Total** | **16** | **125-180 sessions** | |

### 3-Year Total Cost of Ownership

| Item | Year 1 | Year 2 | Year 3 | Total |
|------|--------|--------|--------|-------|
| Infrastructure | $1,068-1,116 | $1,116 | $1,116 | $3,300-3,348 |
| LLM API (Phase 2, after month 4) | $240-720 | $360-1,080 | $360-1,080 | $960-2,880 |
| Maintenance (agent sessions) | $0 (AI) | $0 (AI) | $0 (AI) | $0 |
| **Total 3-Year** | | | | **$4,260-6,228** |

---

## 9. Proven Score Methodology

### What "Proven" Means

A technology or pattern earns "proven" status if it meets ALL of the following:

1. **Production track record**: Deployed in at least one system serving real users for 3+ years
2. **Failure modes documented**: Known failure modes have been encountered, documented, and mitigated by the community
3. **AI-agent buildable**: Can be implemented by Claude Code without requiring specialized hardware, proprietary SDKs, or undocumented APIs
4. **Rollback-safe**: If it fails, the system degrades gracefully or can be replaced without data loss

### Proven Score Rubric

| Score | Definition |
|-------|-----------|
| 10.0 | Mathematically provable correctness (e.g., checksums, hash functions) |
| 9.5 | Deterministic system with exhaustive test coverage and 10+ year track record |
| 9.0 | Well-understood system with known failure modes, all mitigated, 5+ year track record |
| 8.5 | Proven pattern with one or two inherent risks that require monitoring |
| 8.0 | Proven pattern with well-documented risks and reliable recovery mechanisms |
| 7.5 | Proven pattern with some unpredictable failure modes |
| 7.0 | Partially proven; some components are experimental |
| <7.0 | Not eligible for Proven Stack |

### Score Assignments with Justification

| Area | Score | Key Justification |
|------|-------|-------------------|
| KataGo | 9.0 | 6+ year track record (Eigen), known failure mode (memory growth) fully mitigated; single dependency (KataGo binary) |
| Rules Engine | 9.5 | 30-year-old algorithms, pure functions, 220 tests, cross-validated; only risk is undiscovered edge cases |
| Templates | 9.5 | Deterministic; identical pattern used by Lichess (16 years), KaTrain (6 years); zero external dependency |
| Game Server | 8.5 | 34-year track record (IGS pattern); server restart cliff is well-mitigated but inherent |
| UI | 9.0 | 11+ year SVG track record; 15 components is small enough for exhaustive testing |

---

## 10. What Proven Stack Sacrifices vs. What It Guarantees

### What Proven Stack Sacrifices

| Sacrifice | Impact | When Recoverable |
|-----------|--------|-----------------|
| **Natural language explanations at launch** | Users get template text instead of conversational AI commentary | Phase 2 (60 days post-launch); templates provide identical data, just less polished language |
| **Win rate graph in v1.0** | No visual chart; win rate shown as text in template explanation | Phase 2; add Recharts component (1-2 days work) |
| **Move quality colored overlay on board** | No blue/green/yellow/red circles on stones | Phase 2; requires classification calibration against real user data |
| **HumanSL rank-calibrated play** | Users cannot play against AI at specific rank levels | Phase 3+; feature requires 2+ years of HumanSL production track record |
| **GPU acceleration** | KataGo analysis is slower (3-15s vs 0.1-0.5s on GPU) | Phase 3+; only triggered by consistent queue overload |
| **Territory visualization** | No shaded territory markers on board during scoring | Phase 2; requires scoring accuracy validation first |
| **Dark mode** | Light mode only | Phase 2; user demand driven |
| **Sound effects** | Silent game play | Phase 2; audio implementation is straightforward |
| **Spectator mode** | No watching other players' games | Phase 2+; adds connection management complexity |
| **Bot opponent** | No playing against AI in v1.0 | Phase 2; requires KataGo ↔ game server integration |
| **External SGF import** | Cannot upload existing game files for review | Phase 2+; SGF parsing edge cases are well-documented |
| **Development speed** | 16 weeks vs 7-10 weeks for Speed First | Permanent trade-off; quality over speed |

### What Proven Stack Guarantees (That Others Cannot)

| Guarantee | How Ensured | What Others Risk |
|-----------|-------------|-----------------|
| **Zero hallucinated explanations** | No LLM in v1.0; templates are deterministic | Cutting Edge: ~20% hallucination rate; Stability: ~5% after validation |
| **Zero monthly LLM cost** | Templates cost $0 | All others: $30-90/month |
| **Zero external API dependency for core features** | No LLM API, no GPU service, no external database | All others depend on Anthropic API availability |
| **Rules engine correctness to 220-test confidence** | Most exhaustive test suite of any scenario | Cutting Edge: ~90 tests; Stability: 130 tests |
| **50 professional game replay verification** | Most games cross-validated | Cutting Edge: ~10; Stability: 20 |
| **Lowest monthly cost ($89-93)** | Minimal infrastructure, zero API costs | Next cheapest: Speed First at ~$100-130 |
| **Fastest crash recovery for KataGo** | In-memory queue = zero queue infrastructure to recover | BullMQ scenarios require Redis recovery for queue |
| **Simplest debugging** | No Redis for analysis queue, no LLM validation pipeline, no process pool | All others have more components to debug |
| **Highest Proven Score (9.1/10)** | No component below 8.5 | Stability: 8.2 (LLM drags to 6.5); Cutting Edge: ~7.5 |
| **Every choice has 3+ years of production precedent** | Verified against KaTrain, OGS, IGS, Lichess, Sabaki | Others include components with <2 years of track record |

### Decision Matrix: When to Choose Proven Stack

| If your priority is... | Choose... | Why |
|------------------------|-----------|-----|
| Maximum reliability at MAU 8K | **Proven Stack** | Highest Proven Score (9.1), no component below 8.5 |
| Lowest operational cost | **Proven Stack** | $89-93/month vs $100-250/month |
| Simplest codebase for AI agents to maintain | **Proven Stack** | ~2,800-3,200 LOC, 15 UI components, no LLM validation pipeline |
| Natural language AI commentary at launch | Cutting Edge or Stability | Proven Stack defers LLM to Phase 2 |
| Fastest time to market | Speed First | 7-10 weeks vs 16 weeks |
| Maximum future flexibility | Cutting Edge | Event sourcing, process pool, HumanSL |
| Long-term maintainability | Maintainability (2.D) or Proven Stack | Both optimize for long-term; different trade-offs |

---

## Complete Technology Stack Table

| Layer | Technology | Version | Proven Since | Why This Exact Choice |
|-------|-----------|---------|-------------|----------------------|
| **Runtime** | Node.js | 22 LTS | 2009 (17 years) | Decided in Phase 2 |
| **Framework** | Next.js | 15 | 2016 (10 years) | Decided in Phase 2 |
| **Database** | PostgreSQL | 16 | 1996 (30 years) | Decided in Phase 2 |
| **Cache** | Redis | 7.2 | 2009 (17 years) | Sessions + matchmaking only; NOT for game state or analysis queue |
| **ORM** | Drizzle | latest | 2022 (4 years) | Decided in Phase 2 |
| **Linter** | Biome | latest | 2023 (3 years) | Decided in Phase 2 |
| **Hosting** | Coolify + Hetzner CCX33 | latest | 2021 / 2003 | Decided in Phase 2 |
| **KataGo** | v1.16.4, Eigen CPU, b18c384nbt | v1.16.4 | Eigen: 2020 (6 years) | Stable release; CPU avoids GPU crashes |
| **KataGo IPC** | child_process.spawn, JSON stdin/stdout | Node.js built-in | 2015 (11 years) | Simplest, most debuggable IPC |
| **Analysis Queue** | In-memory FIFO array (max 50) | Native JS | 1995 (31 years) | Zero dependencies; trivially debuggable |
| **Rules Engine** | Custom TypeScript, Tromp-Taylor + Chinese | Custom | Algorithms: 1970-1996 | Pure functions; 30-year-old algorithms |
| **Board State** | Uint8Array (1D) | TypedArray | 2011 (15 years) | Cache-friendly; GC-free |
| **Hash** | Zobrist hashing (BigInt, 64-bit) | Custom | 1970 (56 years) | O(1) incremental; standard in game engines |
| **Explanation** | Template engine (string interpolation) | Native JS | 1995 (31 years) | Deterministic; zero external dependency |
| **WebSocket** | ws (npm) | latest | 2011 (15 years) | Fastest Node.js WS library; lowest abstraction |
| **State Mgmt (UI)** | Zustand | latest | 2019 (7 years) | 2KB, minimal API, 40K+ GitHub stars |
| **Board Render** | Pure SVG (<circle>, <line>, <text>) | SVG 1.1 | 2001 (25 years) | Universal browser support; resolution-independent |
| **Process Mgmt** | PM2 or systemd | latest | PM2: 2013 (13 years) | Auto-restart, log management |
| **SGF** | Custom generator, FF[4], UTF-8 | FF[4] | 1999 (27 years) | Generate only; no external parser dependency |

---

## Success Probability Assessment

| Metric | Proven Stack | Stability (2.B) | Cutting Edge (2.A) | Speed First (2.C) |
|--------|-------------|-----------------|--------------------|--------------------|
| **Launch success probability** | **95%** | 88% | 75% | 70% |
| **Zero critical bugs at launch** | **90%** | 80% | 65% | 55% |
| **Meets MAU 8K performance** | **98%** | 95% | 90% | 85% |
| **Monthly cost within budget** | **99%** | 90% | 80% | 85% |
| **AI agent can build without blockers** | **95%** | 90% | 80% | 85% |
| **Users find explanations useful** | **70%** (templates) | 80% (LLM+template) | 75% (LLM with risk) | 60% (rushed) |

The Proven Stack has the highest launch success probability (95%) because it has the fewest moving parts, the fewest external dependencies, and the most exhaustive test suite. The only metric where it scores lower is explanation usefulness (70% vs 80% for Stability), because templates are less engaging than natural language — but they are never wrong.

---

## Sources

- [KataGo GitHub — Releases v1.16.0 through v1.16.4](https://github.com/lightvector/katago/releases)
- [KataGo Analysis Engine Documentation](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [KataGo Eigen CPU Release v1.6.0 (2020)](https://github.com/lightvector/KataGo/releases/tag/v1.6.0)
- [KataGo Memory Growth Issue #756](https://github.com/lightvector/KataGo/issues/756)
- [KataGo Memory Usage Issue #303](https://github.com/lightvector/KataGo/issues/303)
- [KataGo v1.16.0 TensorRT NaN Crash Documentation](https://github.com/lightvector/KataGo/releases/tag/v1.16.0)
- [KataGo v1.16.4 Experimental Eval Cache](https://github.com/lightvector/KataGo/releases/tag/v1.16.4)
- [KataGo Networks — b18, b15, b10 Models](https://katagotraining.org/networks/)
- [KataGo Eigen Optimization Issue #288](https://github.com/lightvector/KataGo/issues/288)
- [KaTrain — AI Analysis/Teaching Tool](https://github.com/sanderland/katrain)
- [KaTrain Move Quality Classification](https://forums.online-go.com/t/katrain-ai-analysis-playing-teaching-tool-based-on-katago/30258)
- [ZBaduk — Commercial AI Review Service](https://zbaduk.com/)
- [ZBaduk Documentation](https://github.com/bvandenbon/zbaduk-docs)
- [BadukAI — Web KataGo Interface](https://aki65.github.io/)
- [Tromp-Taylor Rules — John Tromp's Page](https://tromp.github.io/go.html)
- [Tromp-Taylor Rules — CMU Reference](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html)
- [Computer Go / Tromp-Taylor Rules — Wikibooks](https://en.wikibooks.org/wiki/Computer_Go/Tromp-Taylor_Rules)
- [Implementing the Game of Go — Part 1](https://www.moderndescartes.com/essays/implementing_go/)
- [Rules of Go — Wikipedia](https://en.wikipedia.org/wiki/Rules_of_Go)
- [SGF Format — cwi.nl](https://homepages.cwi.nl/~aeb/go/misc/sgf.html)
- [Smart Game Format — Wikipedia](https://en.wikipedia.org/wiki/Smart_Game_Format)
- [Internet Go Server History — Wikipedia](https://en.wikipedia.org/wiki/Internet_Go_server)
- [Go Servers — A Short History (British Go Association)](https://www.britgo.org/history/servers.html)
- [KGS Server History](https://www.gokgs.com/help/ServerHistory.html)
- [OGS — Online-Go.com GitHub](https://github.com/online-go)
- [OGS Goban Library](https://github.com/online-go/goban)
- [OGS SVG Goban Renderer Announcement](https://forums.online-go.com/t/new-experimental-svg-based-goban-renderer/51831)
- [OGS Real-Time API Documentation](https://ogs.readme.io/docs/real-time-api)
- [Sabaki — Go Board & SGF Editor](https://sabaki.yichuanshen.de/)
- [Shudan — Preact Goban Component](https://github.com/SabakiHQ/Shudan)
- [Tenuki — Web Go Board Library (SVG)](https://github.com/aprescott/tenuki)
- [WGo.js — JavaScript Go Library](https://wgo.waltheri.net/)
- [LLMs Playing and Commentating on Go (2025)](https://www.adarie.com/articles/8/)
- [AI Rewiring Go Players — MIT Technology Review (2026)](https://www.technologyreview.com/2026/02/27/1133624/ai-is-rewiring-how-the-worlds-best-go-players-think/)
- [Node.js WebSocket: ws vs Socket.IO Comparison](https://dev.to/alex_aslam/nodejs-websockets-when-to-use-ws-vs-socketio-and-why-we-switched-di9)
- [WebSocket vs Socket.IO — Ably Guide](https://ably.com/topic/socketio-vs-websocket)
- [Real-time Gaming with Node.js + WebSocket — Google Cloud](https://cloud.google.com/architecture/real-time-gaming-with-node-js-websocket)
- [Colyseus — Real-Time Multiplayer Framework](https://colyseus.io/)
- [AMD EPYC Genoa AVX2/AVX-512 Support — Phoronix](https://www.phoronix.com/review/amd-epyc-9004-genoa)
- [Hetzner Cloud VPS Review 2026 — Better Stack](https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/)
- [Hetzner Cloud Pricing Calculator](https://costgoat.com/pricing/hetzner)
- [katago-analyze-sgf — Node.js KataGo Integration Example](https://github.com/kevinsung/katago-analyze-sgf)
- [Go Game Coordinate Systems — SGF and GTP](https://homepages.cwi.nl/~aeb/go/misc/sgf.html)
- [Go and Mathematics — Combinatorics (Tromp & Farneback)](https://tromp.github.io/go/gostate.pdf)
