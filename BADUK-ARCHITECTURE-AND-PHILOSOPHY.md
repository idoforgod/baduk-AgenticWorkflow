# Baduk Platform: Architecture and Philosophy

이 문서는 Baduk Platform(바둑 앱)의 **설계 철학**과 **아키텍처 전체 조감도**를 기술한다.
부모 프레임워크(AgenticWorkflow)의 방법론이 아닌, **자식 시스템 고유의 도메인 아키텍처**에 집중한다.

> 부모 프레임워크 방법론: [`AGENTICWORKFLOW-ARCHITECTURE-AND-PHILOSOPHY.md`](AGENTICWORKFLOW-ARCHITECTURE-AND-PHILOSOPHY.md)
> 사용자 매뉴얼: [`BADUK-USER-MANUAL.md`](BADUK-USER-MANUAL.md)

---

## 1. 설계 철학 (Design Philosophy)

### 1.1 핵심 목표: KataGo AI와 함께 배우는 바둑

Baduk Platform의 존재 이유는 하나다:

> **KataGo 9단급 AI와 대국하면서, 매 수마다 "왜 이 수가 좋은가/나쁜가"를 이해할 수 있는 데스크톱 바둑 앱.**

단순한 바둑 클라이언트가 아니라, **AI 분석 + 자연어 설명**이 결합된 학습 도구다. 이 목표가 모든 설계 결정을 관통한다:

| 설계 결정 | 이유 |
|-----------|------|
| 네이티브 데스크톱 앱 (Tauri) | KataGo GPU 가속에 웹 브라우저 제약 없음 |
| KataGo Analysis Engine (JSON-line IPC) | 프로 9단 이상 수준, 실시간 분석 가능 |
| 3-tier 설명 템플릿 엔진 | 초급~고급 수준별 맞춤 설명 생성 |
| SVG 기반 바둑판 렌더링 | 정책망 오버레이, 영역 분석 시각화 |
| Tromp-Taylor 순수 TypeScript 구현 | 오프라인에서도 완전한 규칙 검증 |

### 1.2 오프라인-퍼스트 (Offline-First)

바둑 앱은 네트워크 없이도 완전히 동작해야 한다:

- **KataGo**는 로컬 바이너리 + 로컬 모델 파일로 동작
- **규칙 엔진**은 순수 TypeScript — 외부 의존성 없음
- **게임 저장**은 로컬 SQLite (WAL 모드)
- **설명 엔진**은 템플릿 기반 — LLM 호출 불필요

KataGo가 사용 불가능한 경우(바이너리 없음, GPU 미지원 등), 가중 랜덤 AI로 자동 폴백한다.

### 1.3 모듈러 모놀리스 (Modular Monolith)

마이크로서비스의 복잡성 없이, 모듈 간 명확한 경계를 유지하는 모놀리스 구조:

```
┌─────────────────────────────────────────────────────┐
│                  Tauri 2.0 Shell                    │
│  ┌───────────────────────────────────────────────┐  │
│  │            React 19 Frontend                  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │ Board   │ │ Game     │ │ Explanation  │   │  │
│  │  │ UI      │ │ Engine   │ │ Engine       │   │  │
│  │  └────┬────┘ └────┬─────┘ └──────┬───────┘   │  │
│  │       │           │              │            │  │
│  │  ┌────┴───────────┴──────────────┴────────┐   │  │
│  │  │         Core (interfaces.ts)           │   │  │
│  │  └────────────────────────────────────────┘   │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ Tauri Commands (invoke)        │
│  ┌──────────────────┴────────────────────────────┐  │
│  │            Rust Backend (29 commands)          │  │
│  │  ┌────────┐ ┌──────────┐ ┌───────────────┐   │  │
│  │  │ SQLite │ │ KataGo   │ │ Game/Expl/    │   │  │
│  │  │ WAL    │ │ IPC      │ │ i18n/...      │   │  │
│  │  └────────┘ └─────┬────┘ └───────────────┘   │  │
│  └───────────────────┼───────────────────────────┘  │
│                      │ stdin/stdout (JSON-line)      │
│  ┌───────────────────┴───────────────────────────┐  │
│  │  KataGo v1.16.4 (Metal GPU, 200 visits)      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 2. 기술 스택 (Technology Stack)

### 2.1 프론트엔드

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 19 | UI 라이브러리 |
| TypeScript | 5.8 (strict) | 타입 안전성 |
| Vite | 7 | 번들러 + 개발 서버 |
| Tailwind CSS | 4 | 유틸리티-퍼스트 스타일링 |
| Zustand | 5 | 게임 상태 관리 |
| Zod | 4 | 런타임 타입 검증 (외부 경계) |
| i18next | 25 | 다국어 지원 (ko/en/ja) |
| shadcn/ui + Radix | - | UI 컴포넌트 (Dialog, Select, Tabs 등) |
| React Router | 7 | SPA 라우팅 |
| React Query | 5 | 비동기 데이터 페칭 |
| Recharts | 3 | 분석 차트 |
| Biome | 2 | 린팅 + 포매팅 |
| Vitest | 4 | 테스트 프레임워크 |

### 2.2 백엔드 (Rust)

| 기술 | 버전 | 역할 |
|------|------|------|
| Tauri | 2.0 | 데스크톱 앱 프레임워크 |
| rusqlite | 0.31 (bundled) | SQLite — 번들 빌드로 시스템 의존성 제거 |
| tokio | 1 (full) | 비동기 런타임 (Tauri 명령 핸들러) |
| serde + serde_json | 1 | JSON 직렬화/역직렬화 |
| uuid | 1 (v4) | 게임/설정 PK 생성 |

### 2.3 AI 엔진

| 기술 | 버전 | 역할 |
|------|------|------|
| KataGo | v1.16.4 | Analysis Engine (JSON-line IPC) |
| 모델 | g170-b20c256x2 | 20블록 256채널 — 프로 9단 이상 |
| GPU 백엔드 | Metal (Apple Silicon) | M1/M2/M3/M4 네이티브 가속 |
| 방문 횟수 | 200 visits | AI 대국 시 — 충분한 탐색 깊이 |

---

## 3. 모듈 아키텍처 (Module Architecture)

### 3.1 레이어 구조

```
Layer 4: Screens              ← 화면 조합 (Home, Game, Analysis, Settings, QuickGo, Onboarding)
Layer 3: Application          ← 상태 관리 (Zustand store, hooks)
Layer 2: Domain               ← 비즈니스 로직 (rules-engine, explanation-engine, katago-bridge)
Layer 1: Infrastructure       ← 외부 통신 (Tauri commands, i18n, storage, analytics)
Layer 0: Core                 ← 공유 타입 (interfaces.ts — 모든 모듈이 의존)
```

의존성 방향: Layer N은 Layer N-1 이하만 참조. 역방향 의존 금지.

### 3.2 프론트엔드 모듈

| 모듈 | 레이어 | 경로 | 역할 |
|------|--------|------|------|
| `core` | 0 | `src/core/` | 모든 TypeScript 인터페이스, Zod 스키마 |
| `rules-engine` | 2 | `src/rules-engine/` | Tromp-Taylor 규칙, 포석, 착수 검증, 중국식 채점, Zobrist 해싱 |
| `explanation-engine` | 2 | `src/explanation-engine/` | 3-tier 템플릿 매칭, KataGo 출력 파싱, 자연어 설명 생성 |
| `katago-bridge` | 2 | `src/katago-bridge/` | KataGo 상태 관리, 난이도 조절, GPU 감지 |
| `game-engine` | 3 | `src/game-engine/` | Zustand 스토어, 착수/패스/기권, 리플레이, DI 패턴 |
| `board-ui` | 4 | `src/board-ui/` | SVG 바둑판 렌더링, PolicyOverlay, 터치 인터랙션 |
| `screens` | 4 | `src/screens/` | 6개 화면: Home, QuickGo, Game, Analysis, Settings, Onboarding |
| `features` | 4 | `src/features/` | Quick Go 플로우, 게이미피케이션, 온보딩 |
| `i18n` | 1 | `src/i18n/` | i18next 설정, 3개 로케일 (en/ko/ja) |
| `hooks` | 3 | `src/hooks/` | useAiOpponent, useKataGoAnalysis 등 |

### 3.3 백엔드 모듈 (Rust — 29 Tauri Commands)

| 모듈 | 명령 수 | 역할 |
|------|---------|------|
| `commands::storage` | 6 | 게임 저장/로드/목록/삭제, 설정 get/set |
| `commands::katago` | 7 | 초기화, 종료, 분석, 취소, 상태, GPU 감지 |
| `commands::game` | 6 | 게임 생성, 착수, 패스, 기권, 로드, SGF 내보내기 |
| `commands::explanation` | 3 | 설명 생성, 티어 설정/조회 |
| `commands::i18n` | 1 | 시스템 로케일 감지 |
| `commands::analytics` | 2 | 분석 동의 설정/조회 |
| `commands::gamification` | 4 | 퀘스트 목록/완료, 진행 상황, 업적 확인 |

### 3.4 AppState 구조

```rust
pub struct AppState {
    pub db: Mutex<Connection>,            // SQLite (WAL mode)
    pub katago: Mutex<Option<KataGoProcess>>,  // KataGo 프로세스 (lazy init)
}
```

- `db`: 앱 데이터 디렉토리의 `baduk.db`. WAL 모드로 읽기 동시성 확보.
- `katago`: `None`으로 시작 → `katago_initialize` 호출 시 프로세스 생성.

---

## 4. KataGo 통합 아키텍처 (KataGo Integration)

### 4.1 프로세스 관리

KataGo는 **사이드카 패턴**으로 관리된다. Tauri 앱의 자식 프로세스로 실행되며, JSON-line 프로토콜로 stdin/stdout 통신한다.

```
Tauri App
    │
    ├── spawn (std::process::Command)
    │   └── KataGo binary (src-tauri/binaries/katago-aarch64-apple-darwin)
    │       ├── stdin  ← JSON 쿼리 (분석 요청)
    │       ├── stdout → JSON 응답 (분석 결과)
    │       └── stderr → 로그 (ring buffer, 최근 50줄)
    │
    └── state management
        ├── KataGoStatus: Idle → Starting → Ready → Analyzing → ...
        ├── pending_responses: HashMap<query_id, oneshot::Sender>
        └── stdin: Arc<Mutex<ChildStdin>> (동기 쓰기)
```

**설계 결정 — `std::process` 선택 이유**:

Tauri 2.0의 `sidecar()` API와 `tokio::process`를 모두 시도한 후, `std::process::Command` + `std::thread`로 최종 결정했다:

1. **Tauri sidecar API 문제**: 번들러가 바이너리 이름에서 target triple 접미사(`-aarch64-apple-darwin`)를 제거하지만, 런타임 API는 이를 다시 추가하여 "No such file or directory" 발생
2. **tokio::process 문제**: Tauri의 async 컨텍스트에서 `tokio::process::Command::spawn()`이 panic할 수 있으며, 이 panic이 `Mutex`를 오염(poison)시킴
3. **std::process 해결**: OS 스레드 기반으로 안정적. stdout/stderr 리더는 `std::thread::spawn`으로 실행. Mutex poisoning 복구 로직도 구현.

### 4.2 상태 머신

```
Idle ──(initialize)──→ Starting ──(ready)──→ Ready ──(analyze)──→ Analyzing
  ↑                       │                    │                      │
  │                       │                    │                      │
  │                    (error)              (error)               (error)
  │                       │                    │                      │
  │                       ▼                    ▼                      ▼
  │                    Failed              Degraded               Failed
  │                       │                    │                      │
  └──(shutdown)───────────┴────────────────────┴──────────────────────┘
```

`KataGoStatus` 열거형: `Idle`, `Starting`, `Ready`, `Analyzing`, `Degraded`, `Failed`, `Restarting`, `Fallback`

### 4.3 분석 요청/응답 흐름

```
Frontend                  Rust Backend               KataGo Process
    │                         │                          │
    │── invoke('katago_analyze', query) ──→│              │
    │                         │── JSON query ──stdin──→│  │
    │                         │   (pending_responses에 oneshot 등록)
    │                         │                          │
    │                         │←── stdout ── JSON response (id 매칭)
    │                         │── oneshot::send(response) │
    │←── AnalysisResponse ────│                          │
```

쿼리 `id` 필드로 요청-응답을 매칭한다. 여러 분석 요청이 동시에 진행될 수 있으며, `pending_responses` HashMap이 각 쿼리의 응답 채널을 관리한다.

### 4.4 AI 대국 파이프라인

`useAiOpponent` 훅이 AI 대국을 관리한다:

1. 백(W) 차례 + 상태가 `playing`이면 활성화
2. **KataGo 시도**: `katago_get_status` → Ready이면 `katago_analyze` (200 visits, priority 10)
3. **폴백**: KataGo 사용 불가 시 가중 랜덤 (3선/4선 선호)
4. GTP 좌표 → 보드 인덱스 변환 → `playMove()` 호출

---

## 5. 규칙 엔진 (Rules Engine)

### 5.1 구현 방식

순수 TypeScript로 Tromp-Taylor 규칙을 구현. 130개 이상의 테스트로 검증.

| 기능 | 파일 | 설명 |
|------|------|------|
| 보드 표현 | `board.ts` | `Uint8Array` 1D 배열, GTP↔인덱스 변환 |
| 착수 규칙 | `rules.ts` | 자살 금지, 코 규칙(superko), 포석 처리 |
| 채점 | `scoring.ts` | 중국식 계가 (Chinese scoring), 영역 계산 |
| Zobrist 해싱 | `zobrist.ts` | 위치 해시로 superko 검증 + 반복 감지 |

### 5.2 IRulesEngine 인터페이스

게임 엔진은 규칙 엔진을 **직접 import하지 않는다**. 의존성 주입 패턴:

```typescript
// store.ts — 인터페이스에만 의존
let _rulesEngine: IRulesEngine | null = null

export function configureGameStore(rulesEngine: IRulesEngine): void {
  _rulesEngine = rulesEngine
}

// main.tsx — 부트스트랩 시 주입
configureGameStore(createRulesEngine())
```

이 패턴으로 테스트 시 mock 규칙 엔진을 주입할 수 있다.

---

## 6. 설명 엔진 (Explanation Engine)

### 6.1 3-Tier 아키텍처

KataGo 분석 결과를 사용자 수준에 맞는 자연어 설명으로 변환:

| Tier | 대상 | 설명 깊이 | PV 길이 |
|------|------|----------|---------|
| Beginner | 30급~15급 | 간단한 평가, 좋은/나쁜 판단 | 2수 |
| Intermediate | 15급~5단 | 수 비교, 승률 변화, 영역 분석 | 3수 |
| Advanced | 5단~ | 수치 상세, PV 전체, 정책 확률 | 5수 |

### 6.2 파이프라인

```
KataGo Response → Output Parser → Pattern Matcher → Template Engine → Explanation
                  (수치 계산)     (조건 매칭)       (슬롯 채우기)    (자연어 출력)
```

1. **Output Parser**: KataGo JSON을 `ParsedAnalysis`로 변환 — 승률%, 점수 리드, PV 포맷팅
2. **Pattern Matcher**: 조건 기반 패턴 매칭 (승률 차이, 점수 변화, 위치 카테고리)
3. **Template Engine**: 매칭된 패턴의 템플릿에 슬롯 값을 채워 최종 설명 생성
4. **Fallback**: 패턴 미매칭 시 기본 설명 생성

### 6.3 평가 레이블

승률 기반 포지션 평가:

| 승률 범위 | 레이블 |
|----------|--------|
| > 85% | decisive advantage |
| > 65% | strong advantage |
| > 55% | slight advantage |
| 45~55% | even position |
| 35~45% | slight disadvantage |
| 15~35% | significant disadvantage |
| < 15% | lost position |

---

## 7. 데이터 레이어 (Data Layer)

### 7.1 SQLite 설정

- **파일 위치**: `~/Library/Application Support/com.baduk.app/baduk.db` (macOS)
- **WAL 모드**: 읽기 동시성 확보, 쓰기 시 잠금 최소화
- **번들 빌드**: `rusqlite` `bundled` 피쳐 — 시스템 SQLite 의존성 제거
- **PK 전략**: UUID v4 (TEXT 타입)

### 7.2 스키마 (Step 7)

게임 저장, 사용자 설정, 퀘스트/업적, 분석 이력을 관리한다.

---

## 8. UI 아키텍처 (UI Architecture)

### 8.1 화면 구성

| 화면 | 파일 | 기능 |
|------|------|------|
| Home | `HomeScreen.tsx` | 메인 메뉴, 빠른 시작 |
| Quick Go | `QuickGoScreen.tsx` | 한 판 빠르게 시작 |
| Game | `GameScreen.tsx` | 대국 진행, 바둑판 + 분석 |
| Analysis | `AnalysisScreen.tsx` | 복기, 수순 탐색 |
| Settings | `SettingsScreen.tsx` | 바둑판 크기, 난이도, 언어 등 |
| Onboarding | `OnboardingScreen.tsx` | 첫 실행 안내 |

### 8.2 SVG 바둑판

`board-ui` 모듈이 SVG 기반 바둑판을 렌더링한다:

- **보드 크기**: 9×9, 13×13, 19×19
- **인터랙션**: Tap-Preview-Confirm (터치 오조작 방지)
- **오버레이**: 정책망 확률 (상위 5수), 영역 분석, 후보 수 표시

### 8.3 상태 관리

Zustand 스토어가 게임 상태의 단일 진실 소스:

- 보드 상태, 현재 플레이어, 착수 이력
- 포석 수, 패스 카운트, 코 포인트
- Zobrist 해시 히스토리 (superko 검증)
- 게임 설정 (보드 크기, 코미, 규칙, 모드)

---

## 9. 빌드 및 배포 (Build & Deploy)

### 9.1 빌드 파이프라인

```bash
# 개발 모드
cd app && npm install && npx tauri dev

# 프로덕션 빌드
cd app && npx tauri build
# → app/src-tauri/target/release/bundle/macos/Baduk.app
```

### 9.2 KataGo 바이너리 관리

KataGo 바이너리와 모델 파일은 git에 포함되지 않는다:

- **바이너리**: `src-tauri/binaries/katago-aarch64-apple-darwin` (gitignored)
- **모델**: `src-tauri/resources/models/default-model.bin.gz` (gitignored, ~87MB)

자동 업데이트 스크립트(`scripts/auto-update-katago.sh`) 또는 `/play` 명령으로 최신 버전을 설치한다.

### 9.3 CI/CD

GitHub Actions로 macOS, Windows, Linux 3개 플랫폼 빌드:

```yaml
# .github/workflows/ci.yml
matrix:
  os: [macos-latest, windows-latest, ubuntu-latest]
```

---

## 10. 다국어 지원 (i18n)

| 로케일 | 파일 | 상태 |
|--------|------|------|
| English (en) | `i18n/locales/en.json` | 기본 (English-first) |
| Korean (ko) | `i18n/locales/ko.json` | 완전 지원 |
| Japanese (ja) | `i18n/locales/ja.json` | 완전 지원 |

i18next + react-i18next 기반. 시스템 로케일 자동 감지 후, 사용자가 Settings에서 변경 가능.

---

## 11. 워크플로우 유전 (Workflow Inheritance)

이 프로젝트는 **AgenticWorkflow**(부모 유기체)로부터 태어났다. 부모의 25-step 워크플로우 파이프라인과 18개 전문 에이전트가 이 앱을 자동 설계·구현했다.

### 부모로부터 상속한 것

| 유전자 | 상속 내용 |
|--------|----------|
| **헌법** | 절대 기준 1(품질), 절대 기준 2(SOT), 절대 기준 3(CCP) |
| **구조** | 25-step Research → Planning → Implementation 파이프라인 |
| **검증** | 4계층 품질 보장 (L0-L2), pACS 자기 평가 |
| **안전** | Hook 시스템 (위험 명령 차단, 시크릿 필터, 보안 파일 감시) |
| **기억** | Context Preservation System (자동 저장·복원) |
| **비판** | @reviewer 적대적 리뷰, @fact-checker 사실 검증 |
| **투명** | SOT (state.yaml), 의사결정 로그, 검증 로그 |

### 자식 고유의 것

| 고유 요소 | 설명 |
|-----------|------|
| **KataGo 통합** | sidecar IPC, Metal GPU 가속, 난이도 조절 |
| **Tromp-Taylor 엔진** | 130+ 테스트 검증 순수 TypeScript 규칙 |
| **3-tier 설명 엔진** | 패턴 매칭 + 템플릿 기반 자연어 설명 |
| **SVG 바둑판** | 정책망 오버레이, 터치 인터랙션 |
| **KataGo 자동 업데이트** | GitHub API 체크 → 다운로드 → 빌드 자동화 |

---

## 12. 보안 고려사항 (Security)

- **KataGo IPC**: 로컬 stdin/stdout만 사용 — 네트워크 노출 없음
- **SQLite**: 앱 데이터 디렉토리에 격리 — 다른 앱 접근 불가
- **바이너리 서명**: Tauri 빌드 시 macOS 코드 서명 지원
- **모델 파일**: .gitignore로 대용량 바이너리 git 유출 방지
- **Hook 시스템**: 위험 명령 차단, 시크릿 탐지, 보안 파일 감시 (부모 DNA 상속)

---

**Built with [AgenticWorkflow](https://github.com/idoforgod/AgenticWorkflow)** — AI 에이전트 워크플로우 자동화 프레임워크
