# PRD 외부 연동 기술 심층조사 결과 — PHASE 1-4 종합

> **조사 일자**: 2026-03-10
> **프로세스**: Technology_Development_DeepDive_PRD_Teammate_Executable.md 기반
> **투입 에이전트**: 17개 + Orchestrator (PHASE 1: 10개, PHASE 2: 4개, PHASE 3: 3개)
> **연구 번호**: Research 4 of 4 — 외부 연동 기술 심층조사
> **핵심 제약**: OpenAI/Gemini = 구독 계정만, API 연결 금지

---

## 목차

1. [PHASE 1: 10개 Branch 결과 요약](#phase-1)
2. [PHASE 2: 4개 관점별 토론 결과](#phase-2)
3. [PHASE 3: 3개 기술 시나리오 PRD](#phase-3)
4. [PHASE 4: 최종 기술 로드맵 확정](#phase-4)

---

## <a id="phase-1"></a>PHASE 1: 10개 Branch 결과 요약

### Branch 구성

| Branch | 역할 | 관점 |
|--------|------|------|
| 1.1 External AI Aggressive | 외부 AI 연동 — 최신 기술 극대화 | Gemini Nano, WebLLM, MCP, multi-model |
| 1.2 External AI Conservative | 외부 AI 연동 — 안정적 단일 제공자 | Claude-only 4-tier, template fallback |
| 2.1 Payment & Auth Evolutionary | 결제/인증 — MVP 점진적 확장 | Better Auth, Stripe Checkout, 7일 MVP |
| 2.2 Payment & Auth Big Bang | 결제/인증 — 완전 시스템 | 7 providers, 2FA, RBAC, B2B 도장, 8주 |
| 3.1 Communication Rapid | 커뮤니케이션 — 최소 MVP | Resend+WebPush+WS+Discord, 3.5일 |
| 3.2 Communication Robust | 커뮤니케이션 — 전체 시스템 | Novu+FCM+next-intl+leaderboards, 6주 |
| 4.1 Analytics & Data Minimal | 분석/데이터 — 자체 호스팅 | Umami+Bugsink+Uptime Kuma, $0/mo |
| 4.2 Analytics & Data Practical | 분석/데이터 — 관리형 서비스 | PostHog+Sentry+Cloudflare, $0 free tier |
| 5.1 Integration Patterns Modern | 통합 패턴 — 최신 | MCP+tRPC+OAuth 2.1+edge, 8주 |
| 5.2 Integration Patterns Classical | 통합 패턴 — 검증된 | REST+OAuth 2.0+webhooks+circuit breaker |

### 핵심 발견 사항

#### 외부 AI 연동

**Aggressive Branch (1.1):**
- Chrome Built-in AI: Summarizer+Translator+Detector stable (Chrome 138+), **한국어 미지원** (EN/ES/JP만), 모바일 미지원
- WebLLM: 오픈소스, WebGPU 기반 브라우저 LLM, Phi-3.5/Gemma-2B, ~15-30 tok/s
- web-katrain: KataGo 브라우저 실행 가능 (TF.js+WebGPU, 서버 대비 10-25x 느림)
- MCP: 97M+ 월간 SDK 다운로드, multi-vendor 표준, Linux Foundation 기부
- KataGo HumanSL: 랭크별 AI 대국 (무료)
- HARPA AI: ChatGPT/Gemini 구독 브라우저 접근 (하루 10메시지 무료)
- 월 AI 비용: $41-97 (MAU 8K), Risk/Reward: 7.2/10

**Conservative Branch (1.2):**
- Claude-only 4-tier: Template (50%) → Haiku (30%) → Sonnet (15%) → Opus (5%)
- Prompt caching: 85-90% 입력 비용 절감
- Batch API: 50% 할인 (사후 복기, 퍼즐 생성)
- Batch + cache 결합 = **95% 절감**
- Circuit breaker (opossum): Claude 장애 시 template fallback
- 외부 API 의존성 1개: api.anthropic.com만
- OpenAI/Gemini 구독 자동화: **양사 TOS 명시적 금지**
- Google은 OpenClaw 사용 구독자를 실제 차단한 사례
- 비용: $43-65/mo (최적화), 신뢰성: 8/10

#### 결제 & 인증

**Evolutionary Branch (2.1):**
- **Auth.js가 Better Auth에 합병** (2025년 9월, YC $5M)
- Auth.js v5 = 유지보수 모드 (보안 패치만)
- Better Auth: 플러그인 아키텍처, Drizzle adapter, 내장 rate limiting
- Stripe: KakaoPay, NaverPay, PAYCO, PayPay **네이티브 지원** (2024년 10월~)
- Stripe Checkout + Customer Portal = 커스텀 결제 UI 불필요
- 7일 무료 체험 (카드 필수) → ~40% 전환율
- **Stripe entity 제약**: 한국 사업자 등록 불가, US entity (Stripe Atlas $500) 또는 일본 entity 필요
- **CVE-2025-29927**: Next.js 미들웨어 우회 (CVSS 9.1), 15.2.3+ 패치
- MVP: 7일, $60-372/mo

**Big Bang Branch (2.2):**
- Auth.js v5 + 7개 provider (Email, Google, Apple, GitHub, Discord, Kakao, LINE)
- 계정 연결: 신뢰 계층 모델 (Google/Apple/GitHub/Discord 자동, Kakao/LINE 수동)
- 2FA/TOTP: AES-256-GCM 암호화, 백업 코드
- Stripe 전체 생명주기: Trial→Active→PastDue→Grace→Canceled
- B2B 도장 plan: per-seat 결제, RBAC (owner/admin/instructor/student)
- Paddle: MoR(Merchant of Record)로 글로벌 세금 자동 처리
- 10 DB 테이블, 30+ API 엔드포인트, 12 Stripe webhook 이벤트
- 8주, $60-372/mo

#### 커뮤니케이션

**Rapid Branch (3.1):**
- Resend: 3K free/mo, React Email 5.0 JSX 템플릿
- Web Push API: 무료, `web-push` npm, VAPID keys, iOS Safari 16.4+ PWA 지원
- WebSocket rooms: 기존 게임 WS 확장 (채팅) — 추가 인프라 불필요
- Discord webhooks: stateless POST, 의존성 없음
- Stream Chat ($499/mo) 대비 내장 WS 채팅 = $0
- **3.5일 MVP, $0/month**

**Robust Branch (3.2):**
- Resend + FCM + web-push 멀티채널
- Novu (self-hosted, MIT): 알림 오케스트레이션
- next-intl: 5 locales (en/ko/ja/zh-CN/zh-TW), 1.8M 주간 다운로드
- 바둑 용어 사전 (4개 언어) — fuseki/joseki/tesuji 등
- Discord.js bot + OAuth2 (활성 게임일 25% 증가, Discord GDC 2026)
- Redis Sorted Sets: 리더보드 O(log N)
- 6주, $20-260/mo, 13 DB 테이블

#### 분석 & 데이터

**Minimal Branch (4.1):**
- Umami v3: PG 16 공유, 300MB RAM, 2KB 트래커, Coolify 원클릭
- Bugsink: 단일 컨테이너, Sentry SDK 호환, SQLite, ~100MB RAM
- Uptime Kuma: HTTP/TCP/WS 모니터링, Discord 알림
- Cloudflare R2: 10GB 무료, egress 무료
- WAL-G: PITR (5분 RPO), Hetzner Storage Box €3.81/mo
- Go 데이터: CWI (88K 프로 기보), OGS (56M 기보), @sabaki/sgf
- **전체 단일 Hetzner 서버: €18.41/mo, 외부 SaaS 0개**

**Practical Branch (4.2):**
- PostHog Cloud: 1M events free, session replay (5K), feature flags (1M), A/B testing
- Sentry: 5K errors free, AI Agent Monitoring (LLM 추적)
- Cloudflare CDN + R2 (egress 무료)
- Better Stack + Healthchecks.io: 업타임 모니터링
- PG materialized views: 350-9000x 쿼리 가속
- Go 데이터: featurecat/go-dataset (21.1M 기보, GitHub 무료)
- **$0/mo at MAU 8K (free tier), $117/mo at MAU 25K**

#### 통합 패턴

**Modern Branch (5.1):**
- MCP: stable spec v2025-11-25, 97M+ SDK downloads, KataGo MCP Server 설계
- tRPC v11: 35-40% 개발 속도 향상, zero schema 중복, WebSocket 구독
- OAuth 2.1: PKCE 필수, passkeys (70% 사용자 보유, 93% 로그인 성공률)
- Cloudflare Workers: edge rate limiting, Hetzner+CF 하이브리드
- Svix: webhook 인프라, BullMQ job queue
- Type safety: 8.5/10, 8주

**Classical Branch (5.2):**
- REST + Zod validation + Scalar API docs
- Auth.js v5 + DB sessions (JWT 아닌) — 구독 변경 즉시 반영
- Stripe webhooks: HMAC-SHA256, idempotency (PG event_id dedup)
- Postmark email (98.7% inbox) vs SendGrid (95.3%)
- opossum circuit breaker (9+ years production)
- Redis: cache-aside, session, KataGo 분석 캐시 (Zobrist hash), sliding window rate limit
- Drizzle ORM repository pattern
- 80+ 출처, 수십 년 검증 패턴

### 10개 Branch 전원 합의 사항

| # | 합의 항목 | 근거 |
|---|----------|------|
| 1 | **Claude API = 유일한 프로그래밍 AI** | OpenAI/Gemini API 사용 불가 (구독만), TOS 위반 |
| 2 | **Stripe = 결제** | KakaoPay/NaverPay/PayPay 네이티브 지원 |
| 3 | **Resend = 이메일** | React Email JSX, 3K free/mo, Next.js 최적 |
| 4 | **Cloudflare = CDN+R2** | 무료 CDN, R2 egress 무료 |
| 5 | **Web Push API = 푸시** | 무료, 벤더 잠금 없음, iOS PWA 지원 |
| 6 | **Template fallback 필수** | Claude 장애 시 $0 서비스 연속성 |
| 7 | **Prompt caching** | 85-90% 입력 비용 절감 |
| 8 | **next-intl = i18n** | Next.js 15 App Router 네이티브, 1.8M 주간 다운로드 |

---

## <a id="phase-2"></a>PHASE 2: 4개 관점별 토론 결과

### 토론 구조
PHASE 1의 10개 Branch 결과를 입력으로, 4개 관점이 각각 완전한 외부 연동 기술 PRD 작성.

### 4개 관점별 기술 선택 비교표

| 기술 영역 | 2.A Latest Tech | 2.B Stability | 2.C Speed | 2.D Maintainability |
|-----------|:---:|:---:|:---:|:---:|
| **AI** | 4-layer (WebLLM+Chrome+Claude+MCP) | Template-first (60%)+Claude | 2-layer (Template+Haiku) | Claude-only 3-tier |
| **Auth** | Better Auth + passkeys | Better Auth + DB sessions | Better Auth (email+Google) | Better Auth + Ports/Adapters |
| **Payment** | Stripe + B2B 도장 | Stripe Checkout | Stripe Checkout | Stripe + abstraction |
| **Email** | Resend | Resend | Resend | Resend |
| **Analytics** | PostHog+Sentry+Umami | Umami+Bugsink 자체호스팅 | Umami 자체호스팅 | PostHog+Sentry Cloud |
| **API** | tRPC+MCP+Svix | REST+opossum | REST+Zod | REST+Zod+Ports/Adapters |
| **Discord** | Bot+Activity | Webhooks only | Webhooks | Webhooks |
| **i18n** | ko+en (+zh defer) | 3 locales | Deferred | 3 locales |
| **외부 서비스** | 23개 | 6개 | ~8개 | 6개 |
| **일정** | 10주 | 8주 | **14일** | 6주 |
| **월 비용** | $47-89 | $80-115 | $0-5 (런칭) | $78-100 |

### 핵심 분쟁 사항

| 분쟁 | Latest (2.A) | Stability (2.B) | Speed (2.C) | Maintain (2.D) |
|------|:---:|:---:|:---:|:---:|
| AI 레이어 수 | 4-layer | Template-first | 2-layer | 3-tier |
| On-device AI | WebLLM+Chrome | No | No | No |
| MCP 서버 | Yes | No | No | No |
| tRPC vs REST | tRPC | REST | REST | REST |
| Auth 복잡도 | Passkeys+RBAC | DB sessions | Email+Google | Ports/Adapters |
| Analytics 호스팅 | Triple | 자체호스팅 | 자체호스팅 | 관리형 SaaS |
| Discord 수준 | Bot+Activity | Webhooks | Webhooks | Webhooks |

### 각 관점 핵심 인사이트

**2.A — Latest Tech First (Innovation 8.3/10):**
- MCP = 실제 표준 (97M+ downloads), 과대광고 아님
- tRPC v11: 35-40% 개발 속도 향상, type safety 10/10
- Passkeys: 70% 사용자 보유, 4x 빠른 로그인
- PostHog: session replay로 Go 보드 인터랙션 관찰 가능
- 10주, $47-89/mo

**2.B — Stability First (Stability 8.3/10):**
- 6개 외부 의존성만 — 모든 추가 서비스는 장애점
- **Coolify: 최약 링크** (11 CVEs CVSS 10.0, 2026년 1월)
- Template-first: 60% 요청이 Claude API 미사용
- Circuit breaker on every external call
- Stability Tax: 구현 시간의 64%를 신뢰성에 투자
- 8주 (5+3 안정화), $80-115/mo

**2.C — Speed First (14일!):**
- Day 1-3: Auth+Email, Day 4-5: Payment, Day 6-7: Templates, Day 8-9: Claude API
- Day 10-11: Push+Discord, Day 12-14: Analytics+Hardening
- 모든 것을 free tier로 — $0-5/mo at launch
- Sentry 불필요 (console logging), PostHog 불필요 (Umami)
- **"출시하지 않은 제품은 실패한 제품"**

**2.D — Maintainability First (3년 TCO $6,600):**
- 3,000 LOC 통합 예산, 통합당 최대 500 LOC
- Simplified Ports/Adapters: 벤더 교체 시 1파일 변경
- 관리형 SaaS (PostHog+Sentry) > 자체 호스팅 — 자체 호스팅 유지보수 60-120시간/년
- REST + Zod: AI agent에게 가장 친숙 (25년 훈련 데이터 vs MCP 1.5년)
- GitClear 2025: AI 코드 12.3% 중복, 34% 복잡도 증가 — 단순 패턴 필수
- 6주, $78-100/mo

---

## <a id="phase-3"></a>PHASE 3: 3개 기술 시나리오 PRD

### 시나리오 A: Cutting Edge

**"혁신이 경쟁 우위를 준다 — 계산된 위험만"**

> 상세: `/prompt/phase3a-external-integrations-cutting-edge-scenario.md`

**핵심 수치:**

| 항목 | 값 |
|------|---|
| Innovation Score | **8.3/10** |
| 성공 확률 | **60-65% (전체) / 80% (코어+연기)** |
| 월 비용 | **$27-117** |
| 일정 | **10주** |
| 외부 서비스 | 16개 |

**기술 선택:**

| 영역 | Innovation | 핵심 차별점 |
|------|:---:|-----------|
| AI | 9/10 | 4-layer (MCP+Claude+Chrome AI+WebLLM) |
| Auth | 8/10 | Better Auth + passkeys + B2B 도장 |
| Communication | 8/10 | Novu 오케스트레이션, Discord Activity (연기) |
| Analytics | 8/10 | PostHog+Sentry+Umami triple, A/B 테스트 |
| Integration | 8/10 | tRPC v11 + MCP + Svix + BullMQ |

---

### 시나리오 B: Balanced-Tech

**"좋은 기술이지만, AI agent가 빌드하고 유지할 수 있어야 한다"**

> 상세: `/docs/baduk-external-integration-prd-balanced.md`

**핵심 수치:**

| 항목 | 값 |
|------|---|
| Balanced Score | **7.7/10** (Innovation 7.0 / Stability 7.8 / Speed 7.5 / Maintainability 8.5) |
| 성공 확률 | **85% (7주) / 91% (9주 버퍼)** |
| 월 비용 | **$80-130** |
| 일정 | **7주** |
| 외부 서비스 | 8개 |

**10개 분쟁 해결:**

| 분쟁 | 결정 | 근거 |
|------|------|------|
| AI 레이어 | 3-tier Claude-only | 단일 SDK, 검증된 패턴, template-first |
| On-device AI | No (defer) | 한국어 미지원, 4GB VRAM 요구 |
| MCP | No (defer MAU 25K+) | 1.5년 훈련 데이터, MAU 8K에서 이점 미미 |
| tRPC vs REST | REST + Zod + Server Actions | 500K SO 답변 vs 5K, AI agent 일관성 10/10 |
| Auth | Better Auth (email/Google/Kakao Day 1) | Kakao = 한국 1순위 시장 |
| Analytics | PostHog+Sentry Cloud (managed free) | 자체 호스팅 세금 ~60시간/년 제거 |
| Discord | Webhooks only | 95% 가치, 50 LOC, 영구 연결 불필요 |
| i18n | 3 locales (en/ko/ja) | Day 1 현실적 사용자 95%+ 커버 |
| 서비스 수 | 8개 | 2.A 23개(과잉)~2.B 6개(부족) 최적 |
| 일정 | 7주 | 2.C 14일(위험)~2.A 10주(과잉) 최적 |

---

### 시나리오 C: Proven Stack

**"느려도 확실한 것이 낫다. 가장 단순한 시스템"**

> 상세: `/prompt/phase3c-proven-stack-technology-scenario.md`

**핵심 수치:**

| 항목 | 값 |
|------|---|
| Proven Score | **9.0/10** |
| 성공 확률 | **90-95%** |
| 월 비용 | **$80-115** |
| 일정 | **8주** |
| 외부 API | 4개 (런칭 시 3개, Claude 연기) |

**3가지 급진적 차별점:**
1. **런칭 시 AI 없음** — 템플릿 ONLY, 12주차에 사용자 만족도 <60% 시 Claude 도입
2. **NextAuth v4** (v5 아닌) — 안정 버전, 유지보수 모드이나 검증됨
3. **자체 호스팅 전부** — Umami+Prometheus+Grafana, SaaS Analytics 0개
4. **Zero External API Test PASS** — 모든 외부 API 다운 시에도 완전 기능

---

### 3개 시나리오 비교 종합표

| 기준 | 3.A Cutting Edge | 3.B Balanced-Tech | 3.C Proven Stack |
|------|:---:|:---:|:---:|
| **핵심 철학** | 혁신 투자 | AI agent 최적화 | 절대 실패 방지 |
| **성공 확률** | 60-65% | **85-91%** | 90-95% |
| **월 비용** | $27-117 | **$80-130** | $80-115 |
| **일정** | 10주 | **7주** | 8주 |
| **Innovation** | **8.3/10** | 7.0/10 | ~4/10 |
| **Stability** | ~6/10 | 7.8/10 | **9.0/10** |
| **Maintainability** | ~6/10 | **8.5/10** | 7/10 |
| **AI 런칭** | 4-layer Day 1 | Claude 3-tier Day 1 | 템플릿 ONLY |
| **외부 서비스** | 16개 | 8개 | 4개 |
| **API 패턴** | tRPC+MCP | REST+Zod | REST only |
| **합의 존중** | 중간 | **최고** | 높음 (AI 제거) |

---

## <a id="phase-4"></a>PHASE 4: 최종 기술 로드맵 확정

### 시나리오 선택: **Balanced-Tech (3.B)**

**선택 근거 5가지:**

1. **4중 Balanced 정합** — Research 1 Balanced + Research 2 Balanced-Tech + Research 3 Balanced-Tech + Research 4 Balanced-Tech. 4개 독립 연구가 동일 결론.

2. **Claude 3-tier = AI 차별화 유지** — Proven Stack은 템플릿 ONLY로 유일한 moat("Why?" AI 해설) 포기. Balanced는 Day 1 Claude Haiku.

3. **성공 확률 최적** — 85% (7주), 91% (9주). Cutting Edge 60-65% 위험. Proven 90-95%이나 차별화 없음.

4. **8개 서비스 = 관리 가능 복잡도** — Cutting Edge 16개 과잉, Proven 4개 부족. 8개는 명확한 역할 분담.

5. **월 $80-130 = 예산 범위 하단** — $80-260 예산의 30-50%. 성장 시 여유.

**버린 시나리오:**

| 시나리오 | 핵심 미선택 이유 |
|---------|----------------|
| 3.A Cutting Edge | 16 서비스, 60-65% 성공률, MCP/tRPC/WebLLM AI agent 미최적, Coolify CVE 위험 |
| 3.C Proven Stack | 템플릿 ONLY = OGS/KGS 차별화 불가, NextAuth v4 유지보수 모드, i18n 미지원 |

### 최종 확정 스택

```
┌──────────────────────────────────────────────────────────────────┐
│        External Integration — Balanced-Tech v1.0                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  AI:          Claude Haiku 4.5 (80%) + Sonnet 4.6 (15%)          │
│              + Template Engine (5% 폴백), $43-65/mo              │
│  Caching:    Prompt caching 85-90% 절감, Batch API 50% 할인     │
│  Resilience: opossum circuit breaker → template fallback          │
│  Phase 2:    MCP Server, WebLLM on-device (MAU 25K+)             │
│                                                                    │
│  Auth:       Better Auth (email magic link + Google + Kakao)      │
│  Phase 2:    GitHub, Discord, Apple, LINE, passkeys               │
│  Sessions:   DB sessions + Redis cache (5min TTL)                 │
│                                                                    │
│  Payment:    Stripe Checkout (hosted) + Customer Portal           │
│  Methods:    KakaoPay, NaverPay, PayPay (Stripe 네이티브)         │
│  Entity:     Stripe Atlas US ($500 일회성)                        │
│  Phase 2:    B2B 도장 per-seat, Paddle MoR 대안                   │
│                                                                    │
│  Email:      Resend (3K free/mo) + React Email JSX               │
│  Push:       Web Push API (VAPID + web-push npm, $0)              │
│  Chat:       WebSocket rooms (기존 게임 WS 확장)                  │
│  Discord:    Webhooks (게임 결과, 서버 상태)                      │
│  i18n:       next-intl (en/ko/ja) — 3 locales                    │
│  Phase 2:    Discord bot, Novu, zh-CN                             │
│                                                                    │
│  Analytics:  PostHog Cloud (1M events free)                       │
│  Errors:     Sentry Cloud (5K errors free)                        │
│  CDN:        Cloudflare (무료 CDN + R2 10GB free)                 │
│  Data:       PG Materialized Views (350-9000x 가속)              │
│  Go Data:    CWI 88K + featurecat 21.1M + @sabaki/sgf            │
│  Backup:     Hetzner Storage Box (€3.81/mo) + WAL-G              │
│                                                                    │
│  API:        REST + Zod + Next.js Server Actions                  │
│  Webhooks:   Stripe HMAC-SHA256, PG idempotency dedup             │
│  Resilience: opossum circuit breaker (Claude, Stripe, Resend)     │
│  Caching:    Redis (KataGo Zobrist, sessions, rate limit)         │
│  Queue:      BullMQ (분석, 이메일, 배치 AI)                       │
│  Pattern:    Ports/Adapters (벤더 교체 1파일)                     │
│                                                                    │
│  외부 서비스 8개:                                                 │
│  Claude API, Stripe, Resend, PostHog, Sentry,                    │
│  Cloudflare, Google OAuth, Discord Webhooks                       │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 마일스톤

```
Week 1:     Auth (Better Auth + Google + Kakao + email) ████████████
Week 1-2:   Payment (Stripe Checkout + Customer Portal) ████████████████
Week 2:     Email (Resend + React Email 템플릿) ████████
Week 2-3:   AI Templates (KataGo 패턴 매칭 → 템플릿) ████████████████
Week 3-4:   Claude API (Haiku + prompt caching + circuit breaker) ████████████████
Week 3-4:   Notifications (Web Push + Discord webhooks) ████████████████
Week 4-5:   Analytics (PostHog + Sentry + Cloudflare) ████████████████
Week 5-6:   i18n (next-intl en/ko/ja) + Redis caching ████████████████
Week 6-7:   Integration testing + hardening ████████████████
            ──────────────────────────────────────────────────────
            Total: 7주 (병렬 AI agent 실행)
```

### 비용 추정

**월간 운영 (MAU 8K):**

| 항목 | Phase 1 (템플릿+Haiku) | Phase 2 (전체) |
|------|:---:|:---:|
| Hetzner CCX33 (앱+KataGo) | $60 | $60 |
| Claude API (Haiku+Sonnet+caching) | $0 (템플릿) → $43-65 | $43-65 |
| Stripe | 매출 연동 (2.9%+$0.30) | 매출 연동 |
| Resend | $0 (free) | $0-20 |
| PostHog | $0 (free) | $0 |
| Sentry | $0 (free) | $0 |
| Cloudflare | $0 (free) | $0 |
| Hetzner Storage Box | $4 | $4 |
| 도메인+DNS | $2 | $2 |
| **월 합계** | **$66-131** | **$109-151** |

**3년 총 비용:** ~$4,000-5,400 (인프라) + Stripe 수수료

### 위험 레지스터

| # | 위험 | 확률 | 영향 | 검증 시점 | 완화 |
|---|------|------|------|----------|------|
| R1 | Claude API 비용 초과 | 중간 | 중간 | Week 5 | Prompt caching + Batch API + 템플릿 폴백 + Anthropic Console 하드캡 |
| R2 | Better Auth 미성숙 | 낮음 | 높음 | Week 2 | Auth.js v5 폴백 (1주 전환), Drizzle adapter 동일 |
| R3 | Stripe Korea entity | 높음 | 높음 | 사전 | Stripe Atlas ($500) or Paddle MoR 대안 |
| R4 | Coolify 보안 (11 CVEs) | 중간 | 치명적 | 지속 | 자동 업데이트, Docker Compose 직접 대안 검토 |
| R5 | Free tier 정책 변경 | 낮음 | 중간 | 지속 | PostHog→Umami, Sentry→Bugsink 자체호스팅 대안 준비 |

### Research 1 ↔ 2 ↔ 3 ↔ 4 교차 검증

| 항목 | R1 (시장/사용자) | R2 (기술 스택) | R3 (바둑 도메인) | R4 (외부 연동) | 정합 |
|------|:---:|:---:|:---:|:---:|:---:|
| 시나리오 | Balanced | Balanced-Tech | Balanced-Tech | **Balanced-Tech** | ✅ 4중 일치 |
| AI 해설 | "Why?" Day 1 | Haiku/Sonnet | 템플릿 V1→LLM V2 | **Claude 3-tier** | ✅ 구체화 |
| 인프라 | $55-150/mo | Coolify+Hetzner | CCX33 $60/mo | **$66-131/mo** | ✅ 범위 내 |
| 일정 | 6개월 | 6개월 | 12주 (도메인) | **7주 (외부 연동)** | ✅ 부분집합 |
| 결제 | — | — | — | **Stripe+Better Auth** | ✅ 신규 |
| 이메일 | — | — | — | **Resend (free)** | ✅ 신규 |
| 푸시 | — | — | — | **Web Push ($0)** | ✅ 신규 |
| Analytics | — | — | — | **PostHog+Sentry (free)** | ✅ 신규 |
| CDN | — | — | — | **Cloudflare (free)** | ✅ 신규 |
| i18n | — | — | — | **next-intl (en/ko/ja)** | ✅ 신규 |
| API 패턴 | — | — | — | **REST+Zod** | ✅ 신규 |
| 성공 확률 | 65-75% | 70-75% | 82-91% | **85-91%** | ✅ 일관 상승 |

---

## 상세 문서 참조

| 문서 | 내용 | 위치 |
|------|------|------|
| Research 1 전체 | 시장/사용자/비즈니스 PRD | `/prompt/prd-research-phase1-market-user-tech-biz.md` |
| Research 2 전체 | 기술 스택 심층조사 | `/prompt/prd-research-phase2-technology-deep-dive.md` |
| Research 3 전체 | 바둑 도메인 기술 | `/prompt/prd-research-phase3-baduk-domain-tech.md` |
| **Research 4 전체** | **외부 연동 기술 (이 문서)** | `/prompt/prd-research-phase4-external-integration.md` |
| PHASE 2.A 상세 | Latest Tech PRD | `/docs/baduk-external-integration-prd-latest-tech.md` |
| PHASE 2.B 상세 | Stability PRD | `/docs/baduk-external-integration-prd-stability.md` |
| PHASE 2.C 상세 | Speed PRD | `/docs/baduk-external-integration-prd-speed-first.md` |
| PHASE 2.D 상세 | Maintainability PRD | `/docs/baduk-external-integration-prd-maintainability.md` |
| PHASE 3.A 상세 | Cutting Edge 시나리오 | `/prompt/phase3a-external-integrations-cutting-edge-scenario.md` |
| PHASE 3.B 상세 | Balanced-Tech 시나리오 | `/docs/baduk-external-integration-prd-balanced.md` |
| PHASE 3.C 상세 | Proven Stack 시나리오 | `/prompt/phase3c-proven-stack-technology-scenario.md` |
| 프레임워크 원본 | 실행 지침서 | `/prompt/Technology_Development_DeepDive_PRD_Teammate_Executable.md` |
