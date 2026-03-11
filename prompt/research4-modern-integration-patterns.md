# Research 4: Modern Integration Patterns — MCP, OAuth 2.1, tRPC, Edge

> **Branch**: Integration Patterns — Modern (MCP, OAuth 2.1, tRPC, Edge)
>
> **Perspective**: "Modern patterns reduce boilerplate, improve type safety, and enable better tooling. The investment in newer patterns pays dividends."
>
> **Date**: 2026-03-10
> **Stack Context**: Node.js 22 LTS, Next.js 15, PostgreSQL 16, Redis 7.2, Claude API, KataGo, ws (WebSocket)

---

## 1. MCP (Model Context Protocol) — DEEP DIVE

### 1.1 Current State and Maturity

**Protocol Status**: Production-ready. MCP specification reached v2025-11-25 (latest stable), with the June 2025 release adding structured tool outputs, OAuth-based authorization, elicitation for server-initiated user interactions, and improved security best practices. The protocol moved to the Linux Foundation in late 2025 with backing from AWS, Microsoft, and Cloudflare.

**Ecosystem Scale**: 97M+ monthly SDK downloads. The PulseMCP registry lists over 5,500 servers as of October 2025. Remote MCP servers grew 4x since May 2025, signaling production deployment maturity.

**Vendor Adoption**:
- **Anthropic**: Native Claude support (originator)
- **OpenAI**: Adopted MCP across Agents SDK, Responses API, and ChatGPT desktop (March 2025)
- **Google DeepMind**: Confirmed Gemini MCP support (April 2025)
- **Google Cloud**: Launched 4 official remote MCP servers (December 2025)
- **AWS**: 60+ official MCP servers spanning the full AWS product catalog
- **Microsoft**: Integration into Windows AI Foundry

**Maturity Rating**: 9/10 — Industry standard with multi-vendor backing.

### 1.2 MCP vs Function Calling vs Tool Use

| Dimension | Function Calling / Tool Use | MCP |
|-----------|---------------------------|-----|
| **Position in pipeline** | Front-end: LLM converts user input into calls | Back-end: discovery, invocation, response management |
| **Vendor lock-in** | High — each provider has its own schema (OpenAI's function calling, Anthropic's tool use, etc.) | Low — open protocol, vendor-independent |
| **Context cost** | Every tool definition must be included in every API request (token-expensive at 50+ tools) | Tools live server-side, discovered on-demand |
| **Reusability** | In-line definitions, not shareable | Servers are reusable, version-controlled, independently testable |
| **Setup complexity** | Minimal for <5 tools | Higher initial investment, pays off at scale |
| **Best for** | Quick prototypes, 2-3 custom functions | Production systems, multi-tool ecosystems, team sharing |

**Recommendation for Go app**: Use MCP for the KataGo analysis server and game database — these are complex, reusable tool integrations that benefit from MCP's discovery and structured output. Use direct Claude tool use for simple, UI-triggered operations (e.g., "explain this move").

### 1.3 TypeScript SDK for MCP Server Development

**Official SDK**: `@modelcontextprotocol/sdk` — runs on Node.js, Bun, and Deno.

**Core Primitives**:
- **Tools**: Functions the AI can call (fetching data, running calculations, triggering actions)
- **Resources**: Read-only data identified by URIs (file contents, database records)
- **Prompts**: Reusable templates for common interaction patterns

**Key Dependencies**: Peer dependency on `zod` (v3.25+) for schema validation — aligns perfectly with our tRPC stack.

**Framework Adapters**: Optional thin middleware packages for Express and Hono. For Next.js, the API route handler pattern works directly.

**Alternative Framework**: FastMCP — a higher-level TypeScript framework for building MCP servers with less boilerplate. Supports tool annotations as of the MCP 2025-03-26 specification.

**Debugging**: `@modelcontextprotocol/inspector` package for visual inspection and debugging of MCP server functionality.

### 1.4 Go App MCP Server Architecture

Three custom MCP servers for the Go app:

#### MCP Server 1: KataGo Analysis Server

```
Tools:
  - analyze_position(sgf, depth, komi) → { winrate, top_moves[], territory_map }
  - compare_moves(sgf, played, best) → { quality_delta, explanation }
  - estimate_territory(sgf) → { territory_map, score_estimate }

Resources:
  - katago://models/{model_id} — available KataGo models
  - katago://config — current analysis configuration

Prompts:
  - "explain_move" — template for Claude to explain a move using KataGo data
  - "review_game" — template for full game review with KataGo analysis
```

#### MCP Server 2: Game Database Server

```
Tools:
  - search_games(player?, date_range?, opening?) → Game[]
  - get_game(game_id) → { sgf, metadata, analysis_cache }
  - find_similar_positions(sgf, move_number) → SimilarPosition[]

Resources:
  - games://recent — recently played games
  - games://professional/{player} — professional player game collections
  - games://openings/{pattern} — opening pattern database
```

#### MCP Server 3: User Preferences Server

```
Tools:
  - get_study_plan(user_id) → StudyPlan
  - update_skill_assessment(user_id, assessment) → void
  - get_learning_history(user_id) → LearningEvent[]

Resources:
  - user://preferences — display, analysis, and notification settings
  - user://rank_history — rank progression over time
```

### 1.5 MCP + Claude Integration Flow

```
User asks: "Why was move 42 bad?"
     ↓
Claude receives question + MCP tool catalog
     ↓
Claude calls MCP tool: analyze_position(sgf, move=42)
     ↓
KataGo MCP Server executes analysis, returns structured data
     ↓
Claude calls MCP tool: compare_moves(sgf, played=Q16, best=R14)
     ↓
Claude synthesizes KataGo data into natural language explanation
     ↓
"Move 42 (Q16) lost approximately 3.2 points of expected value.
 The recommended move was R14, which maintains pressure on the
 white group while strengthening your position in the corner..."
```

### 1.6 Security Considerations

**Critical finding**: 88% of MCP servers require credentials, but 53% rely on insecure long-lived static secrets. Only 8.5% use OAuth-based modern authentication.

**For our Go app**: Implement OAuth 2.1 authorization for all MCP servers from day one. This aligns with the June 2025 MCP spec update that added OAuth-based authorization as a first-class feature.

### 1.7 Complexity Assessment

| Aspect | Effort |
|--------|--------|
| SDK learning curve | 1-2 days |
| First MCP server (KataGo) | 3-5 days |
| Second server (Game DB) | 2-3 days |
| Third server (User Prefs) | 1-2 days |
| Claude integration | 2-3 days |
| **Total** | **9-15 days** |

**Future-proofing value**: 10/10 — MCP is the emerging universal standard. Building MCP servers now means automatic compatibility with future AI models and tools.

---

## 2. tRPC — End-to-End Type-Safe APIs

### 2.1 Current State and Maturity

**Version**: tRPC v11 (stable). Deep integration with Next.js App Router, TanStack React Query, and Zod.

**Ecosystem**: Core component of the T3 Stack (Next.js + TypeScript + tRPC + Prisma + Tailwind + NextAuth), the most popular full-stack TypeScript starter with create-t3-app.

**Maturity Rating**: 9/10 — Battle-tested in production across thousands of apps.

### 2.2 tRPC vs REST vs GraphQL

| Metric | REST | GraphQL | tRPC |
|--------|------|---------|------|
| **Latency (p50)** | ~0.3ms | ~0.5ms | ~0.2ms |
| **Latency (p99)** | 45ms | 55ms | 40ms |
| **Dev speed** | Baseline | +15-20% vs REST | +35-40% vs REST |
| **Type safety** | Manual (OpenAPI codegen) | Partial (codegen) | Full (zero-config) |
| **Schema duplication** | Yes (server + client types) | Partial (schema + resolvers) | Zero (types shared) |
| **Public API suitability** | Excellent | Good | Poor |
| **Multi-team scaling** | Good | Excellent | Limited |
| **Bundle size overhead** | Minimal | Medium (client lib) | Minimal |

**Key insight**: tRPC reduces new feature development time by 35-40% compared to REST. For a monorepo Go app with a single team, this is the optimal choice.

### 2.3 Next.js 15 App Router Integration

**Architecture** (tRPC v11):

```
app/
├── api/trpc/[trpc]/route.ts    ← API route handler
├── _trpc/
│   ├── init.ts                  ← context, baseProcedure, createTRPCRouter
│   ├── query-client.ts          ← SSR-safe QueryClient factory
│   ├── client.tsx               ← TRPCReactProvider + useTRPC hook
│   └── server.tsx               ← prefetch, HydrateClient, caller
└── routers/
    ├── _app.ts                  ← root router (merges all sub-routers)
    ├── game.ts                  ← game CRUD procedures
    ├── analysis.ts              ← KataGo analysis procedures
    └── user.ts                  ← user management procedures
```

**Server Components**: `createCaller` enables direct procedure calls from Server Components without HTTP overhead — just a function call within the same process.

**Client Components**: React Query hooks (`useQuery`, `useMutation`) with caching, refetching, and optimistic updates. New v11 syntax: `useQuery(trpc.game.getById.queryOptions({ id }))`.

**Prefetching**: `void prefetch` on server side for faster loads, or `await` for blocking SSR without streaming.

### 2.4 WebSocket Subscriptions with tRPC

tRPC supports real-time subscriptions via both WebSocket and Server-Sent Events (SSE).

**WebSocket mode** (recommended for Go app — bidirectional communication needed):
- Persistent connection with automatic reconnection
- `tracked()` helper with `id` for automatic reconnection with `lastEventId`
- Queries, mutations, AND subscriptions share the same WebSocket connection
- Request batching over WebSocket

**Go app subscription use cases**:
```typescript
// Game room real-time updates
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

### 2.5 When NOT to Use tRPC

- **Public APIs**: Third-party developers need REST/GraphQL with documentation
- **Multi-language clients**: tRPC requires TypeScript on both ends
- **Large organizations**: Multiple teams with separate codebases benefit from GraphQL federation

**Go app assessment**: tRPC is ideal. Single team, monorepo, TypeScript throughout. If a public API is needed later (e.g., for a mobile app by a different team), expose a REST layer alongside tRPC — they can coexist.

### 2.6 Complexity Assessment

| Aspect | Effort |
|--------|--------|
| Initial setup | 0.5 days (CLI available: one-command setup) |
| Router architecture | 1-2 days |
| WebSocket subscriptions | 2-3 days |
| Auth middleware integration | 1 day |
| **Total** | **4-6 days** |

**Future-proofing value**: 8/10 — Dominant in TypeScript full-stack. Limited if you need to support non-TypeScript clients.

---

## 3. OAuth 2.1 & Modern Auth Patterns

### 3.1 OAuth 2.1 — Current State

**Status**: Draft (as of April 2025), but core specifications are already being adopted by leading organizations. Anthropic has made OAuth 2.1 foundational to MCP authorization.

**Key Changes from OAuth 2.0**:

| Change | Impact |
|--------|--------|
| PKCE mandatory for ALL clients | Prevents authorization code interception (previously optional, only for public clients) |
| Implicit flow removed | Eliminates token exposure in browser URL fragments |
| Resource Owner Password Credentials removed | Eliminates direct credential handling |
| Exact redirect URI matching | Prevents open redirect attacks |

**Maturity Rating**: 8/10 — Draft status, but changes reflect already-adopted best practices. Safe to implement now.

### 3.2 Passkeys / WebAuthn — Passwordless Future

**Adoption Metrics (2025-2026)**:
- Google: 120% increase in passkey authentications after making them default for new accounts
- ~70% of users have at least one passkey by end of 2025
- 1.3M passkey authentications per month (doubled year-over-year)
- Passwordless authentication market: $24.1B in 2025, projected $55.7B by 2030 (18.24% CAGR)

**Platform Support**:
- Apple: Credential portability with iOS 26
- Microsoft: Passkeys default for new accounts, cross-device sync in Edge/Windows
- Google: Passkeys default for new accounts

**Performance**:
- 93% login success rate (vs passwords: lower)
- 4x faster login compared to passwords + 2FA
- 25% improvement in login success rates over passwords (HubSpot)

**Regulatory Drivers**:
- NIST SP 800-63-4 (July 2025): AAL2 must offer phishing-resistant option; syncable passkeys qualify as AAL2
- UAE Central Bank: Eliminated SMS/email OTPs by March 2026

**Go app implementation**:
```
Authentication Layers:
1. Primary: Passkeys/WebAuthn (passwordless, phishing-resistant)
2. Fallback: OAuth 2.1 with PKCE (social login — Google, GitHub)
3. Emergency: Magic link email (account recovery)
```

### 3.3 Device Flow for CLI Tools

OAuth 2.0 Device Authorization Grant (RFC 8628) enables CLI authentication:

```
User runs: `baduk-cli login`
  ↓
CLI displays: "Visit https://app.baduk.io/device and enter code: ABCD-1234"
  ↓
User authenticates in browser (passkey or social login)
  ↓
CLI receives access token, securely stored in OS keychain
```

**Go app use case**: CLI tool for uploading SGF files, running batch KataGo analysis, managing study plans from terminal. WorkOS, Auth0, and custom implementations all support device flow.

### 3.4 Token Management Best Practices

| Practice | Implementation |
|----------|---------------|
| Short-lived access tokens | 15-minute expiry |
| Refresh token rotation | New refresh token on each use, invalidate old |
| Secure cookie storage | HttpOnly, Secure, SameSite=Lax |
| Token binding | Bind tokens to device fingerprint |
| Revocation endpoint | Immediate token invalidation on logout |

### 3.5 Next.js Middleware for Auth

**Edge Runtime Auth** (Next.js 15):
- Use `jose` library for JWT verification (Web Crypto APIs, Edge-compatible)
- Scope middleware with matchers — only run on protected routes
- Lightweight operations only — no database calls in middleware
- Defense-in-depth: client checks + server validation + edge middleware

**Critical Security Note**: Upgrade to Next.js 15.2.3+ to patch CVE-2025-29927. Verify authentication at every data access point, not just middleware.

**Node.js Runtime in Middleware**: Experimental support in Next.js 15.2+ canary — enables full Node.js APIs in middleware, but use sparingly for auth to keep latency low.

### 3.6 Go App Auth Architecture

```
┌─────────────────────────────────────────────────┐
│                  Auth Flow                       │
├─────────────────────────────────────────────────┤
│                                                  │
│  Browser                                         │
│  ├── Passkey (WebAuthn) ──→ Direct auth          │
│  ├── Google OAuth 2.1 ──→ PKCE flow              │
│  └── GitHub OAuth 2.1 ──→ PKCE flow              │
│                                                  │
│  CLI                                             │
│  └── Device Flow ──→ Browser auth ──→ Token      │
│                                                  │
│  Next.js Middleware (Edge)                       │
│  └── JWT verification (jose) ──→ Route guard     │
│                                                  │
│  Server Actions / tRPC Procedures                │
│  └── Session validation ──→ DB check             │
│                                                  │
│  MCP Servers                                     │
│  └── OAuth 2.1 bearer tokens ──→ Scoped access   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 3.7 Complexity Assessment

| Aspect | Effort |
|--------|--------|
| Passkey/WebAuthn integration | 3-5 days |
| OAuth 2.1 social login | 2-3 days |
| Device flow for CLI | 2-3 days |
| Next.js middleware auth | 1-2 days |
| Token management | 2-3 days |
| **Total** | **10-16 days** |

**Future-proofing value**: 10/10 — Passkeys are the clear future of authentication. OAuth 2.1 is the codified best practice.

---

## 4. Edge Computing Patterns

### 4.1 Platform Comparison

| Feature | Cloudflare Workers | Vercel Edge Functions |
|---------|-------------------|---------------------|
| **Cold start** | <1ms (V8 isolates) | <5ms (optimized containers) |
| **Global PoPs** | 300+ data centers | ~50 regions |
| **Runtime** | JS/TS + WebAssembly | Node.js, Python, Go, Ruby |
| **Free tier** | 1M requests/month, 100K CPU ms/day | 100GB bandwidth/month |
| **WebSocket support** | Full (Durable Objects) | Limited |
| **Stateful computation** | Durable Objects, KV, D1, R2 | KV (limited) |
| **DX for Next.js** | Good (Pages) | Excellent (native) |
| **Pricing at scale** | Very competitive | Usage-based, can get expensive |

### 4.2 Go App Edge Use Cases

#### 4.2.1 Region-Based Matchmaking (Cloudflare Workers)

```
User in Seoul requests match
  ↓
Cloudflare Worker at Seoul PoP
  ├── Check regional player pool (Workers KV)
  ├── Estimate latency to nearby game servers
  ├── Find optimal opponent (rank + latency)
  └── Return match assignment + server endpoint
  ↓
Sub-10ms response (no origin roundtrip needed)
```

#### 4.2.2 CDN Cache Invalidation

```
Game state changes (move played)
  ↓
Origin server publishes invalidation event
  ↓
Cloudflare Purge API invalidates:
  - Game board snapshot image
  - Position analysis cache
  - Game metadata JSON
  ↓
Next request fetches fresh data from origin
```

#### 4.2.3 Edge Middleware (Next.js / Vercel)

```typescript
// Rate limiting at the edge
middleware.ts:
  - Auth token verification (jose)
  - Rate limit check (Upstash Redis)
  - Geolocation-based locale detection
  - A/B test variant assignment
  - Bot detection and challenge
```

### 4.3 WebSocket at the Edge — Limitations

**Cloudflare Durable Objects WebSocket**:
- Soft limit: 1,000 requests/second per individual Durable Object
- Max message size: 32 MiB (increased from 1 MiB in 2025)
- CPU time per invocation: 30 seconds default (configurable)
- Hibernation API: Reduces costs for idle connections but only for server-mode WebSockets

**Recommendation for Go app**: Do NOT run the primary game WebSocket server at the edge. The game state machine requires persistent state, complex logic, and tight coupling with KataGo analysis. Instead:

```
Architecture:
  Edge (Cloudflare Workers):
    - Rate limiting, auth pre-check, geo-routing
    - WebSocket upgrade proxy (route to nearest game server)

  Origin (Hetzner):
    - Game WebSocket server (ws library)
    - KataGo analysis processes
    - PostgreSQL + Redis
```

### 4.4 Hetzner + Cloudflare Edge Hybrid

**Architecture**:
```
Users worldwide
  ↓
Cloudflare Edge (300+ PoPs)
  ├── DNS resolution
  ├── SSL/TLS termination
  ├── DDoS protection
  ├── Static asset CDN (70%+ traffic absorbed)
  ├── Edge Workers (rate limit, geo-route, A/B test)
  └── Cloudflare Tunnel (encrypted QUIC)
      ↓
Hetzner VPS (EU)
  ├── Next.js application server
  ├── WebSocket game server
  ├── KataGo analysis workers
  ├── PostgreSQL 16
  └── Redis 7.2
```

**Cost Benefits**:
- Hetzner: 20TB included outbound traffic, overages ~€1/TB
- Cloudflare: Free egress, absorbs 70%+ of traffic before hitting Hetzner
- Cloudflare R2: User uploads and SGF file storage (no egress fees)
- **Result**: Enterprise-grade global delivery at indie-project pricing

### 4.5 Complexity Assessment

| Aspect | Effort |
|--------|--------|
| Cloudflare Tunnel setup | 0.5 days |
| Edge rate limiting | 1-2 days |
| Geo-routing logic | 1-2 days |
| CDN cache strategy | 1-2 days |
| R2 storage integration | 1-2 days |
| **Total** | **4-8 days** |

**Future-proofing value**: 8/10 — Edge computing is mainstream. Cloudflare + Hetzner hybrid is cost-optimal for indie/startup scale.

---

## 5. Modern Webhook & Event Patterns

### 5.1 Svix — Managed Webhook Infrastructure

**What it is**: Open-source and enterprise-ready webhook service. Provides subscription management UI, delivery guarantees, and retry logic.

**Tech stack alignment**: Svix server requires PostgreSQL (we have PG 16) and optional Redis (we have Redis 7.2) — perfect fit.

**Retry Schedule**: Exponential backoff — immediate, 5s, 5m, 30m, 2h, 5h, 10h.

**Go app webhook use cases**:
```
Events to external consumers:
  - game.completed → Notify rating services, achievement systems
  - analysis.ready → Notify user devices (push notification trigger)
  - user.rank_changed → Update leaderboard services
  - tournament.round_started → Notify all participants
```

### 5.2 Webhook Signature Verification

```typescript
// HMAC-SHA256 signature verification
import { Webhook } from "svix";

const wh = new Webhook(webhookSecret);
const payload = wh.verify(body, headers);
// Throws on invalid signature or replay attack
```

**Best practices**:
- Pre-shared HMAC key per webhook endpoint
- Timestamp validation to prevent replay attacks
- Different URLs/paths for different webhook sources
- Server-side event type filtering to reduce noise

### 5.3 BullMQ — Event-Driven Job Processing

**Role in Go app**: Background job processing for computationally expensive or asynchronous operations.

**Key Features**:
- Job lifecycle events: completed, failed, stalled
- Rate limiting per queue
- Job priorities
- Flows (parent-child job dependencies)
- Idempotent jobs via strategic job ID management
- Redis-backed (our Redis 7.2 instance)

**Go app job queues**:
```typescript
// Queue architecture
const queues = {
  'katago-analysis': {
    // Heavy analysis jobs (60s+ per game)
    concurrency: 4,  // Match KataGo GPU workers
    priority: true,
    rateLimiter: { max: 10, duration: 60000 },
  },
  'sgf-import': {
    // Batch SGF file processing
    concurrency: 8,
    idempotent: true,  // Deduplicate by file hash
  },
  'notification': {
    // Push notifications, emails
    concurrency: 16,
    retry: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
  },
  'game-archive': {
    // Post-game archival and statistics
    concurrency: 4,
    delay: 5000,  // Wait 5s after game completion
  },
};
```

### 5.4 Idempotency Keys

**Pattern**: Every mutation that can be retried must include an idempotency key.

```typescript
// tRPC procedure with idempotency
gameRouter.mutation('submitMove', {
  input: z.object({
    gameId: z.string(),
    move: z.string(),
    idempotencyKey: z.string().uuid(),
  }),
  resolve: async ({ input, ctx }) => {
    // Check if this key was already processed
    const existing = await redis.get(`idem:${input.idempotencyKey}`);
    if (existing) return JSON.parse(existing);

    // Process the move
    const result = await processMove(input);

    // Store result with TTL (24 hours)
    await redis.set(`idem:${input.idempotencyKey}`, JSON.stringify(result), 'EX', 86400);

    return result;
  },
});
```

### 5.5 Dead Letter Queues

```typescript
// BullMQ dead letter queue pattern
const analysisQueue = new Queue('katago-analysis', { connection: redis });

const worker = new Worker('katago-analysis', processAnalysis, {
  connection: redis,
  settings: {
    backoffStrategies: {
      custom: (attemptsMade) => Math.min(attemptsMade * 5000, 60000),
    },
  },
});

worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // Move to dead letter queue for manual inspection
    await deadLetterQueue.add('failed-analysis', {
      originalJob: job.data,
      error: err.message,
      attempts: job.attemptsMade,
      failedAt: new Date().toISOString(),
    });
  }
});
```

### 5.6 Complexity Assessment

| Aspect | Effort |
|--------|--------|
| BullMQ setup + queue architecture | 2-3 days |
| Svix webhook infrastructure | 2-3 days |
| Idempotency layer | 1-2 days |
| Dead letter queue + monitoring | 1-2 days |
| Event schema design | 1-2 days |
| **Total** | **7-12 days** |

**Future-proofing value**: 9/10 — Event-driven architecture scales better than request-response for complex systems. BullMQ + Redis is the Node.js standard.

---

## 6. Conclusion

### 6.1 Recommended Modern Integration Patterns

| Pattern | Status | Priority | Rationale |
|---------|--------|----------|-----------|
| **tRPC** | Production-ready | P0 (Core) | 35-40% dev speed boost, zero schema duplication, perfect for monorepo |
| **BullMQ event queues** | Production-ready | P0 (Core) | KataGo analysis is inherently async/batch — needs job queue |
| **OAuth 2.1 + Passkeys** | Production-ready | P1 (Auth) | PKCE mandatory, passkeys are the future, regulatory momentum |
| **MCP servers** | Production-ready | P1 (AI) | Universal AI integration standard, KataGo + Claude seamless workflow |
| **Cloudflare Edge hybrid** | Production-ready | P1 (Infra) | Global performance + cost optimization with Hetzner |
| **Svix webhooks** | Production-ready | P2 (Ecosystem) | Needed when external integrations or multi-service architecture emerges |
| **Idempotency keys** | Pattern (no library needed) | P2 (Reliability) | Critical for move submission, payment, any non-idempotent mutation |

### 6.2 Production vs Experimental Assessment

**All recommended patterns are production-ready.** This is intentional — the "modern" label does not mean experimental. These patterns represent the current best practices that have crossed the maturity threshold:

| Pattern | Production Since | Risk Level |
|---------|-----------------|------------|
| tRPC v11 | 2024 | Very Low |
| BullMQ | 2021 | Very Low |
| OAuth 2.1 (PKCE) | 2024 (de facto) | Very Low |
| Passkeys/WebAuthn | 2023 (spec), 2025 (mainstream) | Low |
| MCP | 2025 (multi-vendor) | Low |
| Cloudflare Workers | 2018 | Very Low |
| Svix | 2022 | Low |

### 6.3 Implementation Priority Order

```
Phase 1 — Foundation (Weeks 1-3)
  ├── tRPC router architecture with Next.js 15
  ├── OAuth 2.1 + Passkey authentication
  ├── BullMQ queue setup for KataGo analysis
  └── Cloudflare Tunnel + basic edge setup

Phase 2 — AI Integration (Weeks 4-6)
  ├── MCP Server: KataGo Analysis
  ├── MCP Server: Game Database
  ├── Claude + MCP integration for AI explanations
  └── tRPC WebSocket subscriptions for real-time game play

Phase 3 — Operational Excellence (Weeks 7-8)
  ├── MCP Server: User Preferences
  ├── Svix webhook infrastructure
  ├── Idempotency layer for critical mutations
  ├── Dead letter queues + monitoring
  └── Edge rate limiting + geo-routing
```

### 6.4 Type Safety Score

| Layer | Type Safety | Score |
|-------|------------|-------|
| Client ↔ Server (tRPC) | Full — zero schema duplication | 10/10 |
| Database (Prisma/Drizzle) | Full — generated types from schema | 10/10 |
| MCP tools (Zod schemas) | Full — Zod shared between tRPC and MCP | 9/10 |
| WebSocket messages (tRPC subscriptions) | Full — typed with Zod | 9/10 |
| Auth tokens (jose + Zod) | Partial — JWT payload validation | 7/10 |
| External webhooks (Svix) | Partial — event schema validation | 7/10 |
| Edge workers | Partial — separate deployment, type sharing via npm | 6/10 |
| **Overall** | **End-to-end TypeScript + Zod** | **8.5/10** |

### 6.5 Combined Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                           │
│  Next.js 15 + React 19 + tRPC React Query hooks                  │
│  ├── Passkey/WebAuthn authentication                              │
│  ├── tRPC queries/mutations (type-safe)                           │
│  └── tRPC WebSocket subscriptions (real-time game, analysis)      │
└───────────────┬───────────────────────────────────┬───────────────┘
                │ HTTPS                             │ WSS
     ┌──────────▼──────────┐              ┌────────▼────────┐
     │  Cloudflare Edge    │              │  Cloudflare      │
     │  ├── Rate limiting  │              │  ├── WS proxy    │
     │  ├── Auth pre-check │              │  └── Geo-route   │
     │  ├── Geo-routing    │              │     to nearest   │
     │  ├── Cache (CDN)    │              │     game server  │
     │  └── R2 (SGF files) │              │                  │
     └──────────┬──────────┘              └────────┬────────┘
                │ Cloudflare Tunnel (QUIC)          │
     ┌──────────▼──────────────────────────────────▼────────┐
     │                  HETZNER VPS                          │
     │                                                       │
     │  ┌─────────────────────────────────────────────┐     │
     │  │  Next.js 15 Server                          │     │
     │  │  ├── tRPC API routes (queries, mutations)   │     │
     │  │  ├── Auth middleware (jose JWT)              │     │
     │  │  └── Server Components (direct DB access)   │     │
     │  └─────────────────────┬───────────────────────┘     │
     │                        │                              │
     │  ┌─────────────────────▼───────────────────────┐     │
     │  │  MCP Server Layer                           │     │
     │  │  ├── KataGo Analysis Server (tools)         │     │
     │  │  ├── Game Database Server (tools+resources)  │     │
     │  │  └── User Preferences Server (tools)        │     │
     │  └─────────────────────┬───────────────────────┘     │
     │                        │                              │
     │  ┌──────────┐  ┌──────▼─────┐  ┌──────────────┐     │
     │  │ PG 16    │  │ Redis 7.2  │  │ KataGo       │     │
     │  │ ├─ Games │  │ ├─ BullMQ  │  │ ├─ Analysis  │     │
     │  │ ├─ Users │  │ ├─ Cache   │  │ └─ GPU/CPU   │     │
     │  │ └─ SGF   │  │ ├─ Session │  │   workers    │     │
     │  │          │  │ └─ Idem    │  │              │     │
     │  └──────────┘  └────────────┘  └──────────────┘     │
     │                                                       │
     │  ┌─────────────────────────────────────────────┐     │
     │  │  BullMQ Workers                             │     │
     │  │  ├── katago-analysis (concurrency: 4)       │     │
     │  │  ├── sgf-import (concurrency: 8)            │     │
     │  │  ├── notification (concurrency: 16)         │     │
     │  │  └── game-archive (concurrency: 4)          │     │
     │  └─────────────────────────────────────────────┘     │
     │                                                       │
     │  ┌─────────────────────────────────────────────┐     │
     │  │  Svix Webhook Server                        │     │
     │  │  ├── game.completed → external consumers    │     │
     │  │  ├── analysis.ready → push notifications    │     │
     │  │  └── user.rank_changed → leaderboards       │     │
     │  └─────────────────────────────────────────────┘     │
     └───────────────────────────────────────────────────────┘
```

### 6.6 Key Takeaways

1. **tRPC is the highest-ROI pattern**: 35-40% faster development, zero type duplication, trivial setup. For a monorepo TypeScript Go app, this is a no-brainer.

2. **MCP is the strategic investment**: Building KataGo as an MCP server future-proofs the entire AI integration layer. As more AI models adopt MCP, the analysis engine becomes universally accessible — not locked to Claude.

3. **Passkeys eliminate an entire category of security problems**: No passwords to breach, no SMS OTPs to intercept. The Go app should launch with passkeys as the primary auth method.

4. **Edge should augment, not replace**: Run the game logic on Hetzner origin servers. Use Cloudflare edge for rate limiting, caching, and routing. WebSocket game state is too stateful for edge.

5. **BullMQ is essential, not optional**: KataGo analysis takes 10-60 seconds per position. Without a job queue, the entire API blocks. BullMQ + Redis is the proven Node.js solution.

6. **All five patterns compose naturally**: tRPC procedures trigger BullMQ jobs, which invoke MCP servers, which return typed results to tRPC subscriptions, secured by OAuth 2.1/Passkeys, optimized by edge caching. The Zod schema library is the shared foundation across tRPC, MCP, and validation.

---

## Sources

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Adoption Statistics 2025](https://mcpmanager.ai/blog/mcp-adoption-statistics/)
- [A Year of MCP: From Internal Experiment to Industry Standard](https://www.pento.ai/blog/a-year-of-mcp-2025-review)
- [2026: The Year for Enterprise-Ready MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption)
- [The State of MCP — Adoption, Security & Production Readiness](https://zuplo.com/mcp-report)
- [MCP vs Function Calling: How They Differ](https://www.descope.com/blog/post/mcp-vs-function-calling)
- [MCP vs Function Calling Deep Dive](https://www.marktechpost.com/2025/04/18/model-context-protocol-mcp-vs-function-calling-a-deep-dive-into-ai-integration-architectures/)
- [Function Calling vs MCP vs A2A: Developer's Guide](https://zilliz.com/blog/function-calling-vs-mcp-vs-a2a-developers-guide-to-ai-agent-protocols)
- [FastMCP Framework](https://github.com/punkpeye/fastmcp)
- [Code Execution with MCP (Anthropic Engineering)](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [tRPC 11 Setup for Next.js App Router 2025](https://dev.to/matowang/trpc-11-setup-for-nextjs-app-router-2025-33fo)
- [How to Use tRPC with Next.js 15 App Router](https://www.wisp.blog/blog/how-to-use-trpc-with-nextjs-15-app-router)
- [tRPC Subscriptions Documentation](https://trpc.io/docs/server/subscriptions)
- [tRPC WebSockets Documentation](https://trpc.io/docs/server/websockets)
- [REST vs GraphQL vs tRPC: Ultimate API Design Guide 2026](https://dev.to/dataformathub/rest-vs-graphql-vs-trpc-the-ultimate-api-design-guide-for-2026-8n3)
- [REST vs GraphQL vs tRPC vs gRPC in 2026](https://dev.to/pockit_tools/rest-vs-graphql-vs-trpc-vs-grpc-in-2026-the-definitive-guide-to-choosing-your-api-layer-1j8m)
- [REST vs GraphQL vs tRPC: API Guide (Directus)](https://directus.io/blog/rest-graphql-tprc)
- [Create T3 App](https://create.t3.gg/)
- [OAuth 2.1 Specification](https://oauth.net/2.1/)
- [OAuth 2.1 vs 2.0: What Developers Need to Know](https://stytch.com/blog/oauth-2-1-vs-2-0/)
- [OAuth 2.1 vs OAuth 2.0: What's Changing](https://www.descope.com/blog/post/oauth-2-0-vs-oauth-2-1)
- [MCP, OAuth 2.1, PKCE, and the Future of AI Authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/)
- [The State of Passkeys in 2025](https://www.1password.community/blog/random-but-memorable/the-state-of-passkeys-in-2025/163464)
- [Passkeys Are Finally Taking Over in 2025](https://cybersecurity.nusummit.com/blog/why-passkeys-are-finally-taking-over-in-2025/)
- [Developer's Practical Guide to Passwordless Authentication in 2026](https://securityboulevard.com/2026/03/the-developers-practical-guide-to-passwordless-authentication-in-2026/)
- [Passkey Adoption Case Studies (Authenticate 2025)](https://www.corbado.com/blog/passkey-adoption-case-studies-authenticate-2025)
- [Passkeys & WebAuthn in 2026: Migration Playbook](https://kawaldeepsingh.medium.com/passkeys-webauthn-in-2026-a-practical-migration-playbook-for-passwordless-authentication-5202f09c62a3)
- [CLI Auth with OAuth Device Flow (WorkOS)](https://workos.com/blog/cli-auth)
- [OAuth 2.0 Device Flow (RFC 8628)](https://oauth.net/2/device-flow/)
- [Complete Authentication Guide for Next.js App Router 2025](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router)
- [Next.js Middleware Auth: Edge Runtime Limitations & Solutions](https://medium.com/@shuhan.chan08/authentication-in-next-js-middleware-edge-runtime-limitations-solutions-7692a44f47ab)
- [Cloudflare vs Vercel vs Netlify: Edge Performance 2026](https://dev.to/dataformathub/cloudflare-vs-vercel-vs-netlify-the-truth-about-edge-performance-2026-50h0)
- [Vercel vs Cloudflare: Edge Deployment Deep Dive](https://sparkco.ai/blog/vercel-vs-cloudflare-edge-deployment-deep-dive)
- [Cloudflare Durable Objects WebSocket Docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Durable Objects Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Cloudflare WebSocket: Complete 2025 Guide](https://www.videosdk.live/developer-hub/websocket/cloudflare-websocket)
- [60TB for €1? Beating AWS & Vercel Egress Fees with Hetzner & Cloudflare](https://dev.to/saqibshahdev/httpswwwdevmorphdevblogsoptimizing-egress-hidden-killer-of-cloud-bills-2026-142l)
- [Self-Host Like a Pro: Dokku, Hetzner and Cloudflare](https://catalins.tech/selfhost-with-dokku-hetzner-cloudflare/)
- [Svix Webhooks](https://www.svix.com/)
- [Svix Webhook Best Practices: Receiving](https://www.svix.com/resources/webhook-best-practices/receiving/)
- [Svix Webhook Best Practices: Sending](https://www.svix.com/resources/webhook-best-practices/sending/)
- [BullMQ Ultimate Guide 2025](https://www.dragonflydb.io/guides/bullmq)
- [BullMQ Idempotent Jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ Events Documentation](https://docs.bullmq.io/guide/events)
