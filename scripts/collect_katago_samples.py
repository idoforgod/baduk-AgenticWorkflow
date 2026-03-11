#!/usr/bin/env python3
"""Generate sample KataGo Analysis Engine JSON query/response pairs for Step 4.

Reads the Step 2 IPC spec (outputs/step-02-katago-ipc-spec.md) for protocol
context and generates 10 synthetic but realistic KataGo analysis samples
covering opening, middle-game, endgame, life/death, and ko positions.

Usage:
    python scripts/collect_katago_samples.py [--project-dir /path/to/project]

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
# Board-coordinate helpers
# ---------------------------------------------------------------------------

_COLUMNS_19 = "ABCDEFGHJKLMNOPQRST"  # I is skipped in Go notation
_COLUMNS_9 = _COLUMNS_19[:9]


def _coord(col: int, row: int, board_size: int = 19) -> str:
    """Convert 0-based (col, row) to standard Go coordinate (e.g. 'D4')."""
    cols = _COLUMNS_19 if board_size == 19 else _COLUMNS_9
    return f"{cols[col]}{row + 1}"


# ---------------------------------------------------------------------------
# Sample generation
# ---------------------------------------------------------------------------

def _make_move_info(
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


def _generate_samples() -> list[dict]:
    """Return 10 synthetic KataGo analysis samples."""
    samples: list[dict] = []

    # -------------------------------------------------------------------
    # Helper to build a full sample entry
    # -------------------------------------------------------------------
    def _sample(
        *,
        sample_id: str,
        category: str,
        description: str,
        board_size: int,
        move_number: int,
        player: str,
        last_move: str,
        stones_black: list[str],
        stones_white: list[str],
        move_infos: list[dict],
    ) -> dict:
        query = {
            "id": sample_id,
            "rules": "tromp-taylor",
            "komi": 7.5 if board_size == 19 else 5.5,
            "boardXSize": board_size,
            "boardYSize": board_size,
            "initialStones": (
                [["B", s] for s in stones_black]
                + [["W", s] for s in stones_white]
            ),
            "moves": [],  # simplified — moves embedded in initialStones
            "analyzeTurns": [move_number],
        }
        response = {
            "id": sample_id,
            "turnNumber": move_number,
            "moveInfos": move_infos,
            "rootInfo": {
                "winrate": move_infos[0]["winrate"],
                "scoreLead": move_infos[0]["scoreLead"],
                "visits": sum(m["visits"] for m in move_infos),
            },
        }
        return {
            "sample_id": sample_id,
            "category": category,
            "description": description,
            "board_size": board_size,
            "move_number": move_number,
            "player": player,
            "last_move": last_move,
            "query": query,
            "response": response,
        }

    # ===================================================================
    # 1–3  OPENING POSITIONS (corners, approach moves)
    # ===================================================================
    samples.append(_sample(
        sample_id="opening-001",
        category="opening",
        description="Star-point opening — Black plays 4-4 at Q16, White approaches at R14",
        board_size=19,
        move_number=4,
        player="B",
        last_move="R14",
        stones_black=["Q16", "D4"],
        stones_white=["D16", "R14"],
        move_infos=[
            _make_move_info("Q12", winrate=0.5432, score_lead=1.2, order=0,
                            prior=0.1823, visits=320, pv=["Q12", "R10", "Q10"]),
            _make_move_info("R17", winrate=0.5401, score_lead=1.1, order=1,
                            prior=0.1654, visits=280, pv=["R17", "Q14", "R12"]),
            _make_move_info("P17", winrate=0.5380, score_lead=1.0, order=2,
                            prior=0.1201, visits=200, pv=["P17", "Q14", "O16"]),
        ],
    ))

    samples.append(_sample(
        sample_id="opening-002",
        category="opening",
        description="3-3 invasion — White invades Black's 4-4 corner",
        board_size=19,
        move_number=6,
        player="W",
        last_move="Q4",
        stones_black=["Q16", "D4", "Q4"],
        stones_white=["D16", "R14", "C3"],
        move_infos=[
            _make_move_info("R3", winrate=0.4812, score_lead=-0.8, order=0,
                            prior=0.2341, visits=400, pv=["R3", "R4", "S3", "S4"]),
            _make_move_info("C4", winrate=0.4790, score_lead=-0.9, order=1,
                            prior=0.1980, visits=350, pv=["C4", "D3", "C6"]),
        ],
    ))

    samples.append(_sample(
        sample_id="opening-003",
        category="opening",
        description="Komoku approach — knight's move approach to 3-4 point",
        board_size=19,
        move_number=3,
        player="W",
        last_move="C4",
        stones_black=["Q16", "C4"],
        stones_white=["D16"],
        move_infos=[
            _make_move_info("E3", winrate=0.4920, score_lead=-0.3, order=0,
                            prior=0.1456, visits=310, pv=["E3", "D6", "F4"]),
            _make_move_info("F3", winrate=0.4905, score_lead=-0.4, order=1,
                            prior=0.1320, visits=290, pv=["F3", "D6", "F4"]),
            _make_move_info("C6", winrate=0.4895, score_lead=-0.5, order=2,
                            prior=0.1100, visits=250, pv=["C6", "E3", "D5"]),
        ],
    ))

    # ===================================================================
    # 4–6  MIDDLE GAME POSITIONS (fights, influence)
    # ===================================================================
    samples.append(_sample(
        sample_id="middle-001",
        category="middle_game",
        description="Cutting fight — Black cuts through White's knight's move connection",
        board_size=19,
        move_number=52,
        player="B",
        last_move="K10",
        stones_black=["L10", "L11", "K12", "J11", "M9", "N10"],
        stones_white=["K10", "L9", "K11", "J10", "M10", "N11"],
        move_infos=[
            _make_move_info("J9", winrate=0.5823, score_lead=3.4, order=0,
                            prior=0.2560, visits=450, pv=["J9", "K9", "H10", "J8"]),
            _make_move_info("M11", winrate=0.5654, score_lead=2.8, order=1,
                            prior=0.1230, visits=280, pv=["M11", "N12", "L12"]),
        ],
    ))

    samples.append(_sample(
        sample_id="middle-002",
        category="middle_game",
        description="Influence vs territory — Black builds central thickness",
        board_size=19,
        move_number=78,
        player="B",
        last_move="H16",
        stones_black=["K10", "K11", "K12", "J10", "J11", "L10", "L11", "D4", "D10"],
        stones_white=["H16", "G16", "H15", "R4", "R10", "R16", "Q16", "D16", "C16"],
        move_infos=[
            _make_move_info("K14", winrate=0.6102, score_lead=5.1, order=0,
                            prior=0.1890, visits=380, pv=["K14", "H13", "K16", "G14"]),
            _make_move_info("G10", winrate=0.5980, score_lead=4.6, order=1,
                            prior=0.1340, visits=310, pv=["G10", "H10", "G11"]),
        ],
    ))

    samples.append(_sample(
        sample_id="middle-003",
        category="middle_game",
        description="Invasion timing — White invades Black's moyo",
        board_size=19,
        move_number=64,
        player="W",
        last_move="J5",
        stones_black=["D4", "D10", "J4", "J5", "K4", "G4", "G7", "J7"],
        stones_white=["Q4", "Q10", "Q16", "D16", "K16", "K10"],
        move_infos=[
            _make_move_info("F10", winrate=0.4350, score_lead=-2.8, order=0,
                            prior=0.1670, visits=350, pv=["F10", "G10", "E11", "F11"]),
            _make_move_info("H10", winrate=0.4280, score_lead=-3.1, order=1,
                            prior=0.1230, visits=300, pv=["H10", "G10", "H11"]),
        ],
    ))

    # ===================================================================
    # 7–8  ENDGAME POSITIONS (territory, yose)
    # ===================================================================
    samples.append(_sample(
        sample_id="endgame-001",
        category="endgame",
        description="Double sente yose — Black plays endgame move worth ~4 points",
        board_size=19,
        move_number=210,
        player="B",
        last_move="S16",
        stones_black=["R15", "R16", "Q17", "S15", "T15"],
        stones_white=["S16", "S17", "R17", "T16", "T17"],
        move_infos=[
            _make_move_info("B2", winrate=0.6234, score_lead=4.5, order=0,
                            prior=0.2100, visits=500, pv=["B2", "C2", "A2", "B1"]),
            _make_move_info("N1", winrate=0.6190, score_lead=4.1, order=1,
                            prior=0.1560, visits=380, pv=["N1", "M1", "O1"]),
        ],
    ))

    samples.append(_sample(
        sample_id="endgame-002",
        category="endgame",
        description="Territory boundary — small yose move on 9×9 board",
        board_size=9,
        move_number=48,
        player="W",
        last_move="B7",
        stones_black=["E5", "E6", "F5", "D5", "D6", "B7", "C7"],
        stones_white=["E4", "F4", "F6", "G5", "G6", "H5"],
        move_infos=[
            _make_move_info("C6", winrate=0.4100, score_lead=-1.5, order=0,
                            prior=0.1890, visits=450, pv=["C6", "D7", "B6"]),
            _make_move_info("D7", winrate=0.4050, score_lead=-1.8, order=1,
                            prior=0.1340, visits=320, pv=["D7", "C6", "E7"]),
        ],
    ))

    # ===================================================================
    # 9  LIFE/DEATH POSITION
    # ===================================================================
    samples.append(_sample(
        sample_id="life-death-001",
        category="life_death",
        description="Corner life/death — White group needs two eyes to live",
        board_size=19,
        move_number=95,
        player="W",
        last_move="S3",
        stones_black=["R2", "R3", "S3", "Q2", "Q3", "Q4", "R5", "S5"],
        stones_white=["S1", "S2", "T2", "T3", "R1", "R4", "S4"],
        move_infos=[
            _make_move_info("T1", winrate=0.3200, score_lead=-8.5, order=0,
                            prior=0.3400, visits=500, pv=["T1", "T4", "S3"]),
            _make_move_info("T4", winrate=0.2800, score_lead=-10.2, order=1,
                            prior=0.1200, visits=250, pv=["T4", "T1", "S3"]),
        ],
    ))

    # ===================================================================
    # 10  KO POSITION
    # ===================================================================
    samples.append(_sample(
        sample_id="ko-001",
        category="ko",
        description="Direct ko — Black tries to capture ko for corner life",
        board_size=19,
        move_number=118,
        player="B",
        last_move="N15",
        stones_black=["O16", "O15", "P17", "Q17", "R16", "P15"],
        stones_white=["N15", "N16", "O17", "P16", "Q16", "P14"],
        move_infos=[
            _make_move_info("P16", winrate=0.5510, score_lead=2.0, order=0,
                            prior=0.2800, visits=420,
                            pv=["P16", "A1", "O16", "B1", "P16"]),
            _make_move_info("O14", winrate=0.5320, score_lead=1.4, order=1,
                            prior=0.0980, visits=180,
                            pv=["O14", "P16", "O13"]),
        ],
    ))

    return samples


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate sample KataGo analysis JSON pairs for Step 4",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    ipc_spec = project_dir / "outputs" / "step-02-katago-ipc-spec.md"
    output_path = project_dir / "outputs" / "preprocessed" / "step-04-katago-samples.json"

    has_ipc_spec = ipc_spec.exists()

    samples = _generate_samples()

    # Build output document
    output: dict = {
        "_meta": {
            "generator": "collect_katago_samples.py",
            "purpose": "Synthetic KataGo analysis samples for Step 4 template engine design",
            "sample_count": len(samples),
            "ipc_spec_available": has_ipc_spec,
        },
        "samples": samples,
    }

    if not has_ipc_spec:
        output["_meta"]["warning"] = (
            "Step 2 IPC spec not yet available. "
            "Samples use default KataGo Analysis Engine JSON format. "
            "Re-run after Step 2 for spec-aligned samples."
        )

    # Write
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # Summary
    categories = {}
    for s in samples:
        cat = s["category"]
        categories[cat] = categories.get(cat, 0) + 1

    print(f"Generated {len(samples)} KataGo analysis samples")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")
    if not has_ipc_spec:
        print("WARNING: Step 2 IPC spec not found — using default format")
    print(f"Output: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
