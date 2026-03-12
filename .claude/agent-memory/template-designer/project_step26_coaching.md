---
name: Step 26 Coaching Engine Design
description: Key decisions and outputs for the AI Coach Commentary System (Step 26) — real-time Korean coaching during gameplay
type: project
---

## Step 26: AI Coach Commentary System Design

### Core Decisions
- **Zero LLM** — Stronger than Step 4; no LLM fallback path at all. All coaching text from pre-authored Korean templates.
- 15 TacticalSituation types classified by deterministic priority chain (7 tiers).
- 52 templates total: 45 base (3 per situation x 15 situations) + 7 encouragement suffixes (3 streak + 2 recovery + 2 momentum).
- Encouragement FSM with 4 states: neutral, streak, recovery, momentum.
- Template ID convention: `C-{situation_code}-{sequence}` (different from Step 4's `P-T{tier}-{cat}-{num}`).
- Beginner-only tier, Korean language.
- Template selection: `moveNumber % templates.length` for deterministic variety.

### Output Files
- Design doc: `outputs/step-26-coaching-design.md`
- Coaching catalog: `outputs/step-26-coaching-catalog.yaml`

### Key Functions to Reuse (existing)
- `parseAnalysis()` from `explanation-engine/output-parser.ts:169`
- `classifyMoveQuality()` from `explanation-engine/output-parser.ts:89`
- `detectGamePhase()` from `explanation-engine/output-parser.ts:45`
- `findGroup()` from `rules-engine/board.ts:128`
- `getAdjacencyTable()` from `rules-engine/board.ts:47`

### New Functions for Step 27
- `classifyTacticalSituation()` — priority chain classifier
- `classifySpatial()` — corner/side/center from board index
- `computeTacticalPressure()` — adjacent group analysis
- `transitionEncouragementFSM()` — state machine
- `useCoachingStore` — Zustand store following useWinRateStore pattern

### Ownership Handling
- Ownership is optional (from KataGo). When absent, invasion/defense detection is skipped.
- Perspective: flip sign for White player (`effectiveOwnership = player === BLACK ? ownership[i] : -ownership[i]`).

### pACS: 92 GREEN (F:95, C:93, L:92)
