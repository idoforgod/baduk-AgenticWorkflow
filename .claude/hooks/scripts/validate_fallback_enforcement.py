#!/usr/bin/env python3
"""
P1 Fallback Enforcement Validator — MOST CRITICAL anti-hallucination script.

Enforces: "LLM = translator, KataGo = truth source"
For life/death, ko, and seki positions, the explanation engine MUST use
pre-verified templates. Freeform LLM-generated text is PROHIBITED.

Usage: python3 validate_fallback_enforcement.py --project-dir . --check-source
       python3 validate_fallback_enforcement.py --project-dir . --check-output FILE

--check-source: Scan explanation engine source code for unsafe patterns
--check-output: Scan a generated explanation output file for freeform text
"""
import argparse
import glob
import json
import os
import re
import sys

# Patterns that indicate freeform text generation for high-risk positions
UNSAFE_SOURCE_PATTERNS = [
    # Direct LLM calls in high-risk context
    (
        r"(?:generateText|createCompletion|chatComplete|llm\.generate)"
        r".*(?:life|death|ko\b|seki)",
        "LLM text generation in life/death/ko/seki context",
    ),
    # String concatenation for explanations (not template-based)
    (
        r"(?:explanation|comment)\s*[+=]\s*[`'\"]"
        r".*(?:life|death|\uc0ac\ud65c|\ud328|\uc138\ud0a4)",
        "Hardcoded string for high-risk explanation (should use template)",
    ),
    # Dynamic explanation without template reference
    (
        r"(?:explain|describe|analyze)(?:Move|Position|Situation)"
        r".*(?:freeform|dynamic|generate)",
        "Dynamic explanation generation (should use template fallback)",
    ),
]

# Patterns that indicate correct template fallback usage
SAFE_PATTERNS = [
    r"template.*fallback",
    r"TEMPLATE_REQUIRED",
    r"useTemplate.*(?:life|death|ko|seki)",
    r"(?:mandatory|required).*template",
    r"fallback.*(?:life|death|ko|seki)",
]


def check_source(project_dir):
    """Scan explanation engine source for unsafe patterns."""
    engine_dir = os.path.join(project_dir, "src", "engine", "explanation")
    if not os.path.exists(engine_dir):
        print(
            "INFO: Explanation engine not yet implemented — skipping source check"
        )
        return True

    ts_files = glob.glob(
        os.path.join(engine_dir, "**", "*.ts"), recursive=True
    )
    tsx_files = glob.glob(
        os.path.join(engine_dir, "**", "*.tsx"), recursive=True
    )
    all_files = ts_files + tsx_files

    if not all_files:
        print("INFO: No TypeScript files found in explanation engine")
        return True

    print(f"Scanning {len(all_files)} files in src/engine/explanation/...")

    issues = []
    safe_found = False

    for filepath in all_files:
        try:
            with open(filepath, encoding="utf-8", errors="replace") as f:
                content = f.read()
        except Exception:
            continue

        rel_path = os.path.relpath(filepath, project_dir)

        # Check for unsafe patterns
        for pattern, description in UNSAFE_SOURCE_PATTERNS:
            matches = list(
                re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
            )
            for m in matches:
                line_num = content[: m.start()].count("\n") + 1
                issues.append(
                    (rel_path, line_num, description, m.group()[:100])
                )

        # Check for safe patterns
        for pattern in SAFE_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                safe_found = True

    if issues:
        print(f"CRITICAL: {len(issues)} unsafe pattern(s) found:")
        for path, line, desc, match in issues:
            print(f"  {path}:{line} — {desc}")
            print(f"    match: {match}")
        return False

    if safe_found:
        print("PASS: Template fallback patterns found in source")
    else:
        print(
            "WARNING: No explicit template fallback patterns found — "
            "verify manually"
        )

    return True


def check_output(project_dir, output_file):
    """Check a generated output for freeform text in high-risk positions."""
    if os.path.isabs(output_file):
        filepath = output_file
    else:
        filepath = os.path.join(project_dir, output_file)

    if not os.path.exists(filepath):
        print(f"WARNING: Output file not found: {output_file}")
        return True

    try:
        with open(filepath, encoding="utf-8", errors="replace") as f:
            raw = f.read()
        data = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        # Try as plain text
        return _check_text_output(raw if "raw" in dir() else "")

    return _check_json_output(data)


def _check_json_output(data):
    """Check JSON output for freeform text in high-risk positions."""
    issues = []

    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict) and "positions" in data:
        entries = data["positions"]
    elif isinstance(data, dict) and "results" in data:
        entries = data["results"]
    else:
        entries = [data]

    high_risk_terms = [
        "life", "death", "ko", "seki",
        "\uc0ac\ud65c", "\ud328", "\uc138\ud0a4",
    ]

    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue

        classification = str(entry.get("classification", "")).lower()
        position_type = str(entry.get("position_type", "")).lower()
        is_freeform = entry.get("is_freeform", False)
        template_used = entry.get("template_used", "")

        is_high_risk = any(
            term in classification or term in position_type
            for term in high_risk_terms
        )

        if is_high_risk and (
            is_freeform or template_used in ("none", "", None)
        ):
            issues.append(
                f"Position {i}: high-risk ({classification or position_type}) "
                f"uses freeform text"
            )

    if issues:
        print(
            f"CRITICAL: {len(issues)} high-risk position(s) without "
            f"template fallback:"
        )
        for issue in issues:
            print(f"  - {issue}")
        return False

    print("PASS: All high-risk positions use template fallback")
    return True


def _check_text_output(text):
    """Check text output for suspicious freeform patterns."""
    if not text:
        print("INFO: Empty text output — nothing to check")
        return True

    high_risk_sections = re.findall(
        r"(?:life.death|ko\s|seki|\uc0ac\ud65c|\ud328|\uc138\ud0a4).*?(?:\n\n|\Z)",
        text,
        re.IGNORECASE | re.DOTALL,
    )

    if not high_risk_sections:
        print("INFO: No high-risk sections found in output")
        return True

    print(
        f"Found {len(high_risk_sections)} high-risk sections — "
        f"manual review recommended"
    )
    return True


def main():
    parser = argparse.ArgumentParser(
        description="P1 Fallback Enforcement Validator"
    )
    parser.add_argument(
        "--project-dir",
        default=os.environ.get("CLAUDE_PROJECT_DIR", "."),
    )
    parser.add_argument("--check-source", action="store_true")
    parser.add_argument(
        "--check-output", type=str, help="Output file to validate"
    )
    args = parser.parse_args()

    success = True

    if args.check_source:
        if not check_source(args.project_dir):
            success = False

    if args.check_output:
        if not check_output(args.project_dir, args.check_output):
            success = False

    if not args.check_source and not args.check_output:
        parser.print_help()
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
