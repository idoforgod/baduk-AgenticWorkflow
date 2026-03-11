# External Integration Technology PRD -- Maintainability First

**Version**: 1.0
**Date**: 2026-03-10
**Perspective**: Maintainability First -- "Code you write today, you maintain for 3 years. Every integration is a maintenance burden. Choose integrations that are simple to understand, test, and replace."
**Phase**: 2.D of Research 4 (External Integration Technology Deep-Dive)
**Context**: AI baduk (Go) app. Stack: Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, KataGo CPU Eigen, Hetzner+Coolify. MAU 8K. Budget: $80-260/mo. AI agent team develops the code.
**Critical Constraint**: OpenAI/Gemini = subscription accounts ONLY, NO API.

---

## Executive Summary

This PRD makes every integration decision through a single lens: **what minimizes total maintenance burden over 3 years while an AI agent team builds and maintains the code?**

Industry data is unambiguous. Software maintenance consumes 60-90% of total lifecycle cost ([Vention, 2024](https://ventionteams.com/enterprise/software-maintenance-costs)). GitClear's 2025 study of 211 million changed lines found AI-assisted code has a 12.3% duplication rate (vs. 8.3% pre-AI) and refactoring dropped 60% ([GitClear, 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research)). Each external API integration consumes 20-30% of an engineer's time in perpetual maintenance ([Netguru](https://www.netguru.com/blog/api-integration-cost)). These facts demand a ruthlessly minimal integration strategy.

**Core principle**: Every external dependency is a liability. Every abstraction layer is a maintenance contract. Every line of integration code is a line that can break when a vendor changes their API. The winning strategy is **fewer integrations, thicker abstraction walls, and maximum use of managed services that transfer maintenance burden to vendors**.

**Total integration count**: 6 external services (Claude API, Better Auth, Stripe, Resend, PostHog, Sentry). Zero self-hosted analytics. Zero multi-model orchestration. Zero notification aggregators.

**3-Year TCO**: $5,280-$8,640 infrastructure/services + $0 developer salary (AI agents) = **$5,280-$8,640 total**.

---

## Table of Contents

1. [Integration Complexity Budget](#1-integration-complexity-budget)
2. [Abstraction Layer Design](#2-abstraction-layer-design)
3. [AI Agent Friendliness](#3-ai-agent-friendliness)
4. [AI Integration](#4-ai-integration)
5. [Payment & Auth](#5-payment--auth)
6. [Communication](#6-communication)
7. [Analytics & Data](#7-analytics--data)
8. [Integration Patterns](#8-integration-patterns)
9. [Maintainability Scorecard](#9-maintainability-scorecard)
10. [3-Year Total Cost of Ownership](#10-3-year-total-cost-of-ownership)
11. [Monthly Cost Breakdown at MAU 8K](#11-monthly-cost-breakdown-at-mau-8k)
12. [Implementation Timeline](#12-implementation-timeline)
13. [Test Strategy](#13-test-strategy)
14. [Vendor Migration Plan](#14-vendor-migration-plan)

---

## 1. Integration Complexity Budget

### 1.1 The Maintenance Tax

Every line of integration code carries a maintenance tax. Based on industry benchmarks:

- **Year 1**: 15-25% of initial development cost in maintenance ([Gartner](https://ventionteams.com/enterprise/software-maintenance-costs))
- **Year 2-3**: 20-30% annually as APIs change, dependencies update, and edge cases surface
- **Over 3 years**: Maintenance costs equal 2-4x the original development cost
- **AI-written integration code**: 34% higher complexity, 2.1x code duplication ([GitClear, 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research))

This means every 100 lines of integration code will cost 200-400 lines equivalent in maintenance effort over 3 years. The budget must be ruthlessly constrained.

### 1.2 LOC Budget Allocation

**Total integration LOC budget: 3,000 lines** (excluding tests).

This is deliberately aggressive. A loose budget invites complexity creep. The number is derived from: 6 integrations x 500 LOC average = 3,000 LOC. Every integration that exceeds its allocation must justify the overage.

| Integration | Max LOC | Rationale |
|-------------|---------|-----------|
| Claude API (AI) | 600 | Single SDK, tiered routing, caching, circuit breaker |
| Better Auth | 400 | Config-driven, plugin-based, minimal custom code |
| Stripe Checkout | 500 | Webhook handlers, subscription lifecycle, error recovery |
| Resend + react-email | 350 | Templates + send logic + webhook handling |
| PostHog | 150 | SDK init + custom events + feature flags |
| Sentry | 100 | SDK init + custom context + error boundaries |
| Shared infra (ports, adapters, types) | 500 | Abstraction layer, shared error types, retry logic |
| Web Push (native API) | 400 | Service worker + subscription management + payload handling |
| **Total** | **3,000** | |

### 1.3 Complexity Guardrails

1. **No integration may depend on another integration** (no Stripe-calls-Claude, no PostHog-triggers-Resend)
2. **No integration may require more than 1 environment variable beyond API key** (endpoint URL if non-standard)
3. **No integration may introduce more than 2 npm dependencies** (SDK + types/utils at most)
4. **Every integration must work with a mock in tests** (no network calls in CI)
5. **No integration may add more than 3 database tables** (Stripe needs 2, Auth needs 4 from Better Auth, email needs 0)

---

## 2. Abstraction Layer Design

### 2.1 Ports and Adapters (Simplified Hexagonal)

The hexagonal architecture pattern (Alistair Cockburn, 2005) provides maximum testability and replaceability. However, full hexagonal adds ceremony that AI agents may over-engineer. We adopt a **simplified Ports and Adapters** pattern: one TypeScript interface (Port) per external service, one implementation (Adapter) per vendor.

```
src/
  lib/
    ports/                    # Interfaces only -- zero dependencies
      ai.ts                   # AIService interface
      payment.ts              # PaymentService interface
      email.ts                # EmailService interface
      analytics.ts            # AnalyticsService interface
      error-tracking.ts       # ErrorTrackingService interface
      push.ts                 # PushNotificationService interface
    adapters/                 # Implementations -- vendor-specific
      claude-ai.ts            # implements AIService
      stripe-payment.ts       # implements PaymentService
      resend-email.ts         # implements EmailService
      posthog-analytics.ts    # implements AnalyticsService
      sentry-error.ts         # implements ErrorTrackingService
      web-push-native.ts      # implements PushNotificationService
    __mocks__/                # Test doubles
      mock-ai.ts
      mock-payment.ts
      mock-email.ts
      mock-analytics.ts
      mock-error.ts
      mock-push.ts
```

### 2.2 Port Interface Design Rules

Each port interface follows strict rules to maximize maintainability:

1. **No vendor types in port interfaces.** The port uses domain types only. The adapter translates.
2. **Maximum 7 methods per port.** More than 7 signals the port is doing too much (Miller's Law).
3. **Every method returns a Result type** (`{ ok: true, data: T } | { ok: false, error: AppError }`). No thrown exceptions crossing the port boundary.
4. **No optional parameters beyond 3.** Use an options object if more configuration is needed.

**Example Port -- AIService:**

```typescript
// src/lib/ports/ai.ts
export interface AIService {
  explainMove(params: MoveExplanationRequest): Promise<Result<MoveExplanation>>;
  reviewGame(params: GameReviewRequest): Promise<Result<GameReview>>;
  generateStudyPlan(params: StudyPlanRequest): Promise<Result<StudyPlan>>;
  translateContent(params: TranslationRequest): Promise<Result<TranslatedContent>>;
  healthCheck(): Promise<Result<ServiceHealth>>;
}

// Domain types -- no vendor imports
export interface MoveExplanationRequest {
  sgf: string;
  moveNumber: number;
  playerRank: string;
  language: 'ko' | 'en' | 'ja';
  katagoAnalysis: KataGoAnalysis;
}

export interface MoveExplanation {
  explanation: string;
  suggestedAlternatives: string[];
  conceptsCovered: string[];
  confidence: number;
}
```

### 2.3 Adapter Implementation Rules

1. **One file per adapter.** No adapter may import from another adapter.
2. **Constructor injection.** Every adapter receives its SDK client via constructor, never creates it internally.
3. **Wrap every vendor call in try-catch** with structured error mapping to `AppError`.
4. **Log every vendor call** with request ID, latency, and status (success/failure/timeout).
5. **Circuit breaker at the adapter level.** If a vendor fails 5 times in 60 seconds, open the circuit for 30 seconds.

### 2.4 Dependency Injection Container

A simple DI container (no framework -- just a factory function) wires ports to adapters:

```typescript
// src/lib/container.ts
export function createServices(config: AppConfig): Services {
  return {
    ai: new ClaudeAIAdapter(config.claude),
    payment: new StripePaymentAdapter(config.stripe),
    email: new ResendEmailAdapter(config.resend),
    analytics: new PostHogAnalyticsAdapter(config.posthog),
    errorTracking: new SentryErrorAdapter(config.sentry),
    push: new WebPushNativeAdapter(config.webPush),
  };
}

// In tests:
export function createTestServices(): Services {
  return {
    ai: new MockAIAdapter(),
    payment: new MockPaymentAdapter(),
    email: new MockEmailAdapter(),
    analytics: new MockAnalyticsAdapter(),
    errorTracking: new MockErrorAdapter(),
    push: new MockPushAdapter(),
  };
}
```

This pattern costs approximately 150 LOC for the entire container + all mock implementations. Vendor migration requires changing exactly one file (the adapter) and zero changes to business logic.

---

## 3. AI Agent Friendliness

### 3.1 Why This Matters More Than Anything Else

This project is built entirely by AI agents. AI agents have specific characteristics that affect integration design:

1. **AI agents produce 12.3% duplicated code** ([GitClear, 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research)). Fewer integrations = fewer surfaces for duplication.
2. **AI agents perform 60% less refactoring** than human developers. Initial design decisions persist longer.
3. **AI agents work best with well-documented, widely-used patterns.** More Stack Overflow answers = better AI output. REST has 25+ years of training data; MCP has 1.5 years.
4. **AI agents excel at following consistent patterns.** If all 6 integrations follow the same Port/Adapter template, the agent learns the pattern once and replicates it correctly.
5. **AI agents struggle with multi-step orchestration.** A 5-layer AI pipeline (Gemini Nano + WebLLM + Claude + MCP + Template) is exactly the kind of complexity that produces compounding bugs.

### 3.2 Pattern Consistency Score

Each integration pattern is scored on how consistently an AI agent can implement it:

| Pattern | Training Data Volume | Consistency Score | Notes |
|---------|---------------------|-------------------|-------|
| REST + JSON | Massive (25+ years) | 10/10 | Every AI model knows this cold |
| Webhook handlers | Large (10+ years) | 9/10 | Well-documented pattern |
| SDK wrapper (single vendor) | Large | 9/10 | `npm install sdk; new Client(key)` |
| Port/Adapter interfaces | Large (Clean Architecture) | 8/10 | Well-known but requires discipline |
| tRPC | Medium (5 years) | 7/10 | Good TypeScript coverage, smaller community |
| MCP servers | Small (1.5 years) | 5/10 | New protocol, limited training data |
| Multi-model orchestration | Tiny | 3/10 | Novel, few public examples |
| On-device AI (Gemini Nano) | Tiny | 2/10 | Experimental APIs, minimal production examples |

### 3.3 Decision: Classical Patterns with TypeScript Types

We choose REST + Webhooks + SDK wrappers with Zod validation. Not because they are exciting, but because:

- AI agents have the most training data for these patterns
- Every problem has already been solved on Stack Overflow
- TypeScript + Zod provides the type safety that tRPC offers, without the framework lock-in
- Webhook signature verification is a solved problem for Stripe, Resend, and every major vendor

**What we explicitly reject**:
- MCP servers for internal tool integration (overhead not justified at 8K MAU; revisit at 50K)
- tRPC (adds a framework dependency; Next.js Server Actions + Zod achieve the same type safety)
- OAuth 2.1 (Better Auth handles OAuth internally; we do not build an OAuth server)
- GraphQL (unnecessary complexity for a read-heavy game app with predictable queries)

---

## 4. AI Integration

### 4.1 Decision: Claude-Only 3-Tier Architecture

**Maintainability Score: 9/10**

The aggressive branch proposed a 5-layer AI stack (Gemini Nano + WebLLM + Claude API + MCP orchestration + template fallback). From a maintainability perspective, this is a nightmare:

| Dimension | 5-Layer (Aggressive) | 3-Tier Claude-Only (This PRD) |
|-----------|---------------------|-------------------------------|
| SDKs to maintain | 4+ (Chrome AI, WebLLM, Anthropic, MCP) | 1 (`@anthropic-ai/sdk`) |
| API surfaces to monitor | 5 (each can break independently) | 1 (`api.anthropic.com`) |
| Billing relationships | 1 (Claude API; others free) | 1 (Claude API) |
| Failure modes | 15+ (cross-layer cascades) | 3 (Haiku fail, Sonnet fail, total outage) |
| Lines of orchestration code | ~800-1200 | ~200 |
| Korean language support | Broken (Gemini Nano does not support Korean) | Full (Claude supports Korean natively) |
| Mobile support | Broken (Chrome AI is desktop-only) | Full (server-side, device-agnostic) |
| Test complexity | 5 mock layers, feature detection stubs | 1 mock adapter |

**The 3-Tier Architecture:**

```
Tier 1 (80% of requests): Claude Haiku 4.5
  - Move explanations, game commentary, vocabulary, simple Q&A
  - Cost: $1/$5 per million tokens (input/output)
  - Latency: ~500ms-1s

Tier 2 (15% of requests): Claude Sonnet 4.6
  - Complex position analysis, multi-step teaching, deep reasoning
  - Escalation triggers: winrate delta >15%, explicit "why?", teaching mode
  - Cost: $3/$15 per million tokens
  - Latency: ~1-3s

Tier 3 (5% of requests): Template fallback
  - API failures, rate limits, common patterns
  - Pre-written responses for the 50 most common board situations
  - Cost: $0
  - Latency: <50ms
```

**Cost at MAU 8K:**

Assumptions: 8K MAU, 30% daily active, 5 AI requests/session, 20 sessions/month average.
- Monthly requests: ~240K (192K Haiku, 36K Sonnet, 12K template)
- Average tokens per request: ~800 input (with ~600 cached), ~300 output
- With prompt caching (90% savings on cached portion): **$43-65/month**

**Implementation:**

```typescript
// src/lib/adapters/claude-ai.ts -- ~250 LOC total
export class ClaudeAIAdapter implements AIService {
  private client: Anthropic;
  private circuitBreaker: CircuitBreaker;

  async explainMove(params: MoveExplanationRequest): Promise<Result<MoveExplanation>> {
    if (this.circuitBreaker.isOpen()) {
      return this.templateFallback(params); // Tier 3
    }

    const model = this.selectModel(params); // Tier 1 or 2
    const systemPrompt = this.buildSystemPrompt(params.playerRank, params.language);

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 500,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: this.buildUserPrompt(params) }],
      });

      this.circuitBreaker.recordSuccess();
      return { ok: true, data: this.parseExplanation(response) };
    } catch (error) {
      this.circuitBreaker.recordFailure();
      if (model === 'claude-haiku-4-5-20250314') {
        return this.explainMove({ ...params, _escalated: true }); // Escalate to Sonnet
      }
      return this.templateFallback(params); // Final fallback
    }
  }

  private selectModel(params: MoveExplanationRequest): string {
    if (params._escalated) return 'claude-sonnet-4-6-20250514';
    if (params.katagoAnalysis.winrateDelta > 0.15) return 'claude-sonnet-4-6-20250514';
    return 'claude-haiku-4-5-20250314';
  }
}
```

### 4.2 What We Explicitly Do Not Build

- **No Gemini Nano integration**: Korean unsupported, desktop-only, experimental APIs. Revisit when Korean is added (estimated Chrome 145+, late 2026).
- **No WebLLM**: Adds WASM complexity, requires model downloads on user devices, unreliable on low-end hardware.
- **No MCP servers**: At 8K MAU, the overhead of running MCP servers for KataGo + game database + user preferences is not justified. Direct function calls wrapped in the Port/Adapter pattern achieve the same result with zero protocol overhead.
- **No multi-model routing**: One SDK, one billing dashboard, one set of rate limits to understand.

---

## 5. Payment & Auth

### 5.1 Authentication: Better Auth

**Maintainability Score: 8/10**

**Decision: Better Auth** over Auth.js v5 (maintenance mode), Clerk (vendor lock-in), or Supabase Auth (infrastructure dependency).

**Why Better Auth is the maintainability winner:**

1. **Auth.js merged into Better Auth** (September 2025). Better Auth is the future; Auth.js v5 receives security patches only. Starting with Better Auth avoids a migration later.
2. **Plugin architecture**: 2FA, magic links, passkeys, rate limiting, and password policies are first-party plugins. Each plugin is a single import, not custom code. Custom code is maintenance debt; plugins are the vendor's maintenance debt.
3. **Config-driven**: The entire auth system is defined in a configuration object. AI agents produce more reliable config than imperative auth logic.
4. **Self-hosted, own database**: No vendor dependency for user data. If Better Auth dies, user data is in PG 16 with standard bcrypt hashes.
5. **Built-in rate limiting**: No need for separate rate limiting middleware.

**Implementation -- Phased:**

```
Phase 1 (MVP, Week 1-2):
  - Email magic link (via Resend) + Google OAuth
  - JWT sessions, 30-day expiry
  - 3 roles: Free, Premium, Admin
  - 4 DB tables (users, sessions, accounts, verifications)

Phase 2 (Month 3):
  - + GitHub, Discord OAuth (1 plugin each, ~10 LOC per provider)
  - + Apple Sign-in (Korean App Store compliance)

Phase 3 (Month 6+):
  - + Passkeys/WebAuthn (Better Auth plugin, ~20 LOC config)
  - Only if user demand validates the investment
```

**LOC estimate**: ~300-400 (config + middleware + role checking utilities).

**Critical security note**: Next.js 15 has CVE-2025-29927 (CVSS 9.1, middleware bypass via x-middleware-subrequest header). Must use Next.js 15.2.3+ ([WorkOS, 2026](https://workos.com/blog/nextjs-app-router-authentication-guide-2026)).

### 5.2 Payment: Stripe Checkout

**Maintainability Score: 9/10**

**Decision: Stripe Checkout** (hosted payment page) over custom payment form, PayPal, Paddle, or Lemon Squeezy.

**Why Stripe Checkout is the maintainability winner:**

1. **Stripe maintains the payment UI**. PCI compliance, card validation, 3D Secure, localization, error messages -- all Stripe's problem, not ours.
2. **Korean payment methods built-in**: KakaoPay, NaverPay supported since October 2024. Zero additional code.
3. **Webhook-driven architecture**: State changes come to us via webhooks. We never poll. The webhook handler is ~150 LOC.
4. **No payment form code**: Zero `<input type="card">` fields. Zero PCI scope. Stripe Checkout handles everything.
5. **25 years of training data**: AI agents have extensive training data on Stripe integration. Every edge case is documented.

**Subscription model:**

```
Free:        $0   -- 3 AI analyses/day, basic game replay
Premium:     $9.99/mo -- Unlimited AI, full KataGo, study plans
```

**Webhook handler (the only payment code we write):**

```typescript
// src/app/api/webhooks/stripe/route.ts -- ~150 LOC
// Handles: checkout.session.completed, customer.subscription.updated,
//          customer.subscription.deleted, invoice.payment_failed
```

**Monthly cost at MAU 8K with 500 paying users:**
- MRR: ~$5,000
- Stripe fees: 2.9% + $0.30 per txn + 0.7% Billing surcharge = ~$185/mo effective
- **No setup fee, no monthly fee from Stripe itself**

**What we explicitly do not build:**
- No custom payment form (PCI compliance burden)
- No PayPal integration (second payment vendor = double maintenance)
- No B2B/team billing in MVP (defer to Phase 2 if validated)
- No usage-based billing (subscription tiers are simpler to maintain)

---

## 6. Communication

### 6.1 Email: Resend + react-email

**Maintainability Score: 9/10**

**Decision: Resend** with react-email templates.

**Why Resend is the maintainability winner:**

1. **Free tier covers MAU 8K**: 3,000 emails/month free. At 8K MAU, estimated ~2,000-2,500 emails/month (magic links + transactional). No payment needed until growth demands it.
2. **react-email is maintained by Resend**: Same team, same ecosystem. React Email 5.0 (November 2025) supports React 19.2, Tailwind 4, dark mode -- actively maintained with 920K+ weekly npm downloads.
3. **JSX templates**: AI agents write React/JSX every day. Email templates in JSX are natural. No Handlebars, no Liquid, no separate templating language.
4. **Single SDK**: `resend` npm package. One import, one function call: `resend.emails.send()`.
5. **Webhook events**: Open/click/bounce tracking via webhooks. Same pattern as Stripe webhooks.

**Email types (exhaustive list for MVP):**

```
1. Magic link (auth)           -- triggered by sign-in
2. Welcome email               -- triggered by first sign-up
3. Game result summary          -- triggered by game completion (premium only)
4. Subscription confirmation    -- triggered by Stripe webhook
5. Subscription cancellation    -- triggered by Stripe webhook
6. Payment failed               -- triggered by Stripe webhook
```

**6 email templates. 6 react-email components. ~250 LOC for templates + ~100 LOC for send logic.**

**What we explicitly do not build:**
- No Novu (notification aggregator adds a dependency for a problem we don't have at 8K MAU)
- No FCM/Firebase (adds Google Cloud dependency; we use native Web Push API instead)
- No marketing email platform (Resend's free marketing tier covers 1,000 contacts)
- No Discord bot integration (community is in-app, not Discord)

### 6.2 Push Notifications: Native Web Push API

**Maintainability Score: 8/10**

**Decision: Native Web Push API** with the `web-push` npm package.

**Why native Web Push over FCM/OneSignal/Novu:**

1. **Zero vendor dependency**: Web Push is a W3C standard. No Google account, no Firebase project, no vendor dashboard.
2. **Browser support**: Chrome, Firefox, Safari (iOS 16.4+), Edge. Covers >95% of users.
3. **Declarative Web Push (2025)**: Browser handles notification display without custom code for basic scenarios. Less JavaScript = less maintenance.
4. **Single npm package**: `web-push` (6.8K stars, actively maintained) generates VAPID keys and sends push messages. ~200 LOC for the complete implementation.
5. **Service worker is a one-time investment**: Write once, it handles incoming pushes. ~100 LOC.

**Push notification types (MVP):**

```
1. Your turn (opponent played)     -- core engagement driver
2. Game invitation received        -- social feature
3. Daily puzzle available          -- retention hook (premium)
4. Analysis complete               -- KataGo batch analysis done
```

**What we explicitly do not build:**
- No FCM (adds Firebase dependency, SDK, Google project config)
- No OneSignal/Pusher (adds vendor for a feature native APIs handle)
- No rich notification templates (plain text with action URL is sufficient)
- No notification preferences UI beyond on/off toggle per type

---

## 7. Analytics & Data

### 7.1 Product Analytics: PostHog Cloud (Free Tier)

**Maintainability Score: 9/10**

**Decision: PostHog Cloud** (managed) over Umami (self-hosted) or Mixpanel (less free tier).

This is where the maintainability perspective **directly contradicts** the minimal-dependencies branch (4.1), which recommended self-hosted Umami. Here is why:

**The Self-Hosting Maintenance Tax:**

| Dimension | Umami Self-Hosted | PostHog Cloud |
|-----------|-------------------|---------------|
| Server maintenance | You patch, you update, you restart | PostHog's SRE team |
| Database maintenance | Shared PG 16 (risk: analytics queries slow down game DB) | ClickHouse (PostHog-managed) |
| Security patches | You monitor CVEs, you apply patches | Automatic |
| Uptime monitoring | You set up alerts for Umami | PostHog guarantees SLA |
| Backup | You back up analytics DB | PostHog handles it |
| Scaling | You upgrade VPS when analytics grow | Auto-scales |
| Feature updates | Manual Docker pull + migration | Automatic |
| **Annual maintenance hours** | **~40-80 hours** | **~2-4 hours** (SDK updates) |

**PostHog Free Tier covers MAU 8K easily:**
- 1M events/month free (8K MAU x ~50 events/user = ~400K events -- well within free tier)
- 5,000 session recordings/month free
- 1M feature flag requests/month free
- No credit card required
- No team size limit
- Full API access, SQL querying, cohort analysis

**Cost at MAU 8K: $0/month**. PostHog reports 98% of customers use it entirely free ([PostHog Pricing](https://posthog.com/pricing)).

**Implementation: ~150 LOC total**

```typescript
// src/lib/adapters/posthog-analytics.ts
import posthog from 'posthog-js';

export class PostHogAnalyticsAdapter implements AnalyticsService {
  init() { posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, { api_host: 'https://us.i.posthog.com' }); }
  trackEvent(name: string, props?: Record<string, unknown>) { posthog.capture(name, props); }
  identifyUser(userId: string, traits: UserTraits) { posthog.identify(userId, traits); }
  isFeatureEnabled(flag: string): boolean { return posthog.isFeatureEnabled(flag) ?? false; }
}
```

**Why not Umami:**
Umami is excellent software. But at 8K MAU, saving $0/month in hosting costs while adding ~60 hours/year of self-hosting maintenance is a losing trade. The maintainability perspective demands we delegate analytics infrastructure to a vendor. If PostHog's free tier ever becomes insufficient, the Port/Adapter pattern makes switching trivial.

### 7.2 Error Tracking: Sentry Cloud (Free Tier)

**Maintainability Score: 9/10**

**Decision: Sentry Cloud** (free Developer tier) over Bugsink (self-hosted) or PostHog Error Tracking.

**Why Sentry over alternatives:**

1. **Industry standard**: 15+ years, every Next.js tutorial includes Sentry. AI agents know Sentry configuration patterns by heart.
2. **Free tier**: 5,000 errors + 10,000 performance transactions/month. More than sufficient for 8K MAU.
3. **Next.js integration**: `@sentry/nextjs` is a first-party SDK with automatic instrumentation, source maps, and error boundaries.
4. **Stack traces + context**: Automatic breadcrumbs, user context, release tracking. Bugsink (self-hosted alternative) lacks most of these features.
5. **Zero maintenance**: Cloud SaaS. No Docker container to monitor.

**Implementation: ~100 LOC total**

```typescript
// sentry.client.config.ts + sentry.server.config.ts + sentry.edge.config.ts
// Next.js wizard generates these automatically
// src/lib/adapters/sentry-error.ts -- thin wrapper
```

**Cost at MAU 8K: $0/month** (free Developer tier).

---

## 8. Integration Patterns

### 8.1 Decision: REST + Webhooks + Zod + Next.js Server Actions

**Maintainability Score: 9/10**

This is the most consequential architectural decision for long-term maintenance. The modern branch (5.1) proposed MCP + tRPC + OAuth 2.1. The classical branch (5.2) proposed REST + Zod + webhooks. From a maintainability lens, the answer is clear.

**Pattern Comparison:**

| Dimension | MCP + tRPC + OAuth 2.1 | REST + Zod + Webhooks |
|-----------|------------------------|----------------------|
| Community size | MCP: small (1.5yr), tRPC: medium (5yr) | REST: massive (25yr), Webhook: massive (10yr) |
| Stack Overflow answers | MCP: ~500, tRPC: ~5,000 | REST: ~500,000, Webhooks: ~50,000 |
| AI agent training data | Limited (newer patterns) | Extensive (decades of examples) |
| Framework lock-in | tRPC ties client+server | Zod schemas are framework-agnostic |
| Protocol overhead | MCP requires server process, JSON-RPC | HTTP/JSON, universally understood |
| Type safety | tRPC: excellent | Zod: excellent (infer types from schemas) |
| Learning curve | High (new concepts) | Low (known patterns) |
| Vendor SDK compatibility | SDKs expose REST; MCP wraps on top | Direct use of vendor SDKs |
| Debugging | MCP inspector needed | cURL, Postman, browser DevTools |

**The decisive factor: AI agent training data.**

AI agents (including the ones building this app) have been trained primarily on REST APIs, Express/Next.js route handlers, and Zod validation. They produce reliable, idiomatic code for these patterns. MCP server development, by contrast, has ~1.5 years of public examples. The GitClear data showing 12.3% code duplication in AI-written code means we want AI agents working with patterns they know deeply.

**Internal API pattern (Next.js Server Actions + Zod):**

```typescript
// src/app/actions/game.ts
'use server';
import { z } from 'zod';

const PlayMoveSchema = z.object({
  gameId: z.string().uuid(),
  coordinate: z.string().regex(/^[A-T][1-9][0-9]?$/),
});

export async function playMove(formData: FormData) {
  const parsed = PlayMoveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.flatten() };
  // ... business logic using injected services
}
```

**External webhook pattern (Stripe + Resend):**

```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature')!;

  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed': /* ... */ break;
    case 'customer.subscription.deleted': /* ... */ break;
    case 'invoice.payment_failed': /* ... */ break;
  }

  return new Response('OK', { status: 200 });
}
```

**What we explicitly do not adopt:**
- **No MCP**: Revisit at 50K MAU when multi-tool orchestration may justify the protocol overhead
- **No tRPC**: Next.js Server Actions + Zod provide equivalent type safety without the framework
- **No GraphQL**: Predictable game queries do not benefit from flexible query shapes
- **No gRPC**: No microservices, no inter-service communication needs

---

## 9. Maintainability Scorecard

Each integration is scored on 5 dimensions (1-10 each, 50 max):

| Integration | Simplicity | Testability | Replaceability | Doc Quality | AI-Agent Fit | **Total (50)** |
|-------------|-----------|-------------|----------------|------------|-------------|----------------|
| Claude API (3-tier) | 8 | 9 | 7 | 9 | 9 | **42** |
| Better Auth | 8 | 8 | 7 | 7 | 8 | **38** |
| Stripe Checkout | 9 | 9 | 6 | 10 | 10 | **44** |
| Resend + react-email | 9 | 9 | 9 | 8 | 9 | **44** |
| PostHog Cloud | 9 | 8 | 9 | 9 | 9 | **44** |
| Sentry Cloud | 10 | 9 | 8 | 10 | 10 | **47** |
| Web Push (native) | 7 | 7 | 8 | 8 | 7 | **37** |

**Scoring rubric:**

- **Simplicity**: How few concepts must an AI agent understand to implement correctly? (Sentry: init + captureException. Done. Score: 10)
- **Testability**: Can the integration be fully mocked in tests without network calls? (All services have mock adapters: 8-9)
- **Replaceability**: If the vendor dies tomorrow, how many files change? (Port/Adapter pattern: 1 adapter file per vendor. But Stripe lock-in is real due to webhook schemas: 6)
- **Doc Quality**: How well-documented is the vendor SDK? (Stripe: gold standard. Better Auth: good but newer. Score varies)
- **AI-Agent Fit**: How much training data exists for this integration pattern? (Stripe: massive. Web Push: moderate)

**Portfolio Maintainability Score: 296/350 (84.6%)**

Any integration scoring below 35/50 should be reconsidered. Web Push (37) and Better Auth (38) are on the boundary but justified by their Zero-vendor-lock-in benefit.

---

## 10. 3-Year Total Cost of Ownership

### 10.1 TCO Model

**Formula**: TCO = Development Cost + (Annual Maintenance x 3) + Infrastructure Cost + Vendor Fees

For an AI-agent-built project, "development cost" and "maintenance cost" are measured in AI agent compute (Claude Code usage), not human salary. However, the complexity of the code still matters -- more complex integration code means more AI agent rounds, more debugging cycles, and more regression risk.

### 10.2 Our Stack: 3-Year TCO

| Category | Year 1 | Year 2 | Year 3 | 3-Year Total |
|----------|--------|--------|--------|-------------|
| **Claude API (AI features)** | $600 | $720 | $780 | $2,100 |
| **Stripe fees** | $2,220 | $2,220 | $2,220 | $6,660 |
| **Resend** | $0 | $0-240 | $0-240 | $0-480 |
| **PostHog** | $0 | $0 | $0 | $0 |
| **Sentry** | $0 | $0 | $0 | $0 |
| **Hetzner infra** | $1,080 | $1,440 | $1,800 | $4,320 |
| **Domain + DNS** | $60 | $60 | $60 | $180 |
| **Maintenance complexity tax** | Low | Low | Low | -- |
| **Total (excl. Stripe pass-through)** | **$1,740** | **$2,220-2,460** | **$2,640-2,880** | **$6,600-7,080** |
| **Total (incl. Stripe pass-through)** | **$3,960** | **$4,440-4,680** | **$4,860-5,100** | **$13,260-13,740** |

Notes:
- Stripe fees are a pass-through cost (percentage of revenue, not a fixed cost we control). Excluding them gives the true infrastructure TCO.
- Hetzner scales: $90/mo Y1 (single CX41) -> $120/mo Y2 -> $150/mo Y3 (upgraded plan or second node).
- Claude API costs assume flat MAU 8K. Growth would increase AI costs but also revenue.
- PostHog and Sentry remain $0 through the free tier at 8K MAU.
- Resend may require Pro plan ($20/mo) if email volume exceeds 3K/month in Y2-Y3.

### 10.3 Rejected Alternatives: TCO Comparison

| Alternative Stack | 3-Year TCO (excl. Stripe) | Maintenance Risk |
|-------------------|---------------------------|------------------|
| **This PRD (6 services)** | **$6,600-7,080** | Low |
| Aggressive AI (5-layer + Gemini Nano) | $7,200-9,600 | Very High (experimental APIs, multiple SDKs) |
| Self-hosted analytics (Umami + Bugsink) | $5,400-6,600 | High (self-hosting maintenance: ~120 hrs/yr) |
| Big Bang Auth (7 providers + 2FA + RBAC + B2B) | $7,800-10,200 | Very High (30+ endpoints, 10 DB tables, 8 weeks build) |
| Robust Communication (Novu + FCM + Discord) | $8,400-11,400 | High (3 vendor SDKs, 13 DB tables, template maintenance) |

The self-hosted analytics stack appears cheaper in dollar terms, but the 120 hours/year of maintenance (patching Umami, monitoring Bugsink, managing PostgreSQL analytics load) represents hidden cost that erodes the savings entirely when valued at even modest hourly rates.

---

## 11. Monthly Cost Breakdown at MAU 8K

### 11.1 Infrastructure Costs (Fixed)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Hetzner CX41 (8 vCPU, 16 GB) | $18.49 | App + KataGo + PG 16 + Redis 7.2 |
| Hetzner CX22 (2 vCPU, 4 GB) | $5.39 | Coolify management server |
| Hetzner Volume (40 GB) | $1.92 | PG backups + KataGo models |
| Hetzner backup | $3.70 | 20% of server cost |
| Domain (annual, amortized) | $5.00 | .com domain |
| **Infrastructure subtotal** | **$34.50** | |

### 11.2 Service Costs (Usage-Based)

| Service | Monthly Cost | Free Tier | Notes |
|---------|-------------|-----------|-------|
| Claude API | $43-65 | None | 80% Haiku, 15% Sonnet, 5% template, with prompt caching |
| Stripe | ~$185 | N/A | 3.7% effective rate on ~$5K MRR (pass-through) |
| Resend | $0 | 3,000 emails/mo | ~2,500 emails/mo at 8K MAU |
| PostHog | $0 | 1M events/mo | ~400K events/mo at 8K MAU |
| Sentry | $0 | 5K errors/mo | Ample for 8K MAU |
| Web Push | $0 | Native API | No vendor cost |
| **Service subtotal (excl. Stripe)** | **$43-65** | | |
| **Service subtotal (incl. Stripe)** | **$228-250** | | |

### 11.3 Total Monthly Cost

| Category | Monthly Cost |
|----------|-------------|
| Infrastructure | $34.50 |
| AI (Claude API) | $43-65 |
| Payment processing (Stripe, pass-through) | ~$185 |
| All other services | $0 |
| **Total (excl. Stripe)** | **$77.50-99.50** |
| **Total (incl. Stripe)** | **$262.50-284.50** |

This fits within the $80-260/month budget when Stripe fees are correctly categorized as pass-through (deducted from revenue, not an infrastructure expense).

---

## 12. Implementation Timeline

### 12.1 Total: 6 Weeks (Parallel AI Agent Execution)

```
Week 1-2: Foundation + Auth + Payment
├── [Agent 1] Port interfaces + DI container + shared types (3 days)
├── [Agent 1] Better Auth config + middleware + role checking (4 days)
├── [Agent 2] Stripe Checkout + webhook handler + subscription DB (5 days)
├── [Agent 2] Resend adapter + 6 email templates (2 days)
└── [Shared] Integration tests for auth + payment flow (2 days)

Week 3-4: AI + Analytics + Error Tracking
├── [Agent 1] Claude AI adapter (3-tier routing + caching + circuit breaker) (5 days)
├── [Agent 1] Template fallback system (50 common responses) (3 days)
├── [Agent 2] PostHog SDK init + custom events + feature flags (2 days)
├── [Agent 2] Sentry SDK init + error boundaries + source maps (2 days)
├── [Agent 2] Web Push service worker + subscription management (4 days)
└── [Shared] Integration tests for AI + analytics (2 days)

Week 5-6: Integration Testing + Hardening
├── [Agent 1] End-to-end flow testing (auth → payment → AI features) (3 days)
├── [Agent 1] Circuit breaker testing + failure mode verification (2 days)
├── [Agent 2] Webhook reliability testing (Stripe + Resend) (2 days)
├── [Agent 2] Load testing at 2x MAU (16K simulated) (2 days)
└── [Shared] Documentation + adapter migration guides (1 day)
```

### 12.2 Milestone Checkpoints

| Milestone | Week | Verification |
|-----------|------|-------------|
| All 6 port interfaces defined | 1 | TypeScript compiles with no adapter implementations |
| Auth flow works (sign up → sign in → role check) | 2 | Automated test suite passes |
| Stripe Checkout → webhook → subscription active | 2 | End-to-end test with Stripe test mode |
| Claude API explains a move correctly | 3 | Manual verification + automated response schema validation |
| PostHog tracks a custom event | 3 | Event visible in PostHog dashboard |
| Sentry captures a thrown error | 3 | Error visible in Sentry dashboard |
| Web Push delivers a notification | 4 | Browser notification appears on test device |
| All 6 adapters pass mock-based unit tests | 5 | CI green |
| Full auth → payment → AI → analytics flow works | 6 | E2E test suite passes |

---

## 13. Test Strategy

### 13.1 Testing Philosophy for External Integrations

**Principle: Never call a real external service in CI.** Every vendor call goes through a Port interface. Tests use mock adapters. Integration tests with real vendors run manually or in a dedicated staging environment.

### 13.2 Test Pyramid per Integration

| Integration | Unit Tests (Mock) | Integration Tests (Real) | E2E Tests |
|-------------|-------------------|--------------------------|-----------|
| Claude API | Response parsing, tier selection logic, circuit breaker state machine, template fallback | Prompt caching verification (staging), model response quality spot-check | Full game review flow |
| Better Auth | Role checking, JWT validation, session management | OAuth flow with test provider (Google sandbox) | Sign up → Sign in → Access gated content |
| Stripe | Webhook signature verification, subscription state machine, error handling | Stripe test mode checkout flow | Purchase → Access premium → Cancel → Lose access |
| Resend | Template rendering, email content validation, send result handling | Resend test mode send (inspect in Resend dashboard) | Auth magic link → Email received → Click → Signed in |
| PostHog | Event capture calls, user identification, feature flag evaluation | PostHog test project event verification | User journey events appear in analytics |
| Sentry | Error capture calls, context attachment, breadcrumb logging | Sentry test project error verification | Thrown error → Sentry alert received |
| Web Push | Subscription management, payload construction, VAPID signing | Push to test device | Opponent plays → Push notification received |

### 13.3 Mock Adapter Pattern

Every mock adapter implements the same Port interface and records calls for assertion:

```typescript
// src/lib/__mocks__/mock-email.ts
export class MockEmailAdapter implements EmailService {
  public sentEmails: Array<{ to: string; template: string; data: unknown }> = [];

  async sendEmail(params: SendEmailParams): Promise<Result<EmailResult>> {
    this.sentEmails.push({ to: params.to, template: params.template, data: params.data });
    return { ok: true, data: { messageId: `mock-${Date.now()}`, status: 'sent' } };
  }

  // Test helper
  assertEmailSent(to: string, template: string): void {
    const found = this.sentEmails.find(e => e.to === to && e.template === template);
    if (!found) throw new Error(`Expected email to ${to} with template ${template}`);
  }
}
```

### 13.4 Contract Tests

For webhook-based integrations (Stripe, Resend), we use **contract tests** that verify our webhook handlers correctly parse real webhook payloads:

1. Capture real webhook payloads from Stripe/Resend test mode
2. Save as JSON fixtures in `src/lib/__fixtures__/`
3. Run contract tests that feed fixtures through webhook handlers
4. Assert correct database state changes

This catches vendor payload format changes before they break production.

### 13.5 Circuit Breaker Tests

The Claude AI adapter's circuit breaker is tested with a dedicated state machine test:

```
Test cases:
1. 5 failures in 60s → circuit opens → returns template fallback
2. Circuit open for 30s → half-open → next call attempts real API
3. Half-open success → circuit closes → normal operation resumes
4. Half-open failure → circuit re-opens → back to template fallback
5. Failures across restart → circuit state persisted in Redis
```

---

## 14. Vendor Migration Plan

### 14.1 Migration Difficulty Matrix

The Port/Adapter pattern guarantees that vendor migration requires changing exactly 1 file (the adapter). But some migrations are harder than others due to data portability and webhook schema differences.

| Current Vendor | Migration To | Difficulty | Files Changed | Data Migration | Estimated Effort |
|---------------|-------------|-----------|---------------|----------------|-----------------|
| Claude API | OpenAI / Gemini API | **Medium** | 1 adapter + prompt adjustments | None (stateless) | 2-3 days |
| Better Auth | Clerk / Auth0 | **Medium** | 1 adapter + DB migration script | User records export | 3-5 days |
| Stripe | Paddle / Lemon Squeezy | **Hard** | 1 adapter + webhook handler + DB schema | Subscription migration | 1-2 weeks |
| Resend | SendGrid / Postmark | **Easy** | 1 adapter | None (stateless) | 1 day |
| PostHog | Mixpanel / Amplitude | **Easy** | 1 adapter | Historical data export (optional) | 1 day |
| Sentry | Bugsink / GlitchTip | **Easy** | 1 adapter + config | None (error data is ephemeral) | 1 day |
| Web Push (native) | FCM / OneSignal | **Easy** | 1 adapter | Re-register subscriptions | 2 days |

### 14.2 Lock-In Risk Assessment

| Vendor | Lock-In Risk | Mitigation |
|--------|-------------|------------|
| **Claude API** | Medium -- prompt engineering is model-specific | Keep prompts in separate files; use structured output (JSON mode) that works across models |
| **Better Auth** | Low -- data in own PG database, standard bcrypt hashes | User table follows standard schema; any auth library can read the data |
| **Stripe** | High -- subscription metadata, webhook schemas, customer IDs | Accept this lock-in; Stripe is unlikely to disappear; 3.7% fees are market rate |
| **Resend** | Very Low -- SMTP is universal; react-email templates are portable | Templates work with any email sender; Resend API is simple REST |
| **PostHog** | Very Low -- events are fire-and-forget; analytics data is replaceable | PostHog exports data via API; historical data is nice-to-have, not critical |
| **Sentry** | Very Low -- error tracking is ephemeral by nature | Sentry DSN swap takes 5 minutes |
| **Web Push** | None -- W3C standard, no vendor | VAPID keys are self-generated; no vendor to migrate from |

### 14.3 Vendor Health Monitoring

Quarterly review of each vendor's health signals:

```
For each vendor, check:
1. Last SDK release date (stale if >6 months)
2. Open GitHub issues trend (growing backlog = risk)
3. Pricing changes in last quarter
4. Uptime over last 90 days (Stripe status page, Sentry status page, etc.)
5. Community sentiment (Hacker News, Reddit, X/Twitter)

Action thresholds:
- Yellow: 2+ warning signals → research alternatives
- Red: 3+ warning signals or critical outage → begin migration to pre-identified alternative
```

---

## Appendix A: Decision Log

| # | Decision | Chosen | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| D1 | AI provider | Claude-only 3-tier | 5-layer multi-model | Single SDK, single billing, Korean support, mobile support. 5-layer has 15+ failure modes. |
| D2 | Auth library | Better Auth | Auth.js v5, Clerk, Supabase Auth | Auth.js merged into Better Auth. Clerk = vendor lock-in. Supabase = infra dependency. |
| D3 | Payment | Stripe Checkout | Custom form, PayPal, Paddle | Stripe Checkout offloads PCI. PayPal = 2nd vendor. Best AI training data. |
| D4 | Email | Resend + react-email | SendGrid, SES, Postmark | Free tier covers 8K MAU. JSX templates. Same ecosystem as react-email. |
| D5 | Analytics | PostHog Cloud | Umami self-hosted, Mixpanel | Free tier covers 8K MAU. Zero maintenance. Umami = self-hosting tax. |
| D6 | Error tracking | Sentry Cloud | Bugsink, PostHog errors | Industry standard. Free tier. Best Next.js integration. AI agents know it. |
| D7 | Push notifications | Native Web Push | FCM, OneSignal, Novu | Zero vendor. W3C standard. Single npm package. |
| D8 | API pattern | REST + Zod + Webhooks | MCP, tRPC, GraphQL | 25 years of training data. Every problem solved. Maximum AI agent reliability. |
| D9 | Internal type safety | Zod schemas + Server Actions | tRPC | Same type safety, no framework lock-in. Next.js native. |
| D10 | Abstraction pattern | Simplified Ports/Adapters | Full hexagonal, no abstraction | 1 interface + 1 adapter per vendor. Testable. Replaceable. Not over-engineered. |

---

## Appendix B: What We Intentionally Defer

These are features the aggressive/robust branches proposed that are deferred -- not rejected -- until usage data justifies the maintenance investment.

| Feature | Deferred Until | Trigger to Revisit |
|---------|---------------|-------------------|
| MCP servers for KataGo + game DB | MAU 50K+ | When AI request volume justifies protocol overhead |
| Gemini Nano on-device AI | Korean language support added | Chrome 145+ with Korean Prompt API |
| B2B team billing (Dojang plan) | 10+ inbound requests from Go schools | Validated demand, not speculative |
| Discord bot integration | Active Discord community >500 members | Community exists before building bridge to it |
| Novu notification orchestration | 4+ notification channels active | When native Web Push + email is insufficient |
| 2FA / Passkeys | Month 6+ | When security audit or user demand requires it |
| i18n (next-intl) | MVP + 1 | When Korean + English + Japanese all have users |
| FCM mobile push | Native mobile app development starts | Web Push covers PWA; FCM for native only |

---

## Sources

- [Software Maintenance Costs - 2024 Benchmark Overview (Vention)](https://ventionteams.com/enterprise/software-maintenance-costs)
- [Software Maintenance Cost in 2025 (6amtech)](https://6amtech.com/blog/tips-to-reduce-software-maintenance-cost/)
- [AI Copilot Code Quality: 2025 Data (GitClear)](https://www.gitclear.com/ai_assistant_code_quality_2025_research)
- [How AI Generated Code Compounds Technical Debt (LeadDev)](https://leaddev.com/technical-direction/how-ai-generated-code-accelerates-technical-debt)
- [The Real Cost of API Integration (Netguru)](https://www.netguru.com/blog/api-integration-cost)
- [Anthropic Claude API Pricing 2026 (MetaCTO)](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Claude API Pricing - Official (Anthropic)](https://platform.claude.com/docs/en/about-claude/pricing)
- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog True Cost Deep Dive (MetaCTO)](https://www.metacto.com/blogs/the-true-cost-of-posthog-a-deep-dive-into-pricing-integration-and-maintenance)
- [Sentry Plans & Pricing](https://sentry.io/pricing/)
- [Resend Pricing](https://resend.com/pricing)
- [React Email 5.0 (Resend)](https://resend.com/blog/react-email-5)
- [Stripe Fees 2025 Guide](https://hostmerchantservices.com/articles/stripe-fees-a-pricing-guide-to-stripe/)
- [Stripe Billing Price Increase (Wingback)](https://www.wingback.com/blog/stripe-billing-price-increase)
- [NextAuth.js to Better Auth Migration (DEV)](https://dev.to/pipipi-dev/nextauthjs-to-better-auth-why-i-switched-auth-libraries-31h3)
- [Next.js App Router Authentication Guide 2026 (WorkOS)](https://workos.com/blog/nextjs-app-router-authentication-guide-2026)
- [Better Auth vs NextAuth vs Auth0 (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/)
- [Hexagonal Architecture Pattern (AWS)](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html)
- [Push API Browser Support (Can I Use)](https://caniuse.com/push-api)
- [WWDC 2025 Declarative Web Push (DEV)](https://dev.to/arshtechpro/wwdc-2025-declarative-web-push-dn4)
- [Umami Analytics Self-Hosting Guide (DeepakNess)](https://deepakness.com/blog/self-hosting-umami-analytics/)
- [GitClear Report 2025 Summary (jonas.rs)](https://www.jonas.rs/2025/02/09/report-summary-gitclear-ai-code-quality-research-2025.html)
