# PRD 4대 심층조사 통합 요약서

> **작성일**: 2026-03-10
> **성격**: 연구 통합 요약 (PRD 아님 — PRD 작성의 입력 자료)
> **프로세스**: Technology_Development_DeepDive_PRD_Teammate_Executable.md × 4회 독립 실행
> **총 투입 에이전트**: 66개 + 4 Orchestrator
> **핵심 발견**: 4개 독립 연구가 모두 Balanced-Tech를 선택 (4중 수렴)
> **1차 성찰**: 2026-03-10, 3개 teammate 병렬 투입 (본질/요구사항/정밀 검증)
> **1차 성찰 핵심**: 바둑 앱 조사는 충실하나, "자동 구현 workflow system" 관점의 조사가 구조적으로 부재
> **2차 성찰**: 2026-03-10, 3개 teammate 병렬 투입 (무료 전환 영향 분석/적대적 리뷰/사실 검증)
> **2차 성찰 핵심**: 서비스 모델이 Freemium → **완전 무료**로 전환. Stripe 제거, 비용 모델 근본 전환, KPI 체계 전면 교체
> **3차 성찰**: 2026-03-10, 3개 teammate 병렬 투입 (로컬 앱 전환 영향 분석/태스크 상태 조사)
> **3차 성찰 핵심**: 배포 모델이 SaaS → **사용자 로컬 데스크톱 앱**으로 전환. 서버 인프라 전면 제거, 월 운영비 $66→$2, 프레임워크 Next.js→Tauri+Vite+React

---

## 목차

1. [4대 연구 개요](#overview)
2. [4중 Balanced 수렴 분석](#convergence)
3. [통합 기술 스택](#unified-stack)
4. [통합 비용 분석](#unified-cost)
5. [통합 일정](#unified-timeline)
6. [통합 위험 레지스터](#unified-risk)
7. [교차 검증 매트릭스](#cross-validation)
8. [Research별 핵심 발견 요약](#per-research)
9. [미결 사항 및 PRD 작성 시 반영 필요 항목](#open-items)
10. [1차 성찰 결과](#reflection)
11. [2차 성찰: 완전 무료 전환 영향 분석](#reflection-2)
12. [3차 성찰: SaaS→로컬 앱 전환 영향 분석](#reflection-3)

---

## <a id="overview"></a>1. 4대 연구 개요

| # | 연구 주제 | 에이전트 | 시나리오 선택 | 파일 |
|---|----------|---------|-------------|------|
| R1 | 시장·사용자·비즈니스·기술 전략 | 15+1 | **Balanced** | `prd-research-phase1-market-user-tech-biz.md` |
| R2 | 기술 스택 심층조사 | 17+1 | **Balanced-Tech** | `prd-research-phase2-technology-deep-dive.md` |
| R3 | 바둑 도메인 기술 | 17+1 | **Balanced-Tech** | `prd-research-phase3-baduk-domain-tech.md` |
| R4 | 외부 연동 기술 | 17+1 | **Balanced-Tech** | `prd-research-phase4-external-integration.md` |

각 연구는 동일한 4-Phase 프로세스를 적용:
- **PHASE 1**: 8-10개 Branch 병렬 조사 (관점별 극단 탐색)
- **PHASE 2**: 4개 관점별 PRD 작성 (Latest Tech / Stability / Speed / Maintainability)
- **PHASE 3**: 3개 시나리오 비교 (Cutting Edge / Balanced-Tech / Proven Stack)
- **PHASE 4**: 최종 선택 + 교차 검증

---

## <a id="convergence"></a>2. 4중 Balanced 수렴 분석

### 수렴 사실

4개 완전히 독립된 연구가 서로 다른 도메인(시장 vs 기술 vs 바둑 vs 외부연동)을 조사했음에도, 동일한 결론에 도달:

```
Research 1 (시장/사용자/비즈) ──→ Balanced Scenario      ─┐
Research 2 (기술 스택)        ──→ Balanced-Tech Stack v1.0 ├─→ 4중 수렴
Research 3 (바둑 도메인)       ──→ Balanced-Tech           │
Research 4 (외부 연동)         ──→ Balanced-Tech           ─┘
```

### 수렴 근거 패턴

모든 연구에서 Balanced가 선택된 공통 논리:

| # | 패턴 | 설명 |
|---|------|------|
| 1 | **AI agent 개발 최적화** | 개발팀이 AI agent이므로, AI가 잘 쓸 수 있는 기술이 최우선 |
| 2 | **Day 1 차별화 보존** | "Why?" AI 해설을 런칭 시점에 포함 (Proven Stack은 이를 미뤄 moat 상실) |
| 3 | **비용-가치 최적** | Cutting Edge의 과잉 비용 없이, Proven Stack의 부족함 없이 |
| 4 | **성공 확률 최적 밴드** | Cutting Edge 60-78% ↔ **Balanced 70-91%** ↔ Proven 75-95% |
| 5 | **합의 최대 존중** | 각 연구 PHASE 1의 Branch 전원 합의 사항을 가장 많이 반영 |

### 버려진 시나리오 공통 이유

| 시나리오 | R1 | R2 | R3 | R4 |
|---------|:---:|:---:|:---:|:---:|
| **Cutting Edge** | $287K 비현실 비용 | Bun 학습 데이터 부족, +1.5개월 리스크 | GPU $945/mo (월 운영비의 94%), 78% 성공률 | 16 서비스, 60-65% 성공률 |
| **Proven Stack** | "Why?" AI 미포함 = 차별화 불가 | Prisma codegen AI 마찰, 기능 부족 | 템플릿 ONLY = moat 포기, 16주 | 템플릿 ONLY, NextAuth v4 유지보수 모드 |

### ⚠ 수렴에 대한 메타 비판 (성찰 결과)

**Confirmation Bias 가능성**: 4개 연구가 동일한 프레임워크(Technology_Development_DeepDive_PRD_Teammate_Executable.md), 동일한 전제(AI agent 개발, 1인 부트스트랩, 바둑 니치 시장)에서 출발했다. 같은 전제 → 같은 결론은 수렴의 "독립성"을 약화시킨다. 이 수렴이 진정으로 강력한 증거가 되려면 반사실적(counterfactual) 검증이 필요하다.

**미수행 반사실 시나리오:**

| 반사실 전제 | 예상 결론 변화 | 검증 필요도 |
|------------|--------------|:---:|
| "3인 인간 팀이라면?" | Cutting Edge 선택 가능 (AI agent 제약 제거) | 높음 |
| "VC $500K 자금이 있다면?" | Aggressive 시나리오 가능 | 중간 |
| "바둑이 아닌 체스라면?" | 기술 스택은 유사, 시장 전략 대폭 변경 | 낮음 |

**결론**: 4중 수렴은 "AI agent 개발 + 1인 부트스트랩 + 바둑 니치 시장"이라는 특정 전제 하에서의 최적 선택으로 해석해야 한다. 전제가 바뀌면 결론도 바뀔 수 있다.

---

## <a id="unified-stack"></a>3. 통합 기술 스택

4개 연구의 최종 선택을 합산한 전체 기술 스택:

```
┌──────────────────────────────────────────────────────────────────────┐
│        Baduk Platform — Unified Balanced-Tech Stack v2.0 (로컬 앱)    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ■ 코어 인프라 (R2→3차 성찰: SaaS→로컬 앱 전환)                       │
│  ─────────────────────────────────────────────────────                 │
│  App Framework: Tauri 2.0 (Rust sidecar, ~10MB 번들)                   │
│  Frontend:    Vite + React 19 + TypeScript strict                      │
│  Database:    SQLite (better-sqlite3, WAL mode)                        │
│  Queue:       인메모리 큐 + Node.js worker_threads                     │
│  ORM:         Drizzle ORM (SQLite 드라이버)                            │
│  UI:          Tailwind CSS 4 + shadcn/ui                               │
│  Lint:        Biome v2.3 (56x faster)                                  │
│  Quality:     SonarQube Community (SQALE ≤5%)                          │
│  Test:        Vitest + Playwright (Strategic TDD)                      │
│  CI/CD:       GitHub Actions (멀티 플랫폼 빌드)                        │
│  배포:        GitHub Releases + 자동 업데이트 (tauri-plugin-updater)    │
│  Monitor:     Sentry (데스크톱 크래시 리포팅)                           │
│  Architecture: Modular Monolith (단일 앱 프로세스)                      │
│                                                                        │
│  ■ 바둑 도메인 (R3: 바둑 도메인 기술)                                  │
│  ─────────────────────────────────────────────────────                 │
│  AI Engine:   KataGo v1.16.2, Analysis Engine JSON, 사용자 PC 실행      │
│  NN Model:    b6c96 (번들, ~15MB) → b18c384nbt (다운로드, ~70MB)       │
│  GPU:         사용자 GPU 자동 감지 (CUDA/OpenCL), 없으면 CPU Eigen     │
│  HumanSL:     Month 3-4 도입 (AnalysisEngine interface 준비)           │
│  Queue:       인메모리 큐 + worker_threads (사용자 CPU 코어 적응)       │
│  Process:     단일 + Watchdog (child_process, 3s backoff)              │
│  Visits:      5 (즉시) / 50 (빠른 분석) / 500 (심층 복기)              │
│                                                                        │
│  Rules:       Tromp-Taylor + Chinese scoring (Evolutionary)            │
│  Board:       1D Uint8Array, Zobrist hashing, pure functions           │
│  Engine LOC:  300-500줄 TypeScript                                     │
│                                                                        │
│  LLM V1:      Template Engine (패턴 매칭, 10일, $0/mo)                │
│  LLM V2:      Claude Haiku 4.5 (80%) + Sonnet 4.6 (15%) + fallback   │
│  Validation:   3-layer (data anchoring → constrained gen → check)      │
│  Explanation:  3-tier (입문/중급/고급)                                  │
│  Golden Set:   200 positions (단급자 검증)                              │
│                                                                        │
│  Game:        로컬 GameReducer (AI 대국), Phase 2: 경량 릴레이 서버     │
│  State:       Simple state + append-only move log + GameReducer        │
│  Match:       Phase 2: Glicko-2, 경량 릴레이 서버 ($5-10/mo VPS)       │
│  Time:        Byoyomi (Phase 1) → Fischer/Canadian (Phase 2)           │
│  Board UI:    SVG (React JSX), Shudan fork base                        │
│  Components:  20개 (18 classical + WinRateGraph + ExplanationCard)      │
│  Mobile:      Tap-Preview-Confirm, pinch-zoom (@use-gesture)           │
│  State Mgmt:  Zustand (2.7KB)                                          │
│  Charts:      Recharts (D3-based)                                      │
│                                                                        │
│  ■ 외부 연동 (R4: 외부 연동 기술)                                      │
│  ─────────────────────────────────────────────────────                 │
│  AI Phase 1:  Template Engine (패턴 매칭, $0/mo)                       │
│  AI Phase 2:  사용자 자체 Claude API 키 입력 (사용자 부담)              │
│  Resilience:  template fallback (API 미설정/장애 시)                    │
│                                                                        │
│  Auth:        Phase 1: 불필요 (AI 대국 only, 즉시 플레이)               │
│               Phase 2: Better Auth (온라인 대국 시 로그인)               │
│  Auth UX:     Anonymous-first → Progressive Auth                       │
│                                                                        │
│  Notification: OS 네이티브 알림 (Tauri notification plugin)             │
│  Discord:     Webhooks (게임 결과 공유, 선택적)                         │
│  i18n:        react-i18next (en/ko/ja) — 3 locales                     │
│                                                                        │
│  Analytics:   PostHog (클라이언트 SDK, opt-in 텔레메트리)               │
│  Errors:      Sentry (@sentry/electron 또는 Tauri 호환 SDK)            │
│  Go Data:     CWI 88K + featurecat 21.1M + @sabaki/sgf (앱 번들/DL)    │
│  Backup:      SQLite 파일 복사 (사용자 책임, iCloud/Google Drive)       │
│                                                                        │
│  IPC:         Tauri commands (Rust↔JS) + Zod 검증                      │
│  Pattern:     Ports/Adapters (벤더 교체 1파일)                          │
│                                                                        │
│  ■ 제품 전략 (R1: 시장/사용자/비즈니스)                                │
│  ─────────────────────────────────────────────────────                 │
│  Vision:      "세계 최강 AI가 당신의 개인 코치"                         │
│  Moat:        "Why?" AI 자연어 해설 (경쟁자 없음)                       │
│  New Category: Quick Go (9×9, 3분)                                      │
│  Model:       완전 무료 (모든 기능 무료 제공)                            │
│  Growth:      개인 프로젝트 / 공익 프로젝트 (비용 최소화 운영)           │
│  Features:    Green 5 + Yellow 2 = 7개 (Phase 1)                       │
│                                                                        │
│  외부 서비스 총 4개 (3차 성찰: 로컬 앱 최소화):                          │
│  PostHog (opt-in), Sentry (크래시), Cloudflare (랜딩/업데이트),          │
│  Discord Webhooks (선택적)                                               │
│  Phase 2 추가: Claude API (사용자 자체 키), Google OAuth                 │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### R2 → R4 간 Auth 결정 변경 사항

| 항목 | R2 결정 | R4 결정 | 이유 |
|------|---------|---------|------|
| Auth | NextAuth.js v5 | **Better Auth** | Auth.js v5가 Better Auth에 합병 (2025-09, YC $5M). Auth.js v5 = 유지보수 모드 |

> R4가 R2보다 후행 연구이므로, Auth 관련 최신 정보(Better Auth 합병)가 R4 결정을 우선 적용.

### ⚠ Auth 변경의 연쇄 영향 (성찰 결과)

NextAuth.js v5 → Better Auth 전환이 미치는 영향이 불완전하게 추적되었다:

| 영향 영역 | R2 원래 설계 | Better Auth 전환 후 | 추적 상태 |
|-----------|------------|-------------------|:---:|
| OAuth providers | Google, GitHub, Discord | **Phase 2**: email magic link + Google + Kakao | ⚠ Phase 1 불필요 (3차 성찰: 로컬 AI 대국 only) |
| 세션 관리 | DB sessions + JWT | **Phase 2**: DB sessions (로컬 SQLite) | ⚠ 3차 성찰: Redis 제거, 로컬 앱 |
| 미들웨어 패턴 | NextAuth auth() 미들웨어 | **Phase 2**: Better Auth 미들웨어 | ⚠ 3차 성찰: Phase 1에서 Auth 자체 불필요 |
| 폴백 전략 | — | Auth.js v5 (유지보수 모드) 폴백 | ⚠ 구버전 회귀의 적절성 |

### ⚠ Claude API 비용 교차 영향 (성찰 결과, 3차 성찰 보정)

~~R3의 바둑 해설 LLM ($115-180/mo)과 R4의 일반 AI ($43-65/mo)가 같은 Anthropic API 키를 사용한다.~~

> ⚠ **3차 성찰 보정**: Phase 1은 템플릿 only ($0). Phase 2에서 **사용자 자체 API 키** 사용 시, 비용은 **사용자 부담**이며 운영자 비용 $0. 교차 영향 분석은 사용자 개별 API 키 기준으로 재설계 필요:
> - Rate limit: 사용자 개인 API 키이므로 서비스 전체 교차 영향 없음
> - Prompt caching: 사용자 개별 세션이므로 캐시 경합 미미
> - 운영자 관점 비용 모델: **해당 없음** (사용자 부담)

### ⚠ 로컬 앱 최소 사양 요구사항 (3차 성찰 — CCX33 분석 대체)

앱이 사용자 PC에서 실행되므로, 서버 리소스가 아닌 **사용자 하드웨어 요구사항**이 핵심:

| 구분 | 최소 사양 | 권장 사양 | 비고 |
|------|:---:|:---:|------|
| CPU | 4코어 | 8코어+ | KataGo visits=500 시 4코어 점유 |
| RAM | 4GB | 8GB+ | 앱 200-400MB + KataGo 2-4GB |
| 디스크 | 500MB | 1GB+ | 앱 ~100MB + 고성능 모델 ~70MB |
| GPU | 불필요 | CUDA/OpenCL | GPU 있으면 KataGo 10-50x 가속 |
| OS | macOS 12+ / Win 10+ / Ubuntu 20+ | — | Tauri 2.0 지원 범위 |

> KataGo 심층 분석(500 visits)은 별도 프로세스에서 실행되므로 **UI 블로킹 없음** (데스크톱 앱 멀티프로세스 이점). 저사양 PC에서는 visits 자동 축소(50-100).

---

## <a id="unified-cost"></a>4. 통합 비용 분석

### 개발 비용 (일회성)

| 항목 | 금액 | 출처 |
|------|------|------|
| AI agent 컴퓨트 (Claude Code, 6개월) | ~$500-800 | R3 |
| 골든 데이터셋 (200 포지션, 단급자 검증) | $500-1,000 | R3 |
| Apple Developer 등록 (macOS 코드 서명) | $99 | 3차 성찰 |
| **개발 총 비용** | **$1,099-1,899** | 3차 성찰 보정 |

> 기존 개발팀 비용 $180-300K 대비 ~99% 절감 (AI workflow ~$0 개발비 전제). 서버 인프라 비용 $0 (로컬 앱).

### 월간 운영 비용 (3차 성찰 — 로컬 앱 기반)

| 항목 | Phase 1 | Phase 2 | 출처 |
|------|:---:|:---:|:---:|
| ~~Hetzner CCX33~~ | ~~$60~~ | ~~$60~~ | 삭제 (로컬 앱, 서버 불필요) |
| Claude API | $0 (템플릿 only) | $0 (사용자 자체 API 키) | 3차 성찰 |
| ~~Resend~~ | ~~$0~~ | ~~$0~~ | 삭제 (로컬 앱, 이메일 불필요) |
| PostHog | $0 (free) | $0 (free) | R4 |
| Sentry | $0 (free) | $0 (free) | R4 |
| Cloudflare (랜딩/업데이트) | $0 (free) | $0 (free) | R4 |
| ~~Hetzner Storage Box~~ | ~~$4~~ | ~~$4~~ | 삭제 (로컬 SQLite, PG 백업 불필요) |
| 도메인+DNS | $2 | $2 | R2 |
| 매칭/릴레이 서버 (Phase 2) | — | $5-10 | 3차 성찰 (온라인 대국 경량 VPS) |
| **월 합계** | **$2** | **$7-12** | 3차 성찰 보정 |

> ⚠ **3차 성찰 보정**: 로컬 앱 전환으로 서버 인프라 비용 **97% 절감** ($66-70 → $2). KataGo는 사용자 PC에서 실행. Claude API는 Phase 2에서 **사용자 자체 API 키**로 전환 (운영자 비용 $0). "성공의 역설" (MAU↑=비용↑) 문제가 **근본적으로 해소**됨.

### 6개월·18개월·3년 누적

| 기간 | 비용 추정 | 근거 |
|------|----------|------|
| 6개월 (Phase 1) | $1,111-1,911 | 개발 $1,099-1,899 + 운영 $12 |
| 18개월 | $1,195-2,055 | + Phase 2 운영 12개월 ($7-12/mo) |
| 3년 | $1,339-2,331 | + 인프라 성장 미미 (로컬 앱) |

### 비용 지속 가능성 분석 (3차 성찰 — 로컬 앱 기반)

> ⚠ **로컬 앱 + 완전 무료**: 서버 비용 거의 $0. KataGo/AI 분석은 사용자 PC에서 실행. Claude API 비용도 사용자 자체 API 키로 전가. **"성공의 역설" 근본적으로 해소.**

| 시점 | 예상 사용자 | 월간 순수 지출 | 누적 지출 | 비고 |
|------|---------|:------------:|:---------:|------|
| M3 (6개월) | ~2K | $2 | ~$1,111-1,911 | 개발비 포함, Phase 1 템플릿 |
| M6 (12개월) | ~8K | $7-12 | ~$1,147-1,983 | Phase 2 경량 릴레이 서버 |
| M12 (18개월) | ~25K | $7-12 | ~$1,195-2,055 | 사용자↑ 해도 서버 비용 미미 |
| M24 (3년) | ~50K | $7-12 | ~$1,339-2,331 | 릴레이 서버만 확장 필요 시 |

**로컬 앱의 비용 이점:**
- KataGo 연산: **사용자 CPU/GPU** → 서버 비용 $0
- Claude API: **사용자 자체 API 키** → 운영자 비용 $0
- 데이터 저장: **사용자 로컬 SQLite** → DB 서버 비용 $0
- MAU 증가가 비용 증가로 이어지지 않음 (Peer-to-Peer 비용 구조)

**Claude API 전략 (Phase 2):**

| 방식 | 운영자 비용 | 사용자 UX | 권장 |
|------|:--------:|:-------:|:---:|
| 템플릿 only (API 불필요) | $0 | 기본 해설 | **Phase 1 기본** |
| 사용자 자체 API 키 입력 | $0 | 고급 해설, 키 입력 필요 | **Phase 2 옵션** |
| 프록시 서버 (운영자 부담) | $5-10 + API 비용 | 최상 | 비권장 (비용 전가) |

> Phase 1은 템플릿 only로 $0. Phase 2에서 사용자가 원하면 자체 Claude API 키를 입력하여 고급 AI 해설 사용 가능. 운영자 API 비용 부담 $0.

---

## <a id="unified-timeline"></a>5. 통합 일정

### 마일스톤 (R1 기준 6개월 + R2/R3/R4 구체화, 3차 성찰: 로컬 앱 보정)

```
M1 (Month 1-2): Core Engine ═══════════════════════════════════════
├── Tauri 2.0 프로젝트 설정 + Vite + React 19              (3차 성찰, Week 1)
├── 규칙 엔진 Tromp-Taylor + Chinese scoring              (R3, Week 1-2)
├── KataGo 통합 (Tauri sidecar + worker_threads + Watchdog) (R3, Week 1-3)
├── 로컬 GameReducer (AI 대국, SQLite 상태 저장)           (R3, Week 2-5)
├── LLM V1 템플릿 (패턴 매칭 + 3-tier 해설)               (R3, Week 2-4)
├── SQLite 스키마 + Drizzle ORM 설정                       (3차 성찰, Week 1-2)
└── Go/No-Go: 템플릿 커버리지 80%+ & 코어 엔진 완성         (R1, 성찰 보정)

M2 (Month 3-4): Playable Beta ═════════════════════════════════════
├── UI/UX (Shudan fork + 20 컴포넌트)                     (R3, Week 2-8)
├── 멀티 플랫폼 빌드 (macOS + Windows + Linux)             (3차 성찰, Week 3-4)
├── OS 네이티브 알림 (Tauri notification plugin)            (3차 성찰, Week 3)
├── Analytics (PostHog client SDK + Sentry 크래시 리포팅)   (R4, Week 4-5)
├── Quick Go (9×9, 3분) + AI 해설 MVP                      (R1)
├── i18n (react-i18next en/ko/ja)                          (R4, Week 5-6)
├── Integration testing + hardening                        (R4, Week 6-7)
├── LLM V2 통합 (사용자 자체 API 키, 3-layer 검증)         (R3, Week 6-12)
├── GitHub Releases + 자동 업데이트 (tauri-plugin-updater)  (3차 성찰, Week 7)
└── Go/No-Go: Beta DAU 100+                                (R1)

M3 (Month 5-6): Public Launch ═════════════════════════════════════
├── 온보딩 (Zero-to-First-Game)                             (R1)
├── 게이미피케이션 기본                                     (R1)
├── 성능 최적화 + 앱 크기 최적화                            (3차 성찰)
├── 코드 서명 (macOS notarization + Windows SmartScreen)    (3차 성찰)
└── Go/No-Go: DAU 100+, D7 잔존 25%+                       (R1, 3차 성찰 보정)
```

### 도메인별 소요 기간

| 도메인 | 기간 | 병렬 실행 | 출처 |
|--------|------|----------|------|
| Tauri + 로컬 인프라 설정 | 6개월 (전 기간) | 기반 | 3차 성찰 |
| 바둑 도메인 기술 | 12주 | M1-M2 중심 | R3 |
| 외부 연동 (축소) | 4주 | M2 중심 | R4, 3차 성찰 |
| 제품 기능 (온보딩, 게이미피케이션 등) | M2-M3 | M3 중심 | R1 |
| 멀티 플랫폼 빌드 + 배포 | 4주 | M2-M3 | 3차 성찰 |

### ⚠ 병렬 AI agent 실행의 현실성 (성찰 결과)

통합 일정은 "병렬 AI agent 실행"을 전제한다. M1에서만 5개 작업 스트림이 동시 진행된다(Tauri 설정, 규칙 엔진, KataGo 통합, 로컬 GameReducer, LLM 템플릿). 그러나:

**현실적 제약:**
- 같은 코드베이스에서 여러 AI agent가 동시 작업 시 **`package.json`, DB 스키마 마이그레이션, 타입 정의** 등 공유 파일에서 충돌 불가피
- 이것은 **절대 기준 2(동일 파일 동시 수정 금지)**와 직접 충돌
- 현실적 병렬도: **2-3x** (모듈 경계가 명확한 경우)

**보정된 일정 추정:**
- 중복 제거 후 실제 작업량: ~14-16주
- 병렬도 2-3x 적용: ~6-8주 → M1-M2 기간에 부합
- 단, 병렬 작업의 통합(merge) 주기를 **주 1-2회**로 정의해야 하며, 모듈 인터페이스를 **사전에** 합의해야 한다

> PRD에서 에이전트 팀 구성, 모듈별 branch 전략, 통합 주기를 정의해야 이 일정이 현실적이다.

---

## <a id="unified-risk"></a>6. 통합 위험 레지스터

4개 연구의 위험을 통합, 영향도 순으로 정렬:

| # | 위험 | 확률 | 영향 | 출처 | 완화 |
|---|------|------|------|------|------|
| **R1** | **LLM 환각 (잘못된 바둑 조언)** | 높음 | 치명적 | R3 | 3-layer 검증 + 템플릿 폴백 (사활/패/세키). M1 Go/No-Go: 70%+ |
| ~~R2~~ | ~~Coolify 보안 (11 CVEs CVSS 10.0)~~ | — | — | ~~R4~~ | 삭제 (3차 성찰: 로컬 앱, 서버 배포 불필요) |
| **R3** | **무료 서비스 지속 가능성** — 수익=0 | **낮음** ⬇ | **중간** ⬇ | 2차→3차 성찰 보정 | 월 운영비 $2-12로 대폭 축소. "성공의 역설" 근본 해소 (로컬 앱) |
| ~~R4~~ | ~~CVE-2025-29927 (Next.js 미들웨어 우회)~~ | — | — | ~~R4~~ | 삭제 (3차 성찰: Next.js 미사용, Tauri+Vite 전환) |
| **R5** | **KataGo 프로세스 크래시 (사용자 PC)** | 중간 | 높음 | R3, 3차 성찰 | Watchdog 자동 재시작 (3s backoff, 5회/10분 회로 차단). 사용자 PC 환경 다양성 고려 |
| **R6** | **모바일 19×19 터치 정확도** | 높음 | 높음 | R3 | Tap-Preview-Confirm + pinch-zoom |
| **R7** | **Claude API 비용 = 사용자 부담** — Phase 2에서 사용자 자체 API 키 입력 시 사용자 비용 발생 | **중간** | **중간** ⬇ | R3, R4, 3차 성찰 보정 | 템플릿 폴백 기본, API 키 = 선택적 고급 기능. **운영자 비용 $0** |
| **R8** | **Better Auth 미성숙** (Phase 2: 온라인 대국 시) | **낮음** ⬇ | 중간 ⬇ | R4, 3차 성찰 | Phase 1에서 Auth 불필요 (AI 대국 only). Phase 2에서 도입, 대안 충분 |
| **R9** | **Quick Go 바이럴 실패** | 중간 | 높음 | R1 | M2 A/B 테스트, 재설계 |
| **R10** | **AI workflow 자동 구현율 미달** | 중간 | 높음 | R1 | M1 속도 측정, 스코프 축소 |
| **R11** | **입문자 잔존율 미달** | 중간 | 높음 | R1 | M3 15% 미달 시 UX 재설계 |
| **R12** | **Free tier 정책 변경** | 낮음 | 중간 | R4 | PostHog→Umami 자체호스팅 대안. 로컬 앱이므로 영향 축소 |
| **R13** | **일본 규칙 구현 복잡도** | 높음 | 중간 | R3 | Phase 2 연기. 중국 규칙이 온라인 대국 80%+ 커버 |
| **R14** | **AI agent 병렬 코드 충돌** | 높음 | 높음 | 성찰 | 모듈별 branch + 사전 인터페이스 합의 + 주 1-2회 순차 통합 |
| ~~R15~~ | ~~Coolify 최종 결정 지연~~ | — | — | ~~성찰~~ | 삭제 (3차 성찰: Coolify 미사용, GitHub Releases 배포) |
| **R16** | **멀티 OS 호환성** — macOS/Windows/Linux 3개 플랫폼 동시 지원 | **높음** | **높음** | 3차 성찰 | Tauri 2.0 크로스 플랫폼 지원. GitHub Actions 멀티 플랫폼 CI. M2 Go/No-Go에 3 OS 빌드 포함 |
| **R17** | **앱 크기 + 자동 업데이트** — KataGo 번들 시 앱 크기 증가 (~100MB+) | **중간** | **중간** | 3차 성찰 | 경량 모델 번들(b6c96 ~15MB), 고성능 모델은 별도 다운로드. tauri-plugin-updater 점진 업데이트 |
| **R18** | **사용자 하드웨어 다양성** — KataGo 성능이 사용자 PC 사양에 의존 | **높음** | **중간** | 3차 성찰 | GPU 자동 감지(CUDA/OpenCL/Eigen), visits 자동 조절(저사양 50-100, 고사양 500+), 하드웨어 벤치마크 초기 실행 |
| **R19** | **코드 서명/공증 비용** — macOS notarization, Windows SmartScreen 경고 | **중간** | **높음** | 3차 성찰 | Apple Developer $99/yr. Windows: EV 코드 서명 비용 검토 필요. unsigned 앱 경고 대응 UX |
| **R20** | **기부/후원 모델 미구축** — 사용자 보상 경로 부재로 장기 동기 저하 | **중간** | **중간** | 2차 성찰 | Phase 2에서 자발적 기부 옵션(GitHub Sponsors/Buy Me a Coffee) 검토. 핵심 기능은 무료 유지 |

### Go/No-Go 게이트 (R1 기준, 3차 성찰 보정)

| 시점 | CONTINUE | PIVOT |
|------|----------|-------|
| M1 (2개월) | 템플릿 커버리지 80%+ & 코어 엔진 완성 & Tauri 빌드 성공 | 미달 → 스코프 축소 |
| M2 (4개월) | Beta DAU 100+ & 3 OS 빌드 성공 | 50 미만 → UX 재설계 |
| M3 (6개월) | DAU 100+ & D7 잔존 25%+ & 코드 서명 완료 | DAU 30 미만 → 컨셉 재검토 |
| 12개월 | DAU 500+ & 다운로드 5K+ | DAU 100 미만 → 프로젝트 존속 재검토 |

---

## <a id="cross-validation"></a>7. 교차 검증 매트릭스

### 기술 결정 교차 검증

| 기술 영역 | R1 | R2 | R3 | R4 | 3차 성찰 보정 | 정합 |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **시나리오** | Balanced | Balanced-Tech | Balanced-Tech | Balanced-Tech | — | ✅ 4중 일치 |
| **Runtime** | — | Node.js 22 LTS | — | — | Node.js 22 (Tauri 내장) | ✅ |
| **Framework** | ~~Next.js~~ | ~~Next.js 15~~ | — | — | **Tauri 2.0 + Vite + React 19** | ⚠ 3차 성찰 전환 |
| **DB** | ~~PostgreSQL~~ | ~~PG 16 + Redis 7.2~~ | — | — | **SQLite (better-sqlite3)** | ⚠ 3차 성찰 전환 |
| **ORM** | — | Drizzle | — | — | Drizzle (SQLite 드라이버) | ✅ ORM 유지 |
| **Architecture** | Modular Monolith | Lichess pattern | — | — | 단일 앱 프로세스 | ✅ 패턴 유지 |
| **AI Engine** | KataGo CPU Eigen | KataGo CPU Eigen | KataGo CPU Eigen + BullMQ | — | **사용자 PC 실행 + worker_threads** | ⚠ 3차 성찰 전환 |
| **LLM** | "Why?" AI Day 1 | Haiku/Sonnet/Template | 템플릿 V1→LLM V2 | Claude 3-tier | 템플릿 V1 ($0) → 사용자 API 키 V2 | ✅ 전략 유지 |
| **규칙 엔진** | — | — | Tromp-Taylor + Chinese | — | — | ✅ |
| **대국** | 동접 1,000 | WebSocket | ws + GameReducer | — | **로컬 GameReducer (AI 대국)** | ⚠ 3차 성찰 전환 |
| **보드 UI** | 모바일 우선 | SVG | Shudan fork + 20 컴포넌트 | — | — | ✅ |
| **Auth** | — | ~~NextAuth v5~~ | — | Better Auth | **Phase 2에서 도입** (Phase 1 불필요) | ⚠ 3차 성찰 연기 |
| **Payment** | ~~Freemium~~ | — | — | ~~Stripe~~ | 해당 없음 (완전 무료) | ✅ 2차 성찰 |
| **Email** | — | — | — | ~~Resend~~ | 삭제 (로컬 앱) | ⚠ 3차 성찰 제거 |
| **Push** | — | — | — | ~~Web Push~~ | **OS 네이티브 알림** | ⚠ 3차 성찰 전환 |
| **Analytics** | — | — | — | PostHog + Sentry | PostHog client SDK + Sentry (opt-in) | ✅ |
| **CDN** | — | — | — | Cloudflare (free) | 랜딩 페이지 + 업데이트 서버 | ✅ |
| **i18n** | — | — | — | ~~next-intl~~ | **react-i18next** (en/ko/ja) | ⚠ 3차 성찰 전환 |
| **IPC** | — | — | — | REST + Zod | **Tauri commands + Zod** | ⚠ 3차 성찰 전환 |
| **Lint** | — | Biome v2.3 | — | — | — | ✅ |
| **Deploy** | — | ~~Coolify + Hetzner~~ | — | — | **GitHub Releases + 자동 업데이트** | ⚠ 3차 성찰 전환 |

### 수치 교차 검증

| 수치 항목 | R1 | R2 | R3 | R4 | 3차 성찰 보정 | 정합 |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **성공 확률** | 65-75% | 70-75% | 82-91% | 85-91% | — | ⚠ 아래 주석 참조 |
| **인프라 비용** | ~~$55-150/mo~~ | ~~$60/mo~~ | ~~$80→$260/mo~~ | ~~$66-131/mo~~ | **$2/mo (Phase 1)** | ⚠ 3차 성찰 전면 보정 |
| **일정** | 6개월 | 6개월 | 12주 (도메인) | ~~7주~~ | 4주 (외부 연동 축소) | ✅ |
| **KPI (6mo)** | ~~MAU 8K~~, DAU 800+ | — | — | — | DAU 100+ (데스크톱 앱 기준) | ⚠ 3차 성찰 보정 |
| **AI 자동화율** | 60-65% | 65-70% | — | — | — | ✅ 범위 |
| **6mo 비용** | ~~$1,130-2,600~~ | ~~$300-430~~ | ~~$480-1,560~~ | ~~$396-786~~ | **$1,111-1,911** | ⚠ 3차 성찰 전면 보정 |

> ⚠ **3차 성찰 비용 보정**: 로컬 앱 전환으로 R2-R4의 Hetzner/서버 비용이 모두 제거됨. 실제 통합 비용은 섹션 4를 참조할 것. 서버 인프라 비용 3중 계산 문제가 근본적으로 해소됨.
> ⚠ **KPI 보정**: 데스크톱 앱은 MAU(웹 접속 기준) 대신 **다운로드 수 + DAU(활성 사용자)**가 핵심 지표. 바이럴 확산 속도가 웹 앱 대비 느림.

### 성공 확률 상승 추이

```
R1 (전략): 65-75% ──→ R2 (기술): 70-75% ──→ R3 (도메인): 82-91% ──→ R4 (연동): 85-91%
                      ↑ 연구 범위가 좁아지면서 도메인 특화 위험만 측정
```

> ⚠ **성찰 보정**: 이 상승은 "프로젝트 전체의 성공 확률이 85-91%"를 의미하지 않는다.
> - R1 = 전체 프로젝트 성공 확률 (시장+기술+사용자+비즈니스 모든 위험)
> - R2-R4 = 각 도메인의 기술 구현 성공 확률 (범위가 좁아 확률이 높음)
> - **전체 프로젝트 성공 확률은 여전히 R1의 65-75% 범위에 가깝다.**
> - 도메인별 확률이 독립이라면: 0.65 × 0.70 × 0.82 × 0.85 ≈ **31.7%** (하한). 실제로는 상관관계가 있어 이보다 높지만, 개별 도메인의 85-91%와는 크게 다르다.

---

## <a id="per-research"></a>8. Research별 핵심 발견 요약

### R1: 시장·사용자·비즈니스·기술 전략

**핵심 인사이트 5가지:**

1. **"Why?" AI 해설 = 유일한 moat** — 어떤 바둑 플랫폼도 자연어 AI 해설을 제공하지 않음
2. **Quick Go = 새 카테고리** — 9×9, 3분 게임은 기존 시장에 존재하지 않음
3. **OGS 1년 잔존율 5%** — 입문자 온보딩 실패가 근본 원인 → Zero-to-First-Game으로 해결
4. **VC 모델 부적합** — 바둑 시장 규모 한정, $100M+ exit 구조적 불가 → 개인 프로젝트/공익 프로젝트
5. **"AlphaGo 초월" 재정의** — "더 강한 AI"가 아니라 "더 잘 설명하는 AI"

**기능 우선순위:**
- Green (4/4 합의): "Why?" AI 해설, Quick Go, 온보딩, ELO 매칭, AI 대국
- Yellow (3/4): 게이미피케이션, PWA
- Red (Phase 2): B2B LMS, 네이티브 앱, 실시간 코칭, 사활, 커뮤니티, 토너먼트

**KPI 목표 (2차 성찰 — 무료 전환 보정):**
- 6개월: MAU 8K, DAU 800+, D30 잔존 15%+
- 12개월: MAU 25K, DAU 2.5K+, D30 잔존 20%+
- 18개월: MAU 50K, DAU 5K+, D30 잔존 25%+

---

### R2: 기술 스택 심층조사

**핵심 인사이트 5가지:**

1. **72% Proven + 28% Validated-Latest = Goldilocks Zone** — AI agent 최적화 기준
2. **Strategic TDD가 AI agent를 가속** — 반직관적 발견 (DORA 2025, Latent Space 2026)
3. ~~**Coolify + Hetzner = 90% 비용 절감**~~ → **3차 성찰: 로컬 앱 전환으로 서버 인프라 불필요. GitHub Releases 배포**
4. **AI 코드 클로닝 4x rate** — GitClear 2025, SonarQube 3% threshold로 억제
5. **Biome v2.3 = 유일한 Latest 선택** — 56x 빠른 lint가 AI CI 누적 이점 제공

**11개 만장일치 합의 (3차 성찰 보정):**
~~Next.js 15~~ → **Tauri 2.0 + Vite + React 19**, TypeScript strict, ~~PG 16~~ → **SQLite**, Drizzle, KataGo CPU Eigen (사용자 PC), Claude 3-tier, Glicko-2, ~~WebSocket~~ → **로컬 GameReducer**, Vitest+Playwright, SonarQube, Evolutionary Modular Monolith

**6개 분쟁 해결 (3차 성찰 보정):**
Node.js 22 LTS (Bun 대신), ~~Redis 7.2~~ → **인메모리 큐** (로컬 앱), Biome (ESLint 대신), ~~PG 16~~ → **SQLite** (로컬 앱), Daily+Gates (Weekly 대신), 80%/100%/90% 3-tier 커버리지

---

### R3: 바둑 도메인 기술

**핵심 인사이트 5가지:**

1. **LLM은 바둑 이해 능력 ZERO** — LLM = 번역기, KataGo = 진실의 원천
2. **Tromp-Taylor + Chinese scoring = 만장일치** — 수학적 완전성, 10문장으로 표현 가능
3. **SVG 렌더링 = 만장일치** — DOM 이벤트, React JSX 통합, ~400 요소
4. **Event sourcing는 바둑 완벽 핏이나 Simple+GameReducer 선택** — Go 최대 ~400 이벤트, 업그레이드 가능
5. **"보드 자체가 아니라 보드 주변을 혁신하라"** — 바둑 유저는 깨끗한 보드 선호

**8개 만장일치 합의:**
Tromp-Taylor+Chinese, SVG 렌더링, KataGo Analysis Engine, LLM=번역기, Evolutionary 규칙 엔진, 템플릿 폴백, ~~Server-authoritative~~ → **로컬 GameReducer** (3차 성찰: Phase 1 로컬, Phase 2 서버), Zustand

**6개 분쟁 해결:**
단일 KataGo+**worker_threads** (Pool 대신, 3차 성찰: BullMQ→worker_threads), HumanSL Month 3-4 (Day 1 대신), 템플릿 V1→LLM V2 (Day 1 LLM 대신), Simple+GameReducer (Event sourcing 대신), 20 컴포넌트 (18 대신), 12주 (7-18주 범위)

---

### R4: 외부 연동 기술

**핵심 인사이트 5가지:**

1. **OpenAI/Gemini API 사용 불가** — 구독 계정만, 양사 TOS 명시적 금지
2. **Auth.js v5가 Better Auth에 합병** (2025-09, YC $5M) — Auth.js v5 = 유지보수 모드
3. ~~**Stripe = KakaoPay/NaverPay/PayPay 네이티브**~~ — 완전 무료 전환으로 결제 인프라 불필요 (2차 성찰)
4. ~~**Coolify = 최약 링크**~~ — 3차 성찰: 로컬 앱 전환으로 Coolify 미사용. GitHub Releases 배포
5. ~~**REST + Zod > tRPC/MCP**~~ → **Tauri commands + Zod** (3차 성찰: 로컬 앱 IPC)

**4개 만장일치 합의 (3차 성찰 — 로컬 앱 보정, Resend/Web Push/next-intl 제거):**
Claude API = 유일한 프로그래밍 AI, Cloudflare, Template fallback, Prompt caching

**10개 분쟁 해결:**
Claude 3-tier (4-layer 대신), No on-device AI, No MCP (defer), **Tauri commands+Zod** (tRPC 대신, 3차 성찰), Better Auth (**Phase 2**, email/Google/Kakao), PostHog+Sentry Cloud, Webhooks only Discord, 3 locales, **4개 서비스** (3차 성찰: 8→4), **4주** (3차 성찰: 7→4, 범위 축소)

---

## <a id="open-items"></a>9. 미결 사항 및 PRD 작성 시 반영 필요 항목

### 확정 사항 (4개 연구 합의)

| # | 항목 | 상태 |
|---|------|------|
| 1 | 제품 비전: "세계 최강 AI가 당신의 개인 코치" | ✅ 확정 |
| 2 | 핵심 moat: "Why?" AI 자연어 해설 | ✅ 확정 |
| 3 | 신규 카테고리: Quick Go (9×9, 3분) | ✅ 확정 |
| 4 | 서비스 모델: **완전 무료** (모든 기능 무료 제공) | ✅ 확정 (2차 성찰) |
| 5 | 운영 모델: 개인 프로젝트 / 공익 프로젝트 (비용 최소화) | ✅ 확정 (2차 성찰) |
| 6 | 코어 기술: **Tauri 2.0 + Vite + React 19 + SQLite + Drizzle** (3차 성찰 전환) | ✅ 확정 |
| 7 | AI: KataGo CPU Eigen (**사용자 PC 실행**) + Claude 3-tier + Template fallback | ✅ 확정 |
| 8 | 바둑 규칙: Tromp-Taylor + Chinese scoring + Evolutionary | ✅ 확정 |
| 9 | 보드 UI: SVG + Shudan fork + 20 컴포넌트 | ✅ 확정 |
| 10 | Auth: **Phase 1 불필요, Phase 2: Better Auth** (온라인 대국 시) | ✅ 확정 (3차 성찰) |
| 11 | ~~Payment: Stripe Checkout + KakaoPay~~ → 해당 없음 (완전 무료) | ✅ 확정 (2차 성찰) |
| 12 | 인프라: **GitHub Releases + 자동 업데이트 + Cloudflare** (3차 성찰: 서버 불필요) | ✅ 확정 (3차 성찰) |
| 13 | IPC: **Tauri commands + Zod** (3차 성찰: REST→IPC 전환) | ✅ 확정 (3차 성찰) |
| 14 | i18n: **react-i18next** (en/ko/ja) (3차 성찰: next-intl→react-i18next) | ✅ 확정 (3차 성찰) |
| 15 | Analytics: PostHog + Sentry (Cloud free tier) | ✅ 확정 |
| 16 | KPI: MAU 8K, DAU 800+ (6개월) | ✅ 확정 (2차 성찰: MRR→DAU) |
| 17 | 일정: 6개월 (M1/M2/M3) | ✅ 확정 |
| 18 | 비용: **$1,099-1,899 개발 + $2/mo Phase 1 운영** | ✅ 확정 (3차 성찰: 로컬 앱 보정) |

### PRD 작성 시 추가 결정 필요 항목 (성찰 반영 확장)

**최우선 (PRD 작성 불가 수준):**

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 1 | **Workflow system 관점 조사** | 구조적 부재 | 에이전트 팀 구성, 병렬 전략, 사람-에이전트 협업 프로토콜 |
| 2 | **기능 상세 스펙** | Green/Yellow 수준 정의만 | 7개 기능의 유저 스토리, 수락 기준, 화면 목록 (Quick Go/온보딩 특히 부족) |
| 3 | **DB 스키마** | 미정 | users, games, moves, analysis, ratings 최소 5개 테이블 (2차 성찰: subscriptions 제거) |
| 4 | **API 엔드포인트** | REST+Zod 확정, 상세 미정 | 핵심 15-20개 엔드포인트의 경로, 메서드, 요청/응답 스키마 |

**높음 (PRD 품질에 직접 영향):**

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 5 | **기술 검증 게이트** | 비즈니스 Go/No-Go만 | 주차별 기술 완료 기준 + 검증 방법 |
| 6 | **사람-에이전트 협업 지점** | 산발적 언급 | KataGo IPC, LLM 프롬프트, 골든 데이터셋 등 수동 작업의 정식 목록 |
| 7 | **Moat 지속가능성** | "경쟁자 없음" 수준 | 경쟁자 모방 비용/시간 + 선발 주자 축적 자산 |
| 8 | **Phase 2 로드맵** | 각 연구에서 부분 언급 | Red 기능의 우선순위, 의존 관계, 성공 기준 |
| 9 | **성능 SLA/SLO** | ~~"동접 1,000명"~~ (3차 성찰: 로컬 앱, 서버 동접 불필요) | 로컬 앱 UI 응답 시간, KataGo 분석 대기 시간, 하드웨어별 성능 적응 기준 |
| 10 | **보안 체크리스트** | CVE, OWASP 단편 언급 | OWASP Top 10 기반 체계적 보안 요구사항 |

**중간 (구현 시 결정 가능하나 사전 정의 유리):**

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 11 | ~~Coolify 대안 최종 결정~~ | ~~CVE 위험 식별~~ | 삭제 (3차 성찰: 로컬 앱, Coolify 불필요) |
| 12 | ~~Stripe Atlas 타이밍~~ | ~~필요성 확인~~ | 완전 무료 전환으로 불필요 (2차 성찰) |
| 13 | LLM 통합 비용 모델 | R3/R4 별도 계산 | 같은 API 키의 rate limit/캐시 교차 영향. **무료 서비스에서 비용 관리가 더 중요** |
| 14 | 테스트 전략 상세 | Strategic TDD 확정 | 모듈별 테스트 범위, E2E 시나리오 |
| 15 | 접근성 요구사항 | 미정 | WCAG 수준 결정 |
| 16 | AI 해설의 "인격/톤" | 미정 | 차갑고 분석적 vs 따뜻한 코치 vs 소크라테스식 |
| 17 | "Why Now" 논거 | 미정 | LLM 기술 성숙도 타임라인, 바둑 고유 교육 가치 |
| 18 | 자동화율 정의 | "60-70%" 불명확 | 코드 라인/기능 수/시간 중 어떤 기준인지 |

### 핵심 제약 사항 (모든 후속 작업에 적용)

| # | 제약 | 근거 |
|---|------|------|
| 1 | OpenAI/Gemini = 구독 계정만, API 연결 금지 | 양사 TOS 명시적 금지, Google 실제 차단 사례 |
| 2 | 자체 AI 엔진 개발 절대 금지 | Leela Zero 팀도 2019년 중단, DeepMind 수준 리소스 필요 |
| 3 | VC 투자 불필요 | 완전 무료 서비스, 수익 목표 없음. 바둑 시장 규모 한정 |
| 4 | LLM = 번역기, KataGo = 진실의 원천 | LLM 바둑 이해 능력 ZERO 확인 |
| 5 | **월 운영비 $15 한도** (3차 성찰 보정) | 로컬 앱으로 서버 비용 거의 $0. Phase 2 릴레이 서버 포함 $7-12/mo. $300 한도는 과잉 |

---

## <a id="reflection"></a>10. 1차 성찰 결과

> **실행일**: 2026-03-10 | **방법**: 3개 teammate 병렬 투입 (66개 조사 에이전트 + 3개 성찰 에이전트 = 69개)

### 성찰의 핵심 발견: 2중 구조의 비대칭

이 프로젝트의 최종 산출물은 **"바둑 앱"이 아니라 "바둑 앱을 자동으로 만드는 AI workflow system"**이다. 그러나 4개 연구(66개 에이전트)는 모두 "바둑 앱이 무엇이어야 하는가"를 조사했다. **"workflow system"** 관점의 조사는 구조적으로 부재한다.

```
4개 연구가 조사한 것          필요하지만 조사하지 않은 것
──────────────────          ──────────────────────
Layer 1: 바둑 앱             Layer 2: AI Workflow System
 ├── 시장/사용자/비즈 (R1)     ├── 에이전트 팀 구성
 ├── 기술 스택 (R2)           ├── 병렬 실행 전략
 ├── 바둑 도메인 (R3)         ├── 사람-에이전트 협업 프로토콜
 └── 외부 연동 (R4)          ├── 기술 검증 게이트
                              ├── 코드 통합 전략
                              └── 자동화 불가 영역 대책
```

> Layer 1 조사는 공장 설계의 전제인 "제품 스펙"을 확정한 것이다. Layer 2 조사(공장 자체의 설계)는 PRD 작성 전 또는 PRD 내에서 수행해야 한다.

### Pass 1 성찰: 서비스 본질 (What/Why)

**"알파고보다 더 뛰어난"의 재정의는 정확했다.** "더 강한 AI"가 아닌 "더 잘 설명하는 AI"로의 전환은 4개 연구를 관통하는 강력한 비전이다.

**그러나 빠진 본질적 질문 5가지:**

1. **"Why Now?"** — AlphaGo는 2016년. 2026년에 시작하는 이유는 LLM 자연어 생성이 2024-2025년에 비로소 실용 수준에 도달했기 때문이다. 이 시의성 논거가 통합 문서에 명시되지 않았다.

2. **Moat의 모방 취약성** — KataGo(MIT, 무료) + 아무 LLM API = 기본적 자연어 해설 가능. "경쟁자가 아직 안 했다" ≠ "할 수 없다". 진짜 moat는 해설의 "품질"(3-tier, 골든 데이터셋, 도메인 특화 프롬프트) + "속도"(데이터 축적)이다.

3. **1인 운영의 한계** — 6개월 후 "앱 완성"이 끝이 아니다. 고객 지원, 커뮤니티 관리, 마케팅, 개인정보보호 등 AI agent가 할 수 없는 운영 영역의 비용/시간이 미분석. (2차 성찰: 무료 서비스에서 더 심화 — 수익 없이 운영 부담만 증가)

4. **LLM 70% 정확도의 의미** — 10개 해설 중 3개가 틀린다. 사용자가 이를 경험하면 기능 버그가 아닌 **핵심 가치 제안에 대한 신뢰 붕괴**. 무료 서비스라도 품질 기대는 존재한다.

5. **AI 해설의 "인격"** — Duolingo, Khan Academy 등 성공적 교육 앱은 기능이 아니라 "감정적 경험"으로 차별화. AI 코치의 톤(분석적 vs 격려 vs 소크라테스식)은 프롬프트 설계이자 제품 철학이다.

### Pass 2 성찰: 시스템 요구사항

**Layer 1 (바둑 앱) — 기능 상세 수준 불균형:**

| 기능 | 상세 수준 | 문제 |
|------|:---:|------|
| "Why?" AI 해설 | 높음 | 프롬프트 실물, 골든 데이터셋 구축 방법론 미정 |
| Quick Go | **매우 낮음** | 핵심 차별화인데 "9×9, 3분" 한 줄. 시간 제한 방식, AI 튜닝, 매칭 풀 미정 |
| 온보딩 | **매우 낮음** | "5분 온보딩" 목표만. 단계별 설계 없음 |
| 게이미피케이션 | **매우 낮음** | "기본"이라고만. 뱃지/레벨/도전과제 메커니즘 없음 |
| ELO 매칭 | 중간 | 초기 소규모 풀 대응 전략 미구체 |
| AI 대국 | 낮음 | 30단계 설정값 미정 |
| PWA | 낮음 | 오프라인 범위, 설치 UX, 푸시 전략 미정 |

**Layer 2 (workflow system) — 핵심 공백:**

| 공백 | 영향 | PRD에서 필요한 것 |
|------|------|-----------------|
| 에이전트 팀 구성 미설계 | 구현 시작 불가 | Frontend/Backend/Game Logic/AI Pipeline 에이전트의 역할, 담당 모듈, SOT 접근 권한 |
| 기술 검증 게이트 부재 | AI agent가 "완료" 판단 불가 | Week 2: KataGo IPC 테스트, Week 3: 규칙 엔진 100%, Week 4: 대국 E2E |
| 사람-에이전트 협업 미정의 | 수동 작업이 병목 | KataGo IPC(20-30% 자동), LLM 프롬프트(수동), 골든 데이터셋(순수 수동) |
| 자동화율 60-70% 불명확 | 비용 모델 신뢰 저하 | "코드 라인의 65-70%를 AI 생성, SonarQube+TDD+human review 3중 검증" 같은 측정 가능 정의 |

**영역별 자동화 가능성 추정:**

| 영역 | AI 자동화 | 근거 |
|------|:---:|------|
| Frontend (UI, 페이지) | 85-90% | React 19 + Vite = AI 학습 데이터 최대 (3차 성찰: Next.js→Tauri+React) |
| Backend (CRUD, API) | 80-85% | REST + Zod + Drizzle = AI 친숙 패턴 |
| Auth 통합 | 70-80% | Better Auth 문서화 양호. Phase 2 연기로 범위 축소 (3차 성찰) |
| 규칙 엔진 | 50-60% | 순수 함수 + TDD 가능, 에지 케이스(패/세키) 검증 필요 |
| ~~게임 서버 (WebSocket)~~ 로컬 GameReducer | 60-70% | 3차 성찰: 서버 프로토콜 불필요. 로컬 상태 관리 = AI 친숙 패턴 |
| KataGo IPC | 20-30% | AI 학습 데이터에 KataGo 관련 자료 극소 |
| LLM 프롬프트 설계 | 10-20% | 바둑 도메인 전문성 + 메타적 문제 |
| 인프라/CI/CD | 75-85% | Tauri 빌드 + GitHub Actions 멀티 플랫폼 = 표준 패턴 (3차 성찰) |
| 테스트 코드 | 60-70% | 바둑 도메인 테스트는 수동 설계 |

### Pass 3 성찰: 정밀 검증 수정 사항

성찰에서 발견된 불일치와 수정 사항은 이미 해당 섹션에 인라인으로 반영되었다 (⚠ 표시):

| 반영 위치 | 수정 내용 |
|----------|----------|
| 섹션 2 | 4중 수렴 Confirmation Bias 경고 + 반사실 시나리오 |
| 섹션 3 | Auth 연쇄 영향, Claude API 비용 교차, CCX33 리소스 한계 |
| 섹션 4 | Stripe 수수료 $295/mo 정량화, R1 비용 차이 설명, 손익분기 보정 |
| 섹션 5 | Go/No-Go M1 기준 보정 (LLM 70%→템플릿 커버리지), 병렬 실행 현실성 |
| 섹션 6 | R8 확률 상향(낮음→중간), R14-R16 추가, Go/No-Go 보정 |
| 섹션 7 | 성공 확률 해석 보정, 비용 중복 계산 경고 |
| 섹션 9 | 미결 항목 10→18개 확장, 우선순위 3단계 분류 |

---

## <a id="reflection-2"></a>11. 2차 성찰: 완전 무료 전환 영향 분석

> **실행일**: 2026-03-10 | **방법**: 3개 teammate 병렬 투입 (무료 전환 영향 분석 / 적대적 리뷰 / 사실 검증)
> **트리거**: 사용자 결정 — 서비스 모델을 Freemium ($0→$9.99/mo) → **완전 무료**로 전환

### 2차 성찰의 핵심 발견

#### 1. 비즈니스 모델 근본 전환

| 차원 | OLD (Freemium) | NEW (완전 무료) |
|------|:---:|:---:|
| 서비스 모델 | Free → $9.99/mo → $29.99/seat | **모든 기능 무료** |
| 사업 성격 | 1인 부트스트랩 SaaS | **개인 프로젝트 / 공익 프로젝트** |
| 성장 모델 | 수익으로 성장 | **개인 재원 기반 (비용 최소화 핵심)** |
| 성공 지표 | MRR, 유료 전환율, LTV/CAC | **MAU, DAU, 잔존율, 사용자 참여도** |
| 경쟁 전략 | 차별화 + 가격 경쟁력 | **차별화 + 가격 장벽 제로** |

#### 2. ~~"성공의 역설"~~ → 3차 성찰: **근본적으로 해소**

~~MAU가 많아질수록 Claude API 비용 증가 → 성공할수록 재정 부담 가중.~~

> ⚠ **3차 성찰 보정**: 로컬 앱 전환으로 "성공의 역설"이 **근본적으로 해소**됨:
> - KataGo 연산: 사용자 PC에서 실행 → 운영자 서버 비용 $0
> - Claude API: Phase 2에서 **사용자 자체 API 키** 입력 → 운영자 비용 $0
> - 데이터 저장: 사용자 로컬 SQLite → DB 서버 비용 $0
> - **MAU 증가가 운영 비용 증가로 이어지지 않음** (Peer-to-Peer 비용 구조)
>
> 유일한 비용 증가 요인: Phase 2 매칭/릴레이 서버 ($5-10/mo) — 이마저도 경량 VPS로 충분.
> Phase 1에서는 순수 운영비 **$2/mo**.

#### 3. 무료 전환의 전략적 이점

유료→무료 전환이 "수익 포기"만은 아니다:

1. **진입 장벽 제거**: 가입→첫 대국 전환율 극대화. OGS "1년 잔존율 5%" 문제의 직접 해결
2. **개발 복잡도 감소**: 결제 시스템 제거로 ~3주 개발 시간 회수. 보안 표면적 축소 (PCI 관련 고려 불필요)
3. **법적 복잡도 감소**: US 법인 불필요, Stripe Atlas 절차 생략, 결제 관련 규정(환불 정책 등) 해당 없음
4. **사용자 신뢰**: "완전 무료, 숨겨진 비용 없음"은 바둑 커뮤니티(전통적 무료 서비스 익숙)에서 신뢰 형성에 유리
5. **운영 단순화**: 결제 실패, 구독 관리, 환불 처리 등 고객 지원 부담 제거

#### 4. Anonymous-first + Progressive Auth (적대적 리뷰 발견)

무료 서비스의 강점을 극대화하는 인증 전략:

| 단계 | 행동 | Auth 필요 |
|------|------|:---:|
| 1. 최초 방문 | Quick Go 9x9, AI 대국 **즉시 플레이** | **불필요** |
| 2. 기록 저장 원할 때 | email magic link로 계정 생성 유도 | 필요 |
| 3. 전환 시 | anonymous → 계정 시 기존 대국 이력 연결 | 전환 |

> 가입 없이 즉시 플레이 가능한 flow는 OGS/Fox/Tygem 대비 차별화 요소. Better Auth는 유지하되, Progressive Auth 패턴 추가.

#### 5. 기존 연구 유효성 평가

| 구분 | 비율 | 설명 |
|------|:---:|------|
| **완전 유효** | ~85% | 기술 스택, 바둑 도메인, 사용자 분석, 경쟁 분석, 아키텍처 |
| **프레이밍 변경** | ~5% | 4중 수렴 근거, SOM 정의, 성공 확률 해석 |
| **무효화** | ~10% | 수익 모델, 결제 인프라, 재무 KPI, Stripe 관련 전부 |

> **69개 에이전트의 연구 작업 중 ~85%는 완전히 유효하다.** 무효화되는 ~10%는 수익 모델, 결제 인프라, 재무 KPI에 집중.

#### 6. 무료 서비스 KPI 체계 (MRR 대체)

| 카테고리 | 지표 | 목표 (6개월) | 측정 도구 |
|----------|------|:-----------:|----------|
| 성장 | MAU | 8K | PostHog |
| 성장 | DAU/MAU 비율 | 10%+ | PostHog |
| 참여 | D1 잔존율 | 60%+ | PostHog cohort |
| 참여 | D7 잔존율 | 30%+ | PostHog cohort |
| 참여 | D30 잔존율 | 15%+ | PostHog cohort |
| 핵심 기능 | "Why?" AI 해설 사용률 | 40%+ | 커스텀 이벤트 |
| 핵심 기능 | Quick Go 일일 대국 수 | 500+ | 게임 서버 로그 |
| 온보딩 | Zero-to-First-Game 완주율 | 70%+ | PostHog funnel |
| 비용 효율 | Claude API 비용/MAU | $0 (사용자 자체 키) | 3차 성찰: 운영자 부담 $0 |
| 비용 한도 | 월 총 운영비 | **$15 이내** | 3차 성찰: 로컬 앱 보정 |

#### 7. 기술 스택 변경 요약

**제거:**
- Stripe Checkout + Customer Portal
- KakaoPay, NaverPay, PayPay (Stripe 네이티브)
- Stripe Atlas US ($500)
- Stripe HMAC-SHA256 webhook
- 결제 관련 API (5-8개 엔드포인트)
- DB: subscriptions, payments, invoices 테이블
- UI: PricingPage, CheckoutForm, BillingDashboard, UpgradeModal
- 환경 변수: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET

**추가:**
- Anonymous-first play flow (가입 없이 즉시 대국)
- Progressive Auth (anonymous → 계정 전환)
- 사용자당 AI 해설 일일 사용 제한 (rate limiting)
- 월 운영비 하드캡 모니터링

**외부 서비스 8개 → 7개 → 4개** (Stripe 제거 + 서버 인프라 제거, 3차 성찰)

#### 8. 2차 성찰 인라인 반영 목록

| 반영 위치 | 수정 내용 |
|----------|----------|
| 헤더 | 2차 성찰 완료 표기 + 무료 전환 핵심 |
| 섹션 2 | MRR 19% → 월 운영비 94% |
| 섹션 3 | Payment 3줄 삭제, 모델 Freemium→완전 무료, 외부 서비스 8→7개 |
| 섹션 4 | 개발비 $1,500-2,300→$1,000-1,800, Stripe 수수료 삭제, 손익분기→비용 지속가능성, MAU별 비용 추정 추가 |
| 섹션 5 | Payment 타임라인 삭제, Freemium 활성화 삭제, Go/No-Go 유료→D7 잔존율, 6→7개 스트림 |
| 섹션 6 | R3 Stripe→무료 지속가능성, R7 확률·영향 상향, R16 Stripe→API 비용 통제, R17-R18 신규 |
| 섹션 7 | Payment 행 무효화, KPI MRR→DAU |
| 섹션 8 | KPI MRR 전부 DAU/잔존율로 교체, R4 Stripe 인사이트 무효화, 만장일치 8→7 |
| 섹션 9 | 확정 #4 Freemium→무료, #11 Stripe→해당없음, #16 MRR→DAU, #18 비용 하향, DB 6→5테이블, 제약 #5 Stripe→비용한도 |
| 섹션 10 | 1인 부트스트랩→1인 운영 한계 심화, LLM 정확도 문맥 보정 |

#### 9. PRD 작성 전 추가 결정 필요 (2차 성찰 발견)

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 19 | **무료의 목적/동기** | 미정의 | 교육적 공익? 개인 열정? 포트폴리오? 오픈소스? — 이 정의에 따라 성공 기준/비용 상한/스코프 결정 |
| 20 | **비용 상한 설정** | ~~$300/mo~~ → **$15/mo** (3차 성찰) | 로컬 앱으로 서버 비용 $0. Phase 2 릴레이 서버 $5-10/mo |
| 21 | **"완전 무료"의 범위** | 미정의 | 모든 기능 무제한? 사용량 제한 있음? AI 해설 일일 N회? |
| 22 | **후원 채널 전략** | 미정 | GitHub Sponsors/Buy Me a Coffee/Ko-fi 등 Phase 1 포함 여부 |
| 23 | ~~**Hetzner 대안**~~ | ~~자동 사기 탐지 가입 거부 위험~~ | 삭제 (3차 성찰: 로컬 앱, Hetzner 불필요). Phase 2 릴레이 서버는 $5-10 VPS (DigitalOcean/Vultr) |
| 24 | **서비스 종료 계획** | 미정 | 운영 중단 시 사용자 데이터(게임 기록 등) 이관 계획 |

---

## <a id="reflection-3"></a>12. 3차 성찰: SaaS→로컬 앱 전환 영향 분석

> **실행일**: 2026-03-10 | **방법**: 3개 teammate 병렬 투입 (로컬 앱 전환 영향 분석 / 태스크 상태 조사)
> **트리거**: 사용자 결정 — 배포 모델을 SaaS (서버 호스팅) → **사용자 로컬 데스크톱 앱**으로 전환
> **사용자 원문**: "가장 중요한 기준을 하나 말한다. 작동은 SaaS가 아니다. 사용자의 로컬 컴퓨터에서 작동된다."

### 3차 성찰의 핵심 발견

#### 1. 배포 모델 근본 전환

| 차원 | OLD (SaaS) | NEW (로컬 앱) |
|------|:---:|:---:|
| 실행 환경 | 운영자 서버 (Hetzner CCX33) | **사용자 PC** |
| 프레임워크 | Next.js 15 (SSR) | **Tauri 2.0 + Vite + React 19** |
| 데이터베이스 | PostgreSQL 16 + Redis 7.2 | **SQLite (better-sqlite3, WAL mode)** |
| AI 연산 | 서버 KataGo (BullMQ 큐) | **사용자 GPU/CPU KataGo (worker_threads)** |
| LLM 비용 | 운영자 부담 ($115-180/mo) | **Phase 1: $0 (템플릿), Phase 2: 사용자 자체 API 키** |
| 배포 | Coolify + Hetzner | **GitHub Releases + 자동 업데이트** |
| 인증 | Day 1 Better Auth | **Phase 1: 불필요, Phase 2: Better Auth** |
| 알림 | Web Push + Resend 이메일 | **OS 네이티브 알림 (Tauri plugin)** |
| i18n | next-intl | **react-i18next** |
| 모니터링 | Grafana + Prometheus + Loki | **Sentry (데스크톱 크래시 리포팅)** |
| 월 운영비 | $66-70 | **$2 (Phase 1), $7-12 (Phase 2)** |
| 비용 구조 | MAU↑ = 비용↑ | **MAU↑ ≠ 비용↑ (P2P 구조)** |

#### 2. "성공의 역설" 근본 해소

SaaS 모델에서는 **MAU 증가 = 서버 비용 증가**가 필연적이었다 (Claude API, DB, 컴퓨트). 로컬 앱 전환으로:

```
SaaS 모델:     사용자↑ ──→ 서버 부하↑ ──→ 비용↑ ──→ ⚠ 재정 위기
로컬 앱 모델:  사용자↑ ──→ 각자 PC 사용 ──→ 비용 불변 ──→ ✅ 지속 가능
```

- KataGo: 사용자 PC GPU/CPU → 서버 비용 $0
- Claude API: 사용자 자체 API 키 → 운영자 비용 $0
- 데이터: 사용자 로컬 SQLite → DB 서버 비용 $0
- 유일한 비용 증가: Phase 2 릴레이 서버 (동시 접속 비례) — 경량 VPS $5-10/mo로 충분

#### 3. 기술 스택 전면 전환

**제거된 기술 (서버 의존):**
- Next.js 15 (SSR 서버 렌더링)
- PostgreSQL 16 (서버 DB)
- Redis 7.2 (서버 캐시/큐)
- BullMQ (서버 작업 큐)
- Coolify (서버 배포 플랫폼)
- Hetzner CCX33 (서버 인스턴스)
- Resend (서버 이메일)
- Web Push (서버 푸시)
- next-intl (Next.js 전용 i18n)
- Grafana + Prometheus + Loki (서버 모니터링)

**추가된 기술 (로컬 앱):**
- Tauri 2.0 (Rust sidecar, ~10MB 번들, 크로스 플랫폼)
- Vite (빌드 도구, HMR)
- SQLite + better-sqlite3 (WAL mode, 동기 I/O)
- 인메모리 큐 + worker_threads (Node.js 네이티브)
- GitHub Releases + tauri-plugin-updater (자동 업데이트)
- Sentry (데스크톱 크래시 리포팅)
- OS 네이티브 알림 (Tauri notification plugin)
- react-i18next (프레임워크 비의존)
- Tauri commands (Rust↔JS IPC, Zod 검증)

**유지된 기술 (변경 없음):**
- React 19 + TypeScript strict
- Drizzle ORM (드라이버만 PG→SQLite 변경)
- Tailwind CSS 4 + shadcn/ui
- Biome v2.3
- Vitest + Playwright
- KataGo v1.16.2 (실행 환경만 서버→사용자 PC)
- Zustand, Recharts, Shudan fork
- PostHog (클라이언트 SDK)

#### 4. 비용 임팩트 요약

| 비용 항목 | SaaS 모델 | 로컬 앱 모델 | 절감률 |
|----------|:---------:|:----------:|:------:|
| 월 운영비 (Phase 1) | $66-70 | $2 | **97%** |
| 월 운영비 (Phase 2) | $224-311 | $7-12 | **96%** |
| 3년 누적 | $6,600-10,500 | $1,339-2,331 | **78%** |
| Claude API | $115-180/mo | $0 (사용자 부담) | **100%** |
| DB 서버 | $60+/mo | $0 (로컬 SQLite) | **100%** |
| 서버 컴퓨트 | $60/mo | $0 (사용자 PC) | **100%** |

#### 5. 로컬 앱 전환의 새로운 위험

SaaS 위험이 해소된 대신 새로운 데스크톱 앱 고유 위험이 발생:

| 위험 | 확률 | 영향 | 완화 |
|------|:---:|:---:|------|
| 멀티 OS 호환성 (macOS/Win/Linux) | 높음 | 높음 | Tauri 2.0 + GitHub Actions 3 OS CI |
| 앱 크기 + 업데이트 빈도 | 중간 | 중간 | 경량 모델 번들 + 점진 업데이트 |
| 사용자 하드웨어 다양성 | 높음 | 중간 | GPU 자동 감지 + visits 자동 조절 |
| 코드 서명/공증 | 중간 | 높음 | Apple $99/yr + Windows SmartScreen 대응 |
| 오프라인 데이터 동기화 (Phase 2) | 중간 | 중간 | CRDT 또는 conflict resolution 전략 |
| 앱 배포 채널 발견성 | 높음 | 높음 | 랜딩 페이지(Cloudflare) + 바둑 커뮤니티 직접 홍보 |

#### 6. 로컬 앱 전환의 전략적 이점

| 이점 | 설명 |
|------|------|
| **비용 지속가능성** | 운영비 $2/mo로 사실상 무한 운영 가능 |
| **개인정보 보호** | 모든 데이터가 사용자 PC에 저장 → GDPR/개인정보 이슈 최소화 |
| **오프라인 사용** | 인터넷 없이 AI 대국 + 복기 가능 (KataGo 로컬 실행) |
| **성능** | 사용자 GPU 활용 시 KataGo 10-50x 가속 (서버 CPU 대비) |
| **자율성** | 서비스 종료 시에도 앱 계속 사용 가능 (서버 의존 없음) |
| **Anonymous-first** | 가입 없이 즉시 플레이 → 진입 장벽 최소화 |
| **법적 단순성** | 서버 미운영 → 데이터 처리자 의무 최소화 |

#### 7. Phase 1 vs Phase 2 구분 명확화

| 기능 | Phase 1 (로컬 only) | Phase 2 (네트워크 추가) |
|------|:---:|:---:|
| AI 대국 | ✅ 로컬 KataGo | ✅ |
| "Why?" AI 해설 | ✅ 템플릿 ($0) | ✅ + 사용자 API 키 고급 해설 |
| Quick Go (9×9) | ✅ AI 상대 | ✅ + 온라인 매칭 |
| 복기/분석 | ✅ 로컬 KataGo 분석 | ✅ |
| 온보딩 | ✅ | ✅ |
| Auth | ❌ 불필요 | ✅ Better Auth (온라인 대국용) |
| 온라인 대국 | ❌ | ✅ 경량 릴레이 서버 |
| Glicko-2 매칭 | ❌ | ✅ |
| Discord 공유 | ❌ | ✅ Webhooks |
| 후원/기부 | ❌ | ✅ GitHub Sponsors 등 |

#### 8. 기존 연구 유효성 평가 (3차 성찰)

| 구분 | 비율 | 설명 |
|------|:---:|------|
| **완전 유효** | ~65% | 바둑 도메인(규칙/KataGo/LLM/UI), 사용자 분석, 경쟁 분석, AI 해설 |
| **프레이밍 변경** | ~20% | 인프라 전환(서버→로컬), Auth 연기, 비용 모델 전면 보정 |
| **무효화** | ~15% | 서버 배포(Coolify/Hetzner), 서버 DB/캐시(PG/Redis), 서버 모니터링(Grafana), Next.js SSR |

> 2차 성찰 대비 무효화 비율 증가(10%→15%)는 SaaS→로컬 앱이 수익 모델 변경보다 **더 넓은 기술적 영향**을 미치기 때문.

#### 9. 3차 성찰 인라인 반영 목록

| 반영 위치 | 수정 내용 |
|----------|----------|
| 헤더 | 3차 성찰 완료 표기 + 로컬 앱 전환 핵심 |
| 목차 | 섹션 12 추가 |
| 섹션 3 | 기술 스택 전면 전환 (Tauri/SQLite/worker_threads/GitHub Releases), 외부 서비스 7→4개, CCX33→로컬 최소 사양 |
| 섹션 4 | 개발비 $1,099-1,899 (Apple $99 추가), 월 운영비 $66→$2, 누적 비용 $6,600→$1,339, 비용 지속가능성 전면 재작성 |
| 섹션 5 | Tauri 설정/멀티 플랫폼 빌드/코드 서명 추가, Auth/Email/Redis 제거, Go/No-Go 보정 |
| 섹션 6 | R2/R4/R15 삭제, R3/R7/R8 영향 하향, R16-R19 신규 (멀티OS/앱크기/하드웨어/코드서명), R17 SaaS→로컬 앱 |
| 섹션 7 | 기술 교차 검증 11개 항목 3차 성찰 보정 (Framework/DB/Deploy/Auth/i18n 등), 수치 교차 검증 전면 보정 |
| 섹션 8 | R2 Coolify 인사이트 무효화, 만장일치/분쟁해결 3차 성찰 보정 |
| 섹션 9 | 확정 #6/10/12/13/14/18 전환, 제약 #5 비용 한도 $300→$15, Coolify 결정 삭제 |
| 섹션 10 | Auth/게임서버/인프라 자동화율 보정 |
| 섹션 11 | "성공의 역설" 근본 해소 반영, 비용 한도 $300→$15, Hetzner 삭제 |

#### 10. PRD 작성 전 추가 결정 필요 (3차 성찰 발견)

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 25 | **Tauri vs Electron 최종 결정** | Tauri 2.0 선택 | Tauri Rust sidecar 학습 곡선, AI agent Tauri 코드 생성 능력 검증 |
| 26 | **KataGo 번들 전략** | b6c96 번들 + b18c384nbt 다운로드 | CUDA/OpenCL/Eigen 바이너리 3종 번들 vs 사용자 선택 다운로드 |
| 27 | **앱 배포 채널** | GitHub Releases | Microsoft Store / Mac App Store 등록 여부. 사용자 발견성 전략 |
| 28 | **오프라인-온라인 전환 UX** | 미정의 | Phase 2 온라인 기능 추가 시 데이터 동기화 전략 (CRDT, conflict resolution) |
| 29 | **Windows 코드 서명** | 미정의 | EV 코드 서명($200+/yr) vs unsigned 앱 경고 감수. SmartScreen 평판 축적 기간 |
| 30 | **앱 최소 사양 테스트** | 추정치만 존재 | 실제 저사양 PC(4GB RAM, CPU only)에서 KataGo 성능 벤치마크 필요 |

---

## 상세 문서 참조

| 문서 | 위치 |
|------|------|
| **이 통합 요약서** | `/prompt/prd-research-integrated-summary.md` |
| Research 1: 시장/사용자/비즈니스 | `/prompt/prd-research-phase1-market-user-tech-biz.md` |
| Research 2: 기술 스택 | `/prompt/prd-research-phase2-technology-deep-dive.md` |
| Research 3: 바둑 도메인 기술 | `/prompt/prd-research-phase3-baduk-domain-tech.md` |
| Research 4: 외부 연동 기술 | `/prompt/prd-research-phase4-external-integration.md` |
| 프레임워크 원본 | `/prompt/Technology_Development_DeepDive_PRD_Teammate_Executable.md` |
