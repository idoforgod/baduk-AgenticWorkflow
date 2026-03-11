# Communication & Community System Research — Robust Branch

> **Research 4 for PRD**: AI agentic workflow to build Go (baduk) app
> **Stack**: Node.js 22 LTS, Next.js 15, PostgreSQL 16, Redis 7.2
> **Target**: MAU 8K → 50K, global (Korea / Japan / US / EU)
> **Perspective**: "Communication IS the product for a multiplayer game. Invest in a complete system that scales."
> **Date**: 2026-03-10

---

## Table of Contents

1. [Email Platform Comparison](#1-email-platform-comparison)
2. [Push Notification Architecture](#2-push-notification-architecture)
3. [Internationalization (i18n)](#3-internationalization-i18n)
4. [Community Features](#4-community-features)
5. [Complete Communication Architecture](#5-complete-communication-architecture)
6. [Recommended Stack & 6-Week Implementation Plan](#6-recommended-stack--6-week-implementation-plan)
7. [Sources](#sources)

---

## 1. Email Platform Comparison

### 1.1 Provider Analysis

#### Resend — Modern DX, React Email Native

| Attribute | Detail |
|-----------|--------|
| **Free Tier** | 3,000 transactional emails/mo + 1,000 marketing contacts (unlimited sends) |
| **Pro** | $20/mo for 50,000 emails |
| **Scale** | $90/mo for 100,000 emails |
| **Overage** | Pay-as-you-go per 1,000 email bucket (auto-charge) |
| **DX** | React Email v5.0 — JSX templates, dark mode preview, Tailwind 4 support, 8 new components |
| **Features** | REST API, native SDKs (Node.js/Python/Go/Ruby/PHP/Elixir), webhooks (open/click/bounce events), SMTP relay on all plans, batch sends with idempotency keys, scheduled sends, file attachments |
| **Deliverability** | Good; DKIM/SPF/DMARC; dedicated IP on Scale plan |
| **i18n** | `@languine/react-email` library for template localization; JSX-based templates allow per-locale rendering logic natively |
| **Best For** | Next.js/React teams wanting type-safe email templates and modern DX |

**Go App Fit**: Excellent. JSX email templates integrate naturally with the Next.js 15 stack. React Email components can render game result summaries, tournament invitations, and weekly game record digests with embedded board diagrams.

#### SendGrid — Mature, High Volume

| Attribute | Detail |
|-----------|--------|
| **Free Tier** | Retired (May 27, 2025) — no longer available |
| **Essentials** | $19.95/mo for 50,000 emails |
| **Pro** | $34.95/mo for 100,000 emails |
| **Features** | Transactional + marketing in one platform, dynamic templates, email validation API, advanced analytics |
| **Deliverability** | Good; extensive IP warming tools |
| **Support** | Paid support plans only at base tier |
| **Weakness** | No free tier, heavier SDK, older template system (Handlebars), reputation for degrading deliverability in recent years |

**Go App Fit**: Viable but over-engineered for initial scale. The lack of a free tier and older template system make it less attractive than Resend for a Next.js project.

#### Postmark — Best Deliverability

| Attribute | Detail |
|-----------|--------|
| **Pricing** | $15/mo base + $1.80 per 1,000 extra emails |
| **At 10K** | ~$1.50 per 1,000 emails |
| **At 300K** | ~$0.81 per 1,000 emails |
| **Features** | Separate transactional and marketing infrastructure (refuses to mix), message streams, inbound email processing, SMTP + API |
| **Deliverability** | Industry-leading — will reject customers whose use cases threaten sending reputation |
| **Weakness** | No JSX/React Email integration; template system is their own; higher cost per email at low volumes |

**Go App Fit**: Excellent deliverability, but the cost premium and non-React template system make it a secondary choice. Could be used as a fallback provider for critical transactional emails (password reset, account verification).

#### Amazon SES — Cheapest at Scale

| Attribute | Detail |
|-----------|--------|
| **Pricing** | $0.10 per 1,000 emails (flat rate) |
| **At 50M-100M** | Drops to ~$0.02 per 1,000 |
| **Free Tier** | 62,000/mo if sending from EC2 |
| **Features** | Raw SMTP/API, configuration sets, event publishing to SNS/CloudWatch, dedicated IPs ($24.95/mo each) |
| **Deliverability** | Good with proper configuration, but requires manual IP warming, domain verification, and deliverability monitoring |
| **Weakness** | No template management, no analytics dashboard, no React integration — you build everything yourself |

**Go App Fit**: Best for cost optimization at massive scale (50K+ MAU sending daily digests). Could serve as the underlying transport while Resend handles template rendering and DX. However, the operational overhead is significant for a small team.

### 1.2 Cost Comparison at Scale

| Volume/Month | Resend | SendGrid | Postmark | Amazon SES |
|-------------|--------|----------|----------|------------|
| **10,000** | Free | ~$20 | ~$15 | ~$1.00 |
| **50,000** | $20 | ~$20 | ~$75 | ~$5.00 |
| **100,000** | $90 | ~$35 | ~$135 | ~$10.00 |
| **500,000** | ~$350 | ~$100 | ~$405 | ~$50.00 |

### 1.3 Email Localization for Go App

Emails must support Korean, Japanese, English, and potentially Chinese. Key considerations:

| Challenge | Solution |
|-----------|----------|
| **CJK character rendering** | React Email handles UTF-8 natively; test across Gmail/Outlook/Naver Mail/Yahoo Japan |
| **Locale-aware content** | JSX templates accept `locale` prop → conditional rendering of Go terminology (기보/棋譜/game record) |
| **Date/time formatting** | `Intl.DateTimeFormat` in server-side rendering with user's timezone |
| **RTL support (future)** | React Email supports `dir="rtl"` for Arabic expansion |
| **Naver/Daum/Yahoo Japan** | Test rendering on Korean/Japanese email clients specifically — different CSS support |

### 1.4 Recommendation

**Primary: Resend** ($20/mo at 50K scale)
- React Email integration is a natural fit for Next.js 15
- JSX templates enable type-safe, locale-aware email rendering
- Free tier sufficient for MVP (3,000 emails/mo)
- Pay-as-you-go scaling eliminates waste

**Fallback (critical transactional): Postmark** for password resets and account verification if deliverability issues arise.

**Future (100K+ MAU): Amazon SES** as transport layer behind Resend's template rendering for cost optimization.

---

## 2. Push Notification Architecture

### 2.1 Provider Analysis

#### Firebase Cloud Messaging (FCM) — Free, Unlimited

| Attribute | Detail |
|-----------|--------|
| **Cost** | Completely free — unlimited pushes, unlimited devices |
| **Platforms** | Android, iOS, Web (via service workers) |
| **Features** | Topic messaging, device group messaging, upstream messaging, message scheduling |
| **Analytics** | Basic delivery/open metrics via Firebase Console |
| **Weakness** | Push-only (no email, SMS, in-app); no A/B testing built-in; no preference management; you build the notification center yourself |

#### OneSignal — Managed Push Service

| Attribute | Detail |
|-----------|--------|
| **Free Tier** | Unlimited mobile push, 10,000 web push subscribers, 10,000 emails |
| **Growth** | Starting $9-19/mo + per-channel usage |
| **Professional** | Up to 100K subscribers ~$309/mo |
| **Features** | Segmentation, A/B testing, in-app messaging, journeys (automation), intelligent delivery (send-time optimization) |
| **Weakness** | Per-channel pricing adds complexity; vendor lock-in; no self-hosted option |

#### Novu — Open-Source Notification Infrastructure

| Attribute | Detail |
|-----------|--------|
| **Self-Hosted** | Free (MIT license) — you pay infrastructure costs only |
| **Cloud Free** | Limited events |
| **Cloud Pro** | ~$25-30/mo for 25-30K events |
| **Cloud Team** | ~$250/mo for 250K events |
| **Architecture** | Node.js + TypeScript backend, MongoDB storage, Redis + BullMQ queues, WebSocket/Socket.io real-time |
| **Features** | Multi-channel (email, push, in-app, SMS, chat), drag-and-drop workflow builder, embeddable Inbox component (6 lines of code), user preferences API, digest notifications |
| **Key Advantage** | Unified notification layer across ALL channels — single API, single preference system |
| **Weakness** | Self-hosting requires DevOps expertise; MongoDB dependency adds complexity if your stack is PG-native |

### 2.2 Web Push (PWA) Implementation

As of 2026, every major browser fully supports core PWA APIs including service workers, Web App Manifest, and Web Push. Implementation requires:

```
Architecture:
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Next.js App │────▶│ Service Worker│────▶│  Push Manager   │
│  (Frontend)  │     │  (sw.js)     │     │  (Browser API)  │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                                          │
       │ VAPID Keys                               │ Subscription
       ▼                                          ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Node.js API │────▶│  web-push    │────▶│  Push Service   │
│  (Backend)   │     │  (npm lib)   │     │  (FCM/APNS)     │
└─────────────┘     └──────────────┘     └─────────────────┘
```

Key components:
1. **VAPID Keys**: Server-to-push-service authentication
2. **Service Worker**: Background script handling push events + notification display
3. **Push Subscription**: Browser's `pushManager.subscribe()` with VAPID public key
4. **web-push npm package**: Server-side encrypted payload delivery
5. **Workbox 7**: Integrates natively with Next.js build pipeline for SW management

### 2.3 Go App Notification Types

| Event | Channel(s) | Priority | Localization |
|-------|-----------|----------|-------------|
| **Your turn** (correspondence) | Push + In-app | High | "차례입니다" / "あなたの番です" / "Your turn" |
| **Game invitation** | Push + In-app + Email | High | Full template |
| **Game result** | In-app + Email (digest) | Medium | SGF link + result |
| **Tournament starting** | Push + In-app + Email | High | Time-zone aware |
| **Friend request** | In-app + Push | Medium | Username + avatar |
| **Club activity** | In-app + Email (digest) | Low | Weekly digest |
| **Rank change** | In-app + Push | Medium | "30급 → 29급" |
| **AI review ready** | In-app + Push | Medium | Link to analysis |
| **System announcement** | All channels | Varies | Full localization |

### 2.4 Recommendation

**Novu (self-hosted)** as the unified notification orchestration layer:
- Single API for all channels (email via Resend, push via FCM, in-app via WebSocket)
- Built-in preference management per user
- Digest notifications (batch "your club had 5 games today" into one notification)
- Workflow builder for complex notification logic
- MIT license, Node.js/TypeScript stack aligns with our architecture
- The MongoDB dependency is the main tradeoff — mitigate by treating it as an isolated service

**FCM** as the push transport (free, unlimited, cross-platform).

**Web Push via service workers** for PWA users (immediate, no app install required).

---

## 3. Internationalization (i18n)

### 3.1 Library Comparison

#### next-intl — Purpose-Built for Next.js App Router

| Attribute | Detail |
|-----------|--------|
| **NPM Downloads** | ~1.8M weekly (March 2026), 4x growth in 12 months |
| **Bundle Size** | ~2KB (translations rendered server-side add zero bytes to client) |
| **App Router Support** | Native — designed specifically for Next.js 13-15+ |
| **Server Components** | Full support — translations rendered server-side |
| **Routing** | Built-in locale-prefixed routing (`/en/play`, `/ko/play`, `/ja/play`) |
| **Middleware** | `createMiddleware()` handles locale detection (URL prefix → cookie → Accept-Language header) |
| **Navigation** | Lightweight wrappers around `Link`, `useRouter` — automatic locale handling |
| **TypeScript** | Full type safety for translation keys |
| **ICU MessageFormat** | Full support for plurals, dates, numbers, select |

#### react-i18next — General-Purpose React i18n

| Attribute | Detail |
|-----------|--------|
| **NPM Downloads** | ~8.9M weekly (includes all React apps, not just Next.js) |
| **Bundle Size** | ~8KB |
| **App Router Support** | Manual wiring required — no native Next.js integration |
| **Server Components** | Requires additional setup — not native |
| **Routing** | Manual implementation required |
| **Ecosystem** | Largest i18n ecosystem (i18next plugins, backends, formatters) |

#### FormatJS (react-intl) — ICU Standard

| Attribute | Detail |
|-----------|--------|
| **Bundle Size** | ~12KB |
| **Standard** | Strictest ICU MessageFormat compliance |
| **Weakness** | Heaviest bundle; less Next.js-specific tooling |

### 3.2 next-intl Architecture for Go App

```
app/
├── [locale]/
│   ├── layout.tsx          ← locale-aware root layout
│   ├── page.tsx            ← landing page
│   ├── play/
│   │   └── page.tsx        ← /en/play, /ko/play, /ja/play
│   ├── learn/
│   │   └── page.tsx        ← tutorials
│   ├── community/
│   │   └── page.tsx        ← forums, clubs
│   └── profile/
│       └── page.tsx        ← user profile
├── messages/
│   ├── en.json             ← English translations
│   ├── ko.json             ← Korean translations
│   ├── ja.json             ← Japanese translations
│   └── zh.json             ← Chinese translations
├── i18n/
│   ├── routing.ts          ← locale config + default locale
│   └── request.ts          ← per-request locale resolution
└── middleware.ts            ← next-intl middleware
```

**Routing configuration** (`i18n/routing.ts`):
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ko', 'ja', 'zh'],
  defaultLocale: 'en',
  localePrefix: 'always' // /en/play, /ko/play, etc.
});
```

**Middleware** handles automatic locale detection with priority:
1. URL prefix (`/ko/play`)
2. Cookie (previously detected locale)
3. `Accept-Language` header negotiation

### 3.3 Go-Specific Terminology Localization

Go/Baduk has a unique localization challenge: terminology originates from Chinese, was standardized through Japanese, and Korean has its own distinct terms. English often uses Japanese loanwords.

| English | Korean (한국어) | Japanese (日本語) | Chinese (中文) | Notes |
|---------|---------------|-----------------|---------------|-------|
| Go / Baduk | 바둑 | 碁 (go) / 囲碁 (igo) | 围棋 (wéiqí) | Game name varies by culture |
| Game record | 기보 (gibo) | 棋譜 (kifu) | 棋谱 (qǐpǔ) | SGF file representation |
| Joseki | 정석 (jeongseok) | 定石 (jōseki) | 定式 (dìngshì) | Established sequences |
| Haengma | 행마 (haengma) | 石の運び (ishi no hakobi) | 行棋 (xíngqí) | Stone movement patterns |
| Kyu | 급 (geup) | 級 (kyū) | 级 (jí) | Beginner rank |
| Dan | 단 (dan) | 段 (dan) | 段 (duàn) | Advanced rank |
| Atari | 단수 (dansu) | アタリ (atari) | 打吃 (dǎchī) | Last liberty |
| Ko | 패 (pae) | コウ (kō) | 劫 (jié) | Repeated capture |
| Seki | 빅 (bik) | セキ (seki) | 双活 (shuānghuó) | Mutual life |
| Tesuji | 수읽기/묘수 (myosu) | 手筋 (tesuji) | 手筋 (shǒujīn) | Clever technique |
| Fuseki | 포석 (poseok) | 布石 (fuseki) | 布局 (bùjú) | Opening |
| Endgame | 끝내기 (kkeutnaegi) | ヨセ (yose) | 收官 (shōuguān) | Endgame |

**Implementation approach**:
```json
// messages/ko.json
{
  "game": {
    "yourTurn": "{opponent}님과의 대국에서 회원님 차례입니다",
    "gameRecord": "기보",
    "rank": "{level}급",
    "rankDan": "{level}단",
    "result": {
      "win": "{winner}님이 {method}으로 승리했습니다",
      "byResignation": "불계",
      "byPoints": "{points}집 차이"
    }
  }
}
```

### 3.4 Date/Time/Number Formatting

next-intl uses the `Intl` API for locale-aware formatting:

| Format | English | Korean | Japanese |
|--------|---------|--------|----------|
| Date | Mar 10, 2026 | 2026년 3월 10일 | 2026年3月10日 |
| Time | 3:30 PM | 오후 3:30 | 15:30 |
| Duration | 45m 30s | 45분 30초 | 45分30秒 |
| Number | 1,500 | 1,500 | 1,500 |
| Komi | 6.5 points | 6.5집 | 6目半 |

### 3.5 RTL Support (Future)

For future Arabic expansion, next-intl supports `dir="rtl"` at the layout level. The Go board itself is direction-agnostic (grid-based), but UI elements (chat, menus, notifications) need mirroring.

### 3.6 Content Translation Workflow

```
Developer writes EN strings
        │
        ▼
┌─────────────────┐
│  messages/en.json │ ← Source of truth
└─────────────────┘
        │
        ▼ (CI/CD pipeline)
┌─────────────────┐
│  Translation     │ ← Crowdin / Lokalise / manual
│  Management      │
│  System (TMS)    │
└─────────────────┘
        │
        ▼
┌──────┬──────┬──────┐
│ko.json│ja.json│zh.json│ ← Auto-synced
└──────┴──────┴──────┘
```

**Recommended TMS**: Crowdin (free for open-source, $50/mo for teams) or Lokalise ($120/mo) — both have GitHub integration for auto-syncing translation files.

### 3.7 Recommendation

**next-intl** is the clear winner for this stack:
- Purpose-built for Next.js 15 App Router
- Server Component support eliminates i18n bundle bloat
- Built-in locale routing matches `/en/play`, `/ko/play` requirement
- 2KB bundle vs 8-12KB alternatives
- 1.8M weekly downloads with 4x YoY growth signals strong ecosystem commitment
- TypeScript-first with full ICU MessageFormat support

---

## 4. Community Features

### 4.1 Feature Assessment by Complexity

#### Tier 1: Low Complexity (Weeks 1-2)

**User Profiles with Game History**
- PostgreSQL tables: `users`, `games`, `game_participants`
- Display: rank progression chart, win/loss stats, recent games, favorite openings
- SGF game record viewer (already needed for core gameplay)
- Production examples: OGS profiles, Chess.com profiles, Lichess profiles

| Component | Implementation |
|-----------|---------------|
| Profile page | Next.js dynamic route `/[locale]/player/[username]` |
| Game history | PG query with pagination, filterable by opponent/result/date |
| Stats | Aggregate queries cached in Redis (win rate, avg game length, rank over time) |
| Avatar | Upload to S3/R2, crop/resize via Sharp |

**Leaderboards**
- Redis Sorted Sets (ZSETs) — purpose-built for rankings
- `ZADD leaderboard:global <elo> <userId>` — O(log N) insert/update
- `ZREVRANGE leaderboard:global 0 99` — top 100 in O(log N + 100)
- `ZREVRANK leaderboard:global <userId>` — user's rank in O(log N)
- Race conditions eliminated by Redis's single-threaded event loop

| Leaderboard Type | Redis Key Pattern | Update Trigger |
|-----------------|-------------------|----------------|
| Global ELO | `lb:global` | After each rated game |
| Country | `lb:country:{cc}` | After each rated game |
| Monthly | `lb:monthly:{YYYY-MM}` | After each rated game |
| Club | `lb:club:{clubId}` | After each rated game |
| Puzzle rating | `lb:puzzle` | After puzzle attempt |

#### Tier 2: Medium Complexity (Weeks 3-4)

**Friend System**

PostgreSQL schema (bidirectional friendship with request workflow):
```sql
CREATE TABLE friendships (
    user_id_1    INTEGER NOT NULL REFERENCES users(id),
    user_id_2    INTEGER NOT NULL REFERENCES users(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, accepted, blocked
    requested_by INTEGER NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id_1, user_id_2),
    CONSTRAINT ordered_ids CHECK (user_id_1 < user_id_2)
);
CREATE INDEX idx_friendships_user1 ON friendships(user_id_1, status);
CREATE INDEX idx_friendships_user2 ON friendships(user_id_2, status);
```

The `CHECK (user_id_1 < user_id_2)` constraint ensures each friendship is stored once, preventing duplicates and simplifying queries.

**Follow System** (separate from friendships — for watching strong players' games):
```sql
CREATE TABLE follows (
    follower_id  INTEGER NOT NULL REFERENCES users(id),
    following_id INTEGER NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);
```

**In-App Chat** (beyond game chat)
- Extend existing WebSocket infrastructure (already needed for game play)
- Direct messages between friends
- Channel-based chat for clubs
- Message persistence in PostgreSQL with Redis pub/sub for real-time delivery
- Moderation: content filtering, report system, mute/block

#### Tier 3: High Complexity (Weeks 5-6+)

**Club/Group/Dojo System**

Modeled after Chess.com clubs and baduk.club:

```sql
CREATE TABLE clubs (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    slug         VARCHAR(100) UNIQUE NOT NULL,
    description  TEXT,
    avatar_url   VARCHAR(500),
    owner_id     INTEGER NOT NULL REFERENCES users(id),
    is_public    BOOLEAN DEFAULT true,
    max_members  INTEGER DEFAULT 500,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE club_members (
    club_id      INTEGER NOT NULL REFERENCES clubs(id),
    user_id      INTEGER NOT NULL REFERENCES users(id),
    role         VARCHAR(20) NOT NULL DEFAULT 'member',  -- owner, admin, moderator, member
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (club_id, user_id)
);

CREATE TABLE club_tournaments (
    id           SERIAL PRIMARY KEY,
    club_id      INTEGER NOT NULL REFERENCES clubs(id),
    name         VARCHAR(200) NOT NULL,
    format       VARCHAR(30) NOT NULL,  -- round_robin, swiss, elimination
    time_control JSONB NOT NULL,
    status       VARCHAR(20) DEFAULT 'upcoming',
    starts_at    TIMESTAMPTZ NOT NULL,
    created_by   INTEGER NOT NULL REFERENCES users(id)
);
```

Features:
- Club creation with public/private visibility
- Club-only tournaments (like Chess.com)
- Club leaderboard (Redis ZSET `lb:club:{clubId}`)
- Club chat channel (WebSocket)
- Club announcements and news
- Inter-club matches (team battles, like Lichess)

**Forum/Discussion Board**

Two approaches:

| Approach | Pros | Cons |
|----------|------|------|
| **Discord as forum** | Zero development cost; existing community infrastructure; threaded discussions; moderation tools | Fragments user experience; requires Discord account; less control over UX |
| **In-app forum** | Integrated experience; full control; SEO benefits; game embedding | Significant development effort (2-4 weeks); moderation tooling needed |

**Recommendation**: Start with Discord integration (webhook + bot for game results, tournament announcements). Build lightweight in-app discussions in v2 if community outgrows Discord.

### 4.2 Discord Integration Architecture

Discord's Social SDK (launched March 2025) provides deep game integration:

| Feature | Implementation | Benefit |
|---------|---------------|---------|
| **Account Linking** | OAuth2 flow → link Discord ID to game account | Unified identity |
| **Webhooks** | POST game results, tournament updates to Discord channels | Automatic community engagement |
| **Bot** | discord.js v14+ Node.js bot for commands (`/rank`, `/challenge`, `/leaderboard`) | Interactive community |
| **Rich Presence** | Show "Playing Go — 15k vs 14k — Move 127" in Discord status | Organic discovery |
| **Provisional Accounts** | Players without Discord get limited Discord accounts managed by the game | Universal social layer |

**Measured impact** from Discord's integration partners (GDC 2026):
- **25% increase** in active game days for linked players
- **16% longer** session duration

**Note**: Discord's Social SDK currently supports C++, Unreal, and Unity. For a web/Node.js game, use the Discord API + discord.js + Webhooks instead of the native SDK. The OAuth2 and webhook functionality is fully available via REST API.

### 4.3 Production Examples from Go/Chess Platforms

| Platform | Community Features | Lessons |
|----------|-------------------|---------|
| **OGS** | Forums, game chat, groups, puzzles, joseki database, ELO-like rating | Strongest English Go community; forums are highly active; proves Go players want community |
| **Chess.com** | Clubs, tournaments, forums, friends, leaderboards, coaching, news | Gold standard for game community; club tournaments drive retention; 150M+ users |
| **Lichess** | Teams, arena/Swiss tournaments, forums, studies, TV, puzzles | Open-source; team battles are wildly popular; proves community features drive engagement |
| **Fox/Tygem** | Contact lists, messaging, game rooms, professional match viewing | Asian server model; strong spectating culture; ranking system is primary engagement driver |
| **Baduk.club** | Club registry, attendance tracking, tournament tool, map | Offline-online bridge; club identity matters in Go culture |

### 4.4 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Community moderation overwhelm | Medium | High | Automated content filtering + report queue + trusted user moderators |
| Chat abuse / toxicity | Medium | High | Profanity filter (CJK-aware), rate limiting, mute/block, temporary bans |
| Club feature bloat | Medium | Medium | Launch minimal (create/join/chat/leaderboard), iterate based on usage |
| Discord dependency | Low | Medium | Webhooks + OAuth2 are stable APIs; no proprietary SDK dependency |
| Friendship graph query performance | Low | Medium | Ordered ID constraint + proper indexing; Redis cache for friend lists |

---

## 5. Complete Communication Architecture

### 5.1 Unified Notification Service Layer

```
                    ┌──────────────────────────────────┐
                    │         Game Events               │
                    │  (move, result, tournament, rank)  │
                    └──────────────┬───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │     Event Bus (Redis Pub/Sub)      │
                    │  or BullMQ Job Queue               │
                    └──────────────┬───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │   Notification Dispatcher          │
                    │   (Novu Workflow Engine)            │
                    │                                    │
                    │  1. Check user preferences          │
                    │  2. Apply quiet hours               │
                    │  3. Apply frequency capping          │
                    │  4. Select template (per locale)     │
                    │  5. Route to channel(s)              │
                    └──────────┬────┬────┬────┬─────────┘
                               │    │    │    │
                    ┌──────────┘    │    │    └──────────┐
                    │               │    │               │
                    ▼               ▼    ▼               ▼
              ┌──────────┐  ┌─────────┐ ┌──────────┐ ┌──────────┐
              │   Email   │  │  Push   │ │  In-App  │ │ Discord  │
              │  (Resend) │  │  (FCM)  │ │  (WS)   │ │(Webhook) │
              └──────────┘  └─────────┘ └──────────┘ └──────────┘
```

### 5.2 Event-Driven Architecture

The notification system follows an Observer/Event-Driven pattern:

1. **Game Service** emits events: `game.move.made`, `game.finished`, `tournament.round.started`
2. **Redis Pub/Sub** or **BullMQ** distributes events to the notification worker
3. **Notification Dispatcher** (Novu):
   - Fetches user preferences from PostgreSQL
   - Checks quiet hours (user's local timezone)
   - Applies frequency caps (max 5 pushes/hour, max 1 email digest/day)
   - Selects localized template
   - Routes to appropriate channel(s)
4. **Channel Providers** deliver the notification:
   - Email → Resend API
   - Push → FCM (web + mobile)
   - In-App → WebSocket broadcast + persistent storage
   - Discord → Webhook POST

### 5.3 User Preference Storage (PostgreSQL)

```sql
CREATE TABLE notification_preferences (
    user_id          INTEGER PRIMARY KEY REFERENCES users(id),

    -- Channel toggles
    email_enabled    BOOLEAN DEFAULT true,
    push_enabled     BOOLEAN DEFAULT true,
    in_app_enabled   BOOLEAN DEFAULT true,
    discord_enabled  BOOLEAN DEFAULT false,

    -- Per-event preferences (JSONB for flexibility)
    event_channels   JSONB DEFAULT '{
        "game_your_turn":     ["push", "in_app"],
        "game_invitation":    ["push", "in_app", "email"],
        "game_result":        ["in_app", "email_digest"],
        "tournament_start":   ["push", "in_app", "email"],
        "friend_request":     ["in_app", "push"],
        "club_activity":      ["in_app", "email_digest"],
        "rank_change":        ["in_app", "push"],
        "ai_review_ready":    ["in_app", "push"],
        "system_announcement":["in_app", "email", "push"]
    }',

    -- Quiet hours (user's local timezone)
    quiet_hours_start TIME,          -- e.g., 22:00
    quiet_hours_end   TIME,          -- e.g., 08:00
    timezone          VARCHAR(50) DEFAULT 'UTC',

    -- Frequency caps
    max_push_per_hour  INTEGER DEFAULT 10,
    email_digest_time  TIME DEFAULT '09:00',    -- daily digest delivery time

    -- Language
    preferred_locale   VARCHAR(5) DEFAULT 'en',

    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscription storage
CREATE TABLE push_subscriptions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    endpoint        TEXT NOT NULL,
    p256dh_key      TEXT NOT NULL,
    auth_key        TEXT NOT NULL,
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- In-app notification storage
CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    data            JSONB,           -- action URL, game ID, etc.
    is_read         BOOLEAN DEFAULT false,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id, created_at DESC) WHERE NOT is_read;
```

### 5.4 Template Management

Templates organized by: language x channel x event type.

```
templates/
├── email/
│   ├── en/
│   │   ├── game-invitation.tsx     ← React Email component
│   │   ├── game-result.tsx
│   │   ├── tournament-reminder.tsx
│   │   └── weekly-digest.tsx
│   ├── ko/
│   │   ├── game-invitation.tsx
│   │   └── ...
│   └── ja/
│       └── ...
├── push/
│   ├── en.json                     ← Push title/body strings
│   ├── ko.json
│   └── ja.json
└── in-app/
    ├── en.json
    ├── ko.json
    └── ja.json
```

### 5.5 Analytics

| Metric | Source | Storage |
|--------|--------|---------|
| Email open rate | Resend webhook (`email.opened`) | PostgreSQL analytics table |
| Email click rate | Resend webhook (`email.clicked`) | PostgreSQL analytics table |
| Push delivery rate | FCM delivery receipts | PostgreSQL analytics table |
| Push open rate | Service worker `notificationclick` event | PostgreSQL analytics table |
| In-app read rate | `PATCH /notifications/:id/read` | Derived from `notifications` table |
| Notification preference changes | API audit log | PostgreSQL |
| Unsubscribe rate | Email unsubscribe link + preference API | PostgreSQL |

**2025 Industry Benchmarks**:
- Average email open rate: **43.46%**
- Average email click rate: **2.09%**
- Average click-to-open rate: **6.81%**
- Gaming vertical tends to outperform due to high-intent users

### 5.6 A/B Testing Notifications

Implement via Novu's workflow variants or custom implementation:

1. **Subject line testing**: "Your game with {opponent} is complete" vs "You won by {points} points!"
2. **Send time optimization**: Morning (09:00 local) vs evening (19:00 local) for digest emails
3. **Channel preference**: Push vs email for tournament reminders (measure which drives higher attendance)
4. **Frequency**: Daily digest vs real-time individual notifications

Requirements:
- Minimum 1,000 recipients per variant for statistical significance
- Track one primary metric per test (open rate, click-through, game re-engagement)
- Run for 7+ days to account for day-of-week variance

---

## 6. Recommended Stack & 6-Week Implementation Plan

### 6.1 Recommended Complete Communication Stack

| Layer | Technology | Cost | Justification |
|-------|-----------|------|---------------|
| **Notification Orchestration** | Novu (self-hosted) | Infrastructure only (~$20-40/mo) | Unified multi-channel, user preferences, digest, MIT license, Node.js native |
| **Email** | Resend | Free → $20/mo → $90/mo | React Email DX, JSX templates, Next.js native |
| **Push** | FCM + web-push | Free | Unlimited, cross-platform, industry standard |
| **In-App** | Custom (WebSocket + PG) | Included in infra | Reuse existing game WebSocket; persistent storage in PG |
| **Discord** | discord.js + Webhooks | Free | Community bridge, OAuth2 linking, Rich Presence |
| **i18n** | next-intl | Free (OSS) | Purpose-built for Next.js 15, 2KB, Server Components, locale routing |
| **Leaderboards** | Redis Sorted Sets | Included in Redis | O(log N) operations, race-condition-free, purpose-built for rankings |
| **Translation Mgmt** | Crowdin | Free (OSS) / $50/mo | GitHub sync, community translation support |

### 6.2 Six-Week Implementation Plan

#### Week 1-2: Email + Web Push + In-App Notifications

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Set up Resend account + DKIM/SPF/DMARC for domain | Verified sending domain |
| 2-3 | Build React Email templates: welcome, game invitation, game result, password reset | 4 email templates (EN) |
| 3-4 | Implement notification preference schema (PG migration) | `notification_preferences`, `push_subscriptions`, `notifications` tables |
| 4-5 | Set up service worker + web-push for PWA push notifications | VAPID keys, SW registration, push subscription flow |
| 5-7 | Build notification dispatcher service (BullMQ worker) | Event → preference check → channel routing |
| 7-8 | In-app notification inbox UI component | Bell icon + dropdown + unread count badge |
| 9-10 | Wire game events to notification dispatcher | "Your turn", "Game finished", "Invitation received" notifications working E2E |
| 10 | Resend webhook integration for email analytics | Open/click tracking stored in PG |

**Milestone**: Users receive email + push + in-app notifications for core game events.

#### Week 3: i18n Setup + 3 Languages

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Install and configure next-intl with App Router | Middleware, routing, `[locale]` layout |
| 2-3 | Extract all UI strings to `messages/en.json` | Complete EN translation file |
| 3-4 | Create Korean translations (`messages/ko.json`) — Go terminology glossary | Full KO translation |
| 4-5 | Create Japanese translations (`messages/ja.json`) — Go terminology glossary | Full JA translation |
| 5 | Localize email templates (KO + JA) | 4 templates x 3 languages = 12 templates |
| 5 | Localize push notification strings | Push title/body in 3 languages |
| 5 | Date/time/number formatting per locale | `Intl.DateTimeFormat` + `Intl.NumberFormat` |

**Milestone**: Full app available in EN, KO, JA with locale-prefixed URLs.

#### Week 4: Discord Integration + Community Basics

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Discord OAuth2 account linking | Link/unlink Discord in user settings |
| 2-3 | Discord bot (discord.js) — `/rank`, `/challenge`, `/leaderboard` commands | Functional Discord bot |
| 3 | Discord webhooks for game results + tournament updates | Auto-post to #game-results channel |
| 4 | Friend system (PG schema + API + UI) | Send/accept/decline/block friend requests |
| 5 | Leaderboard system (Redis ZSETs + API + UI) | Global, country, monthly leaderboards |

**Milestone**: Discord community bridge operational; friends and leaderboards live.

#### Week 5: User Profiles + Club System

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | User profile pages with game history + stats | `/[locale]/player/[username]` with win rate, rank chart, recent games |
| 2-3 | Follow system (watch strong players' games) | Follow/unfollow + notification on followed player's games |
| 3-4 | Club creation + management (PG schema + API + UI) | Create/join/leave clubs, member list, club chat |
| 5 | Club leaderboard + basic club tournaments | Club-scoped ranking, simple round-robin tournament |

**Milestone**: Full social graph (friends, follows, clubs) operational.

#### Week 6: Advanced Features (Preferences, Analytics, A/B)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Notification preference UI (per-event channel toggles, quiet hours, timezone) | User-facing preferences page |
| 2-3 | Email digest system (daily/weekly batched notifications) | Configurable digest with game summaries |
| 3-4 | Notification analytics dashboard (open rates, click rates, channel effectiveness) | Admin dashboard |
| 4-5 | A/B testing framework for notification content | Subject line variants, send-time optimization |
| 5 | Frequency capping + quiet hours enforcement | Rate limiting per channel, timezone-aware quiet periods |

**Milestone**: Full communication system with user control and analytics.

### 6.3 Monthly Cost at Different Scales

| Component | 8K MAU | 25K MAU | 50K MAU |
|-----------|--------|---------|---------|
| **Resend** (email) | Free (3K emails) | $20/mo (50K emails) | $90/mo (100K emails) |
| **FCM** (push) | Free | Free | Free |
| **Novu** (self-hosted) | Infrastructure: ~$20/mo (small VM + MongoDB) | ~$30/mo | ~$50/mo |
| **Redis** (leaderboards, queues) | Shared with game server | Shared | ~$30/mo dedicated |
| **Discord Bot** | Free (hosted on app server) | Free | Free |
| **Crowdin** (translation) | Free (OSS) | $50/mo | $50/mo |
| **Infrastructure** (notification worker) | Shared Node.js process | Dedicated worker: ~$20/mo | 2 workers: ~$40/mo |
| **TOTAL** | **~$20/mo** | **~$120/mo** | **~$260/mo** |

### 6.4 Why This Investment Pays Off for Retention

1. **Communication drives DAU**: Push notifications for "your turn" in correspondence games are the #1 re-engagement tool. Without them, correspondence games die.

2. **Community is the moat**: Go/Baduk has a tight-knit global community. Clubs, friends, and leaderboards create social obligations that keep players returning. Chess.com's 150M+ users prove that community features are the primary differentiator over raw gameplay.

3. **i18n unlocks markets**: Korean Go market (한국기원 ecosystem) and Japanese Go market (日本棋院 ecosystem) are massive but expect native-language experiences. English-only caps addressable market at ~30% of the global Go community.

4. **Discord integration is free leverage**: Go communities already exist on Discord. Bridging game events to Discord provides free distribution and social proof. The measured 25% increase in active days from Discord linking (per Discord's GDC 2026 data) applies directly.

5. **Notification preferences reduce churn**: Users who can control notification frequency and channels stay longer than those who get spammed or go silent. The preference system is a retention tool, not just a compliance checkbox.

6. **Cost efficiency**: The entire communication stack costs $20-260/mo depending on scale — less than a single engineer-hour per month. FCM is free, Novu is self-hosted (MIT), Resend's free tier covers MVP. The ROI on even modest retention improvement (1-2% churn reduction) far exceeds these costs.

---

## Sources

### Email Platform
- [Email API Pricing Comparison (February 2026)](https://www.buildmvpfast.com/api-costs/email)
- [Easy and Cost-Effective Transactional Email APIs Compared (2025)](https://www.pingram.io/blog/transactional-email-apis)
- [Email APIs in 2025: SendGrid vs Resend vs AWS SES](https://medium.com/@nermeennasim/email-apis-in-2025-sendgrid-vs-resend-vs-aws-ses-a-developers-journey-8db7b5545233)
- [7 Best Transactional Email Services Compared (2026)](https://mailtrap.io/blog/transactional-email-services/)
- [Transactional Email Providers Compared (2025) — Postmark](https://postmarkapp.com/blog/transactional-email-providers)
- [Resend Pricing](https://resend.com/pricing)
- [Resend Pricing Guide 2025](https://flexprice.io/blog/detailed-resend-pricing-guide)
- [Amazon SES Pricing 2026](https://blog.campaignhq.co/amazon-ses-pricing/)
- [Postmark Pricing Analysis (2026)](https://www.sender.net/reviews/postmark/pricing/)
- [13 Best Transactional Email Services (2026)](https://www.emailtooltester.com/en/blog/best-transactional-email-service/)

### Push Notifications
- [Top 12 Push Notification Platforms (2026) — Courier](https://www.courier.com/blog/top-push-notification-platforms)
- [Top 7 Push Notification Providers (2025) — Courier](https://www.courier.com/blog/top-7-push-notification-providers-in-2025)
- [Firebase vs OneSignal (2026) — Ably](https://ably.com/compare/firebase-vs-onesignal)
- [Push Notifications at Scale: FCM vs OneSignal](https://www.sashido.io/en/blog/choosing-a-push-notification-stack-fcm-vs-onesignal)
- [OneSignal Pricing](https://onesignal.com/pricing)
- [OneSignal Pricing Guide (2025)](https://www.oreateai.com/blog/navigating-onesignal-pricing-in-2025-your-guide-to-push-notification-costs/2d0c9a4b1072606ebc7b3f3b76f1e789)

### Novu
- [Novu GitHub — Open-Source Notification Infrastructure](https://github.com/novuhq/novu)
- [What is Novu? — Documentation](https://docs.novu.co/platform/what-is-novu)
- [Novu Pricing](https://novu.co/pricing/)
- [Novu Self-Hosting Overview](https://docs.novu.co/community/self-hosting-novu/overview)
- [5 Best Notification Infrastructure Services (2025)](https://dub.co/blog/best-notification-infrastructure-services)

### i18n
- [next-intl Complete Guide 2026](https://intlpull.com/blog/next-intl-complete-guide-2026)
- [next-intl App Router Getting Started](https://next-intl.dev/docs/getting-started/app-router)
- [next-intl Routing Setup](https://next-intl.dev/docs/routing/setup)
- [next-intl Middleware](https://next-intl.dev/docs/routing/middleware)
- [i18next vs next-intl](https://i18nexus.com/posts/i18next-vs-next-intl)
- [Internationalization in React: Complete Guide 2026](https://www.glorywebs.com/blog/internationalization-in-react)
- [React Email i18n Issue #431](https://github.com/resend/react-email/issues/431)
- [@languine/react-email — npm](https://www.npmjs.com/package/@languine/react-email)

### Community / Discord
- [Discord Social SDK Announcement](https://discord.com/press-releases/announcing-discords-social-sdk-helping-power-your-games-social-experiences)
- [Discord Social SDK Documentation](https://discord.com/developers/docs/social-sdk/index.html)
- [Building on the Social Layer of Games — GDC 2026](https://discord.com/blog/building-on-the-social-layer-of-games-whats-new-from-gdc-2026)
- [How Games Integrate Discord-Powered Features](https://support.discord.com/hc/en-us/articles/27893392334359-How-Games-Integrate-Discord-Powered-Features)
- [discord.js Documentation](https://discord.js.org/)

### Go/Baduk Community
- [Online Go Servers — GoMagic](https://gomagic.org/online-go-servers/)
- [Weiqi/Baduk Online Resources 2026](https://weiqi.soumyak4.in/posts/weiqi-resources/)
- [Korean Go Terms — Sensei's Library](https://senseis.xmp.net/?KoreanGoTerms=)
- [List of Go Terms — Wikipedia](https://en.wikipedia.org/wiki/List_of_Go_terms)
- [Baduk.club](https://baduk.club/welcome)
- [Korea Baduk Association](http://english.baduk.or.kr/sub04_01.htm?menu=f14)

### Architecture
- [Designing Real-Time Leaderboards: Redis Sorted Sets](https://systemdr.substack.com/p/designing-real-time-leaderboards)
- [Redis Leaderboard Solutions](https://redis.io/solutions/leaderboards/)
- [Leaderboard System Design](https://systemdesign.one/leaderboard-system-design)
- [Building Notification Service with Observer Pattern — Node.js](https://medium.com/@o.muhammetcorduk/building-a-notification-service-with-observer-pattern-in-node-js-and-typescript-9dfc27269755)
- [Event-Driven Architecture in Node.js](https://oneuptime.com/blog/post/2026-01-30-nodejs-event-driven-architecture/view)
- [User Friends System & Database Design](https://www.coderbased.com/p/user-friends-system-and-database)
- [Social Friend Relationship System in PostgreSQL](https://dzone.com/articles/social-friend-relationship-system-practice-in-post)

### Web Push / PWA
- [Using Push Notifications in PWAs — MagicBell](https://www.magicbell.com/blog/using-push-notifications-in-pwas)
- [Push Notifications in React PWAs (2026)](https://oneuptime.com/blog/post/2026-01-15-push-notifications-react-pwa/view)
- [Progressive Web Apps 2026 Guide](https://www.digitalapplied.com/blog/progressive-web-apps-2026-pwa-performance-guide)
- [MDN — Notifications and Push APIs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push)

### Analytics / A/B Testing
- [Email Marketing Benchmarks 2025 — MailerLite](https://www.mailerlite.com/blog/compare-your-email-performance-metrics-industry-benchmarks)
- [A/B Testing for Email Campaigns (2026)](https://monday.com/blog/monday-campaigns/email-ab-testing/)
- [2025 Email Open & Click Rates](https://www.accio.com/business/email_open_and_click_rates_benchmarks_and_trends)
