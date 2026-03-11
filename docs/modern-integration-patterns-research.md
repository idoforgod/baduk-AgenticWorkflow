# Modern Integration Patterns Research for AI Baduk App

> **Date**: 2026-03-10
> **Context**: AI baduk (Go) app — Node.js 22, Next.js 15, PG 16, Redis 7.2
> **Constraint**: OpenAI/Gemini via subscription only (no API); Claude API as primary LLM
> **Built by**: AI agents (patterns must be AI-agent-implementable)

---

## Table of Contents

1. [MCP (Model Context Protocol)](#1-mcp-model-context-protocol)
2. [Webhook Architecture](#2-webhook-architecture)
3. [OAuth 2.1 / OIDC Modern Patterns](#3-oauth-21--oidc-modern-patterns)
4. [Edge Computing & Middleware](#4-edge-computing--middleware)
5. [API Design Patterns for Game Platforms](#5-api-design-patterns-for-game-platforms)
6. [Integration Testing Patterns](#6-integration-testing-patterns)
7. [Summary Matrix](#7-summary-matrix)

---

## 1. MCP (Model Context Protocol)

### 1.1 What Is MCP and How Does It Work?

MCP (Model Context Protocol) is an open protocol created by Anthropic (November 2024) that standardizes how LLM applications connect to external data sources and tools. Think of it as **USB-C for AI**: a universal plug that any LLM client can use to talk to any tool server.

**Architecture:**

```
┌─────────────┐     MCP Protocol      ┌─────────────────┐
│  MCP Client  │◄─────────────────────►│   MCP Server     │
│  (Claude,    │   (JSON-RPC 2.0)      │  (Your tool)     │
│   OpenAI,    │                       │                  │
│   etc.)      │                       │  - Tools         │
│              │                       │  - Resources     │
└─────────────┘                       │  - Prompts       │
                                      └─────────────────┘
```

**Three Core Primitives:**

| Primitive | Description | Baduk App Use Case |
|-----------|------------|-------------------|
| **Tools** | Functions the LLM can call (with user approval) | `analyze_position`, `get_best_moves`, `parse_sgf` |
| **Resources** | File-like data the client can read | Game history database, SGF files, player stats |
| **Prompts** | Pre-written templates for specific tasks | "Analyze this game opening", "Explain this joseki" |

**Transport Mechanisms (as of spec 2025-11-25):**

| Transport | Use Case | Status |
|-----------|----------|--------|
| **stdio** | Local dev tools (Claude Code, IDEs) | Stable, dev-only |
| **Streamable HTTP** | Production deployments | **Recommended for production** |
| ~~SSE (deprecated)~~ | Legacy — replaced by Streamable HTTP | Deprecated |

Streamable HTTP uses a single endpoint (e.g., `https://api.baduk.app/mcp`) supporting POST and GET, with optional SSE streaming for real-time notifications. The server can optionally use Server-Sent Events to stream multiple messages, and clients can resume broken connections via `Last-Event-ID` header.

### 1.2 MCP for the Baduk App — Three Server Designs

#### A. KataGo Analysis MCP Server

KataGo already has an Analysis Engine that accepts JSON queries via stdin/stdout — a natural fit for MCP wrapping.

```typescript
// katago-mcp-server/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "katago-analysis",
  version: "1.0.0",
});

// Tool: Analyze a board position
server.tool(
  "analyze_position",
  "Run KataGo analysis on a board position",
  {
    boardXSize: z.number().default(19),
    boardYSize: z.number().default(19),
    moves: z.array(z.tuple([z.enum(["B", "W"]), z.string()])),
    maxVisits: z.number().default(1000),
    komi: z.number().default(6.5),
  },
  async ({ boardXSize, boardYSize, moves, maxVisits, komi }) => {
    // Spawn KataGo analysis engine, send query, parse response
    const result = await katagoAnalyze({ boardXSize, boardYSize, moves, maxVisits, komi });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          bestMoves: result.moveInfos.slice(0, 10),
          winRate: result.rootInfo.winrate,
          scoreLead: result.rootInfo.scoreLead,
          ownership: result.ownership,
        }, null, 2),
      }],
    };
  }
);

// Tool: Explain why a move is good/bad
server.tool(
  "explain_move",
  "Get KataGo's evaluation of a specific move in context",
  {
    moves: z.array(z.tuple([z.enum(["B", "W"]), z.string()])),
    targetMove: z.string(),
    player: z.enum(["B", "W"]),
  },
  async ({ moves, targetMove, player }) => {
    // Analyze with and without the target move, compare evaluations
    const [withMove, withoutMove] = await Promise.all([
      katagoAnalyze({ moves: [...moves, [player, targetMove]] }),
      katagoAnalyze({ moves }),
    ]);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          moveQuality: withMove.rootInfo.winrate - withoutMove.rootInfo.winrate,
          bestAlternative: withoutMove.moveInfos[0],
          policyPrior: withMove.policy,
        }, null, 2),
      }],
    };
  }
);
```

**Note**: An existing [KataGo MCP Server](https://lobehub.com/mcp/dmmcquay-katago-mcp) already exists in the community, providing game analysis, move explanation, and territory evaluation tools. This can serve as a reference implementation or starting point.

#### B. Game Database MCP Server

```typescript
server.resource(
  "game-history",
  "baduk://games/{gameId}",
  async (uri) => {
    const gameId = uri.pathname.split("/").pop();
    const game = await db.query("SELECT * FROM games WHERE id = $1", [gameId]);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(game.rows[0]),
      }],
    };
  }
);

server.tool(
  "query_games",
  "Search game history with filters",
  {
    player: z.string().optional(),
    dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
    result: z.enum(["B+", "W+", "Draw"]).optional(),
    limit: z.number().default(20),
  },
  async (filters) => {
    const games = await searchGames(filters);
    return { content: [{ type: "text", text: JSON.stringify(games) }] };
  }
);
```

#### C. SGF Parser MCP Server

Available TypeScript SGF parsers: `ts-sgf-parser`, `badukjs`, `@sabaki/sgf`. These can be wrapped as MCP tools for parsing, validating, and extracting game data from SGF files.

### 1.3 MCP vs Traditional Function Calling

| Aspect | MCP | Function Calling (e.g., Claude tools API) |
|--------|-----|------------------------------------------|
| **Protocol** | Open standard, vendor-neutral | Vendor-specific (Anthropic, OpenAI) |
| **Discovery** | Dynamic — client discovers tools at runtime | Static — defined at request time |
| **Reusability** | One server works with any MCP client | Must re-implement per vendor |
| **Multi-vendor** | Same KataGo MCP works with Claude, OpenAI, Gemini | Separate integrations per LLM |
| **Transport** | Streamable HTTP (production), stdio (dev) | HTTP API only |
| **Overhead** | Extra server process | Built into API call |
| **Maturity** | Rapidly maturing (97M+ monthly SDK downloads) | Proven (2+ years) |

**Recommendation for Baduk App**: Use **both**. MCP for development tooling and AI-assisted features (teaching, analysis). Traditional function calling for the production Claude API integration where you need tight control over tool definitions and responses. MCP servers can also serve production if deployed as remote Streamable HTTP endpoints.

### 1.4 Is MCP Relevant for Production?

**Yes, increasingly so.** MCP has evolved beyond a dev tool:

- **97M+ monthly SDK downloads** as of late 2025
- **Backed by Anthropic, OpenAI, Google, Microsoft** — cross-vendor standard
- **Remote MCP servers** via Streamable HTTP are designed for production multi-client scenarios
- **Vercel AI SDK** has native MCP client support
- **OpenAI Agents SDK** has native MCP support

However, for the baduk app's primary user-facing features (game play, analysis display), traditional REST/tRPC APIs remain the correct choice. MCP is most valuable for:
1. AI teaching features where Claude needs to call KataGo
2. Development tooling (Claude Code building/debugging the app)
3. Future integrations where new AI clients can discover and use your tools

| Maturity | AI Agent Implementability | Recommendation |
|----------|--------------------------|----------------|
| **Stable** (spec 2025-11-25, multi-vendor) | **High** — TypeScript SDK well-documented | Build KataGo MCP server for AI teaching features |

---

## 2. Webhook Architecture

### 2.1 Webhook Patterns for External Service Integration

The baduk app needs webhooks for two directions:

```
Inbound Webhooks (receive)          Outbound Webhooks (send)
┌──────────┐                        ┌──────────────┐
│  Stripe   │──── subscription ────►│              │
│  Discord  │◄── notifications ─────│  Baduk App   │──── game events ────►│ Discord │
│  KataGo   │                       │              │──── analysis done ──►│ Users   │
└──────────┘                        └──────────────┘
```

### 2.2 Stripe Webhooks — Subscription State Management

**Critical Events to Handle:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription, unlock AI analysis |
| `customer.subscription.updated` | Change tier (free → pro → unlimited) |
| `customer.subscription.deleted` | Downgrade to free tier |
| `invoice.payment_failed` | Grace period, notify user |
| `invoice.paid` | Clear any payment failure flags |

**Security Implementation:**

```typescript
// app/api/webhooks/stripe/route.ts (Next.js App Router)
import Stripe from "stripe";
import { headers } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text(); // MUST use raw body
  const signature = headers().get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: check if event already processed
  const processed = await redis.get(`stripe:event:${event.id}`);
  if (processed) {
    return new Response("Already processed", { status: 200 });
  }

  // Process event
  switch (event.type) {
    case "customer.subscription.updated":
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailure(event.data.object as Stripe.Invoice);
      break;
    // ... other events
  }

  // Mark as processed with 72-hour TTL (Stripe retries for 3 days)
  await redis.set(`stripe:event:${event.id}`, "1", "EX", 259200);
  return new Response("OK", { status: 200 });
}
```

**Key Security Practices (2025):**
- Always verify HMAC-SHA256 signature before processing
- Use raw request body (not parsed JSON) for verification
- Reject timestamps older than 300 seconds (replay prevention)
- Process idempotently (store event IDs in Redis with TTL)
- Rotate webhook secrets every 90 days
- Always use HTTPS endpoints

### 2.3 Discord Webhooks — Game Notifications

```typescript
// Discord Webhook for game events
async function notifyDiscord(event: GameEvent) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL!;

  const embed = {
    title: `Game ${event.type}`,
    description: formatGameDescription(event),
    color: event.winner === "B" ? 0x000000 : 0xffffff,
    fields: [
      { name: "Black", value: event.blackPlayer, inline: true },
      { name: "White", value: event.whitePlayer, inline: true },
      { name: "Result", value: event.result, inline: true },
    ],
    thumbnail: { url: event.boardImageUrl },
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
```

### 2.4 Retry and Dead-Letter Queue Architecture

**Multi-Stage Retry Lifecycle:**

```
Attempt 1 (immediate)
    ↓ fail
Attempt 2 (1 min, +jitter)
    ↓ fail
Attempt 3 (5 min, +jitter)
    ↓ fail
Attempt 4 (30 min, +jitter)
    ↓ fail
Attempt 5 (2 hours, +jitter)
    ↓ fail
→ Dead Letter Queue (manual inspection + replay)
```

**Implementation with BullMQ (Redis-backed):**

```typescript
import { Queue, Worker } from "bullmq";

const webhookQueue = new Queue("webhooks", { connection: redis });
const dlq = new Queue("webhooks-dlq", { connection: redis });

// Producer: enqueue webhook delivery
await webhookQueue.add("deliver", {
  url: subscriber.webhookUrl,
  payload: gameEvent,
  attempt: 0,
}, {
  attempts: 5,
  backoff: { type: "exponential", delay: 60000 },
});

// Consumer: process with retry
const worker = new Worker("webhooks", async (job) => {
  const response = await fetch(job.data.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Signature": signPayload(job.data.payload),
      "X-Webhook-ID": job.id,
      "X-Webhook-Timestamp": Date.now().toString(),
    },
    body: JSON.stringify(job.data.payload),
    signal: AbortSignal.timeout(10000), // 10s timeout
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}, { connection: redis });

// Failed after all retries → move to DLQ
worker.on("failed", async (job, err) => {
  if (job && job.attemptsMade >= 5) {
    await dlq.add("dead-letter", {
      originalJob: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});
```

**Jitter is critical**: Random jitter reduces synchronized retry spikes by over 80% in production systems.

### 2.5 Svix vs Build Your Own

| Factor | Svix | Build Your Own (BullMQ + Redis) |
|--------|------|-------------------------------|
| **Setup time** | Hours | Weeks |
| **Free tier** | 50K messages/month | Unlimited (your infra) |
| **Retry logic** | Built-in exponential backoff | Must implement |
| **DLQ** | Built-in | Must implement |
| **Customer portal** | Built-in (subscribers manage endpoints) | Must build |
| **Compliance** | SOC 2 Type II, HIPAA, GDPR | Your responsibility |
| **Cost at scale** | $490/mo for 1M messages | Redis hosting cost only |
| **Control** | Limited customization | Full control |

**Recommendation for Baduk App**: **Build your own** with BullMQ + Redis. Reasons:
1. You already have Redis 7.2 in the stack
2. Webhook volume will be moderate (game events, not enterprise SaaS scale)
3. Full control over retry logic and payload format
4. BullMQ is well-documented and AI-agent-implementable
5. Save $490+/mo — allocate to GPU compute for KataGo instead

If outbound webhooks for third-party developers become a major feature later, revisit Svix.

| Maturity | AI Agent Implementability | Recommendation |
|----------|--------------------------|----------------|
| **Proven** (Stripe pattern is industry standard) | **High** — BullMQ is straightforward | BullMQ + Redis for custom webhooks |

---

## 3. OAuth 2.1 / OIDC Modern Patterns

### 3.1 OAuth 2.1 — What Changed from 2.0

OAuth 2.1 (draft-ietf-oauth-v2-1-15) consolidates years of security RFCs into one specification. It does not introduce new features — it **codifies best practices and removes insecure patterns**.

| Change | OAuth 2.0 | OAuth 2.1 |
|--------|-----------|-----------|
| **PKCE** | Optional (recommended for public clients) | **Mandatory for ALL clients** |
| **Implicit Grant** | Allowed | **Removed** |
| **Resource Owner Password (ROPC)** | Allowed | **Removed** |
| **Redirect URI matching** | Loose matching allowed | **Exact string matching required** |
| **Refresh token rotation** | Optional | **Recommended (sender-constrained)** |
| **Bearer tokens in URI** | Allowed | **Prohibited** |

**Why it matters for the Baduk App**: If you implement OAuth 2.0 following 2.1 rules from the start, you get future-proof auth with no migration cost. NextAuth.js v5 / Auth.js already follows most of these patterns.

### 3.2 PKCE — Now Mandatory for All Clients

PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks:

```
Client                        Auth Server
  │                                │
  │ 1. Generate code_verifier      │
  │    (random 43-128 chars)       │
  │                                │
  │ 2. Compute code_challenge      │
  │    = SHA256(code_verifier)     │
  │                                │
  │ 3. /authorize?                 │
  │    code_challenge=xxx          │
  │    code_challenge_method=S256 ─┤
  │                                │
  │◄─── 4. authorization_code ─────│
  │                                │
  │ 5. /token                      │
  │    code=xxx                    │
  │    code_verifier=yyy ─────────►│
  │                                │
  │    Server verifies:            │
  │    SHA256(yyy) == xxx          │
  │                                │
  │◄─── 6. access_token ──────────│
```

OAuth 2.1 mandates that the Authorization Server **must reject** any authorization request lacking a `code_challenge`. Auth.js handles this automatically with supported providers.

### 3.3 Device Authorization Grant — Smart Board Devices

For a future smart baduk board (no keyboard, limited UI), the Device Authorization Grant flow is ideal:

```
Smart Board              Baduk Server              Auth Server
    │                         │                         │
    │ 1. POST /device/code    │                         │
    │ ──────────────────────► │ ──────────────────────► │
    │                         │                         │
    │◄── device_code +        │◄── device_code +        │
    │    user_code +          │    user_code +          │
    │    verification_uri     │    verification_uri     │
    │                         │                         │
    │ Display: "Go to         │                         │
    │  baduk.app/activate     │                         │
    │  Enter code: BDUK-1234" │                         │
    │                         │                         │
    │ Poll /token every 5s ──►│ ──────────────────────► │
    │                         │                         │
    │ (User enters code on    │                         │
    │  their phone/laptop)    │                         │
    │                         │                         │
    │◄── access_token ────────│◄── access_token ────────│
```

Combine with PKCE to mitigate device code interception on public clients.

### 3.4 Token Rotation and Refresh Patterns

**Auth.js v5 Refresh Token Rotation:**

```typescript
// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: { params: { access_type: "offline", prompt: "consent" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: save tokens
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at! * 1000,
        };
      }

      // Token still valid
      if (Date.now() < (token.expiresAt as number)) {
        return token;
      }

      // Token expired — refresh
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const refreshed = await response.json();
        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Date.now() + refreshed.expires_in * 1000,
          refreshToken: refreshed.refresh_token ?? token.refreshToken,
        };
      } catch (error) {
        return { ...token, error: "RefreshTokenError" };
      }
    },
  },
});
```

**Multi-tab race condition**: When multiple browser tabs trigger simultaneous refresh, they can all use the same (now-invalidated) refresh token. Mitigation: use a mutex/lock in the JWT callback or implement a short token validity window with database-backed sessions.

### 3.5 Passkeys / WebAuthn with Auth.js v5

**Status**: Auth.js v5 has **experimental** Passkey/WebAuthn support. Not yet recommended for production.

**Implementation requires:**
1. Database adapter (Prisma, Drizzle, etc.) with an `Authenticator` table
2. `@simplewebauthn/server` and `@simplewebauthn/browser` packages
3. Experimental feature flag enabled in Auth.js config

```typescript
// auth.ts
import Passkey from "next-auth/providers/passkey";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Passkey],
  adapter: PrismaAdapter(prisma),
  experimental: { enableWebAuthn: true },
});
```

**Alternative production-ready approaches:**
- **Hanko** — dedicated passkey provider with NextAuth integration
- **Corbado** — passkey-first auth with Next.js SDK
- **Clerk** — full auth platform with passkey support

**Recommendation**: Use Google/Apple sign-in as primary auth now. Add passkeys as a **secondary** auth method when Auth.js stabilizes WebAuthn support (likely mid-2026). Passkey adoption is growing rapidly (800M Google accounts, Amazon rolled out to all users).

### 3.6 Optimal Social Login Provider Count

**The "NASCAR Effect"**: Too many provider logos create decision paralysis. Research shows:
- Social login improves conversion by **20-40%** on average
- But each additional provider beyond the optimal count reduces conversion
- "You last used Google" badge reduces cognitive load

**Recommendation for Baduk App (Korean user base):**

| Provider | Reason | Priority |
|----------|--------|----------|
| **Google** | Universal, 90%+ Android in Korea | **Must have** |
| **Apple** | Required for iOS App Store | **Must have** |
| **Kakao** | #1 Korean social platform | **Must have** |
| **Email/Password** | Fallback for privacy-conscious users | **Must have** |
| Naver | #2 Korean platform | Nice to have |
| Passkeys | Future passwordless | Phase 2 |

**Maximum 3-4 social buttons + email**. Kakao is non-negotiable for a Korean-market app.

| Maturity | AI Agent Implementability | Recommendation |
|----------|--------------------------|----------------|
| **Stable** (Auth.js v5 is GA; Passkeys experimental) | **High** — Auth.js well-documented | Auth.js v5 + Google/Apple/Kakao + email |

---

## 4. Edge Computing & Middleware

### 4.1 Next.js Middleware for Auth & Feature Gating

Next.js Middleware runs **at the edge** (Vercel Edge Runtime or similar), before the request reaches your application. It executes in a lightweight V8 isolate — not Node.js — so no `fs`, `net`, or database drivers.

**Auth Protection Pattern:**

```typescript
// middleware.ts
import { auth } from "@/auth"; // Auth.js v5
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  if (pathname.startsWith("/api/webhooks")) return NextResponse.next();
  if (pathname === "/" || pathname.startsWith("/auth")) return NextResponse.next();

  // Protected routes
  if (!req.auth) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  // Feature gating by subscription tier
  if (pathname.startsWith("/analysis/unlimited") && req.auth.user.tier !== "unlimited") {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  // Pro-only KataGo deep analysis
  if (pathname.startsWith("/api/katago/deep") && req.auth.user.tier === "free") {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Key Constraints:**
- Edge Runtime does NOT support Node.js APIs (no `pg`, no `ioredis`)
- JWT verification works (it's just crypto)
- Database queries must go through API routes (Node.js runtime)
- Keep middleware fast (<50ms) — it runs on every matched request

### 4.2 Cloudflare Workers for Edge Processing

If deploying outside Vercel, Cloudflare Workers provide equivalent edge compute at 300+ global locations with <50ms TTFB.

**Geographic Routing for Korean Users:**

```typescript
// Cloudflare Worker
export default {
  async fetch(request: Request): Promise<Response> {
    const country = request.headers.get("CF-IPCountry"); // "KR" for Korea

    if (country === "KR") {
      // Route to Korean content, Korean KataGo server
      const koreanOrigin = "https://kr.api.baduk.app";
      return fetch(new URL(request.url.replace(request.headers.get("host")!, "kr.api.baduk.app")));
    }

    // Default: global origin
    return fetch(request);
  },
};
```

### 4.3 Edge Caching for Go Board Positions

Go board positions are highly cacheable — the same position always produces the same analysis:

```typescript
// Edge cache key: hash of board state
function boardCacheKey(moves: string[]): string {
  // Normalize move order for transposition equivalence
  const canonical = canonicalBoardState(moves);
  return `katago:analysis:${sha256(canonical)}`;
}

// In Next.js API route or Cloudflare Worker
export async function GET(req: Request) {
  const moves = parseMoves(req);
  const cacheKey = boardCacheKey(moves);

  // Check edge cache (Redis or Cloudflare KV)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      headers: {
        "Content-Type": "application/json",
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=86400", // 24h for analyzed positions
      },
    });
  }

  const analysis = await runKataGoAnalysis(moves);
  await redis.set(cacheKey, JSON.stringify(analysis), "EX", 86400);

  return new Response(JSON.stringify(analysis), {
    headers: { "Content-Type": "application/json", "X-Cache": "MISS" },
  });
}
```

**Cache layers:**

```
Browser Cache (5 min, stale-while-revalidate)
    ↓ miss
Edge Cache / CDN (1 hour for popular positions)
    ↓ miss
Redis Cache (24 hours for any analyzed position)
    ↓ miss
KataGo Analysis Engine (expensive, GPU-bound)
```

### 4.4 Rate Limiting at the Edge — Protecting KataGo

KataGo analysis is **GPU-expensive**. Rate limiting at the edge prevents abuse before requests reach your servers.

```typescript
// Using @upstash/ratelimit in Next.js Middleware
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
  analytics: true,
  prefix: "katago",
});

// In middleware.ts
if (pathname.startsWith("/api/katago")) {
  const userId = req.auth?.user?.id || ip;
  const { success, limit, reset, remaining } = await ratelimit.limit(userId);

  if (!success) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
        "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
      },
    });
  }
}
```

**Tiered Rate Limits:**

| Tier | KataGo Requests | Max Visits per Request |
|------|-----------------|----------------------|
| Free | 5/hour | 100 visits |
| Pro | 60/hour | 1,000 visits |
| Unlimited | 300/hour | 10,000 visits |

**Why Upstash for edge rate limiting**: Upstash Redis is designed for edge — it caches data while the edge function is "hot", reducing remote calls. The `@upstash/ratelimit` library has no cold start issues and adds minimal latency.

| Maturity | AI Agent Implementability | Recommendation |
|----------|--------------------------|----------------|
| **Proven** (Next.js Middleware GA, Upstash stable) | **High** — well-documented patterns | Next.js Middleware + Upstash rate limiting |

---

## 5. API Design Patterns for Game Platforms

### 5.1 REST vs GraphQL vs tRPC

**2025-2026 Consensus**: The landscape is co-existence and specialization, not replacement.

| Criterion | REST | GraphQL | tRPC |
|-----------|------|---------|------|
| **Type safety** | Manual (OpenAPI + codegen) | Schema-based (codegen) | **End-to-end automatic** |
| **Performance** | Fast (cacheable) | Slower for simple queries (~2x REST) | Fast (no overhead) |
| **Learning curve** | Low | Medium-High | Low (TypeScript devs) |
| **Dev speed** | Moderate | Moderate | **35-40% faster than REST** |
| **Public API** | **Best choice** | Good | Not suitable |
| **Caching** | HTTP caching built-in | Complex (normalized cache) | No built-in caching |
| **Real-time** | Polling/SSE | Subscriptions | Subscriptions |
| **Tooling** | Massive ecosystem | Good (Apollo, Relay) | Growing (but TS-only) |
| **AI agent implementability** | **Highest** — universal | **High** — well-documented | **Highest** — TypeScript native |

**Recommendation for Baduk App — Hybrid Approach:**

```
┌──────────────────────────────────────────┐
│           API Architecture               │
│                                          │
│  Internal (Next.js ↔ Server):            │
│  ┌─────────────────────────────────┐     │
│  │         tRPC (primary)          │     │
│  │  • Game CRUD                    │     │
│  │  • User management              │     │
│  │  • Analysis requests            │     │
│  │  • Subscription management      │     │
│  └─────────────────────────────────┘     │
│                                          │
│  External (third-party / mobile):        │
│  ┌─────────────────────────────────┐     │
│  │       REST (secondary)          │     │
│  │  • Public game data             │     │
│  │  • Leaderboards                 │     │
│  │  • SGF export                   │     │
│  │  • Future mobile app            │     │
│  └─────────────────────────────────┘     │
│                                          │
│  Real-time:                              │
│  ┌─────────────────────────────────┐     │
│  │   WebSocket + SSE (dedicated)   │     │
│  │  • Live game moves (WebSocket)  │     │
│  │  • Analysis progress (SSE)      │     │
│  │  • Notifications (SSE)          │     │
│  └─────────────────────────────────┘     │
└──────────────────────────────────────────┘
```

**Why tRPC as primary:**
- 35-40% faster feature development compared to REST
- End-to-end type safety with zero codegen
- Perfect fit for Next.js 15 + TypeScript monorepo
- Refactoring safety (change a return type, see all broken consumers instantly)
- AI agents (Claude Code) excel at TypeScript — tRPC is maximally AI-implementable

**Why not GraphQL:**
- Adds complexity without clear benefit for a single-frontend app
- Performance overhead (~2x REST for simple queries)
- Better suited for multi-client scenarios (mobile, web, partner APIs)
- If mobile apps come later, consider adding a GraphQL layer then

### 5.2 tRPC Setup for Baduk App

```typescript
// server/trpc/router.ts
import { router, protectedProcedure, publicProcedure } from "./trpc";
import { z } from "zod";

export const appRouter = router({
  game: router({
    create: protectedProcedure
      .input(z.object({
        boardSize: z.enum(["9", "13", "19"]),
        komi: z.number().default(6.5),
        timeControl: z.object({
          mainTime: z.number(),
          byoyomi: z.number(),
          periods: z.number(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.game.create({ data: { ...input, blackId: ctx.user.id } });
      }),

    getById: publicProcedure
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        return ctx.db.game.findUnique({ where: { id: input }, include: { moves: true } });
      }),

    listByPlayer: protectedProcedure
      .input(z.object({ limit: z.number().default(20), cursor: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        // Cursor-based pagination
        const games = await ctx.db.game.findMany({
          where: { OR: [{ blackId: ctx.user.id }, { whiteId: ctx.user.id }] },
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          orderBy: { createdAt: "desc" },
        });
        const hasMore = games.length > input.limit;
        return { games: games.slice(0, input.limit), nextCursor: hasMore ? games[input.limit].id : null };
      }),
  }),

  analysis: router({
    requestAnalysis: protectedProcedure
      .input(z.object({
        gameId: z.string().uuid(),
        moveNumber: z.number().optional(),
        depth: z.enum(["quick", "standard", "deep"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check rate limit and subscription tier
        await checkAnalysisQuota(ctx.user);
        const job = await analysisQueue.add("analyze", { ...input, userId: ctx.user.id });
        return { jobId: job.id, estimatedTime: estimateTime(input.depth) };
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

### 5.3 Real-Time Patterns Beyond WebSocket

| Protocol | Direction | Use Case | Browser Support | Status |
|----------|-----------|----------|-----------------|--------|
| **WebSocket** | Bidirectional | Live game play (moves, clock) | Universal | **Proven** |
| **SSE** | Server → Client | Analysis progress, notifications | Universal | **Proven** |
| **WebTransport** | Bidirectional, multiplexed | Future: low-latency game play | Chrome, Edge (no Safari) | **Experimental** |

**When to use which for the Baduk App:**

```
WebSocket:
  ├── Live game moves (both players send moves)
  ├── Game clock synchronization
  └── Chat during game

SSE (Server-Sent Events):
  ├── KataGo analysis progress (% complete, partial results)
  ├── Game result notifications
  ├── Leaderboard updates
  └── Server announcements

REST + Polling:
  └── Non-real-time data (profile, game history, settings)
```

**SSE for Analysis Progress (simpler than WebSocket for unidirectional streams):**

```typescript
// app/api/analysis/[jobId]/stream/route.ts
export async function GET(req: Request, { params }: { params: { jobId: string } }) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Subscribe to analysis progress via Redis pub/sub
      const subscriber = redis.duplicate();
      await subscriber.subscribe(`analysis:${params.jobId}`);

      subscriber.on("message", (channel, message) => {
        const update = JSON.parse(message);
        send(update);
        if (update.status === "complete" || update.status === "error") {
          subscriber.unsubscribe();
          controller.close();
        }
      });

      // Send initial status
      const status = await redis.get(`analysis:${params.jobId}:status`);
      send({ status: status || "queued" });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 5.4 API Versioning Strategy

**Recommendation: Stripe-style hybrid (evolution + explicit versions):**

1. **Default**: Evolve the API — add optional fields, new endpoints. Never remove or rename existing fields.
2. **Breaking changes**: Version bump with dated versions (`2026-03-10`). Pin clients to a version.
3. **Deprecation timeline**: 6-month announcement → 12-month active support → 18-month removal.

For tRPC (internal): versioning is less critical because type changes are caught at compile time. Use feature flags instead.

For REST (public): URI path versioning (`/api/v1/games`, `/api/v2/games`) — simplest, most discoverable.

### 5.5 Rate Limiting Patterns

```typescript
// Tiered rate limiting with sliding window
const rateLimits: Record<string, { requests: number; window: string }> = {
  free:      { requests: 100, window: "1 h" },
  pro:       { requests: 1000, window: "1 h" },
  unlimited: { requests: 5000, window: "1 h" },
};

// Per-endpoint limits (on top of global)
const endpointLimits: Record<string, { requests: number; window: string }> = {
  "/api/katago/analyze":  { requests: 10, window: "1 m" },  // Expensive
  "/api/games":           { requests: 60, window: "1 m" },  // Moderate
  "/api/sgf/export":      { requests: 5,  window: "1 m" },  // Heavy I/O
};
```

| Maturity | AI Agent Implementability | Recommendation |
|----------|--------------------------|----------------|
| **Proven** (tRPC v11, WebSocket, SSE all stable) | **Highest** — TypeScript end-to-end | tRPC (internal) + REST (public) + WebSocket/SSE (real-time) |

---

## 6. Integration Testing Patterns

### 6.1 Testing Strategy Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Testing Pyramid                         │
│                                                         │
│              ┌─────────────┐                            │
│              │   E2E Tests  │  Playwright               │
│              │  (few, slow) │  (critical user flows)    │
│            ┌─┴─────────────┴─┐                          │
│            │Integration Tests │  Testcontainers          │
│            │(moderate, medium)│  + MSW + Pact            │
│          ┌─┴─────────────────┴─┐                        │
│          │    Unit Tests        │  Vitest                │
│          │ (many, fast)         │  (pure logic, utils)   │
│          └─────────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Testcontainers — Real Database & Redis Testing

Testcontainers spins up real PostgreSQL and Redis in Docker containers for each test suite. No mocks, no "it works on my machine" — tests run against the same versions as production.

```typescript
// tests/setup/testcontainers.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, StartedTestContainer } from "testcontainers";

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;

export async function setupTestInfra() {
  // Start PostgreSQL 16 (matching production)
  pgContainer = await new PostgreSqlContainer("postgres:16")
    .withDatabase("baduk_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  // Start Redis 7.2 (matching production)
  redisContainer = await new GenericContainer("redis:7.2")
    .withExposedPorts(6379)
    .start();

  // Set environment for the app
  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

  // Run migrations
  await runPrismaMigrations(process.env.DATABASE_URL);
}

export async function teardownTestInfra() {
  await pgContainer?.stop();
  await redisContainer?.stop();
}
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/setup/testcontainers.ts"],
    testTimeout: 30000, // Containers need time to start
  },
});
```

```typescript
// tests/integration/game.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/server/trpc/router";
import { createTestContext } from "../helpers/context";

describe("Game CRUD Integration", () => {
  beforeEach(async () => {
    await cleanDatabase(); // Truncate tables between tests
  });

  it("creates a game and retrieves it with moves", async () => {
    const ctx = createTestContext({ userId: "user-1", tier: "pro" });
    const caller = appRouter.createCaller(ctx);

    const game = await caller.game.create({
      boardSize: "19",
      komi: 6.5,
      timeControl: { mainTime: 600, byoyomi: 30, periods: 5 },
    });

    expect(game.id).toBeDefined();
    expect(game.boardSize).toBe("19");

    const retrieved = await caller.game.getById(game.id);
    expect(retrieved?.moves).toEqual([]);
  });
});
```

### 6.3 MSW (Mock Service Worker) — External API Mocking

MSW intercepts HTTP requests at the network level — no changes to your application code. Use it to mock external services (Stripe, Discord, KataGo) during development and testing.

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  // Mock Stripe subscription check
  http.get("https://api.stripe.com/v1/subscriptions/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: "active",
      items: {
        data: [{ price: { id: "price_pro_monthly", product: "prod_baduk_pro" } }],
      },
    });
  }),

  // Mock KataGo analysis (for unit tests — integration tests use real KataGo)
  http.post("http://localhost:8080/api/analyze", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      moveInfos: [
        { move: "Q16", visits: 1000, winrate: 0.55, scoreLead: 2.3 },
        { move: "D4", visits: 800, winrate: 0.54, scoreLead: 2.1 },
      ],
      rootInfo: { winrate: 0.52, scoreLead: 1.5 },
    });
  }),

  // Mock Discord webhook
  http.post("https://discord.com/api/webhooks/*", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

```typescript
// tests/setup/msw.ts
import { setupServer } from "msw/node";
import { handlers } from "../mocks/handlers";

export const mockServer = setupServer(...handlers);

// In vitest global setup
beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
```

**MSW Key Benefits:**
- Same mock definitions work in browser (development) AND Node.js (testing)
- Intercepts at network level — no need to mock `fetch` or `axios`
- `onUnhandledRequest: "error"` catches accidental real API calls in tests
- Supports HTTP, GraphQL, and WebSocket

### 6.4 Contract Testing with Pact

Use Pact for consumer-driven contract testing to ensure your app and external services stay compatible.

```typescript
// tests/contracts/stripe-consumer.test.ts
import { PactV4, MatchersV3 } from "@pact-foundation/pact";

const provider = new PactV4({
  consumer: "BadukApp",
  provider: "StripeAPI",
});

describe("Stripe Subscription Contract", () => {
  it("retrieves an active subscription", async () => {
    await provider
      .addInteraction()
      .given("subscription sub_123 exists and is active")
      .uponReceiving("a request for subscription details")
      .withRequest("GET", "/v1/subscriptions/sub_123", (builder) => {
        builder.headers({ Authorization: MatchersV3.regex(/^Bearer sk_test_/, "Bearer sk_test_xxx") });
      })
      .willRespondWith(200, (builder) => {
        builder.jsonBody({
          id: "sub_123",
          status: "active",
          current_period_end: MatchersV3.integer(1735689600),
        });
      })
      .executeTest(async (mockServer) => {
        const stripe = new Stripe("sk_test_xxx", { apiVersion: "2024-12-18" });
        stripe.setHost(mockServer.url);
        const sub = await stripe.subscriptions.retrieve("sub_123");
        expect(sub.status).toBe("active");
      });
  });
});
```

**When to use Pact vs MSW:**
- **MSW**: Unit/integration tests where you control the mock behavior
- **Pact**: Verify that your assumptions about external APIs are correct (publish contracts to a Pact Broker)

### 6.5 Stripe Test Mode + CLI

Stripe provides a complete test environment:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

**Stripe Test Mode features:**
- Test API keys (`sk_test_*`, `pk_test_*`)
- Test card numbers (4242 4242 4242 4242 for success, 4000 0000 0000 0002 for decline)
- Test clocks for simulating subscription lifecycle over time
- CLI for local webhook testing without exposing localhost

### 6.6 CI/CD Pipeline Integration

```yaml
# .github/workflows/test.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      # Note: Testcontainers will spin up its own containers,
      # but you need Docker-in-Docker or a Docker socket
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Unit tests (fast, no containers)
        run: pnpm test:unit

      - name: Integration tests (Testcontainers)
        run: pnpm test:integration
        env:
          TESTCONTAINERS_RYUK_DISABLED: "false"

      - name: Contract tests (Pact)
        run: pnpm test:contracts

      - name: Publish Pact contracts
        if: github.ref == 'refs/heads/main'
        run: pnpm pact:publish
        env:
          PACT_BROKER_BASE_URL: ${{ secrets.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

**CI Testing Tiers:**

| Tier | Tools | Speed | When |
|------|-------|-------|------|
| Unit | Vitest + MSW | ~10s | Every push |
| Integration | Vitest + Testcontainers | ~2 min | Every push |
| Contract | Pact | ~30s | Every push |
| E2E | Playwright | ~5 min | PR merge to main |

| Maturity | AI Agent Implementability | Recommendation |
|----------|--------------------------|----------------|
| **Proven** (all tools are stable, widely adopted) | **High** — Vitest/MSW/Testcontainers well-documented | Full testing pyramid with Testcontainers + MSW + Pact |

---

## 7. Summary Matrix

| Pattern | Maturity | AI Implementability | Recommended Tech | Priority |
|---------|----------|--------------------|--------------------|----------|
| **MCP** | Stable | High | `@modelcontextprotocol/sdk` (TypeScript) | P1 — KataGo MCP server |
| **Webhooks (inbound)** | Proven | High | Stripe SDK + raw body verification | P1 — Stripe subscription |
| **Webhooks (outbound)** | Proven | High | BullMQ + Redis (custom) | P2 — Discord notifications |
| **OAuth 2.1 / Auth** | Stable | High | Auth.js v5 + Google/Apple/Kakao | P1 — User auth |
| **Passkeys** | Experimental | Medium | Wait for Auth.js stabilization | P3 — Future |
| **Edge Middleware** | Proven | High | Next.js Middleware + Upstash | P1 — Auth + rate limiting |
| **Edge Caching** | Proven | High | Redis + CDN layered cache | P1 — KataGo results |
| **tRPC** | Proven | Highest | tRPC v11 + Next.js 15 | P1 — Internal API |
| **REST** | Proven | Highest | Next.js Route Handlers | P2 — Public API |
| **WebSocket** | Proven | High | Socket.io or ws | P1 — Live game play |
| **SSE** | Proven | High | Native ReadableStream | P1 — Analysis streaming |
| **Testcontainers** | Proven | High | `@testcontainers/postgresql` + Redis | P1 — Integration tests |
| **MSW** | Proven | High | `msw` v2 | P1 — External API mocking |
| **Contract Testing** | Proven | Medium-High | Pact v4 | P2 — API stability |
| **Geographic Routing** | Proven | High | Cloudflare Workers / Vercel Edge | P2 — Korean user optimization |

### Recommended Libraries/Tools

| Tool | Version | Purpose |
|------|---------|---------|
| `@modelcontextprotocol/sdk` | latest | MCP server/client |
| `next-auth` (Auth.js v5) | v5.x | Authentication |
| `@trpc/server` + `@trpc/client` | v11.x | Type-safe API |
| `stripe` | latest | Payment integration |
| `bullmq` | latest | Job queue + webhook retry |
| `@upstash/ratelimit` | latest | Edge rate limiting |
| `@upstash/redis` | latest | Edge Redis client |
| `msw` | v2.x | API mocking |
| `@testcontainers/postgresql` | latest | Integration testing |
| `@pact-foundation/pact` | v4.x | Contract testing |
| `zod` | v3.x | Schema validation (shared by tRPC + MCP) |
| `vitest` | latest | Test runner |
| `ts-sgf-parser` or `badukjs` | latest | SGF parsing |

---

## Sources

### MCP (Model Context Protocol)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [Introducing the Model Context Protocol — Anthropic](https://www.anthropic.com/news/model-context-protocol)
- [MCP TypeScript SDK — GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- [Build an MCP Server — Official Docs](https://modelcontextprotocol.io/docs/develop/build-server)
- [A Year of MCP: From Internal Experiment to Industry Standard — Pento](https://www.pento.ai/blog/a-year-of-mcp-2025-review)
- [MCP Enterprise Adoption Guide 2025](https://guptadeepak.com/the-complete-guide-to-model-context-protocol-mcp-enterprise-adoption-market-trends-and-implementation-strategies/)
- [Why MCP Deprecated SSE and Went with Streamable HTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [KataGo MCP Server — LobeHub](https://lobehub.com/mcp/dmmcquay-katago-mcp)
- [KataGo Analysis Engine Documentation](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [KataGo REST API Server — GitHub](https://github.com/hauensteina/katago-server)
- [Build Your First MCP Server with TypeScript — Hackteam](https://hackteam.io/blog/build-your-first-mcp-server-with-typescript-in-under-10-minutes/)
- [How to Build a Custom MCP Server with TypeScript — freeCodeCamp](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)

### Webhook Architecture
- [Webhook Architecture Patterns for Real-Time Integrations — Technori](https://technori.com/news/webhook-architecture-real-time-integrations/)
- [Webhook Retry Best Practices — Svix](https://www.svix.com/resources/webhook-best-practices/retries/)
- [Dead Letter Queue — Svix](https://www.svix.com/resources/glossary/dead-letter-queue/)
- [Building Resilient Webhook Handlers in AWS — Stripe](https://stripe.dev/blog/building-resilient-webhook-handlers-aws-dlqs-stripe-events)
- [Receive Stripe Events in Your Webhook Endpoint — Stripe Docs](https://docs.stripe.com/webhooks)
- [Stripe Webhook Signature Verification — Stripe Docs](https://docs.stripe.com/webhooks/signature)
- [Stripe Webhooks Implementation Guide 2026 — Hooklistener](https://www.hooklistener.com/learn/stripe-webhooks-implementation)
- [Svix — Webhooks as a Service](https://www.svix.com/)
- [Webhooks Build vs Buy — Svix](https://www.svix.com/build-vs-buy/)
- [Webhooks as a Service Comparison — HookRelay](https://www.hookrelay.dev/blog/webhooks-as-a-service-comparison/)

### OAuth 2.1 / OIDC
- [OAuth 2.1 — oauth.net](https://oauth.net/2.1/)
- [OAuth 2.1: What's New, What's Gone — WorkOS](https://workos.com/blog/oauth-2-1-whats-new)
- [OAuth 2.1 vs 2.0: What Developers Need to Know — Stytch](https://stytch.com/blog/oauth-2-1-vs-2-0/)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/rfc9728/)
- [Introducing RFC 9728 — WorkOS](https://workos.com/blog/introducing-rfc-9728-say-hello-to-standardized-oauth-2-0-resource-metadata)
- [PKCE Downgrade Attacks: Why OAuth 2.1 is No Longer Optional](https://medium.com/@instatunnel/pkce-downgrade-attacks-why-oauth-2-1-is-no-longer-optional-887731326f24)
- [Auth.js Passkey Provider](https://authjs.dev/getting-started/providers/passkey)
- [Auth.js WebAuthn Guide](https://authjs.dev/getting-started/authentication/webauthn)
- [Passkeys in Production with Next.js and WebAuthn](https://medium.com/better-dev-nextjs-react/passkeys-in-production-with-next-js-and-webauthn-26ee038aea2c)
- [Add Passkeys to Your Next.js App Using NextAuth — Hanko](https://www.hanko.io/blog/passkeys-nextjs-nextauth)
- [Auth.js Refresh Token Rotation Guide](https://authjs.dev/guides/refresh-token-rotation)
- [Migrating to Auth.js v5](https://authjs.dev/getting-started/migrating-to-v5)

### Edge Computing
- [Rate Limiting Your Next.js App with Vercel Edge — Upstash](https://upstash.com/blog/edge-rate-limiting)
- [Next.js 16 Middleware & Edge Functions Patterns 2025](https://medium.com/@mernstackdevbykevin/next-js-16-middleware-edge-functions-latest-patterns-in-2025-8ab2653bc9de)
- [Next.js Middleware: Authentication & Edge Logic Patterns — LearnWebCraft](https://learnwebcraft.com/learn/nextjs/middleware-auth)
- [Edge Computing: Cloudflare Workers Dev Guide 2026](https://www.digitalapplied.com/blog/edge-computing-cloudflare-workers-development-guide-2026)
- [Cloudflare Workers Cache API Docs](https://developers.cloudflare.com/workers/runtime-apis/cache/)

### API Design
- [REST vs GraphQL vs tRPC vs gRPC in 2026: The Definitive Guide — DEV Community](https://dev.to/pockit_tools/rest-vs-graphql-vs-trpc-vs-grpc-in-2026-the-definitive-guide-to-choosing-your-api-layer-1j8m)
- [REST vs GraphQL vs tRPC: The Ultimate API Design Guide for 2026 — DEV Community](https://dev.to/dataformathub/rest-vs-graphql-vs-trpc-the-ultimate-api-design-guide-for-2026-8n3)
- [REST vs GraphQL vs tRPC: I Built Three Versions — Medium](https://navanathjadhav.medium.com/rest-vs-graphql-vs-trpc-i-built-three-versions-of-the-same-backend-946ddb0fc950)
- [WebSockets vs SSE vs WebTransport: Which Real-Time Protocol Is Best? — Aptuz](https://www.aptuz.com/blog/websockets-vs-sse-vs-webtransports/)
- [WebSockets vs SSE vs Polling vs WebRTC vs WebTransport — RxDB](https://rxdb.info/articles/websockets-sse-polling-webrtc-webtransport.html)
- [API Versioning Best Practices — Postman](https://www.postman.com/api-platform/api-versioning/)
- [API Versioning Best Practices — Redocly](https://redocly.com/blog/api-versioning-best-practices)

### Testing
- [How to Write Integration Tests for Node.js APIs with Testcontainers](https://oneuptime.com/blog/post/2026-01-06-nodejs-integration-tests-testcontainers/view)
- [Integration Testing Node.js Postgres with Vitest & Testcontainers](https://nikolamilovic.com/posts/2025-4-15-integration-testing-node-vitest-testcontainers/)
- [Getting Started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/)
- [Testcontainers for NodeJS](https://node.testcontainers.org/)
- [Mock Service Worker — Official Docs](https://mswjs.io/)
- [MSW Node.js Integration](https://mswjs.io/docs/integrations/node/)
- [Contract Testing with Pact — Best Practices in 2025](https://www.sachith.co.uk/contract-testing-with-pact-best-practices-in-2025-practical-guide-feb-10-2026/)
- [Pact.js — npm](https://www.npmjs.com/package/@pact-foundation/pact)
- [Contract Testing for MCP Using Pact.io](https://markaicode.com/contract-testing-pact-io-model-context-protocol/)

### Social Login & Auth UX
- [How to Use Social Login to Drive App Growth — Auth0](https://auth0.com/blog/how-to-use-social-login-to-drive-your-apps-growth/)
- [Tackle Social Login Experience — Logto](https://blog.logto.io/tackle-social-login-experience)
- [Login Friction Kills Conversion — Corbado](https://www.corbado.com/blog/login-friction-kills-conversion)

### SGF Libraries
- [ts-sgf-parser — npm](https://www.npmjs.com/package/ts-sgf-parser)
- [badukjs — GitHub](https://github.com/espadrine/badukjs)
- [Go Libraries Collection — GitHub](https://github.com/waltheri/go-libraries)
