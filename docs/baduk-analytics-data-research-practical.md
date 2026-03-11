# Research 4: Analytics & Data — Practical (Managed Services, Best-in-Class)

> **Perspective**: "Use the best managed tools. The time you save not maintaining infrastructure is worth the subscription cost."
>
> **Context**: AI agentic workflow to build a Go (baduk) app. Stack: Node.js 22 LTS, Next.js 15, PostgreSQL 16, Redis 7.2. Target: MAU 8K -> 50K.

---

## Table of Contents

1. [PostHog — Product Analytics Deep Dive](#1-posthog--product-analytics-deep-dive)
2. [Sentry — Error Monitoring + Performance](#2-sentry--error-monitoring--performance)
3. [Cloudflare Stack — CDN + R2 + Workers](#3-cloudflare-stack--cdn--r2--workers)
4. [Uptime Monitoring & Status Page](#4-uptime-monitoring--status-page)
5. [Data Pipeline for Go Analytics](#5-data-pipeline-for-go-analytics)
6. [Recommended Practical Stack & Cost Analysis](#6-recommended-practical-stack--cost-analysis)

---

## 1. PostHog — Product Analytics Deep Dive

### 1.1 Current State & Pricing (2025-2026)

PostHog is an open-source, all-in-one product analytics platform purpose-built for developers. It combines product analytics, session replay, feature flags, A/B testing, error tracking, surveys, and a data warehouse into a single platform. As of 2026, PostHog has over 200,000 users and is one of the top 0.01% most popular repositories on GitHub. Notable clients include Airbus and DHL.

**Free Tier (No credit card required):**

| Product | Free Monthly Allowance | Overage Cost |
|---------|----------------------|--------------|
| Product Analytics | 1M events | ~$0.00005/event |
| Session Replay | 5,000 recordings | $0.005/recording |
| Feature Flags | 1M requests | usage-based |
| Surveys | 250 responses | usage-based |
| Data Warehouse | queries included | — |

- 98% of PostHog customers use it entirely for free
- No restrictions on team size, dashboard complexity, or advanced features (cohort analysis, SQL querying, API access)
- Data retained for 1 year on free plan, 7 years on paid
- Session recordings retained 1 month (free), 3 months (paid cloud)

**Paid Pricing (pay-as-you-go):**
- No contract, month-to-month, no minimums
- Tiered step-down rates: per-unit price decreases at higher volumes (up to 82% discount at scale)
- Annual prepayment discounts: 20% at $20K+, 25% at $60K+, 40% at $100K+

### 1.2 PostHog vs Mixpanel vs Amplitude

| Dimension | PostHog | Mixpanel | Amplitude |
|-----------|---------|----------|-----------|
| **Focus** | Developer-first, open-source | Ease of use, marketing/PM friendly | Enterprise, data governance |
| **Free Tier (Analytics)** | 1M events/mo (stable) | 1M events/mo (reduced from 20M in late 2025) | Limited free plan |
| **Session Replay** | Native, included | Not native | Added recently |
| **Feature Flags** | Native since early days | Relaunched late 2025 | Limited |
| **A/B Testing** | Native, integrated billing | Relaunched late 2025 | Available |
| **Error Tracking** | Native | Not available (needs Sentry/Bugsnag) | Not available |
| **Data Access** | Direct SQL (ClickHouse), open-source | JQL, warehouse integrations | Warehouse-native (Snowflake, BigQuery) |
| **Self-Hosted** | Yes (open-source) | No | No |
| **Best For** | Engineering-led teams | Marketing/product teams | Enterprise analytics |

**Why PostHog wins for a Go app:**
- Developer-first: engineers building a Go app will feel at home
- All-in-one: no need for separate session replay (FullStory), feature flags (LaunchDarkly), or A/B testing (Optimizely) tools
- Open-source fallback: if costs ever become an issue, self-hosting is possible
- Stable free tier: Mixpanel's reduction from 20M to 1M events signals risk

### 1.3 Production Examples

1. **Browse AI** — Used PostHog analytics to track interactions, identify UX issues, and measure redesign impact with data-informed decisions
2. **PostHog's own platform** — Runs 20,000+ data warehouse jobs daily, ingesting from Stripe, HubSpot, Postgres, Snowflake, Zendesk
3. **Airbus & DHL** — Enterprise-scale deployments demonstrating PostHog's production readiness
4. **190,000+ customers** — 97% word-of-mouth growth validates product quality

### 1.4 Go App Implementation

#### Installation

```bash
npm install posthog-js posthog-node
```

#### Client-Side Setup (Next.js App Router)

```typescript
// app/providers.tsx
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: '/ingest', // reverse proxy to avoid ad blockers
      capture_pageview: false, // manual control for SPA
    })
  }, [])
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
```

#### Server-Side Setup (Node.js)

```typescript
// lib/posthog-server.ts
import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST,
      flushAt: 1,        // flush immediately (short-lived server functions)
      flushInterval: 0,
    })
  }
  return posthogClient
}
```

#### Reverse Proxy (bypass tracking blockers)

```typescript
// next.config.ts
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ]
  },
}
```

#### Go App Events to Track

```typescript
// Game Flow Events
posthog.capture('game_started', {
  board_size: 19,
  game_type: 'ranked',
  time_control: 'byoyomi_30_5',
  opponent_type: 'human',
  rating_diff: 150,
})

posthog.capture('game_completed', {
  result: 'B+2.5',
  duration_seconds: 1800,
  total_moves: 245,
  ai_review_requested: true,
})

posthog.capture('ai_analysis_used', {
  analysis_type: 'full_game_review',
  engine: 'katago',
  moves_analyzed: 245,
  subscription_tier: 'pro',
})

// Subscription Conversion Funnel
posthog.capture('pricing_page_viewed', { source: 'game_end_prompt' })
posthog.capture('trial_started', { plan: 'pro', trigger: 'ai_analysis_limit' })
posthog.capture('subscription_converted', { plan: 'pro', monthly_price: 9.99 })

// Feature Engagement
posthog.capture('sgf_uploaded', { file_size_kb: 42, game_count: 1 })
posthog.capture('joseki_explorer_used', { pattern: 'star_point_3_3_invasion' })
posthog.capture('problem_attempted', { difficulty: 'dan', solved: true, time_seconds: 45 })
```

#### Feature Flags for Gradual AI Rollout

```typescript
// Server-side feature flag check
const enableNewAI = await posthogServer.isFeatureEnabled(
  'katago-v2-engine',
  userId
)

// Client-side with React
import { useFeatureFlagEnabled } from 'posthog-js/react'

function GameAnalysis() {
  const showAdvancedAnalysis = useFeatureFlagEnabled('advanced-analysis-v2')
  // Gradual rollout: 10% -> 25% -> 50% -> 100%
}
```

### 1.5 Privacy Considerations

- **Cloud hosting regions**: US or EU available for GDPR compliance
- **Self-hosted option**: Full data sovereignty if needed (open-source, BSD license)
- **Cookie-less tracking mode**: Available for privacy-sensitive deployments
- **Data export**: Full API access to raw event data; can export to own data warehouse
- **For a Go app**: Game move data is not PII, but user accounts, IP addresses, and session recordings need standard privacy handling

### 1.6 Monthly Cost Projection

| MAU Scale | Events/mo (est.) | Session Recordings | Monthly Cost |
|-----------|------------------|--------------------|-------------|
| 8K MAU | ~400K events | ~2,000 | **$0** (within free tier) |
| 20K MAU | ~1.2M events | ~5,000 | **~$10** (200K overage events) |
| 50K MAU | ~3M events | ~12,000 | **~$135** (2M events + 7K recordings) |

---

## 2. Sentry — Error Monitoring + Performance

### 2.1 Current State & Pricing (2025-2026)

Sentry is the industry-standard error monitoring and performance tracking platform for web applications. It provides real-time error tracking, performance monitoring, session replay, and release health monitoring.

**Free Tier (Developer plan):**
- 5,000 errors/month
- 10,000 performance transactions/month
- 1 user
- Basic alerting

**Paid Plans (updated August 2025):**

| Plan | Base Price | Errors Included | Performance Units |
|------|-----------|----------------|-------------------|
| Developer | Free | 5,000/mo | 10,000/mo |
| Team | $29/mo | volume-based | volume-based |
| Business | $89/mo | volume-based + discounts | volume-based |
| Enterprise | Custom | custom | custom |

- Event-based pricing: pay only for what you use
- Spike protection: prevents sudden usage from creating surprise bills
- 14-day free trial on all paid plans

### 2.2 Production Examples

1. **Industry standard** — Used by thousands of production applications across startups and enterprises
2. **Next.js ecosystem** — Official `@sentry/nextjs` SDK with first-class support
3. **Real-time alerting** — Slack, Discord, email, PagerDuty integrations
4. **Source maps** — Full stack trace resolution for minified production code

### 2.3 Next.js 15 Integration

#### Installation

```bash
npx @sentry/wizard@latest -i nextjs
# or manually:
npm install @sentry/nextjs
```

#### Configuration Files Created

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% in production
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
})

// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
})
```

#### Next.js 15 Specific: onRequestError Hook

```typescript
// instrumentation.ts (Next.js 15+)
import * as Sentry from '@sentry/nextjs'

export async function onRequestError(err, request, context) {
  await Sentry.captureRequestError(err, request, context)
}
```

**Important limitation**: Sentry SDK does not yet fully support Turbopack in dev mode (Turbopack stable in Next.js 15). Works fine in production builds.

### 2.4 Go App-Specific Monitoring

#### KataGo Process Crash Detection

```typescript
// lib/katago-monitor.ts
import * as Sentry from '@sentry/node'

export function monitorKataGoProcess(process: ChildProcess) {
  process.on('error', (err) => {
    Sentry.captureException(err, {
      tags: { component: 'katago', severity: 'critical' },
      extra: { pid: process.pid },
    })
  })

  process.on('exit', (code, signal) => {
    if (code !== 0) {
      Sentry.captureMessage(`KataGo crashed: code=${code} signal=${signal}`, {
        level: 'fatal',
        tags: { component: 'katago' },
      })
    }
  })

  // Monitor stderr for OOM or GPU errors
  process.stderr?.on('data', (data) => {
    const msg = data.toString()
    if (msg.includes('out of memory') || msg.includes('CUDA error')) {
      Sentry.captureMessage(`KataGo GPU issue: ${msg.slice(0, 500)}`, {
        level: 'error',
        tags: { component: 'katago', type: 'resource' },
      })
    }
  })
}
```

#### WebSocket Health Monitoring

```typescript
// Distributed tracing for WebSocket game connections
import * as Sentry from '@sentry/node'

function handleWebSocketMessage(ws, message) {
  const transaction = Sentry.startSpanManual(
    { name: 'ws.game_move', op: 'websocket' },
    (span) => {
      try {
        processGameMove(message)
        span.setStatus({ code: 1 }) // OK
      } catch (err) {
        Sentry.captureException(err)
        span.setStatus({ code: 2, message: 'internal_error' })
      } finally {
        span.end()
      }
    }
  )
}
```

#### Alert Rules Configuration

```yaml
# Recommended Sentry alert rules for Go app
alerts:
  - name: "KataGo Crash"
    condition: "event.tags.component == 'katago' AND event.level == 'fatal'"
    action: [slack, email]
    threshold: "1 event in 5 minutes"

  - name: "High Error Rate"
    condition: "error_count > 50"
    action: [slack]
    threshold: "per 10 minutes"

  - name: "API Latency Spike"
    condition: "p95(transaction.duration) > 2000ms"
    action: [slack]
    threshold: "for 5 minutes"

  - name: "WebSocket Disconnection Spike"
    condition: "count(ws.disconnect) > 100"
    action: [slack, email]
    threshold: "per 5 minutes"
```

### 2.5 Cost-Benefit at MAU 8K

**Is Sentry worth it at 8K MAU?**

| Factor | Analysis |
|--------|----------|
| Error volume (8K MAU) | Estimated 500-2,000 errors/mo — **within free tier** |
| Performance transactions | Estimated 5,000-8,000/mo — **within free tier** |
| KataGo monitoring | Critical for AI-dependent app — **high value** |
| Time saved debugging | ~4-8 hours/month at $50-100/hr = $200-800/mo value |
| **Verdict** | **Free tier covers 8K MAU. Upgrade at ~30K MAU ($29/mo Team plan)** |

The free tier (5K errors, 10K transactions) comfortably covers an 8K MAU Go app. KataGo crash detection alone justifies the integration effort — a crashed AI engine with no alerting means silent degradation of the core value proposition.

### 2.6 Monthly Cost Projection

| MAU Scale | Errors/mo (est.) | Transactions/mo | Monthly Cost |
|-----------|-----------------|-----------------|-------------|
| 8K MAU | ~1,000 | ~8,000 | **$0** (free tier) |
| 20K MAU | ~3,000 | ~20,000 | **$0** (free tier, borderline) |
| 50K MAU | ~8,000 | ~50,000 | **$29** (Team plan) |

---

## 3. Cloudflare Stack — CDN + R2 + Workers

### 3.1 CDN (Content Delivery Network)

**Pricing**: Free tier available on all Cloudflare plans (including the $0/mo Free plan).

**Features for a Go app:**
- Global edge caching for static assets (JS bundles, CSS, board images, stone sprites)
- HTTP/3 + QUIC support
- Automatic Brotli compression
- DDoS protection included
- SSL/TLS included

**Next.js Integration Options (as of early 2026):**

1. **OpenNext Cloudflare Adapter** — Transforms Next.js build output to run in Cloudflare Workers. Supports Next.js 15 (and 16). Mature, production-tested.

2. **Vinext (Experimental, Feb 2026)** — Cloudflare's AI-built reimplementation of Next.js API surface on Vite. Supports routing, RSC, Server Actions, caching, middleware. Still experimental — not recommended for production yet.

3. **Cloudflare as CDN only** — Deploy Next.js on Vercel/self-hosted, use Cloudflare as a proxy CDN. Simplest approach, most reliable.

**Recommendation for Go app**: Use Cloudflare as a CDN proxy (option 3) initially. Consider OpenNext adapter when scaling costs become a concern with Vercel.

### 3.2 R2 Object Storage

**Pricing:**

| Component | Cost | Free Allowance |
|-----------|------|----------------|
| Storage | $0.015/GB/month | 10 GB/month |
| Class A ops (writes) | $4.50/million | 1M/month |
| Class B ops (reads) | $0.36/million | 10M/month |
| **Egress** | **$0 (FREE)** | Unlimited |
| Infrequent Access (storage) | Lower $/GB | Higher ops cost |

**Zero egress fees** is the killer feature. For comparison: storing 1TB on R2 costs $15/mo vs AWS S3's $891/mo in egress fees alone for 10TB served.

**Go App Use Cases:**

```typescript
// lib/r2-client.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// 1. SGF File Storage
async function uploadSGF(userId: string, gameId: string, sgfContent: string) {
  await r2.send(new PutObjectCommand({
    Bucket: 'baduk-sgf',
    Key: `users/${userId}/games/${gameId}.sgf`,
    Body: sgfContent,
    ContentType: 'application/x-go-sgf',
    Metadata: { userId, gameId, uploadedAt: new Date().toISOString() },
  }))
}

// 2. Board Position Images (for social sharing / OG images)
async function uploadBoardImage(gameId: string, moveNumber: number, image: Buffer) {
  await r2.send(new PutObjectCommand({
    Bucket: 'baduk-images',
    Key: `boards/${gameId}/move-${moveNumber}.png`,
    Body: image,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
}

// 3. KataGo Analysis Results (JSON cache)
async function cacheAnalysis(gameId: string, analysis: object) {
  await r2.send(new PutObjectCommand({
    Bucket: 'baduk-analysis',
    Key: `analysis/${gameId}.json`,
    Body: JSON.stringify(analysis),
    ContentType: 'application/json',
  }))
}
```

**Storage Estimates for Go App:**

| Content Type | Avg Size | Volume (50K MAU) | Storage/mo |
|-------------|----------|------------------|------------|
| SGF files | ~5 KB | 500K games/mo | ~2.5 GB |
| Board images (OG) | ~50 KB | 100K images/mo | ~5 GB |
| AI analysis cache | ~20 KB | 200K analyses/mo | ~4 GB |
| **Total** | | | **~11.5 GB** |

### 3.3 Workers (Edge Compute)

**Pricing:**

| Component | Free Tier | Paid ($5/mo base) |
|-----------|-----------|-------------------|
| Requests | 100K/day | 10M/mo included, then $0.50/M |
| CPU time | 10ms/request | 30ms/request (more on paid) |
| KV storage | included | included |

**Go App Use Cases:**

```typescript
// 1. API Rate Limiting at Edge (before hitting origin)
export default {
  async fetch(request: Request, env: Env) {
    const ip = request.headers.get('CF-Connecting-IP')
    const key = `ratelimit:${ip}`
    const current = await env.KV.get(key)

    if (current && parseInt(current) > 100) {
      return new Response('Rate limited', { status: 429 })
    }

    await env.KV.put(key, String((parseInt(current || '0')) + 1), {
      expirationTtl: 60,
    })

    return fetch(request) // pass to origin
  },
}

// 2. SGF File Validation at Edge
// Validate SGF format before storing in R2 — reject malformed uploads instantly

// 3. Board Position Thumbnail Generation
// Generate simple board state images at the edge using Canvas API
```

### 3.4 Cloudflare Turnstile (CAPTCHA Replacement)

**Pricing**: Completely free. No limits. No Cloudflare CDN subscription required. Unlimited verification checks.

**Key advantages over reCAPTCHA:**
- Google slashed reCAPTCHA v3 free tier from 1M to 10K checks/month
- Turnstile: zero cost, unlimited, no data harvested for ad retargeting
- Invisible mode available (no user interaction)

```typescript
// Registration / Login form protection
// Client-side
<Turnstile sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />

// Server-side verification
async function verifyTurnstile(token: string): Promise<boolean> {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    }
  )
  const data = await response.json()
  return data.success
}
```

### 3.5 Monthly Cost Projection

| Component | 8K MAU | 20K MAU | 50K MAU |
|-----------|--------|---------|---------|
| CDN (Free plan) | $0 | $0 | $0 |
| R2 Storage (~12GB) | $0 (within 10GB free) | ~$0.18 | ~$0.18 |
| R2 Operations | $0 | ~$1 | ~$3 |
| Workers | $0 (free tier) | $5 | $5 |
| Turnstile | $0 | $0 | $0 |
| **Total** | **$0** | **~$6** | **~$8** |

---

## 4. Uptime Monitoring & Status Page

### 4.1 Options Comparison

| Feature | UptimeRobot | Better Stack | Healthchecks.io |
|---------|-------------|--------------|-----------------|
| **Free Monitors** | 50 | 10 | 20 |
| **Check Interval (free)** | 5 min | 3 min | — (heartbeat) |
| **Status Page** | Basic (free) | Beautiful (free) | Not included |
| **Incident Management** | Basic alerting | Full on-call + escalation | Not included |
| **Cron Monitoring** | Heartbeat monitors | Heartbeats included | Core feature |
| **SMS/Phone Alerts** | Paid | Included (paid) | Not included |
| **Commercial Use (free)** | Personal only (since Dec 2024) | Yes | Yes (open-source) |
| **Paid Starting Price** | ~$7/mo | $29/mo | $20/mo |

**Important**: UptimeRobot updated its Terms of Service in December 2024 — the free plan is now restricted to personal, non-commercial use. This is significant for a production Go app.

### 4.2 Recommended Stack

**Primary: Better Stack (Free tier + upgrade path)**
- 10 monitors, 10 heartbeats, 1 status page on free tier
- Beautiful, customizable status pages for users
- When ready to scale: $29/mo includes monitoring + incident management + status page (replaces 2-3 separate tools)

**Cron Job Monitoring: Healthchecks.io (Free)**
- 20 monitors free, open-source, self-hostable
- Perfect for KataGo health checks, backup jobs, aggregation tasks
- Simple ping-based: job sends HTTP request on completion

### 4.3 Go App Implementation

#### Monitors to Set Up

```yaml
# Better Stack Monitors
uptime_monitors:
  - name: "Main App"
    url: "https://baduk-app.com"
    check_interval: 180  # 3 min
    regions: [us, eu, asia]

  - name: "API Health"
    url: "https://baduk-app.com/api/health"
    check_interval: 180
    expected_status: 200

  - name: "WebSocket Server"
    url: "wss://baduk-app.com/ws"
    check_interval: 180

  - name: "Game API"
    url: "https://baduk-app.com/api/games"
    check_interval: 300

# Healthchecks.io Heartbeat Monitors
heartbeat_monitors:
  - name: "KataGo Process"
    ping_url: "https://hc-ping.com/UUID-katago"
    schedule: "*/5 * * * *"  # every 5 minutes
    grace_period: 120  # 2 min grace

  - name: "Daily Stats Aggregation"
    ping_url: "https://hc-ping.com/UUID-stats"
    schedule: "0 3 * * *"  # 3 AM daily
    grace_period: 3600  # 1 hour grace

  - name: "PG Backup"
    ping_url: "https://hc-ping.com/UUID-backup"
    schedule: "0 2 * * *"  # 2 AM daily
    grace_period: 1800

  - name: "Redis Snapshot"
    ping_url: "https://hc-ping.com/UUID-redis"
    schedule: "0 */6 * * *"  # every 6 hours
    grace_period: 600
```

#### KataGo Health Check Implementation

```typescript
// lib/katago-healthcheck.ts
import fetch from 'node-fetch'

const HEALTHCHECK_URL = process.env.HEALTHCHECK_KATAGO_URL!

export async function pingKataGoHealth() {
  try {
    // Verify KataGo is responsive
    const isAlive = await testKataGoQuery()

    if (isAlive) {
      await fetch(HEALTHCHECK_URL, { method: 'POST' })  // success ping
    } else {
      await fetch(`${HEALTHCHECK_URL}/fail`, { method: 'POST' })  // failure ping
    }
  } catch (err) {
    await fetch(`${HEALTHCHECK_URL}/fail`, { method: 'POST' })
  }
}

// Run every 5 minutes via BullMQ scheduled job
```

#### Status Page for Users

```
https://status.baduk-app.com
├── Main Application     ✅ Operational
├── Game Server (WS)     ✅ Operational
├── AI Analysis (KataGo) ✅ Operational
├── API                  ✅ Operational
└── Database             ✅ Operational
```

### 4.4 Monthly Cost Projection

| Component | 8K MAU | 20K MAU | 50K MAU |
|-----------|--------|---------|---------|
| Better Stack (free tier) | $0 | $0 | $29 (upgrade for on-call) |
| Healthchecks.io (free) | $0 | $0 | $0 |
| **Total** | **$0** | **$0** | **$29** |

---

## 5. Data Pipeline for Go Analytics

### 5.1 Game Statistics Aggregation Strategy

A Go app generates rich analytical data: win rates by rank, popular openings, rating distributions, time-of-day patterns, AI usage correlation with improvement. This data needs aggregation for both internal dashboards and user-facing statistics.

**Architecture:**

```
Raw Game Data (PG tables)
    │
    ├── Real-time: PostHog events (user behavior)
    │
    ├── Near-real-time: Redis counters (live stats)
    │
    └── Batch: PG Materialized Views + BullMQ scheduled jobs
         │
         ├── Daily aggregation (3 AM)
         ├── Weekly aggregation (Sunday 4 AM)
         └── Monthly aggregation (1st of month, 5 AM)
```

### 5.2 PostgreSQL Materialized Views

Materialized views store precomputed query results on disk, offering 350x to 9000x faster queries compared to running complex analytics on raw data in real time.

```sql
-- 1. Player Rating Distribution (refreshed daily)
CREATE MATERIALIZED VIEW mv_rating_distribution AS
SELECT
  CASE
    WHEN rating < 1000 THEN 'beginner'
    WHEN rating BETWEEN 1000 AND 1499 THEN 'sdk'
    WHEN rating BETWEEN 1500 AND 1999 THEN 'dan'
    ELSE 'high_dan'
  END AS tier,
  COUNT(*) AS player_count,
  AVG(rating)::int AS avg_rating,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rating)::int AS median_rating
FROM players
WHERE last_active > NOW() - INTERVAL '30 days'
GROUP BY tier;

CREATE UNIQUE INDEX ON mv_rating_distribution (tier);

-- 2. Win Rate by Opening Pattern (refreshed daily)
CREATE MATERIALIZED VIEW mv_opening_stats AS
SELECT
  opening_pattern,
  board_size,
  COUNT(*) AS game_count,
  AVG(CASE WHEN winner = 'black' THEN 1.0 ELSE 0.0 END)::numeric(4,3) AS black_win_rate,
  AVG(total_moves) AS avg_game_length,
  AVG(EXTRACT(EPOCH FROM duration))::int AS avg_duration_seconds
FROM games
WHERE completed_at > NOW() - INTERVAL '90 days'
  AND result IS NOT NULL
GROUP BY opening_pattern, board_size
HAVING COUNT(*) >= 10;

CREATE UNIQUE INDEX ON mv_opening_stats (opening_pattern, board_size);

-- 3. Daily Game Statistics (refreshed daily)
CREATE MATERIALIZED VIEW mv_daily_game_stats AS
SELECT
  date_trunc('day', completed_at)::date AS game_date,
  COUNT(*) AS total_games,
  COUNT(DISTINCT black_player_id) + COUNT(DISTINCT white_player_id) AS unique_players,
  AVG(total_moves)::int AS avg_moves,
  COUNT(CASE WHEN ai_review_requested THEN 1 END) AS ai_reviews,
  COUNT(CASE WHEN game_type = 'ranked' THEN 1 END) AS ranked_games,
  COUNT(CASE WHEN board_size = 19 THEN 1 END) AS games_19x19,
  COUNT(CASE WHEN board_size = 13 THEN 1 END) AS games_13x13,
  COUNT(CASE WHEN board_size = 9 THEN 1 END) AS games_9x9
FROM games
WHERE completed_at > NOW() - INTERVAL '365 days'
GROUP BY game_date;

CREATE UNIQUE INDEX ON mv_daily_game_stats (game_date);

-- 4. User Engagement Metrics (refreshed daily)
CREATE MATERIALIZED VIEW mv_user_engagement AS
SELECT
  p.id AS player_id,
  p.username,
  p.rating,
  COUNT(DISTINCT g.id) AS games_30d,
  COUNT(DISTINCT DATE(g.completed_at)) AS active_days_30d,
  MAX(g.completed_at) AS last_game,
  COUNT(CASE WHEN g.ai_review_requested THEN 1 END) AS ai_reviews_30d,
  p.subscription_tier
FROM players p
LEFT JOIN games g ON (g.black_player_id = p.id OR g.white_player_id = p.id)
  AND g.completed_at > NOW() - INTERVAL '30 days'
GROUP BY p.id, p.username, p.rating, p.subscription_tier;

CREATE UNIQUE INDEX ON mv_user_engagement (player_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rating_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_opening_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_game_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_engagement;
END;
$$ LANGUAGE plpgsql;
```

### 5.3 BullMQ Scheduled Aggregation Jobs

```typescript
// jobs/analytics-scheduler.ts
import { Queue, Worker } from 'bullmq'
import { refreshMaterializedViews } from '../lib/analytics'

const analyticsQueue = new Queue('analytics', {
  connection: { host: process.env.REDIS_HOST, port: 6379 },
})

// Schedule recurring jobs
async function setupScheduledJobs() {
  // Daily stats refresh at 3 AM
  await analyticsQueue.upsertJobScheduler('daily-stats', {
    pattern: '0 3 * * *',
    tz: 'UTC',
  }, {
    name: 'refresh-materialized-views',
  })

  // Weekly leaderboard update (Sunday 4 AM)
  await analyticsQueue.upsertJobScheduler('weekly-leaderboard', {
    pattern: '0 4 * * 0',
    tz: 'UTC',
  }, {
    name: 'compute-weekly-leaderboard',
  })

  // Hourly active game count snapshot
  await analyticsQueue.upsertJobScheduler('hourly-snapshot', {
    pattern: '0 * * * *',
    tz: 'UTC',
  }, {
    name: 'snapshot-active-games',
  })

  // Monthly report generation (1st of month, 5 AM)
  await analyticsQueue.upsertJobScheduler('monthly-report', {
    pattern: '0 5 1 * *',
    tz: 'UTC',
  }, {
    name: 'generate-monthly-report',
  })
}

// Worker to process jobs
const worker = new Worker('analytics', async (job) => {
  const healthcheckUrl = process.env.HEALTHCHECK_ANALYTICS_URL

  try {
    switch (job.name) {
      case 'refresh-materialized-views':
        await refreshMaterializedViews()
        break
      case 'compute-weekly-leaderboard':
        await computeLeaderboard()
        break
      case 'snapshot-active-games':
        await snapshotActiveGames()
        break
      case 'generate-monthly-report':
        await generateMonthlyReport()
        break
    }
    // Ping healthcheck on success
    if (healthcheckUrl) await fetch(healthcheckUrl)
  } catch (err) {
    // Ping healthcheck failure
    if (healthcheckUrl) await fetch(`${healthcheckUrl}/fail`)
    throw err // BullMQ will retry
  }
}, {
  connection: { host: process.env.REDIS_HOST, port: 6379 },
  concurrency: 1, // analytics jobs should run sequentially
})
```

### 5.4 Real-Time Counters via Redis

```typescript
// lib/live-stats.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export const liveStats = {
  async incrementGamesPlayed() {
    const today = new Date().toISOString().slice(0, 10)
    await redis.incr(`stats:games:${today}`)
    await redis.expire(`stats:games:${today}`, 86400 * 7) // 7 day TTL
  },

  async trackActiveGame(gameId: string) {
    await redis.sadd('active_games', gameId)
  },

  async removeActiveGame(gameId: string) {
    await redis.srem('active_games', gameId)
  },

  async getActiveGameCount(): Promise<number> {
    return redis.scard('active_games')
  },

  async getOnlinePlayerCount(): Promise<number> {
    return redis.scard('online_players')
  },

  async getDailyGamesPlayed(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10)
    return parseInt(await redis.get(`stats:games:${today}`) || '0')
  },
}
```

### 5.5 Internal Metrics Dashboard

For an internal dashboard, use the PostHog dashboard capabilities (included in free tier) rather than building a custom dashboard:

```typescript
// Track internal metrics as PostHog events (server-side)
const posthog = getPostHogServer()

// Emit from BullMQ analytics worker after daily aggregation
posthog.capture({
  distinctId: 'system',
  event: 'daily_metrics_computed',
  properties: {
    total_games_today: dailyStats.totalGames,
    active_players_today: dailyStats.uniquePlayers,
    ai_reviews_today: dailyStats.aiReviews,
    new_signups_today: dailyStats.newSignups,
    avg_game_duration_seconds: dailyStats.avgDuration,
    subscription_conversion_rate: dailyStats.conversionRate,
  },
})
```

**Alternative: Metabase** — If more sophisticated internal dashboards are needed, Metabase (open-source) can connect directly to PostgreSQL and query materialized views. Free self-hosted, or $85/mo cloud.

### 5.6 Data Export for Advanced Analysis

```typescript
// API endpoint for SGF export
// GET /api/export/games?from=2026-01-01&to=2026-02-01&format=sgf

// PostHog data export via API
// All raw event data accessible via PostHog API
// Can export to own data warehouse (BigQuery, Snowflake, etc.)
// PostHog Data Warehouse can also pull data from external sources
```

### 5.7 Monthly Cost

The data pipeline uses existing infrastructure (PostgreSQL, Redis, BullMQ) with zero additional cost. PostHog dashboards are included in the free tier. Only if Metabase Cloud is desired: $85/mo.

| Component | Cost |
|-----------|------|
| PG Materialized Views | $0 (uses existing PG) |
| BullMQ Scheduled Jobs | $0 (uses existing Redis) |
| Redis Counters | $0 (uses existing Redis) |
| PostHog Dashboards | $0 (included) |
| Metabase (optional) | $0 self-hosted / $85 cloud |

---

## 6. Recommended Practical Stack & Cost Analysis

### 6.1 Recommended Analytics & Data Stack

| Layer | Tool | Role |
|-------|------|------|
| **Product Analytics** | PostHog | Event tracking, funnels, cohorts, user journeys |
| **Session Replay** | PostHog | Watch users interact with Go board |
| **Feature Flags** | PostHog | Gradual rollout of AI features |
| **A/B Testing** | PostHog | Subscription page variants, UI experiments |
| **Error Monitoring** | Sentry | Error tracking, performance, KataGo crash detection |
| **CDN** | Cloudflare | Global edge caching, DDoS protection, SSL |
| **Object Storage** | Cloudflare R2 | SGF files, board images, analysis cache |
| **Edge Compute** | Cloudflare Workers | Rate limiting, file validation |
| **Bot Protection** | Cloudflare Turnstile | Free CAPTCHA replacement |
| **Uptime Monitoring** | Better Stack | HTTP/WS monitoring, status page |
| **Cron Monitoring** | Healthchecks.io | KataGo health, backup verification |
| **Data Aggregation** | PG Materialized Views + BullMQ | Game stats, ratings, openings |
| **Real-time Counters** | Redis | Active games, online players |
| **Internal Dashboard** | PostHog Dashboards | Business metrics visualization |

### 6.2 Total Monthly Cost Breakdown

#### At 8K MAU (Launch)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| PostHog | $0 | ~400K events, ~2K recordings — within free tier |
| Sentry | $0 | ~1K errors, ~8K transactions — within free tier |
| Cloudflare CDN | $0 | Free plan |
| Cloudflare R2 | $0 | Within 10GB free tier |
| Cloudflare Workers | $0 | Within 100K/day free tier |
| Cloudflare Turnstile | $0 | Always free |
| Better Stack | $0 | 10 monitors free |
| Healthchecks.io | $0 | 20 monitors free |
| PG + Redis + BullMQ | $0 | Uses existing infrastructure |
| **TOTAL** | **$0/mo** | **Entire analytics stack is free at launch** |

#### At 20K MAU (Growth)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| PostHog | ~$10 | 1.2M events (200K overage) |
| Sentry | $0 | Still within free tier |
| Cloudflare CDN | $0 | Free plan still sufficient |
| Cloudflare R2 | ~$2 | ~12GB storage + operations |
| Cloudflare Workers | $5 | Paid plan for higher limits |
| Cloudflare Turnstile | $0 | Always free |
| Better Stack | $0 | Free tier still sufficient |
| Healthchecks.io | $0 | Free tier still sufficient |
| PG + Redis + BullMQ | $0 | Uses existing infrastructure |
| **TOTAL** | **~$17/mo** | |

#### At 50K MAU (Scale)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| PostHog | ~$135 | 3M events + 12K recordings |
| Sentry | $29 | Team plan |
| Cloudflare CDN | $0 | Free plan (or $20 Pro for image optimization) |
| Cloudflare R2 | ~$3 | ~12GB storage + operations |
| Cloudflare Workers | $5 | Paid plan |
| Cloudflare Turnstile | $0 | Always free |
| Better Stack | $29 | Upgrade for on-call + incident mgmt |
| Healthchecks.io | $0 | Free tier |
| PG + Redis + BullMQ | $0 | Uses existing infrastructure |
| **TOTAL** | **~$201/mo** | |

### 6.3 Implementation Timeline

```
Week 1-2: Foundation
├── PostHog: Install SDKs, set up reverse proxy, define core events
├── Sentry: Run wizard, configure alerts, add KataGo monitoring
└── Cloudflare: Enable CDN, set up Turnstile on auth forms

Week 3-4: Storage & Monitoring
├── Cloudflare R2: Set up buckets (sgf, images, analysis), implement upload/download
├── Better Stack: Configure monitors for all endpoints + status page
├── Healthchecks.io: Set up cron monitors for KataGo, backups
└── Redis: Implement live stat counters

Week 5-6: Analytics Pipeline
├── PG Materialized Views: Create views for ratings, openings, daily stats
├── BullMQ: Schedule daily/weekly/monthly aggregation jobs
├── PostHog: Build dashboards for conversion funnel, engagement, game metrics
└── Feature Flags: Set up first flag for gradual AI feature rollout

Week 7-8: Polish & Validation
├── End-to-end testing of all monitoring and alerting
├── Verify PostHog event taxonomy completeness
├── Load test Sentry performance monitoring overhead
└── Document runbooks for incident response
```

### 6.4 ROI Justification

| Investment | Value Generated |
|-----------|----------------|
| **PostHog ($0-135/mo)** | Replaces Mixpanel ($25+) + FullStory ($39+) + LaunchDarkly ($10+) + Optimizely ($36+) = **$110+/mo saved** while getting more integrated data |
| **Sentry ($0-29/mo)** | 4-8 hours/month debugging time saved at $50-100/hr = **$200-800/mo value**. KataGo crash detection prevents silent degradation of core product |
| **Cloudflare Stack ($0-8/mo)** | Zero egress fees on R2 vs S3 saves **$50-500/mo** as file serving scales. Free CDN + DDoS + SSL + Turnstile replaces $100+/mo in separate services |
| **Better Stack ($0-29/mo)** | Replaces separate monitoring ($7) + status page ($29) + incident management ($21) = **$57/mo consolidated**. User trust via status page: priceless |
| **Data Pipeline ($0)** | Uses existing PG/Redis. Materialized views: 350-9000x query speedup vs real-time aggregation. No additional infrastructure cost |

**Total Stack Cost vs Individual Tools:**

| Approach | At 8K MAU | At 50K MAU |
|----------|-----------|------------|
| **Recommended stack** | $0/mo | ~$201/mo |
| **Individual best-of-breed tools** | ~$150/mo | ~$600+/mo |
| **Savings** | $150/mo | $400+/mo |

The managed services approach delivers enterprise-grade observability, analytics, and data infrastructure at a fraction of what individual tools would cost, while requiring zero infrastructure maintenance overhead. The generous free tiers mean the Go app launches with a world-class analytics stack at literally zero cost, with costs scaling gradually and predictably as the user base grows.

---

## Sources

- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog Product Analytics Pricing](https://posthog.com/product-analytics-explorer/pricing)
- [PostHog Pricing Breakdown (LiveSession)](https://livesession.io/blog/posthog-pricing-breakdown-how-much-does-posthog-cost)
- [PostHog Pricing Guide (Flexprice)](https://flexprice.io/blog/posthog-pricing-guide)
- [PostHog vs Mixpanel Comparison](https://posthog.com/blog/posthog-vs-mixpanel)
- [Amplitude vs Mixpanel vs PostHog (Brainforge)](https://www.brainforge.ai/resources/amplitude-vs-mixpanel-vs-posthog)
- [PostHog Next.js Integration Docs](https://posthog.com/docs/libraries/next-js)
- [PostHog Next.js Tutorial](https://posthog.com/tutorials/nextjs-analytics)
- [PostHog Feature Flags Docs](https://posthog.com/docs/feature-flags)
- [PostHog Session Replay Review (Userpilot)](https://userpilot.com/blog/posthog-session-replay/)
- [PostHog GitHub Repository](https://github.com/PostHog/posthog)
- [Sentry Pricing](https://sentry.io/pricing/)
- [Sentry Pricing & Billing Docs](https://docs.sentry.io/pricing/)
- [Sentry Pricing Guide (SigNoz)](https://signoz.io/guides/sentry-pricing/)
- [Sentry Comprehensive Guide 2025 (BayTech)](https://www.baytechconsulting.com/blog/sentry-io-comprehensive-guide-2025)
- [Sentry Plan Changes August 2025](https://sentry.zendesk.com/hc/en-us/articles/40116900282011-How-is-my-plan-changing-August-27-2025)
- [Sentry Next.js Integration Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Node.js Performance Docs](https://docs.sentry.io/platforms/javascript/guides/node/performance/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 vs AWS S3 Comparison](https://www.digitalapplied.com/blog/cloudflare-r2-vs-aws-s3-comparison)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers Free Tier Infographic](https://www.freetiers.com/directory/cloudflare-workers)
- [OpenNext Cloudflare Adapter](https://opennext.js.org/cloudflare)
- [Cloudflare Vinext Blog Post](https://blog.cloudflare.com/vinext/)
- [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)
- [Cloudflare R2 + Next.js Example (GitHub)](https://github.com/diwosuwanto/cloudflare-r2-with-nextjs-upload-download-delete)
- [R2 + Next.js Upload Guide](https://www.buildwithmatija.com/blog/how-to-upload-files-to-cloudflare-r2-nextjs)
- [Better Stack Pricing](https://betterstack.com/pricing)
- [Better Stack vs UptimeRobot (API Status Check)](https://apistatuscheck.com/blog/better-stack-vs-uptimerobot)
- [UptimeRobot Alternatives After 2025 Price Changes](https://earezki.com/ai-news/2026-03-01-uptimerobot-alternatives-who-survived-the-2025-price-hike/)
- [Healthchecks.io](https://healthchecks.io)
- [Cronitor Pricing](https://cronitor.io/pricing)
- [PostgreSQL Materialized Views Performance Case Study](https://sngeth.com/rails/performance/postgresql/2025/10/03/materialized-views-performance-case-study/)
- [PostgreSQL 16 Materialized Views Docs](https://www.postgresql.org/docs/16/rules-materializedviews.html)
- [BullMQ Scheduled Tasks Guide (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)
- [BullMQ Job Schedulers Docs](https://docs.bullmq.io/guide/job-schedulers)
