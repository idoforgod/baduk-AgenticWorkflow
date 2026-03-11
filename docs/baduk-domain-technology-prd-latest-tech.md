# Baduk Domain Technology PRD — Latest Tech First Perspective

**Version**: 1.0
**Date**: 2026-03-10
**Perspective**: Technology Innovation & Latest Trends Expert
**Research Context**: Research 3 of 3 — Baduk domain technology deep-dive
**Pre-conditions**: Balanced Scenario (MAU 8K, MRR $5K), Balanced-Tech Stack v1.0 (Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, Drizzle, Biome, Coolify+Hetzner)

---

## Executive Summary

This PRD defines the baduk domain technology architecture from a **cutting-edge technology maximization** standpoint. The core thesis: the AI baduk platform's competitive moat lies not in the board game itself — which has been refined for millennia — but in **three innovation layers**: (1) KataGo analysis engine integration with HumanSL rank-calibrated play, (2) LLM-powered natural language explanations that no competitor currently offers, and (3) a modern event-sourced game server architecture. Each technology choice below optimizes for innovation score, developer velocity under AI-agent workflow, and future extensibility.

The February 2026 MIT Technology Review article "AI is rewiring how the world's best Go players think" confirms the macro trend: AI has become inseparable from Go training. Over a third of moves by top professionals now replicate AI recommendations. Yet no platform currently offers natural language explanations of *why* these moves matter — that is the gap this product fills.

---

## 1. KataGo Integration

### Recommendation: Aggressive Branch with Phased GPU Upgrade

**Selected Approach**: Branch 1 (Aggressive) as the architecture, with Branch 2 (Conservative) cost discipline for Phase 1 deployment.

#### Technology Choices

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| KataGo Engine | Analysis Engine Mode (JSON stdin/stdout) | v1.16.2 (June 2025) | 3-5x faster than GTP, concurrent queries, structured output |
| Neural Network (Phase 1) | b18c384nbt | Latest kata1 | Best speed/strength balance on CPU; ~15 visits/sec |
| Neural Network (Phase 2) | b28c512nbt | s12614242560-d5766318893 | Strongest network, 200-300 Elo above b18; requires GPU |
| HumanSL Model | b18c384nbt-humanv0 | v1.15.0+ | Rank-calibrated play from beginner to mid-dan |
| Backend (Phase 1) | CPU Eigen | KataGo built-in | Zero GPU cost; sufficient for MAU 8K |
| Backend (Phase 2) | TensorRT | CUDA 12.8 + TRT 10.9.0 | 87-104x speedup over CPU on RTX-class GPUs |
| Job Queue | BullMQ | 5.70.x (March 2026) | Redis-backed, parent-child jobs, rate limiting, retries |
| Process Management | Node.js child_process.spawn() | Node.js 22 LTS | Line-buffered JSON IPC, crash recovery via process.on('exit') |

#### Architecture: Process Pool + Analysis Queue

```
Client Request → Next.js API Route → BullMQ Queue → KataGo Process Pool (2-4 processes)
                                         ↓                        ↓
                                    Redis (job state)     JSON stdin/stdout IPC
                                         ↓                        ↓
                                    Result stored → WebSocket push to client
```

**Visits Tuning Strategy** (cutting-edge adaptive approach):
- **Instant hint**: 5 visits (~0.3s on CPU) — touch-responsive UX
- **Quick analysis**: 50 visits (~3s on CPU) — post-move review
- **Deep review**: 500 visits (~30s on CPU) — full game analysis
- **Rank-calibrated play**: HumanSL model at 1 visit + full temperature — matches target rank behavior

**HumanSL Integration** — the key differentiator no competitor has shipped at scale:
- Configure KataGo with `humanSLProfile` parameter to predict moves at any rank level
- Use for "AI plays like a 5-kyu" feature: HumanSL predicts what a 5-kyu would play, then KataGo's main network evaluates the resulting position
- Mistake detection filter: among two "mistakes," flag only those that the HumanSL model predicts a moderately stronger player would consistently avoid
- Historical year prediction: analyze how a pro from 2010 vs 2025 would approach a position

#### Performance Benchmarks

| Metric | CPU (Eigen, b18) | GPU (TensorRT, b18) | GPU (TensorRT, b28) |
|--------|-------------------|---------------------|---------------------|
| Visits/sec | ~15 | ~1,300 (87x) | ~1,560 (104x) |
| Analyses/min (50 visits) | 18 | ~1,560 | ~1,872 |
| Latency (50 visits) | ~3.3s | ~0.04s | ~0.03s |
| Cost/query | ~$0.001 | ~$0.0001 | ~$0.0001 |

*GPU benchmarks based on RTX 5070 TensorRT measurements (2025).*

#### Real-World Case Studies

1. **KaTrain** (Python GUI, 10K+ users): Uses KataGo Analysis Engine (not GTP). Demonstrates the analysis engine protocol is production-proven. KaTrainGui class implements a message queue system for responsive UI with proper sequencing of operations. Our architecture mirrors this pattern in Node.js.

2. **ZBaduk** (Web platform, subscription-based): Runs KataGo + LeelaZero on NVIDIA GPU cloud servers. Charges EUR 4/month for AI analysis. Validates the subscription model for cloud-hosted analysis. Their limitation: no natural language explanations.

3. **BadukAI** (Mobile app, Android/iOS): Runs KataGo directly on mobile with CPU optimization. Supports rank-calibrated play, SGF import/export, and neural network selection. Demonstrates that even mobile CPU can run KataGo for individual analysis. Updated January 2026 with b18/b28 network support on high-end Mediatek devices.

4. **Web-KaTrain** (Browser-based, 2025): Runs KataGo analysis entirely in-browser using TensorFlow.js with WebGPU/WASM fallback. Uses React + Zustand for state management. Proves in-browser Go AI is technically feasible for future "zero-server-cost" tier.

5. **OGS (Online-Go.com)**: Open-source Go server using GTP wrapper (gtp2ogs) for bot integration. Our JSON Analysis Engine approach is fundamentally more capable than their GTP-based integration.

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| KataGo process crash | Medium | High | Watchdog + auto-restart (3s backoff), process pool redundancy |
| CPU capacity exceeded at MAU 8K | Low | Medium | BullMQ queue absorbs spikes; GPU upgrade trigger at 15s queue wait |
| b28 network too slow on CPU | Certain | Low | b18 for CPU phase; b28 reserved for GPU phase |
| TensorRT version incompatibility | Low | Medium | Pin CUDA 12.8 + TRT 10.9.0; test on exact Hetzner GPU SKU |

#### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Core Integration | 2 weeks | Single KataGo process, BullMQ queue, JSON IPC, basic analysis API |
| Phase 1.5: HumanSL | 1 week | Rank-calibrated play, adaptive visits |
| Phase 2: Process Pool | 1 week | 2-4 process pool, load balancing, crash recovery |
| Phase 3: GPU Migration | 2 weeks | TensorRT backend, b28 network, benchmarking |
| **Total** | **6 weeks** | |

#### Cost Estimate

| Item | Phase 1 (CPU) | Phase 2 (GPU) |
|------|---------------|---------------|
| Hetzner CCX33 (8 vCPU) | EUR 60/mo | — |
| Hetzner GEX44 (RTX 4000 SFF) | — | ~EUR 200/mo |
| BullMQ Pro (optional) | $0 (OSS) | $0 (OSS) |
| **Monthly Total** | **~$65/mo** | **~$220/mo** |

---

## 2. Go Rules Engine

### Recommendation: Evolutionary Branch with Cutting-Edge Optimizations

**Selected Approach**: Branch 3 (Evolutionary) — build incrementally, starting with Tromp-Taylor + Chinese scoring. Branch 4's comprehensive specification serves as the roadmap for Phase 2+.

#### Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Rules Foundation | Tromp-Taylor | 10 sentences, mathematically complete, unambiguous for AI agents |
| Scoring (Phase 1) | Chinese (area) only | No dead stone agreement needed; simplest implementation |
| Scoring (Phase 2) | Japanese (territory) | Requires dead stone marking UI; add after MVP |
| Board Representation | 1D Uint8Array (19*19=361) | Cache-friendly, O(1) access, minimal GC pressure |
| Position Hashing | Zobrist hashing (64-bit XOR) | O(1) incremental update per move; superko detection |
| Language | TypeScript (strict mode) | Type safety, shared with frontend, AI agent productivity |
| Test Framework | Vitest | Fast, ESM-native, compatible with project stack |

#### Core Engine Design (Cutting-Edge Minimalism)

```typescript
// 200-400 lines core — pure functions, zero side effects
type Color = 0 | 1 | 2; // Empty | Black | White
type Board = Uint8Array; // 361 elements for 19x19
type Position = number; // 0-360, row * 19 + col

interface GameState {
  board: Board;           // Immutable — every move creates new state
  zobristHash: bigint;    // 64-bit incremental hash
  hashHistory: Set<bigint>; // For superko detection (Tromp-Taylor)
  koPoint: number | -1;   // Simple ko shortcut
  captures: [number, number]; // [blackCaptures, whiteCaptures]
  moveNumber: number;
  toPlay: Color;
}

// Pure function: state + move → new state (or error)
function applyMove(state: GameState, position: Position): GameState | Error;
function getScore(state: GameState, komi: number): { black: number; white: number };
```

**Zobrist Hashing Implementation**:
- Pre-compute table: 361 positions x 2 colors = 722 random 64-bit BigInts
- On stone placement: XOR in new stone's hash
- On capture: XOR out captured stones' hashes
- Superko check: O(1) lookup in Set<bigint>
- Collision probability with 64-bit hashes: negligible (<10^-19 per game)

#### Evolutionary Build Phases

| Phase | Duration | Feature | Lines (est.) |
|-------|----------|---------|--------------|
| E1 | 3 days | Board + stone placement + liberty counting | ~100 |
| E2 | 3 days | Capture logic + simple ko | ~80 |
| E3 | 2 days | Zobrist hashing + superko (Tromp-Taylor) | ~60 |
| E4 | 3 days | Chinese scoring (area counting) | ~80 |
| E5 | 3 days | SGF import/export (using @sabaki/sgf as reference) | ~100 |
| **MVP Total** | **2 weeks** | **Complete Tromp-Taylor engine** | **~420** |
| E6 (Phase 2) | 2 weeks | Japanese scoring + dead stone agreement | ~300 |
| E7 (Phase 2) | 1 week | AGA/Korean ruleset overlays | ~200 |

#### Real-World Case Studies

1. **Tromp-Taylor as Industry Standard**: Created by John Tromp and Bill Taylor in 1996, these rules are described as "by far the simplest, most elegant, most easily worded, and most easily umpired of the main rule sets." KataGo itself uses Tromp-Taylor as its mathematical base with per-ruleset scoring overlays on top.

2. **Tenuki** (JavaScript Go library): A web-based board and JavaScript library with a standalone engine representing board, game, and rules independent of the renderer. Demonstrates that a JS/TS Go rules engine is viable for production web apps.

3. **KataGo's 3-class Architecture** (Board, BoardHistory, Rules): The gold standard implementation. Our TypeScript engine mirrors this separation — GameState (Board), moveHistory array (BoardHistory), and ruleset configuration (Rules).

4. **sgf-ts** (TypeScript SGF parser): A dedicated TypeScript library for parsing and manipulating SGF files. Integrates directly with our TypeScript engine for game record import/export.

5. **GoVariantsEngine** (Node/ES6): An existing Node.js implementation of Go rules including liberty counting and removing stones. Validates that the JavaScript ecosystem can handle Go rules logic.

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Edge case bugs (ko, seki) | Medium | High | Comprehensive test suite; KataGo as oracle for validation |
| Japanese scoring complexity | High | Medium | Defer to Phase 2; Chinese scoring covers 80%+ of online play |
| Performance on large boards | Low | Low | Uint8Array + Zobrist = microsecond-level operations |
| SGF compatibility issues | Medium | Low | Use @sabaki/sgf as proven reference implementation |

#### Cost Estimate

Pure development cost (no runtime infrastructure). AI agent implementation confidence: **95%** — pure logic, highly testable, no external dependencies.

---

## 3. LLM Explanation Pipeline

### Recommendation: Rapid V1 Templates + Robust V2 LLM with 4-Layer Validation

**Selected Approach**: Branch 5 (Rapid) for speed-to-market with template V1, then Branch 6 (Robust) for the full LLM pipeline with mandatory validation. This is the **#1 innovation differentiator** — no competitor currently offers natural language Go explanations.

#### Technology Choices

| Component | Choice | Version/Model | Rationale |
|-----------|--------|---------------|-----------|
| Template Engine (V1) | Pattern matching on KataGo data | Custom TypeScript | 60% of value for 10% of cost |
| LLM (80% of queries) | Claude Haiku 4.5 | Latest | $1/$5 per M tokens; approaches Sonnet quality |
| LLM (15% complex) | Claude Sonnet 4.5 | Latest | $3/$15 per M tokens; 1M context window |
| LLM (5% fallback) | Template system | N/A | Mandatory for high-risk positions |
| Cost Optimization | Prompt caching + Batch API | Anthropic API | 90% cache read discount + 50% batch discount |
| Validation | 4-layer pipeline | Custom | Data anchoring → Constrained generation → Output validation → Spot-check |
| Golden Dataset | 200 expert-verified positions | Custom | 3-5 dan-level reviewers; ground truth corpus |

#### The Core Principle: LLM = Translator, NOT Analyst

Research conclusively shows that LLMs have **zero Go understanding**. GPT-4 becomes "hopelessly lost" on a standard 19x19 board within a few moves. LLMs produce fluent natural language but hallucinate or mis-evaluate Go positions. Therefore:

- **KataGo is the ONLY truth source** — win rate, score lead, best moves, ownership, policy
- **Claude is the translator** — converts KataGo's JSON data into human-readable explanations
- **Templates are the safety net** — for positions where LLM hallucination risk is highest

#### 3-Tier Explanation Levels

```
Beginner (< 15 kyu):
  "This move protects your group of stones on the right side.
   Without it, your opponent could capture 5 stones."

Intermediate (15 kyu - 3 dan):
  "The attachment at R14 reduces White's potential territory
   on the right side by approximately 8 points. KataGo shows
   this is the best move with a 62% win rate."

Advanced (3 dan+):
  "The shoulder hit at C10 creates aji in White's framework.
   KataGo's policy gives this move 34% weight. The key follow-up
   sequence is C10-D11-C12-D13, after which Black's win rate
   improves from 45% to 52%. Notice the ownership shift in the
   upper-left quadrant."
```

#### 4-Layer Validation Pipeline (Cutting-Edge Safety)

```
Layer 1: DATA ANCHORING
  Extract all facts from KataGo JSON:
  - Win rate (e.g., 62.3%)
  - Score lead (e.g., B+3.5)
  - Best moves with visit counts
  - Ownership map (territory control)
  - Policy distribution (move probabilities)

Layer 2: CONSTRAINED GENERATION
  System prompt with strict boundaries:
  - "You are translating KataGo analysis data into natural language."
  - "NEVER infer Go strategy beyond what the data shows."
  - "ALWAYS cite specific numbers from the analysis."
  - Few-shot examples from golden dataset

Layer 3: OUTPUT VALIDATION
  Automated checks:
  - Win rate mentioned matches KataGo data (±1%)
  - Coordinates mentioned exist on the board
  - No contradictions with KataGo's evaluation
  - Move sequences referenced are legal
  - Sentiment matches win rate direction

Layer 4: SPOT-CHECK
  - Random 5% human review by dan-level players
  - Flag patterns of systematic errors
  - Update golden dataset with corrections
  - Continuous model quality monitoring
```

#### Prompt Engineering Design

```
SYSTEM PROMPT (cached — 90% discount on repeated calls):
  [Go domain knowledge: ~2000 tokens]
  [Explanation level definitions: ~500 tokens]
  [Few-shot examples from golden dataset: ~3000 tokens]
  [Output format specification: ~500 tokens]
  Total: ~6000 tokens cached

USER PROMPT (per-query):
  [KataGo JSON analysis: ~800 tokens]
  [Board position context: ~200 tokens]
  [User level + preferences: ~100 tokens]
  Total: ~1100 tokens per query

OUTPUT:
  [Natural language explanation: ~200-500 tokens]
```

**Cost Calculation with Prompt Caching**:
- System prompt (6000 tokens): cached at 90% discount = $0.0006 per read
- User prompt (1100 tokens): $0.0011 per query (Haiku)
- Output (400 tokens): $0.002 per query (Haiku)
- **Per-query cost (Haiku, cached): ~$0.004**
- At MAU 8K, ~20 queries/user/month = 160K queries/month
- **Monthly LLM cost: ~$640** (vs $1,200-2,200 without caching)

#### Real-World Case Studies

1. **MIT Technology Review (Feb 2026)**: "AI is rewiring how the world's best Go players think" — confirms that professional players train by replicating AI moves, but the thinking behind these moves remains mysterious. Our LLM explanation pipeline directly addresses this gap.

2. **LLM Chess Commentary Research (2025)**: Studies show that expert game-playing models make strong decisions but cannot explain them, while LLMs produce fluent commentary but hallucinate. This validates our "KataGo = analyst, LLM = translator" architecture.

3. **ZBaduk/KaTrain**: Both show KataGo analysis data (win rate graphs, territory maps, best moves) but provide zero natural language explanation. Users must interpret raw data themselves. Our LLM pipeline eliminates this interpretation burden.

4. **Claude Haiku 4.5 Benchmarks (2026)**: Achieves 73.3% on SWE-bench Verified — within 5 percentage points of Sonnet 4.5 at one-third the cost. For our constrained translation task (not open-ended reasoning), Haiku 4.5's capabilities are more than sufficient for 80% of queries.

5. **Anthropic Prompt Caching (2026)**: Automatic prompt caching reduces costs by up to 90% for repeated system prompts. Our architecture's fixed system prompt (domain knowledge + few-shot examples) is perfectly designed to exploit this — the 6000-token system prompt is cached across all user queries.

#### High-Risk Position Handling

| Position Type | LLM Risk | Strategy |
|---------------|----------|----------|
| Opening (fuseki) | Low | LLM explanation with standard validation |
| Middle game (chuban) | Medium | LLM with enhanced validation checks |
| Life & death (tsumego) | **High** | **Mandatory template fallback** |
| Ko fights | **High** | **Mandatory template fallback** |
| Seki | **High** | **Mandatory template fallback** |
| Endgame (yose) | Low-Medium | LLM with point-counting validation |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM hallucination on move sequences | High | Critical | 4-layer validation; template fallback for high-risk |
| Cost overrun at scale | Medium | Medium | Prompt caching (90%), Batch API (50%), Haiku for 80% |
| Claude API downtime | Low | High | Template fallback for 100% availability |
| Golden dataset insufficient | Medium | Medium | Start with 200 positions; expand based on Layer 4 spot-checks |
| User trust erosion from bad explanation | Medium | High | Confidence indicator; "AI-generated" label; feedback button |

#### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| V1 Templates | 10 days | Pattern matching on KataGo data → pre-written explanations |
| V2 LLM Core | 15 days | Claude Haiku integration, 3-tier levels, prompt engineering |
| V2 Validation | 10 days | 4-layer pipeline, automated checks, golden dataset |
| V2 Optimization | 5 days | Prompt caching, Batch API, cost monitoring |
| **Total** | **8 weeks** | |

#### Cost Estimate

| Item | Monthly Cost |
|------|-------------|
| Claude Haiku 4.5 (80% of 160K queries) | ~$510 |
| Claude Sonnet 4.5 (15% of 160K queries) | ~$240 |
| Template fallback (5%) | $0 |
| Prompt caching savings | -$320 |
| **Net Monthly LLM Cost** | **~$430** |

---

## 4. Real-time Game Server

### Recommendation: Event-Sourced Architecture with Debt-Minimized Core

**Selected Approach**: Branch 7 (Debt Minimized) for the architecture — event sourcing IS the natural shape of Go. Incorporate Branch 8's practical timeline by cutting non-essential features for MVP while preserving architectural integrity.

#### Technology Choices

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| WebSocket Server | ws | Latest (npm) | 25K+ connections per process; blazing fast; thoroughly tested |
| Game State Pattern | Event Sourcing + CQRS | Custom | SGF is a natural event log; perfect domain fit |
| Job Queue | BullMQ | 5.70.x | KataGo analysis decoupled from game loop |
| State Management | Immutable GameState | TypeScript | Every move = new state; perfect for replay/review |
| Time Control | Byoyomi (Phase 1) | Custom module | Most common in Asian Go servers |
| Matchmaking | ELO range ±200 | Custom | Expand range after 30s wait; simple and effective |
| Multi-process (Phase 2) | Redis Pub/Sub | Redis 7.2 | Already in tech stack; natural scaling path |
| Framework Reference | Colyseus patterns | 0.15.x | Room-based architecture concepts; but custom implementation preferred |

#### Event-Sourced Architecture

```
Game Event Log (= SGF equivalent):
┌─────────────────────────────────────────────┐
│ Event 1: { type: "move", player: "B",       │
│            coord: [3, 15], time: 1709...}   │
│ Event 2: { type: "move", player: "W",       │
│            coord: [15, 3], time: 1709...}   │
│ ...                                          │
│ Event N: { type: "resign", player: "W" }    │
└─────────────────────────────────────────────┘
          ↓ replay ↓              ↓ project ↓
     Full Game Review        Current Board State
     (any point in time)     (CQRS read model)
```

**Why Event Sourcing is NOT over-engineering for Go**:
- SGF (Smart Game Format) IS an event log — every Go game is already stored this way
- Move-by-move replay is a core feature, not an edge case
- AI analysis needs the full move sequence — event log provides this natively
- Undo/redo in teaching mode = replaying events to a specific point
- Branch variations (common in Go review) = forking the event stream

#### Server-Authoritative Protocol

```typescript
// Client → Server (simple JSON over WebSocket)
{ type: "move", data: { x: 3, y: 15 } }
{ type: "pass" }
{ type: "resign" }
{ type: "requestUndo" }

// Server → Client (authoritative state updates)
{ type: "moveAccepted", data: { x: 3, y: 15, captures: [...], moveNumber: 42 } }
{ type: "moveRejected", data: { reason: "occupied" } }
{ type: "gameState", data: { board: [...], toPlay: "W", timeRemaining: {...} } }
{ type: "analysisResult", data: { winRate: 0.623, bestMoves: [...] } }
```

**Key design**: All move validation happens on the server. The client is a view-only renderer. This prevents cheating and ensures consistency.

#### Capacity Planning

| Metric | Single Process | With Redis Pub/Sub |
|--------|---------------|-------------------|
| WebSocket connections | 25K-50K | 100K+ |
| Concurrent games | 2K-3K | 10K+ |
| Message frequency | ~1 msg/30s per game | Same |
| Memory per connection | ~2KB | ~2KB + Redis overhead |
| CPU utilization | <5% at MAU 8K | <2% per process |

**Why MAU 8K is trivially easy**: Go is an inherently low-frequency game. At 1 message per 30 seconds per player, even 1000 concurrent games produce only ~67 messages/second — well within a single Node.js process.

#### Real-World Case Studies

1. **Colyseus Framework** (Node.js, 10K+ CCU): Room-based architecture with built-in matchmaking, state synchronization, and scaling via Redis. Demonstrates that Node.js handles multiplayer game servers well. Our custom implementation borrows room lifecycle patterns (onCreate, onJoin, onLeave, onDispose) but avoids framework lock-in.

2. **OGS (Online-Go.com)**: Open-source Go server with thousands of concurrent players. Uses WebSocket for real-time communication and Python backend. Their architecture proves Go's low message frequency makes server scaling straightforward. Our Node.js implementation will outperform their Python backend for WebSocket handling.

3. **ws Library Benchmarks (2025)**: Handles 25,000 connections batched at 75/second with 30,000-35,000 completed roundtrips. Latency ranges 680-750ms at this load. For our MAU 8K scenario, this is 3-4x headroom.

4. **Event Sourcing in Games (Microsoft Azure Architecture)**: Microsoft's architecture patterns documentation explicitly recommends event sourcing for game state management. The pattern provides audit logging, temporal queries, and state reconstruction — all core requirements for Go game review.

5. **KGS Go Server**: Java-based server running since 2000. Demonstrates Go server longevity requirements — our event-sourced architecture with PostgreSQL persistence ensures decade-scale data durability.

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebSocket disconnection mid-game | High | High | Reconnection with state replay from event log |
| Clock synchronization | Medium | Medium | Server-authoritative time; NTP sync; client display only |
| Memory leak from long games | Low | Medium | Immutable state + GC; event log persisted to PG |
| Scaling beyond single process | Low (at MAU 8K) | Low | Redis Pub/Sub ready; horizontal scaling path documented |

#### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Core Engine | 1 week | Game room, event sourcing, move validation |
| WebSocket Server | 1 week | ws integration, JSON protocol, auth |
| Time Control | 3 days | Byoyomi implementation |
| Matchmaking | 3 days | ELO-based matching, queue management |
| KataGo Bridge | 3 days | BullMQ integration for analysis requests |
| Reconnection | 2 days | State replay on reconnect |
| **Total** | **4 weeks** | |

#### Cost Estimate

Pure development cost. Runtime infrastructure already covered by Hetzner CCX33 (EUR 60/mo) from the base tech stack — the game server shares the same server.

---

## 5. Baduk UI/UX

### Recommendation: Modern Branch with Classical Board Aesthetics

**Selected Approach**: Branch 9 (Modern) for the component architecture and interaction design, with Branch 10 (Classical) for the board rendering philosophy — "Don't innovate on the board; innovate on what surrounds it."

#### Technology Choices

| Component | Choice | Version | Rationale |
|-----------|--------|---------|-----------|
| Board Renderer | SVG (React JSX) | Native | DOM events, accessibility, React integration |
| Base Component | Shudan fork | 1.7.1 base | 60% of board UI for free; MIT license; React compatible |
| State Management | Zustand | Latest (2026) | 2.7KB gzipped; hook-first; no boilerplate; #1 satisfaction |
| Charts (Win Rate) | Recharts | 3.8.0 (March 2026) | D3-based, React-native, 3.6M weekly downloads |
| Touch Gestures | @use-gesture | Latest | Pinch zoom, pan, drag; usePinch + useDrag hooks |
| Animations | CSS transitions | Native | Go players prefer clean, static boards |
| Design System | Tailwind CSS | v4 | Already in tech stack (Next.js 15) |

#### SVG as the Optimal Choice for Go Boards

The decision is clear from both research branches: **SVG wins for Go boards**.

- Go board = ~400 elements maximum (361 intersections + stones + markup)
- SVG performance is excellent up to a few thousand elements
- Native DOM event handling (click, hover) — no custom hit detection needed
- React JSX integration — stones are React components
- Accessibility built-in — screen readers can navigate elements
- CSS styling — hover effects, transitions via standard CSS
- Canvas would require custom event handling for zero performance benefit at this scale

#### Component Architecture (~25 components)

```
GobanContainer
├── Board (SVG root)
│   ├── Grid (lines + star points)
│   ├── Coordinates (A-T, 1-19)
│   ├── StoneLayer
│   │   ├── Stone (black/white/ghost preview)
│   │   └── MoveNumber (optional overlay)
│   ├── MarkupLayer
│   │   ├── TerritoryMarker (semi-transparent)
│   │   ├── MoveQualityIndicator (KaTrain color scheme)
│   │   └── OwnershipHeatmap (KataGo data)
│   └── InteractionLayer
│       ├── GhostStone (hover/touch preview)
│       └── TouchTarget (enlarged for mobile)
├── AnalysisPanel
│   ├── WinRateChart (Recharts)
│   ├── ScoreGraph (Recharts)
│   ├── BestMovesDisplay
│   └── AIExplanation (LLM output)
├── MoveTree (variation navigator)
├── PlayerInfo (name, rank, time, captures)
├── GameControls (pass, resign, undo, settings)
└── ChatPanel (optional)
```

#### Mobile-First Innovation: Tap-Preview-Confirm

The critical UX challenge: placing stones accurately on a 19x19 grid on mobile.

```
Step 1: TAP — User taps near an intersection
  → Ghost stone appears at nearest intersection
  → Magnified view of surrounding area shown

Step 2: PREVIEW — User sees the ghost stone position
  → Can drag to adjust if wrong intersection
  → Shows immediate KataGo evaluation (5-visit instant hint)

Step 3: CONFIRM — User taps the confirm button (or double-taps)
  → Move is sent to server
  → Full analysis triggered in background
```

**Pinch-zoom + pan** via @use-gesture: Users can zoom into any board region, essential for 19x19 on small screens.

#### Move Quality Color Scheme (KaTrain Standard)

| Color | Meaning | Win Rate Change |
|-------|---------|-----------------|
| Green | Excellent move | < 1 point loss |
| Blue | Good move | 1-3 points loss |
| Yellow | Inaccuracy | 3-5 points loss |
| Orange | Mistake | 5-10 points loss |
| Red | Blunder | > 10 points loss |

This scheme is already familiar to KaTrain users (~10K+) and has become a de facto standard.

#### Responsive Layout

```
Desktop (>1024px):
┌──────────────────────────────────────────┐
│  Board (60%)          │ Analysis (40%)   │
│  ┌───────────────┐    │ Win Rate Chart   │
│  │               │    │ Best Moves       │
│  │   Go Board    │    │ AI Explanation   │
│  │               │    │                  │
│  └───────────────┘    │ Move Tree        │
│  Player Info          │ Chat             │
└──────────────────────────────────────────┘

Mobile (<768px):
┌──────────────────┐
│   Player Info    │
│ ┌──────────────┐ │
│ │              │ │
│ │   Go Board   │ │
│ │ (full width) │ │
│ └──────────────┘ │
│ Game Controls    │
│ Win Rate Chart   │
│ AI Explanation   │
│ (scrollable)     │
└──────────────────┘
```

#### Real-World Case Studies

1. **Shudan** (SabakiHQ, MIT license): The Goban component powering Sabaki. Uses `<div>`, `<span>`, `<svg>`, `<rect>`, `<circle>` with `shudan-` prefixed class names. Written for Preact but fully compatible with React. Version 1.7.1 provides the proven board rendering foundation.

2. **Sabaki** (Electron desktop app): "An elegant Go board and SGF editor for a more civilized age." The most polished open-source Go UI, demonstrating that SVG-based rendering produces professional results. Our web implementation inherits its visual quality through the Shudan fork.

3. **Zustand in 2025-2026**: Ranked #1 in developer satisfaction for React state management. Weighs only 2.7KB gzipped. The subscription model prevents unnecessary re-renders. Teams commonly use Zustand + TanStack Query together — our architecture follows this pattern (Zustand for game state, TanStack Query for server data).

4. **Recharts 3.8.0 (March 2026)**: Over 3.6 million weekly downloads. Uses lightweight D3 submodules instead of the full D3 library. The modular component design makes it ideal for our win rate chart and score graph components.

5. **Felt's SVG-to-Canvas Migration (2025)**: Felt switched from SVG to Canvas when rendering thousands of map elements because React had to manage many thousands of SVGs. This validates our SVG choice — Go boards have ~400 elements maximum, well within SVG's comfortable range.

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Shudan fork maintenance burden | Medium | Medium | Fork only the CSS/rendering; custom React wrapper |
| Mobile touch accuracy on 19x19 | High | High | Tap-Preview-Confirm 2-step; pinch-zoom essential |
| Win rate chart performance | Low | Low | Recharts handles this scale trivially |
| Dark mode implementation | Low | Low | CSS custom properties; theme toggle in Zustand store |
| Accessibility compliance | Medium | Medium | SVG's native aria support; keyboard navigation |

#### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Board Component (Shudan fork) | 1.5 weeks | SVG board, stones, grid, coordinates |
| Interaction Layer | 1 week | Tap-Preview-Confirm, pinch-zoom, ghost stones |
| Analysis Overlay | 1 week | Move quality colors, ownership heatmap |
| Win Rate Chart | 3 days | Recharts integration, responsive |
| AI Explanation Panel | 1 week | LLM output display, 3-tier level UI |
| Mobile Optimization | 1 week | Touch targets, responsive layout |
| Dark Mode + Polish | 3 days | CSS custom properties, animations |
| **Total** | **6 weeks** | |

#### Cost Estimate

Pure development cost. All libraries are open-source ($0 runtime cost).

---

## Complete Technology Recommendation Table

| Area | Primary Technology | Version | Innovation Approach | Phase |
|------|-------------------|---------|--------------------|----|
| **KataGo Engine** | Analysis Engine (JSON) | v1.16.2 | HumanSL rank-calibrated play | 1 |
| **KataGo Network** | b18c384nbt (CPU) → b28c512nbt (GPU) | Latest kata1 | Adaptive visits (5/50/500) | 1→2 |
| **KataGo Backend** | CPU Eigen → TensorRT | CUDA 12.8 / TRT 10.9.0 | 87-104x GPU speedup | 1→2 |
| **Job Queue** | BullMQ | 5.70.x | Parent-child jobs, flow control | 1 |
| **Rules Engine** | Custom TypeScript (Tromp-Taylor) | N/A | 1D Uint8Array + Zobrist O(1) | 1 |
| **Scoring** | Chinese area → +Japanese territory | N/A | Evolutionary expansion | 1→2 |
| **LLM (primary)** | Claude Haiku 4.5 | Latest | Prompt caching (90% savings) | 1 |
| **LLM (complex)** | Claude Sonnet 4.5 | Latest | 1M context, extended thinking | 1 |
| **LLM Validation** | 4-layer pipeline | Custom | Data anchoring + automated checks | 1 |
| **LLM Fallback** | Template system | Custom | Pattern matching on KataGo data | 1 |
| **WebSocket** | ws | Latest | 25K+ connections per process | 1 |
| **Game Architecture** | Event Sourcing + CQRS | Custom | SGF-native event log | 1 |
| **Board Rendering** | SVG (React JSX) | Native | Shudan fork + custom wrapper | 1 |
| **State (client)** | Zustand | Latest | 2.7KB, hook-first, #1 satisfaction | 1 |
| **Charts** | Recharts | 3.8.0 | D3-based, 3.6M weekly downloads | 1 |
| **Touch** | @use-gesture | Latest | Pinch zoom + Tap-Preview-Confirm | 1 |
| **SGF Parser** | @sabaki/sgf (reference) | Latest | Proven implementation | 1 |

---

## Total Development Timeline

| Area | Duration | Dependencies |
|------|----------|-------------|
| Go Rules Engine | 2 weeks | None (start first) |
| KataGo Integration | 4 weeks (Phase 1) | Rules Engine (for move validation) |
| Game Server | 4 weeks | Rules Engine + KataGo |
| Baduk UI/UX | 6 weeks | Game Server (for real-time play) |
| LLM Explanation Pipeline | 8 weeks | KataGo (for analysis data) |

**Critical Path**: Rules Engine (2w) → KataGo Integration (4w) → Game Server (4w) → UI/UX (6w)

**With Parallelization** (AI agents can work concurrently):
```
Week 1-2:   Rules Engine ████████████
Week 1-4:   KataGo Integration ████████████████████████
Week 3-6:   Game Server         ████████████████████████
Week 3-8:   UI/UX               ████████████████████████████████████
Week 2-10:  LLM Pipeline  ████████████████████████████████████████████████
            ──────────────────────────────────────────────────────
            Total: ~10-12 weeks with parallel AI agent execution
```

---

## Total Cost Estimate

### Development Phase (One-time)

| Item | Cost |
|------|------|
| AI agent compute (Claude Code) | ~$500-800 (12 weeks, heavy usage) |
| KataGo testing infrastructure | $0 (open-source, local testing) |
| Golden dataset creation (200 positions, dan-level review) | $500-1,000 (contractor) |
| **Development Total** | **~$1,000-1,800** |

### Monthly Operations (Steady State, MAU 8K)

| Item | Monthly Cost |
|------|-------------|
| Hetzner CCX33 (CPU, app + KataGo Phase 1) | $65 |
| LLM API (Claude Haiku 4.5 + Sonnet 4.5, with caching) | $430 |
| Redis (included in Hetzner) | $0 |
| Domain + CDN | ~$20 |
| **Phase 1 Monthly Total** | **~$515/mo** |

| Item | Monthly Cost |
|------|-------------|
| Hetzner GEX44 (GPU, KataGo Phase 2) | $220 |
| LLM API (scaled) | $430 |
| Hetzner CCX33 (app server) | $65 |
| **Phase 2 Monthly Total** | **~$715/mo** |

---

## Risk Register (Top 5)

| # | Risk | Category | Likelihood | Impact | Score | Mitigation | Owner |
|---|------|----------|-----------|--------|-------|------------|-------|
| R1 | LLM hallucination produces incorrect Go advice | Quality | High | Critical | **9/10** | 4-layer validation pipeline + template fallback for high-risk positions + golden dataset + user feedback loop | LLM Pipeline |
| R2 | KataGo process crashes under load | Reliability | Medium | High | **7/10** | Process pool (2-4), watchdog auto-restart with 3s backoff, BullMQ queue absorbs spikes | KataGo Integration |
| R3 | Mobile touch accuracy on 19x19 board | UX | High | High | **7/10** | Tap-Preview-Confirm 2-step placement, pinch-zoom, enlarged touch targets, ghost stone preview | UI/UX |
| R4 | LLM API costs exceed budget at scale | Cost | Medium | Medium | **5/10** | Prompt caching (90% discount), Batch API (50% discount), Haiku for 80% of queries, template fallback | LLM Pipeline |
| R5 | Japanese scoring implementation complexity | Schedule | Medium | Medium | **5/10** | Defer to Phase 2; Chinese scoring covers 80%+ of online play; KataGo provides dead stone detection as fallback | Rules Engine |

---

## Innovation Score

| Area | Innovation Score (1-10) | Justification |
|------|------------------------|---------------|
| **KataGo Integration** | **8/10** | HumanSL rank-calibrated play is cutting-edge (introduced v1.15.0, 2024). Adaptive visits tuning and Analysis Engine JSON protocol are best-in-class. Phase 2 TensorRT path provides 87-104x speedup. Deducted 2 points: KataGo integration itself is established technology. |
| **Go Rules Engine** | **6/10** | Tromp-Taylor + Zobrist hashing is proven and optimal, not novel. 1D Uint8Array is a known optimization. Evolutionary approach matches AI agent development perfectly. Deducted 4 points: this is a well-solved problem; innovation comes from execution speed, not technology. |
| **LLM Explanation Pipeline** | **10/10** | **No competitor currently offers natural language Go explanations.** The 4-layer validation pipeline (data anchoring → constrained generation → output validation → spot-check) is a novel architecture for game commentary. Prompt caching optimization is cutting-edge (2026). This is the primary competitive moat. |
| **Real-time Game Server** | **7/10** | Event sourcing is a perfect domain fit (SGF IS an event log), but the pattern itself is established. Server-authoritative WebSocket protocol with BullMQ decoupling is best practice. Deducted 3 points: no novel technology, but excellent architectural choices for the domain. |
| **Baduk UI/UX** | **7/10** | SVG with React + Zustand + Recharts is modern best practice. Tap-Preview-Confirm mobile interaction is innovative for Go. KaTrain color scheme standardization is smart. Shudan fork saves 60% of UI development. Deducted 3 points: Go board UI is mature; innovation is in the AI overlay and mobile experience. |

**Overall Innovation Score: 7.6/10** — The platform's innovation is concentrated in the LLM explanation pipeline (10/10), which represents the primary competitive differentiator. The remaining areas use cutting-edge versions of proven technologies, optimized for the specific constraints of AI-agent development and the Go domain.

---

## Sources

- [KataGo GitHub Repository](https://github.com/lightvector/KataGo)
- [KataGo Releases](https://github.com/lightvector/katago/releases)
- [KataGo Analysis Engine Documentation](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [KataGo HumanSL Release (v1.15.0)](https://github.com/lightvector/KataGo/releases/tag/v1.15.0)
- [KataGo Distributed Training Networks](https://katagotraining.org/networks/)
- [KataGo Extra Networks (HumanSL)](https://katagotraining.org/extra_networks/)
- [RTX 5070 KataGo Benchmark](https://songyp.com/blog/katago-workstation-build-and-bench)
- [KataGo Hardware Speed Comparison](https://forums.online-go.com/t/katago-speeds-of-different-hardwares/48463)
- [AI is rewiring how the world's best Go players think — MIT Technology Review (Feb 2026)](https://www.technologyreview.com/2026/02/27/1133624/ai-is-rewiring-how-the-worlds-best-go-players-think/)
- [LLMs Playing and Commentating on Go: Current State (2025)](https://www.adarie.com/articles/8/)
- [Tromp-Taylor Concise Rules of Go](https://tromp.github.io/go.html)
- [Zobrist Hashing — Wikipedia](https://en.wikipedia.org/wiki/Zobrist_hashing)
- [Shudan Goban Component](https://github.com/SabakiHQ/Shudan)
- [Sabaki SGF Editor](https://github.com/SabakiHQ/Sabaki)
- [sgf-ts TypeScript SGF Parser](https://github.com/tkrajina/sgf-ts)
- [Web-KaTrain Browser-based Analysis](https://github.com/Sir-Teo/web-katrain)
- [KaTrain GitHub](https://github.com/sanderland/katrain)
- [ZBaduk AI Review Platform](https://zbaduk.com/)
- [BadukAI Mobile App](https://aki65.github.io/)
- [Online-Go.com Source Code](https://github.com/online-go/online-go.com)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Colyseus Multiplayer Framework](https://colyseus.io/)
- [ws WebSocket Library](https://github.com/websockets/ws)
- [Zustand State Management](https://github.com/pmndrs/zustand)
- [Recharts Chart Library](https://github.com/recharts/recharts)
- [@use-gesture Documentation](https://use-gesture.netlify.app/docs/gestures/)
- [Claude API Pricing (2026)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Haiku 4.5 vs 3.5 Comparison](https://www.burnwise.io/ai-pricing/compare/claude-haiku-4-5-vs-claude-haiku-3-5)
- [Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Hetzner GPU Servers (GEX44)](https://www.hetzner.com/dedicated-rootserver/gex44/)
- [Hetzner GPU Server GEX131](https://www.hetzner.com/dedicated-rootserver/gex131/)
- [Event Sourcing Pattern — Microsoft Azure Architecture](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [SVG vs Canvas vs WebGL Benchmark (2025)](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [Felt SVG to Canvas Migration](https://www.felt.com/blog/from-svg-to-canvas-part-1-making-felt-faster)
- [State of React 2025: State Management](https://2025.stateofreact.com/en-US/libraries/state-management/)
