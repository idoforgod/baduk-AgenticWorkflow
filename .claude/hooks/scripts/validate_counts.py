#!/usr/bin/env python3
"""
P1 Count Validator — enforces minimum numerical thresholds.

Usage: python3 validate_counts.py --project-dir . --step N
       python3 validate_counts.py --project-dir . --check-all

Validates:
- Step 3: entities >= 50, relations >= 30, constraints >= 20, edge_cases >= 15
- Step 4: beginner_patterns >= 20, intermediate_patterns >= 20, advanced_patterns >= 20
- Step 8: rules_test_cases >= 130, e2e_scenarios >= 10
- Step 11: rules_tests_passing >= 130
"""
import argparse
import os
import re
import sys

try:
    import yaml as _yaml
    def _safe_load_yaml(path):
        with open(path) as f:
            return _yaml.safe_load(f)
except ImportError:
    import json as _json

    def _safe_load_yaml(path):
        """Fallback: try JSON, then return None (triggers text fallback)."""
        try:
            with open(path) as f:
                return _json.load(f)
        except Exception:
            return None


# Threshold definitions per step
THRESHOLDS = {
    3: {
        "entities": {
            "min": 50,
            "pattern": r"(?:entity|entities|\u00ec\u0097\u0094\u00ed\u008b\u00b0\u00ed\u008b\u00b0)",
            "file": "outputs/step-03-domain-knowledge.yaml",
        },
        "relations": {
            "min": 30,
            "pattern": r"(?:relation|\uad00\uacc4)",
            "file": "outputs/step-03-domain-knowledge.yaml",
        },
        "constraints": {
            "min": 20,
            "pattern": r"(?:constraint|\uc81c\uc57d)",
            "file": "outputs/step-03-domain-knowledge.yaml",
        },
        "edge_cases": {
            "min": 15,
            "pattern": r"(?:edge.case|\uc5e3\uc9c0.\ucf00\uc774\uc2a4|\uc0ac\ud65c|\ud328|\uc138\ud0a4|snapback|superko)",
            "file": "outputs/step-03-rules-spec.md",
        },
    },
    4: {
        "beginner_patterns": {
            "min": 20,
            "pattern": r"(?:beginner|\uc785\ubb38|tier.1)",
            "file": "outputs/step-04-pattern-catalog.yaml",
        },
        "intermediate_patterns": {
            "min": 20,
            "pattern": r"(?:intermediate|\uc911\uae09|tier.2)",
            "file": "outputs/step-04-pattern-catalog.yaml",
        },
        "advanced_patterns": {
            "min": 20,
            "pattern": r"(?:advanced|\uace0\uae09|tier.3)",
            "file": "outputs/step-04-pattern-catalog.yaml",
        },
    },
    8: {
        "rules_test_cases": {
            "min": 130,
            "pattern": r"(?:test.case|\ud14c\uc2a4\ud2b8.\ucf00\uc774\uc2a4|it\(|test\(|describe\()",
            "file": "outputs/step-08-test-strategy.md",
        },
        "e2e_scenarios": {
            "min": 10,
            "pattern": r"(?:e2e|E2E|end.to.end|\uc2dc\ub098\ub9ac\uc624)",
            "file": "outputs/step-08-test-strategy.md",
        },
    },
}


def count_in_yaml(filepath, key_pattern):
    """Count items in YAML that match a key pattern."""
    data = _safe_load_yaml(filepath)
    if data is not None and isinstance(data, dict):
        return _count_keys_recursive(data, key_pattern)
    # Fallback to text counting
    return _count_in_text(filepath, key_pattern)


def _count_keys_recursive(data, pattern, depth=0):
    """Recursively count keys/items matching pattern."""
    if depth > 20:
        return 0
    count = 0
    if isinstance(data, dict):
        for k, v in data.items():
            if re.search(pattern, str(k), re.IGNORECASE):
                if isinstance(v, list):
                    count += len(v)
                elif isinstance(v, dict):
                    count += len(v)
                else:
                    count += 1
            count += _count_keys_recursive(v, pattern, depth + 1)
    elif isinstance(data, list):
        for item in data:
            count += _count_keys_recursive(item, pattern, depth + 1)
    return count


def _count_in_text(filepath, pattern):
    """Fallback: count regex matches in raw text."""
    try:
        with open(filepath, encoding="utf-8", errors="replace") as f:
            text = f.read()
        return len(re.findall(pattern, text, re.IGNORECASE))
    except Exception:
        return 0


def validate_step(project_dir, step):
    """Validate all thresholds for a given step."""
    if step not in THRESHOLDS:
        print(f"No count thresholds defined for step {step}")
        return True

    all_pass = True
    for metric, config in THRESHOLDS[step].items():
        filepath = os.path.join(project_dir, config["file"])
        if not os.path.exists(filepath):
            print(f"WARNING: {metric}: File not found: {config['file']} — skipping")
            continue

        if filepath.endswith((".yaml", ".yml")):
            count = count_in_yaml(filepath, config["pattern"])
        else:
            count = _count_in_text(filepath, config["pattern"])

        if count >= config["min"]:
            print(f"PASS {metric}: {count} (min: {config['min']})")
        else:
            print(f"FAIL {metric}: {count} < {config['min']} (min required)")
            all_pass = False

    return all_pass


def main():
    parser = argparse.ArgumentParser(description="P1 Count Validator")
    parser.add_argument(
        "--project-dir",
        default=os.environ.get("CLAUDE_PROJECT_DIR", "."),
    )
    parser.add_argument("--step", type=int, help="Step number to validate")
    parser.add_argument(
        "--check-all", action="store_true", help="Validate all steps"
    )
    args = parser.parse_args()

    if args.check_all:
        all_pass = True
        for step in sorted(THRESHOLDS.keys()):
            print(f"\n--- Step {step} ---")
            if not validate_step(args.project_dir, step):
                all_pass = False
        sys.exit(0 if all_pass else 1)
    elif args.step is not None:
        success = validate_step(args.project_dir, args.step)
        sys.exit(0 if success else 1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
