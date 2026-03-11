# Go/No-Go Gate Evaluation

Evaluate milestone Go/No-Go criteria. Usage: `/go-no-go M1`, `/go-no-go M2`, `/go-no-go M3`

## Protocol

1. Parse argument to determine milestone: $ARGUMENTS (M1, M2, or M3)
2. Read SOT to verify all prerequisite steps are complete.
3. Evaluate milestone-specific criteria:

### M1 Criteria (Step 16)
- [ ] Template explanation coverage ≥ 80%
- [ ] Core engine complete: rules-engine + katago-bridge + data-layer + explanation-engine
- [ ] Tauri build succeeds on macOS, Windows, Linux
- [ ] SonarQube SQALE ≤ 5% (technical debt)
- [ ] Rules engine: 130+ tests passing
- [ ] All M1 pACS scores ≥ 70

### M2 Criteria (Step 22)
- [ ] Beta available on 3 OS (GitHub Releases)
- [ ] Quick Go MVP functional (complete game flow)
- [ ] All E2E tests pass (10+ scenarios)
- [ ] Performance targets met (KataGo <2s, UI 60fps, memory <400MB)
- [ ] Security audit clean
- [ ] Beta testers recruited (Reddit r/baduk, Discord)

### M3 Criteria (Step 25)
- [ ] All features (F1-F7) functional
- [ ] Code signing complete (macOS notarization)
- [ ] All E2E tests pass on 3 OS
- [ ] Performance targets met
- [ ] Release notes and landing page ready
- [ ] DAU ≥ 100 AND D7 retention ≥ 25%

4. Display checklist with PASS/FAIL per criterion.
5. **MANDATORY MANUAL DECISION** — Go/No-Go gates are NEVER auto-approved.
6. Options:
   - **GO**: Proceed to next milestone
   - **NO-GO**: Specify blockers and remediation plan
   - **PIVOT**: Scope reduction or redesign

Log decision to `autopilot-logs/step-{N}-decision.md` regardless of outcome.
