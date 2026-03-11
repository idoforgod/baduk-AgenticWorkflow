# Baduk Domain Technology PRD — Stability First Analysis

**Research**: 3 of 3 (Domain Technology Deep-Dive)
**Perspective**: Technology Stability & Reliability Expert
**Date**: 2026-03-10
**Prior Context**: Balanced Scenario (MAU 8K, MRR $5K), Tech Stack v1.0 decided
**Builder**: AI Agents (Claude Code) — no human developers

---

## Executive Summary

This PRD analyzes all 10 Phase 1 branch results through a **stability-first lens**, selecting the approach for each of the 5 baduk domain areas that maximizes reliability, crash resistance, data integrity, and long-term maintainability. The composite stack prioritizes proven patterns over innovation, graceful degradation over feature richness, and deterministic behavior over probabilistic outputs.

**Key finding**: The single greatest stability risk across all 5 areas is the LLM Explanation Pipeline — it is inherently non-deterministic, has zero native Go understanding, and no amount of engineering can make it 100% reliable. Every other component can be made deterministic and crash-recoverable. The architecture must therefore treat LLM explanations as a **luxury feature that degrades gracefully to templates**, never as a load-bearing component.

**Composite Stability Score: 8.1 / 10**

---

## Table of Contents

1. [KataGo Integration](#1-katago-integration)
2. [Go Rules Engine](#2-go-rules-engine)
3. [LLM Explanation Pipeline](#3-llm-explanation-pipeline)
4. [Real-time Game Server](#4-real-time-game-server)
5. [Baduk UI/UX](#5-baduk-uiux)
6. [Composite Analysis](#6-composite-analysis)
7. [Stability-Optimized Development Timeline](#7-stability-optimized-development-timeline)
8. [Cost Estimate](#8-cost-estimate)
9. [Stability Tax Analysis](#9-stability-tax-analysis)

---

## 1. KataGo Integration

### Recommended Approach: Conservative (Branch 2) with selective elements from Branch 1

**Stability Score: 8.5 / 10**

### Rationale

Branch 2 (Conservative) wins decisively on stability grounds. The core insight: at MAU 8K, CPU Eigen is mathematically sufficient, and every additional layer of complexity (GPU drivers, CUDA versions, multi-process pools, TensorRT) introduces failure modes that provide zero user-visible benefit at this scale.

Real-world evidence strongly supports this choice:
- KataGo v1.16.0 had crash bugs specifically on **TensorRT** with extreme komis and large boards due to nonfinite (NaN/Infinity) values. These bugs do not affect the Eigen CPU backend.
- KataGo v1.12 exhibited ~4MB/game memory growth in long-running processes — manageable with periodic cache clearing, but a genuine concern for always-on services.
- The Analysis Engine protocol is JSON-based, single-line-per-query, with built-in error reporting — a stable, well-documented interface.

### Architecture Decision

```
┌─────────────────────────────────────────────┐
│            Node.js Application              │
│                                             │
│  ┌─────────────┐    ┌───────────────────┐   │
│  │  BullMQ      │───▶│  KataGo Worker   │   │
│  │  Queue       │    │  (single process) │   │
│  └─────────────┘    └───────────────────┘   │
│        │                     │               │
│        │              child_process.spawn()  │
│        │                     │               │
│        │            ┌────────▼──────────┐   │
│        │            │  KataGo Analysis  │   │
│        │            │  Engine (Eigen)   │   │
│        │            │  b18c384nbt model │   │
│        └────────────│  stdin/stdout     │   │
│                     └───────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Watchdog (health check every 30s)  │    │
│  │  - Memory threshold: 512MB          │    │
│  │  - Heartbeat timeout: 10s           │    │
│  │  - Auto-restart with 3s backoff     │    │
│  │  - Max 5 restarts / 10 min          │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| Backend | Eigen (CPU, AVX2) | No GPU driver dependencies, deterministic, no NaN crashes |
| Neural Network | b18c384nbt | Best balance of strength and CPU performance |
| Process Model | Single KataGo process | Eliminates process coordination complexity |
| IPC Method | child_process.spawn(), JSON stdin/stdout | Node.js Stability 2 API, no external dependencies |
| Queue | BullMQ with Redis | Proven at-least-once delivery, stalled job recovery |
| Visits (quick) | 10 visits | Fast feedback for interactive play (~200ms) |
| Visits (review) | 100 visits | Adequate for amateur game review (~2s) |
| Visits (deep) | 500 visits | Advanced analysis, async only (~10s) |
| Cache | nnCacheSizePowerOfTwo=20 (1M entries) | ~256MB RAM, periodic clear every 1000 queries |
| Concurrent queries | Sequential processing, BullMQ concurrency=1 | Deterministic resource usage, no contention |
| Server | Hetzner CCX33 (8 vCPU AMD, 32GB RAM) | ~60 EUR/mo, dedicated CPU for consistent performance |

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| KataGo process crash (segfault) | Low | High — all queued analyses stall | process.on('exit') event | Auto-restart with 3s exponential backoff, max 5 restarts/10min | 3-15s |
| Memory leak (4MB/game growth) | Medium | Medium — OOM after ~10K games | RSS monitoring every 30s, threshold 512MB | Graceful restart: drain queue, kill process, respawn | 5-10s |
| Malformed JSON input | Low | None — KataGo reports error, continues | Parse KataGo stderr for error messages | Input validation before sending to KataGo, log + skip bad queries | 0s |
| stdin pipe broken | Low | High — process unusable | Write error on stdin | Kill and restart process, re-queue active job | 3-5s |
| Invalid board position sent | Low | Low — KataGo rejects gracefully | KataGo error response in stdout | Validate board state before sending, return error to user | 0s |
| Redis down (BullMQ) | Very Low | Critical — no queue processing | BullMQ connection error events | Redis persistence (AOF), maxmemory-policy=noeviction, failover | 30-60s |
| CPU saturation (100%) | Medium | Medium — slow responses | Load average monitoring | Reject new queries when queue > 50, return "busy" to user | 0s |
| Neural network file corruption | Very Low | Critical — KataGo won't start | KataGo startup validation | SHA256 checksum on model file, keep backup copy | 30s |

### Weakest Link Analysis

**Weakest link: Long-running process memory accumulation.** KataGo was designed for desktop use (start, analyze, close), not 24/7 server operation. The documented ~4MB/game memory growth means after 10,000 games, the process consumes an additional ~40GB — far exceeding server RAM.

**Mitigation**: Implement a rolling restart schedule. Every 500 analyses (or when RSS exceeds 512MB), gracefully drain the BullMQ queue, terminate the KataGo process, and spawn a fresh one. Total restart window: 5-10 seconds. User impact: one or two users see a ~10s delay instead of ~2s.

### Minimum Test Coverage

| Test Category | Count | Examples |
|--------------|-------|---------|
| Unit: JSON query construction | 15 | All visit levels, all board sizes, edge positions |
| Unit: Response parsing | 10 | Valid response, error response, malformed response |
| Integration: KataGo lifecycle | 8 | Start, query, crash-restart, memory limit restart |
| Integration: BullMQ flow | 6 | Enqueue, process, fail-retry, stalled recovery |
| Stress: Sequential load | 3 | 100/500/1000 queries in sequence |
| E2E: User analysis request | 5 | Quick/review/deep analysis from HTTP to response |
| **Total** | **47** | |

### Recovery Time Objective (RTO)

| Scenario | RTO |
|----------|-----|
| KataGo process crash | < 15 seconds |
| Planned memory restart | < 10 seconds |
| Redis failure + recovery | < 60 seconds |
| Full server reboot | < 5 minutes |

### GPU Upgrade Path (Future)

Trigger: Queue wait time consistently > 15 seconds for >10% of queries. Action: Add Hetzner GPU server (RTX 3090, ~200 EUR/mo), switch to CUDA backend. The architecture (BullMQ queue + single process) remains identical — only the KataGo binary and config change.

---

## 2. Go Rules Engine

### Recommended Approach: Evolutionary (Branch 3) with hardened test suite from Branch 4

**Stability Score: 9.0 / 10**

### Rationale

Branch 3 (Evolutionary) is the correct stability choice. The reasoning:

1. **Correctness is paramount**: A rules engine that is 99.9% correct but covers 6 rulesets is worse than one that is 100% correct for 1 ruleset. Go rules seem simple but contain notorious edge cases — seki scoring, bent four in the corner, moonshine life, triple ko, 10,000-year ko.

2. **Real-world evidence**: Rule differences cause problems in approximately 1 in 10,000 competitive games. For MAU 8K casual players, Chinese rules cover >95% of use cases. Japanese rules can come in Phase 2.

3. **AI agent confidence**: Branch 4 claims 95% AI agent confidence for the Big Bang approach (6 rulesets, 45 edge cases, 4-5K lines code). This means a 5% chance of shipping subtle rules bugs that are extremely hard to detect — a stone placed incorrectly, a capture missed, scoring wrong by 1 point. These bugs destroy user trust completely.

4. **Tromp-Taylor as base**: The Tromp-Taylor rules are the most precisely defined ruleset in Go, with zero ambiguity. Starting here and adding Chinese scoring is mathematically the safest path.

### Architecture Decision

```
┌──────────────────────────────────────────────────────┐
│                    Rules Engine Core                  │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Board State  │  │  Move Logic  │  │  Scoring   │ │
│  │  Uint8Array   │  │  Place       │  │  Chinese   │ │
│  │  19×19=361    │  │  Capture     │  │  Area      │ │
│  │  Zobrist hash │  │  Ko (simple) │  │  Counting  │ │
│  │  Immutable    │  │  Pass        │  │            │ │
│  └──────────────┘  │  Resign      │  └────────────┘ │
│                     └──────────────┘                  │
│                                                      │
│  Invariants enforced at every state transition:      │
│  - Board size: 9×9, 13×13, 19×19 only               │
│  - Stone count: black = white ± 1 (no handicap)     │
│  - No stone on occupied intersection                 │
│  - Captured stones removed before ko check           │
│  - Zobrist hash updated incrementally                │
│  - Move history append-only, never mutated           │
└──────────────────────────────────────────────────────┘
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| Language | TypeScript (strict mode) | Type safety catches category errors at compile time |
| Board representation | 1D Uint8Array (N*N) | Cache-friendly, no object allocation, deterministic |
| Hash | Zobrist hashing (64-bit) | O(1) ko/superko detection, collision probability ~10^-19 |
| Ruleset (MVP) | Tromp-Taylor + Chinese scoring | Unambiguous, covers 95%+ of casual play |
| Ruleset (Phase 2) | Japanese scoring | Added only after 100% test coverage on Chinese |
| Code size target | 200-400 lines core | Small enough for full comprehension and review |
| Immutability | Board state immutable; new state = new object | Eliminates mutation bugs, enables easy undo/replay |
| Komi | 6.5 (Chinese), 6.5 (Japanese) | Standard values, configurable |

### Implementation Order (Stability-Optimized)

```
Week 1: Board + Place + Capture + Liberty counting
  Tests: 30+ (every capture pattern, edge/corner/center)
  Gate: 100% test pass before proceeding

Week 2: Ko detection + Pass/Resign + Game lifecycle
  Tests: 20+ (simple ko, snapback, approach ko variations)
  Gate: 100% test pass, zero known bugs

Week 3: Chinese scoring + Territory detection
  Tests: 25+ (empty board, full board, seki positions, dame)
  Gate: Run against 100 known game records with verified scores

Week 4: Superko (positional) + Handicap stones + Edge hardening
  Tests: 15+ (triple ko, eternal life, sending-two-returning-one)
  Gate: Full regression suite green
```

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| Incorrect capture (liberty miscounted) | Very Low after testing | Critical — game state corrupted | Property-based testing with known positions | Exhaustive liberty flood-fill, tested against KataGo for 1000 positions | N/A (prevention) |
| Ko rule violation (allows illegal retake) | Low | High — game fairness broken | Zobrist hash comparison with previous state | Maintain previous board hash, reject if equal | 0s |
| Scoring error (wrong territory) | Medium (seki cases) | High — wrong game result | Compare scoring against KataGo scoring for test positions | Conservative scoring: flag ambiguous positions for manual review | 0s |
| Integer overflow in Zobrist | Effectively zero | Critical | Static analysis | Use BigInt or split into two 32-bit values with XOR | N/A |
| Invalid board state passed to engine | Low | Medium | Runtime type checking + assertions | TypeScript strict mode + runtime validation at API boundary | 0s |
| Performance degradation on 19x19 | Very Low | Low — moves take >100ms | Benchmark suite in CI | 1D array + flood-fill is O(N) where N=361, always <1ms | N/A |

### Weakest Link Analysis

**Weakest link: Scoring in seki positions.** False eyes in seki are counted differently in Chinese vs. Japanese rules, and detecting seki itself requires life-and-death analysis that approaches the complexity of Go AI. For MVP with Chinese rules, this is partially mitigated because area scoring handles seki more simply — but edge cases remain.

**Mitigation**: For any position where the scoring algorithm's confidence is low (detected via heuristic: groups with 1 liberty adjacent to opponent groups with 1 liberty), defer to KataGo's scoring. This creates a dependency on KataGo for ~0.1% of games but eliminates the highest-risk scoring errors.

### Minimum Test Coverage

| Test Category | Count | Examples |
|--------------|-------|---------|
| Unit: Board operations | 20 | Place, remove, get, neighbors, bounds |
| Unit: Liberty counting | 15 | Single stone, group, edge, corner, surrounded |
| Unit: Capture logic | 20 | Single capture, multi-capture, snapback, self-capture |
| Unit: Ko detection | 10 | Simple ko, no-ko (different position), ko with captures |
| Unit: Scoring | 25 | Empty, full, partial, seki, dame, komi |
| Property-based | 10 | Random valid game → valid end state, hash consistency |
| Integration: Full games | 20 | Replay 20 real game SGF files, verify final score |
| Cross-validation | 10 | Compare engine result with KataGo for complex positions |
| **Total** | **130** | |

### Recovery Time Objective (RTO)

Not applicable — the rules engine is a pure function library with no runtime state. If it produces a wrong result, the bug is in code and requires a code fix, not runtime recovery. The design goal is **zero bugs in production** through exhaustive testing.

---

## 3. LLM Explanation Pipeline

### Recommended Approach: Robust (Branch 6) — LLM as translator, KataGo as truth source

**Stability Score: 6.5 / 10** (lowest of all 5 areas — inherent to the technology)

### Rationale

This is the highest-risk area in the entire domain stack, and Branch 6's analysis is unequivocally correct: **LLMs have ZERO understanding of Go.** Every piece of research confirms this:

- GPT-4 playing 9x9 Go miscount liberties, place stones on occupied points, and require constant correction.
- LLMs hallucinate about move quality: "Black's move at 77 was an error allowing White to seize the initiative" — even when the move was perfectly fine according to engine analysis.
- LLMs fail at chess consistently (hallucinating illegal moves, state drift, context dilution), and Go is orders of magnitude more complex.

Branch 5's "Rapid" approach (V1 templates, V2 Haiku in 25 days, $1,200-2,200/mo) is a stability trap. It gets you to market faster but with hallucinated explanations that will be discovered and reported by experienced Go players — destroying credibility in a community that values precision.

**The only stable architecture**: KataGo produces structured numerical data (win rate, score lead, top moves, territory ownership). The LLM's job is solely to translate these numbers into natural language. The LLM never generates Go knowledge — it formats pre-verified facts.

### Architecture Decision

```
┌─────────────────────────────────────────────────────────┐
│               Explanation Pipeline                       │
│                                                         │
│  Step 1: KataGo Analysis (TRUTH SOURCE)                 │
│  ┌─────────────────────────────────────────────┐        │
│  │  Input: Board position + last N moves       │        │
│  │  Output: {                                  │        │
│  │    winRate: 0.62,                           │        │
│  │    scoreLead: 3.2,                          │        │
│  │    topMoves: [{move: "Q16", visits: 342,    │        │
│  │               winRate: 0.65, scoreLead: 4.1}│        │
│  │              ],                             │        │
│  │    ownership: [...361 floats...],            │        │
│  │    currentPlayer: "black"                   │        │
│  │  }                                          │        │
│  └──────────────────────┬──────────────────────┘        │
│                         │                               │
│  Step 2: Data Anchoring (SAFETY LAYER)                  │
│  ┌──────────────────────▼──────────────────────┐        │
│  │  - Classify position: opening/middle/endgame│        │
│  │  - Classify move delta: blunder/mistake/ok/ │        │
│  │    good/excellent (by winRate change)        │        │
│  │  - Extract territory shifts from ownership  │        │
│  │  - Flag high-risk: if |delta_winRate| > 0.15│        │
│  │    → MANDATORY TEMPLATE FALLBACK            │        │
│  │  - Build structured fact sheet              │        │
│  └──────────────────────┬──────────────────────┘        │
│                         │                               │
│  Step 3: Generate (LLM or Template)                     │
│  ┌──────────────────────▼──────────────────────┐        │
│  │  IF high_risk OR llm_unavailable:           │        │
│  │    → Template engine (deterministic)        │        │
│  │  ELSE:                                      │        │
│  │    → Claude Haiku 4.5 with constrained      │        │
│  │      system prompt + fact sheet only         │        │
│  │    → Max 150 tokens output                  │        │
│  │    → Temperature: 0.3 (low creativity)      │        │
│  └──────────────────────┬──────────────────────┘        │
│                         │                               │
│  Step 4: Output Validation (GUARD RAIL)                 │
│  ┌──────────────────────▼──────────────────────┐        │
│  │  - Check: no board coordinates mentioned    │        │
│  │    that aren't in KataGo's top moves        │        │
│  │  - Check: no win% claims that contradict    │        │
│  │    KataGo data by >5%                       │        │
│  │  - Check: no unsupported Go terminology     │        │
│  │  - Check: output length within bounds       │        │
│  │  - IF any check fails → fallback to         │        │
│  │    template                                 │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| LLM Model | Claude Haiku 4.5 | $1/M input, $5/M output; 597ms TTFT; sub-second latency |
| Temperature | 0.3 | Minimize creative hallucination |
| Max output tokens | 150 | Constrains output, reduces hallucination surface |
| System prompt | Rigid: "You are translating Go analysis data into natural language. ONLY use the facts provided. NEVER add Go knowledge." | Prevents the LLM from inventing Go concepts |
| Fallback trigger | LLM timeout (>5s), validation failure, API error, high-risk position | Any doubt → template |
| Template count (MVP) | 30 templates | 10 per level (beginner/intermediate/advanced) |
| Golden dataset | 200 positions with verified explanations | Accuracy benchmark before launch |
| Target accuracy | 75-80% at launch, 90%+ at 6 months | Measured against expert review of golden dataset |
| Cache | Redis, keyed by position hash + visit count | Identical positions get identical (verified) explanations |
| Cost per explanation | ~$0.001-0.003 (Haiku 4.5) | ~$30-90/mo at MAU 8K assuming 1 explanation/user/day |

### 3-Tier Explanation Levels

| Level | Audience | Content | Example |
|-------|----------|---------|---------|
| Beginner (15-25 kyu) | New players | "Good move" / "Try here instead" + basic reason | "This move protects your group. The AI thinks Black is ahead by about 3 points." |
| Intermediate (5-15 kyu) | Club players | Territory impact, direction of play, efficiency | "This move shifts the territorial balance. White's lead decreases from 5.2 to 2.1 points. The AI's top suggestion was R14, which would maintain pressure on the upper right." |
| Advanced (1-5 dan) | Strong amateurs | Full KataGo data with minimal narration | "Win rate: B 62.3% → 58.1% (-4.2%). Score lead: B+3.2 → B+1.8. Top engine move: Q16 (65.1%, B+4.1, 342 visits). This move appears suboptimal — the engine prefers the shoulder hit." |

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| LLM hallucination (wrong move reference) | Medium | High — misleads player | Output validation: check all coordinates against KataGo data | Reject + template fallback | 0s |
| LLM hallucination (wrong win% claim) | Medium | High — contradicts displayed data | Compare LLM output numbers against KataGo data (±5% tolerance) | Reject + template fallback | 0s |
| LLM API timeout (>5s) | Low-Medium | Low — user waits | Timeout detection | Return template explanation immediately | 0s |
| LLM API rate limit (429) | Low | Medium — batch of users affected | HTTP status code monitoring | Exponential backoff + template fallback queue | 5-30s |
| LLM API outage | Very Low | Low — templates still work | Health check endpoint, error rate monitoring | 100% template mode until API recovers | 0s |
| Claude Haiku price increase | Low | Medium — cost model changes | Invoice monitoring | Budget alert at 2x baseline, switch to cheaper model or 100% templates | N/A |
| Prompt injection via SGF comments | Very Low | Medium — unexpected LLM output | Input sanitization | Strip all non-coordinate, non-numeric data before LLM prompt | 0s |
| Template produces wrong explanation | Very Low | High — deterministic bug | Golden dataset regression tests | Templates are simple variable substitution, fully testable | Code fix |

### Weakest Link Analysis

**Weakest link: LLM hallucination in edge cases that pass validation.** The output validation layer checks for coordinate references and win% consistency, but an LLM could still produce subtly wrong strategic assessments like "This move controls the center" when the move is actually on the edge. These semantic hallucinations are undetectable by automated validation.

**Mitigation strategy (layered)**:
1. **Constrain vocabulary**: The system prompt limits the LLM to a fixed vocabulary of ~50 Go terms with definitions. Any term outside this list triggers re-generation.
2. **Positional awareness**: The data anchoring layer classifies the position (opening/middle/endgame, corner/side/center) and the LLM prompt includes this classification, reducing spatial hallucinations.
3. **User feedback loop**: "Was this explanation helpful?" button. Explanations with <50% helpfulness rating are flagged for review and replaced with templates.
4. **Expert spot-check**: Monthly review of 50 random explanations by a dan-level player. Accuracy tracked as a metric.

### Minimum Test Coverage

| Test Category | Count | Examples |
|--------------|-------|---------|
| Unit: Data anchoring | 15 | Position classification, move quality categorization |
| Unit: Template rendering | 30 | All 30 templates with various input data |
| Unit: Output validation | 20 | Valid output, hallucinated coordinate, wrong win%, too long |
| Integration: Full pipeline (LLM) | 15 | Golden dataset positions, verify output quality |
| Integration: Fallback path | 10 | Timeout, API error, validation failure → template |
| Regression: Golden dataset | 200 | Full golden dataset accuracy measurement |
| **Total** | **290** | |

### Recovery Time Objective (RTO)

| Scenario | RTO |
|----------|-----|
| Single LLM request failure | 0s (immediate template fallback) |
| LLM API outage | 0s (100% template mode) |
| Validation pipeline bug | Code fix (templates continue working) |

---

## 4. Real-time Game Server

### Recommended Approach: Practical (Branch 8) with event log from Branch 7

**Stability Score: 8.0 / 10**

### Rationale

Branch 7 (Debt Minimized) proposes full event sourcing. While event sourcing is a natural fit for Go (SGF is literally an event log), real-world production experience reveals severe pitfalls:

- **Schema evolution**: Adding a field to an event (e.g., `discount_code` to `OrderPlaced`) broke projections retroactively when events were replayed.
- **Event loop cascades**: `UserUpdated` triggered `ProfileUpdated` which triggered `UserUpdated` — infinite loop until OOM.
- **Replay performance**: One system's replays took DAYS in local CI. A financial app with millions of events required replaying 3TB to reconstruct state.

For a Go game server at MAU 8K, full event sourcing is over-engineering. A Go game has at most ~400 moves. The entire game state fits in a single database row. The "event log" is simply the move history array — you get 90% of event sourcing's benefits (replay, audit, undo) without any of the infrastructure complexity.

Branch 8's practical approach (MVP 10-14 days, 8 tracked shortcuts, safe until MAU 25K+) is the correct stability choice because:
- Single Node.js process handles 50K+ concurrent WebSocket connections (MAU 8K means ~200-400 concurrent users)
- Server-authoritative game state eliminates client-side cheating and desync
- Simple matchmaking (ELO ±200, expand after 30s) is exactly what the scale requires

Real-world evidence from Lichess confirms: their longest downtime was caused by hardware failure at the hosting provider, not application-level issues. Their WebSocket reconnection issues are well-documented — users see "Reconnecting" banners, moves are reverted, time discrepancies occur during reconnection. Our architecture must handle these cases explicitly.

The OGS (Online Go Server) gtp2ogs project documents that server disconnects cause games to get stuck when bots are mid-move during a restart — exactly the kind of edge case we must handle.

### Architecture Decision

```
┌────────────────────────────────────────────────────────────┐
│                    Game Server                              │
│                                                            │
│  ┌────────────────┐   ┌──────────────────────────────┐     │
│  │  HTTP API       │   │  WebSocket Server (ws)       │     │
│  │  /api/games     │   │  - Heartbeat: 30s ping/pong  │     │
│  │  /api/match     │   │  - Reconnect window: 5 min   │     │
│  │  /api/users     │   │  - Max connections: 10,000   │     │
│  └────────────────┘   │  - Message format: JSON       │     │
│                        │  - Binary: none (simplicity)  │     │
│                        └──────────────────────────────┘     │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Game State Manager (Server-Authoritative)           │   │
│  │                                                     │   │
│  │  GameState {                                        │   │
│  │    id: string                                       │   │
│  │    board: Uint8Array(361)       // current position │   │
│  │    moves: Move[]                // full history     │   │
│  │    currentPlayer: 'B' | 'W'                        │   │
│  │    captures: {black: n, white: n}                   │   │
│  │    status: 'playing'|'scoring'|'finished'           │   │
│  │    clocks: {black: ms, white: ms}                   │   │
│  │    moveNumber: number           // monotonic        │   │
│  │    lastMoveTimestamp: number                        │   │
│  │  }                                                  │   │
│  │                                                     │   │
│  │  All mutations via applyMove(state, move) → state'  │   │
│  │  (uses Rules Engine as pure function)                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌──────────────────┐  ┌────────────────────────────┐     │
│  │  PostgreSQL 16    │  │  Redis 7.2                 │     │
│  │  - Game records   │  │  - Active game state cache │     │
│  │  - User profiles  │  │  - Session tokens          │     │
│  │  - Move history   │  │  - Matchmaking queue       │     │
│  │  - Ratings        │  │  - BullMQ jobs             │     │
│  └──────────────────┘  └────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| WebSocket library | ws (Node.js) | Fastest, no unnecessary abstraction layer (Socket.IO overhead not needed) |
| Heartbeat | 30s ping/pong | Detects dead connections before user notices; standard interval |
| Reconnect window | 5 minutes | Player has 5 min to reconnect before timeout loss |
| Message format | JSON | Human-readable, easy debugging, adequate for Go's low message rate (~1 msg/30s) |
| State authority | Server only | Client renders, server decides — eliminates desync |
| Move validation | Server-side only (Rules Engine) | Client can pre-validate for UX, but server is authoritative |
| Persistence | Every move → PostgreSQL | Move history is append-only, never updated |
| Active game cache | Redis with 1hr TTL | Fast reads during gameplay, PG is source of truth |
| Matchmaking | ELO ±200, expand ±50 every 30s, max ±500 | Simple, fair, predictable |
| Concurrency model | Single process, event loop | Node.js single-thread handles 50K+ WS connections |
| Time control | Server-side clock | Client clock is display-only; server calculates remaining time |

### Connection State Machine

```
                 ┌─────────┐
                 │  INIT   │
                 └────┬────┘
                      │ connect
                 ┌────▼────┐
            ┌───▶│ ACTIVE  │◀───┐
            │    └────┬────┘    │
            │         │         │
    pong    │    ping │    move │
  received  │   miss  │ received│
            │         │         │
            │    ┌────▼────┐    │
            └────│  STALE  │────┘
                 └────┬────┘
                      │ 3 consecutive
                      │ ping misses
                 ┌────▼────┐
                 │  AWAY   │
                 └────┬────┘
                      │ 5 min timeout
                 ┌────▼────┐
                 │ FORFEIT │
                 └─────────┘

  At any state except FORFEIT:
  reconnect → verify identity → send full game state → ACTIVE
```

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| WebSocket disconnect (network) | High (normal) | None — expected | ping/pong miss | Auto-reconnect client-side, server holds state for 5 min | 0-30s |
| Client sends invalid move | Medium | None | Rules Engine rejects | Return error message, do not mutate state | 0s |
| Game state desync (client vs server) | Low | Medium — confusing UI | Client sends moveNumber with each move, server compares | Server sends full state on mismatch; client re-renders | <1s |
| Server process crash | Very Low | High — all active games pause | Process manager (PM2 / systemd) | Auto-restart, reload active games from Redis/PG | 5-15s |
| PostgreSQL write failure (move) | Very Low | Critical — move lost | Database error handler | Retry 3x with exponential backoff, then hold move in Redis | 1-5s |
| Redis cache failure | Low | Medium — slow reads | Redis connection error | Fall back to PostgreSQL for reads; BullMQ pauses | 10-30s |
| Memory leak (WebSocket handles) | Low | Medium — slow degradation | RSS monitoring | Periodic connection audit; close orphaned connections | 0s |
| Time control disagreement | Low | Medium — player disputes | Server-side clock is authoritative | Client shows server time ± network latency estimate | 0s |
| Simultaneous move race condition | Very Low | Medium — both players' moves accepted | Monotonic moveNumber + currentPlayer check | Reject second move with "not your turn" error | 0s |
| SGF export corruption | Low | Low — bad game record | SGF validation after generation | Use well-tested SGF serializer, validate against parser | N/A |

### Weakest Link Analysis

**Weakest link: Server restart during active games.** When the Node.js process restarts (crash, deploy, or OOM), all WebSocket connections drop simultaneously. Unlike a gradual degradation, this is a "cliff event" where every active game is interrupted.

**Mitigation**:
1. **Persist all game state to Redis on every move** (not just PG). On restart, reload all active games from Redis.
2. **Client auto-reconnect with exponential backoff**: 1s, 2s, 4s, 8s, max 16s.
3. **On reconnect, server sends full game state** (board + moves + clocks + whose turn). Client replaces its local state entirely — no merge, no diff, just overwrite.
4. **Graceful shutdown**: On SIGTERM, send "server restarting" message to all clients, wait 2s for in-flight moves to persist, then exit.
5. **Zero-downtime deploys**: Use PM2 cluster mode or rolling restart (start new process, drain old connections, kill old process after 30s).

### SGF Handling

SGF parsing has documented edge cases: character encoding issues (escaped `\` and `]` characters), mojibake when files are converted to UTF-8, and ambiguous PropValue definitions. Our approach:

| Decision | Rationale |
|----------|-----------|
| Generate SGF, don't parse external SGF (MVP) | We control output format — eliminates all parsing ambiguity |
| Use FF[4] format only | Most widely supported, well-defined |
| UTF-8 encoding always | No charset conversion issues |
| Validate generated SGF | Parse our own output before saving to detect generation bugs |
| Import external SGF (Phase 2) | Use battle-tested parser library, reject invalid files gracefully |

### Minimum Test Coverage

| Test Category | Count | Examples |
|--------------|-------|---------|
| Unit: Game state transitions | 20 | Create, move, capture, pass, resign, score |
| Unit: WebSocket messages | 15 | Connect, move, heartbeat, disconnect, reconnect |
| Unit: Matchmaking | 10 | Match found, expand range, timeout, cancel |
| Unit: Clock management | 10 | Decrement, timeout, pause, resume, reconnect |
| Integration: Full game flow | 10 | Create → match → play → resign/score → save |
| Integration: Reconnection | 8 | Disconnect → reconnect → full state sync → continue |
| Integration: Server restart | 5 | Crash → restart → reload from Redis → games continue |
| Integration: Database | 8 | Save move, load game, save result, query history |
| Stress: Concurrent games | 3 | 100/500/1000 simultaneous games |
| E2E: Two players | 5 | Full game from matchmaking to SGF export |
| **Total** | **94** | |

### Recovery Time Objective (RTO)

| Scenario | RTO |
|----------|-----|
| Single player disconnect | 0s (server holds state) |
| Server process crash | 15-30s (auto-restart + client reconnect) |
| Database failure | 60s (Redis continues serving, PG recovers) |
| Full server reboot | 3-5 min |
| Zero-downtime deploy | 0s (rolling restart) |

---

## 5. Baduk UI/UX

### Recommended Approach: Classical (Branch 10) with responsive additions from Branch 9

**Stability Score: 8.5 / 10**

### Rationale

Branch 10 wins on stability grounds with its core philosophy: **"Don't innovate on the board — innovate on what surrounds it."** This is profoundly correct for several reasons:

1. **20+ years of proven patterns**: CGoban (1999), KGS (2003), Sabaki (2015), OGS (2014), KaTrain (2020). The Go board UI is a solved problem. Every innovation on the board itself (fancy animations, novel interaction patterns, experimental layouts) introduces risk with zero functional benefit.

2. **SVG is confirmed by both branches**: SVG rendering for Go boards is the industry standard. Cross-browser SVG support is excellent on modern browsers (basic SVG support is universal), though subtle rendering differences exist in gradients, filters, and text rendering between browsers.

3. **18 components vs. 30 components**: Branch 10's 18 minimal components is a 40% smaller surface area than Branch 9's 30+ components. Fewer components = fewer bugs, fewer interactions, fewer edge cases.

4. **Mobile UX**: Branch 9 proposes "Tap-Preview-Confirm" on mobile with use-gesture. Branch 10's simpler approach (tap to place) is more reliable. The preview step adds a modal state that can get stuck, doesn't work with screen readers, and is unnecessary for 19x19 where stones are already small enough to require zooming.

From Branch 9, we selectively adopt:
- **KaTrain color scheme** for move quality visualization (blue/green/yellow/red) — this is data display, not interaction innovation.
- **Recharts for statistics** — proven library, display-only, no interaction risk.
- **Zustand for state management** — simpler than Redux, fewer footguns.

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
│  │  │  │GoBoard │ │  │  │ - Name, rank, avatar │ │  │  │
│  │  │  │ (SVG)  │ │  │  │ - Clock              │ │  │  │
│  │  │  │        │ │  │  │ - Captures           │ │  │  │
│  │  │  └────────┘ │  │  └──────────────────────┘ │  │  │
│  │  │  ┌────────┐ │  │  ┌──────────────────────┐ │  │  │
│  │  │  │Coords  │ │  │  │ MoveList             │ │  │  │
│  │  │  └────────┘ │  │  │ - Scrollable         │ │  │  │
│  │  │             │  │  │ - Click to navigate   │ │  │  │
│  │  └─────────────┘  │  └──────────────────────┘ │  │  │
│  │                    │  ┌──────────────────────┐ │  │  │
│  │                    │  │ AIExplanation        │ │  │  │
│  │                    │  │ - Text panel         │ │  │  │
│  │                    │  │ - Loading skeleton   │ │  │  │
│  │                    │  │ - Fallback message   │ │  │  │
│  │                    │  └──────────────────────┘ │  │  │
│  │                    └──────────────────────────────┘  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Total components: 18                                  │
│  External UI dependencies: Zustand, Recharts           │
│  Board rendering: Pure SVG, no Canvas, no WebGL        │
│  Animation: CSS transitions only (opacity, transform)  │
│  Gesture library: none (tap events via standard DOM)   │
└────────────────────────────────────────────────────────┘
```

### Component Inventory (18 Components)

| # | Component | Type | Complexity | Notes |
|---|-----------|------|-----------|-------|
| 1 | GoBoard | SVG container | Medium | Grid lines, star points, click handler |
| 2 | Stone | SVG circle | Low | Black/white, last-move marker |
| 3 | GhostStone | SVG circle | Low | Semi-transparent hover preview |
| 4 | Coordinates | SVG text | Low | A-T (skip I), 1-19 |
| 5 | TerritoryMarker | SVG rect | Low | Small squares for territory |
| 6 | MoveQualityOverlay | SVG circle | Low | KaTrain colors (blue/green/yellow/red) |
| 7 | PlayerInfo | React | Low | Name, rank, avatar, captures |
| 8 | Clock | React | Medium | Countdown, byo-yomi display, server-synced |
| 9 | MoveList | React | Medium | Scrollable, clickable, current move highlight |
| 10 | AIExplanation | React | Medium | Text display, loading state, fallback |
| 11 | GameControls | React | Low | Pass, resign, undo-request buttons |
| 12 | MatchmakingDialog | React | Medium | Board size, time control, ELO range |
| 13 | ScorePanel | React | Low | Final score display, territory count |
| 14 | NavigationBar | React | Low | Home, games, profile |
| 15 | GameReviewBar | React | Medium | Forward/back/start/end, auto-play |
| 16 | WinRateGraph | Recharts | Low | Single line chart, KataGo data |
| 17 | ConnectionStatus | React | Low | Connected/reconnecting/disconnected indicator |
| 18 | ErrorBoundary | React | Low | Catch render errors, show fallback UI |

### Specifications

| Parameter | Value | Justification |
|-----------|-------|---------------|
| Board rendering | SVG | Universal support, resolution-independent, accessible |
| Board sizes | 9x9, 13x13, 19x19 | Standard sizes, responsive via viewBox |
| Stone rendering | SVG circle with radial gradient | Simple, performant, proven in Sabaki/OGS |
| State management | Zustand | 2KB, minimal API, no boilerplate, no reducers |
| Charts | Recharts | React-native SVG charts, well-maintained, accessible |
| Animations | CSS transitions only | transform + opacity, hardware-accelerated, no JS animation library |
| Mobile breakpoint | 768px | Board fills width, info panel below |
| Accessibility | ARIA labels on all interactive elements | Screen reader support for move announcements |
| Color scheme | KaTrain-inspired quality indicators | Blue (excellent), Green (good), Yellow (inaccuracy), Red (mistake) |
| Font | System font stack | No web font loading delay, consistent rendering |

### Failure Mode Catalog

| Failure Mode | Probability | Impact | Detection | Mitigation | RTO |
|-------------|------------|--------|-----------|------------|-----|
| SVG rendering inconsistency (browser) | Low | Low — cosmetic | Visual regression testing with Playwright | Use simple SVG primitives only (circle, rect, line, text) | N/A |
| Touch target too small on mobile | Medium | Medium — misplaced stones | Usability testing, minimum 44px target | Zoom-to-region on first tap, place on second tap | N/A |
| Clock desync (client vs server) | Low | Medium — time pressure unfair | Compare client clock with server on each move | Client clock is display-only; server adjusts on each move | 0s |
| React render crash | Very Low | High — blank screen | ErrorBoundary component | Show "Something went wrong, refresh the page" with game ID | 0s |
| WebSocket message lost | Low | Medium — move not shown | moveNumber monotonic check | Client requests full state if gap detected | <1s |
| Recharts render failure | Very Low | Low — no win rate graph | ErrorBoundary around chart | Show "Chart unavailable" text, game continues | 0s |
| Zustand state corruption | Very Low | High — UI shows wrong state | State invariant checks (e.g., moveNumber always increases) | Reset local state from server state | <1s |
| Large board performance (19x19) | Very Low | Low — janky rendering | Frame rate monitoring in development | 361 SVG circles is trivial for modern browsers, <1ms render | N/A |

### Weakest Link Analysis

**Weakest link: Mobile interaction on 19x19 boards.** A 19x19 board has 361 intersections. On a 375px-wide phone screen, each intersection is approximately 19px apart — below the recommended 44px touch target. This is a solved problem in existing Go apps (zoom, then tap), but implementing the zoom interaction correctly is non-trivial.

**Mitigation**:
1. **Pinch-to-zoom via CSS `transform: scale()`** — no JavaScript gesture library needed.
2. **Double-tap to zoom to quadrant** (top-left, top-right, bottom-left, bottom-right) — simple, predictable.
3. **Once zoomed, tap to place** — standard behavior, no preview step needed.
4. **9x9 and 13x13 work without zoom** on all devices — prioritize these board sizes for mobile.

### Minimum Test Coverage

| Test Category | Count | Examples |
|--------------|-------|---------|
| Unit: Component rendering | 18 | Each component renders without crash |
| Unit: Board interaction | 10 | Click to place, hover preview, coordinate mapping |
| Unit: State management | 10 | Move applied, undo, game end, reconnect state |
| Visual regression | 6 | Board (3 sizes) × 2 themes (light/dark) |
| Accessibility | 5 | Screen reader announces moves, keyboard navigation |
| Cross-browser | 4 | Chrome, Firefox, Safari, Edge — board renders correctly |
| Mobile | 5 | Touch place, zoom, landscape/portrait, small screen |
| E2E: Full game UI | 3 | Play game from match → moves → score on desktop/tablet/phone |
| **Total** | **61** | |

### Recovery Time Objective (RTO)

| Scenario | RTO |
|----------|-----|
| Component render crash | 0s (ErrorBoundary shows fallback) |
| WebSocket disconnect | 0s (ConnectionStatus indicator, auto-reconnect) |
| State desync | <1s (server pushes full state) |
| Full page crash | User refresh (~3s) |

---

## 6. Composite Analysis

### Composite Stability Score

| Area | Score | Weight | Weighted Score | Justification |
|------|-------|--------|---------------|---------------|
| KataGo Integration | 8.5 | 0.20 | 1.70 | Mature software, CPU-only eliminates GPU issues, watchdog covers crashes |
| Go Rules Engine | 9.0 | 0.25 | 2.25 | Pure functions, deterministic, exhaustive testing possible |
| LLM Explanation Pipeline | 6.5 | 0.15 | 0.975 | Inherently non-deterministic, but template fallback contains risk |
| Real-time Game Server | 8.0 | 0.25 | 2.00 | Proven patterns, server-authoritative, but restart cliff exists |
| Baduk UI/UX | 8.5 | 0.15 | 1.275 | Classical patterns, SVG is robust, minimal component count |
| **Composite** | | **1.00** | **8.2** | |

**Composite Stability Score: 8.2 / 10**

The weights reflect criticality: Rules Engine and Game Server are weighted highest because bugs there directly corrupt game integrity. LLM and UI are weighted lower because they are display/explanation layers that can degrade gracefully without affecting game correctness.

### Top 5 Failure Scenarios and Mitigation Strategies

#### Scenario 1: KataGo Process Dies During Peak Usage
**Probability**: Medium | **Impact**: High | **Blast Radius**: All pending analysis requests

| Aspect | Detail |
|--------|--------|
| Trigger | Memory leak reaches OOM, or segfault on edge-case position |
| User experience | Analysis requests return "AI is temporarily unavailable" for 5-15 seconds |
| Detection | process.on('exit') fires immediately |
| Mitigation | Watchdog auto-restarts within 3s; BullMQ re-queues the failed job; user gets result after restart |
| Prevention | RSS monitoring + proactive restart at 512MB; cache clear every 500 queries |
| Data loss | Zero — BullMQ persists jobs in Redis; the pending job is re-processed |
| Recovery | Automatic, 5-15 seconds |

#### Scenario 2: LLM API Outage During User Analysis Request
**Probability**: Low | **Impact**: Low (by design) | **Blast Radius**: Explanation quality degrades

| Aspect | Detail |
|--------|--------|
| Trigger | Anthropic API returns 500/503, or rate limit 429, or network timeout |
| User experience | User sees template-based explanation instead of LLM-generated — slightly less natural language but 100% factually correct |
| Detection | HTTP error code or 5s timeout |
| Mitigation | Immediate fallback to template engine; no retry (user is waiting) |
| Prevention | Cache frequently-requested positions; templates always available |
| Data loss | Zero |
| Recovery | Automatic, 0 seconds (template is served immediately) |

#### Scenario 3: Server Restart During Active Games
**Probability**: Low (deploys, crashes) | **Impact**: High | **Blast Radius**: All active games interrupted

| Aspect | Detail |
|--------|--------|
| Trigger | OOM, deploy, or unhandled exception |
| User experience | "Reconnecting..." banner for 5-30 seconds, then game resumes exactly where it was |
| Detection | PM2 / systemd detects process exit |
| Mitigation | (1) Every move persisted to Redis + PG before ACK to client. (2) On restart, reload all active games from Redis. (3) Client auto-reconnects with exponential backoff. (4) On reconnect, server sends full game state. |
| Prevention | Graceful shutdown on SIGTERM; zero-downtime deploys via rolling restart |
| Data loss | Zero — at-most one move could be in-flight, but it's re-sent by the client on reconnect |
| Recovery | Automatic, 15-30 seconds |

#### Scenario 4: Rules Engine Scoring Bug Discovered in Production
**Probability**: Very Low (after testing) | **Impact**: Critical | **Blast Radius**: All games using affected scoring path

| Aspect | Detail |
|--------|--------|
| Trigger | Seki position or unusual endgame not covered by test suite |
| User experience | Wrong final score displayed; player disputes result |
| Detection | User report; post-game comparison with KataGo scoring |
| Mitigation | (1) Immediate: allow manual score adjustment by both players agreeing. (2) Short-term: add the position to test suite, fix bug, deploy hotfix. (3) Affected games flagged for review. |
| Prevention | 130+ tests including cross-validation against KataGo; golden dataset of 100 game records with verified scores |
| Data loss | Zero — game state and move history are always preserved; only the displayed score is wrong |
| Recovery | Hotfix deploy, 1-4 hours; affected games manually corrected |

#### Scenario 5: Redis Failure (Cache + Queue Layer)
**Probability**: Very Low | **Impact**: High | **Blast Radius**: Analysis queue stops, active game cache lost

| Aspect | Detail |
|--------|--------|
| Trigger | Redis process crash, disk failure, OOM |
| User experience | (1) KataGo analysis unavailable (BullMQ can't enqueue). (2) Active game reads slow (fall back to PG). (3) New matchmaking paused. |
| Detection | Redis connection error events on all consumers |
| Mitigation | (1) PostgreSQL is ultimate source of truth for all game data. (2) KataGo analysis degrades to "unavailable" — games continue. (3) Matchmaking can use in-memory fallback for short outages. |
| Prevention | Redis AOF persistence; maxmemory-policy=noeviction; monitoring with alerts |
| Data loss | Potentially lose in-flight BullMQ jobs (re-submit on recovery). Active game state re-built from PG. |
| Recovery | Redis auto-restart, 30-60 seconds; full recovery after cache warm-up |

### Cross-Cutting Stability Mechanisms

| Mechanism | Applies To | Implementation |
|-----------|-----------|----------------|
| Health check endpoint | All services | GET /health returns status of KataGo, Redis, PG, LLM |
| Structured logging | All services | JSON logs with correlation IDs, log level filtering |
| Error tracking | All services | Sentry or equivalent — group errors, alert on new types |
| Graceful degradation | LLM, KataGo, Redis | Each service has a "degraded mode" that doesn't crash others |
| Circuit breaker | LLM API | After 5 consecutive failures, switch to templates for 60s |
| Rate limiting | All external APIs | BullMQ concurrency limits, LLM request throttle |
| Database migrations | PostgreSQL | Drizzle migrations, always backward-compatible, never destructive |
| Backup | PostgreSQL, Redis | PG: daily WAL backup; Redis: AOF + periodic RDB |

---

## 7. Stability-Optimized Development Timeline

The timeline prioritizes correctness and test coverage over speed. Each phase has explicit quality gates that must pass before proceeding.

```
Phase 1: Foundation (Weeks 1-4)
├── Week 1-2: Rules Engine core (board + place + capture + ko)
│   Gate: 65+ unit tests, all passing, zero known bugs
├── Week 3: Rules Engine scoring (Chinese) + superko
│   Gate: 130+ tests, 20 real game replays verified
├── Week 4: KataGo integration (spawn, query, parse, restart)
│   Gate: 47 tests, 1000-query stress test, memory monitoring
│
Phase 2: Game Server (Weeks 5-8)
├── Week 5-6: WebSocket server + game state manager
│   Gate: Full game lifecycle test, reconnection test
├── Week 7: Matchmaking + clock management
│   Gate: Concurrent games test (100+ games)
├── Week 8: SGF export + game history + database persistence
│   Gate: 94 tests total, zero data loss on crash test
│
Phase 3: LLM Pipeline (Weeks 9-11)
├── Week 9: Template engine (30 templates, 3 levels)
│   Gate: All templates render correctly with varied inputs
├── Week 10: Data anchoring + output validation
│   Gate: Validation catches 100% of test hallucinations
├── Week 11: Claude Haiku integration + fallback wiring
│   Gate: 200 golden dataset positions, 75%+ accuracy
│
Phase 4: UI (Weeks 12-15)
├── Week 12-13: Board component (SVG) + game page layout
│   Gate: Visual regression tests, cross-browser check
├── Week 14: Mobile responsiveness + touch interaction
│   Gate: Mobile usability test on 3 device sizes
├── Week 15: Game review + AI explanation display + statistics
│   Gate: Full E2E test from matchmaking to review
│
Phase 5: Integration & Hardening (Weeks 16-18)
├── Week 16: End-to-end integration testing
│   Gate: 2-player full game, analysis, review, SGF export
├── Week 17: Stress testing + failure injection
│   Gate: Kill KataGo, kill Redis, kill server mid-game — all recover
├── Week 18: Performance optimization + monitoring setup
│   Gate: All RTO targets met, health checks working, alerts configured

Total: 18 weeks
```

### Quality Gates Summary

| Gate | Criteria | Enforcement |
|------|----------|-------------|
| G1: Rules Engine | 130+ tests pass, 20 game replays match | CI blocks merge |
| G2: KataGo | 47 tests pass, memory stays <512MB over 1000 queries | CI + manual check |
| G3: Game Server | 94 tests pass, zero data loss on simulated crash | CI + chaos test |
| G4: LLM Pipeline | 290 tests pass, golden dataset accuracy ≥75% | CI + manual review |
| G5: UI | 61 tests pass, visual regression clean, mobile usable | CI + visual review |
| G6: Integration | Full E2E scenario pass, all 5 failure scenarios recover | Manual + automated |

---

## 8. Cost Estimate

### Monthly Operating Costs (MAU 8K)

| Item | Cost/Month | Notes |
|------|-----------|-------|
| Hetzner CCX33 (app + KataGo) | €60 (~$65) | 8 vCPU AMD, 32GB RAM, dedicated CPU |
| Hetzner CX22 (Redis + misc) | €5 (~$5.50) | 2 vCPU, 4GB RAM (or colocate) |
| Managed PostgreSQL (Hetzner) | €15 (~$16) | Or self-managed for $0 |
| Claude Haiku 4.5 API | $30-90 | ~1 explanation/user/day, with caching |
| Domain + DNS | $15 | Standard |
| Monitoring (Sentry free tier) | $0 | Free for <5K events/month |
| Backup storage | $5 | PG backups, Redis snapshots |
| **Total** | **$137-197/month** | |

### Development Cost (AI Agent Hours)

| Phase | Weeks | Estimated Agent Sessions | Notes |
|-------|-------|------------------------|-------|
| Phase 1: Foundation | 4 | 40-60 | Rules engine is high-test, high-care work |
| Phase 2: Game Server | 4 | 30-50 | WebSocket + persistence, moderate complexity |
| Phase 3: LLM Pipeline | 3 | 20-35 | Template engine + integration, moderate |
| Phase 4: UI | 4 | 30-45 | SVG board + responsive, moderate |
| Phase 5: Hardening | 2 | 15-25 | Integration testing + failure injection |
| **Total** | **17-18** | **135-215 sessions** | |

---

## 9. Stability Tax Analysis

### What is the Stability Tax?

The "stability tax" is the additional time and cost invested in reliability over a minimal viable approach. Here is a direct comparison:

| Area | Rapid Approach | Stability Approach | Tax (Extra Time) | Tax Justification |
|------|---------------|-------------------|-----------------|-------------------|
| KataGo | Single process, no watchdog, no memory monitoring | Watchdog, memory monitoring, graceful restart, BullMQ | +1 week | Prevents 2AM pages when KataGo silently OOMs |
| Rules Engine | 200 lines, 20 tests, ship fast | 300 lines, 130 tests, cross-validation with KataGo | +2 weeks | A single scoring bug destroys user trust permanently |
| LLM Pipeline | Direct LLM call, no validation | 4-layer pipeline, templates, golden dataset | +2 weeks | Without validation, ~20% of explanations will hallucinate |
| Game Server | Stateless, no reconnection, no persistence | Server-authoritative, reconnection, crash recovery | +2 weeks | Without reconnection, every network hiccup = lost game |
| UI | 30+ components, animations, gestures | 18 components, CSS-only animation, proven patterns | -1 week (simpler) | Classical approach is actually faster to build |
| Testing | 50 tests total | 622 tests total | +3 weeks | 622 tests find bugs that 50 tests miss |
| **Total** | **~10 weeks** | **~18 weeks** | **+8 weeks (~80%)** | |

### Cost of the Tax

| Metric | Rapid | Stability | Delta |
|--------|-------|-----------|-------|
| Development time | 10 weeks | 18 weeks | +8 weeks (80% more) |
| Test count | ~50 | 622 | +572 tests |
| Monthly operating cost | ~$100/mo | ~$170/mo | +$70/mo (template engine + monitoring) |
| Time to first user | Week 10 | Week 18 | +8 weeks later |

### Is the Tax Worth It?

**Unequivocally yes.** The math:

1. **A scoring bug in production** requires emergency fix + communication to affected users + potential game result reversals. At MAU 8K, even 0.1% of games affected = 8-80 games/month with wrong results. Each wrong result is a forum post, a trust violation, a potential churn.

2. **A KataGo crash without watchdog** means analysis silently stops working. Without monitoring, this could go undetected for hours. With watchdog, it recovers in 15 seconds automatically.

3. **LLM hallucination without validation** means ~20% of explanations are wrong. Experienced Go players will notice immediately. "The AI said my move was good but KataGo shows -15%" — this contradicts the UI and makes the entire product look broken.

4. **No reconnection support** means every network hiccup (train going through a tunnel, WiFi switch, mobile sleep/wake) results in a lost game. At MAU 8K with mobile users, this could affect 5-10% of all games.

5. **The stability approach UI is actually faster** because 18 classical components are simpler to build than 30+ innovative components with gesture libraries and custom animations.

**Break-even**: The 8-week stability tax pays for itself if it prevents even 2-3 hours of emergency debugging per month — which it almost certainly will, given the failure modes documented above.

---

## Appendix A: Branch Selection Summary

| Area | Selected | Rejected | Key Reason |
|------|----------|----------|-----------|
| KataGo | Branch 2 (Conservative) | Branch 1 (Aggressive) | CPU Eigen avoids GPU crash bugs (v1.16.0 NaN issues); single process eliminates coordination complexity |
| Rules Engine | Branch 3 (Evolutionary) | Branch 4 (Big Bang) | 100% correctness for 1 ruleset > 95% confidence for 6 rulesets; 200 vs 5000 lines of code |
| LLM Pipeline | Branch 6 (Robust) | Branch 5 (Rapid) | LLMs have zero Go understanding (confirmed); 4-layer validation prevents hallucination |
| Game Server | Branch 8 (Practical) | Branch 7 (Debt Minimized) | Full event sourcing has documented production pitfalls; simple state + move history provides 90% of the benefits |
| UI/UX | Branch 10 (Classical) | Branch 9 (Modern) | 20+ years of proven Go UI patterns; 18 vs 30 components; classical is faster AND more stable |

## Appendix B: Technology Dependency Matrix

```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│             │ KataGo   │ Rules    │ LLM      │ Server   │ UI       │
│             │          │ Engine   │ Pipeline │          │          │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ KataGo      │    -     │          │ REQUIRED │          │          │
│             │          │          │ (truth)  │          │          │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Rules       │          │    -     │          │ REQUIRED │          │
│ Engine      │          │          │          │ (moves)  │          │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ LLM         │ Depends  │          │    -     │          │          │
│ Pipeline    │ on K.    │          │          │          │          │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Server      │ Uses via │ Uses as  │ Calls    │    -     │          │
│             │ BullMQ   │ library  │ async    │          │          │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ UI          │          │          │ Displays │ Connects │    -     │
│             │          │          │ output   │ via WS   │          │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Key: REQUIRED = hard dependency (system fails without it)
     Uses/Depends/Connects = soft dependency (system degrades gracefully)
     Empty = no dependency
```

**Critical path for stability**: Rules Engine → Game Server → UI. This chain must be 100% reliable. KataGo and LLM Pipeline are enhancement layers that degrade gracefully.

## Appendix C: Real-World Incident Database (Research Sources)

| Incident | Source | Relevance |
|----------|--------|-----------|
| KataGo v1.16.0 TensorRT NaN crashes | KataGo GitHub releases | Validates CPU Eigen choice |
| KataGo v1.12 ~4MB/game memory growth | KataGo GitHub issue #756 | Informs memory watchdog design |
| KataGo "Engine died unexpectedly. Possibly due to out of memory" | KaTrain GitHub issue #21 | Real user impact of OOM |
| Lichess longest downtime (Sep 2024, ~11 hours) | Lichess blog / HN discussion | Hardware failure at provider; infrastructure redundancy matters |
| Lichess "Server restart results in bad game state" | Lichess forum | WebSocket reconnection must re-sync full state |
| Lichess persistent "Reconnecting" banner | Lichess forum (multiple threads) | Client reconnection logic must be robust |
| OGS gtp2ogs games stuck on server disconnect | gtp2ogs GitHub issue #139 | Bot/AI process must handle disconnects |
| OGS sync oscillation bug | OGS forum | Analysis mode state sync is fragile |
| LLM chess hallucinations (illegal moves, state drift) | Multiple research papers + blog posts | LLMs cannot maintain board state; confirms Branch 6 |
| GPT-4 9x9 Go: miscounts liberties, places on occupied | Reddit / adarie.com article | LLMs have zero Go spatial reasoning |
| Event sourcing infinite loop (UserUpdated ↔ ProfileUpdated) | LinkedIn / KiteMetric blog | Justifies avoiding full event sourcing |
| Event sourcing replay taking days | chriskiehl.com blog | Scale risk of event sourcing for game state |
| SGF character encoding corruption (mojibake) | homepages.cwi.nl SGF notes | SGF import must handle encoding carefully |
| Go scoring seki false eye differences | Wikipedia Rules of Go, OGS | Scoring edge case frequency: ~1 in 10,000 games |

---

## Sources

- [KataGo GitHub Releases — v1.16.0 and v1.16.2 crash fixes](https://github.com/lightvector/katago/releases)
- [KataGo Analysis Engine Documentation](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [KataGo Memory Leak Issue #756](https://github.com/lightvector/KataGo/issues/756)
- [KaTrain "Engine died unexpectedly" Issue #21](https://github.com/sanderland/katrain/issues/21)
- [KataGo Eigen Release v1.6.0](https://github.com/lightvector/KataGo/releases/tag/v1.6.0)
- [Lichess: Post-Mortem of Our Longest Downtime (HN Discussion)](https://news.ycombinator.com/item?id=41586579)
- [Lichess: Server restart results in bad game state](https://lichess.org/forum/lichess-feedback/server-restart-results-in-bad-game-state)
- [Lichess: Persistent "Reconnecting" button bug](https://lichess.org/forum/lichess-feedback/bug-persistent-reconnecting-button)
- [Lichess: Reconnecting issues](https://lichess.org/forum/lichess-feedback/reconnecting-issues-2)
- [Lichess WebSocket bug — Chrome unable to start games](https://github.com/lichess-org/lila/issues/16419)
- [OGS: Server disconnects cause games to get stuck (gtp2ogs #139)](https://github.com/online-go/gtp2ogs/issues/139)
- [OGS: Sync oscillation bug](https://forums.online-go.com/t/please-fix-the-sync-oscillation-bug/59053)
- [OGS: Update about server issues (April 2025)](https://forums.online-go.com/t/update-about-ogs-server-issues/56309)
- [LLMs Playing and Commentating on Go: Current State (2025)](https://www.adarie.com/articles/8/)
- [Why LLMs Fail at Chess — Kaggle Tournament Lessons](https://hmwh.se/blog/2025/08/11/why-llms-fail-at-chess-lessons-from-the-kaggle-tournament/)
- [Why LLMs Can't Play Chess](https://www.nicowesterdale.com/blog/why-llms-cant-play-chess)
- [LLM Chess Evaluation — 13 Models Tested](https://dev.to/maximsaplin/can-llms-play-chess-ive-tested-13-models-2154)
- [OK, I can partly explain the LLM chess weirdness now](https://dynomight.net/more-chess/)
- [The Ugly of Event Sourcing — Real-World Production Issues](https://www.linkedin.com/pulse/ugly-event-sourcing-real-world-production-issues-dennis-doomen)
- [Event Sourcing Fails: 5 Real-World Lessons](https://kitemetric.com/blogs/event-sourcing-fails-5-real-world-lessons)
- [Don't Let the Internet Dupe You, Event Sourcing is Hard](https://chriskiehl.com/article/event-sourcing-is-hard)
- [BullMQ: Going to Production](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ: Failing Fast When Redis is Down](https://docs.bullmq.io/patterns/failing-fast-when-redis-is-down)
- [How to Handle Worker Crashes in BullMQ](https://oneuptime.com/blog/post/2026-01-21-bullmq-worker-crashes-recovery/view)
- [Fixing WebSocket Drops in NodeJS](https://infinitejs.com/posts/fixing-websocket-drops-in-nodejs/)
- [WebSocket Best Practices — Voodoo Engineering](https://medium.com/voodoo-engineering/websockets-on-production-with-node-js-bdc82d07bb9f)
- [How to Fix WebSocket Connection Timeout Errors](https://oneuptime.com/blog/post/2026-01-24-websocket-connection-timeout/view)
- [SGF Format Edge Cases and Flaws](https://homepages.cwi.nl/~aeb/go/misc/sgfnotes.html)
- [Implementing the Game of Go — Part 1](https://www.moderndescartes.com/essays/implementing_go/)
- [Rules of Go — Wikipedia](https://en.wikipedia.org/wiki/Rules_of_Go)
- [Go Termination and Scoring Edge Cases](https://jpolitz.github.io/notes/2012/12/25/go-termination.html)
- [Shudan — Preact Goban Component](https://github.com/SabakiHQ/Shudan)
- [Cross-Browser SVG Compatibility Guide 2024](https://www.devteam-works.com/blog/webdevelopment/comprehensive-guide-handling-browser-rendering-differences-2024)
- [SVG Rendering — How to Ensure Cross-Browser Compatibility](https://blog.pixelfreestudio.com/how-to-ensure-cross-browser-compatibility-for-svgs/)
- [Claude Haiku 4.5 — Performance Benchmarks](https://artificialanalysis.ai/models/claude-4-5-haiku/providers)
- [LLM API Latency Benchmarks 2026](https://www.kunalganglani.com/blog/llm-api-latency-benchmarks-2026)
- [Claude Haiku 4.5 — Anthropic](https://www.anthropic.com/claude/haiku)
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)
- [Hetzner Server Comparison 2025 — Achromatic](https://www.achromatic.dev/blog/hetzner-server-comparison)
