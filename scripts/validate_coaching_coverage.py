#!/usr/bin/env python3
"""Validate coaching engine output coverage and quality — Step 28 pre-processing.

Runs the coaching engine output against 50 Golden Dataset positions and checks:
  1. Coverage ≥ 80% (meaningful coaching, not generic fallback)
  2. Classification ↔ text alignment (template matches concept)
  3. Numeric accuracy ±0.1% (slot values match KataGo source)
  4. Generic fallback ratio ≤ 20%
  5. All 15 tactical situations are exercised

P1 Principle: This is the FINAL validation gate before quality sign-off.
Deterministic code must produce 100% repeatable results.

Usage:
    python scripts/validate_coaching_coverage.py [--project-dir /path/to/project]

Exit codes:
    0 — all validations pass
    1 — validation failures detected
    2 — coaching engine not yet implemented (skip)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_VALID_TACTICAL_SITUATIONS = {
    "territory_building",
    "approach",
    "attack",
    "escape",
    "connection",
    "invasion",
    "defense",
    "capture",
    "endgame_counting",
    "brilliant_move",
    "good_move",
    "mistake",
    "momentum_shift",
    "close_game",
    "positional",
}

# Generic/fallback classification — counts toward fallback ratio
_GENERIC_CLASSIFICATIONS = {"positional"}

# Minimum coverage threshold (meaningful coaching / total positions)
_MIN_COVERAGE_PCT = 80.0

# Maximum generic fallback ratio
_MAX_FALLBACK_PCT = 20.0

# Numeric slot tolerance
_SLOT_TOLERANCE = 0.1

# Concept → required Korean keywords in coaching text
_CONCEPT_KEYWORDS = {
    "territory_building": ["집", "만들"],
    "approach": ["걸침", "다가"],
    "attack": ["공격", "활로"],
    "escape": ["도주", "도망", "탈출"],
    "connection": ["연결", "잇"],
    "invasion": ["침입", "침투"],
    "defense": ["수비", "지키"],
    "capture": ["따냄", "잡", "단수"],
    "endgame_counting": ["끝내기", "마무리"],
    "brilliant_move": ["묘수", "놀라", "뛰어"],
    "good_move": ["좋은", "잘"],
    "mistake": ["실수", "아쉬"],
    "momentum_shift": ["흐름", "전환", "역전"],
    "close_game": ["접전", "팽팽"],
    "positional": ["자리", "포석", "행마"],
}


# ---------------------------------------------------------------------------
# Validation functions
# ---------------------------------------------------------------------------


def _check_coverage(results: list[dict[str, Any]]) -> tuple[float, list[str]]:
    """Calculate meaningful coaching coverage (non-generic / total)."""
    errors: list[str] = []
    total = len(results)
    if total == 0:
        errors.append("No results to validate")
        return 0.0, errors

    meaningful = sum(
        1 for r in results
        if r.get("tactical_situation", r.get("classification", "positional"))
        not in _GENERIC_CLASSIFICATIONS
        and r.get("coaching_text", r.get("message", ""))
    )

    coverage = (meaningful / total) * 100
    if coverage < _MIN_COVERAGE_PCT:
        errors.append(
            f"Coverage {coverage:.1f}% < minimum {_MIN_COVERAGE_PCT}% "
            f"({meaningful}/{total} meaningful)"
        )

    return coverage, errors


def _check_fallback_ratio(results: list[dict[str, Any]]) -> tuple[float, list[str]]:
    """Calculate generic fallback ratio."""
    errors: list[str] = []
    total = len(results)
    if total == 0:
        return 0.0, errors

    generic = sum(
        1 for r in results
        if r.get("tactical_situation", r.get("classification", ""))
        in _GENERIC_CLASSIFICATIONS
    )

    ratio = (generic / total) * 100
    if ratio > _MAX_FALLBACK_PCT:
        errors.append(
            f"Fallback ratio {ratio:.1f}% > maximum {_MAX_FALLBACK_PCT}% "
            f"({generic}/{total} generic)"
        )

    return ratio, errors


def _check_classification_accuracy(
    golden: list[dict[str, Any]], results: list[dict[str, Any]]
) -> tuple[float, list[str]]:
    """Check tactical classification matches expected — must be 100% for deterministic code."""
    errors: list[str] = []
    correct = 0
    total = len(golden)

    for pos, res in zip(golden, results):
        expected = pos["expected_classification"]
        actual = res.get("tactical_situation", res.get("classification", ""))

        if actual == expected:
            correct += 1
        else:
            errors.append(
                f"[{pos['id']}] Classification: expected={expected}, got={actual}"
            )

    accuracy = (correct / total * 100) if total > 0 else 0.0
    if accuracy < 100.0:
        errors.insert(
            0,
            f"Classification accuracy {accuracy:.1f}% < 100% "
            f"({correct}/{total} correct). Deterministic code MUST be 100%.",
        )

    return accuracy, errors


def _check_text_alignment(
    golden: list[dict[str, Any]], results: list[dict[str, Any]]
) -> list[str]:
    """Check coaching text contains expected concept keywords."""
    errors: list[str] = []

    for pos, res in zip(golden, results):
        concept = pos["expected_classification"]
        text = res.get("coaching_text", res.get("message", ""))

        if not text:
            errors.append(f"[{pos['id']}] Empty coaching text for concept={concept}")
            continue

        keywords = _CONCEPT_KEYWORDS.get(concept, [])
        if keywords and not any(kw in text for kw in keywords):
            errors.append(
                f"[{pos['id']}] Text-concept mismatch: concept={concept}, "
                f"missing keywords {keywords}. Text: {text[:60]}..."
            )

    return errors


def _check_numeric_accuracy(
    golden: list[dict[str, Any]], results: list[dict[str, Any]]
) -> list[str]:
    """Check numeric slot values match KataGo source within ±0.1%."""
    errors: list[str] = []

    for pos, res in zip(golden, results):
        slots = res.get("slots", {})
        if not slots:
            continue

        move_infos = pos["response"]["moveInfos"]
        best_move = move_infos[0] if move_infos else {}

        # Winrate
        if "winrate" in slots:
            expected = round(best_move.get("winrate", 0.5) * 100, 1)
            actual = slots["winrate"]
            if abs(actual - expected) > _SLOT_TOLERANCE:
                errors.append(
                    f"[{pos['id']}] Winrate slot: expected={expected}, "
                    f"got={actual}, delta={abs(actual - expected):.2f}"
                )

        # Score lead
        if "score_lead" in slots:
            expected = round(best_move.get("scoreLead", 0.0), 1)
            actual = slots["score_lead"]
            if abs(actual - expected) > _SLOT_TOLERANCE:
                errors.append(
                    f"[{pos['id']}] Score slot: expected={expected}, "
                    f"got={actual}, delta={abs(actual - expected):.2f}"
                )

    return errors


def _check_situation_coverage(results: list[dict[str, Any]]) -> list[str]:
    """Verify all 15 tactical situations are exercised at least once."""
    errors: list[str] = []
    covered = {
        r.get("tactical_situation", r.get("classification", ""))
        for r in results
    }
    missing = _VALID_TACTICAL_SITUATIONS - covered
    if missing:
        errors.append(
            f"Missing tactical situations: {sorted(missing)} "
            f"({len(covered)}/{len(_VALID_TACTICAL_SITUATIONS)} covered)"
        )
    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate coaching coverage and quality — Step 28 pre-processing",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    # Check if coaching engine is implemented
    coaching_dir = project_dir / "app" / "src" / "coaching"
    if not coaching_dir.exists():
        print("SKIP: coaching/ directory not yet created. Step 27 not complete.")
        return 2

    # Load golden dataset
    golden_path = project_dir / "outputs" / "golden-dataset-coaching.json"
    if not golden_path.exists():
        print(f"ERROR: Golden dataset not found at {golden_path.relative_to(project_dir)}")
        print("Run scripts/validate_coaching_rules.py first to generate it.")
        return 1

    golden_data = json.loads(golden_path.read_text(encoding="utf-8"))
    golden_positions = golden_data.get("positions", [])
    print(f"Golden Dataset: {len(golden_positions)} positions loaded")

    # Load coaching engine results (produced by Step 27 tests or integration run)
    results_path = project_dir / "outputs" / "coaching-validation-results.json"
    if not results_path.exists():
        print(f"SKIP: Coaching results not found at {results_path.relative_to(project_dir)}")
        print("Coaching engine must produce results against golden dataset first.")
        print("Expected format: [{\"id\": \"...\", \"tactical_situation\": \"...\", ")
        print("  \"coaching_text\": \"...\", \"slots\": {\"winrate\": N, \"score_lead\": N}}]")
        return 2

    results_data = json.loads(results_path.read_text(encoding="utf-8"))
    results = results_data if isinstance(results_data, list) else results_data.get("results", [])
    print(f"Coaching Results: {len(results)} entries loaded")

    if len(results) != len(golden_positions):
        print(
            f"ERROR: Result count ({len(results)}) != golden dataset ({len(golden_positions)})"
        )
        return 1

    # --- Run all validations ---
    all_errors: list[str] = []
    report: dict[str, Any] = {}

    # 1. Coverage
    coverage_pct, coverage_errors = _check_coverage(results)
    report["coverage_pct"] = coverage_pct
    all_errors.extend(coverage_errors)
    print(f"\n1. Coverage: {coverage_pct:.1f}% (min {_MIN_COVERAGE_PCT}%)")

    # 2. Fallback ratio
    fallback_pct, fallback_errors = _check_fallback_ratio(results)
    report["fallback_pct"] = fallback_pct
    all_errors.extend(fallback_errors)
    print(f"2. Fallback ratio: {fallback_pct:.1f}% (max {_MAX_FALLBACK_PCT}%)")

    # 3. Classification accuracy
    accuracy_pct, accuracy_errors = _check_classification_accuracy(
        golden_positions, results
    )
    report["classification_accuracy_pct"] = accuracy_pct
    all_errors.extend(accuracy_errors)
    print(f"3. Classification accuracy: {accuracy_pct:.1f}% (must be 100%)")

    # 4. Text-concept alignment
    text_errors = _check_text_alignment(golden_positions, results)
    all_errors.extend(text_errors)
    print(f"4. Text alignment: {len(text_errors)} issues")

    # 5. Numeric slot accuracy
    numeric_errors = _check_numeric_accuracy(golden_positions, results)
    all_errors.extend(numeric_errors)
    print(f"5. Numeric accuracy: {len(numeric_errors)} issues (tolerance ±{_SLOT_TOLERANCE}%)")

    # 6. Situation coverage
    situation_errors = _check_situation_coverage(results)
    all_errors.extend(situation_errors)
    situations_covered = len(
        _VALID_TACTICAL_SITUATIONS
        - {
            r.get("tactical_situation", r.get("classification", ""))
            for r in results
        }
        .symmetric_difference(_VALID_TACTICAL_SITUATIONS)
    )
    # Simpler count
    covered_set = {
        r.get("tactical_situation", r.get("classification", ""))
        for r in results
    } & _VALID_TACTICAL_SITUATIONS
    print(f"6. Situation coverage: {len(covered_set)}/{len(_VALID_TACTICAL_SITUATIONS)}")

    # --- Report ---
    report["total_errors"] = len(all_errors)
    report["pass"] = len(all_errors) == 0

    # Write validation report
    report_output = project_dir / "outputs" / "coaching-coverage-report.json"
    report_output.write_text(
        json.dumps(
            {
                "_meta": {
                    "generator": "validate_coaching_coverage.py",
                    "purpose": "Coaching engine coverage and quality validation report",
                    "golden_positions": len(golden_positions),
                    "results_count": len(results),
                },
                "metrics": report,
                "errors": all_errors[:50],  # Cap at 50 for readability
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"\nReport: {os.path.relpath(report_output, project_dir)}")

    if all_errors:
        print(f"\nFAILED — {len(all_errors)} validation errors:")
        for err in all_errors[:20]:
            print(f"  ✗ {err}")
        if len(all_errors) > 20:
            print(f"  ... and {len(all_errors) - 20} more errors")
        return 1

    print(
        f"\nPASSED — All validations pass "
        f"(coverage={coverage_pct:.1f}%, accuracy={accuracy_pct:.1f}%, "
        f"fallback={fallback_pct:.1f}%)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
