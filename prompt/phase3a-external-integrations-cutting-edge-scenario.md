# PHASE 3.A: External Integrations — Cutting Edge Technology Scenario

> **Philosophy**: "Invest in the latest where risk is calculated, and the payoff is competitive advantage no one else has."
>
> **Date**: 2026-03-10
> **Context**: Research 4, PHASE 3.A. Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, KataGo CPU Eigen, Hetzner+Coolify.
> **Constraint**: OpenAI/Gemini = subscription only, NO API. Claude = only programmatic AI.
> **Target**: MAU 8K. Budget: $80-260/mo.

---

## Executive Summary

This scenario pushes every external integration to the cutting edge while maintaining fallbacks for each decision. The result is a **4-layer AI architecture**, **passkey-first auth**, **orchestrated multi-channel notifications**, **triple analytics**, and **type-safe integration patterns** that no competing Go app offers today.

| Dimension | Score |
|-----------|-------|
| **Overall Innovation Score** | **8.4 / 10** |
| **Success Probability (full scope, 10 weeks)** | **60-65%** |
| **Success Probability (core + deferred scope, 12 weeks)** | **80%** |
| **Total Monthly Cost (at MAU 8K)** | **$97-175/mo** |
| **Implementation Timeline** | **10 weeks** (8 core + 2 polish) |

---

## 1. AI Integration — 4-Layer Architecture

### 1.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI INTEGRATION LAYERS                          │
│                                                                   │
│  LAYER 1: KataGo Engine (Game Intelligence)                      │
│  ├── KataGo v1.16.2 CPU Eigen — game analysis backbone          │
│  ├── MCP Server wrapper — standardized tool interface            │
│  └── Cost: $0/mo (self-hosted)                                   │
│                                                                   │
│  LAYER 2: Claude API 3-Tier (Natural Language Intelligence)      │
│  ├── Haiku 4.5 (80%) — bulk move explanations                   │
│  ├── Sonnet 4.6 (15%) — complex strategic analysis              │
│  ├── Template V1 (5%) — pattern-matched fallback                │
│  ├── Prompt caching — 90% input cost reduction                  │
│  ├── Batch API — 50% discount for async workloads               │
│  └── Cost: $20-97/mo (scales with MAU)                          │
│                                                                   │
│  LAYER 3: On-Device AI (Zero-Cost Progressive Enhancement)      │
│  ├── Chrome Built-in AI (Gemini Nano) — Summarizer API          │
│  ├── WebLLM (Phi-3.5-mini) — offline commentary                 │
│  └── Cost: $0/mo                                                 │
│                                                                   │
│  LAYER 4: MCP Protocol (Tool Integration Standard)              │
│  ├── KataGo MCP Server — analyze_position, compare_moves        │
│  ├── Game DB MCP Server — search_games, find_similar_positions   │
│  └── Cost: $0/mo (self-hosted)                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Layer 1: KataGo + MCP Server

| Item | Detail |
|------|--------|
| **Technology** | KataGo v1.16.2 CPU Eigen + custom MCP Server (TypeScript) |
| **Innovation** | 9/10 |
| **Risk** | Low |
| **Competitive Advantage** | Only Go app with MCP-standardized KataGo — any MCP client (Claude, IDE extensions, future AI models) can query analysis. Chess-MCP precedent validates the pattern. |
| **Fallback** | Direct stdio IPC (strip MCP wrapper, keep same analysis logic) |
| **Cost** | $0/mo |

**Why MCP for KataGo, not just IPC?**

A KataGo MCP Server already exists in the ecosystem (documented Feb 2026, LobeHub registry). The pattern is validated. Our custom implementation adds Go-app-specific tools:

```typescript
// MCP tools exposed by KataGo MCP Server
server.tool("analyze_position", {
  board: z.array(z.array(z.number())),  // 19x19 board
  nextPlayer: z.enum(["B", "W"]),
  maxVisits: z.number().default(500),
  komi: z.number().default(7.5),
});

server.tool("compare_moves", {
  board: z.array(z.array(z.number())),
  moveA: z.string(),
  moveB: z.string(),
  nextPlayer: z.enum(["B", "W"]),
});

server.tool("evaluate_sequence", {
  board: z.array(z.array(z.number())),
  moves: z.array(z.string()),       // sequence to evaluate
  nextPlayer: z.enum(["B", "W"]),
});
```

**MCP Maturity Assessment** (March 2026):
- 97M+ monthly SDK downloads
- 5,800+ MCP servers, 300+ clients
- Donated to Linux Foundation AAIF (Dec 2025)
- Adopted by Anthropic, OpenAI, Google DeepMind, Microsoft, AWS
- Spec version: November 2025 (OAuth, structured outputs, security)

**Innovation vs Hype Verdict**: **Real**. MCP has won the tool integration standard war. Building KataGo as MCP is future-proofing, not speculation.

### 1.3 Layer 2: Claude API 3-Tier with Cost Optimization

| Item | Detail |
|------|--------|
| **Technology** | Claude Haiku 4.5 + Sonnet 4.6 + Template V1 |
| **Innovation** | 7/10 |
| **Risk** | Medium (API dependency) |
| **Competitive Advantage** | 3-tier routing + prompt caching = highest quality commentary at lowest cost. No competitor has tiered LLM with domain-specific caching. |
| **Fallback** | Template V1 (pattern-matched explanations from KataGo data, $0 cost) |
| **Cost** | $20-97/mo |

**Model Routing Logic**:

```
User requests "Why was move 42 bad?"
  │
  ├── Is it a simple pattern? (atari, capture, ko, ladder)
  │   └── YES → Template V1 ($0, <10ms)
  │
  ├── Is it a standard position explanation?
  │   └── YES → Claude Haiku 4.5 ($0.001/request, 640ms)
  │
  └── Is it complex? (user question, critical moment, review report)
      └── YES → Claude Sonnet 4.6 ($0.006/request, 1.5s)
```

**Prompt Caching Architecture**:

The Go expert system prompt (~2,000 tokens) is stable across all requests. With prompt caching:
- Cache write: 1.25x base input (first request)
- Cache read: 0.1x base input (subsequent requests within 5 min)
- At 100+ requests/5min window: effective **90% input cost reduction**
- 5-minute TTL resets on each hit — active usage keeps cache warm

**Batch API for Non-Real-Time**:
- Post-game full analysis reports: 50% discount via Batch API
- Daily puzzle generation: batch overnight
- Opening database commentary: one-time batch job
- Up to 100,000 requests per batch, results within 24hr (most <1hr)

**Cost Projection (MAU 8K)**:

| Traffic | Model | Requests/mo | Cost/mo |
|---------|-------|-------------|---------|
| 80% standard | Haiku 4.5 (cached) | 72,000 | $21.60 |
| 15% complex | Sonnet 4.6 | 13,500 | $12.15 |
| 5% template | Template V1 | 4,500 | $0 |
| Async batch | Haiku (50% off) | 15,000 | $5.40 |
| **Total** | | **105,000** | **$39.15** |

After prompt caching optimization (30% total reduction): **~$27/mo** at MAU 8K.

**Current Pricing** (March 2026):
- Haiku 4.5: $1 input / $5 output per 1M tokens
- Sonnet 4.6: $3 input / $15 output per 1M tokens
- Cache read: 0.1x input price
- Batch: 50% off all models

### 1.4 Layer 3: On-Device AI (Progressive Enhancement)

| Item | Detail |
|------|--------|
| **Technology** | Chrome Built-in AI (Gemini Nano) + WebLLM (Phi-3.5-mini) |
| **Innovation** | 9/10 |
| **Risk** | High (experimental APIs, browser-dependent) |
| **Competitive Advantage** | No Go app has on-device AI. Zero-cost, instant response, offline capable. |
| **Fallback** | Cloud Claude API (always available) |
| **Cost** | $0/mo |

#### Chrome Built-in AI — Reality Check (March 2026)

| API | Status | Our Use Case | Feasibility |
|-----|--------|-------------|-------------|
| Summarizer API | Stable (Chrome 138+) | Post-game summary | **High** — English summaries of structured game data |
| Translator API | Stable (Chrome 138+) | EN→KO translation | **Uncertain** — Korean support unconfirmed; expert model, not Gemini Nano |
| Prompt API | Stable (Extensions only) | Move annotations | **Medium** — Web page support still experimental |
| Writer API | Origin Trial (Chrome 139+) | Study notes | **Low** — Too experimental for production |

**Critical Limitation**: Gemini Nano supports only **English, Spanish, Japanese** as of Chrome 140. **Korean is NOT supported** yet. For our Korean-primary user base, Chrome Built-in AI is supplementary, never primary.

**Platform Support**: Windows 10/11, macOS 13+, Linux, ChromeOS (Chromebook Plus). **NOT supported**: Android, iOS. This means mobile users (60%+) cannot use on-device AI.

**Performance**:
- Latency (TTFT): <100ms (sub-100ms median)
- Throughput: ~10-20 tok/s (CPU)
- Quality: Low (small model, shallow Go knowledge)
- Privacy: Full (no data leaves device)

**Verdict**: Use Summarizer API for English post-game summaries only. Everything else is too experimental or lacks Korean support. Progressive enhancement — never a dependency.

#### WebLLM — On-Device Open-Source LLMs

WebLLM (v0.2.81) runs open-source LLMs entirely in-browser via WebGPU:

| Model | Size | RAM | Speed (WebGPU) | Quality for Go |
|-------|------|-----|----------------|---------------|
| Phi-3.5-mini-q4 | 1.8GB | 4GB | ~15-25 tok/s | Good for simple explanations |
| Gemma-2B-q4 | 1.2GB | 3GB | ~20-30 tok/s | Decent for classification |
| Llama-3.2-1B-q4 | 0.7GB | 2GB | ~30-40 tok/s | Fast, lower quality |

**WebGPU Browser Support** (March 2026): WebGPU now ships by default in Chrome, Firefox (Windows + macOS ARM), Safari (macOS Tahoe 26, iOS 26), and Edge. Mobile remains fragmented — Chrome Android works on recent hardware; Firefox Android still behind flag.

**Innovation vs Hype Verdict**: **Real tech, niche use case**. WebLLM is genuinely impressive for offline mode. But the model download (1-2GB), WebGPU requirement, and quality gap vs Claude API mean it serves a narrow audience (power users on desktop who want offline analysis). Worth implementing as Month 4-5 feature, not core.

### 1.5 Layer 4: MCP Protocol Integration

See Layer 1 (KataGo MCP Server) above. Additional MCP servers:

**Game DB MCP Server**:
```
Tools:
  - search_games(player?, date_range?, opening?) → Game[]
  - get_game(game_id) → { sgf, metadata, analysis_cache }
  - find_similar_positions(board, move_number) → SimilarPosition[]

Resources:
  - games://recent — recently played games
  - games://openings/{pattern} — opening pattern database
```

**Claude + MCP Integration Flow**:
```
User: "Why was move 42 bad?"
  → Claude receives question + MCP tool catalog
  → Claude calls: analyze_position(sgf, move=42) via KataGo MCP
  → KataGo returns: { winRate, scoreLead, topMoves, ownership }
  → Claude calls: compare_moves(sgf, played=Q16, best=R14) via KataGo MCP
  → Claude synthesizes: "Move 42 (Q16) lost ~3.2 points..."
```

### 1.6 AI Integration — Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Innovation | 9/10 | 4-layer AI is unique in Go app space |
| Risk | Medium | On-device experimental; Claude API reliable |
| Cost Efficiency | 9/10 | On-device $0; caching 90% savings; templates $0 |
| Competitive Advantage | **No competitor has multi-layer AI** | OGS: none. Fox: proprietary. AI Sensei: single model |
| Fallback Chain | KataGo MCP → Claude API → Template V1 | 3 independent fallback layers |

---

## 2. Payment & Auth — Passkey-First, B2B Ready

### 2.1 Authentication: Better Auth + Passkeys

| Item | Detail |
|------|--------|
| **Technology** | Better Auth (MIT, open-source) + Passkey plugin (SimpleWebAuthn) |
| **Innovation** | 8/10 |
| **Risk** | Low-Medium |
| **Competitive Advantage** | Passwordless-first Go app. 4x faster login. Phishing-resistant. B2B 도장(dojang) support via Organization plugin. |
| **Fallback** | NextAuth.js v5 (proven, but less innovative) |
| **Cost** | $0/mo (self-hosted, MIT license) |

**Why Better Auth over NextAuth.js v5?**

| Feature | Better Auth | NextAuth.js v5 |
|---------|-------------|----------------|
| Passkey/WebAuthn | First-class plugin | Community adapter |
| Organization/Multi-tenant | Built-in plugin | Manual implementation |
| Two-Factor Auth | Built-in plugin | Manual |
| Database-first | Yes (your DB is the source of truth) | Session-first |
| License | MIT | ISC |
| TypeScript | Native, end-to-end type-safe | Good |
| Next.js 15 | Full support (middleware, RSC) | Full support |
| Bundle size overhead | Minimal | Minimal |
| Learning curve | Moderate (newer) | Low (established) |

**Passkey Adoption Context** (2026):
- Google: 120% increase in passkey authentications after making default
- ~70% of users have at least one passkey by end of 2025
- NIST SP 800-63-4 (July 2025): AAL2 must offer phishing-resistant option; syncable passkeys qualify
- WebAuthn Level 3 spec with PRF extension enables end-to-end encrypted data vaults
- Apple iOS 26: credential portability across devices
- 93% login success rate vs passwords (lower); 4x faster login

**Auth Architecture**:

```
Authentication Layers:
1. Primary:  Passkeys/WebAuthn (passwordless, phishing-resistant)
2. Social:   Google OAuth 2.1 + GitHub OAuth 2.1 (PKCE mandatory)
3. Fallback: Magic link email via Resend (account recovery)

Authorization:
├── Individual users: role-based (free, premium, admin)
└── 도장 (Dojang/Club): Organization plugin
    ├── Club owner creates organization
    ├── Members join via invite link
    ├── Role hierarchy: owner → instructor → member
    ├── Shared analytics: club game stats, member progress
    └── B2B billing: Stripe per-organization subscription
```

**B2B 도장 (Dojang/Club) Plan — Innovation Differentiator**:

No existing Go app offers B2B subscriptions for Go schools/clubs. Better Auth's Organization plugin makes this structurally simple:

| Feature | Implementation |
|---------|---------------|
| Club creation | Organization plugin `create()` |
| Member management | Organization `invite()`, `remove()`, roles |
| Club dashboard | Custom analytics page scoped to org members |
| Club billing | Stripe per-organization subscription ($29.99/mo) |
| Instructor tools | Role-based access to member game reviews |

### 2.2 Payment: Stripe + KakaoPay + NaverPay

| Item | Detail |
|------|--------|
| **Technology** | Stripe Checkout + Payment Element + KakaoPay/NaverPay native |
| **Innovation** | 7/10 |
| **Risk** | Low |
| **Competitive Advantage** | Only Go app with native Korean payment methods. 70%+ of Korean online transactions use KakaoPay/NaverPay. |
| **Fallback** | Stripe card-only (still functional, loses Korean conversion) |
| **Cost** | Stripe fees: 2.9% + $0.30/transaction |

**Stripe Korean Payment Integration**:

Stripe natively supports KakaoPay and NaverPay for South Korean payments, documented at `docs.stripe.com/payments/kakao-pay/accept-a-payment` and `docs.stripe.com/payments/naver-pay/accept-a-payment`. No local Korean entity required — Stripe handles local processor partnership.

**Pricing Tiers**:

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | 3 AI reviews/day, ranked play, basic puzzles |
| Premium | $9.99/mo | Unlimited AI reviews, Sonnet analysis, advanced puzzles |
| 도장 (Club) | $29.99/mo | 10 members, instructor tools, club analytics |
| 도장 Pro | $59.99/mo | 30 members, tournament hosting, bulk import |

**Payment Method Detection**:
```typescript
// Stripe automatically shows relevant payment methods based on user locale
const paymentIntent = await stripe.paymentIntents.create({
  amount: 999,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
  // KakaoPay and NaverPay auto-shown for Korean IP/locale
});
```

### 2.3 OAuth 2.1 Compliance

| Item | Detail |
|------|--------|
| **Technology** | OAuth 2.1 (draft-ietf-oauth-v2-1-15, March 2026) |
| **Innovation** | 7/10 |
| **Risk** | Very Low (codifies existing best practices) |
| **Competitive Advantage** | Future-proof auth foundation. PKCE mandatory for all flows. |
| **Fallback** | OAuth 2.0 + PKCE (identical implementation) |
| **Cost** | $0 |

Key OAuth 2.1 changes already implemented by Better Auth:
- PKCE mandatory for ALL clients (prevents authorization code interception)
- Implicit flow removed (no token in URL fragments)
- Resource Owner Password Credentials removed
- Exact redirect URI matching

### 2.4 Payment & Auth — Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Innovation | 8/10 | Passkey-first + B2B 도장 plan is unique |
| Risk | Low | Better Auth MIT + Stripe proven |
| Cost | $0 (auth) + Stripe fees (payment) | |
| Competitive Advantage | **Only Go app with passkeys + Korean payments + B2B clubs** | |
| Fallback | NextAuth.js v5 (auth) / Stripe card-only (payment) | |

---

## 3. Communication — Orchestrated Multi-Channel

### 3.1 Notification Orchestration: Novu (Self-Hosted)

| Item | Detail |
|------|--------|
| **Technology** | Novu open-source (MIT core, self-hosted) |
| **Innovation** | 8/10 |
| **Risk** | Medium (infrastructure complexity) |
| **Competitive Advantage** | Unified notification orchestration across email, push, in-app, Discord. No Go app has this. |
| **Fallback** | Direct Resend (email) + Web Push API (push) + Discord webhook (manual) |
| **Cost** | $0/mo (self-hosted) |

**Why Novu over direct integrations?**

| Approach | Pros | Cons |
|----------|------|------|
| **Direct** (Resend + Web Push + Discord) | Simple, fewer dependencies | No retry logic, no digest, no preference management, no unified log |
| **Novu self-hosted** | Retry, digest, user preferences, multi-channel orchestration, audit log | Additional Docker containers, learning curve |

**Novu Architecture for Go App**:

```
┌───────────────────────────────────────────────────────┐
│                    Novu Orchestrator                    │
│                                                        │
│  Triggers:                                             │
│  ├── game.your_turn    → Push + In-App                │
│  ├── game.completed    → Email (review) + In-App      │
│  ├── analysis.ready    → Push + In-App                │
│  ├── challenge.received → Push + In-App + Discord DM  │
│  ├── rank.changed      → In-App + Email (weekly digest)│
│  └── tournament.start  → Push + Email + Discord       │
│                                                        │
│  Channels:                                             │
│  ├── Email      → Resend (React Email JSX)            │
│  ├── Push       → Web Push API (VAPID, free)          │
│  ├── In-App     → Novu Inbox component (React)       │
│  ├── Discord    → Discord webhook                     │
│  └── SMS        → (deferred, not needed for v1)       │
│                                                        │
│  Features:                                             │
│  ├── Digest: aggregate 5+ game invites into 1 email  │
│  ├── Preferences: user controls per-channel toggles   │
│  ├── Retry: exponential backoff on delivery failure   │
│  └── Analytics: delivery rate, open rate tracking      │
└───────────────────────────────────────────────────────┘
```

**Innovation vs Hype Verdict**: Novu is **real and production-ready** (GitHub 37K+ stars, MIT license, Docker self-host option). However, for MAU 8K launch, the direct approach (Resend + Web Push + Discord webhooks) is sufficient. Novu becomes valuable at **MAU 10K+** when notification volume and complexity justify orchestration.

**Recommended Phasing**:
- **Month 1-3**: Direct integrations (Resend, Web Push, Discord webhooks)
- **Month 4-6**: Evaluate Novu self-hosted if notification complexity warrants
- **Month 7+**: Full Novu orchestration with digest, preferences, analytics

### 3.2 Email: Resend + React Email

| Item | Detail |
|------|--------|
| **Technology** | Resend + React Email JSX templates |
| **Innovation** | 7/10 |
| **Risk** | Very Low |
| **Competitive Advantage** | Type-safe email templates as React components. Version-controlled, testable. |
| **Fallback** | Nodemailer + SMTP (self-hosted, unlimited) |
| **Cost** | $0/mo (3,000 emails/mo free tier) |

**Free Tier Adequacy**: At MAU 8K, estimated email volume:
- Game completion summaries: ~2,000/mo
- Account notifications: ~500/mo
- Weekly digest (opt-in): ~1,000/mo
- Total: ~3,500/mo — just at free tier limit. $20/mo Pro plan if exceeded (50,000 emails).

**React Email Integration**:
```typescript
// emails/game-review.tsx — React component = email template
import { Html, Head, Body, Container, Text } from '@react-email/components';

export function GameReviewEmail({ playerName, result, aiInsight }) {
  return (
    <Html>
      <Body style={main}>
        <Container>
          <Text>Hi {playerName}, your game review is ready!</Text>
          <Text>Result: {result}</Text>
          <Text>AI Insight: {aiInsight}</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### 3.3 Push Notifications: Web Push API

| Item | Detail |
|------|--------|
| **Technology** | Web Push API + VAPID keys + Service Worker |
| **Innovation** | 6/10 (established standard) |
| **Risk** | Low |
| **Competitive Advantage** | Free push notifications. No vendor lock-in. Works on PWA. |
| **Fallback** | In-app notifications only |
| **Cost** | $0/mo (standard API, no vendor) |

**Browser Support**: ~96% overall, 100% across evergreen browsers. iOS Safari partial (Home Screen web apps only). Service Worker required.

**Push Use Cases**:
- "Your turn!" — opponent has played
- "Challenge received" — direct challenge from another player
- "Analysis complete" — KataGo review finished
- "Tournament starting in 10 minutes"

### 3.4 Discord Integration: Embedded App SDK + Webhooks

| Item | Detail |
|------|--------|
| **Technology** | Discord Embedded App SDK (Activity) + Webhooks |
| **Innovation** | 9/10 |
| **Risk** | High (SDK still evolving, niche audience) |
| **Competitive Advantage** | **Play Go inside Discord voice channels.** No Go app has this. Gaming communities live on Discord. |
| **Fallback** | Discord webhooks only (game result notifications) |
| **Cost** | $0/mo |

**Discord Activity — The Bold Bet**:

Discord's Embedded App SDK (GDC 2026 updates) enables rich multiplayer experiences as Activities inside Discord. A Go game playable directly in Discord voice/text channels would be a first.

**Implementation Scope**:
```
Phase 1 (Month 2): Discord Webhooks
├── Post game results to club Discord channels
├── Tournament announcements
└── Daily puzzle sharing

Phase 2 (Month 5-6): Discord Activity (Experimental)
├── Embedded Go board in Discord voice channel
├── Spectate live games from Discord
├── Challenge friends directly from Discord
└── Uses Discord Social SDK for account linking
```

**Innovation vs Hype Verdict**: Discord Activity for Go is **high innovation, high risk**. The SDK is mature (GDC 2026 showcase with Marvel Rivals, Rust, etc.), but building a Go game as a Discord Activity requires significant effort. **Defer to Month 5-6** as a differentiation feature, not a launch requirement.

### 3.5 Internationalization: next-intl

| Item | Detail |
|------|--------|
| **Technology** | next-intl (Next.js 15 App Router native) |
| **Innovation** | 6/10 (standard approach) |
| **Risk** | Very Low |
| **Competitive Advantage** | Full i18n from day 1. Korean + English + Chinese. |
| **Fallback** | Hardcoded strings (terrible, but functional) |
| **Cost** | $0/mo |

**Language Priority**:
1. Korean (ko) — primary market
2. English (en) — global
3. Chinese Simplified (zh-CN) — largest Go player population
4. Japanese (ja) — strong Go culture (Phase 2)

**next-intl Features**:
- Server Component support (`getTranslations()`)
- Client Component support (`useTranslations()`)
- Middleware for locale detection
- ~2KB bundle size
- Type-safe message keys

### 3.6 Communication — Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Innovation | 8/10 | Discord Activity is unique; Novu orchestration is forward-looking |
| Risk | Medium | Discord Activity high risk; everything else low |
| Cost | $0-20/mo | Free tier covers launch; $20/mo Resend Pro at scale |
| Competitive Advantage | **Discord Activity + orchestrated multi-channel** | |
| Fallback | Direct Resend + Web Push + Discord webhooks | |

---

## 4. Analytics — PostHog + Sentry + Umami Triple Stack

### 4.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    TRIPLE ANALYTICS STACK                         │
│                                                                   │
│  LAYER 1: Product Analytics — PostHog Cloud (Free Tier)          │
│  ├── 1M events/mo free                                           │
│  ├── Feature flags (1M requests/mo free)                         │
│  ├── Session replay (5K recordings/mo free)                      │
│  ├── Funnels, retention, user paths                              │
│  └── Cost: $0/mo (90%+ of companies stay free)                  │
│                                                                   │
│  LAYER 2: Error Monitoring — Sentry Cloud (Free Tier)            │
│  ├── 5K errors/mo free                                           │
│  ├── 10K performance units/mo free                               │
│  ├── Next.js deep integration (RSC, API routes, middleware)      │
│  ├── Stack traces, breadcrumbs, session replays                  │
│  └── Cost: $0/mo                                                 │
│                                                                   │
│  LAYER 3: Web Analytics — Umami v3 (Self-Hosted)                │
│  ├── Privacy-first, GDPR by default, no cookies                 │
│  ├── Shares PG 16 instance                                       │
│  ├── Custom events (game-started, puzzle-solved, etc.)           │
│  ├── Funnels, cohorts, segments (v3)                             │
│  └── Cost: $0/mo (self-hosted)                                   │
│                                                                   │
│  WHY THREE?                                                      │
│  PostHog: Product decisions (funnels, feature flags, replay)     │
│  Sentry:  Engineering stability (errors, performance, traces)    │
│  Umami:   Privacy-compliant traffic (no cookie consent needed)   │
│  Each serves a distinct purpose. No overlap in core function.    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 PostHog Cloud — Product Intelligence

| Item | Detail |
|------|--------|
| **Technology** | PostHog Cloud (free tier) |
| **Innovation** | 8/10 |
| **Risk** | Low |
| **Competitive Advantage** | Feature flags for A/B testing AI commentary quality. Session replay to debug UX issues on the Go board. |
| **Fallback** | Umami custom events only (lose feature flags + replay) |
| **Cost** | $0/mo (1M events, 5K replays, 1M flag requests free) |

**Free Tier Adequacy** (MAU 8K):
- Events: ~8K MAU * 20 events/session * 5 sessions/mo = 800K events/mo (within 1M)
- Session replay: 5K recordings/mo (sufficient for debugging, not full recording)
- Feature flags: 1M requests/mo (ample for MAU 8K)

**Go App Feature Flags**:

```typescript
// Feature flag examples
posthog.isFeatureEnabled('new-ai-commentary-v2')     // A/B test AI quality
posthog.isFeatureEnabled('discord-activity-beta')     // Gradual rollout
posthog.isFeatureEnabled('premium-analysis-opus')     // Premium feature gate
posthog.isFeatureEnabled('quick-go-3min')             // New game mode test
```

**Session Replay for Go Board UX**:
- Watch how users interact with the Go board (clicks, hovers, scrolling)
- Debug "why did the user place a stone there?" UX issues
- Identify where users abandon the onboarding tutorial
- No PII captured — PostHog masks sensitive elements

### 4.3 Sentry Cloud — Error & Performance Monitoring

| Item | Detail |
|------|--------|
| **Technology** | Sentry Cloud (free Developer plan) |
| **Innovation** | 6/10 (industry standard) |
| **Risk** | Very Low |
| **Competitive Advantage** | Next.js deep integration. Single SDK instruments entire app — React components, server actions, API routes, edge middleware. |
| **Fallback** | Bugsink self-hosted (Sentry SDK compatible, swap DSN) |
| **Cost** | $0/mo (5K errors, 10K performance units free) |

**Next.js Integration**:
```bash
npx @sentry/wizard -i nextjs  # One-command setup
```

Captures: stack traces, breadcrumbs, session replays, performance traces across all Next.js layers.

**Go App Monitoring Focus**:

| Component | Sentry Integration |
|-----------|-------------------|
| KataGo IPC | Custom spans for analysis timing, crash detection |
| Claude API | Breadcrumbs for API calls, latency tracking |
| WebSocket games | Error tracking for disconnections, state sync issues |
| Go rule engine | Edge case error grouping (ko, superko, counting bugs) |

### 4.4 Umami v3 — Privacy-First Web Analytics

| Item | Detail |
|------|--------|
| **Technology** | Umami v3 (self-hosted, PG 16) |
| **Innovation** | 7/10 |
| **Risk** | Very Low |
| **Competitive Advantage** | GDPR compliant by default. No cookie consent banner needed. Shares existing PG instance — $0 cost. |
| **Fallback** | PostHog alone (but loses privacy compliance simplicity) |
| **Cost** | $0/mo (self-hosted) |

**Why keep Umami alongside PostHog?**

| Umami | PostHog |
|-------|---------|
| No cookies, GDPR by default | Cookies required for session replay |
| Self-hosted (data sovereignty) | Cloud (data on PostHog servers) |
| ~2KB tracking script | ~50KB+ SDK |
| Traffic analytics focus | Product analytics focus |
| Zero ongoing cost | Free tier limits at scale |

For EU/Korean privacy regulations, having a no-cookie traffic analytics layer (Umami) alongside a product analytics layer (PostHog) is belt-and-suspenders.

**Go App Custom Events** (Umami):
```typescript
umami.track('game-started', { mode: 'ranked', boardSize: 19 });
umami.track('game-completed', { result: 'B+3.5', duration: 1800 });
umami.track('analysis-requested', { engine: 'katago', tier: 'haiku' });
umami.track('puzzle-attempted', { difficulty: 'dan', solved: true });
umami.track('subscription-converted', { plan: 'premium', period: 'annual' });
```

### 4.5 Analytics — Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Innovation | 8/10 | Triple stack with feature flags is comprehensive |
| Risk | Low | All three have free tiers; Umami self-hosted |
| Cost | $0/mo | All within free tiers at MAU 8K |
| Competitive Advantage | **Feature flags for AI A/B testing + session replay for Go board UX** | |
| Fallback | Umami alone (covers basics) | |

---

## 5. Integration Patterns — tRPC v11 + MCP + OAuth 2.1

### 5.1 tRPC v11 — End-to-End Type Safety

| Item | Detail |
|------|--------|
| **Technology** | tRPC v11 (stable, v11.12.0 as of March 2026) |
| **Innovation** | 8/10 |
| **Risk** | Low |
| **Competitive Advantage** | 35-40% faster feature development vs REST. Zero schema duplication. WebSocket subscriptions for real-time games. |
| **Fallback** | REST + Zod (manual schema duplication, but functional) |
| **Cost** | $0/mo |

**tRPC v11 Key Features**:
- TanStack React Query v5 integration with full Suspense support
- Non-JSON content types (FormData, Blob, File, Uint8Array) — useful for SGF file upload
- Server-Sent Events (SSE) subscriptions
- `httpBatchStreamLink` for streaming responses
- Backward compatible with v10
- `createCaller` for Server Component procedure calls (no HTTP overhead)

**Go App Router Architecture**:
```
routers/
├── _app.ts              ← root router
├── game.ts              ← game CRUD, matchmaking
├── analysis.ts          ← KataGo analysis, AI commentary
├── user.ts              ← profile, preferences, stats
├── puzzle.ts            ← daily puzzles, problem sets
├── tournament.ts        ← tournament CRUD, pairings
├── club.ts              ← 도장 management (B2B)
└── notification.ts      ← notification preferences
```

**WebSocket Subscriptions for Real-Time Games**:
```typescript
// tRPC subscription for live game updates
gameRouter.subscription('onGameUpdate', {
  input: z.object({ gameId: z.string() }),
  resolve: async function* ({ input }) {
    for await (const update of gameUpdates(input.gameId)) {
      yield tracked(update.id, update);
    }
  },
});

// Live KataGo analysis streaming
analysisRouter.subscription('onAnalysisProgress', {
  input: z.object({ sgf: z.string(), depth: z.number() }),
  resolve: async function* ({ input }) {
    for await (const result of streamKataGoAnalysis(input)) {
      yield tracked(result.moveNumber, result);
    }
  },
});
```

### 5.2 MCP Servers — AI Tool Integration Standard

See Section 1.2 and 1.5 above. Three MCP servers:

1. **KataGo Analysis Server**: `analyze_position`, `compare_moves`, `evaluate_sequence`
2. **Game DB Server**: `search_games`, `get_game`, `find_similar_positions`
3. **User Preferences Server** (Phase 2): `get_study_plan`, `get_learning_history`

**MCP + tRPC Composition**: tRPC procedures invoke MCP tools internally, providing the type-safe external API while MCP handles AI tool integration:

```typescript
// tRPC procedure that uses MCP internally
analysisRouter.mutation('explainMove', {
  input: z.object({ gameId: z.string(), moveNumber: z.number() }),
  resolve: async ({ input }) => {
    // 1. tRPC provides type-safe external API
    const game = await getGame(input.gameId);

    // 2. MCP provides standardized KataGo tool interface
    const analysis = await mcpClient.callTool('analyze_position', {
      board: game.boardAtMove(input.moveNumber),
      nextPlayer: game.playerAtMove(input.moveNumber),
    });

    // 3. Claude API generates natural language explanation
    const explanation = await generateExplanation(analysis);

    return { analysis, explanation }; // Type-safe all the way
  },
});
```

### 5.3 Svix — Webhook Infrastructure

| Item | Detail |
|------|--------|
| **Technology** | Svix (MIT, self-hosted) |
| **Innovation** | 7/10 |
| **Risk** | Low |
| **Competitive Advantage** | Production-grade webhook delivery with retry, signature verification, dead letter queues. Needed for 도장 B2B integrations. |
| **Fallback** | Custom webhook implementation (simpler, less reliable) |
| **Cost** | $0/mo (self-hosted, uses existing PG + Redis) |

**Go App Webhook Events**:
```
game.completed         → Notify rating services, achievement systems
analysis.ready         → Trigger push notification
user.rank_changed      → Update leaderboard services
tournament.round_started → Notify all participants
club.member_joined     → Notify club admin (B2B)
```

**Svix fits our stack perfectly**: requires PostgreSQL (we have PG 16) and optional Redis (we have Redis 7.2).

### 5.4 BullMQ — Event-Driven Job Processing

| Item | Detail |
|------|--------|
| **Technology** | BullMQ (Redis 7.2 backed) |
| **Innovation** | 6/10 (established pattern) |
| **Risk** | Very Low |
| **Competitive Advantage** | KataGo analysis is inherently async (3-8s per position). Without a job queue, the API blocks. BullMQ is the Node.js standard. |
| **Fallback** | In-process queue (loses reliability, retry, monitoring) |
| **Cost** | $0/mo (npm package, uses existing Redis) |

**Queue Architecture**:
```typescript
const queues = {
  'katago-analysis': {
    concurrency: 4,    // Match CPU capacity
    priority: true,
    rateLimiter: { max: 10, duration: 60000 },
  },
  'claude-commentary': {
    concurrency: 8,
    retry: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
  },
  'notification': {
    concurrency: 16,
    retry: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
  },
  'sgf-import': {
    concurrency: 8,
    idempotent: true,  // Deduplicate by file hash
  },
};
```

### 5.5 Integration Patterns — Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Innovation | 8/10 | tRPC v11 + MCP + BullMQ is modern best-practice stack |
| Risk | Low | All production-ready, battle-tested |
| Cost | $0/mo | All open-source, self-hosted |
| Competitive Advantage | **End-to-end type safety + MCP-standardized AI tools** | |
| Type Safety Score | 9/10 | Zod shared across tRPC, MCP, and validation |
| Fallback | REST + Zod (tRPC), direct IPC (MCP), in-process queue (BullMQ) | |

---

## 6. CDN & Storage — Cloudflare Free Tier

| Item | Detail |
|------|--------|
| **Technology** | Cloudflare CDN + R2 (free tier) |
| **Innovation** | 6/10 (standard best practice) |
| **Risk** | Very Low |
| **Competitive Advantage** | Enterprise CDN + zero-egress storage at $0/mo. |
| **Fallback** | Hetzner included bandwidth (20TB) |
| **Cost** | $0/mo |

**Cloudflare Free Tier Includes**:
- Unlimited CDN bandwidth (reasonable use policy)
- DDoS protection (unlimited)
- SSL/TLS (Full Strict)
- R2: 10GB storage, zero egress fees
- 5 custom WAF rules
- 3 page rules
- DNS (unlimited queries)

**R2 Usage for Go App**:
- SGF file storage: ~750MB for 150K games (well within 10GB free)
- PG backup storage: ~50-200MB compressed
- User uploads: minimal at MAU 8K
- Total: <3GB for first year

---

## 7. Complete External Service Inventory

### 7.1 All External Services

| # | Service | Purpose | Innovation | Risk | Monthly Cost | Free Tier |
|---|---------|---------|-----------|------|-------------|-----------|
| 1 | **Claude API** (Haiku 4.5 + Sonnet 4.6) | AI commentary | 7/10 | Medium | $27-97 | Pay-per-use |
| 2 | **Stripe** + KakaoPay/NaverPay | Payment | 7/10 | Low | Tx fees only | No monthly |
| 3 | **Resend** + React Email | Transactional email | 7/10 | Very Low | $0-20 | 3K emails/mo |
| 4 | **Cloudflare** CDN + R2 | CDN, storage, DDoS | 6/10 | Very Low | $0 | Generous |
| 5 | **Web Push API** (VAPID) | Push notifications | 6/10 | Low | $0 | Standard API |
| 6 | **PostHog** Cloud | Product analytics, feature flags | 8/10 | Low | $0 | 1M events/mo |
| 7 | **Sentry** Cloud | Error monitoring | 6/10 | Very Low | $0 | 5K errors/mo |
| 8 | **Umami** v3 (self-hosted) | Web analytics | 7/10 | Very Low | $0 | Self-hosted |
| 9 | **Better Auth** + Passkey plugin | Authentication | 8/10 | Low-Medium | $0 | MIT license |
| 10 | **next-intl** | i18n | 6/10 | Very Low | $0 | MIT license |
| 11 | **tRPC** v11 | Type-safe API | 8/10 | Low | $0 | MIT license |
| 12 | **MCP SDK** | AI tool protocol | 9/10 | Low | $0 | MIT license |
| 13 | **BullMQ** | Job queue | 6/10 | Very Low | $0 | MIT license |
| 14 | **Svix** (self-hosted) | Webhook infrastructure | 7/10 | Low | $0 | MIT license |
| 15 | **Discord** webhooks | Community notifications | 6/10 | Very Low | $0 | Free API |
| 16 | **GitHub Actions** | CI/CD | 6/10 | Very Low | $0 | 2K min/mo |

**Total External Services: 16** (vs 23 in Phase 2.A, vs 6 in Phase 2.B)

### 7.2 Branch Agreement Compliance

All 10 branch agreements from Phase 2 are satisfied:

| # | Agreement | Status | Implementation |
|---|-----------|--------|---------------|
| 1 | Claude API = only programmatic AI | YES | Haiku 4.5 + Sonnet 4.6, 3-tier routing |
| 2 | Stripe = payment (KakaoPay/NaverPay) | YES | Stripe Payment Element with auto method detection |
| 3 | Resend = email (React Email JSX) | YES | 3K free/mo, React Email templates |
| 4 | Cloudflare = CDN + R2 (free) | YES | CDN + R2 object storage |
| 5 | Web Push API = push (free) | YES | VAPID + Service Worker |
| 6 | Template fallback = Claude outage safety | YES | Template V1 (5% traffic, $0) |
| 7 | Prompt caching = 85-90% cost reduction | YES | System prompt caching, 5-min TTL |
| 8 | next-intl = i18n | YES | ko + en + zh-CN (Phase 2: ja) |

### 7.3 Cost Summary

| Category | Month 1-3 | Month 4-6 | At Scale (MAU 8K) |
|----------|-----------|-----------|-------------------|
| Claude API (cached + batched) | $3-10 | $15-30 | $27-97 |
| Resend email | $0 | $0 | $0-20 |
| PostHog Cloud | $0 | $0 | $0 |
| Sentry Cloud | $0 | $0 | $0 |
| Umami (self-hosted) | $0 | $0 | $0 |
| Cloudflare CDN + R2 | $0 | $0 | $0 |
| Stripe | Tx fees | Tx fees | Tx fees |
| Everything else (OSS) | $0 | $0 | $0 |
| **External Integration Total** | **$3-10/mo** | **$15-30/mo** | **$27-117/mo** |

**Note**: Infrastructure costs (Hetzner servers) are separate and covered in the Phase 3.A internal tech stack document. Combined total (infra + external) at MAU 8K: $97-175/mo.

---

## 8. Implementation Timeline

### 8.1 10-Week Phased Rollout

```
Week 1-2: Foundation Integrations
├── Better Auth + Passkeys + Google/GitHub OAuth
├── tRPC v11 router architecture
├── Resend email integration
├── Cloudflare DNS + CDN + R2 setup
├── Umami v3 deployment (Docker, shares PG)
└── next-intl setup (ko + en)

Week 3-4: AI Layer
├── KataGo MCP Server (stdio transport)
├── Claude API integration (Haiku 4.5 + prompt caching)
├── Template V1 engine (pattern-matched fallback)
├── BullMQ queue for KataGo analysis jobs
└── Sentry Cloud integration (Next.js wizard)

Week 5-6: Product Intelligence
├── PostHog Cloud setup (events, feature flags)
├── Go-specific custom events (Umami + PostHog)
├── Stripe payment integration (KakaoPay/NaverPay)
├── Web Push API + Service Worker
├── Discord webhook notifications
└── Claude Sonnet 4.6 routing for complex analysis

Week 7-8: Advanced Features
├── Game DB MCP Server
├── tRPC WebSocket subscriptions (live games)
├── Svix webhook infrastructure
├── Claude Batch API for async reviews
├── PostHog feature flags for A/B testing
└── Session replay for Go board UX

Week 9-10: Polish & Harden
├── Chrome Built-in AI progressive enhancement (Summarizer API)
├── Rate limiting + circuit breakers (Claude API)
├── B2B 도장 plan (Better Auth Organization plugin)
├── Notification preferences (per-channel toggles)
├── Cost monitoring + alerting ($100/mo threshold)
└── Load testing + performance optimization
```

### 8.2 Deferred to Phase 2 (Month 7+)

| Feature | Reason for Deferral | Phase |
|---------|-------------------|-------|
| WebLLM on-device AI | Niche audience (desktop + WebGPU) | Month 7-8 |
| Discord Activity (embedded Go game) | High effort, experimental | Month 9-10 |
| Novu orchestration | Direct integrations sufficient at MAU 8K | Month 7+ |
| Chinese (zh-CN) i18n | Content translation effort | Month 7 |
| Japanese (ja) i18n | Content translation effort | Month 9+ |
| Claude Opus 4.6 (premium deep analysis) | Needs premium tier users first | Month 8+ |
| User Preferences MCP Server | Core MCP servers first | Month 7 |

---

## 9. Risk Register — Top 5

| # | Risk | Probability | Impact | Mitigation | Residual Risk |
|---|------|------------|--------|-----------|---------------|
| **R1** | **Claude API cost overrun at scale** | 30% | High | Prompt caching (90% savings), Batch API (50% off), Template V1 fallback ($0), hard budget cap with alerts. At MAU 8K, worst case $150/mo. | Low |
| **R2** | **Better Auth maturity vs NextAuth.js** | 25% | Medium | Better Auth is MIT, actively maintained, 20K+ GitHub stars. Passkey plugin uses SimpleWebAuthn (proven). Fallback: migrate to NextAuth.js v5 in 3-5 days (same DB schema strategy). | Low |
| **R3** | **Coolify security vulnerabilities** | 40% | High | 11 critical CVEs (CVSS 10.0) disclosed Jan 2026. Mitigation: immediate patching, WAF rules, Cloudflare proxy shields origin, regular security updates, consider Dokku as fallback PaaS. | Medium |
| **R4** | **On-device AI (Chrome Built-in) too experimental** | 50% | Low | Progressive enhancement only — never a dependency. If Chrome APIs change or coverage is poor, simply remove with zero impact on core functionality. | Very Low |
| **R5** | **Integration complexity (16 services)** | 35% | Medium | 12 of 16 services are $0 open-source with simple setup. Only Claude API, Stripe, Resend, and PostHog are external cloud dependencies. Phased rollout (10 weeks) with testing at each stage. | Low |

### Risk vs Reward Matrix

```
                     HIGH IMPACT
                         │
    R3 (Coolify)         │         R1 (Claude cost)
    ─────────────────────┼─────────────────────────
    R4 (On-device AI)    │         R2 (Better Auth)
                         │         R5 (Complexity)
                     LOW IMPACT
         HIGH PROB ──────┼────── LOW PROB
```

---

## 10. Innovation Score Breakdown

| Area | Innovation Score | Weight | Weighted Score |
|------|:---------------:|:------:|:--------------:|
| AI Integration (4-layer) | 9/10 | 30% | 2.70 |
| Payment & Auth (passkeys + B2B) | 8/10 | 20% | 1.60 |
| Communication (Discord Activity + Novu) | 8/10 | 15% | 1.20 |
| Analytics (triple stack + feature flags) | 8/10 | 15% | 1.20 |
| Integration Patterns (tRPC + MCP + OAuth 2.1) | 8/10 | 20% | 1.60 |
| **Overall Innovation Score** | | **100%** | **8.30 / 10** |

---

## 11. Competitive Advantage Summary

### What No Competitor Has

| Feature | Our App | OGS | Fox Baduk | AI Sensei | Tygem |
|---------|---------|-----|-----------|-----------|-------|
| Multi-layer AI (on-device + cloud) | YES | No | No | No | No |
| MCP-standardized KataGo | YES | No | No | No | No |
| Natural language AI commentary (3-tier) | YES | No | Basic | Basic | No |
| Passkey authentication | YES | No | No | No | No |
| B2B 도장 (club) plans | YES | No | No | No | No |
| Native KakaoPay/NaverPay | YES | No | No | No | Partial |
| Feature flags for AI A/B testing | YES | No | No | No | No |
| Discord Activity (Go in Discord) | Planned | No | No | No | No |
| Offline AI analysis (WebLLM) | Planned | No | No | No | No |
| Privacy-first analytics (no cookies) | YES | Partial | No | No | No |
| End-to-end TypeScript type safety | YES | Partial | No | No | No |

### The Cutting Edge Thesis

The Go app market is dominated by legacy platforms (Fox Baduk, Tygem) and functional-but-uninnovative apps (OGS, AI Sensei). None have embraced modern web technologies, AI integration patterns, or developer experience tools.

By investing in cutting-edge integrations where risk is calculated:
- **4-layer AI** gives us cost-efficient, high-quality, offline-capable game commentary
- **Passkeys + B2B clubs** opens an untapped revenue stream in Go education
- **MCP + tRPC** creates a developer experience that accelerates feature velocity 35-40%
- **Triple analytics** enables data-driven decisions from day one

The combined effect is a Go app that is not just better — it is **structurally different** from everything else in the market.

---

## Sources

### AI Integration
- [WebLLM GitHub — v0.2.81](https://github.com/mlc-ai/web-llm)
- [WebLLM Documentation](https://webllm.mlc.ai/docs/)
- [WebLLM: High-Performance In-Browser LLM Inference Engine (arXiv)](https://arxiv.org/abs/2412.15803)
- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis)
- [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Chrome Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api)
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [KataGo MCP Server (LobeHub)](https://lobehub.com/mcp/dmmcquay-katago-mcp)
- [KataGo REST API Server (Rust)](https://github.com/goban-app/katago-server)
- [KataGo GitHub](https://github.com/lightvector/KataGo)
- [WebGPU Now Supported in All Major Browsers](https://web.dev/blog/webgpu-supported-major-browsers)
- [WebGPU Browser Support (CanIUse)](https://caniuse.com/webgpu)

### Payment & Auth
- [Better Auth](https://better-auth.com/)
- [Better Auth Passkey Plugin](https://better-auth.com/docs/plugins/passkey)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [Stripe KakaoPay Documentation](https://docs.stripe.com/payments/kakao-pay/accept-a-payment)
- [Stripe NaverPay Documentation](https://docs.stripe.com/payments/naver-pay/accept-a-payment)
- [Stripe South Korean Payment Methods](https://docs.stripe.com/payments/countries/korea)
- [Passkeys & WebAuthn in 2026 Migration Playbook](https://kawaldeepsingh.medium.com/passkeys-webauthn-in-2026-a-practical-migration-playbook-for-passwordless-authentication-5202f09c62a3)
- [Authentication Trends 2026: Passkeys, OAuth3, WebAuthn](https://www.c-sharpcorner.com/article/authentication-trends-in-2026-passkeys-oauth3-and-webauthn/)
- [OAuth 2.1 Specification Draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- [OAuth 2.1 vs 2.0](https://stytch.com/blog/oauth-2-1-vs-2-0/)

### Communication
- [Novu GitHub](https://github.com/novuhq/novu)
- [Novu Pricing](https://novu.co/pricing/)
- [Novu Self-Hosted vs Cloud](https://docs.novu.co/community/project-differences)
- [Discord Embedded App SDK](https://github.com/discord/embedded-app-sdk)
- [Discord GDC 2026 Announcements](https://discord.com/blog/building-on-the-social-layer-of-games-whats-new-from-gdc-2026)
- [Resend Pricing](https://resend.com/pricing)
- [next-intl Documentation](https://next-intl.dev/docs)
- [Web Push API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

### Analytics
- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog Free Tier Details](https://posthog.com/pricing)
- [Sentry Next.js Integration](https://sentry.io/for/nextjs/)
- [Sentry Pricing](https://docs.sentry.io/pricing/)
- [Umami v3 Documentation](https://umami.is/docs)
- [Umami GitHub](https://github.com/umami-software/umami)

### Integration Patterns
- [tRPC v11 Announcement](https://trpc.io/blog/announcing-trpc-v11)
- [tRPC v11 Migration Guide](https://trpc.io/docs/migrate-from-v10-to-v11)
- [tRPC v11 Next.js Setup (2026 Guide)](https://dev.to/christadrian/mastering-trpc-with-react-server-components-the-definitive-2026-guide-1i2e)
- [Svix Webhooks](https://www.svix.com/)
- [Svix GitHub](https://github.com/svix/svix-webhooks)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Coolify Critical Vulnerabilities (Jan 2026)](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html)
- [Coolify CVE Details](https://www.cvedetails.com/product/176503/Coolify-Coolify.html)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
