# Quality Gates Reference — Per Step

## 4-Layer Quality Assurance

### L0: Anti-Skip Guard
- Output file exists at the defined path
- File size ≥ 100 bytes
- Automated check, no agent involvement

### L1: Verification Gate
- Step-specific verification criteria from workflow.md
- Each checkbox item is independently verifiable
- P1 validation scripts provide deterministic checks where possible

### L1.5: pACS Self-Rating
- Generator agent scores own output: F (Fidelity), C (Completeness), L (Logical Coherence)
- Pre-mortem protocol BEFORE scoring (3 questions)
- Score = min(F, C, L)
- GREEN (≥70): proceed | YELLOW (50-69): proceed with flag | RED (<50): rework

### L2: Adversarial Review
- Independent reviewer scores the output
- Pre-mortem + minimum 1 issue requirement
- Delta check: |Reviewer pACS - Generator pACS| ≥ 15 → reconciliation
- FAIL verdict (Critical issues) → rework required

## Translation Quality Gate
- @translator produces EN→KO translation
- Translation pACS: Ft (Fidelity), Ct (Completeness), Nt (Naturalness)
- Glossary consistency enforced via translations/glossary.yaml

## P1 Validation Scripts
| Script | What It Validates |
|--------|-------------------|
| verify_gate_passage.py | SOT advancement blocked without gates |
| validate_counts.py | Entity/test/pattern count thresholds |
| validate_test_results.py | Vitest JSON output parsing |
| validate_spec_schema.py | IPC spec and interface completeness |
| validate_fallback_enforcement.py | No freeform text for life/death/ko/seki |
| validate_step_output.py | Step output JSON schema conformance |
