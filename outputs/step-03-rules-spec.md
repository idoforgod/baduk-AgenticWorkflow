# Baduk Domain Knowledge Specification: Rules, Edge Cases, and Board Representation

**Version**: 1.0.0
**Author**: @domain-expert (Step 3)
**Date**: 2026-03-11
**Consumers**: Step 4 (template-designer), Step 6 (architect), Step 7 (schema-designer), Step 11 (rules-engine implementer), Step 13 (template-engine)
**Ruleset**: Tromp-Taylor (Chinese/Area Scoring)
**Primary Source**: [John Tromp's Go Page](https://tromp.github.io/go.html), [CMU Tromp-Taylor Rules](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html)

---

## Table of Contents

1. [Tromp-Taylor Rules: The Ten Logical Rules](#1-tromp-taylor-rules)
2. [Formal Definitions](#2-formal-definitions)
3. [Board Representation Specification](#3-board-representation)
4. [Zobrist Hashing Specification](#4-zobrist-hashing)
5. [Chinese Scoring Algorithm](#5-chinese-scoring)
6. [Edge Case Encyclopedia](#6-edge-cases)
7. [Incremental Build Order](#7-build-order)
8. [Data Source Catalog](#8-data-sources)
9. [Entity Catalog](#9-entity-catalog)
10. [Relation Catalog](#10-relation-catalog)
11. [Constraint Catalog](#11-constraint-catalog)
12. [pACS Self-Rating](#12-pacs)

---

## 1. Tromp-Taylor Rules: The Ten Logical Rules

The Tromp-Taylor rules express the complete rules of Go in ten sentences. The numbering below follows the canonical form from John Tromp's website. Two different formulations exist (an 8-sentence version and a 10-sentence version); this document uses the 10-sentence expansion for maximal clarity.

### Rule 1: Board Definition

> "Go is played on a 19x19 square grid of points, by two players called Black and White."

**Formal definition**: The board is a graph `G = (V, E)` where `V = {(r, c) | 0 <= r < N, 0 <= c < N}` for board size `N` (standard: N=19; also supported: N=9, N=13). `E` contains edges between orthogonally adjacent vertices: `((r1,c1), (r2,c2)) in E` iff `|r1-r2| + |c1-c2| = 1`.

**Implementation notes**:
- Board sizes supported: 9, 13, 19. These are the three standard sizes.
- Total intersections: `N * N` (81, 169, 361 respectively).
- Adjacency is 4-connected (up, down, left, right). Diagonal adjacency does not exist.
- Corner vertices have 2 neighbors, edge vertices have 3 neighbors, interior vertices have 4 neighbors.

### Rule 2: Point States

> "Each point on the grid may be colored black, white, or empty."

**Formal definition**: A board state `S: V -> {Empty, Black, White}` is a function mapping every intersection to one of three states.

**Implementation notes**:
- Encode as `Uint8Array` of length `N * N`. Values: `0 = Empty`, `1 = Black`, `2 = White`.
- Total possible board states: `3^(N*N)`. For 19x19: `3^361 ~= 1.74 * 10^172`.

### Rule 3: Reaching (Connectivity)

> "A point P, not colored C, is said to reach C, if there is a path of (vertically or horizontally) adjacent points of P's color from P to a point of color C."

**Formal definition**: Let `color(P)` denote the state of point P under board state S. Point P **reaches** color C iff:
- `color(P) != C` (P is NOT of color C), AND
- there exists a sequence of points `P = P0, P1, ..., Pk` (where `k >= 1`) such that:
  1. For all `i in [0, k-1]`: `(Pi, Pi+1) in E` (orthogonal adjacency).
  2. For all `i in [0, k-1]`: `color(Pi) = color(P)` (the path follows P's own color).
  3. `color(Pk) = C` (the terminal point has color C).

Note: P does NOT reach its own color (the definition requires `color(P) != C`). The path length `k >= 1` means at least one step is required. A Black stone reaches Empty if it (or any connected Black stone) is adjacent to an empty intersection. A Black stone reaches White if it (or any connected Black stone) is adjacent to a White stone.

**Implementation notes**:
- "Reaching" is equivalent to: starting from P, perform a flood-fill (BFS/DFS) through points of the same color as P, and check if any adjacent point of the flood-filled region has color C.
- A group "reaches empty" iff the group has at least one liberty.
- A group "reaches" an opponent color iff some stone in the group is adjacent to an opponent stone.

### Rule 4: Clearing

> "Clearing a color means removing (setting to empty) all points of that color that do not reach empty."

**Formal definition**: `Clear(S, C)` produces a new board state S' where:
- For every point P with `color(P) = C`: if P does not reach Empty in state S, then `S'(P) = Empty`.
- All other points remain unchanged.

**Implementation notes**:
- Clearing requires identifying all connected groups of color C.
- For each group, check if the group reaches Empty (i.e., has at least one liberty).
- Groups with zero liberties are removed (all their stones set to Empty).
- A single Clear operation may remove multiple disjoint groups simultaneously.
- Use Union-Find or BFS/DFS to identify connected groups.

### Rule 5: Alternation

> "Starting with an empty grid, the players alternate turns, starting with Black."

**Formal definition**: Let `turn(k)` denote the player whose turn it is at move number k (0-indexed). `turn(0) = Black`. `turn(k) = Black if k is even, White if k is odd`.

**Implementation notes**:
- The initial board state is all Empty.
- Pass does not change whose turn it is: after Black passes, it is White's turn.
- Track the current player as a single bit or enum.

### Rule 6: Turn Options

> "A turn is either a pass; or a move that doesn't repeat an earlier grid coloring."

**Formal definition**: On each turn, a player must do exactly one of:
1. **Pass**: The board state remains unchanged.
2. **Move**: Place a stone, apply captures and self-captures (Rule 7), producing a new board state. The resulting board state must not be identical to any previous board state in the game history (positional superko).

**Implementation notes**:
- **Positional Superko (PSK)**: The resulting board state after a move must not match ANY previous board state, regardless of whose turn it was. This is more restrictive than simple ko (which only compares to the state two moves ago).
- Store the hash of every board state in a `Set<bigint>` for O(1) superko lookup.
- The CMU version states: "a move that does not leave a grid pattern identical to one that that player has previously left" -- this is **situational superko (SSK)**. Tromp's website uses PSK. **This specification adopts PSK** (positional superko) as it is simpler and more commonly used in computer Go.
- Under PSK, a move is illegal iff the resulting board hash already exists in the history set.

### Rule 7: Move Mechanics

> "A move consists of coloring an empty point one's own color; then clearing the opponent color, and then clearing one's own color."

**Formal definition**: A move by player P at point V (where `S(V) = Empty`) proceeds in three atomic sub-steps:
1. **Place**: Set `S(V) = P` (place the stone).
2. **Capture**: `S = Clear(S, opponent(P))` (remove all opponent groups with zero liberties).
3. **Self-Capture**: `S = Clear(S, P)` (remove all own groups with zero liberties -- this is suicide).

The order is critical: captures happen before self-captures.

**Implementation notes**:
- After step 1 (Place), the placed stone may have zero liberties BUT the opponent groups it touches may also have zero liberties.
- Step 2 (Capture) removes opponent groups that lost their last liberty due to the placed stone. This may create new liberties for the placed stone.
- Step 3 (Self-Capture) removes the placed stone's group only if it still has zero liberties after opponent captures are resolved.
- **Mutual exclusivity**: For any given move, at most one of {Capture, Self-Capture} has effect. If the placed stone captures opponent stones, it gains at least one liberty, so self-capture cannot apply. If no opponent stones are captured, self-capture may apply.
- Suicide is legal under Tromp-Taylor rules. A player may place a stone that results in the removal of the placed stone and its group.

### Rule 8: Game Termination

> "The game ends after two consecutive passes."

**Formal definition**: The game terminates when the last two actions in the move history are both passes. Formally: if `action(k) = Pass` and `action(k-1) = Pass`, the game ends.

**Implementation notes**:
- Track a consecutive-pass counter. Increment on pass, reset to 0 on any move.
- When the counter reaches 2, the game enters the scoring phase.
- There is no mandatory number of moves before passes are allowed.
- Resignation is not part of the Tromp-Taylor rules but is a conventional game-ending action. Implement it as a separate game-flow event.

### Rule 9: Scoring

> "A player's score is the number of points of her color, plus the number of empty points that reach only her color."

**Formal definition**: After the game ends with board state S:
- `Score(P) = |{V | S(V) = P}| + |{V | S(V) = Empty AND V reaches P AND V does NOT reach opponent(P)}|`
- In words: count of own stones + count of empty points that are completely surrounded by own color (territory).

**Implementation notes**:
- This is **area scoring** (Chinese-style). Both stones on the board and enclosed empty territory count.
- An empty point that reaches both Black and White is **neutral** (dame) and counts for neither player.
- An empty point that reaches neither Black nor White is impossible on a non-empty board (it would need to be completely isolated from all stones, which cannot happen with standard topology).
- Empty regions are connected components of empty points. Each region reaches one or both colors. If it reaches exactly one color, it is territory for that color. If it reaches both, it is dame.
- Komi (compensation for White going second) is added to White's score. Standard komi values: 7.5 (19x19), 5.5 (13x13), 5.5 (9x9). The 0.5 prevents ties.

### Rule 10: Winner Determination

> "The player with the higher score at the end of the game is the winner. Equal scores result in a tie."

**Formal definition**: Let `FinalScore(Black) = Score(Black)` and `FinalScore(White) = Score(White) + Komi`.
- If `FinalScore(Black) > FinalScore(White)`: Black wins by `FinalScore(Black) - FinalScore(White)` points.
- If `FinalScore(White) > FinalScore(Black)`: White wins by `FinalScore(White) - FinalScore(Black)` points.
- If `FinalScore(Black) = FinalScore(White)`: Tie (jigo).

**Implementation notes**:
- With 0.5 komi, ties are impossible in practice.
- Integer komi (e.g., 7) allows ties.
- The result string format is: `"B+5.5"` (Black wins by 5.5), `"W+0.5"` (White wins by 0.5), or `"0"` (tie).
- Resignation result: `"B+R"` or `"W+R"`.
- Time loss result: `"B+T"` or `"W+T"`.

---

## 2. Formal Definitions

### 2.1 Core Terminology

| Term | Korean (Romanized) | Definition |
|------|-------------------|------------|
| **Intersection** | Gyo-cha-jeom (교차점) | A point `(r, c)` on the board grid where `0 <= r < N` and `0 <= c < N`. |
| **Stone** | Dol (돌) | A Black or White piece placed on an intersection. |
| **Empty** | Bin-jeom (빈점) | An intersection with no stone. |
| **Adjacent** | In-jeop (인접) | Two intersections `(r1,c1)` and `(r2,c2)` are adjacent iff `|r1-r2| + |c1-c2| = 1`. |
| **Group** (aka Chain, String) | Mu-ri (무리) | A maximal connected set of stones of the same color, where connected means reachable through orthogonal adjacency. |
| **Liberty** | Hwal-ro (활로) | An empty intersection adjacent to a group. The liberty count of a group is the number of distinct empty intersections adjacent to any stone in the group. |
| **Capture** | Ttam (따냄) | Removal of an opponent group that has zero liberties after a stone is placed. |
| **Suicide** | Ja-chung (자충) | A move that results in the removal of the player's own group (legal under Tromp-Taylor). |
| **Ko** | Pae (패) | A board position pattern where two players could alternately capture and recapture a single stone indefinitely. Under superko, the recapture is forbidden. |
| **Superko** | Choguepae (초과패) / Positional Superko | The rule that no board position may be repeated during a game (Rule 6). |
| **Territory** | Jip (집) | Empty intersections that reach exactly one color. |
| **Dame** | Gongbae (공배) | Neutral empty points that reach both Black and White, or are otherwise not territory. |
| **Komi** | Deom (덤) | Compensation points added to White's score for Black's first-move advantage. |
| **Atari** | Dan-su (단수) | A group with exactly one liberty remaining. |
| **Seki** | Bik (빅) | Mutual life: groups of opposing colors that cannot capture each other because any attempt results in self-atari. |
| **Eye** | Nun (눈) | An empty intersection completely surrounded by stones of one color (and the surrounding group must be alive). |
| **Pass** | Pas (패스) | A turn where the player does not place a stone. |
| **Move** | Su (수) | A turn where the player places a stone at an empty intersection. |

### 2.2 Derived Concepts

| Concept | Definition |
|---------|------------|
| **Alive** | A group is alive if it cannot be captured regardless of opponent's play. Sufficient condition: two or more true eyes. Also alive by seki. |
| **Dead** | A group is dead if it can be captured regardless of the owning player's defense. Under Tromp-Taylor/Chinese rules, dead stones that are not actually captured remain on the board and count for the opponent during scoring only if they are captured. Players must capture dead stones before passing, or they remain as-is. |
| **True Eye** | An empty intersection where: (1) all orthogonally adjacent intersections contain stones of the same color (or are off-board), AND (2) for corner points: the one diagonally adjacent on-board intersection contains a friendly stone; for edge points: at least 2 of 2 diagonal on-board intersections contain friendly stones; for interior points: at least 3 of 4 diagonal intersections contain friendly stones. |
| **False Eye** | An empty intersection that appears to be an eye but can be filled by the opponent because one or more diagonal neighbors are opponent stones, compromising the eye shape. |
| **Connected** | Two stones of the same color are connected if there exists a path between them through orthogonally adjacent same-color stones. |
| **Cut** | The placement of a stone between two opponent groups that were previously connected. |
| **Capture Count** | The total number of opponent stones removed from the board during the game (tracked for UI, not used in area scoring). |

---

## 3. Board Representation Specification

### 3.1 Primary Data Structure: 1D Uint8Array

```
Board: Uint8Array of length N * N (row-major order)
```

**Cell Encoding**:
| Value | Meaning | TypeScript Constant |
|-------|---------|-------------------|
| 0 | Empty | `EMPTY = 0` |
| 1 | Black | `BLACK = 1` |
| 2 | White | `WHITE = 2` |

**Index Conversion**:
```
index = row * boardSize + col
row = Math.floor(index / boardSize)
col = index % boardSize
```

**Adjacency Computation**:
For a given index `i` on a board of size `N`:
```
neighbors(i, N) = [
  i - N,     // up    (valid if row > 0)
  i + N,     // down  (valid if row < N - 1)
  i - 1,     // left  (valid if col > 0)
  i + 1,     // right (valid if col < N - 1)
]
```

Validity checks prevent wrap-around:
- Up: `i >= N`
- Down: `i < N * (N - 1)`
- Left: `i % N !== 0`
- Right: `i % N !== N - 1`

### 3.2 Pre-computed Adjacency Table

For performance, pre-compute a neighbor table at initialization:

```
adjacencyTable: Int16Array[] of length N * N
adjacencyTable[i] = array of valid neighbor indices for intersection i
```

Each entry has 2-4 elements. Total memory for 19x19: `361 * 4 * 2 bytes = ~2.9 KB`.

### 3.3 Board State Object

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

### 3.4 Game State Object

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

### 3.5 Move Record

```typescript
type MoveRecord =
  | { type: 'move'; player: 1 | 2; index: number; captured: number[]; hash: bigint }
  | { type: 'pass'; player: 1 | 2; hash: bigint }
  | { type: 'resign'; player: 1 | 2 };
```

### 3.6 Group Representation

```typescript
interface Group {
  color: 1 | 2;
  stones: Set<number>;        // set of board indices
  liberties: Set<number>;     // set of board indices of empty adjacent points
}
```

**Finding groups**: BFS/DFS from any stone, following same-color adjacency. Mark visited stones to avoid re-traversal. A group's liberties are the unique empty neighbors of all stones in the group.

### 3.7 Memory Budget

| Board Size | Grid Memory | Adjacency Table | Zobrist Table | Total |
|-----------|-------------|-----------------|---------------|-------|
| 9x9 | 81 bytes | ~648 bytes | 1,296 bytes | ~2 KB |
| 13x13 | 169 bytes | ~1,352 bytes | 2,704 bytes | ~4.2 KB |
| 19x19 | 361 bytes | ~2,888 bytes | 5,776 bytes | ~9 KB |

---

## 4. Zobrist Hashing Specification

### 4.1 Overview

Zobrist hashing provides O(1) incremental updates to a board hash after each move. This hash is used for positional superko detection (Rule 6).

### 4.2 Hash Table

```
zobristTable: bigint[2][N * N]
```

- `zobristTable[0][i]` = random 64-bit value for Black stone at index `i`.
- `zobristTable[1][i]` = random 64-bit value for White stone at index `i`.

For 19x19: `2 * 361 = 722` random 64-bit values.

### 4.3 Initialization

Generate `zobristTable` using a seeded PRNG (e.g., xoshiro256** with a fixed seed) to ensure deterministic, reproducible hashes across sessions.

```
seed = 0x4BAD_UCK_G0_2026n  // fixed seed, any arbitrary value
for color in [0, 1]:         // 0 = Black mapping, 1 = White mapping
  for i in [0, N*N):
    zobristTable[color][i] = prng.nextBigInt64()
```

The PRNG must produce uniform 64-bit values. Collision probability with 64-bit hashes over a 400-move game: approximately `400^2 / 2^64 ~= 8.7 * 10^-15` per pair, negligible.

### 4.4 Hash Computation

**Full board hash** (for initialization or verification):
```
hash = 0n
for i in [0, N*N):
  if grid[i] === BLACK:
    hash ^= zobristTable[0][i]
  else if grid[i] === WHITE:
    hash ^= zobristTable[1][i]
```

### 4.5 Incremental Update

When placing a stone of color `c` at index `i`:
```
hash ^= zobristTable[c - 1][i]   // c is 1 (BLACK) or 2 (WHITE); index into table is c-1
```

When removing (capturing) a stone of color `c` at index `i`:
```
hash ^= zobristTable[c - 1][i]   // XOR is its own inverse
```

**Full move update**:
1. XOR in the placed stone.
2. For each captured stone, XOR out that stone.
3. For each self-captured stone (suicide), XOR out that stone.

### 4.6 Superko Detection

```
// Before finalizing a move:
const newHash = computeHashAfterMove(currentHash, placedIndex, capturedIndices, selfCapturedIndices);
if (positionHashes.has(newHash)) {
  // Move is ILLEGAL (positional superko violation)
}
// After finalizing:
positionHashes.add(newHash);
```

### 4.7 Simple Ko Optimization

While positional superko covers all cases, simple ko accounts for >99% of ko situations. Tracking the ko point separately allows fast pre-filtering:

A simple ko point exists after a move that:
1. Captures exactly one stone.
2. The capturing stone has exactly one liberty (the point just vacated by capture).
3. The capturing stone is alone (group size 1).

When these conditions are met, store the captured stone's position as `koPoint`. The opponent cannot immediately play at `koPoint`. Clear `koPoint` after any other move or pass.

This optimization avoids checking the full superko hash set for the common case, but the hash set check must still be performed for correctness in complex superko situations.

---

## 5. Chinese Scoring Algorithm

### 5.1 Preconditions

Chinese scoring (area scoring) is performed after the game ends (two consecutive passes). Under Tromp-Taylor rules, dead stones that are not captured remain on the board and count for the player whose color they are. Players must capture dead stones during play before passing if they want them removed.

### 5.2 Algorithm: Step-by-Step

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

### 5.3 Scoring Properties

1. `blackStones + whiteStones + blackTerritory + whiteTerritory + dame = N * N` (all points accounted for).
2. Under area scoring, prisoners (captured stones) are not counted separately; they are already reflected by the stone count on the board.
3. If both players play optimally under area scoring, the last move should not matter (unlike territory scoring where it does).

### 5.4 Seki Scoring Under Chinese Rules

Under Chinese/area scoring, seki groups are alive and their stones count toward their owner's score. The shared liberties (empty points adjacent to both Black and White seki groups) reach both colors, so they are dame and score zero for both players. No special handling is needed beyond the standard algorithm.

### 5.5 Dead Stone Handling Under Tromp-Taylor

Under Tromp-Taylor rules, there is no "dead stone agreement" phase. All stones on the board when the game ends count as-is. If a player believes an opponent's group is dead, that player must capture it during play. This eliminates all ambiguity about life and death, at the cost of requiring extra moves to capture dead stones.

---

## 6. Edge Case Encyclopedia

### EC-01: Simple Ko

**Description**: The most common ko. A single stone captures a single stone, and the opponent could immediately recapture the single stone.

**Formal condition**: After player P places a stone at index V, capturing exactly one opponent stone at index W, the resulting position has the placed stone at V with exactly one liberty (the point W). If the opponent were to play at W, they would capture the stone at V, recreating the previous board position.

**Rule application**: Under positional superko (Rule 6), the opponent's recapture at W is forbidden because it would recreate a previous board state. Under simple ko (optimization), store W as the ko point; the opponent cannot play at W on their immediate next turn.

**Detection**: After a capture:
1. Exactly one stone was captured.
2. The placed stone forms a group of size 1.
3. The placed stone has exactly one liberty (the point of the captured stone).

### EC-02: Snapback

**Description**: A situation where a player can capture an opponent stone, but the opponent can immediately recapture more stones. This is NOT a ko because the board position is different after recapture (more stones are removed).

**Example**: Black has a group of 3 stones with 1 liberty. White captures by playing at that liberty. But then Black plays at the point White just vacated, capturing a larger White group of 2+ stones. The board state is materially different from the original, so superko does not apply.

**Formal condition**: Player A places at V, capturing B's stones. Player B then plays at one of the vacated points, capturing A's group (which includes the stone just placed at V and possibly others). The resulting board state differs from any previous state because more stones were removed.

**Rule application**: Snapback is legal. It is not subject to ko restrictions because the board state after recapture is novel.

**Implementation note**: The ko-point optimization must NOT flag snapback as ko. Check: if more than one stone is captured, or if the capturing group has more than one stone, it is not a simple ko.

### EC-03: Double Ko

**Description**: Two separate simple ko positions on the board. A player can use one ko as a "threat" against the other, leading to complex strategic situations.

**Formal condition**: Two independent regions each contain a simple ko shape. Each ko can be captured independently. Under positional superko, the cycle is eventually broken because the combined board state repeats.

**Rule application**: Positional superko prevents infinite cycling. After several ko captures, one player will be unable to recapture because the resulting board state would match a previous one.

### EC-04: Triple Ko

**Description**: Three independent ko positions on the board. Without superko, players could cycle indefinitely through all three kos.

**Formal condition**: Three independent regions each contain a simple ko. Players can cycle captures across all three. Under positional superko, the game cannot cycle because board positions eventually repeat and such moves are forbidden.

**Rule application**: Under Tromp-Taylor PSK, triple ko situations are resolved by the superko rule. Some moves become illegal, forcing players to play elsewhere or pass.

### EC-05: Eternal Ko (Chosei)

**Description**: A ko-like cycle involving larger groups where captures create new ko situations endlessly.

**Formal condition**: A cyclical sequence of captures and recaptures involving groups of more than one stone, such that the same board positions would recur. Involves at least 4 moves in the cycle.

**Rule application**: Positional superko (Rule 6) prevents this. Any move that recreates a previous board state is illegal.

### EC-06: Quadruple Ko

**Description**: Four independent ko situations. Even rarer than triple ko. Theoretical and composed problems demonstrate this pattern.

**Rule application**: Same as triple ko; positional superko prevents cycling.

### EC-07: Seki (Mutual Life)

**Description**: A position where two opposing groups share liberties such that neither player can capture the other without putting their own group in atari (or being captured first).

**Formal condition**: Groups G_b (black) and G_w (white) are in seki if:
1. Neither G_b nor G_w has two true eyes.
2. All empty points adjacent to both G_b and G_w (shared liberties) are such that playing on any of them by either player results in that player's group being capturable.
3. No sequence of moves by one player can capture the other player's group without the opponent being able to prevent capture.

**Scoring**: Under Chinese/area scoring, stones in seki groups count for their respective owners. Shared liberties are dame (score zero).

**Types of seki**:
- **Basic seki**: Two groups share 1-2 liberties, neither can play.
- **Seki with eyes**: One or both groups have one eye plus shared liberties.
- **Three-group seki**: Three groups (2 of one color, 1 of another) in mutual life.

### EC-08: Bent Four in the Corner

**Description**: A specific shape where four stones are arranged in a bent line in a corner of the board. One player's group occupies a 2x3 area in the corner with a specific stone configuration.

**Formal condition**: A group of 4 stones forms an L-shape (bent-four) in the corner, and the opponent has stones surrounding it. The status depends on ko threats elsewhere on the board.

**Under Tromp-Taylor/Chinese rules**: Bent four in the corner is NOT automatically dead. It must be played out. If the defender has sufficient ko threats, the group can live. If not, the attacker can capture it through ko fights. This differs from Japanese rules, where bent four in the corner is declared dead by rule.

**Implementation note**: No special-case code is needed. The standard rules (place, capture, superko) handle this correctly.

### EC-09: Two-Eye Life

**Description**: A group with two or more true eyes cannot be captured because the opponent cannot fill both eyes simultaneously (doing so would be suicide).

**Formal condition**: A group G has true eyes E1 and E2 (both surrounded entirely by stones of G's color with sufficient diagonal control). To capture G, the opponent must fill all liberties of G. But the last two liberties are E1 and E2, and playing in either one while the other is still empty is suicide (the group still has a liberty).

**Implementation note**: Life/death determination is not required for correct game play or scoring under Tromp-Taylor rules (players must capture dead stones). It is required for AI analysis and commentary features (Step 13 template engine).

### EC-10: False Eye

**Description**: An empty point that looks like an eye but is not a true eye because diagonal control is insufficient.

**Formal condition**: An empty point V is a false eye of group G if:
1. All orthogonal neighbors of V that are on the board are stones of G's color.
2. BUT the diagonal condition fails: for an interior point, 2 or more diagonal neighbors are opponent stones or empty; for an edge point, 1 or more; for a corner point, 1.

**Result**: The opponent can eventually fill V, reducing the group's eye count. A group with only false eyes (and no true eyes, or only one true eye) may be dead.

### EC-11: Connect-and-Die (Uttegaeshi)

**Description**: A situation where connecting two groups into one actually kills the combined group because the connected group has fewer liberties than the separate groups.

**Formal condition**: Player P has two separate groups G1 and G2. Playing a stone to connect them creates a single group G3. But G3 has fewer liberties than G1 and G2 did separately, and the opponent can immediately capture G3.

**Implementation note**: No special handling needed; standard capture mechanics apply.

### EC-12: Semeai (Capturing Race / Liberty Race)

**Description**: Two adjacent groups of opposite colors, neither alive independently, racing to capture the other. The group that runs out of liberties first is captured.

**Formal condition**: Groups G_b and G_w are adjacent, share liberties, and neither has two eyes. The player who can reduce the opponent's liberties to zero first wins the capturing race.

**Key factors**:
1. Number of liberties of each group.
2. Number of shared liberties (dame between the groups).
3. Existence of "approach move" liberties (inside liberties that can only be filled last).
4. Whose turn it is.

**Implementation note**: Semeai resolution is emergent from correct game play; no special rules needed. It is relevant for AI analysis commentary.

### EC-13: Suicide (Self-Capture)

**Description**: A move where the placed stone (and its group) has zero liberties after opponent captures are resolved, resulting in the removal of the player's own group.

**Formal condition**: After placing a stone at V and clearing opponent groups, the group containing V has zero liberties. Under Tromp-Taylor rules, the group is removed (cleared).

**Legality**: Legal under Tromp-Taylor rules. The only restriction is superko: if the suicide would recreate a previous board position, it is illegal.

**Common case**: Single-stone suicide into a single-liberty position where no captures occur. The stone is placed and immediately removed. This is equivalent to a pass in terms of board state change (the board returns to its previous state), which means superko would forbid it if the previous state is in the history. Therefore, **single-stone suicide into an empty space surrounded by opponent stones is forbidden by superko** (it recreates the state before the stone was placed).

**Exception**: Multi-stone suicide where the resulting board state is novel (has never occurred before) is legal.

### EC-14: Positional Superko Edge Cases

**Description**: Positions where the simple ko rule is insufficient and full positional superko is needed.

**Cases**:
1. **Sending-two-returning-one**: A sacrifice of two stones that allows recapture of one stone in a different location, creating a cycle longer than 2 moves.
2. **Triple ko** (see EC-04).
3. **Eternal life** (see EC-05).
4. **Long cycles**: Any cycle of length > 2 that repeats board positions.

**Implementation note**: The `positionHashes: Set<bigint>` must store every board hash from the start of the game. This set grows linearly with game length (at most ~400 entries for a typical 19x19 game).

### EC-15: Pass-for-Ko (Strategic Pass)

**Description**: A player passes not because there are no useful moves, but to resolve a ko situation. After a pass, the opponent's previous ko restriction is lifted (under simple ko), but under positional superko, the restriction depends on whether the resulting board state has been seen before.

**Formal condition**: Player P passes. The board state does not change. On the next turn, any move that does not recreate a previous board state is legal.

**Implementation note**: A pass does not change the board hash. After a pass, the opponent can play at the ko point because:
1. They would place a stone (changing the board state).
2. The resulting board state must be checked against the full history, not just the immediate previous state.
3. Under PSK, if the board state after capturing at the ko point has been seen before (from before the pass), it is still illegal.

**Practical impact**: Under PSK, strategic passes to "reset" ko are more nuanced than under simple ko. The implementation must use the full hash history, not just the ko-point optimization.

### EC-16: Group Lifecycle

**Description**: Stones placed on the board may later be captured. A single stone can be the seed of a group that grows through adjacent placements, loses liberties through opponent play, and is eventually captured or survives to the end of the game.

**States a stone can be in**:
1. Placed on the board (part of a group).
2. Captured (removed from board, increments opponent's capture count).
3. Never transitions back to the board (no recycling in Go).

### EC-17: Board Edges and Corners

**Description**: Intersections on the edges and corners of the board have fewer neighbors than interior intersections, fundamentally affecting life, death, and territory.

**Formal properties**:
- Corner intersections (4 total): 2 neighbors.
- Edge intersections (non-corner, `4*(N-2)` total): 3 neighbors.
- Interior intersections (`(N-2)^2` total): 4 neighbors.

**Impact on play**:
- Groups on the edge need fewer stones to make two eyes.
- Corner groups are easier to kill but also easier to defend (fewer approach directions).
- Territory efficiency is highest in corners, then edges, then center.

### EC-18: Empty Board Pass

**Description**: A player passes on an empty board (or very early in the game). This is legal but strategically nonsensical.

**Rule application**: A pass on an empty board is legal. Two consecutive passes on an empty board end the game with a score of 0 for Black and `komi` for White (White wins by komi).

### EC-19: Full Board

**Description**: All intersections are occupied. This is extremely rare in practice but theoretically possible.

**Rule application**: With all intersections filled, no moves are possible (no empty points to place stones). Both players must pass, ending the game. Score is simply the stone count plus komi.

### EC-20: Moonshine Life

**Description**: A position where a group is alive because the opponent cannot approach without creating a ko that favors the defender, effectively making the group unconditionally alive in practice despite not having two conventional eyes.

**Rule application**: No special handling. The standard rules handle this correctly; the opponent simply cannot execute a successful capture sequence.

---

## 7. Incremental Build Order

The rules engine must be built in a specific order to manage complexity. Each stage builds on the previous one and can be independently tested.

### Stage 1: Place

**Implements**: Rules 1, 2, 5 (partial), 7 (step 1 only).

**Functionality**:
- Create an empty board of size N.
- Place a stone at an intersection.
- Validate that the intersection is empty.
- Alternate between Black and White.

**Test cases**:
- Place stone on empty board.
- Reject placement on occupied intersection.
- Verify alternation.

### Stage 2: Capture

**Implements**: Rules 3, 4, 7 (steps 2-3).

**Functionality**:
- After placing a stone, identify opponent groups with zero liberties.
- Remove captured groups.
- After opponent captures, identify own groups with zero liberties (suicide).
- Remove self-captured groups.
- Track capture counts.

**Test cases**:
- Capture a single stone (surround and fill last liberty).
- Capture a group of multiple stones.
- Capture multiple groups in a single move.
- Suicide: single stone into fully surrounded position.
- Suicide: multi-stone group loses last liberty.
- Snapback (capture then recapture is legal).

### Stage 3: Ko

**Implements**: Rule 6 (simple ko optimization).

**Functionality**:
- Detect simple ko conditions after each capture.
- Store ko point.
- Reject moves at the ko point on the immediately following turn.
- Clear ko point after any other move or pass.

**Test cases**:
- Simple ko: reject immediate recapture.
- Simple ko: allow recapture after intervening move.
- Snapback: verify it is NOT flagged as ko.
- Multiple captures: verify no ko point is set.

### Stage 4: Scoring

**Implements**: Rules 9, 10.

**Functionality**:
- Identify connected empty regions.
- Classify each region as Black territory, White territory, or dame.
- Count stones on the board.
- Compute final scores with komi.
- Determine winner.

**Test cases**:
- Empty board: Black=0, White=komi.
- One stone on board: territory calculation.
- Seki: shared liberties count as dame.
- Complex position with mixed territories.
- Full board: score = stone count.

### Stage 5: Superko

**Implements**: Rule 6 (full positional superko).

**Functionality**:
- Zobrist hashing: initialize hash table, compute hash incrementally.
- Store all board hashes in a Set.
- Check every move against the history set.
- Reject moves that recreate any previous board state.

**Test cases**:
- Simple ko is correctly handled by superko.
- Triple ko: verify all repeated positions are rejected.
- Sending-two-returning-one: verify cycle is broken.
- Suicide that recreates previous position: rejected.
- Long game: verify hash set grows correctly.

### Stage 6: Game Flow

**Implements**: Rules 5, 8, 10.

**Functionality**:
- Track consecutive passes.
- End game after two consecutive passes.
- Handle resignation.
- Complete game result reporting.

**Test cases**:
- Two passes end the game.
- Pass-move-pass: game does not end (non-consecutive).
- Resignation by either player.
- Score reporting format.

---

## 8. Data Source Catalog

### DS-01: CWI Dataset

| Attribute | Value |
|-----------|-------|
| **Name** | CWI Go Games Database |
| **URL** | https://homepages.cwi.nl/~aeb/go/games/ |
| **Size** | 88,888+ games |
| **Format** | SGF (Smart Game Format) |
| **Content** | Japanese professional Go games |
| **License** | Public domain |
| **Download** | `.tar.gz` archive (45 MB) or `.7z` archive (27 MB) |
| **Coverage** | Major Japanese tournaments (Honinbo, Kisei, Meijin, etc.) up to 2025 |
| **Usage in project** | Template engine pattern training, position classification, commentary examples |
| **Acquisition method** | Download archive, extract SGF files, parse with @sabaki/sgf |

### DS-02: featurecat/go-dataset

| Attribute | Value |
|-----------|-------|
| **Name** | Fox Go Server Dataset |
| **URL** | https://github.com/featurecat/go-dataset |
| **Size** | 21.1 million games |
| **Format** | SGF, compressed as 7-zip archives |
| **Content** | Games from Fox Go Server (foxwq.com), all ranks 18k to 9p |
| **License** | Public (GitHub, free download) |
| **Download** | Individual rank archives via GitHub; total ~10.6 GB compressed |
| **Date range** | 2012-2019 |
| **Rank breakdown** | Pro: 10,349; 9d: 59,757; ... 18k: 501,020 (3-dan is largest: 3.2M) |
| **Usage in project** | Large-scale pattern analysis, AI commentary quality benchmarking, opening database |
| **Acquisition method** | Selective download by rank (prioritize Pro and high-dan); parse with @sabaki/sgf |

### DS-03: @sabaki/sgf

| Attribute | Value |
|-----------|-------|
| **Name** | Sabaki SGF Parser |
| **URL** | https://www.npmjs.com/package/@sabaki/sgf |
| **GitHub** | https://github.com/SabakiHQ/sgf |
| **Type** | npm package |
| **License** | MIT |
| **Acquisition** | `npm install @sabaki/sgf` |
| **API** | `parse(sgfString)` returns game tree nodes; `parseFile(path)` for Node.js |
| **Usage in project** | Parse all SGF files from DS-01 and DS-02; export game records from the application |
| **Related packages** | `@sabaki/immutable-gametree` (compatible tree structure) |
| **Compatibility** | TypeScript compatible; works in Node.js and browser (browser: no `parseFile`) |

---

## 9. Entity Catalog

### Category 1: Board Geometry (E01-E08)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E01 | Board | The NxN grid of intersections | `{ size: 9\|13\|19; grid: Uint8Array }` | `grid.length === size * size` |
| E02 | Intersection | A single point on the board | `number` (index) | `0 <= index < size * size` |
| E03 | Row | Horizontal line of intersections | `number` | `0 <= row < size` |
| E04 | Column | Vertical line of intersections | `number` | `0 <= col < size` |
| E05 | Coordinate | A (row, col) pair identifying an intersection | `{ row: number; col: number }` | `0 <= row < size, 0 <= col < size` |
| E06 | AdjacencyEdge | An orthogonal connection between two intersections | `[number, number]` | `|r1-r2|+|c1-c2| === 1` |
| E07 | NeighborList | Pre-computed list of valid neighbors for each intersection | `Int16Array[]` | `2 <= length <= 4` per entry |
| E08 | BoardRegion | A connected set of intersections sharing the same state | `Set<number>` | Non-empty; all same color or all empty |

### Category 2: Stone States (E09-E14)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E09 | CellState | The state of a single intersection | `0 \| 1 \| 2` | 0=Empty, 1=Black, 2=White |
| E10 | Stone | A placed piece on the board | `{ index: number; color: 1\|2 }` | Board at index must be non-empty |
| E11 | BlackStone | A stone of color Black | `1` (constant) | `grid[index] === 1` |
| E12 | WhiteStone | A stone of color White | `2` (constant) | `grid[index] === 2` |
| E13 | EmptyPoint | An unoccupied intersection | `0` (constant) | `grid[index] === 0` |
| E14 | CapturedStone | A stone that has been removed from the board | `{ index: number; color: 1\|2; moveNumber: number }` | Previously on board, now removed |

### Category 3: Groups (E15-E20)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E15 | Group | Maximal connected set of same-color stones | `{ color: 1\|2; stones: Set<number>; liberties: Set<number> }` | Non-empty; all stones same color and connected |
| E16 | GroupId | Unique identifier for a group during a board state | `number` | Unique per board state |
| E17 | GroupSize | Number of stones in a group | `number` | `>= 1` |
| E18 | LibertyCount | Number of empty intersections adjacent to a group | `number` | `>= 0`; 0 means group is captured |
| E19 | Atari | State where a group has exactly one liberty | `boolean` | `libertyCount === 1` |
| E20 | GroupMembership | Mapping from each stone index to its group | `Map<number, GroupId>` | Each stone belongs to exactly one group |

### Category 4: Liberties (E21-E25)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E21 | Liberty | An empty intersection orthogonally adjacent to at least one stone of a group | `number` (index) | `grid[index] === 0` |
| E22 | SharedLiberty | An empty intersection adjacent to groups of both colors | `number` (index) | Adjacent to both a Black and a White group |
| E23 | InternalLiberty | An empty point fully enclosed within a single group (potential eye) | `number` (index) | All neighbors are same-color stones or off-board |
| E24 | ExternalLiberty | An empty point on the boundary between a group and the open board | `number` (index) | At least one neighbor is empty or opponent |
| E25 | LibertyDelta | Change in liberty count after a move | `number` | Can be negative (losing) or positive (gaining) |

### Category 5: Territory and Scoring (E26-E35)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E26 | Territory | Set of empty points that reach only one color | `{ owner: 1\|2; points: Set<number> }` | All points are empty; reaches only one color |
| E27 | Dame | Neutral empty points that reach both colors | `Set<number>` | All points are empty; reaches both colors |
| E28 | EmptyRegion | Connected component of empty intersections | `{ points: Set<number>; reachesBlack: boolean; reachesWhite: boolean }` | Non-empty set |
| E29 | Score | A player's total points (stones + territory) | `number` | `>= 0` |
| E30 | Komi | Compensation points for White | `number` | Standard: 7.5 (19x19), 5.5 (9x9, 13x13) |
| E31 | FinalScore | Score including komi: `Score(White) + Komi` | `number` | `>= 0` |
| E32 | ScoreResult | Complete scoring breakdown | `{ blackStones, whiteStones, blackTerritory, whiteTerritory, dame, komi, blackScore, whiteScore, result }` | All fields non-negative |
| E33 | CaptureCount | Total stones captured by a player during the game | `number` | `>= 0`; not used in area scoring calculation |
| E34 | ScoringMethod | The scoring system used | `'chinese'` | Phase 1: Chinese only |
| E35 | Margin | The point difference between winner and loser | `number` | `> 0` for decisive game; `0` for tie |

### Category 6: Game Flow (E36-E46)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E36 | Move | A turn where a stone is placed | `{ type: 'move'; player: 1\|2; index: number }` | Target must be empty; must not violate superko |
| E37 | Pass | A turn where no stone is placed | `{ type: 'pass'; player: 1\|2 }` | Board state unchanged |
| E38 | Resignation | A voluntary game-ending action | `{ type: 'resign'; player: 1\|2 }` | Opponent wins |
| E39 | MoveRecord | A recorded action with metadata | `{ ...Move\|Pass\|Resign; captured: number[]; hash: bigint }` | Immutable once recorded |
| E40 | MoveHistory | Ordered sequence of all actions in a game | `MoveRecord[]` | Append-only |
| E41 | MoveNumber | The index of the current turn (0-based) | `number` | `>= 0` |
| E42 | CurrentPlayer | The player whose turn it is | `1 \| 2` | Alternates each turn: `moveNumber % 2 === 0 ? 1 : 2` |
| E43 | ConsecutivePasses | Counter of consecutive pass actions | `0 \| 1 \| 2` | Reset to 0 on any move; game ends at 2 |
| E44 | GamePhase | Current phase of the game | `'playing' \| 'scoring' \| 'finished'` | Linear progression |
| E45 | GameResult | Outcome of the game | `{ winner: 1\|2\|null; method: 'score'\|'resign'\|'time'\|'tie'; margin?: number }` | Non-null after game ends |
| E46 | GameRecord | Complete record of a finished game | `{ moves: MoveRecord[]; result: GameResult; board: BoardState; metadata: GameMetadata }` | Immutable |

### Category 7: Player (E47-E50)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E47 | Player | A participant in a game (human or AI) | `{ id: string; type: 'human'\|'ai'; color: 1\|2 }` | Each game has exactly 2 players |
| E48 | PlayerColor | The color assigned to a player | `1 \| 2` | BLACK=1 or WHITE=2 |
| E49 | OpponentColor | The opposite of a player's color | `1 \| 2` | `3 - playerColor` |
| E50 | AILevel | KataGo difficulty level | `number` | `1 <= level <= 30` |

### Category 8: Time Control (E51-E55)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E51 | TimeControl | Time control settings for a game | `{ mainTime: number; byoyomi: number; periods: number }` | All values `> 0` |
| E52 | MainTime | Total time allocated per player in seconds | `number` | `> 0` |
| E53 | Byoyomi | Overtime period duration in seconds | `number` | `> 0` |
| E54 | ByoyomiPeriods | Number of overtime periods | `number` | `>= 1` |
| E55 | RemainingTime | Time left for a player | `{ mainTime: number; byoyomiPeriods: number }` | `mainTime >= 0`; `byoyomiPeriods >= 0` |

### Category 9: Analysis (E56-E62)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E56 | WinRate | Estimated probability of winning for a given player | `number` | `0.0 <= winRate <= 1.0` |
| E57 | ScoreLead | Estimated point lead for a player | `number` | Can be negative (losing) |
| E58 | BestMove | The engine's top recommended move | `{ index: number; winRate: number; visits: number }` | Valid intersection index |
| E59 | MoveVariation | A sequence of recommended moves | `number[]` | Array of intersection indices |
| E60 | Blunder | A move that significantly reduces win rate | `{ moveNumber: number; winRateDrop: number }` | `winRateDrop > threshold` (e.g., 0.05) |
| E61 | AnalysisResult | KataGo analysis output for a position | `{ moveInfos: MoveInfo[]; rootInfo: RootInfo }` | From KataGo Analysis Engine |
| E62 | Visits | Number of MCTS playouts for a position | `number` | `> 0` |

### Category 10: Rank and Rating (E63-E66)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E63 | Rank | Traditional Go rank (kyu/dan) | `string` | Format: `"30k"` to `"1k"`, `"1d"` to `"9d"`, `"1p"` to `"9p"` |
| E64 | RankNumeric | Numeric representation of rank for comparison | `number` | `30k=1`, `1k=30`, `1d=31`, `9d=39`, `1p=40`, `9p=48` |
| E65 | Rating | Elo-like numerical rating | `number` | `>= 0` |
| E66 | RatingDelta | Change in rating after a game | `number` | Can be positive or negative |

### Category 11: Ko and Superko (E67-E72)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E67 | KoPoint | The intersection where immediate recapture is forbidden (simple ko) | `number \| null` | `null` when no ko is active |
| E68 | PositionHash | Zobrist hash of a board state | `bigint` | 64-bit value |
| E69 | PositionHashHistory | Set of all previously seen board hashes | `Set<bigint>` | Grows by 1 per move (not per pass, since pass doesn't change board) |
| E70 | ZobristTable | Random values for hash computation | `bigint[][]` | `[2][N*N]` array of 64-bit values |
| E71 | SuperkoViolation | A move that would recreate a previous board state | `boolean` | Detected by hash lookup |
| E72 | KoThreat | A move played elsewhere to force the opponent to respond before returning to the ko | `number` (index) | Valid move index |

### Category 12: SGF and Data (E73-E78)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E73 | SGFString | Raw SGF file content | `string` | Must conform to SGF specification |
| E74 | SGFNode | A parsed node from an SGF game tree | `{ id: number; data: Record<string, string[]>; parentId: number\|null; children: number[] }` | Compatible with @sabaki/sgf |
| E75 | SGFGameTree | A parsed game tree from an SGF file | `SGFNode[]` | Root node has `parentId === null` |
| E76 | SGFCoordinate | SGF coordinate string (e.g., "pd" for column p, row d) | `string` | Two lowercase letters; `"aa"` = (0,0) |
| E77 | SGFProperty | A key-value pair in an SGF node | `{ key: string; values: string[] }` | Standard SGF properties: B, W, AB, AW, SZ, KM, etc. |
| E78 | GameMetadata | Metadata about a game | `{ blackPlayer: string; whitePlayer: string; date: string; result: string; boardSize: number; komi: number; rules: string }` | From SGF headers |

### Category 13: Life and Death (E79-E85)

| ID | Entity | Description | TypeScript Type Hint | Constraints |
|----|--------|-------------|---------------------|-------------|
| E79 | Alive | A group that cannot be captured | `boolean` | Sufficient: 2+ true eyes, or seki |
| E80 | Dead | A group that will be captured with correct opponent play | `boolean` | No two true eyes, no seki, insufficient ko threats |
| E81 | Unsettled | A group whose life/death depends on who plays first | `boolean` | Context-dependent |
| E82 | TrueEye | An empty intersection that is a genuine eye for a group | `boolean` | All orthogonal neighbors are same color; diagonal condition met |
| E83 | FalseEye | An empty intersection resembling an eye but compromised | `boolean` | Diagonal condition fails |
| E84 | EyeSpace | A set of connected empty points enclosed by a group | `Set<number>` | May contain true eyes, false eyes, or mixed |
| E85 | SekiGroup | A group alive by mutual life (seki) | `boolean` | Cannot capture opponent without self-atari |

---

## 10. Relation Catalog

### Board Geometry Relations (R01-R08)

| ID | Relation | From | To | Cardinality | Direction | Constraint |
|----|----------|------|-----|-------------|-----------|------------|
| R01 | AdjacentTo | Intersection | Intersection | N:M (2-4 per node) | Bidirectional | `\|r1-r2\|+\|c1-c2\| === 1` |
| R02 | InRow | Intersection | Row | N:1 | Unidirectional | `row = Math.floor(index / size)` |
| R03 | InColumn | Intersection | Column | N:1 | Unidirectional | `col = index % size` |
| R04 | DiagonalTo | Intersection | Intersection | N:M (1-4) | Bidirectional | `\|r1-r2\| === 1 AND \|c1-c2\| === 1` |
| R05 | HasIndex | Coordinate | Intersection | 1:1 | Unidirectional | `index = row * size + col` |
| R06 | ContainsIntersection | Board | Intersection | 1:N | Unidirectional | `N = size * size` |
| R07 | BelongsToRegion | Intersection | BoardRegion | N:1 | Unidirectional | Partitions all intersections |
| R08 | AdjacentRegion | BoardRegion | BoardRegion | N:M | Bidirectional | Regions share at least one adjacency edge |

### Stone and Group Relations (R09-R18)

| ID | Relation | From | To | Cardinality | Direction | Constraint |
|----|----------|------|-----|-------------|-----------|------------|
| R09 | OccupiedBy | Intersection | Stone | 1:0..1 | Unidirectional | Empty intersections have no stone |
| R10 | BelongsToGroup | Stone | Group | N:1 | Unidirectional | Every stone on the board belongs to exactly one group |
| R11 | ContainsStone | Group | Stone | 1:N | Unidirectional | `N >= 1`; group is non-empty |
| R12 | HasLiberty | Group | Liberty | 1:N | Unidirectional | `N >= 0`; N=0 means group is dead |
| R13 | AdjacentToGroup | Group | Group | N:M | Bidirectional | Groups are adjacent if any stone pair across groups is adjacent |
| R14 | OpposesGroup | Group | Group | N:M | Bidirectional | Adjacent groups of different colors |
| R15 | CapturedBy | Group | Move | 1:1 | Unidirectional | The move that reduced group's liberties to zero |
| R16 | PlacedBy | Stone | Move | 1:1 | Unidirectional | The move that created this stone |
| R17 | SharesLibertyWith | Group | Group | N:M | Bidirectional | Two groups share at least one liberty |
| R18 | MergesWith | Group | Group | N:M | Unidirectional | Placing a stone connects two or more groups into one |

### Territory and Scoring Relations (R19-R24)

| ID | Relation | From | To | Cardinality | Direction | Constraint |
|----|----------|------|-----|-------------|-----------|------------|
| R19 | OwnsTerritory | Player | Territory | 1:N | Unidirectional | Empty region reaches only this player's color |
| R20 | ReachesColor | EmptyRegion | PlayerColor | N:M (1 or 2) | Unidirectional | BFS from region touches this color |
| R21 | ContainsPoint | EmptyRegion | Intersection | 1:N | Unidirectional | Connected empty points |
| R22 | ClassifiedAs | EmptyRegion | Territory\|Dame | 1:1 | Unidirectional | Reaches one color = territory; both = dame |
| R23 | ContributesToScore | Stone\|Territory | Score | N:1 | Unidirectional | Each stone/territory point adds 1 to owner's score |
| R24 | AdjustedByKomi | Score | FinalScore | 1:1 | Unidirectional | White's FinalScore = Score + Komi |

### Game Flow Relations (R25-R31)

| ID | Relation | From | To | Cardinality | Direction | Constraint |
|----|----------|------|-----|-------------|-----------|------------|
| R25 | FollowedBy | MoveRecord | MoveRecord | 1:0..1 | Unidirectional | Temporal ordering of actions |
| R26 | PlayedBy | MoveRecord | Player | N:1 | Unidirectional | Each action has exactly one player |
| R27 | ResultsIn | MoveRecord | BoardState | 1:1 | Unidirectional | Each action produces a board state |
| R28 | Captures | Move | Group | 1:N | Unidirectional | A move may capture 0 or more groups |
| R29 | CausesKo | Move | KoPoint | 1:0..1 | Unidirectional | A move may create 0 or 1 ko points |
| R30 | EndsGame | Pass\|Resignation | GameResult | 1:0..1 | Unidirectional | Two consecutive passes or resignation ends game |
| R31 | ProducesHash | BoardState | PositionHash | 1:1 | Unidirectional | Each board state has exactly one Zobrist hash |

### Analysis Relations (R32-R36)

| ID | Relation | From | To | Cardinality | Direction | Constraint |
|----|----------|------|-----|-------------|-----------|------------|
| R32 | AnalyzedBy | BoardState | AnalysisResult | 1:0..1 | Unidirectional | A position may be analyzed by KataGo |
| R33 | HasBestMove | AnalysisResult | BestMove | 1:N | Unidirectional | KataGo returns ranked move candidates |
| R34 | HasWinRate | AnalysisResult | WinRate | 1:1 | Unidirectional | Root win rate for current player |
| R35 | IsBlunder | Move | Blunder | 1:0..1 | Unidirectional | A move may be classified as a blunder |
| R36 | HasVariation | BestMove | MoveVariation | 1:1 | Unidirectional | Each best move has a principal variation |

### Ko and Superko Relations (R37-R40)

| ID | Relation | From | To | Cardinality | Direction | Constraint |
|----|----------|------|-----|-------------|-----------|------------|
| R37 | ForbidsMove | KoPoint | Intersection | 1:1 | Unidirectional | The opponent cannot play at this intersection |
| R38 | HasHash | BoardState | PositionHash | 1:1 | Unidirectional | Bijective for practical purposes (collision negligible) |
| R39 | RecordedIn | PositionHash | PositionHashHistory | N:1 | Unidirectional | Every board hash is added to history |
| R40 | ViolatesSuperko | Move | PositionHashHistory | 1:0..1 | Unidirectional | A move violates superko if its result hash is in history |

---

## 11. Constraint Catalog

### Board Constraints (C01-C05)

| ID | Constraint | Formal Definition | Enforcement |
|----|-----------|-------------------|-------------|
| C01 | ValidBoardSize | `size in {9, 13, 19}` | Reject any other board size at game creation |
| C02 | ValidIndex | `0 <= index < size * size` | Bounds check on every intersection reference |
| C03 | GridLength | `grid.length === size * size` | Assert at board creation |
| C04 | CellRange | `grid[i] in {0, 1, 2}` for all `i` | Uint8Array ensures non-negative; validate upper bound |
| C05 | AdjacencyBounds | Neighbor indices must be valid and orthogonally adjacent | Pre-computed table guarantees this |

### Move Constraints (C06-C12)

| ID | Constraint | Formal Definition | Enforcement |
|----|-----------|-------------------|-------------|
| C06 | PlaceOnEmpty | `grid[index] === 0` before placement | Check before placing stone; reject if occupied |
| C07 | AlternatingTurns | `currentPlayer === (moveNumber % 2 === 0 ? BLACK : WHITE)` | Enforce at move validation |
| C08 | NoSuperkoViolation | `!positionHashes.has(hashAfterMove)` | Compute hash after move; check against history |
| C09 | SimpleKoForbidden | If `koPoint !== null`, opponent cannot play at `koPoint` on the next turn | Pre-filter before superko check |
| C10 | SuicideLegal | Suicide is legal under Tromp-Taylor rules | Do NOT reject self-capture; only reject via superko |
| C11 | CaptureBeforeSuicide | Opponent groups are captured (cleared) before own groups | Enforce step order in move execution |
| C12 | MoveProducesNewState | A move must change the board state (implied by placing a stone; unless suicide recreates same state, caught by superko) | Implicit; enforced by C08 |

### Game Flow Constraints (C13-C17)

| ID | Constraint | Formal Definition | Enforcement |
|----|-----------|-------------------|-------------|
| C13 | GameStartsEmpty | All `grid[i] === 0` at move 0 | Initialize grid to all zeros |
| C14 | BlackFirst | `turn(0) === BLACK` | Initialize currentPlayer to BLACK |
| C15 | TwoPassesEndGame | `consecutivePasses === 2` triggers scoring | Check after each pass |
| C16 | ResignationEndsGame | A resignation immediately ends the game; the resigning player loses | Process before move validation |
| C17 | NoMoveAfterGameEnd | No actions allowed after `gamePhase === 'finished'` | Guard all move/pass handlers |

### Scoring Constraints (C18-C23)

| ID | Constraint | Formal Definition | Enforcement |
|----|-----------|-------------------|-------------|
| C18 | AllPointsAccountedFor | `blackStones + whiteStones + blackTerritory + whiteTerritory + dame === size * size` | Assert after scoring |
| C19 | TerritoryReachesOneColor | A territory region reaches exactly one color | BFS classification |
| C20 | DameReachesBothColors | A dame region reaches both Black and White | BFS classification |
| C21 | KomiAppliedToWhite | `whiteScore = whiteStones + whiteTerritory + komi` | Apply in scoring function |
| C22 | NonNegativeScores | `blackScore >= 0 AND whiteScore >= 0` | Assert after scoring |
| C23 | TiePossibleOnlyWithIntegerKomi | With half-point komi (e.g., 7.5), ties are impossible | Informational; no enforcement needed |

### Hash Constraints (C24-C27)

| ID | Constraint | Formal Definition | Enforcement |
|----|-----------|-------------------|-------------|
| C24 | DeterministicHash | Same board state produces same hash | Fixed PRNG seed for Zobrist table |
| C25 | IncrementalCorrectness | Incremental hash update produces same result as full recomputation | Verify in tests |
| C26 | HashHistoryMonotonic | Position hash history is append-only | Never remove entries from `positionHashes` |
| C27 | PassDoesNotChangeHash | A pass does not modify the board hash | Verify hash unchanged after pass |

---

## 12. pACS Self-Rating

### Pre-mortem Protocol

1. **What could go wrong?** The Tromp-Taylor rules have two formulations (8-sentence and 10-sentence). I have documented both sources and reconciled them into a coherent 10-rule specification. The CMU version uses situational superko while Tromp's website uses positional superko -- I have explicitly chosen PSK and documented the choice.

2. **What is the weakest part?** Life/death analysis (EC-09 through EC-11) is defined conceptually but not algorithmically. This is intentional: life/death determination is a hard computational problem (PSPACE-complete) and is the domain of KataGo analysis, not the rules engine. The rules engine only needs correct capture mechanics.

3. **What would a critic say?** The edge case encyclopedia could include more exotic positions (e.g., moonshine life, 10,000-year ko). However, the 20 documented edge cases cover all patterns that affect implementation correctness. Exotic positions are handled correctly by the standard rules + superko and do not require special-case code.

### Scores

- **F (Fidelity)**: 88 -- Tromp-Taylor rules are faithfully transcribed from primary sources (tromp.github.io and CMU). Superko variant (PSK vs SSK) is explicitly documented with a design decision. Chinese scoring is precisely specified.
- **C (Completeness)**: 85 -- 85 entities (target: 50), 40 relations (target: 30), 27 constraints (target: 20), 20 edge cases (target: 15). All required categories covered. Data sources documented with acquisition methods.
- **L (Logical Coherence)**: 87 -- No contradictions between rules, entities, and constraints. The capture-before-suicide ordering is consistently enforced. Superko subsumes simple ko. Scoring formula components are traceable to rule definitions.

**pACS = min(88, 85, 87) = 85 (GREEN)**

**Weak Dimension**: Completeness -- Life/death algorithms are specified conceptually but not procedurally (by design: delegated to KataGo). The entity catalog could be expanded with more UI-facing entities, but those belong to Step 4 (template-designer).

---

## References

- [John Tromp's Go Page](https://tromp.github.io/go.html) -- Primary source for Tromp-Taylor rules
- [CMU Tromp-Taylor Rules](http://www.cs.cmu.edu/~wjh/go/tmp/rules/TrompTaylor.html) -- Concise formulation
- [Ko Bestiary](https://www.cs.cmu.edu/~wjh/go/rules/bestiary.html) -- Comprehensive ko position catalog
- [Zobrist Hashing - Wikipedia](https://en.wikipedia.org/wiki/Zobrist_hashing) -- Hash algorithm specification
- [CWI Go Games Database](https://homepages.cwi.nl/~aeb/go/games/) -- 88,888+ professional games
- [featurecat/go-dataset](https://github.com/featurecat/go-dataset) -- 21.1M games from Fox Go Server
- [@sabaki/sgf](https://www.npmjs.com/package/@sabaki/sgf) -- SGF parsing library
