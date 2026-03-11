# PHASE 3.C: Proven Stack Technology Scenario — External Integration PRD

> **"The simplest system is the one that cannot fail. Use only battle-tested technologies with 5+ years of production history. Zero experimental dependencies."**
>
> **Date**: 2026-03-10
> **Philosophy**: Maximum reliability through minimum external surface area. Every dependency must justify its existence.
> **Constraint**: OpenAI/Gemini = subscription only, NO API. Claude API = only programmatic AI.
> **Inspiration**: Pieter Levels runs $3M+/year businesses on [PHP + SQLite + a single VPS](https://medium.com/swlh/how-pieter-levels-makes-at-least-210k-a-month-from-his-laptop-with-zero-employees-47d8046f43cd). DHH runs [HEY.com on Rails + MySQL + Redis](https://news.ycombinator.com/item?id=23642484) with 40KB of client JavaScript. Simplicity wins.

---

## Executive Summary

This PRD defines the most conservative, battle-tested external integration strategy for the Go (baduk) app. Where PHASE 3.A (Cutting Edge) maximizes innovation and PHASE 2.A (Latest Tech) embraces 23 external services, this scenario asks: **what is the absolute minimum number of external API calls needed to ship a production Go app?**

The answer: **4 external services** (Stripe, Resend, Cloudflare, Claude API) — and the app runs fully functional with **zero** of them online.

**Core Principle**: Every external API is a liability. It can go down, change pricing, alter terms, rate-limit you, or disappear entirely. The Proven Stack treats external dependencies like controlled substances — each one requires explicit justification, a documented fallback, and a kill switch.

| Metric | Proven Stack | Cutting Edge (3.A) | Latest Tech (2.A) |
|--------|-------------|--------------------|--------------------|
| External API dependencies | **4** | 8 | 23 |
| Monthly cost (MAU 8K) | **$80-115/mo** | $200/mo | $47-89/mo* |
| Success probability | **90-95%** | 50-55% | 40-50% |
| Development timeline | **8 weeks** | 26-30 weeks | 10 weeks |
| "Zero external API" survivable | **Yes** | No | No |

*2.A cost is deceptive — excludes hidden SaaS scaling costs

---

## Table of Contents

1. [AI Integration](#1-ai-integration)
2. [Payment & Auth](#2-payment--auth)
3. [Communication](#3-communication)
4. [Analytics](#4-analytics)
5. [Integration Patterns](#5-integration-patterns)
6. [External Dependency Audit](#6-external-dependency-audit)
7. [Proven Score Matrix](#7-proven-score-matrix)
8. [Total External API Dependencies](#8-total-external-api-dependencies)
9. [Monthly Cost at MAU 8K](#9-monthly-cost-at-mau-8k)
10. [Implementation Timeline](#10-implementation-timeline)
11. [Success Probability](#11-success-probability)
12. [What You Sacrifice](#12-what-you-sacrifice)
13. [Risk Register](#13-risk-register)
14. ["Zero External API" Test](#14-zero-external-api-test)

---

## 1. AI Integration

### Philosophy: Templates FIRST, Claude API EARNED

The proven approach inverts the typical AI-first strategy. Instead of launching with an LLM and falling back to templates, we **launch with templates and graduate to Claude API only after templates are proven insufficient**.

### Phase 1: Template-Only Launch (Week 1-8)

**Zero external AI API calls at launch.** All game commentary is generated locally from KataGo numerical output + pre-written template patterns.

#### Template Engine Architecture

```
KataGo Analysis Output (local)
  ├── winrate: 62.3% → 54.1%  (delta: -8.2%)
  ├── topMoves: [{D4, visits: 1200}, {Q16, visits: 800}]
  ├── scoreLead: +3.2 → -1.1  (swing: -4.3 points)
  └── ownership: [territory map]

Template Engine (local, zero API)
  ├── Pattern: BLUNDER (winrate drop > 5%)
  │   └── "이 수로 승률이 {before}%에서 {after}%로 하락했습니다.
  │        {best_move}에 두었다면 승률을 유지할 수 있었습니다."
  │
  ├── Pattern: GOOD_MOVE (winrate gain > 3%)
  │   └── "좋은 수입니다! 승률이 {delta}% 상승했습니다.
  │        {reason_category}에서 이점을 얻었습니다."
  │
  ├── Pattern: TERRITORY_SHIFT (score swing > 3 points)
  │   └── "이 수로 형세가 {points}점 변동되었습니다.
  │        {territory_direction} 방향으로 세력이 이동했습니다."
  │
  ├── Pattern: OPENING_JOSEKI (move < 30, known pattern)
  │   └── Lookup from joseki database (local JSON, 500+ patterns)
  │
  ├── Pattern: ENDGAME_VALUE (move > 200, yose calculation)
  │   └── "이 끝내기 수는 약 {value}점의 가치가 있습니다."
  │
  └── Pattern: NEUTRAL (winrate change < 1%)
      └── "무난한 수입니다. 형세 변동이 거의 없습니다."
```

**Template coverage targets**:
- Blunder detection: 95% accuracy (purely numerical — winrate delta threshold)
- Good move detection: 90% accuracy
- Territory analysis: 85% accuracy
- Opening/joseki identification: 70% accuracy (database lookup)
- Strategic narrative: 40% accuracy (template limitation — this is where Claude API earns its place)

**Template count**: 200-300 templates across 15 pattern categories, 3 skill levels (beginner/intermediate/advanced), 3 languages (KO/EN/ZH).

#### Joseki Database (Local, No API)

A curated JSON file of 500+ common joseki (corner patterns) with pre-written explanations. Source: public domain SGF collections from [Kogo's Joseki Dictionary](http://waterfire.us/joseki.htm) and [Waltheri's Go Pattern Search](https://ps.waltheri.net/).

```typescript
// joseki-db.ts — local, zero external dependency
interface JosekiEntry {
  readonly pattern: string;         // normalized board hash
  readonly name: string;            // "3-3 invasion", "low Chinese opening"
  readonly explanation_ko: string;
  readonly explanation_en: string;
  readonly level: 'beginner' | 'intermediate' | 'advanced';
  readonly frequency: number;       // how common in pro games
}

// Lookup: O(1) hash map, no API call
const josekiMap = new Map<string, JosekiEntry>(
  josekiData.map(j => [j.pattern, j])
);
```

### Phase 2: Claude API Addition (Week 9-12, CONDITIONAL)

**Trigger conditions** — Claude API is added ONLY if ALL of these are true:
1. Template-based commentary receives user satisfaction < 60% in beta feedback
2. Users specifically request "deeper" or "more natural" explanations
3. Revenue (even $1 MRR) exists to fund API costs
4. Template fallback is production-hardened and tested

**If templates score > 60% satisfaction**: Defer Claude API to Month 4+. Save $80-150/month.

#### Claude API Architecture (When Added)

```
┌─────────────────────────────────────────────────┐
│                   Request Flow                    │
│                                                   │
│  User asks "Why?" → Template Engine (instant)     │
│                     ├── Template match? → Return  │
│                     └── No match / "Go deeper"    │
│                          ↓                        │
│                     Claude Haiku 4.5              │
│                     ├── Prompt cache: system      │
│                     ├── KataGo data injected      │
│                     ├── Timeout: 5s               │
│                     └── Failure? → Template       │
│                                                   │
│  Batch review      → Queue → Claude Haiku         │
│  (not real-time)     (BullMQ)  (Batch API, -50%)  │
│                                                   │
│  Complex strategy  → Claude Sonnet 4.6            │
│  (premium only)      ├── Max 5 req/user/day       │
│                      └── Failure? → Haiku → Tmpl  │
└─────────────────────────────────────────────────┘
```

**Cost controls**:
- **Hard budget cap**: $100/month maximum. Circuit breaker trips at 80%.
- **Rate limiting**: Free users: 10 Claude calls/day. Premium: 50/day.
- **Prompt caching**: System prompt (baduk domain context, ~2000 tokens) cached. Read cost 0.1x.
- **Batch API**: Non-real-time review reports use Batch API at 50% discount.
- **Single model default**: Haiku 4.5 only. Sonnet 4.6 reserved for premium full-game reviews.

**Proven Score: 7/10** — Claude API is 2+ years old (launched March 2023). Stable, but external dependency. Template fallback brings effective score to 9/10.

### KataGo: The True AI (Local, Zero API)

KataGo is the heart of the AI system and runs entirely locally. No external API. No cost per request. No rate limits.

| Aspect | Detail |
|--------|--------|
| **Version** | v1.15.x (stable release, NOT bleeding edge v1.16.x) |
| **Backend** | CPU Eigen (AVX2+FMA enabled) |
| **Model** | b18c384nbt (medium — proven stable, well-tested) |
| **Performance** | 10-20 playouts/sec on 4 vCPU, 3-8 sec per analysis |
| **Concurrent** | 3-5 sessions via BullMQ queue |
| **Fallback** | Smaller model (b10c128) for degraded-but-functional analysis |
| **Risk** | Very Low — [MIT licensed](https://github.com/lightvector/KataGo), 5+ years of production use, de facto standard in baduk AI |
| **Proven Score** | **10/10** — Used by Korean national team, OGS, KaTrain, AI Sensei |

---

## 2. Payment & Auth

### Authentication: NextAuth.js v4 (Credentials + OAuth)

**NOT v5/Auth.js** — v5 is [still in beta](https://github.com/nextauthjs/next-auth/discussions/9511) as of March 2026. The proven stack uses **NextAuth.js v4**, which has been stable since 2021 (5+ years of production use, 300K+ weekly downloads at peak).

| Aspect | Detail |
|--------|--------|
| **Provider 1** | Email + Password (Credentials provider) |
| **Provider 2** | Google OAuth 2.0 (optional, reduces friction) |
| **Session** | JWT stored in httpOnly cookie (no database sessions needed initially) |
| **Password** | bcrypt (12 rounds) — [proven since 1999](https://en.wikipedia.org/wiki/Bcrypt), 25+ years |
| **Database** | PostgreSQL via Drizzle adapter |
| **Proven Score** | **9/10** — NextAuth v4 is battle-tested. Credentials provider is the simplest auth path. |

**Why NOT passkeys**: Passkeys are < 3 years old in widespread adoption. WebAuthn spec is mature, but ecosystem tooling (platform authenticator UX, cross-device sync) is still inconsistent across browsers. Proven Stack defers passkeys to Year 2.

**Why NOT magic links at launch**: Magic links require a reliable email delivery service from day one. Credentials auth requires zero external services. Add magic links when Resend integration is proven (Month 2+).

**Why Google OAuth only (not GitHub/Discord)**: Our target users are baduk players (Korea, Japan, China — broad demographic). Google has the highest account penetration in this demographic. GitHub/Discord skew developer-heavy. One OAuth provider = one integration to maintain.

#### Auth Implementation

```typescript
// Minimal NextAuth v4 config — 2 providers, ~60 LOC
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import bcrypt from 'bcrypt';

export default NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    CredentialsProvider({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email),
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        return valid ? { id: user.id, email: user.email } : null;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
});
```

### Payment: Stripe Checkout (Hosted Page)

**Stripe Checkout hosted page only** — no embedded forms, no Stripe Elements, no custom payment UI. The user clicks "Upgrade" and is redirected to Stripe's hosted checkout page. Stripe handles all PCI compliance, card validation, 3D Secure, localization, and mobile optimization.

| Aspect | Detail |
|--------|--------|
| **Integration** | Stripe Checkout Session (server-side API) |
| **UI** | Stripe-hosted payment page (zero custom payment UI) |
| **Products** | 1 product: Premium ($9.99/month). Simplest possible. |
| **Webhooks** | `checkout.session.completed` → activate premium |
| **Webhooks** | `customer.subscription.deleted` → deactivate premium |
| **Customer Portal** | Stripe Customer Portal (hosted) for billing management |
| **Currency** | USD only at launch. Multi-currency is Stripe-managed. |
| **Proven Score** | **10/10** — [Stripe Checkout launched 2019](https://stripe.com/blog/checkout), 7+ years. Billions processed. |

**Why Stripe Checkout hosted (not embedded)**:
- Zero PCI scope on our server
- Stripe handles all payment UI — we write zero payment frontend code
- Mobile-optimized by default
- Supports Apple Pay, Google Pay, Link automatically
- A/B tested by Stripe across millions of checkouts

**Why NOT LemonSqueezy/Paddle**: Both are newer, less proven at scale. Stripe has 14+ years of production history. For a conservative stack, the industry standard wins.

#### Stripe Integration

```typescript
// Total Stripe integration: ~40 LOC server-side

// 1. Create checkout session (API route)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/premium/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/premium`,
    customer_email: currentUser.email,
  });
  return Response.json({ url: session.url });
}

// 2. Webhook handler (~25 LOC)
export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    req.headers.get('stripe-signature')!,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case 'checkout.session.completed':
      await activatePremium(event.data.object.customer_email);
      break;
    case 'customer.subscription.deleted':
      await deactivatePremium(event.data.object.customer);
      break;
  }

  return new Response('OK');
}
```

**Fallback if Stripe is down**: Premium features remain active for existing subscribers (cached in local DB). New subscriptions show "Payment temporarily unavailable, please try again later." No revenue loss on existing users.

---

## 3. Communication

### Email: Resend (Minimal Usage)

**Email is NOT used for core app functionality.** Email serves exactly 3 purposes:

| Purpose | Trigger | Template | Frequency |
|---------|---------|----------|-----------|
| Welcome email | User registration | Static HTML | 1 per user ever |
| Password reset | User request | Static HTML | Rare |
| Subscription receipt | Stripe webhook | Static HTML | 1 per payment |

**No marketing emails. No newsletters. No digest emails at launch.**

| Aspect | Detail |
|--------|--------|
| **Service** | Resend |
| **Volume** | < 500 emails/month at MAU 8K |
| **Cost** | $0 (free tier: 3,000 emails/month, 100/day) |
| **Templates** | 3 static HTML templates, locally rendered |
| **Proven Score** | **6/10** — Resend founded 2023 (3 years). Functional but young. |

**Resend risk mitigation**: Resend has documented [69 outages in the past year](https://isdown.app/status/resend) (~3/month). For our 3 email types:
- Welcome email: Queue and retry. 2-hour delay acceptable.
- Password reset: Show "Email may take a few minutes" + provide Google OAuth as alternative auth.
- Receipt: Stripe sends its own receipt by default. Our email is supplementary.

**Fallback if Resend is down**: App functions normally. Password reset via Google OAuth. Receipts via Stripe's built-in emails. Welcome email queued for retry.

**Why NOT self-hosted email**: Email deliverability is a multi-year expertise domain. SPF, DKIM, DMARC, IP reputation, bounce handling, feedback loops — getting this right is a full-time job. At < 500 emails/month, Resend's free tier is the pragmatic choice. Self-hosting email is the opposite of "proven and simple."

### Push Notifications: Web Push API (Native, Zero Service)

| Aspect | Detail |
|--------|--------|
| **Technology** | [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) + [web-push npm](https://github.com/web-push-libs/web-push) library |
| **Protocol** | VAPID (Voluntary Application Server Identification) |
| **Backend** | Self-hosted. `web-push` sends directly to browser push services |
| **Browser support** | Chrome 50+ (2016), Firefox 44+ (2016), Safari 16+ (2022), Edge 17+ (2018) |
| **Cost** | $0 — VAPID is free, push services (FCM, Mozilla Push, APNs) are free |
| **Proven Score** | **9/10** — Push API standard since 2016 (10 years). VAPID since 2017. |

**Use cases (minimal)**:
- "It's your turn" — opponent has moved in your game
- "Game invitation" — someone challenged you
- "AI analysis ready" — batch review complete

**Why NOT a push service (OneSignal, Firebase Cloud Messaging directly)**: The `web-push` npm library handles VAPID key generation, encryption, and delivery to FCM/Mozilla Push/APNs endpoints. No intermediary SaaS needed. The npm library has [15M+ downloads](https://www.npmjs.com/package/web-push), is maintained, and wraps the W3C standard directly.

```typescript
// web-push setup — ~20 LOC
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@baduk-app.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Send notification — 1 function call
async function notifyTurn(subscription: PushSubscription, gameId: string) {
  await webpush.sendNotification(subscription, JSON.stringify({
    title: '상대가 착수했습니다',
    body: '당신의 차례입니다',
    url: `/game/${gameId}`,
  }));
}
```

**Fallback if push delivery fails**: In-app notification badge (polling every 30s when tab is active). No external dependency.

---

## 4. Analytics

### Self-Hosted Everything: Umami v3

**Zero SaaS analytics.** Zero Google Analytics. Zero Mixpanel. Zero Amplitude.

| Aspect | Detail |
|--------|--------|
| **Platform** | [Umami v3](https://umami.is/) (MIT license, released Nov 2025) |
| **Hosting** | Self-hosted on same Hetzner server |
| **Database** | Shares PostgreSQL 16 instance (separate database) |
| **Resource** | ~200-450 MB RAM, ~1% CPU |
| **Capacity** | ~100K pageviews/month on 1 vCPU (MAU 8K = ~80K pageviews) |
| **Tracking** | Cookie-free, GDPR compliant by default, ~2KB script |
| **Cost** | $0 |
| **Proven Score** | **7/10** — Umami since 2020 (6 years), 20K+ GitHub stars |

**Why Umami over Plausible**: Umami uses PostgreSQL (we already run PG 16). Plausible requires ClickHouse (separate database engine, 1-2 GB RAM minimum). Umami fits in our existing infrastructure with zero additional services.

**Why NOT Google Analytics**: GA4 is a SaaS dependency. It sends user data to Google. It requires cookie consent banners in EU. It adds external JavaScript. Every one of these violates the Proven Stack philosophy.

**Custom events tracked**:

```typescript
// Game-specific analytics — 5 custom events
umami.track('game-started', { board_size: '19x19', type: 'pvp' });
umami.track('game-completed', { result: 'B+2.5', duration_minutes: 45 });
umami.track('ai-analysis-requested', { move_number: 42 });
umami.track('premium-upgrade-clicked');
umami.track('onboarding-completed', { step_count: 5 });
```

### Error Monitoring: Custom Error Logger (Zero SaaS)

**No Sentry. No LogRocket. No Datadog.**

At MAU 8K, a simple error logging table in PostgreSQL + a daily digest is sufficient.

```sql
-- error_logs table — replaces Sentry
CREATE TABLE error_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level VARCHAR(10) NOT NULL,        -- 'error' | 'warn' | 'fatal'
  message TEXT NOT NULL,
  stack TEXT,
  user_id INTEGER REFERENCES users(id),
  url TEXT,
  metadata JSONB,                    -- request context, browser info
  resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_error_logs_timestamp ON error_logs (timestamp DESC);
CREATE INDEX idx_error_logs_level ON error_logs (level) WHERE level = 'fatal';
```

```typescript
// Global error handler — Next.js App Router
// app/error.tsx + instrumentation.ts
export function onError(error: Error, context: Record<string, unknown>) {
  // Write to PG — no external API
  db.insert(errorLogs).values({
    level: 'error',
    message: error.message,
    stack: error.stack,
    metadata: context,
  });
}
```

**Daily error digest**: A cron job (node-cron, local) queries `error_logs` every 24h. If `fatal` count > 0, sends a single Resend email to the admin. Total external API calls for error monitoring: 0-1 per day.

**When to upgrade to Sentry**: If `error_logs` exceeds 100K rows/month OR error triage takes > 30 min/day. Until then, SQL queries are sufficient.

**Proven Score: 10/10** — PostgreSQL logging is as old as PostgreSQL itself.

### Observability: Prometheus + Node Exporter (Local)

| Aspect | Detail |
|--------|--------|
| **Metrics** | Prometheus (self-hosted, scrapes Node Exporter) |
| **Visualization** | Grafana OSS (self-hosted via Coolify) |
| **Logs** | stdout/stderr → Docker logs → Coolify log viewer |
| **Alerting** | Grafana alerting → Resend email (1 external call) |
| **Cost** | $0 |
| **Proven Score** | **10/10** — Prometheus since 2012 (14 years), Grafana since 2014 (12 years) |

**Why NOT Grafana Cloud Free**: It works, but it is an external dependency. At MAU 8K, self-hosted Grafana on the same server uses < 200 MB RAM and eliminates another external service.

**Monitored metrics** (minimal set):
- App: HTTP response time (p50/p95/p99), error rate, active WebSocket connections
- Database: query latency, connection pool utilization, table sizes
- KataGo: analysis queue depth, average analysis time, process restarts
- System: CPU, RAM, disk, network I/O

---

## 5. Integration Patterns

### REST Only (No tRPC, No GraphQL, No gRPC)

| Aspect | Detail |
|--------|--------|
| **API Style** | REST (JSON over HTTP) |
| **Validation** | Zod schemas on every endpoint |
| **Documentation** | OpenAPI 3.1 auto-generated from Zod schemas |
| **Versioning** | URL prefix: `/api/v1/` |
| **Proven Score** | **10/10** — REST since 2000 (26 years). Zod since 2020 (6 years). |

**Why NOT tRPC**: tRPC v11 is < 1 year old. tRPC in general is < 4 years old (launched 2022). It couples client and server TypeScript — if we ever need a mobile app or third-party API consumers, we rewrite everything. REST is universally understood by every HTTP client in every language.

**Why NOT GraphQL**: GraphQL adds query parsing complexity, N+1 resolver problems, and a learning curve for AI agents. For a baduk app with ~15 API endpoints, REST is simpler in every dimension.

#### API Design (Complete Endpoint List)

```
# Auth (2 endpoints)
POST   /api/v1/auth/register        — Create account
POST   /api/v1/auth/login           — Login (credentials)

# Games (6 endpoints)
POST   /api/v1/games                — Create game
GET    /api/v1/games/:id            — Get game state
POST   /api/v1/games/:id/move       — Play a move
POST   /api/v1/games/:id/resign     — Resign
POST   /api/v1/games/:id/pass       — Pass
GET    /api/v1/games/:id/analysis   — Get AI analysis

# Users (3 endpoints)
GET    /api/v1/users/me             — Current user profile
PATCH  /api/v1/users/me             — Update profile
GET    /api/v1/users/:id/stats      — User statistics

# Subscription (2 endpoints)
POST   /api/v1/checkout             — Create Stripe session
POST   /api/v1/webhooks/stripe      — Stripe webhook

# Matchmaking (1 endpoint)
POST   /api/v1/matchmaking          — Join matchmaking queue

Total: 14 REST endpoints
```

### Zod Validation on Every Boundary

```typescript
// Every API input is Zod-validated. No exceptions.
import { z } from 'zod';

const PlayMoveSchema = z.object({
  x: z.number().int().min(0).max(18),
  y: z.number().int().min(0).max(18),
  color: z.enum(['B', 'W']),
});

const CreateGameSchema = z.object({
  boardSize: z.enum(['9', '13', '19']).default('19'),
  timeControl: z.object({
    mainTime: z.number().int().min(60).max(7200),   // 1 min - 2 hours
    byoyomi: z.number().int().min(10).max(60),      // 10-60 seconds
    periods: z.number().int().min(1).max(10),
  }),
  komi: z.number().default(6.5),
  opponent: z.enum(['human', 'ai']),
  aiLevel: z.number().int().min(1).max(30).optional(),
});
```

### Webhook Pattern (Standard, Proven)

Only 1 incoming webhook: **Stripe**.

```typescript
// Webhook verification — standard Stripe pattern, 10+ years proven
function verifyStripeWebhook(req: Request): Stripe.Event {
  const signature = req.headers.get('stripe-signature')!;
  return stripe.webhooks.constructEvent(
    await req.text(),
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}
```

**Webhook reliability pattern**:
1. Verify signature (reject unverified)
2. Check idempotency (deduplicate by event ID in PG)
3. Process synchronously (simple enough at our scale)
4. Return 200 immediately
5. If processing fails, Stripe retries automatically (up to 72 hours)

### WebSocket: ws library (Standard)

| Aspect | Detail |
|--------|--------|
| **Library** | `ws` npm (13+ years old, 70M+ weekly downloads) |
| **Protocol** | Standard WebSocket (RFC 6455, ratified 2011) |
| **Use case** | Real-time game moves only |
| **Reconnection** | Client-side exponential backoff (manual, ~30 LOC) |
| **Heartbeat** | Ping/pong every 30s |
| **Proven Score** | **10/10** — WebSocket RFC since 2011 (15 years). `ws` since 2011. |

**Why NOT Socket.IO**: Socket.IO adds ~100KB to the client bundle, auto-reconnection we can write in 30 lines, and room/namespace abstractions we do not need. Raw WebSocket is simpler and the `ws` library is the most battle-tested WebSocket implementation in Node.js.

---

## 6. External Dependency Audit

Every single external network call the application makes, justified:

### Tier 1: Essential (Cannot Remove)

| # | Service | Direction | Purpose | Calls/Day (MAU 8K) | Justification | Fallback |
|---|---------|-----------|---------|---------------------|---------------|----------|
| 1 | **Google OAuth** | Outbound | User authentication | ~50-200 | Google is the universal auth provider in Asia. Reduces registration friction. | Credentials (email+password) — zero external dependency |
| 2 | **Stripe API** | Outbound | Payment processing | ~5-20 | Legal requirement for subscription billing. No self-hosted alternative exists for payment processing. | Graceful degradation — existing subscriptions cached locally |
| 3 | **Stripe Webhooks** | Inbound | Subscription lifecycle | ~5-20 | Required for Stripe to notify us of payment events. | Polling Stripe API every 5 min (backup) |
| 4 | **Browser Push Services** | Outbound | Push notifications via VAPID | ~100-500 | FCM/Mozilla Push/APNs endpoints — free, operated by browser vendors. Not a single SaaS. | In-app notification badge (polling) |

### Tier 2: Important (Can Degrade)

| # | Service | Direction | Purpose | Calls/Day (MAU 8K) | Justification | Fallback |
|---|---------|-----------|---------|---------------------|---------------|----------|
| 5 | **Resend API** | Outbound | Transactional email | ~10-50 | Password reset, welcome email. < 500/month total. | Queue and retry. Google OAuth bypasses password reset. Stripe handles receipts. |
| 6 | **Claude API** | Outbound | AI commentary (Phase 2+) | 0 (Phase 1), 200-1000 (Phase 2+) | Enhanced move explanation beyond templates. Added ONLY if templates prove insufficient. | Template engine — full functionality without Claude |

### Tier 3: Infrastructure (Static, Not API)

| # | Service | Direction | Purpose | Justification | Fallback |
|---|---------|-----------|---------|---------------|----------|
| 7 | **Cloudflare CDN** | Reverse proxy | Static asset caching, DDoS protection | Free tier. Passive — not an API we call, it sits in front of us. | Serve directly from Hetzner (higher latency, functional) |
| 8 | **Cloudflare R2** | Outbound | Static asset storage (avatars, SGF files) | [Free tier: 10GB storage, zero egress](https://developers.cloudflare.com/r2/pricing/). S3-compatible. | Store on local disk. At MAU 8K, disk is sufficient. |
| 9 | **npm registry** | Build-time only | Package installation | Build-time dependency, not runtime. | `npm ci --offline` with lockfile + cached node_modules |
| 10 | **GitHub** | CI/CD only | Source control + Actions | Build-time dependency, not runtime. | Self-hosted Gitea + local CI (extreme fallback) |

### What Is NOT on This List

| Excluded Service | Why Excluded |
|-----------------|-------------|
| Google Analytics | SaaS dependency. Umami self-hosted replaces it. |
| Sentry | SaaS dependency. PG error_logs table replaces it. |
| Datadog/New Relic | SaaS dependency. Prometheus + Grafana self-hosted replaces it. |
| Firebase | SaaS dependency. PG + web-push replaces it. |
| Algolia/Typesense | Not needed. PG full-text search covers our needs. |
| OpenAI/Gemini API | Subscription only constraint. Not available as API. |
| SendGrid/Mailgun | Older and more complex than Resend. Not needed at < 500 emails/month. |
| OneSignal/Pusher | web-push library eliminates the need. |
| Vercel | Coolify + Hetzner is more proven for self-hosted. |
| Redis Cloud | Self-hosted Redis 7.2 on Hetzner. |
| tRPC | < 4 years old. REST is 26 years old. |
| MCP | < 2 years old. Direct KataGo stdio is simpler. |

---

## 7. Proven Score Matrix

Every technology decision rated on a 1-10 "battle-tested" scale:

| Technology | Proven Score | Production History | Weekly Downloads / Users | Justification |
|-----------|-------------|-------------------|--------------------------|---------------|
| **Node.js 22 LTS** | 10/10 | 2009 (17 years) | 40M+ weekly | The runtime. Not debatable. |
| **Next.js 15** | 9/10 | 2016 (10 years) | 6M+ weekly | Mature. v15 is stable (not bleeding edge v16). |
| **PostgreSQL 16** | 10/10 | 1996 (30 years) | — | The database. Not debatable. |
| **Redis 7.2** | 10/10 | 2009 (17 years) | — | Proven cache. Not Valkey (too new). |
| **Drizzle ORM** | 7/10 | 2022 (4 years) | 1.5M+ weekly | Youngest core dependency. SQL transparency justifies. |
| **KataGo v1.15.x** | 10/10 | 2019 (7 years) | — | De facto standard. Korean national team uses it. |
| **NextAuth v4** | 9/10 | 2020 (6 years) | 300K+ weekly | Proven. NOT v5 beta. |
| **Stripe Checkout** | 10/10 | 2019 (7 years) | — | Industry standard. Billions processed. |
| **Resend** | 6/10 | 2023 (3 years) | — | Youngest external service. Justified by free tier + minimal usage. |
| **web-push (VAPID)** | 9/10 | 2016 (10 years) | 800K+ weekly | W3C standard. |
| **Umami v3** | 7/10 | 2020 (6 years) | — | Self-hosted. MIT. Shares PG. |
| **Prometheus** | 10/10 | 2012 (14 years) | — | CNCF graduated. Industry standard. |
| **Grafana OSS** | 10/10 | 2014 (12 years) | — | Industry standard visualization. |
| **ws (WebSocket)** | 10/10 | 2011 (15 years) | 70M+ weekly | Most battle-tested WS library. |
| **Zod** | 8/10 | 2020 (6 years) | 25M+ weekly | TypeScript validation standard. |
| **bcrypt** | 10/10 | 1999 (27 years) | — | Cryptographic standard. |
| **REST** | 10/10 | 2000 (26 years) | — | The integration pattern. |
| **Coolify** | 7/10 | 2021 (5 years) | — | Self-hosted PaaS. Growing but younger. |
| **Hetzner** | 9/10 | 1997 (29 years) | — | European hosting standard. |
| **Cloudflare** | 10/10 | 2010 (16 years) | — | CDN standard. |

**Weighted Average Proven Score: 9.0/10**

Weakest links: Resend (6/10) and Drizzle (7/10). Both have justifications:
- Resend: < 500 emails/month, free tier, queue-and-retry handles outages
- Drizzle: SQL transparency essential for AI agent code generation, no codegen step

---

## 8. Total External API Dependencies

### Runtime Dependencies (App Must Be Running)

| Count | Category | Services |
|-------|----------|----------|
| 1 | Auth (optional) | Google OAuth |
| 1 | Payment | Stripe |
| 1 | Email | Resend |
| 1 | AI (Phase 2+ only) | Claude API |
| **4** | **Total** | |

### Infrastructure Dependencies (Not Runtime)

| Count | Category | Services |
|-------|----------|----------|
| 1 | CDN | Cloudflare (passive) |
| 1 | Storage | Cloudflare R2 |
| 1 | CI/CD | GitHub Actions |
| 1 | Package registry | npm |
| **4** | **Total** | |

### Push Delivery (Browser-Vendor Operated, Free)

| Count | Category | Services |
|-------|----------|----------|
| 3 | Push endpoints | FCM, Mozilla Push, APNs |

**Grand Total: 4 runtime API dependencies** (Google OAuth, Stripe, Resend, Claude API)

- Phase 1 (launch): **3 runtime dependencies** (no Claude API yet)
- If Google OAuth is removed: **2 runtime dependencies** (Stripe + Resend)
- If Claude API is never added: **3 runtime dependencies** forever

**Comparison**: PHASE 2.A (Latest Tech) has 23 external services. PHASE 3.A (Cutting Edge) has 8. Proven Stack has **4**.

---

## 9. Monthly Cost at MAU 8K

### Infrastructure

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Hetzner CCX23 (4 vCPU, 16GB) | €23.99 (~$26) | App + DB + Redis + KataGo + Umami + Grafana |
| Hetzner Storage Box (100GB) | €3.81 (~$4) | Automated backups |
| Domain | ~$1 | Annual amortized |
| **Infrastructure subtotal** | **~$31** | |

### External Services

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Cloudflare (Free tier) | $0 | CDN + R2 (10GB free) |
| Resend (Free tier) | $0 | < 500 emails/month |
| Stripe fees | ~$50 (5% of revenue) | On $1K MRR (~100 premium users) |
| Google OAuth | $0 | Free |
| Web Push (VAPID) | $0 | Free (browser vendor operated) |
| **Services subtotal** | **~$50** | |

### AI Costs (Phase 2+ Only)

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Claude Haiku 4.5 | ~$15-30 | 80% of AI calls, prompt caching applied |
| Claude Sonnet 4.6 | ~$5-10 | Premium review reports only, Batch API |
| **AI subtotal** | **$0 (Phase 1) / $20-40 (Phase 2+)** | Hard cap: $100/month |

### Total Monthly Cost

| Phase | Monthly Total | Breakdown |
|-------|--------------|-----------|
| **Phase 1 (launch, no Claude API)** | **$81** | $31 infra + $50 Stripe fees |
| **Phase 2 (with Claude API)** | **$101-121** | $31 infra + $50 Stripe + $20-40 AI |
| **Absolute maximum** | **$131** | All services at max + AI hard cap |

**Comparison**:

| Scenario | Monthly Cost (MAU 8K) |
|----------|----------------------|
| **Proven Stack** | **$80-115** |
| Stability (2.B) | $80-115 |
| Cutting Edge (3.A) | ~$200 |
| Maintainability (2.D) | $78-100 |
| Latest Tech (2.A) | $47-89 (deceptive) |

Proven Stack ties with the Stability scenario for lowest cost. The Latest Tech scenario appears cheaper but excludes hidden SaaS scaling costs, trial expirations, and premium tier upgrades.

---

## 10. Implementation Timeline

### 8-Week Sprint Plan

**Total: 8 weeks** — fastest of all scenarios because we have the fewest integrations to build.

#### Week 1-2: Foundation

| Task | External API? | Notes |
|------|--------------|-------|
| Next.js 15 + TypeScript strict setup | No | Proven boilerplate |
| PostgreSQL 16 + Drizzle schema | No | Local |
| Go rules engine (19x19, 9x9, 13x13) | No | Pure logic, no external |
| Board UI component (React Canvas) | No | Pure frontend |
| NextAuth v4 (Credentials only) | No | Zero external at this stage |
| Coolify + Hetzner deployment | No | Infrastructure |
| **External API calls introduced**: 0 | | |

#### Week 3-4: Game Engine

| Task | External API? | Notes |
|------|--------------|-------|
| KataGo v1.15.x integration (stdio IPC) | No | Local binary |
| WebSocket game server (ws) | No | Local |
| PvP real-time gameplay | No | Local |
| AI opponent (KataGo, 10 levels) | No | Local |
| Template commentary engine (200 templates) | No | Local JSON |
| Glicko-2 rating system | No | Pure math |
| **External API calls introduced**: 0 | | |

#### Week 5-6: Polish + First External APIs

| Task | External API? | Notes |
|------|--------------|-------|
| Google OAuth (NextAuth provider) | **Yes — #1** | First external API |
| Umami v3 analytics (self-hosted) | No | Same server |
| Prometheus + Grafana (self-hosted) | No | Same server |
| Resend integration (3 templates) | **Yes — #2** | Second external API |
| Web Push notifications (VAPID) | **Yes — #3** | Browser push endpoints |
| PWA manifest + service worker | No | Local |
| i18n (next-intl, KO+EN) | No | Local |
| **External API calls introduced**: 3 | | |

#### Week 7-8: Monetization + Launch

| Task | External API? | Notes |
|------|--------------|-------|
| Stripe Checkout integration | **Yes — #4** | Fourth and final external API |
| Stripe Customer Portal | No | Stripe-hosted, same integration |
| Matchmaking system | No | Local |
| Onboarding tutorial (5 min) | No | Local |
| Load testing + QA | No | |
| Error logging (PG table) | No | Local |
| Backup automation | No | Hetzner Storage Box |
| **External API calls introduced**: 1 | | |

### Timeline Summary

```
Week 1-2:  Foundation (0 external APIs)    — app runs fully offline
Week 3-4:  Game Engine (0 external APIs)   — playable Go with AI
Week 5-6:  Polish (3 external APIs added)  — auth, email, push
Week 7-8:  Launch (1 external API added)   — payment
───────────────────────────────────────────
Total:     8 weeks, 4 external API integrations

Week 9-12: (CONDITIONAL) Claude API        — only if templates < 60% satisfaction
```

**Comparison**:

| Scenario | Timeline |
|----------|----------|
| Speed (2.C) | 2 weeks (MVP only) |
| **Proven Stack (3.C)** | **8 weeks** |
| Stability (2.B) | 8 weeks |
| Latest Tech (2.A) | 10 weeks |
| Cutting Edge (3.A) | 26-30 weeks |

---

## 11. Success Probability

### Definition of "Success"

A production Go app where users can:
1. Create an account and log in
2. Play Go against humans (real-time) and AI (KataGo)
3. Receive move commentary (template-based at minimum)
4. View their rating and game history
5. Optionally subscribe to Premium

### Probability Analysis

| Scenario | Success Prob. | Why |
|----------|-------------|-----|
| **Proven Stack — full scope** | **90-95%** | 4 external deps, all with fallbacks. Zero unproven tech. |
| **Proven Stack — if all external APIs fail** | **75-80%** | App still works: credentials auth, local AI, templates, in-app notifications. Only payment breaks. |
| Stability (2.B) | 80-85% | More integrations, slightly higher risk |
| Speed (2.C) | 70-75% | Scope too minimal for real product |
| Maintainability (2.D) | 75-80% | More complex architecture |
| Cutting Edge (3.A) | 50-55% | Too many unproven technologies |
| Latest Tech (2.A) | 40-50% | 23 external services = 23 failure points |

### Why 90-95%

1. **4 external dependencies** — each with a documented, tested fallback
2. **Zero technology younger than 3 years** — every tool has known failure modes
3. **8-week timeline** — low complexity = low risk of scope creep
4. **Self-hosted critical path** — KataGo, game engine, rules, rating all run locally
5. **Template-first AI** — eliminates LLM reliability risk at launch
6. **Single server** — no distributed systems coordination failures
7. **Proven patterns** — REST, WebSocket, bcrypt, JWT — zero learning curve for AI agents

### The Only Way This Fails

| Failure Mode | Probability | Impact | Mitigation |
|-------------|-------------|--------|------------|
| KataGo integration proves harder than expected | 15% | 2-week delay | Use lighter model, reduce concurrent sessions |
| WebSocket game sync bugs | 10% | 1-week delay | Extensive testing in Week 3-4 |
| User satisfaction < 30% (app too basic) | 5% | Product failure | This is a product risk, not a technical risk. Claude API addition in Phase 2 addresses it. |

---

## 12. What You Sacrifice

The Proven Stack is the **most conservative** scenario. Here is what you give up:

### Features Sacrificed

| Feature | Available In | Why Sacrificed | Recovery Path |
|---------|-------------|----------------|---------------|
| Natural language AI commentary at launch | 3.A, 2.D | Template-first approach delays Claude API | Add Claude API in Week 9-12 if needed |
| Rich AI game reviews | 3.A | Requires Claude Sonnet (expensive, external) | Phase 2, premium-only feature |
| Passkeys / passwordless auth | 3.A, 2.A | < 3 years of widespread adoption | Add when ecosystem matures (2027+) |
| Multi-model AI (Gemini Nano on-device) | 2.A | Experimental, Chrome-only | Not viable for production in 2026 |
| MCP protocol integration | 2.A | < 2 years old, unnecessary complexity | Direct KataGo stdio is simpler |
| tRPC end-to-end type safety | 3.A, 2.A | < 4 years old, vendor lock-in risk | REST + Zod provides type safety at boundaries |
| Real-time collaborative analysis | 2.A | Requires complex WebSocket state sync | Phase 2+ feature |
| Social features (friends, chat) | All | Scope reduction for 8-week timeline | Phase 2 feature |
| Gamification (badges, quests) | 3.A | Scope reduction | Phase 2 feature |
| Marketing landing page | 3.A | Scope reduction | Week 9-10 task |

### Competitive Edge Sacrificed

| Dimension | Proven Stack | Cutting Edge (3.A) |
|-----------|-------------|-------------------|
| "Wow factor" | Low — functional but plain | High — natural language AI everywhere |
| Time-to-market | Fast (8 weeks) | Slow (26-30 weeks) |
| Technical moat | None — anyone can replicate | Moderate — complex AI pipeline |
| User delight | Reliable but utilitarian | Magical but fragile |
| Developer perception | "Boring" | "Impressive" |

### The Counter-Argument: Boring Is Good

[Pieter Levels](https://medium.com/swlh/how-pieter-levels-makes-at-least-210k-a-month-from-his-laptop-with-zero-employees-47d8046f43cd) generates $3M+/year with PHP + jQuery + SQLite. [Basecamp](https://news.ycombinator.com/item?id=23642484) runs HEY.com with Rails + MySQL + Redis serving millions. [Choose Boring Technology](https://mcfunley.com/choose-boring-technology) (Dan McKinley, 2015) argues that innovation tokens are finite — spend them on your product, not your stack.

For a baduk app, the product innovation is **AI-powered game analysis** (KataGo, running locally). The stack should be invisible. Proven Stack ensures the stack never becomes the story.

---

## 13. Risk Register

### Top 5 Risks (Ranked by Severity)

| # | Risk | Probability | Impact | Severity | Mitigation |
|---|------|-------------|--------|----------|------------|
| R1 | **Template commentary too basic — users unsatisfied** | 30% | Medium | **Medium** | Phase 2 Claude API addition. User surveys at Week 6. Templates cover 85%+ of common patterns. |
| R2 | **KataGo CPU performance insufficient for concurrent users** | 15% | Medium | **Low-Medium** | Queue system (BullMQ). Smaller model fallback. KataGo analysis is async — users wait 3-8 seconds. At MAU 8K, peak concurrent analyses ~5-10, well within CPU Eigen capacity. |
| R3 | **Resend outage during critical password reset** | 20% | Low | **Low** | Google OAuth bypasses email entirely. Password reset can wait 2 hours for retry. Resend has ~3 outages/month but most are < 30 min. |
| R4 | **Stripe API change breaks webhook integration** | 5% | Medium | **Very Low** | Stripe maintains backward compatibility for years. Webhook API version is pinned. We use only 2 webhook events — minimal surface area. |
| R5 | **Single server failure (Hetzner)** | 3% | High | **Very Low** | Automated daily backups to Hetzner Storage Box. Recovery: spin new server + restore from backup (< 1 hour). Hetzner SLA: [99.9% uptime](https://www.hetzner.com/legal/terms-and-conditions). |

### Risk Comparison Across Scenarios

| Risk Category | Proven Stack | Cutting Edge (3.A) | Latest Tech (2.A) |
|--------------|-------------|--------------------|--------------------|
| External service failure | **Very Low** (4 deps) | Medium (8 deps) | High (23 deps) |
| Technology immaturity | **None** (all 3+ years) | High (Bun, Next.js 16, Valkey) | Very High (MCP, Passkeys, WebLLM) |
| Integration complexity | **Very Low** (14 endpoints) | High (multi-layer) | Very High (23 services) |
| Cost overrun | **Very Low** ($80-115 fixed) | Medium (LLM costs variable) | High (SaaS tier upgrades) |
| Timeline overrun | **Very Low** (8 weeks, minimal) | High (26-30 weeks) | Medium (10 weeks) |

**Total risk score**: Proven Stack has the lowest aggregate risk of any scenario.

---

## 14. "Zero External API" Test

**Question**: Can the app run if ALL external APIs are simultaneously down?

### Scenario: Complete External API Failure

| Service Down | Impact | App Behavior |
|-------------|--------|-------------|
| Google OAuth | Cannot login via Google | **Credentials login works** (email + password, bcrypt, local JWT) |
| Stripe | Cannot process new payments | **Existing subscribers retain premium** (cached in PG). New subscriptions show "temporarily unavailable." |
| Resend | Cannot send email | **No impact on core gameplay.** Password reset: use Google OAuth (also down) → show "try again later." Welcome email: queued for retry. |
| Claude API | No AI commentary | **Template engine provides commentary** (200+ templates, local JSON, zero API). Quality lower but functional. |
| Cloudflare CDN | No CDN caching | **App served directly from Hetzner.** Higher latency for static assets but fully functional. |
| Cloudflare R2 | No object storage | **Avatars show default. SGF files served from PG (backup storage).** |
| Browser Push (FCM/Mozilla/APNs) | No push notifications | **In-app notification badge** (polling every 30s when tab active). |
| npm registry | Cannot install new packages | **No impact on running app.** Only affects build/deploy. `npm ci --offline` works with cached lockfile. |
| GitHub | Cannot push/deploy | **No impact on running app.** Only affects development workflow. |

### Verdict: YES — The App Survives Complete API Failure

**Core functionality preserved**:
- Login (credentials)
- Play Go vs human (WebSocket, local server)
- Play Go vs AI (KataGo, local binary)
- View AI analysis (KataGo, local)
- Read move commentary (templates, local)
- View rating and stats (Glicko-2, local PG)
- View analytics (Umami, local)
- Monitor system (Prometheus + Grafana, local)

**Degraded functionality**:
- No Google login (credentials still work)
- No new premium subscriptions (existing ones work)
- No email (non-critical)
- No push notifications (in-app fallback)
- Lower quality AI commentary (templates vs Claude)

**Completely broken**:
- Nothing. Zero features are completely broken.

### The Proven Stack Guarantee

> **If you can run `docker compose up` on a single Hetzner server with a KataGo binary, you have a fully functional Go application.** Everything else — Stripe, Resend, Claude, Cloudflare — is enhancement, not requirement.

This is the defining characteristic of the Proven Stack. No other scenario can make this claim.

---

## Appendix A: Technology Version Matrix

| Category | Technology | Version | Production Since | Proven Score |
|----------|-----------|---------|-----------------|-------------|
| Runtime | Node.js | 22 LTS | 2009 | 10/10 |
| Framework | Next.js | 15.x | 2016 | 9/10 |
| Language | TypeScript | 5.6+ strict | 2012 | 10/10 |
| Database | PostgreSQL | 16 | 1996 | 10/10 |
| Cache | Redis | 7.2 | 2009 | 10/10 |
| ORM | Drizzle | stable | 2022 | 7/10 |
| Auth | NextAuth.js | v4 | 2020 | 9/10 |
| Payment | Stripe Checkout | hosted | 2019 | 10/10 |
| Email | Resend | latest | 2023 | 6/10 |
| Push | web-push (VAPID) | latest | 2016 | 9/10 |
| WebSocket | ws | latest | 2011 | 10/10 |
| AI Engine | KataGo | v1.15.x | 2019 | 10/10 |
| AI LLM | Claude API | Haiku 4.5 | 2023 | 7/10 |
| AI Fallback | Template engine | custom | N/A | 10/10 |
| Analytics | Umami | v3 | 2020 | 7/10 |
| Metrics | Prometheus | latest | 2012 | 10/10 |
| Dashboard | Grafana OSS | latest | 2014 | 10/10 |
| Validation | Zod | latest | 2020 | 8/10 |
| Rating | Glicko-2 | glicko2.ts | 2001 (algorithm) | 10/10 |
| CI/CD | GitHub Actions | latest | 2019 | 9/10 |
| PaaS | Coolify | latest | 2021 | 7/10 |
| Cloud | Hetzner | — | 1997 | 9/10 |
| CDN | Cloudflare | free tier | 2010 | 10/10 |
| Linting | ESLint + Prettier | 9 + 3 | 2013 / 2017 | 10/10 |
| Testing | Vitest + Playwright | 3.x | 2022 / 2020 | 8/10 |
| Password | bcrypt | 12 rounds | 1999 | 10/10 |

**Note on linting**: Proven Stack uses ESLint + Prettier (combined 21+ years of production history), NOT Biome (< 2 years). Biome is faster, but the Proven Stack does not trade reliability for speed.

---

## Appendix B: Cost Projection (18 Months)

| Period | Infra | Stripe Fees | AI (Claude) | Email | Total Monthly | Cumulative |
|--------|-------|-------------|-------------|-------|---------------|------------|
| Month 1-2 | $31 | $0 | $0 | $0 | **$31** | $62 |
| Month 3-4 | $31 | $25 | $0 | $0 | **$56** | $174 |
| Month 5-6 | $31 | $50 | $20-40 | $0 | **$101-121** | $376-416 |
| Month 7-9 | $35 | $75 | $40-60 | $0 | **$150-170** | $826-926 |
| Month 10-12 | $45 | $100 | $60-80 | $0 | **$205-225** | $1,441-1,601 |
| Month 13-18 | $55 | $150 | $80-100 | $20 | **$305-325** | $3,271-3,551 |

**18-month total: ~$3,300-3,600**

**Comparison**:

| Scenario | 18-Month Total Cost |
|----------|-------------------|
| **Proven Stack** | **~$3,300-3,600** |
| Maintainability (2.D) | ~$6,600 |
| Cutting Edge (3.A) | ~$4,156 |

---

## Appendix C: Decision Rationale Summary

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Runtime | Node.js 22 LTS | Bun 1.3 | Bun is < 3 years old. Node.js has 17 years. |
| Framework | Next.js 15 | Next.js 16 | v16 is too new. v15 has 1+ year of production data. |
| Cache | Redis 7.2 | Valkey 8.1 | Valkey forked in 2024 (< 2 years). Redis has 17 years. |
| ORM | Drizzle | Prisma | Prisma requires codegen. Drizzle's SQL transparency is critical for AI agents. Accept 7/10 proven score. |
| Auth | NextAuth v4 | Auth.js v5 | v5 is still beta. v4 has 6 years of stability. |
| Auth method | Credentials + Google OAuth | Passkeys + Magic Links | Passkeys < 3 years. Magic links require email dependency from day one. |
| Linting | ESLint 9 + Prettier 3 | Biome v2.3 | Biome < 2 years. ESLint has 11 years. |
| API style | REST + Zod | tRPC v11 | tRPC < 4 years. REST is 26 years. |
| Analytics | Umami (self-hosted) | Google Analytics / Mixpanel | SaaS dependency. Umami is self-hosted, MIT, shares PG. |
| Error tracking | PG error_logs table | Sentry | SaaS dependency. At MAU 8K, a database table is sufficient. |
| Monitoring | Prometheus + Grafana (self-hosted) | Grafana Cloud / Datadog | SaaS dependency. Self-hosted at this scale is trivial. |
| AI strategy | Templates first, Claude API earned | Claude API at launch | Reduces external dependency at launch. Templates cover 85%+ of patterns. |
| Email | Resend (free tier) | Self-hosted (Postal) | Email deliverability is too complex to self-host. Accept 6/10 proven score for < 500 emails/month. |
| Push | web-push (VAPID) | OneSignal / Firebase | W3C standard. No intermediary SaaS. |
| Payment | Stripe Checkout hosted | LemonSqueezy / Paddle | Stripe has 14+ years. Hosted checkout = zero PCI scope. |
| Object storage | Cloudflare R2 (free tier) | Local disk | R2 free tier (10GB, zero egress) is effectively free insurance. Fallback: local disk. |

---

## Final Verdict

The Proven Stack Scenario is the **anti-innovation** play. It explicitly sacrifices cutting-edge features, natural language AI, and "wow factor" in exchange for:

- **90-95% success probability** (highest of all scenarios)
- **4 external API dependencies** (lowest of all scenarios)
- **$80-115/month** at MAU 8K (tied for lowest cost)
- **8-week delivery** (second fastest, after the 2-week MVP scenario)
- **Zero complete feature failures** if all external APIs go down
- **9.0/10 weighted proven score** (highest possible)

**When to choose this scenario**:
- You value shipping over showcasing
- You want the highest probability of a working product
- You are a solo developer or tiny team
- You distrust external services
- You want to sleep well at night knowing your app cannot completely fail

**When NOT to choose this scenario**:
- You need "magical" AI commentary to differentiate from competitors
- Your investors expect cutting-edge technology
- You are competing against well-funded Go platforms with rich AI features
- You have a large team that can handle integration complexity

> **"Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."**
> — Antoine de Saint-Exupery
>
> The Proven Stack takes away everything that can fail, and what remains is a Go app that works.

---

Sources:
- [How Pieter Levels Makes $210K/Month From His Laptop](https://medium.com/swlh/how-pieter-levels-makes-at-least-210k-a-month-from-his-laptop-with-zero-employees-47d8046f43cd)
- [DHH: The HEY Stack — Vanilla Ruby on Rails, MySQL, Redis](https://news.ycombinator.com/item?id=23642484)
- [KataGo GitHub — MIT Licensed Go AI Engine](https://github.com/lightvector/KataGo)
- [Auth.js v5 Production Readiness Discussion](https://github.com/nextauthjs/next-auth/discussions/9511)
- [Stripe Checkout Quickstart — Next.js](https://docs.stripe.com/checkout/quickstart?client=next)
- [Stripe + Next.js 15 Complete Guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/)
- [web-push Node.js Library](https://github.com/web-push-libs/web-push)
- [Push API — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Push API Browser Support — Can I Use](https://caniuse.com/push-api)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 Durability](https://developers.cloudflare.com/r2/reference/durability/)
- [Umami Analytics — Privacy-First, Self-Hosted](https://umami.is/)
- [Umami vs Plausible vs Matomo Comparison](https://aaronjbecker.com/posts/umami-vs-plausible-vs-matomo-self-hosted-analytics/)
- [Resend Status — Uptime History](https://isdown.app/status/resend)
- [Best Startup Tech Stack in 2026: Keep It Simple](https://wearebrain.com/blog/best-startup-tech-stack-in-2025/)
- [Vercel NextAuth + PostgreSQL Starter](https://github.com/vercel/nextjs-postgres-auth-starter)
- [NextAuth.js Credentials Provider Documentation](https://next-auth.js.org/configuration/providers/credentials)
- [Building KataGo Workstation — CPU Eigen Benchmarks](https://songyp.com/blog/katago-workstation-build-and-bench)
- [katago-server — REST API for KataGo](https://github.com/goban-app/katago-server)
