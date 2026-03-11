# Communication & Notification Research — Rapid MVP Essentials

> **Research Branch**: Communication & Notification — Rapid (MVP essentials only)
> **Perspective**: "Ship the minimum communication features that users actually need. Email for critical stuff, web push for engagement."
> **Date**: 2026-03-10
> **Stack**: Node.js 22 LTS, Next.js 15, PostgreSQL 16, Redis 7.2
> **Target**: MAU 8K, global audience

---

## Table of Contents

1. [Transactional Email — Resend (Deep Dive)](#1-transactional-email--resend-deep-dive)
2. [Web Push Notifications](#2-web-push-notifications)
3. [In-App Notifications](#3-in-app-notifications)
4. [Discord Integration](#4-discord-integration)
5. [MVP Communication Timeline](#5-mvp-communication-timeline)
6. [Conclusion & Recommendations](#6-conclusion--recommendations)
7. [Sources](#7-sources)

---

## 1. Transactional Email — Resend (Deep Dive)

### Current State (2025-2026)

Resend has established itself as the modern developer-first email API, co-created alongside React Email to offer a JSX-native email development experience. In 2025, React Email reached version 5.0 with dark mode preview support, Tailwind 4 integration, a new Resend integration, and 8 new components. The ecosystem is mature and production-ready.

### Resend vs Competitors

| Feature | Resend | SendGrid | Postmark |
|---------|--------|----------|----------|
| **Free Tier** | 3,000 emails/month | ~100 emails/day (~3,000/month) | 100 emails/month |
| **Paid Entry** | $20/month (50K emails) | $19.95/month (50K emails) | $15/month (10K emails) |
| **Developer Experience** | Excellent — React Email, modern API | Good — extensive docs, complex setup | Good — clean API, focused |
| **Deliverability** | Good | Average (shared IP reputation issues) | Best-in-class (22.3% better inbox placement than SendGrid) |
| **Template System** | React Email (JSX components) | Dynamic Templates (Handlebars) | Server-side templates |
| **Overage Policy** | No surprise billing — pauses sending | Auto-charges overage | Charges per email over limit |
| **Next.js Integration** | Native (same team) | SDK available | SDK available |

**Why Resend wins for this project:**
- React Email templates are JSX components — same mental model as the Next.js app
- 3,000 emails/month free tier is sufficient for MAU 8K (see capacity analysis below)
- No surprise billing — critical for MVP budget control
- Modern API with TypeScript support out of the box

### Free Tier Capacity Analysis for MAU 8K

| Email Type | Frequency | Monthly Volume (est.) |
|------------|-----------|----------------------|
| Welcome email | On signup (~200 new users/month) | 200 |
| Game invitation | ~5 per active user/month (subset) | 400 |
| Daily puzzle digest | Opt-in (~500 subscribers) | 500 |
| Subscription receipt | On purchase (~50/month) | 50 |
| Password reset / security | ~2% of MAU/month | 160 |
| **Total** | | **~1,310** |

**Verdict**: 3,000 free tier emails/month is comfortably sufficient for MAU 8K. Upgrade to Pro ($20/month for 50K emails) only needed when approaching MAU 20K+ or adding marketing emails.

### Email Templates for Go App

| Template | Purpose | Priority |
|----------|---------|----------|
| `WelcomeEmail` | New user onboarding, account verification | P0 — Day 1 |
| `GameInviteEmail` | Challenge notification with accept/decline links | P0 — Day 1 |
| `SubscriptionReceipt` | Payment confirmation with receipt details | P1 — Day 1 |
| `DailyPuzzleDigest` | Opt-in daily tsumego (Go problem) email | P2 — Day 2 |
| `PasswordReset` | Security-critical password reset link | P0 — Day 1 |
| `AIAnalysisReady` | Game review completed notification | P2 — Phase 2 |

### Implementation Pattern (Next.js + Resend + React Email)

```
emails/
  components/
    Layout.tsx          # Shared header/footer, Go board branding
    Button.tsx          # CTA button component
  WelcomeEmail.tsx      # Welcome template
  GameInviteEmail.tsx   # Game invitation template
  ReceiptEmail.tsx      # Subscription receipt

app/api/email/
  send/route.ts         # POST endpoint — Resend send API
```

**Key integration points:**
- `resend.emails.send()` with React Email component rendering
- Route Handlers in Next.js App Router for server-side sending
- Environment variables: `RESEND_API_KEY`, verified sender domain

### Deliverability Considerations

Global average inbox placement rate hovers around 83.1% (2025-2026 data). Key factors:
- **SPF, DKIM, DMARC** authentication is mandatory but not sufficient alone — emails with full authentication still see 30%+ spam placement rates
- **Transactional-only sending** (no marketing blasts) significantly improves deliverability
- **Regional variance**: Europe achieves 91% inbox placement vs Asia Pacific at 78%
- **Gmail**: ~95% deliverability (best), **Outlook**: ~75.6% (worst for B2B)

**Recommendation**: Set up custom domain authentication from Day 1 (SPF + DKIM + DMARC). Resend handles DKIM signing automatically for verified domains.

### Cost Summary

| MAU Range | Plan | Monthly Cost |
|-----------|------|-------------|
| 0–8K | Free | $0 |
| 8K–20K | Pro | $20/month |
| 20K–50K | Scale | $90/month |

---

## 2. Web Push Notifications

### Current State (2025-2026)

The Web Push API is now universally supported across all major browsers. Apple added Web Push support for home screen PWAs on iOS 16.4 (2023), and by 2026, every major browser — Chrome, Edge, Firefox, and Safari — fully supports service workers, Web App Manifest, and Web Push without flags.

### Browser Support Matrix

| Browser | Service Worker | Push API | Notifications API |
|---------|---------------|----------|-------------------|
| Chrome (desktop + Android) | Full | Full | Full |
| Firefox | Full | Full | Full |
| Safari (macOS 13+) | Full | Full | Full |
| Safari (iOS 16.4+, PWA) | Full | Full | Full |
| Edge | Full | Full | Full |

**Key constraint**: iOS Safari only supports push notifications when the app is installed as a PWA (added to home screen). This is acceptable for our Go app since PWA installation is a natural UX for engaged game players.

### Technical Architecture

```
[Next.js App] ──── VAPID keys ────▶ [Browser Push Service]
     │                                      │
     │ subscribe()                          │
     ▼                                      ▼
[PushSubscription] ──── stored in ────▶ [PostgreSQL]
     │
     │ web-push.sendNotification()
     ▼
[Service Worker] ──── self.addEventListener('push') ────▶ [Notification Display]
```

**Core components:**

1. **VAPID Key Pair** — Generated once, stored as environment variables
2. **Service Worker** (`public/sw.js`) — Listens for push events, displays notifications
3. **Push Subscription** — Browser-generated, stored in PG per user
4. **web-push npm package** — Server-side sending with VAPID authentication

### Push Notification Types for Go App

| Event | Notification Text (example) | Priority |
|-------|---------------------------|----------|
| Game challenge received | "Alex has challenged you to a 19x19 game" | P0 |
| Your turn | "It's your turn against Alex (move 42)" | P0 |
| AI analysis ready | "Your game review is ready — 3 key moments found" | P1 |
| Tournament starting | "Round 2 starts in 15 minutes" | P1 |
| Friend came online | "Alex is online and looking for a game" | P2 |

### Payload Constraints

- **Maximum payload size**: 4KB (Chrome/Firefox), 2KB (Safari)
- **Safe target**: Keep payloads under 3KB to ensure cross-browser compatibility
- **Encryption**: Mandatory — uses ECDH on P-256 curve + AES128GCM
- **TTL (Time-to-Live)**: Configurable per notification (default: 4 weeks). For "your turn" notifications, set TTL to 24 hours; for tournament reminders, set to 1 hour

### Implementation with web-push

The `web-push` npm package handles all complexity:
- VAPID key generation: `webpush.generateVAPIDKeys()`
- Setting credentials: `webpush.setVapidDetails(subject, publicKey, privateKey)`
- Sending: `webpush.sendNotification(subscription, payload, options)`
- Handles rate limiting and retry automatically
- Works in Node.js 16+, Bun, Deno, Cloudflare Workers

### Next.js PWA Setup

Next.js 15 supports PWA natively without third-party plugins (the `next-pwa` package is largely deprecated). Key files:

```
public/
  manifest.json         # PWA manifest with app metadata
  sw.js                 # Service worker with push event handler
app/
  layout.tsx            # Registers service worker on mount
  api/push/
    subscribe/route.ts  # Stores PushSubscription in PG
    send/route.ts       # Sends push via web-push
```

**Development note**: PWAs require HTTPS. Use `--experimental-https` flag for local development.

### Cost Summary

| Component | Cost |
|-----------|------|
| Web Push API | Free (browser-native) |
| web-push npm | Free (open source) |
| VAPID keys | Free (self-generated) |
| Push delivery | Free (no third-party service) |
| **Total** | **$0/month** |

### Implementation Timeline: 1–2 days

---

## 3. In-App Notifications

### Current State (2025-2026)

In-app notification centers (the "bell icon" pattern) are table-stakes for any web application. For our Go app, the architecture decision centers on how to deliver real-time updates to the client.

### SSE vs WebSocket for Notifications

Since the Go app already requires WebSocket for real-time game play (board state synchronization), the pragmatic choice is to **reuse the existing WebSocket connection** for notifications rather than introducing a second real-time transport.

| Aspect | SSE | WebSocket (already have) |
|--------|-----|-------------------------|
| Direction | Server → Client only | Bidirectional |
| Protocol | HTTP/2 multiplexed | Custom TCP upgrade |
| Reconnection | Automatic | Manual (must implement) |
| New infrastructure needed | Yes (new endpoint) | No (reuse game ws) |
| Complexity for notifications | Lower | Already paid — marginal |

**Decision**: Reuse WebSocket. The game server already maintains authenticated WS connections per player. Adding a notification channel on the same connection costs near-zero incremental complexity.

### PostgreSQL Notification Table Schema

```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,  -- 'game_challenge', 'your_turn', 'ai_ready', 'system'
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    data            JSONB,                 -- Structured payload (game_id, opponent_id, etc.)
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    read_at         TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, created_at DESC)
    WHERE is_read = FALSE;

CREATE INDEX idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
```

**Key design decisions:**
- `JSONB data` column for polymorphic payloads — different notification types carry different context (game_id, puzzle_id, tournament_id)
- Partial index on unread notifications — the most frequent query ("show unread count") hits only the small unread subset
- `type` as VARCHAR (not enum) — easier to add new notification types without migrations
- CASCADE delete — user deletion cleans up notifications automatically

### Notification Flow

```
[Game Event] ──▶ [Notification Service] ──▶ [PostgreSQL INSERT]
                       │                          │
                       │                          ▼
                       │                   [PG NOTIFY channel]
                       │                          │
                       ▼                          ▼
                 [WebSocket Push]          [Redis Pub/Sub]
                 (if user online)          (multi-instance)
```

For single-instance MVP, PostgreSQL `LISTEN/NOTIFY` is sufficient. For multi-instance scaling, Redis Pub/Sub distributes notifications across WebSocket server instances.

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | List notifications (paginated, newest first) |
| GET | `/api/notifications/unread-count` | Unread badge count |
| PATCH | `/api/notifications/:id/read` | Mark single as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Delete single notification |

### Frontend Component

A simple notification center with:
- Bell icon with unread count badge
- Dropdown/panel listing recent notifications
- Click-to-navigate (notification links to relevant page: game, puzzle, profile)
- "Mark all as read" action
- Real-time updates via existing WebSocket

### Cost Summary

| Component | Cost |
|-----------|------|
| PostgreSQL storage | Included (existing PG 16 instance) |
| WebSocket transport | Included (existing game server) |
| Redis Pub/Sub | Included (existing Redis 7.2 instance) |
| **Total** | **$0/month incremental** |

### Implementation Timeline: 1 day

---

## 4. Discord Integration

### Current State (2025-2026)

Discord has become the default community platform for gaming and niche interest groups. Multiple active Go/baduk Discord servers already exist:

| Community | Members | Focus |
|-----------|---------|-------|
| The Online Go Club | 3,435 | Open Go community |
| BenKyo Baduk HQ | 939 | League play, study groups |
| Go / Baduk / Weiqi Polska | 527 | Regional (Polish) |
| APAC Go/Baduk/Weiqi League | — | APAC regional league |
| Go Magic | — | Study, game review, community |
| Pro Go/Baduk/Weiqi | 197 | Professional level discussion |

These existing communities validate the demand and provide partnership/cross-promotion opportunities.

### Webhook-Only Approach (MVP)

For MVP, a webhook-only approach requires **no bot, no Discord.js dependency, no OAuth flow**. Just a simple HTTP POST:

```typescript
// Zero dependencies — just fetch()
async function sendDiscordWebhook(webhookUrl: string, payload: object) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
```

### Webhook Use Cases for Go App

| Event | Discord Channel | Embed Content |
|-------|----------------|---------------|
| Daily puzzle posted | #daily-puzzle | Puzzle image + difficulty + link |
| Tournament results | #tournaments | Winner, standings, notable games |
| New AI analysis feature | #announcements | Feature description + link |
| Server status | #status | Uptime, maintenance windows |
| Notable game completed | #notable-games | Players, result, link to review |

### Webhook Features

- **Embeds**: Rich formatted messages with images, fields, colors
- **Rate limits**: 30 requests/60 seconds per webhook
- **Payload size**: Up to 2000 characters for content, embeds up to 6000 characters total
- **Retry**: Built-in rate limit headers (`X-RateLimit-*`) for backoff
- **No authentication needed**: Webhook URL is the secret (store as env var)

### Phase 2: discord.js Bot (Deferred)

For richer interaction (slash commands, interactive buttons, game state queries):
- `discord.js` v14+ for full bot capabilities
- Slash commands: `/challenge @user`, `/puzzle`, `/leaderboard`
- Interactive embeds: Accept/decline game challenges within Discord
- Bot presence: Show online player count
- **Estimated effort**: 3-5 additional days (Phase 2)

### Cost Summary

| Component | Cost |
|-----------|------|
| Discord webhooks | Free |
| discord-webhook-node npm | Free (or use native fetch) |
| **Total** | **$0/month** |

### Implementation Timeline: 0.5 days

---

## 5. MVP Communication Timeline

### Day-by-Day Breakdown

#### Day 1: Resend + Core Email Templates (8 hours)
| Task | Hours | Details |
|------|-------|---------|
| Resend account + domain verification | 1 | DNS records (SPF, DKIM, DMARC) |
| React Email project setup | 1 | Install `@react-email/components`, shared layout |
| WelcomeEmail template | 1 | Logo, onboarding CTA |
| GameInviteEmail template | 1.5 | Dynamic opponent name, accept/decline links |
| PasswordReset template | 1 | Security-critical, time-limited link |
| SubscriptionReceipt template | 1 | Payment details, download link |
| API routes + integration testing | 1.5 | Route handlers, error handling, Resend SDK |

#### Day 2: Web Push Notifications (8 hours)
| Task | Hours | Details |
|------|-------|---------|
| VAPID key generation + env setup | 0.5 | `web-push` CLI, store in env |
| Service Worker (`sw.js`) | 2 | Push event listener, notification display, click handling |
| PWA manifest + registration | 1 | `manifest.json`, SW registration in layout |
| Push subscription API + PG storage | 2 | Subscribe/unsubscribe endpoints, PG table |
| Server-side send integration | 1.5 | Trigger push on game events |
| Browser permission UX | 1 | Permission prompt timing, fallback for denied |

#### Day 3: In-App Notification Center (8 hours)
| Task | Hours | Details |
|------|-------|---------|
| PG notification table + migrations | 1 | Schema, indexes, seed data |
| Notification API routes | 2 | CRUD endpoints, pagination |
| WebSocket notification channel | 2 | Add notification type to existing WS protocol |
| Bell icon + dropdown UI | 2 | Unread badge, notification list, mark-as-read |
| Integration with game events | 1 | Wire up: challenge, your-turn, analysis-ready |

#### Day 4 (Half Day): Discord Webhooks (4 hours)
| Task | Hours | Details |
|------|-------|---------|
| Discord webhook creation | 0.5 | Create webhooks in Discord server settings |
| Webhook utility function | 1 | Typed wrapper with embed builder |
| Daily puzzle webhook | 1 | Scheduled trigger (cron or game event) |
| Tournament results webhook | 1 | Post-tournament summary with standings |
| Testing + error handling | 0.5 | Rate limit handling, retry logic |

### Total: 3.5 days (28 hours)

---

## 6. Conclusion & Recommendations

### Recommended MVP Communication Stack

| Layer | Technology | Purpose | Cost |
|-------|-----------|---------|------|
| **Transactional Email** | Resend + React Email | Welcome, invites, receipts, password reset | $0/month (free tier) |
| **Push Notifications** | Web Push API + web-push npm | Game challenges, your-turn alerts, real-time engagement | $0/month |
| **In-App Notifications** | PG + WebSocket (existing) | Notification center, unread badges, real-time updates | $0/month incremental |
| **Community** | Discord Webhooks | Daily puzzles, tournament results, announcements | $0/month |

### Total MVP Cost

| Metric | Value |
|--------|-------|
| **Implementation time** | 3.5 days |
| **Monthly cost (MAU 0–8K)** | $0/month |
| **Monthly cost (MAU 8K–20K)** | $20/month (Resend Pro) |
| **Dependencies added** | `resend`, `@react-email/components`, `web-push` |
| **Third-party services** | Resend (email), Discord (webhooks) |
| **Infrastructure changes** | 1 new PG table, 1 service worker file, PWA manifest |

### What's Deferred to Phase 2

| Feature | Reason for Deferral | Estimated Effort |
|---------|---------------------|-----------------|
| **SMS notifications** | Expensive ($0.0079/SMS via Twilio), low ROI for web game | 2 days + ~$50/month |
| **Mobile push (native APNs/FCM)** | Requires native app wrapper (React Native/Capacitor) | 5 days |
| **Slack integration** | Low demand — Go community lives on Discord, not Slack | 1 day |
| **i18n email templates** | English-first MVP; add Korean/Japanese/Chinese in Phase 2 | 3 days |
| **Email marketing (newsletters)** | Resend Marketing Plan ($40/month) or separate tool | 2 days + $40/month |
| **Discord bot (interactive)** | Slash commands, game challenges within Discord | 3-5 days |
| **In-app chat / messaging** | Complex — needs moderation, storage, real-time infra | 5-10 days |
| **Email analytics dashboard** | Open/click tracking, deliverability monitoring | 1 day |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Resend free tier exceeded | Low (capacity: 2.3x headroom) | Medium | Monitor usage, upgrade to Pro ($20/month) |
| iOS push permission denied | Medium (Apple prompts are strict) | Low | Graceful fallback to email; prompt at right moment |
| Email deliverability issues | Low-Medium | High | Custom domain auth from Day 1; transactional-only sending |
| Discord webhook rate limits | Very Low (30/min is generous) | Low | Queue + backoff; batch daily updates |
| Service worker caching conflicts | Medium | Medium | Version SW carefully; use `skipWaiting()` strategy |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Go App (Next.js 15)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Game Events  │  │  User Actions │  │  Scheduled Jobs  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                    │             │
│         ▼                 ▼                    ▼             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Notification Service                    │    │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐  │    │
│  │  │  Email   │ │ Web Push │ │ In-App │ │ Discord  │  │    │
│  │  │ (Resend) │ │(web-push)│ │  (WS)  │ │(Webhook) │  │    │
│  │  └────┬────┘ └────┬─────┘ └───┬────┘ └────┬─────┘  │    │
│  └───────┼───────────┼───────────┼───────────┼─────────┘    │
│          │           │           │           │              │
└──────────┼───────────┼───────────┼───────────┼──────────────┘
           │           │           │           │
           ▼           ▼           ▼           ▼
      ┌─────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐
      │ Resend  │ │ Browser │ │  PG 16 │ │ Discord  │
      │  API    │ │  Push   │ │ + Redis│ │   API    │
      │         │ │ Service │ │  7.2   │ │          │
      └─────────┘ └─────────┘ └────────┘ └──────────┘
```

---

## 7. Sources

### Resend & Email
- [Resend Pricing Guide 2025 — Flexprice](https://flexprice.io/blog/detailed-resend-pricing-guide)
- [Resend Official Pricing](https://resend.com/pricing)
- [Resend Pricing in 2026 — UserJot](https://userjot.com/blog/resend-pricing-in-2025)
- [Resend Account Quotas and Limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Resend New Free Tier Announcement](https://resend.com/blog/new-free-tier)
- [Resend Features & Reviews — SaaSworthy](https://www.saasworthy.com/product/resend)
- [React Email 5.0 — Resend Blog](https://resend.com/blog/react-email-5)
- [Top 10 Resend Features in 2025](https://resend.com/blog/new-features-in-2025)
- [React Email Official](https://react.email)
- [React Email Templates Gallery](https://react.email/templates)
- [Email API Pricing Comparison — BuildMVPFast](https://www.buildmvpfast.com/api-costs/email)
- [Best Transactional Email Services 2026 — Knock](https://knock.app/blog/the-top-transactional-email-services-for-developers)
- [Postmark vs SendGrid Comparison 2026](https://postmarkapp.com/compare/sendgrid-alternative)
- [Choosing Email Service for Startups — Bahroze](https://bahroze.substack.com/p/choosing-the-right-email-service)
- [Transactional Email APIs Compared — Pingram](https://www.pingram.io/blog/transactional-email-apis)
- [Create and Send Email Templates with React Email and Resend — freeCodeCamp](https://www.freecodecamp.org/news/create-and-send-email-templates-using-react-email-and-resend-in-nextjs/)
- [Send Emails from Next.js with Resend — DEV](https://dev.to/thatanjan/send-emails-from-nextjs-with-resend-and-react-email-39fb)
- [Next.js Send Email Tutorial 2026 — Mailtrap](https://mailtrap.io/blog/nextjs-send-email/)

### Deliverability
- [Top 15 Email Deliverability Statistics 2026 — TrulyInbox](https://www.trulyinbox.com/blog/email-deliverability-statistics/)
- [2025 Email Deliverability Report — Unspam](https://unspam.email/articles/email-deliverability-report/)
- [Email Deliverability Statistics 2025 — Mailreach](https://www.mailreach.co/blog/email-deliverability-statistics)
- [Good Email Deliverability Rate 2026 — PowerDMARC](https://powerdmarc.com/email-deliverability-rate/)
- [2025 Deliverability Benchmark Report — Validity](https://www.validity.com/resource-center/2025-email-deliverability-benchmark-report/)

### Web Push
- [PWA Push Notifications Complete Guide — MagicBell](https://www.magicbell.com/blog/using-push-notifications-in-pwas)
- [PWA Performance Guide 2026 — DigitalApplied](https://www.digitalapplied.com/blog/progressive-web-apps-2026-pwa-performance-guide)
- [Re-engage Users with Push — Microsoft Edge Docs](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push)
- [Push API Deep Dive — FSJS](https://fsjs.dev/push-api-pwa-real-time-notifications/)
- [Background Push Notifications in PWAs — Medium](https://medium.com/@gxgemini777/complete-guide-to-implementing-background-push-notifications-in-pwas-d36340a06817)
- [web-push npm Package](https://www.npmjs.com/package/web-push)
- [web-push GitHub Repository](https://github.com/web-push-libs/web-push)
- [Web Push Payload Encryption — Chrome Developers](https://developer.chrome.com/blog/web-push-encryption)
- [Web Push Protocol — web.dev](https://web.dev/articles/push-notifications-web-push-protocol)
- [Web Push Notification Character Limit — Pushpad](https://pushpad.xyz/blog/web-push-notifications-character-limit)
- [Next.js PWA Guide — Official Docs](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js 16 PWA Setup — BuildWithMatija](https://www.buildwithmatija.com/blog/turn-nextjs-16-app-into-pwa)
- [Push Notifications in PWA with Next.js — Medium](https://medium.com/@saeedtajfard3/implementing-push-notifications-in-pwa-with-next-js-8e5bf898b0e8)
- [Push Notifications in Next.js with Web-Push — Designly](https://blog.designly.biz/push-notifications-in-next-js-with-web-push-a-provider-free-solution)
- [PWA Setup Guide for Next.js 15 — DEV](https://dev.to/rakibcloud/progressive-web-app-pwa-setup-guide-for-nextjs-15-complete-step-by-step-walkthrough-2b85)

### SSE vs WebSocket
- [SSE in Next.js Real-Time Notifications — Pedro Alonso](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/)
- [Streaming in Next.js 15: WebSockets vs SSE — HackerNoon](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events)
- [SSE Beat WebSockets for 95% of Apps — DEV](https://dev.to/polliog/server-sent-events-beat-websockets-for-95-of-real-time-apps-heres-why-a4l)
- [WebSockets vs SSE — Ably](https://ably.com/blog/websockets-vs-sse)
- [SSE vs WebSockets — freeCodeCamp](https://www.freecodecamp.org/news/server-sent-events-vs-websockets/)

### Notification System Design
- [Notification Database Design — Medium](https://tannguyenit95.medium.com/designing-a-notification-system-1da83ca971bc)
- [Scalable Notification System Design — DEV](https://dev.to/ndohjapan/scalable-notification-system-design-for-50-million-users-database-design-4cl)
- [Notification System Design — MagicBell](https://www.magicbell.com/blog/notification-system-design)
- [Database Table Structure for Notification Events — DEV](https://dev.to/echoeyecodes/database-table-structure-for-different-notification-events-3lbc)
- [PostgreSQL NOTIFY Documentation](https://www.postgresql.org/docs/current/sql-notify.html)
- [Notifier Pattern for Postgres — Brandur](https://brandur.org/notifier)

### Discord
- [Discord Webhooks Complete Guide 2025 — InventiveHQ](https://inventivehq.com/blog/discord-webhooks-guide)
- [discord.js Webhooks Guide](https://discordjs.guide/popular-topics/webhooks.html)
- [discord-webhook-node npm](https://www.npmjs.com/package/discord-webhook-node)
- [Discord Event Relay Bot with Node.js — Medium](https://javascript.plainenglish.io/discord-event-relay-bot-with-node-js-webhooks-and-postgresql-b6c252346ed2)
- [Monitoring API Health with Discord — Medium](https://medium.com/@louistrinh/monitoring-api-health-and-system-status-with-discord-notifications-in-node-js-express-1c1ddf125f7b)
- [Discord Servers Tagged Baduk — DISBOARD](https://disboard.org/servers/tag/baduk)
