# Payment & Authentication System Design — AI Baduk App

**Version**: 1.0
**Date**: 2026-03-10
**Context**: Freemium ($0) → Premium ($9.99/mo) → 도장 Plan ($29.99/mo/seat, Phase 2)
**Stack**: Node.js 22, Next.js 15 (App Router), PostgreSQL 16, Auth.js v5, Stripe, Drizzle ORM, Redis 7.2
**Target**: MAU 8K globally (Korea, Japan, China, Western)
**Builder**: AI Agents (Claude Code)

---

## Table of Contents

1. [Full Authentication Architecture](#1-full-authentication-architecture)
2. [Payment System — Full Specification](#2-payment-system--full-specification)
3. [Feature Gating Architecture](#3-feature-gating-architecture)
4. [B2B 도장 Plan (Phase 2)](#4-b2b-도장-plan-phase-2)
5. [Complete Edge Case Catalog](#5-complete-edge-case-catalog)
6. [Database Schema (Drizzle)](#6-database-schema-drizzle)
7. [API Endpoints](#7-api-endpoints)
8. [Webhook Handlers](#8-webhook-handlers)
9. [Error Scenarios & Handling](#9-error-scenarios--handling)
10. [Testing Strategy](#10-testing-strategy)
11. [Timeline](#11-timeline)

---

## 1. Full Authentication Architecture

### 1.1 Auth.js v5 Provider Configuration

Auth.js v5 (formerly NextAuth.js) serves as the authentication backbone. All 7 providers are configured from Day 1 to avoid migration friction.

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord";
import Kakao from "next-auth/providers/kakao";
import Line from "next-auth/providers/line";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import * as schema from "@/db/schema/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  providers: [
    // --- Email (Magic Link + Password) ---
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        // 1. Validate email + password (bcrypt compare)
        // 2. If user has 2FA enabled, validate TOTP code
        // 3. Return user object or null
      },
    }),

    // --- OAuth Providers ---
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true, // Google verifies emails
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET, // JWT generated from .p8 key
      // Apple requires HTTPS even in dev (use tunneling)
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      authorization: { params: { scope: "identify email guilds" } },
      allowDangerousEmailAccountLinking: true,
    }),
    Kakao({
      clientId: process.env.AUTH_KAKAO_ID,
      clientSecret: process.env.AUTH_KAKAO_SECRET,
    }),
    Line({
      clientId: process.env.AUTH_LINE_ID,
      clientSecret: process.env.AUTH_LINE_SECRET,
      // Must apply for email permission in LINE Developer Console
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.subscriptionTier = user.subscriptionTier;
        token.twoFactorEnabled = user.twoFactorEnabled;
      }
      // Token rotation: refresh subscription status every 5 minutes
      if (trigger === "update" || shouldRefreshToken(token)) {
        const freshUser = await getUserById(token.userId);
        token.subscriptionTier = freshUser.subscriptionTier;
        token.tokenRefreshedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.subscriptionTier = token.subscriptionTier;
      session.user.twoFactorEnabled = token.twoFactorEnabled;
      return session;
    },
    async signIn({ user, account, profile }) {
      // Block sign-in if 2FA is required but not verified
      if (user.twoFactorEnabled && account?.provider === "credentials") {
        // Handled in authorize()
      }
      // Log sign-in event for security audit
      await logAuthEvent("sign_in", user.id, account?.provider);
      return true;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
    newUser: "/auth/onboarding",
  },
});
```

### 1.2 Provider-Specific Setup Requirements

| Provider | Dev Portal | Callback URL | Special Requirements |
|----------|-----------|--------------|---------------------|
| **Email** | SMTP server (Resend/SES) | N/A | Magic link expiry: 10min |
| **Google** | Google Cloud Console | `/api/auth/callback/google` | Consent screen, verified domain |
| **Apple** | Apple Developer ($99/yr) | `/api/auth/callback/apple` | HTTPS required, .p8 key → JWT secret, Service ID ≠ App ID |
| **GitHub** | GitHub Developer Settings | `/api/auth/callback/github` | Simple OAuth app |
| **Discord** | Discord Developer Portal | `/api/auth/callback/discord` | Bot scope optional, `guilds` for community features |
| **Kakao** | Kakao Developers | `/api/auth/callback/kakao` | Web platform activation, Korean TOS |
| **LINE** | LINE Developers Console | `/api/auth/callback/line` | Email permission requires separate application + review |

### 1.3 Account Linking Strategy

**Problem**: A user signs up with Google (john@gmail.com), then tries to sign in with Discord (same email). Without linking, this creates a duplicate account.

**Solution**: Tiered trust model for `allowDangerousEmailAccountLinking`:

```
┌─────────────────────────────────────────────────────────────┐
│                    Account Linking Matrix                     │
├──────────────┬──────────────┬────────────────────────────────┤
│ Provider     │ Email Verified│ Auto-Link Policy               │
├──────────────┼──────────────┼────────────────────────────────┤
│ Google       │ Always       │ allowDangerousEmailAccountLinking: true  │
│ Apple        │ Always       │ allowDangerousEmailAccountLinking: true  │
│ GitHub       │ Usually      │ allowDangerousEmailAccountLinking: true  │
│ Discord      │ Usually      │ allowDangerousEmailAccountLinking: true  │
│ Kakao        │ Sometimes    │ false — manual link via settings│
│ LINE         │ Requires app │ false — manual link via settings│
│ Email/Pass   │ Via magic link│ N/A (primary identity)        │
└──────────────┴──────────────┴────────────────────────────────┘
```

**Manual linking flow** (for Kakao/LINE or user-initiated):
1. User logs in with primary provider
2. Goes to Settings → Linked Accounts
3. Clicks "Link Kakao" → OAuth flow → callback verifies ownership
4. `accounts` table gets a new row with same `userId`
5. User can now sign in with either provider

```typescript
// src/app/api/auth/link/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, providerAccountId, accessToken } = await req.json();

  // Verify the OAuth token is valid for this provider
  const profile = await verifyOAuthToken(provider, accessToken);
  if (!profile) return Response.json({ error: "Invalid token" }, { status: 400 });

  // Check if this provider account is already linked to another user
  const existing = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.provider, provider),
      eq(accounts.providerAccountId, providerAccountId)
    ),
  });

  if (existing && existing.userId !== session.user.id) {
    return Response.json({
      error: "This account is already linked to another user"
    }, { status: 409 });
  }

  // Link the account
  await db.insert(accounts).values({
    userId: session.user.id,
    type: "oauth",
    provider,
    providerAccountId,
    access_token: accessToken,
    // ... other OAuth fields
  });

  return Response.json({ success: true });
}
```

### 1.4 Two-Factor Authentication (2FA/MFA)

Auth.js does not include built-in 2FA. We implement TOTP-based 2FA using the `otpauth` library.

**Setup flow**:
```
User → Settings → Enable 2FA
  → Server generates TOTP secret (otpauth library)
  → Server encrypts secret with AES-256-GCM, stores in users table
  → Server returns QR code URI (otpauth://totp/Baduk:user@email?secret=...&issuer=Baduk)
  → User scans QR with Google Authenticator / Authy
  → User enters 6-digit code to verify
  → Server validates code, sets twoFactorEnabled = true
  → Server generates 8 backup codes (bcrypt-hashed, stored in backup_codes table)
```

**Login flow with 2FA**:
```
User → Sign In (email + password)
  → Credentials provider authorize() validates password
  → If twoFactorEnabled = true:
    → Return partial session (twoFactorPending = true)
    → Client redirects to /auth/2fa
    → User enters TOTP code
    → POST /api/auth/2fa/verify
    → Server decrypts TOTP secret, validates code (30-second window, ±1 drift)
    → If valid: upgrade session to full access
    → If invalid: increment failedAttempts, lock after 5 failures (15-min cooldown)
```

```typescript
// src/lib/totp.ts
import { TOTP } from "otpauth";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = Buffer.from(process.env.TOTP_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function generateTOTPSecret(email: string): {
  secret: string;
  encryptedSecret: string;
  uri: string;
} {
  const totp = new TOTP({
    issuer: "AI Baduk",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  const secret = totp.secret.base32;
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(secret, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    secret,
    encryptedSecret: `${iv.toString("hex")}:${authTag}:${encrypted}`,
    uri: totp.toString(),
  };
}

export function verifyTOTPCode(encryptedSecret: string, code: string): boolean {
  const [ivHex, authTagHex, encrypted] = encryptedSecret.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    ENCRYPTION_KEY,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let secret = decipher.update(encrypted, "hex", "utf8");
  secret += decipher.final("utf8");

  const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
  const delta = totp.validate({ token: code, window: 1 }); // ±1 period drift
  return delta !== null;
}
```

### 1.5 Session Security

| Mechanism | Implementation | Details |
|-----------|---------------|---------|
| **CSRF Protection** | Auth.js built-in | Signed CSRF tokens on every sign-in request. Server Actions compare Origin vs Host headers. |
| **Token Rotation** | JWT with embedded `iat` + custom refresh | JWT `maxAge: 30d`. Subscription status refreshed every 5 minutes via `jwt` callback. Refresh tokens for OAuth providers rotated on each use. |
| **HttpOnly Cookies** | Auth.js default | `__Secure-authjs.session-token` cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. |
| **Device Management** | Custom `user_sessions` table | Track active sessions with device fingerprint (UA + IP hash). User can view and revoke sessions from Settings. |
| **Rate Limiting** | Middleware + Redis | 5 failed login attempts → 15-min lockout. 20 requests/min per IP on auth endpoints. |
| **Brute Force** | Progressive delay | 1s → 2s → 4s → 8s → 16s delay between failed attempts. After 10 failures: CAPTCHA required. |

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  analytics: true,
});

export default auth(async (req) => {
  // Rate limit auth endpoints
  if (req.nextUrl.pathname.startsWith("/api/auth")) {
    const ip = req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown";
    const { success, limit, remaining } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(remaining) } }
      );
    }
  }

  // Protected routes check
  if (req.nextUrl.pathname.startsWith("/app")) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }
    // 2FA pending check
    if (req.auth.user.twoFactorPending) {
      return NextResponse.redirect(new URL("/auth/2fa", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/api/auth/:path*", "/api/v1/:path*"],
};
```

### 1.6 Profile Management

```typescript
// Profile data model (extends Auth.js user)
interface UserProfile {
  // Auth.js base
  id: string;
  email: string;
  name: string | null;
  image: string | null; // Avatar URL

  // Baduk-specific
  displayName: string; // In-game name
  badukRank: string | null; // e.g., "5d", "3k", "15k"
  rankSystem: "kyu-dan" | "elo" | "glicko2";
  eloRating: number; // Internal Glicko-2 rating
  country: string | null; // ISO 3166-1 alpha-2
  language: "en" | "ko" | "ja" | "zh";
  timezone: string; // IANA timezone

  // Subscription
  subscriptionTier: "free" | "premium" | "dojang";
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "unpaid";

  // Security
  twoFactorEnabled: boolean;
  linkedProviders: string[]; // ["google", "kakao", ...]

  // Stats
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  joinedAt: Date;
  lastActiveAt: Date;
}
```

---

## 2. Payment System — Full Specification

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client (Next.js)                            │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Pricing Page │   │ Billing Page │   │ Stripe Billing Portal│ │
│  │ (Server Comp)│   │ (Server Comp)│   │ (Stripe-hosted)      │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                  │                       │             │
│  ┌──────┴──────────────────┴───────────────────────┴──────────┐ │
│  │              Server Actions (src/app/actions/)              │ │
│  │  createCheckoutSession()  createPortalSession()            │ │
│  │  cancelSubscription()     reactivateSubscription()         │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │   Stripe API        │
                    │ ┌────────────────┐  │
                    │ │ Checkout       │  │
                    │ │ Subscriptions  │  │
                    │ │ Customer Portal│  │
                    │ │ Invoices       │  │
                    │ │ Tax            │  │
                    │ │ Webhooks       │  │
                    │ └────────────────┘  │
                    └─────────┬──────────┘
                              │ webhooks
                    ┌─────────┴──────────┐
                    │  Webhook Handler    │
                    │ /api/webhooks/stripe│
                    └─────────┬──────────┘
                              │
                    ┌─────────┴──────────┐
                    │   PostgreSQL 16     │
                    │ + Redis 7.2 cache   │
                    └────────────────────┘
```

### 2.2 Stripe Product & Price Configuration

```typescript
// Stripe Dashboard / API product setup
const PRODUCTS = {
  premium: {
    name: "AI Baduk Premium",
    description: "Unlimited AI analysis, advanced features",
    prices: {
      monthly: {
        usd: { amount: 999, currency: "usd", interval: "month" },
        krw: { amount: 12900, currency: "krw", interval: "month" },
        jpy: { amount: 1480, currency: "jpy", interval: "month" },
        // Stripe Adaptive Pricing handles 135+ other currencies automatically
      },
      yearly: {
        usd: { amount: 7990, currency: "usd", interval: "year" }, // ~$6.66/mo (33% off)
        krw: { amount: 99000, currency: "krw", interval: "year" },
        jpy: { amount: 11800, currency: "jpy", interval: "year" },
      },
    },
    trialDays: 7,
    features: [
      "Unlimited KataGo analysis",
      "AI game commentary",
      "Advanced problem sets",
      "Game review with natural language explanations",
      "Priority matchmaking",
    ],
  },
  dojang: {
    name: "도장 Plan (Phase 2)",
    description: "Multi-seat license for Go schools",
    prices: {
      perSeat: {
        usd: { amount: 2999, currency: "usd", interval: "month" },
        krw: { amount: 39000, currency: "krw", interval: "month" },
      },
    },
    minSeats: 3,
    maxSeats: 100,
  },
};
```

### 2.3 Complete Subscription Lifecycle

```
┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│          │    │           │    │          │    │          │
│  Free    ├───►│  Trial    ├───►│  Active  ├───►│ Canceled │
│  Tier    │    │  (7 days) │    │(Premium) │    │ (at EOB) │
│          │    │           │    │          │    │          │
└──────────┘    └─────┬─────┘    └────┬─────┘    └────┬─────┘
                      │               │               │
                      │ no payment    │ payment       │ resubscribe
                      │ method        │ fails         │
                      ▼               ▼               ▼
                ┌──────────┐    ┌──────────┐    ┌──────────┐
                │  Expired │    │ Past Due │    │  Active  │
                │  → Free  │    │ (Grace)  │    │ (new sub)│
                └──────────┘    └────┬─────┘    └──────────┘
                                     │
                                     │ 14 days,
                                     │ all retries fail
                                     ▼
                                ┌──────────┐
                                │  Unpaid  │
                                │  → Free  │
                                └──────────┘
```

**Lifecycle events and handlers**:

| Lifecycle Stage | Trigger | Stripe Event | Our Action |
|----------------|---------|--------------|------------|
| **Trial Start** | User clicks "Start Free Trial" | `customer.subscription.created` | Create subscription record, set `status=trialing`, schedule trial-end reminder email (Day 5) |
| **Trial → Active** | Trial ends, card charged | `customer.subscription.updated` + `invoice.paid` | Update `status=active`, send welcome-to-premium email |
| **Trial → Expired** | No payment method at trial end | `customer.subscription.deleted` | Set `status=expired`, revert to Free tier, send "add payment method" email |
| **Renewal** | Monthly/yearly billing | `invoice.paid` | Update `currentPeriodEnd`, log payment in `payment_history` |
| **Payment Failure** | Card declined | `invoice.payment_failed` | Set `status=past_due`, notify user, Stripe Smart Retries begin |
| **Grace Period** | Payment failed, retrying | (internal) | 7-day grace: full premium access. Day 8-14: limited access (read-only analysis). Day 15+: revert to Free. |
| **Upgrade** (monthly→yearly) | User selects yearly plan | `customer.subscription.updated` | Prorate: credit remaining monthly, charge yearly minus credit |
| **Downgrade** (yearly→monthly) | User selects monthly plan | `customer.subscription.updated` | Apply at end of current billing period (no immediate change) |
| **Cancellation** | User cancels | `customer.subscription.updated` | Set `cancelAtPeriodEnd=true`, retain access until `currentPeriodEnd` |
| **Reactivation** | User resubscribes after cancel | `customer.subscription.updated` | Clear `cancelAtPeriodEnd`, set `status=active` |
| **Chargeback** | User disputes charge | `charge.dispute.created` | Immediately revoke premium (fraud prevention), log dispute, submit evidence via API |

### 2.4 Server Actions for Payment

```typescript
// src/app/actions/billing.ts
"use server";

import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { users, subscriptions } from "@/db/schema";

export async function createCheckoutSession(priceId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Get or create Stripe customer
  let stripeCustomerId = await getStripeCustomerId(session.user.id);
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      metadata: { userId: session.user.id },
    });
    stripeCustomerId = customer.id;
    await db
      .update(users)
      .set({ stripeCustomerId: customer.id })
      .where(eq(users.id, session.user.id));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId: session.user.id },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?canceled=true`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_update: { address: "auto" },
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: true }, // Stripe Tax for VAT/GST
  });

  redirect(checkoutSession.url!);
}

export async function createPortalSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const stripeCustomerId = await getStripeCustomerId(session.user.id);
  if (!stripeCustomerId) throw new Error("No billing account");

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
  });

  redirect(portalSession.url);
}

export async function cancelSubscription() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
  });
  if (!sub?.stripeSubscriptionId) throw new Error("No active subscription");

  // Cancel at period end (user keeps access until currentPeriodEnd)
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  return { success: true, accessUntil: sub.currentPeriodEnd };
}

export async function reactivateSubscription() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session.user.id),
  });
  if (!sub?.stripeSubscriptionId) throw new Error("No subscription to reactivate");

  // Only reactivate if within current period
  if (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: false, status: "active", updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
  } else {
    // Period expired — create new checkout session
    throw new Error("Subscription expired. Please resubscribe.");
  }

  return { success: true };
}
```

### 2.5 Stripe Billing Portal Configuration

The Stripe-hosted Billing Portal handles self-service for:
- Update payment method
- View invoice history & download invoices
- Cancel subscription
- Upgrade/downgrade plan
- Update billing address
- Manage tax IDs

```typescript
// src/lib/stripe-portal-config.ts
// Configure via Stripe Dashboard → Settings → Billing → Customer Portal

const portalConfig = {
  business_profile: {
    headline: "AI Baduk — Manage your subscription",
    privacy_policy_url: `${process.env.NEXT_PUBLIC_APP_URL}/privacy`,
    terms_of_service_url: `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
  },
  features: {
    customer_update: {
      enabled: true,
      allowed_updates: ["email", "address", "tax_id"],
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: [
          "too_expensive",
          "missing_features",
          "switched_service",
          "unused",
          "other",
        ],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price", "quantity"],
      proration_behavior: "create_prorations",
      products: [
        {
          product: "prod_premium",
          prices: ["price_monthly_usd", "price_yearly_usd"],
        },
      ],
    },
  },
};
```

### 2.6 Invoice Generation & Tax Compliance

**Stripe Tax** handles automatic tax calculation across jurisdictions:

| Region | Tax Type | Rate | Stripe Tax Handling |
|--------|----------|------|-------------------|
| **Korea** | 부가세 (VAT) | 10% | Auto-calculated. Foreign digital service providers must register with NTS. As of July 2025, intermediary platforms must report quarterly. |
| **Japan** | 消費税 (Consumption Tax) | 10% | Auto-calculated. Qualified Invoice System (QIS) compliance. |
| **EU** | VAT | 17-27% | Auto-calculated per member state. MOSS/OSS registration for <€10K threshold. |
| **USA** | Sales Tax | 0-10.25% | State-by-state. SaaS taxable in ~25 states. Stripe Tax handles nexus detection. |
| **China** | VAT | 6% (digital) | Complex — may need local payment provider (see §2.7). |

```typescript
// Enable Stripe Tax in checkout
const session = await stripe.checkout.sessions.create({
  // ...
  automatic_tax: { enabled: true },
  tax_id_collection: { enabled: true },
  customer_update: { address: "auto" }, // Needed for tax calculation
});
```

**Invoice access**:
```typescript
// src/app/actions/invoices.ts
"use server";

export async function getInvoices() {
  const session = await auth();
  const stripeCustomerId = await getStripeCustomerId(session!.user.id);

  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId!,
    limit: 24, // 2 years of monthly invoices
  });

  return invoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    date: new Date(inv.created * 1000),
    amount: inv.amount_paid,
    currency: inv.currency,
    status: inv.status,
    pdfUrl: inv.invoice_pdf,
    hostedUrl: inv.hosted_invoice_url,
    tax: inv.tax,
  }));
}
```

### 2.7 Regional Payment Fallbacks

Stripe is the primary processor, but regional coverage requires fallbacks:

| Region | Primary | Fallback | Reason |
|--------|---------|----------|--------|
| **Global** | Stripe | — | 135+ currencies, 46 countries |
| **Korea** | Stripe | Toss Payments (토스페이먼츠) | Korean credit cards work on Stripe, but 토스/카카오페이 QR payments need local gateway. Phase 2. |
| **China** | Stripe (WeChat Pay, Alipay) | — | Stripe supports Alipay and WeChat Pay as payment methods. Configure via `payment_method_types`. |
| **Japan** | Stripe | — | Stripe Japan supports konbini (convenience store) payments and JCB cards natively. |

```typescript
// Enable regional payment methods
const session = await stripe.checkout.sessions.create({
  payment_method_types: [
    "card",        // Global
    "alipay",      // China
    "wechat_pay",  // China
    "konbini",     // Japan (convenience store)
  ],
  payment_method_options: {
    wechat_pay: { client: "web" },
    konbini: { expires_after_days: 3 },
  },
  // ...
});
```

### 2.8 Refund Policy & Implementation

**Policy**:
- 7-day trial: free cancellation, no charge
- Within 48 hours of first charge: full refund
- After 48 hours: prorated refund for unused days
- Annual plans: prorated refund within first 30 days; after 30 days, no refund (can cancel for remainder of period)
- Chargebacks: see §5.4

```typescript
// src/app/actions/refunds.ts
"use server";

export async function requestRefund(reason: string) {
  const session = await auth();
  const sub = await getActiveSubscription(session!.user.id);

  // Determine refund eligibility
  const firstChargeDate = sub.firstChargeDate;
  const hoursSinceCharge = (Date.now() - firstChargeDate.getTime()) / (1000 * 60 * 60);

  let refundAmount: number;
  let refundType: "full" | "prorated" | "none";

  if (hoursSinceCharge <= 48) {
    refundType = "full";
    refundAmount = sub.lastPaymentAmount;
  } else if (sub.interval === "year" && hoursSinceCharge <= 30 * 24) {
    refundType = "prorated";
    const daysUsed = Math.ceil(hoursSinceCharge / 24);
    const dailyRate = sub.lastPaymentAmount / 365;
    refundAmount = Math.round(sub.lastPaymentAmount - daysUsed * dailyRate);
  } else if (sub.interval === "month") {
    refundType = "prorated";
    const daysUsed = Math.ceil(hoursSinceCharge / 24);
    const daysInPeriod = 30;
    refundAmount = Math.round(
      sub.lastPaymentAmount * ((daysInPeriod - daysUsed) / daysInPeriod)
    );
  } else {
    refundType = "none";
    refundAmount = 0;
  }

  if (refundAmount > 0) {
    const refund = await stripe.refunds.create({
      payment_intent: sub.lastPaymentIntentId,
      amount: refundAmount,
      reason: "requested_by_customer",
      metadata: { userId: session!.user.id, reason },
    });

    await logRefund(session!.user.id, refund.id, refundAmount, reason);

    // Cancel subscription
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
  }

  return { refundType, refundAmount, currency: sub.currency };
}
```

### 2.9 Revenue Recognition (ASC 606 / IFRS 15)

For SaaS subscription revenue:

**Principle**: Revenue is recognized **as the service is delivered**, not when payment is received.

| Event | Accounting Treatment |
|-------|---------------------|
| Monthly subscription payment ($9.99) | Recognize $0.33/day over 30 days |
| Annual subscription payment ($79.90) | Recognize $6.66/month over 12 months |
| Trial period | No revenue ($0 until trial converts) |
| Prorated upgrade | Credit for old plan + charge for new plan, recognized over remaining period |
| Refund | Reduce recognized revenue for current period |

**Implementation**: Use **Stripe Revenue Recognition** for automated ASC 606 compliance. For our scale (MAU 8K, MRR ~$5K), Stripe's built-in reporting is sufficient. If complexity grows (도장 Plan, enterprise contracts), migrate to a dedicated solution like HubiFi or Recognized.

```typescript
// Revenue tracking in our DB (for internal dashboards)
// Stripe handles the official accounting books
const revenueEntry = {
  subscriptionId: sub.id,
  period: { start: sub.currentPeriodStart, end: sub.currentPeriodEnd },
  totalAmount: sub.amount,
  dailyRecognition: sub.amount / daysInPeriod,
  recognizedToDate: dailyRate * daysSincePeriodStart,
  deferredRevenue: dailyRate * daysRemaining,
};
```

---

## 3. Feature Gating Architecture

### 3.1 Feature Tier Matrix

| Feature | Free | Premium ($9.99/mo) | 도장 ($29.99/seat/mo) |
|---------|------|--------------------|-----------------------|
| Play vs AI (basic) | 3 games/day | Unlimited | Unlimited |
| KataGo analysis | 5 moves/day | Unlimited | Unlimited |
| AI commentary | — | Full game | Full game + student mode |
| Problem sets | 10/day | Unlimited | Unlimited + custom |
| Game review | Last 5 games | Full history | Full history + class review |
| LLM explanations | Basic (1 per game) | Detailed (unlimited) | Detailed + teaching mode |
| Rank tracking | Basic stats | Advanced analytics | Team analytics dashboard |
| Online play | ✓ | ✓ (priority matchmaking) | ✓ (private 도장 rooms) |
| SGF export | ✓ | ✓ | ✓ (batch export) |
| Custom board themes | 1 theme | All themes | All themes + 도장 branding |

### 3.2 Server-Side Middleware (Subscription Check)

Every API call that touches a gated feature passes through subscription verification:

```typescript
// src/lib/feature-gate.ts
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { subscriptions } from "@/db/schema";

export type Feature =
  | "ai_analysis"
  | "ai_commentary"
  | "problem_sets"
  | "game_review"
  | "llm_explanations"
  | "priority_matchmaking"
  | "advanced_analytics"
  | "custom_themes"
  | "batch_export"
  | "dojang_rooms"
  | "student_management";

export type Tier = "free" | "premium" | "dojang";

const FEATURE_ACCESS: Record<Feature, Tier[]> = {
  ai_analysis: ["free", "premium", "dojang"], // rate-limited for free
  ai_commentary: ["premium", "dojang"],
  problem_sets: ["free", "premium", "dojang"], // rate-limited for free
  game_review: ["free", "premium", "dojang"], // limited for free
  llm_explanations: ["premium", "dojang"],
  priority_matchmaking: ["premium", "dojang"],
  advanced_analytics: ["premium", "dojang"],
  custom_themes: ["premium", "dojang"],
  batch_export: ["dojang"],
  dojang_rooms: ["dojang"],
  student_management: ["dojang"],
};

const RATE_LIMITS: Partial<Record<Feature, Record<Tier, number>>> = {
  ai_analysis: { free: 5 },       // 5 per day
  problem_sets: { free: 10 },     // 10 per day
  game_review: { free: 5 },       // last 5 games
};

export async function checkFeatureAccess(
  userId: string,
  feature: Feature
): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
  // 1. Get subscription tier (Redis cache first, DB fallback)
  const tier = await getSubscriptionTier(userId);

  // 2. Check feature access
  const allowedTiers = FEATURE_ACCESS[feature];
  if (!allowedTiers.includes(tier)) {
    return { allowed: false, reason: `Upgrade to ${allowedTiers[0]} to access this feature` };
  }

  // 3. Check rate limits for free tier
  const limit = RATE_LIMITS[feature]?.[tier];
  if (limit !== undefined) {
    const key = `ratelimit:${feature}:${userId}:${todayKey()}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, 86400); // 24h TTL

    if (current > limit) {
      return {
        allowed: false,
        reason: `Daily limit reached (${limit}/${limit}). Upgrade for unlimited access.`,
        remaining: 0,
      };
    }
    return { allowed: true, remaining: limit - current };
  }

  return { allowed: true };
}

// --- Subscription Tier Resolution with Redis Cache ---

const CACHE_TTL = 300; // 5 minutes

async function getSubscriptionTier(userId: string): Promise<Tier> {
  // 1. Check Redis cache
  const cached = await redis.get(`sub:tier:${userId}`);
  if (cached) return cached as Tier;

  // 2. Query database
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    columns: { tier: true, status: true, currentPeriodEnd: true },
  });

  let tier: Tier = "free";

  if (sub) {
    const isActive = ["active", "trialing"].includes(sub.status);
    const notExpired = sub.currentPeriodEnd && sub.currentPeriodEnd > new Date();

    // Grace period: past_due users keep access for 7 days
    const isGracePeriod =
      sub.status === "past_due" &&
      sub.currentPeriodEnd &&
      daysSince(sub.currentPeriodEnd) <= 7;

    if ((isActive && notExpired) || isGracePeriod) {
      tier = sub.tier;
    }
  }

  // 3. Cache result
  await redis.set(`sub:tier:${userId}`, tier, { ex: CACHE_TTL });

  return tier;
}

// --- Cache Invalidation ---

export async function invalidateSubscriptionCache(userId: string) {
  await redis.del(`sub:tier:${userId}`);
}
```

### 3.3 Client-Side Feature Flag Context

```typescript
// src/providers/subscription-provider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface SubscriptionContextType {
  tier: "free" | "premium" | "dojang";
  status: string;
  isLoading: boolean;
  canAccess: (feature: string) => boolean;
  remainingQuota: (feature: string) => number | null;
  showUpgradePrompt: (feature: string) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [featureQuotas, setFeatureQuotas] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const tier = session?.user?.subscriptionTier ?? "free";
  const status = session?.user?.subscriptionStatus ?? "none";

  useEffect(() => {
    if (session?.user) {
      // Fetch remaining quotas for rate-limited features
      fetch("/api/v1/subscription/quotas")
        .then((r) => r.json())
        .then((data) => {
          setFeatureQuotas(data.quotas);
          setIsLoading(false);
        });
    }
  }, [session]);

  const canAccess = (feature: string): boolean => {
    const FEATURE_TIERS: Record<string, string[]> = {
      ai_commentary: ["premium", "dojang"],
      llm_explanations: ["premium", "dojang"],
      advanced_analytics: ["premium", "dojang"],
      dojang_rooms: ["dojang"],
      student_management: ["dojang"],
    };
    const requiredTiers = FEATURE_TIERS[feature];
    if (!requiredTiers) return true; // No restriction
    return requiredTiers.includes(tier);
  };

  const remainingQuota = (feature: string): number | null => {
    return featureQuotas[feature] ?? null;
  };

  const showUpgradePrompt = (feature: string) => {
    // Trigger upgrade modal with feature-specific messaging
    window.dispatchEvent(
      new CustomEvent("show-upgrade", { detail: { feature } })
    );
  };

  return (
    <SubscriptionContext.Provider
      value={{ tier, status, isLoading, canAccess, remainingQuota, showUpgradePrompt }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
};
```

**Usage in components**:

```tsx
// src/components/analysis-button.tsx
"use client";

import { useSubscription } from "@/providers/subscription-provider";

export function AnalysisButton({ gameId }: { gameId: string }) {
  const { canAccess, remainingQuota, showUpgradePrompt } = useSubscription();

  const remaining = remainingQuota("ai_analysis");
  const hasAccess = canAccess("ai_analysis");

  if (!hasAccess || (remaining !== null && remaining <= 0)) {
    return (
      <button
        onClick={() => showUpgradePrompt("ai_analysis")}
        className="btn-upgrade"
      >
        🔒 Upgrade for AI Analysis
        {remaining === 0 && " (Daily limit reached)"}
      </button>
    );
  }

  return (
    <button onClick={() => requestAnalysis(gameId)} className="btn-primary">
      Analyze with AI
      {remaining !== null && ` (${remaining} remaining today)`}
    </button>
  );
}
```

### 3.4 Graceful Degradation — Payment Service Down

**Scenario**: Stripe is unreachable, Redis is down, or database is unavailable.

**Strategy**: Fail-open for existing users, fail-closed for new purchases.

```typescript
// src/lib/feature-gate.ts — degradation logic

async function getSubscriptionTierWithFallback(userId: string): Promise<Tier> {
  try {
    // Primary path: Redis → DB
    return await getSubscriptionTier(userId);
  } catch (redisError) {
    console.error("Redis unavailable, falling back to DB", redisError);
    try {
      // Fallback 1: Direct DB query
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });
      return sub?.tier ?? "free";
    } catch (dbError) {
      console.error("DB unavailable, falling back to JWT", dbError);
      // Fallback 2: Trust JWT session (may be up to 5 min stale)
      const session = await auth();
      return session?.user?.subscriptionTier ?? "free";
    }
  }
}

// Degradation matrix:
// ┌─────────┬───────┬────────┬────────────────────────────────────────┐
// │ Redis   │ DB    │ JWT    │ Behavior                               │
// ├─────────┼───────┼────────┼────────────────────────────────────────┤
// │ ✓       │ ✓     │ ✓      │ Normal operation (Redis → DB → JWT)    │
// │ ✗       │ ✓     │ ✓      │ Slightly slower, DB direct query       │
// │ ✗       │ ✗     │ ✓      │ Trust JWT, may be 5min stale           │
// │ ✗       │ ✗     │ ✗      │ Service unavailable (500 error)        │
// │ ✓       │ ✗     │ ✓      │ Cached data, no writes (read-only)     │
// └─────────┴───────┴────────┴────────────────────────────────────────┘
//
// New purchases: Always fail-closed (require Stripe + DB)
// Existing access: Fail-open (last known tier from cache/JWT)
```

---

## 4. B2B 도장 Plan (Phase 2)

### 4.1 Multi-Seat Licensing Model

**Pricing**: $29.99/seat/month (per-seat model via Stripe `quantity` parameter)

```
┌──────────────────────────────────────────────────────────┐
│                    도장 Organization                      │
│                                                          │
│  ┌──────────────┐         ┌────────────────────────────┐ │
│  │  Owner/Admin │         │  Subscription              │ │
│  │  (도장 선생님) │         │  - 10 seats × $29.99      │ │
│  │              │         │  - $299.90/mo              │ │
│  └──────┬───────┘         │  - Stripe quantity=10      │ │
│         │                  └────────────────────────────┘ │
│         │ manages                                         │
│  ┌──────┴───────────────────────────────────────────────┐ │
│  │                  Members                              │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐     ┌────────┐   │ │
│  │  │Student1│ │Student2│ │Student3│ ... │Student10│   │ │
│  │  │ 15k    │ │ 10k    │ │ 5d     │     │ 1k     │   │ │
│  │  └────────┘ └────────┘ └────────┘     └────────┘   │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Stripe per-seat configuration**:

```typescript
// Create subscription with per-seat pricing
const subscription = await stripe.subscriptions.create({
  customer: orgStripeCustomerId,
  items: [
    {
      price: "price_dojang_seat_monthly",
      quantity: seatCount, // e.g., 10
    },
  ],
  metadata: {
    organizationId: org.id,
    planType: "dojang",
  },
});

// Add/remove seats (proration handled automatically)
await stripe.subscriptions.update(subscriptionId, {
  items: [
    {
      id: subscriptionItemId,
      quantity: newSeatCount, // e.g., 12 (added 2)
    },
  ],
  proration_behavior: "create_prorations", // Charge for added seats immediately
});
```

### 4.2 Admin Dashboard Features

| Feature | Description |
|---------|-------------|
| **Seat Management** | Add/remove students, invite via email/link, bulk import CSV |
| **Progress Dashboard** | Per-student rank progression, games played, problems solved, time spent |
| **Class Management** | Create classes/groups, assign problems, schedule review sessions |
| **Game Review Queue** | Review student games with AI commentary, add teacher annotations |
| **Billing Management** | View invoices, adjust seat count, manage payment method |
| **Analytics** | Class-wide statistics, improvement trends, engagement metrics |
| **Custom Problems** | Create/import custom tsumego sets for the 도장 |
| **Private Rooms** | 도장-only playing rooms for internal matches and tournaments |

### 4.3 Organization Permissions Model

```typescript
enum OrgRole {
  OWNER = "owner",       // Full control, billing, can delete org
  ADMIN = "admin",       // Manage members, view all data, no billing
  INSTRUCTOR = "instructor", // View assigned students, create content
  STUDENT = "student",   // Access 도장 features, personal dashboard
}

// Permission matrix
const PERMISSIONS: Record<OrgRole, string[]> = {
  owner: ["*"], // All permissions
  admin: [
    "members:read", "members:write", "members:invite", "members:remove",
    "analytics:read", "games:review", "problems:create",
    "rooms:manage", "classes:manage",
  ],
  instructor: [
    "members:read", "analytics:read:assigned",
    "games:review:assigned", "problems:create",
    "rooms:manage", "classes:manage:assigned",
  ],
  student: [
    "games:play", "problems:solve", "analytics:read:self",
    "rooms:join",
  ],
};
```

### 4.4 Student Progress Tracking

```typescript
interface StudentProgress {
  userId: string;
  organizationId: string;

  // Rank progression
  rankHistory: Array<{
    date: Date;
    rank: string;       // "15k" → "14k" → ...
    eloRating: number;
    gamesAtRank: number;
  }>;

  // Activity metrics
  totalGamesPlayed: number;
  gamesThisWeek: number;
  totalProblemsAttempted: number;
  problemAccuracy: number; // 0-100
  totalStudyTimeMinutes: number;
  studyTimeThisWeek: number;

  // AI analysis usage
  analysesRequested: number;
  commonMistakePatterns: string[]; // AI-detected patterns

  // Engagement
  currentStreak: number;
  longestStreak: number;
  lastActiveAt: Date;
  weeklyGoalProgress: number; // 0-100
}
```

---

## 5. Complete Edge Case Catalog

### 5.1 Subscription State Transitions

```
Edge Case: Free → Premium → Cancel → Resubscribe
─────────────────────────────────────────────────
Day 1:   User signs up (Free tier)
Day 5:   User starts Premium trial
Day 12:  Trial ends, card charged $9.99 (status=active)
Day 45:  User cancels (cancelAtPeriodEnd=true, access until Day 42)
Day 42:  Billing period ends (status=canceled, tier=free)
Day 60:  User clicks "Resubscribe"
         → New checkout session, new subscription
         → New 7-day trial? NO — trial already used
         → Immediate charge, status=active
```

### 5.2 Payment Failure → Retry → Grace → Downgrade

```
Edge Case: Payment Fails → Smart Retries → Grace Period → Downgrade
────────────────────────────────────────────────────────────────────
Day 0:   invoice.payment_failed (card declined)
         → Status: past_due
         → Email: "Payment failed — update your payment method"
         → Stripe Smart Retries: 8 attempts over 14 days

Day 1:   Retry #1 fails
Day 3:   Retry #2 fails
         → Email: "Second attempt failed — action needed"
Day 7:   Retry #3 fails
         → Grace period day 7: LIMITED access
         → Disable: AI commentary, advanced analytics
         → Keep: basic play, existing game history
Day 10:  Retry #4 fails
         → Email: "Final warning — your Premium access ends in 4 days"
Day 14:  All retries exhausted
         → customer.subscription.deleted event
         → Status: unpaid → tier: free
         → Email: "Your Premium subscription has ended"
         → All premium features disabled
         → Game history preserved (read-only)
```

### 5.3 Currency & International Pricing

```
Edge Case: Currency Conversion and Localized Pricing
─────────────────────────────────────────────────────
Strategy: Fixed prices for KRW/JPY, Stripe Adaptive Pricing for others

Manual pricing (to avoid FX fluctuation):
  USD: $9.99/mo    | $79.90/yr
  KRW: ₩12,900/mo  | ₩99,000/yr   (psychologically < ₩13,000)
  JPY: ¥1,480/mo   | ¥11,800/yr   (psychologically < ¥1,500)

Stripe Adaptive Pricing (automatic for 135+ currencies):
  EUR: ~€9.49/mo   (calculated by Stripe ML)
  GBP: ~£8.49/mo   (calculated by Stripe ML)
  CNY: ~¥68/mo      (calculated by Stripe ML)

FX Risk: Stripe Adaptive Pricing absorbs FX risk with 2-4% fee.
         For KRW/JPY with manual prices, we accept FX margin as cost of
         psychological pricing (round numbers convert better).
```

### 5.4 Chargeback/Dispute Handling

```
Edge Case: User Disputes Charge → Chargeback
─────────────────────────────────────────────
Trigger: charge.dispute.created webhook

Immediate actions:
  1. Record dispute in payment_history (type="dispute")
  2. Revoke premium access immediately (fraud prevention)
  3. Send internal alert (Slack/email to ops)
  4. DO NOT contact user about the dispute (card network rules)

Evidence submission (within 7-21 days):
  1. Collect evidence automatically:
     - User's signup IP, device fingerprint, email verification
     - Usage logs (games played, analyses run) proving service delivered
     - Cancellation policy (link to Terms of Service)
     - Previous successful charges
  2. Submit via Stripe Dispute API or let Stripe Smart Disputes handle

Outcomes:
  charge.dispute.closed (won):
    → Restore premium access
    → Flag user for monitoring (repeat disputers get banned)
  charge.dispute.closed (lost):
    → $15 dispute fee absorbed
    → User remains on free tier
    → If 2+ disputes: ban user, add to blocklist
```

### 5.5 Tax Compliance

| Jurisdiction | Requirements | Implementation |
|-------------|-------------|----------------|
| **Korea (부가세)** | 10% VAT on digital services. Foreign providers must register with NTS. July 2025: quarterly reporting for intermediary platforms. | Stripe Tax auto-calculates. Register for simplified VAT with Korean NTS. Appoint domestic representative by Oct 2025 (PIPA requirement). |
| **Japan (消費税)** | 10% consumption tax. Qualified Invoice System (QIS). | Stripe Tax handles. Register for JCT if revenue exceeds ¥10M threshold. |
| **EU (VAT)** | 17-27% per state. OSS threshold €10K for micro-businesses. | Stripe Tax auto-calculates per member state. Register for OSS (One-Stop-Shop) when EU revenue exceeds €10K. |
| **USA (Sales Tax)** | State-by-state. SaaS taxable in ~25 states. | Stripe Tax handles nexus detection and rate calculation. Economic nexus thresholds vary ($100K or 200 transactions). |

### 5.6 GDPR / 개인정보보호법 Compliance

| Requirement | GDPR | 한국 PIPA | Implementation |
|------------|------|-----------|----------------|
| **Right to Access** | Art. 15 | Art. 35 | `GET /api/v1/privacy/export` — generates JSON of all user data within 30 days |
| **Right to Erasure** | Art. 17 | Art. 36 | `POST /api/v1/privacy/delete` — anonymize user, delete PII, retain anonymized game records for ranking integrity |
| **Data Portability** | Art. 20 | Mar 2025 amendment | Export user data in machine-readable format (JSON/CSV). Game data as SGF files. |
| **Consent** | Explicit opt-in | Explicit consent required | Granular consent checkboxes at signup. Separate consent for marketing, analytics, third-party sharing. |
| **Data Retention** | Only as long as necessary | Defined retention periods | User data: active account + 30 days after deletion request. Payment data: 7 years (tax/legal). Game records: anonymized, kept indefinitely. |
| **Breach Notification** | 72 hours | 72 hours | Automated detection → alert ops → notify authorities → notify users |
| **Cross-Border Transfer** | Adequacy decision or SCCs | Consent or adequate protection | Stripe (US) — covered by SCCs. User data stored in region closest to user (if multi-region). |
| **Domestic Representative** | Art. 27 (for non-EU controllers) | Oct 2025 mandate | Appoint Korean representative for PIPA compliance. |

**Data deletion implementation**:

```typescript
// src/app/actions/privacy.ts
"use server";

export async function requestAccountDeletion() {
  const session = await auth();
  const userId = session!.user.id;

  // 1. Cancel active subscription (immediate, with prorated refund)
  const sub = await getActiveSubscription(userId);
  if (sub) {
    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    // Prorated refund for unused days
  }

  // 2. Schedule deletion (30-day cooling period for GDPR compliance)
  await db.update(users).set({
    deletionRequestedAt: new Date(),
    deletionScheduledFor: addDays(new Date(), 30),
  }).where(eq(users.id, userId));

  // 3. Send confirmation email with cancel-deletion link

  // 4. After 30 days (cron job):
  //    - Anonymize user record (keep ID for game reference integrity)
  //    - Delete: email, name, image, all linked accounts, sessions
  //    - Delete: payment methods (Stripe handles this)
  //    - Retain: anonymized game records (for ranking system integrity)
  //    - Retain: payment history for 7 years (tax compliance)
  //    - Delete Stripe customer (stripe.customers.del)
}
```

---

## 6. Database Schema (Drizzle)

### 6.1 Auth Tables (Auth.js + Extensions)

```typescript
// src/db/schema/auth.ts
import {
  pgTable, text, timestamp, integer, boolean, varchar,
  primaryKey, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free", "premium", "dojang",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "trialing", "past_due", "canceled", "unpaid", "expired",
]);
export const orgRoleEnum = pgEnum("org_role", [
  "owner", "admin", "instructor", "student",
]);

// ─── Users (extends Auth.js default) ───
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  hashedPassword: text("hashed_password"), // For credentials provider

  // Baduk profile
  displayName: varchar("display_name", { length: 30 }),
  badukRank: varchar("baduk_rank", { length: 10 }),
  eloRating: integer("elo_rating").default(1000),
  country: varchar("country", { length: 2 }),
  language: varchar("language", { length: 5 }).default("en"),
  timezone: text("timezone").default("UTC"),

  // Stripe
  stripeCustomerId: text("stripe_customer_id"),

  // Subscription (denormalized for fast access)
  subscriptionTier: subscriptionTierEnum("subscription_tier").default("free"),

  // Security
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"), // AES-256-GCM encrypted
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until", { mode: "date" }),

  // GDPR
  deletionRequestedAt: timestamp("deletion_requested_at", { mode: "date" }),
  deletionScheduledFor: timestamp("deletion_scheduled_for", { mode: "date" }),

  // Metadata
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
  index("users_stripe_customer_idx").on(table.stripeCustomerId),
  index("users_subscription_tier_idx").on(table.subscriptionTier),
]);

// ─── Accounts (Auth.js — linked OAuth providers) ───
export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "oauth" | "credentials" | "email"
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
  index("accounts_user_id_idx").on(table.userId),
]);

// ─── Sessions (Auth.js — for DB session strategy if needed) ───
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),

  // Device tracking extension
  userAgent: text("user_agent"),
  ipHash: text("ip_hash"), // SHA-256 of IP for privacy
  deviceLabel: text("device_label"), // "Chrome on MacOS"
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
]);

// ─── Verification Tokens (Auth.js — magic links) ───
export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ─── Backup Codes (2FA) ───
export const backupCodes = pgTable("backup_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(), // bcrypt hash
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("backup_codes_user_id_idx").on(table.userId),
]);
```

### 6.2 Subscription & Payment Tables

```typescript
// src/db/schema/billing.ts
import {
  pgTable, text, timestamp, integer, boolean, varchar,
  numeric, index, uniqueIndex, pgEnum,
} from "drizzle-orm/pg-core";
import { users, subscriptionTierEnum, subscriptionStatusEnum } from "./auth";

// ─── Subscriptions ───
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id),

  // Stripe references
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),

  // Subscription details
  tier: subscriptionTierEnum("tier").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  interval: varchar("interval", { length: 10 }).notNull(), // "month" | "year"
  quantity: integer("quantity").default(1), // For 도장 per-seat

  // Billing period
  currentPeriodStart: timestamp("current_period_start", { mode: "date" }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }).notNull(),
  trialStart: timestamp("trial_start", { mode: "date" }),
  trialEnd: timestamp("trial_end", { mode: "date" }),

  // Cancellation
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at", { mode: "date" }),
  cancellationReason: text("cancellation_reason"),

  // Metadata
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("subscriptions_stripe_id_idx").on(table.stripeSubscriptionId),
  index("subscriptions_user_id_idx").on(table.userId),
  index("subscriptions_org_id_idx").on(table.organizationId),
  index("subscriptions_status_idx").on(table.status),
]);

// ─── Payment History ───
export const paymentHistory = pgTable("payment_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: text("subscription_id").references(() => subscriptions.id),

  // Stripe references
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripeChargeId: text("stripe_charge_id"),

  // Payment details
  type: varchar("type", { length: 20 }).notNull(),
  // "payment" | "refund" | "dispute" | "proration_credit" | "proration_debit"
  amount: integer("amount").notNull(), // In smallest currency unit (cents, won, yen)
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  // "succeeded" | "failed" | "pending" | "refunded" | "disputed"

  // Tax
  taxAmount: integer("tax_amount"),
  taxCountry: varchar("tax_country", { length: 2 }),

  // Metadata
  description: text("description"),
  failureReason: text("failure_reason"),
  receiptUrl: text("receipt_url"),
  invoicePdfUrl: text("invoice_pdf_url"),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("payment_history_user_id_idx").on(table.userId),
  index("payment_history_subscription_id_idx").on(table.subscriptionId),
  index("payment_history_stripe_intent_idx").on(table.stripePaymentIntentId),
  index("payment_history_created_idx").on(table.createdAt),
]);

// ─── Subscription Events (audit log) ───
export const subscriptionEvents = pgTable("subscription_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriptionId: text("subscription_id").notNull().references(() => subscriptions.id),
  userId: text("user_id").notNull().references(() => users.id),

  event: varchar("event", { length: 50 }).notNull(),
  // "created" | "trial_started" | "activated" | "renewed" | "payment_failed"
  // | "past_due" | "canceled" | "reactivated" | "upgraded" | "downgraded"
  // | "dispute_opened" | "dispute_won" | "dispute_lost"

  previousStatus: subscriptionStatusEnum("previous_status"),
  newStatus: subscriptionStatusEnum("new_status"),
  previousTier: subscriptionTierEnum("previous_tier"),
  newTier: subscriptionTierEnum("new_tier"),

  stripeEventId: text("stripe_event_id"), // For idempotency
  metadata: text("metadata"), // JSON blob for extra context

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  index("sub_events_subscription_idx").on(table.subscriptionId),
  index("sub_events_user_idx").on(table.userId),
  index("sub_events_stripe_event_idx").on(table.stripeEventId),
  index("sub_events_created_idx").on(table.createdAt),
]);
```

### 6.3 Organization Tables (도장 Plan)

```typescript
// src/db/schema/organization.ts
import {
  pgTable, text, timestamp, integer, varchar, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, orgRoleEnum } from "./auth";

// ─── Organizations ───
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull(), // URL-friendly identifier
  ownerId: text("owner_id").notNull().references(() => users.id),
  stripeCustomerId: text("stripe_customer_id"),

  // Settings
  maxSeats: integer("max_seats").default(100),
  currentSeats: integer("current_seats").default(0),
  logoUrl: text("logo_url"),
  description: text("description"),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("orgs_slug_idx").on(table.slug),
  index("orgs_owner_idx").on(table.ownerId),
]);

// ─── Organization Members ───
export const organizationMembers = pgTable("organization_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: orgRoleEnum("role").notNull().default("student"),
  invitedBy: text("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("org_members_unique_idx").on(table.organizationId, table.userId),
  index("org_members_org_idx").on(table.organizationId),
  index("org_members_user_idx").on(table.userId),
]);

// ─── Organization Invites ───
export const organizationInvites = pgTable("organization_invites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: orgRoleEnum("role").notNull().default("student"),
  token: text("token").notNull(), // Unique invite token
  invitedBy: text("invited_by").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  acceptedAt: timestamp("accepted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("org_invites_token_idx").on(table.token),
  index("org_invites_org_idx").on(table.organizationId),
  index("org_invites_email_idx").on(table.email),
]);
```

### 6.4 Entity Relationship Diagram

```
┌──────────────────┐     1:N     ┌──────────────────┐
│     users        │◄────────────│    accounts       │
│                  │             │ (OAuth providers)  │
│  id              │             │                    │
│  email           │     1:N     │  userId           │
│  stripeCustomerId│◄──────┐     │  provider         │
│  subscriptionTier│       │     │  providerAccountId│
│  twoFactorEnabled│       │     └──────────────────┘
└────────┬─────────┘       │
         │                  │     ┌──────────────────┐
         │ 1:N              │     │    sessions       │
         ├──────────────────┤     │                   │
         │                  ├────►│  userId           │
         │                  │     │  sessionToken     │
         │                  │     │  userAgent        │
         │ 1:1              │     └──────────────────┘
         ▼                  │
┌──────────────────┐       │     ┌──────────────────┐
│  subscriptions   │       │     │  backup_codes     │
│                  │       └────►│                   │
│  userId          │             │  userId           │
│  stripeSubId     │             │  codeHash         │
│  tier            │             └──────────────────┘
│  status          │
│  quantity (seats)│     1:N     ┌──────────────────┐
│  currentPeriodEnd│◄────────────│ subscription_    │
│  organizationId  │             │ events           │
└────────┬─────────┘             │                   │
         │                       │  subscriptionId   │
         │ 1:N                   │  event            │
         ▼                       │  stripeEventId    │
┌──────────────────┐             └──────────────────┘
│ payment_history  │
│                  │
│  userId          │
│  subscriptionId  │
│  amount/currency │
│  type            │
│  status          │
└──────────────────┘

┌──────────────────┐     1:N     ┌──────────────────┐
│  organizations   │◄────────────│ organization_    │
│                  │             │ members           │
│  id              │             │                   │
│  ownerId         │             │  organizationId   │
│  stripeCustomerId│             │  userId           │
│  currentSeats    │             │  role             │
└──────────────────┘             └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│ organization_    │
│ invites          │
│                  │
│  organizationId  │
│  email           │
│  token           │
│  expiresAt       │
└──────────────────┘
```

---

## 7. API Endpoints

### 7.1 Authentication Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| `GET/POST` | `/api/auth/[...nextauth]` | Auth.js catch-all handler (signin, signout, callback, session) | No |
| `POST` | `/api/auth/register` | Email + password registration | No |
| `POST` | `/api/auth/2fa/setup` | Generate TOTP secret + QR code | Yes |
| `POST` | `/api/auth/2fa/verify` | Verify TOTP code (setup or login) | Yes (partial) |
| `POST` | `/api/auth/2fa/disable` | Disable 2FA (requires current TOTP or backup code) | Yes |
| `POST` | `/api/auth/2fa/backup-codes` | Generate new backup codes | Yes |
| `POST` | `/api/auth/link` | Link additional OAuth provider | Yes |
| `DELETE` | `/api/auth/link/:provider` | Unlink OAuth provider (must keep ≥1) | Yes |
| `GET` | `/api/auth/sessions` | List active sessions (device management) | Yes |
| `DELETE` | `/api/auth/sessions/:id` | Revoke specific session | Yes |

### 7.2 Billing Endpoints (Server Actions + API)

| Method | Path / Server Action | Description | Auth Required |
|--------|---------------------|-------------|--------------|
| (SA) | `createCheckoutSession(priceId)` | Create Stripe Checkout session | Yes |
| (SA) | `createPortalSession()` | Redirect to Stripe Billing Portal | Yes |
| (SA) | `cancelSubscription()` | Cancel at period end | Yes |
| (SA) | `reactivateSubscription()` | Un-cancel before period end | Yes |
| (SA) | `requestRefund(reason)` | Request prorated refund | Yes |
| `GET` | `/api/v1/billing/status` | Current subscription status | Yes |
| `GET` | `/api/v1/billing/invoices` | List invoices | Yes |
| `GET` | `/api/v1/billing/usage` | Current usage for rate-limited features | Yes |
| `POST` | `/api/webhooks/stripe` | Stripe webhook handler | Stripe signature |

### 7.3 Subscription & Feature Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/subscription/quotas` | Remaining daily quotas for all features | Yes |
| `GET` | `/api/v1/subscription/features` | Feature access map for current tier | Yes |
| `POST` | `/api/v1/subscription/check` | Check access for specific feature | Yes |

### 7.4 Organization / 도장 Endpoints (Phase 2)

| Method | Path | Description | Auth Required | Role |
|--------|------|-------------|--------------|------|
| `POST` | `/api/v1/orgs` | Create organization | Yes | — |
| `GET` | `/api/v1/orgs/:id` | Get organization details | Yes | member |
| `PATCH` | `/api/v1/orgs/:id` | Update organization | Yes | owner/admin |
| `DELETE` | `/api/v1/orgs/:id` | Delete organization | Yes | owner |
| `GET` | `/api/v1/orgs/:id/members` | List members | Yes | admin+ |
| `POST` | `/api/v1/orgs/:id/members/invite` | Send invite | Yes | admin+ |
| `DELETE` | `/api/v1/orgs/:id/members/:userId` | Remove member | Yes | admin+ |
| `PATCH` | `/api/v1/orgs/:id/members/:userId/role` | Change member role | Yes | owner |
| `POST` | `/api/v1/orgs/:id/seats` | Update seat count | Yes | owner |
| `GET` | `/api/v1/orgs/:id/analytics` | 도장 analytics dashboard | Yes | admin+ |
| `GET` | `/api/v1/orgs/:id/students/:userId/progress` | Student progress | Yes | instructor+ |

### 7.5 Privacy / GDPR Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/privacy/export` | Export all user data (JSON) | Yes |
| `POST` | `/api/v1/privacy/delete` | Request account deletion (30-day cooldown) | Yes |
| `POST` | `/api/v1/privacy/cancel-deletion` | Cancel pending deletion | Yes |
| `GET` | `/api/v1/privacy/consents` | Get current consent status | Yes |
| `PATCH` | `/api/v1/privacy/consents` | Update consent preferences | Yes |

---

## 8. Webhook Handlers

### 8.1 Stripe Webhook Route

```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import {
  users, subscriptions, paymentHistory, subscriptionEvents,
} from "@/db/schema";
import { invalidateSubscriptionCache } from "@/lib/feature-gate";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature")!;

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

  // Idempotency: check if we've already processed this event
  const existingEvent = await db.query.subscriptionEvents.findFirst({
    where: eq(subscriptionEvents.stripeEventId, event.id),
  });
  if (existingEvent) {
    return new Response("Already processed", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error processing ${event.type}:`, err);
    // Return 200 to prevent Stripe retries for processing errors
    // Log for manual investigation
    await logWebhookError(event.id, event.type, err);
  }

  return new Response("OK", { status: 200 });
}

// ─── Handler Functions ───

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  // Update Stripe customer ID if not already set
  await db
    .update(users)
    .set({ stripeCustomerId: session.customer as string })
    .where(eq(users.id, userId));
}

async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  const userId = sub.metadata.userId;
  if (!userId) return;

  const priceId = sub.items.data[0].price.id;
  const tier = getTierFromPriceId(priceId);

  await db.insert(subscriptions).values({
    userId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    stripeCustomerId: sub.customer as string,
    tier,
    status: sub.status as any,
    interval: sub.items.data[0].price.recurring?.interval ?? "month",
    quantity: sub.items.data[0].quantity ?? 1,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  });

  // Update denormalized tier on user
  await db.update(users).set({ subscriptionTier: tier }).where(eq(users.id, userId));

  // Invalidate cache
  await invalidateSubscriptionCache(userId);

  // Log event
  await logSubscriptionEvent(sub.id, userId, "created", null, sub.status, null, tier, sub.id);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const existingSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, sub.id),
  });
  if (!existingSub) return;

  const newTier = getTierFromPriceId(sub.items.data[0].price.id);
  const previousStatus = existingSub.status;
  const previousTier = existingSub.tier;

  await db
    .update(subscriptions)
    .set({
      status: sub.status as any,
      tier: newTier,
      stripePriceId: sub.items.data[0].price.id,
      interval: sub.items.data[0].price.recurring?.interval ?? "month",
      quantity: sub.items.data[0].quantity ?? 1,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existingSub.id));

  // Update denormalized tier on user
  await db
    .update(users)
    .set({ subscriptionTier: sub.status === "active" || sub.status === "trialing" ? newTier : "free" })
    .where(eq(users.id, existingSub.userId));

  // Invalidate cache
  await invalidateSubscriptionCache(existingSub.userId);

  // Determine event type
  let eventType = "updated";
  if (previousStatus !== sub.status) {
    if (sub.status === "active" && previousStatus === "trialing") eventType = "activated";
    else if (sub.status === "past_due") eventType = "payment_failed";
    else if (sub.cancel_at_period_end) eventType = "canceled";
  }
  if (previousTier !== newTier) {
    eventType = tierRank(newTier) > tierRank(previousTier) ? "upgraded" : "downgraded";
  }

  await logSubscriptionEvent(
    existingSub.id, existingSub.userId, eventType,
    previousStatus, sub.status, previousTier, newTier, sub.id
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const existingSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, sub.id),
  });
  if (!existingSub) return;

  await db
    .update(subscriptions)
    .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.id, existingSub.id));

  // Revert to free tier
  await db
    .update(users)
    .set({ subscriptionTier: "free" })
    .where(eq(users.id, existingSub.userId));

  await invalidateSubscriptionCache(existingSub.userId);

  await logSubscriptionEvent(
    existingSub.id, existingSub.userId, "deleted",
    existingSub.status, "canceled", existingSub.tier, "free", sub.id
  );

  // Send cancellation email
  await sendEmail(existingSub.userId, "subscription_ended");
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string;
  const existingSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subId),
  });
  if (!existingSub) return;

  await db.insert(paymentHistory).values({
    userId: existingSub.userId,
    subscriptionId: existingSub.id,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent as string,
    type: "payment",
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: "succeeded",
    taxAmount: invoice.tax ?? 0,
    receiptUrl: invoice.hosted_invoice_url,
    invoicePdfUrl: invoice.invoice_pdf,
    description: `${existingSub.tier} subscription — ${existingSub.interval}ly`,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = invoice.subscription as string;
  const existingSub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subId),
  });
  if (!existingSub) return;

  await db.insert(paymentHistory).values({
    userId: existingSub.userId,
    subscriptionId: existingSub.id,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent as string,
    type: "payment",
    amount: invoice.amount_due,
    currency: invoice.currency,
    status: "failed",
    failureReason: invoice.last_finalization_error?.message ?? "Payment declined",
    description: "Subscription renewal failed",
  });

  // Send payment failure notification
  await sendEmail(existingSub.userId, "payment_failed", {
    nextRetry: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000)
      : null,
  });
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId = dispute.charge as string;
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = charge.customer as string;

  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });
  if (!user) return;

  // Immediately revoke premium access (fraud prevention)
  await db.update(users).set({ subscriptionTier: "free" }).where(eq(users.id, user.id));
  await invalidateSubscriptionCache(user.id);

  await db.insert(paymentHistory).values({
    userId: user.id,
    stripeChargeId: chargeId,
    type: "dispute",
    amount: dispute.amount,
    currency: dispute.currency,
    status: "disputed",
    description: `Dispute: ${dispute.reason}`,
  });

  // Alert ops team
  await sendOpsAlert("dispute_created", {
    userId: user.id,
    email: user.email,
    amount: dispute.amount,
    reason: dispute.reason,
  });
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  const chargeId = dispute.charge as string;
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = charge.customer as string;

  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customerId),
  });
  if (!user) return;

  if (dispute.status === "won") {
    // Restore access — find their subscription
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, user.id),
    });
    if (sub && sub.currentPeriodEnd > new Date()) {
      await db.update(users).set({ subscriptionTier: sub.tier }).where(eq(users.id, user.id));
      await invalidateSubscriptionCache(user.id);
    }
  }
  // If lost: user stays on free tier, $15 dispute fee absorbed
}

// ─── Helpers ───

function getTierFromPriceId(priceId: string): "free" | "premium" | "dojang" {
  const PRICE_TIER_MAP: Record<string, "premium" | "dojang"> = {
    [process.env.STRIPE_PRICE_PREMIUM_MONTHLY!]: "premium",
    [process.env.STRIPE_PRICE_PREMIUM_YEARLY!]: "premium",
    [process.env.STRIPE_PRICE_DOJANG_SEAT!]: "dojang",
  };
  return PRICE_TIER_MAP[priceId] ?? "free";
}

function tierRank(tier: string): number {
  return { free: 0, premium: 1, dojang: 2 }[tier] ?? 0;
}

async function logSubscriptionEvent(
  subscriptionId: string, userId: string, event: string,
  previousStatus: any, newStatus: any, previousTier: any, newTier: any,
  stripeEventId: string
) {
  await db.insert(subscriptionEvents).values({
    subscriptionId, userId, event,
    previousStatus, newStatus, previousTier, newTier,
    stripeEventId,
  });
}
```

### 8.2 Webhook Events to Subscribe

Configure these in Stripe Dashboard → Developers → Webhooks:

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.trial_will_end      (→ send reminder email)
invoice.paid
invoice.payment_failed
invoice.upcoming                          (→ send "renewal coming" email)
charge.dispute.created
charge.dispute.closed
charge.refunded
customer.updated                          (→ sync email/address changes)
```

---

## 9. Error Scenarios & Handling

### 9.1 Authentication Errors

| Error | Cause | User-Facing Message | Technical Handling |
|-------|-------|--------------------|--------------------|
| `OAuthAccountNotLinked` | Email exists with different provider | "An account with this email already exists. Sign in with [original provider] or link this provider in Settings." | Auth.js built-in error. Redirect to `/auth/error?error=OAuthAccountNotLinked`. |
| `CredentialsSignin` | Wrong password | "Invalid email or password." | Never reveal which field is wrong. Rate limit after 5 attempts. |
| `2FARequired` | TOTP not provided | "Two-factor authentication required." | Custom error. Redirect to `/auth/2fa`. |
| `2FAInvalid` | Wrong TOTP code | "Invalid code. X attempts remaining." | Increment `failedLoginAttempts`. Lock after 5. |
| `AccountLocked` | Too many failed attempts | "Account temporarily locked. Try again in 15 minutes." | Check `lockedUntil` timestamp. |
| `SessionExpired` | JWT expired | Automatic redirect to sign-in | Auth.js handles via `maxAge`. Silent re-auth for OAuth. |
| `ApplePrivateRelay` | Apple hides email | "Please allow email sharing to create your account." | Apple can provide a private relay email — accept it. Map to real email if user links later. |
| `KakaoEmailMissing` | Kakao doesn't provide email | "Please provide your email to complete registration." | Redirect to supplementary email form. Store Kakao ID without email. |

### 9.2 Payment Errors

| Error | Cause | User-Facing Message | Technical Handling |
|-------|-------|--------------------|--------------------|
| `card_declined` | Insufficient funds, expired, etc. | "Your payment was declined. Please try a different payment method." | Stripe returns decline code. Log in `payment_history`. Show specific guidance based on `decline_code`. |
| `incomplete_expired` | Checkout abandoned | — | Cleanup incomplete subscriptions via cron (7-day TTL). |
| `subscription_incomplete` | First payment failed | "We couldn't process your payment. Your trial will continue — please update your payment method." | Stripe retries. Grace period logic applies. |
| `webhook_signature_invalid` | Tampered or misconfigured | — (internal) | Return 400. Alert ops. Never process unverified events. |
| `idempotency_conflict` | Duplicate webhook delivery | — (internal) | Check `stripeEventId` in `subscription_events`. Skip if exists. Return 200. |
| `stripe_unavailable` | Stripe outage | "Payment processing is temporarily unavailable. Your current access is unaffected." | Fail-closed for new purchases. Fail-open for existing access (trust cache/JWT). |
| `currency_not_supported` | User's country currency unsupported | "We'll charge in USD. Your bank will convert at their rate." | Default to USD. Stripe handles conversion. |

### 9.3 Feature Gating Errors

| Error | Cause | User-Facing Message | Technical Handling |
|-------|-------|--------------------|--------------------|
| `feature_gated` | Free user accessing premium feature | "Upgrade to Premium to unlock [feature]." | Return 403 with `upgradeUrl`. Client shows upgrade modal. |
| `rate_limit_exceeded` | Daily quota exhausted | "Daily limit reached (5/5). Upgrade for unlimited access." | Return 429 with `remaining: 0` and `resetsAt`. |
| `subscription_expired` | Grace period ended | "Your Premium access has ended. Resubscribe to continue." | Revert to free tier features. Preserve data (read-only). |
| `cache_miss` | Redis unavailable | — (transparent) | Fallback to DB query. Log for monitoring. |

---

## 10. Testing Strategy

### 10.1 Authentication Testing

| Test Category | Tool | Tests |
|--------------|------|-------|
| **Unit: Auth callbacks** | Vitest | JWT callback adds correct claims. Session callback shapes response. signIn callback blocks locked accounts. |
| **Unit: TOTP** | Vitest | Secret generation, encryption/decryption, code verification with drift, backup code hashing. |
| **Integration: OAuth flow** | Playwright | Full sign-in flow for each provider (using test accounts). Account linking. Error states. |
| **Integration: 2FA** | Playwright + otpauth | Enable 2FA → login with TOTP → disable. Backup code flow. Lockout after failures. |
| **Security: Rate limiting** | Vitest + supertest | 5 failed logins → lockout. 20 req/min rate limit. CSRF token validation. |
| **E2E: Multi-provider** | Playwright | Sign up with Google → link Discord → sign in with Discord → same account. |

### 10.2 Payment Testing

**Stripe Test Mode**: Use `sk_test_...` keys throughout development. Test card numbers:

| Card Number | Scenario |
|------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0341` | Attaching fails (card_declined) |
| `4000 0000 0000 9995` | Payment fails (insufficient_funds) |
| `4000 0000 0000 0077` | Charge succeeds, then dispute created |
| `4000 0025 0000 3155` | 3D Secure authentication required |

| Test Category | Tool | Tests |
|--------------|------|-------|
| **Unit: Price mapping** | Vitest | `getTierFromPriceId` returns correct tier for all price IDs. |
| **Unit: Refund calculation** | Vitest | Full refund within 48h. Prorated monthly. Prorated yearly within 30d. No refund after 30d yearly. |
| **Integration: Webhook handler** | Vitest + stripe-mock | All 12 event types handled correctly. Idempotency (duplicate events ignored). Signature validation. |
| **Integration: Checkout flow** | Playwright | Free → trial → premium. Upgrade monthly → yearly. Cancel and reactivate. |
| **Integration: Grace period** | Vitest | Payment failure → 7-day full access → 7-day limited → downgrade to free. |
| **E2E: Full lifecycle** | Playwright + Stripe CLI | Trial → activate → renew → upgrade → cancel → resubscribe. Invoice generation. Portal access. |

**Stripe CLI for local webhook testing**:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

### 10.3 Feature Gating Testing

| Test Category | Tool | Tests |
|--------------|------|-------|
| **Unit: Feature access** | Vitest | Free user blocked from premium features. Premium user allowed. Rate limits enforced. |
| **Unit: Cache** | Vitest + ioredis-mock | Cache hit returns correct tier. Cache miss queries DB. Cache invalidation on webhook. |
| **Integration: Degradation** | Vitest | Redis down → DB fallback. DB down → JWT fallback. Both down → 500 error for new purchases, cached access for existing. |
| **E2E: Upgrade flow** | Playwright | Free user hits limit → upgrade prompt → checkout → feature unlocked immediately. |

### 10.4 GDPR/Privacy Testing

| Test Category | Tool | Tests |
|--------------|------|-------|
| **Integration: Data export** | Vitest | Export includes all user data. No other user's data included. Format is machine-readable JSON. |
| **Integration: Deletion** | Vitest | 30-day cooldown enforced. Cancel-deletion works. Post-deletion: PII removed, anonymized games preserved, payment history retained 7 years. |
| **Integration: Consent** | Playwright | Consent checkboxes at signup. Update preferences. Consent withdrawal removes data from non-essential processing. |

---

## 11. Timeline

### Phase 1: Authentication + Payment MVP (Weeks 1-4)

```
Week 1: Auth Foundation
├── Day 1-2: Auth.js v5 setup + Drizzle adapter + DB migration
├── Day 3-4: Google + Email (magic link) + Credentials providers
├── Day 5: Apple Sign-In (HTTPS dev tunnel, .p8 key)
└── Tests: Unit + integration for auth callbacks

Week 2: Full Provider Suite + Security
├── Day 1: GitHub + Discord providers
├── Day 2: Kakao + LINE providers
├── Day 3: Account linking (auto + manual)
├── Day 4: 2FA (TOTP setup, QR, backup codes)
├── Day 5: Rate limiting, session management, device tracking
└── Tests: E2E auth flows for all providers

Week 3: Stripe Integration
├── Day 1: Stripe setup, product/price creation, checkout session
├── Day 2: Webhook handler (all 12 events)
├── Day 3: Subscription lifecycle (trial, activate, renew, cancel)
├── Day 4: Feature gating (server middleware + Redis cache)
├── Day 5: Client-side subscription context + upgrade prompts
└── Tests: Webhook handler unit tests, Stripe CLI integration

Week 4: Billing UX + Compliance
├── Day 1: Billing Portal integration, invoice display
├── Day 2: Refund flow, payment failure grace period
├── Day 3: Stripe Tax setup (VAT/GST auto-calculation)
├── Day 4: GDPR/PIPA compliance (export, deletion, consent)
├── Day 5: Localized pricing (KRW, JPY, adaptive pricing)
└── Tests: E2E checkout → cancel → resubscribe, tax compliance
```

### Phase 2: 도장 Plan + Advanced Features (Weeks 5-8)

```
Week 5: Organization Foundation
├── Day 1-2: Organization schema, create/manage orgs
├── Day 3: Member invites (email + link)
├── Day 4: Role-based permissions (RBAC)
├── Day 5: Per-seat Stripe billing integration
└── Tests: Org CRUD, invite flow, permission enforcement

Week 6: 도장 Dashboard
├── Day 1-2: Admin dashboard (seat management, billing)
├── Day 3: Student progress tracking
├── Day 4: Class management, game review queue
├── Day 5: 도장 analytics (engagement, rank progression)
└── Tests: Dashboard integration tests

Week 7: Advanced Features
├── Day 1: Private 도장 rooms (WebSocket integration)
├── Day 2: Custom problem sets for 도장
├── Day 3: Batch SGF export
├── Day 4: 도장 branding (logo, custom themes)
├── Day 5: Org-level notification settings
└── Tests: Room isolation, export, branding

Week 8: Polish + Security Audit
├── Day 1-2: Security audit (penetration testing, OWASP checklist)
├── Day 3: Performance optimization (Redis caching, query optimization)
├── Day 4: Error handling hardening, monitoring setup (Sentry)
├── Day 5: Documentation, runbooks, incident response plan
└── Tests: Load testing, chaos testing (Redis/DB failure scenarios)
```

### Milestone Deliverables

| Week | Deliverable | Success Criteria |
|------|------------|-----------------|
| W1 | Auth MVP | Sign in with Google/Email/Apple. JWT sessions. DB persistence. |
| W2 | Full auth | All 7 providers working. 2FA. Account linking. Rate limiting. |
| W3 | Payment MVP | Checkout → trial → premium. Webhooks processing. Feature gating blocking free users. |
| W4 | Production billing | Tax compliant. Localized pricing. GDPR export/delete. Refund flow. |
| W5 | Org foundation | Create 도장 org. Invite members. Per-seat billing. |
| W6 | 도장 dashboard | Admin can manage students, view progress, review games. |
| W7 | 도장 features | Private rooms, custom problems, batch export. |
| W8 | Production-ready | Security audit passed. Monitoring. Runbooks. Load-tested. |

---

## Sources

### Authentication
- [Auth.js — Drizzle Adapter](https://authjs.dev/getting-started/adapters/drizzle)
- [Auth.js — Kakao Provider](https://authjs.dev/getting-started/providers/kakao)
- [Auth.js — Apple Provider](https://authjs.dev/getting-started/providers/apple)
- [Auth.js — Discord Provider](https://authjs.dev/getting-started/providers/discord)
- [LINE Provider — NextAuth.js](https://next-auth.js.org/providers/line)
- [Auth.js — Configuring OAuth Providers](https://authjs.dev/guides/configuring-oauth-providers)
- [Account Linking Discussion — NextAuth.js #2808](https://github.com/nextauthjs/next-auth/discussions/2808)
- [Migrating to Auth.js v5](https://authjs.dev/getting-started/migrating-to-v5)
- [Two-Factor Authentication in Next.js with NextAuth.js](https://dev.to/abdur_rakibrony_349a3f89/implementing-two-factor-authentication-in-nextjs-14-with-nextauthjs-28jl)
- [TOTP Authentication in Next.js — Step by Step](https://dev.to/corbado/how-to-implement-totp-authentication-in-nextjs-secure-2fa-login-step-by-step-3aip)

### Payment & Stripe
- [Stripe + Next.js 15: The Complete 2025 Guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/)
- [Stripe Subscriptions in Next.js](https://www.pedroalonso.net/blog/stripe-subscriptions-nextjs/)
- [Stripe — Build a Subscriptions Integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe — Using Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe — How Subscriptions Work](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe — Prorations](https://docs.stripe.com/billing/subscriptions/prorations)
- [Stripe — Configure the Customer Portal](https://docs.stripe.com/customer-management/configure-portal)
- [Stripe — Automate Payment Retries (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Stripe — Refund and Cancel Payments](https://docs.stripe.com/refunds)
- [Stripe — Handle Refunds and Disputes](https://docs.stripe.com/connect/saas/tasks/refunds-disputes)
- [Stripe — How Disputes Work](https://docs.stripe.com/disputes/how-disputes-work)
- [Stripe Checkout and Webhook in Next.js 15 (2025)](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e)
- [Vercel — nextjs-subscription-payments Template](https://github.com/vercel/nextjs-subscription-payments)
- [How to Create Per-Seat Billing with Stripe](https://usegravity.app/blog/how-to-use-per-seat-billing-with-stripe/)

### Tax & International
- [Stripe Tax — Automatic Tax Calculation](https://docs.stripe.com/tax)
- [Stripe Tax Calculation Guide 2025: SaaS Sales Tax & VAT](https://www.quantledger.app/blog/how-to-calculate-taxes-stripe)
- [South Korea VAT Guide for Digital Services](https://www.getsphere.com/blog/south-korea-vat)
- [South Korea VAT Reporting Rules for Foreign Digital Platforms — July 2025](https://vatabout.com/south-korea-vat-reporting-rules-for-foreign-digital-platforms--gateways--effective-july-2025)
- [Korea — Corporate Other Taxes (PWC)](https://taxsummaries.pwc.com/republic-of-korea/corporate/other-taxes)
- [Stripe — Adaptive Pricing](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing)
- [Stripe — Localize Prices](https://docs.stripe.com/payments/currencies/localize-prices)

### Revenue Recognition
- [Stripe — SaaS Revenue Recognition 101](https://stripe.com/resources/more/a-guide-to-revenue-recognition-for-saas-businesses)
- [ASC 606 How-To Guide — Stripe](https://stripe.com/resources/more/asc-606-how-to-guide)
- [Stripe Revenue Recognition](https://stripe.com/revenue-recognition)

### Compliance
- [South Korea PIPA — Complete Guide for SaaS](https://complydog.com/blog/south-korea-pipa-privacy-information-protection-act-saas)
- [South Korea PIPA Updates 2025](https://crossborderadvisorysolutions.com/personal-information-protection-act-pipa-updates-2025/)
- [GDPR Art. 17 — Right to Erasure](https://gdpr-info.eu/art-17-gdpr/)
- [Data Protection Laws — South Korea](https://www.dlapiperdataprotection.com/index.html?c=KR&t=law)

### Security
- [Complete Next.js Security Guide 2025](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices)
- [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [Implementing CSRF Protection in Next.js](https://medium.com/@mmalishshrestha/implementing-csrf-protection-in-next-js-applications-9a29d137a12d)

### Feature Flagging
- [Flags as Code in Next.js — Vercel](https://vercel.com/blog/flags-as-code-in-next-js)
- [Implementing Feature Flags with Next.js and App Router](https://dev.to/kylessg/implementing-feature-flags-with-nextjs-and-app-router-1gl8)
- [Best Feature Flags for React in 2025](https://reflag.com/blog/feature-flags-react)

### Drizzle ORM
- [Drizzle ORM PostgreSQL Best Practices Guide 2025](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [The Ultimate Guide to Drizzle ORM + PostgreSQL (2025 Edition)](https://dev.to/sameer_saleem/the-ultimate-guide-to-drizzle-orm-postgresql-2025-edition-22b)
- [Drizzle ORM — Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
