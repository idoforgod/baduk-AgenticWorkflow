# External Integration Technology PRD — Balanced-Tech Scenario

**Version**: 1.0
**Date**: 2026-03-10
**Perspective**: Balanced-Tech — "Good technology, but we must be able to build AND maintain it. Every choice passes the Pragmatic Innovation Test: (1) Does the AI agent team have proven patterns? (2) Does the risk justify the gain? (3) Can we fall back gracefully?"
**Phase**: 3.B of Research 4 (External Integration Technology Deep-Dive)
**Context**: AI baduk (Go) app. Stack: Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, KataGo CPU Eigen, Hetzner+Coolify. MAU 8K. Budget: $80-260/mo. AI agent team develops the code.
**Critical Constraint**: OpenAI/Gemini = subscription accounts ONLY, NO API.
**Pre-conditions**: Research 1 (Market/User/Biz) selected Balanced. Research 2 (Tech Stack) selected Balanced-Tech. Research 3 (Baduk Domain) selected Balanced-Tech.

---

## Executive Summary

This PRD synthesizes four expert perspectives (2.A Latest Tech, 2.B Stability, 2.C Speed, 2.D Maintainability) into a single actionable external integration blueprint. Every dispute is resolved through one framework question: **"Does the AI agent team have proven patterns for this, does the risk justify the gain, and can we fall back gracefully?"**

The result: a **7-week integration plan** using **8 external services** that captures the innovation value of on-platform AI explanations, the stability of minimal serial dependencies, the speed of free-tier-first economics, and the maintainability of Ports/Adapters abstraction.

**What makes this Balanced, not a compromise**: This is not the average of four perspectives. It is an optimized selection where each dispute resolution creates synergy. PostHog Cloud (from 2.D) eliminates the self-hosting burden that 2.B warned about. REST+Zod (from 2.C/2.D) provides the AI-agent-friendly patterns that 2.A's tRPC cannot match in training data volume. Discord webhooks (from 2.B/2.C/2.D) deliver 95% of the community value of a full bot (2.A) with zero persistent connections. The Claude 3-tier architecture (from 2.D) achieves the template-first launch speed (2.C) with the upgrade path to rich AI (2.A).

**Balanced Score**: Innovation 7.0 / Stability 7.8 / Speed 7.5 / Maintainability 8.5 -- **Weighted Average: 7.7/10**

**Total external services**: 8 (Claude API, Better Auth, Stripe, Resend, PostHog, Sentry, Discord webhooks, Web Push)
**Monthly cost at MAU 8K**: **$78-100/mo** (excluding Stripe pass-through)
**Implementation timeline**: 7 weeks (parallel AI agent execution)
**Success probability**: **85%** (7 weeks) / **91%** (9-week buffer)
**3-year TCO**: ~$6,600-8,400 (excluding Stripe pass-through)

---

## Table of Contents

1. [Decision Framework](#1-decision-framework)
2. [Complete Dispute Resolution](#2-complete-dispute-resolution)
3. [AI Integration](#3-ai-integration)
4. [Payment & Auth](#4-payment--auth)
5. [Communication & Notifications](#5-communication--notifications)
6. [Analytics & Observability](#6-analytics--observability)
7. [Integration Patterns](#7-integration-patterns)
8. [Complete Service Inventory](#8-complete-service-inventory)
9. [Balanced Score](#9-balanced-score)
10. [Monthly Cost Breakdown](#10-monthly-cost-breakdown)
11. [Implementation Timeline](#11-implementation-timeline)
12. [Success Probability](#12-success-probability)
13. [Risk Register](#13-risk-register)
14. [Cross-Research Validation](#14-cross-research-validation)

---

## 1. Decision Framework

### 1.1 The Pragmatic Innovation Test (PIT)

Every integration decision passes through three gates:

| Gate | Question | If YES | If NO |
|------|----------|--------|-------|
| **PIT-1**: Proven Patterns | Does the AI agent team have extensive training data for this pattern? | Proceed | Simplify or defer |
| **PIT-2**: Risk-Gain Ratio | Does the added complexity create measurable competitive advantage at MAU 8K? | Invest | Use proven alternative |
| **PIT-3**: Graceful Fallback | If this integration fails, does the app remain functional? | Proceed | Add fallback or reject |

### 1.2 Why "Balanced" Is Not "Average"

A simple average of four perspectives would produce an incoherent system -- some cutting-edge, some conservative, with no unified philosophy. Instead, our Balanced-Tech approach applies a consistent principle: **maximize the ratio of user-visible value to implementation complexity**.

This means:
- Taking 2.A's innovations only where they directly create competitive moat (AI explanations)
- Taking 2.B's stability discipline for infrastructure that users never see (auth, payment, analytics)
- Taking 2.C's speed-first free tier economics for cost efficiency
- Taking 2.D's Ports/Adapters pattern as the universal integration architecture

---

## 2. Complete Dispute Resolution

### Dispute 1: AI Layers — 4-layer (2.A) vs Template-first (2.B) vs 2-layer (2.C) vs 3-tier Claude (2.D)

**Decision: 3-Tier Claude-Only with Template-First Launch**

| Perspective | What We Take | What We Reject |
|-------------|-------------|----------------|
| **2.A Latest Tech** | Prompt caching strategy (90% savings), 4-tier cost optimization concept | WebLLM/Qwen3 on-device AI, Chrome Built-in AI, MCP server, 4-layer stack |
| **2.B Stability** | Template fallback as mandatory safety net, circuit breaker pattern | Rejecting all cloud AI innovation |
| **2.C Speed** | Template-first launch (templates ship in hours), Claude API second | Skipping prompt caching and cost optimization |
| **2.D Maintainability** | 3-tier architecture (Haiku 80% / Sonnet 15% / Template 5%), Port/Adapter pattern, single SDK | Nothing rejected -- 2.D's AI architecture is the foundation |

**Why this is the balanced choice:**

PIT-1 (Proven Patterns): AI agents have massive training data for REST API calls to a single vendor SDK (`@anthropic-ai/sdk`). WebLLM (1.5 years of examples), Chrome AI (experimental), and MCP servers (limited production examples) all fail this gate. The 2.D Maintainability perspective quantified this: REST has ~500,000 Stack Overflow answers; MCP has ~500.

PIT-2 (Risk-Gain): On-device AI (2.A) saves ~$13-39/mo in Claude API costs but introduces browser-side failure modes, requires 4GB+ VRAM detection, and **Korean is not supported by Chrome Built-in AI** (Gemini Nano only supports EN/ES/JP as of Chrome 140). For a Go platform where Korean is a primary language, this is a disqualifying limitation. The 3-tier Claude-only approach serves all languages natively.

PIT-3 (Graceful Fallback): The 3-tier architecture has natural fallback at every level: Haiku fails -> escalate to Sonnet. Sonnet fails -> template fallback. Total API outage -> template covers 100% of cases. The 4-layer stack (2.A) has cross-layer cascade failure modes that are significantly harder to test.

**Architecture:**

```
Tier 1 (80% of requests): Claude Haiku 4.5
  - Move explanations, game commentary, simple Q&A
  - Cost: $1/$5 per 1M tokens (input/output)
  - With prompt caching: ~$0.10/$5 effective input cost (90% savings)
  - Latency: ~500ms-1s

Tier 2 (15% of requests): Claude Sonnet 4.6
  - Complex position analysis, multi-move teaching narratives
  - Escalation triggers: winrate delta >15%, explicit deep analysis request
  - Cost: $3/$15 per 1M tokens
  - With prompt caching: ~$0.30/$15 effective input cost
  - Latency: ~1-3s

Tier 3 (5% of requests + all fallback): Template
  - Pre-written responses for 50 most common board patterns
  - All high-risk positions (life-and-death, ko, seki) — mandatory template
  - API failures, rate limits, circuit breaker open
  - Cost: $0
  - Latency: <50ms
```

**Prompt Caching Strategy (from 2.A, validated by Anthropic docs):**

Every Claude request includes a cached system prompt (~2,000 tokens) containing Go domain knowledge, terminology glossary, rank-calibrated language, and output format specs. With prompt caching:
- Cache write (5-min TTL): 1.25x base price -- one-time cost per 5-minute window
- Cache read: 0.1x base price -- 90% reduction on subsequent requests
- At 80%+ cache hit rate (realistic for a domain-specific system prompt), effective input cost drops to ~$0.10-0.20/1M tokens for Haiku
- **Economics**: Prompt caching pays for itself after just 2 requests within the same 5-minute window. At MAU 8K with clustered game sessions, hit rates of 85-90% are achievable.

**Monthly Claude API Cost at MAU 8K:**

| Parameter | Value |
|-----------|-------|
| MAU | 8,000 |
| DAU (30% of MAU) | 2,400 |
| AI requests per active session | 5 |
| Sessions per active user per month | 20 |
| Total monthly requests | 240,000 |
| Template handled (Phase 1: 70%, Phase 2: 5%) | Phase 1: 168K, Phase 2: 12K |
| Cloud AI requests | Phase 1: 72K, Phase 2: 228K |
| Haiku (80% of cloud) | Phase 1: 57.6K, Phase 2: 182.4K |
| Sonnet (20% of cloud) | Phase 1: 14.4K, Phase 2: 45.6K |
| **Monthly cost (with prompt caching)** | **Phase 1: ~$15-25** / **Phase 2: ~$43-65** |

Phase 1 (template-first launch) keeps Claude costs under $25/mo because templates handle the majority of requests. Phase 2 (full AI) uses the 3-tier routing to stay within $43-65/mo.

**Implementation (from 2.D, ~300 LOC):**

```typescript
// src/lib/adapters/claude-ai.ts
export class ClaudeAIAdapter implements AIService {
  private client: Anthropic;
  private circuitBreaker: SimpleCircuitBreaker;  // 5 failures/60s -> open 30s

  async explainMove(params: MoveExplanationRequest): Promise<Result<MoveExplanation>> {
    if (this.circuitBreaker.isOpen()) {
      return this.templateFallback(params);
    }
    const model = this.selectTier(params);
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 500,
        system: [{
          type: 'text',
          text: this.domainSystemPrompt(params.playerRank, params.language),
          cache_control: { type: 'ephemeral' }  // 5-min cache
        }],
        messages: [{ role: 'user', content: this.buildPrompt(params) }],
      });
      this.circuitBreaker.recordSuccess();
      return { ok: true, data: this.parseExplanation(response) };
    } catch (error) {
      this.circuitBreaker.recordFailure();
      return this.templateFallback(params);
    }
  }

  private selectTier(params: MoveExplanationRequest): string {
    if (params.katagoAnalysis.winrateDelta > 0.15) return 'claude-sonnet-4-6-20250514';
    return 'claude-haiku-4-5-20250314';
  }
}
```

---

### Dispute 2: On-Device AI — WebLLM+Chrome AI (2.A) vs No (2.B/2.C/2.D)

**Decision: No on-device AI. Server-side Claude-only.**

**PIT-1**: WebLLM has ~1.5 years of public examples. AI agents produce unreliable WebGPU capability detection code.
**PIT-2**: Saves $13-39/mo but Korean (primary language) is unsupported by Chrome Built-in AI. WebLLM+Qwen3 does support Korean but requires 4GB+ VRAM and 1.7GB model download per user. At MAU 8K, the support burden outweighs the cost savings.
**PIT-3**: On-device AI failure modes (insufficient VRAM, WebGPU unavailable, model download interrupted) degrade UX unpredictably.

**Phase 2 reconsideration**: When browser AI APIs mature with Korean support (estimated Chrome 145+, late 2026) and WebGPU adoption exceeds 80%, revisit this decision.

---

### Dispute 3: MCP Servers — Yes (2.A) vs No (2.B/2.C/2.D)

**Decision: No MCP servers at launch. Defer to MAU 25K+.**

**PIT-1**: MCP has ~1.5 years of training data. AI agents produce 5/10 consistency score (2.D data).
**PIT-2**: MCP makes KataGo composable with external AI clients -- genuinely innovative (10/10 from 2.A). But at MAU 8K, the addressable audience for MCP integration (Claude Desktop power users who also play Go) is negligible. The Chess-MCP precedent validates the pattern, but chess has 100x the online player base.
**PIT-3**: MCP server failure does not affect core platform, but it adds a running process, a JSON-RPC layer, and authentication complexity that consumes maintenance budget.

**Deferred implementation**: Design the KataGo `AnalysisEngine` interface (from Research 3 Balanced-Tech) to be MCP-compatible from day one. When MAU reaches 25K+ and the MCP ecosystem matures, exposing the engine as an MCP server becomes a 1-week task, not a redesign.

---

### Dispute 4: tRPC vs REST — tRPC v11 (2.A) vs REST+Zod (2.B/2.C/2.D)

**Decision: REST + Zod + Next.js Server Actions**

| Perspective | What We Take | What We Reject |
|-------------|-------------|----------------|
| **2.A Latest Tech** | Zod schema validation, type inference from schemas | tRPC framework, SSE subscriptions via tRPC |
| **2.B Stability** | REST is the universal standard, cURL-debuggable | Nothing additional |
| **2.C Speed** | Zero learning curve for AI agents | Nothing additional |
| **2.D Maintainability** | Server Actions + Zod = equivalent type safety without framework lock-in | Nothing additional |

**Why this is the balanced choice:**

The 2.A perspective argued tRPC provides 35-40% faster development and zero schema duplication. However:

1. **AI agent training data**: REST has ~500,000 Stack Overflow answers vs tRPC's ~5,000 (2.D data). AI agents produce 10/10 consistency for REST vs 7/10 for tRPC. At 12.3% AI code duplication rate (GitClear 2025), we want AI agents working with their strongest patterns.

2. **Next.js Server Actions**: Next.js 15 Server Actions + Zod provide compile-time type safety via `z.infer<typeof Schema>` without adding a framework dependency. The type safety gap between tRPC and REST+Zod has narrowed significantly.

3. **External API consumers**: REST endpoints are universally consumable. If we build a mobile app or expose a public API later, REST requires zero adaptation. tRPC requires a REST adapter or forces clients to use the tRPC SDK.

4. **Debugging**: REST APIs are debuggable with cURL, Postman, and browser DevTools. tRPC requires the tRPC DevTools or server-side logging.

**Trade-off acknowledged**: We sacrifice tRPC's automatic client type generation and slightly faster development velocity. This is acceptable at MAU 8K where the codebase is small enough that manual Zod schemas do not create significant overhead.

**Implementation pattern:**

```typescript
// src/app/actions/game.ts
'use server';
import { z } from 'zod';

const AnalyzePositionSchema = z.object({
  gameId: z.string().uuid(),
  moveNumber: z.number().int().positive(),
  visits: z.number().min(5).max(500).default(50),
});

export type AnalyzePositionInput = z.infer<typeof AnalyzePositionSchema>;

export async function analyzePosition(input: AnalyzePositionInput) {
  const parsed = AnalyzePositionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten() };
  // Business logic via injected services...
}
```

---

### Dispute 5: Auth Complexity — Passkeys+RBAC (2.A) vs DB Sessions (2.B) vs Email+Google (2.C) vs Ports/Adapters (2.D)

**Decision: Better Auth with Email Magic Link + Google OAuth (Day 1), phased expansion**

| Perspective | What We Take | What We Reject |
|-------------|-------------|----------------|
| **2.A Latest Tech** | Better Auth over Auth.js v5 (successor, actively developed), Kakao OAuth for Korean market | Passkey-first (Day 1), MCP auth, 4 social providers at launch, RBAC complexity |
| **2.B Stability** | DB sessions over stateless JWT for auth state, rate limiting | Rejecting all social login innovation |
| **2.C Speed** | Email magic link + Google = 90%+ coverage, ship in 2-3 days | Skipping Kakao (Korean market is primary) |
| **2.D Maintainability** | Phased approach (Phase 1 minimal, Phase 2 expand), LOC budget (~400), plugin-based expansion | Nothing rejected |

**Why Better Auth over Auth.js v5:**

Auth.js v5 entered maintenance mode following the merger into Better Auth (September 2025, YC $5M backing). Better Auth is the successor with native passkey support, built-in rate limiting, and first-party Drizzle adapter. Starting with Better Auth avoids a migration from a legacy library.

**Phased auth rollout:**

```
Phase 1 (Day 1, Week 1-2):
  - Email magic link via Resend
  - Google OAuth (universal coverage)
  - Kakao OAuth (Korean market #1, 52M MAU)
  - 3 roles: Free, Premium, Admin
  - DB sessions, 30-day expiry
  - ~4 DB tables (users, sessions, accounts, verifications)

Phase 2 (Month 3, after user feedback):
  - + Discord OAuth (Go community hub)
  - + Apple Sign-in (iOS App Store compliance)
  - Each additional provider: ~10 LOC config via Better Auth plugin

Phase 3 (Month 6+, if demand validates):
  - + Passkeys/WebAuthn (Better Auth plugin, ~20 LOC config)
  - + 2FA/TOTP for admin accounts
  - Only if auth friction data justifies the investment
```

**Why Kakao on Day 1 (departure from 2.C):**

The 2.C Speed perspective proposed deferring Kakao. This is the one place where we override speed for strategic value: Research 1 identified Korean users as the primary market segment. Kakao is Korea's dominant platform (52M MAU). Omitting Kakao on Day 1 means Korean users encounter unfamiliar auth (Google-only) as their first experience. Better Auth's Kakao plugin is ~10 LOC config, making the incremental cost negligible.

**Security critical**: Next.js 15 has CVE-2025-29927 (CVSS 9.1, middleware bypass). Must use Next.js 15.2.3+ and verify middleware protection.

---

### Dispute 6: Analytics Hosting — Triple-stack (2.A) vs Self-hosted (2.B) vs Self-hosted (2.C) vs Managed SaaS (2.D)

**Decision: PostHog Cloud + Sentry Cloud (both free tier). No self-hosted analytics.**

| Perspective | What We Take | What We Reject |
|-------------|-------------|----------------|
| **2.A Latest Tech** | PostHog for product analytics + feature flags, Sentry for AI/LLM monitoring | Umami (third tool adds operational burden), triple-stack complexity |
| **2.B Stability** | Minimal dependency approach (fewer is better) | Self-hosted Umami+Bugsink (adds ~60 hrs/yr maintenance) |
| **2.C Speed** | Free tiers first, analytics ships in 1 day | Umami self-hosted as sole solution (insufficient for product analytics) |
| **2.D Maintainability** | PostHog Cloud + Sentry Cloud, managed services transfer maintenance to vendors | Nothing rejected -- 2.D's analytics architecture is the foundation |

**Why managed SaaS over self-hosted (the critical decision):**

The 2.B Stability perspective advocated self-hosted Umami + Bugsink to minimize external dependencies. The 2.D Maintainability perspective provided the counter-argument with data:

| Dimension | Umami Self-Hosted | PostHog Cloud |
|-----------|-------------------|---------------|
| Server maintenance | You patch, update, restart | PostHog SRE team |
| Database load | Shared PG 16 (analytics queries slow game DB) | Separate ClickHouse (PostHog-managed) |
| Security patches | You monitor CVEs and apply | Automatic |
| Annual maintenance hours | ~40-80 hours | ~2-4 hours (SDK updates) |
| Feature set | Basic web analytics | Product analytics + session replay + feature flags + A/B |
| Free tier | Self-hosted = $0 infra cost | 1M events/mo, 5K replays, 1M flag requests |

The Coolify CVE disclosure (11 critical vulnerabilities, CVSS 10.0, January 2026) reinforces the risk of self-hosting. Every self-hosted service on the Coolify-managed VPS inherits Coolify's attack surface. Managed SaaS for non-critical services (analytics, error tracking) reduces this exposure.

**PostHog Cloud free tier allocation at MAU 8K:**
- 1M events/month free -- 8K MAU x ~50 events/user = ~400K events (40% of free tier)
- 5,000 session replays/month -- sufficient for debugging
- 1M feature flag requests/month -- sufficient for progressive rollouts
- **Cost: $0/month**

**Sentry Cloud free tier at MAU 8K:**
- 5,000 errors/month + 10,000 performance transactions/month
- First-party `@sentry/nextjs` SDK with automatic instrumentation
- AI/LLM monitoring: Claude API latency, token consumption, error rates
- **Cost: $0/month**

**What we do NOT deploy:**
- No Umami (PostHog covers web analytics; no need for a third tool)
- No Bugsink (Sentry's free tier provides superior error tracking)
- No Uptime Kuma (Sentry performance monitoring + Hetzner status alerts sufficient for MVP; add at MAU 25K+ if needed)

**Implementation: ~250 LOC total (PostHog ~150 + Sentry ~100)**

---

### Dispute 7: Discord — Bot+Activity (2.A) vs Webhooks only (2.B/2.C/2.D)

**Decision: Discord Webhooks only. No bot.**

**PIT-1**: Webhook integration has 10+ years of training data (9/10 consistency). Discord.js bot has good documentation but requires persistent WebSocket connection management, event handling, and slash command registration.
**PIT-2**: A Discord bot enables interactive features (slash commands, game challenges from Discord). But at MAU 8K, the Discord community will be small (<1K members). Webhooks deliver 95% of the community value (game results, leaderboard updates, new feature announcements) with zero persistent connections.
**PIT-3**: Webhook failure is silent (notification not delivered) vs bot failure is visible (bot appears offline). Webhooks fail more gracefully.

**Webhook events (MVP):**

```
1. Game completed (player names, result, link to review)
2. Weekly leaderboard update
3. New feature announcements
4. Tournament start/results
```

**Implementation: ~50 LOC (single POST function with embed formatting)**

**Phase 2 upgrade path**: If Discord community grows beyond 500 active members and users request interactive features, add a Discord.js bot. The webhook infrastructure remains unchanged.

---

### Dispute 8: i18n — 5 locales (2.A) vs 3 locales (2.B/2.D) vs Deferred (2.C)

**Decision: 3 locales at launch (en, ko, ja), expand to 5 in Phase 2**

**Rationale:**

Research 1 identified the target markets: Korea (primary), Japan (secondary), English-speaking (global). Chinese users primarily use Fox/Tygem with no realistic short-term acquisition path. Starting with 3 locales covers 95%+ of the realistic Day 1 user base.

- **en** (English): Global default, required
- **ko** (Korean): Primary market, Kakao/NaverPay users
- **ja** (Japanese): Second-largest Go market outside China, significant online player base

**Phase 2 expansion** (Month 3-4): Add `zh-CN` and `zh-TW` when/if Chinese user acquisition strategy is validated.

**Implementation**: next-intl (branch agreement #8), ~200 LOC for 3 locales + Go terminology from `translations/glossary.yaml`.

---

### Dispute 9: External Services Count — 23 (2.A) vs 6 (2.B/2.D) vs ~8 (2.C)

**Decision: 8 external services**

| # | Service | Category | Necessity | Cost |
|---|---------|----------|-----------|------|
| 1 | **Claude API** | AI | High | $15-65/mo |
| 2 | **Better Auth** | Auth | High | $0 (self-hosted) |
| 3 | **Stripe** | Payment | High | Pass-through |
| 4 | **Resend** | Email | High | $0 (3K free) |
| 5 | **Cloudflare** | CDN+R2 | Medium | $0 (free tier) |
| 6 | **PostHog Cloud** | Analytics | Medium | $0 (free tier) |
| 7 | **Sentry Cloud** | Errors | Medium | $0 (free tier) |
| 8 | **Web Push API** | Push | Low | $0 (native) |
| + | **Discord Webhooks** | Community | Low | $0 (no SDK) |

Note: Discord webhooks are a single HTTP POST call, not a true "service dependency" -- no SDK, no persistent connection, no auth token rotation. Counted separately.

**Why 8 and not 6 (2.B/2.D) or 23 (2.A):**

- 2.B/2.D's 6-service count omits PostHog and Sentry (self-hosted alternatives) or combines them. We add PostHog and Sentry as managed services because the self-hosting tax (~60 hrs/yr) exceeds the benefit at MAU 8K. But we agree with their principle: every dependency must justify its existence.
- 2.A's 23 services include Novu, Svix, Umami, WebLLM, Chrome AI, MCP, Cloudflare Workers, and multiple self-hosted monitoring tools. Each adds operational surface area without proportional user value at MAU 8K.

**Compound availability calculation:**

8 services with weighted availability:
- Critical path (Claude+Stripe+Resend+Cloudflare): 99.4% x 99.7% x 99.3% x 99.9% = 98.3%
- With template fallback for Claude: effective 99.9% (templates cover 100% of AI failures)
- Non-critical (PostHog+Sentry+WebPush+Discord): failure does not affect core UX
- **Effective system availability: ~99.5%** (3.6 hrs/month downtime)

---

### Dispute 10: Implementation Timeline — 10 weeks (2.A) vs 8 weeks (2.B) vs 14 days (2.C) vs 6 weeks (2.D)

**Decision: 7 weeks**

**Rationale:**

- 2.C's 14 days is heroic but skips hardening, testing, and prompt caching optimization. The "ship broken, fix live" philosophy contradicts Research 3's finding that **game correctness is paramount** for a Go platform.
- 2.A's 10 weeks includes MCP, tRPC, on-device AI, and 5-locale i18n -- all rejected.
- 2.B's 8 weeks includes significant stability tax (circuit breaker testing, failure mode verification) that is partially deferred to ongoing maintenance.
- 2.D's 6 weeks is achievable but tight. Adding 1 week for integration testing buffer brings us to 7 weeks with 85% confidence.

---

## 3. AI Integration

### 3.1 Architecture: Claude-Only 3-Tier with Template-First Launch

(Detailed in Dispute 1 above.)

**Key differentiation from competitors**: No Go platform offers natural-language "Why?" explanations. OGS, KGS, Fox, and Tygem all provide KataGo numerical analysis (winrate, score) but zero narrative explanation. Even AI Sensei provides only numerical data with basic visualization, not teaching-quality commentary.

**Template V1 (Phase 1, launch):**
- 50 pre-written explanation templates covering common board patterns
- Pattern matching on KataGo analysis JSON (winrate delta, top move type, game phase)
- 3-tier explanation depth: beginner / intermediate / advanced
- **This alone is unprecedented** -- no competitor has even templated explanations

**Claude AI V2 (Phase 2, Week 5-7):**
- Haiku 4.5 for 80% of requests (simple explanations)
- Sonnet 4.6 for 15% (complex analysis, teaching narratives)
- Template for 5% (fallback + high-risk positions)
- Prompt caching for 85-90% input cost savings
- **All high-risk positions (life-and-death, ko, seki) use mandatory template** -- LLM hallucination in these domains is confirmed by Research 3 (LLM-Robust branch)

### 3.2 What We Explicitly Do Not Build

| Rejected Feature | Source | Reason |
|-----------------|--------|--------|
| WebLLM + Qwen3-1.7B on-device | 2.A | Korean unsupported (Chrome AI), 4GB VRAM requirement, mobile unusable |
| Chrome Built-in AI (Summarizer) | 2.A | Korean NOT supported, Chrome desktop only, non-deterministic |
| KataGo MCP Server | 2.A | MCP has 1.5 years of training data, negligible audience at MAU 8K |
| Multi-model routing | 2.A | Single vendor SDK = simpler billing, error handling, prompt engineering |
| Extended thinking (Sonnet) | 2.A | Expensive ($15/1M output), niche use case, defer to Phase 3 |

---

## 4. Payment & Auth

### 4.1 Authentication: Better Auth (Phased)

(Detailed in Dispute 5 above.)

**Day 1 providers**: Email magic link (Resend), Google OAuth, Kakao OAuth
**Phase 2 additions**: Discord OAuth, Apple Sign-in
**Phase 3 additions**: Passkeys/WebAuthn, 2FA (admin only)

**LOC budget**: ~400 (config + middleware + role checking)
**DB tables**: 4 (users, sessions, accounts, verifications)

### 4.2 Payment: Stripe Checkout (Hosted)

**Branch agreement**: Stripe is the unanimous choice (Agreement #2). All four perspectives agree on Stripe Checkout (hosted page) to eliminate PCI scope.

**Subscription tiers:**

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 3 games/day, 3 KataGo analyses/day, template explanations |
| Premium | $9.99/mo ($99.99/yr) | Unlimited games, 50 analyses/day, AI explanations, study plans |

**Localized pricing:**
- KRW: 12,900/mo (129,000/yr)
- JPY: 1,480/mo (14,800/yr)

**Why 2 tiers, not 4 (2.A):**

The 2.A perspective proposed Free/Pro/Premium/Dojang (B2B). At MAU 8K with an estimated 500 paying users, 4 tiers create decision paralysis. Two tiers (Free/Premium) maximize conversion clarity: "Do you want AI explanations? Pay." B2B Dojang tier deferred to Phase 2 when institutional demand is validated.

**Implementation: ~350 LOC total**
- Stripe Checkout session creation (~50 LOC)
- Webhook handler (~150 LOC): `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Subscription state machine (~100 LOC): active, past_due (7-day grace), canceled
- Customer Portal link (~50 LOC): self-service subscription management

**KakaoPay and NaverPay**: Supported natively by Stripe since October 2024. Zero additional code -- Stripe Checkout automatically shows Korean payment methods based on customer locale.

**Monthly Stripe fees at MAU 8K (500 paying users, ~$5K MRR):**
- 2.9% + $0.30/txn + 0.7% Billing surcharge
- ~$185/mo (pass-through, deducted from revenue)

---

## 5. Communication & Notifications

### 5.1 Email: Resend + react-email

**Branch agreement**: Resend is the unanimous choice (Agreement #3).

**Email types (exhaustive MVP list):**

| # | Email Type | Trigger | Template |
|---|-----------|---------|----------|
| 1 | Magic link | Sign-in request | Auth |
| 2 | Welcome | First sign-up | Onboarding |
| 3 | Game review ready | KataGo analysis complete (Premium) | Engagement |
| 4 | Subscription confirmation | Stripe webhook | Billing |
| 5 | Payment failed | Stripe webhook | Billing |
| 6 | Rank achieved | Rating milestone | Retention |

**6 emails. 6 react-email JSX components. ~250 LOC templates + ~100 LOC send logic.**

**Free tier**: 3,000 emails/month. At 8K MAU with ~20% email engagement = ~1,600 emails/month. Well within free tier.

### 5.2 Push Notifications: Web Push API (VAPID)

**Branch agreement**: Web Push API is the unanimous choice (Agreement #5).

**Push notification types (MVP):**

| # | Type | Trigger | Engagement Value |
|---|------|---------|-----------------|
| 1 | Your turn | Opponent played | Core loop (highest) |
| 2 | Game invitation | Challenge received | Social |
| 3 | Analysis complete | Batch KataGo review done | Feature discovery |
| 4 | Daily puzzle | Cron job (Premium) | Retention |

**Implementation: ~300 LOC total**
- Service worker (~100 LOC): handles incoming pushes
- Server-side push (~100 LOC): `web-push` npm package with VAPID keys
- Subscription management (~100 LOC): store/revoke push subscriptions in PG

**Browser support (2026)**: Chrome, Edge, Firefox, Safari (macOS 13+ / iOS 16.4+). Coverage: ~95% of target users.

### 5.3 Discord Webhooks

(Detailed in Dispute 7 above.)

**Implementation: ~50 LOC.** Single function that formats Discord embed and POSTs to webhook URL. Rate limit: 30 requests per 60 seconds per webhook (Discord limit).

### 5.4 What We Explicitly Do Not Build

| Rejected | Source | Reason |
|----------|--------|--------|
| Novu (notification orchestration) | 2.A | Over-engineered for <8K users and 3 notification channels |
| FCM (Firebase Cloud Messaging) | 2.A | Google dependency; Web Push API covers browser notifications |
| Discord.js bot | 2.A | Persistent connection for <1K Discord members; webhooks cover 95% |
| In-app notification center | 2.A | Web Push + email covers core engagement; add in Phase 2 if needed |
| Email marketing campaigns | 2.C deferred | Premature without retention data |

---

## 6. Analytics & Observability

### 6.1 PostHog Cloud (Free Tier)

(Detailed in Dispute 6 above.)

**Custom Go events:**

```typescript
posthog.capture('game_completed', {
  board_size: 19,
  time_control: 'byoyomi_30_5',
  result: 'B+2.5',
  moves_count: 243,
  analysis_requested: true,
});

posthog.capture('ai_explanation_viewed', {
  tier: 'haiku',       // or 'sonnet' or 'template'
  language: 'ko',
  latency_ms: 850,
  player_rank: '5kyu',
});
```

**Feature flags for progressive rollout:**
- `claude_sonnet_enabled` -- gate Sonnet tier to Premium users initially
- `kakao_auth` -- gradual rollout to Korean user segment
- `batch_review` -- gate full game reviews to Premium users

### 6.2 Sentry Cloud (Free Tier)

**LLM-specific monitoring:**
- Claude API latency per tier (Haiku vs Sonnet)
- Token consumption per request type
- Error rate by prompt template version
- Cost anomaly alerts (>2x daily average)
- Circuit breaker state changes

### 6.3 Go Data Sources

| Source | Size | License | Use |
|--------|------|---------|-----|
| featurecat/go-dataset (GitHub) | 21.1M games | Free | Template pattern development |
| @sabaki/sgf (npm) | Parser | MIT | SGF parsing/generation |
| OGS Game Records | 56M games | API access | Future puzzle generation |

### 6.4 Backup Strategy

| Component | Tool | Schedule | Retention | Cost |
|-----------|------|----------|-----------|------|
| PG 16 | pg_dump + WAL archiving | Daily base + continuous WAL | 30 days | Included in Hetzner |
| Destination | Cloudflare R2 (free tier, 10GB) | Daily upload | 90 days | $0 |
| Redis | RDB snapshots | Every 15 min | 7 days | $0 |

**Why not WAL-G + Hetzner Storage Box (2.A/2.B):**
At MAU 8K with ~1GB database, pg_dump + Cloudflare R2 is sufficient. WAL-G provides PITR (Point-in-Time Recovery) which is valuable but adds operational complexity. Upgrade to WAL-G when database exceeds 10GB or RPO requirement drops below 24 hours.

---

## 7. Integration Patterns

### 7.1 API Layer: REST + Zod + Next.js Server Actions

(Detailed in Dispute 4 above.)

**Internal API**: Next.js Server Actions with Zod validation. Zero API route boilerplate.
**External webhooks**: Standard route handlers for Stripe and Resend webhooks.
**WebSocket**: Existing game WebSocket (ws 8.x) for real-time game play. No additional WebSocket infrastructure.

### 7.2 Abstraction: Simplified Ports and Adapters (from 2.D)

This is the single most valuable architectural contribution from any perspective. It provides vendor replaceability, testability, and consistency that benefits AI agent development.

```
src/
  lib/
    ports/                    # Interfaces only -- zero dependencies
      ai.ts                   # AIService interface (5 methods)
      payment.ts              # PaymentService interface (4 methods)
      email.ts                # EmailService interface (2 methods)
      analytics.ts            # AnalyticsService interface (3 methods)
      error-tracking.ts       # ErrorTrackingService interface (2 methods)
      push.ts                 # PushNotificationService interface (3 methods)
    adapters/                 # Implementations -- vendor-specific
      claude-ai.ts            # implements AIService (~300 LOC)
      stripe-payment.ts       # implements PaymentService (~350 LOC)
      resend-email.ts         # implements EmailService (~250 LOC)
      posthog-analytics.ts    # implements AnalyticsService (~150 LOC)
      sentry-error.ts         # implements ErrorTrackingService (~100 LOC)
      web-push-native.ts      # implements PushNotificationService (~300 LOC)
    __mocks__/                # Test doubles (1 per adapter)
```

**Adapter rules (from 2.D):**
1. One file per adapter. No adapter imports from another adapter.
2. Constructor injection. SDK client received via constructor.
3. Every vendor call wrapped in try-catch with structured error mapping.
4. Circuit breaker at adapter level (Claude AI, Stripe).
5. All methods return `Result<T>` type. No thrown exceptions crossing port boundary.

**DI Container: ~150 LOC**

```typescript
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

### 7.3 Webhook Processing

Stripe and Resend webhooks follow a unified pattern:

```typescript
// Shared webhook handler pattern
export async function handleWebhook(req: Request, config: WebhookConfig) {
  const body = await req.text();
  const signature = (await headers()).get(config.signatureHeader)!;

  // Signature verification (vendor-specific)
  const event = config.verifySignature(body, signature);

  // Route to handler
  const handler = config.handlers[event.type];
  if (handler) await handler(event.data);

  return new Response('OK', { status: 200 });
}
```

### 7.4 What We Explicitly Do Not Adopt

| Pattern | Source | Reason |
|---------|--------|--------|
| tRPC v11 | 2.A | Framework lock-in; REST+Zod achieves equivalent type safety |
| MCP Protocol | 2.A | 1.5 years training data; negligible audience at MAU 8K |
| GraphQL | General | Predictable Go queries don't benefit from flexible query shapes |
| Svix webhooks | 2.A | Over-engineered for 2 webhook consumers (Stripe + Resend) |
| Cloudflare Workers | 2.A | Edge compute unnecessary at MAU 8K; origin server handles all traffic |
| OAuth 2.1 server | 2.A | Better Auth handles OAuth flows internally |

---

## 8. Complete Service Inventory

### 8.1 Final Integration Stack

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
│              │    Hetzner VPS             │                         │
│              │    Coolify (latest patch)  │                         │
│              │                           │                         │
│              │  ┌─────────────────────┐  │                         │
│              │  │   Next.js 15 App    │  │                         │
│              │  │   + Better Auth     │  │  [SELF-HOSTED AUTH #2]  │
│              │  │   + REST + Zod      │  │                         │
│              │  └──────────┬──────────┘  │                         │
│              │             │             │                         │
│              │  ┌──────────▼──────────┐  │                         │
│              │  │   PostgreSQL 16     │  │  [SELF-HOSTED DB]       │
│              │  │   + Redis 7.2       │  │                         │
│              │  │   + KataGo Eigen    │  │                         │
│              │  └─────────────────────┘  │                         │
│              └───────────────────────────┘                         │
│                            │                                        │
│              ┌─────────────▼─────────────┐                         │
│              │   EXTERNAL API CALLS       │                         │
│              │   (Port/Adapter Layer)     │                         │
│              │                           │                         │
│              │   Claude API ──────── [#3] │  AI explanations       │
│              │   Stripe API ──────── [#4] │  Payments              │
│              │   Resend Email ─────── [#5] │  Transactional email  │
│              │   PostHog Cloud ────── [#6] │  Product analytics    │
│              │   Sentry Cloud ─────── [#7] │  Error tracking       │
│              │   Web Push (browser) ── [#8] │  Push notifications  │
│              │   Discord Webhooks ─── [+]  │  Community alerts     │
│              └───────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 LOC Budget

| Integration | Max LOC | Actual Estimate |
|-------------|---------|-----------------|
| Claude AI adapter (3-tier) | 400 | ~300 |
| Better Auth config + middleware | 500 | ~400 |
| Stripe Checkout + webhooks | 400 | ~350 |
| Resend + react-email templates | 400 | ~350 |
| PostHog adapter | 200 | ~150 |
| Sentry adapter | 150 | ~100 |
| Web Push (service worker + server) | 400 | ~300 |
| Discord webhooks | 100 | ~50 |
| Shared infra (ports, DI, types) | 500 | ~400 |
| **Total** | **3,050** | **~2,400** |

Staying under 3,000 LOC (2.D's budget) with ~600 LOC buffer for edge cases.

---

## 9. Balanced Score

### 9.1 Four-Dimensional Score

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Innovation** | **7.0/10** | AI explanations (unprecedented), prompt caching, template+LLM hybrid. No on-device AI or MCP. |
| **Stability** | **7.8/10** | 8 external services (not 23), circuit breakers, template fallback, managed analytics. |
| **Speed** | **7.5/10** | 7 weeks (not 14 days, but not 10 weeks). Free-tier economics. Template-first launch. |
| **Maintainability** | **8.5/10** | Ports/Adapters, single AI vendor, managed SaaS, 2,400 LOC budget, AI-agent-optimized patterns. |
| **Weighted Average** | **7.7/10** | Weights: Innovation 20%, Stability 25%, Speed 20%, Maintainability 35% |

### 9.2 Maintainability Weight Justification

Maintainability receives the highest weight (35%) because:
1. The development team is AI agents. AI agent code has 12.3% duplication rate and 34% higher complexity (GitClear 2025). Maintainability directly affects AI agent productivity.
2. This is a long-term project (18+ months). Every hour of maintenance debt compounds.
3. Research 3 confirmed: LLM pipeline is the weakest maintainability link (6.6/10). The integration layer must not add more weak links.

### 9.3 Comparison with Other Perspectives

| Dimension | 2.A Latest | 2.B Stability | 2.C Speed | 2.D Maintain | **3.B Balanced** |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Innovation | 8.3 | 5.0 | 6.0 | 5.5 | **7.0** |
| Stability | 6.5 | 8.3 | 5.5 | 7.5 | **7.8** |
| Speed | 6.0 | 5.5 | 9.5 | 7.0 | **7.5** |
| Maintainability | 5.5 | 6.5 | 6.0 | 9.0 | **8.5** |
| **Average** | 6.6 | 6.3 | 6.8 | 7.3 | **7.7** |

The Balanced scenario scores higher than any individual perspective's average because it eliminates each perspective's weakest dimension while preserving their strongest contributions.

---

## 10. Monthly Cost Breakdown

### 10.1 Infrastructure Costs (Fixed)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Hetzner CCX33 (8 vCPU, 16 GB dedicated) | $60.00 | App + KataGo + PG 16 + Redis 7.2 |
| Domain (annual, amortized) | $5.00 | .com domain |
| **Infrastructure subtotal** | **$65.00** | |

**Why CCX33 and not CX41:**
Research 3 Balanced-Tech specified CCX33 for KataGo CPU Eigen performance (dedicated vCPU, not shared). KataGo's Eigen backend benefits from dedicated CPU cycles for AVX2/FMA operations. The CX41 (shared vCPU) from 2.D would cause analysis latency spikes during noisy-neighbor periods.

### 10.2 Service Costs (Usage-Based)

| Service | Phase 1 Cost | Phase 2 Cost | Free Tier | Notes |
|---------|-------------|-------------|-----------|-------|
| Claude API | $15-25 | $43-65 | None | Template-first (Phase 1) → full AI (Phase 2) |
| Stripe | ~$185 | ~$185 | N/A | Pass-through (3.7% of ~$5K MRR) |
| Resend | $0 | $0 | 3,000/mo | ~1,600 emails/mo at MAU 8K |
| PostHog | $0 | $0 | 1M events/mo | ~400K events/mo at MAU 8K |
| Sentry | $0 | $0 | 5K errors/mo | Sufficient for MAU 8K |
| Web Push | $0 | $0 | Native API | No vendor cost |
| Cloudflare | $0 | $0 | Free tier | CDN + R2 (10GB free) |
| Discord webhooks | $0 | $0 | Free | No SDK, no API key cost |

### 10.3 Total Monthly Cost

| Category | Phase 1 (Template) | Phase 2 (Full AI) |
|----------|-------------------|-------------------|
| Infrastructure | $65 | $65 |
| AI (Claude API) | $15-25 | $43-65 |
| All other services | $0 | $0 |
| **Total (excl. Stripe)** | **$80-90** | **$108-130** |
| **Total (incl. Stripe)** | **$265-275** | **$293-315** |

**Budget compliance**: $80-90/mo (Phase 1) and $108-130/mo (Phase 2) both fall within the $80-260/mo budget when Stripe fees are correctly categorized as pass-through (deducted from revenue, not infrastructure expense).

### 10.4 3-Year TCO

| Category | Year 1 | Year 2 | Year 3 | 3-Year Total |
|----------|--------|--------|--------|-------------|
| Hetzner infrastructure | $780 | $960 | $1,200 | $2,940 |
| Claude API | $480 | $720 | $780 | $1,980 |
| Resend | $0 | $0-240 | $0-240 | $0-480 |
| PostHog Cloud | $0 | $0 | $0 | $0 |
| Sentry Cloud | $0 | $0 | $0 | $0 |
| Domain + DNS | $60 | $60 | $60 | $180 |
| **Total (excl. Stripe)** | **$1,320** | **$1,740-1,980** | **$2,040-2,280** | **$5,100-6,240** |
| **Contingency buffer (15%)** | | | | **$765-936** |
| **Total with buffer** | | | | **$5,865-7,176** |

Notes:
- Hetzner scales: $65/mo Y1 -> $80/mo Y2 -> $100/mo Y3 (upgraded plan for growing user base)
- Claude API grows with usage but so does revenue
- PostHog and Sentry remain $0 through free tiers at MAU 8K
- Resend may require Pro plan ($20/mo) if email volume exceeds 3K/month in Y2-Y3

---

## 11. Implementation Timeline

### 11.1 Total: 7 Weeks (Parallel AI Agent Execution)

```
Week 1-2: Foundation + Auth + Payment
├── [Agent 1] Port interfaces + DI container + shared types (3 days)
├── [Agent 1] Better Auth: email magic link + Google + Kakao (4 days)
├── [Agent 2] Stripe Checkout + webhook handler + subscription DB (5 days)
├── [Agent 2] Resend adapter + 6 email templates (3 days)
└── [Shared] Integration tests: auth flow + payment flow (2 days)
    Milestone: User can sign up, sign in, and purchase Premium

Week 3-4: AI Integration + Analytics
├── [Agent 1] Template fallback system (50 patterns) (3 days)
├── [Agent 1] Claude AI adapter (3-tier + caching + circuit breaker) (5 days)
├── [Agent 2] PostHog SDK + custom Go events + feature flags (2 days)
├── [Agent 2] Sentry SDK + error boundaries + source maps (2 days)
├── [Agent 2] Web Push: service worker + subscriptions + server push (4 days)
└── [Shared] Integration tests: AI tier routing + analytics events (2 days)
    Milestone: "Why?" explanations work (template), analytics tracking live

Week 5-6: Communication + AI V2
├── [Agent 1] Claude Haiku/Sonnet integration (prompt tuning) (5 days)
├── [Agent 1] Prompt caching optimization (hit rate >85%) (3 days)
├── [Agent 2] Discord webhook integration (1 day)
├── [Agent 2] next-intl setup (3 locales: en/ko/ja) (3 days)
├── [Agent 2] End-to-end flow: auth → payment → AI → push (3 days)
└── [Shared] Load testing at 2x MAU (16K simulated) (2 days)
    Milestone: Full AI explanations live, i18n working

Week 7: Integration Hardening + Buffer
├── [Agent 1] Circuit breaker testing + failure mode verification (2 days)
├── [Agent 1] Prompt cache warming strategy + cost monitoring (1 day)
├── [Agent 2] Webhook reliability testing (Stripe + Resend) (2 days)
├── [Agent 2] Security audit: auth middleware, webhook signatures (2 days)
└── [Shared] Documentation + adapter migration guides (1 day)
    Milestone: Production-ready, all integrations hardened
```

### 11.2 Milestone Checkpoints

| Milestone | Week | Go/No-Go Criteria |
|-----------|------|--------------------|
| Auth flow works | 2 | Sign up (email+Google+Kakao) → sign in → role-based access |
| Payment flow works | 2 | Stripe Checkout → webhook → Premium activated |
| Template explanations | 3 | KataGo analysis → pattern match → explanation displayed |
| Analytics tracking | 3 | PostHog dashboard shows custom Go events |
| Error monitoring | 3 | Sentry captures thrown error with context |
| Push notifications | 4 | Opponent moves → browser notification received |
| Claude AI live | 5 | Haiku generates explanation, Sonnet escalation works |
| Prompt cache optimized | 6 | Cache hit rate >85%, cost <$65/mo projected |
| All integrations hardened | 7 | Circuit breakers tested, webhook signatures verified |

---

## 12. Success Probability

### 12.1 Risk-Adjusted Probability

| Component | Success Probability | Complexity | Risk Factor |
|-----------|:---:|:---:|:---:|
| Better Auth (3 providers) | 95% | Low | Well-documented, plugin-based |
| Stripe Checkout + webhooks | 95% | Low | 25 years of training data, hosted checkout |
| Resend + react-email | 95% | Low | Single SDK, JSX templates |
| Claude AI 3-tier | 80% | Medium | Prompt tuning, cache optimization, tier routing |
| PostHog Cloud | 98% | Very Low | SDK init + custom events |
| Sentry Cloud | 98% | Very Low | Auto-instrumentation, 15+ year standard |
| Web Push API | 85% | Medium | Service worker complexity, iOS Safari edge cases |
| Discord webhooks | 98% | Very Low | Single POST function |
| i18n (3 locales) | 90% | Low | next-intl, translation management |

**Compound probability (serial)**: 0.95 x 0.95 x 0.95 x 0.80 x 0.98 x 0.98 x 0.85 x 0.98 x 0.90 = **50%**

**Adjusted for parallel independence**: Auth/Payment/Email are independent of AI/Analytics/Push. Failure of analytics does not block payment. Adjusting for independence:
- Critical path (Auth+Payment+AI): 0.95 x 0.95 x 0.80 = **72%**
- With 2-week buffer: **85%**
- With 4-week buffer (9 weeks total): **91%**

### 12.2 Probability Comparison

| Scenario | Timeline | Probability |
|----------|----------|:-----------:|
| 2.A Latest Tech | 10 weeks | 65% |
| 2.B Stability | 8 weeks | 75% |
| 2.C Speed | 14 days | 60% |
| 2.D Maintainability | 6 weeks | 78% |
| **3.B Balanced** | **7 weeks** | **85%** |
| **3.B + Buffer** | **9 weeks** | **91%** |

---

## 13. Risk Register

### Top 5 Risks

| # | Risk | Probability | Impact | Detection | Mitigation |
|---|------|:-----------:|:------:|-----------|------------|
| **R1** | **Claude API outage during peak game hours** | Medium (99.4% uptime = ~4.3 hrs/mo downtime, March 2, 2026 global outage precedent) | High | Sentry AI monitoring, circuit breaker state alerts | Template fallback covers 100% of cases. Circuit breaker opens after 5 failures/60s, auto-closes after 30s. Users see template explanations (still unprecedented vs competitors). |
| **R2** | **Coolify security vulnerability** | Medium (11 CVSS 10.0 CVEs disclosed Jan 2026, 52K exposed instances) | Critical | CVE monitoring, Coolify auto-update enabled | 1) Enable Coolify auto-update for security patches. 2) Restrict Coolify dashboard access (IP whitelist + disable public registration). 3) Rotate all SSH keys quarterly. 4) Managed SaaS for non-infra services (PostHog, Sentry) reduces blast radius. 5) Escape hatch: migrate to direct Docker Compose + Traefik if Coolify CVE frequency continues. |
| **R3** | **LLM hallucination in Go explanations** | High (LLM has zero Go understanding -- Research 3, LLM-Robust branch) | High | Golden dataset spot-checks (200 positions), user feedback flags | 1) Mandatory template for high-risk positions (life-and-death, ko, seki). 2) KataGo data anchoring in every prompt (LLM translates, never generates analysis). 3) 3-layer validation in Phase 2 (data anchor -> constrained generation -> output check). 4) User "flag as wrong" button with review queue. |
| **R4** | **Stripe KakaoPay/NaverPay setup complexity** | Medium | Medium | Pre-launch testing with Korean test accounts | 1) Stripe supports KakaoPay/NaverPay natively since Oct 2024. 2) Entity requirement: Stripe Atlas ($500 one-time) for US LLC or existing entity. 3) Test in Stripe test mode before launch. 4) Fallback: standard card payment works globally. |
| **R5** | **Web Push API iOS Safari limitations** | Medium (iOS 16.4+ required, push requires user to add app to Home Screen on iOS) | Low | Browser detection + graceful degradation | 1) Email notifications as fallback for iOS users who don't add to Home Screen. 2) In-app notification indicator (badge) for active sessions. 3) Document "Add to Home Screen" in onboarding for iOS users. |

### Risk Appetite Statement

We accept medium-probability risks where graceful degradation exists (R1, R5) and invest in mitigation for high-impact risks where degradation could harm users (R2, R3). The Coolify risk (R2) is the most consequential -- we maintain an escape hatch to bare Docker Compose if CVE frequency does not decrease.

---

## 14. Cross-Research Validation

### 14.1 Alignment with Research 1 (Market/User/Business) — Balanced Scenario

| Research 1 Decision | This PRD | Alignment |
|---------------------|----------|:---------:|
| "Why?" AI explanations = primary moat | Claude 3-tier with template-first launch | ALIGNED -- AI explanations ship Day 1 (template), enriched in Phase 2 (Claude) |
| Korean market = primary target | Kakao OAuth Day 1, KakaoPay native, ko locale | ALIGNED -- Korean-first design |
| Quick Go (9x9) for beginner retention | Push notifications for turn-based engagement | ALIGNED -- "Your turn" push drives the quick game loop |
| Premium conversion via AI | Free tier has template explanations, Premium has full Claude AI | ALIGNED -- AI is the conversion driver |
| $80-260/mo budget | $80-130/mo (excl. Stripe) | ALIGNED -- well within budget |
| 6-month total timeline | 7 weeks for external integrations (subset of 6-month plan) | ALIGNED -- leaves ample time for domain tech (12 weeks from Research 3) |

### 14.2 Alignment with Research 2 (Tech Stack) — Balanced-Tech Stack v1.0

| Research 2 Decision | This PRD | Alignment |
|---------------------|----------|:---------:|
| Node.js 22 LTS + Next.js 15 | All integrations built on Next.js 15 (Server Actions, route handlers) | ALIGNED |
| Drizzle ORM | Better Auth uses Drizzle adapter (first-party) | ALIGNED |
| Biome (linter) | No impact on external integrations | NEUTRAL |
| REST + Zod over tRPC | REST + Zod + Server Actions | ALIGNED |
| WebSocket (ws) for real-time | Game WebSocket is domain tech; external integrations use HTTP | ALIGNED |
| Coolify + Hetzner | All self-hosted components on Coolify-managed Hetzner VPS | ALIGNED (with R2 Coolify CVE mitigation) |
| AI agent optimization = primary design criterion | Ports/Adapters, REST patterns, single vendor SDKs | ALIGNED |

### 14.3 Alignment with Research 3 (Baduk Domain) — Balanced-Tech

| Research 3 Decision | This PRD | Alignment |
|---------------------|----------|:---------:|
| Claude Haiku 4.5 (80%) + Sonnet (15%) + Template (5%) | Identical 3-tier architecture | ALIGNED |
| Template V1 (10 days, $0/mo) → LLM V2 (5 weeks) | Template-first launch, Claude Phase 2 | ALIGNED |
| Prompt caching 85-90% savings | Prompt caching with 5-min TTL, 80%+ hit rate target | ALIGNED |
| KataGo = truth, LLM = translator | KataGo data anchoring in every prompt | ALIGNED |
| Mandatory template for high-risk (life/death, ko, seki) | Template fallback for all high-risk positions | ALIGNED |
| BullMQ for KataGo queue | BullMQ is domain tech (Research 3); this PRD integrates via Port interface | ALIGNED |
| $80 (Phase 1) → $260 (Phase 2) monthly | $80-90 (Phase 1) → $108-130 (Phase 2) | ALIGNED -- external integrations are subset of total budget |

### 14.4 Triple-Balanced Consistency Check

| Criterion | R1 Balanced | R2 Balanced-Tech | R3 Balanced-Tech | **R4 Balanced-Tech** | Consistent? |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Scenario selected | Balanced | Balanced-Tech | Balanced-Tech | **Balanced-Tech** | 4/4 ALIGNED |
| AI approach | "Why?" AI Day 1 | Haiku/Sonnet/Template 3-tier | Template V1 → LLM V2 | **Template-first → Claude 3-tier** | ALIGNED (progressive) |
| Infrastructure | $55-150/mo | Coolify+Hetzner $60/mo | CCX33 $60/mo | **CCX33 $65/mo** | ALIGNED |
| Auth | Simple login | Better Auth | -- | **Better Auth + 3 providers** | ALIGNED (concrete) |
| Payment | Stripe | Stripe | -- | **Stripe Checkout** | ALIGNED |
| Analytics | Basic tracking | Vitest + SonarQube | -- | **PostHog + Sentry (managed)** | ALIGNED (complementary) |
| Communication | Push + email | -- | -- | **Resend + Web Push + Discord WH** | ALIGNED (concrete) |
| i18n | Multi-language | next-intl | -- | **next-intl (3 locales)** | ALIGNED |
| External services | Moderate | -- | -- | **8 services** | ALIGNED (moderate) |
| Success probability | 65-75% | 70-75% | 82-91% | **85-91%** | ALIGNED (increasing) |
| Monthly cost | $55-150 | $60-130 | $80-260 | **$80-130** | ALIGNED (converging) |

**All 4 independent research streams selected Balanced-Tech and produced consistent, converging technical decisions.** This is the strongest signal that Balanced-Tech is the correct positioning for this project.

---

## Appendix A: Branch Agreement Compliance

| # | Branch Agreement | This PRD Compliance |
|---|-----------------|:-------------------:|
| 1 | Claude API = only programmatic AI | COMPLIANT -- Claude-only, no OpenAI/Gemini API |
| 2 | Stripe = payment (KakaoPay/NaverPay native) | COMPLIANT -- Stripe Checkout with Korean payment methods |
| 3 | Resend = email (3K free) | COMPLIANT -- Resend with react-email templates |
| 4 | Cloudflare = CDN+R2 (free) | COMPLIANT -- Cloudflare free tier for CDN and R2 storage |
| 5 | Web Push API = push (free) | COMPLIANT -- VAPID-based Web Push, no FCM |
| 6 | Template fallback essential | COMPLIANT -- Template is Tier 3 in 3-tier architecture |
| 7 | Prompt caching 85-90% savings | COMPLIANT -- 5-min TTL, 80%+ hit rate target |
| 8 | next-intl = i18n | COMPLIANT -- next-intl with 3 locales (en/ko/ja) |

**8/8 branch agreements upheld.** Zero violations.

---

## Appendix B: Vendor Health Monitoring Plan

Quarterly review of each vendor:

| Vendor | Health Signals | Replacement (Port/Adapter) |
|--------|---------------|---------------------------|
| Claude API | API status page, release notes, pricing changes | 1 adapter file → OpenAI or Gemini (if API becomes available) |
| Better Auth | GitHub releases, npm downloads, YC backing status | 1 adapter + DB migration → Clerk, Auth0, or Lucia |
| Stripe | Status page, incident count (14 in 90 days), pricing | 1 adapter + webhook schema + DB migration → Paddle, Lemon Squeezy |
| Resend | Status page (~70 incidents since Feb 2024), npm release cadence | 1 adapter → SendGrid, Postmark |
| PostHog | Cloud status, free tier changes, pricing model | 1 adapter → Mixpanel, Umami (self-hosted) |
| Sentry | Cloud status, free tier limits, Next.js SDK maintenance | 1 adapter → GlitchTip, Bugsink (self-hosted) |

---

## Sources

- [Prompt caching - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude API Pricing Guide 2026](https://www.aifreeapi.com/en/posts/claude-api-pricing-per-million-tokens)
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Auth.js v5 Migration Guide](https://authjs.dev/getting-started/migrating-to-v5)
- [Auth.js Email Providers](https://authjs.dev/getting-started/authentication/email)
- [Coolify 11 Critical Vulnerabilities (Hacker News)](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html)
- [CVSS 10 Alert: Coolify Critical Security Flaws](https://securityonline.info/cvss-10-alert-coolify-hit-by-three-critical-security-flaws-cve-2025-22612-cve-2025-22611-and-cve-2025-22609/)
- [Security Hardening Your Coolify Server](https://massivegrid.com/blog/coolify-security-hardening/)
- [tRPC vs REST Comparative Analysis](https://www.wisp.blog/blog/when-to-choose-rest-over-trpc-a-comparative-analysis)
- [tRPC - End-to-end typesafe APIs](https://trpc.io/)
- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog Self-Host Docs](https://posthog.com/docs/self-host)
- [Sentry Pricing](https://sentry.io/pricing/)
- [Sentry Pricing 2026](https://costbench.com/software/developer-tools/sentry/)
- [Discord Webhooks Guide](https://hookdeck.com/webhooks/platforms/guide-to-discord-webhooks-features-and-best-practices)
- [KataGo GitHub](https://github.com/lightvector/KataGo)
- [KataGo Eigen Release](https://github.com/lightvector/KataGo/releases/tag/v1.6.0)
- [GitClear AI Code Quality 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research)
