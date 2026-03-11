# External Integration Technology PRD — Speed First Scenario

> **Perspective**: Speed First Discussion Leader
> **Research**: 4 of 4 (External Integration Technology Deep-Dive)
> **Phase**: 2.C — Synthesis from ALL 10 PHASE 1 Branch Results
> **Date**: 2026-03-10
> **Prior Decisions**: Node.js 22 LTS, Next.js 15, PostgreSQL 16, Redis 7.2, Drizzle ORM, KataGo CPU Eigen, Biome, Coolify + Hetzner
> **Builder**: AI Agents (Claude Code) — not human developers
> **Constraint**: OpenAI/Gemini = subscription only, NO API access
> **Target**: MAU 8K, Budget $80-260/mo

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Speed Philosophy for External Integrations](#2-speed-philosophy)
3. [Master Cut-or-Defer Decision Matrix](#3-cut-or-defer-matrix)
4. [Day-by-Day Implementation Plan](#4-day-by-day-plan)
5. [Area 1: AI Integration — Fastest to Value](#5-ai-integration)
6. [Area 2: Authentication — Quickest Viable Setup](#6-authentication)
7. [Area 3: Payment — Stripe Checkout and Done](#7-payment)
8. [Area 4: Communication — Absolute Minimum](#8-communication)
9. [Area 5: Analytics & Data — Day 1 vs Deferred](#9-analytics)
10. [Area 6: Integration Patterns — Simplest That Works](#10-integration-patterns)
11. [Speed Scorecard](#11-speed-scorecard)
12. [Total Timeline & Cost Summary](#12-timeline-cost)
13. [What We Sacrifice](#13-sacrifices)
14. [Phase 2 Upgrade Path](#14-phase-2-upgrade)
15. [Risk Analysis](#15-risk-analysis)
16. [Consolidated Architecture Diagram](#16-architecture)
17. [Sources](#17-sources)

---

## <a id="1-executive-summary"></a>1. Executive Summary

**The entire external integration layer ships in 14 calendar days.** Not 8 weeks. Not 6 weeks. Fourteen days.

Every week of delay is a week competitors can see our domain (AI-powered Go explanations), replicate it, and beat us to market. No competitor currently offers natural-language Go move explanations. That window closes the moment someone else thinks of it. We ship the minimum viable integrations and iterate from live user feedback.

| Milestone | Day | What Ships |
|-----------|-----|------------|
| Auth + basic email | Day 3 | Users can sign up, log in, get verification emails |
| Stripe Checkout | Day 5 | Users can pay for Premium |
| Claude AI templates | Day 7 | First "Why?" explanations appear (template-based) |
| Claude API live | Day 9 | Real AI explanations with Haiku |
| Web Push + Discord | Day 11 | Notifications working |
| Umami analytics | Day 12 | Traffic tracking live |
| Integration hardening | Day 14 | Error handling, circuit breakers, monitoring |

**Total monthly cost at MAU 8K: $0-15/month** (all free tiers) until paying users appear, then **$47-95/month** for Claude API at scale.

**Key decisions:**
- Claude API only. No multi-model. No Gemini Nano. No WebLLM. One provider, one SDK, one billing relationship.
- Better Auth, not Auth.js v5. Newer, better plugins, same setup speed.
- Stripe Checkout (hosted), not custom payment forms. Zero PCI scope.
- REST + Zod, not tRPC/MCP/GraphQL. Proven, zero learning curve for AI agents.
- Template fallback first, Claude API second. Templates ship in hours; Claude API takes days to tune.

---

## <a id="2-speed-philosophy"></a>2. Speed Philosophy for External Integrations

### 2.1 The Speed-First Integration Principles

1. **Free tiers first, always.** Every service we integrate has a free tier that covers MAU 8K. We pay nothing until we have paying users. Resend: 3,000 emails/mo free. Umami: self-hosted $0. Cloudflare CDN: free. Web Push API: free. Discord webhooks: free.

2. **Hosted over self-built.** Stripe Checkout is a hosted page Stripe maintains. We do not build payment forms. Better Auth handles session management. We do not write JWT logic from scratch.

3. **One integration, one purpose.** No Novu abstraction layer over notifications. No BullMQ email queue on Day 1. Send the email directly. Queue it later when volume demands it.

4. **Template before AI.** String interpolation of KataGo analysis data covers 80% of "Why?" value. Claude API adds richness but is not required for launch.

5. **Ship broken, fix live.** A notification that occasionally fails to deliver is better than no notification system at all. Circuit breakers and retry logic are Day 14, not Day 1.

### 2.2 Why Speed Matters Specifically for External Integrations

External integrations are the highest-risk area for scope creep. The PHASE 1 branches demonstrate this clearly:

- Branch 3.2 (Robust Communication) proposed 6 weeks for notifications. Branch 3.1 (Rapid) achieves the same outcome in 3.5 days. The delta is polish, not function.
- Branch 2.2 (Big Bang Auth) proposed 8 weeks with 7 providers, 2FA, RBAC, B2B. Branch 2.1 (Evolutionary) ships in 7 days with email + Google OAuth. The remaining providers serve <5% of users.
- Branch 5.1 (Modern Integration Patterns) proposed MCP + tRPC + OAuth 2.1 taking 8 weeks. Branch 5.2 (Classical REST + Zod) ships in 3-4 weeks. Type safety difference: 8.5 vs 7.5 out of 10 — negligible for MAU 8K.

**The speed-first integration layer is 14 days. The "complete" layer is 14 weeks.** The delta is 10 weeks of work that serves edge cases, adds architectural elegance, and impresses no users.

### 2.3 Branch Selection Summary

| Area | Selected | Rejected | Speed Gain | Speed Score |
|------|----------|----------|------------|-------------|
| AI Integration | Conservative (1.2): Claude-only | Aggressive (1.1): Multi-model + Gemini Nano | 4-6 weeks saved | 9/10 |
| Auth | Evolutionary (2.1): Better Auth + 2 providers | Big Bang (2.2): 7 providers + 2FA + RBAC | 6+ weeks saved | 9/10 |
| Payment | Evolutionary (2.1): Stripe Checkout | Big Bang (2.2): Multi-gateway | 3+ weeks saved | 10/10 |
| Communication | Rapid (3.1): Resend + WebPush + Discord | Robust (3.2): Novu + FCM + i18n emails | 5+ weeks saved | 9/10 |
| Analytics | Minimal (4.1): Umami self-hosted | Practical (4.2): PostHog + Sentry | 1.5 weeks saved | 8/10 |
| Integration Patterns | Classical (5.2): REST + Zod | Modern (5.1): MCP + tRPC + OAuth 2.1 | 4-5 weeks saved | 9/10 |

---

## <a id="3-cut-or-defer-matrix"></a>3. Master Cut-or-Defer Decision Matrix

Every feature from all 10 PHASE 1 branches, triaged into three categories:

### 3.1 SHIP (Days 1-14) — Minimum Viable

| Feature | Branch Source | Day | Rationale |
|---------|-------------|-----|-----------|
| Better Auth (email magic link + Google OAuth) | 2.1 | 1-3 | Cannot ship without auth |
| Resend transactional emails (welcome, verification) | 3.1 | 2-3 | Auth requires email delivery |
| Stripe Checkout (hosted page, single plan) | 2.1 | 4-5 | Cannot monetize without payment |
| Stripe webhook (payment confirmation) | 2.1, 5.2 | 5 | Must confirm payments |
| Template-based move explanations | 1.2 | 6-7 | 80% of AI value, zero API cost |
| Claude Haiku API (simple explanations) | 1.2 | 8-9 | Differentiator: NL Go explanations |
| Web Push notifications (game turn, challenge) | 3.1 | 10-11 | Core engagement loop |
| Discord webhook (community channel) | 3.1 | 10-11 | Community building, zero cost |
| Umami analytics (self-hosted) | 4.1 | 12 | Must measure to improve |
| Cloudflare CDN (free tier) | 4.1, 4.2 | 12 | Performance baseline |
| Error boundary + console logging | 4.1 | 13-14 | Minimum observability |
| Circuit breaker (Claude API) | 1.2, 5.2 | 13-14 | Prevent cascading failures |
| Zod request/response validation | 5.2 | Throughout | Runtime type safety |

### 3.2 DEFER to Phase 2 (Month 2-3) — After Validation

| Feature | Branch Source | Trigger to Build | Rationale for Deferral |
|---------|-------------|------------------|----------------------|
| Claude Sonnet escalation (complex positions) | 1.2 | Users request deeper analysis | Haiku handles 80%+ adequately |
| Prompt caching (90% cost savings) | 1.2 | Claude API costs >$50/mo | Not needed at low volume |
| Batch API (post-game reviews) | 1.2 | >100 games/day | Premature optimization |
| Extended thinking (complex tsumego) | 1.2 | Teaching mode validated | Expensive, niche use case |
| GitHub/Discord/Apple OAuth | 2.2 | Auth friction complaints | Google + email covers 90%+ |
| Passkeys/WebAuthn | 2.2 | Security audit request | Progressive enhancement |
| Multiple subscription tiers | 2.2 | MRR >$2K | One tier is enough to start |
| Stripe Customer Portal | 2.1 | Subscription management complaints | Manual support at 8K MAU |
| Email marketing campaigns | 3.2 | Retention <15% | Premature without users |
| BullMQ email queue | 3.2 | Email failures >1% | Direct send works at low volume |
| In-app notification center | 3.2 | Users miss Web Push | Web Push handles core loop |
| i18n for notifications | 3.2 | Japanese user segment >20% | Start English+Korean only |
| PostHog feature flags | 4.2 | Need A/B testing | Umami sufficient for MVP |
| Sentry error monitoring | 4.2 | Error count unmanageable | Console + Umami events for MVP |
| PG materialized views (analytics) | 4.1, 4.2 | Query latency >500ms | Direct queries fine at 8K MAU |
| API versioning (v1/) | 5.2 | Breaking API changes needed | No external API consumers yet |

### 3.3 CUT Permanently (Never Build) — Eliminated from Scope

| Feature | Branch Source | Why Cut |
|---------|-------------|---------|
| Gemini Nano on-device AI | 1.1 | Korean NOT supported, Chrome-only, desktop-only |
| WebLLM in-browser inference | 1.1 | Complexity for marginal benefit, mobile unusable |
| MCP (Model Context Protocol) | 1.1, 5.1 | Over-engineered for single-provider setup |
| Multi-model routing (Haiku/Gemini/WebLLM) | 1.1 | Single provider is simpler and sufficient |
| tRPC | 5.1 | REST + Zod achieves same safety with less coupling |
| OAuth 2.1 server | 5.1 | No third-party API consumers |
| Novu notification orchestrator | 3.2 | Abstraction over single channel is overhead |
| FCM (Firebase Cloud Messaging) | 3.2 | Web Push API is free and sufficient |
| 2FA (TOTP/SMS) | 2.2 | Baduk app, not a bank. Magic link is secure enough |
| B2B multi-tenancy | 2.2 | No enterprise use case |
| RBAC beyond Free/Premium/Admin | 2.2 | Three roles is all we need |
| GraphQL | 5.1 | REST is simpler, AI agents generate it faster |
| Custom payment forms | 2.2 | PCI compliance burden, Stripe Checkout eliminates it |
| SMS notifications | 3.2 | Cost per message, Web Push is free |

---

## <a id="4-day-by-day-plan"></a>4. Day-by-Day Implementation Plan

### Prerequisites (Day 0)

Assumes the following are already deployed on Hetzner/Coolify:
- Next.js 15 app skeleton with App Router
- PostgreSQL 16 database running
- Redis 7.2 instance running
- Domain configured with DNS

### Day 1: Authentication Foundation

**Goal**: Users can sign up with email magic link.

```
Morning (4h):
├── npm install better-auth @better-auth/drizzle
├── Create auth configuration (auth.ts)
│   ├── Email magic link provider (Resend transport)
│   └── Google OAuth provider (credentials from Google Cloud Console)
├── Drizzle schema: users, sessions, accounts tables
└── Run drizzle-kit push to create tables

Afternoon (4h):
├── Create auth API route: app/api/auth/[...all]/route.ts
├── Auth middleware: middleware.ts (JWT validation)
├── Sign-in page: app/(auth)/sign-in/page.tsx
├── Sign-up page: app/(auth)/sign-up/page.tsx
└── Auth context provider: providers/auth-provider.tsx
```

**Speed Score: 9/10** — Better Auth boilerplate projects exist on GitHub. Copy structure, adapt.

**Reference**: [Better Auth Next.js integration docs](https://better-auth.com/docs/integrations/next), [GitHub starter: nextjs-better-auth](https://github.com/Achour/nextjs-better-auth)

### Day 2: Email Service + Auth Completion

**Goal**: Magic link emails actually send. Google OAuth works.

```
Morning (4h):
├── npm install resend @react-email/components
├── Create Resend client: lib/email.ts
├── Magic link email template: emails/magic-link.tsx (React Email)
├── Welcome email template: emails/welcome.tsx
└── Wire Resend into Better Auth magic link flow

Afternoon (4h):
├── Google OAuth callback handling
├── Session management: access token (15m) + refresh token (7d)
├── Protected route wrapper: components/auth-guard.tsx
├── User role enum: Free | Premium | Admin
└── Test: sign up → magic link → email arrives → click → logged in
```

**Speed Score: 9/10** — Resend setup is literally 5 lines of code. React Email templates are React components.

**Reference**: [Resend Next.js docs](https://resend.com/docs/send-with-nextjs)

### Day 3: Auth Hardening + Profile

**Goal**: Auth is production-safe. Users have profiles.

```
Morning (4h):
├── Rate limiting on auth endpoints (Better Auth built-in)
├── CSRF protection verification
├── Secure cookie configuration (httpOnly, secure, sameSite)
├── CVE-2025-29927 middleware bypass patch verification
└── Session invalidation on password change

Afternoon (4h):
├── User profile page: app/profile/page.tsx
├── Profile API: app/api/users/[id]/route.ts
├── Avatar upload (local filesystem, defer S3/R2 to Phase 2)
└── Account deletion flow (GDPR compliance)
```

**Speed Score: 8/10** — Security hardening takes time but Better Auth handles most of it.

### Day 4: Stripe Integration

**Goal**: Stripe Checkout works. Users can subscribe to Premium.

```
Morning (4h):
├── npm install stripe @stripe/stripe-js
├── Stripe account setup (product + price creation in Dashboard)
│   ├── Product: "BadukApp Premium"
│   └── Price: $9.99/month (single tier)
├── Checkout API route: app/api/stripe/checkout/route.ts
│   └── stripe.checkout.sessions.create({ mode: 'subscription' })
├── Success page: app/subscription/success/page.tsx
└── Cancel page: app/subscription/cancel/page.tsx

Afternoon (4h):
├── Stripe webhook endpoint: app/api/webhooks/stripe/route.ts
│   ├── checkout.session.completed → upgrade user role to Premium
│   ├── customer.subscription.deleted → downgrade to Free
│   └── invoice.payment_failed → send warning email
├── Webhook signature verification (stripe.webhooks.constructEvent)
├── Drizzle schema: subscriptions table
└── Premium badge on user profile
```

**Speed Score: 10/10** — Stripe Checkout is the fastest payment integration possible. Hosted page, zero PCI scope.

**Reference**: [Stripe Checkout quickstart for Next.js](https://docs.stripe.com/checkout/quickstart?client=next)

### Day 5: Payment Completion + Freemium Gate

**Goal**: Free vs Premium access control works.

```
Morning (4h):
├── Freemium middleware: check user role before premium features
├── Usage counter: Redis INCR for free-tier limits
│   ├── Free: 3 AI explanations/day
│   ├── Free: 5 KataGo analyses/day
│   └── Premium: unlimited
├── Upgrade prompt component: components/upgrade-prompt.tsx
└── Pricing page: app/pricing/page.tsx

Afternoon (4h):
├── Stripe Customer Portal link (self-service subscription management)
├── Payment receipt email template: emails/payment-receipt.tsx
├── Subscription expiry warning email: emails/sub-expiring.tsx
├── Test: full flow: sign up → free → hit limit → upgrade → pay → premium
└── Stripe test mode verification (use test card 4242...)
```

**Speed Score: 9/10** — Redis INCR is trivial. Middleware checks are simple.

### Day 6: Template-Based AI Explanations

**Goal**: KataGo analysis data rendered as human-readable explanations without any API calls.

```
Morning (4h):
├── Template engine: lib/explanation-templates.ts
│   ├── Template: "Good move" (winrate increased)
│   ├── Template: "Mistake" (winrate dropped >5%)
│   ├── Template: "Blunder" (winrate dropped >15%)
│   ├── Template: "Best move" (matches KataGo top pick)
│   ├── Template: "Alternative" (top 3 KataGo suggestions)
│   └── Template: "Direction of play" (quadrant analysis)
├── KataGo JSON → template selector function
└── String interpolation with actual move coordinates + percentages

Afternoon (4h):
├── Explanation display component: components/move-explanation.tsx
├── Game review page integration: show template explanation per move
├── Move categorization: good/neutral/mistake/blunder thresholds
└── Test with real KataGo analysis output
```

**Speed Score: 10/10** — Zero external dependencies. String templates. Instant response. No API latency.

**Why templates first**: This is the 80/20 insight. KataGo already provides winrate, top moves, and variations as structured JSON. Converting `{ winrate: 0.65, previousWinrate: 0.72, topMoves: [...] }` into "This move was a mistake. It dropped your winning probability from 72% to 65%. KataGo suggests playing at Q16 instead, which would maintain a 73% win rate." is pure string interpolation. No LLM needed.

### Day 7: Template Refinement + Claude API Preparation

**Goal**: Templates handle 15+ scenarios. Claude API client is ready.

```
Morning (4h):
├── Additional templates:
│   ├── Opening joseki detection (known patterns)
│   ├── Endgame territory counting
│   ├── Life-and-death status (alive/dead/unsettled groups)
│   ├── Influence vs territory balance
│   ├── Sente/gote classification
│   └── Game phase detection (opening/middlegame/endgame)
├── Template quality score (confidence: high/medium/low)
└── Low-confidence templates flagged for Claude API escalation

Afternoon (4h):
├── npm install @anthropic-ai/sdk
├── Claude API client: lib/claude.ts
│   ├── API key configuration
│   ├── Model selection: claude-4-haiku (default)
│   ├── System prompt: "You are a baduk teacher..."
│   ├── Timeout: 10 seconds
│   └── Basic error handling (retry on 429, fallback on 5xx)
├── Prompt template: prompts/move-explanation.ts
└── Test: send one KataGo analysis → receive Claude explanation
```

**Speed Score: 9/10** — Anthropic SDK is clean. One import, one function call.

### Day 8: Claude API Integration

**Goal**: Claude Haiku generates real AI explanations for moves.

```
Morning (4h):
├── Explanation API route: app/api/explanations/route.ts
│   ├── Input: board state (SGF) + KataGo analysis JSON
│   ├── Process: template check → if low confidence → Claude API
│   ├── Output: structured explanation (category, text, suggestions)
│   └── Freemium gate: check usage counter before API call
├── Two-tier routing:
│   ├── Template (high confidence) → instant, $0
│   └── Claude Haiku (low confidence) → 1-2s, ~$0.001
└── Response caching: Redis SET with 24h TTL (same position = same explanation)

Afternoon (4h):
├── Streaming response for Claude explanations (SSE)
├── Loading state component: "AI is analyzing this position..."
├── Error fallback: if Claude fails → show template explanation
├── Explanation history: store in PG for re-access without re-calling API
└── Test: play a game → review → see AI explanations on each move
```

**Speed Score: 8/10** — Streaming adds complexity but UX is critical.

### Day 9: Claude API Optimization + Prompt Tuning

**Goal**: Claude explanations are good quality and cost-efficient.

```
Morning (4h):
├── Prompt engineering iteration:
│   ├── Test with 20 real game positions across skill levels
│   ├── Adjust system prompt for clarity and baduk accuracy
│   ├── Calibrate explanation depth by player rank
│   └── Ensure Korean terminology is correct (joseki, sente, etc.)
├── Prompt caching setup:
│   ├── cache_control: {"type": "ephemeral"} on system prompt
│   └── Verify cache hits via response headers
└── Cost monitoring: log token usage per request

Afternoon (4h):
├── Rate limiting on Claude API calls:
│   ├── Per-user: 20 requests/hour (Free), 100/hour (Premium)
│   └── Global: 500 requests/hour (stay within Tier 1 limits)
├── Usage dashboard (admin): total tokens, cost estimate, cache hit rate
├── Template vs API ratio tracking (target: 60% template, 40% API)
└── Test end-to-end: various game scenarios, quality review
```

**Speed Score: 7/10** — Prompt tuning is iterative and cannot be fully parallelized.

### Day 10: Web Push Notifications

**Goal**: Users receive browser push notifications for game events.

```
Morning (4h):
├── Generate VAPID keys (web-push library)
├── Service worker: public/sw.js
│   ├── push event → showNotification
│   ├── notificationclick → open game page
│   └── Service worker registration in app layout
├── Push subscription API: app/api/push/subscribe/route.ts
│   └── Store subscription endpoint + keys in PG
├── Push send utility: lib/push.ts
│   └── webpush.sendNotification(subscription, payload)
└── Notification permission request component

Afternoon (4h):
├── Notification triggers:
│   ├── "Your turn" — opponent played a move
│   ├── "Challenge received" — someone wants to play you
│   ├── "Game ended" — result announcement
│   └── "AI analysis ready" — batch analysis complete
├── Notification preferences: user can toggle each type
├── Drizzle schema: push_subscriptions table
└── Test: play a move → opponent gets push notification
```

**Speed Score: 9/10** — Web Push API is free, no third-party service needed.

**Reference**: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [web-push Next.js implementation](https://blog.designly.biz/push-notifications-in-next-js-with-web-push-a-provider-free-solution)

### Day 11: Discord Webhook + Notification Polish

**Goal**: Community Discord channel gets automated updates. Notifications are reliable.

```
Morning (4h):
├── Discord webhook integration: lib/discord.ts
│   ├── POST to webhook URL with embed payload
│   ├── Events: new game completed, daily puzzle posted, milestone
│   └── Rich embeds: title, description, color, thumbnail (board image)
├── Admin Discord channel for:
│   ├── New user signup alerts
│   ├── Payment events
│   └── Error alerts (Claude API failures)
└── Rate limiting: max 30 messages/minute per webhook (Discord limit)

Afternoon (4h):
├── Notification retry logic: 3 attempts with exponential backoff
├── Failed notification logging (PG table: notification_failures)
├── Notification batching: group rapid-fire events (e.g., multiple moves)
├── Test all notification paths end-to-end
└── Silent hours configuration (user preference: no notifications 10pm-8am)
```

**Speed Score: 9/10** — Discord webhooks are literally one HTTP POST. No bot setup, no authentication.

**Reference**: [Discord webhooks with Next.js 15](https://www.freecodecamp.org/news/integrate-discord-webhooks-with-nextjs-15-example-project/)

### Day 12: Analytics Setup

**Goal**: Umami tracks page views and key events. Cloudflare CDN active.

```
Morning (4h):
├── Umami deployment on Coolify:
│   ├── Docker container (umami/umami:postgresql-latest)
│   ├── Connect to existing PG 16 instance (separate database: umami)
│   ├── Configure NEXT_PUBLIC_UMAMI_WEBSITE_ID
│   └── Proxy through Next.js rewrites (bypass ad blockers)
├── Tracking script in app/layout.tsx
├── Custom events:
│   ├── game_started, game_ended, game_reviewed
│   ├── explanation_requested (template vs API)
│   ├── subscription_started, subscription_cancelled
│   └── signup_completed, login_completed
└── Test: visit pages → see data in Umami dashboard

Afternoon (4h):
├── Cloudflare DNS + CDN setup:
│   ├── Proxy mode (orange cloud) for static assets
│   ├── Cache rules: immutable for /_next/static/
│   ├── Auto-minify JS/CSS/HTML
│   └── Always Online fallback
├── Performance baseline measurement
├── Umami dashboard bookmarks for key metrics
└── Admin page with Umami iframe embed
```

**Speed Score: 8/10** — Umami one-click deploy on Coolify. Cloudflare setup is straightforward.

**Reference**: [Umami Coolify docs](https://coolify.io/docs/services/umami)

### Day 13: Error Handling & Resilience

**Goal**: External service failures do not crash the app.

```
Morning (4h):
├── Circuit breaker for Claude API: lib/circuit-breaker.ts
│   ├── States: closed (normal) → open (failing) → half-open (testing)
│   ├── Threshold: 5 failures in 60 seconds → open for 30 seconds
│   ├── When open: return template explanation immediately
│   └── Redis-backed state (shared across server instances)
├── Stripe webhook retry handling:
│   ├── Idempotency keys in subscription table
│   └── Deduplication: ignore duplicate event IDs
└── Resend failure handling: log + retry once

Afternoon (4h):
├── Global error boundary: app/error.tsx + app/global-error.tsx
├── API route error wrapper: lib/api-error-handler.ts
│   ├── Standardized error response format (RFC 9457)
│   ├── Log errors with request context
│   └── Never leak internal details to client
├── Health check endpoint: app/api/health/route.ts
│   ├── Check: PG connection
│   ├── Check: Redis connection
│   ├── Check: KataGo process alive
│   └── Check: Claude API reachable (cached, 5-min TTL)
└── Console-based error monitoring (structured JSON logs)
```

**Speed Score: 7/10** — Resilience patterns require careful implementation.

### Day 14: Integration Testing & Launch Prep

**Goal**: All integrations verified end-to-end. Production-ready.

```
Morning (4h):
├── Integration test suite:
│   ├── Auth flow: signup → login → profile → logout
│   ├── Payment flow: subscribe → webhook → role upgrade
│   ├── AI flow: play move → request explanation → template/API → display
│   ├── Notification flow: game event → push notification delivered
│   └── Analytics flow: user action → Umami event recorded
├── Load test: 50 concurrent users (expected max for launch)
└── Stripe production mode activation (switch from test keys)

Afternoon (4h):
├── Environment variable audit (all secrets in Coolify env config)
├── CORS configuration review
├── Content Security Policy headers
├── Final DNS verification (Cloudflare proxy active)
├── Deployment verification on production URL
└── Smoke test: complete user journey from signup to game to AI analysis
```

**Speed Score: 8/10** — Testing is non-negotiable but focused on critical paths only.

---

## <a id="5-ai-integration"></a>5. Area 1: AI Integration — Fastest to Value

### 5.1 Architecture: Two-Layer, Not Five

Branch 1.1 (Aggressive) proposed a 5-layer AI architecture: Gemini Nano, WebLLM, Claude Haiku, Claude Sonnet, MCP orchestration. That takes months to build and test.

Branch 1.2 (Conservative) proposed a 4-tier Claude-only approach with templates at 50%. We take Branch 1.2 and simplify further.

**Speed-First AI Architecture: Two Layers**

```
Layer 1: Template Engine (Day 6-7)
├── Zero latency, zero cost
├── Covers: good/bad/blunder classification, top alternatives, basic stats
├── KataGo JSON → string interpolation → human-readable text
├── Target: 60-70% of all explanation requests
└── Always available (no external dependency)

Layer 2: Claude Haiku API (Day 8-9)
├── 1-2s latency, ~$0.001/request
├── Covers: nuanced explanations, teaching narratives, complex positions
├── Triggered: template confidence low, user asks "why?", position complexity high
├── Fallback to Layer 1 on any failure
└── Prompt caching for 90% input cost savings
```

**What we skip**: Sonnet escalation (Phase 2), Extended Thinking (Phase 2), Batch API (Phase 2), multi-model routing (never), on-device AI (never for Korean).

### 5.2 Template Engine Design

Templates are not placeholders — they are the primary explanation mechanism.

```typescript
// 15 template categories, each with 3-5 variants by skill level
const templates = {
  good_move: {
    beginner: "Good move! Your win rate improved from {prev}% to {curr}%. {coord} strengthens your position in the {area}.",
    intermediate: "Solid play at {coord}. Win rate: {prev}% → {curr}% (+{delta}%). This move {reason_brief}. KataGo also considered {alt1} ({alt1_wr}%) and {alt2} ({alt2_wr}%).",
    advanced: "{coord} ({delta_sign}{delta}%). {reason_detail}. Top alternatives: {alt1} ({alt1_wr}%, PV: {alt1_pv}), {alt2} ({alt2_wr}%, PV: {alt2_pv}). Visits: {visits}."
  },
  mistake: { /* ... */ },
  blunder: { /* ... */ },
  best_move: { /* ... */ },
  direction: { /* ... */ },
  opening: { /* ... */ },
  endgame: { /* ... */ },
  life_death: { /* ... */ },
  // ... 7 more categories
};
```

**Template selection algorithm**:
1. Calculate winrate delta → classify move (good/mistake/blunder/neutral)
2. Check if move matches KataGo top-1 → "best move" override
3. Detect game phase (opening/middle/end) from move number + board density
4. Select template variant by user's rank
5. Fill variables from KataGo JSON

### 5.3 Claude API Configuration

```typescript
const claudeConfig = {
  model: "claude-haiku-4-20260310",  // Cheapest, fastest
  max_tokens: 300,                    // Short explanations
  system: CACHED_SYSTEM_PROMPT,       // 2000 tokens, cached
  temperature: 0.3,                   // Consistent, not creative
  timeout: 10_000,                    // 10s hard limit
};

// System prompt (cached — 90% input cost savings after first request)
const CACHED_SYSTEM_PROMPT = `You are an expert Go (baduk) teacher.
Given a board position and KataGo analysis data, explain the move to the player.
Rules:
- Use the player's skill level to calibrate depth
- Reference specific coordinates (e.g., "Q16", "D4")
- Include win rate changes when relevant
- Keep explanations under 150 words
- Use standard Go terminology (joseki, sente, gote, etc.)
Output format: JSON { category, explanation, suggestions[] }`;
```

### 5.4 Cost Projection

| Component | Requests/Month (MAU 8K) | Cost/Request | Monthly Cost |
|-----------|------------------------|-------------|-------------|
| Template explanations | 40,000 (60%) | $0 | $0 |
| Haiku explanations | 25,000 (37%) | $0.001 | $25 |
| Haiku cache hits (90%) | 22,500 cached | $0.0001 | $2.25 |
| Sonnet escalation (Phase 2) | 2,000 (3%) | $0.01 | $20 |
| **Total Phase 1** | **65,000** | — | **$27-30/mo** |
| **Total Phase 2** | **67,000** | — | **$47-50/mo** |

---

## <a id="6-authentication"></a>6. Area 2: Authentication — Quickest Viable Setup

### 6.1 Better Auth: Why and How Fast

**Decision: Better Auth** over Auth.js v5. Auth.js is in maintenance mode since the September 2025 merger. Better Auth is the successor, YC-backed, with built-in plugins for magic links, rate limiting, and password policies.

**Setup time: 1 day** for core auth, 3 days total with hardening and profile.

```typescript
// auth.ts — this is the ENTIRE auth configuration
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db),
  emailAndPassword: { enabled: false }, // magic link only, no passwords
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          to: email,
          subject: "Sign in to BadukApp",
          react: MagicLinkEmail({ url }),
        });
      },
    }),
  ],
  session: {
    strategy: "jwt",
    expiresIn: 15 * 60,      // 15 minutes
    refreshExpiresIn: 7 * 24 * 60 * 60, // 7 days
  },
});
```

### 6.2 What We Ship vs Skip

| Feature | Ship? | Rationale |
|---------|-------|-----------|
| Email magic link | Day 1 | Passwordless, simple, secure |
| Google OAuth | Day 2 | Covers ~80% of social login needs |
| JWT sessions (15m/7d) | Day 1 | Stateless, Edge Runtime compatible |
| Role-based access (Free/Premium/Admin) | Day 3 | Minimum for freemium model |
| CSRF protection | Day 3 | Better Auth built-in |
| Rate limiting on auth | Day 3 | Better Auth built-in |
| GitHub OAuth | Defer | <5% of users would use it |
| Discord OAuth | Defer | <5% of users |
| Apple Sign-in | Defer | iOS-only, requires Apple Developer Program |
| Passkeys/WebAuthn | Defer | Progressive enhancement |
| 2FA (TOTP) | Never | Not a banking app |
| RBAC with custom roles | Never | Three roles is sufficient forever |
| B2B multi-tenancy | Never | No enterprise use case |

### 6.3 Korea/Japan Payment Entity Constraint

**Critical finding from Branch 2.1**: Stripe cannot register Korean business entities. The app operator needs a US, UK, Japan, or other supported country entity for Stripe.

**Speed-first solution**: Register Stripe under a US LLC (takes 1-3 business days via Stripe Atlas or similar). This is a business task, not a technical task. It runs in parallel with development and does not block Day 1-14.

---

## <a id="7-payment"></a>7. Area 3: Payment — Stripe Checkout and Done

### 7.1 The Simplest Possible Payment Integration

Stripe Checkout is a hosted payment page maintained by Stripe. We do not build payment forms. We do not handle card numbers. We redirect the user to Stripe and receive a webhook when they pay.

**Total implementation: 2 days** (Day 4-5).

```
User clicks "Upgrade to Premium"
  → POST /api/stripe/checkout (creates Stripe Checkout Session)
    → Redirect to checkout.stripe.com (Stripe's hosted page)
      → User enters payment details on Stripe's page
        → Stripe processes payment
          → Webhook: checkout.session.completed
            → Our server: update user role to Premium
              → Redirect to /subscription/success
```

### 7.2 Single Subscription Tier

Phase 1 has ONE product, ONE price, ONE subscription tier:

| Attribute | Value |
|-----------|-------|
| Product name | BadukApp Premium |
| Price | $9.99/month |
| Trial | 7-day free trial (credit card required) |
| Features | Unlimited AI explanations, unlimited KataGo analyses, priority support |
| Currency | USD (Stripe auto-converts for Korean/Japanese cards) |

**Why one tier**: Adding Basic/Pro/Enterprise tiers adds pricing page complexity, subscription management complexity, feature gating complexity. We do not know which features users value most. Ship one tier, learn from usage patterns, split tiers in Phase 2 if justified.

### 7.3 Stripe Regional Support

Stripe natively supports Korean payment methods since October 2024:
- Korean cards: Shinhan, Hyundai, Samsung
- Korean wallets: KakaoPay, NaverPay, PAYCO

Stripe natively supports Japanese payment methods:
- Japanese cards with 3D Secure (mandatory since March 2025)
- Konbini (convenience store) payments
- PayPay wallet

**No additional payment gateway needed** for Korea/Japan. Stripe handles everything.

### 7.4 Webhook Implementation

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  const event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);

  switch (event.type) {
    case "checkout.session.completed":
      await upgradeUser(event.data.object.customer);
      break;
    case "customer.subscription.deleted":
      await downgradeUser(event.data.object.customer);
      break;
    case "invoice.payment_failed":
      await sendPaymentFailedEmail(event.data.object.customer);
      break;
  }

  return new Response("ok", { status: 200 });
}
```

Three webhook events. That is all we handle on Day 5. Invoice handling, proration, usage-based billing, tax calculation — all deferred.

### 7.5 Cost of Stripe

| Item | Cost |
|------|------|
| Stripe transaction fee | 2.9% + $0.30 per transaction |
| Stripe Billing surcharge | 0.7% of recurring revenue |
| At MRR $5K (500 subscribers) | ~$185/month total Stripe fees |
| At MRR $1K (100 subscribers) | ~$37/month total Stripe fees |
| Day 1 | $0 (no subscribers yet) |

---

## <a id="8-communication"></a>8. Area 4: Communication — Absolute Minimum

### 8.1 Three Channels, Not Six

Branch 3.2 (Robust) proposed: Resend + Web Push + WebSocket + Discord + Novu orchestration + FCM + i18n emails + leaderboard notifications. That is 6 weeks of work for $20-260/mo.

Branch 3.1 (Rapid) proposed: Resend + Web Push + WebSocket + Discord. 3.5 days, $0/mo.

**Speed-first selection: three channels only.**

```
Channel 1: Resend (transactional email)
├── Auth emails: magic link, welcome, verification
├── Payment emails: receipt, expiry warning
├── Game emails: analysis ready (optional, user preference)
└── Cost: $0/mo (free tier: 3,000 emails/mo, covers MAU 8K)

Channel 2: Web Push (browser notifications)
├── Game events: your turn, challenge, game ended
├── AI events: analysis ready
├── Zero cost (Web Push API is free)
└── Works on Chrome, Firefox, Safari, Edge (desktop + mobile)

Channel 3: Discord webhook (community + admin)
├── Community: new game completed, daily puzzle, milestones
├── Admin: signups, payments, errors
├── Zero cost (Discord webhooks are free)
└── Zero setup (one URL, one POST request)
```

**What we skip entirely**:
- Novu notification orchestration layer (adds abstraction over 3 simple channels)
- FCM / Firebase (Google ecosystem dependency for what Web Push does natively)
- SMS notifications (cost per message, unnecessary for a baduk app)
- In-app notification center (users have browser notifications)
- i18n for email templates (start with English, add Korean in Phase 2)

### 8.2 Email Templates (React Email)

Six templates total for launch:

```
emails/
├── magic-link.tsx          ← "Click to sign in" (auth)
├── welcome.tsx             ← "Welcome to BadukApp!" (onboarding)
├── payment-receipt.tsx     ← "Payment confirmed" (Stripe)
├── sub-expiring.tsx        ← "Your subscription expires in 7 days" (retention)
├── game-analysis-ready.tsx ← "Your AI game review is ready" (engagement)
└── password-reset.tsx      ← (if we ever add passwords)
```

**No BullMQ queue**. At MAU 8K, we send <100 emails/day. Direct `resend.emails.send()` is fine. Queue when volume hits 1,000/day.

### 8.3 Web Push Implementation

```typescript
// lib/push.ts — the entire push notification system
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:admin@badukapp.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPush(userId: string, payload: PushPayload) {
  const subscriptions = await db.select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  await Promise.allSettled(
    subscriptions.map(sub =>
      webpush.sendNotification(sub.endpoint, JSON.stringify(payload))
        .catch(() => db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)))
    )
  );
}

// Usage:
await sendPush(opponentId, {
  title: "Your turn!",
  body: `${playerName} played at ${coordinate}. It's your move.`,
  url: `/game/${gameId}`,
});
```

### 8.4 Communication Cost Summary

| Channel | Monthly Cost | Volume |
|---------|-------------|--------|
| Resend email | $0 | <3,000/mo |
| Web Push | $0 | Unlimited |
| Discord webhook | $0 | <1,000/mo |
| **Total** | **$0/mo** | — |

---

## <a id="9-analytics"></a>9. Area 5: Analytics & Data — Day 1 vs Deferred

### 9.1 Day 1 Analytics: Umami Only

Branch 4.1 (Minimal) recommended Umami self-hosted at $0/mo with ~2 days setup. Branch 4.2 (Practical) recommended PostHog + Sentry + Cloudflare at $0 free tiers with ~2 weeks setup.

**Speed-first: Umami only (Day 12, half-day setup).**

Umami v3 on Coolify is a one-click deployment. It shares our existing PostgreSQL 16 instance (separate database). Resource usage: ~200-450 MB RAM, ~1% CPU. Capacity: 100K pageviews/month on 1 vCPU (we expect ~80K at MAU 8K).

### 9.2 What Umami Tracks

**Automatic** (zero code):
- Page views, unique visitors, bounce rate, session duration
- Referral sources, devices, browsers, countries
- Page performance metrics

**Custom events** (one line each):
```typescript
// Track key business events via umami.track()
umami.track("game_started", { boardSize: 19, timeControl: "30m" });
umami.track("game_ended", { result: "B+3.5", duration: 1800 });
umami.track("explanation_requested", { type: "template" | "claude_api" });
umami.track("subscription_started", { plan: "premium" });
umami.track("subscription_cancelled", { reason: "..." });
umami.track("signup_completed", { method: "magic_link" | "google" });
```

### 9.3 What We Skip

| Tool | Branch Source | Why Skip |
|------|-------------|----------|
| PostHog | 4.2 | Feature flags + session replay overkill for MAU 8K |
| Sentry | 4.2 | Console.error + Umami custom events sufficient initially |
| Bugsink | 4.1 | Self-hosted error tracker, unnecessary complexity |
| PG materialized views | 4.1 | Direct queries fast enough at 8K MAU |
| Custom admin dashboard | 4.2 | Umami dashboard + Stripe dashboard + Coolify dashboard |

### 9.4 Error Monitoring: Console + Structured Logging

Instead of Sentry ($0-26/mo) or Bugsink (self-hosted):

```typescript
// lib/logger.ts
export function logError(error: Error, context: Record<string, unknown>) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "error",
    message: error.message,
    stack: error.stack,
    ...context,
  }));

  // Also track in Umami for dashboard visibility
  if (typeof umami !== "undefined") {
    umami.track("error", { message: error.message, ...context });
  }

  // Alert admin via Discord webhook for critical errors
  if (context.severity === "critical") {
    await sendDiscordAlert(error, context);
  }
}
```

This costs $0 and ships in 30 minutes. Sentry is a Phase 2 addition when error volume exceeds what console logs + Coolify log viewer can handle.

### 9.5 Cloudflare CDN: Free Performance

Cloudflare free tier provides:
- Global CDN for static assets (JS, CSS, images)
- Auto-minification
- DDoS protection
- SSL/TLS
- Always Online fallback
- Analytics (basic)

Setup time: 30 minutes (DNS nameserver change). Cost: $0.

---

## <a id="10-integration-patterns"></a>10. Area 6: Integration Patterns — Simplest That Works

### 10.1 REST + Zod: Zero Debate

Branch 5.1 (Modern) proposed tRPC + MCP + OAuth 2.1 with type safety 8.5/10 and 8 weeks implementation. Branch 5.2 (Classical) proposed REST + Zod + webhooks with type safety 7.5/10 and 3-4 weeks.

**Speed-first: REST + Zod. Period.**

| Criterion | REST + Zod | tRPC | GraphQL |
|-----------|-----------|------|---------|
| AI agent generation speed | Fastest | Medium | Slow |
| Learning curve | None | Small | Medium |
| Setup time | 0 (Next.js built-in) | 2-3 days | 1 week |
| Type safety | 7.5/10 (runtime) | 8.5/10 (compile + runtime) | 7/10 |
| External API compatibility | Universal | Node.js only | Universal |
| Debugging | curl + browser | Custom tooling | GraphiQL |
| Production evidence | 25+ years | 3 years | 10 years |

**The 1-point type safety difference between REST+Zod and tRPC is not worth the setup cost, tooling complexity, or reduced curl-debuggability.**

### 10.2 API Pattern: Next.js Route Handlers + Zod

```typescript
// app/api/games/[id]/analysis/route.ts
import { z } from "zod";

const AnalysisRequestSchema = z.object({
  moveNumber: z.number().int().positive().optional(),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = AnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({
      type: "validation_error",
      errors: parsed.error.flatten()
    }, { status: 400 });
  }

  // ... business logic
}
```

### 10.3 Webhook Pattern: Stripe Only

Day 1-14, we receive webhooks from exactly one source: Stripe. No webhook management system needed. No event bus. No message queue.

```typescript
// Webhook verification pattern (Stripe-specific)
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

When we add more webhook sources (Phase 2), we extract a shared verification + routing layer. Until then, one file handles all webhooks.

### 10.4 Caching Pattern: Redis Simple

```typescript
// lib/cache.ts — entire caching layer
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const result = await fn();
  await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
  return result;
}

// Usage:
const explanation = await cached(
  `explanation:${gameId}:${moveNumber}`,
  86400, // 24 hours
  () => generateExplanation(gameId, moveNumber)
);
```

No cache invalidation strategy beyond TTL. No cache warming. No multi-level cache. TTL expiry is sufficient for MAU 8K.

---

## <a id="11-speed-scorecard"></a>11. Speed Scorecard

| Integration Area | Days | Speed Score (1-10) | Rationale |
|-----------------|------|-------------------|-----------|
| Auth (Better Auth) | 3 | 9/10 | Boilerplate exists, config-based setup |
| Email (Resend) | 1 | 10/10 | 5 lines of code, free tier |
| Payment (Stripe Checkout) | 2 | 10/10 | Hosted page, 3 webhook events |
| AI Templates | 2 | 10/10 | Zero dependencies, string interpolation |
| AI Claude API | 2 | 8/10 | SDK is clean but prompt tuning takes time |
| Web Push | 1.5 | 9/10 | VAPID + service worker, no vendor |
| Discord Webhook | 0.5 | 10/10 | One HTTP POST |
| Umami Analytics | 0.5 | 9/10 | One-click Coolify deploy |
| Cloudflare CDN | 0.5 | 9/10 | DNS change only |
| Error Handling | 1 | 7/10 | Circuit breaker requires careful design |
| Integration Testing | 1 | 8/10 | Focused on critical paths |
| **TOTAL** | **14 days** | **9.0/10 avg** | — |

---

## <a id="12-timeline-cost"></a>12. Total Timeline & Cost Summary

### 12.1 Calendar Timeline

```
Week 1 (Day 1-5):  Auth + Email + Payment
  ├─ Day 1: Better Auth core setup
  ├─ Day 2: Resend emails + auth completion
  ├─ Day 3: Auth hardening + profile
  ├─ Day 4: Stripe Checkout + webhook
  └─ Day 5: Freemium gate + payment polish

Week 2 (Day 6-10): AI + Notifications
  ├─ Day 6: Template-based explanations
  ├─ Day 7: Template refinement + Claude prep
  ├─ Day 8: Claude API integration
  ├─ Day 9: Claude optimization + prompt tuning
  └─ Day 10: Web Push notifications

Week 3 (Day 11-14): Communication + Analytics + Hardening
  ├─ Day 11: Discord webhook + notification polish
  ├─ Day 12: Umami analytics + Cloudflare CDN
  ├─ Day 13: Error handling + circuit breakers
  └─ Day 14: Integration testing + launch prep
```

**Total: 14 calendar days** (assuming AI agent works 8-hour equivalent days).

### 12.2 Monthly Cost at Launch (Day 15)

| Service | Monthly Cost | Free Tier Limit |
|---------|-------------|-----------------|
| Resend email | $0 | 3,000 emails/mo |
| Web Push | $0 | Unlimited |
| Discord webhooks | $0 | Unlimited |
| Umami analytics | $0 | Self-hosted |
| Cloudflare CDN | $0 | Unlimited |
| Stripe | $0 | No subscribers yet |
| Claude API | $0-5 | Early usage is minimal |
| **Total** | **$0-5/mo** | — |

### 12.3 Monthly Cost at Scale (MAU 8K, 500 paying users)

| Service | Monthly Cost |
|---------|-------------|
| Claude API (Haiku + caching) | $27-30 |
| Stripe fees (MRR $5K) | $185 |
| Resend (if >3K emails) | $20 |
| Hetzner infrastructure | $8-12 |
| Everything else | $0 |
| **Total** | **$240-247/mo** |
| **Revenue (MRR $5K)** | **$5,000/mo** |
| **Margin** | **~95%** |

### 12.4 Comparison to PHASE 1 Branch Proposals

| Approach | Implementation Time | Monthly Cost | Features |
|----------|-------------------|-------------|----------|
| Speed First (this PRD) | **14 days** | $0-247 | MVP complete |
| Branch 3.1 Rapid (comms only) | 3.5 days | $0 | Comms only |
| Branch 2.1 Evolutionary (auth+pay) | 7 days | $60-372 | Auth+pay only |
| All Aggressive branches | ~8 weeks | $41-97 (AI only) | Over-engineered |
| All Conservative/Robust branches | ~14 weeks | $43-325 | Enterprise-grade |

**We achieve everything the Aggressive branches promise in 2 weeks instead of 8, by ruthlessly cutting features that serve no user.**

---

## <a id="13-sacrifices"></a>13. What We Sacrifice

Transparency demands we name exactly what we knowingly skip and why:

### 13.1 Functionality Sacrifices

| Sacrifice | Impact | Mitigation | Acceptable Because |
|-----------|--------|------------|-------------------|
| No Sonnet escalation | Complex positions get Haiku-quality explanations | Template fallback for consistency | Haiku handles 80%+ of positions well |
| No batch post-game review | Users wait for real-time analysis per move | Cache results for replay | Real-time per-move is actually better UX |
| No email queue (BullMQ) | Email send failures are not retried | Log failures, resend manually | <100 emails/day does not need a queue |
| No in-app notification center | Users rely on browser push | Push notification history in browser | Web Push covers the critical "your turn" loop |
| No feature flags | Cannot A/B test | Deploy changes behind env vars | MAU 8K does not need statistical significance |
| No session replay | Cannot see user struggles | Umami events + user feedback | Small user base means direct feedback |
| No i18n emails | Korean users get English emails | App UI is i18n'd; emails are secondary | Most transactional emails are code-like (links, receipts) |
| No Apple Sign-in | Apple-device-only users must use email/Google | Magic link works on all devices | <5% of Go app users are Apple-exclusive |

### 13.2 Quality Sacrifices

| Sacrifice | Impact | Trigger to Fix |
|-----------|--------|---------------|
| Console logging instead of Sentry | Errors require manual Coolify log review | Error volume >10/day |
| No API versioning | Breaking changes require client updates | External API consumers emerge (never?) |
| No idempotency keys on all endpoints | Duplicate requests possible on network retries | Duplicate entries appear in production |
| Simple Redis cache (TTL only) | Stale data possible for up to 24h | Users report stale explanations |
| No webhook retry dead letter queue | Failed Stripe events require manual retry | Payment state inconsistencies >1/week |

### 13.3 Security Sacrifices (minimal)

| Sacrifice | Impact | Mitigation |
|-----------|--------|------------|
| No 2FA | Account takeover via email compromise | Magic link = email IS the factor |
| No rate limiting on all endpoints | Potential abuse of free-tier features | Rate limit auth + AI endpoints only |
| No WAF (Web Application Firewall) | Exposed to common web attacks | Cloudflare free provides basic DDoS protection |

---

## <a id="14-phase-2-upgrade"></a>14. Phase 2 Upgrade Path

When the product is validated (MAU >2K, MRR >$1K, retention >10%), we invest in durability:

### 14.1 Phase 2A: AI Enhancement (Weeks 3-4)

| Upgrade | Trigger | Effort |
|---------|---------|--------|
| Claude Sonnet escalation tier | Users ask "why?" and Haiku is shallow | 2 days |
| Prompt caching optimization | Claude costs >$50/mo | 1 day |
| Batch API for post-game reviews | >100 games completed/day | 2 days |
| Extended thinking for tsumego | Teaching mode feature request | 1 day |

### 14.2 Phase 2B: Auth & Payment (Weeks 5-6)

| Upgrade | Trigger | Effort |
|---------|---------|--------|
| GitHub + Discord OAuth | User requests + community growth | 1 day each |
| Apple Sign-in | iOS user complaints | 2 days |
| Multiple subscription tiers | Feature usage data reveals tier boundaries | 3 days |
| Stripe Customer Portal (self-service) | Support tickets for subscription changes | 1 day |
| Korean won / Japanese yen pricing | Regional user segments >30% | 1 day |

### 14.3 Phase 2C: Communication (Weeks 7-8)

| Upgrade | Trigger | Effort |
|---------|---------|--------|
| i18n email templates (Korean) | Korean user segment >30% | 2 days |
| BullMQ email queue | Email volume >1,000/day | 2 days |
| In-app notification center | Push opt-in rate <30% | 3 days |
| Email marketing automation | Retention <15% | 3 days |

### 14.4 Phase 2D: Analytics & Monitoring (Weeks 9-10)

| Upgrade | Trigger | Effort |
|---------|---------|--------|
| Sentry error monitoring | Error volume >10/day | 1 day |
| PostHog feature flags | Need A/B testing | 2 days |
| PG materialized views | Analytics query latency >500ms | 2 days |
| Custom admin dashboard | Umami + Stripe + Coolify insufficient | 1 week |

### 14.5 Phase 2 Total Estimate

If all Phase 2 upgrades are needed (unlikely — only build what users demand):
- **Time**: 6-8 additional weeks
- **Additional monthly cost**: $20-50/mo (Sentry free tier, PostHog free tier)
- **Total with Phase 1**: 10-12 weeks for "complete" integration layer

---

## <a id="15-risk-analysis"></a>15. Risk Analysis

### 15.1 Speed-Specific Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Claude API outage kills AI explanations | Medium (SLA 99.5%) | High (core feature) | Template fallback always available (Layer 1) |
| Stripe webhook missed → payment not recorded | Low | High (revenue loss) | Stripe retries for 3 days; idempotent handler |
| Resend free tier exceeded | Low (3K/mo >> need) | Medium | Upgrade to $20/mo Pro or switch to SES |
| Web Push opt-in rate <20% | Medium | Medium | Email fallback for critical notifications |
| Better Auth has breaking bug | Low (actively maintained) | High (auth is core) | Pin version, Auth.js v5 as emergency fallback |
| Prompt quality poor (Haiku too shallow) | Medium | Medium | Escalate to Sonnet earlier than planned |
| No error monitoring → silent failures | Medium | High | Discord webhook alerts for critical paths |
| Coolify deployment issues | Low | Medium | Docker Compose fallback on raw Hetzner |

### 15.2 Dependency Map

```
Critical Path (single points of failure):
├── Claude API → Template fallback (eliminates SPOF)
├── Stripe → No fallback (but Stripe has 99.999% uptime)
├── Resend → Console log emails as last resort
├── PostgreSQL → No fallback (but PG is local, not cloud)
└── Redis → App works without cache (just slower)

Non-Critical (degraded but functional without):
├── Umami → App works, just no analytics
├── Cloudflare → App works, just slower
├── Discord webhook → App works, just no community updates
└── Web Push → App works, users check manually
```

### 15.3 Recovery Scenarios

| Scenario | Recovery Time | Action |
|----------|-------------|--------|
| Claude API down for 1 hour | 0 min | Templates serve automatically |
| Claude API down for 24 hours | 0 min | Templates serve; users see "AI is temporarily using cached analysis" |
| Stripe webhook failures | Minutes | Check Stripe dashboard → manually retry events |
| Resend rate limited | 1 hour | Switch to direct SMTP or SES as transport |
| PG database corruption | 1-4 hours | Restore from daily backup |
| Hetzner server failure | 30-60 min | Coolify auto-restart; worst case: rebuild from Docker images |

---

## <a id="16-architecture"></a>16. Consolidated Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ Game UI  │  │ Auth UI  │  │Profile UI│  │ Service Worker   ││
│  │ (Board)  │  │ (Login)  │  │          │  │ (Web Push)       ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
└───────┼──────────────┼──────────────┼────────────────┼───────────┘
        │              │              │                │
        ▼              ▼              ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 15 (App Router)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    API Route Handlers                        │ │
│  │  /api/auth/*      → Better Auth                             │ │
│  │  /api/stripe/*    → Stripe Checkout + Webhooks              │ │
│  │  /api/games/*     → Game CRUD + Moves                       │ │
│  │  /api/explain/*   → Template Engine → Claude Haiku fallback │ │
│  │  /api/push/*      → Web Push subscriptions + send           │ │
│  │  /api/health      → Infrastructure health check             │ │
│  └──────┬──────────────┬──────────────┬────────────────────────┘ │
│         │              │              │                           │
│  ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐                   │
│  │ Zod         │ │ Middleware │ │ Circuit   │                   │
│  │ Validation  │ │ (JWT Auth)│ │ Breaker   │                   │
│  └─────────────┘ └───────────┘ └───────────┘                   │
└───────┬──────────────┬──────────────┬────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ PostgreSQL 16│ │  Redis 7.2   │ │  KataGo      │
│              │ │              │ │  (CPU Eigen) │
│ - users      │ │ - sessions   │ │              │
│ - games      │ │ - cache      │ │ stdin/stdout │
│ - moves      │ │ - rate limit │ │ JSON protocol│
│ - subs       │ │ - usage cnt  │ │              │
│ - push_subs  │ │              │ │              │
│ - umami (db) │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘

External Services (all free tier):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Claude API   │ │ Stripe       │ │ Resend       │ │ Cloudflare   │
│ (Haiku)      │ │ (Checkout)   │ │ (Email)      │ │ (CDN)        │
│ $27-30/mo    │ │ 2.9%+$0.30   │ │ $0/mo        │ │ $0/mo        │
│              │ │              │ │ 3K emails/mo │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Community:
┌──────────────┐ ┌──────────────┐
│ Discord      │ │ Umami v3     │
│ (Webhooks)   │ │ (Analytics)  │
│ $0/mo        │ │ $0/mo        │
│              │ │ Self-hosted  │
└──────────────┘ └──────────────┘
```

---

## <a id="17-sources"></a>17. Sources

### Authentication
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Next.js Example](https://better-auth.com/docs/examples/next-js)
- [Better Auth Starter (GitHub)](https://github.com/devAaus/better-auth)
- [Next.js Better Auth Starter Kit (GitHub)](https://github.com/Achour/nextjs-better-auth)
- [Better Auth UI for Next.js](https://better-auth-ui.com/integrations/next-js)
- [Next.js App Router Auth Guide 2026 (WorkOS)](https://workos.com/blog/nextjs-app-router-authentication-guide-2026)
- [Better Auth + Next.js Complete Guide (Medium)](https://medium.com/@amitupadhyay878/better-auth-with-next-js-a-complete-guide-for-modern-authentication-06eec09d6a64)

### Payment (Stripe)
- [Stripe Checkout Quickstart for Next.js](https://docs.stripe.com/checkout/quickstart?client=next)
- [Stripe Checkout + Webhook in Next.js 15 (Medium)](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e)
- [Next.js + Stripe Complete Guide (MakerKit)](https://makerkit.dev/blog/tutorials/guide-nextjs-stripe)
- [Stripe Korea: Accept Local Cards](https://docs.stripe.com/payments/kr-card/accept-a-payment)
- [Stripe Japan: PayPay + Terminal Launch 2025](https://stripe.com/newsroom/news/tour-tokyo-2025)
- [Stripe Japan Payment Methods 2025](https://stripe.com/newsroom/news/japan-payments-moment-2025)
- [supastarter Next.js Stripe Boilerplate](https://supastarter.dev/nextjs-stripe-boilerplate)

### Communication (Email)
- [Resend: Send Emails with Next.js](https://resend.com/docs/send-with-nextjs)
- [Resend + Next.js Integration](https://resend.com/nextjs)
- [Next.js Send Email Tutorial 2026 (Mailtrap)](https://mailtrap.io/blog/nextjs-send-email/)
- [Send Emails from Next.js with Resend (DEV Community)](https://dev.to/thatanjan/send-emails-from-nextjs-with-resend-and-react-email-39fb)

### Communication (Push Notifications)
- [Next.js PWA Guide (Official)](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Web Push in Next.js — Provider-Free (Designly)](https://blog.designly.biz/push-notifications-in-next-js-with-web-push-a-provider-free-solution)
- [Web Push Notifications in Next.js (Medium)](https://medium.com/@ameerezae/implementing-web-push-notifications-in-next-js-a-complete-guide-e21acd89492d)
- [Push Notifications in Next.js (Wisp CMS)](https://www.wisp.blog/blog/nextjs-push-notifications)

### Communication (Discord)
- [Discord Webhooks with Next.js 15 (freeCodeCamp)](https://www.freecodecamp.org/news/integrate-discord-webhooks-with-nextjs-15-example-project/)
- [Discord Webhooks Complete Guide 2025](https://inventivehq.com/blog/discord-webhooks-guide)

### Analytics
- [Umami v3 Documentation](https://umami.is/docs)
- [Umami on Coolify (Official Docs)](https://coolify.io/docs/services/umami)
- [Self-Hosting Umami Analytics](https://bryananthonio.com/blog/self-hosting-umami-analytics/)
- [Umami Self-Hosted Guide (Easy Self Host)](https://easyselfhost.dev/blog/umami)

### AI Integration
- [Claude API Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude API Pricing 2026](https://platform.claude.com/docs/en/about-claude/pricing)
- [Prompt Caching Guide with Code Examples (AI Free API)](https://www.aifreeapi.com/en/posts/claude-api-prompt-caching-guide)
- [Claude Sonnet 4.6](https://www.anthropic.com/claude/sonnet)

### Integration Patterns
- [KataGo GitHub (Analysis Engine)](https://github.com/lightvector/KataGo)
- [KataGo Getting Started (DeepWiki)](https://deepwiki.com/lightvector/KataGo/1.2-getting-started)

### WebSocket
- [WebSocket with Next.js (Fly.io)](https://fly.io/javascript-journal/websockets-with-nextjs/)
- [next-ws: WebSockets in Next.js App Routes (GitHub)](https://github.com/apteryxxyz/next-ws)
- [WebSocket Implementation with Next.js (DEV Community)](https://dev.to/addwebsolutionpvtltd/websocket-implementation-with-nextjs-nodejs-react-in-one-app-gb6)

### SaaS Boilerplates (Reference)
- [Next.js SaaS Boilerplate (ixartz GitHub)](https://github.com/ixartz/SaaS-Boilerplate)
- [Top Next.js SaaS Boilerplates 2026](https://boilerplatesearch.com/tops/top-Next.js-saas-boilerplates)
- [MakerKit Next.js SaaS Boilerplate](https://makerkit.dev/nextjs-saas-boilerplate)
- [Vercel Next.js SaaS Starter Templates](https://vercel.com/templates/next.js/next-js-saas-starter)
