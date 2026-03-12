---
related_agents: [translator, template-engineer]
cluster: content
---

# Template Designer Agent Memory

## Key Decisions (Step 4)
- Core invariant: LLM = Translator, KataGo = Truth Source. Enforced at 4 layers (L0-L3).
- Mandatory templates for life/death, ko, seki — LLM structurally excluded.
- 90 patterns total: 30 per tier (beginner/intermediate/advanced), 10 categories.
- AI tone: adaptive by tier — encouraging (beginner), informative (intermediate), analytical (advanced).
- Coverage target: 80%+ via templates alone.

## Key Decisions (Step 26)
- Zero LLM coaching pipeline (stronger than Step 4 — no fallback path at all).
- 15 TacticalSituation types, 7-tier priority chain, deterministic if/else.
- 52 Korean templates (45 base + 7 encouragement suffixes), beginner-only.
- Encouragement FSM: 4 states (neutral/streak/recovery/momentum).
- See: [project_step26_coaching.md](project_step26_coaching.md)

## Output Files
- Step 4 design: `outputs/step-04-template-engine-design.md`
- Step 4 catalog: `outputs/step-04-pattern-catalog.yaml`
- Step 26 design: `outputs/step-26-coaching-design.md`
- Step 26 catalog: `outputs/step-26-coaching-catalog.yaml`

## Input Dependencies
- Step 2: `outputs/step-02-katago-ipc-spec.md` — KataGo JSON protocol, TypeScript types
- Step 3: `outputs/step-03-rules-spec.md` + `outputs/step-03-domain-knowledge.yaml` — 86 entities, 40 relations
- Step 4 Samples: `outputs/preprocessed/step-04-katago-samples.json` — 10 synthetic samples
- Step 26 Signals: `outputs/step-26-coaching-signals.yaml` — 15 signal-to-concept entries, 10 extracted samples

## KataGo Field Mapping Notes
- `reportAnalysisWinratesAs` defaults to BLACK — must flip for current-player perspective
- `rootInfo.rawVarTimeLeft` is useful for game phase detection
- `ownership[]` is optional (requires `includeOwnership: true` in query) — all L/D templates need fallbacks
- `scoreMean` is alias for `scoreLead` (backward compat) — use `scoreLead` consistently

## Pattern ID Convention
- Step 4: `P-T{1|2|3}-{MQ|PA|OP|MG|EG|LD|KO|SK|AL|GN}-{01..nn}`, fallback variants add `-fb` suffix
- Step 26: `C-{TB|AP|AT|ES|CN|IN|DF|CP|EC|BR|GM|MK|MS|CG|PS|SK|RC|MO}-{01..nn}`

## Step Schema Notes
- `step-schemas/step-04.json` requires: design (.md), pattern_catalog (.md note: schema says .md but we used .yaml), design_ko (.ko.md)
- Verification fields: katago_fields_mapped, beginner/intermediate/advanced_patterns (min 20 each), high_risk_fallback_defined, llm_translator_principle, coverage_methodology
