# Template Designer Agent Memory

## Key Decisions (Step 4)
- Core invariant: LLM = Translator, KataGo = Truth Source. Enforced at 4 layers (L0-L3).
- Mandatory templates for life/death, ko, seki — LLM structurally excluded.
- 90 patterns total: 30 per tier (beginner/intermediate/advanced), 10 categories.
- AI tone: adaptive by tier — encouraging (beginner), informative (intermediate), analytical (advanced).
- Coverage target: 80%+ via templates alone.

## Output Files
- Design doc: `outputs/step-04-template-engine-design.md`
- Pattern catalog: `outputs/step-04-pattern-catalog.yaml`

## Input Dependencies
- Step 2: `outputs/step-02-katago-ipc-spec.md` — KataGo JSON protocol, TypeScript types
- Step 3: `outputs/step-03-rules-spec.md` + `outputs/step-03-domain-knowledge.yaml` — 86 entities, 40 relations
- Samples: `outputs/preprocessed/step-04-katago-samples.json` — 10 synthetic samples

## KataGo Field Mapping Notes
- `reportAnalysisWinratesAs` defaults to BLACK — must flip for current-player perspective
- `rootInfo.rawVarTimeLeft` is useful for game phase detection
- `ownership[]` is optional (requires `includeOwnership: true` in query) — all L/D templates need fallbacks
- `scoreMean` is alias for `scoreLead` (backward compat) — use `scoreLead` consistently

## Pattern ID Convention
- Format: `P-T{1|2|3}-{MQ|PA|OP|MG|EG|LD|KO|SK|AL|GN}-{01..nn}`
- Fallback variants add `-fb` suffix

## Step Schema Notes
- `step-schemas/step-04.json` requires: design (.md), pattern_catalog (.md note: schema says .md but we used .yaml), design_ko (.ko.md)
- Verification fields: katago_fields_mapped, beginner/intermediate/advanced_patterns (min 20 each), high_risk_fallback_defined, llm_translator_principle, coverage_methodology
