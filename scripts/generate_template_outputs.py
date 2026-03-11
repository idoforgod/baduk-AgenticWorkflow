#!/usr/bin/env python3
"""Run template engine against test positions for Step 14 golden dataset validation.

This script is a TEST HARNESS.  It checks whether the template engine module
exists (src/engine/explanation/), invokes it via subprocess if available, and
collects coverage & quality metrics.

If the template engine is not yet implemented, exits 0 with a skip message.

Usage:
    python scripts/generate_template_outputs.py [--project-dir /path/to/project]

Exit codes:
    0 — success (or template engine not yet implemented)
    1 — unexpected error
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EXPLANATION_DIR_CANDIDATES = [
    "src/engine/explanation",
    "src/engine/explanation/",
]

_TEST_DATA_FILE = "outputs/preprocessed/step-13-katago-test-data.json"

_HIGH_RISK_CLASSIFICATIONS = {"life_death", "ko", "seki"}

# Template categories for synthetic coverage
_TEMPLATE_CATEGORIES = [
    "opening_star_point", "opening_komoku", "opening_approach",
    "opening_3_3_invasion", "opening_direction",
    "middle_cutting", "middle_connection", "middle_influence",
    "middle_invasion", "middle_fight", "middle_thickness",
    "endgame_double_sente", "endgame_reverse_sente", "endgame_gote",
    "endgame_territory", "endgame_boundary",
    "life_death_corner", "life_death_side", "life_death_center",
    "ko_direct", "ko_approach", "ko_threat",
    "seki_corner", "seki_side",
    "blunder_ladder", "blunder_self_atari", "blunder_direction",
    "mistake_joseki", "mistake_shape", "mistake_tenuki",
    "inaccuracy_order", "inaccuracy_speed",
    "good_move_standard",
]


# ---------------------------------------------------------------------------
# Engine detection
# ---------------------------------------------------------------------------

def _find_engine(project_dir: Path) -> Path | None:
    """Return the path to the template engine directory, or None."""
    for candidate in _EXPLANATION_DIR_CANDIDATES:
        p = project_dir / candidate
        if p.is_dir():
            return p
    return None


def _detect_runner(engine_dir: Path) -> tuple[str, str] | None:
    """Detect the runner command (node/ts-node/npx tsx) and entry point.

    Returns (command, entry_file) or None.
    """
    # Check for TypeScript entry points
    for entry in ["index.ts", "main.ts", "engine.ts"]:
        entry_path = engine_dir / entry
        if entry_path.exists():
            # Prefer npx tsx (modern), then ts-node, then node (if .js)
            return ("npx tsx", str(entry_path))

    # Check for JavaScript entry points
    for entry in ["index.js", "main.js", "engine.js"]:
        entry_path = engine_dir / entry
        if entry_path.exists():
            return ("node", str(entry_path))

    return None


# ---------------------------------------------------------------------------
# Synthetic position generation (200 positions)
# ---------------------------------------------------------------------------

def _generate_test_positions(project_dir: Path) -> list[dict]:
    """Generate or load 200 test positions for validation.

    If step-13 test data exists, expands it to 200 positions through
    systematic variation.  Otherwise, generates fully synthetic positions.
    """
    positions: list[dict] = []
    position_id = 0

    # Try to load existing test data
    test_data_path = project_dir / _TEST_DATA_FILE
    base_samples: list[dict] = []
    if test_data_path.exists():
        try:
            data = json.loads(test_data_path.read_text(encoding="utf-8"))
            base_samples = data.get("samples", [])
        except (json.JSONDecodeError, OSError):
            pass

    # Tier definitions
    tiers = ["beginner", "intermediate", "advanced"]

    # Phase definitions
    phases = ["opening", "middle", "endgame"]

    # Classification definitions
    classifications = [
        ("blunder", 0.12),      # 12% → ~24 positions
        ("mistake", 0.15),      # 15% → ~30 positions
        ("inaccuracy", 0.18),   # 18% → ~36 positions
        ("good", 0.35),         # 35% → ~70 positions
        ("life_death", 0.10),   # 10% → ~20 positions
        ("ko", 0.05),           # 5%  → ~10 positions
        ("seki", 0.05),         # 5%  → ~10 positions
    ]

    target_count = 200

    # Generate positions
    for classification, ratio in classifications:
        count = max(1, round(target_count * ratio))
        for i in range(count):
            if position_id >= target_count:
                break

            phase_idx = i % len(phases)
            tier_idx = i % len(tiers)

            # Use base sample if available, otherwise synthetic
            base = None
            if base_samples:
                matching = [s for s in base_samples if s.get("classification") == classification]
                if matching:
                    base = matching[i % len(matching)]

            pos: dict[str, Any] = {
                "position_id": f"pos-{position_id:03d}",
                "classification": classification,
                "tier": tiers[tier_idx],
                "game_phase": phases[phase_idx],
                "board_size": 19 if position_id % 5 != 0 else 9,
                "move_number": _synthetic_move_number(phases[phase_idx], i),
            }

            if base:
                pos["katago_response"] = base.get("katago_response", {})
                pos["description"] = base.get("description", "")
            else:
                pos["katago_response"] = _synthetic_katago_response(classification, i)
                pos["description"] = f"Synthetic {classification} position #{i + 1}"

            positions.append(pos)
            position_id += 1

    # Pad to exactly 200 if needed
    while len(positions) < target_count:
        positions.append({
            "position_id": f"pos-{len(positions):03d}",
            "classification": "good",
            "tier": tiers[len(positions) % len(tiers)],
            "game_phase": phases[len(positions) % len(phases)],
            "board_size": 19,
            "move_number": 50 + len(positions),
            "katago_response": _synthetic_katago_response("good", len(positions)),
            "description": f"Padding position #{len(positions)}",
        })

    return positions[:target_count]


def _synthetic_move_number(phase: str, seed: int) -> int:
    if phase == "opening":
        return 1 + (seed * 3) % 30
    elif phase == "middle":
        return 31 + (seed * 5) % 120
    else:
        return 151 + (seed * 2) % 100


def _synthetic_katago_response(classification: str, seed: int) -> dict:
    """Generate a minimal synthetic KataGo response for a position."""
    wr_ranges = {
        "blunder":    (0.25, 0.40),
        "mistake":    (0.38, 0.48),
        "inaccuracy": (0.45, 0.52),
        "good":       (0.48, 0.55),
        "life_death": (0.20, 0.80),
        "ko":         (0.40, 0.60),
        "seki":       (0.45, 0.55),
    }
    wr_lo, wr_hi = wr_ranges.get(classification, (0.45, 0.55))
    # Deterministic pseudo-random
    frac = ((seed * 7 + 13) % 100) / 100.0
    winrate = round(wr_lo + frac * (wr_hi - wr_lo), 6)

    return {
        "turnNumber": seed + 1,
        "moveInfos": [
            {
                "move": "D4",
                "winrate": winrate,
                "scoreLead": round((winrate - 0.5) * 20, 2),
                "order": 0,
                "prior": 0.15,
                "visits": 300,
                "pv": ["D4", "Q16"],
            }
        ],
        "rootInfo": {
            "winrate": winrate,
            "scoreLead": round((winrate - 0.5) * 20, 2),
            "visits": 300,
        },
    }


# ---------------------------------------------------------------------------
# Engine invocation
# ---------------------------------------------------------------------------

def _invoke_engine(
    runner_cmd: str,
    entry_file: str,
    positions: list[dict],
    project_dir: Path,
) -> list[dict]:
    """Invoke the template engine via subprocess for each position.

    Passes positions as JSON on stdin, expects JSON results on stdout.
    """
    results: list[dict] = []
    input_payload = json.dumps({"positions": positions}, ensure_ascii=False)

    try:
        proc = subprocess.run(
            runner_cmd.split() + [entry_file, "--batch"],
            input=input_payload,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(project_dir),
        )
        if proc.returncode == 0 and proc.stdout.strip():
            output_data = json.loads(proc.stdout)
            results = output_data.get("results", [])
    except (subprocess.TimeoutExpired, json.JSONDecodeError, OSError) as exc:
        print(f"WARNING: Engine invocation failed: {exc}", file=sys.stderr)

    return results


# ---------------------------------------------------------------------------
# Coverage computation
# ---------------------------------------------------------------------------

def _compute_coverage(
    positions: list[dict],
    engine_results: list[dict],
) -> dict:
    """Compute coverage metrics from engine results.

    If engine_results is empty (engine not available), all positions are
    marked as having no template match.
    """
    total = len(positions)
    position_outputs: list[dict] = []
    template_count = 0
    freeform_count = 0
    high_risk_failures: list[dict] = []

    # Build a lookup of engine results by position_id
    result_map: dict[str, dict] = {}
    for r in engine_results:
        pid = r.get("position_id", "")
        if pid:
            result_map[pid] = r

    for pos in positions:
        pid = pos["position_id"]
        classification = pos["classification"]
        tier = pos["tier"]
        game_phase = pos["game_phase"]

        engine_result = result_map.get(pid, {})

        template_used = engine_result.get("template_used", "none")
        explanation_text = engine_result.get("explanation_text", "")
        is_freeform = engine_result.get("is_freeform", True)

        if template_used and template_used != "none":
            template_count += 1
            is_freeform = False
        else:
            freeform_count += 1
            is_freeform = True

        entry = {
            "position_id": pid,
            "tier": tier,
            "game_phase": game_phase,
            "classification": classification,
            "template_used": template_used,
            "explanation_text": explanation_text,
            "is_freeform": is_freeform,
        }
        position_outputs.append(entry)

        # Flag high-risk freeform as critical failure
        if classification in _HIGH_RISK_CLASSIFICATIONS and is_freeform:
            high_risk_failures.append({
                "position_id": pid,
                "classification": classification,
                "tier": tier,
                "game_phase": game_phase,
                "severity": "CRITICAL",
                "reason": (
                    f"High-risk position ({classification}) has no template match. "
                    "Freeform/LLM explanation is unreliable for this position type."
                ),
            })

    coverage_pct = (template_count / total * 100) if total > 0 else 0.0

    return {
        "total_positions": total,
        "template_matched": template_count,
        "freeform": freeform_count,
        "coverage_percent": round(coverage_pct, 1),
        "high_risk_failures": high_risk_failures,
        "high_risk_failure_count": len(high_risk_failures),
        "position_outputs": position_outputs,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run template engine against test positions for Step 14 validation",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    output_path = project_dir / "outputs" / "preprocessed" / "step-14-template-outputs.json"

    # ------------------------------------------------------------------
    # Detect template engine
    # ------------------------------------------------------------------
    engine_dir = _find_engine(project_dir)
    if engine_dir is None:
        print("Template engine not yet implemented — skipping")
        print(f"  (looked for: {', '.join(_EXPLANATION_DIR_CANDIDATES)})")
        return 0

    runner = _detect_runner(engine_dir)
    if runner is None:
        print("Template engine directory found but no entry point detected — skipping")
        print(f"  Directory: {engine_dir}")
        return 0

    runner_cmd, entry_file = runner
    print(f"Template engine found: {engine_dir}")
    print(f"Runner: {runner_cmd} {entry_file}")

    # ------------------------------------------------------------------
    # Generate test positions
    # ------------------------------------------------------------------
    positions = _generate_test_positions(project_dir)
    print(f"Test positions: {len(positions)}")

    # ------------------------------------------------------------------
    # Invoke engine
    # ------------------------------------------------------------------
    print("Invoking template engine...")
    engine_results = _invoke_engine(runner_cmd, entry_file, positions, project_dir)

    if not engine_results:
        print("WARNING: Engine returned no results — computing coverage with 0 matches")

    # ------------------------------------------------------------------
    # Compute coverage
    # ------------------------------------------------------------------
    coverage = _compute_coverage(positions, engine_results)

    output: dict = {
        "_meta": {
            "generator": "generate_template_outputs.py",
            "purpose": "Step 14 golden dataset validation — template engine coverage",
            "engine_dir": str(engine_dir.relative_to(project_dir)),
            "total_positions": coverage["total_positions"],
            "coverage_percent": coverage["coverage_percent"],
        },
        "summary": {
            "total_positions": coverage["total_positions"],
            "template_matched": coverage["template_matched"],
            "freeform": coverage["freeform"],
            "coverage_percent": coverage["coverage_percent"],
            "high_risk_failure_count": coverage["high_risk_failure_count"],
        },
        "high_risk_failures": coverage["high_risk_failures"],
        "position_outputs": coverage["position_outputs"],
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print(f"\n=== Coverage Report ===")
    print(f"Coverage: {coverage['coverage_percent']}%")
    print(f"  Template-matched: {coverage['template_matched']}/{coverage['total_positions']}")
    print(f"  Freeform: {coverage['freeform']}/{coverage['total_positions']}")

    if coverage["high_risk_failures"]:
        print(f"\nCRITICAL FAILURES: {coverage['high_risk_failure_count']}")
        for failure in coverage["high_risk_failures"][:10]:
            print(f"  - {failure['position_id']}: {failure['classification']} ({failure['tier']})")
        if coverage["high_risk_failure_count"] > 10:
            print(f"  ... and {coverage['high_risk_failure_count'] - 10} more")
    else:
        print("\nNo high-risk failures detected.")

    print(f"\nOutput: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
