# PRD: AI Agentic Workflow로 구축하는 바둑 플랫폼

> **버전**: 0.1 (초안)
> **작성일**: 2026-03-10
> **근거 자료**: 4대 심층조사 통합 요약서 + 3차 성찰 (75개 에이전트: 66 조사 + 9 성찰, 4 Orchestrator, 4×4-Phase 독립 연구)
> **핵심 전제**: 개발팀 = AI agents, 배포 = 사용자 로컬 데스크톱 앱, 서비스 모델 = 완전 무료

---

## 목차

1. [제품 비전 및 자동화 목적](#1-vision)
2. [2중 구조: 바둑 앱 × AI Workflow System](#2-dual-structure)
3. [핵심 기능 (Phase 1)](#3-core-features)
4. [사용자 스토리](#4-user-stories)
5. [기술 아키텍처](#5-architecture)
6. [데이터 소스](#6-data-sources)
7. [성공 지표 (KPI)](#7-kpi)
8. [비용 구조](#8-cost)
9. [일정 및 마일스톤](#9-timeline)
10. [위험 레지스터](#10-risks)
11. [미결 사항 및 추후 결정 필요 항목](#11-open-items)
12. [Phase 2 로드맵](#12-phase-2)
13. [제약 사항](#13-constraints)

---

## <a id="1-vision"></a>1. 제품 비전 및 자동화 목적

### 1.1 제품 비전

**"세계 최강 AI가 당신의 개인 코치"**

KataGo(MIT 라이선스, 프로 9단+ 수준) + LLM 기반 Explainable AI를 핵심 moat로, Quick Go(9×9, 3분)로 새 카테고리를 창조하며, 파편화된 글로벌 바둑 시장을 통합하는 **사용자 로컬 데스크톱 앱**.

### 1.2 "AlphaGo 초월"의 재정의

"더 강한 AI"가 아니라 **"더 잘 설명하는 AI"**. KataGo는 이미 프로 9단 수준이다. 사용자가 원하는 것은 "이 수가 왜 좋은/나쁜지"를 **자연어로 이해하는 것**이다. 어떤 바둑 플랫폼도 이 기능을 제공하지 않는다 — AI Sensei조차 수치(승률/변화도)만 제공할 뿐, "왜?"를 설명하지 않는다.

**Moat의 모방 취약성과 진짜 방어벽**: KataGo(MIT, 무료) + 아무 LLM API = 기본적 자연어 해설은 기술적으로 가능하다. "경쟁자가 아직 안 했다" ≠ "할 수 없다". 진짜 moat는 3겹이다:
1. **해설 품질** — 3-tier 수준별 해설 + 골든 데이터셋 200 포지션 검증 + 도메인 특화 템플릿
2. **데이터 축적 속도** — 선발 주자의 사용자 피드백 루프가 해설 품질을 지속 개선
3. **로컬 앱 통합 패키지** — KataGo 번들 + GPU 자동 감지 + 프로세스 생명주기 관리 + 템플릿 엔진이 하나의 설치 파일로 제공되는 원클릭 경험. API 조합으로는 이 수준의 통합이 어려움

### 1.3 Why Now?

AlphaGo는 2016년이다. 2026년에 이 프로젝트를 시작하는 이유:

1. **LLM 자연어 생성이 2024-2025년에 비로소 실용 수준에 도달** — GPT-4, Claude 3.5/4 시리즈로 복잡한 도메인의 자연어 해설이 가능해짐
2. **AI agentic workflow의 성숙** — Claude Code, Cursor 등으로 1인 개발자가 15-18개 기능의 플랫폼을 6개월 내 구축 가능
3. **Tauri 2.0의 안정화** — 크로스 플랫폼 데스크톱 앱을 ~10MB 번들로 배포 가능
4. **경쟁자 부재** — Fox/Tygem/OGS/KGS 어느 플랫폼도 "Why?" AI 자연어 해설을 제공하지 않음

### 1.4 자동화 목적

이 프로젝트는 **바둑 앱 자체**가 아니라, **바둑 앱을 AI agentic workflow로 자동 구현하는 과정** 전체를 포괄한다.

| 목적 | 설명 |
|------|------|
| **AI 자동화율 극대화** | 코드의 65-70%를 AI agent가 생성, SonarQube+TDD+human review 3중 검증 |
| **1인 개발자 모델 증명** | AI agent 팀이 전통적 3인 팀($180-300K)을 대체 → 개발비 ~$0 |
| **비용 지속가능성** | 로컬 앱 P2P 구조로 MAU 증가가 비용 증가로 이어지지 않음 (월 $2) |
| **완전 무료 서비스** | 교육적 공익 프로젝트로서 모든 기능을 무료 제공 |

---

## <a id="2-dual-structure"></a>2. 2중 구조: 바둑 앱 × AI Workflow System

이 프로젝트는 2개의 레이어로 구성된다:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 2: AI Agentic Workflow System (공장)                       │
│  ─────────────────────────────────────────────────               │
│  • 에이전트 팀 구성 (Frontend/Backend/Game Logic/AI Pipeline)     │
│  • 병렬 실행 전략 (모듈별 branch + 주 1-2회 순차 통합)             │
│  • 사람-에이전트 협업 프로토콜                                     │
│  • 기술 검증 게이트 (주차별 Go/No-Go)                              │
│  • Strategic TDD + Quality Gates                                  │
│  • SonarQube AI Code Assurance (클로닝 4x 문제 감시)              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 바둑 플랫폼 (제품)                                       │
│  ─────────────────────────────────────────────────               │
│  • "Why?" AI 자연어 해설                                          │
│  • Quick Go (9×9, 3분)                                            │
│  • KataGo AI 대국                                                 │
│  • Zero-to-First-Game 온보딩                                      │
│  • 게이미피케이션                                                  │
│  • 멀티 플랫폼 데스크톱 앱 (macOS/Windows/Linux)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Layer 2의 핵심 — 영역별 자동화 가능성

4대 연구와 3차 성찰에서 도출된 영역별 AI 자동화율 추정:

| 영역 | AI 자동화율 | 근거 |
|------|:---:|------|
| Frontend (UI, 페이지) | 85-90% | React 19 + Vite = AI 학습 데이터 최대 |
| Backend (CRUD, Tauri commands) | 80-85% | REST + Zod + Drizzle = AI 친숙 패턴 |
| 인프라/CI/CD | 75-85% | Tauri 빌드 + GitHub Actions = 표준 패턴 |
| Auth 통합 | 70-80% | Better Auth 문서화 양호 (Phase 2 연기) |
| 로컬 GameReducer | 60-70% | 로컬 상태 관리 = AI 친숙 패턴 |
| 테스트 코드 | 60-70% | 바둑 도메인 테스트는 수동 설계 필요 |
| 규칙 엔진 | 50-60% | 순수 함수 + TDD 가능, 에지 케이스 검증 필요 |
| KataGo IPC | 20-30% | AI 학습 데이터에 KataGo 관련 자료 극소 |
| LLM 프롬프트 설계 | 10-20% | 바둑 도메인 전문성 + 메타적 문제 |

**사람-에이전트 협업 지점 (인간 리드 직접 담당):**
- KataGo Analysis Engine IPC 통합 (JSON stdin/stdout 프로토콜)
- LLM 바둑 해설 프롬프트 설계 + 골든 데이터셋 200 포지션 검증
- 멀티 플랫폼 빌드 + 코드 서명 (macOS notarization, Windows SmartScreen)

---

## <a id="3-core-features"></a>3. 핵심 기능 (Phase 1)

### 3.1 기능 우선순위 매트릭스

4개 연구의 4개 관점(Market/User/Tech/Business)이 독립적으로 평가한 결과:

| Zone | 기능 | 합의도 | Phase 1 포함 | 핵심 가치 |
|------|------|:------:|:---:|------|
| **Green** | "Why?" AI 자연어 해설 | 4/4 | ✅ | **유일한 moat** — 경쟁자 없음 |
| **Green** | Quick Go (9×9, 3분) | 4/4 | ✅ | **새 카테고리** — 시장에 존재하지 않음 |
| **Green** | Zero-to-First-Game 온보딩 | 4/4 | ✅ | OGS 1년 잔존율 5% 문제의 직접 해결 |
| **Green** | KataGo AI 대국 (30단계) | 4/4 | ✅ | 초기 유저풀 부족 해결 (로컬 실행) |
| **Green** | 복기/분석 | 4/4 | ✅ | KataGo 로컬 분석 |
| **Yellow** | 게이미피케이션 기본 | 3/4 | ✅ | 리텐션 선제 대응 |
| **Yellow** | 멀티 플랫폼 빌드 | — | ✅ | macOS/Windows/Linux (Tauri 2.0) |
| **Red** | 온라인 대국 (PvP) | — | ❌ | Phase 2 (릴레이 서버 필요) |
| **Red** | Glicko-2 매칭 | — | ❌ | Phase 2 (온라인 대국 전제) |
| **Red** | 사활 문제 시스템 | — | ❌ | Phase 2 |
| **Red** | 커뮤니티/소셜 | — | ❌ | Phase 2 |
| **Red** | 토너먼트 시스템 | — | ❌ | Phase 2 |
| **Red** | B2B 도장 LMS | — | ❌ | Phase 2 |
| **Red** | 실시간 AI 코칭 | — | ❌ | Phase 2 (GPU 전환 후) |

### 3.2 기능 상세 스펙

#### F1: "Why?" AI 자연어 해설 엔진

**핵심 차별화 기능 — 유일한 moat**

```
KataGo 분석 JSON (승률, 최선수, 변화도)
    ↓
도메인 특화 패턴 매칭 (Phase 1: 템플릿 엔진)
    ↓
3-tier 수준별 해설 (입문/중급/고급)
    ↓
사용자에게 "왜 이 수가 좋은/나쁜지" 자연어 제공
```

| 항목 | Phase 1 (템플릿) | Phase 2 (LLM) |
|------|:---:|:---:|
| 엔진 | 패턴 매칭 템플릿 | Claude Haiku 4.5 (80%) + Sonnet 4.6 (15%) + 템플릿 폴백 (5%) |
| 비용 | **$0/mo** | **$0** (사용자 자체 API 키) |
| 정확도 목표 | 커버리지 80%+ | 정확도 80%+ |
| 검증 | 템플릿 QA | 3-layer (data anchoring → constrained gen → output check) |
| 고위험 포지션 | **필수 템플릿 폴백** (사활/패/세키) | 동일 — LLM 바둑 이해 능력 ZERO |
| 해설 수준 | 3-tier (입문/중급/고급) | 동일 |

**핵심 원칙: LLM = 번역기, KataGo = 진실의 원천**
- LLM은 바둑 이해 능력이 ZERO임이 연구로 확인됨
- LLM은 KataGo가 제공하는 수치 데이터를 자연어로 "번역"하는 역할만 수행
- 모든 해설은 KataGo 분석 데이터에 앵커링되어야 함

#### F2: Quick Go (9×9, 3분)

**시장에 존재하지 않는 새 카테고리**

| 항목 | 스펙 |
|------|------|
| 보드 크기 | 9×9 |
| 시간 제한 | 3분 + 초읽기 (Byoyomi) |
| 상대 | KataGo AI (Phase 1), 온라인 매칭 (Phase 2) |
| 규칙 | Tromp-Taylor + Chinese scoring |
| AI 난이도 | 자동 조절 (사용자 수준에 맞춤) |
| 대국 후 | 즉시 "Why?" AI 해설 제공 |
| UX 목표 | 점심시간에 한 판 = 바둑 인구 확대 |

#### F3: Zero-to-First-Game 온보딩

**OGS 1년 잔존율 5%의 근본 원인 해결**

| 항목 | 스펙 |
|------|------|
| 목표 시간 | 5분 이내 |
| 방식 | 인터랙티브 튜토리얼 |
| 흐름 | 규칙 → 첫 돌 → 캡처 체험 → Quick Go 9×9 → AI 해설 체험 |
| 완주율 목표 | 70%+ |
| Anonymous-first | 가입 없이 즉시 시작 가능 |

#### F4: KataGo AI 대국 (30단계)

| 항목 | 스펙 |
|------|------|
| 엔진 | KataGo v1.16.2, Analysis Engine JSON |
| 실행 환경 | **사용자 PC** (Tauri sidecar) |
| NN 모델 | b6c96 (~15MB, 번들) → b18c384nbt (~70MB, 별도 다운로드) |
| GPU | 자동 감지 (CUDA/OpenCL), 없으면 CPU Eigen |
| 난이도 | 30단계 (입문자~프로급) |
| Visits | 5 (즉시) / 50 (빠른 분석) / 500 (심층 복기) |
| 프로세스 | 단일 + Watchdog (3s backoff, 5회/10분 회로 차단) |
| HumanSL | Month 3-4 도입 — "AI가 5급처럼 둡니다" (AnalysisEngine interface 준비) |
| 저사양 대응 | visits 자동 축소 (50-100), 하드웨어 벤치마크 초기 실행 |

#### F5: 복기/분석

| 항목 | 스펙 |
|------|------|
| 분석 엔진 | KataGo 로컬 분석 (사용자 PC) |
| 시각화 | 승률 그래프 (WinRateGraph), 변화도 색상 코드 (KaTrain scheme) |
| 해설 | "Why?" AI 해설 통합 (각 수에 대한 자연어 설명) |
| 저장 | 로컬 SQLite (append-only move log) |
| 내보내기 | SGF 포맷 |

#### F6: 게이미피케이션 기본

| 항목 | 스펙 |
|------|------|
| 일일 퀘스트 | "Quick Go 1판", "AI 해설 확인 3회" 등 |
| 레벨 | 경험치 기반 레벨업 |
| 스트릭 | 연속 플레이 일수 추적 |
| 뱃지 | 첫 승리, 첫 복기, 온보딩 완료 등 |

#### F7: 멀티 플랫폼 데스크톱 앱

| 항목 | 스펙 |
|------|------|
| 프레임워크 | Tauri 2.0 (Rust sidecar, ~10MB 번들) |
| 지원 OS | macOS 12+ / Windows 10+ / Ubuntu 20+ |
| 배포 | GitHub Releases + 자동 업데이트 (tauri-plugin-updater) |
| 코드 서명 | macOS notarization (Apple Developer $99/yr) |
| 알림 | OS 네이티브 알림 (Tauri notification plugin) |
| 앱 크기 | ~100MB (경량 모델 포함), 고성능 모델 ~70MB 별도 다운로드 |

### 3.3 바둑판 UI 스펙

| 항목 | 스펙 |
|------|------|
| 렌더링 | SVG (React JSX), Shudan fork base |
| 컴포넌트 수 | 20개 (18 classical + WinRateGraph + ExplanationCard) |
| 모바일 터치 | Tap-Preview-Confirm 2단계 (19×9 오클릭 방지) + pinch-zoom (@use-gesture) |
| 상태 관리 | Zustand (2.7KB) |
| 차트 | Recharts (D3-based, 승률 그래프) |
| 색상 코드 | KaTrain scheme (green→blue→yellow→orange→red) |
| 설계 원칙 | **"보드 자체가 아니라 보드 주변을 혁신하라"** — 바둑 유저는 깨끗하고 정적인 보드를 선호 |

### 3.4 바둑 규칙 엔진

| 항목 | 스펙 |
|------|------|
| 규칙 | Tromp-Taylor (10문장, 수학적 완전성) |
| 계가 | Chinese scoring only (Phase 1) → Japanese (Phase 2) |
| 보드 표현 | 1D Uint8Array |
| Ko 감지 | Zobrist hashing (O(1) superko) |
| 구현 방식 | 순수 함수, 증분 빌드 (Place → Capture → Ko → Scoring → Superko) |
| 코드 규모 | 300-500줄 TypeScript |
| 테스트 | 130+ (KataGo oracle 교차 검증 포함) |

---

## <a id="4-user-stories"></a>4. 사용자 스토리

### 4.1 핵심 사용자 세그먼트

연구에서 도출된 2개 핵심 세그먼트:

#### 세그먼트 A: 입문자/초급자 (주 타겟)

**핵심 좌절**: "규칙은 알겠는데 뭘 해야 할지 모르겠다"

- OGS 1년 잔존율 5%의 근본 원인
- 원하는 것: 가이드, AI 코치, 짧은 게임, 성장 실감
- Quick Go + 온보딩 + AI 해설이 직접 해결

#### 세그먼트 B: 중급자/고급자

**핵심 좌절**: "왜 졌는지 모르겠다"

- AI Sensei의 수치만으로는 불충분
- 원하는 것: "이 수가 왜 나빴는지" 자연어 설명
- "Why?" AI 해설이 직접 해결

### 4.2 사용자 여정

```
입문자: 앱 설치 → 5분 온보딩 → Quick Go(9×9) AI 대국 → AI 해설 체험
        → "더 알고 싶다" → 13×13, 19×19 진출 → 복기/분석 일상화

중급자: 앱 설치 → AI 대국 (수준 맞춤) → 복기 → "Why?" AI 해설
        → "매일 이게 필요하다" → 일상적 복기 루틴 형성
```

### 4.3 사용자 스토리 목록

#### Epic 1: 첫 경험 (Zero-to-First-Game)

| ID | 사용자 스토리 | 수락 기준 |
|----|-------------|----------|
| US-1.1 | 바둑을 처음 접하는 사용자로서, 앱을 열자마자 **가입 없이** 바로 플레이를 시작할 수 있다 | Anonymous-first: 앱 실행 → 3초 내 온보딩 시작 가능 |
| US-1.2 | 입문자로서, 5분 이내 인터랙티브 튜토리얼을 통해 기본 규칙을 체험하고 **즉시 첫 대국**을 할 수 있다 | 온보딩 완주율 70%+, 5분 이내 |
| US-1.3 | 완전 초보자로서, 9×9 Quick Go를 통해 **3분 만에** 바둑 한 판을 경험할 수 있다 | Quick Go 시작→종료 3분 이내 |
| US-1.4 | 첫 대국을 마친 사용자로서, AI가 "이 수가 좋았던 이유"를 **내 수준에 맞게** 자연어로 설명해준다 | 3-tier 해설 (입문/중급/고급), 사용자 수준 자동 감지 |

#### Epic 2: AI 대국

| ID | 사용자 스토리 | 수락 기준 |
|----|-------------|----------|
| US-2.1 | 중급자로서, 내 실력에 맞는 AI 상대를 골라 대국할 수 있다 | 30단계 난이도 선택, 자동 추천 |
| US-2.2 | 사용자로서, 대국 중 KataGo가 **내 PC에서 직접** 작동하여 빠른 응답을 받을 수 있다 | GPU 감지: CUDA/OpenCL 자동, 없으면 CPU Eigen |
| US-2.3 | 저사양 PC 사용자로서, 성능이 자동으로 조절되어 **UI가 멈추지 않는다** | visits 자동 축소 (50-100), KataGo 별도 프로세스 |
| US-2.4 | 사용자로서, 9×9, 13×13, 19×19 보드 중 선택하여 대국할 수 있다 | 3종 보드 지원 |

#### Epic 3: "Why?" AI 해설 & 복기

| ID | 사용자 스토리 | 수락 기준 |
|----|-------------|----------|
| US-3.1 | 대국을 마친 사용자로서, **모든 수에 대해** KataGo 분석 기반 자연어 해설을 받을 수 있다 | 각 수별 "이 수가 좋은/나쁜 이유" 텍스트 |
| US-3.2 | 입문자로서, 해설이 **바둑 용어 없이** 쉬운 말로 제공된다 | 3-tier: 입문 = 일상어, 중급 = 기본 용어, 고급 = 전문 분석 |
| US-3.3 | 사용자로서, 승률 그래프에서 **전환점(blunder)**을 한눈에 확인할 수 있다 | WinRateGraph 컴포넌트, KaTrain 색상 코드 |
| US-3.4 | 사용자로서, 과거 대국 기록을 **로컬에 안전하게** 저장하고 언제든 다시 볼 수 있다 | SQLite 로컬 저장, SGF 내보내기 지원 |
| US-3.5 | 고급 사용자로서, Phase 2에서 **내 Claude API 키**를 입력하여 더 깊은 AI 해설을 받을 수 있다 | API 키 입력 UI, 키 미입력 시 템플릿 폴백 |

#### Epic 4: 성장 여정 (게이미피케이션)

| ID | 사용자 스토리 | 수락 기준 |
|----|-------------|----------|
| US-4.1 | 사용자로서, 일일 퀘스트(Quick Go 1판, 해설 확인 3회 등)를 완료하며 성장을 실감할 수 있다 | 일일 퀘스트 시스템 |
| US-4.2 | 사용자로서, 연속 플레이 스트릭으로 동기를 유지할 수 있다 | 스트릭 카운터 + 보상 |
| US-4.3 | 사용자로서, 뱃지와 레벨업을 통해 성취감을 느낄 수 있다 | 뱃지/레벨 시스템 |

#### Epic 5: 데스크톱 앱 경험

| ID | 사용자 스토리 | 수락 기준 |
|----|-------------|----------|
| US-5.1 | 사용자로서, macOS/Windows/Linux에서 앱을 설치하여 **인터넷 없이** AI 대국 + 복기를 할 수 있다 | Tauri 2.0, 3 OS 지원, 오프라인 모드 |
| US-5.2 | 사용자로서, 앱이 자동으로 업데이트되어 항상 최신 버전을 사용할 수 있다 | tauri-plugin-updater |
| US-5.3 | 사용자로서, 모든 게임 데이터가 **내 컴퓨터에만** 저장되어 개인정보가 보호된다 | 로컬 SQLite, 서버 전송 없음 |
| US-5.4 | 다국어 사용자로서, 영어/한국어/일본어 중 선택하여 앱을 사용할 수 있다 | react-i18next, 3 locales (en/ko/ja) |

---

## <a id="5-architecture"></a>5. 기술 아키텍처

### 5.1 통합 기술 스택 (Balanced-Tech v2.0 — 로컬 앱)

4개 독립 연구가 동일하게 Balanced-Tech를 선택한 **4중 수렴** 결과:

```
┌──────────────────────────────────────────────────────────────────┐
│        Baduk Platform — Unified Balanced-Tech Stack v2.0          │
│                         (로컬 데스크톱 앱)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ■ 코어 인프라                                                     │
│  App Framework:  Tauri 2.0 (Rust sidecar, ~10MB 번들)              │
│  Frontend:       Vite + React 19 + TypeScript strict               │
│  Database:       SQLite (better-sqlite3, WAL mode)                 │
│  Queue:          인메모리 큐 + Node.js worker_threads              │
│  ORM:            Drizzle ORM (SQLite 드라이버)                     │
│  UI:             Tailwind CSS 4 + shadcn/ui                        │
│  Lint:           Biome v2.3 (56x faster)                           │
│  Quality:        SonarQube Community (SQALE ≤5%)                   │
│  Test:           Vitest + Playwright (Strategic TDD)               │
│  CI/CD:          GitHub Actions (멀티 플랫폼 빌드)                  │
│  배포:            GitHub Releases + tauri-plugin-updater            │
│  Monitor:        Sentry (데스크톱 크래시 리포팅)                    │
│  Architecture:   Modular Monolith (단일 앱 프로세스)               │
│  IPC:            Tauri commands (Rust↔JS) + Zod 검증               │
│  Pattern:        Ports/Adapters (벤더 교체 1파일)                   │
│                                                                    │
│  ■ 바둑 도메인                                                     │
│  AI Engine:      KataGo v1.16.2 (사용자 PC 실행)                   │
│  NN Model:       b6c96 (번들) → b18c384nbt (다운로드)              │
│  Rules:          Tromp-Taylor + Chinese scoring                    │
│  Board:          1D Uint8Array, Zobrist hashing                    │
│  LLM V1:         Template Engine (패턴 매칭, $0/mo)               │
│  LLM V2:         Claude Haiku 4.5 + Sonnet 4.6 (사용자 API 키)    │
│  Board UI:       SVG + Shudan fork + 20 컴포넌트                   │
│  State Mgmt:     Zustand (2.7KB)                                   │
│  Charts:         Recharts (D3-based)                               │
│                                                                    │
│  ■ 외부 서비스 (Phase 1: 4개)                                       │
│  PostHog:        클라이언트 SDK (opt-in 텔레메트리)                 │
│  Sentry:         데스크톱 크래시 리포팅                              │
│  Cloudflare:     랜딩 페이지 + 업데이트 서버                        │
│  Discord:        Webhooks (게임 결과 공유, 선택적)                   │
│                                                                    │
│  i18n:           react-i18next (en/ko/ja)                            │
│                                                                    │
│  ■ Phase 2 추가                                                     │
│  Claude API:     사용자 자체 API 키                                 │
│  Better Auth:    온라인 대국 시 로그인                               │
│  릴레이 서버:     경량 VPS ($5-10/mo)                               │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 72% Proven + 28% Validated-Latest 전략

| 기술 | 유형 | 근거 |
|------|------|------|
| React 19, TypeScript strict | Proven | AI 학습 데이터 최대 |
| SQLite, Zustand, Recharts | Proven | 수십 년 검증 |
| KataGo v1.16.2 | Industry Standard | MIT, 유일한 현실적 선택 |
| Drizzle ORM | Validated-Latest | no codegen → AI agent 최적 |
| Biome v2.3 | Validated-Latest | 56x faster → AI CI 반복 이점 |
| Tauri 2.0 | Validated-Latest | ~10MB 번들, 크로스 플랫폼 |
| Vite | Validated-Latest | HMR, 빠른 빌드 |

### 5.3 하드웨어 요구사항 (사용자 PC)

| 구분 | 최소 사양 | 권장 사양 | 비고 |
|------|:---:|:---:|------|
| CPU | 4코어 | 8코어+ | KataGo visits=500 시 4코어 점유 |
| RAM | 4GB | 8GB+ | 앱 200-400MB + KataGo 2-4GB |
| 디스크 | 500MB | 1GB+ | 앱 ~100MB + 고성능 모델 ~70MB |
| GPU | 불필요 | CUDA/OpenCL | GPU 시 KataGo 10-50x 가속 |
| OS | macOS 12+ / Win 10+ / Ubuntu 20+ | — | Tauri 2.0 지원 범위 |

---

## <a id="6-data-sources"></a>6. 데이터 소스

### 6.1 바둑 기보 데이터

| 소스 | 규모 | 용도 | 라이선스 | 획득 방법 |
|------|------|------|---------|----------|
| **CWI Dataset** | 88,000 프로 기보 | 템플릿 엔진 패턴 학습, 포지션 분류 | 공개 | 앱 번들 또는 초기 다운로드 |
| **featurecat/go-dataset** | 21.1M 기보 | 대규모 패턴 분석, AI 해설 품질 향상 | GitHub 무료 | 선택적 다운로드 |
| **@sabaki/sgf** | npm 패키지 | SGF 파싱/직렬화 | MIT | npm install |

### 6.2 KataGo 모델

| 모델 | 크기 | 성능 | 배포 방식 |
|------|------|------|----------|
| **b6c96** | ~15MB | 아마추어 고단 수준 | 앱 번들 (기본) |
| **b18c384nbt** | ~70MB | 프로 9단+ 수준 | 별도 다운로드 (선택) |

### 6.3 골든 데이터셋

| 항목 | 스펙 |
|------|------|
| 규모 | 200 포지션 |
| 용도 | LLM 해설 정확도 검증 |
| 구축 방법 | 3-5명 단급자 검증 |
| 비용 | $500-1,000 (일회성) |
| 구성 | 입문(50) + 중급(80) + 고급(50) + 고위험(20, 사활/패/세키) |

### 6.4 사용자 생성 데이터 (로컬 저장)

| 데이터 | 저장소 | 백업 |
|--------|--------|------|
| 대국 기록 (move log) | SQLite (append-only) | 사용자 책임 (iCloud/Google Drive) |
| 분석 결과 | SQLite | 동일 |
| 사용자 설정 | SQLite | 동일 |
| 게이미피케이션 진행 | SQLite | 동일 |

### 6.5 Analytics 데이터

| 소스 | 데이터 유형 | 수집 방식 | 개인정보 |
|------|-----------|----------|---------|
| PostHog | 사용 패턴, funnel, cohort | 클라이언트 SDK, **opt-in** | 익명화 |
| Sentry | 크래시 리포트, 에러 | 자동 | 최소 수집 |

---

## <a id="7-kpi"></a>7. 성공 지표 (KPI)

### 7.1 핵심 성공 기준

**완전 무료 + 로컬 앱** 모델에서의 성공 지표. MRR/유료 전환율 대신 **사용자 참여도**가 핵심:

| 카테고리 | 지표 | 6개월 | 12개월 | 18개월 | 측정 도구 |
|----------|------|:-----:|:------:|:------:|----------|
| **성장** | 총 다운로드 | 5K+ | 15K+ | 30K+ | GitHub Releases 통계 |
| **성장** | DAU | 100+ | 500+ | 1,000+ | PostHog |
| **성장** | MAU | 2K+ (보정) | 8K | 25K | PostHog |
| **참여** | DAU/MAU 비율 | 10%+ | 10%+ | 10%+ | PostHog |
| **리텐션** | D1 잔존율 | 60%+ | 65%+ | 70%+ | PostHog cohort |
| **리텐션** | D7 잔존율 | 25%+ | 30%+ | 35%+ | PostHog cohort |
| **리텐션** | D30 잔존율 | 15%+ | 20%+ | 25%+ | PostHog cohort |
| **핵심 기능** | "Why?" AI 해설 사용률 | 40%+ | 50%+ | 60%+ | 커스텀 이벤트 |
| **핵심 기능** | Quick Go 일일 대국 수 | 200+ | 500+ | 1,000+ | 로컬 통계 |
| **온보딩** | Zero-to-First-Game 완주율 | 70%+ | 75%+ | 80%+ | PostHog funnel |
| **비용** | 월 총 운영비 | **$2** | **$7-12** | **$7-12** | 수동 추적 |

> **KPI 보정 (3차 성찰)**: 데스크톱 앱은 웹 앱 대비 바이럴 확산 속도가 느림. MAU 목표를 R1의 8K에서 **2K (6개월)**으로 보정. 단, 데스크톱 앱 사용자의 참여도와 잔존율은 웹 대비 높을 것으로 예상.

### 7.2 Go/No-Go 게이트

| 시점 | CONTINUE | PIVOT |
|------|----------|-------|
| **M1 (2개월)** | 템플릿 커버리지 80%+ & 코어 엔진 완성 & Tauri 빌드 성공 | 미달 → 스코프 축소 |
| **M2 (4개월)** | Beta DAU 100+ & 3 OS 빌드 성공 | 50 미만 → UX 재설계 |
| **M3 (6개월)** | DAU 100+ & D7 잔존율 25%+ & 코드 서명 완료 | DAU 30 미만 → 컨셉 재검토 |
| **12개월** | DAU 500+ & 다운로드 5K+ | DAU 100 미만 → 프로젝트 존속 재검토 |

### 7.3 성공 확률 분석

4개 독립 연구의 성공 확률 추정:

```
R1 (전략):   65-75%  ← 전체 프로젝트 성공 확률 (모든 위험 포함)
R2 (기술):   70-75%  ← 기술 구현 성공 확률
R3 (도메인): 82-91%  ← 바둑 도메인 기술 성공 확률
R4 (연동):   85-91%  ← 외부 연동 기술 성공 확률
```

> **주의**: 전체 프로젝트 성공 확률은 R1의 **65-75%** 범위에 가깝다. R2-R4는 범위가 좁아 확률이 높게 나타나는 것이며, "프로젝트 전체가 85-91% 확률로 성공"을 의미하지 않는다.

---

## <a id="8-cost"></a>8. 비용 구조

### 8.1 개발 비용 (일회성)

| 항목 | 금액 | 근거 |
|------|------|------|
| AI agent 컴퓨트 (Claude Code, 6개월) | $500-800 | R3 |
| 골든 데이터셋 (200 포지션, 단급자 검증) | $500-1,000 | R3 |
| Apple Developer 등록 (macOS 코드 서명) | $99/yr | 3차 성찰 |
| **개발 총 비용** | **$1,099-1,899** | |

> 전통적 개발팀 대비 ~99% 절감 ($180-300K → ~$1,099-1,899)

### 8.2 월간 운영 비용

| 항목 | Phase 1 | Phase 2 | 근거 |
|------|:---:|:---:|------|
| 도메인+DNS | $2 | $2 | R2 |
| PostHog | $0 (free) | $0 (free) | R4 |
| Sentry | $0 (free) | $0 (free) | R4 |
| Cloudflare | $0 (free) | $0 (free) | R4 |
| Claude API | $0 (템플릿) | $0 (사용자 키) | 3차 성찰 |
| 매칭/릴레이 서버 | — | $5-10 | 3차 성찰 |
| **월 합계** | **$2** | **$7-12** | |

### 8.3 "성공의 역설" 근본 해소

로컬 앱 + 완전 무료 모델의 핵심 이점:

```
SaaS 모델:     사용자↑ ──→ 서버 부하↑ ──→ 비용↑ ──→ ⚠ 재정 위기
로컬 앱 모델:  사용자↑ ──→ 각자 PC 사용 ──→ 비용 불변 ──→ ✅ 지속 가능
```

| 비용 요소 | 로컬 앱 모델 |
|----------|:---:|
| KataGo 연산 | **사용자 CPU/GPU** → 운영자 $0 |
| Claude API | **사용자 자체 API 키** → 운영자 $0 |
| 데이터 저장 | **사용자 로컬 SQLite** → 서버 $0 |
| MAU 증가 영향 | **비용 불변** (P2P 구조) |

### 8.4 누적 비용 추정

| 기간 | 비용 추정 | 비고 |
|------|----------|------|
| 6개월 (Phase 1) | $1,111-1,911 | 개발 $1,099-1,899 + 운영 $12 |
| 18개월 | $1,195-2,055 | + Phase 2 운영 12개월 |
| 3년 | $1,339-2,331 | 인프라 성장 미미 |

---

## <a id="9-timeline"></a>9. 일정 및 마일스톤

### 9.1 6개월 마일스톤 (Phase 1)

```
M1 (Month 1-2): Core Engine ══════════════════════════════════════
├── Tauri 2.0 프로젝트 설정 + Vite + React 19             (Week 1)
├── 규칙 엔진 Tromp-Taylor + Chinese scoring              (Week 1-2)
├── KataGo 통합 (Tauri sidecar + worker_threads + Watchdog)(Week 1-3)
├── SQLite 스키마 + Drizzle ORM 설정                       (Week 1-2)
├── 로컬 GameReducer (AI 대국, SQLite 상태 저장)           (Week 2-5)
├── LLM V1 템플릿 (패턴 매칭 + 3-tier 해설)               (Week 2-4)
└── Go/No-Go: 템플릿 커버리지 80%+ & 코어 엔진 완성

M2 (Month 3-4): Playable Beta ════════════════════════════════════
├── UI/UX (Shudan fork + 20 컴포넌트)                     (Week 2-8)
├── 멀티 플랫폼 빌드 (macOS + Windows + Linux)             (Week 3-4)
├── OS 네이티브 알림 (Tauri notification plugin)            (Week 3)
├── Analytics (PostHog client SDK + Sentry 크래시 리포팅)   (Week 4-5)
├── Quick Go (9×9, 3분) + AI 해설 MVP                      (—)
├── i18n (react-i18next en/ko/ja)                          (Week 5-6)
├── Integration testing + hardening                        (Week 6-7)
├── GitHub Releases + 자동 업데이트                         (Week 7)
└── Go/No-Go: Beta DAU 100+ & 3 OS 빌드 성공

M3 (Month 5-6): Public Launch ════════════════════════════════════
├── 온보딩 (Zero-to-First-Game)
├── 게이미피케이션 기본
├── 성능 최적화 + 앱 크기 최적화
├── 코드 서명 (macOS notarization + Windows SmartScreen)
└── Go/No-Go: DAU 100+ & D7 잔존율 25%+
```

### 9.2 병렬 실행 현실성

AI agent 병렬 실행의 현실적 제약:

| 제약 | 설명 | 대응 |
|------|------|------|
| 공유 파일 충돌 | package.json, DB 스키마, 타입 정의 | 모듈별 branch + 사전 인터페이스 합의 |
| 절대 기준 2 위반 | 동일 파일 동시 수정 금지 | 순차 통합 (주 1-2회) |
| 현실적 병렬도 | 2-3x (모듈 경계 명확 시) | 중복 제거 후 ~14-16주 → 2-3x → M1-M2 부합 |

### 9.3 주차별 기술 검증 게이트

| 주차 | 검증 항목 | 판정 기준 |
|------|----------|----------|
| Week 2 | Tauri 프로젝트 빌드 | 3 OS 빌드 성공 |
| Week 3 | KataGo IPC 통신 | Analysis Engine JSON 송수신 성공 |
| Week 4 | 규칙 엔진 코어 | Tromp-Taylor 100% 통과 |
| Week 6 | 템플릿 해설 | 커버리지 60%+ |
| Week 8 | AI 대국 E2E | 9×9 완전 대국 성공 |
| Week 10 | 멀티 플랫폼 | 3 OS 설치+실행 성공 |
| Week 12 | Beta 릴리스 | 외부 사용자 10명+ 테스트 |

---

## <a id="10-risks"></a>10. 위험 레지스터

4개 연구 + 3차 성찰에서 도출된 통합 위험 목록 (영향도 순):

| # | 위험 | 확률 | 영향 | 완화 전략 |
|---|------|:---:|:---:|------|
| **R1** | **LLM 환각 (잘못된 바둑 조언)** | 높음 | 치명적 | 3-layer 검증 + 사활/패/세키 필수 템플릿 폴백. M1 Go/No-Go: 커버리지 80%+ |
| **R14** | **AI agent 병렬 코드 충돌** | 높음 | 높음 | 모듈별 branch + 사전 인터페이스 합의 + 주 1-2회 순차 통합 |
| **R16** | **멀티 OS 호환성** (3 플랫폼) | 높음 | 높음 | Tauri 2.0 + GitHub Actions 멀티 플랫폼 CI |
| **R5** | **KataGo 프로세스 크래시** (사용자 PC) | 중간 | 높음 | Watchdog 자동 재시작 (3s backoff, 5회/10분 회로 차단) |
| **R6** | **모바일 19×19 터치 정확도** | 높음 | 높음 | Tap-Preview-Confirm + pinch-zoom |
| **R9** | **Quick Go 바이럴 실패** | 중간 | 높음 | M2 A/B 테스트, 재설계 |
| **R10** | **AI workflow 자동 구현율 미달** | 중간 | 높음 | M1 속도 측정, 스코프 축소 |
| **R11** | **입문자 잔존율 미달** | 중간 | 높음 | M3 15% 미달 시 UX 재설계 |
| **R19** | **코드 서명/공증 비용** | 중간 | 높음 | Apple Developer $99/yr. Windows SmartScreen 대응 UX |
| **R18** | **사용자 하드웨어 다양성** | 높음 | 중간 | GPU 자동 감지, visits 자동 조절, 하드웨어 벤치마크 |
| **R17** | **앱 크기 + 자동 업데이트** | 중간 | 중간 | 경량 모델 번들 + 점진 업데이트 |
| **R3** | **무료 서비스 지속 가능성** | 낮음 | 중간 | 월 $2 → 사실상 무한 운영. "성공의 역설" 근본 해소 |
| **R7** | **Claude API = 사용자 부담** (Phase 2) | 중간 | 중간 | 템플릿 폴백 기본, API 키 = 선택적. 운영자 $0 |
| **R8** | **Better Auth 미성숙** (Phase 2) | 낮음 | 중간 | Phase 1에서 Auth 불필요. Phase 2에서 도입, 대안 충분 |
| **R13** | **일본 규칙 구현 복잡도** | 높음 | 중간 | Phase 2 연기. 중국 규칙이 온라인 대국 80%+ 커버 |
| **R12** | **Free tier 정책 변경** | 낮음 | 중간 | PostHog→Umami 자체호스팅 대안 |
| **R20** | **기부/후원 모델 미구축** | 중간 | 중간 | Phase 2에서 GitHub Sponsors 검토 |
| **R21** | **앱 배포 채널 발견성** — 데스크톱 앱은 웹 앱 대비 다운로드+설치 장벽으로 바이럴 확산 속도 느림 | 높음 | 높음 | 랜딩 페이지(Cloudflare) + 바둑 커뮤니티 직접 홍보(Reddit r/baduk, Discord, 바둑 포럼) + GitHub README SEO |

---

## <a id="11-open-items"></a>11. 미결 사항 및 추후 결정 필요 항목

### 11.1 최우선 (PRD 확정 전 결정 필요)

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 1 | **Workflow system 관점 조사** | 구조적 부재 | 에이전트 팀 구성, 병렬 전략, 사람-에이전트 협업 프로토콜 |
| 2 | **기능 상세 스펙** | Green/Yellow 수준 정의만 | Quick Go/온보딩/게이미피케이션의 상세 UX 흐름 |
| 3 | **DB 스키마** | 미정 | users, games, moves, analysis, gamification 최소 5개 테이블 |

### 11.2 높음 (구현 초기 결정 필요)

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 4 | Tauri vs Electron 검증 | Tauri 2.0 선택 | AI agent Tauri 코드 생성 능력 검증 |
| 5 | KataGo 번들 전략 | b6c96 번들 + 고성능 다운로드 | CUDA/OpenCL/Eigen 바이너리 전략 |
| 6 | AI 해설의 "인격/톤" | 미정 | 분석적 vs 격려 vs 소크라테스식 |
| 7 | "완전 무료"의 범위 | 미정 | AI 해설 일일 사용 제한 여부 |
| 8 | 앱 배포 채널 | GitHub Releases | Microsoft Store / Mac App Store 등록 여부 |
| 9 | Windows 코드 서명 | 미정 | EV 코드 서명($200+/yr) vs unsigned 경고 감수 |

### 11.3 중간 (구현 중 결정 가능)

| # | 항목 | 현재 상태 | 필요한 것 |
|---|------|----------|----------|
| 10 | 테스트 전략 상세 | Strategic TDD 확정 | 모듈별 테스트 범위 + E2E 시나리오 |
| 11 | 접근성 요구사항 | 미정 | WCAG 수준 결정 |
| 12 | 서비스 종료 계획 | 미정 | 운영 중단 시 사용자 데이터 이관 방안 |
| 13 | 후원 채널 전략 | 미정 | GitHub Sponsors/Buy Me a Coffee Phase 1 포함 여부 |
| 14 | 오프라인-온라인 전환 UX | 미정 | Phase 2 데이터 동기화 전략 |

---

## <a id="12-phase-2"></a>12. Phase 2 로드맵 (Month 7-12+)

### 12.1 Phase 1 → Phase 2 기능 구분

| 기능 | Phase 1 (로컬 only) | Phase 2 (네트워크 추가) |
|------|:---:|:---:|
| AI 대국 | ✅ 로컬 KataGo | ✅ |
| "Why?" AI 해설 | ✅ 템플릿 ($0) | ✅ + 사용자 API 키 고급 해설 |
| Quick Go | ✅ AI 상대 | ✅ + 온라인 매칭 |
| 복기/분석 | ✅ 로컬 KataGo | ✅ |
| 온보딩 | ✅ | ✅ |
| 게이미피케이션 | ✅ 기본 | ✅ 확장 |
| Auth | ❌ | ✅ Better Auth (온라인 대국) |
| 온라인 대국 | ❌ | ✅ 경량 릴레이 서버 |
| Glicko-2 매칭 | ❌ | ✅ ELO ±200, 30초 후 확장 |
| HumanSL | ❌ | ✅ "AI가 5급처럼 둡니다" |
| Discord 공유 | ❌ | ✅ Webhooks |
| 후원/기부 | ❌ | ✅ GitHub Sponsors |
| 사활 문제 | ❌ | ✅ |
| 일본 규칙 | ❌ | ✅ |
| 커뮤니티 | ❌ | ✅ |

### 12.2 Phase 2 비용 영향

| 항목 | Phase 1 | Phase 2 |
|------|:---:|:---:|
| 월 운영비 | $2 | $7-12 |
| 추가 인프라 | 없음 | 릴레이 서버 VPS $5-10/mo |
| Claude API | $0 | $0 (사용자 자체 API 키) |

---

## <a id="13-constraints"></a>13. 제약 사항

### 13.1 절대 제약 (모든 의사결정에 적용)

| # | 제약 | 근거 |
|---|------|------|
| 1 | **자체 AI 엔진 개발 절대 금지** | Leela Zero 팀도 2019년 중단. DeepMind 수준 리소스 필요. KataGo(MIT)가 유일한 현실적 선택 |
| 2 | **OpenAI/Gemini API 사용 불가** | 양사 TOS 명시적 금지 (구독 계정만). Google 실제 차단 사례 존재 |
| 3 | **LLM = 번역기, KataGo = 진실의 원천** | LLM 바둑 이해 능력 ZERO 확인. 모든 해설은 KataGo 데이터에 앵커링 |
| 4 | **월 운영비 $15 한도** | 로컬 앱으로 서버 비용 거의 $0. Phase 2 릴레이 서버 포함 |
| 5 | **VC 투자 불필요** | 완전 무료 서비스, 수익 목표 없음. 바둑 시장 규모 한정 |

### 13.2 기술 제약

| 제약 | 영향 | 대응 |
|------|------|------|
| Tauri 2.0 Rust sidecar 학습 곡선 | AI agent의 Rust 코드 생성 능력 불확실 | JS↔Rust IPC는 Tauri commands 패턴으로 최소화 |
| KataGo IPC 자동화율 20-30% | 인간 리드 직접 구현 필요 | 전체 코드의 ~15-20%이므로 관리 가능 |
| 사용자 하드웨어 다양성 | KataGo 성능 편차 | GPU 자동 감지 + visits 자동 조절 |
| 앱 크기 ~100MB+ | 다운로드 진입 장벽 | 경량 모델 번들, 고성능 모델 별도 다운로드 |

### 13.3 비즈니스 제약

| 제약 | 영향 | 대응 |
|------|------|------|
| 완전 무료 = 수익 없음 | 장기 운영 동기 | 교육적 공익 + 개인 프로젝트. 비용 $2/mo로 부담 최소 |
| 1인 운영 | 고객 지원, 마케팅 한계 | 커뮤니티 기반 자생적 성장. Discord/Reddit |
| Fox/Tygem 복제 리스크 | moat 침식 가능 | 진짜 moat = 해설 "품질"(3-tier, 골든 데이터셋) + "속도"(데이터 축적) + "로컬 통합"(KataGo 번들+GPU 감지+프로세스 관리의 원클릭 패키지) |

### 13.4 4중 수렴에 대한 메타 비판

4개 연구가 동일한 결론(Balanced-Tech)에 도달했으나, 동일 프레임워크 + 동일 전제(AI agent 개발, 1인 부트스트랩, 바둑 니치 시장)에서 출발했다. **Confirmation Bias 가능성**:

| 반사실 전제 | 예상 결론 변화 |
|------------|--------------|
| "3인 인간 팀이라면?" | Cutting Edge 선택 가능 |
| "VC $500K 자금이 있다면?" | Aggressive 시나리오 가능 |
| "바둑이 아닌 체스라면?" | 기술 스택 유사, 시장 전략 대폭 변경 |

> 4중 수렴은 **"AI agent 개발 + 1인 부트스트랩 + 바둑 니치 시장"이라는 특정 전제 하에서의 최적 선택**으로 해석해야 한다.

---

## 부록: 경쟁사 분석

### 글로벌 바둑 시장 현황

- 글로벌 동접: ~43,000명 (Fox 10K, Tygem 8K, OGS 4K, KGS 2K 등)
- TAM: ~$500M (교육 + 용품 + 소프트웨어)
- SAM: ~$50M (온라인 바둑)
- SOM: $2-8M (현실적 획득 가능)

### 경쟁사 AI 해설 비교

| 플랫폼 | 사용자 | 강점 | 약점 | "Why?" AI 해설 |
|--------|--------|------|------|:---:|
| Fox Weiqi | 15M+ | 최대 유저 | 중국어 전용 | ❌ |
| Tygem | 8M+ | 한국 1위 | UI 노후 | ❌ |
| OGS | 150K | 오픈소스, 글로벌 | 1년 잔존율 5% | ❌ |
| KGS | 200K | 레거시 사용자 | Java, 정체 | ❌ |
| AI Sensei | — | KataGo 복기 | 대국 없음, $5.95/mo | △ (수치만) |
| **Ours** | — | "Why?" AI 해설 + Quick Go | 신규 | **✅ 자연어** |

> **어떤 플랫폼도 "왜 이 수가 좋은/나쁜지" 자연어 설명을 제공하지 않는다.** 이것이 유일한 moat.

---

## 문서 이력

| 버전 | 날짜 | 변경 |
|------|------|------|
| 0.1 | 2026-03-10 | 초안 작성 — 4대 심층조사 + 3차 성찰 기반 |
| 0.1.1 | 2026-03-10 | 로컬 앱 관점 성찰 반영 — 에이전트 수 보정(75개), R21 배포 발견성 위험 추가, Moat 로컬 통합 관점 보강, i18n Phase 1 배치 수정 |

## 참조 문서

| 문서 | 위치 |
|------|------|
| 4대 심층조사 통합 요약서 | `/prompt/prd-research-integrated-summary.md` |
| R1: 시장/사용자/비즈니스 | `/prompt/prd-research-phase1-market-user-tech-biz.md` |
| R2: 기술 스택 심층조사 | `/prompt/prd-research-phase2-technology-deep-dive.md` |
| R3: 바둑 도메인 기술 | `/prompt/prd-research-phase3-baduk-domain-tech.md` |
| R4: 외부 연동 기술 | `/prompt/prd-research-phase4-external-integration.md` |
