# PHASE 4: 최종 기술 로드맵 확정

> **작성일**: 2026-03-10
> **프로세스**: Technology_Development_DeepDive_PRD_Teammate_Executable.md PHASE 4
> **입력**: PHASE 1 (10 Branch) + PHASE 2 (4 Discussion) + PHASE 3 (3 Scenario)
> **의사결정자**: Orchestrator (전체 데이터 통합)

---

## STEP 1: 3개 시나리오 재검토 + 팀 상황 평가

### 팀 기술 역량

| 영역 | 수준 | 근거 |
|------|------|------|
| 프론트엔드 | **높음** | AI agents — React/Next.js 학습 데이터 최다, 코드 생성 정확도 85-90% |
| 백엔드 | **높음** | AI agents — Node.js/Express 패턴 풍부, CRUD 자동화율 80%+ |
| DevOps/인프라 | **중간** | AI agents — Docker/CI 설정 가능하나, 서버 관리는 인간 리드 필요 |
| 게임 도메인 | **낮음** | 바둑 규칙 엔진, KataGo IPC, LLM 프롬프트 설계 — AI 자동화율 20-50% |
| **평균** | **중간-높음** | CRUD/UI/인프라 높음, 도메인 로직 낮음 → **Balanced-Tech 적합** |

### 시장 요구

| 항목 | 수준 | 근거 |
|------|------|------|
| 기술 혁신 필요도 | **중간** | "Why?" AI 해설은 혁신적이나, 핵심은 LLM 활용이지 프레임워크 자체가 아님 |
| 시간 압박 | **중간** | 6개월 목표이나, 경쟁자(OGS/Fox)는 AI 해설 미보유 → 1-2개월 여유 있음 |
| 성능 요구 | **낮음** | MAU 8K, 동접 최대 수백 명 — 단일 서버로 충분 |
| → 판정 | **Balanced-Tech** | 과도한 혁신 불필요, 과도한 보수도 불필요 |

### 리소스 제약

| 항목 | 상태 | 근거 |
|------|------|------|
| 개발 기간 | **충분** | 6개월 + 경쟁 압박 낮음 |
| 개발 인력 | **충분** | AI agents + 인간 리드 1명. 개발비 ~$0 |
| 학습 시간 | **부족** | AI agents는 학습 데이터 기반 — 최신 기술은 데이터 부족 리스크 |
| → 판정 | **Balanced-Tech** | 학습 시간 부족 → Cutting Edge 배제, 기간 충분 → Proven Stack 불필요 |

### 운영 계획

| 항목 | 답변 | 근거 |
|------|------|------|
| 장기 운영 | **예** | 18개월+ 계획, MAU 50K 목표 |
| 지속적 개선 | **예** | Phase 2 기능 지속 추가 (B2B LMS, 네이티브 앱, GPU 전환) |
| 기술 부채 감당 | **제한적** | AI 코드 1.7x 이슈율 → 부채 누적 속도 빠름 → 선제 관리 필수 |
| → 판정 | **Balanced-Tech** | 장기 운영 + 부채 관리 = 품질 우선 선택 |

### 3개 시나리오 비교 종합

| 기준 | 3.A Cutting Edge | **3.B Balanced-Tech** | 3.C Proven Stack |
|------|------------------|-----------------------|------------------|
| **핵심 철학** | "최신이 우리를 강하게" | **"좋은 기술 + 할 수 있어야"** | "느려도 확실하게" |
| **성공 확률** | 65-70% | **70-75%** | 75-85% |
| **6개월 비용** | $292 | **$430** | $415-885 |
| **기능 수** | 15 | **15-18** | 13-15 |
| **일정** | 6.5-7.5개월 | **6개월** | 6개월 |
| **위험도** | 4/5 | **3.5/5** | 1.4/5 |
| **DX 향상** | 2-5x | **1.5-3x** | 1x (기준) |
| **AI 자동화율** | 55-65% | **65-70%** | 70-75% |
| **기술 부채** | 높음 | **중간 (통제)** | 낮음 |
| **Fallback 범위** | 전체 | **전체** | 불필요 |
| **ORM** | Drizzle | **Drizzle** | Prisma (합의 이탈) |
| **Linter** | Biome | **Biome** | ESLint+Prettier |
| **Runtime** | Bun 1.3+ | **Node.js 22 LTS** | Node.js 22 LTS |
| **DB** | PG 17 | **PG 16** | PG 16 |
| **Cache** | Valkey 8.1 | **Redis 7** | Redis 7 |
| **Deploy** | Daily | **Daily + gates** | Weekly |
| **핵심 차별화** | DX 극대화 | **AI agent 최적화** | 안정성 극대화 |

---

## 시나리오 선택: **Balanced-Tech (3.B)**

### 선택 근거 5가지

1. **AI agent 최적화가 핵심** — 우리 개발팀은 AI agents. Balanced-Tech는 "AI agent가 잘 쓸 수 있는가?"를 모든 선택의 기준으로 삼음. Cutting Edge는 DX 향상이 목적이나 AI 학습 데이터 부족이 역효과.

2. **72% Proven + 28% Validated Latest = Goldilocks Zone** — Node.js 22, PG 16, Redis 7 (검증됨) + Biome, Drizzle (혁신적이나 AI 마찰 감소 확인됨). "혁신은 직접적 이점이 있을 때만."

3. **6개월 일정 충족** — Cutting Edge는 +0.5-1.5개월 리스크. Balanced-Tech는 기준 일정 유지. 사용자의 6개월 목표에 부합.

4. **PHASE 2 합의 최대 존중** — 4/4 만장일치 11개 항목 모두 수용. 6개 분쟁 중 5개를 Stability 측으로, 1개(Biome)를 Latest 측으로 해결. 합의 기반이 가장 넓음.

5. **비용 대비 가치 최적** — $430/6개월로 15-18개 기능. Cutting Edge($292)보다 비싸지만 일정 리스크 제거. Proven Stack($415-885)과 유사 비용이나 기능 2-5개 더 많음.

### 버린 시나리오

**3.A Cutting Edge 배제 이유:**
- Bun 1.3+: AI 학습 데이터 Node.js 대비 부족, npm 호환 95%는 "5% 디버깅 시간"을 의미
- Next.js 16: RC 상태, AI agents에게 예측 불가능한 API 변경은 치명적
- 개발 기간 +0.5-1.5개월: 사용자의 6개월 일정 위반 리스크
- DX 향상의 수혜자가 "인간 개발자"이지 AI agent가 아님 (HMR 18ms는 AI에게 무의미)

**3.C Proven Stack 배제 이유:**
- Prisma 선택이 PHASE 2 합의(Drizzle) 위반 — `prisma generate` 단계가 AI agent 워크플로우에 마찰 추가
- ESLint+Prettier: CI 시간 56x 느림 — AI agent의 반복 빌드에서 누적 손실
- Next.js 14: App Router가 v15에서 성숙 — v14는 이미 레거시 경로
- 13-15개 기능은 시장 진입에 불충분할 수 있음 (게이미피케이션 미포함 시 OGS 5% 잔존율 개선 불가)
- Weekly deploy는 AI agent의 빠른 반복 사이클과 부조화

---

## STEP 2: 선택된 시나리오의 상세 기술 로드맵

### 전체 기술 스택 상세

#### Frontend Layer

| 항목 | 상세 |
|------|------|
| **프레임워크** | Next.js 15.x (App Router, latest stable) |
| **UI 라이브러리** | React 19 + TypeScript strict |
| **빌드 도구** | Turbopack (Next.js 15 내장, opt-in stable) |
| **상태관리** | React Server Components + zustand (클라이언트 상태) |
| **UI 컴포넌트** | Tailwind CSS 4 + shadcn/ui |
| **바둑판 렌더링** | React Canvas (SVG fallback) |
| **테스트** | Vitest (unit/component) + Playwright (E2E) |
| **선택 유형** | Proven-Latest Hybrid (Next.js 15: 18개월 성숙, React 19: stable) |

#### Backend Layer

| 항목 | 상세 |
|------|------|
| **런타임** | Node.js 22 LTS (15년 검증, 최대 학습 데이터) |
| **프레임워크** | Next.js 15 API Routes (별도 서버 불필요) |
| **API 설계** | REST (AI agents에게 가장 친숙) + WebSocket (대국 전용) |
| **인증** | NextAuth.js v5 (OAuth — Google, GitHub, Discord) |
| **로깅** | Pino (structured JSON, 10x faster than Winston) |
| **선택 유형** | Proven (Node.js 22 LTS, 8+ years in production) |

#### Data Layer

| 항목 | 상세 |
|------|------|
| **Primary DB** | PostgreSQL 16 (30+ years proven, ACID) |
| **ORM** | Drizzle ORM (no codegen, SQL 투명성, AI agent 최적) |
| **Cache** | Redis 7.2 (15+ years proven, 9.5/10 안정성) |
| **Message Queue** | BullMQ (Redis 기반, KataGo 분석 큐) |
| **Search** | PostgreSQL Full-Text Search (Phase 1 충분) |
| **선택 유형** | Proven (PG 16, Redis 7) + Validated-Latest (Drizzle) |

#### AI/Game Engine Layer

| 항목 | 상세 |
|------|------|
| **바둑 AI** | KataGo v1.16.2 (CPU Eigen backend, MIT 라이선스) |
| **통신 방식** | Analysis Engine Mode (JSON stdin/stdout IPC) |
| **성능** | 3-8초 분석, 동시 3-5세션 (CPU) |
| **모델** | b28c512nbt (최신, 이전 대비 200-300 Elo 향상) |
| **LLM Pipeline** | Claude API 3-Tier: Haiku 4.5 (80%) → Sonnet 4.6 (15%) → Template (5%) |
| **레이팅** | Glicko-2 (glicko2.ts, Lichess/OGS 검증) |
| **실시간** | ws (Native WebSocket) — 바둑 대국은 저빈도 메시지 |
| **선택 유형** | Industry Standard (KataGo) + Latest (Claude API) |

#### Infrastructure Layer

| 항목 | 상세 |
|------|------|
| **PaaS** | Coolify (self-hosted, Vercel 대비 90% 비용 절감) |
| **Cloud** | Hetzner Cloud |
| **컨테이너화** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions (Free tier: 2,000분/월 private) |
| **모니터링** | Grafana Cloud Free + Prometheus + Loki |
| **배포 방식** | Rolling Update (Coolify), Zero-downtime |
| **선택 유형** | Validated-Latest (Coolify) + Proven (Docker, GitHub Actions) |

#### Quality & Security Layer

| 항목 | 상세 |
|------|------|
| **Linter/Formatter** | Biome v2.3 (56x faster, 단일 도구) |
| **코드 품질** | SonarQube Community (SQALE ≤5%) |
| **보안** | NextAuth.js v5, Rate Limiting (Redis), CORS, CSP, HTTPS |
| **의존성 관리** | GitHub Dependabot + npm audit |
| **테스트 전략** | Strategic TDD — AI agent가 테스트 주도 코드 작성 |
| **커버리지** | 전체 80% + 게임 로직 100% + E2E 90% |
| **선택 유형** | Validated-Latest (Biome) + Proven (SonarQube) |

### PHASE 2 분쟁 해결 요약

| 분쟁 항목 | 결정 | 근거 |
|----------|------|------|
| Runtime: Bun vs Node.js | **Node.js 22 LTS** | AI 학습 데이터 최대, npm 100% 호환, 15년 검증 |
| Cache: Valkey vs Redis | **Redis 7.2** | 15년 검증, 9.5/10 안정성, 생태계 최대 |
| Linter: Biome vs ESLint | **Biome v2.3** | 56x 빠름 → AI agent CI 반복에 누적 이점, 단일 설정 |
| PG Version: 17 vs 16 | **PG 16** | 30+ years proven, 충분한 성능, 안정화 완료 |
| Deploy: Daily vs Weekly | **Daily + Quality Gates** | AI agent 빠른 반복 + SonarQube/Vitest 게이트로 품질 보장 |
| Coverage: 다양 | **80%/100%/90% 3-tier** | 전체 80%, 게임 로직 100%, E2E 크리티컬 패스 90% |

---

### 개발 프로세스 정의

#### 1. 로컬 개발 환경

| 항목 | 상세 |
|------|------|
| 세팅 시간 | **~15분** (Node.js 22 + Docker + npm install + DB 초기화) |
| 자동화 수준 | 높음 (docker compose + npm scripts) |
| 문서 | 충분 (Next.js 15 + Node.js — 최대 문서량) |

```bash
# Prerequisites: Node.js 22 LTS, Docker
git clone <repo>
cd baduk-platform
npm install                           # ~15s
docker compose up -d                  # PostgreSQL 16 + Redis 7.2 (~15s)
npx drizzle-kit push                  # Schema push (~3s)
npm run katago:setup                  # Download KataGo binary + model (~60s first time)
npm run dev                           # Next.js 15 + Turbopack (~3s cold start)
```

#### 2. 개발 사이클

```
AI Agent writes code
    ↓
Biome pre-commit lint+format (0.8s)
    ↓
Vitest unit/component tests (10s)
    ↓
Git push → GitHub Actions CI
    ↓
  ├─ Biome lint (~1s)
  ├─ Vitest (~10s)
  ├─ Playwright E2E (~30s)
  ├─ SonarQube scan (~60s)
  └─ Next.js build (~15s)
    ↓
Quality Gate pass → Coolify auto-deploy (~30s)

Total cycle: ~3 minutes from commit to production
```

- 전체 사이클 시간: **2-4시간** (기능 단위), **3분** (커밋→배포)

#### 3. 배포 전략

| 항목 | 상세 |
|------|------|
| 배포 빈도 | **일 2-5회** (AI agent 작업 속도에 따라) |
| 배포 방식 | **Rolling Update** (Coolify, zero-downtime) |
| Rollback 계획 | **자동** — Coolify 원클릭 이전 버전 복구 |
| 블루-그린 | Phase 2 (MAU 10K+) 시 도입 |
| 품질 게이트 | SonarQube SQALE ≤5% + Vitest pass + Playwright pass |

#### 4. 품질 관리

| 항목 | 목표 |
|------|------|
| 단위 테스트 | 커버율 80%+ (Vitest) |
| 게임 로직 테스트 | 커버율 100% (계가, 패, 사활, 레이팅) |
| 통합 테스트 | 자동 (GitHub Actions) |
| E2E 테스트 | 자동 (Playwright), 크리티컬 패스 90% |
| 성능 테스트 | 월 1회 (k6 또는 Artillery) |
| AI 코드 품질 | SonarQube AI Code Assurance — 클로닝 4x 문제 감시 |

---

### 기술 부채 관리 계획

#### 1. 예상 기술 부채

| 항목 | 우선순위 | 예상 발생 시점 |
|------|----------|--------------|
| AI 생성 코드 중복 (4x cloning) | 높음 | Month 1부터 지속 |
| KataGo IPC 에러 핸들링 미비 | 높음 | Month 1-2 |
| LLM 프롬프트 하드코딩 | 중간 | Month 2-3 |
| 테스트 부족 영역 (WebSocket) | 중간 | Month 2-4 |
| CSS/UI 일관성 부족 | 낮음 | Month 3-5 |
| DB 인덱스 최적화 | 낮음 | Month 4-6 |

#### 2. 부채 갚기 계획

- 스프린트 **20%를 부채 갚기에 할당** (AI agent에게 리팩토링 태스크 지시)
- **월 1회** SonarQube 리포트 기반 부채 정리 회의
- **분기마다** 큰 리팩토링 (모듈 경계 강화, 중복 제거)
- SQALE 부채 비율 **3% 이하** 목표 (Balanced Scenario 기준)

#### 3. 모니터링

| 항목 | 도구 | 목표 |
|------|------|------|
| 코드 메트릭 | SonarQube Community | SQALE ≤5%, 중복률 <3% |
| 기술 부채 지수 | SonarQube SQALE Rating | **A** (≤5% ratio) |
| AI 코드 클로닝 | SonarQube Duplication | <3% threshold |
| 복잡도 | SonarQube Cognitive Complexity | ≤15 per function |
| 모듈 크기 | ESLint/Biome rule | ≤500 LOC per module |

---

### 마일스톤

#### M1 (Month 1-2): Foundation + Core Engine

**기능:**
- 프로젝트 초기화 (Node.js 22 + Next.js 15 + Biome + Drizzle)
- PostgreSQL 16 스키마 설계 (유저, 대국, 기보)
- NextAuth.js 인증 (Google, GitHub)
- KataGo v1.16.2 IPC 통합 (Analysis Engine Mode)
- Go 규칙 엔진 기본 구현 (19×19, 9×9, 13×13)
- 바둑판 UI 컴포넌트 (React Canvas/SVG)
- PvP 대국 (WebSocket 실시간)
- KataGo AI 대국 (10단계)
- Glicko-2 레이팅 시스템
- LLM "Why?" 해설 프로토타입 (Claude Haiku 4.5)

**인프라:**
- Coolify + Hetzner CCX13 (€12/월) — 올인원 서버
- GitHub Actions CI/CD
- SonarQube 초기 설정
- Redis 7.2 세션/캐시

**품질:**
- 테스트 커버리지 > 40%, 게임 로직 > 80%
- SQALE < 3%
- Biome 0 warning

**Go/No-Go Gate (M1):**
- LLM 해설 정확도 **70%+** (유단자 5명 평가) → CONTINUE
- 70% 미만 → Template 전환 또는 프롬프트 재설계
- 코어 기능 2개 이상 미완성 → 스코프 축소

---

#### M2 (Month 3-4): Playable Beta

**기능:**
- Quick Go (9×9, 3분 블리츠)
- AI 대국 30단계 확장
- "Why?" 해설 3수준 (입문/중급/고급)
- LLM 환각 억제 시스템 (도메인 검증 레이어)
- 대국 히스토리/통계
- 기본 프로필/설정

**인프라:**
- KataGo 분석 큐 시스템 (BullMQ)
- 서버 분리 시작 (App + DB 분리)
- 모니터링 대시보드 (Grafana)

**품질:**
- 테스트 커버리지 > 55%, 게임 로직 100%
- LLM 정확도 > 75%
- P95 응답 < 500ms

**Go/No-Go Gate (M2):**
- Beta DAU **100+** → CONTINUE
- 50 미만 → UX 재설계
- Quick Go 시작율 **20%+** → CONTINUE

---

#### M3 (Month 5-6): Public Launch

**기능:**
- Zero-to-First-Game 온보딩 (5분 인터랙티브 튜토리얼)
- PWA 설정 (모바일 최적화)
- 글로벌 ELO 매칭 시스템
- AI fallback 매칭 (유저풀 부족 시 KataGo 대체)
- 성장 여정 게이미피케이션 기본 (일일 퀘스트, 레벨, 스트릭)
- Freemium 결제 통합 (Stripe — $9.99/월 Premium)
- i18n (영어 + 한국어)
- 이용약관/개인정보처리방침
- 최종 QA + 부하 테스트

**인프라:**
- CCX23 + CCX13 2서버 구성 (€36/월)
- CDN (Hetzner 내장)
- 백업 자동화
- WAF 기본 설정

**품질:**
- 테스트 커버리지 > 75%, 게임 로직 100%, E2E 크리티컬 90%
- SQALE < 5%
- LLM 정확도 > 80%
- Core Web Vitals: LCP < 2.5s, INP < 200ms
- Lighthouse > 90

**Go/No-Go Gate (M3):**
- MAU **2K+** & 유료 **50+** → CONTINUE to Phase 2
- MAU 500 미만 → B2B pivot 검토

---

### Infrastructure Evolution

```
Month 1-2:  1 서버 (CCX13, €12/월)          → 올인원 (App+DB+Redis+KataGo)
Month 3-4:  2 서버 (CCX23+CCX13, €36/월)    → App/DB 분리
Month 5-6:  2-3 서버 (€36-50/월)            → KataGo 전용 서버 추가 (필요시)
Month 7-12: 3 서버 (€50-80/월)              → 수평 확장
Month 13+:  4-6 서버 (€100-150/월)          → KataGo GPU 전환 고려
```

### Quality Metrics Evolution

| 지표 | M1 | M2 | M3 | M4 | M5 | M6 |
|------|-----|-----|-----|-----|-----|-----|
| 테스트 커버리지 | 40% | 55% | 65% | 70% | 75% | 80%+ |
| 게임 로직 커버리지 | 80% | 100% | 100% | 100% | 100% | 100% |
| SQALE 부채 비율 | <3% | <3% | <4% | <4% | <5% | <5% |
| LLM 정확도 | 70% | 75% | 78% | 80% | 82% | 85%+ |
| Lighthouse | — | — | 75 | 80 | 85 | 90+ |
| P95 응답 시간 | — | <500ms | <300ms | <200ms | <200ms | <150ms |

---

## STEP 3: 팀의 기술 역량 준비

### 필요한 교육/학습

| 기술 | 학습 방법 | 시점 | 대상 |
|------|----------|------|------|
| KataGo Analysis Engine IPC | 공식 문서 + 오픈소스 코드 분석 | M1 초기 | 인간 리드 (수동 구현 영역) |
| LLM 바둑 프롬프트 설계 | 도메인 전문가 자문 + 반복 실험 | M1-M2 | 인간 리드 |
| Go 규칙 엔진 | GTP 표준 + SGF 파싱 | M1 | AI agent + 인간 검증 |
| Drizzle ORM 패턴 | 공식 문서 (AI agent 학습 데이터 풍부) | M1 초기 | AI agents |
| Biome v2.3 설정 | 기본 설정으로 충분 (커스텀 최소) | M1 Day 1 | AI agents |
| Coolify 서버 관리 | 공식 문서 + Docker 경험 | M1 초기 | 인간 리드 |
| Glicko-2 수학 | glicko2.ts 라이브러리 활용 (구현 불필요) | M1 | AI agents |

### 필요한 외부 지원

| 역할 | 필요 여부 | 상세 |
|------|----------|------|
| 바둑 도메인 자문 | **필요** (파트타임) | 유단자 1명 — LLM 해설 정확도 검증, 규칙 엣지 케이스, M1 Go/No-Go 평가단 |
| 외부 컨설턴트 | 불필요 | 기술 스택 모두 공개 문서 충분 |
| 디자인 | 최소 | shadcn/ui 기반 + Tailwind. 바둑판은 Canvas 직접 구현 |

### 문서화 계획

| 문서 | 도구 | 시점 |
|------|------|------|
| 아키텍처 다이어그램 | Mermaid (코드 내장) | M1 Week 1 |
| API 문서 | Next.js API Routes 자체 문서화 | M1-M2 (지속) |
| 개발 가이드 | CLAUDE.md / AGENTS.md 패턴 | M1 Week 1 |
| KataGo IPC 프로토콜 | Markdown (프로젝트 내) | M1 Week 2 |
| LLM 프롬프트 설계서 | Markdown (프로젝트 내) | M1 Week 3 |

---

## STEP 4: 최종 기술 검증 (팀 서명)

> PHASE 1-3에서 활동한 가상 전문가들의 관점을 종합하여 최종 서명.

```
✅ Frontend Lead: [현실적]
   근거: Next.js 15 + React 19은 AI 코드 생성 정확도 최고 (85-90%).
   TypeScript strict + shadcn/ui로 AI agent가 일관된 UI 생성 가능.
   Turbopack opt-in으로 빌드 속도도 확보.

✅ Backend Lead: [현실적]
   근거: Node.js 22 LTS + Drizzle ORM은 AI agent에게 가장 친숙한 조합.
   no-codegen 방식이 스키마 변경 → 코드 반영 사이클을 단축.
   WebSocket 대국 로직은 수동 구현 필요하나, 기본 패턴은 AI가 생성 가능.

✅ DevOps/Infrastructure Lead: [도전적이지만 가능]
   근거: Coolify + Hetzner는 Vercel 대비 90% 절감이나 서버 관리 직접 필요.
   Docker Compose 기반이므로 초기 세팅은 간단.
   Phase 2에서 서버 분리/확장 시 인간 리드의 DevOps 역량 필요.
   GitHub Actions CI/CD는 AI agent가 yml 작성 가능.

✅ AI/Game Engine Lead: [도전적이지만 가능]
   근거: KataGo IPC 통합은 AI agent 자동화율 20-30%로 대부분 수동.
   LLM 프롬프트 설계는 완전 수동. 그러나 이 둘은 전체 코드의 15-20%.
   나머지 80%는 AI agent가 충분히 구현 가능.
   M1 Go/No-Go에서 LLM 정확도 70%+ 검증이 핵심 관문.

결과:
- 2명 "현실적" + 2명 "도전적이지만 가능" = ✅ 실행 가능
- 특정 영역 강화 필요: KataGo 통합, LLM 프롬프트 설계, 서버 관리
- 이 3개 영역은 인간 리드가 직접 담당하고 AI agent에게 위임하지 않음
```

---

## STEP 5: 최종 결과물 확정

### 1. 최종 기술 스택

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
│  AI 자동화율:  65-70% (CRUD/UI/인프라), 20-50% (도메인)        │
│                                                                │
│  월 인프라: €12-50 ($13-55)                                    │
│  LLM API: $1-34/월 (MAU 비례)                                 │
│  개발비: ~$0 (AI agentic workflow)                             │
│  6개월 총비용: ~$430                                           │
│  6개월 기능: 15-18개                                           │
│  성공 확률: 70-75%                                             │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### 2. 개발 프로세스 정의

```
환경 세팅 (~15분)
    ↓
기능 설계 (인간 리드)
    ↓
Strategic TDD (AI agent: 테스트 먼저 → 구현 → 리팩토링)
    ↓
Biome pre-commit (0.8s)
    ↓
GitHub Actions CI (Biome + Vitest + Playwright + SonarQube + Build)
    ↓
Quality Gate PASS
    ↓
Coolify auto-deploy (30s, rolling update)
    ↓
Grafana 모니터링
```

### 3. 기술 부채 관리 계획

- SQALE Rating A 유지 (≤5%)
- 스프린트 20% 부채 갚기
- SonarQube AI Code Assurance로 클로닝 4x 문제 감시
- 월 1회 부채 정리, 분기 1회 대규모 리팩토링

### 4. 팀 준비 계획

- **인간 리드**: KataGo IPC + LLM 프롬프트 + 서버 관리 (M1 초기)
- **바둑 자문**: 유단자 1명 파트타임 (M1 Go/No-Go + 지속 검증)
- **AI agents**: 나머지 전체 (65-70% 자동 구현)

### 5. 마일스톤 및 완료 기준

| 마일스톤 | 기간 | 핵심 산출물 | Go/No-Go |
|---------|------|-----------|----------|
| M1 | Month 1-2 | Core Engine (PvP + AI + LLM 프로토타입) | LLM 정확도 70%+ |
| M2 | Month 3-4 | Playable Beta (Quick Go + 해설 MVP) | Beta DAU 100+ |
| M3 | Month 5-6 | Public Launch (온보딩 + 게이미피케이션 + Freemium) | MAU 2K+ & 유료 50+ |

### 6. 팀 서명 및 동의서

| 역할 | 판정 | 서명 |
|------|------|------|
| Frontend Lead | 현실적 | ✅ |
| Backend Lead | 현실적 | ✅ |
| DevOps Lead | 도전적이지만 가능 | ✅ |
| AI/Game Engine Lead | 도전적이지만 가능 | ✅ |
| **최종 판정** | **실행 가능** | **✅ 승인** |

### 7. PHASE 1-3 분석 문서 (선택하지 않은 이유 포함)

| 시나리오 | 선택 여부 | 미선택 이유 |
|---------|----------|-----------|
| 3.A Cutting Edge | ❌ | Bun 학습 데이터 부족, Next.js 16 RC 불안정, +0.5-1.5개월 리스크, DX 향상이 AI agent에게 무의미 |
| **3.B Balanced-Tech** | **✅ 선택** | AI agent 최적화, 72% Proven + 28% Latest, 6개월 일정 충족, 합의 최대 존중 |
| 3.C Proven Stack | ❌ | Prisma codegen이 AI 마찰 추가, ESLint CI 56x 느림, Next.js 14 레거시 경로, 기능 수 부족 |

---

## Cost Analysis Summary

### 6개월 총비용 상세

| 항목 | Month 1-2 | Month 3-4 | Month 5-6 | 6개월 총계 |
|------|-----------|-----------|-----------|-----------|
| Hetzner 서버 | €24 ($26) | €72 ($78) | €72-100 ($78-108) | $182-212 |
| 도메인 + DNS | $3 | $3 | $3 | $9 |
| LLM API (Claude) | $2 | $12 | $68 | $82 |
| SonarQube | $0 (Community) | $0 | $0 | $0 |
| Grafana | $0 (Free tier) | $0 | $0 | $0 |
| GitHub Actions | $0 (Free tier) | $0 | $0 | $0 |
| Stripe | $0 | $0 | ~$10 (수수료) | $10 |
| 기타 (이메일 등) | $0 | $0 | $0 | $0 |
| **소계** | **~$31** | **~$93** | **~$159-186** | **~$283-310** |

> **6개월 총비용: ~$300-430** (LLM 사용량 의존)
>
> vs 전통적 개발팀 6개월: $180-300K (3인 팀)
> → **비용 절감: 99.8-99.9%**

### LLM API 비용 최적화

| 전략 | 절감 효과 |
|------|----------|
| Prompt Caching (시스템 프롬프트) | 읽기 비용 -90% → 전체 -30% |
| Batch API (복기 리포트) | -50% → 전체 -8% |
| Haiku 80% 라우팅 | Sonnet 대비 70% 절감 |
| Template Fallback | API 장애 시 비용 $0 |
| **최적화 후 실질** | **위 금액의 약 60-70%** |

---

## 연구 통합: 두 PRD 연구의 교차 검증

### Research 1 (시장/사용자/비즈니스) → Research 2 (기술) 정합성

| Research 1 결론 | Research 2 검증 | 정합성 |
|----------------|----------------|--------|
| Balanced Scenario 선택 | Balanced-Tech 선택 | ✅ 일치 — 양쪽 모두 "균형" 원칙 |
| MAU 8K, MRR $5K | 15-18 기능으로 달성 가능 | ✅ 일치 |
| 개발비 ~$0 (AI workflow) | AI 자동화율 65-70% 확인 | ✅ 일치 |
| KataGo + Claude API | 상세 IPC 프로토콜 + 3-Tier 설계 | ✅ 구체화 |
| Modular Monolith | Lichess 패턴 + DDD Bounded Context | ✅ 구체화 |
| 6개월 일정 | M1/M2/M3 마일스톤 + Go/No-Go | ✅ 구체화 |
| 인프라 $55-150/월 | Coolify+Hetzner €12-50/월 ($13-55) | ✅ 실제로 더 저렴 |
| LLM $100-300/월 | MAU 8K 기준 ~$34/월 (최적화 후) | ✅ 실제로 더 저렴 |
| Next.js 15 + Node.js | Next.js 15 + Node.js 22 LTS 확정 | ✅ 일치 |
| PostgreSQL + Redis | PG 16 + Redis 7.2 확정 | ✅ 버전 구체화 |

### 핵심 업데이트 사항 (Research 2에서 새로 결정된 것)

| 항목 | Research 1 | Research 2 최종 |
|------|-----------|----------------|
| ORM | 미정 | **Drizzle ORM** (no codegen, AI agent 최적) |
| Linter | 미정 | **Biome v2.3** (56x faster) |
| 인프라 | Railway/Vercel 언급 | **Coolify + Hetzner** (90% 절감) |
| 테스트 | 미정 | **Vitest + Playwright** (Strategic TDD) |
| 코드 품질 | 미정 | **SonarQube Community** (SQALE ≤5%) |
| 레이팅 | ELO 언급 | **Glicko-2** (Rating Deviation으로 소규모 풀 대응) |
| 배포 빈도 | 미정 | **Daily + Quality Gates** |
| 모니터링 | 미정 | **Grafana Cloud Free + Prometheus** |
| 비용 모델 | $1,130-2,600/6개월 | **$300-430/6개월** (Coolify+Hetzner로 대폭 절감) |

---

> **이 기술 로드맵은 "AI agent가 만드는 바둑 플랫폼"이라는 고유한 제약 조건을 기술 선택의 제1 원칙으로 삼는다.**
>
> **"Our developers are AI agents — this changes every technology choice."**
