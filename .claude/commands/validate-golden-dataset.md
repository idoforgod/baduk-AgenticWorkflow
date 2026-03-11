# Validate Golden Dataset

Run golden dataset validation on the template explanation engine output (Step 14).

## Protocol

1. Read the SOT to verify Step 13 (Template Engine V1) is complete.
2. Run pre-processing: `python3 scripts/generate_template_outputs.py`
   - Generates template engine output for 200 golden positions
3. Validate coverage:
   - Count positions with meaningful explanations (target: ≥ 80%)
   - Classify by tier: beginner (50), intermediate (80), advanced (50), high-risk (20)
4. Validate high-risk fallback:
   - All 20 life/death, ko, seki positions MUST use template fallback
   - Zero freeform text generation for these positions
5. Validate tier quality:
   - Beginner: no Go terminology used
   - Intermediate: basic terms only (atari, liberty, territory)
   - Advanced: professional analysis vocabulary
6. Display results with PASS/FAIL per category.
7. Present decision:
   - **APPROVE**: Coverage ≥ 80% AND high-risk fallback 100% → proceed to Step 15
   - **REVISE**: Re-run Step 13 with specific feedback

## Autopilot Behavior
Auto-approve if coverage ≥ 80% AND high-risk fallback 100% AND no factual errors. Log to `autopilot-logs/step-14-decision.md`.
