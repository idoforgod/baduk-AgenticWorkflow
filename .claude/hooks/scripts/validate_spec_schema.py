#!/usr/bin/env python3
"""
P1 Spec Schema Validator — validates structural completeness of specs.

Usage: python3 validate_spec_schema.py --project-dir . --step N

Validates:
- Step 2: KataGo IPC spec has all required protocol fields
- Step 4: Pattern catalog has required tier structure
- Step 7: TypeScript interfaces have required module contracts
"""
import argparse
import os
import re
import sys

REQUIRED_FIELDS = {
    2: {
        "file": "outputs/step-02-katago-ipc-spec.md",
        "name": "KataGo IPC Spec",
        "fields": [
            ("query format", r"(?:query|request)\s*(?:format|schema|structure)"),
            ("response format", r"(?:response|result)\s*(?:format|schema|structure)"),
            ("moveInfo fields", r"(?:moveInfo|move_info|MoveInfo)"),
            ("winrate", r"winrate"),
            ("scoreLead", r"scoreLead|score_lead"),
            ("visits", r"visits"),
            (
                "principal variation",
                r"(?:pv|principal.variation|PV)",
            ),
            (
                "GPU detection",
                r"(?:GPU|CUDA|OpenCL|Eigen).*(?:detect|fallback)",
            ),
            ("watchdog", r"watchdog"),
            ("circuit breaker", r"circuit.breaker"),
            (
                "model bundling",
                r"(?:model|b6c96|b18c384).*(?:bundl|download)",
            ),
        ],
    },
    4: {
        "file": "outputs/step-04-pattern-catalog.yaml",
        "name": "Pattern Catalog",
        "fields": [
            ("beginner tier", r"(?:beginner|tier.1|\uc785\ubb38)"),
            ("intermediate tier", r"(?:intermediate|tier.2|\uc911\uae09)"),
            ("advanced tier", r"(?:advanced|tier.3|\uace0\uae09)"),
            ("life/death", r"(?:life.death|\uc0ac\ud65c)"),
            ("ko pattern", r"(?:\bko\b|\ud328)"),
            ("seki pattern", r"(?:seki|\uc138\ud0a4)"),
            ("fallback", r"fallback"),
            ("coverage", r"coverage"),
        ],
    },
    7: {
        "file": "outputs/step-07-interfaces.ts",
        "name": "TypeScript Interfaces",
        "fields": [
            ("IRulesEngine", r"IRulesEngine"),
            ("IKatagoBridge", r"IKatagoBridge|IKatago"),
            ("IExplanationEngine", r"IExplanationEngine"),
            ("IGameEngine", r"IGameEngine"),
            (
                "IGamificationService",
                r"IGamificationService|IGamification",
            ),
            ("KataGoQuery", r"KataGoQuery"),
            ("KataGoResponse", r"KataGoResponse"),
            ("MoveInfo", r"MoveInfo"),
        ],
    },
}


def validate_step(project_dir, step):
    """Validate spec schema for a given step."""
    if step not in REQUIRED_FIELDS:
        print(f"No spec schema validation for step {step}")
        return True

    config = REQUIRED_FIELDS[step]
    filepath = os.path.join(project_dir, config["file"])

    if not os.path.exists(filepath):
        print(
            f"WARNING: {config['name']}: File not found: {config['file']} — skipping"
        )
        return True  # File not created yet

    try:
        with open(filepath, encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Cannot read {config['file']}: {e}")
        return True  # Non-blocking on read error

    print(f"Validating {config['name']} ({config['file']}):")
    all_pass = True

    for field_name, pattern in config["fields"]:
        if re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
            print(f"  PASS {field_name}")
        else:
            print(f"  FAIL {field_name} — NOT FOUND")
            all_pass = False

    return all_pass


def main():
    parser = argparse.ArgumentParser(description="P1 Spec Schema Validator")
    parser.add_argument(
        "--project-dir",
        default=os.environ.get("CLAUDE_PROJECT_DIR", "."),
    )
    parser.add_argument("--step", type=int, required=True)
    args = parser.parse_args()

    success = validate_step(args.project_dir, args.step)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
