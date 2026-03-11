# Template Explanation Engine Design

**Version**: 1.0.0
**Author**: @template-designer (Step 4)
**Date**: 2026-03-11
**Consumers**: Step 13 (template-engineer), Step 6 (architect), Step 12 (katago-integrator)
**Inputs**: Step 2 IPC Spec, Step 3 DKS + Rules Spec, Step 4 KataGo Samples

---

## Table of Contents

1. [Core Principle: LLM = Translator, KataGo = Truth](#1-core-principle)
2. [Architecture Overview](#2-architecture-overview)
3. [KataGo Field Mapping](#3-katago-field-mapping)
4. [Pattern Matching Pipeline](#4-pattern-matching-pipeline)
5. [3-Tier Template System](#5-3-tier-template-system)
6. [Mandatory Fallback Templates: High-Risk Positions](#6-mandatory-fallback)
7. [AI Explanation Tone and Personality](#7-ai-tone)
8. [Coverage Methodology](#8-coverage-methodology)
9. [LLM Integration Boundary](#9-llm-integration-boundary)
10. [Pattern Catalog Reference](#10-pattern-catalog-reference)
11. [Verification Checklist](#11-verification-checklist)
12. [pACS Self-Rating](#12-pacs)

---

## 1. Core Principle: LLM = Translator, KataGo = Truth

### 1.1 Structural Invariant

Every Go-specific claim presented to the user MUST originate from KataGo numerical data. The LLM's role is strictly limited to:

1. **Translation**: Converting KataGo numbers into natural language sentences.
2. **Combination**: Merging multiple template outputs into coherent paragraphs.
3. **Rephrasing**: Adjusting vocabulary for the target audience tier.

The LLM NEVER:

- Generates strategic Go analysis independently.
- Invents move sequences not present in KataGo's `pv` output.
- Fabricates winrate, score, or ownership values.
- Offers positional assessments that contradict KataGo data.

### 1.2 Structural Enforcement Mechanisms

The architecture enforces this invariant at four levels:

| Layer | Mechanism | Failure Mode Blocked |
|-------|-----------|---------------------|
| **L0: Data Gate** | Template engine receives only KataGo JSON; no board state is passed to LLM | LLM cannot "reason" about the board |
| **L1: Slot Binding** | Every template placeholder maps to a specific KataGo field; empty slots are compilation errors | Fabricated data cannot enter output |
| **L2: Category Lock** | Life/death, ko, seki positions use mandatory pre-authored templates; LLM is never invoked | Hallucinated life/death claims impossible |
| **L3: Output Validator** | Post-generation check: every number in the output text must trace to a KataGo field value | Catch-all for any leaks |

### 1.3 Data Flow Diagram

```
KataGo Process
     |
     v
[JSON Response] ─────────────────────────────────────┐
     |                                                 |
     v                                                 v
[Pattern Classifier]                        [L3: Output Validator]
     |                                                 ^
     ├── High-Risk? ──YES──> [Mandatory Template]      |
     |                           |                     |
     ├── Pattern Match? ──YES──> [Template Engine] ────┤
     |                           |                     |
     └── No Match ──> [LLM Translator] ───────────────┤
                       (KataGo data as input only)     |
                                                       v
                                                [User-Facing Text]
```

### 1.4 Anti-Patterns (NEVER DO)

1. **NEVER** pass raw board positions to the LLM and ask "what do you think about this position?"
2. **NEVER** ask the LLM to generate move sequences — use KataGo `pv` exclusively.
3. **NEVER** allow the LLM to override a KataGo assessment (e.g., KataGo says 60% winrate but LLM says "this is a losing position").
4. **NEVER** use LLM-generated text for life/death, ko, or seki explanations.
5. **NEVER** allow template slots to remain unfilled — every `{placeholder}` must resolve to a KataGo value.

---

## 2. Architecture Overview

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 Template Explanation Engine               │
│                                                           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   KataGo      │   │   Pattern     │   │  Template    │ │
│  │   Field       │──>│   Classifier  │──>│  Selector    │ │
│  │   Extractor   │   │              │   │              │ │
│  └──────────────┘   └──────────────┘   └──────┬───────┘ │
│                                                 │         │
│                    ┌───────────────────────────┤         │
│                    │              │              │         │
│                    v              v              v         │
│            ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│            │ Mandatory  │ │  Template  │ │    LLM     │  │
│            │ Fallback   │ │  Renderer  │ │ Translator │  │
│            │ (L/D, Ko,  │ │            │ │ (fallback) │  │
│            │  Seki)     │ │            │ │            │  │
│            └─────┬──────┘ └─────┬──────┘ └─────┬──────┘  │
│                  │              │              │          │
│                  v              v              v          │
│            ┌─────────────────────────────────────────┐   │
│            │           Output Combiner               │   │
│            │   + Tier Adapter (Beginner/Mid/Adv)     │   │
│            │   + L3 Validator                        │   │
│            └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Processing Pipeline

1. **Extract**: Parse KataGo `AnalysisResponse` into structured fields.
2. **Compute Deltas**: If previous-move analysis is available, compute `winrateDelta`, `scoreLeadDelta`.
3. **Classify**: Determine the position category (opening, middle game, endgame, life/death, ko, seki).
4. **Select Template**: Match the situation to the highest-priority applicable template.
5. **Bind Slots**: Fill template placeholders with extracted KataGo values.
6. **Render**: Produce the final text for the target audience tier.
7. **Validate**: L3 validator ensures all numbers trace to KataGo data.

### 2.3 Context Requirements

The template engine requires two pieces of context per explanation:

| Context | Source | Required |
|---------|--------|----------|
| **Current position analysis** | KataGo `AnalysisResponse` for the current move | Always |
| **Previous position analysis** | KataGo `AnalysisResponse` for the move before | For delta-based patterns (mistake detection, improvement, etc.) |

When only the current analysis is available (e.g., first move, or no comparison requested), delta-based patterns are skipped and absolute patterns are used.

---

## 3. KataGo Field Mapping

### 3.1 Always-Present Fields (Core Mapping)

These fields are present in every standard `AnalysisResponse` and form the backbone of explanation generation.

#### 3.1.1 RootInfo Fields

| KataGo Field | Type | Explanation Pattern | Description |
|---|---|---|---|
| `rootInfo.winrate` | `number [0,1]` | Overall position assessment | Win probability for current player |
| `rootInfo.scoreLead` | `number` | Score estimation | Predicted point lead |
| `rootInfo.visits` | `integer` | Confidence indicator | Total MCTS visits |
| `rootInfo.currentPlayer` | `"B"\|"W"` | Player identification | Who is to move |
| `rootInfo.scoreStdev` | `number` | Uncertainty indicator | Score prediction uncertainty |
| `rootInfo.rawStWrError` | `number` | Confidence qualifier | NN short-term winrate uncertainty |
| `rootInfo.rawStScoreError` | `number` | Confidence qualifier | NN short-term score uncertainty |
| `rootInfo.rawVarTimeLeft` | `number` | Game phase detection | Estimated meaningful moves remaining |

#### 3.1.2 MoveInfo Fields (per candidate move)

| KataGo Field | Type | Explanation Pattern | Description |
|---|---|---|---|
| `moveInfos[i].move` | `string` | Move identification | GTP coordinate of the candidate |
| `moveInfos[i].winrate` | `number [0,1]` | Move quality assessment | Win probability if this move is played |
| `moveInfos[i].scoreLead` | `number` | Move value assessment | Predicted score after this move |
| `moveInfos[i].order` | `integer` | Move ranking | 0 = best, 1 = second best, etc. |
| `moveInfos[i].prior` | `number [0,1]` | AI intuition indicator | NN policy weight (how "natural" the move looks) |
| `moveInfos[i].visits` | `integer` | Search depth indicator | How deeply this move was analyzed |
| `moveInfos[i].pv` | `string[]` | Sequence explanation | Best follow-up sequence |
| `moveInfos[i].utility` | `number` | Combined assessment | Win + score utility value |
| `moveInfos[i].lcb` | `number` | Pessimistic assessment | Lower confidence bound for winrate |
| `moveInfos[i].scoreStdev` | `number` | Outcome variance | How volatile the position is after this move |

#### 3.1.3 Computed Fields (derived, not from KataGo directly)

| Computed Field | Formula | Explanation Pattern |
|---|---|---|
| `winrateDelta` | `current.rootInfo.winrate - previous.rootInfo.winrate` (perspective-adjusted) | Mistake/improvement detection |
| `scoreLeadDelta` | `current.rootInfo.scoreLead - previous.rootInfo.scoreLead` (perspective-adjusted) | Points gained/lost |
| `bestMovePlayed` | `actualMove === moveInfos[0].move` | Good/bad move detection |
| `moveRank` | Index of actual move in `moveInfos` (by `order`) | Move quality grading |
| `topMoveGap` | `moveInfos[0].winrate - moveInfos[1].winrate` | How clear the best choice was |
| `movePhase` | Derived from `rootInfo.rawVarTimeLeft` and `turnNumber` | Game phase classification |
| `confidenceLevel` | Derived from `rootInfo.visits` and visit tiers | Analysis reliability |

### 3.2 Optional Fields (Conditional Mapping)

These fields are present only when specifically requested in the query.

| KataGo Field | Query Flag | Explanation Pattern | Fallback |
|---|---|---|---|
| `ownership[]` | `includeOwnership: true` | Territory visualization, life/death assessment | Use `scoreLead` for general territory talk |
| `ownershipStdev[]` | `includeOwnershipStdev: true` | Contested area identification | Skip uncertainty visualization |
| `moveInfos[i].ownership[]` | `includeMovesOwnership: true` | Move-specific territory change | Use `scoreLead` delta |
| `policy[]` | `includePolicy: true` | Move naturalness explanation | Use `prior` from moveInfos |
| `moveInfos[i].pvVisits[]` | `includePVVisits: true` | Sequence confidence depth | Use `pv` length as proxy |

**Rule**: Templates that use optional fields MUST have a fallback template variant that works without them. The Step 13 implementer must check field presence before selecting the template variant.

### 3.3 Perspective Handling

KataGo reports winrate/score from the perspective configured by `reportAnalysisWinratesAs` (default: BLACK). The template engine MUST:

1. Check `rootInfo.currentPlayer` for every response.
2. If the reporting perspective differs from the current player, flip values:
   - `adjustedWinrate = 1.0 - winrate`
   - `adjustedScoreLead = -scoreLead`
3. All templates use current-player-relative values: positive = good for current player.

### 3.4 Threshold Definitions

These thresholds determine which pattern activates. All delta values are in current-player perspective.

| Threshold Name | Value | Usage |
|---|---|---|
| `BLUNDER_WINRATE_DROP` | > 0.10 (10%) | Triggers "blunder" pattern |
| `MISTAKE_WINRATE_DROP` | > 0.05 (5%) | Triggers "mistake" pattern |
| `INACCURACY_WINRATE_DROP` | > 0.02 (2%) | Triggers "inaccuracy" pattern |
| `GOOD_MOVE_THRESHOLD` | actual move is `order: 0` | Triggers "good move" pattern |
| `EXCELLENT_MOVE_THRESHOLD` | `order: 0` AND `topMoveGap > 0.03` | Triggers "excellent move" pattern |
| `BRILLIANT_MOVE_THRESHOLD` | `order: 0` AND `prior < 0.05` AND `visits > 100` | Triggers "brilliant/unexpected" pattern |
| `CLOSE_GAME_THRESHOLD` | `abs(winrate - 0.50) < 0.05` | Triggers "close game" pattern |
| `WINNING_THRESHOLD` | `winrate > 0.65` | Triggers "strong advantage" pattern |
| `LOSING_THRESHOLD` | `winrate < 0.35` | Triggers "significant disadvantage" pattern |
| `DECISIVE_THRESHOLD` | `winrate > 0.85` or `winrate < 0.15` | Triggers "decisive" pattern |
| `ENDGAME_PHASE` | `rawVarTimeLeft < 40` or `turnNumber > 150` (19x19) | Phase classification |
| `OPENING_PHASE` | `turnNumber < 40` (19x19), `< 15` (9x9) | Phase classification |
| `SCORE_SIGNIFICANT` | `abs(scoreLeadDelta) > 2.0` | Score change worth mentioning |
| `HIGH_CONFIDENCE` | `rootInfo.visits >= 400` | Confident analysis |
| `LOW_CONFIDENCE` | `rootInfo.visits < 50` | Add uncertainty qualifier |
| `LIFE_DEATH_OWNERSHIP` | `abs(ownership[i]) > 0.9` for a group region | Life/death detection |
| `CONTESTED_OWNERSHIP` | `abs(ownership[i]) < 0.3` | Contested territory |

---

## 4. Pattern Matching Pipeline

### 4.1 Priority Chain

When a KataGo response arrives, the pattern classifier evaluates candidates in strict priority order. The first match wins.

```
Priority 1: MANDATORY FALLBACK (Life/Death, Ko, Seki)
  │  Trigger: Position categorized as life/death, ko, or seki
  │  Action: Use pre-authored template. LLM is NEVER invoked.
  │
  v
Priority 2: MOVE QUALITY ASSESSMENT
  │  Trigger: winrateDelta computed (requires previous analysis)
  │  Sub-priorities:
  │    2a: Blunder (winrateDelta < -0.10)
  │    2b: Mistake (winrateDelta < -0.05)
  │    2c: Inaccuracy (winrateDelta < -0.02)
  │    2d: Brilliant move (order=0, prior<0.05, visits>100)
  │    2e: Excellent move (order=0, topMoveGap>0.03)
  │    2f: Good move (order=0)
  │    2g: Acceptable move (order 1-2, winrateDelta > -0.02)
  │
  v
Priority 3: POSITIONAL ASSESSMENT
  │  Trigger: No delta available OR delta is negligible
  │  Sub-priorities:
  │    3a: Decisive advantage (winrate > 0.85 or < 0.15)
  │    3b: Strong advantage (winrate > 0.65 or < 0.35)
  │    3c: Slight advantage (winrate 0.55-0.65 or 0.35-0.45)
  │    3d: Even/close position (winrate 0.45-0.55)
  │
  v
Priority 4: GAME PHASE PATTERNS
  │  Trigger: Based on turnNumber and rawVarTimeLeft
  │  Sub-priorities:
  │    4a: Opening patterns (fuseki)
  │    4b: Middle game patterns (chuban)
  │    4c: Endgame patterns (yose)
  │
  v
Priority 5: ALTERNATIVE MOVES
  │  Trigger: moveInfos has 2+ candidates
  │  Action: Suggest top alternatives with explanations
  │
  v
Priority 6: GENERIC FALLBACK
  │  Trigger: Nothing above matched
  │  Action: Simple position summary from rootInfo
```

### 4.2 Position Category Detection

The pattern classifier determines position categories using the following heuristics. These are implemented in deterministic code, not by the LLM.

#### 4.2.1 Life/Death Detection

A position is classified as life/death when ANY of these conditions are met:

1. **Ownership-based**: `includeOwnership: true` was requested AND a contiguous group of stones has ownership values clustering near 0 (contested, between -0.4 and 0.4) while surrounding stones have ownership near +/-1 (decided).
2. **Score-swing-based**: The best move and second-best move differ by more than 5 points in `scoreLead`, AND the group near the best move has low ownership confidence.
3. **PV-based**: The principal variation contains captures and recaptures in a localized area (moves within Manhattan distance 3 of each other).

**Important**: Life/death detection does NOT determine whether the group lives or dies. That assessment comes from KataGo's ownership data and `scoreLead` values. The detection only triggers the mandatory template, which then reads KataGo's numbers to fill in the status.

#### 4.2.2 Ko Detection

A position involves ko when ANY of these conditions are met:

1. **PV pattern**: The `pv` sequence contains a move at location X, followed by a move elsewhere (threat), followed by a recapture at or near X. This indicates ko fighting.
2. **Score oscillation**: Within the top 3 candidates, `scoreLead` values show a pattern where fighting at a specific location alternates between large positive and negative values.
3. **Query metadata**: The position was flagged by the game engine as containing an active ko point.

#### 4.2.3 Seki Detection

Seki is detected when:

1. **Ownership-based**: Two adjacent groups of opposite colors both have ownership values near 0 (alive but neutral), AND shared liberties between them also have ownership near 0.
2. **Score stability**: The `scoreLead` does not change significantly regardless of which player moves in the contested area (both top moves preserve the status quo).

#### 4.2.4 Game Phase Detection

| Phase | Condition (19x19) | Condition (13x13) | Condition (9x9) |
|-------|-------------------|-------------------|-----------------|
| Opening | `turnNumber < 40` | `turnNumber < 25` | `turnNumber < 15` |
| Middle Game | `40 <= turnNumber < 150` AND `rawVarTimeLeft > 40` | `25 <= turnNumber < 90` | `15 <= turnNumber < 40` |
| Endgame | `turnNumber >= 150` OR `rawVarTimeLeft < 40` | `turnNumber >= 90` OR `rawVarTimeLeft < 25` | `turnNumber >= 40` OR `rawVarTimeLeft < 15` |

### 4.3 Multiple Pattern Composition

A single position may trigger multiple patterns simultaneously. The composition rules are:

1. **Primary pattern**: The highest-priority match determines the lead sentence.
2. **Supporting patterns**: Lower-priority matches add supplementary sentences (up to 2).
3. **Maximum length**: Beginner = 3 sentences, Intermediate = 5 sentences, Advanced = 7 sentences.
4. **Conflict resolution**: If two patterns make contradictory claims, the higher-priority one wins and the lower is discarded.

---

## 5. 3-Tier Template System

### 5.1 Tier Design Philosophy

| Tier | Audience | Vocabulary | Focus | Tone |
|------|----------|-----------|-------|------|
| **Beginner** (T1) | New players, sub-20k | No Go terms; everyday language | "What happened" — concrete outcomes | Encouraging, warm |
| **Intermediate** (T2) | 20k-5d players | Basic Go terms (atari, territory, influence) | "Why this matters" — strategic concepts | Informative, balanced |
| **Advanced** (T3) | 5d+ players | Full Go vocabulary (aji, sabaki, tewari) | "Deep analysis" — reading, shape, timing | Analytical, precise |

### 5.2 Template Structure

Every template follows this canonical structure:

```yaml
id: "P-{TIER}-{CATEGORY}-{NUMBER}"  # e.g., P-T1-MQ-01
tier: "beginner" | "intermediate" | "advanced"
category: "move_quality" | "position" | "opening" | "middle_game" | "endgame" | "life_death" | "ko" | "seki" | "alternative" | "generic"
trigger:
  conditions:                    # ALL conditions must be true (AND logic)
    - field: "winrateDelta"      # KataGo field or computed field
      operator: "<"             # <, >, <=, >=, ==, !=, in, between
      value: -0.10              # threshold value
  requires_optional:             # list of optional KataGo fields needed
    - "ownership"               # if listed, fallback template used when absent
  requires_delta: true|false    # whether previous-move analysis is needed
template:
  text: "..."                    # template text with {placeholders}
  slots:                         # mapping from placeholder to KataGo field
    move: "moveInfos[0].move"
    winrate_pct: "computed.winrateDelta * 100"
    best_move: "moveInfos[0].move"
fallback_id: "P-T1-MQ-01-fb"   # ID of fallback template (if this one needs optional data)
mandatory: false                 # true = pre-authored, LLM bypass
```

### 5.3 Placeholder Resolution Rules

1. Every `{placeholder}` in the template text MUST have a corresponding entry in `slots`.
2. Every `slots` entry MUST map to either a KataGo response field path or a computed field with a defined formula.
3. Numeric placeholders are formatted according to tier rules:
   - Beginner: rounded to whole numbers (`{winrate_pct}` = "62")
   - Intermediate: one decimal place ("62.3")
   - Advanced: one decimal place with additional context ("62.3% [LCB: 58.1%]")
4. Move location placeholders (`{move}`, `{best_move}`) are always in GTP notation.
5. PV sequence placeholders are formatted as: "Q12 -> R10 -> Q10" (beginner shows first 2 moves, intermediate first 3, advanced up to 5).

### 5.4 Template Catalog Summary

The full catalog is in the companion file `outputs/step-04-pattern-catalog.yaml`. Here is the summary by category and tier:

| Category | Beginner (T1) | Intermediate (T2) | Advanced (T3) | Total |
|----------|:---:|:---:|:---:|:---:|
| Move Quality | 7 | 7 | 7 | 21 |
| Position Assessment | 4 | 4 | 4 | 12 |
| Opening | 3 | 3 | 3 | 9 |
| Middle Game | 3 | 3 | 3 | 9 |
| Endgame | 3 | 3 | 3 | 9 |
| Life/Death (mandatory) | 3 | 3 | 3 | 9 |
| Ko (mandatory) | 2 | 2 | 2 | 6 |
| Seki (mandatory) | 1 | 1 | 1 | 3 |
| Alternative Moves | 2 | 2 | 2 | 6 |
| Generic / Confidence | 2 | 2 | 2 | 6 |
| **Total per tier** | **30** | **30** | **30** | **90** |

Each tier has 30 patterns, exceeding the minimum requirement of 20 per tier.

---

## 6. Mandatory Fallback Templates: High-Risk Positions

### 6.1 Design Rationale

Life/death, ko, and seki are the three categories where incorrect explanations cause the most harm to learners. An LLM has zero understanding of Go and WILL fabricate plausible-sounding but wrong analysis for these positions. Therefore:

- **Mandatory templates are pre-authored by Go-knowledgeable engineers.**
- **The LLM is structurally excluded from the generation path for these categories.**
- **The template engine hard-codes a branch: if category in {life_death, ko, seki}, use mandatory template directly.**

### 6.2 Life/Death Templates

Life/death templates report KataGo's ownership-based assessment of group status. They do NOT attempt to explain the reading (that would require Go understanding). Instead, they report what KataGo says about the group's chances.

**Detection input**: `ownership[]` array (when available) or `scoreLead` swing between moves.

**Template family**:

| ID | Trigger | Beginner Text |
|---|---|---|
| `P-T1-LD-01` | Group ownership > 0.7 (alive) | "This group of stones is safe. It has enough room to survive." |
| `P-T1-LD-02` | Group ownership < -0.7 (dead) | "This group of stones is in danger. The computer thinks it will be captured." |
| `P-T1-LD-03` | Group ownership between -0.4 and 0.4 (unsettled) | "This group's fate is not decided yet. The next few moves will determine if it survives." |

Each has intermediate and advanced variants with progressively more detail. See the pattern catalog for the complete set.

**Fallback when ownership is unavailable**: Use `scoreLead` magnitude. If the best move involves a localized fight with `scoreLead` swing > 8 points, classify as life/death and use a simplified template.

### 6.3 Ko Templates

Ko templates explain that a ko fight is occurring and report the stakes based on KataGo's score differential.

| ID | Trigger | Beginner Text |
|---|---|---|
| `P-T1-KO-01` | Ko detected, stakes > 5 points | "A special kind of fight (called 'ko') is happening here. Both players are taking turns trying to win this area. It is worth about {ko_value} points." |
| `P-T1-KO-02` | Ko detected, stakes <= 5 points | "There is a small back-and-forth fight here. It is worth about {ko_value} points." |

### 6.4 Seki Templates

Seki templates explain that neither group can capture the other.

| ID | Trigger | Beginner Text |
|---|---|---|
| `P-T1-SK-01` | Seki detected | "Both groups of stones here are alive. Neither player can capture the other without losing their own stones. They will both stay on the board." |

### 6.5 Mandatory Template Enforcement

The Step 13 implementer MUST enforce the following code-level invariant:

```typescript
function generateExplanation(analysis: AnalysisResponse, category: PositionCategory, tier: Tier): string {
  // MANDATORY: high-risk categories NEVER go through LLM
  if (category === 'life_death' || category === 'ko' || category === 'seki') {
    return renderMandatoryTemplate(analysis, category, tier);
    // ^^^ This path NEVER calls the LLM. It uses only pre-authored templates + KataGo data.
  }

  // Standard path: template matching with LLM fallback
  const template = findBestTemplate(analysis, category, tier);
  if (template) {
    return renderTemplate(template, analysis);
  }

  // LLM fallback: ONLY for non-high-risk categories
  return llmTranslate(analysis, tier);
  // ^^^ LLM receives ONLY KataGo data. It CANNOT access the board or generate moves.
}
```

---

## 7. AI Explanation Tone and Personality

### 7.1 Open Item Resolution: PRD 11.2 #6

The PRD lists AI explanation tone as an open item with three candidates: analytical, encouraging, and Socratic. After analysis, the recommendation is a **hybrid approach** that varies by audience tier.

### 7.2 Recommendation: Adaptive Tone by Tier

| Tier | Primary Tone | Secondary Tone | Rationale |
|------|-------------|---------------|-----------|
| **Beginner** | Encouraging | Informative | Beginners need positive reinforcement to continue learning. Harsh analysis drives them away. Research on language learning apps (Duolingo) shows encouragement increases retention by 30%+. |
| **Intermediate** | Informative | Mildly Socratic | Intermediate players want to understand concepts. Occasional "What might happen if...?" questions promote thinking without being condescending. |
| **Advanced** | Analytical | Neutral/Precise | Advanced players want data, not encouragement. They appreciate precision, conciseness, and numerical detail. |

### 7.3 Tone Implementation in Templates

**Beginner examples**:
- Good move: "Nice choice! This move keeps you in a strong position."
- Mistake: "This move lost some advantage, but do not worry — there is still a good game ahead."
- Blunder: "Careful! This move gave away a significant lead. Let us look at what might have been better."

**Intermediate examples**:
- Good move: "Good move. {move} maintains your territorial advantage at {scoreLead} points."
- Mistake: "This move dropped your win rate by {winrate_delta_pct}%. The engine preferred {best_move}, which would keep the pressure on."
- Blunder: "A significant mistake. Playing at {best_move} instead would have maintained a {best_winrate_pct}% win rate. The key sequence: {pv_sequence}."

**Advanced examples**:
- Good move: "{move} — optimal. WR: {winrate_pct}% [LCB: {lcb_pct}%], Score: {scoreLead}. Policy prior: {prior_pct}%."
- Mistake: "Suboptimal. Delta: -{winrate_delta_pct}% WR, -{score_delta} pts. Best: {best_move} (V:{visits}, PV: {pv_sequence}). {alternatives_count} alternatives within 2% WR."
- Blunder: "Blunder: -{winrate_delta_pct}% WR, -{score_delta} pts. Critical line: {pv_sequence}. Position shifts from {prev_assessment} to {curr_assessment}."

### 7.4 Persona Definition: "Teaching Assistant"

The AI explanation system adopts the persona of a **patient teaching assistant** who:

- Knows their role is to translate the teacher's (KataGo's) analysis, not to offer their own opinions.
- Adjusts vocabulary and detail level to the student's level.
- Celebrates progress and frames mistakes as learning opportunities (beginner tier).
- Provides actionable insights ("next time, look for...") at the intermediate tier.
- Delivers precise, economical analysis at the advanced tier.

### 7.5 What the LLM CAN vs. CANNOT Do

| CAN DO | CANNOT DO |
|--------|-----------|
| Rephrase template output for variety | Generate Go strategy or analysis |
| Combine multiple template outputs into fluent paragraphs | Contradict KataGo's numerical data |
| Adjust formality/casualness within tier guidelines | Invent move sequences not in KataGo `pv` |
| Add transitional phrases between explanation segments | Claim a move is good/bad without KataGo data |
| Translate GTP coordinates into human-readable form ("the upper-right corner") | Explain WHY a position is life/death (beyond what KataGo data shows) |
| Paraphrase encouragement/analytical framing | Override a mandatory template with its own text |

---

## 8. Coverage Methodology

### 8.1 Coverage Definition

**Coverage** = the percentage of KataGo analysis responses that can be fully explained using templates alone, without requiring LLM fallback.

Formally:

```
Coverage = (positions explained by templates only) / (total positions analyzed) * 100%
```

A position is "explained by templates only" when:
1. At least one template's trigger conditions match the KataGo response data.
2. All template slots can be filled with available KataGo fields.
3. No LLM invocation is needed to produce the output text.

### 8.2 Target

**Minimum coverage: 80%** of positions in a representative game sample.

### 8.3 Measurement Methodology

#### 8.3.1 Sample Construction

1. Collect a corpus of **50 games** across difficulty levels:
   - 10 games: 9x9 beginner-level
   - 15 games: 19x19 amateur (SDK to low-dan)
   - 15 games: 19x19 amateur (mid-dan to high-dan)
   - 10 games: 19x19 professional
2. For each game, analyze every move with KataGo at the "standard" visits tier (200 visits).
3. This produces approximately **50 games x ~200 moves/game = ~10,000 position analyses**.

#### 8.3.2 Measurement Procedure

For each KataGo analysis response in the corpus:

1. Run the pattern classifier to determine the position category.
2. Attempt template matching using the priority chain (Section 4.1).
3. Record the result:
   - `TEMPLATE_HIT`: A template matched and all slots were filled.
   - `TEMPLATE_PARTIAL`: A template matched but required optional fields that were absent; fallback template used.
   - `LLM_REQUIRED`: No template matched; LLM fallback would be needed.
   - `MANDATORY_HIT`: Position was high-risk; mandatory template used.

4. Compute coverage:
   ```
   coverage = (TEMPLATE_HIT + TEMPLATE_PARTIAL + MANDATORY_HIT) / total * 100%
   ```

#### 8.3.3 Coverage Breakdown by Category

Track coverage per position category to identify gaps:

| Category | Expected Coverage | Notes |
|----------|:---:|---|
| Move quality (with delta) | 95%+ | Well-defined thresholds cover all delta ranges |
| Position assessment (no delta) | 90%+ | Winrate ranges are exhaustive |
| Opening | 85%+ | Common patterns well-covered |
| Middle game | 75%+ | Highest variety; some complex fights may need LLM |
| Endgame | 90%+ | Endgame is primarily about point counting |
| Life/death | 100% | Mandatory templates, always hit |
| Ko | 100% | Mandatory templates, always hit |
| Seki | 100% | Mandatory templates, always hit |

### 8.4 Coverage Expansion Strategy

When a coverage gap is identified:

1. **Analyze the miss**: What KataGo data was present? Why did no template match?
2. **Design a new pattern**: Define trigger conditions that would catch this case.
3. **Author templates**: Write beginner, intermediate, and advanced variants.
4. **Add to catalog**: Include in `pattern-catalog.yaml` with a new unique ID.
5. **Re-measure**: Run the coverage measurement again to confirm improvement.
6. **Iteration cadence**: Monthly during development, quarterly post-launch.

### 8.5 Coverage Gap Categories (Anticipated)

Based on analysis of the sample data and Go game structure, these areas are likely to need expansion:

| Gap Area | Why | Mitigation |
|----------|-----|------------|
| Complex middle-game fights | Many possible shapes and tactics | Start with generic "fighting" templates; expand as data comes in |
| Multi-group interactions | Template designed for single-group focus | Add templates for "this move affects groups at {loc1} AND {loc2}" |
| Unusual openings | Template assumes standard fuseki | Add catch-all opening template with generic assessment |
| Very close endgames | Small deltas hard to narrate interestingly | Add "every point matters" templates for close endgames |

---

## 9. LLM Integration Boundary

### 9.1 When the LLM Is Invoked

The LLM is invoked ONLY when:

1. No template matches the KataGo response (coverage gap).
2. The position is NOT in a high-risk category (life/death, ko, seki).
3. The system has KataGo data to provide as context.

### 9.2 LLM Input Contract

When the LLM is invoked, it receives a structured prompt containing:

```
You are a Go game explanation assistant. Your role is to translate the following
KataGo analysis into a {tier}-level explanation.

RULES:
- Use ONLY the data provided below. Do not add strategic analysis.
- Do not invent move sequences. Use only the PV sequences given.
- Do not claim a move is good or bad without citing the winrate/score values.
- Keep your explanation to {max_sentences} sentences.

KATAGO DATA:
- Current player: {currentPlayer}
- Win rate: {winrate}%
- Score lead: {scoreLead} points
- Best move: {bestMove} (winrate: {bestWinrate}%, score: {bestScore})
- Played move: {playedMove} (winrate: {playedWinrate}%, score: {playedScore})
- Best sequence: {pvSequence}
- Winrate change from previous move: {winrateDelta}%
- Score change from previous move: {scoreLeadDelta} points

Write the explanation:
```

### 9.3 LLM Output Validation (L3)

After the LLM generates text, the L3 validator checks:

1. **Number matching**: Every percentage or point value mentioned in the output must match a value from the KataGo data (within rounding tolerance of 0.5%).
2. **Move matching**: Every move coordinate mentioned must appear in the KataGo `moveInfos` or `pv` arrays.
3. **Assessment consistency**: If the text says "advantage" the winrate must be > 0.52. If it says "disadvantage" the winrate must be < 0.48. If it says "even" the winrate must be 0.48-0.52.
4. **No forbidden phrases**: The output must not contain phrases like "I think", "In my opinion", "I would play" (the LLM has no opinions about Go).

If validation fails, the system falls back to a generic template rather than showing potentially incorrect LLM output.

### 9.4 LLM Selection

The LLM used for translation should be a general-purpose language model. No Go-specific fine-tuning is needed or desired (fine-tuning might teach the model to generate Go analysis, which violates the core principle). Recommended: use the application's existing LLM integration, or a lightweight model (GPT-4o-mini, Claude 3.5 Haiku) for cost efficiency.

---

## 10. Pattern Catalog Reference

The full pattern catalog is defined in the companion file:

**`outputs/step-04-pattern-catalog.yaml`**

The catalog contains 90 patterns (30 per tier) organized by category. Each pattern includes:

- Unique ID following the `P-{TIER}-{CATEGORY}-{NUMBER}` convention.
- Trigger conditions referencing KataGo fields and computed values.
- Template text with `{placeholder}` syntax.
- Slot definitions mapping placeholders to data sources.
- Mandatory flag for life/death, ko, seki patterns.
- Fallback ID for templates requiring optional KataGo fields.

### 10.1 Pattern ID Convention

```
P - T{tier} - {category_code} - {sequence}
│    │          │                  │
│    │          │                  └── 01, 02, 03...
│    │          └── MQ (move quality), PA (position assessment),
│    │              OP (opening), MG (middle game), EG (endgame),
│    │              LD (life/death), KO (ko), SK (seki),
│    │              AL (alternative), GN (generic)
│    └── 1 (beginner), 2 (intermediate), 3 (advanced)
└── Pattern prefix
```

### 10.2 Cross-Reference: Pattern to KataGo Field

This table shows which KataGo fields each pattern category depends on:

| Category | Required Fields | Optional Fields |
|----------|----------------|-----------------|
| Move Quality (MQ) | `winrate`, `scoreLead`, `order`, `pv`, `prior` | `ownership` |
| Position Assessment (PA) | `rootInfo.winrate`, `rootInfo.scoreLead`, `rootInfo.visits` | `ownership` |
| Opening (OP) | `moveInfos[*].move`, `moveInfos[*].winrate`, `pv` | `policy` |
| Middle Game (MG) | `moveInfos[*].move`, `winrate`, `scoreLead`, `pv` | `ownership`, `moveInfos[*].ownership` |
| Endgame (EG) | `scoreLead`, `scoreLeadDelta`, `pv` | `ownership` |
| Life/Death (LD) | `scoreLead`, `winrate`, `pv` | `ownership` (strongly recommended) |
| Ko (KO) | `scoreLead`, `pv`, `moveInfos[*].move` | `ownership` |
| Seki (SK) | `scoreLead`, `winrate` | `ownership` (strongly recommended) |
| Alternative (AL) | `moveInfos[0..2].*` | None |
| Generic (GN) | `rootInfo.winrate`, `rootInfo.scoreLead` | None |

---

## 11. Verification Checklist

| # | Requirement | Status | Evidence |
|---|------------|:------:|----------|
| 1 | All KataGo analysis output fields (`winrate`, `scoreLead`, `order`, `prior`, `visits`, `pv`) mapped to patterns | PASS | Section 3.1 maps all core fields; Section 3.2 maps optional fields |
| 2 | 3-tier template catalog with >= 20 patterns per tier | PASS | 30 patterns per tier = 90 total (Section 5.4) |
| 3 | High-risk position mandatory fallback rules for life/death, ko, seki | PASS | Section 6 defines mandatory templates with code-level enforcement |
| 4 | Core principle "LLM = translator, KataGo = truth" structurally reflected | PASS | Section 1 defines 4-layer enforcement (L0-L3); Section 9 defines LLM boundary |
| 5 | Coverage 80%+ methodology defined | PASS | Section 8 defines metric, measurement, and expansion strategy |
| 6 | Step 13 implementable: pattern catalog in directly usable format | PASS | YAML catalog with trigger conditions, slots, template text |
| 7 | AI explanation tone resolved (PRD open item 11.2 #6) | PASS | Section 7 recommends adaptive tone: encouraging/informative/analytical by tier |

---

## 12. pACS Self-Rating

### Fidelity (F): 90

**Justification**: The design structurally enforces "LLM = translator, KataGo = truth" through four independent layers (L0-L3). The mandatory fallback mechanism hard-codes life/death, ko, and seki to pre-authored templates, making it structurally impossible for the LLM to hallucinate Go analysis for the most dangerous categories. The LLM integration boundary (Section 9) specifies an explicit input contract that prevents board-state access. Minor risk: the L3 output validator is designed but not yet implemented; its effectiveness depends on Step 13 implementation quality.

### Completeness (C): 88

**Justification**: The catalog contains 90 patterns (30 per tier), exceeding the 60-pattern minimum. All mandatory categories (life/death, ko, seki) have templates across all three tiers. The coverage methodology is fully specified with sample construction, measurement procedure, and expansion strategy. All KataGo response fields from the Step 2 IPC spec are mapped. The AI tone open item is resolved with rationale. Minor gap: the pattern catalog will inevitably need expansion as real game data reveals coverage gaps, but the expansion strategy is defined.

### Logical Coherence (L): 87

**Justification**: The priority chain (Section 4.1) is designed to be mutually exclusive (first match wins) and collectively exhaustive (generic fallback catches everything). Trigger conditions use measurable thresholds tied to KataGo fields. The template structure is consistent across all 90 patterns. The tier system is cleanly separated with no vocabulary overlap. Minor risk: some edge cases in position category detection (Section 4.2) rely on heuristics that may need tuning with real data.

### pACS Score: min(90, 88, 87) = **87 GREEN**
