# External AI Integration Research: Conservative Single-Provider Architecture

**Research**: External AI Integration Deep-Dive
**Perspective**: Conservative Technology Analyst
**Date**: 2026-03-10
**Prior Context**: Tech Stack v1.0 (Node.js 22, Next.js 15, PG 16, Redis 7.2, Drizzle, Coolify+Hetzner)
**Constraint**: Claude API is the ONLY LLM API. OpenAI/Gemini are subscription-only (no API access).
**Builder**: AI Agents (Claude Code)
**Philosophy**: "One provider, one SDK, one billing relationship. Minimize external surface area. Every dependency is a liability."

---

## Executive Summary

This document argues that a **single-provider Claude API architecture** is not merely acceptable but **strategically optimal** for a baduk app at MAU 8K scale. The industry trend toward multi-model routing is driven by enterprise-scale concerns (cost optimization across millions of requests, provider-specific strengths in specialized domains, SLA requirements exceeding 99.99%). None of these apply here.

The architecture requires exactly **two external AI dependencies**: KataGo (local, zero network dependency) and Claude API (single REST endpoint). Everything else — search, translation, summarization, content generation — either runs on PostgreSQL, Redis, or Claude API itself. The total external API surface area is one endpoint: `api.anthropic.com`.

**Total estimated monthly cost at MAU 8K: $47-95/month for Claude API** (with aggressive caching and tiered model routing), plus $8-12/month for Hetzner infrastructure. This is a $60-107/month total external cost for a complete AI-powered baduk application.

---

## Table of Contents

1. [Claude API as Single LLM Provider](#1-claude-api-as-single-llm-provider)
2. [Why NOT Multi-Model](#2-why-not-multi-model)
3. [Minimal External Dependencies](#3-minimal-external-dependencies)
4. [Proven Integration Patterns](#4-proven-integration-patterns)
5. [Cost Optimization](#5-cost-optimization)
6. [Risk Analysis and Mitigations](#6-risk-analysis-and-mitigations)
7. [Recommendation Summary](#7-recommendation-summary)

---

## 1. Claude API as Single LLM Provider

### 1.1 Model Routing Strategy: Haiku-Default, Sonnet-Escalation

The single most impactful cost and quality decision is **which model handles which query**. The research converges on a clear consensus: use the cheapest model that produces acceptable quality, and escalate only when necessary.

**Tiered Model Routing for Baduk App:**

| Tier | Model | Use Cases | Traffic Share | Latency | Cost/1M tokens (in/out) |
|------|-------|-----------|--------------|---------|------------------------|
| T1 (Default) | Haiku 4.5 | Move explanations, game commentary, vocabulary help, simple Q&A, board state descriptions | 80% | ~0.5-1s | $1 / $5 |
| T2 (Escalation) | Sonnet 4.6 | Complex position analysis narratives, teaching explanations for multi-step sequences, strategic concepts, user questions requiring deep reasoning | 15% | ~1-3s | $3 / $15 |
| T3 (Fallback) | Template-based | API failures, rate limit hits, common patterns with known explanations | 5% | <50ms | $0 |

**Escalation Triggers (T1 -> T2):**
- KataGo winrate delta > 15% (complex position requiring nuanced explanation)
- User explicitly asks "why?" about a position (deeper reasoning needed)
- Multi-stone sequence explanation (>3 moves in a variation)
- Teaching mode active (user is studying, not just playing)
- Haiku response confidence below threshold (self-assessed or rule-based)

**Fallback Triggers (any tier -> T3):**
- Claude API returns 429 (rate limit) or 5xx error
- Circuit breaker is open
- Response latency exceeds 10s timeout
- Monthly cost budget threshold reached (configurable)

This routing saves 40-60% compared to using Sonnet for everything, with minimal quality impact on the 80% of queries that are straightforward.

### 1.2 Prompt Caching Strategy (90% Input Cost Savings)

Prompt caching is the single highest-ROI optimization available. Claude's prompt caching stores prefixes of prompts so subsequent requests using the same prefix are charged at 10% of the standard input price.

**How It Works:**
- First request: pay 1.25x input price (5-minute cache) or 2x (1-hour cache) to write the cache
- Subsequent requests: pay 0.1x input price (90% savings)
- Cache hit breaks even after just 1 read (5-min TTL) or 2 reads (1-hour TTL)

**Baduk App Cache Architecture:**

```
System Prompt (cached, ~2000 tokens):
├── Role: "You are a baduk teacher explaining moves to players."
├── Output format instructions (JSON schema for structured explanations)
├── Vocabulary/terminology guidelines
├── Player skill level context rules
└── Response length constraints

Per-Request Variable (NOT cached, ~200-500 tokens):
├── Board state (SGF or coordinate list)
├── KataGo analysis JSON (winrate, top moves, variations)
├── Specific user question
└── Player's current rank/level
```

**Estimated savings**: The system prompt (~2000 tokens) is identical across all requests. At 80% cache hit rate (conservative — the system prompt changes rarely), input costs drop by ~72% on the cached portion. Since the system prompt is typically 80% of total input tokens, effective input cost reduction is approximately **58-72%**.

**Implementation:**
```
cache_control: {"type": "ephemeral"}  // placed after system prompt
// 5-minute TTL is sufficient — baduk app traffic is bursty during games
// 1-hour TTL for batch analysis jobs
```

### 1.3 Batch API for Non-Real-Time Analysis (50% Cost Reduction)

The Batch API processes requests asynchronously with a **50% discount on both input and output tokens**. Combined with prompt caching, total savings can reach **up to 95%**.

**Baduk App Batch Use Cases:**

| Use Case | Urgency | Batch Eligible? | Savings |
|----------|---------|-----------------|---------|
| Post-game full review (all moves) | User waits 1-5 min | Yes | 50% |
| Daily puzzle generation | Overnight job | Yes | 50% + caching |
| Content generation (articles, lessons) | Background | Yes | 50% + caching |
| Training data labeling | Periodic | Yes | 50% + caching |
| Historical game re-analysis | Low priority | Yes | 50% + caching |
| Live move explanation | Real-time | No | Caching only |
| Interactive Q&A during game | Real-time | No | Caching only |

**Implementation Pattern:**
1. After a game ends, queue all moves for batch analysis
2. Submit batch request to `/v1/messages/batches`
3. Poll for completion (typically <1 hour for moderate batches)
4. Store results in PostgreSQL for instant retrieval when user opens review
5. User sees "Full AI review ready!" notification

**Cost impact**: Post-game reviews are the highest-token use case (analyzing 100-300 moves). Moving these to batch reduces their cost by 50%, and these represent roughly 30-40% of total API spend.

### 1.4 Extended Thinking for Complex Positions

Extended thinking gives Claude step-by-step reasoning capability for complex tasks. For baduk, this is valuable for a specific subset of queries.

**When to Use Extended Thinking:**
- Complex life-and-death (tsumego) explanations where the reading tree has 5+ variations
- Position judgement disagreements (user thinks they're winning, KataGo says otherwise)
- Strategic concept explanations requiring multi-paragraph teaching narratives
- When Sonnet's standard response seems shallow or misses key variations

**When NOT to Use:**
- Simple move explanations ("this is a good defensive move because...")
- Board state descriptions
- Any query where latency matters more than depth
- High-volume queries (extended thinking adds significant latency)

**Configuration:**
- Minimum budget: 1,024 tokens
- Start at minimum, increase incrementally per use case
- For baduk: 2,048-4,096 tokens is likely the sweet spot for complex positions
- Only available on Sonnet 4.6+ and Opus models

**Estimated usage**: <5% of total queries. Reserved for the teaching/study mode where users are actively learning, not playing.

### 1.5 Rate Limiting and Error Handling

**Claude API Rate Limits (Tier 1 — starting tier):**

| Constraint | Limit |
|-----------|-------|
| Requests per minute | 50 RPM |
| Input tokens per minute | 50,000 ITPM (Haiku) / 30,000 ITPM (Sonnet) |
| Output tokens per minute | 8,000-10,000 OTPM |
| Monthly spend limit | $100 |
| Minimum deposit | $5 |

**Important nuance**: The 50 RPM limit operates on a per-second basis (effectively 1 request/second maximum to prevent bursting).

**At MAU 8K, is Tier 1 sufficient?**
- Average concurrent users: ~200 (2.5% of MAU online simultaneously)
- Peak concurrent: ~500
- Requests needing Claude: ~30% of user actions (most are board moves, not explanations)
- Peak Claude requests: ~150/minute = **exceeds Tier 1 (50 RPM)**
- **Recommendation**: Budget for Tier 2 ($40 deposit threshold) which provides higher RPM limits. At $47-95/month spend, automatic tier advancement will occur.

**Tier Advancement Path:**

| Tier | Deposit | Monthly Spend Limit | Expected Timeline |
|------|---------|--------------------|--------------------|
| Tier 1 | $5 | $100 | Month 1 |
| Tier 2 | $40 | $500 | Month 1-2 (automatic after consistent usage) |
| Tier 3 | $200 | $1,000 | Only if MAU exceeds 15K |
| Tier 4 | $400 | $5,000 | Only if MAU exceeds 50K |

### 1.6 Graceful Degradation Pattern

The March 2, 2026 Claude API outage (14+ hours for web/mobile, ~1 hour for API) is a real-world reminder that no external API has 100% uptime. The baduk app must function without Claude.

**Three-Layer Degradation:**

```
Layer 1: Full Claude API (normal operation)
  ↓ (API error or timeout)
Layer 2: Redis-cached responses (serve previous answers for similar positions)
  ↓ (cache miss)
Layer 3: Template-based explanations (pre-written, keyed by move category)
  ↓ (unknown category)
Layer 4: KataGo-only mode (show raw analysis without natural language)
```

**Template Categories for Layer 3:**
- Opening moves (joseki, fuseki patterns) — ~50 templates
- Tactical moves (capture, escape, connect, cut) — ~30 templates
- Strategic moves (influence, territory, aji) — ~20 templates
- Endgame moves (yose patterns) — ~15 templates
- Life-and-death moves (living shapes, killing moves) — ~25 templates
- Generic fallback ("KataGo evaluates this move as [score]. [basic category description]") — 1 template

**Total: ~141 templates** covering the most common explanations. At MAU 8K, users will encounter template responses only during API outages, and even then, the explanations are factually accurate (backed by KataGo data), just less conversational.

---

## 2. Why NOT Multi-Model

### 2.1 The Case Against Multi-Model at This Scale

The industry consensus for enterprise-scale applications is clear: multi-model routing optimizes cost and capability. But the industry consensus is wrong **for a MAU 8K application built by AI agents with no human developers on call**.

**What multi-model adds to the codebase:**

| Component | Single Provider | Multi-Provider |
|-----------|----------------|----------------|
| SDK dependencies | 1 (`@anthropic-ai/sdk`) | 3+ (Anthropic, OpenAI, Google) |
| Prompt formats | 1 (Anthropic Messages API) | 3+ (each with different schemas) |
| Response parsing | 1 normalization layer | 3+ parsers + normalization |
| Error handling | 1 error hierarchy | 3+ error types + mapping |
| Rate limit logic | 1 set of rules | 3+ sets with different semantics |
| Billing dashboards | 1 | 3+ |
| API key management | 1 secret | 3+ secrets |
| Testing surface | 1 mock | 3+ mocks |
| Behavioral consistency | Guaranteed | Requires output normalization |
| Prompt engineering | 1 prompt per use case | 3+ prompts per use case (models respond differently) |
| Monitoring | 1 provider health | 3+ provider health + routing metrics |

**Conservative estimate**: Multi-model adds 2,000-4,000 lines of integration code, creates 3x the testing surface, and requires ongoing prompt maintenance across multiple models.

### 2.2 The Subscription Account Risk (OpenAI/Gemini)

The constraint is explicit: OpenAI and Gemini access is via subscription accounts only, not API keys. This means:

- **TOS violation risk**: Using subscription access programmatically may violate Terms of Service
- **No SLA**: Subscription accounts have no uptime guarantees for programmatic access
- **Rate limits unknown**: Subscription rate limits are designed for human interaction, not API-scale usage
- **Authentication fragility**: Session tokens expire, require browser-based re-authentication
- **No billing predictability**: Fixed monthly subscription regardless of usage volume
- **Legal exposure**: Automated access to subscription services is explicitly prohibited by most providers

**This is not a "nice to have that we're choosing to skip." It is a technical and legal non-starter.**

### 2.3 When "Good Enough" from Claude Is Optimal

For a baduk explanation app, the quality bar is:
1. Factually correct (KataGo provides the ground truth; Claude explains it)
2. Natural-sounding Korean/English explanations
3. Appropriate for the player's skill level
4. Delivered within 2-3 seconds

Claude Haiku 4.5 meets all four criteria for 80% of queries. Sonnet 4.6 meets them for the remaining 15% (complex positions). The 5% template fallback meets criteria 1 and 4.

**No second model provider improves any of these four metrics.** The bottleneck is never "Claude doesn't understand baduk well enough" — it's "the explanation needs to be grounded in KataGo's analysis." Any LLM receiving the same KataGo JSON produces a comparable explanation. The differentiation is in prompt engineering, not model provider.

### 2.4 The Real Cost of Multi-Model

The enterprise case study cited in industry research: "reduced monthly LLM spend from $50,000 to $27,000 by routing 60% of requests to cheaper models." That's a $23,000/month saving that justifies maintaining a multi-model routing layer.

**Our scenario**: Claude API costs ~$47-95/month. Even if a second provider were 50% cheaper for some queries, the savings would be $15-30/month — less than the cost of one hour of engineering time to maintain the integration.

---

## 3. Minimal External Dependencies

### 3.1 Dependency Audit: What Is Truly Needed?

| Capability | External Service | Self-Hosted Alternative | Recommendation |
|-----------|-----------------|------------------------|----------------|
| Go analysis engine | None (KataGo local) | N/A — already local | LOCAL |
| Natural language explanations | Claude API | Template-based fallback | CLAUDE API + TEMPLATES |
| Translation (KO/EN) | Claude API | Static translation files | CLAUDE API (multi-language prompt) |
| Database | None (PG 16 local) | N/A — already local | LOCAL |
| Caching | None (Redis 7.2 local) | N/A — already local | LOCAL |
| Full-text search | Elasticsearch/Algolia | PostgreSQL FTS with GIN index | PG FTS (LOCAL) |
| Email delivery | SendGrid/SES | None at launch; add later | DEFER |
| File storage | S3/R2 | Local filesystem + PG BYTEA | LOCAL (MAU 8K) |
| Authentication | Auth0/Clerk | NextAuth.js (self-hosted) | SELF-HOSTED |
| Monitoring | Datadog/New Relic | Self-hosted Prometheus + Grafana | SELF-HOSTED |
| Error tracking | Sentry | Console logs + PG error table | SELF-HOSTED (MVP) |
| Analytics | Mixpanel/Amplitude | Custom events in PG | SELF-HOSTED |
| Push notifications | Firebase/OneSignal | Web Push API (native) | NATIVE |
| CDN | Cloudflare/Vercel | Hetzner + nginx cache | HETZNER |
| DNS | Cloudflare | Hetzner DNS | HETZNER |

**Result: ONE external API dependency (Claude API). Everything else is local or self-hosted.**

### 3.2 Claude API as All-in-One Language Service

Claude API can handle multiple language tasks that would otherwise require separate services:

| Task | Dedicated Service Alternative | Claude API Approach | Quality |
|------|------------------------------|--------------------|----|
| Move explanations | N/A (unique to this app) | Primary use case | Excellent |
| KO/EN translation | DeepL API ($5.49/M chars) | Include in prompt: "Respond in Korean" | Very Good |
| Content summarization | N/A | Batch API for article summaries | Very Good |
| Content generation | N/A | Batch API for lessons, puzzles | Very Good |
| User question answering | N/A | Real-time Haiku queries | Excellent |
| Sentiment analysis | AWS Comprehend | Include in prompt if needed | Good (but rarely needed) |

**Key insight**: For a baduk app, translation is not a separate service call. The prompt simply includes `"Respond in Korean at {skill_level} difficulty."` This is one API call, not two. Claude handles Korean natively with high quality.

### 3.3 PostgreSQL Full-Text Search vs External Search

For a baduk app at MAU 8K, the search requirements are:
- Search game records by player name, date, result
- Search lesson content by topic
- Search move patterns (this is coordinate-based, not text-based)

**PostgreSQL FTS is more than sufficient:**
- Datasets under 1 million records: PG FTS handles comfortably with GIN index
- Simple keyword search: native `to_tsvector` / `to_tsquery`
- Query time with GIN index on 100K records: 5-10ms
- Zero additional infrastructure, zero synchronization concerns
- Korean language support via `simple` dictionary or `pg_bigm` extension

**When to consider Elasticsearch**: Only if dataset exceeds 5 million records, or if fuzzy matching / complex faceted navigation becomes critical. At MAU 8K with ~50K games/year, this threshold is years away.

**Alternative worth watching**: `pg_search` (ParadeDB) embeds Tantivy (Rust-based Lucene alternative) inside PostgreSQL. Elastic-quality search with zero additional infrastructure. Currently newer but promising for future consideration.

---

## 4. Proven Integration Patterns

### 4.1 REST API Best Practices for Claude API

**SDK Choice: `@anthropic-ai/sdk` (Official TypeScript SDK)**
- Maintained by Anthropic directly
- Built-in type safety, streaming support, retry logic
- Error hierarchy: `APIError`, `RateLimitError`, `AuthenticationError`, etc.
- Node.js 20+ required (compatible with Node.js 22)

**Basic Integration Structure:**

```typescript
// claude-client.ts — singleton module
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,  // server-side only
  timeout: 30_000,       // 30s default timeout
  maxRetries: 2,         // SDK built-in retry
});

// Model routing
type ModelTier = 'haiku' | 'sonnet';

function selectModel(context: AnalysisContext): ModelTier {
  if (context.winrateDelta > 15) return 'sonnet';
  if (context.isTeachingMode) return 'sonnet';
  if (context.variationDepth > 3) return 'sonnet';
  return 'haiku';
}
```

**Key practices:**
1. **Pin model versions**: Use `claude-haiku-4-5-20250315` not `claude-haiku-4-5-latest`. Behavior must not change without explicit deployment.
2. **Set `max_tokens` explicitly**: Always specify — prevents runaway token usage.
3. **Server-side only**: Never expose API keys to the client. All Claude calls go through your Node.js backend.
4. **Structured output**: Use JSON mode or tool_use for structured responses that feed into the UI.

### 4.2 Circuit Breaker Pattern

**Library: `opossum` (1,560+ GitHub stars, maintained by Red Hat/Nodeshift team)**
- Production-proven since 2017 (9+ years)
- Node.js 20+ compatible
- Prometheus metrics integration via `opossum-prometheus`
- Three states: CLOSED (normal) -> OPEN (failing, reject fast) -> HALF-OPEN (testing recovery)

**Configuration for Claude API:**

```typescript
import CircuitBreaker from 'opossum';

const claudeBreaker = new CircuitBreaker(callClaudeAPI, {
  timeout: 15_000,           // 15s before considering a request failed
  errorThresholdPercentage: 50,  // open circuit after 50% failure rate
  resetTimeout: 30_000,      // try again after 30s
  rollingCountTimeout: 60_000,   // measure failure rate over 60s window
  volumeThreshold: 5,        // minimum 5 requests before circuit can open
});

claudeBreaker.on('open', () => {
  logger.warn('Claude API circuit OPEN — falling back to templates');
  metrics.increment('claude.circuit.open');
});

claudeBreaker.on('halfOpen', () => {
  logger.info('Claude API circuit HALF-OPEN — testing recovery');
});

claudeBreaker.on('close', () => {
  logger.info('Claude API circuit CLOSED — normal operation resumed');
  metrics.increment('claude.circuit.close');
});

claudeBreaker.fallback(() => {
  return generateTemplateFallback(currentContext);
});
```

**Why these specific values:**
- **15s timeout**: KataGo analysis + Claude generation should complete in <10s. 15s gives headroom.
- **50% error threshold**: Aggressive — if half the requests fail, something is seriously wrong.
- **30s reset**: Give Anthropic's infrastructure 30s to recover before probing again.
- **5 request volume**: Don't open the circuit on 1-2 transient errors during low-traffic periods.

### 4.3 Retry with Exponential Backoff and Jitter

The `@anthropic-ai/sdk` has built-in retry logic, but for finer control:

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry client errors (4xx except 429)
      if (error instanceof Anthropic.APIError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      if (attempt === options.maxRetries) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        options.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage
const response = await callWithRetry(
  () => client.messages.create({ /* ... */ }),
  { maxRetries: 3, baseDelay: 1000, maxDelay: 10000 }
);
```

**Retry rules:**
- Retry: 429 (rate limit), 500, 502, 503, 529 (overloaded)
- Do NOT retry: 400 (bad request), 401 (auth), 403 (forbidden), 404
- Jitter prevents thundering herd when multiple requests retry simultaneously
- Cap at 10s delay — beyond that, the user is better served by a template fallback

### 4.4 Response Caching with Redis

**Two-tier caching strategy:**

```
Tier 1: Exact Match Cache (Redis hash)
  Key: claude:exact:{hash(model + systemPrompt + userMessage)}
  TTL: 24 hours
  Hit rate: ~15-25% (same position, same question)

Tier 2: Semantic/Position Cache (Redis sorted set)
  Key: claude:position:{sgf_normalized_hash}
  Value: JSON array of cached explanations for this position
  TTL: 7 days
  Hit rate: ~10-15% (same position, different phrasing)
```

**Tier 1 implementation:**

```typescript
import { createHash } from 'crypto';

function cacheKey(model: string, systemPrompt: string, userMessage: string): string {
  const hash = createHash('sha256')
    .update(`${model}:${systemPrompt}:${userMessage}`)
    .digest('hex')
    .slice(0, 16);
  return `claude:exact:${hash}`;
}

async function getCachedOrCall(params: MessageParams): Promise<string> {
  const key = cacheKey(params.model, params.system, params.userMessage);

  // Check cache first
  const cached = await redis.get(key);
  if (cached) {
    metrics.increment('claude.cache.hit');
    return cached;
  }

  // Call Claude API
  const response = await claudeBreaker.fire(params);

  // Cache the response
  await redis.setex(key, 86400, response.content[0].text);  // 24h TTL
  metrics.increment('claude.cache.miss');

  return response.content[0].text;
}
```

**Tier 2 (position-based) implementation:**

For baduk, many users will ask about the same position. A normalized board hash (ignoring move order, capturing only stone positions) allows cache hits across different games that reach the same position. This is highly effective for common joseki and fuseki patterns.

**Estimated combined cache hit rate: 25-40%** at MAU 8K, reducing Claude API calls (and costs) proportionally.

### 4.5 Async Processing with BullMQ

**Library: BullMQ (Redis-based queue, successor to Bull)**
- Production-proven since 2011 (15+ years for the Bull family)
- Powers video transcoding, AI pipelines, payment processing at scale
- Features: retries with configurable backoff, rate limiting, job priorities, concurrency control

**Baduk App Queue Architecture:**

```
Queue: "game-review" (post-game batch analysis)
  Priority: LOW
  Concurrency: 2
  Rate limit: 10 jobs/minute (stay under Claude RPM limit)
  Retry: 3 attempts, exponential backoff

Queue: "live-explanation" (real-time move explanations)
  Priority: HIGH
  Concurrency: 5
  Rate limit: 30 jobs/minute
  Retry: 1 attempt, then template fallback

Queue: "content-generation" (lessons, puzzles)
  Priority: LOWEST
  Concurrency: 1
  Rate limit: 5 jobs/minute
  Retry: 5 attempts (not urgent)
```

**Note**: The Proven Stack PRD argues against BullMQ at launch, preferring an in-memory FIFO queue. This is a valid position for KataGo queuing (local process, no external dependency). For Claude API queuing, BullMQ adds value because:
1. Redis is already in the stack (no new dependency)
2. Rate limiting is critical for API cost control
3. Job persistence survives process restarts
4. Priority queues ensure live explanations trump batch analysis

**Recommendation**: In-memory queue for KataGo (per Proven Stack). BullMQ for Claude API queues (different risk profile — external API needs rate limiting and persistence).

### 4.6 Health Check and Monitoring

**Three-layer monitoring:**

```
Layer 1: Application Health (Node.js)
  /health endpoint: { status: "ok", uptime: 12345, memory: {...} }
  Checked by: Coolify built-in health checks

Layer 2: Claude API Health
  Periodic probe: Send minimal "ping" request every 5 minutes
  Track: response time, error rate, circuit breaker state
  Dashboard: Prometheus gauge + Grafana panel

Layer 3: Business Metrics
  Claude API spend: daily aggregate from response headers
  Cache hit rate: Redis-tracked counter
  Template fallback rate: application counter
  Queue depth: BullMQ dashboard (Bull Board)
```

**Prometheus metrics to export:**

```
claude_api_requests_total{model, status}     — counter
claude_api_latency_seconds{model}            — histogram
claude_api_tokens_used{model, direction}     — counter
claude_circuit_state{state}                  — gauge
claude_cache_hit_total{tier}                 — counter
claude_fallback_total{reason}                — counter
claude_monthly_spend_dollars                 — gauge
```

**Self-hosted monitoring stack:**
- Prometheus: scrapes metrics every 15s
- Grafana: dashboards + alerts
- Both run on the same Hetzner VPS (minimal resource overhead)
- Uptime Kuma (open-source, self-hosted) for external uptime monitoring

---

## 5. Cost Optimization

### 5.1 Claude API Cost Model

**Current pricing (March 2026):**

| Model | Input/1M tokens | Output/1M tokens | Prompt Cache Write | Prompt Cache Read | Batch Discount |
|-------|-----------------|-------------------|--------------------|-------------------|----------------|
| Haiku 4.5 | $1.00 | $5.00 | 1.25x | 0.10x | 50% |
| Sonnet 4.6 | $3.00 | $15.00 | 1.25x | 0.10x | 50% |
| Opus 4.6 | $5.00 | $25.00 | 1.25x | 0.10x | 50% |

### 5.2 Usage Estimation at Various MAU Levels

**Assumptions:**
- Average session: 2 games, 15 moves per game requiring explanation
- Average explanation: ~300 input tokens (system prompt cached) + ~150 variable tokens + ~200 output tokens
- 30% of sessions include post-game review (batch eligible)
- Users average 8 sessions/month
- Prompt cache hit rate: 80% (system prompt portion)
- Redis cache hit rate: 30% (position/exact match)

**Per-request cost breakdown (Haiku, with caching):**

| Component | Tokens | Unit Cost | With Cache | Effective Cost |
|-----------|--------|-----------|------------|----------------|
| System prompt (cached) | 2,000 | $1.00/M | 0.10x (80% hit) | $0.000_44 |
| Variable input | 500 | $1.00/M | No cache | $0.000_50 |
| Output | 200 | $5.00/M | No cache | $0.001_00 |
| **Total per request** | | | | **$0.001_94** |

**With 30% Redis cache hit rate, effective cost per "user-facing request": ~$0.001_36**

**Monthly cost estimates:**

| MAU | Sessions/mo | Claude Requests/mo | Haiku (80%) | Sonnet (15%) | Batch Reviews | Total/mo |
|-----|-------------|-------------------|-------------|--------------|---------------|----------|
| 1K | 8,000 | 168,000* | $16 | $9 | $4 | **~$29** |
| 5K | 40,000 | 840,000* | $80 | $44 | $19 | **~$143** → optimized: **~$70** |
| 8K | 64,000 | 1,344,000* | $128 | $70 | $30 | **~$228** → optimized: **~$95** |
| 25K | 200,000 | 4,200,000* | $401 | $220 | $95 | **~$716** → optimized: **~$295** |

*Before Redis cache deduction (30% reduction applied in "optimized" column, plus prompt caching*

**Key insight at MAU 8K**: The optimized cost of ~$95/month includes aggressive caching (prompt + Redis), batch API for reviews, and Haiku-default routing. This is well within Tier 2 spending limits ($500/month).

**More aggressive optimization** (if budget is tight):
- Increase template coverage to handle 20% of queries instead of 5%: saves ~15%
- Reduce output token limit to 150 (shorter explanations): saves ~25%
- Cache post-game reviews permanently (never re-analyze same game): saves ~10% of batch costs
- With all optimizations: **~$47/month at MAU 8K**

### 5.3 Infrastructure Cost (Hetzner + Coolify)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| Application server | Hetzner CX22 (2 vCPU, 4GB RAM, 40GB NVMe) | ~$4.50 (post-April 2026 pricing) |
| Database (PG 16) | Same server | $0 (included) |
| Redis 7.2 | Same server | $0 (included) |
| KataGo (CPU) | Same server | $0 (included) |
| Coolify | Self-hosted on same server | $0 |
| DNS | Hetzner DNS | $0 (free) |
| SSL | Let's Encrypt via Coolify | $0 |
| Monitoring | Prometheus + Grafana on same server | $0 |
| **Backup server** | Hetzner Storage Box (100GB) | ~$3.50 |
| **Total infrastructure** | | **~$8-12/month** |

**Note**: Post-April 2026 Hetzner pricing increase (~30%) is factored in. The CX22 moves from ~$3.79 to ~$4.50-5.00. For MAU 8K, a single CX22 is sufficient since KataGo CPU (Eigen backend) and Node.js comfortably share 4GB RAM.

**When to upgrade**: If KataGo analysis queue consistently fills (>80% capacity), upgrade to CPX32 (4 vCPU, 8GB RAM) at ~$12/month. This threshold is likely around MAU 15-20K.

### 5.4 Total Monthly Cost Summary

| Item | MAU 1K | MAU 5K | MAU 8K | MAU 25K |
|------|--------|--------|--------|---------|
| Claude API (optimized) | $29 | $70 | $47-95 | $295 |
| Hetzner infrastructure | $8 | $8 | $8-12 | $12-24 |
| Domain name | $1 | $1 | $1 | $1 |
| **Total** | **$38** | **$79** | **$56-108** | **$308-320** |

No other external paid services required. Every other capability is self-hosted.

---

## 6. Risk Analysis and Mitigations

### 6.1 Single Provider Dependency Risk

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Claude API outage (hours) | Medium (happened March 2026) | Medium — degraded UX, not broken | 3-layer fallback (cache -> template -> KataGo-only) |
| Claude API outage (days) | Very Low | High — extended degraded UX | Template mode carries full functionality; expand template library |
| Claude API pricing increase | Low-Medium | Low-Medium — costs increase | Budget has 2-3x headroom; can increase template usage to reduce API calls |
| Claude API deprecation of Haiku | Low | Medium — forces migration to different model | Pin model versions; Anthropic provides deprecation notice periods |
| Anthropic company risk | Very Low | Very High | Template fallback is permanent; migrate to alternative API if ever needed |
| Rate limit insufficient | Low (at MAU 8K) | Medium — some users get template responses | Queue-based rate smoothing; tier upgrade |

**Net assessment**: The single-provider risk is real but manageable. The 3-layer fallback ensures the app never breaks — it only loses the "conversational AI" polish. KataGo analysis (the core value) is entirely local and unaffected by any API outage.

### 6.2 Claude API-Specific Failure Modes

| Failure Mode | Detection | Response |
|-------------|-----------|----------|
| 429 Too Many Requests | SDK error type | Exponential backoff, queue priority shuffle |
| 500 Internal Server Error | SDK error type | Retry 2x, then circuit break |
| 529 Overloaded | SDK error type | Back off 60s, reduce concurrency |
| Timeout (>15s) | Circuit breaker timeout | Return cached/template response |
| Malformed response | JSON parse failure | Log, return template response |
| Token limit exceeded | Response truncated | Reduce input context, retry with shorter prompt |
| Unexpected model behavior | Output validation | Log for review, return template if quality check fails |

### 6.3 The March 2026 Outage Lesson

The March 2, 2026 outage affected web/mobile/API services globally for 14+ hours. Key takeaways:

1. **The API recovered faster than web** (~1 hour vs 14+ hours). Direct API integration is more resilient than web-based access.
2. **Root cause was authentication infrastructure**, not model serving. API key-based auth was less affected than SSO/OAuth.
3. **2,000 users reported issues at peak** — relatively small blast radius, but 100% for affected users.
4. **Teams with fallback mechanisms reported minimal disruption**. Teams without experienced "complete outage."

**Implication for our architecture**: The 3-layer fallback design is not over-engineering. It is a requirement validated by a real incident 8 days ago.

---

## 7. Recommendation Summary

### Architecture: Single-Provider + Maximum Self-Hosting

```
┌─────────────────────────────────────────────────────────────┐
│                    Hetzner CX22 VPS                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Next.js 15  │  │  PostgreSQL  │  │  Redis 7.2       │  │
│  │  (App + API) │  │  16          │  │  (Cache + Queue)  │  │
│  └──────┬───────┘  │  - Game data │  │  - Response cache │  │
│         │          │  - Users     │  │  - BullMQ jobs    │  │
│         │          │  - FTS index │  │  - Session store  │  │
│         │          └──────────────┘  └──────────────────┘  │
│         │                                                   │
│  ┌──────┴───────────────────────────────────────────────┐   │
│  │  Claude API Integration Layer                        │   │
│  │                                                      │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │   │
│  │  │  Circuit   │  │  Model      │  │  Prompt      │  │   │
│  │  │  Breaker   │  │  Router     │  │  Cache Mgr   │  │   │
│  │  │  (opossum) │  │  (H/S/Tmpl) │  │  (Anthropic) │  │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘  │   │
│  │                                                      │   │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │   │
│  │  │  Redis     │  │  Retry      │  │  Rate        │  │   │
│  │  │  Response  │  │  + Backoff  │  │  Limiter     │  │   │
│  │  │  Cache     │  │             │  │  (BullMQ)    │  │   │
│  │  └────────────┘  └─────────────┘  └──────────────┘  │   │
│  │                                                      │   │
│  │  Fallback: Templates (141 pre-written explanations)  │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                   │
│  ┌──────┴───────┐          ┌─────────────────────────┐     │
│  │  KataGo      │          │  Monitoring              │     │
│  │  (local CPU) │          │  Prometheus + Grafana    │     │
│  │  Eigen/b18c  │          │  + Uptime Kuma           │     │
│  │  In-mem queue│          └─────────────────────────┘     │
│  └──────────────┘                                           │
│                                                             │
│              External: api.anthropic.com ONLY               │
└─────────────────────────────────────────────────────────────┘
```

### Decision Matrix

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM Provider | Claude API only | Single SDK, single billing, proven quality for explanations |
| Default model | Haiku 4.5 | 80% of queries, 3x cheaper than Sonnet, fast |
| Escalation model | Sonnet 4.6 | 15% of queries, complex positions requiring deep reasoning |
| Fallback | 141 templates | 5% (API failures), factually accurate via KataGo data |
| Prompt caching | Enabled (5-min TTL) | 90% input savings on system prompt, breaks even after 1 read |
| Batch API | Post-game reviews | 50% discount on highest-token use case |
| Response caching | Redis, 2-tier | 25-40% API call reduction |
| Circuit breaker | opossum | 9+ years production history, Prometheus integration |
| Job queue | BullMQ (Claude), in-memory (KataGo) | Different risk profiles warrant different solutions |
| Search | PostgreSQL FTS | Zero additional infrastructure, sufficient at <1M records |
| Translation | Claude API (in-prompt) | No additional service needed |
| Monitoring | Prometheus + Grafana (self-hosted) | Free, proven, adequate for MAU 8K |
| Multi-model | REJECTED | $15-30/month savings does not justify 2,000-4,000 LOC of integration code |

### What This Architecture Sacrifices

1. **No multi-provider failover**: If Claude API is completely down, users get template explanations (accurate but less conversational)
2. **No frontier model diversity**: Cannot leverage GPT-5 for specific tasks or Gemini for multimodal
3. **No edge-case model optimization**: Some queries might be 5-10% better with a specialized model
4. **No competitive pricing leverage**: Cannot negotiate rates by threatening to switch providers

### What This Architecture Guarantees

1. **One dependency**: Total external API surface is one endpoint
2. **Predictable costs**: $47-95/month at MAU 8K, no surprise billing from multiple providers
3. **Minimal codebase complexity**: One SDK, one prompt format, one error hierarchy
4. **Always functional**: KataGo + templates provide 100% uptime for core analysis
5. **Debuggable**: When something breaks with Claude API, there is exactly one place to look
6. **Maintainable by AI agents**: Less integration code = fewer things for Claude Code to get wrong

---

## Sources

- [Claude API Pricing — Official](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude API Prompt Caching — Official](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude API Rate Limits — Official](https://platform.claude.com/docs/en/api/rate-limits)
- [Building with Extended Thinking — Official](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Claude API Quota Tiers — Complete Guide 2026](https://www.aifreeapi.com/en/posts/claude-api-quota-tiers-limits)
- [Claude API Pricing Guide 2026](https://www.aifreeapi.com/en/posts/claude-api-pricing-per-million-tokens)
- [Anthropic Claude API Pricing 2026 — MetaCTO](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Claude Haiku 4.5 — Anthropic](https://www.anthropic.com/claude/haiku)
- [Claude Sonnet 4.6 — Anthropic](https://www.anthropic.com/claude/sonnet)
- [Claude Haiku 4.5 vs Sonnet: Speed, Cost, and Strategy](https://sider.ai/blog/ai-tools/claude-haiku-4_5-vs_claude-sonnet-speed-cost-and-strategy-in-ai-model-segmentation)
- [Multi AI Model Platform vs Single LLM Provider 2026](https://customgpt.ai/multi-ai-model-platform-vs-single-llm-provider/)
- [Multi-Model vs Single Provider 2025 — Liminal](https://www.liminal.ai/blog/multi-model-vs-single-provider-ai-platforms)
- [Claude AI Outage March 2026 — API Status Check](https://apistatuscheck.com/blog/claude-march-2026-outage-analysis)
- [Claude AI Outage March 2026 — Resilience Playbook](https://www.digitalapplied.com/blog/claude-ai-outage-march-2026-enterprise-resilience-playbook)
- [Is Claude Down? March 2026 — DeployFlow](https://deployflow.co/blog/claude-anthropic-outage-protect-claude-infrastructure/)
- [Anthropic Post-Mortem of Three Recent Issues](https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues)
- [Circuit Breaker Pattern — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html)
- [opossum — Node.js Circuit Breaker (GitHub)](https://github.com/nodeshift/opossum)
- [opossum-prometheus — Prometheus Metrics](https://www.npmjs.com/package/opossum-prometheus)
- [Building Resilient APIs with Node.js](https://medium.com/@erickzanetti/building-resilient-apis-with-node-js-47727d38d2a9)
- [Resilient Node.js Microservices — Production Guide](https://www.thebasictechinfo.com/node-js-frameworks/resilient-node-js-microservices-with-circuit-breakers-retries-and-rate-limiting-production-guide/)
- [Node.js Retry Logic with Exponential Backoff](https://oneuptime.com/blog/post/2026-01-06-nodejs-retry-exponential-backoff/view)
- [Redis Semantic Caching — Guide](https://redis.io/blog/what-is-semantic-caching/)
- [Cache REST API Responses with Node.js and Redis — Tutorial](https://redis.io/tutorials/how-to-cache-rest-api-responses-using-redis-and-nodejs/)
- [Redis LLM Caching](https://redis.io/docs/latest/develop/ai/redisvl/user_guide/llmcache/)
- [BullMQ — GitHub](https://github.com/taskforcesh/bullmq)
- [Implementing Webhook System with BullMQ](https://blog.taskforce.sh/implementing-a-webhook-system-with-bullmq/)
- [PostgreSQL FTS vs Elasticsearch — Neon](https://neon.com/blog/postgres-full-text-search-vs-elasticsearch)
- [Why We Replaced Elasticsearch with Postgres FTS](https://blog.blockost.com/why-we-replaced-elasticsearch-with-postgres-full-text-search)
- [pg_search: Elastic-Quality FTS Inside Postgres — ParadeDB](https://www.paradedb.com/blog/introducing-search)
- [Hetzner Cloud VPS Pricing (March 2026)](https://costgoat.com/pricing/hetzner)
- [Hetzner Price Adjustment April 2026](https://www.hetzner.com/pressroom/statement-price-adjustment/)
- [@anthropic-ai/sdk — npm](https://www.npmjs.com/package/@anthropic-ai/sdk)
- [anthropic-sdk-typescript — GitHub](https://github.com/anthropics/anthropic-sdk-typescript)
- [Claude Code OTel Monitoring — GitHub](https://github.com/ColeMurray/claude-code-otel)
- [Claude Code Metrics Dashboard with Grafana — Sealos](https://sealos.io/blog/claude-code-metrics/)
- [Extended Thinking Tips — Official](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/extended-thinking-tips)
- [LLM API Pricing March 2026 Comparison — TLDL](https://www.tldl.io/resources/llm-api-pricing-2026)
- [Coolify — GitHub](https://github.com/coollabsio/coolify)
