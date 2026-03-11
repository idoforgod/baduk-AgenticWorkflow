# PRD 바둑 도메인 기술 심층조사 결과 — PHASE 1-4 종합

> **조사 일자**: 2026-03-10
> **프로세스**: Technology_Development_DeepDive_PRD_Teammate_Executable.md 기반
> **투입 에이전트**: 17개 + Orchestrator (PHASE 1: 10개, PHASE 2: 4개, PHASE 3: 3개)
> **연구 번호**: Research 3 of 3 — 바둑 도메인 기술 심층조사

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
| KataGo-Aggressive | KataGo 통합 — 최신 기능 극대화 | Analysis Engine, HumanSL, GPU 업그레이드 |
| KataGo-Conservative | KataGo 통합 — 안정적 통합 | CPU Eigen, 단일 프로세스, 최소 구성 |
| GoRules-Evolutionary | 바둑 규칙 엔진 — 점진적 구현 | Tromp-Taylor, Chinese scoring, 2주 MVP |
| GoRules-BigBang | 바둑 규칙 엔진 — 완전 구현 | 6개 규칙셋, 45개 에지케이스, 10주 |
| LLM-Rapid | LLM 해설 — 빠른 파이프라인 | 템플릿 10일, Haiku V2 25일 |
| LLM-Robust | LLM 해설 — 견고한 파이프라인 | 4-layer 검증, 골든 데이터셋 200개 |
| GameServer-DebtMin | 대국 서버 — 기술부채 최소화 | Event sourcing, 순수 코어, 5-6주 |
| GameServer-Practical | 대국 서버 — 실용적 접근 | MVP 10-14일, 8개 추적 단축키 |
| UI-Modern | UI/UX — 최신 인터랙션 | SVG, Shudan fork, 30개 컴포넌트, 6주 |
| UI-Classical | UI/UX — 검증된 패턴 | SVG, 18개 컴포넌트, 4-5주, 20년+ 검증 |

### 핵심 발견 사항

#### KataGo 통합

**Aggressive Branch:**
- Analysis Engine Mode (JSON stdin/stdout) — GTP 대비 3-5x 빠름
- HumanSL 모델 — 랭크별 AI 대국 ("AI가 5급처럼 두기")
- GPU 업그레이드: CPU Eigen ($65/mo) → TensorRT ($220/mo, 87-104x)
- Process pool 2-4개, BullMQ 큐, ~100 analyses/min (CPU)
- Adaptive visits: 5 (즉시) → 50 (빠른 분석) → 500 (심층 복기)

**Conservative Branch:**
- CPU Eigen 충분 (MAU 8K) — GPU 불필요
- 단일 프로세스 + BullMQ, Hetzner CCX33 €60/mo
- child_process.spawn() 단순 IPC, 3초 backoff 자동 재시작
- GPU 전환 트리거: 큐 대기 >15초 지속 시

#### 바둑 규칙 엔진

**Evolutionary Branch:**
- Tromp-Taylor 규칙 (10문장, 수학적 완전성)
- Chinese scoring만 (Phase 1) — dead stone agreement 불필요
- **MVP 2주**: 200-400줄 TypeScript 코어
- 1D Uint8Array, Zobrist hashing (O(1) superko)
- 증분 빌드: Place → Capture → Ko → Scoring → Superko

**Big Bang Branch:**
- 6개 주요 규칙셋 완전 명세 (일본/중국/AGA/Ing/한국/뉴질랜드)
- 45개 에지케이스 카탈로그 (삼패, 영생, 만년패 등)
- KataGo 3-class 아키텍처 (Board, BoardHistory, Rules) = 골드 스탠다드
- 10주, 4-5K줄 코드 + 6-8K줄 테스트
- 95% AI agent 구현 신뢰도

#### LLM 설명 파이프라인

**Rapid Branch:**
- V1 템플릿 (10일): KataGo 데이터 패턴 매칭 → 사전 작성 설명
- V2 Haiku (25일): Claude Haiku 자연어 생성
- 월 $1,200-2,200 (MAU 8K)
- **어떤 경쟁자도 자연어 바둑 해설을 제공하지 않음** — 이것이 moat

**Robust Branch:**
- **LLM은 바둑 이해 능력 ZERO** — 연구로 확인
- LLM = 번역기, KataGo = 진실의 원천
- **4-layer 검증**: 데이터 앵커링 → 제한된 생성 → 출력 검증 → 스팟체크
- 골든 데이터셋 200개 포지션 (3-5명 단급자 검증)
- 고위험 포지션 (사활/패/세키) → **필수 템플릿 폴백**
- 10주, 런칭 시 75-80% 정확도

#### 실시간 대국 서버

**Debt Minimized Branch:**
- **Event sourcing = 바둑의 완벽한 도메인 핏** — SGF가 곧 이벤트 로그
- Immutable GameState, 순수 코어 모듈
- Server-authoritative (모든 검증 서버), BullMQ for KataGo 큐
- 5-6주, 2K-3K 동시 게임

**Practical Branch:**
- MVP 10-14일, 8개 추적 단축키 (기술 부채)
- MAU 25K+까지 안전 — 단일 프로세스 50K+ 연결
- 단순 매칭: ELO ±200, 30초 후 범위 확장

#### 바둑 UI/UX

**Modern Branch:**
- **SVG 렌더링** — DOM 이벤트, React JSX 통합, 접근성
- **Shudan** (Sabaki 보드 컴포넌트) fork — MIT, 60% UI 무료
- ~30개 컴포넌트, 6주
- 모바일: **Tap-Preview-Confirm** 2단계 (19×19 오클릭 방지)
- Recharts (승률 차트), Zustand (상태), @use-gesture (터치)
- KaTrain 색상 코드 (초록→파랑→노랑→주황→빨강)

**Classical Branch:**
- SVG 확인, **18개 최소 컴포넌트**, 4-5주 MVP
- **20년+ 검증 패턴** (CGoban, Sabaki, OGS, KGS)
- 애니메이션 없음 — 바둑 유저는 깨끗하고 정적인 보드 선호
- "보드 자체가 아니라 보드 주변을 혁신하라"

### 10개 Branch 전원 합의 사항

| # | 합의 항목 | 근거 |
|---|----------|------|
| 1 | **Tromp-Taylor + Chinese scoring** | 수학적 완전성, dead stone agreement 불필요 |
| 2 | **SVG 렌더링** | ~400 요소, DOM 이벤트, React 통합 |
| 3 | **KataGo Analysis Engine (JSON)** | GTP 대비 3-5x 빠름, 동시 쿼리 |
| 4 | **LLM = 번역기, KataGo = 진실** | LLM 바둑 이해 ZERO 확인 |
| 5 | **Evolutionary 규칙 엔진** | 2주 MVP, AI agent 개발에 최적 |
| 6 | **템플릿 폴백** (사활/패/세키) | 고위험 포지션은 LLM 신뢰 불가 |
| 7 | **Server-authoritative** | 치팅 방지, 일관성 보장 |
| 8 | **Zustand 상태 관리** | 2.7KB, hook-first, 만족도 1위 |

---

## <a id="phase-2"></a>PHASE 2: 4개 관점별 토론 결과

### 토론 구조
PHASE 1의 10개 Branch 결과를 입력으로, 4개 관점이 각각 완전한 바둑 도메인 기술 PRD 작성.

### 4개 관점별 기술 선택 비교표

| 기술 영역 | 2.A Latest Tech | 2.B Stability | 2.C Speed | 2.D Maintainability |
|-----------|:---:|:---:|:---:|:---:|
| **KataGo** | Pool 2-4, HumanSL, GPU path | 단일+watchdog | 단일 (최속 설정) | 단일+추상화 |
| **규칙 엔진** | Evolutionary | Evolutionary | Evolutionary (2주) | Evolutionary (순수 함수) |
| **LLM** | Rapid V1 + Robust V2 | Robust (4-layer 필수) | Rapid (템플릿 10일) | Robust 아키+Rapid V1 |
| **서버** | Debt-Min (ES) | Practical (단순) | Practical (10-14일) | Debt-Min (ES) |
| **UI** | Modern ~25 | Classical 18 | Classical (최속) | Classical+Modern |

### 핵심 분쟁 사항

| 분쟁 | Latest (2.A) | Stability (2.B) | Speed (2.C) | Maintain (2.D) |
|------|:---:|:---:|:---:|:---:|
| KataGo 프로세스 | Pool 2-4 | 단일 | 단일 | 단일+인터페이스 |
| HumanSL | Day 1 | No | No | Phase 2 |
| LLM 검증 | 4-layer | 4-layer | 템플릿만 | 4-layer |
| 서버 패턴 | Event sourcing | 단순 상태 | 단순 상태 | Event sourcing |
| UI 컴포넌트 | ~25 | 18 | 18 | 18+패턴 |
| 일정 | 10-12주 | 18주 | 6-7주 | 13주 |

### 각 관점 핵심 인사이트

**2.A — Latest Tech First (Innovation 7.6/10):**
- LLM 파이프라인 = Innovation 10/10 — 어떤 경쟁자도 NL 바둑 해설 없음
- HumanSL — 랭크별 AI 대국, 경쟁자 없는 기능
- GPU 업그레이드: 87-104x 속도, 3.3초→40ms
- Prompt caching: LLM 비용 40% 절감, ~$430/mo
- 10-12주

**2.B — Stability First (Stability 8.1/10):**
- KataGo v1.16.0 TensorRT crash (NaN) — CPU Eigen 안전
- KataGo v1.12: 게임당 ~4MB 메모리 증가 — 512MB에서 재시작
- Lichess 최장 다운타임: 11시간 (하드웨어)
- OGS 동기화 oscillation 버그
- LLM = 최약 링크 (6.5/10)
- Stability Tax: +8주 (80% 추가), 622 테스트
- 18주, $137-197/mo

**2.C — Speed First:**
- Day 5: 첫 유효 수
- Day 14-18: 첫 완전 대국
- Day 42-52: 전체 프로덕션
- 규칙 엔진 Evolutionary = 8주 절감 (최대 속도 이득)
- 2,400-3,600 LOC + 2,100-3,000 테스트

**2.D — Maintainability First:**
- 총 ~4,900 LOC 예산, 파일당 300 LOC 상한
- 규칙 엔진 = crown jewel (9.8/10)
- LLM 파이프라인 = 최약 링크 (6.6/10)
- Event sourcing: 선행 투자가 유일하게 수지맞는 영역
- 13주, 3년 유지비 ~$62,000
- AI 코드 34% 복잡도 증가, 2.1x 중복 (GitClear 2025)

---

## <a id="phase-3"></a>PHASE 3: 3개 기술 시나리오 PRD

### 시나리오 A: Cutting Edge

**"혁신이 중요한 곳에 집중, 해결된 문제는 검증된 기술"**

> 상세: `/docs/baduk-domain-tech-prd-cutting-edge.md` (1,086 lines)

**핵심 수치:**

| 항목 | 값 |
|------|---|
| Innovation Score | **8.4/10** |
| 성공 확률 | **78%** |
| 월 비용 | **$945** |
| 일정 | **11-12주** |
| 개발 비용 | $1,786-2,686 |

**기술 선택:**

| 영역 | Innovation | 핵심 차별점 |
|------|:---:|-----------|
| KataGo | 9/10 | GPU Day 1 (87x), HumanSL, 3-pool |
| 규칙 엔진 | 6.5/10 | Tromp-Taylor (만장일치) + KataGo oracle 테스트 |
| LLM | 10/10 | Sonnet 4.6 adaptive thinking, 5-layer 검증 |
| 서버 | 8/10 | Event sourcing+CQRS, PG JSONB |
| UI | 7.5/10 | PPR, 실시간 hover 분석, 모바일 UX |

**핵심 차별 사항:**
- GPU Day 1 — $135/mo 추가로 질적으로 다른 UX (3.3초→40ms)
- HumanSL — "AI가 5급처럼 둡니다" (경쟁자 없는 기능)
- 5-layer 검증 (Latest Tech의 4-layer + semantic consistency)
- 10개 Go/No-Go 기준 + 모든 cutting-edge 선택에 대한 사전 설계 fallback

---

### 시나리오 B: Balanced-Tech

**"좋은 기술이지만, AI agent가 빌드하고 유지할 수 있어야 한다"**

> 상세: `/docs/baduk-domain-tech-prd-balanced.md` (963 lines)

**핵심 수치:**

| 항목 | 값 |
|------|---|
| Balanced Score | **7.8/10** (Innovation 7.4 / Stability 7.8 / Speed 7.5 / Maintainability 8.2) |
| 성공 확률 | **82% (12주) / 91% (14주 버퍼)** |
| 월 비용 | **$80 (Phase 1) → $240 (Phase 2)** |
| 일정 | **12주** |
| 3년 비용 | ~$10,200 |

**6개 분쟁 해결:**

| 분쟁 | 결정 | 근거 |
|------|------|------|
| KataGo Pool vs Single | 단일+BullMQ(4) | MAU 8K에서 3x 여유 |
| HumanSL | Month 3-4 도입 | 진정한 차별화, 코어 검증 후 |
| LLM 검증 | 템플릿 V1(10일) → 3-layer V2(5주) | 템플릿만으로도 전례 없는 기능 |
| 서버 패턴 | Simple + GameReducer | Go 최대 ~400 이벤트, 업그레이드 가능 |
| UI 컴포넌트 | 20개 (18 + WinRateGraph + ExplanationCard) | 2개 추가 = AI 차별화의 시각적 얼굴 |
| 일정 | 12주 | 2.C(7주, 위험) ~ 2.B(18주, 과잉) 최적 |

---

### 시나리오 C: Proven Stack

**"느려도 확실한 것이 낫다. 가장 단순한 시스템 = 실패할 수 없는 시스템"**

> 상세: `/docs/baduk-domain-tech-prd-proven-stack.md` (1,439 lines)

**핵심 수치:**

| 항목 | 값 |
|------|---|
| Proven Score | **9.1/10** |
| 성공 확률 | **95%** |
| 월 비용 | **$89-93** |
| 일정 | **16주** |
| 테스트 | **~554개** |
| LOC | **2,800-3,200** |
| 외부 API 의존성 | **Zero** |

**3가지 급진적 차별점:**
1. **런칭 시 LLM 없음** — 템플릿 ONLY, 60일 데이터 수집 후 LLM 도입
2. **BullMQ/Redis 없음** — 인메모리 FIFO (50슬롯), 외부 의존성 제로
3. **15개 UI 컴포넌트** — 차트·오버레이·제스처 라이브러리 없음

---

### 3개 시나리오 비교 종합표

| 기준 | 3.A Cutting Edge | 3.B Balanced-Tech | 3.C Proven Stack |
|------|:---:|:---:|:---:|
| **핵심 철학** | 혁신 집중 투자 | AI agent 최적화 | 절대 실패 방지 |
| **성공 확률** | 78% | **82-91%** | 95% |
| **월 비용** | $945 | **$80→$240** | $89-93 |
| **일정** | 11-12주 | **12주** | 16주 |
| **Innovation** | **8.4/10** | 7.4/10 | ~5/10 |
| **Stability** | ~7/10 | 7.8/10 | **9.1/10** |
| **KataGo** | GPU+3pool+HumanSL | CPU+BullMQ | CPU+FIFO |
| **LLM 런칭** | Sonnet Day 1 | 템플릿→LLM | 템플릿 ONLY |
| **서버** | Event sourcing | GameReducer | Simple+PG |
| **UI** | ~25+ | 20 | 15 |
| **외부 의존성** | GPU+LLM+Redis | Redis | Zero |
| **테스트** | — | ~400 | ~554 |
| **합의 존중** | 중간 (GPU/pool 이탈) | **최고** | 높음 (LLM 제거) |

---

## <a id="phase-4"></a>PHASE 4: 최종 기술 로드맵 확정

### 시나리오 선택: **Balanced-Tech (3.B)**

**선택 근거 5가지:**

1. **"Why?" AI 해설 런칭 포함** — 템플릿 V1으로 Day 1 제공. Proven Stack은 유일한 moat를 Phase 2로 미뤄 OGS/KGS와 차별화 불가.

2. **비용 대비 가치 최적** — $80→$240/mo. Cutting Edge $945/mo는 MRR $5K의 19%. Balanced는 4%→4.8%.

3. **성공 확률 최고** — 82% (12주), 91% (14주 버퍼). 순수 확률은 Proven 95%이나 16주 소요 + moat 부재.

4. **AI agent 개발 최적화** — 단일 KataGo+BullMQ, AnalysisEngine 추상화, 300 LOC/file, 순수 함수. 2.D의 유지보수성 8.2/10 반영.

5. **3중 Balanced 정합** — Research 1 Balanced + Research 2 Balanced-Tech + Research 3 Balanced-Tech. 세 연구가 독립적으로 같은 결론.

**버린 시나리오:**

| 시나리오 | 핵심 미선택 이유 |
|---------|----------------|
| 3.A Cutting Edge | GPU Day 1은 $945/mo (MRR 19%), MAU 8K CPU 3x 여유. HumanSL Day 1은 검증 전 과잉. 78% 성공률 |
| 3.C Proven Stack | LLM 없이 런칭 = 차별화 불가. 16주 (+4주). 15개 컴포넌트로 AI 해설 UI 부재 |

### 최종 확정 스택

```
┌──────────────────────────────────────────────────────────────────┐
│              Baduk Domain Technology — Balanced v1.0              │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  KataGo:      v1.16.2, Analysis Engine JSON, CPU Eigen            │
│  NN Model:    b18c384nbt (Phase 1) → b28c512nbt (Phase 2 GPU)    │
│  HumanSL:     Month 3-4 도입 (AnalysisEngine interface 준비)      │
│  Queue:       BullMQ concurrency=4, Redis-backed                  │
│  Process:     단일 + Watchdog (512MB, 3s backoff)                 │
│  Visits:      5 (즉시) / 50 (빠른 분석) / 500 (심층 복기)         │
│                                                                    │
│  Rules:       Tromp-Taylor + Chinese scoring (Evolutionary)       │
│  Board:       1D Uint8Array, Zobrist hashing, pure functions      │
│  Scoring:     Chinese only (Phase 1) → Japanese (Phase 2)         │
│  Engine LOC:  300-500줄 TypeScript                                │
│  Tests:       130+ (KataGo oracle 교차 검증 포함)                  │
│                                                                    │
│  LLM V1:     Template (패턴 매칭, 10일, $0/mo)                   │
│  LLM V2:     Claude Haiku 4.5 (80%) + Sonnet (15%) + fallback    │
│  Validation:  3-layer (data anchoring → constrained gen → check)  │
│  Explanation: 3-tier (입문/중급/고급)                              │
│  Golden Set:  200 positions (단급자 검증)                          │
│  Cost:        Phase 1 $0/mo → Phase 2 ~$180/mo (prompt caching)  │
│                                                                    │
│  Server:      ws WebSocket, server-authoritative                  │
│  State:       Simple state + append-only move log + GameReducer   │
│  Match:       Glicko-2, ±200 범위, 30초 후 확장                   │
│  Time:        Byoyomi (Phase 1) → Fischer/Canadian (Phase 2)      │
│  Capacity:    2K-3K 동시 게임 (단일 프로세스)                      │
│                                                                    │
│  Board UI:    SVG (React JSX), Shudan fork base                   │
│  Components:  20개 (18 classical + WinRateGraph + ExplanationCard) │
│  Mobile:      Tap-Preview-Confirm, pinch-zoom (@use-gesture)      │
│  State Mgmt:  Zustand (2.7KB)                                     │
│  Charts:      Recharts (D3-based)                                  │
│  Colors:      KaTrain scheme (green→blue→yellow→orange→red)       │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 마일스톤

```
Week 1-2:   규칙 엔진 ████████████ (Tromp-Taylor + Chinese scoring)
Week 1-3:   KataGo 통합 ██████████████████ (단일 프로세스 + BullMQ + Watchdog)
Week 2-5:   대국 서버 ████████████████████████ (ws + GameReducer + 매칭)
Week 2-8:   UI/UX ████████████████████████████████████ (Shudan fork + 20 컴포넌트)
Week 2-4:   LLM V1 템플릿 ████████████████ (패턴 매칭 + 3-tier 해설)
Week 6-12:  LLM V2 통합 ████████████████████████████████████ (Haiku + 3-layer 검증)
            ──────────────────────────────────────────────────────
            Total: 12주 (병렬 AI agent 실행)
```

### 비용 추정

**개발 단계 (일회성):**

| 항목 | 비용 |
|------|------|
| AI agent 컴퓨트 (Claude Code, 12주) | ~$500-800 |
| 골든 데이터셋 (200 포지션, 단급자 검증) | $500-1,000 |
| **개발 총 비용** | **~$1,000-1,800** |

**월간 운영 (MAU 8K):**

| 항목 | Phase 1 (템플릿) | Phase 2 (LLM) |
|------|:---:|:---:|
| Hetzner CCX33 (앱+KataGo) | $60 | $60 |
| LLM API (Haiku+Sonnet+caching) | $0 | ~$180 |
| Redis (BullMQ) | $0 (Hetzner 포함) | $0 |
| 도메인+CDN | $20 | $20 |
| **월 합계** | **$80** | **$260** |

**3년 총 비용:** ~$10,200

### 위험 레지스터

| # | 위험 | 확률 | 영향 | 검증 시점 | 완화 |
|---|------|------|------|----------|------|
| R1 | LLM 환각 (잘못된 바둑 조언) | 높음 | 치명적 | V2 런칭 시 | 3-layer 검증 + 템플릿 폴백 (사활/패/세키) |
| R2 | KataGo 프로세스 크래시 | 중간 | 높음 | 통합 테스트 | Watchdog 자동 재시작 (3s backoff, 5회/10분 회로 차단) |
| R3 | 모바일 19×19 터치 정확도 | 높음 | 높음 | UI 테스트 | Tap-Preview-Confirm + pinch-zoom |
| R4 | LLM API 비용 초과 | 중간 | 중간 | Phase 2 | Prompt caching (90%), Batch API (50%), 템플릿 폴백 |
| R5 | 일본 규칙 구현 복잡도 | 높음 | 중간 | Phase 2 | 중국 규칙이 온라인 대국 80%+ 커버. KataGo dead stone 감지 |

### Research 1 ↔ 2 ↔ 3 교차 검증

| 항목 | Research 1 (시장/사용자) | Research 2 (기술 스택) | Research 3 (바둑 도메인) | 정합 |
|------|:---:|:---:|:---:|:---:|
| 시나리오 선택 | Balanced | Balanced-Tech | Balanced-Tech | ✅ 3중 일치 |
| KataGo | CPU Eigen | CPU Eigen | CPU Eigen + BullMQ | ✅ 구체화 |
| LLM 해설 | "Why?" AI Day 1 | Haiku/Sonnet/Template 3-tier | 템플릿 V1 → LLM V2 | ✅ 구체화 |
| 인프라 | $55-150/mo | Coolify+Hetzner $60/mo | CCX33 $60/mo + LLM $0→$180 | ✅ 일치 |
| 일정 | 6개월 (M1/M2/M3) | 6개월 | 12주 (도메인 기술만) | ✅ 부분집합 |
| 규칙 | — | — | Tromp-Taylor + Chinese | ✅ 신규 |
| 보드 UI | 모바일 우선 | SVG | Shudan fork + 20 컴포넌트 | ✅ 구체화 |
| 서버 | 동접 1,000명 | WebSocket | ws + GameReducer | ✅ 구체화 |
| 성공 확률 | 65-75% | 70-75% | 82-91% | ✅ 도메인 기술 낮은 위험 |
| 비용 | $1,130-2,600/6mo | $300-430/6mo | $480-1,560/6mo (LLM 포함) | ✅ 범위 내 |

---

## 상세 문서 참조

| 문서 | 내용 | 위치 |
|------|------|------|
| Research 1 전체 | 시장/사용자/비즈니스 PRD | `/prompt/prd-research-phase1-market-user-tech-biz.md` |
| Research 2 전체 | 기술 스택 심층조사 | `/prompt/prd-research-phase2-technology-deep-dive.md` |
| **Research 3 전체** | **바둑 도메인 기술 (이 문서)** | `/prompt/prd-research-phase3-baduk-domain-tech.md` |
| PHASE 2.A 상세 | Latest Tech PRD | `/docs/baduk-domain-technology-prd-latest-tech.md` |
| PHASE 2.B 상세 | Stability PRD | `/docs/baduk-domain-tech-prd-stability.md` |
| PHASE 2.C 상세 | Speed PRD | `/docs/baduk-domain-tech-prd-speed-first.md` |
| PHASE 2.D 상세 | Maintainability PRD | `/prompt/phase2d-maintainability-first-baduk-domain-technology-prd.md` |
| PHASE 3.A 상세 | Cutting Edge 시나리오 | `/docs/baduk-domain-tech-prd-cutting-edge.md` |
| PHASE 3.B 상세 | Balanced-Tech 시나리오 | `/docs/baduk-domain-tech-prd-balanced.md` |
| PHASE 3.C 상세 | Proven Stack 시나리오 | `/docs/baduk-domain-tech-prd-proven-stack.md` |
| 프레임워크 원본 | 실행 지침서 | `/prompt/Technology_Development_DeepDive_PRD_Teammate_Executable.md` |
| Research 2 최종 로드맵 | Balanced-Tech Stack v1.0 | `/prompt/phase4-final-technology-roadmap.md` |
