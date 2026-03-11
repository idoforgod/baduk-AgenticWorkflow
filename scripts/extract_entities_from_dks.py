#!/usr/bin/env python3
"""Extract data entities from Step 3 DKS YAML for Step 7 schema design.

Reads outputs/step-03-domain-knowledge.yaml, extracts entity definitions, and
writes a structured entity list organised into categories (game, board,
analysis, user) to outputs/preprocessed/step-07-entity-list.yaml.

If the DKS file doesn't exist yet, a template entity list based on the known
6-table schema from the workflow is generated with a warning.

Usage:
    python scripts/extract_entities_from_dks.py [--project-dir /path/to/project]

Exit codes:
    0 — success
    1 — unexpected error
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Lightweight YAML helpers (stdlib only — no PyYAML)
# ---------------------------------------------------------------------------
# We need to read simple YAML and write structured YAML.  Rather than pulling
# in a dependency, we implement a *minimal* reader that handles the subset of
# YAML we expect (maps, lists, scalars, limited nesting) and a writer.

def _yaml_dump(data: Any, indent: int = 0) -> str:
    """Serialise *data* as YAML (subset: dicts, lists, scalars)."""
    sp = "  " * indent
    lines: list[str] = []

    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{sp}{key}:")
                lines.append(_yaml_dump(value, indent + 1))
            else:
                lines.append(f"{sp}{key}: {_yaml_scalar(value)}")
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                first = True
                for key, value in item.items():
                    prefix = f"{sp}- " if first else f"{sp}  "
                    first = False
                    if isinstance(value, (dict, list)):
                        lines.append(f"{prefix}{key}:")
                        lines.append(_yaml_dump(value, indent + 2))
                    else:
                        lines.append(f"{prefix}{key}: {_yaml_scalar(value)}")
            else:
                lines.append(f"{sp}- {_yaml_scalar(item)}")
    else:
        lines.append(f"{sp}{_yaml_scalar(data)}")

    return "\n".join(lines)


def _yaml_scalar(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    s = str(value)
    # Quote if contains special characters
    if any(c in s for c in ":{}\n#[]&*!|>'\"%@`"):
        return f'"{s}"'
    return s


# ---------------------------------------------------------------------------
# Minimal YAML reader
# ---------------------------------------------------------------------------

def _yaml_load_simple(text: str) -> dict:
    """Parse a *very* simplified subset of YAML into nested dicts/lists.

    This handles:
      - Top-level keys with scalar or list values
      - Nested dicts (indentation-based)
      - Lists of scalars (``- item``)

    It does NOT handle anchors, aliases, flow style, multi-line strings, etc.
    For robust parsing, use PyYAML — but we stay stdlib-only per requirements.
    """
    result: dict[str, Any] = {}
    stack: list[tuple[int, dict]] = [(-1, result)]
    current_key: str | None = None

    for raw_line in text.splitlines():
        # Skip comments and blank lines
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        indent = len(raw_line) - len(raw_line.lstrip())

        # Pop stack back to correct nesting level
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()

        parent = stack[-1][1]

        # List item
        m_list = re.match(r"^(\s*)-\s+(.*)", raw_line)
        if m_list:
            if current_key and current_key in parent:
                if not isinstance(parent[current_key], list):
                    parent[current_key] = []
                val = m_list.group(2).strip()
                parent[current_key].append(_parse_scalar(val))
            continue

        # Key: value
        m_kv = re.match(r"^(\s*)([\w][\w\s_-]*?)\s*:\s*(.*)", raw_line)
        if m_kv:
            key = m_kv.group(2).strip()
            val_str = m_kv.group(3).strip()
            current_key = key
            if val_str:
                parent[key] = _parse_scalar(val_str)
            else:
                # Nested dict or upcoming list
                child: dict[str, Any] = {}
                parent[key] = child
                stack.append((indent, child))

    return result


def _parse_scalar(s: str) -> Any:
    if not s:
        return None
    if s in ("null", "~"):
        return None
    if s == "true":
        return True
    if s == "false":
        return False
    # Remove quotes
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        pass
    return s


# ---------------------------------------------------------------------------
# Entity extraction from DKS
# ---------------------------------------------------------------------------

def _extract_entities_from_dks(dks: dict) -> dict:
    """Walk the DKS dict and extract entity-like structures."""
    entities: list[dict] = []
    relationships: list[dict] = []

    def _walk(d: dict, path: str = "") -> None:
        for key, value in d.items():
            current_path = f"{path}.{key}" if path else key
            if isinstance(value, dict):
                # Heuristic: if it has 'type' or 'properties' keys, treat as entity
                if "type" in value or "properties" in value:
                    entity = {
                        "name": key,
                        "path": current_path,
                        "type": value.get("type", "object"),
                        "properties": {},
                        "relationships": [],
                    }
                    if isinstance(value.get("properties"), dict):
                        entity["properties"] = value["properties"]
                    entities.append(entity)
                else:
                    _walk(value, current_path)

    _walk(dks)

    # If no structured entities found, extract top-level keys as entities
    if not entities:
        for key, value in dks.items():
            entities.append({
                "name": key,
                "path": key,
                "type": "section" if isinstance(value, dict) else "value",
                "properties": value if isinstance(value, dict) else {"value": value},
                "relationships": [],
            })

    return {
        "entities": entities,
        "relationship_count": len(relationships),
    }


# ---------------------------------------------------------------------------
# Default template entities (when DKS doesn't exist)
# ---------------------------------------------------------------------------

def _default_template_entities() -> dict:
    """Return template entity list based on the known 6-table schema."""
    return OrderedDict([
        ("_meta", OrderedDict([
            ("generator", "extract_entities_from_dks.py"),
            ("source", "template (DKS not yet available)"),
            ("warning", "Default entities from known 6-table schema. Update after Step 3."),
            ("table_count", 6),
        ])),
        ("categories", OrderedDict([
            ("game_entities", OrderedDict([
                ("description", "Core game lifecycle entities"),
                ("entities", [
                    OrderedDict([
                        ("name", "Game"),
                        ("table", "games"),
                        ("properties", OrderedDict([
                            ("id", "TEXT PRIMARY KEY (UUID)"),
                            ("board_size", "INTEGER (9 | 13 | 19)"),
                            ("ruleset", "TEXT (tromp-taylor)"),
                            ("komi", "REAL (default 7.5 for 19x19, 5.5 for 9x9)"),
                            ("status", "TEXT (in_progress | finished | abandoned)"),
                            ("result", "TEXT (B+R | W+3.5 | ...)"),
                            ("black_player_id", "TEXT REFERENCES users(id)"),
                            ("white_player_id", "TEXT (NULL for AI)"),
                            ("ai_level", "INTEGER (1-30, NULL for PvP)"),
                            ("created_at", "TEXT (ISO 8601)"),
                            ("finished_at", "TEXT (ISO 8601, nullable)"),
                        ])),
                        ("relationships", [
                            "has_many: Move",
                            "has_many: AnalysisResult",
                            "belongs_to: User (black_player)",
                        ]),
                    ]),
                    OrderedDict([
                        ("name", "Move"),
                        ("table", "moves"),
                        ("properties", OrderedDict([
                            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
                            ("game_id", "TEXT REFERENCES games(id)"),
                            ("move_number", "INTEGER"),
                            ("player", "TEXT (B | W)"),
                            ("coordinate", "TEXT (e.g. Q16, pass)"),
                            ("timestamp", "TEXT (ISO 8601)"),
                        ])),
                        ("relationships", [
                            "belongs_to: Game",
                            "has_one: AnalysisResult (optional)",
                        ]),
                    ]),
                ]),
            ])),
            ("board_entities", OrderedDict([
                ("description", "Board state and Go-domain entities (in-memory, not persisted)"),
                ("entities", [
                    OrderedDict([
                        ("name", "Position"),
                        ("storage", "in-memory (1D Uint8Array)"),
                        ("properties", OrderedDict([
                            ("board", "Uint8Array (board_size * board_size)"),
                            ("current_player", "enum (BLACK | WHITE)"),
                            ("ko_point", "number | null"),
                            ("zobrist_hash", "BigInt"),
                            ("captures_black", "number"),
                            ("captures_white", "number"),
                        ])),
                        ("relationships", [
                            "contains: Stone[]",
                            "contains: Group[]",
                        ]),
                    ]),
                    OrderedDict([
                        ("name", "Stone"),
                        ("storage", "in-memory"),
                        ("properties", OrderedDict([
                            ("index", "number (0-based position in 1D array)"),
                            ("color", "enum (BLACK | WHITE | EMPTY)"),
                            ("coordinate", "string (e.g. Q16)"),
                        ])),
                        ("relationships", [
                            "belongs_to: Group",
                        ]),
                    ]),
                    OrderedDict([
                        ("name", "Group"),
                        ("storage", "in-memory (computed)"),
                        ("properties", OrderedDict([
                            ("stones", "Set<number> (indices)"),
                            ("color", "enum (BLACK | WHITE)"),
                            ("liberties", "Set<number> (liberty indices)"),
                            ("liberty_count", "number"),
                        ])),
                        ("relationships", [
                            "contains: Stone[]",
                            "adjacent_to: Group[] (enemy/friendly)",
                        ]),
                    ]),
                    OrderedDict([
                        ("name", "Territory"),
                        ("storage", "in-memory (computed at scoring)"),
                        ("properties", OrderedDict([
                            ("owner", "enum (BLACK | WHITE | NEUTRAL)"),
                            ("points", "Set<number> (empty indices)"),
                            ("size", "number"),
                        ])),
                        ("relationships", [
                            "bounded_by: Group[]",
                        ]),
                    ]),
                ]),
            ])),
            ("analysis_entities", OrderedDict([
                ("description", "KataGo analysis results and explanation output"),
                ("entities", [
                    OrderedDict([
                        ("name", "AnalysisResult"),
                        ("table", "analysis_results"),
                        ("properties", OrderedDict([
                            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
                            ("game_id", "TEXT REFERENCES games(id)"),
                            ("move_number", "INTEGER"),
                            ("winrate", "REAL (0.0 - 1.0)"),
                            ("score_lead", "REAL (points)"),
                            ("top_moves_json", "TEXT (JSON array of moveInfo)"),
                            ("classification", "TEXT (blunder | mistake | inaccuracy | good)"),
                            ("visits", "INTEGER"),
                            ("created_at", "TEXT (ISO 8601)"),
                        ])),
                        ("relationships", [
                            "belongs_to: Game",
                            "has_one: Explanation",
                        ]),
                    ]),
                    OrderedDict([
                        ("name", "Explanation"),
                        ("table", "explanations"),
                        ("properties", OrderedDict([
                            ("id", "INTEGER PRIMARY KEY AUTOINCREMENT"),
                            ("analysis_result_id", "INTEGER REFERENCES analysis_results(id)"),
                            ("tier", "TEXT (beginner | intermediate | advanced)"),
                            ("template_id", "TEXT (nullable — NULL if freeform)"),
                            ("text", "TEXT"),
                            ("is_freeform", "INTEGER (0 | 1)"),
                            ("created_at", "TEXT (ISO 8601)"),
                        ])),
                        ("relationships", [
                            "belongs_to: AnalysisResult",
                        ]),
                    ]),
                ]),
            ])),
            ("user_entities", OrderedDict([
                ("description", "User profile, progress, and settings"),
                ("entities", [
                    OrderedDict([
                        ("name", "User"),
                        ("table", "users"),
                        ("properties", OrderedDict([
                            ("id", "TEXT PRIMARY KEY (UUID)"),
                            ("display_name", "TEXT"),
                            ("skill_level", "INTEGER (1-30)"),
                            ("preferred_board_size", "INTEGER (9 | 13 | 19)"),
                            ("explanation_tier", "TEXT (beginner | intermediate | advanced)"),
                            ("onboarding_completed", "INTEGER (0 | 1)"),
                            ("created_at", "TEXT (ISO 8601)"),
                        ])),
                        ("relationships", [
                            "has_many: Game",
                            "has_one: UserProgress",
                            "has_one: UserSettings",
                        ]),
                    ]),
                    OrderedDict([
                        ("name", "UserProgress"),
                        ("table", "user_progress"),
                        ("properties", OrderedDict([
                            ("user_id", "TEXT PRIMARY KEY REFERENCES users(id)"),
                            ("level", "INTEGER"),
                            ("experience_points", "INTEGER"),
                            ("games_played", "INTEGER"),
                            ("games_won", "INTEGER"),
                            ("current_streak", "INTEGER"),
                            ("longest_streak", "INTEGER"),
                            ("badges_json", "TEXT (JSON array)"),
                        ])),
                        ("relationships", [
                            "belongs_to: User",
                        ]),
                    ]),
                ]),
            ])),
        ])),
    ])


# ---------------------------------------------------------------------------
# Categorise extracted entities
# ---------------------------------------------------------------------------

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "game_entities": ["game", "match", "move", "player", "turn", "result"],
    "board_entities": ["board", "position", "stone", "group", "liberty", "territory", "eye", "ko", "seki"],
    "analysis_entities": ["analysis", "explanation", "pattern", "template", "winrate", "score"],
    "user_entities": ["user", "profile", "progress", "settings", "preference", "badge", "streak"],
}


def _categorise_entity(name: str) -> str:
    """Assign an entity to a category based on its name."""
    name_lower = name.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in name_lower:
                return category
    return "game_entities"  # default


def _organise_entities(raw: dict) -> dict:
    """Take raw extracted entities and organise into categories."""
    categories: dict[str, list[dict]] = {
        "game_entities": [],
        "board_entities": [],
        "analysis_entities": [],
        "user_entities": [],
    }

    for entity in raw.get("entities", []):
        cat = _categorise_entity(entity["name"])
        categories[cat].append(entity)

    return categories


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract data entities from DKS YAML for Step 7 schema",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    dks_path = project_dir / "outputs" / "step-03-domain-knowledge.yaml"
    output_path = project_dir / "outputs" / "preprocessed" / "step-07-entity-list.yaml"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not dks_path.exists():
        # Generate template from known schema
        template = _default_template_entities()
        output_text = "# Step 7 Entity List — Template (DKS not yet available)\n"
        output_text += "# Re-run after Step 3 generates domain-knowledge.yaml\n\n"
        output_text += _yaml_dump(template) + "\n"
        output_path.write_text(output_text, encoding="utf-8")

        entity_count = sum(
            len(cat_data.get("entities", []))
            for cat_data in template.get("categories", {}).values()
            if isinstance(cat_data, dict)
        )
        print(f"WARNING: DKS file not found — generated template entity list")
        print(f"Entities: {entity_count} (from known 6-table schema)")
        print(f"Categories: {len(template.get('categories', {}))}")
        print(f"Output: {os.path.relpath(output_path, project_dir)}")
        return 0

    # Read and parse DKS
    try:
        dks_text = dks_path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"ERROR: Cannot read {dks_path}: {exc}", file=sys.stderr)
        return 1

    dks = _yaml_load_simple(dks_text)
    raw = _extract_entities_from_dks(dks)
    categories = _organise_entities(raw)

    # Build output
    output_data = OrderedDict([
        ("_meta", OrderedDict([
            ("generator", "extract_entities_from_dks.py"),
            ("source", os.path.relpath(dks_path, project_dir)),
            ("entity_count", len(raw["entities"])),
            ("relationship_count", raw["relationship_count"]),
        ])),
        ("categories", OrderedDict()),
    ])

    total_entities = 0
    total_relationships = 0

    for cat_name, cat_entities in categories.items():
        cat_data = OrderedDict([
            ("entity_count", len(cat_entities)),
            ("entities", []),
        ])
        for entity in cat_entities:
            e = OrderedDict([
                ("name", entity["name"]),
                ("type", entity.get("type", "object")),
            ])
            if entity.get("properties"):
                e["properties"] = entity["properties"]
            rels = entity.get("relationships", [])
            if rels:
                e["relationships"] = rels
                total_relationships += len(rels)
            cat_data["entities"].append(e)
            total_entities += 1
        output_data["categories"][cat_name] = cat_data

    output_text = "# Step 7 Entity List — Extracted from DKS\n\n"
    output_text += _yaml_dump(output_data) + "\n"
    output_path.write_text(output_text, encoding="utf-8")

    print(f"Entities extracted: {total_entities}")
    print(f"Relationships mapped: {total_relationships}")
    for cat_name, cat_entities in categories.items():
        if cat_entities:
            print(f"  {cat_name}: {len(cat_entities)}")
    print(f"Output: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
