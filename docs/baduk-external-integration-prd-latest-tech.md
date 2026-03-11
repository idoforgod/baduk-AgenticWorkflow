# External Integration Technology PRD — Latest Technology First Perspective

**Version**: 1.0
**Date**: 2026-03-10
**Perspective**: Latest Technology First — Competitive Differentiation via Cutting-Edge Integrations
**Research Context**: Research 4 — External Integration Technology Deep-Dive, PHASE 2.A
**Pre-conditions**: Balanced Scenario (MAU 8K, MRR $5K), Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, KataGo CPU Eigen, Hetzner+Coolify. Budget $80-260/mo.
**CRITICAL CONSTRAINT**: OpenAI/Gemini = subscription accounts ONLY, NO API.

---

## Executive Summary

This PRD defines every external integration for the baduk platform from a **latest technology maximization** standpoint. The central thesis: OGS, KGS, Fox, and Tygem are all legacy platforms built on 2010-era technology stacks. Our competitive moat is not merely having KataGo — everyone has that — but in how we **integrate cutting-edge technologies** around KataGo to create experiences these incumbents cannot replicate without fundamental architectural rewrites.

Three technology bets define our differentiation:

1. **On-device AI layer** — WebLLM + Qwen3-1.7B running in-browser via WebGPU for zero-latency, zero-cost Go commentary in Korean/English/Japanese. No competitor has this.
2. **MCP-first architecture** — KataGo as an MCP Server, making our analysis engine composable with any MCP-capable AI client (Claude Desktop, Cursor, VS Code Copilot). This turns our platform into infrastructure, not just a product.
3. **Passkey-first authentication** — 69% of consumers already hold a passkey. We skip the password era entirely for new users, with Better Auth's native passkey support.

Combined monthly cost at MAU 8K: **$53-117/mo** — well within the $80-260 budget, leaving headroom for the GPU upgrade trigger.

---

## 1. Complete External Integration Stack

### 1.1 Service Inventory

| Category | Service | Version/Tier | Role | Monthly Cost (MAU 8K) | Innovation Score |
|----------|---------|-------------|------|----------------------|-----------------|
| **AI — Cloud** | Claude API (Anthropic) | Haiku 4.5 / Sonnet 4.5 | Game review NL explanations, teaching commentary | $33-65 | 8/10 |
| **AI — On-Device** | WebLLM + Qwen3-1.7B | WebLLM 0.2.81+ | Browser-side Go commentary, offline analysis | $0 | 10/10 |
| **AI — On-Device** | Chrome Built-in AI (Summarizer) | Chrome 140+ | Position summary for Chrome users (EN/JP only) | $0 | 7/10 |
| **AI — Engine** | KataGo Analysis Engine | v1.16.2+ | Go analysis, rank-calibrated play (HumanSL) | $0 (CPU) | 9/10 |
| **AI — Protocol** | KataGo MCP Server | MCP spec 2025-11-25 | Composable AI tool for external MCP clients | $0 | 10/10 |
| **Auth** | Better Auth | Latest (2026) | Authentication, passkeys, social login, MFA | $0 | 9/10 |
| **Payment** | Stripe (Checkout + Portal) | API v2025-12 | Subscription billing, KakaoPay, NaverPay | 2.9%+30c/tx | 7/10 |
| **Email** | Resend + React Email | Resend API v2 | Transactional email (JSX templates) | $0 (3K/mo free) | 8/10 |
| **Push** | Web Push API (VAPID) | Push API spec | Browser push notifications | $0 | 7/10 |
| **Realtime** | WebSocket (existing game WS) | ws 8.x | In-game chat, live spectating, notifications | $0 | 6/10 |
| **Community** | Discord Webhooks + Bot | Discord.js 14.x | Community bridge, game alerts, leaderboards | $0 | 7/10 |
| **Notifications** | Novu (self-hosted) | MIT, latest | Multi-channel notification orchestration | $0 | 8/10 |
| **Analytics** | PostHog Cloud | Free tier | Product analytics, session replay, feature flags, A/B | $0 | 9/10 |
| **Error Tracking** | Sentry | Free tier (5K errors) | Error tracking + AI/LLM monitoring | $0 | 9/10 |
| **Uptime** | Uptime Kuma | Self-hosted | HTTP/TCP/WS monitoring, Discord alerts | $0 | 6/10 |
| **CDN/Storage** | Cloudflare R2 + CDN | Free tier (10GB) | SGF files, game images, static assets | $0 | 8/10 |
| **Edge** | Cloudflare Workers | Free (100K req/day) | Rate limiting, geo-routing, edge caching | $0 | 8/10 |
| **Job Queue** | BullMQ | 5.70.x | Analysis queue, batch reviews, scheduled jobs | $0 (uses Redis) | 7/10 |
| **Webhooks** | Svix (self-hosted) | MIT, latest | Outbound webhook infrastructure (Stripe relay) | $0 | 8/10 |
| **Backup** | WAL-G + Hetzner Storage Box | Latest | PG PITR, encrypted backups | ~$4 | 6/10 |
| **i18n** | next-intl | Latest | 5 locales (en/ko/ja/zh-CN/zh-TW) | $0 | 7/10 |
| **API Layer** | tRPC v11 | 11.x | End-to-end type safety, SSE subscriptions | $0 | 9/10 |
| **ORM** | Drizzle ORM | v1.0-beta | PG 16 identity columns, type-safe queries | $0 | 8/10 |

### 1.2 Monthly Cost Summary at MAU 8K

| Category | Optimistic | Pessimistic |
|----------|-----------|-------------|
| Claude API (cache+batch optimized) | $33 | $65 |
| Stripe processing fees | $10 | $20 |
| Hetzner Storage Box (backup) | $4 | $4 |
| Resend (within free tier) | $0 | $0 |
| PostHog (within free tier) | $0 | $0 |
| Sentry (within free tier) | $0 | $0 |
| Cloudflare R2 (within free tier) | $0 | $0 |
| All self-hosted (Novu, Svix, Umami, Uptime Kuma) | $0 | $0 |
| **Total** | **$47** | **$89** |

This is deliberately aggressive on free tiers. The "pessimistic" scenario accounts for Claude API usage spikes during peak game hours but still lands within the $80-260 budget.

---

## 2. AI Integration Architecture

### 2.1 Four-Layer AI Stack

This is where we fundamentally diverge from every competitor. No Go platform has a multi-layer AI architecture. They all have "KataGo on a server." We have four layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 4: MCP Protocol Layer (KataGo MCP Server)               │
│  ├── Exposes KataGo as standardized MCP tools                  │
│  ├── Any MCP client (Claude Desktop, Cursor) can query our     │
│  │   analysis engine                                           │
│  └── Chess-MCP precedent proves the pattern works              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Cloud AI (Claude API — Anthropic)                    │
│  ├── Haiku 4.5 (80%): Move explanations, game summaries        │
│  ├── Sonnet 4.5 (15%): Complex teaching narratives             │
│  ├── Template (5%): Cached pattern responses                   │
│  └── Batch API: Post-game full reviews, puzzle generation      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: On-Device AI (WebLLM + Qwen3-1.7B via WebGPU)       │
│  ├── Zero-latency Go commentary in Korean/English/Japanese     │
│  ├── Offline analysis explanations (no server round-trip)      │
│  ├── Progressive enhancement: falls back to Layer 3 if no GPU  │
│  └── Chrome Built-in AI: Summarizer for EN/JP Chrome users     │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: KataGo Analysis Engine (Server-side, CPU Eigen)      │
│  ├── b18c384nbt main network: position evaluation              │
│  ├── b18c384nbt-humanv0 HumanSL: rank-calibrated play          │
│  ├── BullMQ job queue: priority-based analysis scheduling      │
│  └── Zobrist hash cache in Redis: dedup identical positions    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 On-Device AI — The Differentiator

**Why WebLLM + Qwen3-1.7B over Chrome Built-in AI:**

| Criterion | Chrome Built-in AI (Gemini Nano) | WebLLM + Qwen3-1.7B |
|-----------|--------------------------------|---------------------|
| Korean support | NO (only EN/ES/JP as of Chrome 140) | YES (119 languages incl. Korean) |
| Browser support | Chrome desktop only (no mobile) | All WebGPU browsers (Chrome, Edge, Firefox 141+, Safari 26) |
| Model control | Google-managed, no fine-tuning | Full control, can fine-tune on Go terminology |
| Offline capable | Yes | Yes |
| Hardware requirement | 4GB+ VRAM or 16GB RAM | 4GB+ VRAM recommended |
| Inference speed | Not disclosed | 20-60 tok/s on WebGPU |
| Customization | Predefined APIs only | OpenAI-compatible API, function calling |
| License | Chrome-proprietary | Apache 2.0 (Qwen3) |

**Implementation: Progressive Enhancement Model**

```typescript
// Capability detection at app boot
async function initOnDeviceAI(): Promise<AIProvider> {
  // Tier 1: WebLLM with Qwen3-1.7B (best — Korean + cross-browser)
  if (navigator.gpu && await checkVRAM() >= 4096) {
    const engine = await CreateMLCEngine("Qwen/Qwen3-1.7B-q4f16_1-MLC");
    return new WebLLMProvider(engine);
  }

  // Tier 2: Chrome Built-in AI (fallback — EN/JP only)
  if ('ai' in self && await self.ai.summarizer?.capabilities()) {
    return new ChromeAIProvider();
  }

  // Tier 3: Server-side Claude API (universal fallback)
  return new CloudAIProvider();
}
```

**Go-Specific On-Device Prompting:**

The on-device model receives KataGo JSON analysis output and generates natural language commentary:

```
System: You are a Go (baduk) teacher. Given KataGo analysis JSON, explain
the position to a {rank} player in {language}. Focus on: (1) why the top
move is best, (2) what the player's move missed, (3) one tactical/strategic
concept illustrated. Keep under 100 words.

User: {katago_analysis_json}
```

At Qwen3-1.7B's 20-60 tok/s on WebGPU, a 100-word explanation generates in 1-3 seconds — faster than any server round-trip.

**Cost Impact**: On-device AI handles an estimated 40-60% of explanation requests at MAU 8K, reducing Claude API calls proportionally. This saves $13-39/mo on Claude costs.

### 2.3 Cloud AI — Claude API Architecture

**Why Claude-only (no OpenAI/Gemini API):**
- OpenAI and Gemini are subscription accounts only per project constraint — API access is not available
- Claude API has 99.36% uptime, prompt caching (90% input cost reduction), and batch API (50% discount)
- Single vendor simplifies error handling, prompt engineering, and billing

**4-Tier Cost Optimization:**

| Tier | Model | Use Case | Cost/1M tokens (input/output) | % of Requests |
|------|-------|----------|-------------------------------|---------------|
| Template | None (cached response) | Common position patterns, FAQ | $0 | 50% |
| Haiku 4.5 | claude-haiku-4.5 | Single-move explanations, quick summaries | $1/$5 | 30% |
| Sonnet 4.5 | claude-sonnet-4.5 | Multi-move teaching narratives, game reviews | $3/$15 | 15% |
| Batch Haiku | claude-haiku-4.5 (batch) | Post-game full reviews, puzzle generation | $0.50/$2.50 | 5% |

**Prompt Caching Strategy:**

Every Claude request includes a cached system prompt (~2,000 tokens) containing Go domain knowledge, terminology glossary, and output format specifications. With prompt caching:
- Cache write: $1.25/1M tokens (Haiku), one-time per 5-minute TTL
- Cache read: $0.10/1M tokens (Haiku) — 90% reduction
- At 80%+ cache hit rate, effective input cost drops to ~$0.20/1M tokens

**Estimated Monthly Claude Spend at MAU 8K:**

Assumptions: 8,000 MAU, 30% DAU (2,400), 5 analysis requests/active session, 20 sessions/month per active user.
- Total monthly requests: 2,400 * 5 * 20 = 240,000
- After template (50%): 120,000 cloud requests
- After on-device offload (40% of remainder): 72,000 cloud requests
- Haiku (83%): 59,760 requests * ~500 tokens avg = 29.9M tokens → ~$8.95
- Sonnet (17%): 12,240 requests * ~800 tokens avg = 9.8M tokens → ~$22.05
- Prompt cache savings: -60%
- **Net monthly: ~$33-45**

**Circuit Breaker (opossum pattern):**

```typescript
import CircuitBreaker from 'opossum';

const claudeBreaker = new CircuitBreaker(callClaudeAPI, {
  timeout: 10000,        // 10s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000,   // 30s half-open
  fallback: (req) => templateFallback(req),  // cached response
});
```

### 2.4 MCP Integration — KataGo as MCP Server

**Why this is a 10/10 innovation play:**

MCP (Model Context Protocol) reached 97M+ monthly SDK downloads. It was donated to the Linux Foundation's Agentic AI Foundation in December 2025, with OpenAI and Block as co-founders. It is the standard for AI tool integration.

By exposing KataGo as an MCP Server, we make our analysis engine available to:
- Claude Desktop users who want Go analysis in their AI workflow
- Cursor/VS Code Copilot users building Go-related projects
- Any future MCP-compatible AI agent

**KataGo MCP Server Design:**

```typescript
// MCP Tool definitions for KataGo
const tools = [
  {
    name: "analyze_position",
    description: "Analyze a Go board position using KataGo engine",
    inputSchema: {
      type: "object",
      properties: {
        board_size: { type: "number", enum: [9, 13, 19] },
        moves: { type: "array", items: { type: "string" } }, // ["B[pd]", "W[dd]"]
        visits: { type: "number", default: 50 },
        komi: { type: "number", default: 6.5 },
      }
    }
  },
  {
    name: "rank_estimate",
    description: "Estimate rank of moves using HumanSL model",
    inputSchema: {
      type: "object",
      properties: {
        sgf: { type: "string" },
        player_color: { type: "string", enum: ["B", "W"] },
      }
    }
  },
  {
    name: "generate_puzzle",
    description: "Generate a Go puzzle (tsumego) from a game position",
    inputSchema: {
      type: "object",
      properties: {
        difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
        type: { type: "string", enum: ["life_and_death", "tesuji", "endgame"] },
      }
    }
  }
];
```

**Precedent**: Chess-MCP (chess engine as MCP server) already exists and validates this pattern for board games.

### 2.5 Innovation Score Summary — AI Layer

| Component | Innovation Score | Justification |
|-----------|-----------------|---------------|
| WebLLM + Qwen3-1.7B on-device | 10/10 | No Go platform has in-browser LLM commentary. Cross-browser Korean support. |
| KataGo MCP Server | 10/10 | No Go engine exposes MCP interface. Platform-as-infrastructure play. |
| Claude API 4-tier with prompt caching | 8/10 | Mature but optimally deployed. Cache+batch = 95% savings. |
| HumanSL rank-calibrated play | 9/10 | Released v1.15.0; few platforms integrate it. Unique teaching tool. |
| Chrome Built-in AI (supplementary) | 7/10 | Limited to EN/JP, Chrome-only. Useful but not primary. |

---

## 3. Payment & Auth

### 3.1 Recommendation: Better Auth + Stripe (Evolutionary with cutting-edge auth)

**Why Better Auth over Auth.js v5:**

Auth.js v5 is in maintenance mode following its merge into Better Auth (September 2025, YC $5M backing). Better Auth is the successor, not just an alternative:

| Feature | Auth.js v5 (maintenance) | Better Auth (active) |
|---------|-------------------------|---------------------|
| Development status | Maintenance mode | Active, YC-backed |
| Passkey support | Plugin (community) | Native, first-class |
| MCP auth | None | Built-in (agent-to-agent delegation) |
| Plugin architecture | Limited | Extensible plugin system |
| Drizzle adapter | Community | Official, maintained |
| Rate limiting | External (Upstash) | Built-in |
| Bot detection | None | Built-in behavioral analysis |
| Multi-tenancy | Manual | Built-in (teams, roles, invitations) |
| Session management | DB or JWT | Stateless option + DB option |

**Innovation Score: 9/10** — Better Auth's MCP auth support is uniquely forward-looking for an AI-native Go platform. Agent-to-agent delegation means our KataGo MCP Server can authenticate external AI agents securely.

### 3.2 Authentication Architecture

**Passkey-first strategy:**

69% of consumers now hold at least one passkey (up from 39% two years ago). 48% of the top 100 websites offer passkeys. We design for passkeys as the primary auth method, not an afterthought:

```
Registration Flow:
1. Email + passkey creation (primary path — 60% expected)
2. Social login: Google, Kakao, Discord (secondary — 35%)
3. Email + password (legacy fallback — 5%)

Login Flow:
1. Passkey (WebAuthn) → 93% success rate, <2s
2. Social OAuth 2.1 (PKCE mandatory) → auto-link to existing account
3. Email magic link → for password-forgotten recovery
```

**OAuth 2.1 compliance** (RFC 9700, published 2025):
- PKCE mandatory for all authorization code flows — no exceptions
- Implicit grant eliminated
- Exact redirect URI matching
- Better Auth handles all of this natively

**Social providers (4 for MVP, expandable):**

| Provider | Rationale | Target Users |
|----------|-----------|-------------|
| Google | Universal, 85%+ smartphone penetration | All |
| Kakao | #1 in Korea (52M MAU), KakaoTalk integration | Korean users |
| Discord | Go community hub, 25% increase in active game days (GDC 2026 data) | Community/competitive |
| Apple | Required for App Store if native app later | iOS users |

### 3.3 Payment Architecture — Stripe

**Why Stripe despite the Korea entity constraint:**

Stripe natively supports KakaoPay, NaverPay, and PAYCO since October 2024. For Korean users, this means familiar payment methods without a separate Korean payment gateway (PG).

**Entity solution**: Stripe Atlas ($500 one-time) for US LLC formation OR Japan entity if targeting JP market. This is a business decision, not a technical one. The technical integration is identical regardless of entity.

**Stripe integration pattern — zero custom billing UI:**

| Component | Tool | Custom Code |
|-----------|------|-------------|
| Checkout page | Stripe Checkout (hosted) | Zero |
| Subscription management | Stripe Customer Portal | Zero |
| Webhook processing | Svix (self-hosted) relay | Minimal |
| Invoice/receipt | Stripe Billing | Zero |

**Subscription tiers:**

| Tier | Price | Features | Stripe Price ID pattern |
|------|-------|----------|----------------------|
| Free | $0 | 3 games/day, 5 KataGo analyses/day | N/A |
| Pro | $7.99/mo ($79.99/yr) | Unlimited games, 50 analyses/day, game review | `price_pro_monthly` |
| Premium | $14.99/mo ($149.99/yr) | Unlimited everything, priority queue, HumanSL | `price_premium_monthly` |
| Dojang (B2B) | $49.99/mo | Per-seat, instructor dashboard, student tracking | `price_dojang_monthly` |

**Localized pricing:**
- KRW: 9,900/14,900/59,900 (psychological pricing)
- JPY: 980/1,480/5,980

**Webhook events to handle (via Svix relay):**

```
checkout.session.completed    → Activate subscription
customer.subscription.updated → Plan changes
customer.subscription.deleted → Cancellation
invoice.payment_failed        → Grace period (7 days)
invoice.paid                  → Reactivate after recovery
```

**Innovation Score: 7/10** — Stripe is mature, not cutting-edge. But the KakaoPay/NaverPay native support and zero-UI approach (Checkout + Portal) is the most modern Stripe integration pattern.

---

## 4. Communication

### 4.1 Recommendation: Hybrid (Rapid foundation + Robust orchestration)

We take Branch 3.1's speed and zero-cost foundation, but add Novu for notification orchestration and next-intl for internationalization — both from Branch 3.2.

**Why not pure Rapid (Branch 3.1):**
- A Go platform serving Korean, Japanese, English, and Chinese users MUST have i18n from day one. Retrofitting i18n is 3-5x more expensive than building it in.
- Novu (self-hosted, MIT) adds orchestration without adding cost.

**Why not pure Robust (Branch 3.2):**
- FCM adds complexity without clear benefit over Web Push API for a web-first platform
- 6 weeks for communication is too long when AI integration needs that time

### 4.2 Communication Stack

| Channel | Technology | Cost | Innovation Score |
|---------|-----------|------|-----------------|
| Email | Resend + React Email (JSX) | $0 (3K/mo free) | 8/10 |
| Push | Web Push API + `web-push` npm (VAPID) | $0 (forever free) | 7/10 |
| In-app | WebSocket rooms (extend game WS) | $0 | 6/10 |
| Community | Discord webhooks (stateless) + Discord.js bot | $0 | 7/10 |
| Orchestration | Novu (self-hosted, MIT) | $0 | 8/10 |
| i18n | next-intl (5 locales) | $0 | 7/10 |

**Total communication cost: $0/mo**

### 4.3 Email Architecture — Resend + React Email

React Email has 1.35M weekly npm downloads. JSX email templates mean our Next.js developers write emails with the same syntax as UI components:

```tsx
// emails/game-review-ready.tsx
import { Html, Head, Body, Container, Heading, Text, Button } from '@react-email/components';

export function GameReviewReady({ playerName, gameId, opponent }: Props) {
  return (
    <Html>
      <Body style={main}>
        <Container>
          <Heading>Your game review is ready, {playerName}</Heading>
          <Text>Your game against {opponent} has been analyzed by KataGo.</Text>
          <Button href={`https://app.baduk.io/games/${gameId}/review`}>
            View Review
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

Resend free tier: 3,000 emails/month. At MAU 8K with ~20% email engagement rate, that is 1,600 emails/month — well within free tier.

### 4.4 Push Notification — Web Push API

VAPID (Voluntary Application Server Identification) keys enable direct browser push without FCM dependency:

```typescript
import webPush from 'web-push';

webPush.setVapidDetails(
  'mailto:admin@baduk.io',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Supported events
type PushEvent =
  | 'game_challenge_received'
  | 'game_review_completed'
  | 'opponent_moved'
  | 'tournament_starting'
  | 'rank_achieved';
```

**Browser support in 2026**: Chrome, Edge, Firefox, Safari (macOS 13+ / iOS 16.4+) all support Web Push. Coverage: ~95% of target users.

### 4.5 Notification Orchestration — Novu

Novu self-hosted (MIT license) provides a unified notification API across all channels:

```typescript
import { Novu } from '@novu/node';

await novu.trigger('game-review-ready', {
  to: { subscriberId: userId },
  payload: { gameId, opponent, reviewUrl },
  overrides: {
    email: { replyTo: 'noreply@baduk.io' },
  }
});
// Novu handles: which channel, dedup, preferences, delivery
```

Six lines of code for the embeddable notification center in the app. Drag-and-drop workflow builder for non-technical team members to manage notification logic.

### 4.6 Internationalization — next-intl

5 locales from launch: `en`, `ko`, `ja`, `zh-CN`, `zh-TW`.

Go terminology glossary (shared with `translations/glossary.yaml`):

| English | Korean | Japanese | Chinese |
|---------|--------|----------|---------|
| Atari | 단수 | アタリ | 叫吃 |
| Ko | 패 | コウ | 劫 |
| Seki | 빅 | セキ | 双活 |
| Joseki | 정석 | 定石 | 定式 |
| Fuseki | 포석 | 布石 | 布局 |

**Innovation Score: 7/10** — i18n is table stakes for a global Go platform, but next-intl's App Router integration is the modern standard.

---

## 5. Analytics & Data

### 5.1 Recommendation: PostHog Cloud + Sentry + Umami (Belt and suspenders)

This is where I disagree with both Branch 4.1 (Umami-only) and Branch 4.2 (PostHog-only). We use **all three** because they serve distinct purposes at zero marginal cost:

| Tool | Purpose | Why Not Just One? |
|------|---------|-------------------|
| PostHog Cloud | Product analytics, session replay, feature flags, A/B testing | Free tier: 1M events, 5K replays. All-in-one product analytics. |
| Sentry | Error tracking + **AI/LLM monitoring** | Tracks Claude API errors, token usage, latency. PostHog cannot do this. |
| Umami v3 | Privacy-focused web analytics, SEO, public dashboard | Self-hosted on our PG 16. GDPR-compliant. PostHog is US-hosted. |

**Key insight**: Sentry's AI Agent Monitoring is the critical differentiator. No other error tracking tool can monitor LLM calls, token consumption, tool executions, and agent handoffs in production. For an AI-native Go platform, this is not optional.

### 5.2 PostHog Integration

```typescript
// posthog-provider.tsx — App Router integration
import posthog from 'posthog-js';

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: 'https://us.i.posthog.com',
  capture_pageview: false,  // Manual capture for SPA
  capture_pageleave: true,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '.sensitive',
  },
});

// Custom Go events
posthog.capture('game_completed', {
  board_size: 19,
  time_control: 'byoyomi_30_5',
  result: 'B+2.5',
  moves_count: 243,
  analysis_requested: true,
});

posthog.capture('ai_explanation_viewed', {
  source: 'on_device',  // or 'cloud'
  model: 'qwen3-1.7b',  // or 'claude-haiku-4.5'
  language: 'ko',
  latency_ms: 1200,
});
```

**Feature flags for progressive rollout:**
- `on_device_ai` — Gate WebLLM to users with sufficient hardware
- `mcp_server_public` — Gate public MCP endpoint
- `passkey_registration` — A/B test passkey-first vs password-first signup

**Free tier allocation at MAU 8K:**
- 1M product analytics events/month → ~125 events/user/month → sufficient
- 5K session replays/month → ~0.6 replays/user/month → sufficient for debugging
- 1M feature flag requests/month → ~125 flag checks/user/month → sufficient

### 5.3 Sentry AI Monitoring

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.replayIntegration(),
    // AI monitoring for Claude API calls
  ],
  tracesSampleRate: 0.1,  // 10% of transactions
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
});
```

LLM-specific tracking:
- Claude API latency per model tier (Haiku vs Sonnet)
- Token consumption per request type (move explanation vs game review)
- Error rate by prompt template version
- Cost anomaly alerts (>2x daily average)

### 5.4 Umami v3 (Self-Hosted)

Umami v3 runs on our existing PG 16 instance — no additional infrastructure. It is PostgreSQL-only (MySQL support dropped in v3).

Key advantage: **public analytics dashboard**. We can share a read-only analytics page showing active games, popular openings, rank distribution — building community trust and SEO.

Tracker size: 2KB gzipped. Zero performance impact.

### 5.5 Go Data Sources

| Source | Size | License | Use |
|--------|------|---------|-----|
| featurecat/go-dataset (GitHub) | 21.1M games | Free | Training data, puzzle generation |
| CWI Pro Games | 88K pro games | Research | Pro game database |
| OGS Game Records | 56M games | API access | Modern amateur games |
| @sabaki/sgf (npm) | Parser | MIT | SGF parsing/generation |

**Materialized views for game statistics** (PG 16):

```sql
CREATE MATERIALIZED VIEW mv_player_stats AS
SELECT
  player_id,
  COUNT(*) as total_games,
  COUNT(*) FILTER (WHERE result LIKE 'B+%' AND color = 'B'
    OR result LIKE 'W+%' AND color = 'W') as wins,
  AVG(move_count) as avg_game_length,
  MODE() WITHIN GROUP (ORDER BY opening_name) as favorite_opening
FROM games
JOIN game_players USING (game_id)
GROUP BY player_id;

-- 350-9000x speedup over raw queries (Branch 4.2 benchmark)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_player_stats;
```

### 5.6 Backup Strategy

| Component | Tool | Schedule | Retention |
|-----------|------|----------|-----------|
| PG 16 | WAL-G PITR | Continuous WAL + daily base | 30 days |
| Destination | Hetzner Storage Box (€3.81/mo) | — | Encrypted |
| Cloudflare R2 | R2 versioning | Automatic | 90 days |
| Redis | RDB snapshots | Every 15 min | 7 days |

**Innovation Score: 8/10** — PostHog + Sentry AI Monitoring is the most modern observability stack for an AI-native application. The triple-tool approach (PostHog + Sentry + Umami) provides zero-cost comprehensive coverage.

---

## 6. Integration Patterns

### 6.1 Recommendation: tRPC v11 + MCP + OAuth 2.1 (Modern patterns)

This is the most opinionated section. I advocate for **tRPC v11** over REST, **MCP** over custom protocols, and **OAuth 2.1** over OAuth 2.0.

### 6.2 API Layer — tRPC v11

**Why tRPC over REST:**

| Criterion | REST + Zod + Scalar | tRPC v11 |
|-----------|---------------------|----------|
| Type safety | Runtime (Zod validation) | Compile-time + runtime |
| Schema duplication | Yes (OpenAPI + Zod) | Zero (inferred from router) |
| Dev speed | Baseline | 35-40% faster (Branch 5.1 data) |
| WebSocket subscriptions | Manual setup | Built-in (SSE or WS) |
| Bundle size | ~15KB (Zod + validator) | ~7KB (core) |
| Ecosystem | Universal | TypeScript-only |
| External API consumers | Easy (OpenAPI) | Requires tRPC client or REST adapter |

**Trade-off acknowledged**: tRPC locks us into TypeScript clients. For external API consumers (MCP clients, mobile apps), we expose a REST-compatible layer via tRPC's `httpBatchLink` or a dedicated REST adapter for critical endpoints.

**tRPC Router Architecture:**

```typescript
// server/trpc/routers/game.ts
export const gameRouter = router({
  // Query: Get game analysis
  getAnalysis: protectedProcedure
    .input(z.object({
      gameId: z.string().uuid(),
      visits: z.number().min(1).max(1000).default(50),
    }))
    .query(async ({ input, ctx }) => {
      // Check Redis cache (Zobrist hash)
      const cached = await redis.get(`analysis:${input.gameId}:${input.visits}`);
      if (cached) return JSON.parse(cached);
      // Queue KataGo analysis
      return await analysisQueue.add('analyze', input, { priority: ctx.user.tier });
    }),

  // Subscription: Live game updates via SSE
  onGameUpdate: protectedProcedure
    .input(z.object({ gameId: z.string().uuid() }))
    .subscription(async function* ({ input }) {
      for await (const update of gameEventStream(input.gameId)) {
        yield update;
      }
    }),
});
```

**SSE for subscriptions** (tRPC v11 recommendation):
- No WebSocket server needed for non-game events (analysis results, notifications)
- Automatic reconnection with resume
- Game play itself uses existing WebSocket (different concern)

**Innovation Score: 9/10** — tRPC v11 with SSE subscriptions is the most modern API pattern for full-stack TypeScript apps.

### 6.3 Webhook Infrastructure — Svix (Self-Hosted)

Svix (MIT, written in Rust) provides production-grade webhook infrastructure:

```typescript
import { Svix } from 'svix';

const svix = new Svix(process.env.SVIX_AUTH_TOKEN);

// Register Stripe webhook endpoint
await svix.endpoint.create(appId, {
  url: 'https://api.baduk.io/webhooks/stripe',
  version: 1,
  filterTypes: [
    'checkout.session.completed',
    'customer.subscription.updated',
    'invoice.payment_failed',
  ],
});
```

Self-hosted Svix requirements: PG (existing) + Redis (existing). Zero additional infrastructure.

Features we get for free:
- Automatic retries with exponential backoff
- Webhook signature verification (HMAC-SHA256)
- Delivery monitoring dashboard
- Event replay for debugging

### 6.4 Job Queue — BullMQ 5.70.x

BullMQ runs on our existing Redis 7.2 instance:

```typescript
import { Queue, Worker } from 'bullmq';

const analysisQueue = new Queue('katago-analysis', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { age: 3600 },
    removeOnFail: { count: 1000 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

// Priority-based processing
const worker = new Worker('katago-analysis', processAnalysis, {
  connection: redis,
  concurrency: 4,  // Match KataGo process pool size
  limiter: {
    max: 100,
    duration: 60000,  // 100 analyses/minute rate limit
  },
});
```

**Job types:**

| Job | Priority | Timeout | Retry |
|-----|----------|---------|-------|
| Instant hint (5 visits) | 1 (highest) | 5s | 1 |
| Quick analysis (50 visits) | 2 | 30s | 2 |
| Full game review (500 visits) | 3 | 5min | 3 |
| Batch puzzle generation | 4 (lowest) | 30min | 3 |
| Post-game Claude review | 4 | 60s | 2 |

### 6.5 Edge Layer — Cloudflare Workers

Cloudflare Workers (100K requests/day free) handle edge concerns that should NOT hit the origin server:

```typescript
// workers/rate-limiter.ts
export default {
  async fetch(request: Request, env: Env) {
    const ip = request.headers.get('CF-Connecting-IP');
    const key = `rl:${ip}:${new Date().getMinutes()}`;

    const count = await env.KV.get(key);
    if (parseInt(count || '0') > 60) {
      return new Response('Rate limited', { status: 429 });
    }
    await env.KV.put(key, String((parseInt(count || '0')) + 1), { expirationTtl: 120 });

    // Pass through to origin
    return fetch(request);
  }
};
```

**Edge use cases:**
1. Rate limiting (per-IP, per-API-key)
2. SGF file serving from R2 (zero-egress CDN)
3. Geo-routing hints (serve Korean users from closest edge)
4. Bot detection pre-filter (reduce origin load)

### 6.6 Database Patterns — Drizzle ORM v1.0-beta

Drizzle ORM with PG 16 identity columns (modern PostgreSQL standard):

```typescript
// db/schema/games.ts
import { pgTable, text, integer, timestamp, jsonb, identity } from 'drizzle-orm/pg-core';

export const games = pgTable('games', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  blackPlayerId: integer().references(() => users.id),
  whitePlayerId: integer().references(() => users.id),
  boardSize: integer().notNull().default(19),
  sgf: text().notNull(),
  result: text(),  // "B+2.5", "W+R", "B+T"
  katagoAnalysis: jsonb(),
  createdAt: timestamp().defaultNow(),
});
```

**Cache strategy (Redis 7.2):**

| Cache Type | Key Pattern | TTL | Use |
|-----------|-------------|-----|-----|
| KataGo analysis | `analysis:{zobrist_hash}:{visits}` | 24h | Dedup identical positions |
| Player stats | `stats:{player_id}` | 5min | Materialized view cache |
| Session | `session:{session_id}` | 24h | Better Auth DB-backed |
| Rate limit | `rl:{ip}:{window}` | 2min | Sliding window |

**Innovation Score: 9/10** — tRPC v11 + Svix + BullMQ + Drizzle v1.0 is the most type-safe, modern Node.js integration stack available in 2026.

---

## 7. Innovation Score Summary

| Decision Area | Choice | Innovation Score | Competitor Parity? |
|---------------|--------|-----------------|-------------------|
| On-device AI (WebLLM + Qwen3) | Browser-side Go commentary | 10/10 | No competitor has this |
| KataGo MCP Server | Composable analysis engine | 10/10 | No competitor has this |
| Better Auth (passkey-first) | Modern auth with MCP support | 9/10 | No competitor has passkeys |
| tRPC v11 | End-to-end type safety | 9/10 | OGS uses REST, KGS uses Java RMI |
| PostHog + Sentry AI Monitoring | Product + AI observability | 9/10 | No competitor monitors AI costs |
| Claude API (4-tier + cache + batch) | NL explanations | 8/10 | No competitor has NL commentary |
| HumanSL rank-calibrated play | "AI plays like a 5-kyu" | 9/10 | Few competitors integrate HumanSL |
| Novu notification orchestration | Multi-channel, self-hosted | 8/10 | Competitors use basic email only |
| Resend + React Email | JSX email templates | 8/10 | Modern developer experience |
| Svix webhooks (self-hosted) | Production-grade webhooks | 8/10 | Rust-based, MIT, reliable |
| Cloudflare Workers edge | Edge rate limiting + CDN | 8/10 | Free tier, global edge |
| Drizzle ORM v1.0-beta | Type-safe PG 16 integration | 8/10 | Modern alternative to Prisma |
| Stripe (KakaoPay/NaverPay) | Korean payment methods | 7/10 | Mature but well-integrated |
| Web Push (VAPID) | Free push notifications | 7/10 | Standard, not cutting-edge |
| next-intl (5 locales) | Internationalization | 7/10 | Table stakes for global app |
| Discord integration | Community bridge | 7/10 | OGS has Discord, we match |
| Umami v3 (self-hosted) | Privacy web analytics | 6/10 | Reliable, not innovative |
| WAL-G backup | PG PITR | 6/10 | Standard practice |

**Weighted Innovation Score: 8.3/10**

---

## 8. Monthly Cost Breakdown at MAU 8K

| Line Item | Monthly Cost | Notes |
|-----------|-------------|-------|
| Claude API (Haiku 80% / Sonnet 15% / Batch 5%) | $33-65 | With prompt caching + on-device offload |
| Stripe processing fees | $10-20 | 2.9%+30c on ~$3,500 MRR |
| Hetzner Storage Box (backup) | ~$4 | WAL-G PITR destination |
| Resend email | $0 | 3K/mo free tier |
| PostHog analytics | $0 | 1M events/mo free |
| Sentry error tracking | $0 | 5K errors/mo free |
| Cloudflare R2 + CDN + Workers | $0 | 10GB + 100K req/day free |
| Web Push (VAPID) | $0 | Forever free |
| Discord webhooks/bot | $0 | Free |
| Novu (self-hosted) | $0 | MIT license |
| Svix (self-hosted) | $0 | MIT license |
| Umami v3 (self-hosted) | $0 | MIT, runs on existing PG |
| Uptime Kuma (self-hosted) | $0 | MIT |
| BullMQ | $0 | MIT, uses existing Redis |
| next-intl | $0 | MIT |
| tRPC v11 | $0 | MIT |
| Drizzle ORM | $0 | MIT |
| Better Auth | $0 | MIT |
| **TOTAL** | **$47-89** | **Well within $80-260 budget** |

**Budget headroom**: $191-213/mo remaining for GPU upgrade when MAU exceeds 8K or analysis queue exceeds 15s average wait time.

---

## 9. Implementation Timeline

### Phase 1: Foundation (Weeks 1-3)

| Week | Deliverable | Dependencies |
|------|-------------|-------------|
| 1 | Better Auth + passkeys + Google/Kakao OAuth | PG 16 schema |
| 1 | Drizzle ORM schema + migrations | PG 16 |
| 1 | tRPC v11 router scaffold | Next.js 15 |
| 2 | Stripe Checkout + Customer Portal + webhook via Svix | Better Auth (user model) |
| 2 | Resend email templates (welcome, game review, subscription) | — |
| 3 | Web Push API + VAPID setup | Better Auth (subscription model) |
| 3 | PostHog + Sentry integration | Next.js 15 app |

### Phase 2: AI Integration (Weeks 4-6)

| Week | Deliverable | Dependencies |
|------|-------------|-------------|
| 4 | KataGo Analysis Engine integration + BullMQ queue | Redis 7.2 |
| 4 | Claude API integration (Haiku tier + prompt caching) | — |
| 5 | WebLLM + Qwen3-1.7B on-device integration | WebGPU detection |
| 5 | HumanSL rank-calibrated play API | KataGo process pool |
| 6 | KataGo MCP Server (analyze_position, rank_estimate) | KataGo integration |
| 6 | Circuit breaker (opossum) + template fallback | Claude API |

### Phase 3: Communication & Community (Weeks 7-8)

| Week | Deliverable | Dependencies |
|------|-------------|-------------|
| 7 | Novu self-hosted + notification orchestration | Docker, PG |
| 7 | Discord webhooks + bot (game alerts, leaderboards) | — |
| 7 | next-intl i18n (5 locales) | Content freeze |
| 8 | Umami v3 self-hosted + public dashboard | PG 16 |
| 8 | Cloudflare Workers edge rate limiting | Cloudflare account |
| 8 | WAL-G backup + Hetzner Storage Box | PG 16 |

### Phase 4: Polish & Optimization (Weeks 9-10)

| Week | Deliverable | Dependencies |
|------|-------------|-------------|
| 9 | Feature flags (PostHog) for WebLLM/MCP rollout | PostHog |
| 9 | Sentry AI Monitoring for Claude API | Sentry SDK |
| 9 | Cloudflare R2 for SGF storage + CDN | — |
| 10 | Load testing + Redis cache tuning | All integrations |
| 10 | Uptime Kuma monitoring + Discord alerts | — |
| 10 | Security audit: OWASP Top 10, CSP headers, rate limiting | — |

**Total: 10 weeks**

This is 2 weeks longer than Branch 5.1's 8-week estimate because we include the on-device AI layer (WebLLM) and MCP Server, which neither Branch anticipated. The extra 2 weeks deliver our two highest-innovation-score differentiators.

---

## 10. Risk Register — Top 5 Risks

| # | Risk | Likelihood | Impact | Mitigation | Residual Risk |
|---|------|-----------|--------|------------|---------------|
| R1 | **WebLLM/Qwen3 on low-end devices**: Users with <4GB VRAM get degraded experience | High | Medium | Progressive enhancement: automatic fallback to Cloud AI (Layer 3). Feature flag gates on-device AI. PostHog tracks adoption by hardware tier. | Users on old hardware get cloud-only experience (still better than competitors). |
| R2 | **Claude API outage or price increase**: Single cloud AI vendor dependency | Medium | High | Circuit breaker (opossum) falls back to templates. Prompt caching reduces API call volume 80%+. On-device AI handles 40-60% of requests independently. 30-day prompt archive enables vendor switch. | 4-6 week migration to alternative API if permanent price change. |
| R3 | **Stripe Korea entity requirement**: Cannot process KRW payments without US/JP entity | Medium | High | Stripe Atlas ($500, 2-week process) for US LLC. Alternative: partner with Korean PG (Toss Payments) as fallback. | Business risk, not technical. Integration is identical. |
| R4 | **MCP spec breaking changes**: Spec is v2025-11-25, may evolve | Low | Medium | MCP is now under Linux Foundation governance (AAIF). Breaking changes require community consensus. Our MCP Server is a thin wrapper over KataGo JSON API — adaptation cost is low. | <1 week to adapt to any spec change. |
| R5 | **PostHog/Sentry free tier changes**: Vendor may reduce free allocations | Medium | Low | Umami v3 (self-hosted) is the backup for analytics. Sentry is replaceable by Bugsink (self-hosted, Sentry SDK compatible). PostHog can be self-hosted if needed. All three have open-source alternatives. | Migration path exists for every SaaS dependency. |

### Risk Appetite Statement

As the Latest Technology First perspective, I accept higher adoption risk (R1, R4) in exchange for competitive differentiation. The mitigations ensure no risk causes data loss or service outage — only degraded experience at worst.

---

## 11. Where I Disagree With Other Perspectives

### vs. Stability First (Perspective 2.B)

**They would say**: "Use Auth.js v5 — it is battle-tested. Better Auth is too new."

**I counter**: Auth.js v5 is in **maintenance mode**. Choosing a maintenance-mode library for a greenfield project in 2026 is actively choosing to accumulate technical debt from day one. Better Auth has YC backing ($5M), first-class passkey support, built-in MCP auth for AI agents, and a migration path FROM Auth.js. The stability argument for Auth.js is the stability of a project that has stopped innovating.

**What I sacrifice**: Auth.js's 6+ years of edge-case fixes and stack overflow answers.

### vs. Speed First (Perspective 2.C)

**They would say**: "Skip WebLLM/MCP — ship without on-device AI and add it later. Focus on core game play."

**I counter**: On-device AI and MCP are not features — they are **architectural decisions** that must be made at the integration layer from the start. Retrofitting WebLLM after the cloud-only AI architecture is hardened is 3x more expensive than building the progressive enhancement model from day one. MCP is even harder to retrofit because it requires restructuring the KataGo process interface.

**What I sacrifice**: 2 weeks of implementation time (10 weeks vs their likely 8 weeks).

### vs. Maintainability First (Perspective 2.D)

**They would say**: "REST is universally understood. tRPC locks you into TypeScript. One developer leaving means no one can maintain the tRPC router."

**I counter**: In 2026, finding a TypeScript developer who cannot work with tRPC is like finding a JavaScript developer in 2020 who cannot work with React. tRPC v11 has been stable for over a year with 35-40% dev speed improvements. The REST adapter handles external consumers. The type safety alone prevents entire categories of integration bugs that REST+Zod would allow at the boundary.

**What I sacrifice**: REST's universal client compatibility. Mitigated by REST adapter for the 3-5 endpoints that external consumers need.

### vs. Conservative AI (Branch 1.2)

**They would say**: "Claude-only, 4-tier pyramid, no on-device AI. One API dependency is enough risk."

**I counter**: Their approach makes Claude API a **single point of failure** for ALL AI features. My 4-layer architecture (KataGo + WebLLM + Chrome AI + Claude) means Claude outage degrades experience but does not eliminate AI functionality. On-device AI is not just about cost — it is about **resilience**. Additionally, their template-first approach (50% of requests) delivers inferior user experience compared to a real 1.7B parameter model running locally.

**What I sacrifice**: Simplicity of a single-vendor AI stack. Gained: resilience, zero-latency commentary, Korean language support that Chrome Built-in AI cannot provide.

### vs. Robust Communication (Branch 3.2)

**They would say**: "FCM for native push, full Discord.js bot, Redis Sorted Sets for leaderboards from day one."

**I counter**: FCM adds a Google dependency for push notifications when Web Push API (VAPID) achieves ~95% browser coverage in 2026 without any third-party dependency. Redis Sorted Sets for leaderboards is a great feature but belongs in Phase 2 once we have enough players to make leaderboards meaningful. I agree on Discord.js bot — it is zero-cost and high-value.

**What I sacrifice**: Native mobile push (FCM) and day-one leaderboards. Deferred to Phase 2.

### The Line I Will Not Cross

Despite my bias toward latest technology, I will NOT adopt:
- **Unfinished specifications** — MCP is v2025-11-25 (stable, Linux Foundation governed). OAuth 2.1 has RFC 9700. These are finalized.
- **Pre-1.0 runtimes** — Node.js 22 is LTS, Next.js 15 is stable, PG 16 is mature. The innovation is in the integration layer, not the foundation.
- **AI models without Korean** — Chrome Built-in AI's lack of Korean makes it supplementary, not primary. Qwen3's 119-language support including Korean is why it wins.
- **TOS-violating automations** — HARPA AI or similar tools that automate ChatGPT/Gemini subscriptions violate both OpenAI and Google TOS. I advocate latest technology, not terms-of-service evasion.

---

## Appendix A: Technology Version Matrix

| Technology | Version | Release Date | LTS/Stable? | EOL |
|-----------|---------|-------------|-------------|-----|
| Node.js | 22 LTS | Oct 2024 | LTS | Apr 2027 |
| Next.js | 15.x | Oct 2024 | Stable | — |
| PostgreSQL | 16 | Sep 2023 | Stable | Nov 2028 |
| Redis | 7.2 | Aug 2023 | Stable | — |
| KataGo | 1.16.2+ | Jun 2025 | Stable | — |
| Better Auth | Latest | 2025-2026 | Active | — |
| Drizzle ORM | 1.0-beta | 2026 | Beta | — |
| tRPC | 11.x | 2025 | Stable | — |
| BullMQ | 5.70.x | Mar 2026 | Stable | — |
| WebLLM | 0.2.81+ | 2026 | Active | — |
| Qwen3 | 1.7B | 2025 | Stable | — |
| MCP Spec | 2025-11-25 | Nov 2025 | Stable (AAIF) | — |
| OAuth 2.1 | RFC 9700 | 2025 | Ratified | — |
| PostHog | Cloud | — | SaaS | — |
| Sentry | @sentry/nextjs | — | Stable | — |
| Umami | v3 | Nov 2025 | Stable | — |
| Resend | API v2 | — | Stable | — |
| Novu | MIT, latest | — | Stable | — |
| Svix | MIT, latest | — | Stable | — |
| Cloudflare Workers | — | — | GA | — |
| Cloudflare R2 | — | — | GA | — |

## Appendix B: Decision Traceability

| Decision | Branch Source | Modified? | Rationale for Modification |
|----------|-------------|-----------|---------------------------|
| Claude 4-tier | B1.2 (Conservative) | Yes | Added on-device offload layer to reduce cloud dependency |
| WebLLM + Qwen3 | B1.1 (Aggressive) | No | Adopted as-is — solves Korean gap Chrome AI cannot |
| KataGo MCP Server | B1.1 + B5.1 | Combined | MCP from B5.1, KataGo from B1.1 |
| Better Auth | B2.1 (Evolutionary) | Yes | Upgraded from "Better Auth option" to "primary recommendation" |
| Stripe Checkout | B2.1 (Evolutionary) | No | Zero-custom-UI pattern adopted as-is |
| Passkey-first | B5.1 (Modern) | Enhanced | Elevated from "support passkeys" to "primary auth method" |
| Resend + React Email | B3.1 (Rapid) | No | Adopted as-is |
| Web Push (VAPID) | B3.1 (Rapid) | No | Adopted as-is, explicitly rejected FCM from B3.2 |
| Novu orchestration | B3.2 (Robust) | Yes | Adopted Novu but rejected FCM |
| next-intl 5 locales | B3.2 (Robust) | No | Adopted as-is — critical for global Go platform |
| PostHog Cloud | B4.2 (Practical) | Enhanced | Added Umami + Sentry triple-stack |
| Sentry AI Monitoring | B4.2 (Practical) | Enhanced | Emphasized AI/LLM monitoring as critical feature |
| Umami v3 | B4.1 (Minimal) | No | Adopted for privacy + public dashboard |
| tRPC v11 | B5.1 (Modern) | No | Adopted as-is |
| Svix webhooks | B5.1 (Modern) | Yes | Self-hosted (MIT) instead of cloud to save cost |
| BullMQ | B5.1 (Modern) | No | Adopted as-is |
| Cloudflare Workers | B5.1 (Modern) | No | Adopted for edge rate limiting |
| Drizzle ORM | B5.2 (Classical) | Enhanced | Used v1.0-beta with PG 16 identity columns |
| Redis cache patterns | B5.2 (Classical) | Adopted | Zobrist hash cache for KataGo dedup |
| opossum circuit breaker | B5.2 (Classical) | Adopted | Proven pattern, 9+ years production |
| Discord integration | B3.1 + B3.2 | Combined | Webhooks (B3.1) + bot (B3.2) |
| Go data sources | B4.1 + B4.2 | Combined | featurecat (B4.2) + CWI (B4.1) |
| WAL-G backup | B4.1 (Minimal) | No | Standard practice, adopted as-is |

---

*This PRD represents the Latest Technology First perspective. It deliberately maximizes innovation score (8.3/10 weighted average) while maintaining cost discipline ($47-89/mo). The two 10/10 innovation items — on-device AI commentary and KataGo MCP Server — are unique competitive advantages that no Go platform currently offers. The risk is higher adoption complexity, mitigated by progressive enhancement patterns and fallback chains at every layer.*

Sources:
- [Better Auth](https://better-auth.com/)
- [Better Auth Next.js Integration](https://better-auth.com/docs/integrations/next)
- [Auth.js merged into Better Auth — GitHub Discussion](https://github.com/nextauthjs/next-auth/discussions/13252)
- [MCP 2026 Complete Guide — Calmops](https://calmops.com/ai/model-context-protocol-mcp-2026-complete-guide/)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [One Year of MCP — Blog](http://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [WebLLM — GitHub](https://github.com/mlc-ai/web-llm)
- [WebLLM Documentation](https://webllm.mlc.ai/docs/)
- [Qwen3 — GitHub](https://github.com/QwenLM/Qwen3)
- [Qwen3 WebGPU — Hugging Face](https://huggingface.co/spaces/webml-community/qwen3-webgpu)
- [Qwen3-0.6B — Hugging Face](https://huggingface.co/Qwen/Qwen3-0.6B)
- [Chrome Built-in AI](https://developer.chrome.com/docs/ai/built-in)
- [Chrome AI APIs — Talent500](https://talent500.com/blog/chrome-ai-api-on-device-summarization-translation/)
- [WebGPU Browser AI — SitePoint](https://www.sitepoint.com/webgpu-browser-based-ai-future/)
- [TensorFlow.js WebGPU Backend — npm](https://www.npmjs.com/package/@tensorflow/tfjs-backend-webgpu)
- [Claude API Pricing 2026](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude API Pricing Breakdown — MetaCTO](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [tRPC v11 Announcement](https://trpc.io/blog/announcing-trpc-v11)
- [tRPC Subscriptions](https://trpc.io/docs/server/subscriptions)
- [Stripe KakaoPay Documentation](https://docs.stripe.com/payments/kakao-pay/accept-a-payment)
- [Stripe NaverPay Documentation](https://docs.stripe.com/payments/naver-pay/accept-a-payment)
- [Stripe South Korea Payment Methods](https://docs.stripe.com/payments/countries/korea)
- [Passkey Adoption Statistics 2026](https://state-of-passkeys.io/)
- [OAuth 2.1 — oauth.net](https://oauth.net/2.1/)
- [PKCE Downgrade Attacks — Medium](https://medium.com/@instatunnel/pkce-downgrade-attacks-why-oauth-2-1-is-no-longer-optional-887731326f24)
- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog — GitHub](https://github.com/PostHog/posthog)
- [Sentry AI/LLM Observability](https://sentry.io/solutions/ai-observability/)
- [Sentry AI Agent Monitoring](https://docs.sentry.io/platforms/javascript/guides/connect/ai-agent-monitoring/)
- [Resend Pricing](https://resend.com/pricing)
- [Resend Transactional Emails](https://resend.com/products/transactional-emails)
- [Umami v3 Launch](https://www.opensourceforu.com/2025/11/umami-v3-launches-with-new-interface-cohorts-and-advanced-segmentation/)
- [Umami — GitHub](https://github.com/umami-software/umami)
- [Novu — GitHub](https://github.com/novuhq/novu)
- [Novu Documentation](https://docs.novu.co/platform/what-is-novu)
- [Svix — GitHub](https://github.com/svix/svix-webhooks)
- [Svix Pricing](https://www.svix.com/pricing/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [BullMQ — npm](https://www.npmjs.com/package/bullmq)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Drizzle ORM v1.0-beta.2 Release](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2)
- [KataGo v1.15.0 HumanSL Release](https://github.com/lightvector/KataGo/releases/tag/v1.15.0)
- [KataGo — GitHub](https://github.com/lightvector/KataGo)
- [HARPA AI](https://harpa.ai/)
- [Web Push npm](https://www.npmjs.com/package/web-push)
- [Small Language Models 2026 Guide](https://localaimaster.com/blog/small-language-models-guide-2026)
- [WebLLM Browser AI Guide 2026](https://localaimaster.com/blog/webllm-browser-ai-guide)
- [Drizzle vs Prisma 2026 — Bytebase](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Top 5 Auth Solutions Next.js 2026 — WorkOS](https://workos.com/blog/top-authentication-solutions-nextjs-2026)
- [Auth Stats 2026 — Descope](https://www.descope.com/blog/post/auth-stats-2026)
