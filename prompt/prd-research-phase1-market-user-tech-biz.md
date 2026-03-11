# PRD 심층조사 결과 — PHASE 1-4 종합

> **조사 일자**: 2026-03-10
> **프로세스**: prd_teammate_executable.md 기반 Fork-Based Sessions
> **투입 에이전트**: 15개 + Orchestrator
> **팀**: baduk-prd-research

---

## 목차

1. [PHASE 1: 8개 조사 Branch 결과 요약](#phase-1)
2. [PHASE 2: 4개 관점별 토론 결과](#phase-2)
3. [PHASE 3: 3개 시나리오 PRD](#phase-3)
4. [PHASE 4: 최종 통합 및 의사결정](#phase-4)
5. [최종 PRD 1.0](#final-prd)

---

## <a id="phase-1"></a>PHASE 1: 8개 조사 Branch 결과 요약

### Branch 구성

| Branch | 역할 | 관점 |
|--------|------|------|
| Market-Optimistic | 시장 조사 — 기회 중심 | 바둑 시장 성장 가능성, 새 카테고리 기회 |
| Market-Cautious | 시장 조사 — 위험 중심 | 시장 축소 추세, 경쟁 장벽, 현실적 규모 |
| User-EdgeCase | 사용자 조사 — 극단 사례 | 고단자, 교육 기관, 비전형적 사용자 |
| User-Mainstream | 사용자 조사 — 주류 사용자 | 입문자, 중급자, 일반 유저 여정 |
| Tech-Monolithic | 기술 아키텍처 — 모놀리식 | Modular Monolith, Lichess 패턴 |
| Tech-Microservices | 기술 아키텍처 — 마이크로서비스 | 분산 아키텍처, 스케일링 |
| Business-Aggressive | 비즈니스 전략 — 공격적 | 빠른 성장, 시장 선점, VC 모델 |
| Business-Sustainable | 비즈니스 전략 — 지속가능 | 부트스트랩, 자체 수익, 장기 관점 |

### 핵심 발견 사항

#### 시장 조사 (Market)

**글로벌 바둑 시장 현황:**
- 글로벌 동접: ~43,000명 (Fox 10K, Tygem 8K, OGS 4K, KGS 2K 등)
- 등록 유저: Fox 15M+, Tygem 8M+, OGS 150K, KGS 200K
- 바둑 인구: 한국 800만, 일본 120만(감소 추세), 중국 5,000만+, 서양 성장 중
- TAM: ~$500M (바둑 교육 + 용품 + 소프트웨어)
- SAM: ~$50M (온라인 바둑 소프트웨어/서비스)
- SOM: $2-8M (현실적 획득 가능 시장)

**경쟁사 분석:**
| 플랫폼 | 강점 | 약점 | AI 해설 |
|--------|------|------|---------|
| Fox Weiqi | 최대 유저, 중국 프로 기사 | 중국어 전용, 비중국권 미진출 | X |
| Tygem | 한국 시장 1위, 빠른 매칭 | 한국어 중심, UI 노후 | X |
| OGS | 오픈소스, 글로벌, 영어 | 1년 잔존율 5%, UX 부족 | X |
| KGS | 레거시 사용자층 | Java 앱, 개발 정체 | X |
| AI Sensei | KataGo 복기 | 대국 기능 없음, $5.95/월 | △ (수치만) |

**핵심 인사이트:**
- **어떤 플랫폼도 "Why?" AI 해설을 제공하지 않음** — KataGo 승률/수치는 있으나, "왜 이 수가 좋은/나쁜지" 자연어 설명은 없음
- Quick Go(9×9, 3분)는 기존 시장에 존재하지 않는 새 카테고리
- Chess.com 벤치마크: 200M 유저, $150M+ 매출 — 바둑이 체스의 5%만 달성해도 $5-15M/year
- Fox/Tygem은 비중국권/비한국권 시장에 미진출 — 영어권 시장은 사실상 빈 공간

#### 사용자 조사 (User)

**2개 핵심 사용자 세그먼트:**

1. **입문자/초급자 (주 타겟)**
   - 핵심 좌절: "규칙은 알겠는데 뭘 해야 할지 모르겠다"
   - OGS 1년 잔존율 5%의 근본 원인
   - 원하는 것: 가이드, AI 코치, 짧은 게임, 성장 실감
   - Quick Go + 온보딩 + AI 해설이 직접 해결

2. **중급자/고급자 (유료 전환 대상)**
   - 핵심 좌절: "왜 졌는지 모르겠다"
   - AI Sensei의 수치만으로는 불충분
   - 원하는 것: "이 수가 왜 나빴는지" 자연어 설명
   - "Why?" AI 해설이 직접 해결 → 프리미엄 전환 트리거

**사용자 여정:**
```
입문자: 가입 → 5분 온보딩 → Quick Go(9×9) → AI 해설 체험 → "더 알고 싶다" → Premium
중급자: 가입 → ELO 매칭 대국 → 복기 → "Why?" AI 해설 → "매일 이게 필요하다" → Premium
```

#### 기술 조사 (Tech)

**KataGo — 유일한 현실적 AI 엔진:**
- 버전: v1.16.2 (2025.06)
- 라이선스: MIT (상업적 사용 가능)
- 한국 국가대표팀도 사용
- CPU Eigen 백엔드로 GPU 없이 구동 가능
- 응답 시간: 3-8초 (복기 분석), 동시 3-5세션
- **자체 AI 엔진 개발은 절대 불가** — Leela Zero 팀도 2019년 중단. DeepMind 수준 리소스 필요.

**Explainable AI 파이프라인:**
```
KataGo 분석 JSON (승률, 최선수, 변화도)
    ↓
도메인 특화 프롬프트 (바둑 용어, 수준별 설명)
    ↓
Claude API (자연어 생성)
    ↓
수준별 3단계 해설 (입문/중급/고급)
```
- 이 파이프라인을 제대로 구현한 바둑 플랫폼은 아직 없음
- KataGo는 "이해"하고, LLM은 "번역"하는 구조

**아키텍처 합의 — Modular Monolith (4/4):**
- Lichess 패턴 차용 (69개 모듈, 단일 배포)
- Next.js 15 + Node.js + PostgreSQL + Redis + KataGo (CPU Eigen)
- 초기 단일 서버로 동접 1,000명까지 충분
- Phase 2에서 AI Engine 모듈만 독립 추출
- AI 자동 구현율: 60-65% (CRUD/UI/인프라), 게임 로직·AI 파이프라인은 수동

#### 비즈니스 조사 (Business)

**수익화 모델 합의 — Freemium:**
| Tier | 가격 | 핵심 가치 |
|------|------|----------|
| Free | $0 | 9×9/13×13 대국, 기본 AI 봇(10단계), 일 3회 AI 복기 |
| Premium | $9.99/월 | 무제한 "Why?" AI 해설, 전체 AI 봇(30단계), 상세 분석 |
| 도장 Plan | $29.99/월/seat | Phase 2 (12개월+), B2B LMS |

**비용 구조 (AI workflow ~$0 개발비):**
- 개발비: ~$0 (AI agentic workflow)
- 인프라: 월 $55-150 (Phase 1)
- LLM API: 월 $100-300
- 전통적 개발팀 대비: $180-300K → ~$0 (비용 구조 자체가 다른 게임)

**성장 모델 합의 — Sustainable/부트스트랩:**
- VC 모델 부적합 (바둑 시장 SOM $2-8M, $100M+ exit 구조적 불가)
- 자체 수익으로 성장, 외부 투자 불필요
- Phase 1 종료 시 이미 흑자 가능 (MRR $5K vs 월 운영비 $300-700)

**"AlphaGo 초월" 포지셔닝 재정의:**
- 기술적으로 KataGo ≈ AlphaGo 수준이므로 "초월"은 마케팅적으로 무의미
- 재포지셔닝: **"세계 최강 AI가 당신의 개인 코치가 됩니다"**
- 차별화는 "더 강한 AI"가 아니라 "더 잘 설명하는 AI"

---

## <a id="phase-2"></a>PHASE 2: 4개 관점별 토론 결과

### 토론 구조
4개 관점(Market/User/Tech/Business)이 각각 자기 관점을 극단까지 밀어본 후, 기능 우선순위를 도출.

### 기능별 합의도 (Green/Yellow/Red Zone)

| Zone | 기능 | 합의도 | 근거 |
|------|------|--------|------|
| **Green** | "Why?" AI 해설 엔진 | 4/4 | 유일한 moat. 모든 관점에서 필수 |
| **Green** | Quick Go (9×9, 3분) | 4/4 | 새 카테고리, 비경쟁, 최소 비용 |
| **Green** | Zero-to-First-Game 온보딩 | 4/4 | OGS 5% 잔존율 근본 해결 |
| **Green** | 글로벌 ELO 매칭 | 4/4 | 43K 동접 통합, 공정 매칭 |
| **Green** | KataGo AI 대국 30단계 | 4/4 | 초기 유저풀 부족 해결 |
| **Yellow** | 성장 여정 게이미피케이션 | 3/4 | 리텐션 핵심. Biz만 Phase 1.5 주장 |
| **Yellow** | 모바일 앱/PWA | 3/4 | 유저 80% 모바일. 네이티브 vs PWA 논쟁 |
| **Yellow** | AI 복기 리포트 | 3/4 | Tech: LLM 환각 리스크 |
| **Yellow** | 사활 문제 시스템 | 3/4 | Biz: 직접 수익 연결 약함 |
| **Red** | 실시간 AI 코칭 | 2/4 | 레이턴시/비용/GPU 필요 |
| **Red** | B2B 도장 LMS | 2/4 | B2C 기반 필요. Phase 2 |
| **Red** | 커뮤니티/소셜 | 2/4 | 유저풀 확보 후 |
| **Red** | 토너먼트 시스템 | 1/4 | 동접 요구 높음 |
| **Red** | 네이티브 모바일 앱 | 1/4 | PWA 우선 |

### 4개 관점의 핵심 주장

**Market Priority**: "파이를 키우는 자가 되어라" — Fox/Tygem과 정면 경쟁하지 말고, Quick Go + AI 해설로 새 카테고리 창조. 바둑 인구 확대가 곧 우리 시장 확대.

**User Priority**: "입문자가 떠나지 않게 하라" — 온보딩 + AI 해설 + 게이미피케이션이 삼위일체. OGS 5% 잔존율을 20%+로 올리는 것이 핵심.

**Tech Priority**: "할 수 있는 것만 하라" — Modular Monolith, KataGo CPU, 검증된 스택만. 자체 AI 엔진 절대 금지. LLM 환각은 M1에서 검증.

**Business Priority**: "돈은 나중에, 기반은 지금" — Sustainable 부트스트랩. AI workflow ~$0 개발비 활용. Freemium 전환이 수익의 핵심.

---

## <a id="phase-3"></a>PHASE 3: 3개 시나리오 PRD

### 시나리오 A: Aggressive

**"바둑의 Duolingo + Chess.com을 6개월 내 만든다"**

- 기능: 9개 (Green 5 + Yellow 1 + Red 3: 모바일 네이티브, 실시간 AI 코칭, B2B LMS)
- 6개월 KPI: 가입 500K, DAU 50K, MRR $75K
- 12개월 KPI: 가입 2M, MRR $500K
- 비용: 6개월 $287K, 12개월 $623K (3인 유급 팀 전제)
- 성공 가능성: 40-55%
- 실패 시 손실: $400K-600K
- 기술 부채: 매우 큼 (18주 리팩토링 필요)

**위험 가정 Top 3:**
1. Quick Go 바이럴 (40% 확률)
2. AI 해설이 잔존율 향상에 기여 (50%)
3. 3인 팀이 9개 기능 6개월 완성 (55%)

**선택 조건:** 시장 긴급성 높음 + 탁월한 팀 + $400K+ 자금 + 올인 마인드

---

### 시나리오 B: Balanced (최종 선택)

**"세계 최강 AI가 당신의 개인 코치 — Sustainable 성장"**

- 기능: 7개 (Green 5 + Yellow 2: 게이미피케이션 기본, PWA)
- 6개월 KPI: MAU 8K, 유료 500명, MRR $5K
- 12개월 KPI: MAU 25K, 유료 2K명, MRR $20K
- 18개월 KPI: MAU 50K, 유료 5K명, MRR $50K+
- 비용: 6개월 $1,130-2,600, 18개월 $4,530-10,600 (개발비 ~$0)
- 성공 가능성: 65-75%
- 실패 시 손실: $1,000-3,000
- 기술 부채: 중간 (통제 가능)

**핵심 차별점 (vs 다른 시나리오):**
- "Why?" AI 해설 Day 1 포함 (LLM 자연어 — 템플릿이 아님)
- 게이미피케이션 Phase 1 포함 (리텐션 선제 대응)
- AI workflow ~$0 개발비 전제 (현실 부합)
- Phase 1 종료 시 이미 흑자 가능

**위험 가정 Top 3:**
1. LLM 바둑 해설 정확도 (검증: M1, 유단자 5명)
2. Quick Go 신규 유입 효과 (검증: M2, A/B 테스트)
3. AI workflow 60-65% 자동 구현율 (검증: M1, 속도 측정)

**Go/No-Go 게이트:**
| 시점 | CONTINUE | PIVOT |
|------|----------|-------|
| M1(2개월) | LLM 70%+ & 코어 완성 | 미달 → 스코프 축소 |
| M2(4개월) | 베타 DAU 100+ | 50 미만 → UX 재설계 |
| M3(6개월) | MAU 2K+ & 유료 50+ | MAU 500 미만 → B2B pivot |
| 12개월 | MAU 10K+ & MRR $10K+ | MRR $3K 미만 → 재검토 |

**마일스톤:**
- M1 (2개월): Core Engine — PvP + AI 대국 + LLM 해설 프로토타입
- M2 (4개월): Playable Beta — Quick Go + AI 해설 MVP + PWA → 100명 베타
- M3 (6개월): Public Launch — 온보딩 + 게이미피케이션 + Freemium → MAU 8K

---

### 시나리오 C: Conservative

**"작게, 확실하게, 깊게"**

- 기능: 4개 (Green에서 "Why?" AI 해설 제외, Phase 1.5로 이동)
- 6개월 KPI: MAU 3-5K, 유료 50-100명, MRR $500-1K
- 12개월 KPI: MAU 8-10K, 유료 300-500명, MRR $3-5K
- 비용: 6개월 $345-610, 12개월 $875-1,490
- 성공 가능성: 85%+
- 실패 시 손실: ~$500
- 기술 부채: 거의 없음
- 테스트 커버리지: 80%+, 7주 버퍼

**절대 금지 5가지:**
1. 조기 스케일링 (Premature Scaling)
2. 기능 크리프 (Feature Creep)
3. 자체 AI 엔진 개발
4. 중국/한국 시장 직접 경쟁
5. VC 투자 의존

---

## <a id="phase-4"></a>PHASE 4: 최종 통합 및 의사결정

### 시나리오 선택: Balanced

**선택 근거 3가지:**
1. "Why?" AI 해설 Day 1 포함 — 유일한 moat. Conservative는 미포함으로 차별화 불가.
2. 비용 구조 현실 부합 — AI workflow ~$0. Aggressive의 $287K는 유급 팀 전제로 불일치.
3. 실패 안전망 내장 — 손실 $1-3K + pivot 옵션 보존. Aggressive 실패 시 회복 불가.

**버린 시나리오:**
- Aggressive: $287K 비용 + 500K MAU 비현실적 + 기술 부채 감당 불가
- Conservative: "Why?" AI 없이는 OGS/KGS와 차별화 불가, 시장 진입 자체 무의미

### 충돌 로그

| 기능 | 결정 | 반대 의견 해소 |
|------|------|--------------|
| "Why?" AI 해설 | Green (포함) | Tech 환각 리스크 → M1 Go/No-Go |
| 게이미피케이션 | Yellow (포함) | Biz Phase 1.5 → 리텐션 우선 논리 수용 |
| React Native 앱 | Red (Phase 2) | Market 모바일 80% → PWA로 대체 |
| 실시간 AI 코칭 | Red (Phase 2) | Aggressive 킬러 → GPU 전환 후 |
| B2B LMS | Red (Phase 2) | Biz 조기 계약 → B2C 기반 우선 |
| 자체 AI 엔진 | 절대 금지 | 4/4 합의 |

### 리스크 레지스터

| # | 위험 가정 | 영향 | 검증 시점 | Go/No-Go |
|---|----------|------|----------|----------|
| R1 | LLM 해설 정확도 | 매우 높음 | M1 (2개월) | 70% 미만 → 템플릿 전환 |
| R2 | Quick Go 바이럴 | 높음 | M2 (4개월) | 20% 미만 → 재설계 |
| R3 | AI workflow 실행력 | 높음 | M1 (2개월) | 2기능 미완성 → 축소 |
| R4 | 입문자 잔존율 | 높음 | M3 (6개월) | 15% 미만 → UX 재설계 |
| R5 | Freemium 전환율 | 중간 | M3+3개월 | 3% 미만 → 가격 재설계 |

### 팀 정렬

| Teammate | 판정 | 핵심 근거 |
|----------|------|----------|
| Market Researcher | 수용 | SOM 현실적, Quick Go 지지. 우려: Fox/Tygem 복제 리스크 |
| User Researcher | 동의 | 양쪽 세그먼트 니즈 충족. 게이미피케이션 포함 긍정적 |
| Tech Architect | 동의 | Modular Monolith 현실적. LLM 환각만 M1 검증 |
| Business Strategist | 수용 | Sustainable 모델 적합. 우려: B2B 지연 → B2C 우선 수용 |

**결과: 동의 2 + 수용 2 = 현실적이면서 실행 가능한 PRD**

---

## <a id="final-prd"></a>최종 PRD 1.0 요약

### 제품 비전
**"세계 최강 AI가 당신의 개인 코치"**
KataGo + LLM 기반 Explainable AI를 핵심 moat로, Quick Go로 새 카테고리 창조,
파편화된 글로벌 바둑 시장을 통합하는 모바일 우선 플랫폼.

### 기능 구성
- **Green Zone (5개)**: "Why?" AI 해설, Quick Go, 온보딩, ELO 매칭, AI 대국
- **Yellow Zone (2개)**: 게이미피케이션 기본, PWA
- **Red Zone (7개)**: B2B LMS, 네이티브 앱, 실시간 코칭, 사활, 커뮤니티, 토너먼트, GPU 전환

### 기술 스택
- Next.js 15 + Node.js + PostgreSQL + Redis + KataGo (CPU Eigen) + Claude API
- Modular Monolith (Lichess 패턴)
- AI 자동 구현율: 60-65%

### 비용
- 6개월: $1,130-2,600 (개발비 ~$0)
- 18개월 누적: $4,530-10,600
- 손익분기: Phase 1 종료(6개월) 시점

### KPI
- 6개월: MAU 8K, MRR $5K
- 12개월: MAU 25K, MRR $20K
- 18개월: MAU 50K, MRR $50K+

### 수익화
- Free → Premium $9.99/월 → 도장 Plan $29.99/월/seat (Phase 2)

---

## 추가 기술 심층조사 대기 항목

> 이 조사는 시장·사용자·비즈니스·기술 전략 관점의 조사입니다.
> 다음 단계로 **관련 기술에 대한 심층조사**를 추가 수행한 후,
> 두 조사 결과를 종합하여 최종 PRD를 확정할 예정입니다.

### 기술 심층조사에서 다뤄야 할 후보 주제:
1. KataGo 통합 — IPC/stdio, 동시 세션 관리, crash recovery, playout 튜닝
2. LLM 바둑 해설 파이프라인 — 프롬프트 설계, 환각 억제, 수준별 생성
3. Next.js 15 + WebSocket 실시간 대국 — 아키텍처, 성능, 동접 한계
4. Go 규칙 엔진 — 오픈소스 옵션, 계가, 사활 판정, 패 처리
5. ELO/Glicko-2 매칭 — 초기 유저풀 소규모 대응, AI fallback
6. PWA vs React Native — 바둑판 터치 경험, 오프라인 지원
7. Freemium 결제 — Stripe/Paddle, 구독 관리, 무료→유료 전환 UX
8. AI agentic workflow 자동 구현 — 실제 자동화율 검증, 한계, 수동 영역
