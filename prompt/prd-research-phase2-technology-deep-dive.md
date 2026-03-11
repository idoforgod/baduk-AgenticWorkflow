# PRD 기술 심층조사 결과 — PHASE 1-4 종합

> **조사 일자**: 2026-03-10
> **프로세스**: Technology_Development_DeepDive_PRD_Teammate_Executable.md 기반
> **투입 에이전트**: 17개 + Orchestrator (PHASE 1: 10개, PHASE 2: 4개, PHASE 3: 3개)
> **팀**: baduk-tech-research → baduk-tech-phase2

---

## 목차

1. [PHASE 1: 10개 기술 Branch 결과 요약](#phase-1)
2. [PHASE 2: 4개 관점별 토론 결과](#phase-2)
3. [PHASE 3: 3개 기술 시나리오 PRD](#phase-3)
4. [PHASE 4: 최종 기술 로드맵 확정](#phase-4)

---

## <a id="phase-1"></a>PHASE 1: 10개 기술 Branch 결과 요약

### Branch 구성

| Branch | 역할 | 관점 |
|--------|------|------|
| Core-Tech-Aggressive | 핵심 기술 스택 — 최신 기술 극대화 | SvelteKit+Bun, cutting-edge 선호 |
| Core-Tech-Conservative | 핵심 기술 스택 — 검증된 기술 | Next.js+Node.js, Lichess 패턴 |
| Architecture-Evolutionary | 아키텍처 — 진화적 접근 | 모듈러 모놀리스, 점진적 분리 |
| Architecture-BigBang | 아키텍처 — 사전 설계 | 7-모듈 DDD, KataGo Analysis Engine |
| Workflow-Rapid | 개발 워크플로우 — 속도 우선 | 3분 배포, 25-30 기능, Day 3 첫 배포 |
| Workflow-Robust | 개발 워크플로우 — 견고함 우선 | 주간 배포, 15-18 기능, 품질 게이트 |
| Debt-Practical | 기술 부채 — 실용적 | Ship First Clean Later, 80/20 규칙 |
| Debt-Minimized | 기술 부채 — 최소화 | SQALE A등급, 0.7x→1.8x 속도 곡선 |
| Theory-Modern | 이론적 기반 — 최신 | XAI 2.0, WebTransport, CRDTs, MCP |
| Theory-Classical | 이론적 기반 — 고전적 | Codd, Parnas, Conway, 56년 검증 |

### 핵심 발견 사항

#### 기술 선택 스펙트럼

```
Core Technology:
  Aggressive ━━━━━━━●━━━━━ Conservative
  SvelteKit+Bun (8/10)    Next.js+Node.js (9/10 안정성)
  → 추천 위치: 70% Conservative (Next.js, 검증된 생태계)

Architecture:
  Evolutionary ━━━━━━●━━━━━ Big Bang
  8-10주, 진화적         20-24주, 사전 완성
  → 추천 위치: 60% Evolutionary (모듈러 모놀리스 + 분리 이음새)

Development Workflow:
  Rapid ━━━━━━━━●━━━━ Robust
  3분 배포, 25-30기능    주간 배포, 15-18기능(견고)
  → 추천 위치: 65% Robust (게임 플랫폼은 정확성이 핵심)

Technical Debt:
  Minimized ━━━━━━●━━━━━ Practical
  0.7x→1.8x 속도곡선    빠르게 출시+나중 정리
  → 추천 위치: 60% Minimized (AI 코드 1.7x 이슈율 고려)

Theory Foundation:
  Modern ━━━━━━━●━━━━━ Classical
  8.5/10 이론 타당성     9.5/10 이론 확실성
  → 추천 위치: Classical 기반 + Modern 보강 (하이브리드)
```

#### 10개 Branch 전원 합의 사항

| # | 합의 항목 | 근거 |
|---|----------|------|
| 1 | **Next.js 15 + TypeScript strict** | Aggressive·Conservative 모두 인정, AI 코드 생성 품질 최고 |
| 2 | **PostgreSQL + Redis** | Codd 56년 검증, ACID 필수, CAP에서 CP 선택 |
| 3 | **모듈러 모놀리스** | Parnas(1972)+Conway(1967)+CNCF 2025(42% 회귀), Lichess/Shopify 사례 |
| 4 | **KataGo Analysis Engine 모드** | GTP 대비 3-5x 빠름, CPU Eigen 백엔드, 유일한 현실적 선택 |
| 5 | **LLM 3-Tier (Haiku → Sonnet → Template)** | 비용 최적화 + 장애 대응 |
| 6 | **Drizzle ORM** | no codegen, SQL 투명성, AI agent 최적 |
| 7 | **Glicko-2 레이팅** | Rating Deviation으로 소규모 풀 대응, Lichess 검증 |
| 8 | **WebSocket 실시간** | 바둑 대국 저빈도 메시지 패턴에 최적 |
| 9 | **Vitest + Playwright** | 단위 + E2E, Strategic TDD |
| 10 | **SonarQube (SQALE ≤5%)** | AI 코드 1.7x 이슈율 구조적 감시 |
| 11 | **Evolutionary Modular Monolith** | CNCF 2025 42% 역이동 증거, Lichess 패턴 |

#### Branch별 주요 데이터 포인트

**Core-Tech-Aggressive:**
- SvelteKit 2 + Svelte 5 Runes: 번들 65% 작음, HTTP RPS +41%
- **BUT**: AI 코드 생성 품질 치명적 — Svelte 5 Runes가 LLM 혼란 유발
- React/Next.js 학습 데이터 압도적 → AI 코드 생성 정확도 최고
- Bun 1.3: 10x startup, 10.7x HTTP throughput vs Node.js

**Core-Tech-Conservative:**
- Lichess 벤치마크: 단일 서버에서 100K+ 동접 (Scala + PostgreSQL)
- Node.js 22 LTS: 15년 검증, npm 생태계 최대
- PostgreSQL 16: 30+ years, 가장 안정적인 RDBMS

**Architecture-Evolutionary:**
- 8-10주 만에 MVP 아키텍처 완성 (Big Bang 20-24주 대비)
- 모듈 경계에 "분리 이음새(seams)" 내장 → Phase 2 서비스 추출 용이
- Lichess 69개 모듈 단일 배포 패턴

**Architecture-BigBang:**
- 7개 모듈 DDD Bounded Context 설계
- KataGo Analysis Engine Mode 상세: JSON stdin/stdout, GTP 대비 3-5x 빠름
- LLM 3-Tier Fallback 상세 설계

**Workflow-Rapid:**
- Day 3 첫 배포, Week 6 MVP 가능
- 25-30개 기능 6개월 내 (품질 희생)
- Docker Compose 로컬 → Railway 배포 (<1분)

**Workflow-Robust:**
- 주간 배포 + 품질 게이트
- 15-18개 기능 6개월 (견고)
- **Strategic TDD가 AI agent를 오히려 가속** (DORA 2025, Latent Space 2026)

**Debt-Practical:**
- Ship First, Clean Later — Month 1-3 부채 허용
- Month 4-5부터 15% → Month 6 25% 부채 갚기
- TODO/FIXME 기반 추적

**Debt-Minimized:**
- SQALE Rating A (≤5%) 유지
- 속도 곡선: 0.7x (초기 느림) → 1.8x (Month 4+ 가속)
- AI 코드 클로닝 4x 문제 → SonarQube 3% threshold로 구조적 억제

**Theory-Modern:**
- XAI 2.0: Explainable AI 최신 프레임워크
- WebTransport: WebSocket 후속 — Safari 미지원으로 시기상조
- CRDTs: 턴제 바둑에는 오버킬
- MCP (Model Context Protocol): 도구 통합 표준

**Theory-Classical:**
- Codd 관계형 이론 (1970): PostgreSQL 정당화
- Parnas 모듈 분해 (1972): 모듈러 모놀리스 정당화
- Conway 법칙 (1967): 팀 구조 = 시스템 구조
- 9.5/10 이론적 확실성 (Modern 8.5/10 대비)

#### 기술 선택 합의 스택

```
┌──────────────────────────────────────────────────────────────────┐
│                    PHASE 1 합의 스택                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Frontend: Next.js 15 + React + TypeScript strict                  │
│  Runtime:  Node.js (버전 미확정 — Bun vs LTS 분쟁)                  │
│  ORM:      Drizzle ORM (no codegen)                                │
│  DB:       PostgreSQL + Redis                                      │
│  AI:       KataGo Analysis Engine (CPU Eigen)                      │
│  LLM:     Claude API 3-tier (Haiku → Sonnet → Template fallback)   │
│  Rating:   Glicko-2                                                │
│  Realtime: WebSocket (→ WebTransport 업그레이드 경로)               │
│  Test:     Vitest + Playwright + SonarQube                         │
│  Deploy:   Docker Compose → Railway/Fly.io                         │
│  Arch:     Modular Monolith (DDD Bounded Context)                  │
│  AI Dev:   60-65% AI 구현 + 다층 검증 파이프라인                    │
│                                                                    │
│  월 인프라: $55-150 (GPU 없음)                                     │
│  개발비:    ~$0 (AI workflow)                                      │
│  6개월 기능: 15-18개 (견고함 우선)                                  │
│  이론 기반: 9+/10 (Classical + Modern 하이브리드)                   │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## <a id="phase-2"></a>PHASE 2: 4개 관점별 토론 결과

### 토론 구조
PHASE 1의 10개 Branch 결과를 입력으로, 4개 관점(Latest Tech, Stability, Speed, Maintainability)이 각각 완전한 기술 PRD를 작성.

### 4개 관점별 기술 선택 비교표

| 기술 | 최신 우선 (2.A) | 안정성 우선 (2.B) | 속도 우선 (2.C) | 유지보수 우선 (2.D) | 합의도 |
|------|:---:|:---:|:---:|:---:|:---:|
| **Next.js (React)** | ✓ (16.1) | ✓ (15) | ✓ (15) | ✓ (15) | **4/4** ✅ |
| **TypeScript strict** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **PostgreSQL** | ✓ (17) | ✓ (16) | ✓ (16) | ✓ (16) | **4/4** ✅ |
| **Drizzle ORM** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **KataGo CPU Eigen** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **Claude API 3-tier** | ✓ (Haiku primary) | ✓ (graceful degrade) | ✓ | ✓ | **4/4** ✅ |
| **Glicko-2** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **WebSocket** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **Vitest + Playwright** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **SonarQube** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **Evolutionary Arch** | ✓ | ✓ | ✓ | ✓ (Structured) | **4/4** ✅ |
| **SQALE ≤5%** | ✓ | ✓ | ✓ | ✓ | **4/4** ✅ |
| **Bun runtime** | ✓ | △ (Node LTS 선호) | △ | △ | **1/4** |
| **Valkey (vs Redis)** | ✓ | △ (Redis 선호) | △ | △ | **1/4** |
| **Biome (vs ESLint)** | ✓ | △ | △ | △ | **1/4** |
| **Daily deploy** | ✓ | △ (weekly) | ✓ | ✓ (with gates) | **3/4** |
| **Test coverage** | 80% | 80%+100% game | 60-70% strategic | 80%+100% E2E | **다양** |

### 핵심 분쟁 사항

| 분쟁 항목 | LatestTech (2.A) | Stability (2.B) | Speed (2.C) | Maintainability (2.D) |
|----------|:---:|:---:|:---:|:---:|
| Runtime | **Bun** | Node LTS | — | — |
| Cache | **Valkey** | Redis | — | — |
| Linter | **Biome** | ESLint | — | — |
| Deploy 주기 | Daily | **Weekly** | Daily | Daily+gates |
| PG 버전 | **17** | 16 | 16 | 16 |
| 커버리지 | 80% | 80%+100% game | 60-70% | 80%+100% E2E |

### 각 관점 핵심 인사이트

**Branch 2.A — Latest Tech First:**
- "Calculated Cutting-Edge" 접근 — 무조건 최신이 아니라, AI Buildability 게이트 통과 시만 최신
- 3-gate test: AI Buildability → Scale Relevance → Risk Proportionality
- Next.js 16.1 + Bun + PostgreSQL 17 + Valkey + Biome
- Coolify + Hetzner: 월 $17 서버 (Vercel 대비 90% 절감)
- 합의 스택 대비 오직 +1주 추가 리스크

**Branch 2.B — Stability First:**
- Composite Stability Score: **9.2/10** (합의 스택으로도 이미 매우 높음)
- Claude API가 최약 링크 (7/10) — 2025년 다수 장애 기록 → graceful degradation 필수
- PostgreSQL (10/10), Glicko-2 (10/10), Redis (9.5/10) — 수십 년 검증
- CVE-2025-66478: Next.js RCE (CVSS 10.0) — 패치됐으나 우려. v14 안전
- Weekly deploy + hotfix 예외 권장
- 80% 전체 + 100% 게임 로직 커버리지

**Branch 2.C — Speed First:**
- **Day 3** 첫 배포 가능, **Week 6** MVP
- Strategic TDD가 AI agents를 **오히려 가속** (반직관적 발견 — DORA 2025)
- Drizzle > Prisma for speed: `prisma generate` 단계 제거
- Evolutionary arch = MVP 4주 더 빠름 (Big Bang 대비)
- Railway → 최속 배포 (<1분)
- Velocity: 1.0x steady → 1.4x by month 6

**Branch 2.D — Maintainability First:**
- 유지보수 = **총 비용의 50-80%** — 장기적으로 가장 중요
- AI 코드 클로닝 4x rate (GitClear 2025) → SonarQube 3% threshold
- **10가지 유지보수 규칙**: 500 LOC max, 복잡도 ≤15, barrel exports, no-any 등
- Structured Evolutionary = Evolutionary + 명확한 경계 (Day 1부터)
- Daily deploy WITH quality gates
- OpenTelemetry + Grafana for observability
- AI 에이전트 유지보수성: Next.js (8.6/10) >> SvelteKit (6.8/10)

---

## <a id="phase-3"></a>PHASE 3: 3개 기술 시나리오 PRD

### 시나리오 A: Cutting Edge

**"최신 기술이 우리를 더 강하게 만든다"**

> 전체 상세: `/prompt/phase3a-cutting-edge-technology-scenario.md` (721 lines)

**기술 스택 (16 Layers):**

| Layer | Primary | Key Advantage |
|-------|---------|---------------|
| Runtime | Bun 1.3+ | HTTP 10.7x faster, startup 10x, memory -26% vs Node.js |
| Frontend | Next.js 16 + React Compiler 1.0 | Turbopack default, HMR 18ms (28x faster), build -77% |
| Database | PostgreSQL 17 | VACUUM 20x memory reduction, WAL 2x throughput |
| Cache | Valkey 8.1 | 37% faster writes, 22% less memory, BSD license (Redis SSPL 회피) |
| ORM | Drizzle ORM | No codegen, 2-3x faster than Prisma, 7.4KB bundle |
| Real-time | ws (Native WebSocket) | 오버헤드 제거, 10K+ 동시 연결 |
| AI Engine | KataGo v1.16.2 (CPU Eigen) | MIT 라이선스, 프로 9단+ 수준 |
| LLM | Claude API 3-Tier | Haiku 80% / Sonnet 15% / Template 5% |
| Rating | Glicko-2 | OGS/Lichess 검증 |
| Testing | Vitest 4.0 + Playwright | Browser Mode, Visual Regression |
| Linting | Biome v2.3 | 56x faster lint, 40x faster format, 단일 바이너리 |
| Quality | SonarQube Community | AI Code Assurance, SQALE ≤5% |
| Infra | Coolify + Hetzner | Vercel 대비 90% 비용 절감 |
| Monitor | Grafana Cloud Free | 무료 최대 10K 시계열 |
| Security | NextAuth.js v5 | OAuth (Google, GitHub, Discord) |
| CI/CD | GitHub Actions | Free tier 2,000분/월 |

**핵심 수치:**

| 항목 | 값 |
|------|---|
| 6개월 비용 | **$292** |
| 성공 확률 | **65-70%** (풀 스코프 7.5개월 내) |
| 일정 | **6.5-7.5개월** (+0.5-1.5 vs baseline) |
| AI 자동화율 | **55-65%** |
| DX 향상 | **2-5x** (Turbopack, Biome, Bun) |
| 기능 수 | **15개** |
| 위험도 | **높음** (통합 복잡도) |
| 핵심 리스크 | Bun 호환성 30%, LLM 환각 60%, Claude API 안정성 40% |
| Fallback | 모든 기술에 1-2일 내 전환 가능 |

---

### 시나리오 B: Balanced-Tech (최종 선택)

**"좋은 기술이지만, 우리가 할 수 있어야 한다"**

**핵심 철학:** 72% Proven + 28% Validated-Latest. AI agent가 잘 쓸 수 있는 기술만 선택. 혁신은 직접적 이점이 있을 때만.

**기술 스택:**

| Layer | Primary | 선택 유형 | 근거 |
|-------|---------|----------|------|
| Runtime | **Node.js 22 LTS** | Proven | AI 학습 데이터 최대, npm 100% 호환 |
| Frontend | **Next.js 15** (App Router) | Proven-Latest Hybrid | 18개월 성숙, App Router 안정 |
| UI | React 19 + TypeScript strict | Proven | AI 코드 생성 정확도 최고 |
| Database | **PostgreSQL 16** | Proven | 30+ years, 충분한 성능 |
| Cache | **Redis 7.2** | Proven | 15+ years, 9.5/10 안정성 |
| ORM | **Drizzle ORM** | Validated-Latest | No codegen → AI agent 최적 |
| Real-time | ws (Native WebSocket) | Proven | 바둑 저빈도 메시지에 충분 |
| AI Engine | KataGo v1.16.2 (CPU Eigen) | Industry Standard | MIT, 유일한 선택 |
| LLM | Claude API 3-Tier | Latest (필수) | Haiku/Sonnet/Template |
| Rating | Glicko-2 | Proven | Lichess/OGS 검증 |
| Testing | Vitest + Playwright | Validated-Latest | Strategic TDD |
| Linting | **Biome v2.3** | Validated-Latest | 56x faster → AI CI 반복 이점 |
| Quality | SonarQube Community | Proven | SQALE ≤5% |
| Infra | **Coolify + Hetzner** | Validated-Latest | 90% 비용 절감 |
| CI/CD | GitHub Actions | Proven | Free tier |
| Monitor | Grafana Cloud Free | Proven | 무료 |

**PHASE 2 분쟁 해결:**

| 분쟁 | 결정 | 근거 |
|------|------|------|
| Bun vs Node.js | **Node.js 22 LTS** | AI 학습 데이터 최대 |
| Valkey vs Redis | **Redis 7.2** | 15년 검증, 생태계 최대 |
| Biome vs ESLint | **Biome v2.3** | 56x 빠름 → AI CI 누적 이점 |
| PG 17 vs 16 | **PG 16** | 안정화 완료, 충분 |
| Daily vs Weekly deploy | **Daily + Quality Gates** | AI 빠른 반복 + 게이트 |
| Coverage | **80%/100%/90% 3-tier** | 전체/게임로직/E2E |

**핵심 수치:**

| 항목 | 값 |
|------|---|
| 6개월 비용 | **$430** |
| 성공 확률 | **70-75%** |
| 일정 | **6개월** (기준) |
| AI 자동화율 | **65-70%** |
| DX 향상 | **1.5-3x** |
| 기능 수 | **15-18개** |
| 위험도 | **3.5/5** |
| 핵심 차별화 | "Not a compromise, an optimization for AI agent developers" |
| 분기점 | Month 5 breakeven |

**마일스톤:**
- M1 (Month 1-2): Core Engine — PvP + AI 대국 + LLM 해설 프로토타입. Go/No-Go: LLM 70%+
- M2 (Month 3-4): Playable Beta — Quick Go + AI 해설 MVP. Go/No-Go: Beta DAU 100+
- M3 (Month 5-6): Public Launch — 온보딩 + 게이미피케이션 + Freemium. Go/No-Go: MAU 2K+

---

### 시나리오 C: Proven Stack

**"느려도 확실한 것이 낫다"**

**핵심 철학:** 5+ years 검증된 기술만 사용. 평균 검증 연수 10.5년. "지루하게 안정적."

**기술 스택:**

| Layer | Primary | 검증 연수 | 합의 이탈 여부 |
|-------|---------|----------|-------------|
| Runtime | **Node.js 22 LTS** | 15+ | — |
| Frontend | **Next.js 14** (v15/16 아닌) | 10+ (React 기반) | ⚠ CVE-2025-66478 리스크 회피 |
| UI | React 18 (v19 아닌) | 12+ | — |
| Database | **PostgreSQL 16** | 30+ | — |
| Cache | **Redis 7** | 15+ | — |
| ORM | **Prisma** (Drizzle 아닌) | 5+ | ⚠ **합의 이탈** — Drizzle 3년 미달 |
| Real-time | **Socket.IO** (ws 아닌) | 14+ | ⚠ 자동 재연결, 룸 추상화 |
| AI Engine | KataGo v1.16.2 (CPU Eigen) | — | — |
| LLM | Claude API 3-Tier | — | — |
| Rating | Glicko-2 | — | — |
| Testing | Vitest + Playwright | — | — |
| Linting | **ESLint + Prettier** (Biome 아닌) | 10+ | — |
| Quality | SonarQube Community | — | — |
| Infra | Railway 또는 Vercel | 5+ | — |
| Deploy | **Weekly** + manual QA gate | — | — |

**핵심 수치:**

| 항목 | 값 |
|------|---|
| 6개월 비용 | **$415-885** |
| 성공 확률 | **75-85%** (최고) |
| 일정 | **6개월** (가장 예측 가능) |
| AI 자동화율 | **70-75%** |
| 기능 수 | **13-15개** (2-3개 적음) |
| 위험도 | **1.4/5** (최저) |
| 핵심 차별화 | "The too-conservative failure mode: fewer features but everything works" |
| 합의 이탈 | Prisma (Drizzle 대신), ESLint (Biome 대신), Socket.IO (ws 대신) |

**Prisma vs Drizzle 분석 (시나리오 C 고유):**
- Prisma: 5+ years, 더 많은 AI 학습 데이터, 더 풍부한 생태계
- **BUT**: `prisma generate` 단계가 AI agent 워크플로우에 마찰 추가
- Proven Stack은 안정성 극대화를 위해 Prisma 선택, 다른 시나리오는 Drizzle 유지

---

### 3개 시나리오 비교 종합표

| 기준 | 3.A Cutting Edge | 3.B Balanced-Tech | 3.C Proven Stack |
|------|:---:|:---:|:---:|
| **핵심 철학** | 최신이 강하게 | AI agent 최적화 | 확실하게 |
| **성공 확률** | 65-70% | **70-75%** | 75-85% |
| **6개월 비용** | $292 | $430 | $415-885 |
| **기능 수** | 15 | **15-18** | 13-15 |
| **일정** | 6.5-7.5개월 | **6개월** | 6개월 |
| **위험도** | 4/5 | 3.5/5 | **1.4/5** |
| **DX 향상** | **2-5x** | 1.5-3x | 1x |
| **AI 자동화율** | 55-65% | 65-70% | **70-75%** |
| **Runtime** | Bun | Node.js 22 | Node.js 22 |
| **Next.js** | 16 | 15 | 14 |
| **ORM** | Drizzle | Drizzle | Prisma |
| **Cache** | Valkey | Redis | Redis |
| **Linter** | Biome | Biome | ESLint |
| **Deploy** | Daily | Daily+gates | Weekly |
| **합의 존중도** | 중간 | **최고** | 낮음 (3건 이탈) |

---

## <a id="phase-4"></a>PHASE 4: 최종 기술 로드맵 확정

> 전체 상세: `/prompt/phase4-final-technology-roadmap.md`

### 시나리오 선택: **Balanced-Tech (3.B)**

**선택 근거 5가지:**

1. **AI agent 최적화가 핵심** — 개발팀이 AI agents이므로 "AI가 잘 쓸 수 있는 기술"이 제1 원칙
2. **72% Proven + 28% Validated Latest = Goldilocks Zone** — 검증된 곳은 안전하게, 혁신적인 곳은 AI 마찰 감소 확인 후만
3. **6개월 일정 충족** — Cutting Edge의 +0.5-1.5개월 리스크 제거
4. **PHASE 2 합의 최대 존중** — 11개 만장일치 + 6개 분쟁 중 5개 Stability 측, 1개(Biome) Latest 측
5. **비용 대비 가치 최적** — $430/6개월로 15-18개 기능

**버린 시나리오:**

| 시나리오 | 미선택 핵심 이유 |
|---------|----------------|
| 3.A Cutting Edge | Bun 학습 데이터 부족, Next.js 16 RC 불안정, +0.5-1.5개월 리스크, DX 향상이 AI에게 무의미 |
| 3.C Proven Stack | Prisma codegen이 AI 마찰 추가, ESLint CI 56x 느림, Next.js 14 레거시, 기능 수 부족 |

### 최종 확정 스택

```
┌──────────────────────────────────────────────────────────────┐
│                    Balanced-Tech Stack v1.0                    │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  Frontend:  Next.js 15 + React 19 + TypeScript strict          │
│  Runtime:   Node.js 22 LTS                                     │
│  ORM:       Drizzle ORM (no codegen)                           │
│  Database:  PostgreSQL 16                                      │
│  Cache:     Redis 7.2                                          │
│  Queue:     BullMQ (Redis-based)                               │
│  Realtime:  ws (Native WebSocket)                              │
│  AI Engine: KataGo v1.16.2 (CPU Eigen)                         │
│  LLM:      Claude API 3-tier (Haiku/Sonnet/Template)           │
│  Rating:    Glicko-2                                           │
│  Auth:      NextAuth.js v5                                     │
│  UI:        Tailwind CSS 4 + shadcn/ui                         │
│  Lint:      Biome v2.3                                         │
│  Quality:   SonarQube Community (SQALE ≤5%)                    │
│  Test:      Vitest + Playwright (Strategic TDD)                │
│  CI/CD:     GitHub Actions                                     │
│  PaaS:      Coolify + Hetzner Cloud                            │
│  Monitor:   Grafana Cloud Free + Prometheus + Loki             │
│                                                                │
│  Architecture: Modular Monolith (Lichess pattern)              │
│  Dev Process:  Strategic TDD + Daily Deploy + Quality Gates    │
│  AI 자동화율:  65-70%                                          │
│  6개월 비용:   ~$300-430                                       │
│  성공 확률:    70-75%                                          │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 팀 서명

| 역할 | 판정 | 근거 |
|------|------|------|
| Frontend Lead | **현실적** | Next.js 15 + React 19, AI 코드 생성 85-90% |
| Backend Lead | **현실적** | Node.js 22 LTS + Drizzle, 가장 친숙한 조합 |
| DevOps Lead | **도전적이지만 가능** | Coolify 90% 절감이나 서버 관리 직접 필요 |
| AI/Game Engine Lead | **도전적이지만 가능** | KataGo IPC 20-30% 자동화, LLM 프롬프트 수동 |
| **최종** | **✅ 실행 가능** | 2명 현실적 + 2명 도전적이지만 가능 |

---

## Research 1 ↔ Research 2 교차 검증

| Research 1 (시장/사용자/비즈니스) | Research 2 (기술) | 정합성 |
|------|------|------|
| Balanced Scenario 선택 | Balanced-Tech 선택 | ✅ 일치 |
| MAU 8K, MRR $5K | 15-18 기능 달성 가능 | ✅ 일치 |
| 개발비 ~$0 | AI 자동화율 65-70% | ✅ 일치 |
| KataGo + Claude API | IPC 상세 + 3-Tier 설계 | ✅ 구체화 |
| Modular Monolith | Lichess 패턴 + DDD | ✅ 구체화 |
| 6개월 일정 | M1/M2/M3 + Go/No-Go | ✅ 구체화 |
| 인프라 $55-150/월 | Coolify+Hetzner €12-50/월 | ✅ 더 저렴 |
| LLM $100-300/월 | MAU 8K 기준 ~$34/월 | ✅ 더 저렴 |
| 비용 $1,130-2,600/6개월 | **$300-430/6개월** | ✅ 대폭 하향 |

---

## 상세 문서 참조

| 문서 | 내용 | 위치 |
|------|------|------|
| Research 1 전체 | 시장/사용자/비즈니스 PRD | `/prompt/prd-research-phase1-market-user-tech-biz.md` |
| Cutting Edge 시나리오 상세 | 3.A 721줄 전체 | `/prompt/phase3a-cutting-edge-technology-scenario.md` |
| PHASE 4 최종 로드맵 상세 | 마일스톤/비용/서명 | `/prompt/phase4-final-technology-roadmap.md` |
| 프레임워크 원본 | 실행 지침서 | `/prompt/Technology_Development_DeepDive_PRD_Teammate_Executable.md` |
