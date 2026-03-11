# PHASE 3.A: Cutting Edge Technology Scenario

> **"최신 기술이 우리를 더 강하게 만든다"**
>
> **작성일**: 2026-03-10
> **철학**: 검증된 최신 기술을 최대로 활용하여 AI 에이전트 개발팀의 생산성과 결과물 품질을 극대화
> **제약**: AI buildability — AI 에이전트가 코드를 생성하므로, 학습 데이터가 풍부한 기술만 선택

---

## 1. Complete Technology Stack

### Layer 1: Runtime — Bun 1.3+

| 항목 | 상세 |
|------|------|
| **기술** | Bun 1.3+ (Zig + JavaScriptCore) |
| **Why Cutting Edge** | Node.js 대체 런타임. 2023년 1.0 출시 이후 2025-2026에 프로덕션 안정화 |
| **벤치마크** | HTTP 처리량 ~150K req/s (Node.js 14K의 10.7x), 시작 시간 ~5ms (Node.js 50ms의 10x), 메모리 Next.js 기준 380MB (Node.js 512MB 대비 -26%) |
| **리스크** | Medium — npm 호환성 95%+이나 일부 네이티브 모듈 이슈 가능 |
| **Fallback** | Node.js 22 LTS. package.json 호환이므로 `bun` → `node` 전환 1일 이내 |

**Cutting Edge 근거**: Bun 1.3은 built-in database client, zero-config 프론트엔드 개발, HMR을 내장. Next.js와의 메모리 감소(-26%)는 Hetzner 저사양 서버에서 결정적 이점.

---

### Layer 2: Frontend Framework — Next.js 16 + React Compiler

| 항목 | 상세 |
|------|------|
| **기술** | Next.js 16.x + React 19 + React Compiler 1.0 + TypeScript strict |
| **Why Cutting Edge** | Turbopack 기본 번들러 승격, React Compiler 자동 메모이제이션 |
| **벤치마크** | Dev cold start 603ms (Next.js 15의 1083ms 대비 -44%), Prod build 5.7s (Webpack 24.5s 대비 -77%), HMR 18ms (28x faster), 메모리 890MB (58% less) |
| **리스크** | Low — Next.js는 AI 코드 생성 정확도 최고 (학습 데이터 최다) |
| **Fallback** | Next.js 15 (Turbopack opt-in, 동일 코드베이스) |

**Cutting Edge 근거**: Turbopack 안정화로 대형 앱에서도 cold build 12s (Webpack 45s), prod build 절반. React Compiler는 수동 `useMemo`/`useCallback` 제거로 AI 생성 코드의 성능 버그를 구조적으로 제거.

---

### Layer 3: Database — PostgreSQL 17

| 항목 | 상세 |
|------|------|
| **기술** | PostgreSQL 17 |
| **Why Cutting Edge** | VACUUM 메모리 20x 감소 (TidStore), WAL 고동시성 2x 처리량 |
| **벤치마크** | VACUUM 메모리 20x 절감, 고동시성 WAL 쓰기 처리량 2x 향상, COPY 대규모 행 내보내기 2x 성능 |
| **리스크** | Very Low — PostgreSQL 17은 2024.09 GA, 충분히 안정화 |
| **Fallback** | PostgreSQL 16 (동일 스키마, 마이그레이션 불필요) |

**Cutting Edge 근거**: 바둑 대국 기록은 누적 데이터 → VACUUM 효율이 장기 운영에 결정적. TidStore 기반 VACUUM은 소규모 서버에서도 유지보수 부담을 극적으로 줄임.

---

### Layer 4: Cache — Valkey 8.1

| 항목 | 상세 |
|------|------|
| **기술** | Valkey 8.1 (Linux Foundation, BSD 라이선스) |
| **Why Cutting Edge** | Redis fork — 37% 빠른 쓰기, 28% 적은 메모리, 라이선스 리스크 제거 |
| **벤치마크** | SET 999.8K RPS (Redis 729.4K의 1.37x), p99 레이턴시 0.8ms (Redis 0.99ms), 50M sorted set 메모리 3.77GB (Redis 4.83GB의 -22%), 비동기 I/O 스레딩으로 멀티코어 활용 |
| **리스크** | Low — Redis 프로토콜 100% 호환, 모든 Redis 클라이언트 그대로 사용 |
| **Fallback** | Redis 8.x (프로토콜 호환, 드롭인 교체) |

**Cutting Edge 근거**: Valkey는 Linux Foundation 관리 + BSD 라이선스로 Redis의 SSPL 라이선스 리스크를 완전 제거. 성능이 Redis보다 우수하면서 라이선스 비용 $0. 실시간 대국의 세션 캐시, WebSocket 상태, KataGo 분석 캐시에 최적.

---

### Layer 5: ORM — Drizzle ORM (latest)

| 항목 | 상세 |
|------|------|
| **기술** | Drizzle ORM (latest, v1.0 beta) |
| **Why Cutting Edge** | 코드젠 없음 → AI 에이전트가 직접 스키마 정의. SQL 투명성 완전 보장 |
| **벤치마크** | 쿼리 2-3x faster than Prisma, 번들 7.4KB (Prisma 6.5MB의 0.1%), cold start 10x faster |
| **리스크** | Low — v1.0 pre-release이나 프로덕션 사용 사례 다수 (fintech, real-time) |
| **Fallback** | Prisma (마이그레이션 비용 높음, 가급적 회피) |

**Cutting Edge 근거**: Drizzle의 "no codegen" 철학은 AI 에이전트 워크플로우에 완벽 부합. Prisma의 `prisma generate` 단계 없이 TypeScript 스키마가 곧 타입이므로, AI가 스키마 변경 → 쿼리 작성을 단일 흐름으로 처리.

---

### Layer 6: Real-time — Native WebSocket (ws)

| 항목 | 상세 |
|------|------|
| **기술** | `ws` 라이브러리 (Bun 내장 WebSocket 또는 ws npm) |
| **Why Cutting Edge** | Socket.IO 대비 오버헤드 제거, 바둑 대국에 필요한 프로토콜만 구현 |
| **벤치마크** | 단일 서버 10,000+ 동시 연결, sub-millisecond 레이턴시 |
| **리스크** | Medium — 재연결 로직, 하트비트 등 수동 구현 필요 |
| **Fallback** | Socket.IO 4.x (이벤트 기반 추상화, 자동 재연결) |

**Cutting Edge 근거**: 바둑 대국은 저빈도 메시지(수 당 1회, 3-30초 간격)이므로 Socket.IO의 풍부한 기능이 불필요. Raw WebSocket이 메모리/CPU 최적. Bun 내장 WebSocket은 추가 의존성 제거.

---

### Layer 7: AI / Game Engine — KataGo v1.16.2 (CPU Eigen)

| 항목 | 상세 |
|------|------|
| **기술** | KataGo v1.16.2 + CPU Eigen backend + b28c512nbt 최신 모델 |
| **Why Cutting Edge** | MIT 라이선스, 최신 v1.16.2 (2025.06), b28c512nbt 모델은 이전 대비 200-300 Elo 향상 |
| **성능** | CPU Eigen: 3-8초 분석 (복기), 동시 3-5세션. GPU 없이 프로 9단 이상 수준 |
| **리스크** | Very Low — KataGo는 바둑 AI의 de facto standard. 한국 국가대표팀도 사용 |
| **Fallback** | KataGo 이전 안정 버전 (v1.15.x) |

**Cutting Edge 근거**: v1.16.x는 action-value head 연구 데이터를 축적하는 최신 학습 체계 도입. 분산 학습 커뮤니티가 지속적으로 더 강한 모델 배포. CPU Eigen은 GPU 비용 $0이면서 프로 수준 분석 제공.

---

### Layer 8: LLM Pipeline — Claude API 3-Tier

| 항목 | 상세 |
|------|------|
| **기술** | Haiku 4.5 (primary) / Sonnet 4.6 (complex) / Template (fallback) |
| **Pricing** | Haiku: $1/$5 per M tokens, Sonnet: $3/$15 per M tokens |
| **전략** | 80% Haiku (일반 해설) + 15% Sonnet (복잡한 전략 설명) + 5% Template (API 장애 시) |
| **리스크** | Medium-High — Claude API 안정성 7/10, 외부 의존성 |
| **Fallback** | Template 기반 해설 (KataGo 수치 + 미리 작성된 패턴 매칭 해설) |

**3-Tier 전략 상세:**

```
Tier 1 — Haiku 4.5 (80% 트래픽)
  ├─ 단순 착수 해설: "이 수는 흑의 영향력을 넓히는 좋은 수입니다"
  ├─ 승률 변동 설명: "이 수로 흑의 승률이 62%→58%로 감소했습니다"
  └─ 비용: ~$0.30/1000 해설 (평균 300 input + 200 output tokens)

Tier 2 — Sonnet 4.6 (15% 트래픽)
  ├─ 복잡한 전략 분석: "이 시점에서 흑은 중앙 두터움과 변 실리 사이의 선택..."
  ├─ 게임 전체 흐름 요약: 복기 리포트
  └─ 비용: ~$0.90/1000 해설

Tier 3 — Template (5% 트래픽, Fallback)
  ├─ Claude API 장애/지연 시 자동 전환
  ├─ KataGo 수치 기반 미리 정의된 해설 패턴
  └─ 비용: $0 (로컬 처리)
```

**비용 최적화:**
- Prompt caching 활용: 바둑 도메인 시스템 프롬프트 캐시 → 읽기 비용 0.1x
- Batch API: 비실시간 복기 리포트는 50% 할인
- 결과: 월 8K MAU 기준 LLM 비용 $80-150/월 예상

---

### Layer 9: Rating System — Glicko-2

| 항목 | 상세 |
|------|------|
| **기술** | Glicko-2 (glicko2.ts npm 패키지) |
| **Why** | OGS/Lichess에서 검증된 바둑/체스 표준. Rating Deviation으로 불확실성 표현, Volatility로 기복 추적 |
| **구현** | 초기값 1500 ±350, 주기: 대국 15판 또는 7일 |
| **리스크** | Very Low — 수학적으로 검증된 알고리즘, TypeScript 구현체 안정 |

---

### Layer 10: Testing — Vitest 4.0 + Playwright

| 항목 | 상세 |
|------|------|
| **기술** | Vitest 4.0 (unit/component) + Playwright (E2E) |
| **Why Cutting Edge** | Vitest 4.0: Browser Mode 안정화, Visual Regression Testing 내장, Playwright Traces 통합 |
| **벤치마크** | Vitest 주간 다운로드 7M→17M (1년간 2.4x 성장) |
| **전략** | Strategic TDD — AI 에이전트가 테스트 주도로 코드 작성 시 더 빠르고 정확 (DORA 2025) |
| **리스크** | Low — Vitest는 Vite 생태계 표준, Playwright는 E2E 업계 표준 |

**AI Agent TDD Workflow:**
```
1. AI 에이전트가 Vitest 테스트 먼저 작성
2. 테스트 실패 확인 (Red)
3. 최소 구현으로 테스트 통과 (Green)
4. 리팩토링 (Refactor)
5. 반복 — AI의 코드 클로닝 4x 문제를 TDD로 구조적 억제
```

---

### Layer 11: Linting & Formatting — Biome v2.3

| 항목 | 상세 |
|------|------|
| **기술** | Biome v2.3 (Rust 기반 통합 린터+포매터) |
| **Why Cutting Edge** | ESLint+Prettier 교체. 단일 바이너리로 lint + format + 번들링. 423+ 린트 규칙, type-aware linting |
| **벤치마크** | 10K 파일 lint: 0.8s (ESLint 45.2s의 56x), 10K 파일 format: 0.3s (Prettier 12.1s의 40x), 단일 설정 파일 (ESLint+Prettier 4개 대비) |
| **리스크** | Low — Prettier 호환 모드 내장, ESLint 규칙 80%+ 호환 |
| **Fallback** | ESLint 9 + Prettier 4 (설정 복잡도 증가) |

**Cutting Edge 근거**: CI 파이프라인에서 lint+format 시간이 45s→0.8s로 단축. Pre-commit hook에서 개발자 경험 결정적 개선. 단일 바이너리이므로 AI 에이전트의 의존성 관리 단순화.

---

### Layer 12: Code Quality — SonarQube Community + AI Code Assurance

| 항목 | 상세 |
|------|------|
| **기술** | SonarQube Community Build (2025.x) |
| **Why** | AI 생성 코드의 1.7x 이슈, 4x 코드 클로닝 문제를 구조적으로 감시 |
| **2026 기능** | AI Code Assurance — AI 생성 코드 자동 감지 + 특화 Taint Analysis. JS/TS 분석 40% 속도 향상 |
| **목표** | SQALE ≤5% (기술 부채 비율) |
| **리스크** | Low — 업계 표준, 커뮤니티 에디션 무료 |

---

### Layer 13: Infrastructure — Coolify + Hetzner

| 항목 | 상세 |
|------|------|
| **기술** | Coolify (self-hosted PaaS) + Hetzner Cloud |
| **Why Cutting Edge** | Vercel 대비 90% 비용 절감, 풀 컨트롤 유지 |
| **서버 구성** | |

**초기 (Month 1-3):**

| 서버 | 스펙 | 월 비용 | 용도 |
|------|------|---------|------|
| CCX13 | 2 vCPU, 8GB, 80GB NVMe | €11.99 | App + DB + Valkey |
| — | — | — | KataGo는 같은 서버에서 CPU Eigen |

**성장 (Month 4-6):**

| 서버 | 스펙 | 월 비용 | 용도 |
|------|------|---------|------|
| CCX23 | 4 vCPU, 16GB, 160GB NVMe | €23.99 | App (Next.js + Bun) |
| CCX13 | 2 vCPU, 8GB, 80GB NVMe | €11.99 | DB (PostgreSQL 17) + Valkey |
| CX23 | 2 vCPU, 4GB, 40GB NVMe | €3.49 | KataGo 전용 |

**비용 비교:**
- Coolify + Hetzner: ~€17-40/월 ($18-43)
- Vercel Pro: $20/seat + 대역폭 → $200-850+/월
- Railway: $8-15/월 (단, 스케일 시 증가 빠름)
- **절감**: Vercel 대비 90%+

**리스크**: Medium — 서버 관리 직접 필요. Coolify가 PaaS 자동화하나, 장애 시 직접 대응.
**Fallback**: Railway ($15/월) 또는 Render free tier.

---

### Layer 14: Observability — Lightweight Stack

| 항목 | 상세 |
|------|------|
| **기술** | Grafana Cloud Free Tier + Prometheus (Node Exporter) + Loki (로그) |
| **대안** | OpenObserve (self-hosted, 단일 플랫폼, 140x 압축) |
| **Why** | MAU 8K 규모에서 엔터프라이즈 옵저버빌리티 불필요. Grafana Cloud 무료 최대 10K 시계열 |
| **리스크** | Low — Grafana Cloud Free는 소규모에 충분 |

**모니터링 대상:**
- App: 응답 시간, 에러율, WebSocket 연결 수
- DB: 쿼리 지연, 커넥션 풀, VACUUM 상태
- KataGo: 분석 시간, 큐 깊이, 크래시 카운트
- LLM: API 응답 시간, 토큰 사용량, 에러율, 비용

---

### Layer 15: Security

| 항목 | 상세 |
|------|------|
| **인증** | NextAuth.js v5 (OAuth — Google, GitHub, Discord) |
| **API 보호** | Rate limiting (Valkey 기반), CORS, CSP headers |
| **데이터** | bcrypt (비밀번호), AES-256 (민감 데이터), HTTPS 전용 |
| **의존성** | GitHub Dependabot + `npm audit` 자동화 |
| **코드** | SonarQube Taint Analysis (AI 코드 대상 강화) |

---

### Layer 16: CI/CD — GitHub Actions

| 항목 | 상세 |
|------|------|
| **기술** | GitHub Actions (Free tier: 2,000분/월 private, 무제한 public) |
| **파이프라인** | |

```yaml
# .github/workflows/ci.yml
name: CI/CD
on: [push, pull_request]
jobs:
  lint:      # Biome v2.3 — ~1s
  test:      # Vitest 4.0 — ~10s
  e2e:       # Playwright — ~30s
  quality:   # SonarQube scan — ~60s
  build:     # Next.js 16 Turbopack — ~12s
  deploy:    # Coolify webhook — ~30s
# Total: ~2.5 minutes (lint→deploy)
```

**전략:**
- PR마다 lint + test + build 자동 실행
- main 머지 시 자동 배포 (Coolify webhook)
- 배포 빈도: 일 2-5회 (AI 에이전트 작업 속도에 따라)

---

## 2. Development Environment & Process

### Local Dev Setup

**Time to First Run: ~3 minutes**

```bash
# Prerequisites: Bun 1.3+, Docker (for PostgreSQL + Valkey)
git clone <repo>
cd baduk-platform
bun install                          # ~5s (Bun install is 25x faster than npm)
docker compose up -d                 # PostgreSQL 17 + Valkey 8.1 (~15s)
bun run db:push                      # Drizzle schema push (~3s)
bun run katago:setup                 # Download KataGo binary + model (~60s first time)
bun dev                              # Next.js 16 + Turbopack (~2s cold start)
```

### Development Cycle

```
Code → Lint → Test → Build → Deploy
 AI agent writes code
  ↓
 Biome pre-commit (0.8s)
  ↓
 Vitest unit/component (10s)
  ↓
 GitHub Actions CI (2.5min)
  ↓
 Coolify auto-deploy (30s)

Total cycle: ~4 minutes from commit to production
```

### AI Agent Workflow Optimization

| 최적화 | 효과 |
|--------|------|
| **Bun** | npm install 25x 빠름 → 의존성 추가 시 대기 시간 제거 |
| **Turbopack** | HMR 18ms → AI가 변경 즉시 확인 |
| **Biome** | lint 56x 빠름 → pre-commit hook에서 AI 블로킹 제거 |
| **Drizzle (no codegen)** | 스키마 변경 → 즉시 타입 반영 (Prisma generate 단계 제거) |
| **Strategic TDD** | AI 코드 클로닝 4x 문제를 테스트로 구조적 억제 |
| **TypeScript strict** | AI 생성 코드의 타입 오류를 컴파일 타임에 차단 |
| **React Compiler** | useMemo/useCallback 실수를 자동 수정 → AI 성능 버그 제거 |

### Deploy Strategy

- **전략**: Continuous Deployment (main 머지 = 자동 배포)
- **빈도**: 일 2-5회
- **롤백**: Coolify 원클릭 이전 버전 복구
- **블루-그린**: Phase 2 (MAU 10K+) 시 도입
- **다운타임**: Zero (Coolify 롤링 업데이트)

---

## 3. Realistic Assessment

### Development Difficulty: **High**

| 영역 | 난이도 | 이유 |
|------|--------|------|
| Bun 런타임 | Medium | npm 호환성 95%이나 엣지 케이스 존재 |
| Next.js 16 + Turbopack | Medium | 최신 버전 — 일부 문서/커뮤니티 답변 부족 가능 |
| KataGo 통합 | High | IPC/stdio 통신, crash recovery, playout 튜닝 수동 필요 |
| LLM 파이프라인 | High | 바둑 도메인 프롬프트 엔지니어링, 환각 억제 |
| Go 규칙 엔진 | Medium | 계가(counting), 패(ko), 사활(life/death) 알고리즘 |
| WebSocket 대국 | Medium-High | 재연결, 시간 동기화, 상태 일관성 |
| Glicko-2 | Low | 수학 공식 구현, 라이브러리 존재 |
| Coolify 인프라 | Medium | 서버 관리, SSL, 백업 직접 구성 |

**종합 난이도: High** — 개별 기술은 관리 가능하나, 통합 복잡도가 높음 (KataGo ↔ LLM ↔ WebSocket ↔ 대국 로직).

### AI Agent Learning Curve

| 기술 | AI 코드 생성 품질 | 학습 데이터 | 예상 자동화율 |
|------|-------------------|-------------|--------------|
| Next.js/React/TypeScript | Excellent | 최다 | 85-90% |
| Drizzle ORM | Good | 풍부 (성장 중) | 75-80% |
| Bun 런타임 | Good | 중간 (Node.js 코드 대부분 호환) | 70-75% |
| Biome 설정 | Good | 중간 | 70% |
| Vitest 테스트 | Good | 풍부 (Jest 유사) | 80% |
| Playwright E2E | Good | 풍부 | 75% |
| WebSocket 대국 로직 | Fair | 제한적 (도메인 특화) | 40-50% |
| KataGo IPC | Poor | 매우 제한적 | 20-30% |
| Go 규칙 엔진 | Fair | 제한적 | 40-50% |
| LLM 프롬프트 설계 | Manual | N/A | 10-20% |

**종합 AI 자동 구현율: 55-65%** (CRUD/UI/인프라 높음, 게임 로직/AI 파이프라인 낮음)

### Expected Bugs

| 카테고리 | 예상 버그 수 (6개월) | 심각도 | 근거 |
|----------|---------------------|--------|------|
| AI 생성 코드 일반 | 150-250 | Low-Medium | GitClear: AI 코드 1.7x 이슈율 |
| 코드 클로닝/중복 | 80-120 | Low | GitClear: 4x cloning. TDD로 50% 감소 예상 |
| KataGo 통합 | 20-30 | High | IPC 타임아웃, crash, 모델 로딩 |
| LLM 환각 | 30-50 | High | 바둑 용어 오용, 잘못된 수순 설명 |
| WebSocket 동기화 | 15-25 | High | 재연결 시 상태 불일치, 타이밍 |
| Go 규칙 엣지 케이스 | 10-20 | Medium-High | 패(ko), 초패(superko), 계가 논쟁 |
| Bun 호환성 | 5-10 | Medium | 네이티브 모듈 이슈 |
| **총계** | **310-505** | — | SonarQube + TDD로 관리 |

### Expected Development Period

| 항목 | Cutting Edge | Baseline (6개월) |
|------|-------------|-----------------|
| 개발 기간 | **6.5-7.5개월** | 6개월 |
| 초과 원인 | Bun 호환성 디버깅 1-2주, KataGo 통합 추가 1-2주 |
| 이점 | DX 향상으로 Month 4+ 가속 |

---

## 4. Risks & Mitigation

### Risk Matrix

| # | 위험 | 확률 | 영향 | 완화 |
|---|------|------|------|------|
| R1 | **LLM 환각 — 바둑 해설 오류** | 60% | Critical | M1 Go/No-Go: 유단자 5명 평가 70%+ 정확도. 실패 시 Template 전환 |
| R2 | **Bun npm 호환성 이슈** | 30% | Medium | Bun → Node.js 22 전환 1일 이내. package.json 공유 |
| R3 | **Claude API 안정성 (7/10)** | 40% | High | 3-Tier: Template fallback 자동 전환. Circuit breaker 패턴 |
| R4 | **KataGo CPU 성능 한계** | 20% | Medium | 초기 동시 3-5세션 → 큐잉 시스템 → Phase 2 GPU 전환 |
| R5 | **Next.js 16 초기 버그** | 25% | Low | Next.js 15 다운그레이드 (동일 코드베이스, 1일 작업) |
| R6 | **Hetzner 가격 인상 (2026.04)** | 95% | Low | 30-35% 인상 → €17→€23 수준. 여전히 Vercel 대비 90% 절감 |
| R7 | **AI 에이전트 Bun 코드 품질** | 35% | Medium | Node.js 코드 대부분 호환. 차이점은 테스트로 검증 |
| R8 | **Drizzle ORM v1.0 미달** | 15% | Low | Beta이나 프로덕션 사용 다수. 최악 시 Kysely 전환 |
| R9 | **개발 기간 초과** | 40% | Medium | 6→7.5개월. Cutting Edge 고유 리스크. 스코프 축소로 대응 |

### Technology Selection Error Mitigation

모든 핵심 기술에 **동일 생태계 내 Fallback** 보장:

```
Bun 1.3         → Node.js 22 LTS        (1일)
Next.js 16      → Next.js 15            (1일)
Valkey 8.1      → Redis 8.x             (1시간)
PostgreSQL 17   → PostgreSQL 16         (마이그레이션 불필요)
Drizzle ORM     → Kysely                (1-2주)
Biome v2.3      → ESLint 9 + Prettier 4 (2일)
Vitest 4.0      → Vitest 3.x            (1시간)
```

### AI Code Generation Challenges

| 도전 | 대응 |
|------|------|
| Bun 관련 코드 생성 | Node.js 코드 95% 호환 → 차이점만 수동 조정 |
| Next.js 16 새 API | React/Next.js 학습 데이터 최다 → 대부분 정확 |
| Biome 설정 | 기본 설정으로 충분, 커스텀은 수동 |
| Drizzle 스키마 | 학습 데이터 성장 중, SQL 지식으로 보완 가능 |
| 바둑 도메인 로직 | AI 자동화 어려움 → 수동 작성 (전체의 35-45%) |

---

## 5. 6-Month Milestone Roadmap

### Month 1: Foundation Sprint

**기능:**
- 프로젝트 초기화 (Bun + Next.js 16 + Turbopack + Biome)
- PostgreSQL 17 + Drizzle ORM 스키마 설계
- NextAuth.js 인증 (Google, GitHub)
- KataGo v1.16.2 IPC 통합 프로토타입
- Go 규칙 엔진 기본 구현 (19×19, 9×9, 13×13)
- 바둑판 UI 컴포넌트 (React Canvas/SVG)

**인프라:**
- Coolify + Hetzner CCX13 (€11.99/월)
- GitHub Actions CI/CD
- SonarQube 초기 설정

**품질:**
- 테스트 커버리지 > 40%
- SQALE < 3%
- Biome 0 warning

---

### Month 2: Core Engine

**기능:**
- PvP 대국 (WebSocket 실시간)
- KataGo AI 대국 (10단계)
- Glicko-2 레이팅 시스템
- LLM "Why?" 해설 프로토타입 (Claude Haiku 4.5)
- 기본 대국 기록/복기

**인프라:**
- Valkey 8.1 세션/캐시 계층 추가
- KataGo 분석 큐 시스템

**품질:**
- 테스트 커버리지 > 55%
- **M1 Go/No-Go**: LLM 해설 정확도 70%+ (유단자 5명 평가)

---

### Month 3: Quick Go + AI Enhancement

**기능:**
- Quick Go (9×9, 3분 블리츠)
- AI 대국 30단계 확장
- "Why?" 해설 3수준 (입문/중급/고급)
- LLM 환각 억제 시스템 (도메인 검증 레이어)
- 대국 히스토리/통계

**인프라:**
- 서버 분리 시작 (App + DB 분리)
- 모니터링 대시보드 (Grafana)

**품질:**
- 테스트 커버리지 > 65%
- LLM 정확도 > 75%

---

### Month 4: Onboarding + Beta

**기능:**
- Zero-to-First-Game 온보딩 (5분 인터랙티브 튜토리얼)
- PWA 설정 (모바일 최적화)
- 글로벌 ELO 매칭 시스템
- AI fallback 매칭 (유저풀 부족 시 KataGo 대체)
- 기본 프로필/설정

**인프라:**
- CCX23 + CCX13 2서버 구성
- CDN (Hetzner 내장)

**품질:**
- 테스트 커버리지 > 70%
- **M2 Go/No-Go**: Beta DAU 100+
- 성능: P95 응답 < 200ms (대국 제외)

---

### Month 5: Gamification + Polish

**기능:**
- 성장 여정 게이미피케이션 (레벨, 배지, 일일 퀘스트)
- AI 복기 리포트 (전체 대국 분석 — Sonnet 4.6)
- 리더보드
- 알림 시스템 (대국 초대, 턴 알림)
- UX 개선 (베타 피드백 반영)

**인프라:**
- 성능 최적화 (Valkey 캐시 전략 고도화)
- 백업 자동화

**품질:**
- 테스트 커버리지 > 75%
- SQALE < 5%
- Core Web Vitals: LCP < 2.5s, INP < 200ms

---

### Month 6: Public Launch

**기능:**
- Freemium 결제 통합 (Stripe — $9.99/월 Premium)
- 마케팅 랜딩 페이지
- i18n (영어 + 한국어 + 중국어 간체)
- 이용약관/개인정보처리방침
- 최종 QA + 부하 테스트

**인프라:**
- 3서버 구성 (App + DB + KataGo)
- WAF 기본 설정
- 자동 백업 + 재해 복구 테스트

**품질:**
- 테스트 커버리지 > 80%
- SQALE < 5%
- **M3 Go/No-Go**: MAU 2K+, 유료 50+
- Lighthouse 점수 > 90

---

### Infrastructure Evolution Summary

```
Month 1-3:  1 서버 (CCX13, €12/월)    → 올인원
Month 4-6:  2-3 서버 (€28-40/월)       → App/DB/KataGo 분리
Month 7-12: 3-4 서버 (€50-80/월)       → 수평 확장 시작
Month 13+:  4-6 서버 (€100-150/월)     → KataGo GPU 전환 고려
```

### Quality Metrics Evolution

| 지표 | M1 | M2 | M3 | M4 | M5 | M6 |
|------|-----|-----|-----|-----|-----|-----|
| 테스트 커버리지 | 40% | 55% | 65% | 70% | 75% | 80%+ |
| SQALE 부채 비율 | <3% | <3% | <4% | <4% | <5% | <5% |
| LLM 정확도 | 70% | 75% | 80% | 82% | 85% | 85%+ |
| Lighthouse | — | — | 75 | 80 | 85 | 90+ |
| P95 응답 시간 | — | <500ms | <300ms | <200ms | <200ms | <150ms |

---

## 6. Cost Analysis

### Monthly Infrastructure Cost

| 항목 | Month 1-3 | Month 4-6 | Month 7-12 | Month 13-18 |
|------|-----------|-----------|------------|-------------|
| Hetzner 서버 | €12 | €40 | €70 | €130 |
| 도메인 + DNS | €1 | €1 | €1 | €1 |
| 이메일 (Resend) | $0 | $0 | $0 | $20 |
| **인프라 소계** | **~$14** | **~$44** | **~$77** | **~$143** |

> Note: 2026.04 Hetzner 가격 인상 30-35% 반영 시 Month 4+ 약 $57-58

### LLM API Cost Projection

| 기간 | MAU | 일 평균 해설 | 월 해설 수 | Haiku (80%) | Sonnet (15%) | 월 LLM 비용 |
|------|------|------------|----------|------------|-------------|------------|
| M1-2 | 0-100 | 50 | 1,500 | $0.36 | $0.20 | **~$1** |
| M3-4 | 100-1K | 500 | 15,000 | $3.60 | $2.03 | **~$6** |
| M5-6 | 1K-8K | 3,000 | 90,000 | $21.60 | $12.15 | **~$34** |
| M7-12 | 8K-25K | 10,000 | 300,000 | $72 | $40.50 | **~$113** |
| M13-18 | 25K-50K | 25,000 | 750,000 | $180 | $101 | **~$281** |

**비용 최적화 적용:**
- Prompt caching (시스템 프롬프트): 읽기 비용 -90% → 실질 -30% 전체 비용
- Batch API (복기 리포트): -50% → 실질 -8% 전체 비용
- **최적화 후 실질 비용**: 위 금액의 약 60-70%

### Total Cost Summary

| 기간 | 인프라 | LLM API | 기타 (도메인 등) | **월 총비용** | **누적** |
|------|--------|---------|----------------|--------------|---------|
| **Month 1-3** | $42 | $3 | $10 | **~$18/월** | **$55** |
| **Month 4-6** | $132 | $40 | $10 | **~$61/월** | **$237** |
| **6개월 총계** | | | | | **~$292** |
| **Month 7-12** | $462 | $678 | $60 | **~$200/월** | **$1,492** |
| **12개월 총계** | | | | | **~$1,492** |
| **Month 13-18** | $858 | $1,686 | $120 | **~$444/월** | **$4,156** |
| **18개월 총계** | | | | | **~$4,156** |

**vs 전통적 개발팀:**
- 전통적: 6개월 $180-300K (3인 개발팀)
- Cutting Edge (AI workflow): 6개월 **~$292**
- **비용 절감: 99.8-99.9%**

---

## 7. Conclusion

### Technical Leadership Requirement

| 역할 | 필요 수준 | 이유 |
|------|----------|------|
| **기술 리드 (인간)** | 시니어 풀스택 1명 | KataGo 통합, LLM 프롬프트 설계, 아키텍처 의사결정 — AI로 대체 불가 |
| **AI 에이전트 팀** | Claude Code agents | CRUD/UI/인프라 60-65% 자동 구현 |
| **바둑 도메인 자문** | 유단자 1명 (파트타임) | LLM 해설 정확도 검증, 규칙 엣지 케이스 |

### 6-Month Feature Delivery Estimate

| 카테고리 | 기능 수 | 상세 |
|----------|--------|------|
| Green Zone (핵심) | 5 | Why AI, Quick Go, 온보딩, ELO 매칭, AI 대국 |
| Yellow Zone (부가) | 2 | 게이미피케이션, PWA |
| 인프라/품질 | 8 | CI/CD, 모니터링, 인증, 결제, i18n, 테스트, 보안, 성능 |
| **총 Feature 수** | **15** | 6.5-7.5개월 예상 |

### Success Probability

| 시나리오 | 성공 확률 | 조건 |
|----------|----------|------|
| 풀 스코프 달성 (6개월 내) | **50-55%** | 모든 기술이 순조롭게 통합 |
| 풀 스코프 달성 (7.5개월 내) | **65-70%** | Bun/Next.js 16 초기 이슈 1-2주 추가 |
| 코어 기능 + 축소 스코프 | **80%** | Yellow Zone 일부 Phase 2 이동 |

### Key Advantage Over Other Scenarios

| vs Balanced-Tech | vs Proven Stack |
|-----------------|----------------|
| **DX 2-5x 향상** (Turbopack, Biome, Bun) | **DX 5-10x 향상** |
| **인프라 비용 -90%** (Coolify+Hetzner vs Vercel) | **인프라 비용 -85%** |
| **CI 파이프라인 56x 빠름** (Biome) | **CI 파이프라인 56x 빠름** |
| **메모리 -26%** (Bun) | **메모리 -26%** |
| **라이선스 리스크 제거** (Valkey BSD) | **라이선스 리스크 제거** |
| 통합 복잡도 약간 높음 | 통합 복잡도 상당히 높음 |
| 개발 기간 +0.5-1.5개월 | 기준 |

### Final Verdict

**Cutting Edge Scenario는 "기술이 우리를 더 강하게 만든다"는 철학을 구현한다.**

- **강점**: DX 극대화, 비용 극소화, 미래 기술 부채 최소화, 모든 Fallback 확보
- **약점**: 통합 복잡도 높음, 개발 기간 6→7.5개월 리스크, AI 학습 데이터 일부 부족
- **권장 조건**: 기술적 도전을 즐기는 리더 + 1-2주 버퍼를 수용할 수 있는 일정
- **핵심 차별화**: 같은 $292/6개월 비용으로 Balanced-Tech 대비 **DX가 2-5배 빠르고**, 기술 부채가 구조적으로 적으며, 18개월 시점에서 기술 전환 비용이 $0에 가까움

> **"좋은 기술은 비용을 줄이고, 위대한 기술은 가능성을 넓힌다."**
> — Cutting Edge Scenario는 후자를 추구한다.

---

## Appendix: Technology Version Matrix

| Layer | Primary | Version | Fallback | Fallback Version | Switch Cost |
|-------|---------|---------|----------|-------------------|-------------|
| Runtime | Bun | 1.3+ | Node.js | 22 LTS | 1 day |
| Frontend | Next.js | 16.x | Next.js | 15.x | 1 day |
| UI Library | React | 19 | React | 18 | 2-3 days |
| Language | TypeScript | 5.7+ strict | — | — | — |
| Database | PostgreSQL | 17 | PostgreSQL | 16 | 0 |
| Cache | Valkey | 8.1 | Redis | 8.x | 1 hour |
| ORM | Drizzle | latest | Kysely | latest | 1-2 weeks |
| Real-time | ws (native) | latest | Socket.IO | 4.x | 2-3 days |
| AI Engine | KataGo | v1.16.2 | KataGo | v1.15.x | 1 hour |
| LLM | Claude Haiku 4.5 | latest | Template | — | 0 (auto) |
| LLM (complex) | Claude Sonnet 4.6 | latest | Haiku 4.5 | — | 0 (auto) |
| Rating | Glicko-2 | glicko2.ts | — | — | — |
| Testing (Unit) | Vitest | 4.0 | Vitest | 3.x | 1 hour |
| Testing (E2E) | Playwright | latest | — | — | — |
| Linting | Biome | v2.3 | ESLint+Prettier | 9+4 | 2 days |
| Code Quality | SonarQube | Community 2025.x | — | — | — |
| PaaS | Coolify | latest | Railway | — | 1-2 days |
| Cloud | Hetzner | — | — | — | — |
| CI/CD | GitHub Actions | — | — | — | — |
| Auth | NextAuth.js | v5 | — | — | — |
| Observability | Grafana Cloud Free | — | OpenObserve | — | 1-2 days |
