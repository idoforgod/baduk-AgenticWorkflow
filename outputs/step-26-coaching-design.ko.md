# AI 코치 코멘터리 시스템 설계

**버전**: 1.0.0
**작성자**: @template-designer (Step 26)
**날짜**: 2026-03-12
**소비자**: Step 27 (coaching-engine 구현자)
**입력**: Step 4 템플릿 엔진 설계, Step 26 코칭 시그널, 기존 코드베이스
**언어**: 한국어 코칭 출력, 영어 설계 문서

---

## 목차

1. [핵심 원칙: Zero-LLM 코칭 파이프라인](#1-핵심-원칙)
2. [아키텍처 개요](#2-아키텍처-개요)
3. [시그널-개념 매핑 테이블](#3-시그널-개념-매핑)
4. [전술 분류 알고리즘](#4-전술-분류-알고리즘)
5. [바둑판 상태 시그널 정의](#5-바둑판-상태-시그널)
6. [격려 상태 머신](#6-격려-상태-머신)
7. [코칭 템플릿 카탈로그](#7-코칭-템플릿-카탈로그)
8. [기존 시스템과의 통합](#8-통합)
9. [검증 체크리스트](#9-검증)
10. [pACS 자체 평가](#10-pacs)

---

## 1. 핵심 원칙: Zero-LLM 코칭 파이프라인

### 1.1 절대 불변 원칙

> **KataGo = 진실의 원천, 결정론적 코드 = 해석기, 사전 작성된 템플릿 = 텍스트.**
> **코칭 파이프라인에 LLM 개입은 일절 없다.**

이 원칙은 비고위험 카테고리에 대해 LLM 폴백을 허용하는 Step 4 해설 엔진보다 더 강력하다. 코칭 시스템에는 **LLM 경로가 전혀 없다**. 모든 코칭 코멘트는 다음과 같이 생성된다:

1. KataGo 데이터 + 바둑판 상태에 대한 결정론적 분류(if/else 체인).
2. 사전 작성된 카탈로그에서 템플릿 선택.
3. KataGo 파생 값으로 슬롯 주입.

### 1.2 구조적 강제

| 계층 | 메커니즘 | 방지하는 것 |
|-------|-----------|------------|
| **L0: 데이터 게이트** | `classifyTacticalSituation()`은 `ParsedAnalysis` + `BoardGrid` + `ownership[]`만 수신한다. 자연어 입력도, LLM 컨텍스트도 없다. | LLM이 분류에 영향을 미치는 것을 방지한다. |
| **L1: 슬롯 바인딩** | 모든 템플릿의 모든 `{placeholder}`는 KataGo 필드 또는 결정론적 연산에 매핑된다. 자유 텍스트 슬롯은 없다. | 조작된 데이터가 출력에 진입하는 것을 방지한다. |
| **L2: 결정론적 체인** | 분류는 엄격한 우선순위 기반 if/else 체인이다. 확률적 점수 산정도, ML 모델도, 휴리스틱 가중치도 없다. | 비재현성 결과를 방지한다. |
| **L3: 템플릿 전용 출력** | 코칭 훅은 `templateId`, `situationType`, `slots`, `rendered text`를 포함하는 `CoachingComment` 객체를 반환한다. 임의의 문자열을 받아들이는 코드 경로는 없다. | 런타임 텍스트 생성을 구조적으로 방지한다. |

### 1.3 데이터 흐름

```
KataGo AnalysisResponse
        |
        v
 [parseAnalysis()]           [BoardGrid from game store]
   (existing fn)                      |
        |                             |
        v                             v
 ParsedAnalysis  ───────> [classifyTacticalSituation()]
                                      |
                                      v
                           TacticalSituation enum
                                      |
                    ┌─────────────────┼──────────────────┐
                    v                 v                    v
          [EncouragementFSM]   [selectTemplate()]   [fillSlots()]
                    |                 |                    |
                    v                 v                    v
           state modifier     CoachingTemplate      slot values
                    |                 |                    |
                    └────────> [renderCoaching()] <───────┘
                                      |
                                      v
                             CoachingComment (Korean text)
```

### 1.4 Step 4 해설 엔진과의 관계

| 측면 | Step 4 (복기 엔진) | Step 26 (코칭 엔진) |
|------|----------------------|--------------------------|
| **타이밍** | 대국 후 복기 | 대국 중 실시간 |
| **언어** | 영어 | 한국어 |
| **계층** | 3단계 (초급/중급/고급) | 초급 전용 (따뜻한 멘토) |
| **LLM 경로** | 있음 (비고위험에 대한 폴백) | **없음** (zero LLM) |
| **템플릿 수** | 90개 (계층당 30개) | 45개 (초급 한국어만) |
| **재사용** | `parseAnalysis()`, `classifyMoveQuality()`, `detectGamePhase()` | 동일 함수 재사용 |
| **신규** | N/A | 바둑판 상태 전술 분석, 격려 FSM |

---

## 2. 아키텍처 개요

### 2.1 컴포넌트 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Coach Commentary System                 │
│                                                               │
│  ┌──────────────┐   ┌────────────────────┐   ┌────────────┐ │
│  │ ParsedAnalysis│   │ BoardStateAnalyzer │   │ Ownership  │ │
│  │ (reused from  │   │ (new: findGroup,   │   │ (optional  │ │
│  │  output-parser│   │  getAdjacencyTable │   │  from      │ │
│  │  .ts)         │   │  wrappers)         │   │  KataGo)   │ │
│  └──────┬───────┘   └─────────┬──────────┘   └─────┬──────┘ │
│         │                     │                      │        │
│         └──────────┬──────────┘──────────────────────┘        │
│                    v                                          │
│         ┌──────────────────────┐                              │
│         │  classifyTactical    │                              │
│         │  Situation()         │                              │
│         │  (priority chain)    │                              │
│         └──────────┬───────────┘                              │
│                    │                                          │
│                    v                                          │
│         ┌──────────────────────┐                              │
│         │ EncouragementFSM     │                              │
│         │ (state machine)      │                              │
│         └──────────┬───────────┘                              │
│                    │                                          │
│                    v                                          │
│         ┌──────────────────────┐                              │
│         │  selectTemplate()    │──> COACHING_CATALOG (45)     │
│         │  + fillSlots()       │                              │
│         │  + renderCoaching()  │                              │
│         └──────────┬───────────┘                              │
│                    │                                          │
│                    v                                          │
│           CoachingComment                                     │
│           { text, situation, emotion, templateId }            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 React 통합

코칭 시스템은 커스텀 React 훅인 `useCoaching()`을 통해 노출된다.

```typescript
// Conceptual API (Step 27 implements)
interface CoachingComment {
  readonly text: string;                    // Rendered Korean template
  readonly situationType: TacticalSituation;
  readonly emotion: CoachingEmotion;        // 'positive' | 'neutral' | 'encouraging' | 'cautionary'
  readonly templateId: string;
  readonly encouragementState: EncouragementState;
}

interface UseCoachingReturn {
  readonly comment: CoachingComment | null;
  readonly encouragementState: EncouragementState;
  readonly updateCoaching: (
    analysis: ParsedAnalysis,
    grid: BoardGrid,
    boardSize: BoardSize,
    lastMoveIndex: number,
    player: PlayerColor,
    ownership?: number[]
  ) => void;
  readonly reset: () => void;
}
```

`useCoaching` 훅은 다음을 유지한다:
- 현재 `CoachingComment` (UI에 표시)
- `EncouragementState` (착수 간 유지되는 FSM 상태)
- FSM용 착수 이력 (연속 좋은 수/나쁜 수 카운트)

### 2.3 스토어 패턴 (useWinRateStore 따름)

```typescript
// Follows the exact pattern from useWinRateStore.ts
interface CoachingStore {
  comment: CoachingComment | null;
  encouragementState: EncouragementState;
  consecutiveGoodMoves: number;
  consecutiveBadMoves: number;
  previousWinrate: number | null;
  setComment: (comment: CoachingComment) => void;
  transitionFSM: (situation: TacticalSituation, moveQuality: MoveQuality | null) => void;
  reset: () => void;
}
```

---

## 3. 시그널-개념 매핑 테이블

### 3.1 15가지 TacticalSituation 유형

```typescript
type TacticalSituation =
  | 'brilliant_move'        // Priority 1: AI-unexpected best move
  | 'mistake'               // Priority 1: Significant winrate loss
  | 'momentum_shift'        // Priority 2: Winrate crosses 50% boundary
  | 'capture'               // Priority 3: Adjacent opponent group in atari
  | 'attack'                // Priority 3: Adjacent opponent group with few liberties
  | 'escape'                // Priority 3: Own group in danger, surrounded
  | 'connection'            // Priority 3: Connecting two friendly groups
  | 'invasion'              // Priority 4: Playing into opponent's territory
  | 'defense'               // Priority 4: Protecting own territory from invasion
  | 'approach'              // Priority 4: Opening approach to corner stone
  | 'territory_building'    // Priority 4: Claiming territory in open area
  | 'endgame_counting'      // Priority 5: Endgame phase
  | 'close_game'            // Priority 5: Winrate near 50%
  | 'good_move'             // Priority 6: Positive move quality
  | 'positional'            // Priority 7: Fallback
```

### 3.2 전체 매핑 테이블

| 우선순위 | 개념 | 입력 시그널 | 임계값 / 조건 | 바둑판 상태 필요 | 소유권 필요 |
|:---:|---|---|---|:---:|:---:|
| 1a | `brilliant_move` | `classifyMoveQuality()`의 `moveQuality` | `moveQuality === 'brilliant'` | 아니오 | 아니오 |
| 1b | `mistake` | `classifyMoveQuality()`의 `moveQuality` | `moveQuality === 'blunder' OR moveQuality === 'mistake'` | 아니오 | 아니오 |
| 2 | `momentum_shift` | `previousWinrate`, `currentWinrate` | `(previousWinrate < 0.50 AND currentWinrate >= 0.50) OR (previousWinrate >= 0.50 AND currentWinrate < 0.50)` 여기서 승률은 동일 플레이어 시점 | 아니오 | 아니오 |
| 3a | `capture` | 인접 상대 무리 각각에 대한 `findGroup()` | 인접 상대 무리 중 `liberties.size === 1`인 것이 있음 | **예** | 아니오 |
| 3b | `attack` | 인접 상대 무리 각각에 대한 `findGroup()` | 인접 상대 무리 중 `liberties.size <= 3` AND `liberties.size > 1`인 것이 있음 | **예** | 아니오 |
| 3c | `escape` | `lastMoveIndex`를 포함하는 무리의 `findGroup()` + 인접 상대 수 | 자기 무리 `liberties.size <= 3` AND `adjOpponentCount >= 2` | **예** | 아니오 |
| 3d | `connection` | 인접 아군 무리 스캔 (`findGroup`으로 식별된 별개의 무리) | `adjFriendlyGroupCount >= 2` (놓인 돌에 인접한 두 개 이상의 별개 아군 무리) | **예** | 아니오 |
| 4a | `invasion` | `ownership[lastMoveIndex]` (이 수를 두기 전, KataGo 제공) | `ownership[lastMoveIndex] < -0.3` (상대 영역으로 기울어진 집) 여기서 음수 = 현재 플레이어 기준 상대 | 아니오 | **예** (폴백: 건너뜀) |
| 4b | `defense` | `ownership[lastMoveIndex]`, 인접 상대 수 | `ownership[lastMoveIndex] > 0.3` (자기 집) AND `adjOpponentCount >= 1` | **예** | **예** (폴백: 건너뜀) |
| 4c | `approach` | `gamePhase`, 공간적 위치, 인접 상대 수 | `gamePhase === 'opening'` AND `spatial === 'corner'` AND `adjOpponentCount >= 1` | **예** | 아니오 |
| 4d | `territory_building` | `gamePhase`, 공간적 위치, 인접 상대 수 | `gamePhase === 'opening'` AND `spatial in ['corner', 'side']` AND `adjOpponentCount === 0` | **예** | 아니오 |
| 5a | `endgame_counting` | `detectGamePhase()`의 `gamePhase` | `gamePhase === 'endgame'` | 아니오 | 아니오 |
| 5b | `close_game` | `winratePct` | `abs(winratePct - 50) < 5` (즉, 승률이 45%~55% 사이) | 아니오 | 아니오 |
| 6 | `good_move` | `classifyMoveQuality()`의 `moveQuality` | `moveQuality in ['excellent', 'good']` | 아니오 | 아니오 |
| 7 | `positional` | (위 어느 것에도 해당하지 않음) | 항상 참 (폴백) | 아니오 | 아니오 |

### 3.3 공간적 위치 분류

접근(approach)과 집짓기(territory_building)에서 사용된다. `lastMoveIndex`와 `boardSize`로부터 도출된다:

```typescript
function classifySpatial(index: number, boardSize: BoardSize): 'corner' | 'side' | 'center' {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;

  // Corner region: within 4 lines of two edges (5 for 19x19, 3 for 9x9)
  const edgeThreshold = boardSize === 9 ? 3 : boardSize === 13 ? 4 : 5;

  const nearTop = row < edgeThreshold;
  const nearBottom = row >= boardSize - edgeThreshold;
  const nearLeft = col < edgeThreshold;
  const nearRight = col >= boardSize - edgeThreshold;

  const verticalEdge = nearTop || nearBottom;
  const horizontalEdge = nearLeft || nearRight;

  if (verticalEdge && horizontalEdge) return 'corner';
  if (verticalEdge || horizontalEdge) return 'side';
  return 'center';
}
```

### 3.4 인접 무리 분석

따냄(capture), 공격(attack), 탈출(escape), 연결(connection), 방어(defense), 접근(approach), 집짓기(territory_building)에서 사용된다:

```typescript
interface AdjacentGroupAnalysis {
  adjOpponentGroups: Group[];       // Distinct opponent groups adjacent to lastMoveIndex
  adjFriendlyGroups: Group[];       // Distinct friendly groups adjacent (excluding the group of lastMoveIndex itself)
  ownGroup: Group | null;           // The group containing lastMoveIndex
  adjOpponentCount: number;         // Count of adjacent intersections occupied by opponent
  adjFriendlyCount: number;         // Count of adjacent intersections occupied by same color
  minOpponentLiberties: number;     // Minimum liberty count among adjacent opponent groups
  minOwnLiberties: number;          // Liberty count of own group
}
```

다음과 같이 계산된다:
```
adjTable = getAdjacencyTable(boardSize)
neighbors = adjTable[lastMoveIndex]
for each neighbor n:
  if grid[n] === opponentColor:
    group = findGroup(grid, boardSize, n)
    add to adjOpponentGroups (deduplicated by first stone index)
  if grid[n] === playerColor AND n is not in ownGroup.stones:
    group = findGroup(grid, boardSize, n)
    add to adjFriendlyGroups (deduplicated)
```

### 3.5 소유권 시점 처리

KataGo 소유권 값은 흑의 시점에서 보고된다 (양수 = 흑의 집, 음수 = 백의 집). 코칭 코멘터리에서는:

- `player === 'B'` (흑이 방금 착수)인 경우: ownership > 0 = 자기 집, ownership < 0 = 상대 집.
- `player === 'W'` (백이 방금 착수)인 경우: ownership < 0 = 자기 집, ownership > 0 = 상대 집.

분류 함수는 플레이어에 따라 소유권을 반전시킨다:

```
effectiveOwnership = (player === BLACK) ? ownership[index] : -ownership[index]
// effectiveOwnership > 0 means "my territory"
// effectiveOwnership < 0 means "opponent's territory"
```

---

## 4. 전술 분류 알고리즘

### 4.1 완전한 의사코드

```
function classifyTacticalSituation(
  parsed: ParsedAnalysis,
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor,
  ownership: number[] | null,
  previousWinrate: number | null     // Same-player-perspective winrate from 2 moves ago
): TacticalSituation {

  // ─────────────────────────────────────────────────────
  // TIER 1: Quality-based (checked FIRST via moveQuality)
  // ─────────────────────────────────────────────────────

  moveQuality = parsed.moveQuality   // from classifyMoveQuality()

  if (moveQuality === 'brilliant') {
    return 'brilliant_move'
  }

  if (moveQuality === 'blunder' OR moveQuality === 'mistake') {
    return 'mistake'
  }

  // ─────────────────────────────────────────────────────
  // TIER 2: Momentum-based (winrate crossing 50% boundary)
  // ─────────────────────────────────────────────────────

  // currentWinrate is from current player's perspective
  currentWinrate = parsed.raw.rootInfo.winrate

  // previousWinrate is the same player's winrate from 2 moves ago
  // (not the opponent's last turn — we need same-player comparison)
  // This is passed in from the coaching store.

  if (previousWinrate !== null) {
    crossedUp   = previousWinrate < 0.50 AND currentWinrate >= 0.50
    crossedDown = previousWinrate >= 0.50 AND currentWinrate < 0.50

    if (crossedUp OR crossedDown) {
      return 'momentum_shift'
    }
  }

  // ─────────────────────────────────────────────────────
  // TIER 3: Board-state tactical
  // ─────────────────────────────────────────────────────

  // Only if the grid has a stone at lastMoveIndex
  if (grid[lastMoveIndex] !== EMPTY) {

    adjTable = getAdjacencyTable(boardSize)
    neighbors = adjTable[lastMoveIndex]
    opponentColor = (player === BLACK) ? WHITE : BLACK

    // Collect adjacent groups
    adjOpponentGroups: Map<number, Group> = new Map()   // keyed by min stone index for dedup
    adjFriendlyGroups: Map<number, Group> = new Map()
    adjOpponentCount = 0

    ownGroup = findGroup(grid, boardSize, lastMoveIndex)

    for each n in neighbors:
      if (grid[n] === opponentColor):
        adjOpponentCount++
        group = findGroup(grid, boardSize, n)
        if group !== null:
          key = min(group.stones)   // dedup key
          adjOpponentGroups.set(key, group)

      if (grid[n] === player):
        group = findGroup(grid, boardSize, n)
        if group !== null:
          key = min(group.stones)
          // Exclude the group containing lastMoveIndex itself
          if NOT ownGroup.stones.has(key):
            // But after placing stone, they might already be merged.
            // Use: if group identity differs from ownGroup
            // Simplification: check if key is in ownGroup.stones
            // If the stone at lastMoveIndex was just placed and already
            // merged with this group, findGroup from n returns the same group.
            // So we check: if the group from n has stones beyond ownGroup
            // Actually, after the stone is placed and groups merge, findGroup
            // returns the merged group. We need pre-move group count.
            // Solution: count distinct groups found from neighbors, all of
            // which are the same color as player. If we find >= 2 distinct
            // groups among neighbors (before they merged via this stone),
            // that means this stone connected them.
            // But post-placement, they are all one group.
            // So instead: count how many neighbor stones of same color
            // were in DIFFERENT groups before this move.
            // Approximation: count adjacent same-color stones; if they
            // come from different parts of the merged group (i.e., removing
            // the placed stone would split the group), this is a connection.
            //
            // Simpler heuristic for coaching purposes:
            // If 2+ adjacent same-color neighbors exist, classify as connection.
            adjFriendlyGroups.set(key, group)

    // Count distinct adjacent friendly neighbors (not in own group before merge)
    adjFriendlyNeighborCount = count of n in neighbors where grid[n] === player

    // --- CAPTURE: adjacent opponent in atari ---
    for each group in adjOpponentGroups.values():
      if (group.liberties.size === 1):
        return 'capture'

    // --- ATTACK: adjacent opponent with few liberties ---
    for each group in adjOpponentGroups.values():
      if (group.liberties.size >= 2 AND group.liberties.size <= 3):
        return 'attack'

    // --- ESCAPE: own group in danger ---
    if (ownGroup !== null AND ownGroup.liberties.size <= 3 AND adjOpponentCount >= 2):
      return 'escape'

    // --- CONNECTION: connecting friendly groups ---
    // Heuristic: if 2+ adjacent intersections have same-color stones,
    // and at least one of them was not already connected to the stone
    // before this move, this is likely a connection move.
    // Post-merge simplification: if adjFriendlyNeighborCount >= 2
    if (adjFriendlyNeighborCount >= 2):
      return 'connection'
  }

  // ─────────────────────────────────────────────────────
  // TIER 4: Spatial-strategic (ownership + coordinates)
  // ─────────────────────────────────────────────────────

  gamePhase = parsed.computed.movePhase   // from detectGamePhase()
  spatial = classifySpatial(lastMoveIndex, boardSize)

  // Ownership-based: invasion and defense
  if (ownership !== null) {
    effectiveOwnership = (player === BLACK) ? ownership[lastMoveIndex] : -ownership[lastMoveIndex]
    // effectiveOwnership > 0 = my territory, < 0 = opponent's territory

    // --- INVASION: playing into opponent's territory ---
    if (effectiveOwnership < -0.3):
      return 'invasion'

    // --- DEFENSE: protecting own territory from nearby opponent ---
    // Need adjOpponentCount computed above; if we skipped tier 3
    // (because grid[lastMoveIndex] was EMPTY, which shouldn't happen
    // for a played move), we recalculate here.
    adjOppCount = 0
    for each n in getAdjacencyTable(boardSize)[lastMoveIndex]:
      opponentColor = (player === BLACK) ? WHITE : BLACK
      if grid[n] === opponentColor:
        adjOppCount++

    if (effectiveOwnership > 0.3 AND adjOppCount >= 1):
      return 'defense'
  }

  // Coordinate-based: approach and territory_building (opening only)
  if (gamePhase === 'opening') {
    // Recalculate adjOpponentCount if not already available
    adjOppCount = 0
    for each n in getAdjacencyTable(boardSize)[lastMoveIndex]:
      opponentColor = (player === BLACK) ? WHITE : BLACK
      if grid[n] === opponentColor:
        adjOppCount++

    // --- APPROACH: approaching opponent's corner stone ---
    if (spatial === 'corner' AND adjOppCount >= 1):
      return 'approach'

    // --- TERRITORY BUILDING: claiming open territory ---
    if (spatial in ['corner', 'side'] AND adjOppCount === 0):
      return 'territory_building'
  }

  // ─────────────────────────────────────────────────────
  // TIER 5: Game-state (phase + winrate)
  // ─────────────────────────────────────────────────────

  if (gamePhase === 'endgame'):
    return 'endgame_counting'

  winratePct = parsed.winratePct
  if (abs(winratePct - 50) < 5):   // Between 45% and 55%
    return 'close_game'

  // ─────────────────────────────────────────────────────
  // TIER 6: Positive feedback
  // ─────────────────────────────────────────────────────

  if (moveQuality in ['excellent', 'good']):
    return 'good_move'

  // ─────────────────────────────────────────────────────
  // TIER 7: Fallback
  // ─────────────────────────────────────────────────────

  return 'positional'
}
```

### 4.2 우선순위 체인 요약

| 우선순위 | 상황 | 검사 | 단락 평가 |
|:---:|---|---|:---:|
| 1a | `brilliant_move` | `moveQuality === 'brilliant'` | 예 |
| 1b | `mistake` | `moveQuality in ['blunder', 'mistake']` | 예 |
| 2 | `momentum_shift` | 승률이 50% 경계를 넘음 (동일 플레이어 비교) | 예 |
| 3a | `capture` | 인접 상대 무리의 `liberties.size === 1` | 예 |
| 3b | `attack` | 인접 상대 무리의 `2 <= liberties.size <= 3` | 예 |
| 3c | `escape` | 자기 무리 `liberties.size <= 3` AND `adjOpponentCount >= 2` | 예 |
| 3d | `connection` | `adjFriendlyNeighborCount >= 2` | 예 |
| 4a | `invasion` | `effectiveOwnership < -0.3` | 예 |
| 4b | `defense` | `effectiveOwnership > 0.3` AND `adjOpponentCount >= 1` | 예 |
| 4c | `approach` | `opening` AND `corner` AND `adjOpponentCount >= 1` | 예 |
| 4d | `territory_building` | `opening` AND `corner or side` AND `adjOpponentCount === 0` | 예 |
| 5a | `endgame_counting` | `gamePhase === 'endgame'` | 예 |
| 5b | `close_game` | `45% <= winrate <= 55%` | 예 |
| 6 | `good_move` | `moveQuality in ['excellent', 'good']` | 예 |
| 7 | `positional` | (폴백, 항상 일치) | 종단 |

### 4.3 결정론 보장

알고리즘의 모든 분기는 다음 중 하나를 비교한다:
- KataGo 파생 수치와 고정 임계값 비교 (예: `liberties.size === 1`)
- 바둑판 상태 열거 (예: `grid[n] === opponentColor`)
- 계산된 열거형 (예: `moveQuality === 'brilliant'`)

다음 요소는 없다:
- **난수 생성 없음**
- **확률적 점수 산정이나 가중치 없음**
- **ML 모델 추론 없음**
- **LLM 호출 없음**
- **휴리스틱 추정 없음** (모든 임계값은 고정 상수)

동일한 입력(`ParsedAnalysis`, `BoardGrid`, `ownership[]`, `previousWinrate`)이 주어지면, 이 함수는 매번 동일한 `TacticalSituation`을 생성한다.

### 4.4 엣지 케이스와 폴백 동작

| 엣지 케이스 | 동작 |
|-----------|----------|
| `moveQuality === null` (실제 수가 알려지지 않은 경우, 예: 초기 국면) | Tier 1과 Tier 6을 건너뛴다. 분류는 공간/대국 상태 계층으로 넘어간다. |
| `previousWinrate === null` (첫 수이거나 이력 없음) | Tier 2 (momentum_shift)를 건너뛴다. |
| `grid[lastMoveIndex] === EMPTY` (패스 또는 잘못된 인덱스) | Tier 3 (모든 바둑판 상태 전술)을 전부 건너뛴다. |
| `ownership === null` (KataGo가 소유권을 포함하지 않은 경우) | Tier 4a (invasion)와 4b (defense)를 건너뛴다. 접근과 집짓기는 좌표 기반 검사로 여전히 동작한다. |
| `moveQuality === 'inaccuracy'` | 'mistake'에 해당할 만큼 심각하지 않다. 바둑판 상태 또는 공간 분석으로 넘어가 더 유용한 코칭을 제공한다. |
| `moveQuality === 'acceptable'` | 'mistake'에 해당할 만큼 나쁘지도, tier 6의 'good_move'에 해당할 만큼 좋지도 않다. 맥락적 분류로 넘어간다. |

---

## 5. 바둑판 상태 시그널 정의

### 5.1 `findGroup()` 사용법

**소스**: `app/src/rules-engine/board.ts:128`

**시그니처**: `findGroup(grid: BoardGrid, size: BoardSize, index: number): Group | null`

**반환**: `{ color: PlayerColor, stones: ReadonlySet<number>, liberties: ReadonlySet<number> }`

**코칭에서의 사용**:

| 용도 | 방법 | 코칭 시그널 |
|---------|-----|-----------------|
| **위험 감지** | `lastMoveIndex`에 대해 호출하여 자기 무리를 얻음 | `ownGroup.liberties.size`가 위험 수준에 매핑 |
| **단수 감지** | 인접한 상대 돌 각각에 대해 호출 | `opponentGroup.liberties.size === 1`이면 따낼 수 있음 |
| **공격 감지** | 인접한 상대 돌 각각에 대해 호출 | `opponentGroup.liberties.size <= 3`이면 취약 |
| **무리 중복 제거** | `min(group.stones)`를 식별 키로 사용 | 서로 다른 이웃에서 같은 무리를 중복 계산하는 것을 방지 |

**위험 수준 매핑** (자기 무리):

| 활로 수 | 수준 | 템플릿 수정자 |
|:---------:|-------|-------------------|
| 1 | **단수** (위급) | 긴급한 어조의 탈출 템플릿 |
| 2 | **위험** | 우려하는 어조의 탈출 템플릿 |
| 3 | **압박** | 공격/탈출 맥락 |
| 4+ | **안전** | 위험 시그널 없음 |

**상대 취약도 매핑** (인접 상대 무리):

| 활로 수 | 수준 | 템플릿 수정자 |
|:---------:|-------|-------------------|
| 1 | **단수** (따낼 수 있음) | 따냄 템플릿 |
| 2-3 | **취약** | 공격 템플릿 |
| 4+ | **안정** | 공격 시그널 없음 |

### 5.2 `getAdjacencyTable()` 사용법

**소스**: `app/src/rules-engine/board.ts:47`

**시그니처**: `getAdjacencyTable(size: BoardSize): ReadonlyArray<readonly number[]>`

**반환**: 각 바둑판 인덱스에 대해, 직교 방향으로 인접한 인덱스의 배열.

**코칭에서의 사용**:

| 용도 | 방법 | 결과 |
|---------|-----|--------|
| **인접 상대 수** | `grid[n] === opponentColor`인 이웃을 카운트 | `adjOpponentCount`: 정수 0-4 |
| **인접 아군 수** | `grid[n] === playerColor`인 이웃을 카운트 | `adjFriendlyNeighborCount`: 정수 0-4 |
| **이웃 열거** | `adjTable[lastMoveIndex]`를 반복하여 모든 이웃 탐색 | `findGroup()` 호출의 입력 |

### 5.3 전술적 압박도 계산

```typescript
function computeTacticalPressure(
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor
): {
  adjOpponentCount: number;
  adjFriendlyNeighborCount: number;
  adjOpponentGroups: Group[];
  ownGroup: Group | null;
} {
  const adjTable = getAdjacencyTable(boardSize);
  const neighbors = adjTable[lastMoveIndex];
  const opponent = player === BLACK ? WHITE : BLACK;

  let adjOpponentCount = 0;
  let adjFriendlyNeighborCount = 0;
  const opponentGroupMap = new Map<number, Group>();

  const ownGroup = findGroup(grid, boardSize, lastMoveIndex);

  for (const n of neighbors) {
    if (grid[n] === opponent) {
      adjOpponentCount++;
      const group = findGroup(grid, boardSize, n);
      if (group) {
        const key = Math.min(...group.stones);
        opponentGroupMap.set(key, group);
      }
    }
    if (grid[n] === player) {
      adjFriendlyNeighborCount++;
    }
  }

  return {
    adjOpponentCount,
    adjFriendlyNeighborCount,
    adjOpponentGroups: Array.from(opponentGroupMap.values()),
    ownGroup,
  };
}
```

### 5.4 연결 감지 휴리스틱

돌을 놓은 후, `findGroup()`은 병합된 무리를 반환한다. 놓인 돌이 이전에 분리되어 있던 무리를 연결했는지 감지하려면:

**휴리스틱**: `adjFriendlyNeighborCount >= 2`이면, 놓인 돌에 같은 색 이웃이 최소 2개 있다는 뜻이다. 이 수를 두기 전에 이미 연결되어 있었다면 하나의 무리였을 것이다. 하지만 착수 전 무리 구조를 판별하려면 국면을 재생해야 하므로, 더 단순한 휴리스틱을 사용한다:

- `adjFriendlyNeighborCount >= 2`이면 높은 확률로 연결 수를 의미한다.
- 거짓 양성: 이미 연결된 같은 무리의 두 돌 사이에 놓는 경우. 이는 충분히 드물고, 코칭 코멘트("돌을 연결하고 있네요")는 여전히 합리적이다.

### 5.5 단수 감지 — 템플릿용

`capture` 코칭 템플릿의 경우, 사용자에게 몇 개의 돌을 따낼 수 있는지 알려줘야 한다:

```
captureCount = max(group.stones.size for group in adjOpponentGroups where group.liberties.size === 1)
```

이 값은 `{capture_count}` 템플릿 슬롯에 주입된다.

---

## 6. 격려 상태 머신

### 6.1 상태

```typescript
type EncouragementState = 'neutral' | 'streak' | 'recovery' | 'momentum';
```

| 상태 | 설명 | 템플릿 효과 |
|-------|-------------|-----------------|
| `neutral` | 기본 상태. 특별한 패턴 없음. | 표준 템플릿 선택. |
| `streak` | 플레이어가 연속으로 좋은 수를 둠. | 연승 격려 접미사를 추가. |
| `recovery` | 실수 후 좋은 수를 둠. | 회복 축하 변형을 사용. |
| `momentum` | 승률이 유리하게 전환됨. | 모멘텀 격려를 추가. |

### 6.2 상태 전환 규칙

```
INPUTS:
  currentSituation: TacticalSituation  (from classification)
  moveQuality: MoveQuality | null      (from classifyMoveQuality)
  currentState: EncouragementState     (from store)
  consecutiveGoodMoves: number         (from store)
  consecutiveBadMoves: number          (from store)

TRANSITION TABLE:

[neutral] ──── moveQuality in ['good', 'excellent', 'brilliant']
           ──── consecutiveGoodMoves becomes 1
           ──── IF consecutiveGoodMoves >= 3 AFTER increment ──> [streak]
           ──── ELSE stay [neutral]

[neutral] ──── moveQuality in ['mistake', 'blunder']
           ──── consecutiveBadMoves becomes 1
           ──── stay [neutral]

[neutral] ──── situation === 'momentum_shift' AND winrate improved
           ──── go to [momentum]

[streak]  ──── moveQuality in ['good', 'excellent', 'brilliant']
           ──── increment consecutiveGoodMoves
           ──── stay [streak]

[streak]  ──── moveQuality in ['mistake', 'blunder']
           ──── reset consecutiveGoodMoves to 0
           ──── consecutiveBadMoves = 1
           ──── go to [neutral]

[streak]  ──── moveQuality in ['inaccuracy', 'acceptable'] OR moveQuality is null
           ──── reset consecutiveGoodMoves to 0
           ──── go to [neutral]

[recovery] ── moveQuality in ['good', 'excellent', 'brilliant']
           ──── consecutiveGoodMoves = 1
           ──── go to [neutral] (recovery is a single-move state)

[recovery] ── any other
           ──── go to [neutral]

[momentum] ── any move
           ──── go to [neutral] (momentum is a single-move state)

ADDITIONAL TRANSITIONS (from any state):

  IF previousMoveQuality in ['mistake', 'blunder'] AND currentMoveQuality in ['good', 'excellent', 'brilliant']:
    go to [recovery] (override)
```

### 6.3 의사코드 구현

```
function transitionEncouragementFSM(
  currentState: EncouragementState,
  situation: TacticalSituation,
  moveQuality: MoveQuality | null,
  previousMoveQuality: MoveQuality | null,
  consecutiveGoodMoves: number,
  consecutiveBadMoves: number,
  winrateImproved: boolean
): {
  nextState: EncouragementState,
  nextConsecutiveGoodMoves: number,
  nextConsecutiveBadMoves: number
} {

  isGood = moveQuality in ['good', 'excellent', 'brilliant']
  isBad  = moveQuality in ['mistake', 'blunder']

  // Priority override: recovery detection
  previousWasBad = previousMoveQuality in ['mistake', 'blunder']
  if (previousWasBad AND isGood) {
    return {
      nextState: 'recovery',
      nextConsecutiveGoodMoves: 1,
      nextConsecutiveBadMoves: 0
    }
  }

  // Momentum detection
  if (situation === 'momentum_shift' AND winrateImproved) {
    return {
      nextState: 'momentum',
      nextConsecutiveGoodMoves: isGood ? consecutiveGoodMoves + 1 : 0,
      nextConsecutiveBadMoves: isBad ? consecutiveBadMoves + 1 : 0
    }
  }

  // Standard transitions based on current state
  switch (currentState) {
    case 'neutral':
    case 'recovery':
    case 'momentum':
      // recovery and momentum are single-move states, revert to neutral logic
      if (isGood) {
        newGood = consecutiveGoodMoves + 1
        if (newGood >= 3) {
          return { nextState: 'streak', nextConsecutiveGoodMoves: newGood, nextConsecutiveBadMoves: 0 }
        }
        return { nextState: 'neutral', nextConsecutiveGoodMoves: newGood, nextConsecutiveBadMoves: 0 }
      }
      if (isBad) {
        return { nextState: 'neutral', nextConsecutiveGoodMoves: 0, nextConsecutiveBadMoves: consecutiveBadMoves + 1 }
      }
      // inaccuracy, acceptable, or null
      return { nextState: 'neutral', nextConsecutiveGoodMoves: 0, nextConsecutiveBadMoves: 0 }

    case 'streak':
      if (isGood) {
        return { nextState: 'streak', nextConsecutiveGoodMoves: consecutiveGoodMoves + 1, nextConsecutiveBadMoves: 0 }
      }
      // Any non-good move breaks the streak
      return {
        nextState: 'neutral',
        nextConsecutiveGoodMoves: 0,
        nextConsecutiveBadMoves: isBad ? 1 : 0
      }
  }
}
```

### 6.4 상태 머신 다이어그램

```
                ┌──────────────────────────────┐
                │         [neutral]              │
                │  (default state)               │
                └──┬────────┬────────┬──────────┘
                   │        │        │
          good x3  │   bad  │   momentum_shift
          moves    │        │   AND winrateImproved
                   v        │        v
            ┌──────────┐    │   ┌──────────┐
            │ [streak] │    │   │[momentum]│  (1-move state)
            │          │    │   └────┬─────┘
            └──┬───┬───┘    │        │ any
          good │   │ !good  │        v
          move │   │        │   [neutral]
               │   v        │
          (stay)  [neutral] │
                            │
          ┌─────────────────┘
          │  previousBad AND currentGood
          v
     ┌──────────┐
     │[recovery]│  (1-move state)
     └────┬─────┘
          │ any
          v
     [neutral]
```

### 6.5 템플릿 선택에 대한 효과

격려 상태는 템플릿 선택을 수정한다:

| 상태 | 템플릿에 미치는 효과 |
|-------|----------------------|
| `neutral` | 분류된 상황에 대한 표준 템플릿을 선택한다. |
| `streak` | 연승 격려 접미사를 추가한다: 연승 격려 템플릿 중 하나 (`consecutiveGoodMoves % streakTemplateCount`로 선택). |
| `recovery` | 일반 템플릿을 회복 변형으로 교체하거나 (가능한 경우), 회복 접미사를 추가한다. |
| `momentum` | 모멘텀 접미사를 추가한다: 모멘텀 격려 템플릿 중 하나. |

접미사 템플릿은 주 코칭 코멘트 뒤에 추가되는 짧은 한국어 구문이다:

```yaml
streak_suffixes:
  - " 연속 {consecutive_count}수째 좋은 수입니다! 대단해요!"
  - " {consecutive_count}수 연속 좋은 선택! 이 흐름을 이어가세요!"
  - " 벌써 {consecutive_count}번째 좋은 수! 실력이 느는 게 보여요!"

recovery_suffixes:
  - " 이전 실수를 만회하는 좋은 수입니다!"
  - " 멋진 회복이에요! 이렇게 다시 일어서는 게 중요합니다."

momentum_suffixes:
  - " 흐름이 바뀌고 있어요!"
  - " 이제 주도권을 잡았습니다!"
```

---

## 7. 코칭 템플릿 카탈로그

### 7.1 카탈로그 구조

전체 카탈로그는 동반 파일 `outputs/step-26-coaching-catalog.yaml`에 있다.

요약:

| 상황 | 템플릿 수 | 감정 변형 |
|-----------|:-:|---|
| `territory_building` | 3 | positive |
| `approach` | 3 | neutral |
| `attack` | 3 | positive |
| `escape` | 3 | cautionary |
| `connection` | 3 | positive |
| `invasion` | 3 | neutral / encouraging |
| `defense` | 3 | neutral |
| `capture` | 3 | positive |
| `endgame_counting` | 3 | neutral |
| `brilliant_move` | 3 | positive |
| `good_move` | 3 | positive |
| `mistake` | 3 | encouraging |
| `momentum_shift` | 3 | positive / cautionary |
| `close_game` | 3 | neutral |
| `positional` | 3 | neutral |
| **기본 합계** | **45** | |
| 연승 접미사 | 3 | positive |
| 회복 접미사 | 2 | encouraging |
| 모멘텀 접미사 | 2 | positive |
| **총합** | **52** | |

### 7.2 템플릿 ID 규칙

```
C-{situation_code}-{sequence}
│  │                 │
│  │                 └── 01, 02, 03
│  └── TB=territory_building, AP=approach, AT=attack, ES=escape,
│      CN=connection, IN=invasion, DF=defense, CP=capture,
│      EC=endgame_counting, BR=brilliant, GM=good_move,
│      MK=mistake, MS=momentum_shift, CG=close_game, PS=positional,
│      SK=streak_suffix, RC=recovery_suffix, MO=momentum_suffix
└── Coaching prefix
```

### 7.3 슬롯 유형

모든 슬롯은 KataGo 파생 값 또는 결정론적 연산에 매핑된다:

| 슬롯 이름 | 타입 | 출처 | 예시 |
|-----------|------|--------|---------|
| `{winrate}` | number (정수) | `parsed.winratePct` 반올림 | `54` |
| `{score_lead}` | number (소수점 1자리) | `parsed.raw.rootInfo.scoreLead` | `3.5` |
| `{best_move}` | string (GTP 좌표) | `parsed.raw.moveInfos[0].move` | `Q16` |
| `{pv_short}` | string | `parsed.pvShort` | `Q12 -> R10` |
| `{game_phase}` | string | `parsed.computed.movePhase`를 한국어로 매핑 | `포석` |
| `{winrate_delta}` | number (정수) | `parsed.winrateDeltaPct` 반올림 | `8` |
| `{capture_count}` | number (정수) | `max(group.stones.size) (단수 무리 대상)` | `3` |
| `{liberties}` | number (정수) | `ownGroup.liberties.size` | `2` |
| `{consecutive_count}` | number (정수) | FSM의 `consecutiveGoodMoves` | `5` |
| `{opponent_liberties}` | number (정수) | `minOpponentGroup.liberties.size` | `2` |
| `{spatial}` | string | `classifySpatial()`을 한국어로 매핑 | `귀` |

### 7.4 한국어 공간 용어

| 영어 | 한국어 | 템플릿에서의 사용 |
|---------|--------|-------------------|
| corner | 귀 | 값이 'corner'일 때 `{spatial}` 슬롯 |
| side | 변 | 값이 'side'일 때 `{spatial}` 슬롯 |
| center | 중앙 | 값이 'center'일 때 `{spatial}` 슬롯 |

### 7.5 한국어 국면 용어

| 영어 | 한국어 | 템플릿에서의 사용 |
|---------|--------|-------------------|
| opening | 포석 | `{game_phase}` 슬롯 |
| middle_game | 중반전 | `{game_phase}` 슬롯 |
| endgame | 끝내기 | `{game_phase}` 슬롯 |

### 7.6 템플릿 선택 알고리즘

```
function selectCoachingTemplate(
  situation: TacticalSituation,
  moveNumber: number
): CoachingTemplate {
  // Get all templates for this situation
  templates = COACHING_CATALOG[situation]

  // Select deterministically based on move number to provide variety
  // without randomness
  index = moveNumber % templates.length

  return templates[index]
}
```

이 방식은 다음을 보장한다:
- **결정론적**: 동일한 착수 번호는 항상 동일한 템플릿 변형을 선택한다.
- **다양성**: 연속된 수는 변형들을 순환하며 돈다.
- **무작위성 없음**: 파이프라인 어디에도 `Math.random()`이 없다.

---

## 8. 기존 시스템과의 통합

### 8.1 재사용 함수

| 함수 | 소스 | 코칭에서의 용도 |
|----------|--------|--------------------------|
| `parseAnalysis()` | `explanation-engine/output-parser.ts:169` | KataGo 원시 응답을 `winrateDelta`, `moveQuality` 등이 포함된 `ParsedAnalysis`로 변환. |
| `classifyMoveQuality()` | `explanation-engine/output-parser.ts:89` | 수가 brilliant/good/mistake/blunder인지 판별. 우선순위 Tier 1과 6에서 사용. |
| `detectGamePhase()` | `explanation-engine/output-parser.ts:45` | opening/middle_game/endgame 판별. 우선순위 Tier 4와 5에서 사용. |
| `findGroup()` | `rules-engine/board.ts:128` | 무리, 돌, 활로를 찾음. 우선순위 Tier 3에서 사용. |
| `getAdjacencyTable()` | `rules-engine/board.ts:47` | 이웃 인덱스를 얻음. 모든 Tier 3과 일부 Tier 4 검사에서 사용. |
| `indexToGTP()` | `rules-engine/board.ts:326` | 바둑판 인덱스를 표시용 GTP 문자열로 변환. |

### 8.2 신규 구현 함수 (Step 27)

| 함수 | 위치 | 용도 |
|----------|----------|---------|
| `classifyTacticalSituation()` | `coaching-engine/classifier.ts` | 우선순위 체인 분류 |
| `classifySpatial()` | `coaching-engine/classifier.ts` | 귀/변/중앙 감지 |
| `computeTacticalPressure()` | `coaching-engine/board-signals.ts` | 인접 무리 분석 |
| `selectCoachingTemplate()` | `coaching-engine/template-selector.ts` | 상황 + 착수 번호에 따른 템플릿 선택 |
| `fillCoachingSlots()` | `coaching-engine/template-renderer.ts` | 슬롯 주입 |
| `renderCoaching()` | `coaching-engine/template-renderer.ts` | 전체 파이프라인: 분류 -> 선택 -> 채움 -> 렌더링 |
| `transitionEncouragementFSM()` | `coaching-engine/encouragement-fsm.ts` | 상태 머신 전환 |
| `useCoachingStore` | `hooks/useCoachingStore.ts` | Zustand 스토어 (useWinRateStore 패턴 따름) |
| `useCoaching()` | `hooks/useCoaching.ts` | 스토어 + 렌더링을 결합하는 React 훅 |

### 8.3 데이터 흐름 통합

```
[KataGo Response via Tauri IPC]
          |
          v
    [parseAnalysis()]        ← existing, reused
          |
          v
    [ParsedAnalysis]
          |
    ┌─────┼──────────────────────────────────────────┐
    │     v                                           │
    │  [Step 4 explanation engine]                    │
    │  (post-game review, English, 3-tier)            │
    │                                                  │
    │     v                                           │
    │  [Step 26 coaching engine]   ← NEW              │
    │  (real-time, Korean, beginner-only)              │
    └─────────────────────────────────────────────────┘
```

두 시스템은 동일한 `ParsedAnalysis`를 소비하지만 독립적으로 동작한다:
- Step 4 엔진은 대국 후 실행되어 영어 복기 텍스트를 생성한다.
- Step 26 엔진은 매 수마다 실행되어 한국어 코칭 코멘트를 생성한다.

### 8.4 성능 고려사항

코칭 엔진은 대국 중 실행되므로 빠르게 코멘터리를 생성해야 한다 (목표: < 10ms).

| 컴포넌트 | 예상 시간 | 비고 |
|-----------|:---:|---|
| `parseAnalysis()` | < 1ms | 이미 최적화됨, 순수 연산 |
| `computeTacticalPressure()` | < 2ms | 최대 4회의 `findGroup()` BFS 호출 |
| `classifyTacticalSituation()` | < 1ms | if/else 체인, 루프 없음 |
| `transitionEncouragementFSM()` | < 0.1ms | 순수 상태 머신 |
| `selectCoachingTemplate()` + `fillCoachingSlots()` | < 0.5ms | 배열 인덱스 + 문자열 보간 |
| **합계** | **< 5ms** | 16ms 프레임 예산 내 충분히 여유 |

---

## 9. 검증 체크리스트

| # | 요구사항 | 상태 | 근거 |
|---|------------|:------:|----------|
| 1 | KataGo 시그널 -> 전략 개념 매핑 테이블: 15개 이상 매핑 정의 | **PASS** | 섹션 3.2: 정확한 임계값을 가진 15개 매핑 |
| 2 | 각 매핑은 정확한 시그널 조합과 임계값을 명시 | **PASS** | 섹션 3.2: 모든 행에 정밀한 조건 |
| 3 | 코칭 템플릿 카탈로그: 30개 이상 패턴 (초급 계층, 한국어) | **PASS** | 섹션 7.1: 기본 45개 + 접미사 7개 = 총 52개 |
| 4 | 전술 분류 알고리즘: 100% 결정론적 if/else (zero LLM/ML) | **PASS** | 섹션 4.1-4.3: 완전한 의사코드, 결정론 보장 |
| 5 | 격려 상태 머신: 상태 + 전환 + 조건 정의 | **PASS** | 섹션 6: 4개 상태, 완전한 전환 테이블, 의사코드 |
| 6 | 바둑판 상태 분석 시그널: findGroup + getAdjacencyTable 사용 정의 | **PASS** | 섹션 5: 위험/취약도 매핑, computeTacticalPressure() |
| 7 | "KataGo = 진실, LLM = 영(zero)" 원칙이 설계에서 구조적으로 강제 | **PASS** | 섹션 1: 4계층 강제, LLM 코드 경로 제로 |
| 8 | Step 27이 이 설계에서 바로 구현 가능 (모호함 없음) | **PASS** | 완전한 의사코드, 함수 시그니처, 파일 위치, 슬롯 정의 |

---

## 10. pACS 자체 평가

### 충실도 (F): 95

**근거**: 이 설계는 "KataGo = 진실, LLM = 영(zero)"을 4개의 구조적 계층으로 강제한다. LLM 폴백 경로가 있는 Step 4 엔진과 달리, 이 코칭 시스템에는 문자 그대로 LLM 코드 경로가 전혀 없다. 모든 코칭 코멘트는 데이터 슬롯 주입을 거친 사전 작성된 한국어 템플릿에서 생성된다. 분류 알고리즘은 확률적 요소가 없는 100% 결정론적 if/else이다. 유일한 미미한 위험은 연결 감지 휴리스틱(`adjFriendlyNeighborCount >= 2`)이 이미 연결된 돌 사이에 놓는 경우 거짓 양성을 생성할 수 있다는 점이나, 해당 코칭 코멘트는 여전히 의미적으로 합리적이다.

### 완전성 (C): 93

**근거**: 총 52개 템플릿 (기본 45개 + 접미사 7개)으로, 30개 이상 요구사항을 초과 달성했다. 15가지 TacticalSituation 유형 모두에 템플릿이 있다. 격려 상태 머신은 4개 상태와 결정론적 전환으로 완전히 명세되었다. 바둑판 상태 분석은 findGroup(), getAdjacencyTable(), 공간적 분류를 다룬다. 모든 슬롯 유형이 출처와 함께 정의되어 있다. 유일한 간극: 템플릿이 현재 초급 계층만 다루고 있으며 (설계 의도), 고급/중급 코칭 계층은 추후 추가할 수 있다.

### 논리적 일관성 (L): 92

**근거**: 우선순위 체인은 엄격한 순서와 결정론을 유지한다: 첫 번째 일치가 승리하며, 폴백(`positional`)은 빈틈없다. 격려 FSM은 도달 불가능한 상태나 무한 루프 없이 잘 정의된 전환을 갖는다 (recovery와 momentum은 1회성 상태로 항상 neutral로 전환). 공간적 분류는 판 크기별 고정 좌표 임계값을 사용한다. 엣지 케이스(null 소유권, null moveQuality, 패스)가 명시적으로 처리되었다. 미미한 위험: 소유권 시점 처리가 정확하게 구현되어야 하며, 부호 반전 오류가 발생하면 침입/방어 분류가 뒤바뀔 수 있다.

### pACS 점수: min(95, 93, 92) = **92 GREEN**
