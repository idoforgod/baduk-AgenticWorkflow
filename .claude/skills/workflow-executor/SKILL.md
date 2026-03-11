# Workflow Executor — Baduk Platform Orchestrator

> **Purpose**: Execute the 25-step Baduk Platform workflow defined in `prompt/workflow.md`.
> This skill is the single orchestrator that manages the entire pipeline.

## Activation

This skill activates when the user requests workflow execution:
- "워크플로우 실행해줘" / "Execute the workflow"
- "Step N 실행" / "Run step N"
- "다음 단계" / "Next step"
- Resuming from a previous session via SOT state

## Absolute Rules

1. **SOT is the single source of truth**: Read `.claude/state.yaml` before EVERY action. Write to SOT after EVERY step completion.
2. **Quality gates are non-negotiable**: No step advances without L0 + pACS + Review (where required) + Translation (where required).
3. **English-first execution**: All agent work in English. Korean translations produced by @translator AFTER step completion.
4. **Orchestrator never generates step content**: Dispatch to specialized sub-agents. Orchestrator only coordinates, validates, and records.
5. **Inherited DNA**: This orchestrator is a direct expression of AgenticWorkflow's Orchestrator gene. SOT pattern, 4-layer QA, adversarial review, and cross-step traceability are inherited, not optional.

## 14-Step Orchestration Protocol (Per Step)

Execute these 14 steps for EVERY workflow step:

### Phase A: Preparation (Steps 1-4)
1. **SOT Read**: Read `.claude/state.yaml` → get `current_step`, `status`, `outputs`
2. **Step Load**: Run `python3 .claude/hooks/scripts/query_step.py --step N` → get deterministic step metadata (agent, type, deps, outputs, pre/post-processing). This is the P1 truth source for **structural metadata** — do NOT parse workflow.md for step type, dependencies, or output paths. However, the **full task description** (agent instructions) must still be read from workflow.md's corresponding step section.
3. **Dependency Check**: Run `python3 .claude/hooks/scripts/query_step.py --step N --check-deps --project-dir .` → verify all upstream outputs exist on disk (file check + SOT completion check for team/impl steps).
4. **Pre-processing**: Run any `pre_processing` scripts returned by query_step.py (e.g., `scripts/extract_prd_tech_stack.py`)

### Phase B: Execution (Steps 5-7)
5. **Agent Dispatch** (use `type` field from query_step.py):
   - `type: "agent"` → spawn sub-agent via Agent tool with `subagent_type` matching the step's `agent` field
   - `type: "team"` → use TeamCreate with `team` name and `teammates` list from query_step.py
   - `type: "human"` → present options to user, wait for decision
6. **Output Collection**: Collect agent output files from the `outputs` map returned by query_step.py
7. **Post-processing**: Run any `post_processing` scripts returned by query_step.py

### Phase C: Quality Assurance (Steps 8-12)
8. **L0 Anti-Skip Guard**: Verify output file exists AND size ≥ 100 bytes
9. **L1 Verification**: Check step-specific verification criteria (from workflow.md)
10. **L1.5 pACS Self-Rating**: Agent writes pACS score (F/C/L). Record to `pacs-logs/step-NN-pacs.md`
11. **L2 Adversarial Review**: Spawn @reviewer (or @fact-checker where specified). Write to `review-logs/step-NN-review.md`
12. **Translation**: Spawn @translator for steps with Translation defined. Output to `outputs/step-NN-*.ko.md`

### Phase D: State Update (Steps 13-14)
13. **SOT Write**: Update `.claude/state.yaml`:
    - Set `outputs.step-N: "path/to/output"`
    - Set `pacs.current_step_score`, `pacs.dimensions`, `pacs.history.step-N`
    - Advance `current_step` to N+1
    - Update `verification.last_verified_step`
14. **Decision Log**: Write autopilot decision to `autopilot-logs/step-NN-decision.md` (if auto-approved)

## Step Type Handlers

### Sequential Agent Steps (1, 2, 3, 4, 6, 7, 8, 12, 13, 15, 18, 19, 20, 21, 24)
```
Agent(subagent_type="{agent-name}", prompt="{task from workflow.md}", isolation="worktree")
```
- Spawn sub-agent with worktree isolation for clean context
- Provide step-specific instructions from workflow.md
- Collect output files after completion

### Team Steps (10, 11, 17, 23)
```
TeamCreate(name="{team-name}", description="{team description}")
```
- Create Agent Team with teammates defined in workflow.md
- Team Lead manages SOT `active_team` during execution
- After all teammates complete, Team Lead merges and verifies
- Write `active_team` → `completed_teams` on completion

### Human Gate Steps (5, 9, 14, 16, 22, 25)
- Display relevant outputs for review
- Present decision options (APPROVE/REVISE/PIVOT or GO/NO-GO)
- For Autopilot mode: auto-approve if pACS ≥ 70 (except manual gates 16, 22, 25)
- Log decision to `autopilot-logs/`

## Error Handling

| Error Type | Action |
|-----------|--------|
| Agent failure | Retry with feedback (max 3 attempts) |
| Validation failure | Retry with specific error context (max 3) |
| Hook failure | Log and continue |
| Context overflow | Save context, resume from SOT |
| Teammate failure | Retry → upgrade model → human escalation |

## SOT Schema Quick Reference

```yaml
workflow:
  current_step: N        # Next step to execute
  status: "in_progress"  # not_started | in_progress | completed | blocked
  outputs:
    step-N: "path"       # Output file paths
    step-N-ko: "path"    # Korean translation paths
  active_team:           # During team execution only
    name: "team-name"
    status: "partial"
    tasks_completed: []
    tasks_pending: []
  completed_teams: []
  pacs:
    current_step_score: N
    dimensions: {F: N, C: N, L: N}
    history:
      step-N: {F: N, C: N, L: N, score: N}
```

## NEVER DO

- NEVER generate step content yourself — always dispatch to specialized agents
- NEVER skip quality gates — L0 + pACS are minimum for every step
- NEVER advance SOT current_step without completing all gates
- NEVER modify agent output files — agents own their outputs
- NEVER run team steps as sequential steps or vice versa
- NEVER auto-approve Go/No-Go gates (steps 16, 22, 25)
