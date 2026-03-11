# Classical Integration Patterns Research
## AI Baduk App — Proven, Battle-Tested External Integration Approaches

**Context**: AI baduk (Go) app, MAU 8K, Coolify+Hetzner, Node.js 22 / Next.js 15 / PG 16 / Redis 7.2
**Constraint**: Claude API as sole LLM API (OpenAI/Gemini subscription only)
**Date**: 2026-03-10

---

## Table of Contents

1. [REST API Best Practices](#1-rest-api-best-practices)
2. [Authentication — OAuth 2.0 + NextAuth.js v5](#2-authentication--oauth-20--nextauthjs-v5)
3. [Payment Integration — Stripe](#3-payment-integration--stripe)
4. [Webhook Architecture — Battle-Tested Patterns](#4-webhook-architecture--battle-tested-patterns)
5. [Email — Transactional Patterns](#5-email--transactional-patterns)
6. [Caching, CDN & Redis Patterns](#6-caching-cdn--redis-patterns)
7. [Error Handling & Resilience Patterns](#7-error-handling--resilience-patterns)
8. [Database Integration Patterns](#8-database-integration-patterns)

---

## 1. REST API Best Practices

**Years in production**: REST has been the dominant API paradigm since ~2000 (25+ years). JSON-over-HTTP since ~2010.

### 1.1 Resource Design for a Baduk Platform

```
# Core Resources
GET    /api/v1/games                    # List games (cursor-paginated)
POST   /api/v1/games                    # Create a new game
GET    /api/v1/games/:id                # Get game details
PATCH  /api/v1/games/:id                # Update game (resign, pass)
DELETE /api/v1/games/:id                # Delete/archive game

GET    /api/v1/games/:id/moves          # Move history
POST   /api/v1/games/:id/moves          # Play a move

GET    /api/v1/games/:id/analysis       # KataGo analysis results
POST   /api/v1/games/:id/analysis       # Request analysis

GET    /api/v1/users/:id                # User profile
PATCH  /api/v1/users/:id                # Update profile
GET    /api/v1/users/:id/games          # User's game history

POST   /api/v1/explanations             # Request Claude explanation
GET    /api/v1/explanations/:id         # Retrieve explanation

GET    /api/v1/problems                 # Go problems (tsumego)
GET    /api/v1/problems/:id             # Specific problem
POST   /api/v1/problems/:id/attempts    # Submit solution attempt
```

### 1.2 HTTP Methods and Status Codes

| Method | Usage | Idempotent |
|--------|-------|-----------|
| GET | Read resource | Yes |
| POST | Create resource / trigger action | No |
| PATCH | Partial update | No |
| PUT | Full replacement (rarely needed) | Yes |
| DELETE | Remove resource | Yes |

**Standard Status Codes**:
- `200 OK` — successful GET/PATCH/DELETE
- `201 Created` — successful POST with `Location` header
- `204 No Content` — successful DELETE with no body
- `400 Bad Request` — validation failure (with details)
- `401 Unauthorized` — missing/invalid auth
- `403 Forbidden` — authenticated but insufficient permissions
- `404 Not Found` — resource does not exist
- `409 Conflict` — illegal move, duplicate game
- `422 Unprocessable Entity` — semantically invalid request
- `429 Too Many Requests` — rate limited (with `Retry-After` header)
- `500 Internal Server Error` — unexpected failure

### 1.3 Standardized Error Format — RFC 9457 (successor to RFC 7807)

**Pattern maturity**: RFC 7807 published 2016 (10 years), superseded by RFC 9457 in 2023. The "Problem Details for HTTP APIs" standard provides a machine-readable error format adopted by Stripe, GitHub, Microsoft, and AWS.

```json
{
  "type": "https://baduk-app.com/errors/invalid-move",
  "title": "Invalid Move",
  "status": 409,
  "detail": "Position (3,4) is already occupied by a black stone",
  "instance": "/api/v1/games/g_abc123/moves",
  "position": [3, 4],
  "currentStone": "black",
  "requestId": "req_abc123",
  "timestamp": "2026-03-10T12:00:00Z"
}
```

**RFC 9457 fields**:
| Field | Required | Description |
|-------|----------|-------------|
| `type` | Recommended | URI identifying the error type (documentation link) |
| `title` | Recommended | Human-readable summary (stable across instances) |
| `status` | Recommended | HTTP status code (redundant but explicit) |
| `detail` | Optional | Human-readable explanation specific to this occurrence |
| `instance` | Optional | URI identifying the specific occurrence |

**Extension members** (like `position`, `currentStone`) are allowed and encouraged for domain-specific context.

**Node.js library**: `http-problem-details` (npm) implements RFC 7807/9457 natively. Alternatively, a simple utility function suffices for this app's scale.

**Why RFC 9457 over custom formats**: Standardized error structure enables client-side error handling libraries to parse errors consistently, reduces per-endpoint documentation burden, and aligns with industry practice (Stripe, GitHub, Zalando API guidelines all use Problem Details).

**Legacy compatibility note**: The original error format shown below is also acceptable for internal consistency, but RFC 9457 is preferred for any public-facing API surface:

```json
{
  "error": {
    "code": "INVALID_MOVE",
    "message": "Position (3,4) is already occupied",
    "details": {
      "position": [3, 4],
      "currentStone": "black"
    },
    "requestId": "req_abc123",
    "timestamp": "2026-03-10T12:00:00Z"
  }
}
```

### 1.4 Cursor-Based Pagination

Cursor-based pagination is **strongly recommended** over offset-based for game lists because:
- **Consistent performance**: O(1) regardless of page depth (offset degrades as offset grows)
- **No skipped/duplicated items**: Safe when games are added/deleted between pages
- **Natural fit**: Game lists ordered by timestamp; the cursor is an encoded `(created_at, id)` pair

```
GET /api/v1/games?cursor=eyJjIjoiMjAyNi0wMy0wOVQxMjowMDowMFoiLCJpIjoiZ18xMjMifQ&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJjIjoiMjAyNi0wMy0wOFQxMjowMDowMFoiLCJpIjoiZ185OTkifQ",
    "has_more": true
  }
}
```

**Trade-off**: No "jump to page N" capability. For a baduk app, infinite scroll is the natural UX anyway.

### 1.5 REST vs tRPC vs GraphQL — Why REST Is Still the Default

**Decision**: Use **REST for the Go app**. Here is the evidence-based comparison:

| Criterion | REST | tRPC | GraphQL |
|-----------|------|------|---------|
| **Maturity** | 25+ years | 3 years | 9 years |
| **Simple query perf** | 922ms avg | ~900ms (similar) | 1864ms avg (2x slower) |
| **Public API readiness** | Native | No (TypeScript-only) | Yes |
| **Caching** | HTTP-native (CDN, ETag) | Manual | Complex (normalized) |
| **Tooling ecosystem** | Massive | Growing | Large |
| **AI agent implementability** | Highest (most training data) | High (TS-only) | Medium (query complexity) |
| **Learning curve** | Low | Low (TS devs) | Medium-High |
| **Mobile client support** | Universal | TypeScript only | Good |

**Why REST wins for this project**:
1. **Universality**: REST has the most documentation, examples, and AI training data of any API style. AI agents implementing the code will have the highest success rate with REST patterns.
2. **HTTP-native caching**: KataGo analysis results, game states, and leaderboards benefit directly from `Cache-Control`, `ETag`, and CDN caching. GraphQL requires a separate caching layer (Apollo cache).
3. **Simple data model**: A baduk app has well-defined resources (games, moves, users, analysis) without the deep nesting that makes GraphQL shine. No over-fetching problem exists when your endpoints are purpose-built.
4. **Proven at scale**: REST APIs power Stripe, GitHub, AWS, and every major cloud provider. The patterns are battle-tested across billions of requests.

**When to reconsider**:
- If a mobile app requires flexible data fetching (different views needing different subsets), add GraphQL as a gateway layer on top of REST services.
- If the team grows and needs end-to-end type safety without OpenAPI codegen, tRPC can supplement internal routes while REST handles external/webhook endpoints.

**Hybrid approach** (Phase 3+): REST for public API + webhooks, tRPC or Server Actions for internal Next.js mutations. This is the pattern Dub.co, Cal.com, and other Next.js production apps use.

### 1.6 OpenAPI / Scalar Documentation

**Recommended Stack**:
- **`zod`** for runtime request/response validation (contract-first design)
- **`zod-openapi`** to generate OpenAPI 3.1 spec from Zod schemas
- **`@scalar/nextjs-api-reference`** for beautiful, interactive API docs

This pipeline gives you:
1. TypeScript types from Zod schemas (compile-time safety)
2. Runtime validation at API boundary (security)
3. Auto-generated OpenAPI spec (documentation)
4. Interactive API explorer via Scalar (developer UX)

**Recommended Libraries**:
| Library | Purpose | Weekly Downloads |
|---------|---------|-----------------|
| `zod` | Runtime validation + TypeScript types | ~20M |
| `@asteasolutions/zod-to-openapi` | Zod → OpenAPI 3.x | ~400K |
| `@scalar/nextjs-api-reference` | Interactive API docs | ~50K |
| `next-openapi-gen` | Auto-scan routes → OpenAPI | ~5K |

### 1.7 API Versioning

**Recommendation: URL path versioning (`/api/v1/`)**.

| Strategy | Pros | Cons |
|----------|------|------|
| URL path `/v1/` | Explicit, cacheable, simple | "Ugly" URLs |
| Header `Accept: application/vnd.baduk.v1+json` | "Clean" URLs | Hidden, debugging harder |
| Query param `?version=1` | Easy to add | Conflicts with caching |

For a small team with AI agents building the code, URL path versioning is the simplest and most debuggable. Header-based versioning adds complexity with negligible benefit at MAU 8K.

**Deprecation Strategy** (from 2025-2026 best practices):
- Emit `Deprecation` and `Sunset` HTTP headers when an API version approaches EOL
- Set a 6-month deprecation window minimum
- Bias to additive changes: add fields, never remove or rename without deprecation window
- Tag metrics and logs by API version to guide rollouts and sunsets
- Automate compatibility checks through OpenAPI schema diffs and contract tests

### 1.8 HATEOAS Assessment

**Verdict: Skip HATEOAS for this project.**

HATEOAS adds self-describing links to every response. While theoretically elegant, it is impractical here because:
- The baduk app has a **single frontend client** (Next.js), not a public API ecosystem
- **No industry consensus** on format (HAL, JSON:API, Siren, Hydra all compete)
- Response bloat for every request
- AI agents implementing the code would need to handle additional link-generation logic
- At MAU 8K, API discoverability is not a business requirement

If the app later exposes a public API for third-party Go clients, HATEOAS can be reconsidered.

### 1.9 Anti-Patterns to Avoid

- **Verbs in URLs**: `/api/getGame/123` — use nouns + HTTP methods instead
- **Nested resources deeper than 2 levels**: `/users/1/games/2/moves/3/analysis` — flatten beyond 2
- **Ignoring Accept/Content-Type headers**: Always validate and set explicitly
- **Returning 200 with error body**: Use proper HTTP status codes
- **Exposing database IDs directly**: Use UUIDs or nanoid for external-facing IDs

### 1.10 Next.js 15 Route Handlers

Key considerations for Next.js 15:

- **`params` is now a Promise** — must `await params` before accessing dynamic route values
- **GET handlers default to dynamic** (uncached) in Next.js 15+; opt into caching with `export const revalidate`
- **Use Server Actions for internal mutations** from React components; Route Handlers for external API consumers and webhooks
- **Middleware scope**: Configure `matcher` to limit middleware to `/api/*` and `/dashboard/*` paths; avoid heavy computation in middleware

---

## 2. Authentication — OAuth 2.0 + NextAuth.js v5

**Years in production**: OAuth 2.0 since 2012 (14 years), OIDC since 2014 (12 years), NextAuth.js since 2020 (6 years).

### 2.1 Auth.js v5 (formerly NextAuth.js) — The De Facto Standard

Auth.js v5 is the rebranded NextAuth.js with stricter OAuth/OIDC compliance. It is the most widely adopted auth library in the Next.js ecosystem.

**Key Configuration**:

```typescript
// auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Kakao from "next-auth/providers/kakao"  // Korea-focused
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google,          // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET auto-inferred
    Kakao,           // Korea market share
  ],
  session: { strategy: "database" },  // DB sessions > JWT for subscription apps
  callbacks: {
    async session({ session, user }) {
      session.user.role = user.role       // Free/Premium/Admin
      session.user.subscriptionStatus = user.subscriptionStatus
      return session
    }
  }
})
```

**Why database sessions over JWT for this app**:
- Subscription status changes (Stripe webhook) must take effect immediately
- JWT would require waiting for token refresh (up to 15 min stale data)
- Database sessions let you invalidate/update instantly
- At MAU 8K, the DB load from session lookups is negligible

### 2.2 OAuth 2.0 + PKCE — The Security Foundation

**RFC 9700** (published 2025) codifies OAuth 2.0 security best practices. Key mandates relevant to this app:

**PKCE (Proof Key for Code Exchange)**:
- PKCE is now **required for all client types** — web, mobile, and SPAs — not just public clients
- Prevents authorization code interception attacks
- Auth.js v5 implements PKCE automatically for all providers
- Flow: Client generates `code_verifier` → hashes to `code_challenge` → sends challenge in auth request → sends verifier in token exchange → server verifies match

**Refresh Token Rotation** (mandatory per RFC 9700):
- Each token exchange produces a **new refresh token** and invalidates the old one
- If an old refresh token is reused, the entire token family is revoked (breach detection)
- Auth.js v5 implements rotation when using database sessions
- Maximum refresh token lifetime should be bounded (7-30 days)

**Token Storage Best Practices** (per OWASP 2025):
| Token Type | Storage Location | Flags |
|------------|-----------------|-------|
| Session cookie | httpOnly cookie | `HttpOnly`, `Secure`, `SameSite=Strict`, `__Host-` prefix |
| CSRF token | Cookie + header double-submit | `SameSite=Strict` |
| Access token (if JWT) | In-memory only | Never localStorage (XSS vector) |
| Refresh token (if JWT) | httpOnly cookie | `HttpOnly`, `Secure`, `SameSite=Strict` |

**Why database sessions over JWT for this app** (reinforced by research):
- Subscription status changes (Stripe webhook) must take effect **immediately**
- JWT would require waiting for token refresh (up to 15 min stale data)
- Database sessions let you invalidate/update instantly
- At MAU 8K, the DB load from session lookups is negligible
- "Sign out everywhere" feature is trivial with DB sessions, impossible with JWT without a blocklist

### 2.3 JWT Best Practices (When JWT Is Used)

If JWT is needed for stateless API access (e.g., mobile clients in the future):

| Parameter | Recommended Value | Rationale |
|-----------|-------------------|-----------|
| Access token TTL | 15 minutes | Minimize window if token is leaked |
| Refresh token TTL | 7 days | Balance UX vs security |
| Storage (access) | In-memory (JavaScript variable) | Never localStorage — XSS vulnerable |
| Storage (refresh) | `httpOnly`, `Secure`, `SameSite=Strict` cookie | Cannot be accessed by JavaScript |
| Algorithm | RS256 or ES256 | Asymmetric — verify without secret |
| Rotation | New refresh token on every use | Old token invalidated immediately |

**Refresh Token Rotation Flow**:
1. Client sends expired access token → gets 401
2. Client sends refresh token (via httpOnly cookie)
3. Server issues new access token + new refresh token
4. Old refresh token is invalidated in DB
5. If old refresh token is reused → revoke entire family (breach detection)

### 2.4 RBAC for Free/Premium/Admin

```typescript
// Roles and permissions
const PERMISSIONS = {
  free: {
    gamesPerDay: 3,
    analysisPerDay: 5,
    explanationsPerDay: 3,
    boardSizes: [9, 13],
  },
  premium: {
    gamesPerDay: Infinity,
    analysisPerDay: Infinity,
    explanationsPerDay: 50,
    boardSizes: [9, 13, 19],
  },
  admin: {
    // All premium + admin panel access
    allPermissions: true,
  },
}
```

**Implementation Pattern**: Middleware checks role at route level, fine-grained checks in business logic.

### 2.5 Rate Limiting per User Role

Integrate with Redis sliding window (see Section 6):

| Role | API Rate Limit | Analysis Limit | Explanation Limit |
|------|---------------|----------------|-------------------|
| Anonymous | 10 req/min | 0 | 0 |
| Free | 30 req/min | 5/day | 3/day |
| Premium | 120 req/min | unlimited | 50/day |
| Admin | 300 req/min | unlimited | unlimited |

### 2.6 Recommended Libraries

| Library | Purpose | Maturity |
|---------|---------|----------|
| `next-auth` (v5) | Auth framework | 6 years, 22K+ GitHub stars |
| `@auth/drizzle-adapter` | DB adapter for Auth.js | Official adapter |
| `arctic` | Low-level OAuth 2.0 / OIDC | Alternative if Auth.js too opinionated |
| `jose` | JWT creation/verification | IETF-compliant, zero-dependency |

### 2.7 Auth.js v5 Production Checklist

- [ ] Set `AUTH_SECRET` environment variable (required, will throw without it)
- [ ] Set `AUTH_TRUST_HOST=true` in Docker/Coolify environments
- [ ] Use separate OAuth apps for development vs production
- [ ] Configure CSRF protection (built-in, but verify)
- [ ] Set session `maxAge` and `updateAge` appropriately
- [ ] Test provider-specific edge cases (token refresh, account linking)

### 2.8 Failure Modes

- **OAuth provider down** (Google outage): Users cannot log in via that provider. Mitigation: Support multiple providers. Consider email magic link as fallback.
- **Database session table bloated**: Implement cleanup cron job (delete expired sessions weekly)
- **CSRF token mismatch**: Common with CDN/proxy misconfiguration. Ensure `AUTH_TRUST_HOST=true` on Coolify.

### 2.9 Anti-Patterns

- **Storing JWT in localStorage**: XSS attack vector; use httpOnly cookies
- **Long-lived access tokens** (>1 hour): Increases breach window
- **Rolling your own auth**: Use Auth.js; custom auth is the #1 source of security bugs
- **Hardcoding secrets**: Use environment variables exclusively
- **Not validating `state` parameter**: OAuth CSRF vulnerability (Auth.js handles this)

---

## 3. Payment Integration — Stripe

**Years in production**: Stripe since 2011 (15 years). The gold standard for developer-friendly payment processing.

### 3.1 Architecture Decision: Checkout Sessions (Not Custom Forms)

**Use Stripe Checkout Sessions**, not custom payment forms because:
- **Reduced PCI scope**: Stripe hosts the payment form; you never touch card numbers
- **Built-in UX**: Apple Pay, Google Pay, local payment methods — all handled by Stripe
- **3D Secure / SCA compliance**: Automatically handled
- **Less code**: ~50 lines vs 500+ for custom form with Elements

### 3.2 Subscription Flow

```
User clicks "Upgrade to Premium"
        │
        ▼
Server creates Checkout Session (mode: "subscription")
        │
        ▼
User redirected to Stripe-hosted checkout page
        │
        ├── Success → redirect to /dashboard?session_id=xxx
        │                  │
        │                  ▼
        │              Verify session server-side
        │              (Don't trust client-side redirect alone)
        │
        └── Cancel → redirect to /pricing

Meanwhile, asynchronously:

Stripe webhook → customer.subscription.created
        │
        ▼
Update user role in database (Free → Premium)
```

### 3.3 Webhook Handler Pattern

```typescript
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'
import { db } from '@/db'

export async function POST(req: Request) {
  const body = await req.text()  // RAW body — critical for signature
  const sig = (await headers()).get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return new Response('Invalid signature', { status: 400 })
  }

  // Idempotency: check if event already processed
  const existing = await db.query.processedEvents.findFirst({
    where: eq(processedEvents.stripeEventId, event.id)
  })
  if (existing) return new Response('Already processed', { status: 200 })

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionCanceled(event.data.object)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object)
      break
  }

  // Record processed event
  await db.insert(processedEvents).values({
    stripeEventId: event.id,
    type: event.type,
    processedAt: new Date()
  })

  return new Response('OK', { status: 200 })  // Return 200 within 20 seconds
}
```

### 3.4 Critical Webhook Rules

1. **Return 200 within 20 seconds** — Stripe considers anything else a failure and retries (up to 3 days)
2. **Use raw request body** for signature verification — parsed JSON will break verification
3. **Process idempotently** — Stripe may send the same event multiple times; deduplicate via `event.id`
4. **Signature verification window**: Stripe rejects verification if >5 minutes old (replay attack protection)
5. **For complex processing**: Return 200 immediately, then process asynchronously via a queue

### 3.5 Customer Portal

```typescript
// Self-service subscription management
const portalSession = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
})
// Redirect user to portalSession.url
```

The Customer Portal handles: plan changes, payment method updates, invoice history, cancellation — all without custom UI code.

### 3.6 Stripe Tax

For automatic tax calculation across jurisdictions:
```typescript
const session = await stripe.checkout.sessions.create({
  // ...
  automatic_tax: { enabled: true },
})
```

### 3.7 Testing Strategy

- **Stripe CLI**: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` for local webhook testing
- **Test mode**: Use `sk_test_*` keys; all transactions are simulated
- **Test cards**: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)
- **Clock testing**: Stripe Test Clocks simulate subscription lifecycle (trial → active → past_due → canceled)

### 3.8 Recommended Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| `stripe` (Node.js SDK) | Official Stripe SDK | Type-safe, auto-pagination |
| Stripe CLI | Local webhook testing | Essential for development |
| Stripe Tax | Automatic tax calculation | Compliance in 50+ countries |

### 3.9 Failure Modes

- **Webhook endpoint down**: Stripe retries with exponential backoff for 3 days. After all retries fail, event is visible in Stripe Dashboard.
- **Duplicate webhook delivery**: Idempotency key check (see 3.3) prevents double-processing
- **Stripe API outage** (rare, ~99.999% uptime): Queue payment operations for later processing; show "payment pending" UI
- **Webhook secret rotation**: Support both old and new secrets during rotation period

### 3.10 Anti-Patterns

- **Trusting client-side success redirect**: Always verify session server-side via webhook
- **Custom payment form** when Checkout Session suffices: Unnecessary PCI burden
- **Processing webhooks synchronously** for heavy operations: Return 200 fast, process async
- **Not storing `stripeCustomerId`** on user record: Required for portal, invoices, future charges
- **Hardcoding prices**: Use Stripe Price IDs from Dashboard; change plans without code deploy

---

## 4. Webhook Architecture — Battle-Tested Patterns

**Years in production**: Webhooks as a pattern since ~2007 (19 years). Stripe webhooks since 2011 (15 years). HMAC signature verification in use since the 1990s (30+ years).

### 4.1 Webhook Architecture Overview

Webhooks implement the **Publish-Subscribe (Pub/Sub) architectural pattern** — the receiving application subscribes to events from external services, which push notifications when state changes occur. This is the inverse of polling and is vastly more efficient for event-driven integrations.

**Webhook consumers in the baduk app**:
| Source | Events | Priority |
|--------|--------|----------|
| Stripe | `customer.subscription.*`, `invoice.*`, `checkout.session.completed` | Critical |
| Claude API | Async completion callbacks (if using streaming) | High |
| GitHub (CI/CD) | Deployment status notifications | Low |

**Webhook producers from the baduk app** (Phase 3+):
| Event | Consumer | Use Case |
|-------|----------|----------|
| `game.completed` | Discord bot, analytics | Notify community |
| `analysis.ready` | Mobile push service | Notify user of KataGo results |

### 4.2 Signature Verification — HMAC-SHA256

**The single most important webhook security practice**. Every incoming webhook must be verified before processing.

```typescript
// lib/webhook-verify.ts
import crypto from 'crypto'

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm = 'sha256'
): boolean {
  const expected = crypto
    .createHmac(algorithm, secret)
    .update(payload, 'utf8')
    .digest('hex')

  // CRITICAL: Use timingSafeEqual to prevent timing attacks
  // Never use === for signature comparison
  const sigBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  if (sigBuffer.length !== expectedBuffer.length) return false
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
}
```

**Why `timingSafeEqual`**: A plain `===` comparison returns `false` at the first mismatched character, leaking timing information. An attacker can determine correct signature bytes one at a time. `timingSafeEqual` always compares the full length.

**Stripe-specific verification**: Stripe uses a composite signature (`v1=<hmac>`) with a timestamp to prevent replay attacks. The `stripe.webhooks.constructEvent()` method handles this automatically (see Section 3.3).

### 4.3 Idempotency — PostgreSQL Event Log

**Pattern maturity**: Idempotency keys used by Stripe since 2013 (13 years). Database-backed deduplication is the standard approach.

```sql
-- Webhook event log table (PG)
CREATE TABLE webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL UNIQUE,  -- External event ID (e.g., evt_xxx from Stripe)
  source VARCHAR(50) NOT NULL,            -- 'stripe', 'github', etc.
  event_type VARCHAR(100) NOT NULL,       -- 'customer.subscription.created'
  payload JSONB NOT NULL,                 -- Full event payload for audit trail
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'processed', 'failed'
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  first_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast deduplication lookup
CREATE UNIQUE INDEX idx_webhook_events_event_id ON webhook_events (event_id);

-- Index for monitoring failed events
CREATE INDEX idx_webhook_events_status ON webhook_events (status) WHERE status = 'failed';
```

**Idempotency flow**:
1. Receive webhook → extract `event_id`
2. Attempt `INSERT` with unique constraint on `event_id`
3. If constraint violation (PG error code `23505`) → already processed → return `200 OK`
4. If insert succeeds → process the event → update status to `processed`
5. If processing fails → update status to `failed`, store error → Stripe will retry

**Critical ordering**: Perform the INSERT **before** side effects (emails, database mutations). This ensures that if processing fails partway through, the retry will reprocess correctly.

### 4.4 Retry Handling — Exponential Backoff from Providers

Webhook providers retry failed deliveries with exponential backoff:

| Provider | Retry Schedule | Total Window | Success Code |
|----------|---------------|-------------|-------------|
| Stripe | 3 retries over 3 days | 72 hours | 2xx |
| GitHub | 3 retries at 10s, 60s, 360s | ~7 minutes | 2xx |
| Postmark | 5 retries over 24h | 24 hours | 2xx |

**Your endpoint must**:
- Return `200-299` within the timeout (Stripe: 20s, GitHub: 10s)
- Return 200 immediately for complex processing, then process asynchronously
- Never return 200 if processing actually failed (data loss risk)

### 4.5 Webhook Endpoint Security Checklist

- [ ] **HTTPS only** — never accept webhooks over HTTP
- [ ] **Signature verification** — reject all unsigned/invalid payloads (see 4.2)
- [ ] **IP allowlisting** (optional) — Stripe publishes webhook source IPs
- [ ] **Rate limiting** — even verified webhooks should be rate-limited (prevent abuse via event flooding)
- [ ] **Dedicated route** — `/api/webhooks/stripe` not `/api/webhook` (source-specific routing)
- [ ] **No sensitive data in response** — return minimal body (`OK` or empty)
- [ ] **Replay protection** — Stripe includes timestamp; reject events older than 5 minutes

### 4.6 Webhook Event Audit Trail

The PostgreSQL `webhook_events` table (Section 4.3) serves as a complete audit trail:

**Benefits**:
- **Debugging**: Replay any event by reading stored payload
- **Compliance**: Prove that payment events were received and processed (PCI, SOX)
- **Monitoring**: Query for failed events, alert on patterns (same event type failing repeatedly)
- **Recovery**: After a bug fix, reprocess failed events from the stored payload

**Retention policy**: Keep webhook events for 90 days minimum (Stripe's event retention period). Archive to cold storage after that.

### 4.7 Webhook Anti-Patterns

- **Processing before verifying signature**: Security vulnerability — forge events to trigger actions
- **Using parsed JSON body for signature verification**: Raw body bytes must match what was signed; JSON.parse + JSON.stringify changes whitespace/ordering
- **Returning 200 before confirming DB write succeeded**: Data loss when DB is temporarily down
- **No idempotency handling**: Double-processing payments, duplicate emails
- **Synchronous heavy processing**: Webhook endpoint times out, provider retries, causing duplicate work
- **Ignoring webhook during deploys**: Use a queue so events aren't lost during zero-downtime deploys

---

## 5. Email — Transactional Patterns

**Years in production**: SMTP since 1982 (44 years). Modern transactional email services (SendGrid, Postmark) since ~2009 (17 years).

### 5.1 Provider Recommendation: Postmark

| Provider | Inbox Rate | Latency | Free Tier | Best For |
|----------|-----------|---------|-----------|----------|
| **Postmark** | 98.7% | ~1s | 100 emails/month | Transactional reliability |
| SendGrid | 95.3% | ~3s | 100 emails/day | Mixed transactional + marketing |
| Amazon SES | ~97% | ~2s | 62K/month (from EC2) | High volume, low cost |

**Postmark is recommended** because:
- Highest inbox placement rates (98.7%) — critical for password resets and game invitations
- Separates transactional and broadcast infrastructure (IP reputation isolation)
- Excellent API documentation with Node.js examples
- At MAU 8K, the free tier (100/month) is insufficient; their $15/month plan covers 10K emails

### 5.2 Email Template Catalog

| Template | Trigger | Priority |
|----------|---------|----------|
| Welcome | User registration | Day 1 |
| Email verification | Registration / email change | Day 1 |
| Password reset | Forgot password request | Day 1 |
| Game invitation | User invites friend | Phase 2 |
| Move notification | Opponent played in async game | Phase 2 |
| Analysis complete | KataGo analysis finished | Phase 2 |
| Weekly digest | Cron (Sunday) — games played, rank change | Phase 3 |
| Subscription receipt | Stripe webhook (invoice.paid) | Day 1 |
| Payment failed | Stripe webhook (invoice.payment_failed) | Day 1 |
| Subscription canceled | Stripe webhook (subscription.deleted) | Day 1 |

### 5.3 Deliverability Best Practices

**DNS Records** (set once, forget):

| Record | Purpose | Priority |
|--------|---------|----------|
| SPF | Authorize sending IPs | Required |
| DKIM | Cryptographic message signing (2048-bit) | Required |
| DMARC | Policy for failed SPF/DKIM | Required |
| Return-Path (CNAME) | Bounce handling | Recommended |

Setup time: 15-20 minutes for DNS records, 1-2 hours for propagation.

**Domain Warm-Up Schedule** (new sending domain):
- Week 1: 50 emails/day (verification, welcome only)
- Week 2: 200 emails/day
- Week 3: 500 emails/day
- Week 4+: Full volume

**Bounce Handling**:
- Hard bounces (invalid address): Remove from list immediately
- Soft bounces (mailbox full): Retry 3 times, then suppress
- Complaint (marked as spam): Immediate suppression + review template

### 5.4 Compliance

- **CAN-SPAM**: Unsubscribe link in every marketing email (not required for transactional)
- **GDPR**: Explicit consent for marketing emails; transactional emails (order confirmations, password resets) do not require consent
- **Korea PIPA**: Similar to GDPR; explicit consent for marketing

### 5.5 Recommended Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| `postmark` | Official Postmark SDK | Type-safe, template support |
| `nodemailer` | Generic SMTP client | Fallback, works with any provider |
| `react-email` | Email templates in React/JSX | Compile to HTML, great DX |
| `@react-email/components` | Pre-built email components | Responsive, tested across clients |

### 5.6 Implementation Pattern

```typescript
// lib/email.ts
import { ServerClient } from 'postmark'

const client = new ServerClient(process.env.POSTMARK_API_TOKEN!)

export async function sendWelcomeEmail(to: string, name: string) {
  await client.sendEmailWithTemplate({
    From: 'hello@baduk-app.com',
    To: to,
    TemplateAlias: 'welcome',
    TemplateModel: { name, dashboardUrl: `${process.env.APP_URL}/dashboard` },
  })
}
```

### 5.7 Anti-Patterns

- **Using marketing email service for transactional**: Shared IP reputation damages deliverability
- **No bounce handling**: Destroys sender reputation over time
- **HTML-only emails**: Always include plain-text alternative
- **Sending from `noreply@`**: Reduces trust; use a monitored address
- **Not testing across email clients**: Use Litmus or Email on Acid for rendering checks

---

## 6. Caching, CDN & Redis Patterns

**Years in production**: Redis since 2009 (17 years). Cloudflare since 2010 (16 years). HTTP caching headers since HTTP/1.1 (1997, 29 years).

### 6.1 Redis Caching Patterns for the Baduk App

#### Pattern 1: Cache-Aside (Primary Pattern)

The most appropriate general-purpose pattern. Application checks cache first; on miss, loads from DB and populates cache.

```typescript
async function getGameState(gameId: string) {
  const cached = await redis.get(`game:${gameId}:state`)
  if (cached) return JSON.parse(cached)

  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) })
  if (game) {
    await redis.setex(`game:${gameId}:state`, 300, JSON.stringify(game))  // 5 min TTL
  }
  return game
}
```

#### Pattern 2: Session Cache

```typescript
// User profile + subscription status — avoid DB hit on every request
await redis.setex(`session:${userId}`, 1800, JSON.stringify({
  role: 'premium',
  subscriptionStatus: 'active',
  displayName: 'GoPlayer123',
  rating: 1850,
}))
// TTL: 30 minutes. Invalidate on Stripe webhook or profile update.
```

#### Pattern 3: KataGo Analysis Cache

```typescript
// Position hash → analysis result
// Key: SGF-derived position hash (board state, not move sequence)
const positionHash = computeZobristHash(boardState)
const cacheKey = `analysis:${positionHash}`

const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)  // Cache hit — instant response

const result = await runKataGoAnalysis(boardState)
await redis.setex(cacheKey, 86400, JSON.stringify(result))  // 24h TTL
return result
```

**Why 24h TTL**: KataGo analysis for a given position is deterministic (same settings = same result). 24h balances memory usage with hit rate. Popular positions (common joseki) stay cached.

#### Pattern 4: Rate Limiting (Sliding Window)

```typescript
// Using Redis sorted sets for precise sliding window
async function checkRateLimit(userId: string, limit: number, windowMs: number): Promise<boolean> {
  const key = `ratelimit:${userId}`
  const now = Date.now()
  const windowStart = now - windowMs

  const multi = redis.multi()
  multi.zremrangebyscore(key, 0, windowStart)  // Remove expired entries
  multi.zadd(key, now, `${now}:${crypto.randomUUID()}`)  // Add current request
  multi.zcard(key)  // Count requests in window
  multi.expire(key, Math.ceil(windowMs / 1000))  // Set TTL for cleanup

  const results = await multi.exec()
  const count = results[2] as number
  return count <= limit
}
```

#### Redis Memory Estimation (MAU 8K)

| Cache Type | Key Count | Avg Size | TTL | Memory |
|-----------|-----------|----------|-----|--------|
| Sessions | ~2K concurrent | 500B | 30min | ~1 MB |
| Game state | ~500 active | 2KB | 5min | ~1 MB |
| Analysis cache | ~50K positions | 5KB | 24h | ~250 MB |
| Rate limits | ~2K users | 200B | 1min | ~0.5 MB |
| **Total** | | | | **~253 MB** |

Redis 7.2 with 512MB is more than sufficient. Use `volatile-lru` eviction policy.

#### Pattern 5: Redis Pub/Sub for Real-Time Game Features

**Pattern maturity**: Redis Pub/Sub available since Redis 2.0 (2010, 16 years). Battle-tested in chat apps, live dashboards, and gaming platforms.

Redis Pub/Sub enables real-time communication between WebSocket server instances, solving the multi-instance scaling problem.

```typescript
// lib/redis-pubsub.ts
import Redis from 'ioredis'

const publisher = new Redis(process.env.REDIS_URL!)
const subscriber = new Redis(process.env.REDIS_URL!)

// Channels for the baduk app
const CHANNELS = {
  GAME_MOVE: 'game:move',          // Real-time move broadcast
  GAME_CHAT: 'game:chat',          // In-game chat messages
  ANALYSIS_READY: 'analysis:ready', // KataGo analysis completed
  USER_STATUS: 'user:status',       // Online/offline status
  MATCH_FOUND: 'match:found',       // Matchmaking result
} as const

// Publishing a move (from WebSocket handler)
async function publishMove(gameId: string, move: Move) {
  await publisher.publish(CHANNELS.GAME_MOVE, JSON.stringify({
    gameId, move, timestamp: Date.now()
  }))
}

// Subscribing (each WebSocket server instance)
subscriber.subscribe(CHANNELS.GAME_MOVE, CHANNELS.ANALYSIS_READY)
subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message)
  switch (channel) {
    case CHANNELS.GAME_MOVE:
      broadcastToGameRoom(data.gameId, data)  // Send to all clients in game room
      break
    case CHANNELS.ANALYSIS_READY:
      notifyUser(data.userId, data)           // Send to requesting user
      break
  }
})
```

**Architecture benefit**: When scaling to multiple Node.js instances behind a load balancer, Redis Pub/Sub ensures that a move made on Server A is broadcast to spectators connected to Server B. Without this, each server only knows about its own WebSocket connections.

**Go app-specific channels**:
| Channel | Data | Frequency | Latency Requirement |
|---------|------|-----------|-------------------|
| `game:move` | Move coordinates + captures | Per move (~1/min avg, burst during speed games) | <100ms |
| `game:chat` | Text messages | Variable | <500ms |
| `analysis:ready` | Analysis result ID | Per analysis request | <1s |
| `user:status` | Online/offline/in-game | Per status change | <2s |
| `match:found` | Game ID + opponent info | Per match | <500ms |

**Limitation**: Redis Pub/Sub is fire-and-forget — if a subscriber is down when a message is published, that message is lost. For the baduk app this is acceptable because:
- Moves are persisted to PostgreSQL before being published
- Clients can fetch missed state via REST API on reconnect
- For critical events (game results, payments), use persistent queues instead

#### Redis Memory Management & Eviction

**Configuration for the baduk app**:

```conf
# redis.conf
maxmemory 512mb
maxmemory-policy volatile-lru
maxmemory-samples 10
```

**Eviction policy selection rationale**:

| Policy | Behavior | When to Use |
|--------|----------|-------------|
| `volatile-lru` | Evict least recently used keys that have TTL set | **Recommended** — protects keys without TTL while allowing cache eviction |
| `allkeys-lru` | Evict any LRU key | When all data is cacheable (no critical keys) |
| `volatile-lfu` | Evict least frequently used with TTL | When access frequency matters more than recency |
| `noeviction` | Return error when full | For persistence-critical data (not caching) |

**Why `volatile-lru` for the baduk app**: All cache keys have TTL set (sessions: 30min, game state: 5min, analysis: 24h, rate limits: 1min). Keys without TTL (pub/sub channels, configuration) are protected from eviction. If memory pressure increases, least-recently-used cache entries are evicted first — analysis results for obscure positions get evicted before popular joseki positions.

**Monitoring recommendations**:
- Alert when `used_memory` exceeds 80% of `maxmemory` (threshold: 410MB)
- Track `evicted_keys` metric — rising evictions indicate need to scale
- Monitor `keyspace_hits` / `keyspace_misses` ratio — target >90% hit rate
- Use `INFO memory` command for real-time memory breakdown

### 6.2 CDN Patterns (Cloudflare)

| Content Type | Cache Strategy | Cache-Control |
|-------------|---------------|---------------|
| JS/CSS bundles | Immutable + content hash | `public, max-age=31536000, immutable` |
| Images (board, stones) | Long cache | `public, max-age=604800` (7 days) |
| API responses | No cache or short | `private, no-cache` or `max-age=60` |
| Game SGF exports | Medium cache | `public, max-age=3600` (1 hour) |

**Cache Invalidation Strategy**:
- **Static assets**: Use content-hashed filenames (Next.js does this automatically). No purging needed — new hash = new URL.
- **API responses**: Use `Cache-Control: private, no-cache` — CDN passes through, browser revalidates.
- **Selective purge**: Cloudflare supports purge by URL, prefix, tag, or hostname. Use cache tags for grouped invalidation.

### 6.3 HTTP Caching Headers

```typescript
// Next.js Route Handler example
export async function GET(req: Request) {
  const data = await getPublicGameData(id)

  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'ETag': computeETag(data),
      'Last-Modified': data.updatedAt.toUTCString(),
    }
  })
}
```

- `s-maxage=60`: CDN caches for 60 seconds
- `stale-while-revalidate=300`: Serve stale for 5 min while fetching fresh copy (non-blocking)
- `ETag`: Enables conditional requests (`If-None-Match`)

### 6.4 Anti-Patterns

- **Caching user-specific data in CDN**: Use `Cache-Control: private` for authenticated responses
- **No TTL on cache entries**: Memory leak; always set expiration
- **Cache stampede**: When TTL expires, hundreds of requests hit DB simultaneously. Mitigate with `stale-while-revalidate` or mutex/lock pattern.
- **Caching error responses**: A temporary 500 gets cached and served to everyone. Never cache errors.
- **Not invalidating on write**: Update cache (or delete key) when underlying data changes

---

## 7. Error Handling & Resilience Patterns

**Years in production**: Circuit breaker pattern formalized by Michael Nygard in "Release It!" (2007, 19 years). Exponential backoff used in Ethernet since 1980 (46 years). Bulkhead pattern from ship design (centuries), applied to software since ~2009.

### 7.1 Circuit Breaker Pattern

**Recommended Library**: `opossum` (Node.js, TypeScript types available, requires Node 20+)

```typescript
import CircuitBreaker from 'opossum'

// Circuit breaker for Claude API
const claudeBreaker = new CircuitBreaker(callClaudeAPI, {
  timeout: 30000,          // 30s timeout per call
  errorThresholdPercentage: 50,  // Open if 50%+ fail
  resetTimeout: 30000,     // Try half-open after 30s
  volumeThreshold: 5,      // Minimum 5 calls before evaluating
  rollingCountTimeout: 60000,  // 60s rolling window
})

claudeBreaker.fallback(() => ({
  explanation: getTemplateExplanation(position),  // Pre-written template
  source: 'template',
  notice: 'AI explanation temporarily unavailable. Showing template.'
}))

claudeBreaker.on('open', () => logger.warn('Claude API circuit OPEN'))
claudeBreaker.on('halfOpen', () => logger.info('Claude API circuit HALF-OPEN'))
claudeBreaker.on('close', () => logger.info('Claude API circuit CLOSED'))
```

**Per-Service Configuration**:

| Service | Timeout | Error Threshold | Reset Timeout |
|---------|---------|----------------|---------------|
| Claude API | 30s | 50% (5 min window) | 30s |
| Stripe API | 10s | 30% (1 min window) | 15s |
| KataGo (local) | 60s | 25% (2 min window) | 10s |
| Postmark | 5s | 50% (5 min window) | 30s |

### 7.2 Retry with Exponential Backoff + Jitter

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number; maxDelay: number }
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === options.maxRetries) throw err
      if (!isRetryable(err)) throw err  // Don't retry 4xx errors

      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,  // Jitter
        options.maxDelay
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Unreachable')
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error && 'status' in err) {
    const status = (err as any).status
    return status >= 500 || status === 429  // Server errors + rate limits
  }
  return true  // Network errors are retryable
}
```

**Jitter is critical**: Without jitter, all clients retry at the same time after a failure, causing a "thundering herd" that can bring down the recovering service.

### 7.3 Graceful Degradation Hierarchy

```
┌─────────────────────────────────────────────────┐
│                Service Status                     │
├──────────────┬──────────────────────────────────┤
│ Claude API   │ DOWN → Template-based explanation │
│              │ (pre-written for common positions) │
├──────────────┼──────────────────────────────────┤
│ KataGo       │ CRASH → Auto-restart process      │
│              │ Queue holds, process when back     │
│              │ Show "analysis pending" in UI      │
├──────────────┼──────────────────────────────────┤
│ Stripe       │ DOWN → Queue payment operation     │
│              │ Process when service recovers      │
│              │ Show "payment processing" to user  │
├──────────────┼──────────────────────────────────┤
│ Postmark     │ DOWN → Queue emails                │
│              │ Fall back to Nodemailer + SMTP      │
│              │ Non-critical emails can be dropped  │
├──────────────┼──────────────────────────────────┤
│ Redis        │ DOWN → Fall through to database    │
│              │ Performance degrades, not fails     │
│              │ Rate limiting falls back to memory  │
├──────────────┼──────────────────────────────────┤
│ PostgreSQL   │ DOWN → App is effectively down     │
│              │ Show maintenance page               │
│              │ All writes queued (if possible)     │
└──────────────┴──────────────────────────────────┘
```

### 7.4 Dead Letter Queue for Failed Webhooks

```typescript
// When webhook processing fails after all retries
interface DeadLetterEntry {
  id: string
  eventId: string               // Stripe event ID
  eventType: string             // e.g., 'invoice.payment_failed'
  payload: string               // Full event JSON
  error: string                 // Last error message
  attempts: number              // Total delivery attempts
  firstAttemptAt: Date
  lastAttemptAt: Date
  resolvedAt: Date | null       // null = unresolved
}

// Store in PostgreSQL (not Redis — must survive restarts)
// Alert on: count > 5 unresolved, or same event type failing repeatedly
```

### 7.5 Bulkhead Pattern for Resource Isolation

**Pattern maturity**: Borrowed from ship hull design (compartmentalized flooding). Applied to software by Michael Nygard in "Release It!" (2007, 19 years).

The Bulkhead Pattern isolates resources so that a failure in one component does not cascade to the entire system. For a baduk app calling multiple external services, this means each service gets its own resource pool.

```typescript
// lib/bulkheads.ts
// Each external service gets an isolated connection/concurrency pool

// Bulkhead for Claude API calls
const claudePool = {
  maxConcurrent: 5,        // Max simultaneous Claude API calls
  currentActive: 0,
  queue: [] as Array<{ resolve: Function; reject: Function; fn: Function }>,
}

// Bulkhead for KataGo analysis
const katagoPool = {
  maxConcurrent: 3,        // KataGo is CPU/GPU-bound — limit strictly
  currentActive: 0,
  queue: [] as Array<{ resolve: Function; reject: Function; fn: Function }>,
}

// Bulkhead for Stripe API calls
const stripePool = {
  maxConcurrent: 10,       // Stripe handles high concurrency well
  currentActive: 0,
  queue: [] as Array<{ resolve: Function; reject: Function; fn: Function }>,
}

async function executeBulkheaded<T>(
  pool: typeof claudePool,
  fn: () => Promise<T>
): Promise<T> {
  if (pool.currentActive >= pool.maxConcurrent) {
    // Queue the request instead of overwhelming the service
    return new Promise((resolve, reject) => {
      pool.queue.push({ resolve, reject, fn })
    })
  }

  pool.currentActive++
  try {
    return await fn()
  } finally {
    pool.currentActive--
    // Process queued request
    if (pool.queue.length > 0) {
      const next = pool.queue.shift()!
      executeBulkheaded(pool, next.fn as () => Promise<any>)
        .then(next.resolve)
        .catch(next.reject)
    }
  }
}
```

**Resource isolation for the baduk app**:

| Service | Max Concurrent | Rationale |
|---------|---------------|-----------|
| Claude API | 5 | API rate limits + cost control |
| KataGo (local) | 3 | GPU-bound, more would thrash |
| Stripe API | 10 | High concurrency tolerance |
| PostgreSQL | 20 (pool) | Connection pool already acts as bulkhead |
| Redis | 50 (pool) | Low-latency, handles high concurrency |

**Combined with Circuit Breaker**: Bulkhead prevents resource exhaustion (controls concurrency), while Circuit Breaker prevents cascade failure (stops calling failing services). Used together:
1. Request enters **Bulkhead** (concurrency gate)
2. If admitted, passes through **Circuit Breaker** (failure gate)
3. If circuit is closed, executes with **Timeout**
4. On failure, **Retry with Backoff** (if idempotent)

This layered defense ensures that even if Claude API is down and all 5 concurrent slots are timing out, the KataGo analysis and Stripe payments continue functioning normally.

### 7.6 Health Check Endpoints

```typescript
// app/api/health/live/route.ts — Liveness probe
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}

// app/api/health/ready/route.ts — Readiness probe
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    katago: await checkKataGo(),
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok')

  return Response.json(
    { status: allHealthy ? 'ready' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 }
  )
}

// app/api/health/route.ts — Detailed health (admin only)
export async function GET() {
  return Response.json({
    status: 'ok',
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabaseDetailed(),
      redis: await checkRedisDetailed(),
      katago: await checkKataGoDetailed(),
      stripe: await checkStripeConnectivity(),
      claude: await checkClaudeAPIConnectivity(),
    }
  })
}
```

**Naming Convention**: Use `/health/live` and `/health/ready` (z-pages pattern: `/livez`, `/readyz` is also common but less readable).

### 7.7 Timeout Management

| Service | Connect Timeout | Read Timeout | Total Timeout |
|---------|----------------|-------------|---------------|
| Claude API | 5s | 30s | 35s |
| Stripe API | 3s | 10s | 13s |
| KataGo | 2s | 60s | 62s |
| PostgreSQL | 2s | 5s | 7s |
| Redis | 1s | 2s | 3s |
| Postmark | 3s | 5s | 8s |

### 7.8 Recommended Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| `opossum` | Circuit breaker | Red Hat maintained, Node 20+ |
| `p-retry` | Retry with backoff | Lightweight, Promise-based |
| `p-timeout` | Promise timeout | Composable with p-retry |
| `ioredis` | Redis client | Built-in reconnect, cluster support |
| `pino` | Structured logging | Fast, JSON output, production-grade |

### 7.9 Anti-Patterns

- **No timeout on external calls**: A hanging connection blocks the event loop. Always set timeouts.
- **Retrying non-idempotent operations**: POST to create a game — retry could create duplicates. Only retry safe operations or use idempotency keys.
- **Circuit breaker with too-low threshold**: 1-2 failures triggering open state causes flapping. Use `volumeThreshold` (minimum samples before evaluating).
- **Logging without structure**: `console.log("Error:", err)` is unsearchable. Use structured logging (`pino`) with context fields.
- **Swallowing errors silently**: Always log, always alert on repeated failures.

---

## 8. Database Integration Patterns

**Years in production**: PostgreSQL since 1996 (30 years). Drizzle ORM since 2022 (4 years, rapid adoption).

### 8.1 Repository Pattern with Drizzle ORM

Drizzle uses pure TypeScript for schema definitions (not a custom DSL like Prisma). This is an advantage for AI agent implementability — standard TypeScript, no special parsing needed.

```typescript
// db/schema/games.ts
import { pgTable, uuid, varchar, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  blackPlayerId: uuid('black_player_id').references(() => users.id).notNull(),
  whitePlayerId: uuid('white_player_id').references(() => users.id),
  boardSize: integer('board_size').notNull().default(19),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  // 'active' | 'completed' | 'resigned' | 'timeout'
  moves: jsonb('moves').notNull().default([]),
  result: varchar('result', { length: 20 }),  // 'B+2.5', 'W+R', etc.
  sgf: varchar('sgf'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

```typescript
// db/repositories/game-repository.ts
export class GameRepository {
  constructor(private db: DrizzleDB) {}

  async findById(id: string) {
    return this.db.query.games.findFirst({
      where: eq(games.id, id),
      with: { blackPlayer: true, whitePlayer: true },
    })
  }

  async findByUser(userId: string, cursor?: string, limit = 20) {
    const conditions = [
      or(eq(games.blackPlayerId, userId), eq(games.whitePlayerId, userId))
    ]
    if (cursor) {
      const decoded = decodeCursor(cursor)
      conditions.push(
        or(
          lt(games.createdAt, decoded.createdAt),
          and(eq(games.createdAt, decoded.createdAt), lt(games.id, decoded.id))
        )
      )
    }
    return this.db.query.games.findMany({
      where: and(...conditions),
      orderBy: [desc(games.createdAt), desc(games.id)],
      limit: limit + 1,  // Fetch one extra to determine hasMore
    })
  }

  async create(data: NewGame) {
    const [game] = await this.db.insert(games).values(data).returning()
    return game
  }

  async addMove(gameId: string, move: Move) {
    return this.db.transaction(async (tx) => {
      const game = await tx.query.games.findFirst({
        where: eq(games.id, gameId),
        for: 'update',  // SELECT FOR UPDATE — row lock
      })
      if (!game) throw new NotFoundError('Game not found')
      if (game.status !== 'active') throw new ConflictError('Game is not active')

      const updatedMoves = [...game.moves, move]
      await tx.update(games)
        .set({ moves: updatedMoves, updatedAt: new Date() })
        .where(eq(games.id, gameId))

      return { ...game, moves: updatedMoves }
    })
  }
}
```

### 8.2 Transaction Management

**Key Principles**:
- Use transactions for multi-step operations that must be atomic (e.g., play move + update score + check game end)
- Use `SELECT FOR UPDATE` to prevent concurrent move conflicts in the same game
- Keep transactions short — long transactions hold locks and block other operations

```typescript
// Example: Complete a game (atomic)
async function completeGame(gameId: string, result: string) {
  return db.transaction(async (tx) => {
    // 1. Update game status
    await tx.update(games)
      .set({ status: 'completed', result, updatedAt: new Date() })
      .where(eq(games.id, gameId))

    // 2. Update player ratings (ELO calculation)
    const game = await tx.query.games.findFirst({ where: eq(games.id, gameId) })
    const [newBlackRating, newWhiteRating] = calculateElo(game, result)

    await tx.update(users).set({ rating: newBlackRating }).where(eq(users.id, game.blackPlayerId))
    await tx.update(users).set({ rating: newWhiteRating }).where(eq(users.id, game.whitePlayerId))

    // 3. Invalidate caches
    await redis.del(`game:${gameId}:state`)
    await redis.del(`user:${game.blackPlayerId}:profile`)
    await redis.del(`user:${game.whitePlayerId}:profile`)
  })
}
```

### 8.3 Connection Pooling

```typescript
// db/index.ts
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // Max connections in pool
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if can't connect in 2s
})

export const db = drizzle(pool, { schema })
```

**Pool Sizing Rule of Thumb**: `max = (CPU cores * 2) + effective_disk_spindles`. For a Hetzner VPS with 4 cores and SSD: `max = (4 * 2) + 1 = 9` minimum, round up to 15-20 for headroom.

### 8.4 Migration Strategy with Drizzle Kit

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Introspect existing database (useful for brownfield)
npx drizzle-kit introspect
```

**Migration Best Practices**:
1. **Additive changes first**: Add new columns as nullable, backfill, then add NOT NULL constraint
2. **Safe renames**: Add new column → backfill → update code → drop old column (never rename directly in production)
3. **Concurrent indexes**: Use `CREATE INDEX CONCURRENTLY` to avoid locking tables during index creation
4. **Idempotent migrations**: Check `IF NOT EXISTS` for creates, `IF EXISTS` for drops
5. **Test migrations**: Run against a copy of production data before deploying

**Migration folder structure** (Drizzle v3): `YYYYMMDDHHmmss_n/` — second precision, supports out-of-order migrations for team workflows.

### 8.5 PostgreSQL-Specific Patterns for Baduk

```sql
-- Use identity columns (NOT serial) — PostgreSQL best practice since PG 10
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- ...
);

-- GIN index for JSONB moves (query moves by position)
CREATE INDEX idx_games_moves ON games USING GIN (moves);

-- Partial index for active games only (most queries filter by status)
CREATE INDEX idx_games_active ON games (created_at DESC) WHERE status = 'active';

-- Full-text search for game annotations/comments
CREATE INDEX idx_games_annotations_fts ON game_annotations
  USING GIN (to_tsvector('english', annotation_text));
```

### 8.6 Seed Data

Essential seed data for a baduk app:
- **Go problems (tsumego)**: 100+ beginner problems with solutions (life & death, tesuji)
- **Joseki database**: Common corner patterns with variations
- **Opening fuseki**: Standard openings with explanations
- **Test users**: Free, premium, and admin accounts for development

```typescript
// db/seed.ts
async function seed() {
  // System user for AI-generated content
  await db.insert(users).values({
    id: SYSTEM_USER_ID,
    name: 'Baduk AI',
    role: 'admin',
  })

  // Beginner tsumego problems
  const problems = await loadProblemsFromSGF('./seed-data/tsumego/')
  await db.insert(goProblems).values(problems)

  // Common joseki
  const joseki = await loadJosekiFromSGF('./seed-data/joseki/')
  await db.insert(josekiPatterns).values(joseki)
}
```

### 8.7 Read Replica Pattern (Phase 2)

Not needed at MAU 8K. Plan for it when:
- Read:write ratio exceeds 10:1
- Query latency consistently >100ms
- Connection pool exhaustion under peak load

When ready, Drizzle supports specifying different database instances for read vs write:

```typescript
const writeDb = drizzle(writePool, { schema })
const readDb = drizzle(readPool, { schema })

// Queries go to read replica
const games = await readDb.query.games.findMany(...)

// Mutations go to primary
await writeDb.insert(games).values(data)
```

### 8.8 Recommended Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| `drizzle-orm` | ORM | TypeScript-native, SQL-like API |
| `drizzle-kit` | Migrations CLI | Generate, apply, introspect |
| `pg` (node-postgres) | PostgreSQL driver | Pool support, battle-tested (20+ years) |
| `postgres` (postgres.js) | Alternative PG driver | Faster, but newer |
| `@auth/drizzle-adapter` | Auth.js integration | Official adapter |

### 8.9 Anti-Patterns

- **Using `serial` instead of `identity`**: PostgreSQL recommends identity columns since PG 10
- **N+1 queries**: Use Drizzle's `with` for eager loading relations
- **Missing indexes on foreign keys**: Every `_id` column needs an index
- **Storing board state as string**: Use JSONB for structured move data; enables querying
- **Large transactions**: Keep transactions under 100ms. Long transactions block other writes.
- **Not using connection pooling**: Each request opening a new connection is 50-100ms overhead
- **Migrations without rollback plan**: Always test migrations on a DB copy first

---

## Cross-Cutting Concerns

### Recommended Observability Stack

| Layer | Tool | Why |
|-------|------|-----|
| Logging | `pino` | Fastest Node.js logger, JSON structured output |
| Error tracking | Sentry (free tier) | Automatic error grouping, source maps |
| Uptime monitoring | UptimeRobot or Better Stack | Free tier sufficient for MAU 8K |
| APM (Phase 2) | OpenTelemetry + Grafana | When performance tuning is needed |

### Environment Variable Management

```bash
# .env.local (development — gitignored)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
POSTMARK_API_TOKEN=...
CLAUDE_API_KEY=...
```

Use Coolify's built-in environment variable management for production. Never commit `.env` files.

### Overall Library Summary

| Category | Library | Purpose | Production Years |
|----------|---------|---------|-----------------|
| API Validation | `zod` | Runtime validation + types | 4+ years |
| API Docs | `@scalar/nextjs-api-reference` | Interactive API docs | 3+ years |
| Auth | `next-auth` v5 | OAuth 2.0 / OIDC | 6+ years |
| JWT | `jose` | Token operations | 5+ years |
| Payment | `stripe` SDK | Stripe integration | 10+ years |
| Email | `postmark` SDK | Transactional email | 10+ years |
| Email Templates | `react-email` | JSX email templates | 3+ years |
| Cache | `ioredis` | Redis client | 9+ years |
| Circuit Breaker | `opossum` | Resilience pattern | 7+ years |
| Retry | `p-retry` | Exponential backoff | 7+ years |
| ORM | `drizzle-orm` | Database operations | 4+ years |
| Logging | `pino` | Structured logging | 8+ years |
| Error Tracking | `@sentry/nextjs` | Error monitoring | 10+ years |

---

## AI Agent Implementability Assessment

All patterns in this document were selected for **high AI agent implementability**:

1. **Well-documented**: Every library has extensive documentation and examples
2. **TypeScript-native**: Type safety catches errors at compile time, reducing AI hallucination impact
3. **Declarative over imperative**: Zod schemas, Drizzle schema definitions, Auth.js config — all declarative
4. **Minimal custom logic**: Using Stripe Checkout (not custom forms), Auth.js (not custom auth), Postmark templates (not custom rendering)
5. **Standard patterns**: Cache-aside, circuit breaker, repository — all have canonical implementations
6. **Copy-paste friendly**: Code snippets in this document are production-ready starting points

**Risk Areas for AI Agents**:
- Webhook signature verification (raw body handling is subtle — must not parse JSON before verifying)
- Transaction isolation levels (AI may not understand concurrent access patterns)
- Cache invalidation timing (race conditions between write and cache delete)
- OAuth callback URL configuration (environment-specific, easy to misconfigure)

These risk areas should have **explicit test cases** and **integration tests** that verify correct behavior.

---

## Conclusion: Recommended Classical Integration Pattern Set

### Pattern Maturity & Reliability Scores

| Pattern | Years in Production | Proven Implementations | Go App Application | Complexity | Reliability Score |
|---------|-------------------|----------------------|-------------------|------------|------------------|
| **REST API + Zod + OpenAPI** | 25+ years | Stripe, GitHub, AWS, Twilio | All game/user/analysis endpoints | Low | 9/10 |
| **OAuth 2.0 + PKCE (Auth.js v5)** | 14+ years (OAuth 2.0), 6+ years (NextAuth) | Google, GitHub, Discord, Auth0 | User login, session management, RBAC | Medium | 9/10 |
| **Webhook (HMAC-SHA256 + PG idempotency)** | 19+ years | Stripe, GitHub, Postmark, Twilio | Payment events, deployment notifications | Medium | 9/10 |
| **Circuit Breaker (opossum)** | 19+ years | Netflix Hystrix, Resilience4j, opossum | Claude API, Stripe API, KataGo | Low-Medium | 8/10 |
| **Bulkhead (resource isolation)** | 19+ years | Netflix, AWS SDK, Azure SDK | Per-service concurrency limits | Low | 8/10 |
| **Exponential Backoff + Jitter** | 46+ years (Ethernet origins) | AWS SDK, Stripe SDK, every cloud SDK | All external API calls | Low | 10/10 |
| **Redis Cache-Aside** | 17+ years | Every major web application | KataGo analysis, sessions, game state | Low | 9/10 |
| **Redis Sliding Window Rate Limiting** | 10+ years | Stripe, Cloudflare, GitHub | Per-user API rate limits | Low | 9/10 |
| **Redis Pub/Sub** | 16+ years | Slack, Discord, gaming platforms | Real-time moves, chat, analysis notifications | Low-Medium | 8/10 |
| **PostgreSQL + Drizzle ORM** | 30+ years (PG), 4+ years (Drizzle) | Every enterprise application | All persistent data | Medium | 9/10 |

### Why These Patterns Survive Technology Hype Cycles

1. **REST has survived GraphQL, gRPC, tRPC, and every "REST killer"** because HTTP is the universal protocol. Every CDN, proxy, load balancer, monitoring tool, and debugging utility understands REST natively. Performance benchmarks show REST averaging 922ms vs GraphQL's 1864ms for simple queries. The ecosystem advantage is insurmountable.

2. **OAuth 2.0 + PKCE defeated proprietary auth** because security standards benefit from collective scrutiny. RFC 9700 (2025) codifies 13 years of battle-tested improvements. Auth.js v5 wraps this in a developer-friendly package with 22K+ GitHub stars.

3. **Webhooks replaced polling** because push is fundamentally more efficient than pull. Stripe processes billions of webhook deliveries annually with 99.999% reliability. The HMAC-SHA256 + idempotency pattern has zero known architectural vulnerabilities when implemented correctly.

4. **Circuit breaker + backoff + jitter** survived because distributed systems fail partially by nature. AWS's own architecture blog calls jittered backoff "a standard approach for remote clients." These patterns have been refined across 46 years of networked computing.

5. **Redis caching patterns endure** because the speed-of-light gap between in-memory and disk-based storage is physics, not engineering. Cache-aside is the simplest correct pattern; write-through adds consistency guarantees at minimal complexity cost.

### Implementation Complexity vs Reliability Trade-off

```
Reliability
10 ┤ ● Backoff+Jitter
   │
 9 ┤ ● REST+Zod   ● OAuth/PKCE   ● Webhooks   ● Cache-Aside   ● PG+Drizzle
   │                                              ● Rate Limiting
 8 ┤ ● Circuit Breaker   ● Bulkhead   ● Pub/Sub
   │
 7 ┤
   │
 6 ┤
   └──┬──────┬──────┬──────┬──────┬──────┬──
     Low  Low-Med  Medium  Med-High  High
                 Complexity
```

**Key insight**: All recommended patterns cluster in the **high reliability, low-to-medium complexity** zone. This is not coincidental — decades of refinement have simplified these patterns to their essential forms. Complex patterns that failed to simplify (SOAP, CORBA, EJB) were replaced by simpler alternatives.

### Overall Reliability Score: **9/10**

The classical integration pattern set scores 9/10 overall because:
- Every pattern has 10+ years of production validation (most have 15-25+)
- All libraries have TypeScript support, active maintenance, and large communities
- Failure modes are well-documented with known mitigations
- No single point of failure — each service has a fallback strategy (Section 7.3)
- The -1 point accounts for inherent distributed system complexity (network partitions, clock skew, eventual consistency) which no pattern set can fully eliminate

**Bottom line**: These patterns are boring. That is their greatest virtue. They let a small team building a baduk app focus on the domain (Go game logic, KataGo integration, teaching features) rather than fighting infrastructure. Boring technology is reliable technology.

---

## Sources

### REST API Design
- [REST API Best Practices and Standards in 2026 | Hevo](https://hevodata.com/learn/rest-api-best-practices/)
- [My Node.js API Best Practices in 2025 - DEV Community](https://dev.to/wmdn9116/my-nodejs-api-best-practices-in-2025-1km5)
- [Best practices for REST API design - Stack Overflow](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
- [The Best Practices for REST API Design in 2026 | Medium](https://medium.com/@hdcik/the-best-practices-for-rest-api-design-in-2026-c4f7fb5e5ec3)
- [Understanding Offset and Cursor-Based Pagination in Node.js | AppSignal](https://blog.appsignal.com/2024/05/15/understanding-offset-and-cursor-based-pagination-in-nodejs.html)
- [HATEOAS: Building Self-Documenting REST APIs That Scale | Pradeep Loganathan](https://pradeepl.com/blog/rest/hateoas/)
- [Why HATEOAS is useless | Medium](https://medium.com/@andreasreiser94/why-hateoas-is-useless-and-what-that-means-for-rest-a65194471bc8)
- [REST vs GraphQL vs tRPC: API Guide | Directus](https://directus.io/blog/rest-graphql-tprc)
- [REST vs GraphQL vs tRPC: The Ultimate API Design Guide for 2026 | DEV Community](https://dev.to/dataformathub/rest-vs-graphql-vs-trpc-the-ultimate-api-design-guide-for-2026-8n3)
- [tRPC vs GraphQL vs REST: Choosing the right API design | SD Times](https://sdtimes.com/graphql/trpc-vs-graphql-vs-rest-choosing-the-right-api-design-for-modern-web-applications/)
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Understanding Problem Details — RFC 7807 and RFC 9457 | codecentric](https://www.codecentric.de/en/knowledge-hub/blog/charge-your-apis-volume-19-understanding-problem-details-for-http-apis-a-deep-dive-into-rfc-7807-and-rfc-9457)
- [http-problem-details npm package | GitHub](https://github.com/PDMLab/http-problem-details)
- [Nextjs API Best Practice 2025 | Medium](https://medium.com/@lior_amsalem/nextjs-api-best-practice-2025-250c0a6514b9)

### Next.js 15 Route Handlers & API Docs
- [Next.js Route Handlers: The Complete Guide | MakerKit](https://makerkit.dev/blog/tutorials/nextjs-api-best-practices)
- [Getting Started: Route Handlers and Middleware | Next.js](https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware)
- [Building APIs with Next.js | Next.js](https://nextjs.org/blog/building-apis-with-nextjs)
- [Scalar API Reference for Next.js](https://scalar.com/products/api-references/integrations/nextjs)
- [next-openapi-gen: Auto-generate OpenAPI 3.0 from Next.js | GitHub](https://github.com/tazo90/next-openapi-gen)
- [Using Zod to validate Next.js API Route Handlers | Dub](https://dub.co/blog/zod-api-validation)
- [next-swagger-doc | GitHub](https://github.com/jellydn/next-swagger-doc)
- [API Versioning Deep Dive | Calmops](https://calmops.com/api-design/api-versioning-deep-dive/)
- [How to Implement API Versioning in Node.js (2026) | DEV Community](https://dev.to/1xapi/how-to-implement-api-versioning-strategies-in-nodejs-2026-guide-58cc)

### Pagination
- [A Developer's Guide to API Pagination: Offset vs. Cursor-Based | Gusto](https://embedded.gusto.com/blog/api-pagination/)
- [Cursor Pagination and Why It's So Fast | Milan Jovanovic](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive)
- [Pagination Best Practices in REST API Design | Speakeasy](https://www.speakeasy.com/api-design/pagination)

### Authentication & OAuth 2.0
- [Auth.js | Next.js Reference](https://authjs.dev/reference/nextjs)
- [Auth.js | Configuring OAuth Providers](https://authjs.dev/guides/configuring-oauth-providers)
- [NextAuth.js 2025: Secure Authentication | Strapi](https://strapi.io/blog/nextauth-js-secure-authentication-next-js-guide)
- [Auth.js | Deployment](https://authjs.dev/getting-started/deployment)
- [Migrating to v5 | Auth.js](https://authjs.dev/getting-started/migrating-to-v5)
- [JWT Security Best Practices for 2025 - JWT.app](https://jwt.app/blog/jwt-best-practices/)
- [JWT Security Best Practices | Curity](https://curity.io/resources/learn/jwt-best-practices/)
- [Refresh Token Rotation Best Practices | Serverion](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/)
- [RFC 9700 - Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/rfc9700/)
- [Refresh Token Rotation | Auth0 Docs](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- [Securing SPAs with Refresh Token Rotation | Auth0](https://auth0.com/blog/securing-single-page-applications-with-refresh-token-rotation/)
- [OAuth 2.1 vs 2.0: What developers need to know | Stytch](https://stytch.com/blog/oauth-2-1-vs-2-0/)
- [Stop Crying Over Auth: Auth.js v5 Guide | JavaScript in Plain English](https://javascript.plainenglish.io/stop-crying-over-auth-a-senior-devs-guide-to-next-js-15-auth-js-v5-42a57bc5b4ce)

### Stripe Payment & Webhooks
- [Stripe Checkout and Webhook in Next.js 15 (2025) | Medium](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e)
- [Stripe + Next.js 15: The Complete 2025 Guide | Pedro Alonso](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/)
- [Best practices for Stripe webhooks | Stigg](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Stripe Webhooks: Complete Guide | MagicBell](https://www.magicbell.com/blog/stripe-webhooks-guide)
- [Idempotent requests | Stripe API Reference](https://docs.stripe.com/api/idempotent_requests)
- [Receive Stripe events in your webhook endpoint | Stripe Docs](https://docs.stripe.com/webhooks)
- [Building resilient webhook handlers with DLQs | Stripe Dev Blog](https://stripe.dev/blog/building-resilient-webhook-handlers-aws-dlqs-stripe-events)
- [Stripe Webhooks: Complete Guide with Payload Examples [2025] | InventiveHQ](https://inventivehq.com/blog/stripe-webhooks-guide)

### Webhook Architecture & Security
- [How to Implement Webhook Idempotency | Hookdeck](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)
- [Webhook Architecture Design Pattern | Beeceptor](https://beeceptor.com/docs/webhook-feature-design/)
- [Webhook Security Best Practices 2025-2026 | DEV Community](https://dev.to/digital_trubador/webhook-security-best-practices-for-production-2025-2026-384n)
- [How to Implement SHA256 Webhook Signature Verification | Hookdeck](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification)
- [Webhook Signature Verification: How to Secure Integrations | Apidog](https://apidog.com/blog/webhook-signature-verification/)
- [How to Secure Webhook Endpoints with HMAC | Prismatic](https://prismatic.io/blog/how-secure-webhook-endpoints-hmac/)
- [Top 7 Webhook Reliability Tricks for Idempotency | Medium](https://medium.com/@kaushalsinh73/top-7-webhook-reliability-tricks-for-idempotency-a098f3ef5809)
- [Webhook Deduplication Checklist | Latenode](https://latenode.com/blog/integration-api-management/webhook-setup-configuration/webhook-deduplication-checklist-for-developers)

### Email
- [Postmark Review 2026 | Hackceleration](https://hackceleration.com/postmark-review/)
- [Postmark vs SendGrid: Which Is Better? [2026] | Moosend](https://moosend.com/blog/postmark-vs-sendgrid/)
- [5 Best SendGrid Alternatives for Transactional Email in 2025 | CompanionLink](https://www.companionlink.com/blog/2025/10/5-best-sendgrid-alternatives-for-transactional-email-in-2025/)

### Caching, CDN & Redis
- [Redis Caching Strategies for High-Performance Node.js APIs | Lead With Skills](https://www.leadwithskills.com/blogs/redis-caching-strategies-nodejs-api)
- [Redis Caching Strategies: Next.js Production Guide 2025 | Digital Applied](https://www.digitalapplied.com/blog/redis-caching-strategies-nextjs-production)
- [Cache-Aside Pattern with Redis | Redis.io](https://redis.io/tutorials/howtos/solutions/microservices/caching/)
- [Build 5 Rate Limiters with Redis | Redis.io](https://redis.io/tutorials/howtos/ratelimiting/)
- [Instant Purge: Invalidating cached content under 150ms | Cloudflare](https://blog.cloudflare.com/instant-purge/)
- [Edge Caching for Startups | OtterAI](https://otterai.net/blog/cloudflare-caching-best-practices-startups)
- [Improving Node.js Performance with Redis Caching | Better Stack](https://betterstack.com/community/guides/scaling-nodejs/nodejs-caching-redis/)
- [Cache Optimization Strategies | Redis.io](https://redis.io/blog/guide-to-cache-optimization-strategies/)
- [Caching Patterns - AWS Whitepaper | AWS](https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html)
- [How to Build Redis Caching Patterns | OneUptime](https://oneuptime.com/blog/post/2026-01-26-redis-caching-patterns/view)
- [Key Eviction | Redis Docs](https://redis.io/docs/latest/develop/reference/eviction/)
- [Cache Eviction Strategies Every Redis Developer Should Know | Redis](https://redis.io/blog/cache-eviction-strategies/)
- [Memory Management Best Practices | Google Cloud Memorystore](https://docs.google.com/memorystore/docs/redis/memory-management-best-practices)
- [Redis Sliding Window Rate Limiting | OneUptime](https://oneuptime.com/blog/post/2026-01-25-redis-sliding-window-rate-limiting/view)
- [Redis for Rate Limiting and Throttling in Node.js | Fenil Sonani](https://fenilsonani.com/articles/redis-for-rate-limiting-and-throttling-in-node-js)

### Redis Pub/Sub & Real-Time
- [Build a Real-Time Chat App with Redis Pub/Sub | Redis.io](https://redis.io/tutorials/howtos/chatapp/)
- [Scaling WebSocket Services with Redis Pub/Sub | Leapcell](https://leapcell.io/blog/scaling-websocket-services-with-redis-pub-sub-in-node-js)
- [How to Use Redis Pub/Sub with Node.js | OneUptime](https://oneuptime.com/blog/post/2026-01-25-redis-pubsub-nodejs/view)
- [Scaling Pub/Sub with WebSockets and Redis | Ably](https://ably.com/blog/scaling-pub-sub-with-websockets-and-redis)

### Resilience Patterns
- [Building Resilient Applications: Circuit Breaker Pattern | Medium](https://medium.com/@usama19026/building-resilient-applications-circuit-breaker-pattern-with-exponential-backoff-fc14ba0a0beb)
- [Node.js Advanced Patterns: Implementing Robust Retry Logic | Medium](https://v-checha.medium.com/advanced-node-js-patterns-implementing-robust-retry-logic-656cf70f8ee9)
- [Circuit Breaker Pattern in Node.js and TypeScript | DEV Community](https://dev.to/wallacefreitas/circuit-breaker-pattern-in-nodejs-and-typescript-enhancing-resilience-and-stability-bfi)
- [Opossum — Node.js Circuit Breaker | GitHub](https://github.com/nodeshift/opossum)
- [Dead Letter Queue: How to Implement in Node.js | Medium](https://devdiaryacademy.medium.com/dead-letter-queue-dlq-what-it-is-and-how-to-implement-it-in-a-node-js-application-3c6d4b6a9400)
- [Health Checks | Node.js Reference Architecture](https://nodeshift.dev/nodejs-reference-architecture/operations/healthchecks/)
- [Timeouts, Retries and Backoff with Jitter | AWS Builders' Library](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [Exponential Backoff And Jitter | AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Mastering Exponential Backoff | Better Stack](https://betterstack.com/community/guides/monitoring/exponential-backoff/)
- [Implementing the Bulkhead Pattern in Node.js | DEV Community](https://dev.to/silentwatcher_95/implementing-the-bulkhead-pattern-in-nodejs-14ao)
- [Circuit Breaker with Bulkhead Isolation | GeeksforGeeks](https://www.geeksforgeeks.org/system-design/circuit-breaker-with-bulkhead-isolation-in-microservices/)
- [Bulkhead Pattern in Microservices | Medium](https://rameshfadatare.medium.com/bulkhead-pattern-in-microservices-improve-resilience-fault-isolation-6eb2aec3c5cc)
- [Circuit Breaker Pattern — How to Build Better Microservice Architecture 2025 | Box Piper](https://www.boxpiper.com/posts/circuit-breaker-pattern)

### KataGo Integration
- [KataGo Analysis Engine Documentation | GitHub](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
- [KataGo GTP Engine | GitHub](https://github.com/lightvector/KataGo)
- [KaTrain: AI Analysis/Teaching Tool | GitHub](https://github.com/sanderland/katrain)

### Database
- [The Ultimate Guide to Drizzle ORM + PostgreSQL (2025) | DEV Community](https://dev.to/sameer_saleem/the-ultimate-guide-to-drizzle-orm-postgresql-2025-edition-22b)
- [Drizzle ORM PostgreSQL Best Practices Guide (2025) | GitHub Gist](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [8 Drizzle ORM Patterns for Clean, Fast Migrations | Medium](https://medium.com/@bhagyarana80/8-drizzle-orm-patterns-for-clean-fast-migrations-456c4c35b9d8)
- [Working with Drizzle ORM and PostgreSQL in Next.js | Refine](https://refine.dev/blog/drizzle-react/)
- [Drizzle ORM — PostgreSQL | Official Docs](https://orm.drizzle.team/docs/get-started/postgresql-new)
