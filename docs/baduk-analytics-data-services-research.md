# Baduk App — Analytics & Data Services Integration Research

**Version**: 1.0
**Date**: 2026-03-10
**Context**: AI Baduk App, MAU 8K (target 25K → 100K), Global users
**Tech Stack**: Node.js 22, Next.js 15, PG 16, Redis 7.2, Coolify+Hetzner
**Builder**: AI Agents (Claude Code)

---

## Table of Contents

1. [Product Analytics — SaaS Comparison](#1-product-analytics--saas-comparison)
2. [Error Tracking & APM](#2-error-tracking--apm)
3. [Feature Flags & Experimentation](#3-feature-flags--experimentation)
4. [External Go Data Integration](#4-external-go-data-integration)
5. [CDN & Asset Delivery](#5-cdn--asset-delivery)
6. [Cost Comparison Table](#6-cost-comparison-table)
7. [Recommended Stack](#7-recommended-stack)
8. [Implementation Priority](#8-implementation-priority)

---

## 1. Product Analytics — SaaS Comparison

### 1.1 PostHog Cloud

**Free Tier (2026)**:
- 1M product analytics events/month
- 5,000 session recordings/month
- 1M feature flag requests/month
- 100K error tracking events/month
- 1,500 survey responses/month
- 1-year data retention
- No credit card required

**Pricing After Free Tier**: $0.00005/event (~$50 per additional 1M events), with volume discounts up to 82%.

**Strengths for a Baduk App**:
- All-in-one: analytics + session replay + feature flags + A/B testing + error tracking in a single SDK
- Developer-first philosophy aligns with AI-agent-built codebase
- SQL querying and API access on the free tier
- No team size restrictions
- Open-source core (can self-host later if needed)

**Baduk-Specific Events to Track**:
```
game_started          — board size, color, opponent type (AI/human), time control
game_ended            — result, move count, duration, resignation vs score
analysis_requested    — position complexity, KataGo response time, queue depth
explanation_viewed    — explanation type (template/LLM), language, user rank
move_played           — move number, time spent, whether AI suggestion was shown
review_started        — game age, review type (self/AI/shared)
subscription_upgraded — from_tier, to_tier, trigger_event
joseki_explored       — sequence length, variation count
tsumego_attempted     — problem difficulty, time to solve, correct/incorrect
```

**Key Funnels**:
```
Visit → Signup → First Game → AI Analysis Used → Premium Conversion
Visit → Signup → 3 Games in Week 1 → Retained Week 2 → Retained Month 1
Free User → Feature Gate Hit → Upgrade Prompt Viewed → Payment Started → Completed
```

**Cohort Analysis**:
- Retention by signup week (standard)
- Retention by initial rank (kyu vs dan)
- Retention by first opponent type (AI vs human)
- Feature adoption by user segment (casual vs competitive)

**A/B Testing Use Cases**:
- Template vs LLM explanations (engagement, comprehension, retention)
- Board size default (19x19 vs 9x9 for new users)
- Onboarding flow variations (tutorial vs immediate play)

### 1.2 Mixpanel

**Free Tier (2026)**:
- 1M events/month (reduced from 20M in late 2025)
- 5 saved reports per user
- 10K session replays/month
- Funnels, retention, flows included
- No credit card required

**Pricing After Free Tier**: $0.28 per 1K events after first 1M.

**Strengths**: Polished UI, excellent funnel visualization, easy for non-technical users. Recently added experimentation and feature flags (late 2025).

**Weaknesses for Baduk App**:
- Reduced free tier (was 20M, now 1M — trend is concerning)
- No built-in error tracking
- No session replay on free tier prior to recent additions
- Less developer-focused than PostHog
- Separate tools needed for feature flags (until recently)

### 1.3 Amplitude

**Free Tier (2026)**:
- 50,000 Monthly Tracked Users (MTU-based, not event-based)
- Unlimited events per MTU
- 12-month data retention
- 10 saved charts
- Basic session replay
- Unlimited feature flags

**Pricing After Free Tier**: Plus plan from $49/month (up to 300K MTUs or 25M events).

**Strengths**: Deep behavioral analytics, warehouse-native queries, strong enterprise features. MTU-based pricing is advantageous for high-event-per-user apps (games generate many events per session).

**Weaknesses for Baduk App**:
- Enterprise-oriented, heavier than needed at MAU 8K
- 50K MTU free tier is generous but the 10-chart limit is restrictive
- Less integrated feature flag/experiment tooling compared to PostHog

### 1.4 Verdict: PostHog Cloud

| Criterion | PostHog | Mixpanel | Amplitude |
|-----------|---------|----------|-----------|
| Free events/month | 1M events | 1M events | Unlimited (50K MTU) |
| Session replay (free) | 5,000 | 10,000 | Basic |
| Feature flags (free) | 1M requests | Limited | Unlimited |
| A/B testing (free) | Yes | Recently added | Yes |
| Error tracking | Built-in (100K) | No | No |
| Developer-friendliness | Excellent | Good | Moderate |
| All-in-one | Yes | No | Partial |
| Self-host option | Yes | No | No |
| Free tier stability | Stable | Reduced 20x in 2025 | Stable |

**Recommendation: PostHog Cloud**

For a game app built by AI agents with MAU 8K:
- A Go game averages ~30 events per session (moves, analysis requests, navigation). At 8K MAU with 3 sessions/user/month, that is ~720K events/month — well within the 1M free tier.
- The all-in-one value (analytics + flags + experiments + error tracking + session replay) eliminates the need for 3-4 separate integrations.
- At MAU 25K (~2.25M events/month), the cost would be ~$63/month. At MAU 100K (~9M events/month), ~$400/month.
- MTU-based Amplitude pricing would be more favorable at very high event volumes, but the all-in-one PostHog advantage outweighs this until MAU 100K+.

---

## 2. Error Tracking & APM

### 2.1 Sentry

**Free Tier (Developer Plan)**:
- 5,000 errors/month
- 10,000 performance units/month
- 1 user
- Unlimited projects
- 14-day free trial for paid features

**Paid Plans**: Team from $26/month, Business with volume discounts, Enterprise for compliance.

**Next.js 15 Integration**:
```bash
npx @sentry/wizard@latest -i nextjs
```

The Sentry Next.js SDK creates three initialization files:
- `instrumentation-client.ts` — browser runtime
- `sentry.server.config.ts` — Node.js runtime
- `sentry.edge.config.ts` — edge runtime

Automatic capture includes: unhandled exceptions, promise rejections, React error boundaries, API route errors, middleware errors, and source map upload for production debugging.

**LLM Monitoring (Built-in)**:
Sentry's AI Agent Monitoring supports tracing AI agent workflows including:
- Agent runs and tool calls
- Model interaction latency and token usage
- Failed tool calls and noisy third-party API detection
- Integration with Vercel AI SDK and LangChain

**Baduk-Specific Error Tracking**:
```javascript
// KataGo crash/timeout tracking
Sentry.captureException(new Error('KataGo analysis timeout'), {
  tags: { component: 'katago', error_type: 'timeout' },
  extra: { position_complexity: 847, queue_depth: 12, wait_ms: 30000 }
});

// LLM hallucination tracking (validation layer failures)
Sentry.captureMessage('LLM explanation failed validation', {
  level: 'warning',
  tags: { component: 'llm_pipeline', validation_rule: 'move_reference_check' },
  extra: { model: 'claude-sonnet', prompt_tokens: 1200, explanation_snippet: '...' }
});

// Game state corruption detection
Sentry.captureException(new Error('Invalid board state detected'), {
  tags: { component: 'rules_engine', game_id: gameId },
  extra: { move_number: 142, expected_captures: 3, actual_captures: 5 }
});
```

### 2.2 BetterStack (formerly Logtail)

**Free Tier**: Details vary; base product starts around $3K/year for enterprise. For small projects, the Vercel integration provides basic log management.

**Strengths**: Clean UI, OpenTelemetry-native, Vercel marketplace integration.

**For Baduk App**: Overkill at MAU 8K. The free Grafana Cloud tier (50GB logs) or self-hosted Loki is more cost-effective.

### 2.3 Highlight.io

**Free Tier**:
- 500 session recordings/month (3-month retention)
- 1K errors/month (3-month retention)
- 1M logs/month (30-day retention)
- 25M traces/month (30-day retention)

**Important Note**: Highlight.io has been acquired by LaunchDarkly. The docs site is no longer being updated. This creates uncertainty about the product's future direction and independence.

**For Baduk App**: The acquisition risk makes it unsuitable as a primary tool. PostHog's built-in session replay and error tracking provide equivalent functionality without vendor risk.

### 2.4 Self-Hosted Logging: Grafana Loki

**Cost**: Free (AGPL-3.0 open source), self-hosted on Hetzner. Alternatively, Grafana Cloud free tier provides 50GB logs/month + 3 users.

**Stack**: Grafana Alloy (agent) → Loki (storage) → Grafana (visualization).

**Node.js Integration**:
```javascript
// winston + winston-loki
import winston from 'winston';
import LokiTransport from 'winston-loki';

const logger = winston.createLogger({
  transports: [
    new LokiTransport({
      host: 'http://loki:3100',
      labels: { app: 'baduk-api', env: 'production' },
      json: true,
      batching: true,
      interval: 5
    })
  ]
});
```

**Loki labels for Baduk**:
```
{app="baduk-api", component="katago"}     — KataGo process logs
{app="baduk-api", component="llm"}        — LLM pipeline logs
{app="baduk-api", component="game"}       — Game state logs
{app="baduk-api", component="websocket"}  — Real-time connection logs
{app="baduk-web", component="client"}     — Client-side error logs
```

### 2.5 Verdict: Sentry + Grafana Loki

| Layer | Tool | Purpose | Cost at MAU 8K |
|-------|------|---------|----------------|
| Error tracking | Sentry (free tier) | Exceptions, LLM failures, KataGo crashes | $0 |
| Performance monitoring | Sentry (free tier) | API latency, Web Vitals | $0 |
| LLM monitoring | Sentry AI Agent Monitoring | Token usage, latency, tool call failures | $0 |
| Structured logging | Grafana Loki (self-hosted) | Application logs, audit trail | $0 (infra only) |
| Log visualization | Grafana (self-hosted) | Dashboards, alerts | $0 (infra only) |

**Alternative**: Use Grafana Cloud free tier (50GB logs) instead of self-hosting if Hetzner resources are constrained.

---

## 3. Feature Flags & Experimentation

### 3.1 PostHog Feature Flags

Since PostHog is recommended for analytics, its built-in feature flags are the natural choice.

**Free Tier**: 1M feature flag requests/month. Experiments are powered by feature flags and share the same quota.

**Pricing After Free**: $0.0001/request (1-2M), stepping down to $0.00001 at 50M+.

**At MAU 8K**: With ~24K daily active users checking flags on page load + key interactions, expect ~500K-700K requests/month — well within the free tier.

### 3.2 Unleash (Self-Hosted Alternative)

**Cost**: Free (open source), requires PostgreSQL (already in the stack).

**Minimum Resources**: unleash-server (~256MB RAM, Node.js) + existing PG instance + optional unleash-edge (~50MB RAM, Rust binary).

**Strengths**: 12K+ GitHub stars, broadest SDK ecosystem, data never leaves infrastructure, unlimited flags.

**When to Consider**: If PostHog feature flag limits are reached or if strict data sovereignty is required (GDPR-sensitive European users). Since the app already runs PG 16, adding Unleash has near-zero marginal infrastructure cost.

### 3.3 Baduk-Specific Feature Flag Use Cases

```yaml
# 1. Gradual LLM rollout
gradual_llm_rollout:
  type: percentage
  stages: [10%, 25%, 50%, 100%]
  metric: explanation_satisfaction_score
  guardrail: llm_error_rate < 5%

# 2. New board UI experiment
new_board_ui:
  type: experiment
  variants: [control, canvas_3d, svg_enhanced]
  metric: games_per_session
  audience: new_users_last_7_days

# 3. Regional payment methods
korean_payment:
  type: boolean
  condition: user.country == 'KR'
  enables: [kakaopay, toss_payments]

# 4. Beta features for testers
beta_features:
  type: boolean
  condition: user.group in ['beta_testers', 'staff']
  enables: [human_sl_mode, ai_commentary, voice_analysis]

# 5. KataGo compute allocation
katago_deep_analysis:
  type: percentage
  condition: user.tier == 'premium'
  parameter: katago_visits  # 100 for free, 1000 for premium

# 6. Difficulty-adaptive tsumego
adaptive_tsumego:
  type: experiment
  variants: [fixed_difficulty, adaptive_elo, spaced_repetition]
  metric: tsumego_completion_rate
  audience: users_with_10_plus_games
```

### 3.4 Verdict: PostHog Feature Flags (primary) + Unleash (standby)

Start with PostHog feature flags for the unified platform benefit. Keep Unleash as a self-hosted fallback if PostHog limits are hit or data sovereignty requirements emerge. The migration path is straightforward since both use similar flag evaluation models.

---

## 4. External Go Data Integration

### 4.1 Professional Game Databases

| Source | Games | Format | Access | License/Legal | Cost | Recommendation |
|--------|-------|--------|--------|---------------|------|----------------|
| **Go4Go.net** | 40,000+ (growing weekly) | SGF | Subscription + bulk download | Commercial license, EUR 9.99/year | EUR 9.99/yr | Best for curated, up-to-date pro games |
| **featurecat/go-dataset** (GitHub) | 21.1M games (18k-9p) | SGF | Direct download (10.6GB compressed) | Open (GitHub) | Free | Best for training data / large corpus |
| **PAGE Dataset** (GitHub) | 98,525 pro games (1950-2021) | SGF + annotations | GitHub download | CC BY-NC-SA 4.0 (non-commercial only) | Free | Best for annotated professional games |
| **computer-go-dataset** (GitHub) | 50,956 (TOM 9D vs 9D) | SGF | GitHub download | Open (GitHub) | Free | Good for high-level amateur games |
| **GoKifu.com** | 120,000+ | SGF (web viewer) | Web interface, no bulk API | No documented API; scraping TOS unclear | Free (view) | Risky for bulk access — no official API |
| **GOGOD** | 90,000+ pro games | SGF | Paid subscription | Commercial | ~$30/yr | Alternative to Go4Go, strong historical coverage |
| **CWI (Netherlands)** | Varies | SGF | Direct download | Academic | Free | Japanese professional game records |

**Recommended Approach**:
1. **Primary corpus**: featurecat/go-dataset (21.1M games) for pattern matching, opening book generation, and training data
2. **Professional games**: Go4Go subscription (EUR 9.99/yr) for curated, current professional games with weekly updates
3. **Annotated data**: PAGE dataset for research and explanation generation
4. **Avoid**: Scraping GoKifu.com — no documented API, unclear TOS

### 4.2 Opening Book / Joseki Database

| Source | Type | Access | Technical Details | Recommendation |
|--------|------|--------|-------------------|----------------|
| **Waltheri's Go Pattern Search** | Position search in 85,518 pro games | Web (ps.waltheri.net) | Open-source (GitHub: waltheri/go-pattern-search), HTML5/JS, WGo library | Fork for embedding; 85K games searchable by fuseki/joseki/manual pattern |
| **OGS Joseki Explorer** | Curated joseki catalog | Web (online-go.com/joseki) + API | Part of OGS open-source codebase (github.com/online-go/online-go.com) | Use API for joseki data; contribute back to community |
| **KataGo self-play data** | AI-generated optimal play | katagotraining.org | Neural network weights (.bin.gz), training games | Use KataGo's own analysis rather than pre-computed positions |

**Recommended Approach**:
1. **Joseki database**: Fork/integrate OGS Joseki Explorer data via their API
2. **Pattern search**: Embed Waltheri's search logic (open-source) or build custom using the 21.1M game corpus
3. **AI joseki**: Run KataGo analysis on common positions to generate AI-recommended joseki (more accurate than historical databases)

### 4.3 Problem Collections (Tsumego)

| Source | Problems | Access | License | Notes |
|--------|----------|--------|---------|-------|
| **Classical Collections** (tsumego.tasuki.org) | 3 collections: Gokyo Shumyo, XuanXuan Qijing, Igo Hatsuyoron | Web, downloadable | Public domain (18th century works) | Best starting point — no legal risk |
| **GoProblems.com** | Community-contributed | Web (interactive) | Community content, TOS apply | Check if data export is permitted |
| **Tsumego Hero** | Large collection with levels | Web app | Proprietary | Not suitable for data import |
| **Wbaduk** | 2,000+ problems | Free account required | Proprietary | View only |

**Recommended Approach**:
1. **Phase 1**: Start with classical public domain collections (Gokyo Shumyo, XuanXuan Qijing) — zero legal risk, 400+ problems
2. **Phase 2**: Generate new tsumego from KataGo analysis of positions with local life/death situations
3. **Phase 3**: Allow community-contributed problems with review system (a la GoProblems.com)

### 4.4 ELO/Rating Data

**OGS API** (apidocs.online-go.com):
- Rating distribution statistics feature (shipped March 2025)
- Player rating history endpoint: `https://online-go.com/termination-api/player/{id}/v5-rating-history`
- Active player rank distribution histogram (Rating Deviation < 200)
- Community analysis: 27M game sample statistics available from OGS forums

**Use Cases for Matchmaking Calibration**:
- Map OGS ranks to internal ELO for users who import their OGS account
- Calibrate AI difficulty levels to correspond to real rank distributions
- Set initial rating based on tsumego performance before first game

---

## 5. CDN & Asset Delivery

### 5.1 Cloudflare Free Tier

**Included (Free Plan)**:
- Global CDN with automatic file compression
- Enterprise-grade DNS hosting with DNSSEC
- DDoS protection (unmetered, basic mitigation)
- Universal SSL/TLS certificates
- Security event logging
- 3 Page Rules
- Unlimited sites

**Setup: Cloudflare → Hetzner Origin**:
```
User Request
  → Cloudflare CDN (edge cache)
    → [Cache HIT] serve from edge
    → [Cache MISS] Hetzner origin (Coolify)
      → Next.js app
```

**Cache Strategy for Baduk App**:
```
# Static assets (immutable) — cache 1 year
*.js, *.css, *.woff2, board-textures/*, stone-sprites/*
Cache-Control: public, max-age=31536000, immutable

# SGF files (user-specific, but stable after game ends)
/api/games/{id}/sgf
Cache-Control: public, max-age=86400  (1 day)
Vary: Accept-Encoding

# API responses (dynamic)
/api/analysis/*, /api/game-state/*
Cache-Control: no-cache  (Cloudflare bypass)

# OG images (generated, cache after first generation)
/api/og/*
Cache-Control: public, max-age=604800  (1 week)
```

### 5.2 Object Storage: Cloudflare R2 vs Hetzner Object Storage

| Feature | Cloudflare R2 | Hetzner Object Storage |
|---------|---------------|----------------------|
| **Free tier** | 10GB storage, 1M Class A ops, 10M Class B ops/month | None (base price applies) |
| **Storage cost** | $0.015/GB/month | ~$0.0049/GB/month (EUR 4.99 for 1TB) |
| **Egress cost** | **$0 (zero egress fees)** | $1.20/TB |
| **Class A ops (write)** | $4.50/M (1M free) | Included |
| **Class B ops (read)** | $0.36/M (10M free) | Included |
| **S3 compatible** | Yes | Yes |
| **Locations** | Global (Cloudflare edge) | EU only (FSN1, HEL1, NBG1) |
| **Best for** | Frequently accessed assets, global delivery | Large archival storage, cost optimization |

**What to Store Where**:

| Asset Type | Size Estimate | Access Pattern | Store In |
|------------|---------------|----------------|----------|
| User avatars | ~50KB each, ~8K files = 400MB | Frequent read, global | R2 (zero egress + edge cache) |
| Board screenshots / OG images | ~200KB each | Moderate read, social sharing | R2 (zero egress, CDN-native) |
| SGF game files | ~5KB each, ~500K files = 2.5GB | Moderate read | R2 free tier (well within 10GB) |
| KataGo analysis cache | ~50KB per position, grows large | Write-heavy, read by API only | Hetzner (cheaper storage, EU-local) |
| Game replay data | Variable | Low frequency | Hetzner (cheaper bulk storage) |
| Training dataset (21.1M games) | 10.6GB compressed | Rare access | Hetzner (one-time load, never egressed to users) |

### 5.3 OG Image Generation with @vercel/og

**Next.js 15 Built-in** (no separate package needed):

```typescript
// app/api/og/game/[id]/route.tsx
import { ImageResponse } from 'next/og';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const game = await getGameSummary(params.id);

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        width: '1200px',
        height: '630px',
        background: '#1a1a2e',
        color: 'white',
        fontFamily: 'Inter',
      }}>
        {/* Mini board preview (SVG rendered) */}
        <div style={{ width: '400px', padding: '40px' }}>
          <BoardPreviewSVG position={game.finalPosition} size={320} />
        </div>

        {/* Game info */}
        <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '36px' }}>
            {game.blackPlayer} vs {game.whitePlayer}
          </h1>
          <p style={{ fontSize: '24px', color: '#888' }}>
            {game.result} | {game.moveCount} moves | {game.date}
          </p>
          <p style={{ fontSize: '20px', marginTop: 'auto' }}>
            AI Analysis by BadukApp
          </p>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

**Use Cases**:
- `/api/og/game/{id}` — Game result card with mini board preview
- `/api/og/profile/{id}` — Player card with rank, win rate, recent form
- `/api/og/problem/{id}` — Tsumego preview for social sharing
- `/api/og/position/{hash}` — AI analysis position card

**Caching**: Store generated images in R2 with Cloudflare CDN. First request generates, subsequent requests serve from cache.

### 5.4 Next.js Image Optimization

Use Next.js built-in `<Image>` component with Cloudflare as the CDN:

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'assets.badukapp.com' }, // R2 custom domain
    ],
    formats: ['image/avif', 'image/webp'],
  },
};
```

---

## 6. Cost Comparison Table

### 6.1 Per-Service Cost at Scale

| Service | Free Tier | MAU 8K Cost | MAU 25K Cost | MAU 100K Cost |
|---------|-----------|-------------|--------------|---------------|
| **PostHog Analytics** | 1M events | $0 (~720K events) | ~$63/mo (~2.25M events) | ~$400/mo (~9M events) |
| **PostHog Session Replay** | 5,000 recordings | $0 | ~$45/mo (~15K recordings) | ~$200/mo (~60K recordings) |
| **PostHog Feature Flags** | 1M requests | $0 (~600K requests) | $0 (~900K requests) | ~$50/mo (~5M requests) |
| **Sentry Error Tracking** | 5K errors + 10K perf | $0 | $0 (likely within limits) | $26/mo (Team plan) |
| **Grafana Loki** | Self-hosted (free) | $0 (infra only) | $0 (infra only) | $0 (infra only) |
| **Cloudflare CDN** | Unlimited | $0 | $0 | $0 |
| **Cloudflare R2** | 10GB + 1M writes + 10M reads | $0 (~3GB used) | $0 (~7GB used) | ~$3/mo (~15GB) |
| **Hetzner Object Storage** | None (base EUR 4.99) | $6/mo (1TB included) | $6/mo | $6/mo |
| **Go4Go Subscription** | None | $11/yr (~$1/mo) | $1/mo | $1/mo |
| **Domain + DNS** | Cloudflare free DNS | ~$12/yr (~$1/mo) | $1/mo | $1/mo |

### 6.2 Total Monthly Cost

| Scale | Analytics | Error/Log | CDN/Storage | Data | **Total** |
|-------|-----------|-----------|-------------|------|-----------|
| **MAU 8K** | $0 | $0 | $7/mo | $2/mo | **$9/mo** |
| **MAU 25K** | ~$108/mo | $0 | $7/mo | $2/mo | **$117/mo** |
| **MAU 100K** | ~$650/mo | $26/mo | $10/mo | $2/mo | **$688/mo** |

### 6.3 Break-Even: Self-Host vs Managed

| Service | Self-Host Cost | Managed Cost (MAU 100K) | Break-Even Point |
|---------|---------------|------------------------|------------------|
| PostHog | ~$50/mo (Hetzner VPS, 8GB RAM, PG, ClickHouse) | $650/mo | MAU ~15K |
| Sentry | ~$20/mo (Hetzner VPS, 4GB RAM) | $26/mo | Never (too close) |
| Grafana Stack | ~$10/mo (already on Hetzner) | $50/mo (Cloud) | MAU ~5K |

**Recommendation**: Stay on managed PostHog Cloud until MAU exceeds ~25K. The engineering time saved (no ClickHouse ops, no upgrades) far outweighs the ~$100/mo cost. Self-host Grafana Loki from day one since it runs alongside existing infrastructure.

---

## 7. Recommended Stack

### 7.1 Final Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                             │
│  PostHog JS SDK ─── analytics events, session replay         │
│  Sentry JS SDK ──── error capture, performance spans         │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS via Cloudflare CDN
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE (Free)                           │
│  DNS + CDN + DDoS + SSL                                      │
│  R2: avatars, SGF files, OG images                           │
│  Cache: static assets (1yr), OG images (1wk), SGF (1day)    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              HETZNER + COOLIFY (Origin)                       │
│                                                               │
│  Next.js 15 App ──┬── PostHog Node SDK (server events)       │
│                   ├── Sentry Node SDK (errors + LLM monitor) │
│                   ├── winston-loki (structured logs)          │
│                   └── PostHog feature flags (evaluated)       │
│                                                               │
│  KataGo Process ──── Sentry custom events (crashes/timeouts) │
│                                                               │
│  Grafana Loki ────── log aggregation (self-hosted)           │
│  Grafana ─────────── dashboards + alerts (self-hosted)       │
│                                                               │
│  Hetzner Object Storage ── analysis cache, training data     │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              MANAGED SERVICES (SaaS)                          │
│  PostHog Cloud ─── analytics, flags, experiments, replay     │
│  Sentry Cloud ──── errors, performance, LLM monitoring       │
│  Go4Go ─────────── weekly pro game updates (EUR 9.99/yr)     │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 SDK Integration Summary

```bash
# Install all SDKs
npm install posthog-js posthog-node    # PostHog (client + server)
npm install @sentry/nextjs             # Sentry Next.js SDK
npm install winston winston-loki       # Structured logging
```

```typescript
// lib/analytics.ts — unified analytics wrapper
import posthog from 'posthog-js';

export const analytics = {
  // Game events
  gameStarted: (props: GameStartProps) =>
    posthog.capture('game_started', props),
  gameEnded: (props: GameEndProps) =>
    posthog.capture('game_ended', props),
  analysisRequested: (props: AnalysisProps) =>
    posthog.capture('analysis_requested', props),

  // Feature flag check
  isEnabled: (flag: string) =>
    posthog.isFeatureEnabled(flag),

  // Experiment variant
  getVariant: (experiment: string) =>
    posthog.getFeatureFlag(experiment),
};
```

---

## 8. Implementation Priority

### Phase 1: Week 1-2 (Foundation)

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 1 | Cloudflare DNS + CDN setup | 2h | Domain registration |
| 2 | Cloudflare R2 bucket creation | 1h | Cloudflare account |
| 3 | PostHog Cloud account + JS SDK | 2h | None |
| 4 | Sentry account + Next.js SDK (`@sentry/wizard`) | 1h | None |
| 5 | Core event schema definition | 2h | PostHog setup |

### Phase 2: Week 3-4 (Instrumentation)

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 6 | Game event tracking (start, move, end) | 4h | PostHog SDK |
| 7 | KataGo error/timeout tracking in Sentry | 2h | Sentry SDK |
| 8 | Grafana Loki setup on Hetzner | 3h | Hetzner VPS |
| 9 | winston-loki integration | 2h | Loki running |
| 10 | PostHog feature flag infrastructure | 2h | PostHog SDK |

### Phase 3: Week 5-8 (Data & Intelligence)

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 11 | Go4Go subscription + SGF import pipeline | 4h | Object storage |
| 12 | featurecat dataset download + indexing | 8h | Hetzner storage |
| 13 | OG image generation routes | 4h | R2 + game data |
| 14 | PostHog funnels + dashboards | 3h | Event data flowing |
| 15 | First A/B experiment (template vs LLM) | 4h | Feature flags + LLM pipeline |
| 16 | LLM monitoring via Sentry AI Agent | 3h | LLM pipeline |

### Phase 4: Week 9-12 (Optimization)

| # | Task | Effort | Dependency |
|---|------|--------|------------|
| 17 | Joseki database integration (OGS API) | 6h | Pattern matching |
| 18 | Tsumego from classical collections | 4h | Problem UI |
| 19 | Retention cohort analysis setup | 2h | 4+ weeks of data |
| 20 | Grafana alerting (KataGo latency, error spikes) | 3h | Loki + Grafana |
| 21 | Cache optimization based on analytics | 4h | Traffic patterns |

---

## Sources

- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog Product Analytics Pricing](https://posthog.com/product-analytics-explorer/pricing)
- [PostHog Feature Flags Docs](https://posthog.com/docs/feature-flags)
- [PostHog A/B Testing](https://posthog.com/ab-testing)
- [PostHog vs Mixpanel](https://posthog.com/blog/posthog-vs-mixpanel)
- [Mixpanel Pricing](https://mixpanel.com/pricing/)
- [Mixpanel Pricing 2026 Analysis](https://seline.com/blog/mixpanel-pricing)
- [Amplitude Pricing](https://amplitude.com/pricing)
- [Amplitude vs Mixpanel vs PostHog](https://www.brainforge.ai/resources/amplitude-vs-mixpanel-vs-posthog)
- [Sentry Pricing](https://sentry.io/pricing/)
- [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry LLM Monitoring](https://docs.sentry.io/product/insights/llm-monitoring/getting-started/)
- [Cloudflare Free Plan](https://www.cloudflare.com/plans/free/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Hetzner Object Storage](https://www.hetzner.com/storage/object-storage/)
- [Grafana Loki](https://github.com/grafana/loki)
- [Grafana Loki Node.js Configuration](https://grafana.com/blog/how-to-configure-grafana-loki-with-a-node-js-e-commerce-app/)
- [Highlight.io Pricing](https://www.highlight.io/pricing)
- [BetterStack Pricing](https://betterstack.com/pricing)
- [Unleash Open Source](https://www.getunleash.io/open-source)
- [Unleash GitHub](https://github.com/Unleash/unleash)
- [Open Source Feature Flag Tools Compared 2026](https://flagshark.com/blog/open-source-feature-flag-tools-compared-2026/)
- [Go4Go Game Delivery](https://www.go4go.net/go/games/delivery)
- [Go4Go Database Info](https://www.go4go.net/go/go4go_information)
- [featurecat/go-dataset (21.1M games)](https://github.com/featurecat/go-dataset)
- [PAGE Professional Go Annotation Dataset](https://github.com/yifangao112/PAGE)
- [computer-go-dataset](https://github.com/yenw/computer-go-dataset)
- [Waltheri's Go Pattern Search](https://ps.waltheri.net/)
- [Waltheri GitHub](https://github.com/waltheri/go-pattern-search)
- [OGS Joseki Explorer Wiki](https://github.com/online-go/online-go.com/wiki/OGS-Joseki-Explorer)
- [OGS API Documentation](https://apidocs.online-go.com/)
- [OGS Rating Distribution Feature](https://forums.online-go.com/t/new-rank-rating-distribution-statistics-feature-in-your-profile/56006)
- [Tsumego Classical Collections](https://tsumego.tasuki.org/)
- [GoProblems.com](https://www.goproblems.com/)
- [Pro Games SGF Collections (OGS Forum)](https://forums.online-go.com/t/pro-games-sgf-collection/49003)
- [SGF Archives Discussion (OGS Forum)](https://forums.online-go.com/t/best-sites-to-get-thousands-of-go-games-sgf-as-archive/16757)
- [Next.js OG Image Generation](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Vercel OG Image Generation](https://vercel.com/docs/og-image-generation)
- [Next.js 15 Dynamic OG Images Guide](https://www.buildwithmatija.com/blog/complete-guide-dynamic-og-image-generation-for-next-js-15)
