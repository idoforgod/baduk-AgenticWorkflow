# Research 4: Analytics & Data — Minimal (Self-hosted, Minimal Dependencies)

> **Branch Perspective**: "Every external service is a dependency that can fail, cost money, and leak data. Self-host what you can."
> **Research Date**: 2026-03-10
> **Context**: Go (Baduk) app — Next.js 15, Node.js 22 LTS, PG 16, Redis 7.2, Hetzner+Coolify. MAU 8K, budget $80-260/mo.

---

## Table of Contents

1. [Umami Analytics (Deep Dive)](#1-umami-analytics)
2. [Error Monitoring — Self-hosted](#2-error-monitoring)
3. [Go Game Data Sources](#3-go-game-data-sources)
4. [CDN & Static Assets — Cloudflare Free Tier](#4-cdn-static-assets)
5. [Backup & Data Strategy](#5-backup-data-strategy)
6. [Conclusion: Recommended Minimal Stack](#conclusion)

---

## <a id="1-umami-analytics"></a>1. Umami Analytics (Deep Dive — Privacy-First, Self-Hosted)

### Current State

Umami v3 (released November 2025) is the leading open-source, privacy-first analytics platform. It now exclusively supports PostgreSQL (dropped MySQL), making it a natural fit for our PG 16 stack. The v3 release introduced a redesigned interface, cohort analysis, advanced segmentation, link tracking, and pixel tracking for email/non-JS environments.

### Alternatives Compared

| Feature | Umami v3 | Plausible | Matomo |
|---------|----------|-----------|--------|
| **License** | MIT | AGPL-3.0 | GPL-3.0 |
| **Tracking Script** | ~2 KB | ~1 KB | ~23 KB |
| **Database** | PostgreSQL only | PostgreSQL + ClickHouse | MySQL/MariaDB |
| **RAM Usage** | ~200-450 MB | ~1-2 GB (ClickHouse) | ~2-4 GB |
| **Min Server** | 1 vCPU, 1 GB RAM | 2 vCPU, 4 GB RAM | 2 vCPU, 4 GB RAM |
| **Docker Complexity** | 2 containers (app + PG) | 4+ containers (incl. ClickHouse) | 3+ containers |
| **Custom Events** | Yes — `umami.track()` | Yes | Yes (verbose) |
| **Funnels** | v3: Yes | Yes (paid cloud) | Yes |
| **Cohorts** | v3: Yes | No | Yes |
| **Cookie-free** | Yes | Yes | Configurable |
| **GDPR Compliant** | By default | By default | Configurable |
| **Self-host Cost** | $0 | $0 | $0 |
| **Capacity (1 vCPU)** | ~100K pageviews/mo | ~50K pageviews/mo | ~30K pageviews/mo |

### Why Umami Wins for This Project

1. **Shares PG 16**: Umami v3 is PostgreSQL-only — we can reuse our existing PG 16 instance (separate database), eliminating any additional database overhead
2. **Lightest resource footprint**: ~200-450 MB RAM, ~1% CPU — fits comfortably on the same Hetzner server running the Go app
3. **MAU 8K headroom**: At 8K MAU with ~10 pageviews/session, we expect ~80K pageviews/month — well within the 100K capacity on a 1 vCPU setup
4. **v3 feature parity**: Cohorts, segments, funnels — enough for subscription conversion tracking without paid tools

### Implementation for Go App

**Next.js Integration (App Router)**:

```tsx
// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src="/stats/script.js"
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**next.config.js proxy** (avoids ad-blockers):

```js
async rewrites() {
  return [
    { source: '/stats/:path*', destination: 'https://umami.yourdomain.com/:path*' }
  ];
}
```

**Go App Custom Events**:

```typescript
// Game events
umami.track('game-started', { mode: 'ranked', boardSize: 19 });
umami.track('game-completed', { result: 'B+3.5', duration: 1800 });

// Analysis events
umami.track('analysis-requested', { source: 'game-review', engine: 'katago' });
umami.track('puzzle-attempted', { difficulty: 'dan', solved: true });

// Subscription funnel
umami.track('pricing-viewed');
umami.track('trial-started', { plan: 'premium' });
umami.track('subscription-converted', { plan: 'premium', period: 'annual' });
```

**Docker Compose** (co-located with app):

```yaml
umami:
  image: ghcr.io/umami-software/umami:postgresql-latest
  environment:
    DATABASE_URL: postgresql://umami:password@db:5432/umami
    APP_SECRET: ${UMAMI_SECRET}
  ports:
    - "3001:3000"
  restart: unless-stopped
  # Shares the existing PG 16 container — just create a separate 'umami' database
```

### Monthly Cost

**$0** — Runs on existing Hetzner server, shares existing PG 16 instance.

### Self-Hosting Trade-offs

| Advantage | Trade-off |
|-----------|-----------|
| No data leaves your server | You manage updates (minor — Docker pull) |
| No cookie consent banners needed | No real-time collaborative dashboards (solo founder OK) |
| Zero recurring cost | No built-in A/B testing (use custom events instead) |
| Full data ownership | Must manually set up data retention/cleanup |

---

## <a id="2-error-monitoring"></a>2. Error Monitoring — Self-Hosted

### Current State

The error monitoring landscape for self-hosted setups has matured significantly. Three tiers exist: full observability platforms (Sentry self-hosted), lightweight alternatives (GlitchTip, Bugsink), and DIY structured logging.

### Alternatives Compared

| Feature | Sentry Self-Hosted | GlitchTip | Bugsink | DIY (Pino + PG) |
|---------|-------------------|-----------|---------|------------------|
| **Architecture** | 12+ Docker containers | 4 containers | 1 container | In-app |
| **RAM Required** | 8-16 GB | 2-4 GB | 512 MB - 1 GB | 0 (app memory) |
| **Sentry SDK Compatible** | Native | Yes (drop-in) | Yes (drop-in) | No |
| **Stack Traces** | Full | Full | Full | Manual |
| **Error Grouping** | AI-powered | Basic | Basic | Manual |
| **Performance Monitoring** | Yes | Yes | No | Manual |
| **Session Replay** | Yes | No | No | No |
| **Uptime Monitoring** | No | Yes | No | No |
| **Setup Complexity** | High | Medium | Very Low | Low |
| **Maintenance** | Heavy | Moderate | Minimal | Minimal |
| **License** | BSL-1.1 | MIT | Non-competing | N/A |

### Recommendation: Bugsink + Pino Structured Logging

For MAU 8K, a full Sentry deployment is overkill. The recommended approach is a two-layer strategy:

**Layer 1 — Pino Structured Logging (primary)**:
- JSON structured logs with correlation IDs
- Log levels: fatal, error, warn, info, debug, trace
- Pino transports to write error-level logs to a PG table
- 5x faster than Winston, minimal CPU/memory overhead
- Built-in redaction for sensitive data (passwords, tokens)

**Layer 2 — Bugsink (error aggregation)**:
- Single Docker container, SQLite by default
- Sentry SDK compatible — just change the DSN
- Handles 30 events/second on 2 vCPU / 4 GB RAM
- Stack traces, error grouping, metadata
- Minimal maintenance

### Implementation for Go App

**Pino Setup (Next.js)**:

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password'],
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

// Game-specific child loggers
export const gameLogger = logger.child({ module: 'game' });
export const analysisLogger = logger.child({ module: 'analysis' });
export const authLogger = logger.child({ module: 'auth' });
```

**Error-to-PG Transport** (for querying/dashboard):

```typescript
// lib/pg-error-transport.ts
import { Transform } from 'stream';

// Write error+ level logs to PG for retention & querying
// Table: error_logs (id, timestamp, level, module, message, stack, metadata)
// Cron: DELETE FROM error_logs WHERE timestamp < NOW() - INTERVAL '30 days'
```

**Bugsink Docker Compose**:

```yaml
bugsink:
  image: bugsink/bugsink:latest
  environment:
    BUGSINK_SECRET_KEY: ${BUGSINK_SECRET}
    PORT: 8000
  volumes:
    - bugsink-data:/data
  ports:
    - "8000:8000"
  restart: unless-stopped
  # Uses SQLite internally — no external DB needed
```

**Discord Webhook Alerts**:

```typescript
// lib/error-alert.ts
async function alertDiscord(error: Error, context: Record<string, unknown>) {
  if (process.env.DISCORD_WEBHOOK_URL) {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `🚨 ${error.name}: ${error.message.slice(0, 100)}`,
          color: 0xff0000,
          fields: [
            { name: 'Module', value: context.module || 'unknown', inline: true },
            { name: 'User', value: context.userId || 'anonymous', inline: true },
            { name: 'Stack', value: `\`\`\`${error.stack?.slice(0, 500)}\`\`\`` },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  }
}
```

### Monthly Cost

**$0** — Bugsink runs in a single container on existing server. Pino is an npm dependency. Discord webhooks are free.

### Is Full Error Monitoring Necessary at MAU 8K?

**No, but basic error aggregation is.** At 8K MAU:
- Expected error volume: ~50-200 errors/day (typical for early-stage apps)
- Bugsink handles this trivially (rated for 2.5M events/day)
- Stack traces + grouping prevent the same bug from being investigated twice
- Graduate to GlitchTip or Sentry Cloud when approaching MAU 50K+

---

## <a id="3-go-game-data-sources"></a>3. Go Game Data Sources (Content/Puzzles)

### Current State

Multiple public and semi-public SGF databases exist. The Go community has a strong culture of sharing game records, but commercial databases (GoGoD, SmartGo) have licensing restrictions.

### Data Sources Compared

| Source | Games | Coverage | License/Access | Download | Quality |
|--------|-------|----------|----------------|----------|---------|
| **CWI Japanese Pro Games** | 88,888+ | Japanese pro, up to 2025 | Public domain | .tar.gz (45 MB) / .7z (27 MB) | High (curated) |
| **Badukmovies Pro Games** | 115,623 | International pro | Public domain | Bulk download | High |
| **GoKifu** | 2000-2026 | Mixed pro/amateur | Free access | Per-game | Medium-High |
| **Go4Go** | Large | International pro | Free w/ daily limits | Limited bulk | High |
| **OGS Public Games** | Millions | Community/amateur | Public API | API + tools | Variable |
| **GoGoD** | 136,000+ | Comprehensive pro | Commercial ($) | Paid subscription | Highest |
| **SmartGo** | 108,000+ | Pro collection | Commercial ($) | Paid software | Highest |
| **KGS Archives** | Large | Community/amateur | Public | Bulk archives | Variable |

### Legal Considerations

1. **Game moves are not copyrightable**: The sequence of moves in a Go game is considered factual data (similar to chess notation). This is a widely accepted position in the Go community.
2. **Commentary IS copyrightable**: Professional commentary, annotations, and analysis added to SGF files are protected by copyright.
3. **Database compilation rights**: Some jurisdictions (EU) grant database rights to the compiler, even if individual records are public domain.
4. **Safe approach**: Use public domain collections (CWI, Badukmovies) as the foundation. Strip any commentary from sourced files. Attribute sources.

### Recommended Data Pipeline

**Phase 1 — Seed Database (Week 1-2)**:
```
CWI Archive (88K games) + Badukmovies (115K games)
  → Deduplicate by game hash
  → Parse with @sabaki/sgf or ts-sgf-parser
  → Store metadata in PG: players, date, result, event, opening
  → Store SGF files in Cloudflare R2
  → Expected unique games: ~120-150K
```

**Phase 2 — Puzzle Generation (Week 3-4)**:
```
Select games with clear mistakes (>5 point swing per KataGo)
  → Run KataGo analysis on key positions
  → Extract positions where:
    - Best move vs played move differs by >5 points
    - Solution is unique (one clearly best move)
    - Position is not too complex (< 3 good alternatives)
  → Tag with difficulty: beginner / SDK / dan / pro
  → Expected puzzles: ~5,000-10,000 from initial corpus
```

**Phase 3 — Ongoing Enrichment**:
```
GoKifu scraper (respectful, 1 req/5s)
  → Weekly cron for new pro games
  → ~50-100 new games/week
  → Puzzle generation pipeline on new games
```

### SGF Parser Selection

| Library | TypeScript | Maintained | Features | Stars |
|---------|-----------|------------|----------|-------|
| **@sabaki/sgf** | Yes | Active | Full SGF R/W, tree manipulation | ~100+ |
| **ts-sgf-parser** | Native TS | Active | Parse + type safety | Recent |
| **smartgame** | JS | Moderate | Parse + serialize | ~50 |

**Recommendation**: `@sabaki/sgf` — most mature, from the Sabaki Go editor project, handles edge cases in SGF format well, and has proper tree manipulation for extracting game positions.

### Monthly Cost

**$0** — Public domain data, self-processed. KataGo runs locally (CPU mode sufficient for analysis, though slow). R2 storage for SGF files: ~150K files at ~5 KB each = ~750 MB = well within R2 free tier (10 GB).

---

## <a id="4-cdn-static-assets"></a>4. CDN & Static Assets — Cloudflare Free Tier

### Current State

Cloudflare's free tier is remarkably generous and provides enterprise-grade CDN, DDoS protection, DNS, and SSL at zero cost. For a budget-conscious Go app, this is the single highest-value free service available.

### What Cloudflare Free Provides

| Feature | Free Tier Limit | Our Usage (MAU 8K) |
|---------|----------------|---------------------|
| **CDN Bandwidth** | Unlimited* | ~50-100 GB/mo |
| **DDoS Protection** | Unlimited | Essential |
| **DNS** | Unlimited queries | Minimal |
| **SSL/TLS** | Full (strict) | 1 domain |
| **WAF Rules** | 5 custom rules | 3-4 rules |
| **Page Rules** | 3 rules | 2-3 rules |
| **Cache** | 512 MB per file | Sufficient |
| **Workers** | 100K req/day | Optional |
| **R2 Storage** | 10 GB, free egress | SGF + backups |
| **Analytics** | Basic (72hr) | Supplementary |

*Cloudflare requires >50% of requests be for HTML content (reasonable use policy).

### Caching Strategy for Go App

**Tier 1 — Immutable Assets** (cache forever):
```
/_next/static/*  → Cache-Control: public, max-age=31536000, immutable
/fonts/*          → Cache-Control: public, max-age=31536000, immutable
/images/board/*   → Cache-Control: public, max-age=31536000, immutable
/images/stones/*  → Cache-Control: public, max-age=31536000, immutable
```

**Tier 2 — Semi-static** (cache with revalidation):
```
/sgf/*.sgf        → Cache-Control: public, max-age=86400, s-maxage=604800
/api/puzzles/*    → Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
/api/openings/*   → Cache-Control: public, s-maxage=86400
```

**Tier 3 — Dynamic** (no CDN cache):
```
/api/games/live/* → Cache-Control: no-store
/api/auth/*       → Cache-Control: no-store
/api/user/*       → Cache-Control: private, no-cache
```

**Go Board Assets**:
- Board textures (wood grain SVGs): ~50 KB total, cache forever
- Stone SVGs: ~10 KB total, cache forever
- Board position renders (if server-side): cache by position hash

### Cloudflare R2 for Object Storage

**Use Cases**:
1. **SGF file storage**: ~750 MB for 150K games (within 10 GB free tier)
2. **PG backup storage**: Daily pg_dump compressed ~50-200 MB (within free tier)
3. **User-uploaded SGFs**: Minimal at MAU 8K
4. **KataGo analysis cache**: Serialized analysis results

**R2 Pricing (beyond free tier)**:
- Storage: $0.015/GB/month
- Class A operations (writes): $4.50/million
- Class B operations (reads): $0.36/million
- Egress: **$0** (always free)

At our scale, total R2 cost should remain at **$0/month** within the 10 GB free tier.

### Implementation

**DNS Setup**:
```
Type  Name           Content              Proxy
A     @              <hetzner-ip>         Proxied (orange cloud)
A     umami          <hetzner-ip>         Proxied
CNAME www            @                    Proxied
```

**Cloudflare Page Rules** (free tier: 3 rules):
1. `*yourdomain.com/_next/static/*` → Cache Level: Cache Everything, Edge TTL: 1 month
2. `*yourdomain.com/api/games/live/*` → Cache Level: Bypass
3. `*yourdomain.com/sgf/*` → Cache Level: Cache Everything, Edge TTL: 1 week

### Monthly Cost

**$0** — Everything fits within Cloudflare's free tier at MAU 8K.

### Trade-offs

| Advantage | Trade-off |
|-----------|-----------|
| Enterprise CDN for free | Limited to 3 page rules (free tier) |
| Global edge network (~300 cities) | No image optimization (requires Pro $20/mo) |
| Always-on DDoS protection | 5 custom WAF rules only |
| Free SSL with Full Strict mode | No custom cache keys (requires Business) |
| R2: S3-compatible, zero egress | 10 GB free storage limit |

---

## <a id="5-backup-data-strategy"></a>5. Backup & Data Strategy

### Current State

Coolify (our deployment platform on Hetzner) has built-in database backup capabilities with S3-compatible storage support. Combined with WAL archiving and Cloudflare R2, we can build a robust backup strategy at near-zero cost.

### Backup Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Hetzner Server                     │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │
│  │  PG 16   │───▶│ WAL-G    │───▶│ Local Backup  │  │
│  │ (primary)│    │ archiver │    │ /backups/      │  │
│  └──────────┘    └──────────┘    └───────┬───────┘  │
│       │                                   │          │
│       │ pg_dump (Coolify)                │ sync     │
│       ▼                                   ▼          │
│  ┌──────────┐                   ┌───────────────┐   │
│  │ Coolify  │                   │ Cloudflare R2 │   │
│  │ Backup   │──────────────────▶│ (offsite)     │   │
│  │ Manager  │                   │ 10 GB free    │   │
│  └──────────┘                   └───────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Backup Layers

#### Layer 1: Coolify Built-in Backups (Primary)

```yaml
# Coolify dashboard → Database → Backups
Schedule: "0 */6 * * *"  # Every 6 hours
Retention:
  count: 28            # Keep last 28 backups (7 days at 4x/day)
  days: 30             # Or 30 days max
Destination: S3 (Cloudflare R2)
```

Coolify natively supports:
- Automated pg_dump on cron schedule
- S3-compatible destinations (R2)
- One-click restore from dashboard
- Retention policies (count, days, max storage)

#### Layer 2: WAL Archiving for PITR (Advanced)

For point-in-time recovery when needed (e.g., after a bad migration):

```bash
# postgresql.conf
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 300  # Archive WAL every 5 minutes max

# WAL-G environment (for R2)
WALG_S3_PREFIX=s3://baduk-backups/wal
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret-key>
AWS_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_FORCE_PATH_STYLE=true
AWS_REGION=auto
```

**Base backup schedule**:
```bash
# Weekly full base backup (cron: Sunday 03:00)
wal-g backup-push /var/lib/postgresql/data

# Retention: keep last 4 base backups + all WAL between them
wal-g delete retain FULL 4 --confirm
```

#### Layer 3: SGF & Asset Backup

```bash
# SGF files are already in R2 (primary storage)
# Additional sync for any locally-generated assets
rclone sync /app/data/sgf r2:baduk-assets/sgf --checksum
```

### Storage Estimation

| Data Type | Size (initial) | Growth/month | 12-month total |
|-----------|---------------|--------------|----------------|
| PG dump (compressed) | ~100 MB | +20 MB | ~340 MB |
| WAL archives (compressed) | ~200 MB | +100 MB | ~1.4 GB |
| SGF collection | ~750 MB | +5 MB | ~810 MB |
| Umami analytics data | ~50 MB | +30 MB | ~410 MB |
| **Total** | **~1.1 GB** | **~155 MB** | **~3.0 GB** |

All within Cloudflare R2's 10 GB free tier for the first year. Even at 2x growth, we stay under 10 GB.

### Backup Verification Automation

```bash
#!/bin/bash
# /scripts/verify-backup.sh — run weekly via cron
set -euo pipefail

BACKUP_DIR="/tmp/backup-verify-$(date +%s)"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"

# 1. Download latest backup from R2
rclone copy r2:baduk-backups/latest/ "$BACKUP_DIR" --max-depth 1

# 2. Restore to temporary PG instance
docker run -d --name pg-verify \
  -e POSTGRES_PASSWORD=verify \
  -v "$BACKUP_DIR:/backups" \
  postgres:16-alpine

sleep 5

# 3. Restore and verify
docker exec pg-verify pg_restore -U postgres -d postgres /backups/latest.dump

# 4. Run integrity checks
TABLES=$(docker exec pg-verify psql -U postgres -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
USERS=$(docker exec pg-verify psql -U postgres -t -c "SELECT count(*) FROM users" 2>/dev/null || echo "0")

# 5. Cleanup
docker stop pg-verify && docker rm pg-verify
rm -rf "$BACKUP_DIR"

# 6. Report to Discord
curl -s -X POST "$DISCORD_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"✅ Backup verification passed: ${TABLES} tables, ${USERS} users\"}"
```

### Disaster Recovery Plan

| Scenario | RTO | RPO | Method |
|----------|-----|-----|--------|
| Accidental table drop | 15 min | 5 min (WAL) | PITR via WAL-G |
| Bad migration | 30 min | 5 min (WAL) | PITR to pre-migration |
| Server disk failure | 1 hr | 6 hrs (Coolify dump) | Restore from R2 |
| Complete server loss | 2-4 hrs | 6 hrs | New Hetzner + R2 restore |
| Datacenter outage | 4-8 hrs | 6 hrs | New Hetzner region + R2 |

### Monthly Cost

| Component | Cost |
|-----------|------|
| R2 storage (< 10 GB) | $0 |
| R2 operations (< 1M/mo) | $0 |
| R2 egress | $0 (always) |
| Coolify backup feature | $0 (built-in) |
| WAL-G | $0 (open-source) |
| Cron scripts | $0 |
| **Total** | **$0** |

---

## <a id="conclusion"></a>Conclusion: Recommended Minimal Analytics & Data Stack

### Recommended Stack

```
┌─────────────────────────────────────────────────────────────┐
│                MINIMAL ANALYTICS & DATA STACK                │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │   Umami v3   │  │  Bugsink    │  │  Pino Logger     │    │
│  │  (analytics) │  │  (errors)   │  │  (structured)    │    │
│  │  ~300 MB RAM │  │  ~256 MB RAM│  │  in-process      │    │
│  │  shares PG   │  │  SQLite     │  │  → PG + Discord  │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ Cloudflare  │  │ Cloudflare  │  │  WAL-G + Coolify │    │
│  │ CDN (free)  │  │ R2 (free)   │  │  (backups)       │    │
│  │ DDoS + SSL  │  │ SGF + backup│  │  PG PITR         │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Go Game Data: CWI + Badukmovies (public domain)    │    │
│  │  ~150K games → @sabaki/sgf → PG metadata + R2 files │    │
│  │  Puzzle gen: KataGo analysis on mistake positions    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Total Additional Monthly Cost

| Component | Monthly Cost |
|-----------|-------------|
| Umami v3 | $0 (self-hosted, shares PG) |
| Bugsink | $0 (self-hosted, SQLite) |
| Pino + PG error table | $0 (npm package + existing PG) |
| Cloudflare CDN | $0 (free tier) |
| Cloudflare R2 | $0 (< 10 GB free tier) |
| WAL-G + Coolify backups | $0 (open-source + built-in) |
| Discord alerts | $0 (webhooks free) |
| Go game data | $0 (public domain) |
| **Total** | **$0/month** |

### Additional Server Resource Requirements

| Service | RAM | CPU | Disk |
|---------|-----|-----|------|
| Umami v3 | ~300 MB | ~1% | ~500 MB (PG data) |
| Bugsink | ~256 MB | <1% | ~100 MB (SQLite) |
| WAL-G | ~50 MB (during backup) | Burst | Per backup size |
| **Total Added** | **~600 MB** | **~2%** | **~600 MB** |

This fits comfortably within a Hetzner CX31 (4 vCPU, 8 GB RAM, 80 GB disk) alongside the main Go app, PG 16, and Redis 7.2.

### Implementation Timeline

| Week | Task | Effort |
|------|------|--------|
| 1 | Cloudflare DNS + CDN setup | 2 hours |
| 1 | Cloudflare R2 bucket creation | 1 hour |
| 1 | Umami v3 Docker deployment + Next.js integration | 4 hours |
| 2 | Pino logger setup + PG error table | 3 hours |
| 2 | Discord webhook alerts | 1 hour |
| 2 | Bugsink deployment + Sentry SDK config | 2 hours |
| 3 | Coolify backup → R2 configuration | 2 hours |
| 3 | WAL-G setup + PITR testing | 4 hours |
| 3 | Backup verification cron script | 2 hours |
| 4 | SGF data pipeline (download + parse + dedupe) | 8 hours |
| 4 | @sabaki/sgf integration + PG metadata schema | 4 hours |
| **Total** | | **~33 hours** |

### What You Sacrifice vs Managed Services

| Managed Service Feature | Our Alternative | What's Lost |
|------------------------|-----------------|-------------|
| Google Analytics AI insights | Umami v3 cohorts + segments | Predictive analytics, ML-powered insights |
| Sentry session replay | Bugsink + Pino | No visual replay of user sessions |
| Sentry performance tracing | Pino timing + manual spans | No distributed tracing flame graphs |
| Vercel Analytics (Web Vitals) | Umami custom events + CWV API | Less polished Web Vitals dashboard |
| Managed DB backups (Supabase/Neon) | WAL-G + Coolify + R2 | No managed PITR UI, must script |
| AWS S3 + CloudFront | Cloudflare R2 + CDN | Fewer regions, no Lambda@Edge |
| Datadog/New Relic APM | Pino + PG queries | No APM dashboards, no anomaly detection |

### When to Graduate from This Stack

| Trigger | Action |
|---------|--------|
| MAU > 30K | Consider Plausible Cloud ($19/mo) for better scale |
| Error volume > 1K/day | Migrate Bugsink → GlitchTip (more features) |
| Team > 3 developers | Add Sentry Cloud Team ($26/mo) for collaboration |
| Revenue > $5K/mo | Add Datadog APM ($15/mo) for performance insights |
| SGF collection > 10 GB | R2 paid tier ($0.015/GB/mo — still cheap) |
| Need compliance audit | Add proper audit logging + Cloudflare Pro ($20/mo WAF) |

---

## Sources

- [Umami vs Plausible vs Matomo Comparison](https://aaronjbecker.com/posts/umami-vs-plausible-vs-matomo-self-hosted-analytics/)
- [Umami v3 Launch — Cohorts and Segmentation](https://www.opensourceforu.com/2025/11/umami-v3-launches-with-new-interface-cohorts-and-advanced-segmentation/)
- [Umami Review — Features, Pricing & Alternatives (2025)](https://userbird.com/review/umami)
- [Self-Hosting Umami Analytics on a VPS](https://bryananthonio.com/blog/self-hosting-umami-analytics/)
- [How to Run Umami Analytics in Docker](https://oneuptime.com/blog/post/2026-02-08-how-to-run-umami-analytics-in-docker/view)
- [Umami Docker Resource Usage (~200-450 MB RAM)](https://deepakness.com/blog/self-hosting-umami-analytics/)
- [GlitchTip vs Sentry vs Bugsink Comparison](https://www.bugsink.com/blog/glitchtip-vs-sentry-vs-bugsink/)
- [Sentry Alternatives — Lightweight Self-Hosted Error Tracking](https://medium.com/@hilda.wg.writes/sentry-alternatives-6-tools-for-lightweight-simpler-and-smaller-self-hosted-error-tracking-6c4e542898e6)
- [Bugsink: Self-hosted Error Tracking](https://www.bugsink.com/)
- [Bugsink GitHub — Single Container Architecture](https://github.com/bugsink/bugsink)
- [Top 8 Sentry Alternatives in 2026](https://signoz.io/comparisons/sentry-alternatives/)
- [Pino Logger: Complete Node.js Guide (2026)](https://signoz.io/guides/pino-logger/)
- [Production-Grade Logging in Node.js with Pino](https://www.dash0.com/guides/logging-in-node-js-with-pino)
- [CWI Japanese Professional Go Games (88,888+ SGF)](https://homepages.cwi.nl/~aeb/go/games/games/)
- [Badukmovies Pro Game Collection (115,623 games, public domain)](https://badukmovies.com/pro_games/)
- [GoKifu — Share SGF Go Games](http://gokifu.com/)
- [OGS Game SGF Downloader](https://forums.online-go.com/t/ogs-game-sgf-downloader/3018)
- [OGS API Documentation](https://ogs.docs.apiary.io/)
- [@sabaki/sgf — npm](https://www.npmjs.com/package/@sabaki/sgf)
- [ts-sgf-parser — npm](https://www.npmjs.com/package/ts-sgf-parser)
- [KataGo GitHub](https://github.com/lightvector/KataGo)
- [KaTrain — Train with KataGo](https://github.com/sanderland/katrain)
- [Cloudflare Free Plan Overview](https://www.cloudflare.com/plans/free/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 Free Tier — 10 GB Storage](https://www.oreateai.com/blog/cloudflare-r2-free-tier-what-to-expect-in-2025-and-beyond/1f6a945849135ad3fe4625c8a1511786)
- [CDN Caching Strategies for Next.js](https://dev.to/melvinprince/cdn-caching-strategies-for-nextjs-speed-up-your-website-globally-4194)
- [Configure CDN Caching for Self-hosted Next.js](https://focusreactive.com/configure-cdn-caching-for-self-hosted-next-js-websites/)
- [PostgreSQL PITR Documentation (PG 16)](https://www.postgresql.org/docs/16/continuous-archiving.html)
- [Top 5 PostgreSQL Backup Tools in 2025](https://medium.com/@rostislavdugin/top-5-postgresql-backup-tools-in-2025-82da772c89e5)
- [WAL-G Storage Configuration](https://wal-g.readthedocs.io/STORAGES/)
- [Coolify Automated DB Backups with S3](https://hamy.xyz/blog/2025-03_coolify-automated-db-backups)
- [Coolify Backup and Restore Documentation](https://coolify.io/docs/knowledge-base/how-to/backup-restore-coolify)
- [Coolify Backup Strategy Guide](https://massivegrid.com/blog/coolify-backup-strategy/)
- [The Quiet Power of Cloudflare Free Tier (2026)](https://andrewbaker.ninja/2026/02/24/the-quiet-power-of-free-tier-why-cloudflare-gets-it-right-and-why-enterprise-pricing-tiering-will-die-out/)
