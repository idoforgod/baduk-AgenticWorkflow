# KataGo Analysis Engine IPC Specification

**Version**: 1.0.0
**KataGo Target Version**: v1.16.4
**Author**: @katago-researcher (Step 2)
**Date**: 2026-03-11
**Consumer**: Step 12 (katago-integrator), Step 4 (template-designer)

---

## Table of Contents

1. [Source Catalog](#1-source-catalog)
2. [Protocol Overview](#2-protocol-overview)
3. [Query Format Specification](#3-query-format-specification)
4. [Response Format Specification](#4-response-format-specification)
5. [TypeScript Type Definitions](#5-typescript-type-definitions)
6. [GPU Backend Detection Strategy](#6-gpu-backend-detection-strategy)
7. [Process Lifecycle Management](#7-process-lifecycle-management)
8. [NN Model Strategy](#8-nn-model-strategy)
9. [Visits Tier Configuration](#9-visits-tier-configuration)
10. [Hardware Benchmark Strategy](#10-hardware-benchmark-strategy)

---

## 1. Source Catalog

All specification details are traced to the following primary sources.

| ID | Source | URL | Retrieved |
|----|--------|-----|-----------|
| S1 | Analysis Engine Documentation | https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md | 2026-03-11 |
| S2 | Analysis Example Config | https://github.com/lightvector/KataGo/blob/master/cpp/configs/analysis_example.cfg | 2026-03-11 |
| S3 | GTP Extensions (Rules) | https://github.com/lightvector/KataGo/blob/master/docs/GTP_Extensions.md | 2026-03-11 |
| S4 | analysis.cpp Source Code | https://github.com/lightvector/KataGo/blob/master/cpp/command/analysis.cpp | 2026-03-11 |
| S5 | Python Example | https://github.com/lightvector/KataGo/blob/master/python/query_analysis_engine_example.py | 2026-03-11 |
| S6 | KataGo README | https://github.com/lightvector/KataGo/blob/master/README.md | 2026-03-11 |
| S7 | v1.16.0 Release Notes | https://github.com/lightvector/KataGo/releases/tag/v1.16.0 | 2026-03-11 |
| S8 | v1.16.4 Release Notes | https://github.com/lightvector/KataGo/releases/tag/v1.16.4 | 2026-03-11 |
| S9 | KataGo Training Networks | https://katagotraining.org/networks/ | 2026-03-11 |
| S10 | KaTrain engine.py | https://github.com/sanderland/katrain/blob/master/katrain/core/engine.py | 2026-03-11 |
| S11 | g65 Model Archive | https://katagoarchive.org/g65/models/index.html | 2026-03-11 |
| S12 | Extra Networks | https://katagotraining.org/extra_networks/ | 2026-03-11 |
| S13 | DeepWiki Getting Started | https://deepwiki.com/lightvector/KataGo/1.2-getting-started | 2026-03-11 |
| S14 | v1.15.0 Release (Human SL) | https://github.com/lightvector/KataGo/releases/tag/v1.15.0 | 2026-03-11 |
| S15 | Benchmark Blog (RTX 5070) | https://songyp.com/blog/katago-workstation-build-and-bench | 2026-03-11 |
| S16 | OGS Forum Hardware Speeds | https://forums.online-go.com/t/katago-speeds-of-different-hardwares/48463 | 2026-03-11 |
| S17 | b18c384nbt Architecture Issue | https://github.com/lightvector/KataGo/issues/793 | 2026-03-11 |

---

## 2. Protocol Overview

### 2.1 Transport Layer

KataGo's Analysis Engine uses a **line-delimited JSON protocol** over stdin/stdout. [S1]

- **Direction**: Client writes JSON queries to KataGo's **stdin**; KataGo writes JSON responses to **stdout**.
- **Framing**: Each message (query or response) is a **single JSON object on one line**, terminated by `\n`. Multi-line JSON is NOT supported. [S1]
- **Ordering**: Responses may arrive **out of order** relative to query submission. The `id` field correlates responses to queries. [S1]
- **Stderr**: Used for logging/errors (not part of the protocol). Should be consumed to prevent pipe blocking. [S4, S5]
- **Encoding**: UTF-8. [S4]

### 2.2 Invocation

```bash
./katago analysis -config <CONFIG_FILE> -model <MODEL_FILE> [OPTIONS]
```

**Command-line arguments** [S1, S4, S6]:

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `-config <FILE>` | string | Yes* | Path to analysis config file (e.g., `analysis_example.cfg`) |
| `-model <FILE>` | string | Yes* | Path to neural network model (`.bin.gz`) |
| `-human-model <FILE>` | string | No | Path to human SL model (e.g., `b18c384nbt-humanv0.bin.gz`) |
| `-override-config <KEY=VALUE>` | string | No | Override config file parameters |
| `--analysis-threads <N>` | integer | No | Number of parallel analysis positions (overrides `numAnalysisThreads` in config). Range: 1-16384. Default: from config. |
| `--quit-without-waiting` | switch | No | Exit immediately when stdin closes, without completing queued analyses |

*If not specified, KataGo looks for `default_model.bin.gz` and `default_gtp.cfg` in its executable directory. [S6]

### 2.3 Guarantees

1. Every analyzed position produces **exactly one final response** with `isDuringSearch: false`. [S1]
2. If `reportDuringSearchEvery` is set, **intermediate** responses with `isDuringSearch: true` may precede the final response. [S1]
3. Terminated queries produce a response with `isDuringSearch: false` and either partial results or `"noResults": true`. [S1]
4. Future versions may add new fields to responses. Consumers MUST tolerate unknown fields. [S1]

---

## 3. Query Format Specification

### 3.1 Standard Analysis Query

#### Required Fields [S1]

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | `string` | Arbitrary identifier echoed back in the response | Any non-empty string |
| `moves` | `[string, string][]` | Array of `[player, location]` tuples representing the move history in play order | Player: `"B"` or `"W"`. Location: GTP notation (see 3.5). Empty array `[]` for initial position. |
| `rules` | `string \| RulesObject` | Game rules as a named ruleset string or a JSON rules object | See Section 3.3 |
| `boardXSize` | `integer` | Board width | 1-19 (default build); up to 50 with +bs50 build |
| `boardYSize` | `integer` | Board height | 1-19 (default build); up to 50 with +bs50 build |

**Note on `komi`**: While commonly included, `komi` is technically optional. If omitted, KataGo guesses based on rules: 7.5 for area scoring, 6.5 for territory scoring, 7.0 for button Go. [S1]

#### Optional Fields [S1]

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `komi` | `number` | Guessed from rules (7.5 area / 6.5 territory / 7.0 button) | Komi value. Range: [-150, 150]. |
| `initialStones` | `[string, string][]` | `[]` | Pre-placed stones (handicap, tsumego setup). Format same as `moves`. |
| `initialPlayer` | `string` | Inferred from context | `"B"` or `"W"`. Who plays at turn 0. Useful when `moves` is empty. |
| `whiteHandicapBonus` | `string` | From rules | Override white handicap compensation. Values: `"0"`, `"N"`, `"N-1"`. |
| `analyzeTurns` | `integer[]` | `[moves.length]` | Which positions to analyze. `0` = initial position, `1` = after `moves[0]`, etc. |
| `maxVisits` | `integer` | Config file value | Maximum MCTS visits per position. |
| `rootPolicyTemperature` | `number` | `1.0` | Values >1 broaden search exploration. |
| `rootFpuReductionMax` | `number` | Config value | `0` increases move variety exploration. |
| `analysisPVLen` | `integer` | Config value | Maximum principal variation length per move. |
| `includeOwnership` | `boolean` | `false` | Include board ownership prediction in response. Note: doubles memory usage. |
| `includeOwnershipStdev` | `boolean` | `false` | Include ownership standard deviation. |
| `includeMovesOwnership` | `boolean` | `false` | Include ownership prediction after each candidate move. |
| `includeMovesOwnershipStdev` | `boolean` | `false` | Include ownership stdev after each candidate move. |
| `includePolicy` | `boolean` | `false` | Include raw neural network policy output. |
| `includePVVisits` | `boolean` | `false` | Include visit counts along the PV. |
| `includeNoResultValue` | `boolean` | `false` | Include no-result probability (relevant for Japanese rules). |
| `avoidMoves` | `AvoidMovesSpec[]` | `[]` | Prohibit specific moves until a given depth. See 3.4. |
| `allowMoves` | `AllowMovesSpec[]` | `[]` | Restrict search to specific moves. Array must have length 1. See 3.4. |
| `overrideSettings` | `object` | `{}` | Override config parameters for this query only. See 3.6. |
| `reportDuringSearchEvery` | `number` | Disabled | Report partial results at this interval (seconds). |
| `priority` | `integer` | `0` | Query priority. Higher values are processed first. |
| `priorities` | `integer[]` | None | Per-turn priorities. Length must match `analyzeTurns`. |

### 3.2 Action Queries [S1]

Action queries use the `action` field instead of analysis fields.

#### query_version

Returns KataGo version information.

```json
{"id": "version-check", "action": "query_version"}
```

**Response**:
```json
{
  "id": "version-check",
  "action": "query_version",
  "version": "1.16.4",
  "git_hash": "0b0c2975..."
}
```

#### query_models

Returns information about loaded neural network models.

```json
{"id": "model-check", "action": "query_models"}
```

**Response**:
```json
{
  "id": "model-check",
  "action": "query_models",
  "models": [
    {
      "name": "kata1-b18c384nbt-s...-d....bin.gz",
      "internalName": "kata1-b18c384nbt-s...-d...",
      "maxBatchSize": 256,
      "usesHumanSLProfile": false,
      "version": 16,
      "usingFP16": "auto"
    }
  ]
}
```

#### clear_cache

Empties the neural network result cache.

```json
{"id": "clear-1", "action": "clear_cache"}
```

**Response**: Echoes the query fields.

#### terminate

Terminates analysis for queries matching `terminateId`.

```json
{"id": "term-1", "action": "terminate", "terminateId": "analysis-42"}
```

Optional: `turnNumbers` (integer[]) to restrict termination to specific turns.

**Response**: Echoes the query. Terminated analyses produce responses with `"isDuringSearch": false` and either partial results or `"noResults": true`.

#### terminate_all

Terminates all queued analyses.

```json
{"id": "term-all", "action": "terminate_all"}
```

Optional: `turnNumbers` (integer[]) to restrict to specific turns.

### 3.3 Rules Specification [S3]

Rules can be specified as a **string shorthand** or a **JSON object**.

#### String Shorthands

| Ruleset | Ko | Scoring | Suicide | Tax | White Handicap Bonus |
|---------|-----|---------|---------|------|---------------------|
| `"tromp-taylor"` | POSITIONAL | AREA | true | NONE | 0 |
| `"chinese"` | SIMPLE | AREA | false | NONE | N |
| `"chinese-ogs"` | POSITIONAL | AREA | false | NONE | N |
| `"chinese-kgs"` | POSITIONAL | AREA | false | NONE | N |
| `"japanese"` | SIMPLE | TERRITORY | false | SEKI | 0 |
| `"korean"` | SIMPLE | TERRITORY | false | SEKI | 0 |
| `"stone-scoring"` | SIMPLE | AREA | false | ALL | 0 |
| `"aga"` | SITUATIONAL | AREA | false | NONE | N-1 |
| `"bga"` | SITUATIONAL | AREA | false | NONE | N-1 |
| `"new-zealand"` | SITUATIONAL | AREA | true | NONE | 0 |
| `"aga-button"` | SITUATIONAL | AREA | false | NONE | N-1 |

#### JSON Object Format

```json
{
  "ko": "SIMPLE" | "POSITIONAL" | "SITUATIONAL",
  "scoring": "AREA" | "TERRITORY",
  "suicide": true | false,
  "tax": "NONE" | "SEKI" | "ALL",
  "whiteHandicapBonus": "0" | "N-1" | "N",
  "hasButton": true | false,
  "friendlyPassOk": true | false
}
```

### 3.4 Avoid/Allow Moves Specification [S1]

```json
{
  "player": "B" | "W",
  "moves": ["C3", "Q4", "pass"],
  "untilDepth": 3
}
```

- `player`: Which player's moves to restrict.
- `moves`: Array of GTP location strings.
- `untilDepth`: Positive integer. Restriction applies from depth 1 to `untilDepth` (inclusive).
- For `allowMoves`, the outer array must have exactly **length 1**. [S1]

### 3.5 Location Format [S1]

Moves use GTP coordinate notation:

| Format | Example | Description |
|--------|---------|-------------|
| Standard | `"C4"`, `"Q16"` | Column letter (A-T, skipping I) + row number |
| Extended | `"AA5"`, `"AB3"` | For boards wider than 25 columns |
| Explicit | `"(0,13)"` | X,Y integer coordinates (0-indexed) |
| Pass | `"pass"` | Pass move |

Column letters skip `I` (to avoid confusion with `1`): A, B, C, D, E, F, G, H, J, K, L, M, N, O, P, Q, R, S, T.

### 3.6 Override Settings [S1]

The `overrideSettings` field accepts a subset of config file parameters. Notable parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `cpuctExploration` | float | MCTS exploration constant |
| `winLossUtilityFactor` | float | Winrate contribution to utility |
| `staticScoreUtilityFactor` | float | Static score contribution to utility |
| `dynamicScoreUtilityFactor` | float | Dynamic score contribution to utility |
| `playoutDoublingAdvantage` | float | Assume current player has 2^PDA times opponent's playouts. Range: [-3, 3]. |
| `wideRootNoise` | float | Root noise for wider exploration |
| `ignorePreRootHistory` | boolean | Ignore move history before analyzed position |
| `antiMirror` | boolean | Detect/respond to mirror play (biases results) |
| `rootNumSymmetriesToSample` | integer | Symmetries to average. Range: [1, 8]. Higher = smoother but slower. |
| `useUncertainty` | boolean | Enable uncertainty features |
| `subtreeValueBiasFactor` | float | Subtree value bias amount |
| `useNoisePruning` | boolean | Enable noise-based pruning |
| `humanSLProfile` | string | Human imitation profile. See 3.7. |
| `humanSLRootExploreProbWeightless` | float | Explore human moves without biasing evals. Range: [0, 1]. |
| `humanSLCpuctPermanent` | float | Human move exploration strength. Must be >0. |
| `humanSLPlaExploreProbWeightful` | float | Own moves via human policy. Range: [0, 1]. |
| `humanSLOppExploreProbWeightful` | float | Opponent moves via human policy. Range: [0, 1]. |

### 3.7 Human SL Profile Strings [S1, S14]

Requires a human SL model loaded via `-human-model`. Profile strings:

| Pattern | Examples | Description |
|---------|----------|-------------|
| `preaz_{rank}` | `preaz_9d`, `preaz_5k` | Pre-AlphaZero style by rank |
| `rank_{rank}` | `rank_3d`, `rank_20k` | Modern style by rank |
| `preaz_{BR}_{WR}` | `preaz_3d_7d` | Pre-AZ with per-color rank awareness |
| `rank_{BR}_{WR}` | `rank_1d_5d` | Modern with per-color rank awareness |
| `proyear_{year}` | `proyear_2023`, `proyear_1800` | Pro/insei historical year imitation |

Rank values: `20k` through `9d`. Year values: `1800` through `2023`.

### 3.8 Example Queries

#### Analyze a single position (after 2 moves)

```json
{
  "id": "game-001-turn-2",
  "moves": [["B", "Q4"], ["W", "D4"]],
  "rules": "chinese",
  "komi": 7.5,
  "boardXSize": 19,
  "boardYSize": 19,
  "maxVisits": 500,
  "includeOwnership": true,
  "includePolicy": true
}
```

#### Analyze an entire game at multiple turns

```json
{
  "id": "full-game-review",
  "initialStones": [["B", "D4"]],
  "moves": [["W", "Q16"], ["B", "C16"], ["W", "Q3"], ["B", "R14"]],
  "rules": "japanese",
  "komi": 6.5,
  "boardXSize": 19,
  "boardYSize": 19,
  "analyzeTurns": [0, 1, 2, 3, 4],
  "maxVisits": 50
}
```

#### Quick instant analysis (5 visits)

```json
{
  "id": "instant-hint",
  "moves": [["B", "Q4"], ["W", "D16"], ["B", "C4"]],
  "rules": "chinese",
  "komi": 7.5,
  "boardXSize": 19,
  "boardYSize": 19,
  "maxVisits": 5,
  "priority": 10
}
```

#### Query version on startup

```json
{"id": "startup-version", "action": "query_version"}
```

---

## 4. Response Format Specification

### 4.1 Standard Analysis Response [S1]

#### Top-Level Fields

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| `id` | `string` | Always | Echoed query identifier |
| `isDuringSearch` | `boolean` | Always | `false` for final result; `true` for intermediate results |
| `turnNumber` | `integer` | Always | Which turn was analyzed (index into `analyzeTurns`) |
| `moveInfos` | `MoveInfo[]` | Always | Analysis for each considered move |
| `rootInfo` | `RootInfo` | Always | Overall position evaluation |
| `ownership` | `number[]` | When `includeOwnership: true` | Board ownership prediction. See 4.4. |
| `ownershipStdev` | `number[]` | When `includeOwnershipStdev: true` | Ownership uncertainty. See 4.4. |
| `policy` | `number[]` | When `includePolicy: true` | Raw neural network policy. See 4.5. |
| `humanPolicy` | `number[]` | When `includePolicy: true` + human model loaded | Human model policy. Same format as `policy`. |

### 4.2 MoveInfo Fields [S1]

Each element in `moveInfos` contains:

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| `move` | `string` | Always | Move location in GTP notation (e.g., `"C4"`, `"pass"`) |
| `visits` | `integer` | Always | Child node visit count |
| `edgeVisits` | `integer` | Always | Parent node visit commitment for this move |
| `winrate` | `number` | Always | Win probability for current player. Range: [0, 1]. |
| `scoreMean` | `number` | Always | Alias for `scoreLead` (backward compatibility) |
| `scoreLead` | `number` | Always | Predicted point advantage for current player |
| `scoreStdev` | `number` | Always | Predicted score standard deviation (biased high due to MCTS) |
| `scoreSelfplay` | `number` | Always | Average final game score if this move is played |
| `prior` | `number` | Always | Neural network policy prior. Range: [0, 1]. |
| `utility` | `number` | Always | Combined winrate+score utility value |
| `utilityLcb` | `number` | Always | Utility lower confidence bound |
| `lcb` | `number` | Always | Winrate lower confidence bound. May exceed [0, 1]. |
| `weight` | `number` | Always | Total visit weight (uncertainty-adjusted) |
| `edgeWeight` | `number` | Always | Parent's intended visit weight |
| `order` | `integer` | Always | Rank: 0 = best move, 1 = second best, etc. |
| `playSelectionValue` | `number` | Always (v1.16+) | Value used for move selection ordering; proportional to play probability. [S7] |
| `pv` | `string[]` | Always | Principal variation (sequence of moves after this move) |
| `pvVisits` | `integer[]` | When `includePVVisits: true` | Visit count at each PV position |
| `pvEdgeVisits` | `integer[]` | When `includePVVisits: true` | Edge visit count for each PV move |
| `noResultValue` | `number` | When `includeNoResultValue: true` | No-result probability. Range: [0, 1]. |
| `humanPrior` | `number` | When human model loaded | Human policy prior. Range: [0, 1]. |
| `isSymmetryOf` | `string` | When symmetry pruning active | This move was not searched; results copied from the named move. |
| `ownership` | `number[]` | When `includeMovesOwnership: true` | Board ownership after this move. See 4.4. |
| `ownershipStdev` | `number[]` | When `includeMovesOwnershipStdev: true` | Ownership stdev after this move. See 4.4. |

### 4.3 RootInfo Fields [S1]

| Field | Type | Condition | Description |
|-------|------|-----------|-------------|
| `winrate` | `number` | Always | Position win probability for current player. Range: [0, 1]. |
| `scoreLead` | `number` | Always | Predicted point advantage for current player |
| `scoreSelfplay` | `number` | Always | Average final game score |
| `scoreStdev` | `number` | Always | Score standard deviation |
| `utility` | `number` | Always | Combined utility value |
| `visits` | `integer` | Always | Total visits at root |
| `currentPlayer` | `string` | Always | `"B"` or `"W"` |
| `thisHash` | `string` | Always | Position hash (unique per board/player/ko state) |
| `symHash` | `string` | Always | Symmetry-invariant hash (does not track superko) |
| `lcb` | `number` | Always | Winrate lower confidence bound |
| `utilityLcb` | `number` | Always | Utility lower confidence bound |
| `rawWinrate` | `number` | Always | Neural net raw winrate prediction (no MCTS search) |
| `rawLead` | `number` | Always | Neural net raw lead prediction (no search) |
| `rawScoreSelfplay` | `number` | Always | Neural net raw score prediction (no search) |
| `rawScoreSelfplayStdev` | `number` | Always | Neural net raw score stdev (no search) |
| `rawNoResultProb` | `number` | Always | Neural net raw no-result probability |
| `rawStWrError` | `number` | Always | Neural net short-term winrate uncertainty estimate |
| `rawStScoreError` | `number` | Always | Neural net short-term score uncertainty estimate |
| `rawVarTimeLeft` | `number` | Always | Neural net estimate of meaningful game length remaining |
| `humanWinrate` | `number` | When human model loaded | Human model winrate prediction |
| `humanScoreMean` | `number` | When human model loaded | Human model score prediction |
| `humanScoreStdev` | `number` | When human model loaded | Human model score stdev |
| `humanStWrError` | `number` | When human model loaded | Human model short-term winrate uncertainty |
| `humanStScoreError` | `number` | When human model loaded | Human model short-term score uncertainty |

### 4.4 Ownership Map Format [S1]

When ownership is included in the response:

- **Array length**: `boardYSize * boardXSize`
- **Order**: Row-major, starting from top-left (A19 for 19x19) to bottom-right (T1)
- **Values**: Floats in range `[-1, 1]`
  - `+1` = fully owned by Black
  - `-1` = fully owned by White
  - `0` = neutral/contested
- **Perspective**: Always from the perspective of Black ownership, regardless of `reportAnalysisWinratesAs` setting.
- **Stdev values**: Range `[0, 1]`

**Index mapping** for a 19x19 board:
```
index = (18 - y) * 19 + x
```
Where `x` is the column (0=A, 1=B, ..., 18=T, skipping I in display but not in indexing) and `y` is the row (0=1, ..., 18=19).

### 4.5 Policy Output Format [S1]

When `includePolicy: true`:

- **Array length**: `boardYSize * boardXSize + 1`
- **Order**: Row-major (same as ownership), with the **last element** being the pass policy
- **Values**: Positive floats summing to approximately 1.0
- **Illegal moves**: Indicated by `-1`
- **`humanPolicy`**: Same format, present only when a human model is loaded and `humanSLProfile` is configured

### 4.6 Winrate Perspective [S1, S2]

All winrate and score values are reported from the perspective of the player specified by `reportAnalysisWinratesAs` in the config file (default: `BLACK`). [S2]

This means:
- When `reportAnalysisWinratesAs = BLACK`: a `winrate` of 0.6 means Black has 60% chance of winning, regardless of whose turn it is.
- When `reportAnalysisWinratesAs = WHITE`: values are from White's perspective.

**Implementation note**: For a UI showing "current player's perspective," you must check `rootInfo.currentPlayer` and flip values if needed.

### 4.7 Error and Warning Responses [S1, S4]

#### Generic Error (no query context)

```json
{"error": "Failed to parse input as json"}
```

#### Field-Specific Error

```json
{"id": "query-1", "field": "boardXSize", "error": "Board size must be between 1 and 19"}
```

#### Field-Specific Warning

```json
{"id": "query-1", "field": "unknownField", "warning": "Unexpected field in query"}
```

### 4.8 Terminated Query Response [S1]

When a query is terminated before completion:

```json
{
  "id": "analysis-42",
  "turnNumber": 3,
  "isDuringSearch": false,
  "noResults": true
}
```

If partial results are available, the response has the standard format with whatever data was collected.

### 4.9 Example Response

```json
{
  "id": "game-001-turn-2",
  "isDuringSearch": false,
  "turnNumber": 2,
  "moveInfos": [
    {
      "move": "R16",
      "visits": 248,
      "edgeVisits": 249,
      "winrate": 0.5124,
      "scoreMean": 0.35,
      "scoreLead": 0.35,
      "scoreStdev": 12.5,
      "scoreSelfplay": 0.42,
      "prior": 0.0823,
      "utility": 0.042,
      "utilityLcb": 0.028,
      "lcb": 0.498,
      "weight": 246.3,
      "edgeWeight": 247.5,
      "order": 0,
      "playSelectionValue": 248.5,
      "pv": ["R16", "C16", "Q3", "D17", "E3"]
    },
    {
      "move": "C16",
      "visits": 145,
      "edgeVisits": 146,
      "winrate": 0.5098,
      "scoreMean": 0.29,
      "scoreLead": 0.29,
      "scoreStdev": 12.8,
      "scoreSelfplay": 0.35,
      "prior": 0.0671,
      "utility": 0.038,
      "utilityLcb": 0.021,
      "lcb": 0.491,
      "weight": 143.8,
      "edgeWeight": 145.1,
      "order": 1,
      "playSelectionValue": 145.2,
      "pv": ["C16", "R16", "D3", "Q17"]
    }
  ],
  "rootInfo": {
    "winrate": 0.5124,
    "scoreLead": 0.35,
    "scoreSelfplay": 0.42,
    "scoreStdev": 12.5,
    "utility": 0.042,
    "visits": 500,
    "currentPlayer": "W",
    "thisHash": "A1B2C3D4E5F6...",
    "symHash": "X9Y8Z7W6V5...",
    "lcb": 0.498,
    "utilityLcb": 0.028,
    "rawWinrate": 0.5089,
    "rawLead": 0.32,
    "rawScoreSelfplay": 0.38,
    "rawScoreSelfplayStdev": 13.1,
    "rawNoResultProb": 0.0001,
    "rawStWrError": 0.045,
    "rawStScoreError": 2.1,
    "rawVarTimeLeft": 85.3
  }
}
```

---

## 5. TypeScript Type Definitions

```typescript
// ============================================================
// KataGo Analysis Engine IPC Types
// Based on KataGo v1.16.4 Analysis Engine documentation [S1]
// ============================================================

// --- Location & Player Types ---

/** GTP player identifier */
type Player = "B" | "W";

/** GTP location string: "C4", "Q16", "AA5", "(0,13)", "pass" */
type GTPLocation = string;

/** A move is a [player, location] tuple */
type Move = [Player, GTPLocation];

// --- Rules Types ---

type KoRule = "SIMPLE" | "POSITIONAL" | "SITUATIONAL";
type ScoringRule = "AREA" | "TERRITORY";
type TaxRule = "NONE" | "SEKI" | "ALL";
type WhiteHandicapBonus = "0" | "N-1" | "N";

type RulesetString =
  | "tromp-taylor"
  | "chinese"
  | "chinese-ogs"
  | "chinese-kgs"
  | "japanese"
  | "korean"
  | "stone-scoring"
  | "aga"
  | "bga"
  | "new-zealand"
  | "aga-button";

interface RulesObject {
  ko: KoRule;
  scoring: ScoringRule;
  suicide: boolean;
  tax: TaxRule;
  whiteHandicapBonus: WhiteHandicapBonus;
  hasButton?: boolean;
  friendlyPassOk?: boolean;
}

type Rules = RulesetString | RulesObject;

// --- Avoid/Allow Moves ---

interface MoveRestriction {
  player: Player;
  moves: GTPLocation[];
  untilDepth: number; // positive integer
}

// --- Query Types ---

/** Standard analysis query */
interface AnalysisQuery {
  // Required fields
  id: string;
  moves: Move[];
  rules: Rules;
  boardXSize: number; // 1-19 (default), up to 50 (+bs50)
  boardYSize: number; // 1-19 (default), up to 50 (+bs50)

  // Optional fields
  komi?: number; // [-150, 150], default guessed from rules
  initialStones?: Move[];
  initialPlayer?: Player;
  whiteHandicapBonus?: WhiteHandicapBonus;
  analyzeTurns?: number[];
  maxVisits?: number;
  rootPolicyTemperature?: number; // default 1.0
  rootFpuReductionMax?: number;
  analysisPVLen?: number;
  includeOwnership?: boolean; // default false
  includeOwnershipStdev?: boolean; // default false
  includeMovesOwnership?: boolean; // default false
  includeMovesOwnershipStdev?: boolean; // default false
  includePolicy?: boolean; // default false
  includePVVisits?: boolean; // default false
  includeNoResultValue?: boolean; // default false
  avoidMoves?: MoveRestriction[];
  allowMoves?: [MoveRestriction]; // must be length 1
  overrideSettings?: Record<string, unknown>;
  reportDuringSearchEvery?: number; // seconds
  priority?: number; // default 0
  priorities?: number[]; // must match analyzeTurns length
}

/** Action queries */
interface QueryVersionAction {
  id: string;
  action: "query_version";
}

interface QueryModelsAction {
  id: string;
  action: "query_models";
}

interface ClearCacheAction {
  id: string;
  action: "clear_cache";
}

interface TerminateAction {
  id: string;
  action: "terminate";
  terminateId: string;
  turnNumbers?: number[];
}

interface TerminateAllAction {
  id: string;
  action: "terminate_all";
  turnNumbers?: number[];
}

type KataGoQuery =
  | AnalysisQuery
  | QueryVersionAction
  | QueryModelsAction
  | ClearCacheAction
  | TerminateAction
  | TerminateAllAction;

// --- Response Types ---

interface MoveInfo {
  // Always present
  move: GTPLocation;
  visits: number;
  edgeVisits: number;
  winrate: number; // [0, 1]
  scoreMean: number; // alias for scoreLead
  scoreLead: number;
  scoreStdev: number;
  scoreSelfplay: number;
  prior: number; // [0, 1]
  utility: number;
  utilityLcb: number;
  lcb: number; // may exceed [0, 1]
  weight: number;
  edgeWeight: number;
  order: number; // 0 = best
  playSelectionValue: number; // v1.16+
  pv: GTPLocation[];

  // Conditional fields
  pvVisits?: number[]; // when includePVVisits=true
  pvEdgeVisits?: number[]; // when includePVVisits=true
  noResultValue?: number; // when includeNoResultValue=true
  humanPrior?: number; // when human model loaded
  isSymmetryOf?: GTPLocation; // when symmetry pruning active
  ownership?: number[]; // when includeMovesOwnership=true
  ownershipStdev?: number[]; // when includeMovesOwnershipStdev=true
}

interface RootInfo {
  // Always present
  winrate: number; // [0, 1]
  scoreLead: number;
  scoreSelfplay: number;
  scoreStdev: number;
  utility: number;
  visits: number;
  currentPlayer: Player;
  thisHash: string;
  symHash: string;
  lcb: number;
  utilityLcb: number;
  rawWinrate: number;
  rawLead: number;
  rawScoreSelfplay: number;
  rawScoreSelfplayStdev: number;
  rawNoResultProb: number;
  rawStWrError: number;
  rawStScoreError: number;
  rawVarTimeLeft: number;

  // Conditional fields (human model)
  humanWinrate?: number;
  humanScoreMean?: number;
  humanScoreStdev?: number;
  humanStWrError?: number;
  humanStScoreError?: number;
}

/** Standard analysis response */
interface AnalysisResponse {
  id: string;
  isDuringSearch: boolean;
  turnNumber: number;
  moveInfos: MoveInfo[];
  rootInfo: RootInfo;

  // Conditional fields
  ownership?: number[]; // length: boardYSize * boardXSize
  ownershipStdev?: number[];
  policy?: number[]; // length: boardYSize * boardXSize + 1
  humanPolicy?: number[];
}

/** Terminated query with no results */
interface NoResultResponse {
  id: string;
  isDuringSearch: false;
  turnNumber: number;
  noResults: true;
}

/** Error response */
interface ErrorResponse {
  error: string;
  id?: string;
  field?: string;
}

/** Warning response */
interface WarningResponse {
  warning: string;
  id: string;
  field: string;
}

/** Version response */
interface VersionResponse {
  id: string;
  action: "query_version";
  version: string;
  git_hash: string;
}

/** Models response */
interface ModelInfo {
  name: string;
  internalName: string;
  maxBatchSize: number;
  usesHumanSLProfile: boolean;
  version: number;
  usingFP16: string;
}

interface ModelsResponse {
  id: string;
  action: "query_models";
  models: ModelInfo[];
}

type KataGoResponse =
  | AnalysisResponse
  | NoResultResponse
  | ErrorResponse
  | WarningResponse
  | VersionResponse
  | ModelsResponse;
```

---

## 6. GPU Backend Detection Strategy

### 6.1 Key Fact: Backend Is Compile-Time, Not Runtime [S6, S13]

KataGo's neural network backend is **selected at compile time** via the `USE_BACKEND` CMake option. A single binary supports exactly one backend. There is no runtime backend switching.

This means the desktop app must **ship or detect multiple binary variants** and select the appropriate one at runtime.

### 6.2 Available Backends

| Backend | CMake Flag | Hardware | Platforms | First-Run Delay | Relative Speed |
|---------|-----------|----------|-----------|-----------------|---------------|
| **TensorRT** | `USE_BACKEND=TENSORRT` | NVIDIA GPU (TensorRT 8.5+) | Linux, Windows | None | Fastest (87-104x vs CPU) [S15] |
| **CUDA** | `USE_BACKEND=CUDA` | NVIDIA GPU (CUDA 11+, cuDNN) | Linux, Windows | None | Fast (61-69x vs CPU) [S15] |
| **Metal** | `USE_BACKEND=METAL` | Apple GPU (macOS 13.0+) | macOS | Minimal | Fast (9-10x vs CPU) [S15] |
| **OpenCL** | `USE_BACKEND=OPENCL` | Any GPU with OpenCL drivers | All | 5-30 min (first run, auto-tuning) [S6] | Moderate (33-43x vs CPU) [S15] |
| **Eigen (AVX2)** | `USE_BACKEND=EIGEN`, `-DUSE_AVX2=1` | CPU (AVX2+FMA support) | All | None | Baseline + 37-64% [S15] |
| **Eigen** | `USE_BACKEND=EIGEN` | Any CPU | All | None | Baseline |

### 6.3 Backend Detection Algorithm (for Desktop App)

Since the backend is compile-time, the desktop app must implement a **binary selection** algorithm:

```
FUNCTION detectBestBackend():

  platform = detectPlatform()  // "darwin" | "win32" | "linux"

  IF platform == "darwin":
    // macOS: Metal is the best option for Apple Silicon
    IF hasBinary("katago-metal") AND macOSVersion >= 13.0:
      RETURN "metal"
    ELIF hasBinary("katago-opencl") AND hasOpenCLDrivers():
      RETURN "opencl"
    ELIF hasBinary("katago-eigenavx2") AND cpuSupportsAVX2():
      RETURN "eigenavx2"
    ELSE:
      RETURN "eigen"

  ELIF platform == "win32" OR platform == "linux":
    IF hasBinary("katago-tensorrt") AND hasTensorRT():
      RETURN "tensorrt"
    ELIF hasBinary("katago-cuda") AND hasCUDA():
      RETURN "cuda"
    ELIF hasBinary("katago-opencl") AND hasOpenCLDrivers():
      RETURN "opencl"
    ELIF hasBinary("katago-eigenavx2") AND cpuSupportsAVX2():
      RETURN "eigenavx2"
    ELSE:
      RETURN "eigen"

FUNCTION hasBinary(name):
  RETURN fileExists(bundledBinaryPath(name))

FUNCTION hasOpenCLDrivers():
  // Check if OpenCL ICD is available
  // On Linux: check /etc/OpenCL/vendors/
  // On Windows: check registry for OpenCL.dll
  // On macOS: always available (deprecated but functional)

FUNCTION hasCUDA():
  // Check nvidia-smi or libcuda availability
  // Verify CUDA version matches binary requirements (e.g., CUDA 12.5)

FUNCTION hasTensorRT():
  // Check libnvinfer availability
  // Verify TensorRT version matches (e.g., 10.2.0)

FUNCTION cpuSupportsAVX2():
  // Check CPU flags for AVX2 and FMA support
  // On Linux: grep avx2 /proc/cpuinfo
  // On macOS: sysctl -a | grep AVX2
  // On Windows: check CPUID
```

### 6.4 Bundling Strategy for Desktop App

| Platform | Bundled Binaries | Priority |
|----------|-----------------|----------|
| **macOS (Apple Silicon)** | `katago-metal`, `katago-eigen` | Metal >> Eigen |
| **macOS (Intel)** | `katago-opencl`, `katago-eigenavx2`, `katago-eigen` | OpenCL >> EigenAVX2 >> Eigen |
| **Windows** | `katago-opencl`, `katago-cuda12.5`, `katago-eigenavx2`, `katago-eigen` | CUDA >> OpenCL >> EigenAVX2 >> Eigen |
| **Linux** | `katago-opencl`, `katago-cuda12.5`, `katago-eigenavx2`, `katago-eigen` | CUDA >> OpenCL >> EigenAVX2 >> Eigen |

**Note**: TensorRT binaries are NOT recommended for bundling due to complex library dependencies. Users who need TensorRT performance can install it separately. [S6]

### 6.5 OpenCL First-Run Tuning [S6]

The OpenCL backend performs auto-tuning on first launch (5-30 minutes). Results are cached in `KataGoData/opencltuning/`. The desktop app should:

1. Detect if tuning cache exists
2. If not, warn the user about the one-time delay
3. Optionally run the tuning in a setup wizard

---

## 7. Process Lifecycle Management

### 7.1 State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle: App starts

    Idle --> Starting: User requests analysis / app init

    Starting --> Ready: KataGo responds to query_version
    Starting --> Failed: Process exits / timeout (10s)

    Ready --> Analyzing: Analysis query sent
    Ready --> ShuttingDown: App requests shutdown

    Analyzing --> Ready: Final response received (isDuringSearch=false)
    Analyzing --> Degraded: Response timeout (configurable)
    Analyzing --> Failed: Process crash detected (poll != null)
    Analyzing --> ShuttingDown: App requests shutdown

    Degraded --> Ready: Response eventually received
    Degraded --> Failed: Consecutive timeouts exceed threshold

    Failed --> Restarting: Circuit breaker allows restart
    Failed --> Fallback: Circuit breaker open (5 failures in 10 min)

    Restarting --> Starting: After backoff delay
    Restarting --> Fallback: Max restart attempts exceeded

    Fallback --> Idle: User intervention / manual restart

    ShuttingDown --> [*]: Process terminated

    note right of Starting
      1. Spawn subprocess
      2. Start stderr reader thread
      3. Send query_version
      4. Wait for response (10s timeout)
    end note

    note right of Failed
      Log error details
      Increment failure counter
      Calculate backoff delay
    end note
```

### 7.2 Spawn Protocol [S1, S4, S5, S6]

```
FUNCTION spawnKataGo(config):
  binary = detectBestBackend()
  args = [
    binaryPath(binary),
    "analysis",
    "-config", config.configPath,
    "-model", config.modelPath,
  ]

  IF config.humanModelPath:
    args.append("-human-model", config.humanModelPath)

  IF config.analysisThreads:
    args.append("--analysis-threads", config.analysisThreads)

  // Always use quit-without-waiting for controlled shutdown
  args.append("--quit-without-waiting")

  IF config.overrideConfig:
    FOR EACH key, value IN config.overrideConfig:
      args.append("-override-config", key + "=" + value)

  process = subprocess.spawn(args, {
    stdin: PIPE,
    stdout: PIPE,
    stderr: PIPE,
  })

  // Start stderr consumer thread (prevents pipe blocking)
  startStderrReader(process.stderr)

  // Verify process is alive with version check
  sendQuery(process.stdin, { id: "__startup__", action: "query_version" })
  response = waitForResponse(process.stdout, timeout=10000)

  IF response.error OR timeout:
    process.kill()
    THROW "KataGo failed to start"

  RETURN process
```

### 7.3 Communication Protocol [S1, S4, S5]

#### Writing Queries

```
FUNCTION sendQuery(stdin, query):
  line = JSON.stringify(query) + "\n"
  stdin.write(line, encoding="utf-8")
  stdin.flush()
```

#### Reading Responses

```
FUNCTION readResponse(stdout):
  line = stdout.readline()  // blocks until \n
  IF line is empty:
    RETURN null  // process has exited
  RETURN JSON.parse(line.trim())
```

**Threading model** (based on KaTrain pattern [S10]):

| Thread | Responsibility |
|--------|---------------|
| **Write thread** | Dequeues from write queue, serializes to stdin, flushes |
| **Read thread** | Reads stdout line-by-line, parses JSON, dispatches to callbacks |
| **Stderr thread** | Reads stderr, logs output, detects "Uncaught exception" patterns |

### 7.4 Health Monitoring (Watchdog) [S4, S10]

#### Crash Detection

```
FUNCTION checkAlive(process):
  exitCode = process.poll()
  IF exitCode is not null:
    RETURN { alive: false, exitCode: exitCode }
  RETURN { alive: true }
```

**Known exit codes** [S10]:
- Exit code `3221225781` (Windows): Missing DLL — report to user with specific library guidance
- Any non-zero exit: Process failed

#### Hang Detection

```
FUNCTION detectHang(lastResponseTime, timeout):
  IF currentTime() - lastResponseTime > timeout:
    RETURN true
  RETURN false
```

Recommended timeouts per visits tier:

| Visits | Expected Response Time | Hang Timeout |
|--------|----------------------|--------------|
| 5 | <100ms (GPU), <2s (CPU) | 5s |
| 50 | <500ms (GPU), <10s (CPU) | 15s |
| 500 | <3s (GPU), <60s (CPU) | 90s |

#### Stderr Monitoring [S10]

Watch for these patterns in stderr output:
- `"Uncaught exception"` — Fatal error, process will exit
- `"what()"` — C++ exception, process will exit
- `"out of memory"` / `"OOM"` — GPU memory exhaustion
- `"CUDA error"` / `"OpenCL error"` — Backend failure

### 7.5 Circuit Breaker

```
CONFIGURATION:
  maxFailures = 5
  windowMs = 600000       // 10 minutes
  backoffBaseMs = 3000    // 3 seconds
  backoffMaxMs = 30000    // 30 seconds
  backoffMultiplier = 2.0

STATE:
  failures = []           // timestamps of failures
  consecutiveFailures = 0

FUNCTION recordFailure():
  now = currentTime()
  failures.append(now)
  consecutiveFailures += 1

  // Prune old failures outside the window
  failures = failures.filter(t => now - t < windowMs)

FUNCTION isOpen():
  RETURN failures.length >= maxFailures

FUNCTION getBackoffDelay():
  delay = backoffBaseMs * (backoffMultiplier ^ (consecutiveFailures - 1))
  RETURN min(delay, backoffMaxMs)

FUNCTION onSuccess():
  consecutiveFailures = 0

FUNCTION shouldRestart():
  IF isOpen():
    RETURN false  // circuit is open, go to fallback
  RETURN true
```

**Backoff schedule** (3s base, 2x multiplier, 30s max):

| Failure # | Delay |
|-----------|-------|
| 1 | 3s |
| 2 | 6s |
| 3 | 12s |
| 4 | 24s |
| 5 | 30s (capped) |

### 7.6 Graceful Shutdown Protocol [S1, S4]

```
FUNCTION shutdown(process, waitForCompletion=true):
  IF waitForCompletion:
    // Send terminate_all to stop new analysis
    sendQuery(process.stdin, { id: "__shutdown__", action: "terminate_all" })
    // Close stdin — signals KataGo to finish remaining work
    process.stdin.close()
    // Wait with timeout
    exitCode = process.waitForExit(timeout=5000)
    IF exitCode is null:
      process.kill()  // force kill if stuck
  ELSE:
    // With --quit-without-waiting, closing stdin triggers immediate exit
    process.stdin.close()
    exitCode = process.waitForExit(timeout=3000)
    IF exitCode is null:
      process.kill()

  // Clean up threads
  joinAllThreads()
```

**Key insight from source code** [S4]:
- When `--quit-without-waiting` is specified and stdin closes, KataGo calls `setReadOnly()` on both queues and `setKilled()` on all bots, then joins threads immediately.
- Without the flag, KataGo allows analysis threads to drain remaining work before shutting down.
- **Recommendation**: Always spawn with `--quit-without-waiting` for desktop app use. This gives the host app full control over shutdown timing.

---

## 8. NN Model Strategy

### 8.1 Model Architecture Overview

KataGo uses a residual neural network with configurable depth (blocks) and width (channels). The "nbt" suffix indicates **nested bottleneck** architecture. [S17]

| Architecture | Blocks | Channels | Bottleneck | Approximate File Size (.bin.gz) | Source |
|-------------|--------|----------|------------|--------------------------------|--------|
| b6c96 | 6 | 96 | No | ~3.5 MB | [S11]: 8.4 MB .zip (note: zip includes extra metadata; .bin.gz is smaller) |
| b10c128 | 10 | 128 | No | ~11 MB | [S11]: 24 MB .zip |
| b15c192 | 15 | 192 | No | ~35 MB | [S11]: 81 MB .zip |
| b18c384nbt | 18 | 384 (192 bottleneck) | Yes (factor 2) | ~65 MB | [S9, S17] |
| b28c512nbt | 28 | 512 | Yes | ~170 MB | [S9] |

**Note on file sizes**: The .zip files in the g65 archive [S11] are larger than .bin.gz format used in current releases. The .bin.gz sizes above are estimates based on the architecture parameter counts. The exact sizes should be verified by downloading from [S9]. This is marked as **partially unverified** for the exact .bin.gz byte counts.

### 8.2 Available Models for Desktop Bundling

| Model | Purpose | Strength (Elo) | Recommended Use | Source |
|-------|---------|----------------|-----------------|--------|
| **kata1-b18c384nbt** (latest) | Primary analysis | ~13,600 [S9] | Default model for all users | [S6, S9] |
| **kata1-b28c512nbt** (latest) | Maximum strength | ~14,080 [S9] | Optional download for power users | [S9] |
| **b10c128** (Extended Training) | Fast analysis | ~Pro level | Low-spec hardware fallback | [S6] |
| **b6c96** (Extended Training) | Fastest, weakest | ~Strong amateur | Emergency CPU fallback | [S11] |
| **b18c384nbt-humanv0** | Human play imitation | N/A (human-like) | Teaching/review features | [S14] |

### 8.3 Desktop App Bundling Strategy

#### Tier 1: Bundled with App (required)

| Component | Size | Justification |
|-----------|------|---------------|
| `kata1-b18c384nbt-*.bin.gz` | ~65 MB | Best strength/speed tradeoff. Recommended by KataGo author for all hardware levels. [S6] |
| `analysis_config.cfg` | <1 KB | Pre-configured for desktop use |
| KataGo binary (per platform) | ~5-15 MB | Selected by backend detection |

**Total bundled size estimate**: ~70-80 MB per platform.

#### Tier 2: Optional Download (in-app)

| Component | Size | Justification |
|-----------|------|---------------|
| `kata1-b28c512nbt-*.bin.gz` | ~170 MB | Maximum strength for power users |
| `b18c384nbt-humanv0.bin.gz` | ~65 MB | Human-like analysis for teaching features |
| Additional backend binaries | ~5-15 MB each | If user has different GPU |

#### Tier 3: Emergency Fallback (bundled, compressed)

| Component | Size | Justification |
|-----------|------|---------------|
| `b10c128-*.bin.gz` | ~11 MB | For users where b18 is too slow on CPU |

### 8.4 Model Download Sources [S9, S6]

| Source | URL | Content |
|--------|-----|---------|
| Official Training | https://katagotraining.org/networks/ | Latest b18 and b28 models |
| GitHub Releases | https://github.com/lightvector/KataGo/releases | Binaries + model links |
| Extended Training Archive | https://katagoarchive.org/ | Older/smaller models (b6, b10, b15) |
| Extra Networks | https://katagotraining.org/extra_networks/ | Specialized models (human, 9x9, etc.) |

### 8.5 Model Version Compatibility [S7]

KataGo v1.16.x supports model versions up to **version 16**. Older model versions (14, 15) are backward compatible. The model version is reported in `query_models` response. [S1]

---

## 9. Visits Tier Configuration

### 9.1 Tier Definitions

| Tier | Visits | Use Case | Expected Response Time (GPU) | Expected Response Time (CPU Eigen) |
|------|--------|----------|-----------------------------|------------------------------------|
| **Instant** | 5 | Move hints, real-time cursor hover | <50ms | 0.5-2s |
| **Quick** | 50 | Quick review, next-move suggestions | <200ms | 3-10s |
| **Deep** | 500 | Full analysis, game review | <2s | 30-100s |

Response time estimates based on:
- **GPU**: RTX 3060-class or M1+ Apple Silicon, b18c384nbt model [S15, S16]
- **CPU Eigen**: Modern 8-core desktop CPU with AVX2, b18c384nbt model [S15]

### 9.2 Configuration Mapping

```json
{
  "tiers": {
    "instant": {
      "maxVisits": 5,
      "analysisPVLen": 5,
      "includeOwnership": false,
      "includePolicy": false,
      "priority": 10
    },
    "quick": {
      "maxVisits": 50,
      "analysisPVLen": 10,
      "includeOwnership": true,
      "includePolicy": false,
      "priority": 5
    },
    "deep": {
      "maxVisits": 500,
      "analysisPVLen": 15,
      "includeOwnership": true,
      "includePolicy": true,
      "priority": 0
    }
  }
}
```

### 9.3 Low-Spec Auto-Adjustment Strategy

For hardware that cannot meet acceptable response times, the app should automatically adjust visits.

#### Benchmark-Based Calibration

On first launch (and periodically), run a quick calibration:

```
FUNCTION calibrateVisitsTiers():
  // Send a standard position with 100 visits
  startTime = now()
  sendQuery({ id: "__calibrate__", moves: [], rules: "chinese",
              komi: 7.5, boardXSize: 19, boardYSize: 19, maxVisits: 100 })
  response = waitForResponse()
  elapsed = now() - startTime

  visitsPerSecond = 100 / elapsed

  // Adjust tiers based on measured performance
  IF visitsPerSecond >= 500:
    // High-performance GPU: use default tiers
    RETURN { instant: 5, quick: 50, deep: 500 }
  ELIF visitsPerSecond >= 100:
    // Mid-range GPU: moderate reduction
    RETURN { instant: 5, quick: 50, deep: 300 }
  ELIF visitsPerSecond >= 30:
    // Low-end GPU or fast CPU: significant reduction
    RETURN { instant: 3, quick: 30, deep: 150 }
  ELIF visitsPerSecond >= 10:
    // CPU-only: minimal analysis
    RETURN { instant: 1, quick: 10, deep: 50 }
  ELSE:
    // Very slow hardware: consider smaller model
    suggestModelDowngrade()
    RETURN { instant: 1, quick: 5, deep: 25 }
```

#### Response Time Targets

| Tier | Target Response Time | Acceptable Maximum |
|------|---------------------|-------------------|
| Instant | <200ms | 500ms |
| Quick | <1s | 3s |
| Deep | <5s | 15s |

If the calibration shows that even minimal visits exceed these targets, the app should:

1. **First**: Suggest a smaller model (b10c128 instead of b18c384nbt)
2. **Second**: Reduce `numSearchThreadsPerAnalysisThread` to free resources
3. **Third**: Display a performance warning to the user

### 9.4 Recommended Analysis Config Parameters [S2]

```ini
# === Threading (adjust per hardware) ===
numAnalysisThreads = 2
numSearchThreadsPerAnalysisThread = 16
nnMaxBatchSize = 64

# === Cache ===
nnCacheSizePowerOfTwo = 23   # 8M entries, ~1-2GB RAM

# === Reporting ===
reportAnalysisWinratesAs = BLACK
maxVisits = 500              # Default for deep analysis

# === Search Quality ===
# Leave defaults for cpuctExploration, FPU, etc.
# These are well-tuned in KataGo's defaults
```

**Low-spec overrides**:

```ini
numAnalysisThreads = 1
numSearchThreadsPerAnalysisThread = 4
nnMaxBatchSize = 16
nnCacheSizePowerOfTwo = 20   # 1M entries, ~128MB RAM
```

---

## 10. Hardware Benchmark Strategy

### 10.1 Reference Benchmarks [S15, S16]

#### b18c384nbt Model Performance

| Backend | Hardware | Visits/sec | Source |
|---------|----------|-----------|--------|
| TensorRT | RTX 5070 | 3,262 | [S15] |
| CUDA | RTX 5070 | 2,294 | [S15] |
| TensorRT | RTX 4070 | ~6,500 | [S16] (extrapolated, different config) |
| CUDA | RTX 4070 | ~4,000 | [S16] |
| OpenCL | RTX 5070 | 1,250 | [S15] |
| OpenCL | RTX 4070 | ~2,200 | [S16] |
| Metal | Apple M3 Max | 348 | [S15] |
| Metal | Apple M1 (est.) | ~150-200 | Estimated from M3 Max data |
| Eigen AVX2 | Intel Ultra 7 265 | 52 | [S15] |
| Eigen | Intel Ultra 7 265 | 38 | [S15] |
| OpenCL | RX 5700 XT | ~580 | [S16] (b40 model, extrapolate ~800-1000 for b18) |

#### b28c512nbt Model Performance

| Backend | Hardware | Visits/sec | Source |
|---------|----------|-----------|--------|
| TensorRT | RTX 5070 | 1,397 | [S15] |
| CUDA | RTX 5070 | 927 | [S15] |
| OpenCL | RTX 5070 | 580 | [S15] |
| Metal | Apple M3 Max | 135 | [S15] |
| Eigen AVX2 | Intel Ultra 7 265 | 22 | [S15] |

### 10.2 In-App Benchmark Protocol

```
FUNCTION runBenchmark():
  // Use KataGo's built-in benchmark command for initial setup
  // ./katago benchmark -model <MODEL> -config <CONFIG>
  // This outputs recommended thread counts

  // For ongoing calibration, use the analysis engine directly:
  position = createEmptyBoard(19, 19)
  results = []

  FOR visits IN [10, 50, 100]:
    start = now()
    sendQuery({
      id: "__bench_" + visits,
      moves: [],
      rules: "chinese",
      komi: 7.5,
      boardXSize: 19,
      boardYSize: 19,
      maxVisits: visits,
    })
    response = waitForResponse()
    elapsed = now() - start
    results.append({ visits, elapsed, vps: visits / elapsed })

  // Use median visits/sec for tier calibration
  medianVPS = median(results.map(r => r.vps))
  RETURN calibrateTiersFromVPS(medianVPS)
```

### 10.3 Hardware Classification

| Classification | Visits/sec (b18) | Typical Hardware | Recommended Tier Limits |
|----------------|-------------------|------------------|------------------------|
| **High** | >= 500 | RTX 3060+, M2 Pro+ with Metal | instant=5, quick=50, deep=500 |
| **Medium** | 100-499 | GTX 1060, M1, RX 5600 | instant=5, quick=50, deep=300 |
| **Low** | 30-99 | Older GPUs, M1 (OpenCL), fast CPU | instant=3, quick=30, deep=150 |
| **Minimal** | 10-29 | CPU with AVX2, integrated GPU | instant=1, quick=10, deep=50 |
| **Ultra-Low** | <10 | Old CPU without AVX2 | instant=1, quick=5, deep=25 + suggest smaller model |

---

## Appendix A: Config File Template

A minimal analysis config for the desktop app:

```ini
# KataGo Analysis Engine Configuration
# Generated by Baduk Platform

# === Reporting ===
reportAnalysisWinratesAs = BLACK

# === Search Limits ===
maxVisits = 500

# === Threading (auto-tuned at first launch) ===
numAnalysisThreads = 2
numSearchThreadsPerAnalysisThread = 16

# === Neural Net ===
nnMaxBatchSize = 64
nnCacheSizePowerOfTwo = 23

# === Logging ===
logDir = katago_logs
logAllRequests = false
logAllResponses = false
logSearchInfo = false
```

## Appendix B: Integration Checklist for Step 12

The following items must be verified by the katago-integrator implementation:

- [ ] Query serialization produces valid single-line JSON
- [ ] Response parsing tolerates unknown fields (future-proof)
- [ ] Stderr is consumed on a separate thread to prevent pipe blocking
- [ ] Process crash is detected via `poll()` (exit code check)
- [ ] `query_version` is sent on startup to verify the process is responsive
- [ ] `--quit-without-waiting` flag is always set for controlled shutdown
- [ ] Circuit breaker tracks failures within a 10-minute sliding window
- [ ] Backoff delay starts at 3s and doubles up to 30s maximum
- [ ] OpenCL first-run tuning delay is communicated to the user
- [ ] Visits tiers are calibrated based on hardware benchmark on first launch
- [ ] Model file existence is verified before spawning the process
- [ ] `id` field format allows correlation of responses to UI requests
- [ ] `analyzeTurns` is used for batch analysis of game sequences
- [ ] `terminate` / `terminate_all` actions are used to cancel obsolete queries
- [ ] `priority` field is used to prioritize user-facing queries over background analysis

---

## pACS Self-Rating

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **F (Fidelity)** | 88 | Every query/response field is traced to official KataGo docs [S1] or source code [S4]. Model file sizes for newer .bin.gz models are estimated (marked "partially unverified") since exact byte counts were not directly extractable from web sources. All other protocol details match primary sources exactly. |
| **C (Completeness)** | 90 | All six required sections are covered: query format (3.1-3.8), response format (4.1-4.9), GPU detection (6.1-6.5), process lifecycle (7.1-7.6), model strategy (8.1-8.5), visits tiers (9.1-9.4), plus hardware benchmarks (10.1-10.3). TypeScript types are complete. Human SL model integration is documented. |
| **L (Logical Coherence)** | 92 | The spec is internally consistent: TypeScript types match the documented fields, the state machine covers all transitions, the circuit breaker parameters are realistic, and the visits tier calibration algorithm references the benchmark data. The GPU detection correctly accounts for compile-time backend selection. |
| **pACS** | **88** | min(88, 90, 92) = 88. GREEN (>= 70). |

**Known limitations**:
1. Exact .bin.gz file sizes for b18c384nbt and b28c512nbt models are estimated, not verified by direct download. Marked in Section 8.1.
2. Response time expectations for the "Instant" tier on GPU are estimated from visits/sec benchmarks, not measured with 5-visit queries specifically (overhead may dominate at very low visit counts).
3. The `enableMorePassingHacks` parameter added in v1.16.0 [S7] is not documented in detail as its specification was not found in the Analysis Engine docs.

---

*Generated by @katago-researcher | Step 2 of Baduk Platform Workflow*
*All claims attributed to primary sources. See Source Catalog (Section 1) for URLs.*
