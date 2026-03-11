# Baduk Domain Technology PRD — Cutting Edge Scenario

**Version**: 1.0
**Date**: 2026-03-10
**Perspective**: Cutting-Edge Technology Leader — "Innovation where it matters, proven where it's boring"
**Research Context**: Research 3 of 3 — Synthesis scenario across all 4 perspectives
**Pre-conditions**: Balanced Scenario (MAU 8K, MRR $5K), Tech Stack v1.0 (Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, Drizzle, Biome, Coolify+Hetzner)
**Builder**: AI Agents (Claude Code)

---

## Executive Summary

This document defines the **Cutting Edge** composite scenario for the 5 baduk domain technology areas. It is not a reckless "everything latest" approach — it is a *surgical innovation strategy* that concentrates risk-taking where competitive advantage is greatest, and defers to proven technology where innovation yields no user-visible benefit.

The thesis: **three areas justify cutting-edge investment** (KataGo with HumanSL + GPU, LLM pipeline with adaptive thinking + 4-layer validation, and event-sourced game server), while **two areas should use proven approaches with modern patterns** (rules engine and UI/UX). This asymmetric risk profile maximizes the innovation-to-risk ratio.

The February 2026 MIT Technology Review article "AI is rewiring how the world's best Go players think" confirms professional players now replicate AI moves >37% of the time — but no platform explains *why*. This gap is our primary competitive moat, and the Cutting Edge scenario is designed to exploit it with maximum technology leverage.

**Overall Innovation Score: 8.4/10** (vs Latest-Tech 7.6, Stability 5.8, Speed 5.2)

---

## Philosophy: Innovation Asymmetry

Not all 5 domain areas deserve equal innovation investment. The right question is not "what is the most cutting-edge choice?" but "where does cutting-edge create competitive advantage a user can feel?"

```
Innovation Investment Distribution:

  LLM Pipeline    ████████████████████████████████████████  ← MAXIMUM (moat)
  KataGo          ██████████████████████████████████        ← HIGH (differentiator)
  Game Server     ████████████████████████                  ← MODERATE (architectural)
  Rules Engine    ████████████                              ← LOW (solved problem)
  UI/UX           ████████████████                          ← MODERATE (mobile UX)
```

**Cutting Edge ≠ Reckless.** Every cutting-edge choice must pass three gates:
1. **Competitive advantage gate**: Does this create something users cannot get elsewhere?
2. **Technical readiness gate**: Is the technology production-ready (not alpha/experimental)?
3. **Recovery gate**: If this fails, can we fall back without rebuilding from scratch?

---

## 1. KataGo Integration — Aggressive with GPU-First Architecture

### Innovation Score: 9/10

### Technology Choices

| Component | Choice | Version | Cutting Edge Element |
|-----------|--------|---------|---------------------|
| KataGo Engine | Analysis Engine Mode (JSON) | v1.16.2 (June 2025) | Unanimous — JSON not GTP |
| Neural Network (Phase 1) | b18c384nbt | Latest kata1 training | Speed/strength balance |
| Neural Network (Phase 2) | b28c512nbt | s12614242560-d5766318893 | Strongest available, ~200 Elo above b18 |
| **HumanSL Model** | **b18c384nbt-humanv0** | **v1.15.0+** | **Rank-calibrated play — no competitor ships this** |
| Backend (Phase 1) | **TensorRT on GPU** | CUDA 12.8 + TRT 10.9.0 | **GPU-first, not CPU-first** |
| Backend (fallback) | CPU Eigen | KataGo built-in | Degraded mode only |
| Job Queue | BullMQ | 5.70.x | Parent-child jobs, flow control |
| Process Management | Process pool (2-4) | Node.js 22 child_process | Concurrent analysis |
| Infrastructure | **Hetzner GEX44** | RTX 4000 SFF Ada, 20GB | **GPU from Day 1** |

### What Makes This Cutting-Edge

The key divergence from all other scenarios: **GPU from Day 1, not as a Phase 2 upgrade**.

All other scenarios start with CPU Eigen (~15 visits/sec) and plan a future GPU migration. The Cutting Edge scenario inverts this — start with TensorRT on the Hetzner GEX44 (RTX 4000 SFF Ada, 20GB VRAM) and fall back to CPU only as a degraded mode.

**Why this matters**:

| Metric | CPU Eigen (b18) | GPU TensorRT (b18) | GPU TensorRT (b28) |
|--------|-----------------|--------------------|--------------------|
| Visits/sec | ~15 | ~1,300 (87x) | ~1,560 (104x) |
| 50-visit analysis | ~3.3s | ~0.04s | ~0.03s |
| 500-visit deep review | ~33s | ~0.4s | ~0.3s |
| User experience | "Loading..." spinner | **Instant** | **Instant** |

At GPU speeds, analysis feels instant. The difference between a 3-second spinner and a 40ms response is not incremental — it fundamentally changes the UX from "request and wait" to "think and explore." Users can scrub through a game and see analysis update in real-time, like scrubbing a video timeline.

### HumanSL — The Feature No Competitor Ships at Scale

KataGo v1.15.0 introduced the HumanSL model trained to predict human moves at calibrated rank levels. Using `humanSLProfile` configuration, the engine predicts what a player of any rank — from 30-kyu beginner to 9-dan professional — would play.

**Cutting-edge applications**:

1. **"AI plays like a 5-kyu" mode**: HumanSL generates moves at the target rank. Unlike simple visit-count reduction (which produces random-looking play), HumanSL produces *coherent* moves that feel human at that level.

2. **Mistake detection filter**: Among candidate "mistakes," flag only those a moderately stronger player would consistently avoid. HumanSL provides the "would a 3-dan avoid this?" signal that raw win-rate delta cannot.

3. **Historical mode**: Predict how a professional from 1950 vs 2024 would approach a position. HumanSL is trained on historical game data with year metadata.

4. **Rank estimation**: Analyze a player's game with HumanSL and estimate their rank based on move prediction accuracy at each level.

### Architecture: GPU-First Process Pool

```
                    ┌─────────────────────────────────────────┐
                    │         Hetzner GEX44 Server            │
                    │    RTX 4000 SFF Ada (20GB VRAM)         │
                    │                                         │
Client Request ────▶│  Next.js API ──▶ BullMQ Queue           │
                    │                       │                 │
                    │              ┌────────┼────────┐        │
                    │              ▼        ▼        ▼        │
                    │         KataGo-1  KataGo-2  KataGo-3   │
                    │         (TensorRT) (TensorRT) (HumanSL) │
                    │          b28c512    b18c384   b18-human  │
                    │              │        │        │         │
                    │              └────────┼────────┘         │
                    │                       ▼                  │
                    │              Result ──▶ WebSocket Push   │
                    └─────────────────────────────────────────┘

Process Pool Strategy:
  Process 1: b28c512 (strongest) — deep analysis, game review
  Process 2: b18c384 (fast)     — instant hints, quick analysis
  Process 3: b18-humanv0        — rank-calibrated play, AI opponent

GPU Memory Budget (20GB VRAM):
  Process 1 (b28): ~3GB
  Process 2 (b18): ~1.5GB
  Process 3 (humanSL): ~1.5GB
  System overhead: ~1GB
  Total: ~7GB / 20GB available (65% headroom)
```

**Adaptive Visits Strategy** (cutting-edge):
- **Instant hint**: 5 visits (~4ms on GPU) — real-time as user hovers
- **Quick analysis**: 50 visits (~40ms on GPU) — post-move review
- **Deep review**: 500 visits (~0.4s on GPU) — full game analysis
- **Tournament depth**: 2000 visits (~1.5s on GPU) — professional-grade

### Risk Assessment

| Risk | Probability | Impact | Mitigation | Go/No-Go Criterion |
|------|------------|--------|------------|---------------------|
| TensorRT crash (v1.16.0 NaN bug) | Medium (20%) | High | v1.16.2 fixes numeric scaling; CPU Eigen fallback ready | Run 1000-game stress test on exact GEX44 hardware before launch |
| GPU VRAM exhaustion with 3 processes | Low (10%) | Medium | 7GB/20GB = 65% headroom; reduce to 2 processes if needed | Monitor VRAM usage in staging for 48 hours |
| GEX44 availability/pricing change | Low (5%) | High | Hetzner GEX131 as upgrade path; GPU cloud alternatives mapped | Confirm GEX44 order lead time before committing |
| HumanSL rank calibration inaccurate | Medium (25%) | Medium | Community beta testing with known-rank players; fallback to visit-count reduction | Test with 50 games at each target rank level |
| KataGo process pool complexity | Medium (30%) | Medium | Start with 2 processes; add 3rd after stability proven | Single-process MVP works; pool is an enhancement |

### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| GPU Environment Setup | 3 days | GEX44 provisioning, CUDA 12.8, TRT 10.9.0, KataGo build |
| Core Integration | 1.5 weeks | Single KataGo TensorRT process, BullMQ queue, JSON IPC |
| Process Pool | 1 week | 2-3 process pool, load balancing, crash recovery watchdog |
| HumanSL Integration | 1 week | Rank-calibrated play, historical mode, rank estimation API |
| Adaptive Visits | 3 days | 5/50/500/2000 visit tiers, automatic selection |
| Stress Testing | 4 days | 1000-game test, VRAM monitoring, latency benchmarks |
| **Total** | **5.5 weeks** | |

### Monthly Cost

| Item | Cost |
|------|------|
| Hetzner GEX44 (RTX 4000 SFF Ada, 20GB) | EUR 184/mo (~$200) |
| GEX44 setup fee (one-time) | EUR 79 (~$86) |
| **Monthly Total** | **~$200/mo** |

**Cost justification**: $200/mo buys 87x performance improvement. The CPU alternative ($65/mo) saves $135/mo but delivers a fundamentally worse user experience — 3.3s waits vs 40ms instant responses. At MRR $5K, $200/mo is 4% of revenue.

---

## 2. Go Rules Engine — Evolutionary with Tromp-Taylor (Proven)

### Innovation Score: 6.5/10

### Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Rules Foundation | Tromp-Taylor | Unanimous 4/4 — 10 sentences, mathematically complete |
| Scoring (Phase 1) | Chinese (area) only | Unanimous 4/4 — no dead stone agreement needed |
| Scoring (Phase 2) | Japanese (territory) | Deferred — requires dead stone marking UI |
| Board Representation | 1D Uint8Array (361) | Cache-friendly, O(1) access, minimal GC pressure |
| Position Hashing | Zobrist hashing (64-bit XOR) | O(1) incremental update; superko detection |
| Language | TypeScript (strict mode) | Shared with frontend; pure functions |
| Test Framework | Vitest | ESM-native, fast |

### What Makes This Cutting-Edge (vs Other Scenarios)

This area is intentionally *not* where cutting-edge investment goes. All 4 perspectives agreed on the Evolutionary approach with Tromp-Taylor + Chinese scoring. The rules engine is a **solved problem** — innovation yields zero competitive advantage here.

However, two optimizations push this above the baseline:

1. **KataGo Oracle Validation**: Every rules engine edge case (ko, seki, snapback, bent-four-in-corner) is validated against KataGo's own rules implementation by running identical positions through both engines and comparing results. This is a cutting-edge testing strategy — using a superhuman AI as a test oracle.

2. **Property-Based Testing with fast-check**: Beyond traditional unit tests, use fast-check to generate random legal game sequences and verify invariants (captures never negative, Zobrist hash consistent, Chinese score = territory + stones). This catches edge cases no human test writer would imagine.

### Innovation Justification

Investing innovation here is a **trap**. The rules of Go have been unchanged for millennia. A "cutting-edge" rules engine would mean either (a) supporting exotic rulesets that <1% of users need, or (b) premature optimization that adds complexity without user benefit. The Cutting Edge scenario's discipline is knowing where *not* to innovate.

### Risk Assessment

| Risk | Probability | Impact | Mitigation | Go/No-Go Criterion |
|------|------------|--------|------------|---------------------|
| Edge case bugs (ko, seki) | Medium (25%) | High | KataGo oracle + property-based testing | 100% match with KataGo on 1000 random game positions |
| Japanese scoring complexity | High (60%) | Medium | Deferred to Phase 2 | Chinese-only for MVP is acceptable |
| Performance issues | Very Low (2%) | Low | Uint8Array + Zobrist = microsecond ops | Non-issue at any realistic scale |

### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| E1: Board + stones + liberties | 3 days | Core data structures, ~100 LOC |
| E2: Capture + simple ko | 3 days | Capture logic, ~80 LOC |
| E3: Zobrist + superko | 2 days | Hashing, Tromp-Taylor superko, ~60 LOC |
| E4: Chinese scoring | 3 days | Area counting, ~80 LOC |
| E5: SGF import/export | 3 days | @sabaki/sgf reference, ~100 LOC |
| E6: KataGo oracle tests | 2 days | 1000-position validation |
| **Total** | **2.5 weeks** | **~420 LOC + oracle test suite** |

### Monthly Cost

$0 — pure logic, no runtime infrastructure.

---

## 3. LLM Explanation Pipeline — Maximum Innovation (The Competitive Moat)

### Innovation Score: 10/10

### Technology Choices

| Component | Choice | Version/Model | Cutting Edge Element |
|-----------|--------|---------------|---------------------|
| Template Engine (V1) | Pattern matching on KataGo data | Custom TS | 60% of value for 10% of cost |
| LLM Primary (70%) | **Claude Haiku 4.5** | Latest | $1/$5 per M tokens; near-Sonnet quality |
| LLM Complex (20%) | **Claude Sonnet 4.6** | Latest | **Adaptive thinking** for deep analysis |
| LLM Critical (5%) | **Claude Sonnet 4.6 Extended Thinking** | Budget-controlled | **Chain-of-thought for life-and-death** |
| LLM Fallback (5%) | Template system | N/A | Mandatory for highest-risk positions |
| Output Format | **Structured Outputs (JSON schema)** | Anthropic API | **Schema-guaranteed conformance** |
| Cost Optimization | Prompt caching + Batch API | Anthropic API | 90% cache + 50% batch savings |
| Validation | **5-layer pipeline** | Custom | One layer beyond Latest-Tech's 4-layer |
| Golden Dataset | 200+ expert-verified positions | Custom | Dan-level reviewers; expandable |

### What Makes This Cutting-Edge

The LLM pipeline is where the Cutting Edge scenario diverges most from all others. Three innovations push beyond the Latest-Tech scenario:

#### Innovation 1: Claude Sonnet 4.6 with Adaptive Thinking

Rather than the flat Haiku-for-everything approach, the Cutting Edge scenario uses a **tiered intelligence strategy**:

```
Query Complexity Routing:

  Simple position evaluation ──▶ Haiku 4.5 (70%)
    "This move captures 3 stones"     $0.003/query
                                      ~100ms latency

  Complex strategic explanation ──▶ Sonnet 4.6 (20%)
    "Why this shoulder hit changes     $0.015/query
     the framework balance"            ~500ms latency

  Life-and-death / Ko / Seki ──▶ Sonnet 4.6 Extended (5%)
    "This group lives because of       $0.05/query
     the eye-stealing tesuji at 3-3"   ~2s latency
     (chain-of-thought reasoning)

  Ultra-high-risk positions ──▶ Template Fallback (5%)
    "KataGo evaluates this as a        $0/query
     95% win for Black after the       ~5ms latency
     sequence A-B-C-D"
```

**Why adaptive thinking matters**: Claude Sonnet 4.6's adaptive thinking lets the model determine its own thinking depth based on query complexity. For a simple "this captures stones" explanation, it responds instantly. For a complex semeai (capturing race) that requires reasoning about liberty counts and eye shapes, it engages extended thinking to produce a more accurate explanation. The model self-selects the thinking budget — we set a max budget, and the model uses only what it needs.

#### Innovation 2: Structured Outputs for Schema-Guaranteed Responses

Instead of parsing free-text LLM responses, use Anthropic's structured output feature to guarantee JSON schema conformance:

```typescript
// Schema-guaranteed output — never a parsing failure
interface MoveExplanation {
  summary: string;              // 1-2 sentence headline
  details: string;              // Full explanation paragraph
  confidence: 'high' | 'medium' | 'low';
  katago_data: {
    win_rate: number;           // Must match KataGo ±1%
    score_lead: number;         // Must match KataGo ±0.5
    best_move: string;          // Coordinate string
    visit_count: number;
  };
  explanation_level: 'beginner' | 'intermediate' | 'advanced';
  cited_coordinates: string[];  // All board coordinates mentioned
  risk_flags: string[];         // Any detected hallucination signals
}
```

This eliminates an entire class of bugs: malformed responses, missing fields, wrong data types. The schema is the contract.

#### Innovation 3: 5-Layer Validation Pipeline

Beyond the Latest-Tech scenario's 4 layers, the Cutting Edge adds a **semantic consistency layer**:

```
Layer 1: DATA ANCHORING
  Extract all facts from KataGo JSON analysis.
  Win rate, score lead, best moves, ownership map, policy.

Layer 2: CONSTRAINED GENERATION
  System prompt with strict boundaries.
  Few-shot examples from golden dataset.
  Structured output schema enforcement.

Layer 3: OUTPUT VALIDATION (automated)
  Win rate cited matches KataGo data (±1%).
  All coordinates mentioned exist on the board.
  Move sequences referenced are legal (validated by rules engine).
  Sentiment matches win rate direction.

Layer 4: SEMANTIC CONSISTENCY (NEW — cutting-edge)
  Cross-reference with previous explanations in the same game.
  "Move 45 explanation says 'Black is winning' but move 43 said
   'White has a comfortable lead' — flag inconsistency."
  Detect contradictions with the game's overall narrative arc.
  Use embedding similarity to catch paraphrased contradictions.

Layer 5: SPOT-CHECK + FEEDBACK LOOP
  Random 5% human review by dan-level players.
  User feedback button ("Was this helpful? Accurate?").
  Flag systematic error patterns.
  Continuously expand golden dataset.
  Monthly model quality report.
```

### 3-Tier Explanation Levels

```
Beginner (< 15 kyu):
  "This move protects your group of stones on the right side.
   Without it, your opponent could capture 5 stones. KataGo
   gives this move a 67% chance of winning."

Intermediate (15 kyu - 3 dan):
  "The attachment at R14 reduces White's potential territory
   on the right side by approximately 8 points. This is
   KataGo's top choice with 34% of the policy weight and
   a 62% win rate. The main alternative is the shoulder hit
   at R15, which is slightly less efficient."

Advanced (3 dan+):
  "The shoulder hit at C10 creates aji in White's framework
   that becomes relevant around move 80-100. KataGo's
   ownership map shows the upper-left shifts from 70% White
   to 45% White after the expected sequence C10-D11-C12-D13.
   This represents a 7-point swing. The timing is critical —
   playing C10 before White reinforces at D12 gains 2.3
   additional points according to the score lead analysis."
```

### Prompt Architecture with Caching

```
SYSTEM PROMPT (cached — 90% read discount):
  Go domain knowledge          ~2,000 tokens
  Explanation level definitions ~500 tokens
  Few-shot golden examples     ~3,000 tokens
  Output schema specification  ~500 tokens
  Anti-hallucination rules     ~500 tokens
  Total system prompt:         ~6,500 tokens (cached)

USER PROMPT (per-query):
  KataGo JSON analysis         ~800 tokens
  Board position context       ~200 tokens
  Game narrative context       ~300 tokens  ← NEW: previous explanations
  User level + preferences     ~100 tokens
  Total user prompt:           ~1,400 tokens

OUTPUT (structured):
  JSON explanation object      ~300-600 tokens
```

### Cost Calculation

| Tier | Queries/mo (of 160K) | Cost/Query | Monthly Cost |
|------|---------------------|------------|-------------|
| Haiku 4.5 (70%) | 112,000 | $0.003 | $336 |
| Sonnet 4.6 (20%) | 32,000 | $0.015 | $480 |
| Sonnet 4.6 Extended (5%) | 8,000 | $0.05 | $400 |
| Template fallback (5%) | 8,000 | $0 | $0 |
| **Subtotal** | | | **$1,216** |
| Prompt caching savings (est. 40%) | | | -$486 |
| **Net Monthly LLM Cost** | | | **~$730** |

**Cost comparison**:
- Latest-Tech scenario: ~$430/mo (Haiku-heavy, no extended thinking)
- Cutting Edge scenario: ~$730/mo (+$300/mo for dramatically better explanations)
- Cost delta: $300/mo = 6% of MRR $5K — buys a fundamentally superior explanation quality

### Risk Assessment

| Risk | Probability | Impact | Mitigation | Go/No-Go Criterion |
|------|------------|--------|------------|---------------------|
| LLM hallucination on move sequences | High (40%) | Critical | 5-layer validation + template fallback | <5% hallucination rate in Layer 3 checks on golden dataset |
| Cost overrun at scale | Medium (30%) | Medium | Prompt caching, tier routing, Batch API | Monthly LLM spend < $1,000 at MAU 8K |
| Claude API downtime | Low (5%) | High | Template fallback for 100% availability | Template system tested independently |
| Adaptive thinking cost unpredictable | Medium (25%) | Medium | Budget cap per query; fallback to standard Sonnet | Set max_tokens_thinking = 4096 |
| Semantic consistency false positives | Medium (30%) | Low | Tunable threshold; human review queue | <10% false positive rate on test set |

### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| V1: Template Engine | 10 days | Pattern matching, pre-written explanations |
| V2: Haiku Integration | 10 days | Structured output, 3-tier levels, prompt engineering |
| V2.5: Sonnet Tier Routing | 5 days | Complexity classifier, adaptive thinking config |
| V3: 5-Layer Validation | 12 days | All 5 layers, golden dataset integration |
| V3.5: Semantic Consistency | 5 days | Cross-explanation consistency checks |
| V4: Cost Optimization | 5 days | Prompt caching, Batch API, monitoring dashboard |
| **Total** | **9.5 weeks** | |

---

## 4. Real-time Game Server — Event-Sourced with WebSocket + WebTransport Readiness

### Innovation Score: 8/10

### Technology Choices

| Component | Choice | Version | Cutting Edge Element |
|-----------|--------|---------|---------------------|
| WebSocket Server | ws | Latest | 25K+ connections/process; proven |
| **Transport Layer** | **WebSocket + WebTransport fallback architecture** | ws + experimental | **Future-proofed dual-transport** |
| Game State Pattern | **Event Sourcing + CQRS** | Custom | **SGF IS an event log — perfect domain fit** |
| Event Store | **PostgreSQL JSONB** | PG 16 | **JSONB event payloads with partition pruning** |
| ORM | Drizzle | Latest | Type-safe event schemas |
| Job Queue | BullMQ | 5.70.x | Analysis decoupled from game loop |
| State Management | Immutable GameState | TypeScript | Every move = new state |
| Time Control | Byoyomi + Fischer (Phase 1) | Custom | Two most common systems |
| Matchmaking | **Glicko-2** | Custom | **Better than Elo for rating accuracy** |
| Scaling (Phase 2) | Redis Pub/Sub | Redis 7.2 | Horizontal scaling path |

### What Makes This Cutting-Edge

#### Innovation 1: Event Sourcing as a First-Class Architecture (Not Retrofitted)

All 4 perspectives agreed on the conceptual appeal of event sourcing for Go. The Cutting Edge scenario commits fully — event sourcing is not an optimization layer added later but the **foundational storage model from Day 1**.

```
Why Event Sourcing is the Natural Architecture for Go:

  ┌─────────────────────────────────────────────────────────┐
  │  SGF (Standard Game Format) = Event Log                 │
  │                                                         │
  │  (;GM[1]FF[4]SZ[19]                                    │
  │   ;B[pd]    ← Event: Black plays at pd                 │
  │   ;W[dp]    ← Event: White plays at dp                 │
  │   ;B[pp]    ← Event: Black plays at pp                 │
  │   ;W[dd])   ← Event: White plays at dd                 │
  │                                                         │
  │  Every Go game ever recorded is already event-sourced.  │
  └─────────────────────────────────────────────────────────┘

  Benefits that are NOT theoretical — they ARE the core features:
  ✓ Move-by-move replay (core feature) = replay events
  ✓ Game review at any point = rebuild state at event N
  ✓ Branch variations (teaching) = fork the event stream
  ✓ AI analysis per move = event handler
  ✓ Undo/redo = pop/push events
  ✓ SGF export = serialize event stream
  ✓ Full audit trail = free
```

#### Innovation 2: PostgreSQL JSONB Event Store with CQRS

Instead of a separate event store technology, use PostgreSQL 16's JSONB capabilities — it is already in the tech stack.

```sql
-- Event store table (write model)
CREATE TABLE game_events (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id      UUID NOT NULL,
  sequence_num INTEGER NOT NULL,
  event_type   TEXT NOT NULL,  -- 'move', 'pass', 'resign', 'timeout', 'undo'
  payload      JSONB NOT NULL, -- { coord: [3, 15], time_remaining: 300 }
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (game_id, sequence_num)
) PARTITION BY RANGE (created_at);

-- Read model (materialized from events)
CREATE TABLE game_states (
  game_id      UUID PRIMARY KEY,
  board        BYTEA NOT NULL,  -- 361-byte board state
  to_play      SMALLINT NOT NULL,
  move_number  INTEGER NOT NULL,
  status       TEXT NOT NULL,    -- 'active', 'finished', 'suspended'
  result       TEXT,             -- 'B+3.5', 'W+R', etc.
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- CQRS: events → state projection
-- On each new event: update game_states materialized view
-- Queries read from game_states (fast, denormalized)
-- History reads from game_events (complete, append-only)
```

**Partition strategy**: Monthly partitions on `created_at`. At MAU 8K with ~5 games/user/month = 40K games/month, ~10K events/game average = ~400M events/year. PG 16 partition pruning keeps queries fast.

#### Innovation 3: Glicko-2 Rating System

Elo is the standard, but Glicko-2 is strictly superior — it tracks rating deviation (confidence) and rating volatility, producing more accurate ratings with fewer games. The algorithm is well-documented and implementable in ~200 LOC TypeScript.

```typescript
interface GlickoRating {
  rating: number;     // ~1500 default (like Elo)
  deviation: number;  // Confidence — decreases with more games
  volatility: number; // How consistent the player is
}

// After each game: update rating, deviation, and volatility
// Players with high deviation get larger rating adjustments
// Inactive players' deviation increases over time (uncertainty grows)
```

**Why this matters**: At MAU 8K, many players will have few rated games. Elo produces wildly inaccurate ratings with <20 games. Glicko-2's deviation tracking means the system *knows* it is uncertain and can display this to users ("1500 ± 200" vs a misleading precise "1500").

#### Innovation 4: WebTransport-Ready Architecture

WebTransport is not production-ready in 2026 (Safari/Firefox support incomplete, Node.js libraries experimental). But the Cutting Edge scenario designs the transport layer to be **swap-ready**:

```typescript
// Transport abstraction — WebSocket today, WebTransport tomorrow
interface GameTransport {
  send(message: GameMessage): void;
  onMessage(handler: (msg: GameMessage) => void): void;
  onClose(handler: () => void): void;
  readonly latency: number;
  readonly protocol: 'websocket' | 'webtransport';
}

// Current implementation: WebSocket via ws
class WebSocketTransport implements GameTransport { ... }

// Future implementation: WebTransport (when stable)
class WebTransportTransport implements GameTransport { ... }

// Server selects transport based on client capability
function negotiateTransport(req: IncomingMessage): GameTransport {
  if (supportsWebTransport(req) && FEATURE_FLAGS.webTransportEnabled) {
    return new WebTransportTransport(req);
  }
  return new WebSocketTransport(req);
}
```

**Expected WebTransport benefits** (when production-ready):
- 35% latency reduction (QUIC vs TCP)
- No head-of-line blocking (independent streams)
- Better mobile performance on unstable networks

**Cost of this abstraction**: ~50 LOC interface + one adapter class. Minimal overhead for future-proofing.

### Server-Authoritative Protocol

```typescript
// Client → Server
{ type: "move", data: { x: 3, y: 15 } }
{ type: "pass" }
{ type: "resign" }
{ type: "requestUndo" }
{ type: "requestAnalysis", data: { depth: "quick" } }

// Server → Client (authoritative)
{ type: "moveAccepted", data: { x: 3, y: 15, captures: [...], moveNum: 42 } }
{ type: "moveRejected", data: { reason: "ko_violation" } }
{ type: "gameState", data: { board: [...], toPlay: "W", time: {...} } }
{ type: "analysisReady", data: { winRate: 0.623, bestMoves: [...] } }
{ type: "explanation", data: { summary: "...", details: "..." } }
```

### Capacity Planning

| Metric | Single Node.js Process | With Redis Pub/Sub |
|--------|----------------------|-------------------|
| WebSocket connections | 25K-50K | 100K+ |
| Concurrent games | 2K-3K | 10K+ |
| Message frequency | ~1 msg/30s per game | Same |
| Memory per connection | ~2KB | ~2KB + Redis |
| CPU at MAU 8K | <5% | <2% per process |

Go is inherently low-frequency. At 1 message/30 seconds/player, 1000 concurrent games = ~67 messages/second. A single Node.js process handles this trivially.

### Risk Assessment

| Risk | Probability | Impact | Mitigation | Go/No-Go Criterion |
|------|------------|--------|------------|---------------------|
| Event sourcing complexity vs simple state | Medium (30%) | Medium | CQRS read model keeps queries simple | Game replay works correctly for 100 test games |
| WebSocket disconnection mid-game | High (40%) | High | Reconnection via event replay from PG | Reconnect + resume within 5 seconds in testing |
| PostgreSQL event table growth | Low (10%) | Low | Monthly partitioning; archive old partitions | Query latency < 50ms with 1M events |
| Glicko-2 implementation bugs | Low (15%) | Medium | Validated against reference implementation | Match FIDE Glicko-2 output for 100 test cases |
| WebTransport abstraction premature | Low (10%) | Low | ~50 LOC cost; no production dependency | Abstraction has zero runtime overhead |

### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Event Store + CQRS | 1 week | PG schema, event handlers, state projection |
| WebSocket Server | 1 week | ws integration, JSON protocol, auth |
| Game Room Lifecycle | 4 days | Create, join, leave, reconnect, dispose |
| Time Control | 4 days | Byoyomi + Fischer |
| Matchmaking (Glicko-2) | 4 days | Rating system + queue management |
| KataGo Bridge | 3 days | BullMQ integration for analysis requests |
| Transport Abstraction | 2 days | Interface + WebSocket adapter |
| **Total** | **4.5 weeks** | |

### Monthly Cost

Runtime shares the GEX44 server with KataGo — no additional infrastructure cost. PostgreSQL runs on the same server.

---

## 5. Baduk UI/UX — Modern Patterns with Classical Board Aesthetics

### Innovation Score: 7.5/10

### Technology Choices

| Component | Choice | Version | Cutting Edge Element |
|-----------|--------|---------|---------------------|
| Board Renderer | **SVG (React JSX)** | Native | Unanimous 4/4 — DOM events, accessibility |
| Base Component | Shudan fork | 1.7.1 base | 60% of board UI free; MIT; React compatible |
| State Management | Zustand | Latest (2026) | 2.7KB; hook-first; #1 satisfaction |
| Charts (Win Rate) | Recharts | 3.8.0 | D3-based, React-native, 3.6M weekly downloads |
| Touch Gestures | @use-gesture | Latest | Pinch zoom, pan, drag |
| **Page Rendering** | **Next.js 15 PPR** | Experimental | **Partial Prerendering for instant shell** |
| **View Transitions** | **React 19 View Transitions** | Stable | **Smooth page transitions** |
| Design System | Tailwind CSS v4 | Latest | Already in tech stack |
| Animations | CSS transitions + View Transitions | Native | Clean, minimal, purposeful |

### What Makes This Cutting-Edge

#### Innovation 1: Partial Prerendering (PPR) for Instant Board Loading

Next.js 15's PPR serves a static shell from the edge cache, then streams dynamic content. For a Go app, this means:

```
User visits /game/abc-123:

  0ms:   Static shell renders (board grid, player info layout, controls)
         ← Served from edge cache, appears INSTANTLY

  50ms:  Dynamic board state streams in (stones, current position)
         ← Server-rendered, streamed via React Suspense

  200ms: Analysis panel populates (win rate, AI explanation)
         ← Async, non-blocking

  Result: Users see a functional board in <100ms instead of a loading spinner.
```

**Caveat**: PPR is still experimental in Next.js 15. The Go/No-Go criterion is: if PPR causes instability, fall back to standard SSR with Suspense boundaries. The architecture works either way — PPR is an optimization, not a dependency.

#### Innovation 2: Real-time Analysis Overlay with GPU-Speed Updates

With GPU TensorRT delivering 40ms analysis latency, the UI can show analysis updates as the user *hovers* over intersections — not just after clicking:

```
User hovers over intersection D4:
  → Ghost stone appears at D4
  → 5-visit instant hint fires (4ms on GPU)
  → Win rate delta shown: "+2.3% if you play here"
  → Territory shift visualization updates
  → All this happens BEFORE the user clicks

User moves to intersection Q16:
  → Entire overlay updates in real-time
  → Previous analysis fades, new analysis appears
  → Smooth CSS transition between states

This "analysis-as-you-explore" UX is impossible without GPU-speed analysis.
It fundamentally changes the interaction model from "move then analyze"
to "explore then decide."
```

#### Innovation 3: Tap-Preview-Confirm for Mobile (Enhanced)

Building on the Latest-Tech scenario's Tap-Preview-Confirm pattern, the Cutting Edge version adds:

```
Step 1: TAP — User taps near an intersection
  → Ghost stone at nearest intersection
  → Magnified view (2x zoom) of surrounding 5x5 area
  → Haptic feedback (mobile)

Step 2: PREVIEW — 200ms later
  → Instant KataGo hint appears (5-visit, GPU: 4ms)
  → Win rate change indicator: ▲+2.3% or ▼-4.1%
  → Alternative moves shown as smaller ghost stones
  → User can swipe between top 3 alternatives

Step 3: CONFIRM — Double-tap or confirm button
  → Move sent to server
  → Full 50-visit analysis triggered
  → AI explanation generated (Haiku: ~100ms)
  → Win rate chart updates with smooth animation
```

### Component Architecture (~25 components)

```
GobanContainer
├── Board (SVG root — PPR static shell)
│   ├── Grid (lines + star points)
│   ├── Coordinates (A-T, 1-19)
│   ├── StoneLayer
│   │   ├── Stone (black/white/ghost preview)
│   │   └── MoveNumber (optional overlay)
│   ├── MarkupLayer
│   │   ├── TerritoryMarker (semi-transparent fill)
│   │   ├── MoveQualityIndicator (KaTrain color scheme)
│   │   ├── OwnershipHeatmap (KataGo ownership data)
│   │   └── WinRateDelta (hover preview — GPU-speed)
│   └── InteractionLayer
│       ├── GhostStone (hover/touch preview)
│       ├── AlternativeGhosts (top 3 moves, faded)
│       └── TouchTarget (enlarged for mobile, 44px min)
├── AnalysisPanel (Suspense boundary — streams after board)
│   ├── WinRateChart (Recharts, animated)
│   ├── ScoreGraph (Recharts, area chart)
│   ├── BestMovesDisplay (sortable by visits/policy)
│   └── AIExplanation (LLM output, 3-tier, structured)
├── MoveTree (variation navigator, horizontal scroll)
├── PlayerInfo (name, rank, Glicko-2 deviation, time, captures)
├── GameControls (pass, resign, undo, settings, analysis depth)
└── ChatPanel (optional, collapsible)
```

### Move Quality Color Scheme (KaTrain Standard)

| Color | Meaning | Win Rate Change |
|-------|---------|-----------------|
| Green | Excellent | < 1 point loss |
| Blue | Good | 1-3 points loss |
| Yellow | Inaccuracy | 3-5 points loss |
| Orange | Mistake | 5-10 points loss |
| Red | Blunder | > 10 points loss |

### Risk Assessment

| Risk | Probability | Impact | Mitigation | Go/No-Go Criterion |
|------|------------|--------|------------|---------------------|
| PPR instability (experimental) | Medium (30%) | Medium | Standard SSR fallback; PPR is optimization, not dependency | Test PPR on 10 route patterns; disable if errors > 0.1% |
| Mobile touch accuracy 19x19 | High (45%) | High | Tap-Preview-Confirm + pinch-zoom | User test with 10 mobile users; >90% first-attempt accuracy |
| Shudan fork maintenance | Medium (25%) | Medium | Fork CSS/rendering only; custom React wrapper | Track Shudan upstream for 6 months |
| Real-time hover analysis too chatty | Low (15%) | Low | Debounce 100ms; cancel previous on new hover | Measure KataGo queue depth; alert if > 50 pending |
| View Transitions browser support | Low (10%) | Low | Graceful fallback to no transition | Feature-detect; apply only if supported |

### Development Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Board Component (Shudan fork) | 1.5 weeks | SVG board, stones, grid, coordinates |
| Interaction Layer | 1 week | Tap-Preview-Confirm, pinch-zoom, ghost stones |
| Analysis Overlay (GPU-speed) | 1.5 weeks | Real-time hover analysis, move quality, ownership |
| Win Rate Chart + AI Panel | 1 week | Recharts, structured explanation display |
| Mobile Optimization | 1 week | Touch targets, responsive layout, haptic |
| PPR + View Transitions | 3 days | Next.js 15 PPR config, page transition animations |
| Dark Mode + Polish | 3 days | CSS custom properties, theme toggle |
| **Total** | **6.5 weeks** | |

### Monthly Cost

$0 — all libraries open-source. Runtime served by Next.js on the same server.

---

## Complete Technology Stack Table

| Area | Primary Technology | Version | Innovation Level | Phase |
|------|-------------------|---------|:---:|:---:|
| **KataGo Engine** | Analysis Engine (JSON) | v1.16.2 | Unanimous | 1 |
| **KataGo Network** | b18c384 + b28c512 + HumanSL | Latest kata1 | HIGH | 1 |
| **KataGo Backend** | **TensorRT (GPU-first)** | CUDA 12.8 / TRT 10.9.0 | **CUTTING EDGE** | 1 |
| **KataGo Infra** | **Hetzner GEX44** | RTX 4000 SFF Ada 20GB | **CUTTING EDGE** | 1 |
| **Process Mgmt** | Pool of 2-3 processes | Node.js 22 child_process | HIGH | 1 |
| **Job Queue** | BullMQ | 5.70.x | Standard | 1 |
| **Rules Engine** | Custom TS (Tromp-Taylor) | N/A | Proven | 1 |
| **Rules Testing** | KataGo oracle + fast-check | Vitest | MODERATE | 1 |
| **Scoring** | Chinese → +Japanese | N/A | Evolutionary | 1→2 |
| **LLM Primary** | **Claude Haiku 4.5** | Latest | Standard | 1 |
| **LLM Complex** | **Claude Sonnet 4.6** | Latest | **CUTTING EDGE** | 1 |
| **LLM Critical** | **Sonnet 4.6 Extended Thinking** | Budget-controlled | **CUTTING EDGE** | 1 |
| **LLM Validation** | **5-layer pipeline** | Custom | **CUTTING EDGE** | 1 |
| **LLM Output** | **Structured Outputs (schema)** | Anthropic API | HIGH | 1 |
| **LLM Fallback** | Template system | Custom | Proven | 1 |
| **WebSocket** | ws | Latest | Standard | 1 |
| **Transport** | WebSocket + WT-ready abstraction | ws + interface | MODERATE | 1→2 |
| **Game Architecture** | **Event Sourcing + CQRS** | PG 16 JSONB | **CUTTING EDGE** | 1 |
| **Rating System** | **Glicko-2** | Custom | HIGH | 1 |
| **Board Rendering** | SVG (React JSX) | Native | Unanimous | 1 |
| **UI Framework** | Shudan fork + custom | 1.7.1 base | Standard | 1 |
| **State (client)** | Zustand | Latest | Standard | 1 |
| **Charts** | Recharts | 3.8.0 | Standard | 1 |
| **Page Rendering** | **Next.js 15 PPR** | Experimental | HIGH | 1 |
| **Transitions** | React 19 View Transitions | Stable | MODERATE | 1 |
| **Touch** | @use-gesture | Latest | Standard | 1 |

---

## Gantt Timeline with Dependencies and Parallelization

```
Week:  1    2    3    4    5    6    7    8    9    10   11   12
       ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤

Track A: Infrastructure + KataGo
       ┌──┐
       │A1│ GPU Environment Setup (3d)
       └──┘
          ┌──────────┐
          │A2        │ Core KataGo Integration (1.5w)
          └──────────┘
                     ┌────────┐
                     │A3      │ Process Pool (1w)
                     └────────┘
                              ┌────────┐
                              │A4      │ HumanSL Integration (1w)
                              └────────┘
                                       ┌──┐
                                       │A5│ Adaptive Visits (3d)
                                       └──┘
                                          ┌───┐
                                          │A6 │ Stress Testing (4d)
                                          └───┘

Track B: Rules Engine (no dependencies)
       ┌──────────────────┐
       │B1                │ Full Rules Engine (2.5w)
       └──────────────────┘

Track C: Game Server (depends on B1)
                     ┌────────┐
                     │C1      │ Event Store + CQRS (1w)
                     └────────┘
                              ┌────────┐
                              │C2      │ WebSocket Server (1w)
                              └────────┘
                                       ┌───┐
                                       │C3 │ Game Room Lifecycle (4d)
                                       └───┘
                                            ┌───┐
                                            │C4 │ Time Control (4d)
                                            └───┘
                                                 ┌───┐
                                                 │C5 │ Glicko-2 Matchmaking (4d)
                                                 └───┘
                                                      ┌──┐
                                                      │C6│ KataGo Bridge (3d)
                                                      └──┘
                                                         ┌─┐
                                                         │7│ Transport Abstraction
                                                         └─┘

Track D: UI/UX (depends on B1, partially on C2)
                     ┌──────────┐
                     │D1        │ Board Component (1.5w)
                     └──────────┘
                                 ┌────────┐
                                 │D2      │ Interaction Layer (1w)
                                 └────────┘
                                          ┌──────────┐
                                          │D3        │ Analysis Overlay (1.5w)
                                          └──────────┘
                                                      ┌────────┐
                                                      │D4      │ Charts + AI Panel (1w)
                                                      └────────┘
                                                               ┌────────┐
                                                               │D5      │ Mobile (1w)
                                                               └────────┘
                                                                        ┌──┐
                                                                        │D6│ PPR + Polish
                                                                        └──┘

Track E: LLM Pipeline (depends on A2 for KataGo data)
          ┌──────────┐
          │E1        │ Template Engine (10d)
          └──────────┘
                     ┌──────────┐
                     │E2        │ Haiku Integration (10d)
                     └──────────┘
                                ┌────┐
                                │E3  │ Sonnet Tier Routing (5d)
                                └────┘
                                     ┌────────────┐
                                     │E4          │ 5-Layer Validation (12d)
                                     └────────────┘
                                                  ┌────┐
                                                  │E5  │ Semantic Consistency (5d)
                                                  └────┘
                                                       ┌────┐
                                                       │E6  │ Cost Optimization (5d)
                                                       └────┘

──────────────────────────────────────────────────────────────────────
Critical Path: B1 (2.5w) → C1-C7 (4.5w) → Integration (1w) = 8 weeks
Parallel completion: ~11-12 weeks total with 5 parallel AI agent tracks
```

**Milestones**:
- **Week 2.5**: Rules engine complete, first legal Go game possible
- **Week 4**: KataGo integration working, first AI analysis
- **Week 5.5**: Template explanations live
- **Week 6**: WebSocket game server functional
- **Week 7.5**: Board UI rendering with analysis overlay
- **Week 9.5**: Full LLM pipeline with 5-layer validation
- **Week 11**: Mobile optimization + PPR + polish
- **Week 12**: Integration testing + stress testing complete

---

## Total Cost Estimate

### Development Phase (One-time)

| Item | Cost |
|------|------|
| AI agent compute (Claude Code, 12 weeks) | ~$600-1,000 |
| Hetzner GEX44 during development (3 months) | ~$600 |
| GEX44 one-time setup fee | ~$86 |
| Golden dataset creation (200+ positions, dan-level) | $500-1,000 |
| Glicko-2 reference validation | $0 (open-source reference) |
| **Development Total** | **~$1,786-2,686** |

### Monthly Operations (Steady State, MAU 8K)

| Item | Monthly Cost |
|------|-------------|
| Hetzner GEX44 (GPU server — KataGo + app + PG) | $200 |
| LLM API (Haiku + Sonnet + Extended, with caching) | $730 |
| Domain + CDN (Cloudflare free tier) | ~$15 |
| Monitoring (Sentry free tier) | $0 |
| **Monthly Total** | **~$945/mo** |

### Cost Comparison Across Scenarios

| Scenario | Monthly Ops | Dev Cost | Innovation Score |
|----------|------------|----------|:---:|
| Speed-First | ~$150/mo | ~$800 | 5.2 |
| Stability | ~$170/mo | ~$2,500 | 5.8 |
| Latest-Tech | ~$515-715/mo | ~$1,400 | 7.6 |
| **Cutting Edge** | **~$945/mo** | **~$2,200** | **8.4** |

**ROI analysis**: At MRR $5K, the Cutting Edge monthly cost ($945) consumes 18.9% of revenue, leaving $4,055/mo gross margin. The Speed-First scenario ($150/mo) has higher margin but dramatically lower feature quality. The question is whether the innovation premium ($795/mo over Speed-First) converts more users.

---

## Success Probability Estimate

| Area | Success Probability | Confidence Basis |
|------|:---:|---|
| KataGo GPU Integration | 85% | TensorRT v1.16.2 fixed critical bugs; GEX44 is production hardware; CPU fallback exists |
| HumanSL Features | 80% | v1.15.0 is stable; rank calibration accuracy is the unknown |
| Rules Engine | 98% | Solved problem; KataGo oracle validation; all 4 perspectives agree |
| LLM 5-Layer Validation | 75% | Layer 4 (semantic consistency) is novel and unproven at scale; Layers 1-3 are straightforward |
| Event Sourcing Game Server | 85% | Pattern is well-documented; PostgreSQL JSONB is proven; Go's low message frequency reduces risk |
| Glicko-2 Rating | 90% | Well-documented algorithm; reference implementations exist |
| UI/UX with PPR | 80% | PPR is experimental; fallback to standard SSR is trivial |
| Real-time Hover Analysis | 75% | Depends on GPU latency staying <50ms under concurrent load |

**Composite Success Probability: ~78%** (geometric mean of all areas)

This is lower than Stability (90%) and Speed-First (88%) but represents the highest expected-value outcome: 78% chance of a significantly more impressive product vs 90% chance of a merely adequate product.

---

## Innovation Scorecard

| Area | Score | What You GAIN Over Balanced/Proven | What You RISK |
|------|:---:|---|---|
| **KataGo** | **9/10** | 87x faster analysis (instant vs 3s wait), HumanSL rank-calibrated play, 3-process pool for parallel analysis/play/human-like modes | GPU hardware cost ($200/mo vs $65/mo), TensorRT stability (mitigated by v1.16.2 fixes), process pool complexity |
| **Rules Engine** | **6.5/10** | KataGo oracle testing catches edge cases humans miss, property-based testing discovers unknown unknowns | Minimal risk — intentionally conservative here |
| **LLM Pipeline** | **10/10** | Adaptive thinking for deep explanations, structured outputs eliminate parsing bugs, 5-layer validation with semantic consistency, tiered intelligence routing | $300/mo higher LLM cost, semantic consistency layer is novel/unproven, extended thinking cost can be unpredictable |
| **Game Server** | **8/10** | Event sourcing is native to Go domain (SGF = event log), PostgreSQL JSONB event store (no extra infra), Glicko-2 produces better ratings faster, WebTransport-ready architecture | Event sourcing learning curve, Glicko-2 implementation complexity (mitigated by reference implementations), partition management for growing event tables |
| **UI/UX** | **7.5/10** | Partial Prerendering for instant board shell, real-time hover analysis (GPU-enabled), View Transitions for smooth page navigation, enhanced Tap-Preview-Confirm with win rate preview | PPR is experimental (fallback exists), real-time hover analysis may be too chatty under load |
| **Overall** | **8.4/10** | A product that feels qualitatively different from competitors: instant AI analysis, natural language explanations that actually make sense, human-like AI opponent at any rank, rating system that knows its own uncertainty | ~22% higher failure probability than proven approach; ~$795/mo higher monthly cost; ~4 weeks longer development |

---

## Go/No-Go Criteria Summary

Each cutting-edge choice has a concrete, measurable criterion that must pass before commitment:

| # | Technology Choice | Go/No-Go Criterion | Fallback If No-Go |
|---|-------------------|--------------------|--------------------|
| 1 | GPU TensorRT (Day 1) | 1000-game stress test on GEX44: zero TensorRT crashes, latency <50ms p99 | CPU Eigen (15 visits/sec) |
| 2 | KataGo Process Pool (3) | VRAM stays <15GB under concurrent load for 48 hours | Reduce to 2 processes (analysis + play only) |
| 3 | HumanSL Rank-Calibrated Play | 50 test games at each rank show consistent perceived strength | Visit-count reduction (less realistic but functional) |
| 4 | Sonnet 4.6 Extended Thinking | Per-query cost stays <$0.10 with budget cap; <5% timeout rate | Route all queries through standard Sonnet 4.6 |
| 5 | 5-Layer Validation (Semantic) | <10% false positive rate on 200-position golden dataset | Disable Layer 4, run 4-layer (same as Latest-Tech) |
| 6 | Structured Outputs | Schema validation works for 100% of test prompts | Parse free-text with regex + JSON.parse fallback |
| 7 | Event Sourcing + CQRS | Game replay works correctly for 100 complete test games | Simplified state-only storage with SGF export |
| 8 | Glicko-2 Rating System | Matches reference implementation output for 100 test cases | Standard Elo ±200 matching |
| 9 | Next.js PPR | Zero errors on 10 route patterns under load | Standard SSR with React Suspense boundaries |
| 10 | Real-time Hover Analysis | KataGo queue depth stays <50 under 100 concurrent hover users | Debounce to 500ms; require click to trigger analysis |

**Decision protocol**: Run Go/No-Go checks during weeks 4-5 of development. Any No-Go triggers an immediate fallback — no schedule delay, because the fallback architecture is pre-designed.

---

## What You Gain by Choosing Cutting Edge

1. **Instant AI analysis** — 40ms instead of 3.3 seconds. Users can *explore* the board with AI feedback, not just *request* analysis and wait.

2. **Human-like AI opponent at any rank** — HumanSL produces coherent, appropriately-skilled play from beginner to dan level. No competitor ships this at scale.

3. **Natural language explanations with depth** — Adaptive thinking means simple positions get quick explanations, complex positions get thoughtful chain-of-thought analysis. Structured outputs guarantee consistent formatting.

4. **Rating system that knows its uncertainty** — Glicko-2 shows "1500 ± 200" for new players instead of a misleadingly precise "1500." Users trust the system more.

5. **Architecture that matches the domain** — Event sourcing is not over-engineering for Go; SGF *is* an event log. The architecture speaks the domain's language.

6. **Future-proof transport** — WebTransport readiness costs ~50 LOC today and positions the platform for 35% latency reduction when browser support matures (2027-2028).

## What You Risk by Choosing Cutting Edge

1. **$795/mo higher monthly cost** than the Speed-First scenario — $945/mo vs $150/mo. At MRR $5K, this is the difference between 81% and 97% gross margin.

2. **~4 weeks longer development** — 12 weeks vs 7-8 weeks for Speed-First. In a first-mover race, this matters.

3. **22% higher failure probability** — 78% composite success vs 90% for proven approaches. The LLM semantic consistency layer and GPU process pool are the primary risk contributors.

4. **GPU hardware dependency** — If Hetzner GEX44 becomes unavailable or prices increase, migration to another GPU provider requires work. CPU fallback exists but degrades the core UX promise.

5. **LLM cost unpredictability** — Extended thinking costs depend on model behavior. A budget cap mitigates but could truncate explanations for complex positions.

---

## Sources

- [KataGo GitHub Repository](https://github.com/lightvector/KataGo)
- [KataGo Releases (v1.16.2)](https://github.com/lightvector/katago/releases)
- [KataGo Analysis Engine Documentation](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [KataGo HumanSL Release (v1.15.0)](https://github.com/lightvector/KataGo/releases/tag/v1.15.0)
- [KataGo HumanSL Issues and Research](https://github.com/lightvector/KataGo/issues/1074)
- [KataGo Distributed Training Networks](https://katagotraining.org/networks/)
- [KataGo Extra Networks (HumanSL)](https://katagotraining.org/extra_networks/)
- [RTX 5070 KataGo Benchmark](https://songyp.com/blog/katago-workstation-build-and-bench)
- [KataGo Hardware Speed Comparison](https://forums.online-go.com/t/katago-speeds-of-different-hardwares/48463)
- [TensorRT Issue on RTX5090](https://github.com/lightvector/KataGo/issues/1041)
- [AI is rewiring how the world's best Go players think — MIT Technology Review (Feb 2026)](https://www.technologyreview.com/2026/02/27/1133624/ai-is-rewiring-how-the-worlds-best-go-players-think/)
- [LLMs Playing and Commentating on Go: Current State (2025)](https://www.adarie.com/articles/8/)
- [Is KataGo HumanSL All You Need? — CiNii Research](https://cir.nii.ac.jp/crid/1050302237609755136)
- [Tromp-Taylor Concise Rules of Go](https://tromp.github.io/go.html)
- [Tromp-Taylor Rules — CMU](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html)
- [Computer Go / Tromp-Taylor Rules — Wikibooks](https://en.wikibooks.org/wiki/Computer_Go/Tromp-Taylor_Rules)
- [Claude API Pricing (2026)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Sonnet 4.6 — What's New](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-6)
- [Claude Sonnet 4.6 — Adaptive Thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)
- [Claude Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Claude Haiku 4.5](https://www.anthropic.com/claude/haiku)
- [Claude Haiku 4.5 Deep Dive — Caylent](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity)
- [Anthropic Prompt Caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)
- [Hetzner GEX44 GPU Server](https://www.hetzner.com/dedicated-rootserver/gex44/)
- [Hetzner GEX131 GPU Server](https://www.hetzner.com/dedicated-rootserver/gex131/)
- [Hetzner GPU Servers Overview](https://www.hetzner.com/dedicated-rootserver/matrix-gpu/)
- [Event Sourcing PostgreSQL + CQRS Patterns](https://drcodes.com/posts/event-sourcing-postgresql-master-cqrs-database-patterns)
- [PostgreSQL Event Sourcing Reference Implementation](https://github.com/eugene-khyst/postgresql-event-sourcing)
- [Drizzle ORM PostgreSQL Best Practices 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [Colyseus Multiplayer Framework](https://colyseus.io/)
- [Colyseus Documentation](https://docs.colyseus.io/)
- [ws WebSocket Library](https://github.com/websockets/ws)
- [WebTransport vs WebSocket Comparison](https://websocket.org/comparisons/webtransport/)
- [WebTransport — 35% Latency Reduction](https://www.vroble.com/2025/11/beyond-websockets-mastering.html)
- [WebTransport for Multiplayer Games 2025](https://markaicode.com/webtransport-multiplayer-games-2025/)
- [WebTransport Node.js Guide](https://www.videosdk.live/developer-hub/webtransport/nodejs-webtransport)
- [Web KaTrain — Browser-based KataGo Analysis](https://forums.online-go.com/t/web-katrain-browser-based-katrain-clone-with-in-browser-katago-analysis-webgpu-wasm/59096)
- [SVG vs Canvas vs WebGL Performance 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [Next.js 15 Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering)
- [React 19.2 View Transitions Support](https://dev.to/sagi0312/react-192-react-in-its-sigma-era-op7)
- [React Server Components Streaming Performance 2026](https://www.sitepoint.com/react-server-components-streaming-performance-2026/)
- [Shudan Goban Component](https://github.com/SabakiHQ/Shudan)
- [Sabaki SGF Editor](https://github.com/SabakiHQ/Sabaki)
- [Zustand State Management](https://github.com/pmndrs/zustand)
- [Recharts Chart Library](https://github.com/recharts/recharts)
- [@use-gesture Documentation](https://use-gesture.netlify.app/docs/gestures/)
- [ZBaduk AI Review Platform](https://zbaduk.com/)
- [BadukAI Mobile App](https://aki65.github.io/)
- [Legend of Baduk — KBA Teaching App](https://forums.online-go.com/t/new-go-app-for-beginners-from-kba-legend-of-baduk/57331)
- [OGS Real-time API](https://ogs.readme.io/docs/real-time-api)
- [BullMQ Documentation](https://docs.bullmq.io/)
