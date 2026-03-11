#!/usr/bin/env python3
"""
P1 Gate Passage Verifier — blocks SOT step advancement without quality gates.

PreToolUse hook for Edit|Write. Checks if the edit targets state.yaml,
and if so, verifies that quality gates were passed before advancing current_step.
Blocks the edit (exit 2) if gates are not satisfied.

Quality gates checked:
- L0: Output file exists and >= 100 bytes
- pACS: pacs-logs/step-N-pacs.md exists
- Review: review-logs/step-N-review.md exists (for steps with Review: defined)
- Translation: outputs/step-N-*.ko.md exists (for steps with Translation: defined)
"""
import json
import sys
import os
import re
import glob

try:
    import yaml as _yaml
    def _load_yaml(path):
        with open(path) as f:
            return _yaml.safe_load(f)
except ImportError:
    def _load_yaml(path):
        """Minimal YAML parser for state.yaml (flat key-value + simple nesting)."""
        with open(path) as f:
            text = f.read()
        return _parse_yaml_text(text)


def _parse_yaml_text(text):
    """Best-effort YAML parser using only stdlib."""
    result = {}
    current_section = None
    current_subsection = None

    for line in text.split('\n'):
        stripped = line.rstrip()
        if not stripped or stripped.startswith('#'):
            continue

        indent = len(line) - len(line.lstrip())

        # Top-level key
        if indent == 0 and ':' in stripped:
            key, _, val = stripped.partition(':')
            key = key.strip()
            val = val.strip()
            if val:
                result[key] = _coerce(val)
                current_section = None
            else:
                result[key] = {}
                current_section = key
                current_subsection = None
        elif indent > 0 and current_section and ':' in stripped:
            key, _, val = stripped.partition(':')
            key = key.strip()
            val = val.strip()

            if indent <= 4:
                if val:
                    result[current_section][key] = _coerce(val)
                    current_subsection = None
                else:
                    result[current_section][key] = {}
                    current_subsection = key
            elif current_subsection and indent > 4:
                if val:
                    result[current_section][current_subsection][key] = _coerce(val)

    return result


def _coerce(val):
    """Coerce string value to int/bool/None/list/dict if appropriate."""
    if val in ('true', 'True'):
        return True
    if val in ('false', 'False'):
        return False
    if val in ('null', 'None', '~'):
        return None
    # Inline empty dict: {}
    if val == '{}':
        return {}
    # Inline list: [16, 22, 25]
    if val.startswith('[') and val.endswith(']'):
        inner = val[1:-1].strip()
        if not inner:
            return []
        return [_coerce(item.strip()) for item in inner.split(',')]
    # Inline dict: { F: null, C: null }
    if val.startswith('{') and val.endswith('}'):
        inner = val[1:-1].strip()
        if not inner:
            return {}
        result = {}
        for pair in inner.split(','):
            if ':' in pair:
                k, _, v = pair.partition(':')
                result[k.strip()] = _coerce(v.strip())
        return result
    try:
        return int(val)
    except ValueError:
        pass
    try:
        return float(val)
    except ValueError:
        pass
    # Strip quotes
    if (val.startswith('"') and val.endswith('"')) or \
       (val.startswith("'") and val.endswith("'")):
        return val[1:-1]
    return val


def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, Exception):
        sys.exit(0)  # Can't parse — allow

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    # Only check state.yaml modifications
    if "state.yaml" not in file_path:
        sys.exit(0)

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    sot_path = os.path.join(project_dir, ".claude", "state.yaml")

    if not os.path.exists(sot_path):
        sys.exit(0)  # SOT doesn't exist yet — allow creation

    try:
        sot = _load_yaml(sot_path)
    except Exception:
        sys.exit(0)  # Can't read SOT — allow

    if not isinstance(sot, dict):
        sys.exit(0)

    workflow = sot.get("workflow", {})
    if not isinstance(workflow, dict):
        sys.exit(0)

    current_step = workflow.get("current_step", 0)
    if not isinstance(current_step, int):
        try:
            current_step = int(current_step)
        except (ValueError, TypeError):
            sys.exit(0)

    # Check if this edit advances current_step
    new_string = tool_input.get("new_string", "")
    step_match = re.search(r'current_step:\s*(\d+)', new_string)
    if not step_match:
        sys.exit(0)  # Not changing current_step

    new_step = int(step_match.group(1))
    if new_step <= current_step:
        sys.exit(0)  # Not advancing

    # Advancing step — check gates for the step being completed (current_step)
    prev_step = current_step
    if prev_step == 0:
        sys.exit(0)  # Initial setup

    # Human gate steps don't need automated gates
    human_gates = {5, 9, 14, 16, 22, 25}
    if prev_step in human_gates:
        sys.exit(0)

    # Team steps — gate checks are done by Team Lead
    team_steps = {10, 11, 17, 23}
    if prev_step in team_steps:
        sys.exit(0)

    errors = []

    # L0: Check output exists
    outputs = workflow.get("outputs", {})
    if not isinstance(outputs, dict):
        outputs = {}

    step_key = f"step-{prev_step}"
    if step_key not in outputs:
        errors.append(f"L0 FAIL: No output recorded for {step_key} in SOT")
    else:
        output_val = outputs[step_key]
        if isinstance(output_val, str):
            output_path = os.path.join(project_dir, output_val)
            if os.path.exists(output_path):
                size = os.path.getsize(output_path)
                if size < 100:
                    errors.append(
                        f"L0 FAIL: Output {output_val} is only {size} bytes (min: 100)"
                    )
            else:
                errors.append(f"L0 FAIL: Output file {output_val} does not exist")

    # pACS: Check pACS log exists (try both padded and non-padded names)
    pacs_log = os.path.join(
        project_dir, "pacs-logs", f"step-{prev_step}-pacs.md"
    )
    pacs_log_padded = os.path.join(
        project_dir, "pacs-logs", f"step-{prev_step:02d}-pacs.md"
    )
    if not os.path.exists(pacs_log) and not os.path.exists(pacs_log_padded):
        errors.append(f"pACS FAIL: pacs-logs/step-{prev_step}-pacs.md not found")

    # Review: Check review log exists (steps with review defined)
    review_steps = {1, 2, 3, 4, 6, 7, 10, 11, 12, 13, 15, 17, 18, 19, 21, 23, 24}
    if prev_step in review_steps:
        review_log = os.path.join(
            project_dir, "review-logs", f"step-{prev_step}-review.md"
        )
        review_log_padded = os.path.join(
            project_dir, "review-logs", f"step-{prev_step:02d}-review.md"
        )
        if not os.path.exists(review_log) and not os.path.exists(review_log_padded):
            errors.append(
                f"Review FAIL: review-logs/step-{prev_step}-review.md not found"
            )

    # Translation: Check translation exists (steps with translation)
    translation_steps = {1, 2, 3, 4, 6, 7, 8, 24}
    if prev_step in translation_steps:
        ko_found = False
        for key, val in outputs.items():
            if key.endswith("-ko") and key.startswith(f"step-{prev_step}"):
                if isinstance(val, str):
                    ko_path = os.path.join(project_dir, val)
                    if os.path.exists(ko_path):
                        ko_found = True
                        break
        if not ko_found:
            # Also check for .ko.md files in outputs/ (both padded and non-padded)
            ko_pattern = os.path.join(
                project_dir, "outputs", f"step-{prev_step:02d}-*.ko.md"
            )
            ko_files = glob.glob(ko_pattern)
            if not ko_files:
                ko_pattern2 = os.path.join(
                    project_dir, "outputs", f"step-{prev_step}-*.ko.md"
                )
                ko_files = glob.glob(ko_pattern2)
            if not ko_files:
                errors.append(
                    f"Translation FAIL: No .ko.md file found for step {prev_step}"
                )

    if errors:
        print(f"GATE PASSAGE BLOCKED — Step {prev_step} -> Step {new_step}")
        for e in errors:
            print(f"  - {e}")
        print("\nComplete all quality gates before advancing current_step.")
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
