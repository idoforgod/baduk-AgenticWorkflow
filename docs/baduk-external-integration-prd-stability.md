# External Integration Technology PRD — Stability First Analysis

**Research**: 4 of 4 (External Integration Technology Deep-Dive)
**Perspective**: Stability First — Minimize Dependencies, Maximize Reliability
**Date**: 2026-03-10
**Prior Context**: Domain Tech PRD decided, Stack: Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, KataGo CPU Eigen, Hetzner+Coolify
**Builder**: AI Agents (Claude Code) — no human developers
**Constraint**: OpenAI/Gemini = subscription accounts ONLY, NO API

---

## Executive Summary

Every external dependency is a potential point of failure. This PRD ruthlessly audits each proposed integration against a single criterion: **does it make the system more or less likely to serve users reliably?** A Go app's users trust it when it never goes down — when their game analysis completes, when their payment processes, when their notifications arrive. That trust is destroyed by a single bad outage at a critical moment.

The research across 10 Phase 1 branches reveals a dangerous temptation: feature-rich architectures with 15+ external dependencies that compound failure risk. Real-world data paints a sobering picture:

- **Claude API**: 99.4% uptime over 90 days — meaning ~4.3 hours of downtime per month. A March 2, 2026 global outage affected all services. Haiku 4.5 had elevated error rates on March 7, 2026.
- **Stripe**: 14 incidents in the last 90 days (2 major, 12 minor), median resolution 63 minutes. Over 674 tracked outages in ~11 years.
- **Hetzner**: 832+ outages tracked over ~5 years. A July 2025 incident took down a third of virtualization nodes in affected clusters.
- **Coolify**: 11 critical CVEs disclosed in January 2026 (CVSS up to 10.0), exposing 52,000+ instances to full server compromise including container escape and root access.
- **Resend**: November 2025 outage caused by upstream Cloudflare failure (3 hours). February 2026 outage from database connection exhaustion (3.5 hours). ~70 incidents since February 2024.

**Core principle**: For serial dependencies, compound availability = product of individual availabilities. Five services each at 99.5% uptime yield 97.5% compound — meaning **18 hours of downtime per month**. Every dependency we eliminate is a direct improvement to system reliability.

**Composite Stability Score: 8.3 / 10**
**Target System Availability: 99.5% (3.6 hours/month maximum downtime)**
**Total External Dependencies: 6 (vs. 15+ in aggressive proposals)**
**Monthly Cost at MAU 8K: $63–115/mo**

---

## Table of Contents

1. [Complete External Integration Stack](#1-complete-external-integration-stack)
2. [Dependency Audit](#2-dependency-audit)
3. [Failure Mode Analysis](#3-failure-mode-analysis)
4. [AI Integration](#4-ai-integration)
5. [Payment & Auth](#5-payment--auth)
6. [Communication](#6-communication)
7. [Analytics & Data](#7-analytics--data)
8. [Integration Patterns](#8-integration-patterns)
9. [Stability Scores](#9-stability-scores)
10. [SLA Budget](#10-sla-budget)
11. [Monthly Cost Breakdown](#11-monthly-cost-breakdown)
12. [Implementation Timeline](#12-implementation-timeline)
13. [Stability Tax](#13-stability-tax)
14. [Risk Register](#14-risk-register)

---

## 1. Complete External Integration Stack

### Architecture: Defense-in-Depth with Minimal Surface Area

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET                                    │
│                            │                                        │
│                    ┌───────▼───────┐                                │
│                    │  Cloudflare   │  CDN + DDoS + R2 Storage       │
│                    │  (Free Tier)  │  [EXTERNAL #1]                 │
│                    └───────┬───────┘                                │
│                            │                                        │
│              ┌─────────────▼─────────────┐                         │
│              │    Hetzner VPS (CX32)     │                         │
│              │    Coolify Self-Hosted     │  [INFRASTRUCTURE]       │
│              │                           │                         │
│              │  ┌─────────────────────┐  │                         │
│              │  │   Next.js 15 App    │  │                         │
│              │  │   + Better Auth     │  │  [SELF-HOSTED AUTH]     │
│              │  └──────────┬──────────┘  │                         │
│              │             │             │                         │
│              │  ┌──────────▼──────────┐  │                         │
│              │  │   PostgreSQL 16     │  │                         │
│              │  │   (Auth + App +     │  │  [SELF-HOSTED DB]       │
│              │  │    Analytics data)  │  │                         │
│              │  └─────────────────────┘  │                         │
│              │                           │                         │
│              │  ┌─────────────────────┐  │                         │
│              │  │   Redis 7.2         │  │                         │
│              │  │   (Cache + Queue +  │  │  [SELF-HOSTED CACHE]    │
│              │  │    Rate Limiting)   │  │                         │
│              │  └─────────────────────┘  │                         │
│              │                           │                         │
│              │  ┌─────────────────────┐  │                         │
│              │  │   KataGo Eigen CPU  │  │  [SELF-HOSTED ENGINE]   │
│              │  └─────────────────────┘  │                         │
│              │                           │                         │
│              │  ┌─────────────────────┐  │                         │
│              │  │  Umami Analytics    │  │  [SELF-HOSTED ANALYTICS]│
│              │  │  Bugsink Errors     │  │                         │
│              │  │  Uptime Kuma Mon.   │  │                         │
│              │  └─────────────────────┘  │                         │
│              └───────────────────────────┘                         │
│                            │                                        │
│              ┌─────────────▼─────────────┐                         │
│              │   EXTERNAL API CALLS       │                         │
│              │   (Circuit Breaker Layer)  │                         │
│              │                           │                         │
│              │   Claude API ──────────── [EXTERNAL #2]             │
│              │   Stripe API ──────────── [EXTERNAL #3]             │
│              │   Resend Email ─────────── [EXTERNAL #4]            │
│              │   Discord Webhooks ─────── [EXTERNAL #5]            │
│              │   Web Push (browser) ───── [EXTERNAL #6]            │
│              └───────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### What Was Rejected and Why

| Proposed Integration | Status | Reason for Rejection |
|---------------------|--------|---------------------|
| Gemini Nano / WebLLM | **REJECTED** | Korean NOT supported, adds browser-side failure mode, non-deterministic |
| MCP Protocol | **REJECTED** | Unnecessary complexity for MAU 8K, immature protocol |
| Novu notification hub | **REJECTED** | Additional SaaS dependency for <8K users, Resend+WebPush sufficient |
| FCM (Firebase Cloud Messaging) | **REJECTED** | Google dependency, Web Push API covers browser notifications |
| PostHog | **REJECTED** | SaaS dependency when Umami self-hosted is sufficient |
| Sentry (cloud) | **REJECTED** | $26+/mo SaaS when Bugsink self-hosted uses 0.1x resources |
| Better Stack (cloud) | **REJECTED** | SaaS dependency when Uptime Kuma self-hosted works |
| Svix webhooks | **REJECTED** | Over-engineered for <5 webhook consumers |
| tRPC | **REJECTED** | REST+Zod achieves same type safety without lock-in |
| OAuth 2.1 (standalone) | **REJECTED** | Better Auth handles OAuth flows internally |
| next-intl (5 locales) | **REJECTED** | Start with ko/en only; add locales when demand proven |
| Discord.js (full bot) | **REJECTED** | Webhooks cover 95% of use cases with zero persistent connection |

---

## 2. Dependency Audit

### External Dependencies (6 total)

| # | Dependency | Category | Necessity | Can App Function Without It? | Stability Score |
|---|-----------|----------|-----------|------------------------------|----------------|
| 1 | **Cloudflare** | CDN/Security | High | Yes — direct to origin, slower but functional | 9/10 |
| 2 | **Claude API** | AI Features | Medium | Yes — template fallback covers 100% of cases | 7/10 |
| 3 | **Stripe** | Payments | High | Partially — free tier works, paid features degrade | 9/10 |
| 4 | **Resend** | Email | Medium | Yes — queue emails, retry when restored | 7/10 |
| 5 | **Discord Webhooks** | Community | Low | Yes — non-critical notifications | 9/10 |
| 6 | **Web Push** | Notifications | Low | Yes — in-app notifications remain | 8/10 |

### Self-Hosted Dependencies (7 total — all on same server)

| # | Component | Purpose | Single Point of Failure? | Mitigation |
|---|----------|---------|--------------------------|------------|
| 1 | **PostgreSQL 16** | Primary data store | YES — critical | Daily pg_dump to Cloudflare R2, WAL archiving |
| 2 | **Redis 7.2** | Cache + queues | No — app degrades gracefully | AOF persistence, app works without cache |
| 3 | **KataGo Eigen** | Game analysis | No — queue buffers requests | Watchdog auto-restart, analysis queued |
| 4 | **Umami** | Analytics | No — analytics can be offline | Data in PG, recoverable |
| 5 | **Bugsink** | Error tracking | No — errors logged locally too | Single container, minimal resources |
| 6 | **Uptime Kuma** | Monitoring | No — monitors other services | Lightweight, independent |
| 7 | **Coolify** | Deployment | No — containers run independently | Containers survive Coolify downtime |

### Dependency Count Comparison

| Approach | External APIs | Self-Hosted | Total | Compound Availability* |
|----------|--------------|-------------|-------|----------------------|
| Aggressive (Branch 1.1+2.2+3.2+4.2+5.1) | 12+ | 5 | 17+ | ~96.2% |
| **Stability First (This PRD)** | **6** | **7** | **13** | **~99.1%** |
| Theoretical minimum | 2 | 5 | 7 | ~99.6% |

*Compound availability considers only serial critical-path dependencies.

---

## 3. Failure Mode Analysis

### Critical Path Failures (System Cannot Serve Users)

| Failure | Probability | Impact | Detection Time | Recovery Time | Mitigation |
|---------|-------------|--------|---------------|---------------|------------|
| **Hetzner server down** | Medium (832 outages/5yr) | Total outage | <1 min (external monitor) | 5-60 min | Cloudflare "maintenance" page, PG backup to R2 |
| **PostgreSQL crash** | Low | Total outage | <30s (health check) | 1-5 min (auto-restart) | WAL archiving, daily R2 backup, connection pooling |
| **Coolify compromise** | Medium (11 CVEs 2026) | Server takeover | Hours-Days | Hours | Immediate patching, minimal exposed ports, SSH key only |
| **Redis OOM crash** | Medium | Degraded (no cache) | <30s | 30s (auto-restart) | maxmemory-policy allkeys-lru, AOF persistence |
| **Next.js middleware bypass** | Low (CVE patched) | Auth bypass | N/A | N/A | Upgrade to Next.js 15.2.3+, strip x-middleware-subrequest at Cloudflare |

### Degraded Mode Failures (Features Unavailable, Core Works)

| Failure | Probability | Impact | User Experience | Auto-Recovery |
|---------|-------------|--------|----------------|---------------|
| **Claude API down** | Medium (99.4% = ~4.3hr/mo) | No AI explanations | Template explanations shown, "AI temporarily unavailable" badge | Yes — circuit breaker half-open every 30s |
| **Stripe API down** | Low (99.5%+) | No new payments | Existing sessions work, new purchases show "try again later" | Yes — webhook retry queue |
| **Resend down** | Medium (~70 incidents/2yr) | No email delivery | Emails queued in Redis, sent on recovery | Yes — BullMQ retry with exponential backoff |
| **Discord webhooks fail** | Very Low | No community notifications | Silent failure, logged for manual review | Yes — fire-and-forget with logging |
| **KataGo crash** | Low | No game analysis | "Analysis queued, will complete shortly" | Yes — watchdog restart <10s |

### Cascading Failure Scenarios

```
Scenario 1: Cloudflare Outage (Nov 2025 precedent — took down Resend)
├── Cloudflare CDN down
├── → Direct traffic hits Hetzner origin (higher latency, no DDoS protection)
├── → Resend email fails (Cloudflare dependency)
├── → Mitigation: DNS failover timeout, email queue in Redis
└── → User impact: Slower page loads, delayed emails. Core app WORKS.

Scenario 2: Hetzner Virtualization Failure (Jul 2025 precedent)
├── Server completely unreachable
├── → ALL self-hosted services down
├── → Cloudflare serves cached static assets + maintenance page
├── → Stripe webhooks queued (72hr retry window)
├── → Emails queued at Resend (retry on recovery)
└── → User impact: TOTAL OUTAGE until Hetzner recovers. RTO: 5-60 min.

Scenario 3: Redis Memory Exhaustion
├── Redis OOM kill
├── → Cache miss: all requests hit PostgreSQL
├── → BullMQ queues lost (if AOF not enabled)
├── → Rate limiting disabled temporarily
├── → Mitigation: AOF enabled, maxmemory 256MB, auto-restart
└── → User impact: Slower responses for 30-60s during restart.

Scenario 4: Claude API Sustained Outage (Mar 2, 2026 precedent)
├── Claude API returns 5xx for hours
├── → Circuit breaker opens after 5 failures in 30s
├── → All explanation requests served by template engine
├── → Users see "powered by templates" indicator
├── → No data loss, no cascading failure
└── → User impact: Lower quality explanations. Core app UNAFFECTED.
```

---

## 4. AI Integration

### Decision: Conservative Claude-Only with Template Dominance

**Stability Score: 7.5 / 10**

The aggressive branch proposed 5 layers (Gemini Nano + WebLLM + Claude + MCP + Template). This is architectural malpractice from a stability perspective. Gemini Nano does not support Korean — a dealbreaker for a Korean Go community app. WebLLM adds browser-side model loading failures. MCP adds protocol complexity for zero user benefit at MAU 8K.

### Architecture: Template-First, Claude-Optional

```
┌─────────────────────────────────────────────────────────┐
│              Explanation Request Pipeline                 │
│                                                          │
│  Request ──▶ Template Engine (in-process, 0ms latency)   │
│                   │                                      │
│              Can template                                │
│              answer this?                                │
│                   │                                      │
│           ┌───────┼───────┐                              │
│           │ YES   │       │ NO                           │
│           ▼       │       ▼                              │
│     Return        │   Claude API                         │
│     template      │   available?                         │
│     response      │       │                              │
│                   │   ┌───┼───┐                          │
│                   │   │YES│   │NO                        │
│                   │   ▼   │   ▼                          │
│                   │ Call  │ Return enhanced               │
│                   │ Claude│ template + badge              │
│                   │ Haiku │ "AI unavailable"             │
│                   │   │   │                              │
│                   │   ▼   │                              │
│                   │ Cache │                              │
│                   │ result│                              │
│                   │ (Redis│                              │
│                   │ 24hr) │                              │
│                   └───────┘                              │
└─────────────────────────────────────────────────────────┘
```

### Tier Distribution (Target)

| Tier | Handler | Expected Traffic | Latency | Cost/Request | Reliability |
|------|---------|-----------------|---------|-------------|-------------|
| T0 | **Template Engine** | 60% | <5ms | $0 | 100% (in-process) |
| T1 | **Redis Cache Hit** | 20% | <10ms | $0 | 99.9% (local Redis) |
| T2 | **Claude Haiku** | 15% | 200-800ms | ~$0.001 | 99.4% (API) |
| T3 | **Claude Sonnet** | 4% | 500-2000ms | ~$0.01 | 99.4% (API) |
| T4 | **Claude Opus** | 1% | 1-5s | ~$0.05 | 99.4% (API) |

### Template Engine: The Reliability Backbone

The template engine must handle 100% of traffic when Claude is down. It is not a fallback — it is the **primary system**, with Claude providing optional enhancement.

```
Template categories (pre-built, deterministic):
├── Opening patterns (joseki, fuseki) → 200+ templates from CWI 88K pro games
├── Capture/atari explanations → 50+ templates
├── Territory assessment → 30+ templates with numeric scoring
├── Life and death → 40+ templates keyed to common shapes
├── Endgame counting → 20+ templates
├── Move quality ratings → KataGo winrate delta mapped to 5 tiers
└── Error explanations → "This move lost X% winrate because..."
```

### Claude API Integration Specifications

```typescript
// Circuit breaker configuration (opossum)
const claudeBreaker = new CircuitBreaker(callClaudeAPI, {
  timeout: 10_000,          // 10s hard timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,     // 30s before half-open
  rollingCountTimeout: 60_000,
  volumeThreshold: 5,       // minimum 5 calls before tripping
});

claudeBreaker.fallback(() => templateEngine.generate(context));

// Prompt caching: 85-90% cost reduction on repeated patterns
// Cache key: hash(board_state + analysis_type + language)
// TTL: 24 hours in Redis, prompt cache at Anthropic side

// Rate limiting: 100 requests/min to Claude API
// User-level: 20 AI explanations/hour per user
// Global: 2000 AI explanations/hour across all users
```

### Monthly AI Cost Estimate

| Scenario | Template % | Claude Calls | Prompt Cache Hit | Monthly Cost |
|----------|-----------|-------------|-----------------|-------------|
| Conservative (target) | 60% | ~12K | 85% | $18-25 |
| Moderate usage | 50% | ~20K | 80% | $30-45 |
| Heavy usage peak | 40% | ~30K | 75% | $45-65 |

---

## 5. Payment & Auth

### Decision: Better Auth (Self-Hosted) + Stripe Checkout (Minimal Surface)

**Stability Score: 8.5 / 10**

### Authentication: Better Auth

The Big Bang proposal (7 providers, 2FA/TOTP, RBAC, 10 DB tables, 8 weeks) is antithetical to stability. Every auth provider is a dependency. Every additional table is a migration risk. Every feature is an attack surface.

```
Auth Architecture (Stability-Optimized):
├── Better Auth (self-hosted, TypeScript-first)
│   ├── Email + password (primary)
│   ├── Google OAuth (single social provider — widest coverage)
│   ├── Magic link (via Resend — passwordless option)
│   └── DB sessions in PostgreSQL (not JWT — revocable)
│
├── Security Hardening
│   ├── Next.js 15.2.3+ (CVE-2025-29927 patched)
│   ├── Cloudflare: strip x-middleware-subrequest header
│   ├── Rate limiting: Redis-backed, 5 login attempts/15 min
│   ├── CSRF: Double-submit cookie pattern
│   ├── Password: argon2id, minimum 8 chars
│   └── Session: httpOnly, secure, sameSite=strict, 30-day expiry
│
└── What Was Deferred
    ├── 2FA/TOTP → Phase 2 (when user demand proven)
    ├── KakaoTalk OAuth → Phase 2 (Korean market validation first)
    ├── RBAC → Simple role column (free/pro/admin) on user table
    └── B2B 도장 plan → Phase 3 (requires market validation)
```

### Payment: Stripe Checkout + Customer Portal

Stripe is the only viable payment processor given the constraints. The key stability decisions:

```
Payment Architecture:
├── Stripe Checkout (hosted) — NOT custom payment form
│   ├── PCI compliance handled by Stripe
│   ├── 3D Secure handled by Stripe
│   ├── KakaoPay/NaverPay supported natively
│   └── Zero payment UI code to maintain
│
├── Stripe Customer Portal (hosted) — NOT custom billing UI
│   ├── Subscription management
│   ├── Invoice history
│   ├── Payment method updates
│   └── Zero billing UI code to maintain
│
├── Webhook Processing (critical path)
│   ├── HMAC signature verification (stripe-signature header)
│   ├── Idempotency: event ID dedup in PostgreSQL
│   ├── Retry: Stripe retries for 72 hours
│   ├── Events handled:
│   │   ├── checkout.session.completed → activate subscription
│   │   ├── customer.subscription.updated → sync plan changes
│   │   ├── customer.subscription.deleted → downgrade to free
│   │   └── invoice.payment_failed → notify user, grace period
│   └── Failure mode: if webhook processing fails,
│       user stays on current plan (fail-safe, not fail-open)
│
├── Entity Requirement
│   ├── Stripe Atlas: $500 one-time for US LLC
│   ├── Alternative: Japan entity (Stripe JP supports KRW)
│   └── Decision: Stripe Atlas US LLC (fastest, most flexible)
│
└── Subscription Tiers
    ├── Free: 5 analyses/day, template explanations only
    ├── Pro ($9.99/mo): 50 analyses/day, Claude explanations
    └── Premium ($19.99/mo): unlimited analyses, Sonnet/Opus access
```

### Stripe Failure Mode

```
Stripe API down:
├── New subscriptions: "Payment processing temporarily unavailable"
├── Existing subscribers: Continue working (subscription status cached in PG)
├── Webhook queue: Stripe retries automatically for 72 hours
├── Revenue loss: ~$0 (users retry later)
└── Recovery: Automatic when Stripe recovers
```

### Monthly Payment Cost

| Component | Cost |
|-----------|------|
| Stripe Atlas (one-time) | $500 |
| Stripe processing (2.9% + $0.30) | ~$15-40/mo at MAU 8K |
| Stripe monthly fee | $0 (no monthly fee on standard) |

---

## 6. Communication

### Decision: Resend + Web Push + Discord Webhooks

**Stability Score: 8.0 / 10**

The Robust branch proposed Novu, FCM, next-intl with 5 locales, and Discord.js. Each adds a dependency with minimal incremental value at MAU 8K.

### Email: Resend

```
Email Architecture:
├── Transactional (via Resend API)
│   ├── Welcome email
│   ├── Password reset / magic link
│   ├── Subscription confirmation
│   ├── Payment receipt (Stripe handles directly)
│   └── Weekly analysis summary (opt-in)
│
├── Failure Handling
│   ├── All emails queued via BullMQ (Redis-backed)
│   ├── Retry: 3 attempts with exponential backoff (1m, 5m, 30m)
│   ├── Dead letter queue after 3 failures
│   ├── Resend status: 99.26% overall uptime, ~70 incidents/2yr
│   ├── Known risk: Cloudflare dependency (Nov 2025 outage)
│   └── Mitigation: emails are never blocking — user can continue
│
├── Volume & Cost
│   ├── MAU 8K: ~3K-5K emails/month
│   ├── Resend free tier: 3,000 emails/month
│   ├── Resend Pro: $20/mo for 50,000 emails
│   └── Estimate: $0-20/mo
│
└── Templates
    ├── React Email components (compiled at build time)
    ├── ko/en bilingual (hardcoded, not i18n framework)
    └── Plain text fallback for every HTML template
```

### Notifications: Web Push API (No FCM)

```
Web Push Architecture:
├── Service Worker registration on first visit
├── VAPID keys (self-generated, no third-party service)
├── Push events:
│   ├── Analysis complete
│   ├── Game invitation
│   ├── Opponent's turn (live games)
│   └── Weekly digest available
│
├── Browser Support (2026)
│   ├── Chrome/Edge: Full support
│   ├── Firefox: Full support
│   ├── Safari 18.5+: Declarative Web Push (improved reliability)
│   ├── iOS Safari: Supported since iOS 16.4
│   └── Coverage: ~95% of modern browsers
│
├── Reliability Considerations
│   ├── Chrome 144+ rate limits for low-engagement notifications
│   ├── Mitigation: only send high-value notifications
│   ├── Target: <5 push notifications/user/day
│   ├── Expected delivery rate: 90%+ with good engagement
│   └── Fallback: in-app notification bell always works
│
└── Cost: $0 (Web Push API is free, browser-native)
```

### Community: Discord Webhooks (Not Discord.js Bot)

```
Discord Integration:
├── Webhooks only (no persistent connection, no bot process)
│   ├── New pro game analysis shared
│   ├── Weekly leaderboard updates
│   ├── Server maintenance announcements
│   └── New feature announcements
│
├── Implementation
│   ├── Simple POST to webhook URL
│   ├── Fire-and-forget with error logging
│   ├── No authentication state to manage
│   ├── No WebSocket connection to maintain
│   └── No Discord.js dependency (6.5MB, gateway connection)
│
├── Failure Mode
│   ├── Webhook fails: log error, continue
│   ├── Discord outage: zero impact on app
│   └── Rate limit (30 req/min): batch notifications
│
└── Cost: $0
```

---

## 7. Analytics & Data

### Decision: Self-Hosted Stack (Umami + Bugsink + Uptime Kuma)

**Stability Score: 8.5 / 10**

The Practical branch proposed PostHog + Sentry + Better Stack — all SaaS services with free tiers that can be revoked, rate-limited, or sunset. For a stability-first architecture, **owning your analytics data** is non-negotiable.

### Web Analytics: Umami v3

```
Umami Configuration:
├── Self-hosted on same Hetzner VPS
├── PostgreSQL backend (shares PG 16 instance, separate database)
├── Umami v3: PostgreSQL-only (MySQL dropped)
├── Docker container: ~100MB RAM
├── Tracking script: <1KB, async, zero performance impact
│
├── Tracked Events
│   ├── Page views and sessions
│   ├── Analysis requests (count, type, completion rate)
│   ├── Subscription conversions
│   ├── Feature usage (which analysis features used most)
│   └── Custom events via data attributes
│
├── Privacy
│   ├── GDPR compliant by design (no cookies, no PII)
│   ├── No consent banner needed
│   └── Data stays on our server
│
└── Scaling Concern
    ├── PG-backed analytics slower than ClickHouse at scale
    ├── At MAU 8K: ~240K pageviews/month — well within PG capacity
    ├── Materialized views for dashboard queries (refresh every 5 min)
    └── Revisit at MAU 50K+ (switch to ClickHouse or Plausible)
```

### Error Tracking: Bugsink

```
Bugsink Configuration:
├── Single Docker container (~50MB RAM)
├── No Redis, no queue, no separate frontend
├── Sentry SDK compatible (just change DSN)
├── Handles 1.5M events/day on €5 VPS
│
├── Integration
│   ├── @sentry/nextjs SDK in app (point DSN to Bugsink)
│   ├── Source maps uploaded at build time
│   ├── Error grouping and deduplication
│   ├── Stack trace with local variable state
│   └── Release tracking
│
├── Alerting
│   ├── Discord webhook for new error types
│   ├── Email (via Resend) for critical errors
│   └── No PagerDuty/OpsGenie needed at this scale
│
└── vs Sentry Cloud
    ├── Sentry free: 5K errors/month, 1 user
    ├── Sentry Team: $26/mo
    ├── Bugsink: $0/mo, unlimited errors, unlimited retention
    └── Trade-off: no performance monitoring (acceptable at MAU 8K)
```

### Uptime Monitoring: Uptime Kuma

```
Uptime Kuma Configuration:
├── Single Docker container (~80MB RAM)
├── 20-second monitoring intervals
│
├── Monitors
│   ├── HTTP: App homepage, API health endpoint
│   ├── HTTP: Stripe webhook endpoint
│   ├── TCP: PostgreSQL port
│   ├── TCP: Redis port
│   ├── HTTP: KataGo health check
│   ├── HTTP: Umami dashboard
│   ├── HTTP: Bugsink dashboard
│   └── External: Claude API status page
│
├── Alerting
│   ├── Discord webhook (immediate)
│   ├── Email via Resend (for sustained outages >5 min)
│   └── Web Push notification to admin
│
├── Status Page
│   ├── Public status page at status.yourdomain.com
│   ├── Shows real-time service health
│   └── Incident history
│
├── Limitation
│   ├── Single node — if server is down, monitoring is down too
│   ├── Mitigation: external ping from free UptimeRobot (1 monitor free)
│   └── UptimeRobot pings Uptime Kuma; if down, alerts admin directly
│
└── Cost: $0 (self-hosted) + $0 (UptimeRobot free tier for external check)
```

### Go Data Sources

```
Game Data Pipeline:
├── CWI 88K pro games (public domain SGF files)
│   ├── Download once at build time
│   ├── Parse with @sabaki/sgf (npm, in-process)
│   ├── Store patterns in PostgreSQL
│   └── No ongoing external dependency
│
├── featurecat 21.1M games (optional, Phase 2)
│   ├── Massive dataset — storage and processing concern
│   ├── Defer to Phase 2 after validating user demand
│   └── If needed: batch import, Cloudflare R2 for raw SGF storage
│
└── KataGo analysis results
    ├── Cache in PostgreSQL (permanent)
    ├── Cache in Redis (24hr hot cache)
    └── Same position = same analysis (deterministic with fixed settings)
```

---

## 8. Integration Patterns

### Decision: Classical REST + Zod + Circuit Breaker

**Stability Score: 9.0 / 10**

The Modern branch proposed MCP + tRPC + OAuth 2.1 + edge functions + Svix. Each adds complexity. tRPC provides type safety but creates tight coupling. MCP is immature. Svix is unnecessary for <5 webhook consumers. Edge functions fragment the runtime.

### Core Pattern: REST + Zod Validation

```typescript
// Every external API call follows this pattern:

// 1. Zod schema defines expected response
const ClaudeResponseSchema = z.object({
  content: z.array(z.object({
    text: z.string(),
    type: z.literal('text'),
  })),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
});

// 2. Circuit breaker wraps the call
const claudeBreaker = new CircuitBreaker(callClaude, {
  timeout: 10_000,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
});

// 3. Fallback is always defined
claudeBreaker.fallback((context) => templateEngine.generate(context));

// 4. Response is validated
const result = ClaudeResponseSchema.safeParse(response);
if (!result.success) {
  logger.error('Invalid Claude response', result.error);
  return templateEngine.generate(context); // fallback
}
```

### Circuit Breaker Configuration (All External Services)

| Service | Timeout | Error Threshold | Reset Timeout | Fallback |
|---------|---------|----------------|---------------|----------|
| Claude API | 10s | 50% (5 calls) | 30s | Template engine |
| Stripe API | 15s | 30% (3 calls) | 60s | "Payment unavailable" + queue |
| Resend | 10s | 50% (5 calls) | 60s | Redis email queue |
| Discord | 5s | 80% (5 calls) | 120s | Silent drop + log |

### Webhook Processing Pattern

```typescript
// All incoming webhooks follow this pattern:

// 1. Signature verification (HMAC)
function verifyStripeWebhook(req: Request): boolean {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
  );
  return true; // throws on invalid signature
}

// 2. Idempotency check
async function processWebhook(event: StripeEvent) {
  const exists = await db.query(
    'SELECT 1 FROM processed_webhooks WHERE event_id = $1',
    [event.id]
  );
  if (exists.rows.length > 0) return; // already processed

  // 3. Process in transaction
  await db.transaction(async (tx) => {
    await handleEvent(tx, event);
    await tx.query(
      'INSERT INTO processed_webhooks (event_id, type, processed_at) VALUES ($1, $2, NOW())',
      [event.id, event.type]
    );
  });
}

// 4. Cleanup: delete processed webhooks older than 7 days
// (cron job, daily)
```

### Redis Caching Strategy

```
Cache Layers:
├── L1: In-memory LRU (Node.js, 100MB max)
│   ├── Hot game positions (last 1000 analyses)
│   ├── User session data
│   └── TTL: 5 minutes
│
├── L2: Redis 7.2
│   ├── Claude API responses (TTL: 24 hours)
│   ├── KataGo analysis results (TTL: 7 days)
│   ├── Rate limiting counters (TTL: per-window)
│   ├── BullMQ job queues
│   └── maxmemory: 256MB, policy: allkeys-lru
│
├── L3: PostgreSQL
│   ├── Permanent analysis cache (no TTL)
│   ├── User data, game history
│   └── Materialized views for analytics
│
└── Cache Invalidation
    ├── Time-based TTL (primary strategy)
    ├── No complex invalidation logic
    └── Cache miss = recalculate (simple, correct)
```

### Redis Failure Handling

```
Redis crash scenario:
├── Node.js detects connection loss
├── L1 in-memory cache continues serving
├── All Redis operations wrapped in try/catch
├── Rate limiting temporarily disabled (accept all requests)
├── BullMQ jobs: re-queued from PostgreSQL job table on recovery
├── Redis auto-restarts (systemd / Coolify health check)
├── AOF file replays committed operations
└── Full recovery in <60 seconds

Key configuration for stability:
├── appendonly yes                    # AOF persistence
├── appendfsync everysec              # Fsync every second
├── maxmemory 256mb                   # Prevent OOM
├── maxmemory-policy allkeys-lru      # Evict least-recently-used
├── save 900 1                        # RDB snapshot every 15min if 1+ write
├── save 300 10                       # RDB snapshot every 5min if 10+ writes
└── timeout 300                       # Close idle connections after 5min
```

### API Design Standards

```
REST API Conventions:
├── Versioning: /api/v1/* (URL path, not header)
├── Authentication: Cookie-based sessions (not Bearer tokens)
├── Rate Limiting: Redis-backed sliding window
│   ├── Anonymous: 30 req/min
│   ├── Free user: 60 req/min
│   ├── Pro user: 120 req/min
│   └── Response: 429 with Retry-After header
│
├── Error Responses: RFC 7807 Problem Details
│   {
│     "type": "/errors/rate-limited",
│     "title": "Too Many Requests",
│     "status": 429,
│     "detail": "Rate limit exceeded. Try again in 45 seconds.",
│     "instance": "/api/v1/analysis/12345"
│   }
│
├── Pagination: Cursor-based (not offset)
│   ├── ?cursor=abc123&limit=20
│   ├── Response includes next_cursor
│   └── No COUNT(*) queries
│
└── Health Check: GET /api/health
    {
      "status": "healthy",
      "version": "1.0.0",
      "checks": {
        "database": "ok",
        "redis": "ok",
        "katago": "ok",
        "claude": "degraded"  // shows real status
      }
    }
```

---

## 9. Stability Scores

| Component | Score | Rationale |
|-----------|-------|-----------|
| **Template Engine** | 10/10 | In-process, deterministic, zero external dependencies |
| **PostgreSQL 16** | 9/10 | Decades proven, WAL archiving, daily backups to R2 |
| **Stripe Checkout** | 9/10 | Hosted UI, PCI handled, 72hr webhook retry |
| **Cloudflare CDN** | 9/10 | Massive global network, free tier generous, 2025 outages noted |
| **Better Auth** | 8.5/10 | Self-hosted, DB sessions, simple attack surface |
| **Circuit Breaker (opossum)** | 8.5/10 | 70K+ weekly downloads, 8 years mature, well-documented |
| **REST + Zod** | 9/10 | Decades proven pattern, runtime validation, no lock-in |
| **Redis 7.2** | 8/10 | Fast, proven, but OOM risk requires careful configuration |
| **Umami + Bugsink + Uptime Kuma** | 8.5/10 | Self-hosted, minimal resources, no SaaS dependency |
| **Discord Webhooks** | 9/10 | Stateless, fire-and-forget, zero impact on failure |
| **Web Push API** | 8/10 | Browser-native, no third party, but Chrome rate limits |
| **Resend** | 7.5/10 | Good API, but Cloudflare dependency and 70+ incidents/2yr |
| **Claude API** | 7/10 | 99.4% uptime, but non-deterministic, cost variable |
| **KataGo Eigen** | 8.5/10 | Deterministic, CPU-only, v1.6.1 fixed memory bugs |
| **Coolify** | 6.5/10 | 11 critical CVEs in Jan 2026, single point of deployment |
| **Hetzner VPS** | 7.5/10 | Good value, but 832 outages/5yr, no built-in HA |

**Composite Stability Score: 8.3 / 10**

### Weakest Links (Requires Extra Attention)

1. **Coolify** (6.5) — Must patch immediately on every CVE. Consider switching to Docker Compose direct if CVE frequency continues.
2. **Claude API** (7.0) — Template-first architecture ensures this never becomes a critical path dependency.
3. **Hetzner single server** (7.5) — Acceptable at MAU 8K. Plan for second server at MAU 20K+.

---

## 10. SLA Budget

### Composite SLA Calculation

For serial critical-path dependencies (all must work for core functionality):

```
Core Path: User → Cloudflare → Hetzner → Next.js → PostgreSQL
├── Cloudflare:   99.9%  (SLA guarantee)
├── Hetzner:      99.9%  (SLA guarantee)
├── Application:  99.9%  (target, self-managed)
├── PostgreSQL:   99.95% (target, self-managed with auto-restart)
└── Compound:     99.9% × 99.9% × 99.9% × 99.95% = 99.65%

Non-critical path (graceful degradation):
├── Claude API:   99.4%  → degrades to templates
├── Stripe:       99.5%  → degrades to "try later"
├── Resend:       99.3%  → emails queued
├── Redis:        99.9%  → app works without cache
└── These do NOT reduce core compound SLA
```

### SLA Budget Allocation

| Budget Category | Monthly Allowance | Annual Allowance |
|----------------|-------------------|------------------|
| **Target System SLA** | 99.5% | 99.5% |
| **Allowed Downtime** | 3.6 hours/month | 43.8 hours/year |
| **Planned Maintenance** | 1 hour/month | 12 hours/year |
| **Unplanned Outage Budget** | 2.6 hours/month | 31.8 hours/year |

### Error Budget Policy

```
Monthly Error Budget: 2.6 hours unplanned downtime

If remaining budget > 50%:
  → Normal deployments, feature development

If remaining budget 20-50%:
  → Reduce deployment frequency
  → Extra testing before deploys

If remaining budget < 20%:
  → Freeze feature deployments
  → Focus exclusively on reliability improvements

If budget exhausted:
  → Post-incident review mandatory
  → No deployments until next month unless critical security fix
```

---

## 11. Monthly Cost Breakdown

### Infrastructure (Fixed)

| Item | Specification | Monthly Cost |
|------|-------------|-------------|
| Hetzner CX32 | 4 vCPU, 8GB RAM, 80GB SSD | €7.59 (~$8) |
| Hetzner CX22 (backup/monitoring) | 2 vCPU, 4GB RAM, 40GB SSD | €4.59 (~$5) |
| Hetzner Volume (100GB) | Database + SGF storage | €4.40 (~$5) |
| Cloudflare Free | CDN + DDoS + DNS | $0 |
| Cloudflare R2 (10GB free) | Backups + SGF files | $0 |
| Domain name | .com renewal | ~$1/mo amortized |
| **Infrastructure Subtotal** | | **~$19/mo** |

### External Services (Variable)

| Item | Tier | Monthly Cost |
|------|------|-------------|
| Claude API | Haiku-dominant, 85% cache hit | $18-45 |
| Stripe processing | 2.9% + $0.30 per transaction | $15-40 |
| Resend | Free (3K emails) → Pro ($20) | $0-20 |
| Discord webhooks | Free | $0 |
| Web Push API | Free (browser-native) | $0 |
| UptimeRobot (external ping) | Free (1 monitor) | $0 |
| **Services Subtotal** | | **$33-105/mo** |

### Self-Hosted (No Extra Cost)

| Item | Runs On | Extra Cost |
|------|---------|-----------|
| PostgreSQL 16 | CX32 | $0 |
| Redis 7.2 | CX32 | $0 |
| KataGo Eigen | CX32 | $0 |
| Umami v3 | CX32 | $0 |
| Bugsink | CX32 | $0 |
| Uptime Kuma | CX22 | $0 |
| Coolify | CX32 | $0 |

### One-Time Costs

| Item | Cost |
|------|------|
| Stripe Atlas (US LLC) | $500 |

### Total Monthly Cost

| Scenario | Monthly Total |
|----------|--------------|
| **Minimum (low usage)** | **$52/mo** |
| **Expected (MAU 8K)** | **$80-115/mo** |
| **Maximum (high usage)** | **$124/mo** |

### Cost Comparison vs Alternatives

| Approach | Monthly Cost | Dependencies | Stability |
|----------|-------------|-------------|-----------|
| Aggressive (all SaaS) | $120-350/mo | 15+ | 6.5/10 |
| **Stability First** | **$80-115/mo** | **6** | **8.3/10** |
| Bare minimum | $25-50/mo | 3 | 7.0/10 |

---

## 12. Implementation Timeline

### Phase 1: Foundation (Weeks 1-3)

```
Week 1: Infrastructure + Auth
├── Day 1-2: Hetzner CX32 + Coolify setup
│   ├── Docker Compose configuration
│   ├── Cloudflare DNS + CDN setup
│   ├── SSL certificates (Cloudflare origin)
│   └── Firewall rules (only 80/443 from Cloudflare IPs)
│
├── Day 3-4: PostgreSQL + Redis setup
│   ├── PG 16 with WAL archiving
│   ├── Redis 7.2 with AOF + maxmemory config
│   ├── Automated backup script (pg_dump → R2, daily)
│   └── Connection pooling (PgBouncer or built-in)
│
└── Day 5: Better Auth integration
    ├── Email/password + Google OAuth
    ├── DB session tables
    ├── Rate limiting on auth endpoints
    └── CVE-2025-29927 mitigation verified

Week 2: Core Integrations
├── Day 1-2: Stripe Checkout + Portal
│   ├── Stripe Atlas LLC (start process, 2 days to complete)
│   ├── Checkout session creation
│   ├── Customer portal configuration
│   ├── Webhook endpoint with HMAC verification
│   └── Idempotent event processing
│
├── Day 3-4: Communication stack
│   ├── Resend setup + email templates (React Email)
│   ├── Web Push service worker + VAPID keys
│   ├── Discord webhook integration
│   └── BullMQ email queue
│
└── Day 5: Circuit breaker framework
    ├── opossum wrapper for all external APIs
    ├── Fallback handlers for each service
    ├── Prometheus-compatible metrics export
    └── Health check endpoint (/api/health)

Week 3: Analytics + Monitoring
├── Day 1-2: Self-hosted analytics
│   ├── Umami v3 Docker setup
│   ├── Bugsink Docker setup
│   ├── Sentry SDK → Bugsink DSN configuration
│   └── Tracking script integration
│
├── Day 3: Uptime Kuma
│   ├── Install on CX22 (separate from app server)
│   ├── Configure all monitors
│   ├── Alert channels (Discord, email)
│   └── Public status page
│
└── Day 4-5: Template engine + Claude integration
    ├── Template engine with 200+ Go explanation templates
    ├── Claude Haiku integration with circuit breaker
    ├── Redis caching for AI responses
    └── Prompt caching configuration
```

### Phase 2: Hardening (Weeks 4-5)

```
Week 4: Integration testing + failure simulation
├── Day 1-2: Integration test suite
│   ├── Stripe webhook processing (all event types)
│   ├── Claude API timeout + error handling
│   ├── Resend delivery confirmation
│   └── Auth flow (register → login → session → logout)
│
├── Day 3-4: Chaos testing (manual)
│   ├── Kill Redis → verify app continues
│   ├── Block Claude API → verify template fallback
│   ├── Simulate Stripe webhook failure → verify retry
│   ├── Stop KataGo → verify queue + restart
│   └── Disconnect internet → verify cached content serves
│
└── Day 5: Performance baseline
    ├── Load test at 2x expected (16K concurrent)
    ├── Redis memory profiling under load
    ├── PostgreSQL query performance (explain analyze)
    └── KataGo queue depth under sustained load

Week 5: Documentation + runbooks
├── Day 1-2: Operational runbooks
│   ├── Server recovery procedure
│   ├── Database restore from R2 backup
│   ├── Redis recovery procedure
│   ├── Coolify CVE patching procedure
│   └── Cost monitoring and alerting thresholds
│
├── Day 3-4: Monitoring dashboard
│   ├── Uptime Kuma status page finalization
│   ├── Umami dashboard configuration
│   ├── Bugsink alert rules
│   └── Discord notification channel organization
│
└── Day 5: Go-live checklist
    ├── Security audit (headers, CORS, CSP)
    ├── Backup verification (restore test)
    ├── All circuit breakers tested
    └── Rate limiting verified at all tiers
```

### Phase 3: Post-Launch Stabilization (Weeks 6-8)

```
Week 6-8: Monitor, tune, harden
├── Monitor error rates (Bugsink)
├── Monitor uptime (Uptime Kuma)
├── Monitor costs (Stripe dashboard, Claude usage)
├── Tune Redis memory based on actual usage
├── Tune Claude prompt caching based on hit rates
├── Tune rate limits based on actual traffic patterns
└── Address any emergent stability issues
```

**Total: 5 weeks to production, 3 weeks stabilization = 8 weeks total**

---

## 13. Stability Tax

The "Stability Tax" is the extra time invested specifically for reliability engineering — work that would not be needed if we only cared about features working on the happy path.

### Itemized Stability Tax

| Activity | Time | What It Prevents |
|----------|------|-----------------|
| Circuit breaker setup for 4 external APIs | 2 days | Cascading failures from API outages |
| Template engine (200+ templates) | 3 days | Claude API dependency on critical path |
| Redis AOF + maxmemory configuration | 0.5 days | Data loss on Redis crash |
| PostgreSQL WAL archiving + R2 backup | 1 day | Data loss on server failure |
| Webhook idempotency + signature verification | 1 day | Duplicate processing, MITM attacks |
| BullMQ retry queues for email + analysis | 1 day | Lost requests during outages |
| Health check endpoint + Uptime Kuma | 1 day | Undetected outages |
| Chaos testing (kill each service) | 2 days | Untested failure modes |
| Coolify security hardening + CVE monitoring | 0.5 days | Server compromise |
| Rate limiting (Redis-backed, 4 tiers) | 1 day | DoS, cost overruns |
| CVE-2025-29927 mitigation verification | 0.5 days | Auth bypass |
| Operational runbooks | 2 days | Slow incident response |
| Backup restore test | 0.5 days | Untested recovery procedures |
| **Total Stability Tax** | **~16 days (3.2 weeks)** | |

### Stability Tax as Percentage of Total

- Total implementation: 5 weeks (25 working days)
- Stability tax: 16 days
- **Stability tax = 64% of implementation time**

This is high, and intentionally so. The alternative — deploying without these measures — is false economy. A single unhandled cascading failure at launch could destroy user trust that takes months to rebuild. At MAU 8K, every user who experiences downtime during a game analysis is a user who considers alternatives.

### What the Stability Tax Buys

```
Without stability tax (3 weeks to launch):
├── Claude API down → app crashes or hangs
├── Redis OOM → data loss, undefined behavior
├── Stripe webhook failure → subscriptions out of sync
├── Server crash → unknown recovery time
├── No monitoring → outages discovered by users
└── Expected downtime: 10-20+ hours/month

With stability tax (5 weeks to launch):
├── Claude API down → templates serve instantly
├── Redis OOM → auto-restart, app continues without cache
├── Stripe webhook failure → automatic retry, no data loss
├── Server crash → restore from backup in <1 hour
├── Monitoring → outages detected in <1 minute
└── Expected downtime: <4 hours/month
```

---

## 14. Risk Register

### Risk 1: Hetzner Single Server Failure (CRITICAL)

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium (832 outages/5yr across platform) |
| **Impact** | Critical — total application outage |
| **Current Mitigation** | Daily PG backup to R2, Cloudflare maintenance page |
| **Residual Risk** | Data loss of up to 24 hours of transactions |
| **Enhanced Mitigation** | Reduce backup interval to 6 hours; WAL archiving to R2 for point-in-time recovery; document server rebuild procedure (target: 1 hour from bare metal) |
| **Escalation Trigger** | >3 Hetzner outages/quarter affecting our server |
| **Escalation Action** | Add second Hetzner server in different datacenter with PG streaming replication |

### Risk 2: Coolify Critical Vulnerabilities (HIGH)

| Attribute | Value |
|-----------|-------|
| **Probability** | High (11 CVEs in Jan 2026, CVSS 10.0) |
| **Impact** | Critical — full server compromise, container escape, root access |
| **Current Mitigation** | Immediate patching, SSH key only, minimal exposed ports |
| **Residual Risk** | Zero-day before patch available |
| **Enhanced Mitigation** | Subscribe to Coolify security advisories; Coolify admin panel not exposed to internet (only via SSH tunnel); consider fallback to plain Docker Compose if CVE frequency exceeds 2/quarter |
| **Escalation Trigger** | Another CVSS 9.0+ CVE within 6 months |
| **Escalation Action** | Migrate to Docker Compose + Caddy (remove Coolify entirely) |

### Risk 3: Claude API Cost Escalation or Deprecation (MEDIUM)

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium (API pricing changes are common in AI industry) |
| **Impact** | Medium — increased costs or feature degradation |
| **Current Mitigation** | Template-first architecture, 60% traffic never hits Claude, 85% prompt cache hit rate |
| **Residual Risk** | Haiku model deprecated or price increased 3x+ |
| **Enhanced Mitigation** | Monitor monthly Claude spend; set hard budget cap ($100/mo); if exceeded, increase template coverage to 80%; maintain model-agnostic prompt format for potential future migration |
| **Escalation Trigger** | Monthly Claude cost exceeds $80 or Haiku deprecation announced |
| **Escalation Action** | Increase template coverage, reduce Claude tier distribution, evaluate alternative LLM APIs |

### Risk 4: Stripe Entity / Compliance Complexity (MEDIUM)

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium (Korean payment regulations, US entity tax obligations) |
| **Impact** | Medium — delayed payment launch, legal exposure |
| **Current Mitigation** | Stripe Atlas US LLC, Stripe handles KakaoPay/NaverPay natively |
| **Residual Risk** | Korean tax reporting obligations, potential need for Korean entity |
| **Enhanced Mitigation** | Consult with cross-border tax advisor before launch; use Stripe Tax for automated collection; start with USD pricing, add KRW in Phase 2 |
| **Escalation Trigger** | Korean regulatory requirement for local entity identified |
| **Escalation Action** | Engage Korean agency for entity setup; evaluate Stripe Korea direct |

### Risk 5: Redis Memory Exhaustion Under Load (MEDIUM)

| Attribute | Value |
|-----------|-------|
| **Probability** | Medium (common Redis failure mode, especially with BullMQ + cache + rate limiting on shared instance) |
| **Impact** | Low-Medium — temporary degraded performance, possible queued job loss |
| **Current Mitigation** | maxmemory 256MB, allkeys-lru eviction, AOF persistence |
| **Residual Risk** | Burst traffic causing OOM before eviction completes |
| **Enhanced Mitigation** | Redis memory monitoring in Uptime Kuma (alert at 80% threshold); separate Redis instances for cache vs. queue if memory pressure observed; BullMQ job persistence in PostgreSQL as backup |
| **Escalation Trigger** | Redis OOM kill occurs more than twice in one month |
| **Escalation Action** | Split into two Redis instances (cache: 256MB volatile, queue: 128MB persistent); or increase server RAM |

### Risk Heat Map

```
                    Low Impact    Medium Impact    High Impact    Critical Impact
                  ┌─────────────┬───────────────┬──────────────┬────────────────┐
High Probability  │             │               │              │ R2: Coolify    │
                  │             │               │              │ CVEs           │
                  ├─────────────┼───────────────┼──────────────┼────────────────┤
Medium            │             │ R5: Redis OOM │ R3: Claude   │ R1: Hetzner    │
Probability       │             │               │ Cost/Deprec  │ Server Down    │
                  │             │ R4: Stripe    │              │                │
                  │             │ Entity        │              │                │
                  ├─────────────┼───────────────┼──────────────┼────────────────┤
Low Probability   │             │               │              │                │
                  │             │               │              │                │
                  └─────────────┴───────────────┴──────────────┴────────────────┘
```

---

## Appendix A: Decision Summary Matrix

| Decision Area | Chosen Approach | Rejected Alternative | Stability Delta |
|--------------|----------------|---------------------|-----------------|
| AI Integration | Claude-only, template-first | 5-layer (Gemini Nano+WebLLM+MCP) | +2.5 points |
| Authentication | Better Auth, 2 providers | 7 providers, 2FA, RBAC, 10 tables | +1.5 points |
| Payment | Stripe Checkout hosted | Custom payment form | +1.0 points |
| Email | Resend + BullMQ queue | Novu orchestration layer | +0.5 points |
| Notifications | Web Push API native | FCM + Novu + push service | +1.5 points |
| Community | Discord webhooks | Discord.js full bot | +1.0 points |
| Analytics | Umami self-hosted | PostHog SaaS | +1.0 points |
| Error Tracking | Bugsink self-hosted | Sentry cloud | +1.0 points |
| Monitoring | Uptime Kuma self-hosted | Better Stack SaaS | +0.5 points |
| API Pattern | REST + Zod + opossum | tRPC + MCP + Svix | +2.0 points |
| i18n | Hardcoded ko/en | next-intl 5 locales | +0.5 points |

## Appendix B: Monitoring and Alerting Matrix

| What | How | Alert Channel | Threshold |
|------|-----|--------------|-----------|
| App uptime | Uptime Kuma HTTP check | Discord + Email | Down >20s |
| App response time | Uptime Kuma HTTP check | Discord | >2s average |
| PostgreSQL | Uptime Kuma TCP check | Discord + Email | Connection refused |
| Redis | Uptime Kuma TCP check | Discord | Connection refused |
| Redis memory | Custom script via Uptime Kuma | Discord | >80% of maxmemory |
| KataGo process | Custom health endpoint | Discord | Not responding >30s |
| Claude API | Circuit breaker state | Bugsink + Discord | Circuit opens |
| Stripe webhooks | Failed webhook count | Bugsink + Email | >5 failures/hour |
| Error rate | Bugsink threshold | Discord + Email | >50 errors/hour |
| Disk usage | Uptime Kuma script | Discord + Email | >80% |
| SSL certificate | Uptime Kuma cert check | Email | <14 days to expiry |
| External uptime | UptimeRobot (free) | Email | Uptime Kuma unreachable |

## Appendix C: Security Checklist

```
Pre-Launch Security Audit:
☐ Next.js 15.2.3+ (CVE-2025-29927 patched)
☐ Cloudflare: x-middleware-subrequest header stripped
☐ Coolify: latest version, all CVEs patched
☐ Coolify admin: not exposed to internet (SSH tunnel only)
☐ Hetzner firewall: only ports 80/443 from Cloudflare IPs
☐ SSH: key-only, no password auth, non-standard port
☐ PostgreSQL: local socket only, no TCP exposure
☐ Redis: local socket only, requirepass set
☐ Stripe webhook: HMAC signature verified on every request
☐ CORS: strict origin whitelist
☐ CSP: strict Content-Security-Policy header
☐ Rate limiting: verified on auth, API, and webhook endpoints
☐ Sessions: httpOnly, secure, sameSite=strict
☐ Passwords: argon2id hashing
☐ Secrets: environment variables, never in code
☐ Dependencies: npm audit clean, Dependabot enabled
☐ Backups: verified restore from R2 backup
```

---

**Document version**: 1.0
**Perspective**: Stability First
**Composite Stability Score**: 8.3 / 10
**Total External Dependencies**: 6
**Monthly Cost**: $80-115/mo (at MAU 8K)
**Implementation**: 5 weeks to production + 3 weeks stabilization

Sources:
- [Claude Status - Uptime History](https://status.anthropic.com/uptime)
- [Claude Status - Incident History](https://status.anthropic.com/history)
- [Anthropic's Claude reports widespread outage | TechCrunch](https://techcrunch.com/2026/03/02/anthropics-claude-reports-widespread-outage/)
- [Stripe Status | StatusGator](https://statusgator.com/services/stripe)
- [Stripe Status Page](https://status.stripe.com/)
- [Resend Incident Report Nov 2025](https://resend.com/blog/incident-report-for-november-18-2025)
- [Resend Incident Report Feb 2026](https://resend.com/blog/incident-report-for-february-15-2026)
- [CVE-2025-29927 Postmortem | Vercel](https://nextjs.org/blog/cve-2025-29927)
- [CVE-2025-29927 | NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-29927)
- [Hetzner Status | StatusGator](https://statusgator.com/services/hetzner)
- [Hetzner Server Outage Jul 2025 | Flownative](https://www.flownative.com/en/blog/server-failures-at-hetzner.html)
- [Coolify Critical Vulnerabilities | The Hacker News](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html)
- [Coolify 11 CVEs | WebProNews](https://www.webpronews.com/coolify-reveals-11-critical-vulnerabilities-exposing-52000-instances/)
- [Redis Persistence Failure Modes | Medium](https://medium.com/@sohail_saifi/how-redis-persistence-actually-works-and-when-it-fails-c3715d11529f)
- [Top 5 Redis Failure Reasons | DragonflyDB](https://www.dragonflydb.io/blog/top-5-reasons-why-your-redis-instance-might-fail)
- [KataGo Eigen Release Notes](https://github.com/lightvector/KataGo/releases/tag/v1.6.1)
- [Opossum Circuit Breaker | GitHub](https://github.com/nodeshift/opossum)
- [Bugsink Self-Hosted Error Tracking](https://www.bugsink.com/)
- [Uptime Kuma](https://uptimekuma.org/)
- [Umami Analytics | GitHub](https://github.com/umami-software/umami)
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Composite SLA Calculation | Medium](https://alexewerlof.medium.com/calculating-composite-sla-d855eaf2c655)
- [Web Push API Browser Support | Can I Use](https://caniuse.com/push-api)
- [Stripe Atlas 2025 Year in Review](https://stripe.com/blog/stripe-atlas-startups-in-2025-year-in-review)
