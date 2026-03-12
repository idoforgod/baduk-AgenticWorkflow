#!/usr/bin/env python3
"""Extract coaching-relevant signals from KataGo analysis samples for Step 26.

Pre-processing script for the Coaching Engine Design step.
Reads existing KataGo analysis samples (from Step 4) and extracts/classifies
signals that are relevant for coaching commentary generation.

P1 Principle: The agent receives a structured signal table, NOT raw JSON.
This eliminates noise and reduces hallucination risk in the design phase.

Usage:
    python scripts/extract_coaching_signals.py [--project-dir /path/to/project]

Exit codes:
    0 — success
    1 — unexpected error
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Board-coordinate helpers (deterministic — no LLM)
# ---------------------------------------------------------------------------

_COLUMNS = "ABCDEFGHJKLMNOPQRST"  # I is skipped in Go notation


def _gtp_to_rowcol(gtp: str, board_size: int) -> tuple[int, int] | None:
    """Convert GTP coordinate (e.g. 'D4') to 0-based (row, col). None if 'pass'."""
    if not gtp or gtp.lower() == "pass":
        return None
    col = _COLUMNS.index(gtp[0].upper())
    row = int(gtp[1:]) - 1
    return (row, col)


def _classify_spatial(gtp: str, board_size: int) -> str:
    """Deterministic spatial classification: corner / side / center."""
    rc = _gtp_to_rowcol(gtp, board_size)
    if rc is None:
        return "pass"
    row, col = rc
    dist = min(row, col, board_size - 1 - row, board_size - 1 - col)
    if dist <= 2:
        return "corner"
    if dist <= 4:
        return "side"
    return "center"


def _classify_game_phase(move_number: int, board_size: int) -> str:
    """Deterministic game phase detection (matches output-parser.ts thresholds)."""
    opening_threshold = {19: 40, 13: 25, 9: 15}.get(board_size, 40)
    endgame_threshold = {19: 150, 13: 90, 9: 40}.get(board_size, 150)

    if move_number < opening_threshold:
        return "opening"
    if move_number >= endgame_threshold:
        return "endgame"
    return "middle_game"


# ---------------------------------------------------------------------------
# Signal extraction (deterministic — no LLM)
# ---------------------------------------------------------------------------


def _extract_signals(sample: dict[str, Any]) -> dict[str, Any]:
    """Extract coaching-relevant signals from a single KataGo sample."""
    response = sample.get("response", {})
    move_infos = response.get("moveInfos", [])
    root_info = response.get("rootInfo", {})
    board_size = sample.get("board_size", 19)
    move_number = sample.get("move_number", 0)
    last_move = sample.get("last_move", "")
    category = sample.get("category", "unknown")

    best_move = move_infos[0] if move_infos else {}
    second_move = move_infos[1] if len(move_infos) > 1 else {}

    # --- Deterministic signal extraction ---
    winrate = best_move.get("winrate", 0.5)
    score_lead = best_move.get("scoreLead", 0.0)
    prior = best_move.get("prior", 0.0)
    visits = best_move.get("visits", 0)
    pv = best_move.get("pv", [])
    order = best_move.get("order", 0)

    top_move_gap = (
        best_move.get("winrate", 0.5) - second_move.get("winrate", 0.5)
        if second_move
        else 0.0
    )

    spatial = _classify_spatial(last_move, board_size)
    phase = _classify_game_phase(move_number, board_size)

    # Winrate assessment (deterministic thresholds from output-parser.ts)
    if winrate > 0.85:
        assessment = "decisive_advantage"
    elif winrate > 0.65:
        assessment = "strong_advantage"
    elif winrate > 0.55:
        assessment = "slight_advantage"
    elif winrate >= 0.45:
        assessment = "even"
    elif winrate >= 0.35:
        assessment = "slight_disadvantage"
    elif winrate >= 0.15:
        assessment = "significant_disadvantage"
    else:
        assessment = "lost"

    return {
        "sample_id": sample.get("sample_id", "unknown"),
        "category": category,
        "description": sample.get("description", ""),
        "board_size": board_size,
        "move_number": move_number,
        "player": sample.get("player", "?"),
        "last_move": last_move,
        "signals": {
            "winrate": round(winrate, 4),
            "winrate_pct": round(winrate * 100, 1),
            "score_lead": round(score_lead, 1),
            "prior": round(prior, 4),
            "visits": visits,
            "top_move_gap": round(top_move_gap, 4),
            "best_move": best_move.get("move", "?"),
            "pv_short": " → ".join(pv[:2]) if pv else "",
            "pv_medium": " → ".join(pv[:3]) if pv else "",
        },
        "spatial": {
            "position": spatial,
            "game_phase": phase,
        },
        "assessment": assessment,
        "coaching_potential": {
            "can_assess_quality": True,
            "can_detect_phase": True,
            "can_classify_spatial": spatial != "pass",
            "needs_board_state_for": [
                "group_liberties",
                "adjacent_opponent_count",
                "adjacent_friendly_count",
                "tactical_situation_classification",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Signal-to-Concept Mapping Table (reference for agent)
# ---------------------------------------------------------------------------

SIGNAL_TO_CONCEPT_MAPPING = [
    {
        "concept": "territory_building",
        "signals": ["phase=opening", "spatial∈{corner,side}", "adj_opponent=0"],
        "description": "집을 만들기 유리한 자리 — 포석 단계에서 적 돌 없는 귀/변에 착수",
        "requires_board_state": False,
    },
    {
        "concept": "approach",
        "signals": ["phase=opening", "spatial=corner", "adj_opponent≥1"],
        "description": "다가가기(걸침) — 포석에서 적의 귀 돌에 접근",
        "requires_board_state": True,
    },
    {
        "concept": "attack",
        "signals": ["adj_opponent_group.liberties≤3"],
        "description": "공격 — 상대 돌 그룹의 활로가 적을 때",
        "requires_board_state": True,
    },
    {
        "concept": "escape",
        "signals": ["own_group.liberties≤3", "adj_opponent≥2"],
        "description": "도주 — 자기 돌 그룹의 활로가 적고 상대에 둘러싸여 있을 때",
        "requires_board_state": True,
    },
    {
        "concept": "connection",
        "signals": ["adj_friendly_groups≥2"],
        "description": "연결 — 두 아군 그룹 사이를 잇는 수",
        "requires_board_state": True,
    },
    {
        "concept": "invasion",
        "signals": ["ownership[index]<-0.3"],
        "description": "침입 — 상대 영역(ownership 음수)에 착수",
        "requires_board_state": False,
    },
    {
        "concept": "defense",
        "signals": ["ownership[index]>0.3", "adj_opponent≥1"],
        "description": "수비 — 자기 영역에서 상대 돌이 접근할 때",
        "requires_board_state": True,
    },
    {
        "concept": "capture",
        "signals": ["adj_opponent_group.liberties=1"],
        "description": "따냄 — 상대 돌이 단수(활로 1개)일 때",
        "requires_board_state": True,
    },
    {
        "concept": "endgame_counting",
        "signals": ["phase=endgame"],
        "description": "끝내기 — 한 집 한 집이 중요한 마무리 단계",
        "requires_board_state": False,
    },
    {
        "concept": "brilliant_move",
        "signals": ["moveQuality=brilliant (rank=0, prior<0.05, visits>100)"],
        "description": "묘수 — AI도 예상하지 못한 뛰어난 수",
        "requires_board_state": False,
    },
    {
        "concept": "good_move",
        "signals": ["moveQuality∈{excellent,good}"],
        "description": "좋은 수 — AI 추천과 일치하는 수",
        "requires_board_state": False,
    },
    {
        "concept": "mistake",
        "signals": ["moveQuality∈{mistake,blunder} (winrateDelta<-5%)"],
        "description": "실수 — 승률이 크게 떨어진 수",
        "requires_board_state": False,
    },
    {
        "concept": "momentum_shift",
        "signals": ["prev_winrate<50% && curr_winrate>50% (or vice versa)"],
        "description": "흐름 전환 — 우세/열세가 뒤바뀌는 순간",
        "requires_board_state": False,
    },
    {
        "concept": "close_game",
        "signals": ["|winrate-50%|<5"],
        "description": "접전 — 양쪽 승률이 비슷한 팽팽한 국면",
        "requires_board_state": False,
    },
    {
        "concept": "positional",
        "signals": ["(위 어디에도 해당 없음)"],
        "description": "일반적 포석/행마 — 특별한 전술 상황 없음",
        "requires_board_state": False,
    },
]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract coaching signals from KataGo samples for Step 26",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    # Read existing KataGo samples (from Step 4 pre-processing)
    samples_path = (
        project_dir / "outputs" / "preprocessed" / "step-04-katago-samples.json"
    )
    output_path = project_dir / "outputs" / "step-26-coaching-signals.yaml"

    if samples_path.exists():
        raw = json.loads(samples_path.read_text(encoding="utf-8"))
        samples = raw.get("samples", [])
    else:
        # If samples don't exist yet, generate inline set for bootstrapping
        print(f"WARNING: {samples_path} not found. Using bootstrapped samples.")
        samples = []

    # Extract signals from each sample
    extracted = [_extract_signals(s) for s in samples]

    # Build output YAML (using json for simplicity — agent can parse either)
    output = {
        "_meta": {
            "generator": "extract_coaching_signals.py",
            "purpose": "Pre-processed coaching signals for Step 26 agent input",
            "p1_compliance": "Agent receives structured signals, not raw KataGo JSON",
            "sample_count": len(extracted),
        },
        "signal_to_concept_mapping": SIGNAL_TO_CONCEPT_MAPPING,
        "extracted_signals": extracted,
        "board_state_functions_available": {
            "findGroup": {
                "source": "rules-engine/board.ts:128",
                "returns": "{color, stones: Set<number>, liberties: Set<number>}",
                "usage": "Detect group danger (liberties count), connection opportunities",
            },
            "getAdjacencyTable": {
                "source": "rules-engine/board.ts:47",
                "returns": "Array of neighbor index arrays per intersection",
                "usage": "Count adjacent opponent/friendly stones",
            },
        },
        "existing_reusable_functions": {
            "parseAnalysis": {
                "source": "explanation-engine/output-parser.ts:169",
                "returns": "ParsedAnalysis with winrateDelta, moveQuality, gamePhase, etc.",
            },
            "classifyMoveQuality": {
                "source": "explanation-engine/output-parser.ts:89",
                "returns": "MoveQuality enum (brilliant/excellent/good/.../blunder)",
            },
            "detectGamePhase": {
                "source": "explanation-engine/output-parser.ts:45",
                "returns": "'opening' | 'middle_game' | 'endgame'",
            },
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Summary
    phases = {}
    for e in extracted:
        p = e["spatial"]["game_phase"]
        phases[p] = phases.get(p, 0) + 1

    print(f"Extracted coaching signals from {len(extracted)} samples")
    for phase, count in sorted(phases.items()):
        print(f"  {phase}: {count}")
    print(f"Signal-to-concept mappings: {len(SIGNAL_TO_CONCEPT_MAPPING)}")
    print(f"Output: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
