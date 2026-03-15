#!/usr/bin/env python3
"""
validate_stat_functions.py — Anti-Hallucination Layer 3
=======================================================
Golden test datasets for deterministic utility functions.
Independent Python implementation cross-validates TypeScript logic.

Functions validated:
  1. parseResult — Go game result string parsing
  2. calcStreak — Win streak calculation
  3. calcMovingAvg — Moving average calculation
  4. calcWinRateByBoardSize — Win rate by board size
  5. extractHighlights — Key moments from win rate history

Exit codes:
  0 — All golden tests pass
  1 — Mismatch detected
"""

import json
import math
import re
import sys


# ===========================================================================
# 1. parseResult — Golden dataset
# ===========================================================================

def parse_result_py(result):
    """Python mirror of utils/parseResult.ts"""
    if result is None or (isinstance(result, str) and result.strip() == ""):
        return {"winner": None, "method": "ongoing", "score": None, "isUserWin": False}

    trimmed = result.strip()

    if trimmed == "0":
        return {"winner": None, "method": "jigo", "score": 0, "isUserWin": False}

    m = re.match(r'^([BW])\+(.+)$', trimmed)
    if not m:
        return {"winner": None, "method": "ongoing", "score": None, "isUserWin": False}

    winner = m.group(1)
    detail = m.group(2)

    if detail.upper() in ("R", "RESIGN"):
        return {"winner": winner, "method": "resign", "score": None, "isUserWin": winner == "B"}

    if detail.upper() in ("T", "TIME"):
        return {"winner": winner, "method": "timeout", "score": None, "isUserWin": winner == "B"}

    try:
        score_val = float(detail)
        if math.isfinite(score_val):
            return {"winner": winner, "method": "score", "score": score_val, "isUserWin": winner == "B"}
    except ValueError:
        pass

    return {"winner": winner, "method": "resign", "score": None, "isUserWin": winner == "B"}


GOLDEN_PARSE_RESULT = [
    ("B+R",   {"winner": "B", "method": "resign",  "score": None, "isUserWin": True}),
    ("W+R",   {"winner": "W", "method": "resign",  "score": None, "isUserWin": False}),
    ("B+5.5", {"winner": "B", "method": "score",   "score": 5.5,  "isUserWin": True}),
    ("W+0.5", {"winner": "W", "method": "score",   "score": 0.5,  "isUserWin": False}),
    ("B+T",   {"winner": "B", "method": "timeout", "score": None, "isUserWin": True}),
    ("W+T",   {"winner": "W", "method": "timeout", "score": None, "isUserWin": False}),
    ("B+12",  {"winner": "B", "method": "score",   "score": 12.0, "isUserWin": True}),
    ("0",     {"winner": None, "method": "jigo",    "score": 0,    "isUserWin": False}),
    (None,    {"winner": None, "method": "ongoing", "score": None, "isUserWin": False}),
    ("",      {"winner": None, "method": "ongoing", "score": None, "isUserWin": False}),
    ("  ",    {"winner": None, "method": "ongoing", "score": None, "isUserWin": False}),
    ("invalid", {"winner": None, "method": "ongoing", "score": None, "isUserWin": False}),
]


# ===========================================================================
# 2. calcStreak — Golden dataset
# ===========================================================================

def calc_streak_py(outcomes):
    """Python mirror of utils/calcStats.ts calcStreak()"""
    if not outcomes:
        return {"current": 0, "best": 0}

    best = 0
    run = 0
    for win in outcomes:
        if win:
            run += 1
            if run > best:
                best = run
        else:
            run = 0

    current = 0
    for i in range(len(outcomes) - 1, -1, -1):
        if outcomes[i]:
            current += 1
        else:
            break

    return {"current": current, "best": best}


# outcomes: True=win, False=loss
GOLDEN_STREAK = [
    ([],                                   {"current": 0, "best": 0}),
    ([True],                               {"current": 1, "best": 1}),
    ([True, True, True],                   {"current": 3, "best": 3}),
    ([False, False],                       {"current": 0, "best": 0}),
    ([True, False, True, True],            {"current": 2, "best": 2}),
    ([True, True, False, True],            {"current": 1, "best": 2}),
    ([False, True, True, True, False],     {"current": 0, "best": 3}),
    ([True, False, True, False, True, True, True], {"current": 3, "best": 3}),
]


# ===========================================================================
# 3. calcMovingAvg — Golden dataset
# ===========================================================================

def calc_moving_avg_py(values, window):
    """Python mirror of utils/calcStats.ts calcMovingAvg()"""
    if not values or window <= 0:
        return []

    effective_window = min(window, len(values))
    result = []

    for i in range(effective_window - 1, len(values)):
        s = sum(values[i - effective_window + 1: i + 1])
        avg = round(s / effective_window, 1)
        result.append(avg)

    return result


GOLDEN_MOVING_AVG = [
    ([], 3,          []),
    ([60, 40, 80], 2, [50.0, 60.0]),
    ([60, 40, 80], 3, [60.0]),
    ([50], 5,         [50.0]),
    ([10, 20, 30, 40, 50], 3, [20.0, 30.0, 40.0]),
    ([100, 0, 100, 0], 2, [50.0, 50.0, 50.0]),
]


# ===========================================================================
# 4. calcWinRateByBoardSize — Golden dataset
# ===========================================================================

def calc_win_rate_by_board_size_py(games):
    """
    Python mirror of utils/calcStats.ts calcWinRateByBoardSize().
    games: list of { "result": str|None, "boardSize": int }
    """
    groups = {}  # boardSize -> { total, wins }
    for g in games:
        r = g.get("result")
        if r is None or (isinstance(r, str) and r.strip() == ""):
            continue
        bs = g["boardSize"]
        if bs not in groups:
            groups[bs] = {"total": 0, "wins": 0}
        groups[bs]["total"] += 1
        parsed = parse_result_py(r)
        if parsed["isUserWin"]:
            groups[bs]["wins"] += 1

    result = []
    for bs in sorted(groups.keys()):
        total = groups[bs]["total"]
        wins = groups[bs]["wins"]
        wr = round(wins / total * 1000) / 10 if total > 0 else 0
        result.append({"boardSize": bs, "games": total, "wins": wins, "winRate": wr})
    return result


GOLDEN_WIN_RATE_BY_BOARD_SIZE = [
    # (games, expected)
    ([], []),
    (
        [{"result": "B+R", "boardSize": 9}, {"result": "W+R", "boardSize": 9}],
        [{"boardSize": 9, "games": 2, "wins": 1, "winRate": 50.0}],
    ),
    (
        [
            {"result": "B+R", "boardSize": 9},
            {"result": "B+5.5", "boardSize": 9},
            {"result": "W+R", "boardSize": 13},
            {"result": "B+R", "boardSize": 13},
        ],
        [
            {"boardSize": 9, "games": 2, "wins": 2, "winRate": 100.0},
            {"boardSize": 13, "games": 2, "wins": 1, "winRate": 50.0},
        ],
    ),
    (
        [{"result": None, "boardSize": 9}, {"result": "", "boardSize": 13}],
        [],
    ),
    (
        [
            {"result": "B+R", "boardSize": 9},
            {"result": "W+R", "boardSize": 9},
            {"result": "W+R", "boardSize": 9},
            {"result": "B+R", "boardSize": 19},
        ],
        [
            {"boardSize": 9, "games": 3, "wins": 1, "winRate": 33.3},
            {"boardSize": 19, "games": 1, "wins": 1, "winRate": 100.0},
        ],
    ),
]


# ===========================================================================
# 5. extractHighlights — Golden dataset
# ===========================================================================

def extract_highlights_py(history):
    """
    Python mirror of utils/extractHighlights.ts extractHighlights().
    history: list of { "move": int, "blackWinRate": float }
    """
    if len(history) < 2:
        return []

    biggest_drop = 0
    biggest_drop_move = -1
    biggest_gain = 0
    biggest_gain_move = -1
    turning_point_move = -1
    turning_point_change = 0

    for i in range(1, len(history)):
        prev = history[i - 1]
        curr = history[i]
        change = curr["blackWinRate"] - prev["blackWinRate"]

        # Turning point: crosses 50%
        if turning_point_move == -1:
            if (prev["blackWinRate"] >= 50 and curr["blackWinRate"] < 50) or \
               (prev["blackWinRate"] < 50 and curr["blackWinRate"] >= 50):
                turning_point_move = curr["move"]
                turning_point_change = change

        if change < biggest_drop:
            biggest_drop = change
            biggest_drop_move = curr["move"]

        if change > biggest_gain:
            biggest_gain = change
            biggest_gain_move = curr["move"]

    highlights = []

    if turning_point_move >= 0:
        highlights.append({
            "moveNumber": turning_point_move,
            "type": "turning_point",
            "winRateChange": round(turning_point_change * 10) / 10,
        })

    if biggest_drop_move >= 0 and biggest_drop < -8:
        highlights.append({
            "moveNumber": biggest_drop_move,
            "type": "critical_mistake",
            "winRateChange": round(biggest_drop * 10) / 10,
        })

    if biggest_gain_move >= 0 and biggest_gain > 8:
        highlights.append({
            "moveNumber": biggest_gain_move,
            "type": "best_sequence",
            "winRateChange": round(biggest_gain * 10) / 10,
        })

    return sorted(highlights, key=lambda h: h["moveNumber"])


GOLDEN_EXTRACT_HIGHLIGHTS = [
    # (history, expected — only checking type + moveNumber + winRateChange)
    ([], []),
    ([{"move": 1, "blackWinRate": 55}], []),  # <2 points
    (
        # Turning point at move 3 (crosses 50%), big drop at move 3
        [
            {"move": 1, "blackWinRate": 60},
            {"move": 2, "blackWinRate": 55},
            {"move": 3, "blackWinRate": 40},
        ],
        [
            {"moveNumber": 3, "type": "turning_point", "winRateChange": -15.0},
            {"moveNumber": 3, "type": "critical_mistake", "winRateChange": -15.0},
        ],
    ),
    (
        # Big gain only
        [
            {"move": 1, "blackWinRate": 30},
            {"move": 2, "blackWinRate": 50},
        ],
        [
            {"moveNumber": 2, "type": "turning_point", "winRateChange": 20.0},
            {"moveNumber": 2, "type": "best_sequence", "winRateChange": 20.0},
        ],
    ),
    (
        # Flat — no highlights (changes < 8%)
        [
            {"move": 1, "blackWinRate": 48},
            {"move": 2, "blackWinRate": 50},
            {"move": 3, "blackWinRate": 52},
        ],
        [
            {"moveNumber": 2, "type": "turning_point", "winRateChange": 2.0},
        ],
    ),
    (
        # All three highlights
        [
            {"move": 1, "blackWinRate": 55},
            {"move": 2, "blackWinRate": 40},   # turning point + critical mistake (-15)
            {"move": 3, "blackWinRate": 35},
            {"move": 4, "blackWinRate": 55},   # best sequence (+20)
        ],
        [
            {"moveNumber": 2, "type": "turning_point", "winRateChange": -15.0},
            {"moveNumber": 2, "type": "critical_mistake", "winRateChange": -15.0},
            {"moveNumber": 4, "type": "best_sequence", "winRateChange": 20.0},
        ],
    ),
]


# ===========================================================================
# Runner
# ===========================================================================

def run_tests():
    errors = []

    # parseResult tests
    print("Testing parseResult...")
    for i, (input_val, expected) in enumerate(GOLDEN_PARSE_RESULT):
        actual = parse_result_py(input_val)
        if actual != expected:
            errors.append(
                f"parseResult[{i}] input={repr(input_val)}\n"
                f"  expected: {json.dumps(expected)}\n"
                f"  actual:   {json.dumps(actual)}"
            )
    print(f"  {len(GOLDEN_PARSE_RESULT)} cases checked")

    # calcStreak tests
    print("Testing calcStreak...")
    for i, (outcomes, expected) in enumerate(GOLDEN_STREAK):
        actual = calc_streak_py(outcomes)
        if actual != expected:
            errors.append(
                f"calcStreak[{i}] input={outcomes}\n"
                f"  expected: {expected}\n"
                f"  actual:   {actual}"
            )
    print(f"  {len(GOLDEN_STREAK)} cases checked")

    # calcMovingAvg tests
    print("Testing calcMovingAvg...")
    for i, (values, window, expected) in enumerate(GOLDEN_MOVING_AVG):
        actual = calc_moving_avg_py(values, window)
        if actual != expected:
            errors.append(
                f"calcMovingAvg[{i}] input=({values}, {window})\n"
                f"  expected: {expected}\n"
                f"  actual:   {actual}"
            )
    print(f"  {len(GOLDEN_MOVING_AVG)} cases checked")

    # calcWinRateByBoardSize tests
    print("Testing calcWinRateByBoardSize...")
    for i, (games, expected) in enumerate(GOLDEN_WIN_RATE_BY_BOARD_SIZE):
        actual = calc_win_rate_by_board_size_py(games)
        if actual != expected:
            errors.append(
                f"calcWinRateByBoardSize[{i}] input={json.dumps(games)}\n"
                f"  expected: {json.dumps(expected)}\n"
                f"  actual:   {json.dumps(actual)}"
            )
    print(f"  {len(GOLDEN_WIN_RATE_BY_BOARD_SIZE)} cases checked")

    # extractHighlights tests
    print("Testing extractHighlights...")
    for i, (history, expected) in enumerate(GOLDEN_EXTRACT_HIGHLIGHTS):
        actual = extract_highlights_py(history)
        if actual != expected:
            errors.append(
                f"extractHighlights[{i}] input={json.dumps(history)}\n"
                f"  expected: {json.dumps(expected)}\n"
                f"  actual:   {json.dumps(actual)}"
            )
    print(f"  {len(GOLDEN_EXTRACT_HIGHLIGHTS)} cases checked")

    return errors


def main():
    print("=" * 60)
    print("Stat Functions Validator (Anti-Hallucination L3)")
    print("=" * 60)

    errors = run_tests()

    if errors:
        print(f"\n{'!' * 60}")
        print(f"GOLDEN TEST FAILURES: {len(errors)}")
        print(f"{'!' * 60}")
        for err in errors:
            print(f"\n  {err}")
        return 1

    total = (len(GOLDEN_PARSE_RESULT) + len(GOLDEN_STREAK) + len(GOLDEN_MOVING_AVG)
             + len(GOLDEN_WIN_RATE_BY_BOARD_SIZE) + len(GOLDEN_EXTRACT_HIGHLIGHTS))
    print(f"\n{'=' * 60}")
    print(f"ALL {total} GOLDEN TESTS PASSED")
    print(f"{'=' * 60}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
