# Review Architecture & Planning Phase Outputs

Display all Planning Phase outputs (Steps 6-8) for architecture and plan approval (Step 9).

## Protocol

1. Read the SOT file `.claude/state.yaml` to verify Steps 6-8 are complete.
2. For each completed step, display:
   - **Step N**: Output path, pACS score, review verdict
   - Architecture decisions summary
3. Key validation checks:
   - Module dependency DAG has no cycles (Step 6)
   - All module interfaces defined (Step 7)
   - Test strategy covers all modules (Step 8)
   - Branch strategy defined for parallel teams (Step 8)
4. Present decision options:
   - **APPROVE**: Architecture and plans ready → proceed to M1 Implementation (Step 10)
   - **REVISE**: Specify which step(s) need rework
   - **PIVOT**: Architecture redesign needed

## Autopilot Behavior
If all Step 6-8 pACS scores ≥ 70 (GREEN) and architecture DAG has no cycles, auto-approve and log to `autopilot-logs/step-09-decision.md`.

## Files to Review
- `outputs/step-06-architecture-design.md` — Modular monolith architecture
- `outputs/step-07-data-model.md` — Data model documentation
- `outputs/step-07-schema.ts` — Drizzle ORM schema
- `outputs/step-07-interfaces.ts` — Module interface contracts
- `outputs/step-08-test-strategy.md` — Test strategy
- `outputs/step-08-parallel-plan.md` — Parallel execution plan
