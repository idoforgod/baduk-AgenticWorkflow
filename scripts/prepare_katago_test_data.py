#!/usr/bin/env python3
"""Generate KataGo test data for Step 13 template engine testing.

Produces 20 diverse synthetic KataGo analysis result samples covering blunders,
mistakes, inaccuracies, good moves, life/death, ko, and seki positions.  Each
sample includes an expected classification label and realistic KataGo field
values.

Usage:
    python scripts/prepare_katago_test_data.py [--project-dir /path/to/project]

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


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_COLUMNS_19 = "ABCDEFGHJKLMNOPQRST"


def _coord(col: int, row: int) -> str:
    return f"{_COLUMNS_19[col]}{row + 1}"


# ---------------------------------------------------------------------------
# Sample generators
# ---------------------------------------------------------------------------

def _move_info(
    move: str,
    *,
    winrate: float,
    score_lead: float,
    order: int,
    prior: float,
    visits: int,
    pv: list[str],
) -> dict:
    return {
        "move": move,
        "winrate": round(winrate, 6),
        "scoreLead": round(score_lead, 2),
        "order": order,
        "prior": round(prior, 6),
        "visits": visits,
        "pv": pv,
    }


def _sample(
    *,
    sample_id: str,
    classification: str,
    description: str,
    board_size: int,
    move_number: int,
    player: str,
    game_phase: str,
    last_move: str,
    best_winrate: float,
    played_winrate: float,
    move_infos: list[dict],
) -> dict:
    winrate_delta = abs(best_winrate - played_winrate)
    return {
        "sample_id": sample_id,
        "classification": classification,
        "expected_label": classification,
        "description": description,
        "board_size": board_size,
        "move_number": move_number,
        "player": player,
        "game_phase": game_phase,
        "last_move": last_move,
        "winrate_delta": round(winrate_delta, 4),
        "katago_response": {
            "turnNumber": move_number,
            "moveInfos": move_infos,
            "rootInfo": {
                "winrate": round(best_winrate, 6),
                "scoreLead": move_infos[0]["scoreLead"],
                "visits": sum(m["visits"] for m in move_infos),
            },
        },
    }


def _generate_all_samples() -> list[dict]:
    samples: list[dict] = []

    # ===================================================================
    # BLUNDERS (winrate delta > 10%) — 4 samples
    # ===================================================================
    samples.append(_sample(
        sample_id="blunder-001",
        classification="blunder",
        description="Missed ladder — played into a broken ladder losing a group",
        board_size=19, move_number=45, player="B", game_phase="middle",
        last_move="K10",
        best_winrate=0.62, played_winrate=0.38,
        move_infos=[
            _move_info("H8", winrate=0.62, score_lead=5.4, order=0,
                       prior=0.23, visits=400, pv=["H8", "G7", "H6"]),
            _move_info("K10", winrate=0.38, score_lead=-4.8, order=1,
                       prior=0.05, visits=80, pv=["K10", "J10", "K9"]),
        ],
    ))

    samples.append(_sample(
        sample_id="blunder-002",
        classification="blunder",
        description="Self-atari — placed stone reducing own liberties to one",
        board_size=19, move_number=88, player="W", game_phase="middle",
        last_move="N14",
        best_winrate=0.55, played_winrate=0.30,
        move_infos=[
            _move_info("M13", winrate=0.55, score_lead=2.1, order=0,
                       prior=0.31, visits=450, pv=["M13", "N13", "L14"]),
            _move_info("N14", winrate=0.30, score_lead=-8.5, order=1,
                       prior=0.02, visits=30, pv=["N14", "M14"]),
        ],
    ))

    samples.append(_sample(
        sample_id="blunder-003",
        classification="blunder",
        description="Wrong direction — approached from the wrong side, giving influence",
        board_size=19, move_number=12, player="B", game_phase="opening",
        last_move="F3",
        best_winrate=0.54, played_winrate=0.41,
        move_infos=[
            _move_info("C6", winrate=0.54, score_lead=1.8, order=0,
                       prior=0.18, visits=380, pv=["C6", "D6", "C10"]),
            _move_info("F3", winrate=0.41, score_lead=-3.2, order=1,
                       prior=0.04, visits=50, pv=["F3", "E3", "F4"]),
        ],
    ))

    samples.append(_sample(
        sample_id="blunder-004",
        classification="blunder",
        description="Failed invasion — invaded too deep and group died",
        board_size=19, move_number=102, player="W", game_phase="middle",
        last_move="E15",
        best_winrate=0.48, played_winrate=0.25,
        move_infos=[
            _move_info("R7", winrate=0.48, score_lead=-0.5, order=0,
                       prior=0.15, visits=350, pv=["R7", "S7", "R6"]),
            _move_info("E15", winrate=0.25, score_lead=-12.3, order=1,
                       prior=0.01, visits=20, pv=["E15", "F15", "E16", "D15"]),
        ],
    ))

    # ===================================================================
    # MISTAKES (winrate delta 5–10%) — 4 samples
    # ===================================================================
    samples.append(_sample(
        sample_id="mistake-001",
        classification="mistake",
        description="Suboptimal joseki — chose inferior variation giving opponent sente",
        board_size=19, move_number=18, player="B", game_phase="opening",
        last_move="Q5",
        best_winrate=0.53, played_winrate=0.46,
        move_infos=[
            _move_info("R6", winrate=0.53, score_lead=1.2, order=0,
                       prior=0.22, visits=320, pv=["R6", "S5", "R7"]),
            _move_info("Q5", winrate=0.46, score_lead=-1.5, order=1,
                       prior=0.08, visits=120, pv=["Q5", "P5", "Q6"]),
        ],
    ))

    samples.append(_sample(
        sample_id="mistake-002",
        classification="mistake",
        description="Missed double-sente endgame — played gote instead",
        board_size=19, move_number=195, player="W", game_phase="endgame",
        last_move="T12",
        best_winrate=0.45, played_winrate=0.38,
        move_infos=[
            _move_info("B2", winrate=0.45, score_lead=-2.0, order=0,
                       prior=0.25, visits=400, pv=["B2", "C2", "A2"]),
            _move_info("T12", winrate=0.38, score_lead=-5.2, order=1,
                       prior=0.06, visits=90, pv=["T12", "T11", "S12"]),
        ],
    ))

    samples.append(_sample(
        sample_id="mistake-003",
        classification="mistake",
        description="Premature tenuki — left local fight unfinished",
        board_size=19, move_number=67, player="B", game_phase="middle",
        last_move="D10",
        best_winrate=0.58, played_winrate=0.50,
        move_infos=[
            _move_info("L8", winrate=0.58, score_lead=3.5, order=0,
                       prior=0.19, visits=340, pv=["L8", "M8", "L7"]),
            _move_info("D10", winrate=0.50, score_lead=0.1, order=1,
                       prior=0.07, visits=100, pv=["D10", "C10", "D11"]),
        ],
    ))

    samples.append(_sample(
        sample_id="mistake-004",
        classification="mistake",
        description="Shape mistake — empty triangle instead of solid connection",
        board_size=19, move_number=55, player="W", game_phase="middle",
        last_move="J12",
        best_winrate=0.52, played_winrate=0.44,
        move_infos=[
            _move_info("K13", winrate=0.52, score_lead=0.8, order=0,
                       prior=0.20, visits=300, pv=["K13", "J13", "L13"]),
            _move_info("J12", winrate=0.44, score_lead=-2.1, order=1,
                       prior=0.06, visits=85, pv=["J12", "J13", "K12"]),
        ],
    ))

    # ===================================================================
    # INACCURACIES (winrate delta 2–5%) — 4 samples
    # ===================================================================
    samples.append(_sample(
        sample_id="inaccuracy-001",
        classification="inaccuracy",
        description="Slightly slow — played solid but lost a point of initiative",
        board_size=19, move_number=30, player="B", game_phase="opening",
        last_move="E4",
        best_winrate=0.54, played_winrate=0.51,
        move_infos=[
            _move_info("K4", winrate=0.54, score_lead=1.5, order=0,
                       prior=0.16, visits=280, pv=["K4", "K3", "L4"]),
            _move_info("E4", winrate=0.51, score_lead=0.4, order=1,
                       prior=0.10, visits=180, pv=["E4", "F4", "E5"]),
        ],
    ))

    samples.append(_sample(
        sample_id="inaccuracy-002",
        classification="inaccuracy",
        description="Missed tesuji — played standard instead of clever local move",
        board_size=19, move_number=78, player="W", game_phase="middle",
        last_move="G14",
        best_winrate=0.49, played_winrate=0.46,
        move_infos=[
            _move_info("H13", winrate=0.49, score_lead=-0.2, order=0,
                       prior=0.14, visits=260, pv=["H13", "G13", "H14"]),
            _move_info("G14", winrate=0.46, score_lead=-1.4, order=1,
                       prior=0.09, visits=150, pv=["G14", "G13", "H14"]),
        ],
    ))

    samples.append(_sample(
        sample_id="inaccuracy-003",
        classification="inaccuracy",
        description="Order of moves — correct idea but suboptimal move order",
        board_size=19, move_number=140, player="B", game_phase="endgame",
        last_move="A5",
        best_winrate=0.60, played_winrate=0.57,
        move_infos=[
            _move_info("A3", winrate=0.60, score_lead=4.2, order=0,
                       prior=0.21, visits=360, pv=["A3", "A4", "B3"]),
            _move_info("A5", winrate=0.57, score_lead=3.0, order=1,
                       prior=0.11, visits=200, pv=["A5", "A4", "A3"]),
        ],
    ))

    samples.append(_sample(
        sample_id="inaccuracy-004",
        classification="inaccuracy",
        description="Slightly loose — one-space jump instead of knight's move",
        board_size=19, move_number=42, player="W", game_phase="middle",
        last_move="M5",
        best_winrate=0.50, played_winrate=0.47,
        move_infos=[
            _move_info("N6", winrate=0.50, score_lead=0.1, order=0,
                       prior=0.15, visits=290, pv=["N6", "M6", "N7"]),
            _move_info("M5", winrate=0.47, score_lead=-1.0, order=1,
                       prior=0.09, visits=160, pv=["M5", "M4", "N5"]),
        ],
    ))

    # ===================================================================
    # GOOD MOVES (winrate delta < 2%) — 4 samples
    # ===================================================================
    samples.append(_sample(
        sample_id="good-001",
        classification="good",
        description="Book move — standard star-point opening",
        board_size=19, move_number=1, player="B", game_phase="opening",
        last_move="Q16",
        best_winrate=0.52, played_winrate=0.52,
        move_infos=[
            _move_info("Q16", winrate=0.52, score_lead=0.6, order=0,
                       prior=0.15, visits=350, pv=["Q16", "D4", "D16"]),
            _move_info("D4", winrate=0.52, score_lead=0.6, order=1,
                       prior=0.15, visits=345, pv=["D4", "Q16", "Q4"]),
        ],
    ))

    samples.append(_sample(
        sample_id="good-002",
        classification="good",
        description="Correct defense — protected cutting point maintaining connection",
        board_size=19, move_number=65, player="W", game_phase="middle",
        last_move="L11",
        best_winrate=0.51, played_winrate=0.50,
        move_infos=[
            _move_info("L11", winrate=0.51, score_lead=0.3, order=0,
                       prior=0.18, visits=300, pv=["L11", "K11", "L12"]),
            _move_info("M11", winrate=0.50, score_lead=0.1, order=1,
                       prior=0.14, visits=270, pv=["M11", "L11", "M12"]),
        ],
    ))

    samples.append(_sample(
        sample_id="good-003",
        classification="good",
        description="Accurate endgame — biggest reverse sente correctly identified",
        board_size=19, move_number=182, player="B", game_phase="endgame",
        last_move="S6",
        best_winrate=0.58, played_winrate=0.57,
        move_infos=[
            _move_info("S6", winrate=0.58, score_lead=3.8, order=0,
                       prior=0.22, visits=420, pv=["S6", "S5", "T6"]),
            _move_info("B18", winrate=0.57, score_lead=3.5, order=1,
                       prior=0.12, visits=250, pv=["B18", "A18", "B19"]),
        ],
    ))

    samples.append(_sample(
        sample_id="good-004",
        classification="good",
        description="Strong fight — correct reading in a complex capturing race",
        board_size=19, move_number=95, player="W", game_phase="middle",
        last_move="F8",
        best_winrate=0.53, played_winrate=0.52,
        move_infos=[
            _move_info("F8", winrate=0.53, score_lead=1.2, order=0,
                       prior=0.20, visits=380, pv=["F8", "E8", "F7"]),
            _move_info("G8", winrate=0.52, score_lead=0.9, order=1,
                       prior=0.16, visits=310, pv=["G8", "F8", "G7"]),
        ],
    ))

    # ===================================================================
    # LIFE/DEATH — 2 samples
    # ===================================================================
    samples.append(_sample(
        sample_id="life-death-001",
        classification="life_death",
        description="Corner life/death — vital point to kill the corner group",
        board_size=19, move_number=110, player="B", game_phase="middle",
        last_move="T2",
        best_winrate=0.72, played_winrate=0.72,
        move_infos=[
            _move_info("T2", winrate=0.72, score_lead=12.5, order=0,
                       prior=0.35, visits=500, pv=["T2", "S1", "T1"]),
            _move_info("S1", winrate=0.58, score_lead=3.8, order=1,
                       prior=0.08, visits=100, pv=["S1", "T2", "T1"]),
        ],
    ))

    samples.append(_sample(
        sample_id="life-death-002",
        classification="life_death",
        description="Side group survival — must make two eyes under attack",
        board_size=19, move_number=128, player="W", game_phase="middle",
        last_move="B10",
        best_winrate=0.40, played_winrate=0.40,
        move_infos=[
            _move_info("B10", winrate=0.40, score_lead=-4.2, order=0,
                       prior=0.30, visits=480, pv=["B10", "A10", "C10"]),
            _move_info("A11", winrate=0.22, score_lead=-14.5, order=1,
                       prior=0.04, visits=40, pv=["A11", "B10", "A10"]),
        ],
    ))

    # ===================================================================
    # KO — 1 sample
    # ===================================================================
    samples.append(_sample(
        sample_id="ko-001",
        classification="ko",
        description="Direct ko fight — ko threat and recapture sequence",
        board_size=19, move_number=135, player="B", game_phase="middle",
        last_move="P16",
        best_winrate=0.55, played_winrate=0.55,
        move_infos=[
            _move_info("P16", winrate=0.55, score_lead=2.3, order=0,
                       prior=0.28, visits=420,
                       pv=["P16", "A1", "O16", "B1", "P16"]),
            _move_info("O14", winrate=0.52, score_lead=0.8, order=1,
                       prior=0.10, visits=180,
                       pv=["O14", "P16", "O13"]),
        ],
    ))

    # ===================================================================
    # SEKI — 1 sample
    # ===================================================================
    samples.append(_sample(
        sample_id="seki-001",
        classification="seki",
        description="Seki position — mutual life, neither side can capture",
        board_size=19, move_number=156, player="W", game_phase="endgame",
        last_move="pass",
        best_winrate=0.48, played_winrate=0.48,
        move_infos=[
            _move_info("pass", winrate=0.48, score_lead=-0.5, order=0,
                       prior=0.40, visits=500,
                       pv=["pass", "pass"]),
            _move_info("S19", winrate=0.35, score_lead=-6.2, order=1,
                       prior=0.03, visits=25,
                       pv=["S19", "T19"]),
        ],
    ))

    return samples


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate KataGo test data for Step 13 template engine testing",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    output_path = project_dir / "outputs" / "preprocessed" / "step-13-katago-test-data.json"

    samples = _generate_all_samples()

    # Classify counts
    counts: dict[str, int] = {}
    for s in samples:
        label = s["classification"]
        counts[label] = counts.get(label, 0) + 1

    output: dict = {
        "_meta": {
            "generator": "prepare_katago_test_data.py",
            "purpose": "Synthetic KataGo test fixtures for Step 13 template engine testing",
            "sample_count": len(samples),
            "classification_distribution": counts,
            "note": "These are synthetic test fixtures, not real KataGo output.",
        },
        "samples": samples,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Summary
    print(f"Generated {len(samples)} KataGo test samples")
    for label in ["blunder", "mistake", "inaccuracy", "good", "life_death", "ko", "seki"]:
        c = counts.get(label, 0)
        print(f"  {label}: {c}")
    print(f"Output: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
