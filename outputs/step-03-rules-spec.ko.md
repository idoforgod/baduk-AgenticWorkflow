# 바둑 도메인 지식 명세: 규칙, 엣지 케이스, 바둑판 표현

**Version**: 1.0.0
**Author**: @domain-expert (Step 3)
**Date**: 2026-03-11
**Consumers**: Step 4 (template-designer), Step 6 (architect), Step 7 (schema-designer), Step 11 (rules-engine implementer), Step 13 (template-engine)
**Ruleset**: Tromp-Taylor (중국식/집 계산)
**Primary Source**: [John Tromp's Go Page](https://tromp.github.io/go.html), [CMU Tromp-Taylor Rules](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html)

---

## 목차

1. [Tromp-Taylor 규칙: 열 가지 논리 규칙](#1-tromp-taylor-rules)
2. [형식적 정의](#2-formal-definitions)
3. [바둑판 표현 명세](#3-board-representation)
4. [Zobrist 해싱 명세](#4-zobrist-hashing)
5. [중국식 계가 알고리즘](#5-chinese-scoring)
6. [엣지 케이스 백과](#6-edge-cases)
7. [점진적 빌드 순서](#7-build-order)
8. [데이터 소스 카탈로그](#8-data-sources)
9. [엔티티 카탈로그](#9-entity-catalog)
10. [관계 카탈로그](#10-relation-catalog)
11. [제약 조건 카탈로그](#11-constraint-catalog)
12. [pACS 자기 평가](#12-pacs)

---

## 1. Tromp-Taylor 규칙: 열 가지 논리 규칙

Tromp-Taylor 규칙은 바둑의 완전한 규칙을 열 개의 문장으로 표현한다. 아래 번호 체계는 John Tromp 웹사이트의 정규 형식을 따른다. 두 가지 형식(8문장 버전과 10문장 버전)이 존재하며, 본 문서에서는 최대한의 명확성을 위해 10문장 확장판을 사용한다.

### 규칙 1: 바둑판 정의

> "Go is played on a 19x19 square grid of points, by two players called Black and White."

**형식적 정의**: 바둑판은 그래프 `G = (V, E)`이며, 여기서 `V = {(r, c) | 0 <= r < N, 0 <= c < N}`이고 바둑판 크기 `N`(표준: N=19; 추가 지원: N=9, N=13)이다. `E`는 직교 인접한 꼭짓점 사이의 간선을 포함한다: `((r1,c1), (r2,c2)) in E` iff `|r1-r2| + |c1-c2| = 1`.

**구현 참고사항**:
- 지원하는 바둑판 크기: 9, 13, 19. 이 세 가지가 표준 크기다.
- 총 교차점 수: `N * N` (각각 81, 169, 361).
- 인접은 4방향 연결(상, 하, 좌, 우)이다. 대각선 인접은 존재하지 않는다.
- 귀(꼭짓점) 교차점은 이웃 2개, 변(가장자리) 교차점은 이웃 3개, 내부 교차점은 이웃 4개를 가진다.

### 규칙 2: 교차점 상태

> "Each point on the grid may be colored black, white, or empty."

**형식적 정의**: 바둑판 상태 `S: V -> {Empty, Black, White}`는 모든 교차점을 세 가지 상태 중 하나로 매핑하는 함수다.

**구현 참고사항**:
- 길이 `N * N`의 `Uint8Array`로 인코딩한다. 값: `0 = Empty`, `1 = Black`, `2 = White`.
- 가능한 총 바둑판 상태 수: `3^(N*N)`. 19x19의 경우: `3^361 ~= 1.74 * 10^172`.

### 규칙 3: 도달(연결성)

> "A point P, not colored C, is said to reach C, if there is a path of (vertically or horizontally) adjacent points of P's color from P to a point of color C."

**형식적 정의**: 바둑판 상태 S에서 교차점 P의 상태를 `color(P)`라 하자. 교차점 P가 색 C에 **도달**하는 조건은:
- `color(P) != C` (P는 색 C가 아님), 그리고
- 다음과 같은 교차점 시퀀스 `P = P0, P1, ..., Pk` (`k >= 1`)가 존재:
  1. 모든 `i in [0, k-1]`에 대해: `(Pi, Pi+1) in E` (직교 인접).
  2. 모든 `i in [0, k-1]`에 대해: `color(Pi) = color(P)` (경로가 P 자신의 색을 따름).
  3. `color(Pk) = C` (종단점의 색이 C).

참고: P는 자기 자신의 색에 도달하지 않는다(정의에 의해 `color(P) != C`가 필요). 경로 길이 `k >= 1`은 최소 한 단계가 필요함을 의미한다. 흑돌은 자신(또는 연결된 흑돌)이 빈 교차점에 인접해 있으면 빈점에 도달한다. 흑돌은 자신(또는 연결된 흑돌)이 백돌에 인접해 있으면 백색에 도달한다.

**구현 참고사항**:
- "도달"은 다음과 동일하다: P에서 시작하여 P와 같은 색의 교차점을 통해 범람 채우기(BFS/DFS)를 수행하고, 범람 채우기된 영역의 인접점 중 색 C를 가진 것이 있는지 확인한다.
- 돌 무리가 "빈점에 도달"하면 해당 무리는 활로(liberty)가 하나 이상 있다는 뜻이다.
- 돌 무리가 상대 색에 "도달"하면 무리 내 어떤 돌이 상대 돌에 인접해 있다는 뜻이다.

### 규칙 4: 제거

> "Clearing a color means removing (setting to empty) all points of that color that do not reach empty."

**형식적 정의**: `Clear(S, C)`는 새로운 바둑판 상태 S'를 생성하며:
- `color(P) = C`인 모든 교차점 P에 대해: P가 상태 S에서 빈점에 도달하지 못하면 `S'(P) = Empty`.
- 나머지 모든 교차점은 변경되지 않는다.

**구현 참고사항**:
- 제거 작업은 색 C의 모든 연결된 무리를 식별해야 한다.
- 각 무리에 대해 빈점에 도달하는지(즉, 활로가 하나 이상 있는지) 확인한다.
- 활로가 0인 무리는 제거된다(모든 돌이 빈점으로 설정).
- 단일 제거 연산으로 여러 분리된 무리를 동시에 제거할 수 있다.
- Union-Find 또는 BFS/DFS를 사용하여 연결된 무리를 식별한다.

### 규칙 5: 교대

> "Starting with an empty grid, the players alternate turns, starting with Black."

**형식적 정의**: 수 번호 k(0 기반 인덱스)에서 차례인 선수를 `turn(k)`라 하자. `turn(0) = Black`. `turn(k) = k가 짝수이면 Black, 홀수이면 White`.

**구현 참고사항**:
- 초기 바둑판 상태는 모두 빈점이다.
- 패스(pass)는 차례를 바꾸지 않는다: 흑이 패스한 후에는 백의 차례다.
- 현재 선수를 단일 비트 또는 열거형으로 추적한다.

### 규칙 6: 차례 선택지

> "A turn is either a pass; or a move that doesn't repeat an earlier grid coloring."

**형식적 정의**: 각 차례에서 선수는 다음 중 정확히 하나를 수행해야 한다:
1. **패스**: 바둑판 상태가 변경되지 않는다.
2. **착수**: 돌을 놓고, 따냄과 자충을 적용(규칙 7)하여 새로운 바둑판 상태를 생성한다. 결과 바둑판 상태는 게임 기록의 어떤 이전 바둑판 상태와도 동일하면 안 된다(위치적 초과패).

**구현 참고사항**:
- **위치적 초과패(Positional Superko, PSK)**: 착수 후 결과 바둑판 상태가 누구의 차례였는지와 관계없이 이전의 어떤 바둑판 상태와도 일치하면 안 된다. 이는 단순 패(직전 2수 전 상태만 비교)보다 더 제한적이다.
- 모든 바둑판 상태의 해시를 `Set<bigint>`에 저장하여 O(1) 초과패 검색을 수행한다.
- CMU 버전은 "해당 선수가 이전에 남긴 것과 동일한 격자 패턴을 남기지 않는 착수"라고 명시하는데, 이는 **상황적 초과패(Situational Superko, SSK)**이다. Tromp 웹사이트는 PSK를 사용한다. **본 명세는 PSK**(위치적 초과패)를 채택하며, 이는 더 단순하고 컴퓨터 바둑에서 더 널리 사용되기 때문이다.
- PSK 하에서 착수 결과 바둑판 해시가 이미 기록 집합에 존재하면 해당 착수는 위법이다.

### 규칙 7: 착수 메커니즘

> "A move consists of coloring an empty point one's own color; then clearing the opponent color, and then clearing one's own color."

**형식적 정의**: 선수 P가 교차점 V에 착수(`S(V) = Empty`인 경우)하면 세 가지 원자적 하위 단계로 진행된다:
1. **놓기**: `S(V) = P` 설정(돌 놓기).
2. **따냄**: `S = Clear(S, opponent(P))` (활로가 0인 모든 상대 무리 제거).
3. **자충**: `S = Clear(S, P)` (활로가 0인 모든 자기 무리 제거 -- 이것이 자충이다).

순서가 핵심이다: 따냄이 자충보다 먼저 일어난다.

**구현 참고사항**:
- 1단계(놓기) 후, 놓인 돌의 활로가 0일 수 있지만, 인접한 상대 무리 역시 활로가 0일 수 있다.
- 2단계(따냄)는 놓인 돌로 인해 마지막 활로를 잃은 상대 무리를 제거한다. 이로써 놓인 돌에 새로운 활로가 생길 수 있다.
- 3단계(자충)는 상대 따냄이 처리된 후에도 놓인 돌의 무리가 여전히 활로 0이면 해당 무리를 제거한다.
- **상호 배타성**: 주어진 착수에서 {따냄, 자충} 중 최대 하나만 효과가 있다. 놓인 돌이 상대 돌을 따내면 최소 하나의 활로를 얻으므로 자충이 적용될 수 없다. 상대 돌이 따내지 않으면 자충이 적용될 수 있다.
- Tromp-Taylor 규칙에서 자충은 합법이다. 선수는 자신의 돌과 무리가 제거되는 결과를 낳는 착수를 할 수 있다.

### 규칙 8: 게임 종료

> "The game ends after two consecutive passes."

**형식적 정의**: 수 기록에서 마지막 두 행동이 모두 패스이면 게임이 종료된다. 형식적으로: `action(k) = Pass`이고 `action(k-1) = Pass`이면 게임이 끝난다.

**구현 참고사항**:
- 연속 패스 카운터를 추적한다. 패스 시 증가, 착수 시 0으로 초기화한다.
- 카운터가 2에 도달하면 게임은 계가 단계에 진입한다.
- 패스가 허용되기 전 필수 수 수는 없다.
- 기권(resignation)은 Tromp-Taylor 규칙의 일부가 아니지만 관행적인 게임 종료 행동이다. 별도의 게임 흐름 이벤트로 구현한다.

### 규칙 9: 계가

> "A player's score is the number of points of her color, plus the number of empty points that reach only her color."

**형식적 정의**: 바둑판 상태 S에서 게임이 종료된 후:
- `Score(P) = |{V | S(V) = P}| + |{V | S(V) = Empty AND V reaches P AND V does NOT reach opponent(P)}|`
- 풀어서 말하면: 자기 돌의 수 + 자기 색으로만 완전히 둘러싸인 빈 교차점(집)의 수.

**구현 참고사항**:
- 이것은 **집 계산**(중국식) 방식이다. 바둑판 위의 돌과 둘러싸인 빈 영역(집) 모두 계산한다.
- 흑과 백 모두에 도달하는 빈 교차점은 **공배**(dame)이며 어느 쪽에도 계산되지 않는다.
- 흑과 백 어느 쪽에도 도달하지 않는 빈 교차점은 비어 있지 않은 바둑판에서는 불가능하다(표준 위상에서는 모든 돌로부터 완전히 격리될 수 없다).
- 빈 영역은 빈 교차점의 연결 성분(connected component)이다. 각 영역은 하나 또는 두 색에 도달한다. 정확히 한 색에만 도달하면 해당 색의 집이다. 양쪽에 도달하면 공배다.
- 덤(Komi, 백에 대한 선수 보상)이 백의 점수에 더해진다. 표준 덤: 7.5 (19x19), 5.5 (13x13), 5.5 (9x9). 0.5는 동점을 방지한다.

### 규칙 10: 승자 결정

> "The player with the higher score at the end of the game is the winner. Equal scores result in a tie."

**형식적 정의**: `FinalScore(Black) = Score(Black)`, `FinalScore(White) = Score(White) + Komi`로 하자.
- `FinalScore(Black) > FinalScore(White)`: 흑이 `FinalScore(Black) - FinalScore(White)`집 차이로 승리.
- `FinalScore(White) > FinalScore(Black)`: 백이 `FinalScore(White) - FinalScore(Black)`집 차이로 승리.
- `FinalScore(Black) = FinalScore(White)`: 무승부(빅).

**구현 참고사항**:
- 0.5 덤을 사용하면 실전에서 무승부는 불가능하다.
- 정수 덤(예: 7)은 무승부를 허용한다.
- 결과 문자열 형식: `"B+5.5"` (흑 5.5집 승), `"W+0.5"` (백 0.5집 승), 또는 `"0"` (무승부).
- 기권 결과: `"B+R"` 또는 `"W+R"`.
- 시간 패배 결과: `"B+T"` 또는 `"W+T"`.

---

## 2. 형식적 정의

### 2.1 핵심 용어

| 용어 | 한국어 (로마자) | 정의 |
|------|----------------|------|
| **Intersection** | 교차점 (Gyo-cha-jeom) | 바둑판 격자 위의 교차점 `(r, c)`, `0 <= r < N`, `0 <= c < N`. |
| **Stone** | 돌 (Dol) | 교차점에 놓인 흑돌 또는 백돌. |
| **Empty** | 빈점 (Bin-jeom) | 돌이 놓이지 않은 교차점. |
| **Adjacent** | 인접 (In-jeop) | 두 교차점 `(r1,c1)`과 `(r2,c2)`가 `|r1-r2| + |c1-c2| = 1`이면 인접. |
| **Group** (별칭: Chain, String) | 무리 (Mu-ri) | 같은 색 돌의 최대 연결 집합. 직교 인접을 통해 도달 가능한 것을 연결이라 한다. |
| **Liberty** | 활로 (Hwal-ro) | 무리에 인접한 빈 교차점. 무리의 활로 수는 무리 내 어떤 돌에든 인접한 고유한 빈 교차점의 수다. |
| **Capture** | 따냄 (Ttam) | 돌을 놓은 후 활로가 0이 된 상대 무리를 제거하는 것. |
| **Suicide** | 자충 (Ja-chung) | 자기 무리가 제거되는 결과를 낳는 착수(Tromp-Taylor에서 합법). |
| **Ko** | 패 (Pae) | 두 선수가 단일 돌을 무한히 교대로 따내고 되따낼 수 있는 바둑판 위치 패턴. 초과패 하에서 되따냄은 금지된다. |
| **Superko** | 초과패 (Choguepae) / Positional Superko | 게임 중 바둑판 위치가 반복될 수 없다는 규칙(규칙 6). |
| **Territory** | 집 (Jip) | 정확히 한 색에만 도달하는 빈 교차점. |
| **Dame** | 공배 (Gongbae) | 흑과 백 모두에 도달하거나 집이 아닌 중립적 빈 교차점. |
| **Komi** | 덤 (Deom) | 흑의 선수 이점에 대한 백의 보상 점수. |
| **Atari** | 단수 (Dan-su) | 활로가 정확히 1개 남은 무리. |
| **Seki** | 빅 (Bik) | 상호생: 서로를 따낼 수 없는 상태의 대립하는 색의 무리들. 어느 쪽이든 따내려 하면 자기가 단수에 빠진다. |
| **Eye** | 눈 (Nun) | 한 색의 돌로 완전히 둘러싸인 빈 교차점(둘러싼 무리가 살아 있어야 함). |
| **Pass** | 패스 (Pas) | 선수가 돌을 놓지 않는 차례. |
| **Move** | 수 (Su) | 선수가 빈 교차점에 돌을 놓는 차례. |

### 2.2 파생 개념

| 개념 | 정의 |
|------|------|
| **살아 있음(Alive)** | 상대의 어떤 수를 두어도 따낼 수 없는 무리. 충분 조건: 진눈 2개 이상. 빅(seki)으로도 살 수 있다. |
| **죽어 있음(Dead)** | 소유자의 방어와 관계없이 따낼 수 있는 무리. Tromp-Taylor/중국식 규칙에서 실제로 따내지 않은 죽은 돌은 바둑판에 그대로 남아 있으며, 따낸 경우에만 상대의 계가에 반영된다. 선수는 패스하기 전에 죽은 돌을 따내야 하며, 그렇지 않으면 그대로 유지된다. |
| **진눈(True Eye)** | 다음 조건을 만족하는 빈 교차점: (1) 직교 인접한 모든 교차점이 같은 색의 돌(또는 바둑판 밖), 그리고 (2) 귀(코너) 교차점: 바둑판 내 대각선 인접 교차점 1개가 아군 돌; 변(엣지) 교차점: 바둑판 내 대각선 인접 교차점 2개 중 최소 2개가 아군 돌; 내부 교차점: 대각선 인접 교차점 4개 중 최소 3개가 아군 돌. |
| **거짓눈(False Eye)** | 눈처럼 보이지만 하나 이상의 대각선 이웃이 상대 돌이어서 상대가 채울 수 있는 빈 교차점. |
| **연결됨(Connected)** | 같은 색의 두 돌이 직교 인접한 같은 색 돌의 경로를 통해 연결 가능한 상태. |
| **끊음(Cut)** | 이전에 연결되어 있던 상대 두 무리 사이에 돌을 놓는 것. |
| **따냄 수(Capture Count)** | 게임 중 바둑판에서 제거된 상대 돌의 총 수(UI용으로 추적하며, 집 계산에는 사용하지 않음). |

---

## 3. 바둑판 표현 명세

### 3.1 기본 데이터 구조: 1D Uint8Array

```
Board: Uint8Array of length N * N (row-major order)
```

**셀 인코딩**:
| 값 | 의미 | TypeScript 상수 |
|----|------|-----------------|
| 0 | 빈점 | `EMPTY = 0` |
| 1 | 흑 | `BLACK = 1` |
| 2 | 백 | `WHITE = 2` |

**인덱스 변환**:
```
index = row * boardSize + col
row = Math.floor(index / boardSize)
col = index % boardSize
```

**인접 교차점 계산**:
주어진 인덱스 `i`와 바둑판 크기 `N`에 대해:
```
neighbors(i, N) = [
  i - N,     // up    (valid if row > 0)
  i + N,     // down  (valid if row < N - 1)
  i - 1,     // left  (valid if col > 0)
  i + 1,     // right (valid if col < N - 1)
]
```

유효성 검사로 순환(wrap-around)을 방지한다:
- 위: `i >= N`
- 아래: `i < N * (N - 1)`
- 왼쪽: `i % N !== 0`
- 오른쪽: `i % N !== N - 1`

### 3.2 사전 계산된 인접 테이블

성능을 위해 초기화 시 이웃 테이블을 사전 계산한다:

```
adjacencyTable: Int16Array[] of length N * N
adjacencyTable[i] = array of valid neighbor indices for intersection i
```

각 항목은 2~4개의 요소를 가진다. 19x19 기준 총 메모리: `361 * 4 * 2 bytes = ~2.9 KB`.

### 3.3 바둑판 상태 객체

```typescript
interface BoardState {
  size: 9 | 13 | 19;
  grid: Uint8Array;           // length = size * size
  hash: bigint;               // Zobrist hash of the current position
  koPoint: number | null;     // simple ko point (optimization; superko still checked via history)
  capturedByBlack: number;    // total white stones captured by Black
  capturedByWhite: number;    // total black stones captured by White
}
```

### 3.4 게임 상태 객체

```typescript
interface GameState {
  board: BoardState;
  currentPlayer: 1 | 2;      // BLACK = 1, WHITE = 2
  moveHistory: MoveRecord[];  // ordered list of all moves/passes
  positionHashes: Set<bigint>;// all previous board hashes (for superko)
  consecutivePasses: number;  // 0, 1, or 2
  moveNumber: number;         // 0-indexed count of turns taken
  komi: number;               // e.g., 7.5
  result: GameResult | null;  // null while game is in progress
}
```

### 3.5 수 기록

```typescript
type MoveRecord =
  | { type: 'move'; player: 1 | 2; index: number; captured: number[]; hash: bigint }
  | { type: 'pass'; player: 1 | 2; hash: bigint }
  | { type: 'resign'; player: 1 | 2 };
```

### 3.6 무리 표현

```typescript
interface Group {
  color: 1 | 2;
  stones: Set<number>;        // set of board indices
  liberties: Set<number>;     // set of board indices of empty adjacent points
}
```

**무리 탐색**: 임의의 돌에서 시작하여 같은 색의 인접 경로를 따라 BFS/DFS를 수행한다. 방문한 돌을 표시하여 재탐색을 방지한다. 무리의 활로는 무리 내 모든 돌의 고유한 빈 이웃들이다.

### 3.7 메모리 예산

| 바둑판 크기 | 격자 메모리 | 인접 테이블 | Zobrist 테이블 | 합계 |
|------------|------------|------------|---------------|------|
| 9x9 | 81 bytes | ~648 bytes | 1,296 bytes | ~2 KB |
| 13x13 | 169 bytes | ~1,352 bytes | 2,704 bytes | ~4.2 KB |
| 19x19 | 361 bytes | ~2,888 bytes | 5,776 bytes | ~9 KB |

---

## 4. Zobrist 해싱 명세

### 4.1 개요

Zobrist 해싱은 각 착수 후 바둑판 해시를 O(1)로 점진적 갱신할 수 있게 한다. 이 해시는 위치적 초과패 감지(규칙 6)에 사용된다.

### 4.2 해시 테이블

```
zobristTable: bigint[2][N * N]
```

- `zobristTable[0][i]` = 인덱스 `i`에 흑돌이 있을 때의 랜덤 64비트 값.
- `zobristTable[1][i]` = 인덱스 `i`에 백돌이 있을 때의 랜덤 64비트 값.

19x19 기준: `2 * 361 = 722`개의 랜덤 64비트 값.

### 4.3 초기화

고정 시드를 사용한 시드 PRNG(예: xoshiro256**)로 `zobristTable`을 생성하여 세션 간 결정적이고 재현 가능한 해시를 보장한다.

```
seed = 0x4BAD_UCK_G0_2026n  // fixed seed, any arbitrary value
for color in [0, 1]:         // 0 = Black mapping, 1 = White mapping
  for i in [0, N*N):
    zobristTable[color][i] = prng.nextBigInt64()
```

PRNG은 균일한 64비트 값을 생성해야 한다. 400수 게임에서 64비트 해시의 충돌 확률: 쌍당 약 `400^2 / 2^64 ~= 8.7 * 10^-15`로 무시할 수 있는 수준이다.

### 4.4 해시 계산

**전체 바둑판 해시** (초기화 또는 검증용):
```
hash = 0n
for i in [0, N*N):
  if grid[i] === BLACK:
    hash ^= zobristTable[0][i]
  else if grid[i] === WHITE:
    hash ^= zobristTable[1][i]
```

### 4.5 점진적 갱신

색 `c`의 돌을 인덱스 `i`에 놓을 때:
```
hash ^= zobristTable[c - 1][i]   // c is 1 (BLACK) or 2 (WHITE); index into table is c-1
```

색 `c`의 돌을 인덱스 `i`에서 제거(따냄)할 때:
```
hash ^= zobristTable[c - 1][i]   // XOR is its own inverse
```

**전체 착수 갱신**:
1. 놓인 돌을 XOR로 추가.
2. 따낸 각 돌에 대해 해당 돌을 XOR로 제거.
3. 자충된 각 돌에 대해 해당 돌을 XOR로 제거.

### 4.6 초과패 감지

```
// Before finalizing a move:
const newHash = computeHashAfterMove(currentHash, placedIndex, capturedIndices, selfCapturedIndices);
if (positionHashes.has(newHash)) {
  // Move is ILLEGAL (positional superko violation)
}
// After finalizing:
positionHashes.add(newHash);
```

### 4.7 단순 패 최적화

위치적 초과패가 모든 경우를 처리하지만, 단순 패가 패 상황의 99% 이상을 차지한다. 패점(ko point)을 별도로 추적하면 빠른 사전 필터링이 가능하다.

단순 패점은 다음 조건을 만족하는 착수 후 존재한다:
1. 정확히 하나의 돌을 따냈다.
2. 따낸 돌의 활로가 정확히 하나(따냄으로 방금 비워진 지점)이다.
3. 따낸 돌이 단독(무리 크기 1)이다.

이 조건이 충족되면 따낸 돌의 위치를 `koPoint`로 저장한다. 상대는 다음 차례에 즉시 `koPoint`에 착수할 수 없다. 다른 착수나 패스 후에는 `koPoint`를 해제한다.

이 최적화는 일반적인 경우에 전체 초과패 해시 집합을 확인하는 것을 피할 수 있지만, 복잡한 초과패 상황에서의 정확성을 위해 해시 집합 확인은 여전히 수행되어야 한다.

---

## 5. 중국식 계가 알고리즘

### 5.1 전제 조건

중국식 계가(집 계산)는 게임 종료(연속 두 번 패스) 후 수행된다. Tromp-Taylor 규칙에서 따내지 않은 죽은 돌은 바둑판에 그대로 남아 해당 돌의 색을 가진 선수에게 계산된다. 선수는 죽은 돌을 제거하고 싶다면 패스하기 전 플레이 중에 따내야 한다.

### 5.2 알고리즘: 단계별 설명

```
function chineseScore(board: BoardState, komi: number): ScoreResult {

  // Step 1: Count stones on the board
  let blackStones = 0;
  let whiteStones = 0;
  for (let i = 0; i < board.size * board.size; i++) {
    if (board.grid[i] === BLACK) blackStones++;
    else if (board.grid[i] === WHITE) whiteStones++;
  }

  // Step 2: Identify empty regions (connected components of empty points)
  const visited = new Uint8Array(board.size * board.size);  // 0 = unvisited
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let dame = 0;

  for (let i = 0; i < board.size * board.size; i++) {
    if (board.grid[i] !== EMPTY || visited[i]) continue;

    // BFS/DFS to find connected empty region
    const region: number[] = [];
    let reachesBlack = false;
    let reachesWhite = false;
    const queue = [i];
    visited[i] = 1;

    while (queue.length > 0) {
      const current = queue.shift()!;
      region.push(current);

      for (const neighbor of adjacencyTable[current]) {
        if (board.grid[neighbor] === BLACK) {
          reachesBlack = true;
        } else if (board.grid[neighbor] === WHITE) {
          reachesWhite = true;
        } else if (!visited[neighbor]) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }

    // Step 3: Classify the region
    if (reachesBlack && !reachesWhite) {
      blackTerritory += region.length;
    } else if (reachesWhite && !reachesBlack) {
      whiteTerritory += region.length;
    } else {
      // Reaches both or neither: dame (neutral)
      dame += region.length;
    }
  }

  // Step 4: Compute final scores
  const blackScore = blackStones + blackTerritory;
  const whiteScore = whiteStones + whiteTerritory + komi;

  // Step 5: Determine winner
  let result: string;
  if (blackScore > whiteScore) {
    result = `B+${blackScore - whiteScore}`;
  } else if (whiteScore > blackScore) {
    result = `W+${whiteScore - blackScore}`;
  } else {
    result = '0';  // Tie (jigo)
  }

  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    dame,
    komi,
    blackScore,
    whiteScore,
    result,
  };
}
```

### 5.3 계가 속성

1. `blackStones + whiteStones + blackTerritory + whiteTerritory + dame = N * N` (모든 교차점이 빠짐없이 계산됨).
2. 집 계산 방식에서는 잡힌 돌(포로)을 별도로 세지 않는다; 바둑판 위의 돌 수에 이미 반영되어 있다.
3. 양 선수가 집 계산 방식에서 최적으로 두면 마지막 수는 중요하지 않다(집 계산이 아닌 영역 계산에서는 중요).

### 5.4 중국식 규칙에서의 빅(Seki) 계가

중국식/집 계산 방식에서 빅 상태의 무리는 살아 있으며, 해당 돌은 소유자의 점수에 포함된다. 공유 활로(흑과 백 빅 무리 모두에 인접한 빈 교차점)는 양쪽 색에 도달하므로 공배이며 양 선수 모두에게 0점이다. 표준 알고리즘 외에 별도 처리가 필요 없다.

### 5.5 Tromp-Taylor에서의 죽은 돌 처리

Tromp-Taylor 규칙에서는 "사석 합의" 단계가 없다. 게임 종료 시 바둑판 위의 모든 돌은 있는 그대로 계산된다. 선수가 상대 무리가 죽어 있다고 판단하면, 플레이 중에 직접 따내야 한다. 이로써 사활에 대한 모든 모호함이 제거되며, 대신 죽은 돌을 따내기 위한 추가 수가 필요하다.

---

## 6. 엣지 케이스 백과

### EC-01: 단순 패(Simple Ko)

**설명**: 가장 흔한 패. 단일 돌이 단일 돌을 따내고, 상대가 즉시 되따낼 수 있는 상황.

**형식적 조건**: 선수 P가 인덱스 V에 돌을 놓아 인덱스 W에 있는 상대 돌 하나를 따낸 후, 결과 위치에서 V의 돌은 정확히 하나의 활로(W 지점)를 가진다. 상대가 W에 착수하면 V의 돌을 따내어 이전 바둑판 상태를 재현하게 된다.

**규칙 적용**: 위치적 초과패(규칙 6) 하에서 W에서의 되따냄은 이전 바둑판 상태를 재현하므로 금지된다. 단순 패(최적화) 하에서는 W를 패점으로 저장하며, 상대는 바로 다음 차례에 W에 착수할 수 없다.

**감지**: 따냄 후:
1. 정확히 하나의 돌이 따내졌다.
2. 놓인 돌이 크기 1의 무리를 형성한다.
3. 놓인 돌의 활로가 정확히 하나(따낸 돌의 위치)이다.

### EC-02: 환격(Snapback)

**설명**: 한 선수가 상대 돌을 따낼 수 있지만, 상대가 즉시 더 많은 돌을 되따낼 수 있는 상황. 되따냄 후 바둑판 위치가 다르므로(더 많은 돌이 제거됨) 패가 아니다.

**예시**: 흑이 활로 1개인 3돌 무리를 가지고 있다. 백이 해당 활로에 착수하여 따낸다. 그러면 흑이 백이 방금 비운 지점에 착수하여 2돌 이상의 백 무리를 따낸다. 바둑판 상태가 원래와 실질적으로 다르므로 초과패가 적용되지 않는다.

**형식적 조건**: 선수 A가 V에 놓아 B의 돌을 따낸다. 선수 B가 비워진 지점 중 하나에 착수하여 A의 무리(방금 V에 놓은 돌과 다른 돌 포함)를 따낸다. 더 많은 돌이 제거되었으므로 결과 바둑판 상태는 이전의 어떤 상태와도 다르다.

**규칙 적용**: 환격은 합법이다. 되따냄 후 바둑판 상태가 새로운 것이므로 패 제한의 대상이 아니다.

**구현 참고사항**: 패점 최적화가 환격을 패로 잘못 표시해서는 안 된다. 확인: 따낸 돌이 2개 이상이거나, 따낸 무리의 크기가 2개 이상이면 단순 패가 아니다.

### EC-03: 쌍패(Double Ko)

**설명**: 바둑판 위에 두 개의 독립적인 단순 패 위치. 한 선수가 하나의 패를 다른 패에 대한 "위협"으로 사용할 수 있어 복잡한 전략적 상황이 발생한다.

**형식적 조건**: 두 개의 독립적 영역에 각각 단순 패 형태가 있다. 각 패는 독립적으로 따낼 수 있다. 위치적 초과패 하에서 결합된 바둑판 상태가 반복되므로 순환이 결국 끊어진다.

**규칙 적용**: 위치적 초과패가 무한 순환을 방지한다. 여러 번의 패 따냄 후, 한 선수는 결과 바둑판 상태가 이전과 일치하므로 되따낼 수 없게 된다.

### EC-04: 삼패(Triple Ko)

**설명**: 바둑판 위에 세 개의 독립적인 패 위치. 초과패 없이는 선수들이 세 패를 순환하며 무한히 반복할 수 있다.

**형식적 조건**: 세 개의 독립적 영역에 각각 단순 패가 있다. 선수들이 세 패를 번갈아 따낼 수 있다. 위치적 초과패 하에서 바둑판 위치가 결국 반복되고 이러한 착수가 금지되므로 순환할 수 없다.

**규칙 적용**: Tromp-Taylor PSK 하에서 삼패 상황은 초과패 규칙으로 해결된다. 일부 착수가 위법이 되어 선수들은 다른 곳에 착수하거나 패스해야 한다.

### EC-05: 만년패(Eternal Ko, Chosei)

**설명**: 따냄이 새로운 패 상황을 끝없이 만들어내는, 더 큰 무리를 포함하는 패와 유사한 순환.

**형식적 조건**: 2돌 이상의 무리를 포함하는 따냄과 되따냄의 순환적 시퀀스로, 같은 바둑판 위치가 재발생한다. 순환에 최소 4수가 포함된다.

**규칙 적용**: 위치적 초과패(규칙 6)가 이를 방지한다. 이전 바둑판 상태를 재현하는 모든 착수는 위법이다.

### EC-06: 사패(Quadruple Ko)

**설명**: 네 개의 독립적인 패 상황. 삼패보다도 드물다. 이론적 문제와 창작 문제에서 이 패턴이 시연된다.

**규칙 적용**: 삼패와 동일; 위치적 초과패가 순환을 방지한다.

### EC-07: 빅(Seki, 상호생)

**설명**: 대립하는 두 무리가 활로를 공유하여, 어느 선수도 상대를 따낼 수 없는 위치. 따내려 하면 자기 무리가 단수에 빠지거나(먼저 따내지게) 된다.

**형식적 조건**: 무리 G_b(흑)와 G_w(백)이 빅 상태인 조건:
1. G_b도 G_w도 진눈 2개를 가지지 않는다.
2. G_b와 G_w 모두에 인접한 빈 교차점(공유 활로)에 어느 선수가 착수하든 해당 선수의 무리가 따낼 수 있게 된다.
3. 어느 한 선수의 수 시퀀스로도 상대의 무리를 따낼 수 없으며, 상대가 방어할 수 있다.

**계가**: 중국식/집 계산 방식에서 빅 무리의 돌은 각 소유자의 점수에 포함된다. 공유 활로는 공배(0점)다.

**빅의 유형**:
- **기본 빅**: 두 무리가 1~2개의 활로를 공유하며 어느 쪽도 착수할 수 없다.
- **눈이 있는 빅**: 한쪽 또는 양쪽 무리가 눈 하나와 공유 활로를 가진다.
- **세 무리 빅**: 세 무리(한 색 2개, 다른 색 1개)가 상호생 상태.

### EC-08: 귀의 굽은 사궁(Bent Four in the Corner)

**설명**: 바둑판 귀에 네 개의 돌이 꺾인 줄로 배열된 특정 형태. 한 선수의 무리가 귀의 2x3 영역을 특정 돌 배치로 점유한다.

**형식적 조건**: 4돌의 무리가 귀에서 L자형(귀의 굽은 사궁)을 형성하고, 상대 돌이 이를 둘러싸고 있다. 상태는 바둑판 다른 곳의 패 위협에 따라 달라진다.

**Tromp-Taylor/중국식 규칙에서**: 귀의 굽은 사궁은 자동적으로 죽은 것이 아니다. 실제로 두어 봐야 한다. 방어자에게 충분한 패 위협이 있으면 무리가 살 수 있다. 그렇지 않으면 공격자가 패싸움으로 따낼 수 있다. 이는 귀의 굽은 사궁을 규칙에 의해 죽은 것으로 선언하는 일본식 규칙과 다르다.

**구현 참고사항**: 특수 케이스 코드가 필요 없다. 표준 규칙(놓기, 따냄, 초과패)이 이를 올바르게 처리한다.

### EC-09: 두 눈 살이(Two-Eye Life)

**설명**: 진눈 2개 이상을 가진 무리는 따낼 수 없다. 상대가 두 눈을 동시에 채울 수 없기 때문이다(그렇게 하면 자충이 된다).

**형식적 조건**: 무리 G가 진눈 E1과 E2(모두 G 색의 돌로 완전히 둘러싸이고 대각선 조건 충족)를 가진다. G를 따내려면 상대가 G의 모든 활로를 채워야 한다. 그러나 마지막 두 활로가 E1과 E2이고, 다른 하나가 아직 빈 상태에서 하나에 착수하는 것은 자충이다(무리에 아직 활로가 있다).

**구현 참고사항**: 사활 판정은 Tromp-Taylor 규칙의 올바른 게임 플레이나 계가에 필요하지 않다(선수가 죽은 돌을 직접 따내야 함). AI 분석 및 해설 기능(Step 13 template engine)에 필요하다.

### EC-10: 거짓눈(False Eye)

**설명**: 눈처럼 보이지만 대각선 통제가 불충분하여 진눈이 아닌 빈 교차점.

**형식적 조건**: 빈 교차점 V가 무리 G의 거짓눈인 조건:
1. 바둑판 위에 있는 V의 모든 직교 이웃이 G 색의 돌이다.
2. 그러나 대각선 조건이 실패: 내부 교차점의 경우 대각선 이웃 중 2개 이상이 상대 돌이거나 빈점; 변 교차점의 경우 1개 이상; 귀 교차점의 경우 1개.

**결과**: 상대가 결국 V를 채울 수 있어 무리의 눈 수가 줄어든다. 거짓눈만 있는 무리(진눈이 없거나 하나만 있는)는 죽을 수 있다.

### EC-11: 연결하면 죽음(Connect-and-Die, Uttegaeshi)

**설명**: 두 무리를 하나로 연결하는 것이 오히려 결합된 무리를 죽이는 상황. 연결된 무리가 분리된 무리보다 활로가 적기 때문이다.

**형식적 조건**: 선수 P가 별도의 두 무리 G1과 G2를 가진다. 돌을 놓아 이들을 연결하면 단일 무리 G3가 된다. 그러나 G3는 G1과 G2가 별도일 때보다 활로가 적으며, 상대가 즉시 G3를 따낼 수 있다.

**구현 참고사항**: 특수 처리 불필요; 표준 따냄 메커니즘이 적용된다.

### EC-12: 수상전(Semeai, 활로 경쟁)

**설명**: 독립적으로 살아 있지 않은 인접한 양 색의 두 무리가 상대를 먼저 따내기 위해 경쟁하는 상황. 활로가 먼저 0이 되는 무리가 따내진다.

**형식적 조건**: 무리 G_b와 G_w가 인접하고, 활로를 공유하며, 어느 쪽도 진눈 2개를 가지지 않는다. 상대의 활로를 먼저 0으로 줄일 수 있는 선수가 수상전에서 이긴다.

**핵심 요인**:
1. 각 무리의 활로 수.
2. 공유 활로(두 무리 사이의 공배) 수.
3. "접근수" 활로의 존재(마지막에만 채울 수 있는 내부 활로).
4. 누구의 차례인지.

**구현 참고사항**: 수상전 해결은 올바른 게임 플레이에서 자연히 발생한다; 특수 규칙이 필요 없다. AI 분석 해설에 관련된다.

### EC-13: 자충(Suicide, Self-Capture)

**설명**: 놓인 돌(과 그 무리)이 상대 따냄 처리 후에도 활로가 0이어서 자기 무리가 제거되는 착수.

**형식적 조건**: V에 돌을 놓고 상대 무리를 제거한 후, V를 포함하는 무리의 활로가 0이다. Tromp-Taylor 규칙에서 해당 무리는 제거(cleared)된다.

**합법성**: Tromp-Taylor 규칙에서 합법이다. 유일한 제한은 초과패: 자충이 이전 바둑판 상태를 재현하면 위법이다.

**일반적인 경우**: 따냄이 발생하지 않는 활로 하나인 위치에 단일 돌 자충. 돌이 놓이고 즉시 제거된다. 이는 바둑판 상태 변화 측면에서 패스와 동일하며(바둑판이 이전 상태로 돌아감), 이전 상태가 기록에 있으면 초과패가 이를 금지한다. 따라서 **상대 돌로 둘러싸인 빈 교차점에 단일 돌 자충은 초과패에 의해 금지된다**(놓기 전 상태를 재현하므로).

**예외**: 결과 바둑판 상태가 새로운(이전에 발생하지 않은) 다중 돌 자충은 합법이다.

### EC-14: 위치적 초과패 엣지 케이스

**설명**: 단순 패 규칙으로 충분하지 않고 전체 위치적 초과패가 필요한 위치들.

**경우**:
1. **이석환일(Sending-two-returning-one)**: 다른 위치에서 단일 돌을 되따내기 위해 두 돌을 희생하여, 2수보다 긴 순환을 만드는 상황.
2. **삼패** (EC-04 참조).
3. **만년패** (EC-05 참조).
4. **장기 순환**: 바둑판 위치를 반복하는 길이 2 초과의 모든 순환.

**구현 참고사항**: `positionHashes: Set<bigint>`는 게임 시작부터 모든 바둑판 해시를 저장해야 한다. 이 집합은 게임 길이에 비례하여 선형적으로 증가한다(일반적인 19x19 게임에서 최대 ~400개 항목).

### EC-15: 패를 위한 패스(Pass-for-Ko, 전략적 패스)

**설명**: 유용한 수가 없어서가 아니라 패 상황을 해결하기 위해 패스하는 경우. 패스 후, 단순 패에서는 상대의 이전 패 제한이 해제되지만, 위치적 초과패에서는 결과 바둑판 상태의 기존 출현 여부에 따라 제한이 결정된다.

**형식적 조건**: 선수 P가 패스한다. 바둑판 상태는 변경되지 않는다. 다음 차례에 이전 바둑판 상태를 재현하지 않는 모든 착수가 합법이다.

**구현 참고사항**: 패스는 바둑판 해시를 변경하지 않는다. 패스 후 상대가 패점에 착수할 수 있는 이유:
1. 돌을 놓게 되므로(바둑판 상태가 변경).
2. 결과 바둑판 상태는 직전 상태뿐 아니라 전체 기록과 대조해야 한다.
3. PSK 하에서, 패점에서 따낸 후 바둑판 상태가(패스 이전부터) 이미 출현한 적이 있으면 여전히 위법이다.

**실제적 영향**: PSK에서 패를 "리셋"하기 위한 전략적 패스는 단순 패보다 더 미묘하다. 구현은 패점 최적화만이 아닌 전체 해시 기록을 사용해야 한다.

### EC-16: 무리 생명주기(Group Lifecycle)

**설명**: 바둑판에 놓인 돌은 나중에 따내질 수 있다. 단일 돌은 인접 착수를 통해 성장하는 무리의 씨앗이 될 수 있으며, 상대의 착수로 활로를 잃고, 결국 따내지거나 게임 끝까지 살아남는다.

**돌이 가질 수 있는 상태**:
1. 바둑판 위에 놓임(무리의 일부).
2. 따내짐(바둑판에서 제거됨, 상대의 따냄 수 증가).
3. 다시 바둑판으로 돌아가는 전환은 없다(바둑에는 재활용이 없음).

### EC-17: 바둑판 변과 귀(Board Edges and Corners)

**설명**: 바둑판의 변과 귀에 있는 교차점은 내부 교차점보다 이웃이 적어, 사활과 집에 근본적으로 영향을 미친다.

**형식적 속성**:
- 귀 교차점(총 4개): 이웃 2개.
- 변 교차점(귀 제외, 총 `4*(N-2)`개): 이웃 3개.
- 내부 교차점(총 `(N-2)^2`개): 이웃 4개.

**착수에 미치는 영향**:
- 변에 있는 무리는 진눈 2개를 만들기 위해 더 적은 돌이 필요하다.
- 귀의 무리는 죽이기 쉽지만 방어하기도 쉽다(접근 방향이 적음).
- 집 효율은 귀가 가장 높고, 다음이 변, 그 다음이 중앙이다.

### EC-18: 빈 바둑판에서의 패스(Empty Board Pass)

**설명**: 빈 바둑판에서(또는 게임 극초반에) 패스하는 경우. 합법이지만 전략적으로 무의미하다.

**규칙 적용**: 빈 바둑판에서의 패스는 합법이다. 빈 바둑판에서 연속 두 번 패스하면 흑 0점, 백 `komi`점으로 게임이 종료된다(백이 덤으로 승리).

### EC-19: 가득 찬 바둑판(Full Board)

**설명**: 모든 교차점이 점유된 상태. 실전에서는 극히 드물지만 이론적으로 가능하다.

**규칙 적용**: 모든 교차점이 채워지면 착수가 불가능하다(돌을 놓을 빈 교차점이 없음). 양 선수 모두 패스해야 하며 게임이 종료된다. 점수는 단순히 돌 수 더하기 덤이다.

### EC-20: 월광생(Moonshine Life)

**설명**: 상대가 방어자에게 유리한 패를 만들지 않고는 접근할 수 없어서, 관행적으로 두 개의 일반적인 눈이 없음에도 사실상 무조건 살아 있는 위치.

**규칙 적용**: 특수 처리 불필요. 표준 규칙이 이를 올바르게 처리한다; 상대가 성공적인 따냄 시퀀스를 실행할 수 없다.

---

## 7. 점진적 빌드 순서

규칙 엔진은 복잡성을 관리하기 위해 특정 순서로 구축해야 한다. 각 단계는 이전 단계를 기반으로 하며 독립적으로 테스트할 수 있다.

### 단계 1: 놓기(Place)

**구현 대상**: 규칙 1, 2, 5(부분), 7(1단계만).

**기능**:
- 크기 N의 빈 바둑판 생성.
- 교차점에 돌 놓기.
- 교차점이 비어 있는지 검증.
- 흑과 백 교대.

**테스트 케이스**:
- 빈 바둑판에 돌 놓기.
- 점유된 교차점에 놓기 거부.
- 교대 검증.

### 단계 2: 따냄(Capture)

**구현 대상**: 규칙 3, 4, 7(2-3단계).

**기능**:
- 돌을 놓은 후 활로가 0인 상대 무리 식별.
- 따낸 무리 제거.
- 상대 따냄 후 활로가 0인 자기 무리 식별(자충).
- 자충된 무리 제거.
- 따냄 수 추적.

**테스트 케이스**:
- 단일 돌 따냄(둘러싸고 마지막 활로 채우기).
- 다수 돌 무리 따냄.
- 단일 착수로 여러 무리 따냄.
- 자충: 완전히 둘러싸인 위치에 단일 돌.
- 자충: 다중 돌 무리의 마지막 활로 상실.
- 환격(따낸 후 되따냄이 합법).

### 단계 3: 패(Ko)

**구현 대상**: 규칙 6(단순 패 최적화).

**기능**:
- 각 따냄 후 단순 패 조건 감지.
- 패점 저장.
- 바로 다음 차례에 패점에서의 착수 거부.
- 다른 착수나 패스 후 패점 해제.

**테스트 케이스**:
- 단순 패: 즉시 되따냄 거부.
- 단순 패: 사이에 다른 수를 둔 후 되따냄 허용.
- 환격: 패로 표시되지 않음을 검증.
- 다수 따냄: 패점이 설정되지 않음을 검증.

### 단계 4: 계가(Scoring)

**구현 대상**: 규칙 9, 10.

**기능**:
- 연결된 빈 영역 식별.
- 각 영역을 흑 집, 백 집, 또는 공배로 분류.
- 바둑판 위의 돌 수 계산.
- 덤을 포함한 최종 점수 계산.
- 승자 결정.

**테스트 케이스**:
- 빈 바둑판: Black=0, White=komi.
- 바둑판에 돌 하나: 집 계산.
- 빅: 공유 활로가 공배로 계산됨.
- 혼합 집이 있는 복잡한 위치.
- 가득 찬 바둑판: 점수 = 돌 수.

### 단계 5: 초과패(Superko)

**구현 대상**: 규칙 6(전체 위치적 초과패).

**기능**:
- Zobrist 해싱: 해시 테이블 초기화, 해시 점진적 계산.
- 모든 바둑판 해시를 Set에 저장.
- 모든 착수를 기록 집합과 대조.
- 이전 바둑판 상태를 재현하는 착수 거부.

**테스트 케이스**:
- 초과패가 단순 패를 올바르게 처리.
- 삼패: 모든 반복 위치가 거부됨을 검증.
- 이석환일: 순환이 끊어짐을 검증.
- 이전 위치를 재현하는 자충: 거부됨.
- 장기 게임: 해시 집합이 올바르게 증가함을 검증.

### 단계 6: 게임 흐름(Game Flow)

**구현 대상**: 규칙 5, 8, 10.

**기능**:
- 연속 패스 추적.
- 연속 두 번 패스 후 게임 종료.
- 기권 처리.
- 완전한 게임 결과 보고.

**테스트 케이스**:
- 두 번 패스로 게임 종료.
- 패스-착수-패스: 게임이 종료되지 않음(비연속).
- 어느 선수든 기권.
- 점수 보고 형식.

---

## 8. 데이터 소스 카탈로그

### DS-01: CWI 데이터셋

| 속성 | 값 |
|------|-----|
| **이름** | CWI Go Games Database |
| **URL** | https://homepages.cwi.nl/~aeb/go/games/ |
| **크기** | 88,888+ 게임 |
| **형식** | SGF (Smart Game Format) |
| **내용** | 일본 프로 바둑 기보 |
| **라이선스** | Public domain |
| **다운로드** | `.tar.gz` 아카이브 (45 MB) 또는 `.7z` 아카이브 (27 MB) |
| **범위** | 주요 일본 대회(본인방, 기성, 명인 등) 2025년까지 |
| **프로젝트 활용** | Template engine 패턴 학습, 포지션 분류, 해설 예시 |
| **취득 방법** | 아카이브 다운로드, SGF 파일 추출, @sabaki/sgf로 파싱 |

### DS-02: featurecat/go-dataset

| 속성 | 값 |
|------|-----|
| **이름** | Fox Go Server Dataset |
| **URL** | https://github.com/featurecat/go-dataset |
| **크기** | 2,110만 게임 |
| **형식** | SGF, 7-zip 아카이브로 압축 |
| **내용** | Fox Go Server(foxwq.com) 기보, 전 급수 18k~9p |
| **라이선스** | Public (GitHub, 무료 다운로드) |
| **다운로드** | GitHub를 통한 급수별 개별 아카이브; 총 ~10.6 GB 압축 |
| **기간** | 2012-2019 |
| **급수별 분포** | Pro: 10,349; 9d: 59,757; ... 18k: 501,020 (3단이 가장 많음: 320만) |
| **프로젝트 활용** | 대규모 패턴 분석, AI 해설 품질 벤치마킹, 포석 데이터베이스 |
| **취득 방법** | 급수별 선택적 다운로드(Pro 및 고단 우선); @sabaki/sgf로 파싱 |

### DS-03: @sabaki/sgf

| 속성 | 값 |
|------|-----|
| **이름** | Sabaki SGF Parser |
| **URL** | https://www.npmjs.com/package/@sabaki/sgf |
| **GitHub** | https://github.com/SabakiHQ/sgf |
| **유형** | npm 패키지 |
| **라이선스** | MIT |
| **설치** | `npm install @sabaki/sgf` |
| **API** | `parse(sgfString)`은 게임 트리 노드를 반환; Node.js에서는 `parseFile(path)` |
| **프로젝트 활용** | DS-01 및 DS-02의 모든 SGF 파일 파싱; 애플리케이션에서 기보 내보내기 |
| **관련 패키지** | `@sabaki/immutable-gametree` (호환 트리 구조) |
| **호환성** | TypeScript 호환; Node.js와 브라우저에서 동작(브라우저: `parseFile` 불가) |

---

## 9. 엔티티 카탈로그

### 카테고리 1: 바둑판 기하학 (E01-E08)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E01 | Board | NxN 교차점 격자 | `{ size: 9\|13\|19; grid: Uint8Array }` | `grid.length === size * size` |
| E02 | Intersection | 바둑판 위의 단일 교차점 | `number` (index) | `0 <= index < size * size` |
| E03 | Row | 교차점의 가로줄 | `number` | `0 <= row < size` |
| E04 | Column | 교차점의 세로줄 | `number` | `0 <= col < size` |
| E05 | Coordinate | 교차점을 식별하는 (행, 열) 쌍 | `{ row: number; col: number }` | `0 <= row < size, 0 <= col < size` |
| E06 | AdjacencyEdge | 두 교차점 사이의 직교 연결 | `[number, number]` | `|r1-r2|+|c1-c2| === 1` |
| E07 | NeighborList | 각 교차점의 유효한 이웃에 대한 사전 계산 목록 | `Int16Array[]` | 항목당 `2 <= length <= 4` |
| E08 | BoardRegion | 같은 상태를 공유하는 교차점의 연결 집합 | `Set<number>` | 비어 있지 않음; 모두 같은 색이거나 모두 빈점 |

### 카테고리 2: 돌 상태 (E09-E14)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E09 | CellState | 단일 교차점의 상태 | `0 \| 1 \| 2` | 0=빈점, 1=흑, 2=백 |
| E10 | Stone | 바둑판에 놓인 돌 | `{ index: number; color: 1\|2 }` | 해당 인덱스의 바둑판이 비어 있지 않아야 함 |
| E11 | BlackStone | 흑색 돌 | `1` (상수) | `grid[index] === 1` |
| E12 | WhiteStone | 백색 돌 | `2` (상수) | `grid[index] === 2` |
| E13 | EmptyPoint | 비어 있는 교차점 | `0` (상수) | `grid[index] === 0` |
| E14 | CapturedStone | 바둑판에서 제거된 돌 | `{ index: number; color: 1\|2; moveNumber: number }` | 이전에 바둑판 위에 있었으나 현재 제거됨 |

### 카테고리 3: 무리 (E15-E20)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E15 | Group | 같은 색 돌의 최대 연결 집합 | `{ color: 1\|2; stones: Set<number>; liberties: Set<number> }` | 비어 있지 않음; 모든 돌이 같은 색이고 연결됨 |
| E16 | GroupId | 바둑판 상태 내 무리의 고유 식별자 | `number` | 바둑판 상태당 고유 |
| E17 | GroupSize | 무리 내 돌의 수 | `number` | `>= 1` |
| E18 | LibertyCount | 무리에 인접한 빈 교차점의 수 | `number` | `>= 0`; 0이면 무리가 따내짐 |
| E19 | Atari | 무리의 활로가 정확히 하나인 상태 | `boolean` | `libertyCount === 1` |
| E20 | GroupMembership | 각 돌 인덱스에서 해당 무리로의 매핑 | `Map<number, GroupId>` | 각 돌은 정확히 하나의 무리에 속함 |

### 카테고리 4: 활로 (E21-E25)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E21 | Liberty | 무리의 돌 중 하나 이상에 직교 인접한 빈 교차점 | `number` (index) | `grid[index] === 0` |
| E22 | SharedLiberty | 양 색의 무리에 인접한 빈 교차점 | `number` (index) | 흑 무리와 백 무리 모두에 인접 |
| E23 | InternalLiberty | 단일 무리 내에 완전히 둘러싸인 빈 교차점(잠재적 눈) | `number` (index) | 모든 이웃이 같은 색 돌이거나 바둑판 밖 |
| E24 | ExternalLiberty | 무리와 열린 바둑판 사이 경계에 있는 빈 교차점 | `number` (index) | 이웃 중 최소 하나가 빈점이거나 상대 |
| E25 | LibertyDelta | 착수 후 활로 수의 변화 | `number` | 음수(감소) 또는 양수(증가) 가능 |

### 카테고리 5: 집과 계가 (E26-E35)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E26 | Territory | 한 색에만 도달하는 빈 교차점 집합 | `{ owner: 1\|2; points: Set<number> }` | 모든 교차점이 빈점; 한 색에만 도달 |
| E27 | Dame | 양 색 모두에 도달하는 중립적 빈 교차점 | `Set<number>` | 모든 교차점이 빈점; 양 색에 도달 |
| E28 | EmptyRegion | 빈 교차점의 연결 성분 | `{ points: Set<number>; reachesBlack: boolean; reachesWhite: boolean }` | 비어 있지 않은 집합 |
| E29 | Score | 선수의 총 점수(돌 + 집) | `number` | `>= 0` |
| E30 | Komi | 백에 대한 보상 점수 | `number` | 표준: 7.5 (19x19), 5.5 (9x9, 13x13) |
| E31 | FinalScore | 덤 포함 점수: `Score(White) + Komi` | `number` | `>= 0` |
| E32 | ScoreResult | 완전한 계가 상세 내역 | `{ blackStones, whiteStones, blackTerritory, whiteTerritory, dame, komi, blackScore, whiteScore, result }` | 모든 필드 비음수 |
| E33 | CaptureCount | 게임 중 선수가 따낸 총 돌 수 | `number` | `>= 0`; 집 계산에는 사용되지 않음 |
| E34 | ScoringMethod | 사용되는 계가 방식 | `'chinese'` | 1단계: 중국식만 |
| E35 | Margin | 승자와 패자 간의 점수 차이 | `number` | 확정적 게임에서 `> 0`; 무승부에서 `0` |

### 카테고리 6: 게임 흐름 (E36-E46)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E36 | Move | 돌을 놓는 차례 | `{ type: 'move'; player: 1\|2; index: number }` | 대상이 빈점이어야 함; 초과패를 위반하면 안 됨 |
| E37 | Pass | 돌을 놓지 않는 차례 | `{ type: 'pass'; player: 1\|2 }` | 바둑판 상태 변경 없음 |
| E38 | Resignation | 자발적 게임 종료 행위 | `{ type: 'resign'; player: 1\|2 }` | 상대 승리 |
| E39 | MoveRecord | 메타데이터가 포함된 기록된 행동 | `{ ...Move\|Pass\|Resign; captured: number[]; hash: bigint }` | 기록 후 변경 불가 |
| E40 | MoveHistory | 게임의 모든 행동에 대한 순서화된 시퀀스 | `MoveRecord[]` | 추가 전용 |
| E41 | MoveNumber | 현재 차례의 인덱스(0 기반) | `number` | `>= 0` |
| E42 | CurrentPlayer | 현재 차례인 선수 | `1 \| 2` | 매 차례 교대: `moveNumber % 2 === 0 ? 1 : 2` |
| E43 | ConsecutivePasses | 연속 패스 행동 카운터 | `0 \| 1 \| 2` | 착수 시 0으로 초기화; 2가 되면 게임 종료 |
| E44 | GamePhase | 게임의 현재 단계 | `'playing' \| 'scoring' \| 'finished'` | 선형적 진행 |
| E45 | GameResult | 게임의 결과 | `{ winner: 1\|2\|null; method: 'score'\|'resign'\|'time'\|'tie'; margin?: number }` | 게임 종료 후 non-null |
| E46 | GameRecord | 완료된 게임의 완전한 기록 | `{ moves: MoveRecord[]; result: GameResult; board: BoardState; metadata: GameMetadata }` | 변경 불가 |

### 카테고리 7: 선수 (E47-E50)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E47 | Player | 게임 참가자(인간 또는 AI) | `{ id: string; type: 'human'\|'ai'; color: 1\|2 }` | 각 게임에 정확히 2명의 선수 |
| E48 | PlayerColor | 선수에게 배정된 색 | `1 \| 2` | BLACK=1 또는 WHITE=2 |
| E49 | OpponentColor | 선수 색의 반대 | `1 \| 2` | `3 - playerColor` |
| E50 | AILevel | KataGo 난이도 수준 | `number` | `1 <= level <= 30` |

### 카테고리 8: 시간 제어 (E51-E55)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E51 | TimeControl | 게임의 시간 제어 설정 | `{ mainTime: number; byoyomi: number; periods: number }` | 모든 값 `> 0` |
| E52 | MainTime | 선수당 할당된 총 시간(초) | `number` | `> 0` |
| E53 | Byoyomi | 초읽기 기간(초) | `number` | `> 0` |
| E54 | ByoyomiPeriods | 초읽기 횟수 | `number` | `>= 1` |
| E55 | RemainingTime | 선수의 남은 시간 | `{ mainTime: number; byoyomiPeriods: number }` | `mainTime >= 0`; `byoyomiPeriods >= 0` |

### 카테고리 9: 분석 (E56-E62)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E56 | WinRate | 주어진 선수의 추정 승률 | `number` | `0.0 <= winRate <= 1.0` |
| E57 | ScoreLead | 선수의 추정 점수 우위 | `number` | 음수(열세) 가능 |
| E58 | BestMove | 엔진의 최상위 추천 수 | `{ index: number; winRate: number; visits: number }` | 유효한 교차점 인덱스 |
| E59 | MoveVariation | 추천 수의 시퀀스 | `number[]` | 교차점 인덱스 배열 |
| E60 | Blunder | 승률을 크게 떨어뜨리는 수 | `{ moveNumber: number; winRateDrop: number }` | `winRateDrop > threshold` (예: 0.05) |
| E61 | AnalysisResult | 포지션에 대한 KataGo 분석 출력 | `{ moveInfos: MoveInfo[]; rootInfo: RootInfo }` | KataGo Analysis Engine에서 제공 |
| E62 | Visits | 포지션에 대한 MCTS 플레이아웃 수 | `number` | `> 0` |

### 카테고리 10: 급수와 레이팅 (E63-E66)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E63 | Rank | 전통 바둑 급수(급/단) | `string` | 형식: `"30k"` ~ `"1k"`, `"1d"` ~ `"9d"`, `"1p"` ~ `"9p"` |
| E64 | RankNumeric | 비교를 위한 급수의 숫자 표현 | `number` | `30k=1`, `1k=30`, `1d=31`, `9d=39`, `1p=40`, `9p=48` |
| E65 | Rating | Elo 유사 수치 레이팅 | `number` | `>= 0` |
| E66 | RatingDelta | 게임 후 레이팅 변화 | `number` | 양수 또는 음수 가능 |

### 카테고리 11: 패와 초과패 (E67-E72)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E67 | KoPoint | 즉시 되따냄이 금지되는 교차점(단순 패) | `number \| null` | 패가 활성 상태가 아닐 때 `null` |
| E68 | PositionHash | 바둑판 상태의 Zobrist 해시 | `bigint` | 64비트 값 |
| E69 | PositionHashHistory | 이전에 출현한 모든 바둑판 해시의 집합 | `Set<bigint>` | 착수당 1개씩 증가(패스당이 아님, 패스는 바둑판을 변경하지 않으므로) |
| E70 | ZobristTable | 해시 계산용 랜덤 값 | `bigint[][]` | 64비트 값의 `[2][N*N]` 배열 |
| E71 | SuperkoViolation | 이전 바둑판 상태를 재현할 착수 | `boolean` | 해시 조회로 감지 |
| E72 | KoThreat | 패로 돌아가기 전에 상대가 응수하도록 강제하기 위해 다른 곳에 두는 수 | `number` (index) | 유효한 착수 인덱스 |

### 카테고리 12: SGF와 데이터 (E73-E78)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E73 | SGFString | 원본 SGF 파일 내용 | `string` | SGF 명세를 준수해야 함 |
| E74 | SGFNode | SGF 게임 트리에서 파싱된 노드 | `{ id: number; data: Record<string, string[]>; parentId: number\|null; children: number[] }` | @sabaki/sgf와 호환 |
| E75 | SGFGameTree | SGF 파일에서 파싱된 게임 트리 | `SGFNode[]` | 루트 노드는 `parentId === null` |
| E76 | SGFCoordinate | SGF 좌표 문자열 (예: "pd" = 열 p, 행 d) | `string` | 소문자 두 글자; `"aa"` = (0,0) |
| E77 | SGFProperty | SGF 노드의 키-값 쌍 | `{ key: string; values: string[] }` | 표준 SGF 속성: B, W, AB, AW, SZ, KM 등 |
| E78 | GameMetadata | 게임에 대한 메타데이터 | `{ blackPlayer: string; whitePlayer: string; date: string; result: string; boardSize: number; komi: number; rules: string }` | SGF 헤더에서 추출 |

### 카테고리 13: 사활 (E79-E85)

| ID | 엔티티 | 설명 | TypeScript 타입 힌트 | 제약 조건 |
|----|--------|------|---------------------|-----------|
| E79 | Alive | 따낼 수 없는 무리 | `boolean` | 충분 조건: 진눈 2개 이상, 또는 빅 |
| E80 | Dead | 상대의 올바른 착수로 따낼 수 있는 무리 | `boolean` | 진눈 2개 없음, 빅 아님, 패 위협 불충분 |
| E81 | Unsettled | 누가 먼저 두느냐에 따라 사활이 결정되는 무리 | `boolean` | 상황 의존적 |
| E82 | TrueEye | 무리의 진정한 눈인 빈 교차점 | `boolean` | 모든 직교 이웃이 같은 색; 대각선 조건 충족 |
| E83 | FalseEye | 눈을 닮았지만 손상된 빈 교차점 | `boolean` | 대각선 조건 실패 |
| E84 | EyeSpace | 무리에 둘러싸인 빈 교차점의 연결 집합 | `Set<number>` | 진눈, 거짓눈, 또는 혼합을 포함할 수 있음 |
| E85 | SekiGroup | 상호생(빅)으로 살아 있는 무리 | `boolean` | 자기 단수 없이 상대를 따낼 수 없음 |

---

## 10. 관계 카탈로그

### 바둑판 기하학 관계 (R01-R08)

| ID | 관계 | 출발 | 도착 | 카디널리티 | 방향 | 제약 조건 |
|----|------|------|------|-----------|------|-----------|
| R01 | AdjacentTo | Intersection | Intersection | N:M (노드당 2-4) | 양방향 | `\|r1-r2\|+\|c1-c2\| === 1` |
| R02 | InRow | Intersection | Row | N:1 | 단방향 | `row = Math.floor(index / size)` |
| R03 | InColumn | Intersection | Column | N:1 | 단방향 | `col = index % size` |
| R04 | DiagonalTo | Intersection | Intersection | N:M (1-4) | 양방향 | `\|r1-r2\| === 1 AND \|c1-c2\| === 1` |
| R05 | HasIndex | Coordinate | Intersection | 1:1 | 단방향 | `index = row * size + col` |
| R06 | ContainsIntersection | Board | Intersection | 1:N | 단방향 | `N = size * size` |
| R07 | BelongsToRegion | Intersection | BoardRegion | N:1 | 단방향 | 모든 교차점을 분할 |
| R08 | AdjacentRegion | BoardRegion | BoardRegion | N:M | 양방향 | 영역이 최소 하나의 인접 간선을 공유 |

### 돌과 무리 관계 (R09-R18)

| ID | 관계 | 출발 | 도착 | 카디널리티 | 방향 | 제약 조건 |
|----|------|------|------|-----------|------|-----------|
| R09 | OccupiedBy | Intersection | Stone | 1:0..1 | 단방향 | 빈 교차점에는 돌 없음 |
| R10 | BelongsToGroup | Stone | Group | N:1 | 단방향 | 바둑판 위의 모든 돌은 정확히 하나의 무리에 속함 |
| R11 | ContainsStone | Group | Stone | 1:N | 단방향 | `N >= 1`; 무리는 비어 있지 않음 |
| R12 | HasLiberty | Group | Liberty | 1:N | 단방향 | `N >= 0`; N=0이면 무리가 죽음 |
| R13 | AdjacentToGroup | Group | Group | N:M | 양방향 | 무리 간 어떤 돌 쌍이든 인접하면 무리가 인접 |
| R14 | OpposesGroup | Group | Group | N:M | 양방향 | 서로 다른 색의 인접 무리 |
| R15 | CapturedBy | Group | Move | 1:1 | 단방향 | 무리의 활로를 0으로 줄인 착수 |
| R16 | PlacedBy | Stone | Move | 1:1 | 단방향 | 이 돌을 만든 착수 |
| R17 | SharesLibertyWith | Group | Group | N:M | 양방향 | 두 무리가 최소 하나의 활로를 공유 |
| R18 | MergesWith | Group | Group | N:M | 단방향 | 돌을 놓아 두 개 이상의 무리를 하나로 연결 |

### 집과 계가 관계 (R19-R24)

| ID | 관계 | 출발 | 도착 | 카디널리티 | 방향 | 제약 조건 |
|----|------|------|------|-----------|------|-----------|
| R19 | OwnsTerritory | Player | Territory | 1:N | 단방향 | 빈 영역이 이 선수의 색에만 도달 |
| R20 | ReachesColor | EmptyRegion | PlayerColor | N:M (1 또는 2) | 단방향 | 영역에서 BFS가 이 색에 도달 |
| R21 | ContainsPoint | EmptyRegion | Intersection | 1:N | 단방향 | 연결된 빈 교차점 |
| R22 | ClassifiedAs | EmptyRegion | Territory\|Dame | 1:1 | 단방향 | 한 색에 도달 = 집; 양쪽 = 공배 |
| R23 | ContributesToScore | Stone\|Territory | Score | N:1 | 단방향 | 각 돌/집 교차점이 소유자의 점수에 1점 추가 |
| R24 | AdjustedByKomi | Score | FinalScore | 1:1 | 단방향 | 백의 FinalScore = Score + Komi |

### 게임 흐름 관계 (R25-R31)

| ID | 관계 | 출발 | 도착 | 카디널리티 | 방향 | 제약 조건 |
|----|------|------|------|-----------|------|-----------|
| R25 | FollowedBy | MoveRecord | MoveRecord | 1:0..1 | 단방향 | 행동의 시간적 순서 |
| R26 | PlayedBy | MoveRecord | Player | N:1 | 단방향 | 각 행동에는 정확히 한 명의 선수 |
| R27 | ResultsIn | MoveRecord | BoardState | 1:1 | 단방향 | 각 행동은 하나의 바둑판 상태를 생성 |
| R28 | Captures | Move | Group | 1:N | 단방향 | 착수가 0개 이상의 무리를 따냄 |
| R29 | CausesKo | Move | KoPoint | 1:0..1 | 단방향 | 착수가 0 또는 1개의 패점을 생성 |
| R30 | EndsGame | Pass\|Resignation | GameResult | 1:0..1 | 단방향 | 연속 두 번 패스 또는 기권이 게임 종료 |
| R31 | ProducesHash | BoardState | PositionHash | 1:1 | 단방향 | 각 바둑판 상태에는 정확히 하나의 Zobrist 해시 |

### 분석 관계 (R32-R36)

| ID | 관계 | 출발 | 도착 | 카디널리티 | 방향 | 제약 조건 |
|----|------|------|------|-----------|------|-----------|
| R32 | AnalyzedBy | BoardState | AnalysisResult | 1:0..1 | 단방향 | 포지션이 KataGo에 의해 분석될 수 있음 |
| R33 | HasBestMove | AnalysisResult | BestMove | 1:N | 단방향 | KataGo가 순위별 후보 수를 반환 |
| R34 | HasWinRate | AnalysisResult | WinRate | 1:1 | 단방향 | 현재 선수의 루트 승률 |
| R35 | IsBlunder | Move | Blunder | 1:0..1 | 단방향 | 착수가 악수로 분류될 수 있음 |
| R36 | HasVariation | BestMove | MoveVariation | 1:1 | 단방향 | 각 최선수에 주요 변화수(principal variation)가 있음 |

### 패와 초과패 관계 (R37-R40)

| ID | 관계 | 출발 | 도착 | 카디널리티 | 방향 | 제약 조건 |
|----|------|------|------|-----------|------|-----------|
| R37 | ForbidsMove | KoPoint | Intersection | 1:1 | 단방향 | 상대가 이 교차점에 착수할 수 없음 |
| R38 | HasHash | BoardState | PositionHash | 1:1 | 단방향 | 실용적으로 전단사(충돌 무시 가능) |
| R39 | RecordedIn | PositionHash | PositionHashHistory | N:1 | 단방향 | 모든 바둑판 해시가 기록에 추가됨 |
| R40 | ViolatesSuperko | Move | PositionHashHistory | 1:0..1 | 단방향 | 결과 해시가 기록에 있으면 착수가 초과패 위반 |

---

## 11. 제약 조건 카탈로그

### 바둑판 제약 조건 (C01-C05)

| ID | 제약 조건 | 형식적 정의 | 적용 방법 |
|----|-----------|------------|-----------|
| C01 | ValidBoardSize | `size in {9, 13, 19}` | 게임 생성 시 다른 바둑판 크기 거부 |
| C02 | ValidIndex | `0 <= index < size * size` | 모든 교차점 참조에 대해 범위 검사 |
| C03 | GridLength | `grid.length === size * size` | 바둑판 생성 시 assert |
| C04 | CellRange | 모든 `i`에 대해 `grid[i] in {0, 1, 2}` | Uint8Array가 비음수를 보장; 상한 검증 |
| C05 | AdjacencyBounds | 이웃 인덱스가 유효하고 직교 인접해야 함 | 사전 계산된 테이블이 이를 보장 |

### 착수 제약 조건 (C06-C12)

| ID | 제약 조건 | 형식적 정의 | 적용 방법 |
|----|-----------|------------|-----------|
| C06 | PlaceOnEmpty | 놓기 전 `grid[index] === 0` | 돌을 놓기 전 확인; 점유 시 거부 |
| C07 | AlternatingTurns | `currentPlayer === (moveNumber % 2 === 0 ? BLACK : WHITE)` | 착수 검증 시 적용 |
| C08 | NoSuperkoViolation | `!positionHashes.has(hashAfterMove)` | 착수 후 해시 계산; 기록과 대조 |
| C09 | SimpleKoForbidden | `koPoint !== null`이면 상대가 다음 차례에 `koPoint`에 착수 불가 | 초과패 확인 전 사전 필터 |
| C10 | SuicideLegal | Tromp-Taylor 규칙에서 자충은 합법 | 자충을 거부하지 않음; 초과패로만 거부 |
| C11 | CaptureBeforeSuicide | 상대 무리가 자기 무리보다 먼저 제거(cleared)됨 | 착수 실행에서 단계 순서 적용 |
| C12 | MoveProducesNewState | 착수는 바둑판 상태를 변경해야 함(돌을 놓으므로 내재적; 자충이 같은 상태를 재현하면 초과패에 의해 포착) | 내재적; C08에 의해 적용 |

### 게임 흐름 제약 조건 (C13-C17)

| ID | 제약 조건 | 형식적 정의 | 적용 방법 |
|----|-----------|------------|-----------|
| C13 | GameStartsEmpty | 수 0에서 모든 `grid[i] === 0` | 격자를 모두 0으로 초기화 |
| C14 | BlackFirst | `turn(0) === BLACK` | currentPlayer를 BLACK으로 초기화 |
| C15 | TwoPassesEndGame | `consecutivePasses === 2`이면 계가 시작 | 각 패스 후 확인 |
| C16 | ResignationEndsGame | 기권은 즉시 게임을 종료; 기권한 선수가 패배 | 착수 검증 전 처리 |
| C17 | NoMoveAfterGameEnd | `gamePhase === 'finished'` 후 어떤 행동도 허용 불가 | 모든 착수/패스 핸들러에 가드 |

### 계가 제약 조건 (C18-C23)

| ID | 제약 조건 | 형식적 정의 | 적용 방법 |
|----|-----------|------------|-----------|
| C18 | AllPointsAccountedFor | `blackStones + whiteStones + blackTerritory + whiteTerritory + dame === size * size` | 계가 후 assert |
| C19 | TerritoryReachesOneColor | 집 영역은 정확히 한 색에 도달 | BFS 분류 |
| C20 | DameReachesBothColors | 공배 영역은 흑과 백 모두에 도달 | BFS 분류 |
| C21 | KomiAppliedToWhite | `whiteScore = whiteStones + whiteTerritory + komi` | 계가 함수에서 적용 |
| C22 | NonNegativeScores | `blackScore >= 0 AND whiteScore >= 0` | 계가 후 assert |
| C23 | TiePossibleOnlyWithIntegerKomi | 반집 덤(예: 7.5)에서는 무승부가 불가능 | 정보 제공용; 적용 불필요 |

### 해시 제약 조건 (C24-C27)

| ID | 제약 조건 | 형식적 정의 | 적용 방법 |
|----|-----------|------------|-----------|
| C24 | DeterministicHash | 같은 바둑판 상태는 같은 해시를 생성 | Zobrist 테이블에 고정 PRNG 시드 |
| C25 | IncrementalCorrectness | 점진적 해시 갱신이 전체 재계산과 같은 결과를 생성 | 테스트에서 검증 |
| C26 | HashHistoryMonotonic | 위치 해시 기록은 추가 전용 | `positionHashes`에서 항목을 절대 제거하지 않음 |
| C27 | PassDoesNotChangeHash | 패스는 바둑판 해시를 수정하지 않음 | 패스 후 해시 변경 없음을 검증 |

---

## 12. pACS 자기 평가

### Pre-mortem Protocol

1. **무엇이 잘못될 수 있는가?** Tromp-Taylor 규칙에는 두 가지 형식(8문장과 10문장)이 있다. 두 출처를 모두 문서화하고 일관된 10개 규칙 명세로 통합했다. CMU 버전은 상황적 초과패를 사용하고 Tromp 웹사이트는 위치적 초과패를 사용한다 -- PSK를 명시적으로 선택하고 해당 결정을 문서화했다.

2. **가장 취약한 부분은?** 사활 분석(EC-09 ~ EC-11)은 개념적으로 정의되어 있지만 알고리즘적으로는 아니다. 이는 의도된 것이다: 사활 판정은 계산적으로 어려운 문제(PSPACE-complete)이며 규칙 엔진이 아닌 KataGo 분석의 영역이다. 규칙 엔진은 올바른 따냄 메커니즘만 필요하다.

3. **비평가라면 무엇을 지적하겠는가?** 엣지 케이스 백과가 더 특이한 위치(예: 월광생, 만년패)를 포함할 수 있다. 그러나 문서화된 20개의 엣지 케이스는 구현 정확성에 영향을 미치는 모든 패턴을 포함한다. 특이한 위치는 표준 규칙 + 초과패로 올바르게 처리되며 특수 케이스 코드가 필요하지 않다.

### 점수

- **F (Fidelity)**: 88 -- Tromp-Taylor 규칙이 원본 소스(tromp.github.io 및 CMU)에서 충실하게 전사되었다. 초과패 변형(PSK vs SSK)이 설계 결정과 함께 명시적으로 문서화되었다. 중국식 계가가 정밀하게 명세되었다.
- **C (Completeness)**: 85 -- 85개 엔티티(목표: 50), 40개 관계(목표: 30), 27개 제약 조건(목표: 20), 20개 엣지 케이스(목표: 15). 모든 필수 카테고리가 포함되었다. 데이터 소스가 취득 방법과 함께 문서화되었다.
- **L (Logical Coherence)**: 87 -- 규칙, 엔티티, 제약 조건 간 모순이 없다. 따냄 우선 자충 순서가 일관되게 적용된다. 초과패가 단순 패를 포함한다. 계가 공식의 구성 요소가 규칙 정의까지 추적 가능하다.

**pACS = min(88, 85, 87) = 85 (GREEN)**

**취약 차원**: 완전성 -- 사활 알고리즘이 개념적으로 명세되었지만 절차적으로는 아니다(설계상: KataGo에 위임). 엔티티 카탈로그는 더 많은 UI 관련 엔티티로 확장할 수 있지만, 이는 Step 4(template-designer)의 영역이다.

---

## 참조

- [John Tromp's Go Page](https://tromp.github.io/go.html) -- Tromp-Taylor 규칙의 주요 출처
- [CMU Tromp-Taylor Rules](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html) -- 간결한 형식
- [Ko Bestiary](https://www.cs.cmu.edu/~wjh/go/rules/bestiary.html) -- 포괄적인 패 위치 카탈로그
- [Zobrist Hashing - Wikipedia](https://en.wikipedia.org/wiki/Zobrist_hashing) -- 해시 알고리즘 명세
- [CWI Go Games Database](https://homepages.cwi.nl/~aeb/go/games/) -- 88,888+ 프로 기보
- [featurecat/go-dataset](https://github.com/featurecat/go-dataset) -- Fox Go Server 2,110만 기보
- [@sabaki/sgf](https://www.npmjs.com/package/@sabaki/sgf) -- SGF 파싱 라이브러리
