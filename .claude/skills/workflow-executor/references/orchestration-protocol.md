# Orchestration Protocol — Detailed Reference

## Step Execution Matrix

| Step | Phase | Type | Agent/Team | Pre-processing | Post-processing | Review | Translation |
|------|-------|------|-----------|----------------|-----------------|--------|-------------|
| 1 | Research | agent | @tech-validator | extract_prd_tech_stack.py | — | @fact-checker | @translator |
| 2 | Research | agent | @katago-researcher | — | — | @fact-checker | @translator |
| 3 | Research | agent | @domain-expert | — | validate_domain_knowledge.py | @fact-checker | @translator |
| 4 | Research | agent | @template-designer | collect_katago_samples.py | — | @reviewer + @fact-checker | @translator |
| 5 | Research | human | — | — | — | — | — |
| 6 | Planning | agent | @architect | merge_research_outputs.py | validate_traceability.py | @reviewer | @translator |
| 7 | Planning | agent | @schema-designer | extract_entities_from_dks.py | — | @reviewer | @translator |
| 8 | Planning | agent | @strategy-planner | — | — | — | @translator |
| 9 | Planning | human | — | — | — | — | — |
| 10 | M1 | team | m1-scaffold | — | — | @reviewer | — |
| 11 | M1 | team | m1-core | — | — | @reviewer | — |
| 12 | M1 | agent+human | @katago-integrator | — | — | @reviewer | — |
| 13 | M1 | agent | @template-engineer | prepare_katago_test_data.py | — | @reviewer + @fact-checker | — |
| 14 | M1 | human | — | generate_template_outputs.py | — | — | — |
| 15 | M1 | agent | @integration-tester | — | validate_traceability.py | @reviewer | — |
| 16 | M1 | human | — | — | — | — | — |
| 17 | M2 | team | m2-ui | — | — | @reviewer | — |
| 18 | M2 | agent | @game-developer | — | — | @reviewer | — |
| 19 | M2 | agent | @devops-engineer | — | — | @reviewer | — |
| 20 | M2 | agent | @integration-developer | — | — | — | — |
| 21 | M2 | agent | @qa-engineer | — | — | @reviewer | — |
| 22 | M2 | human | — | — | — | — | — |
| 23 | M3 | team | m3-features | — | — | @reviewer | — |
| 24 | M3 | agent | @release-engineer | — | — | @reviewer | @translator |
| 25 | M3 | human | — | — | — | — | — |

## Pipeline Dependencies

```
Step 1 ──────────────────────────────────────→ Step 6 (tech constraints)
Step 2 ──→ Step 4 (KataGo fields) ──────────→ Step 12 (IPC spec)
Step 3 ──→ Step 4 (edge cases) ─────────────→ Step 11 (rules spec)
                                               Step 7 (entity extraction)
                                               Step 13 (DKS for templates)
Step 4 ──────────────────────────────────────→ Step 13 (pattern catalog)
Steps 1-4 ──→ Step 6 (merged research) ────→ Steps 7, 8
Step 7 ──────────────────────────────────────→ Steps 10, 11 (interfaces)
Step 8 ──────────────────────────────────────→ Steps 10, 11 (test/branch plan)
Steps 10-11 ─────────────────────────────────→ Step 12 (foundation)
Step 12 ─────────────────────────────────────→ Step 13 (KataGo bridge)
Steps 11-13 ─────────────────────────────────→ Step 15 (integration)
Step 17 ─────────────────────────────────────→ Step 18 (UI components)
Steps 15, 18-20 ─────────────────────────────→ Step 21 (full testing)
Steps 21, 23 ────────────────────────────────→ Step 24 (release)
```

## Agent Team Configuration

### m1-scaffold (Step 10)
```yaml
name: m1-scaffold
teammates:
  - name: scaffold-frontend
    prompt: "Set up Vite + React 19 + TypeScript strict + Tailwind CSS 4 + shadcn/ui + Zustand + Biome v2.3 + Vitest. Create project structure matching Step 6 module boundaries. Configure path aliases, Vitest config. Set up SonarQube Community."
  - name: scaffold-backend
    prompt: "Set up Tauri 2.0 with Rust sidecar configuration. Configure SQLite (better-sqlite3, WAL mode) + Drizzle ORM with Step 7 schema. Set up KataGo sidecar binary path configuration."
join_verification: "npm run tauri build succeeds"
```

### m1-core (Step 11)
```yaml
name: m1-core
teammates:
  - name: rules-engineer
    prompt: "Implement Tromp-Taylor rules engine in TypeScript. 1D Uint8Array board. Zobrist hashing. Incremental: Place→Capture→Ko→Scoring→Superko. 130+ tests. Reference: outputs/step-03-rules-spec.md"
  - name: data-engineer
    prompt: "Implement SQLite data layer + GameReducer. Drizzle ORM from Step 7 schema. GameReducer with Zustand. Append-only move log. SGF export. Reference: outputs/step-07-schema.ts"
join_verification: "Combined test suite passes, no interface conflicts"
```

### m2-ui (Step 17)
```yaml
name: m2-ui
teammates:
  - name: board-developer
    prompt: "Go board SVG UI. Fork Shudan. 20 components. KaTrain colors. 9×9/13×13/19×19. Tap-Preview-Confirm. Pinch-zoom."
  - name: screen-developer
    prompt: "Application screens: Home, Game, Analysis, Settings, QuickGo, Onboarding. React Router + Zustand. Responsive + dark/light."
  - name: i18n-developer
    prompt: "react-i18next with en/ko/ja. Extract all UI strings. Language detection and switching."
join_verification: "All UI modules render, navigation works, i18n switches"
```

### m3-features (Step 23)
```yaml
name: m3-features
teammates:
  - name: onboarding-developer
    prompt: "Zero-to-First-Game onboarding. Interactive tutorial: rules → place stone → capture → Quick Go → AI explanation. 5 minutes, 70%+ completion. Anonymous-first."
  - name: gamification-developer
    prompt: "Daily quests, XP/level, streaks, badges. Store in local SQLite."
  - name: optimization-engineer
    prompt: "Bundle size optimization, KataGo startup optimization, SQLite WAL tuning, React rendering optimization."
join_verification: "Full regression passes, app size <100MB"
```

## Autopilot Decision Template

```markdown
# Autopilot Decision — Step {N}

**Date**: {YYYY-MM-DD}
**Step**: {N} — {Step Name}
**Type**: {auto-approve | manual | escalation}

## pACS Score
- F: {score} | C: {score} | L: {score}
- Overall: {min score} → {GREEN|YELLOW|RED}

## Review Verdict
- Reviewer: {agent}
- Verdict: {PASS|FAIL}
- Issues: {count} ({critical}/{warning}/{suggestion})

## Decision
- **{APPROVE|REVISE|GO|NO-GO}**
- Rationale: {reason}
- Threshold: pACS ≥ 70 (auto-approve)
```
