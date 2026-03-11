# Step 8: 테스트 전략 및 품질 계획 — 바둑 플랫폼

**버전**: 1.0.0
**작성자**: @strategy-planner (Step 8)
**날짜**: 2026-03-11
**소비자**: Step 10 (scaffold), Step 11 (rules-engineer, data-engineer), Step 12 (katago-integrator), Step 13 (template-engineer), Step 14-20 (모든 구현 단계)
**입력**: Step 3 (DKS + 규칙 명세), Step 6 (아키텍처 설계), Step 7 (데이터 모델 + 인터페이스 계약)

---

## 목차

1. [전략적 TDD 분류](#1-전략적-tdd-분류)
2. [규칙 엔진 TDD 계획 — 130개 이상 테스트 카테고리](#2-규칙-엔진-tdd-계획)
3. [KataGo Bridge TDD 계획](#3-katago-bridge-tdd-계획)
4. [설명 엔진 TDD 계획](#4-설명-엔진-tdd-계획)
5. [게임 엔진 TDD 계획](#5-게임-엔진-tdd-계획)
6. [스토리지 모듈 TDD 계획](#6-스토리지-모듈-tdd-계획)
7. [게이미피케이션(gamification) 모듈 TDD 계획](#7-게이미피케이션-모듈-tdd-계획)
8. [Board-UI 및 i18n 테스트 계획](#8-board-ui-및-i18n-테스트-계획)
9. [KataGo Oracle 교차 검증 전략](#9-katago-oracle-교차-검증-전략)
10. [End-to-End 테스트 시나리오](#10-end-to-end-테스트-시나리오)
11. [테스트 인프라 및 도구](#11-테스트-인프라-및-도구)
12. [커버리지 목표](#12-커버리지-목표)
13. [pACS 자체 평가](#13-pacs-자체-평가)

---

## 1. 전략적 TDD 분류

### 1.1 TDD 철학

**TDD는 예외 없이 모든 모듈에 필수 적용된다.** 단, TDD의 방식 — 테스트 우선 vs. 구현 우선 — 은 모듈 유형에 따라 달라진다.

핵심 원칙: **테스트 없이 배포되는 코드는 없다.** 테스트 우선과 구현 우선의 차이는 설계 산출물의 순서에만 영향을 미칠 뿐, 커버리지 요건에는 영향을 주지 않는다.

### 1.2 모듈 분류 매트릭스

| 모듈 | TDD 방식 | 근거 | 커버리지 목표 |
|--------|----------|-----------|-----------------|
| `rules-engine` | **테스트 우선** | 수학적 정확성은 타협 불가능하다. DKS 명세의 모든 규칙은 구현 코드 작성 전에 테스트로 먼저 정의된다. 단 하나의 잘못된 엣지 케이스(예: 패(ko) 감지, 따냄(capture) 순서)도 게임 무결성을 훼손한다. | 모든 규칙 구현의 분기 커버리지 100% |
| `katago-bridge` | **테스트 우선** | IPC 신뢰성은 통합 전에 증명되어야 한다. 서킷 브레이커(circuit breaker) 상태 전이, 감시자(watchdog) 동작, 타임아웃 처리는 모두 상태 머신(State Machine) 동작으로, 테스트 우선으로 기술하기에 가장 적합하다. | 생명주기 상태의 분기 커버리지 95% 이상 |
| `explanation-engine` | **테스트 우선** | 패턴 매칭 파이프라인은 결정론적이다: 입력 X가 주어지면 출력 Y는 예측 가능해야 한다. 테스트 우선 방식은 90개 패턴 카탈로그의 커버리지 공백을 런타임 문제가 되기 전에 드러낸다. | 동작 커버리지 90% 이상 (90개 패턴 전체 실행) |
| `storage` | **테스트 우선** | 인터페이스 계약은 Step 7 (IStoragePort)에서 완전히 명세된다. 모든 메서드에는 정의된 에러 코드가 있다. 이 계약을 먼저 테스트로 작성하면 스토리지 계층 버그가 게임 엔진 로직으로 전파되는 것을 방지한다. | 라인 커버리지 95% 이상 |
| `core` | **테스트 우선** | 유틸리티 함수(GTP 변환, Zobrist 해싱, 좌표 계산)는 순수 함수다. 테스트 우선은 매우 쉽고, 이를 하지 않을 경우의 비용은 모든 의존 모듈에서 무음 데이터 오염으로 나타난다. | 라인 커버리지 100% |
| `game-engine` | **구현 우선 (제한적)** | 게임 엔진은 `rules-engine`, `storage`, Zustand 상태 저장소를 통합한다. 그 동작은 이 의존성들 간의 상호작용에 크게 영향을 받는다. 처음부터 세 가지 모두를 mock하면 동작이 아닌 mock을 검증하는 테스트가 만들어진다. 뼈대 구현 → 통합 테스트 → 독립 로직(타이머, 리듀서 액션)에 대한 단위 테스트 순으로 진행한다. | 라인 커버리지 85% 이상 |
| `gamification` | **구현 우선 (제한적)** | 퀘스트 트리거와 업적 해제 로직은 게임 이벤트에 의존하며, 이는 다시 동작하는 게임 엔진에 의존한다. 데이터 모델과 XP 공식을 먼저 작성한 후 서비스 구현에 대한 테스트를 작성한다. | 라인 커버리지 85% 이상 |
| `board-ui` | **비주얼 우선 (Storybook 주도)** | SVG 렌더링은 시각적 하네스 없이는 의미 있는 단위 테스트가 불가능하다. Storybook 컴포넌트 스토리가 명세로 기능한다. 상호작용 테스트(클릭, 호버)에는 React Testing Library를 사용한다. 수학적 헬퍼(좌표 변환)는 단위 테스트한다. | 상호작용에는 React Testing Library; 비주얼 검토는 Storybook |
| `i18n` | **구성 주도** | 번역 완전성은 도구(i18next-parser 누락 키 감지)로 확인하며, 단위 테스트로 확인하지 않는다. 통합 테스트로 로케일 전환이 E2E로 동작함을 검증한다. | CI 도구로 번역 키 커버리지 강제 |
| `analytics` | **어댑터 전용** | 분석 로직은 서드파티 SDK에 있다. 어댑터는 얇은 래퍼다. 어댑터가 이벤트를 올바르게 전달하고 동의 플래그를 준수하는지 테스트한다. | 어댑터 코드의 라인 커버리지 80% 이상 |

### 1.3 테스트 우선 모듈 설계 워크플로우

**테스트 우선 모듈** (`rules-engine`, `katago-bridge`, `explanation-engine`, `storage`, `core`):

```
Phase 0: Read interface contract (Step 7 interfaces.ts)
    |
    v
Phase 1: Write test file skeleton (describe blocks, test names only)
    |
    v
Phase 2: Implement failing tests (assertions without implementation)
    |
    v
Phase 3: Run tests — all fail (confirms tests are real, not vacuous)
    |
    v
Phase 4: Implement production code until all tests pass
    |
    v
Phase 5: Refactor with tests as safety net
    |
    v
Phase 6: Add edge-case tests discovered during implementation
```

Step 11의 rules-engineer와 data-engineer는 이 프로토콜을 따른다. TDD 가드 Hook (`block_test_file_edit.py`)은 Phase 2-3 동안 활성화되어 구현 우선 작성을 방지한다.

---

## 2. 규칙 엔진 TDD 계획

### 2.1 개요

규칙 엔진(`src/engine/rules/`)은 Tromp-Taylor 규칙을 순수 TypeScript 함수로 구현한다. **외부 의존성이 전혀 없으며**(오직 `core` 타입만 사용), 시스템에서 가장 테스트하기 좋은 모듈이다 — 모든 테스트가 결정론적이고, 빠르며, mock이 필요 없다.

**테스트 프레임워크**: Vitest
**테스트 파일 위치**: `src/engine/rules/__tests__/`
**테스트 대상 인터페이스**: `IRulesEngine` (Step 7, 9개 메서드)

### 2.2 카테고리 1: 바둑판 생성 (8개 테스트)

**메서드**: `createBoard(size: BoardSize): BoardState`

| # | 테스트명 | 입력 | 기대 출력 | 규칙 |
|---|-----------|-------|-----------------|------|
| 1.01 | create-9x9-board | size=9 | grid.length=81, all zeros, hash=0n | DKS C13, E01 |
| 1.02 | create-13x13-board | size=13 | grid.length=169, all zeros | DKS C01 |
| 1.03 | create-19x19-board | size=19 | grid.length=361, all zeros | DKS C01 |
| 1.04 | initial-player-is-black | createBoard(9) | GameState.currentPlayer = "B" | DKS C14 |
| 1.05 | initial-hash-is-zero | createBoard(9) | board.hash = 0n | DKS R31 |
| 1.06 | initial-ko-point-is-null | createBoard(9) | board.koPoint = null | DKS E67 |
| 1.07 | initial-captures-zero | createBoard(9) | capturedByBlack=0, capturedByWhite=0 | DKS E33 |
| 1.08 | invalid-board-size-throws | size=7 | Error: INVALID_BOARD_SIZE | DKS C01 |

### 2.3 카테고리 2: 돌 착수 — 기본 유효성 검사 (22개 테스트)

**메서드**: `isLegalMove(state: GameState, index: number): boolean`
**메서드**: `applyMove(state: GameState, index: number): Result<GameState, RulesError>`

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 2.01 | place-on-empty-center | 빈 바둑판, 중앙에 착수 | 합법 | TT Rule 7 |
| 2.02 | place-on-empty-corner-9x9 | 인덱스 0(귀)에 착수 | 합법 | TT Rule 7 |
| 2.03 | place-on-empty-edge | 변 교차점(intersection)에 착수 | 합법 | TT Rule 7 |
| 2.04 | reject-occupied-black | 흑돌이 있는 위치에 착수 | OCCUPIED_INTERSECTION | DKS C06 |
| 2.05 | reject-occupied-white | 백돌이 있는 위치에 착수 | OCCUPIED_INTERSECTION | DKS C06 |
| 2.06 | reject-negative-index | index = -1 | INVALID_INDEX | DKS C02 |
| 2.07 | reject-index-too-large | 19x19에서 index = 361 | INVALID_INDEX | DKS C02 |
| 2.08 | black-plays-first | 새 게임 상태 | currentPlayer가 "B"로 시작 | DKS C14 |
| 2.09 | alternation-black-then-white | 흑 착수 후 | currentPlayer가 "W"로 전환 | DKS C07 |
| 2.10 | alternation-white-then-black | 백 착수 후 | currentPlayer가 "B"로 전환 | DKS C07 |
| 2.11 | move-count-increments | 임의 착수 | moveNumber 1 증가 | DKS E41 |
| 2.12 | board-state-is-immutable | applyMove 후 | 원본 상태 변경 없음 | Immutability |
| 2.13 | place-returns-new-state | applyMove 반환값 | 돌이 놓인 새 GameState | DKS R25 |
| 2.14 | placed-stone-color-correct | 흑이 인덱스 40에 착수 | grid[40] = 1 (BLACK) | DKS E09 |
| 2.15 | placed-stone-white-color | 백이 인덱스 40에 착수 | grid[40] = 2 (WHITE) | DKS E09 |
| 2.16 | get-legal-moves-empty-board | 빈 9x9 바둑판 | 81개 인덱스 전체 반환 | TT Rule 7 |
| 2.17 | get-legal-moves-excludes-occupied | 3개 돌이 있는 바둑판 | 78개 인덱스 반환 | DKS C06 |
| 2.18 | reject-move-after-game-ended | GameState.phase = "finished" | GAME_ALREADY_ENDED | DKS C17 |
| 2.19 | adjacency-table-corner | 귀 인덱스 이웃 | 정확히 2개 이웃 | DKS E07 |
| 2.20 | adjacency-table-edge | 변 인덱스 이웃 | 정확히 3개 이웃 | DKS E07 |
| 2.21 | adjacency-table-interior | 내부 인덱스 이웃 | 정확히 4개 이웃 | DKS E07 |
| 2.22 | gtp-to-index-round-trip | 9x9에서 "D4" | index → gtp → index = 원본 | DKS utility |

### 2.4 카테고리 3: 따냄 메커니즘 — 단일 돌 (15개 테스트)

**메서드**: `applyMove`, `getGroup`, `applyMove` 내부 따냄 감지

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 3.01 | capture-single-stone-4-surround | 사방으로 상대 돌 포위 | 돌 제거, 따냄 수 +1 | TT Rule 4 |
| 3.02 | capture-single-corner-stone | 2수로 귀 돌 따냄 | 돌 제거 | TT Rule 4 |
| 3.03 | capture-single-edge-stone | 3수로 변 돌 따냄 | 돌 제거 | TT Rule 4 |
| 3.04 | capture-triggers-hash-update | 따냄 발생 | 바둑판 해시 변경 | DKS R38 |
| 3.05 | capture-count-increments | 백이 흑돌 1개 따냄 | capturedByWhite = 1 | DKS E33 |
| 3.06 | captured-stone-becomes-empty | 따냄 후 | grid[capturedIndex] = 0 | TT Rule 4 |
| 3.07 | stone-with-liberty-not-captured | 돌에 활로(liberty) 1개 남음 | 돌 유지 | TT Rule 3 |
| 3.08 | capture-before-self-capture | 따냄과 자충(suicide)이 동시 발생 | 상대 먼저 따냄 | TT Rule 7 (순서) |
| 3.09 | capture-creates-new-liberty | 따냄으로 빈 공간 생성 | 놓인 돌이 활로 획득 | TT Rule 7 |
| 3.10 | last-liberty-fill-triggers-capture | 1개 돌 무리의 마지막 활로 채움 | 무리 따냄 | TT Rule 4 |
| 3.11 | partial-surround-no-capture | 4개 활로 중 3개 채움 | 돌 미따냄 | TT Rule 3 |
| 3.12 | capture-updates-captured-cells | 따냄 후 | 모든 따낸 인덱스 = 0 | TT Rule 4 |
| 3.13 | capture-large-group-all-removed | 5개 돌 무리 포위 | 5개 돌 전부 제거 | TT Rule 4 |
| 3.14 | capture-multiple-groups-simultaneously | 2개 별도 상대 무리 동시 제거 | 두 무리 모두 제거 | TT Rule 4 |
| 3.15 | capture-returns-indices-in-result | applyMove 결과값 | captures[]에 올바른 인덱스 포함 | IGameEngine |

### 2.5 카테고리 4: 따냄 메커니즘 — 다중 무리 (12개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 4.01 | capture-two-groups-one-move | 1수로 분리된 2개 상대 무리 제거 | 두 무리 모두 제거 | TT Rule 4 |
| 4.02 | capture-three-groups-one-move | 1수로 3개 분리 무리 제거 | 3개 무리 전체 제거 | TT Rule 4 |
| 4.03 | capture-L-shaped-group | L자형 4개 돌 무리 따냄 | 4개 돌 전부 제거 | TT Rule 4 |
| 4.04 | capture-line-group-5-stones | 일렬 5개 돌 무리 따냄 | 5개 돌 전부 제거 | TT Rule 4 |
| 4.05 | snapback-is-legal-EC02 | 환격(snapback) 위치 (EC-02) | 따냄과 재따냄 모두 합법 | DKS EC-02 |
| 4.06 | snapback-not-flagged-as-ko | 환격 따냄 후 | koPoint는 null 유지 | DKS EC-02 |
| 4.07 | group-merge-on-placement | 두 개의 별도 아군 무리 연결 | 단일 병합 무리 생성 | TT Rule 7 |
| 4.08 | group-split-impossible | 무리 분리 불가 | (구조적 불변) | TT Rule 7 |
| 4.09 | capture-in-corner-complex | 복잡한 귀 따냄 시나리오 | 올바른 돌 제거 | TT Rule 4 |
| 4.10 | capture-updates-liberty-counts | 다중 무리 따냄 후 | 남은 무리의 활로 수 업데이트 | TT Rule 3 |
| 4.11 | capture-large-group-20-stones | L자형 감싸기 (19x19) | 20개 돌 전부 제거 | TT Rule 4 |
| 4.12 | capture-all-stones-leaves-empty | 상대 돌 전부 따냄 | 바둑판에 자신의 돌만 남음 | TT Rule 4 |

### 2.6 카테고리 5: 자충(Self-Capture) (10개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 5.01 | suicide-single-stone-surrounded | 활로 0인 위치에 착수 | 돌 착수 후 제거 | TT Rule 7 step 3 |
| 5.02 | suicide-creates-empty-board-state | 상대 영역에 단일 돌 자충 | 이전 상태 복원 → 초과패(superko) 위반 | DKS EC-13 |
| 5.03 | suicide-multi-stone-legal | 무리 자충으로 새로운 바둑판 상태 생성 | 허용 (초과패 위반 없음) | DKS EC-13 |
| 5.04 | suicide-after-capture-impossible | 상대를 따낸 후 살아 있는 착수 | 자충 아님 (따낸 돌이 활로 제공) | TT Rule 7 step ordering |
| 5.05 | connect-and-die-EC11 | 연결하면 죽음(connect-and-die) — 합쳐진 무리의 활로가 0 | 합쳐진 무리 제거 | DKS EC-11 |
| 5.06 | suicide-hash-check | 이전 위치를 재현하는 자충 | 초과패로 거부 | DKS EC-13 |
| 5.07 | suicide-count-tracked | 자충 후 | capturedByOpponent 증가 (돌 제거) | TT Rule 7 |
| 5.08 | two-stone-suicide | 착수 후 활로 0인 2개 돌 무리 | 두 돌 모두 제거 | TT Rule 7 |
| 5.09 | legal-moves-excludes-pure-suicide | 자충 위치가 있는 바둑판에서 getLegalMoves() | 초과패 위반 시 순수 자충 제외 | TT Rule 7 |
| 5.10 | suicide-in-corner-single | 상대 돌에 둘러싸인 귀 | 자충: 돌 제거 | TT Rule 7 |

### 2.7 카테고리 6: 단순 패(Ko) 감지 (15개 테스트)

**Board.koPoint 최적화 (DKS EC-01, Section 4.7)**

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 6.01 | simple-ko-point-set-after-capture | 흑이 백돌 1개 따냄, 패 형성 | koPoint = 따낸 돌의 인덱스 | DKS EC-01 |
| 6.02 | simple-ko-white-cannot-recapture | 패 후 백이 즉시 재따냄 시도 | KO_VIOLATION | DKS EC-01 |
| 6.03 | simple-ko-clears-after-pass | 패 후 흑이 패스 | koPoint = null | DKS Section 4.7 |
| 6.04 | simple-ko-clears-after-move-elsewhere | 패 후 흑이 다른 곳에 착수 | koPoint = null | DKS Section 4.7 |
| 6.05 | simple-ko-white-can-play-after-clear | 패 해소 후 백이 해소된 패 위치에 착수 | 합법 | DKS EC-01 |
| 6.06 | ko-conditions-single-stone-capture | 다중 돌 따냄 | koPoint 미설정 (단순 패 아님) | DKS Section 4.7 |
| 6.07 | ko-conditions-single-stone-placing | 착수 돌이 활로 1개 이상 보유 | koPoint 미설정 | DKS Section 4.7 |
| 6.08 | ko-conditions-group-size-1 | 따냄하는 돌의 무리 크기 > 1 | koPoint 미설정 | DKS Section 4.7 |
| 6.09 | double-ko-EC03 | 독립적인 두 패 형 | 두 패 모두 초과패로 올바르게 추적 | DKS EC-03 |
| 6.10 | ko-point-not-in-legal-moves | 활성 패가 있는 상태에서 getLegalMoves() | 패 위치 제외 | DKS EC-01 |
| 6.11 | pass-for-ko-EC15 | 패 싸움에서 전략적 패스 | 패스 후 이전 제한은 초과패에 의존 | DKS EC-15 |
| 6.12 | ko-black-captures-ko-shape | 흑이 패를 올바르게 인식하고 koPoint 설정 | koPoint = 비워진 인덱스 | DKS EC-01 |
| 6.13 | ko-survives-to-next-turn | 한 턴 동안 koPoint 유지 | koPoint 여전히 설정됨 | DKS EC-01 |
| 6.14 | snapback-no-ko-point | 환격: 다중 돌 따냄 | koPoint = null | DKS EC-02 |
| 6.15 | ko-both-players-alternating | 백 패, 흑 응수, 백 재따냄 시도 | 각 단계에서 올바른 합법성 | DKS EC-01 |

### 2.8 카테고리 7: 위치적 초과패(Positional Superko) (12개 테스트)

**Zobrist 해싱 + Set<bigint> 이력 (DKS Section 4, Rule 6)**

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 7.01 | zobrist-initial-hash-zero | 빈 바둑판 | hash = 0n | DKS Section 4.2 |
| 7.02 | zobrist-hash-changes-on-placement | 돌 착수 | hash가 0n에서 변경 | DKS Section 4.5 |
| 7.03 | zobrist-incremental-equals-full | 점진적 계산 vs. 전체 재계산 | 동일한 bigint | DKS Section 4.4-4.5 |
| 7.04 | zobrist-capture-xor-reverses | 돌 착수 후 따냄 | hash가 착수 전 값으로 복귀 | DKS Section 4.5 (XOR 특성) |
| 7.05 | hash-stored-in-history | 각 착수 후 | positionHashes에 새 해시 포함 | DKS Section 4.6 |
| 7.06 | superko-violation-rejected | 이전 위치 재현 착수 | SUPERKO_VIOLATION | TT Rule 6 |
| 7.07 | simple-ko-covered-by-superko | 단순 패 재따냄 | SUPERKO_VIOLATION (KO_VIOLATION도 해당) | TT Rule 6 |
| 7.08 | triple-ko-EC04 | 삼패(triple ko) 위치 | 반복된 위치 모두 거부 | DKS EC-04 |
| 7.09 | eternal-ko-EC05 | 만년패(eternal ko) 위치 | 초과패로 순환 차단 | DKS EC-05 |
| 7.10 | sending-two-returning-one-EC14 | 복잡한 순환 위치 | 포지션 해시 비교로 순환 방지 | DKS EC-14 |
| 7.11 | history-grows-with-game | 100수 진행 | positionHashes.size >= 100 | DKS Section 4.6 |
| 7.12 | suicide-superko-rejected | 단일 돌 자충으로 이전 상태 재현 | SUPERKO_VIOLATION | DKS EC-13 |

### 2.9 카테고리 8: 계가(Scoring) 알고리즘 (22개 테스트)

**메서드**: `computeScore(board: BoardState, komi: number): ScoreResult`
**메서드**: `getTerritory(board: BoardState): TerritoryMap`

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 8.01 | empty-board-score-white-wins-by-komi | 빈 바둑판, komi=7.5 | 백이 7.5점 차로 승 | TT Rule 9, 10 |
| 8.02 | all-black-stones-score | 9x9 전체 흑 | 흑=81, 백=0+komi | TT Rule 9 |
| 8.03 | single-black-stone-territory | 빈 9x9 중앙에 흑돌 1개 | 흑 집(territory) = 81-1 = 80 (모두 흑에 접함) | TT Rule 9 |
| 8.04 | territory-classification-black | 흑에만 인접한 빈 영역 | 흑의 집으로 계산 | TT Rule 9 |
| 8.05 | territory-classification-white | 백에만 인접한 빈 영역 | 백의 집으로 계산 | TT Rule 9 |
| 8.06 | dame-classification | 양색 모두에 접한 빈 영역 | 공배(dame) (어느 쪽에도 불산입) | TT Rule 9 |
| 8.07 | all-points-accounted-for | 임의 바둑판 | blackScore + whiteScore + dame = size^2 | DKS C18 |
| 8.08 | komi-7-5-applied | 표준 덤(Komi) | 백 점수에 +7.5 포함 | TT Rule 10 |
| 8.09 | komi-5-5-applied | 9x9 덤 | 백 점수에 +5.5 포함 | TT Rule 10 |
| 8.10 | integer-komi-tie-possible | komi=7, 동일 영역 | 무승부(jigo): result="0" | TT Rule 10 |
| 8.11 | black-wins-by-margin | 흑이 8점 더 많음 | result = "B+8" | TT Rule 10 |
| 8.12 | white-wins-by-margin | 백이 3.5점 더 많음 (덤) | result = "W+3.5" | TT Rule 10 |
| 8.13 | seki-scoring-EC07 | 기본 빅(seki) 위치 | 빅 돌은 소유자에게 귀속; 공유 활로 = 공배 | DKS EC-07 |
| 8.14 | seki-dame-not-territory | 빅에서의 공유 활로 | 공배로 분류 | DKS EC-07 |
| 8.15 | full-board-no-territory | 모든 교차점 점유 | 점수 = 돌 수 + 덤 | TT Rule 9 |
| 8.16 | territory-bfs-completeness | 복잡한 다중 영역 바둑판 | 모든 빈 영역 정확히 1회 방문 | TT Rule 9 |
| 8.17 | corner-territory | 흑이 4개 귀 봉쇄 | 4개 귀 = 흑의 집 | TT Rule 9 |
| 8.18 | dead-stones-count-as-opponent-territory | 제거되지 않은 죽은 돌(Tromp-Taylor) | 상대 집이 아닌 자신의 색으로 계산 | DKS Section 5.5 |
| 8.19 | score-result-object-complete | computeScore 반환값 | ScoreResult의 9개 필드 모두 채워짐 | IExplanationEngine |
| 8.20 | chinese-area-scoring-not-territory | 중국식 집 계산(area scoring)은 바둑판 위 돌 포함 | 집만 계산하는 것이 아닌 돌 + 집 | TT Rule 9 |
| 8.21 | two-eyes-alive-scoring | 두 눈 보유 무리, 따냄 불필요 | 소유자에게 돌 산입 | DKS EC-09 |
| 8.22 | bent-four-corner-EC08 | 귀의 굽은 사궁(bent four in corner) (Tromp-Taylor) | 실전 진행, 자동 사망 선언 없음 | DKS EC-08 |

### 2.10 카테고리 9: 게임 흐름 (12개 테스트)

**메서드**: `applyPass`, `isGameOver`, `computeScore`

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 9.01 | pass-does-not-change-board | 임의 상태에서 applyPass | board.grid 변경 없음 | TT Rule 8 |
| 9.02 | pass-changes-player | 흑이 패스 | currentPlayer가 "W"로 전환 | TT Rule 5 |
| 9.03 | pass-increments-consecutive-passes | 첫 패스 | consecutivePasses = 1 | TT Rule 8 |
| 9.04 | move-resets-consecutive-passes | 패스 후 착수 | consecutivePasses = 0 | TT Rule 8 |
| 9.05 | two-consecutive-passes-end-game | 흑 패스, 백 패스 | isGameOver() = true | TT Rule 8 |
| 9.06 | game-not-over-after-one-pass | 1회 패스 | isGameOver() = false | TT Rule 8 |
| 9.07 | game-not-over-pass-move-pass | 패스, 착수, 패스 패턴 | isGameOver() = false | TT Rule 8 |
| 9.08 | pass-on-empty-board-legal-EC18 | 빈 바둑판에서 패스 | 합법 | DKS EC-18 |
| 9.09 | double-pass-empty-board-ends-game | 빈 바둑판에서 2회 연속 패스 | 게임 종료, 백이 덤으로 승 | DKS EC-18 |
| 9.10 | full-board-forces-pass-EC19 | 모든 교차점 점유 | 합법 착수 없음, 양쪽 모두 패스 필요 | DKS EC-19 |
| 9.11 | resign-ends-game | resignGame(player) | 상대방 승리 GameResult | TT (관례) |
| 9.12 | no-move-after-game-ends | Phase = "finished" | GAME_ALREADY_ENDED | DKS C17 |

### 2.11 카테고리 10: 무리(Group) 연산 (10개 테스트)

**메서드**: `getGroup(board, index)`, `getTerritory(board)`

| # | 테스트명 | 시나리오 | 기대 결과 | 규칙 |
|---|-----------|----------|----------|------|
| 10.01 | get-group-single-stone | 고립된 돌 | 크기 1의 무리 | DKS E15 |
| 10.02 | get-group-connected-chain | 5개 연결된 돌(chain) | 크기 5 무리, 올바른 활로 | DKS E15 |
| 10.03 | get-group-l-shaped | L자형 무리 | 모든 돌이 단일 무리에 포함 | DKS E15 |
| 10.04 | get-group-liberties-count | 활로 3개인 돌 | liberties.size = 3 | DKS E18 |
| 10.05 | get-group-corner-liberties | 귀의 돌 | liberties.size = 2 | DKS E18 |
| 10.06 | get-group-returns-null-empty | 빈 교차점에 getGroup 실행 | null 반환 | IRulesEngine spec |
| 10.07 | groups-not-connected-diagonally | 대각선 위치의 돌 | 두 개의 별도 무리 | DKS E06 |
| 10.08 | atari-detection | 활로 1개인 무리 | liberties.size = 1 (단수(atari)) | DKS E19 |
| 10.09 | territory-map-complete | 바둑판에서 getTerritory 실행 | TerritoryMap.black + white + dame = 전체 빈 점 | DKS E27-E28 |
| 10.10 | get-group-index-out-of-bounds | 9x9에서 인덱스 999 | null 또는 Error | IRulesEngine spec |

### 2.12 카테고리 11: 엣지 케이스 대백과 테스트 (40개 테스트)

이 테스트들은 Step 3 Section 6에 정의된 20개 엣지 케이스와 직접 대응한다. 각 엣지 케이스는 최소 2개의 테스트(설정 및 해소)로 구성된다.

| # | 엣지 케이스 | 테스트 | 기대 결과 |
|---|-----------|------|----------|
| 11.01 | EC-01 단순 패 설정 | 기본 패 위치 생성 | koPoint 올바르게 설정 |
| 11.02 | EC-01 단순 패 강제 | 즉각적인 재따냄 시도 | KO_VIOLATION |
| 11.03 | EC-02 환격 따냄 | 환격 위치에서 따냄 | 합법적 따냄 |
| 11.04 | EC-02 환격 재따냄 | 환격 후 재따냄 | 합법 (패 아님) |
| 11.05 | EC-03 쌍패(double ko) 위치 | 두 패 위치 설정 | 초과패로 두 패 모두 추적 |
| 11.06 | EC-03 쌍패 순환 차단 | 두 패 순환 시도 | SUPERKO_VIOLATION으로 순환 종료 |
| 11.07 | EC-04 삼패 설정 | 세 개의 독립적 패 형 | 모두 초과패로 추적 |
| 11.08 | EC-04 삼패 소진 | 세 패 모두 순환 | SUPERKO_VIOLATION |
| 11.09 | EC-05 만년패 설정 | 4개 이상 돌 순환 잡수 위치 | 순환으로 올바르게 식별 |
| 11.10 | EC-05 만년패 초과패 | 순환 차단 착수 감지 | SUPERKO_VIOLATION |
| 11.11 | EC-06 사패(quadruple ko) | 네 개의 패 형 | 초과패로 모두 처리 |
| 11.12 | EC-06 사패 순환 차단 | 네 패 모두 순환 | SUPERKO_VIOLATION |
| 11.13 | EC-07 기본 빅 | 2개 활로를 공유하는 두 무리 | 두 무리 모두 살아 있음 |
| 11.14 | EC-07 빅 공배 계가 | 빅에서의 공유 활로 | 공배로 분류 |
| 11.15 | EC-07 삼자 빅 | 세 무리의 상호 생존 | 세 무리 모두 살아 있음 |
| 11.16 | EC-08 귀의 굽은 사궁 (Tromp-Taylor) | 귀의 굽은 사궁 — 자동 사망 없음 | 실전으로 진행 필요 |
| 11.17 | EC-08 굽은 사궁 패 위협 | 수비 측이 패를 실전으로 진행 | 위협이 있으면 무리 생존 가능 |
| 11.18 | EC-09 두 눈 생존 | 진눈(true eye) 2개 보유 무리 | 따냄 불가 |
| 11.19 | EC-09 두 눈 무리 따냄 시도 | 눈 채우기 시도 | 눈 위치 착수 = 자충 → 초과패로 거부 |
| 11.20 | EC-10 거짓눈(false eye) 설정 | 거짓눈 위치 | 눈 채우기 가능 |
| 11.21 | EC-10 거짓눈 따냄 | 상대가 거짓눈 채움 | 무리가 눈 잃고 따낼 수 있게 됨 |
| 11.22 | EC-11 연결하면 죽음 | 연결로 활로 0인 무리 생성 | 합쳐진 무리 제거 |
| 11.23 | EC-11 떼냄(uttegaeshi) 위치 | 전형적인 연결하면 죽음 형 | 올바른 따냄 동작 |
| 11.24 | EC-12 수상전(semeai) 설정 | 두 인접 무리의 수상전 | 활로 수로 승자 결정 |
| 11.25 | EC-12 수상전 해소 | 수상전 완전 진행 | 활로가 적은 무리 따냄 |
| 11.26 | EC-13 단일 돌 자충 | 포위된 위치에 단일 돌 착수 | 돌 착수 후 제거 |
| 11.27 | EC-13 자충 초과패 | 이전 상태 재현 자충 | SUPERKO_VIOLATION |
| 11.28 | EC-13 다중 돌 자충 새 상태 | 새로운 위치 생성하는 다중 돌 자충 | 합법 |
| 11.29 | EC-14 이석환일(sending-two-returning-one) | 전형적 4수 순환 | 순환 후 SUPERKO_VIOLATION |
| 11.30 | EC-14 장기 순환 6수 | 6수 위치 순환 | SUPERKO_VIOLATION |
| 11.31 | EC-15 패를 위한 패스 | 패 싸움에서 전략적 패스 | 패스 후 바둑판 해시 불변 |
| 11.32 | EC-15 패스 후 패 위치 | 전략적 패스 후 | 패 확인은 여전히 전체 이력 사용 |
| 11.33 | EC-16 무리 생명주기 | 돌 착수 → 무리 성장 → 따냄 | 각 단계에서 올바른 상태 |
| 11.34 | EC-16 따냄 수 추적 | 게임 전반의 다중 따냄 | captureCount 정확히 추적 |
| 11.35 | EC-17 귀 교차점 이웃 2개 | 귀 인덱스 | adjacencyTable[0].length = 2 |
| 11.36 | EC-17 변 교차점 이웃 3개 | 변 인덱스 | adjacencyTable[9].length = 3 |
| 11.37 | EC-18 빈 바둑판 패스 | 빈 바둑판에서 패스 | 합법, consecutivePasses = 1 |
| 11.38 | EC-18 빈 바둑판 연속 패스 | 2회 연속 패스, 빈 바둑판 | 게임 종료, 백이 덤으로 승 |
| 11.39 | EC-19 꽉 찬 바둑판 합법 착수 없음 | 361개 교차점 전부 점유 | getLegalMoves() 반환값 [] |
| 11.40 | EC-20 월광생(moonshine life) | 표준 규칙으로 올바르게 처리 | 별도 코드 불필요; 표준 규칙으로 무리 살아 있음 |

**카테고리 11 총 테스트 수**: 40개

### 2.13 규칙 엔진 테스트 수 요약

| 카테고리 | 수량 |
|----------|-------|
| 바둑판 생성 | 8 |
| 돌 착수 — 기본 유효성 검사 | 22 |
| 따냄 메커니즘 — 단일 돌 | 15 |
| 따냄 메커니즘 — 다중 무리 | 12 |
| 자충(Self-Capture) | 10 |
| 단순 패 감지 | 15 |
| 위치적 초과패 | 12 |
| 계가 알고리즘 | 22 |
| 게임 흐름 | 12 |
| 무리 연산 | 10 |
| 엣지 케이스 대백과 | 40 |
| **합계** | **178** |

**178개 테스트 카테고리 정의 — 130개 이상 요건을 37% 초과 충족.**

### 2.14 규칙 엔진의 Mock 전략

**Mock 불필요.** 규칙 엔진은 외부 의존성이 전혀 없는 순수 함수다. 모든 테스트는 다음을 대상으로 동작한다:
- 인메모리 데이터베이스 `BoardState` 객체 (Uint8Array)
- 미리 구성된 `GameState` 픽스처
- 파일 I/O, 네트워크, Tauri IPC 없음

**테스트 데이터 픽스처** (`__tests__/fixtures/`):
- `empty-9x9.ts`, `empty-13x13.ts`, `empty-19x19.ts` — 빈 바둑판 상태
- `ko-positions.ts` — EC-01~EC-06용 미리 구성된 패 위치
- `seki-positions.ts` — EC-07용 빅 위치
- `scoring-positions.ts` — 카테고리 8용 점수 계산 종반 위치
- `edge-cases.ts` — 모든 20개 DKS 엣지 케이스의 바둑판 픽스처

---

## 3. KataGo Bridge TDD 계획

### 3.1 개요

`katago-bridge` 모듈(`src/engine/katago/`)은 외부 OS 프로세스를 관리한다. 이를 테스트하려면 어댑터를 신중하게 교체해야 한다. **프로덕션 어댑터**(`KataGoSidecarAdapter`)는 실제 KataGo 바이너리 없이는 단위 테스트가 불가능하므로, 설계에서 어댑터 주입(adapter injection)을 사용한다.

**테스트 프레임워크**: Vitest
**테스트 파일 위치**: `src/engine/katago/__tests__/`
**테스트 대상 인터페이스**: `IKatagoBridge` (Step 7, 12개 메서드)

### 3.2 테스트용 어댑터 전략

| 테스트 유형 | 사용 어댑터 | 테스트 대상 |
|-----------|-------------|----------------|
| 단위 테스트 | `MockKataGoAdapter` | 상태 머신 로직, 서킷 브레이커, 큐 관리 |
| 통합 테스트 | `MockKataGoAdapter` | 사전 기록된 응답으로 완전한 analyze() 왕복 |
| Sidecar 테스트 (CI 선택 사항) | `KataGoSidecarAdapter` | 실제 바이너리 시작 및 버전 조회 (KataGo 설치 필요) |

### 3.3 카테고리 1: 생명주기 상태 머신 (15개 테스트)

| # | 테스트명 | 초기 상태 | 동작 | 기대 상태 |
|---|-----------|--------------|--------|----------------|
| K.01 | initial-state-idle | — | 생성 | `Idle` |
| K.02 | initialize-transitions-to-starting | `Idle` | `initialize()` 호출 | `Starting` |
| K.03 | successful-init-transitions-to-ready | `Starting` | 버전 조회 성공 | `Ready` |
| K.04 | failed-init-transitions-to-failed | `Starting` | 바이너리 없음 | `Failed` |
| K.05 | analyze-transitions-to-analyzing | `Ready` | `analyze()` 호출 | `Analyzing` |
| K.06 | analyze-complete-returns-to-ready | `Analyzing` | 응답 수신 | `Ready` |
| K.07 | analyze-failure-increments-circuit-breaker | `Ready` | `analyze()` 실패 | 실패 횟수 +1 |
| K.08 | circuit-breaker-opens-after-5-failures | `Ready` | 5회 연속 실패 | `Degraded`, CB 오픈 |
| K.09 | circuit-breaker-analyze-rejected-when-open | `Degraded` | `analyze()` | CIRCUIT_BREAKER_OPEN |
| K.10 | circuit-breaker-half-open-after-timeout | `Degraded` | 10분 경과 | `Degraded` (half-open) |
| K.11 | crash-detected-by-watchdog | `Ready` | 프로세스 예기치 않게 종료 | `Restarting` |
| K.12 | restart-attempts-limit | `Restarting` | 3회 재시작 실패 | `Failed` |
| K.13 | shutdown-transitions-to-idle | `Ready` | `shutdown()` | `Idle` |
| K.14 | get-status-reflects-current-state | 임의 상태 | `getStatus()` | 올바른 KataGoStatus |
| K.15 | is-healthy-true-only-when-ready | `Ready` | `isHealthy()` | true |

### 3.4 카테고리 2: 분석 IPC (10개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| K.16 | analyze-sends-correct-json | 유효한 쿼리로 analyze() | 필수 필드 모두 포함된 JSON 라인 |
| K.17 | analyze-parses-response | Mock이 유효한 JSON 응답 반환 | 올바른 타입의 AnalysisResponse |
| K.18 | analyze-validates-response-schema | Mock이 잘못된 JSON 반환 | INVALID_RESPONSE 에러 |
| K.19 | analyze-timeout-after-30s | Mock이 응답 없음 | ANALYSIS_TIMEOUT 에러 |
| K.20 | cancel-analysis-terminates-query | cancelAnalysis(queryId) | 종료 명령 전송 |
| K.21 | cancel-all-terminates-all-queries | cancelAll() | 대기 중인 모든 쿼리 종료 |
| K.22 | analyze-multiple-returns-ordered | analyzeMultiple([q1,q2,q3]) | 쿼리와 동일한 순서로 결과 반환 |
| K.23 | query-id-correlation | 두 개의 동시 쿼리 | 각 응답이 올바른 쿼리에 매칭 |
| K.24 | analyze-with-invalid-query | 필수 필드 누락 | INVALID_QUERY 에러 |
| K.25 | no-result-response-handled | KataGo가 noResult 반환 | ANALYSIS_ERROR로 매핑 |

### 3.5 카테고리 3: 서킷 브레이커 (8개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| K.26 | cb-closed-initially | 시작 시 | CB 상태 = Closed |
| K.27 | cb-records-failure | analyze() 실패 | failure_count = 1 |
| K.28 | cb-opens-at-threshold | 10분 내 5회 실패 | CB 오픈 |
| K.29 | cb-rejects-when-open | CB 오픈 상태에서 analyze() | CIRCUIT_BREAKER_OPEN |
| K.30 | cb-half-open-allows-probe | 타임아웃 후 프로브 1회 허용 | 프로브 요청 전달 |
| K.31 | cb-closes-on-probe-success | 프로브 성공 | CB 닫힘, failure_count 초기화 |
| K.32 | cb-opens-on-probe-failure | 프로브 실패 | CB 재오픈 |
| K.33 | cb-get-state-accurate | getCircuitBreakerState() | 올바른 CB 상태 객체 반환 |

### 3.6 카테고리 4: 방문 횟수 티어(Visits Tier) 캘리브레이션 (5개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| K.34 | get-visits-tiers-returns-config | getVisitsTiers() | beginner/intermediate/advanced 포함한 VisitsTierConfig |
| K.35 | calibrate-tiers-runs-benchmark | calibrateVisitsTiers() | 업데이트된 VisitsTierConfig 반환 |
| K.36 | calibrate-fails-if-not-ready | Ready 상태가 아닐 때 캘리브레이션 | 에러 반환 |
| K.37 | visits-tiers-stored-in-settings | 캘리브레이션 후 | 설정에 티어 구성 영속화 |
| K.38 | get-backend-info | getBackendInfo() | 바이너리 이름, GPU 감지 포함 BackendInfo |

---

## 4. 설명 엔진 TDD 계획

### 4.1 개요

`explanation-engine` 모듈(`src/engine/explanation/`)은 `AnalysisResponse` 객체를 사람이 읽을 수 있는 설명으로 변환한다. 런타임에 외부 의존성이 없는 **순수 변환 파이프라인**이다.

**테스트 프레임워크**: Vitest
**테스트 파일 위치**: `src/engine/explanation/__tests__/`
**테스트 대상 인터페이스**: `IExplanationEngine` (Step 7, 5개 메서드)
**테스트 데이터**: Step 2 샘플 응답에서 사전 기록된 `AnalysisResponse` 픽스처

### 4.2 카테고리 1: 필드 추출 (8개 테스트)

| # | 테스트명 | 입력 | 기대 결과 |
|---|-----------|-------|----------|
| E.01 | extract-winrate-from-root-info | rootInfo.winrate=0.65인 AnalysisResponse | extractedFields.winrate = 0.65 |
| E.02 | extract-score-lead | rootInfo.scoreLead = 3.2 | extractedFields.scoreLead = 3.2 |
| E.03 | extract-best-move | moveInfos[0].move = "D4" | extractedFields.bestMove = "D4" |
| E.04 | compute-winrate-delta | current.winrate=0.65, previous.winrate=0.58 | winrateDelta = +0.07 |
| E.05 | compute-score-lead-delta | 집 차이(score lead) 변화 | 올바른 델타 |
| E.06 | perspective-flip-for-white | 백의 차례, winrate = 0.65 | 시점 조정: 흑의 시점으로 표시 |
| E.07 | move-rank-computation | 최선 착수 vs. 5번째 최선 착수 | moveRank = 4 (0 기반 인덱스) |
| E.08 | top-move-gap | 1위와 2위 착수 간 승률(winrate) 차이 | topMoveGap 계산됨 |

### 4.3 카테고리 2: 패턴 분류 (15개 테스트)

| # | 테스트명 | 입력 조건 | 기대 패턴 |
|---|-----------|-----------------|-----------------|
| E.09 | life-death-pattern | categoryDetector: 사활 위치 | MANDATORY_TEMPLATE_LIFE_DEATH |
| E.10 | ko-fight-pattern | categoryDetector: 패 활성 | MANDATORY_TEMPLATE_KO |
| E.11 | seki-pattern | categoryDetector: 빅 감지 | MANDATORY_TEMPLATE_SEKI |
| E.12 | blunder-pattern | winrateDelta < -0.10 | BLUNDER 패턴 |
| E.13 | excellent-move-pattern | winrateDelta > +0.05, moveRank = 0 | EXCELLENT_MOVE 패턴 |
| E.14 | standard-territory-pattern | 안정적 형세, 작은 델타 | TERRITORY_MANAGEMENT |
| E.15 | game-phase-opening | moveNumber < 30 | OPENING_PHASE 분류 |
| E.16 | game-phase-middle | 30 <= moveNumber < 200 | MIDDLE_GAME 분류 |
| E.17 | game-phase-endgame | moveNumber >= 200 | ENDGAME 분류 |
| E.18 | confidence-level-high | 방문 횟수 많음 | confidenceLevel = HIGH |
| E.19 | confidence-level-low | 방문 횟수 적음 | confidenceLevel = LOW |
| E.20 | pattern-priority-chain | 여러 패턴 매칭 | 가장 높은 우선순위 패턴 선택 |
| E.21 | mandatory-fallback-life-death | 사활: 비필수 템플릿 없음 | 필수 템플릿 사용 |
| E.22 | mandatory-fallback-ko | 패: 폴백 강제 | 필수 패 템플릿 |
| E.23 | multi-pattern-composition | 2개 보조 패턴 | 출력에 주 패턴 + 최대 2개 보조 패턴 |

### 4.4 카테고리 3: 계층 렌더링 (12개 테스트)

| # | 테스트명 | 계층 | 입력 | 기대 출력 |
|---|-----------|------|-------|-----------------|
| E.24 | beginner-tier-simple-language | 입문 | 악수(blunder) 위치 | 전문 용어 없는 짧고 간단한 설명 |
| E.25 | intermediate-tier-tactical | 중급 | 패 싸움 | 바둑 용어를 사용한 전술적 설명 |
| E.26 | advanced-tier-strategic | 고급 | 전략적 착수 | 상세한 전략 분석 |
| E.27 | beginner-no-numerical-winrate | 입문 | 임의 위치 | 출력에 원시 승률 수치 없음 |
| E.28 | intermediate-winrate-shown | 중급 | 임의 위치 | 승률 퍼센트로 표시 |
| E.29 | advanced-full-details | 고급 | 임의 위치 | 출력에 모든 계산 필드 포함 |
| E.30 | set-default-tier | setDefaultTier('intermediate') | 이후 explain() | 중급 계층 사용 |
| E.31 | get-default-tier | 설정 후 getDefaultTier() | 'intermediate' 반환 |
| E.32 | tier-change-mid-game | 착수 중간에 계층 변경 | 즉시 새 계층 적용 |
| E.33 | output-validation-L3 | 전 계층 | 임의 설명 | 숫자가 KataGo 소스 데이터에 추적 가능 |
| E.34 | slot-binding-correct | 슬롯 포함 템플릿 | 바인딩된 설명 | 모든 {{slot}} 플레이스홀더 대체됨 |
| E.35 | explain-no-previous-analysis | previous = null | 1수 | null을 우아하게 처리 (오프닝 문구) |

### 4.5 카테고리 4: 커버리지 측정 (5개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| E.36 | coverage-stats-all-patterns | 90개 패턴 모두 실행 | getCoverageStats()가 100% 표시 |
| E.37 | coverage-missing-pattern-flagged | 카탈로그에서 1개 패턴 제거 | getCoverageStats()가 공백 표시 |
| E.38 | pattern-catalog-complete | getPatternCatalog() | 90개 패턴 (계층당 30개) |
| E.39 | fallback-always-triggered | 패턴 매칭 없음 | 폴백 설명 생성 |
| E.40 | coverage-stats-include-mandatory | 필수 템플릿 | 커버리지에 포함 계산 |

---

## 5. 게임 엔진 TDD 계획

### 5.1 개요

`game-engine` 모듈(`src/engine/game/`)은 Zustand 상태 관리를 사용하여 게임 흐름을 조율한다. `IRulesEngine`과 `IStoragePort`에 의존하며, 두 가지 모두 mock해야 한다.

**테스트 프레임워크**: Vitest + `@testing-library/react-hooks`
**Mock 전략**: `MockRulesEngine` (미리 구성된 착수 결과 반환), `MemoryStorageAdapter` (인메모리 SQLite 대체)
**테스트 대상 인터페이스**: `IGameEngine` (Step 7, 12개 메서드)

### 5.2 카테고리 1: 게임 생명주기 (10개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| G.01 | create-game-returns-session | createGame(config) | 유효한 ID를 가진 GameSession |
| G.02 | create-game-saves-to-storage | createGame() | IStoragePort.saveGame() 호출 |
| G.03 | create-game-initializes-board | createGame(9x9) | GameState.board가 9x9 빈 바둑판 |
| G.04 | end-game-after-two-passes | playPass() 2회 | GameState.phase = "finished" |
| G.05 | end-game-saves-result | endGame() | 결과로 스토리지 레코드 업데이트 |
| G.06 | resign-game-result | resignGame("B") | GameResult: 백이 기권(resignation)으로 승 |
| G.07 | get-game-state-null-initially | createGame 이전 | getGameState() = null |
| G.08 | get-game-state-after-create | createGame 이후 | GameState 객체 반환 |
| G.09 | request-ai-move-calls-katago | requestAIMove() | IKatagoBridge.analyze() 호출 |
| G.10 | game-engine-state-subscription | subscribe() | 상태 변경 시 리스너 호출 |

### 5.3 카테고리 2: 착수 처리 (8개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| G.11 | play-move-validates-legality | playMove(index) | IRulesEngine.isLegalMove() 호출 |
| G.12 | play-move-applies-state | 합법 착수 | IRulesEngine.applyMove() 호출, 상태 업데이트 |
| G.13 | play-move-appends-to-storage | playMove(legal) | IStoragePort.appendMove() 호출 |
| G.14 | play-move-returns-captures | 따냄 발생 | PlayMoveResult.captures 채워짐 |
| G.15 | play-illegal-move-returns-error | playMove(occupied) | RulesError 반환, 상태 변경 없음 |
| G.16 | play-pass-appends-pass-record | playPass() | coordinate=null인 MoveRecord 저장 |
| G.17 | timer-advances-on-move | 진행 중인 게임 | 흑 착수 후 백 타이머 시작 |
| G.18 | move-triggers-analysis | playMove() | 비동기적으로 분석 트리거 |

### 5.4 카테고리 3: 복기 모드 (7개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| G.19 | go-to-move-0 | goToMove(0) | 바둑판이 초기 빈 상태 표시 |
| G.20 | go-to-move-n | goToMove(5) | 5수 후 상태 표시 |
| G.21 | go-forward | 중간에서 goForward() | 1수 앞으로 |
| G.22 | go-back | 중간에서 goBack() | 1수 뒤로 |
| G.23 | go-back-at-start | 0수에서 goBack() | 상태 변경 없음, 에러 없음 |
| G.24 | go-forward-at-end | 마지막 수에서 goForward() | 상태 변경 없음, 에러 없음 |
| G.25 | review-mode-cannot-play-move | 복기 모드에서 playMove() | REVIEW_MODE_ONLY 에러 |

---

## 6. 스토리지 모듈 TDD 계획

### 6.1 개요

`storage` 모듈(`src/storage/`)은 Tauri 명령 뒤에 `IStoragePort`를 래핑한다. 테스트는 `MemoryStorageAdapter`를 사용하여 테스트 중 Tauri IPC를 피한다.

**테스트 프레임워크**: Vitest
**테스트 대상 인터페이스**: `IStoragePort` (Step 7, 10개 메서드)
**Mock 어댑터**: `MemoryStorageAdapter` — 인메모리 Map 기반 구현, SQLite 없음

### 6.2 카테고리 1: 게임 CRUD (15개 테스트)

| # | 테스트명 | 메서드 | 기대 결과 |
|---|-----------|--------|----------|
| S.01 | save-game-returns-id | saveGame(payload) | UUID 문자열 반환 |
| S.02 | load-game-returns-record | loadGame(id) | 저장된 데이터와 일치하는 GameRecord |
| S.03 | load-nonexistent-game | loadGame("nonexistent") | null 반환 |
| S.04 | list-games-returns-all | listGames(filter) | GameSummary 객체 배열 |
| S.05 | list-games-filter-by-board-size | listGames({boardSize: 9}) | 9x9 게임만 |
| S.06 | delete-game-removes-record | deleteGame(id) | 삭제 후 loadGame이 null 반환 |
| S.07 | delete-cascade-moves | deleteGame(id) | 삭제된 게임의 getMoves가 [] 반환 |
| S.08 | save-game-write-failed | DB 에러 시뮬레이션 | WRITE_FAILED 에러 코드 |
| S.09 | load-game-read-failed | DB 에러 시뮬레이션 | READ_FAILED 에러 코드 |
| S.10 | delete-nonexistent-game | deleteGame("missing") | NOT_FOUND 에러 |
| S.11 | append-move-ordered | appendMove(gameId, move) | getMoves가 순서대로 착수 반환 |
| S.12 | append-move-append-only | 착수 업데이트 시도 | CONSTRAINT_VIOLATION |
| S.13 | get-moves-returns-complete-log | getMoves(gameId) | 모든 착수를 순서대로 |
| S.14 | export-sgf-returns-string | exportSGF(gameId) | 착수 이력이 포함된 유효한 SGF 문자열 |
| S.15 | export-sgf-nonexistent-game | exportSGF("missing") | NOT_FOUND 에러 |

### 6.3 카테고리 2: 설정 (8개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| S.16 | get-setting-existing | getSetting("theme") | 올바른 값 반환 |
| S.17 | get-setting-nonexistent | getSetting("unknown") | null 반환 |
| S.18 | set-setting-persists | setSetting("theme", "dark") | getSetting이 "dark" 반환 |
| S.19 | set-setting-overwrite | setSetting 2회 | 두 번째 값 저장 |
| S.20 | setting-validation-theme | setSetting("theme", "invalid") | Zod 검증 에러 |
| S.21 | setting-validation-board-size | setSetting("defaultBoardSize", 7) | Zod 검증 에러 |
| S.22 | settings-schema-map-coverage | 모든 알려진 키 | 각 키에 Zod 스키마 보유 |
| S.23 | unknown-setting-key-rejected | setSetting("hackKey", "x") | WRITE_FAILED 또는 검증 에러 |

---

## 7. 게이미피케이션 모듈 TDD 계획

### 7.1 개요

`gamification` 모듈(`src/features/gamification/`)은 퀘스트, XP, 스트릭, 배지를 관리한다. `IStoragePort`와 `IGameEngine`(이벤트 구독용)에 의존한다.

**Mock 전략**: 스토리지에는 `MemoryStorageAdapter`, 이벤트 시뮬레이션에는 `MockGameEngine`

### 7.2 카테고리 1: 퀘스트 시스템 (10개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| GA.01 | get-daily-quests-returns-list | getDailyQuests() | 오늘의 Quest 객체 배열 |
| GA.02 | quests-refresh-daily | 새 날짜 | refreshQuests()가 새 퀘스트 세트 반환 |
| GA.03 | complete-quest-marks-done | completeQuest(questId) | Quest.completed = true |
| GA.04 | complete-quest-returns-reward | completeQuest(questId) | XP 양이 포함된 QuestReward |
| GA.05 | complete-quest-not-found | completeQuest("bad-id") | QUEST_NOT_FOUND 에러 |
| GA.06 | complete-quest-twice | 동일 퀘스트 completeQuest | QUEST_ALREADY_COMPLETED 에러 |
| GA.07 | quest-progress-persisted | 퀘스트 완료, 재로드 | 퀘스트 완료 상태 유지 |
| GA.08 | quest-triggers-xp-add | completeQuest() | 보상 양으로 addXP 호출 |
| GA.09 | quests-reset-next-day | 다음 날 | 전날 퀘스트 초기화 |
| GA.10 | get-quests-specific-date | getDailyQuests("2026-03-12") | 해당 날짜의 퀘스트 |

### 7.3 카테고리 2: XP 및 레벨링 (8개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| GA.11 | add-xp-increments-total | addXP(50, "quest") | XP가 50 증가 |
| GA.12 | level-up-threshold | XP가 레벨 임계값 초과 | LevelUpResult 반환 |
| GA.13 | level-up-increments-level | 레벨 임계값 초과 | playerLevel.level += 1 |
| GA.14 | get-player-level | getPlayerLevel() | 현재 레벨과 XP가 포함된 PlayerLevel |
| GA.15 | xp-persists-across-sessions | addXP, 재로드 | 스토리지에서 XP 유지 |
| GA.16 | invalid-xp-amount | addXP(-10) | INVALID_XP_AMOUNT 에러 |
| GA.17 | level-progression-table | 레벨 1→2→3 임계값 | 올바른 XP 요건 |
| GA.18 | get-progress-complete-view | getProgress() | 레벨, XP, 스트릭, 배지 전체 필드 |

### 7.4 카테고리 3: 스트릭 (5개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| GA.19 | streak-increments-on-daily-activity | recordDailyActivity() | streak.count += 1 |
| GA.20 | streak-resets-after-miss | 하루 건너뜀 | streak.count = 0 |
| GA.21 | streak-not-double-counted | 같은 날 recordDailyActivity() 2회 | streak.count 변경 없음 |
| GA.22 | get-streak-returns-current | getStreak() | 현재 카운트가 포함된 StreakData |
| GA.23 | streak-persists | 활동 기록, 재로드 | streak.count 유지 |

### 7.5 카테고리 4: 업적 (7개 테스트)

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| GA.24 | check-achievement-first-game | GameEvent: game_completed | "First Game" 배지 해제 |
| GA.25 | achievement-not-double-unlocked | 동일 업적 트리거 2회 | 업적 1회만 반환 |
| GA.26 | get-achievements-returns-all | getAchievements() | 획득한 모든 업적 |
| GA.27 | achievement-persisted | 해제, 재로드 | 스토리지에 업적 존재 |
| GA.28 | multiple-achievements-one-event | 이벤트가 2개 배지 트리거 | 둘 다 반환 |
| GA.29 | streak-achievement | 7일 스트릭 | "Week Streak" 배지 |
| GA.30 | achievement-xp-reward | 업적 해제 | 업적에 대한 XP 추가 |

---

## 8. Board-UI 및 i18n 테스트 계획

### 8.1 Board-UI 테스트 전략

`board-ui` 모듈(`src/board-ui/`)에는 SVG를 렌더링하는 React 컴포넌트가 포함된다. 테스트 접근 방식:

**컴포넌트 상호작용 테스트** (React Testing Library):

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| B.01 | click-intersection-fires-callback | 빈 교차점 클릭 | onMove 콜백이 올바른 인덱스로 호출 |
| B.02 | hover-shows-ghost-stone | 빈 점 위에 마우스 호버 | GhostStone 컴포넌트 렌더링 |
| B.03 | occupied-intersection-no-ghost | 점유된 점 위에 호버 | 고스트 돌 없음 |
| B.04 | last-move-marker-shown | 착수 후 | 올바른 위치에 LastMoveMarker |
| B.05 | board-size-9x9-grid | boardSize=9 prop | 81개 교차점 렌더링 |
| B.06 | board-size-19x19-grid | boardSize=19 prop | 361개 교차점 렌더링 |
| B.07 | territory-markers-shown | TerritoryMap prop 포함 | 집 오버레이 표시 |
| B.08 | coordinate-labels-correct | showCoordinates=true 포함 | A-T 및 1-19 레이블 |

**유틸리티 단위 테스트** (순수 함수):

| # | 테스트명 | 함수 | 기대 결과 |
|---|-----------|----------|----------|
| B.09 | index-to-screen-coord | boardIndexToScreenXY(40, 9, 400) | 올바른 픽셀 좌표 |
| B.10 | screen-coord-to-index | screenXYToBoardIndex(200, 200, 9, 400) | 가장 가까운 교차점 인덱스 |
| B.11 | star-points-19x19 | getStarPoints(19) | 9개 화점(hoshi) 위치 |
| B.12 | star-points-9x9 | getStarPoints(9) | 5개 화점 위치 |

### 8.2 i18n 테스트 전략

| # | 테스트명 | 시나리오 | 기대 결과 |
|---|-----------|----------|----------|
| I.01 | english-locale-loads | locale="en" | 영어 문자열 표시 |
| I.02 | korean-locale-loads | locale="ko" | 한국어 문자열 표시 |
| I.03 | japanese-locale-loads | locale="ja" | 일본어 문자열 표시 |
| I.04 | locale-change-rerenders | changeLocale("ko") | UI가 한국어로 업데이트 |
| I.05 | missing-key-falls-back | 번역 키 누락 | 키 문자열로 폴백, 크래시 없음 |
| I.06 | go-terms-correct-per-locale | 한국어의 "ko" | 패(ko) = 패, 집(territory) = 집 |

---

## 9. KataGo Oracle 교차 검증 전략

### 9.1 목적

KataGo Oracle 교차 검증은 규칙 엔진의 **근거 기반 검증(ground truth verification)**이다. 핵심 질문: 우리의 TypeScript 규칙 엔진이 합법 착수, 따냄, 계가에 대한 KataGo의 해석과 일치하는가?

**이는 선택 사항이 아니다.** 규칙 엔진이 KataGo와 불일치한다는 것은 KataGo의 분석 응답이 우리 엔진에서 비합법으로 간주하는 착수를 참조하거나, 그 반대의 경우가 생긴다는 의미다. 이는 분석 표시 실패와 잘못된 게임 플레이를 초래한다.

### 9.2 검증 방법론

```
Oracle Pipeline:

For each test position P in the oracle corpus:

  Step 1: Load P into TypeScript rules engine
          → Get legal_moves_ts = IRulesEngine.getLegalMoves(state)

  Step 2: Send P to KataGo via IKatagoBridge.analyze()
          → Get katago_response = AnalysisResponse
          → Extract katago_legal_moves from moveInfos[].move

  Step 3: Compare sets
          → Agreement = legal_moves_ts === katago_legal_moves (set equality)
          → Discrepancies: moves in one set but not the other

  Step 4: Score comparison
          → Get score_ts = IRulesEngine.computeScore(board, komi)
          → Get score_katago = rootInfo.scoreLead (signed, from Black's perspective)
          → Agreement threshold: |score_ts - score_katago| < 1.0 point

  Step 5: Flag discrepancies
          → Any disagreement → HUMAN_REVIEW flag
          → 0 discrepancies = oracle PASS
```

### 9.3 Oracle 테스트 포지션 코퍼스 (20개 위치)

| 포지션 # | 출처 | 설명 | 주요 검증 규칙 |
|-----------|--------|-------------|---------------------|
| OV-01 | 빈 9x9 | 시작 위치 | 81개 착수 모두 합법 |
| OV-02 | EC-01 단순 패 | 전형적 패 위치 | 패 제한 활성 |
| OV-03 | EC-01 패 해소 | 개입 착수 후 | 패 위치 해제 |
| OV-04 | EC-02 환격 | 따냄 전 환격 위치 | 환격 착수 합법 (패 아님) |
| OV-05 | EC-07 빅 | 기본 2무리 빅 | 공유 활로는 공배 |
| OV-06 | EC-07 삼자 빅 | 3자 빅 | 세 무리 모두 살아 있음 |
| OV-07 | EC-09 두 눈 생존 | 진눈 2개 보유 무리 | 따냄 불가 |
| OV-08 | EC-10 거짓눈 | 거짓눈 위치 | 상대가 눈 채울 수 있음 |
| OV-09 | EC-13 자충 합법 | 다중 돌 자충, 새로운 위치 | 자충 합법 |
| OV-10 | EC-13 자충 초과패 | 단일 돌 자충, 이전과 동일 | 비합법 (초과패) |
| OV-11 | EC-14 이석환일 | 4수 순환 위치 | 3번째 반복 착수 비합법 |
| OV-12 | EC-08 귀의 굽은 사궁 | 귀의 굽은 사궁 | 실전 진행 (자동 사망 없음) |
| OV-13 | 복잡한 계가 | 혼합 집, 공배, 빅 | 1점 이내 일치 |
| OV-14 | 꽉 찬 9x9 | 모든 교차점 점유 | 합법 착수 없음 |
| OV-15 | 19x19 오프닝 | 20수 프로 오프닝 | 모든 착수 일치 |
| OV-16 | 축(Ladder) | 전형적 축 형 | 활로 수 검증 |
| OV-17 | 거미줄(Net, Geta) | 포획형 거미줄 | 포획된 무리 활로 0 |
| OV-18 | 큰 빅 (19x19) | 귀의 복잡한 빅 | 올바른 공배 분류 |
| OV-19 | 끝내기 위치 | 게임 종료 직전 계가 위치 | 점수 일치 |
| OV-20 | 월광생 EC-20 | 패를 통한 무조건 삶 | 특별 처리 불필요 |

### 9.4 불일치 처리

**규칙 엔진과 KataGo가 불일치할 경우:**

1. **불일치 기록**: 포지션 해시, 착수 인덱스, 각 시스템의 합법/비합법 판단, KataGo 분석 JSON.
2. **불일치 분류**:
   - Type A: KataGo는 합법, 규칙 엔진은 비합법 → 규칙 엔진이 과도하게 제한적일 수 있음
   - Type B: 규칙 엔진은 합법, KataGo가 제안하지 않음 → KataGo 최적화일 수 있음 (버그 아님)
3. **해당 위치를 수락으로 표시하기 전 반드시 인간 검토 필요.**
4. **해소 기준**: Type A 불일치가 하나라도 있으면 Oracle 테스트 스위트 실패. Type B 불일치는 경고로 기록.

### 9.5 자동화 CI 통합

Oracle 교차 검증은 KataGo 바이너리가 필요한 **별도 CI 작업**으로 실행된다:

```yaml
# CI Pipeline: oracle-validation job
environment:
  KATAGO_BINARY: /usr/local/bin/katago
  KATAGO_MODEL: /models/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz

steps:
  1. Build TypeScript rules engine
  2. Start KataGo process (via KataGoSidecarAdapter)
  3. Run oracle_validation.ts script (all 20 positions)
  4. Compare results
  5. Generate oracle_report.json with pass/fail per position
  6. Fail CI if any Type A discrepancy found
```

**실행 주기**: `integration` 브랜치 및 메인 브랜치로의 모든 푸시마다. 기능 브랜치 푸시에는 실행하지 않음 (CI 환경에 KataGo 바이너리 필요).

---

## 10. End-to-End 테스트 시나리오

### 10.1 E2E 테스트 프레임워크

**프레임워크**: Playwright + Tauri WebDriver
**테스트 파일 위치**: `e2e/`
**실행**: integration 브랜치 빌드 후 CI에서 (전체 Tauri 앱 빌드 필요)
**KataGo**: 실제 KataGo 바이너리 필요; 오프라인 시나리오용 stub 사용 가능

### 10.2 시나리오 1: 첫 게임 흐름

**목표**: 신규 사용자의 첫 게임 정상 경로(happy path) 검증.

```
Precondition: Fresh app installation (empty SQLite database)

Steps:
1. Launch application
2. Onboarding screen appears
3. User enters name "TestPlayer"
4. App navigates to main menu
5. Click "New Game" → 9x9, vs AI, komi=5.5
6. Game board renders
7. Click intersection D4 (Black's first move)
8. Stone appears at D4
9. AI move plays after ~2 seconds
10. Game continues for 3 more moves each side
11. Both players pass twice
12. End-game score screen appears
13. Winner displayed with point margin
14. "Save Game" option available

Assertions:
- Board renders 9x9 grid with 81 intersections
- Black stone appears at D4 after click
- AI response within 10 seconds
- Score screen shows both players' totals
- Game record appears in "My Games" list after save
```

### 10.3 시나리오 2: Quick Go 완전 게임 (5분)

**목표**: Quick Go 게임이 제한 시간 내에 완료됨을 검증.

```
Steps:
1. New Game → 9x9, Quick Go mode, time: 5 min main + 3x30s byoyomi
2. Play 40 moves alternating (scripted clicks)
3. Timer display shows correct remaining time
4. Both players enter byoyomi
5. Both players pass twice
6. Game ends, score calculated
7. Time not expired prematurely

Assertions:
- Timer counts down correctly for each player
- Byoyomi indicator appears when main time exhausted
- Game ends normally (not by time) after double pass
- Total elapsed time matches time control
```

### 10.4 시나리오 3: AI 난이도 조정

**목표**: 게임 중 AI 난이도 변경이 KataGo 동작에 영향을 줌을 검증.

```
Steps:
1. New game, AI difficulty = "Beginner" (50 visits)
2. Play 5 moves
3. Open Settings
4. Change AI difficulty to "Advanced" (800 visits)
5. Play 5 more moves
6. Verify KataGo query parameters change

Assertions:
- Settings change persists after navigation
- KataGo requests after difficulty change use higher visit count
- Board remains in same state (game continues, not reset)
- Analysis quality visibly improves (win rate more confident)
```

### 10.5 시나리오 4: 설명 표시 — "왜?" 버튼

**목표**: 설명 엔진이 세 계층 모두에서 올바른 설명을 렌더링함을 검증.

```
Steps:
1. Load a game with recorded analysis
2. Navigate to a position where a blunder occurred
3. Click "Why?" button
4. Explanation card appears (Beginner tier default)
5. Change tier to "Intermediate"
6. Click "Why?" again
7. Change tier to "Advanced"
8. Click "Why?" again

Assertions:
- Explanation card renders for all three tiers
- Beginner: simple language, no raw numbers
- Intermediate: Go terminology, percentage shown
- Advanced: full analysis with score lead, visit count
- All explanations reference the same move context
- No "undefined" or template placeholders in output
```

### 10.6 시나리오 5: SGF 내보내기

**목표**: 완료된 게임이 유효한 SGF 파일로 내보내짐을 검증.

```
Steps:
1. Play a complete game (10 moves + double pass)
2. Game ends, result displayed
3. Click "Export SGF"
4. File save dialog appears
5. Save as "test-game.sgf"
6. Parse the saved file with @sabaki/sgf

Assertions:
- File exists at save path
- @sabaki/sgf parses without error
- SGF contains correct number of moves (10 + 2 passes)
- Result tag matches displayed result
- Board size tag matches game configuration
- Player names included
```

### 10.7 시나리오 6: 튜토리얼 온보딩 완료

**목표**: 신규 사용자가 온보딩 튜토리얼을 완료함을 검증.

```
Steps:
1. First launch (fresh install)
2. Tutorial starts automatically
3. Follow prompts: place stones, make captures, understand ko
4. Tutorial completes
5. "First Tutorial" achievement unlocked
6. App navigates to main menu

Assertions:
- Tutorial steps render in correct order
- Guided move placement works (restricted to tutorial moves)
- Achievement notification appears on tutorial completion
- Main menu accessible after tutorial
- Achievement stored in gamification_progress table
```

### 10.8 시나리오 7: 게이미피케이션 퀘스트 완료

**목표**: 일일 퀘스트 완료가 XP를 부여하고 레벨을 올림을 검증.

```
Steps:
1. Open Daily Quests panel
2. Active quests are shown (e.g., "Play 1 game")
3. Play and complete a game
4. Quest appears as completed
5. XP reward displayed (+50 XP)
6. If level threshold crossed: level-up animation

Assertions:
- Quest "Play 1 game" marked complete after game ends
- XP total increases by quest reward amount
- Level increments if threshold crossed
- Quest completion persists (not reset until next day)
- Quest panel shows correct remaining quests
```

### 10.9 시나리오 8: 설정 변경 영속성

**목표**: 설정이 앱 재시작 후에도 유지됨을 검증.

```
Steps:
1. Open Settings
2. Change: theme = dark, defaultBoardSize = 19, locale = ko
3. Close Settings
4. Close app
5. Relaunch app

Assertions:
- Dark theme applied immediately on settings change
- 19x19 selected by default on next "New Game"
- Korean locale displayed after change
- All three settings survive app restart (SQLite persistence)
```

### 10.10 시나리오 9: 다국어 전환

**목표**: 로케일 전환이 모든 UI 문자열을 변경함을 검증.

```
Steps:
1. App running in English
2. Navigate to Settings → Language → Korean
3. Confirm language change
4. Navigate through app

Assertions:
- Main menu shows Korean labels (새 게임, 내 게임 등)
- Board coordinate labels in Korean format
- Go terms use Korean romanization (집, 패, 따냄)
- English not visible (no mixed language)
5. Switch back to English
6. App returns to full English
```

### 10.11 시나리오 10: 오프라인 모드 — 정상 성능 저하

**목표**: KataGo 없이도 앱이 동작하며 분석이 우아하게 저하됨을 검증.

```
Steps:
1. Start app with KataGo disabled (stub returns BINARY_NOT_FOUND)
2. Game board still renders and accepts moves
3. Move is played
4. Analysis panel shows "AI analysis unavailable" message
5. "Why?" button shows offline message
6. Game can be played and scored without AI

Assertions:
- App does not crash when KataGo unavailable
- "Offline mode" indicator visible
- Games can be played and completed
- Moves still saved to SQLite
- SGF export still works
- When KataGo becomes available (simulated reconnect), analysis resumes
```

### 10.12 시나리오 11: 게임 후 분석 탐색 복기

**목표**: 완료된 게임을 각 수의 분석과 함께 복기할 수 있음을 검증.

```
Steps:
1. Open a completed game from "My Games"
2. Game review mode activates (shows move 0: empty board)
3. Click "Forward" 10 times
4. At move 5, click "Why?"
5. Analysis card appears (from stored analysis or new KataGo query)
6. Navigate to last move
7. Click "Export SGF"

Assertions:
- Board reconstructs correctly at each move step
- Analysis card shows data for the correct position
- Navigation back and forward is instant
- SGF export from review mode includes complete game
```

### 10.13 시나리오 12: 초읽기(Byoyomi) 타임 아웃

**목표**: 타이머 만료가 게임을 올바르게 종료함을 검증.

```
Steps:
1. New game, time: 10s main + 1x5s byoyomi
2. Wait for timer to enter byoyomi
3. Wait for byoyomi to expire
4. Game ends with time loss result

Assertions:
- Byoyomi countdown visible
- After byoyomi expires: GameResult = {method: "time", winner: opponent}
- Result displayed: "W+T" or "B+T"
- Game saved with time-loss result
- No further moves accepted
```

---

## 11. 테스트 인프라 및 도구

### 11.1 프레임워크 결정

| 도구 | 목적 | 근거 |
|------|---------|-----------|
| **Vitest** | 단위 및 통합 테스트 | 빠름, ESM 네이티브, Tauri에서 사용하는 Vite 빌드와 호환 |
| **@testing-library/react** | 컴포넌트 테스트 | React 컴포넌트 상호작용의 업계 표준 |
| **Playwright** | E2E 테스트 | 크로스플랫폼, WebDriver를 통해 Tauri 호환 |
| **Storybook** | 시각적 컴포넌트 검토 | Board UI 컴포넌트를 문서화하고 시각적으로 검증 |
| **c8 / v8** | 커버리지 리포팅 | Vitest에 내장, 추가 설정 불필요 |

### 11.2 테스트 파일 구성

```
src/
  engine/
    rules/__tests__/
      board.test.ts          (Categories 1-2: Board creation, placement)
      capture.test.ts        (Categories 3-4: Single and multi-group capture)
      suicide.test.ts        (Category 5: Suicide / self-capture)
      ko.test.ts             (Category 6: Simple ko detection)
      superko.test.ts        (Category 7: Positional superko)
      scoring.test.ts        (Category 8: Chinese scoring algorithm)
      game-flow.test.ts      (Category 9: Game flow, passes, resignation)
      groups.test.ts         (Category 10: Group operations)
      edge-cases.test.ts     (Category 11: EC-01 through EC-20)
      fixtures/              (Pre-built board positions for all tests)

    katago/__tests__/
      state-machine.test.ts
      ipc.test.ts
      circuit-breaker.test.ts
      visits-calibration.test.ts

    explanation/__tests__/
      field-extractor.test.ts
      pattern-classifier.test.ts
      tier-renderer.test.ts
      coverage.test.ts

    game/__tests__/
      lifecycle.test.ts
      move-processing.test.ts
      review-mode.test.ts

  storage/__tests__/
    game-crud.test.ts
    settings.test.ts

  features/gamification/__tests__/
    quests.test.ts
    xp-leveling.test.ts
    streaks.test.ts
    achievements.test.ts

  board-ui/__tests__/
    board-interactions.test.ts
    coordinate-utils.test.ts

  i18n/__tests__/
    locale-switching.test.ts

e2e/
  scenarios/
    01-first-game-flow.spec.ts
    02-quick-go-complete.spec.ts
    03-ai-difficulty.spec.ts
    04-explanation-display.spec.ts
    05-sgf-export.spec.ts
    06-onboarding-tutorial.spec.ts
    07-gamification-quests.spec.ts
    08-settings-persistence.spec.ts
    09-multi-language.spec.ts
    10-offline-mode.spec.ts
    11-post-game-review.spec.ts
    12-timer-expiry.spec.ts
  oracle/
    oracle-validation.ts      (KataGo oracle cross-validation script)
    positions/               (20 SGF/JSON test position files)
```

### 11.3 CI 파이프라인 구조

```yaml
# CI Stages (runs on every PR and push to integration branch)

Stage 1: Lint and TypeScript
  - tsc --noEmit (type check all modules)
  - eslint src/
  - i18next-parser (translation key coverage check)

Stage 2: Unit Tests (fast, no dependencies)
  - vitest run src/engine/rules/
  - vitest run src/engine/explanation/
  - vitest run src/storage/
  - vitest run src/core/
  Duration target: < 60 seconds

Stage 3: Integration Tests (mock adapters)
  - vitest run src/engine/katago/ (MockKataGoAdapter)
  - vitest run src/engine/game/ (MockRulesEngine + MemoryStorageAdapter)
  - vitest run src/features/gamification/
  Duration target: < 120 seconds

Stage 4: Coverage Report
  - vitest run --coverage
  - Fail if rules-engine coverage < 100% branch
  - Fail if overall coverage < 85% line

Stage 5: Oracle Validation (requires KataGo binary)
  - Runs only on integration branch
  - oracle-validation.ts (all 20 positions)
  - Fail if any Type A discrepancy

Stage 6: E2E Tests (requires Tauri build)
  - Runs only on integration branch
  - playwright test e2e/
  - Fail if any scenario fails
  Duration target: < 15 minutes
```

---

## 12. 커버리지 목표

| 모듈 | 커버리지 유형 | 목표 | 근거 |
|--------|-------------|--------|-----------|
| `rules-engine` | 분기 | 100% | 수학적 정확성 — 모든 조건 분기 반드시 테스트 |
| `core` | 라인 | 100% | 순수 유틸리티 — 테스트가 매우 용이 |
| `katago-bridge` | 분기 | 95% | 상태 머신 완전성이 핵심 |
| `explanation-engine` | 동작 | 90% | 90개 패턴 전부 실행 필요 |
| `storage` | 라인 | 95% | 데이터 무결성 타협 불가 |
| `game-engine` | 라인 | 85% | 통합 복잡성으로 인해 일부 UI 의존 미커버 경로 허용 |
| `gamification` | 라인 | 85% | 퀘스트/배지 로직 완전 테스트 가능 |
| `board-ui` | 상호작용 | 80% | 시각적 컴포넌트는 Storybook으로 부분 커버 |
| `i18n` | 키 커버리지 | 100% | 모든 로케일에 모든 번역 키 존재 필수 |
| `analytics` | 라인 | 80% | 어댑터 래퍼; 서드파티 SDK는 테스트 대상 아님 |

---

## 13. pACS 자체 평가

### 충실도 (F): 93

**근거**: Step 6 아키텍처의 모든 모듈에는 Step 7 인터페이스 계약에서 도출한 테스트 카테고리를 포함하는 TDD 계획이 있다. 규칙 엔진 테스트 카테고리는 Step 3 DKS 엔티티(E01-E72) 및 제약 카탈로그(C01-C18)에 직접 추적 가능하다. KataGo Bridge 테스트는 Step 2 IPC 명세(상태 머신, 서킷 브레이커, 방문 횟수 티어)에 추적된다. 설명 엔진 테스트는 Step 4 템플릿 엔진 설계에 추적된다. Oracle 검증 방법론은 Step 3의 20개 엣지 케이스 전체를 올바르게 참조한다. E2E 시나리오는 Step 7의 10개 Tauri 명령 표면 모두를 커버한다.

소폭 감점: analytics 모듈 테스트 계획은 의도적으로 최소화(어댑터 전용)되었다 — 이는 의도적인 설계 선택(analytics는 얇은 래퍼)이지만, 모듈별 심도가 줄어드는 것을 나타낸다.

### 완전성 (C): 95

**근거**: 모든 필수 산출물이 존재한다:
- 178개 규칙 엔진 테스트 카테고리 (130개 이상 요건을 37% 초과)
- 12개 E2E 시나리오 (10개 이상 요건을 20% 초과)
- 20개 위치, 자동화 CI 통합, 불일치 처리를 포함하는 KataGo Oracle 교차 검증
- 10개 모듈 전체에 대한 TDD 분류
- 모든 모듈에 커버리지 목표 정의
- 테스트 파일 구성, CI 파이프라인 구조, 도구 선택 문서화
- Mock이 필요한 모든 모듈에 Mock 전략 명세

### 논리적 일관성 (L): 92

**근거**: 테스트 전략은 Step 6의 모듈 의존성 DAG를 존중한다. 하위 계층 모듈(`rules-engine`, `storage`)의 테스트에는 mock을 사용하지 않는다. 상위 계층 모듈(`game-engine`, `gamification`)의 테스트는 Step 7에 정의된 인터페이스를 사용하여 직접 의존성만 mock한다. Oracle 검증은 TypeScript 규칙 로직과 KataGo 자체의 규칙 해석 간의 통합을 테스트한다는 점을 올바르게 식별한다 — 이는 단위 테스트만으로는 테스트할 수 없는 교차 시스템 경계다. 커버리지 목표는 모듈 유형에 맞게 조정되어 있다 (순수 함수는 100%, 통합 복잡 모듈은 85%).

소폭 감점: board-ui 시각적 테스트 전략은 Storybook을 통한 인간 검토에 부분적으로 의존하며, 이는 완전히 자동화 가능하지 않다. UI 컴포넌트에 대해서는 허용 가능하지만, 자동화 검증의 공백을 나타낸다.

### pACS 점수: min(93, 95, 92) = **92 GREEN**
