# Review Research Phase Outputs

Display all Research Phase outputs (Steps 1-4) for human review and direction approval (Step 5).

## Protocol

1. Read the SOT file `.claude/state.yaml` to verify Steps 1-4 are complete.
2. For each completed step, display:
   - **Step N**: Output path, pACS score, review verdict
   - Key findings summary (read first 50 lines of each output)
3. Display aggregate quality metrics:
   - All pACS scores with GREEN/YELLOW/RED classification
   - Any review FAIL verdicts requiring attention
   - Cross-step dependency validation (Step 2→4, Step 3→4)
4. Present decision options:
   - **APPROVE**: All research meets quality bar → proceed to Planning (Step 6)
   - **REVISE**: Specify which step(s) need rework → re-run those steps
   - **PIVOT**: Fundamental direction change needed → update workflow

## Autopilot Behavior
If all Step 1-4 pACS scores ≥ 70 (GREEN), auto-approve and log decision to `autopilot-logs/step-05-decision.md`.

## Files to Review
- `outputs/step-01-tech-validation-report.md` — Technology PoC results
- `outputs/step-02-katago-ipc-spec.md` — KataGo IPC protocol spec
- `outputs/step-03-domain-knowledge.yaml` — Baduk DKS
- `outputs/step-03-rules-spec.md` — Tromp-Taylor rules specification
- `outputs/step-04-template-engine-design.md` — Template engine architecture
- `outputs/step-04-pattern-catalog.yaml` — Explanation pattern catalog
