#!/usr/bin/env python3
"""Extract the technology stack section from PRD.md for Step 1.

Reads coding-resource/PRD.md, locates the technology architecture / tech stack
section (§5 "기술 아키텍처"), and writes a clean extract to
outputs/preprocessed/step-01-tech-stack-extract.md.

Usage:
    python scripts/extract_prd_tech_stack.py [--project-dir /path/to/project]

Exit codes:
    0 — success (or PRD not yet available)
    1 — unexpected error
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Section extraction helpers
# ---------------------------------------------------------------------------

# Patterns that mark the beginning of the tech-stack / architecture section.
_SECTION_START_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^#{1,3}\s.*기술\s*아키텍처", re.IGNORECASE),
    re.compile(r"^#{1,3}\s.*기술\s*스택", re.IGNORECASE),
    re.compile(r"^#{1,3}\s.*Technology\s+Stack", re.IGNORECASE),
    re.compile(r"^#{1,3}\s.*Technology\s+Architecture", re.IGNORECASE),
    re.compile(r'^##\s*<a\s+id="5-architecture"', re.IGNORECASE),
    re.compile(r"^#{1,2}\s+5[\.\s]", re.IGNORECASE),  # "## 5." or "# 5 "
]

# A major heading at the same or higher level signals end-of-section.
_MAJOR_HEADING = re.compile(r"^(#{1,2})\s")


def _find_section(lines: list[str]) -> tuple[int, int]:
    """Return (start, end) line indices of the tech-stack section.

    *start* is inclusive, *end* is exclusive.  Raises ``ValueError`` if the
    section cannot be found.
    """
    start: int | None = None
    heading_level: int = 2  # default — we'll detect the actual level

    for idx, line in enumerate(lines):
        if start is None:
            for pat in _SECTION_START_PATTERNS:
                if pat.search(line):
                    start = idx
                    m = _MAJOR_HEADING.match(line)
                    if m:
                        heading_level = len(m.group(1))
                    break
        else:
            # Stop at the next heading whose level is <= the section's level,
            # but skip if we are still on the very first line.
            if idx == start:
                continue
            m = _MAJOR_HEADING.match(line)
            if m and len(m.group(1)) <= heading_level:
                return start, idx

    if start is not None:
        return start, len(lines)

    raise ValueError("Tech-stack section not found in PRD.md")


# ---------------------------------------------------------------------------
# Technology keyword extraction
# ---------------------------------------------------------------------------

_TECH_KEYWORDS: list[str] = [
    "Tauri", "React", "TypeScript", "Vite", "SQLite", "Drizzle",
    "Tailwind", "shadcn", "Biome", "Vitest", "Playwright", "SonarQube",
    "KataGo", "Zustand", "Recharts", "Sentry", "PostHog", "Cloudflare",
    "Discord", "GitHub Actions", "Claude", "OpenCL", "CUDA", "Eigen",
    "Rust", "Node.js", "Zod", "i18next", "Better Auth", "SGF",
    "Shudan", "Zobrist",
]


def _extract_mentioned_technologies(text: str) -> list[str]:
    """Return a sorted list of recognised technology names found in *text*."""
    found: list[str] = []
    for kw in _TECH_KEYWORDS:
        if kw.lower() in text.lower():
            found.append(kw)
    return sorted(set(found))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract tech-stack section from PRD.md",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    prd_path = project_dir / "coding-resource" / "PRD.md"
    output_path = project_dir / "outputs" / "preprocessed" / "step-01-tech-stack-extract.md"

    # ------------------------------------------------------------------
    # Guard: PRD not yet available
    # ------------------------------------------------------------------
    if not prd_path.exists():
        print("PRD not yet available — skipping")
        return 0

    # ------------------------------------------------------------------
    # Read & extract
    # ------------------------------------------------------------------
    try:
        prd_text = prd_path.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"ERROR: Cannot read {prd_path}: {exc}", file=sys.stderr)
        return 1

    lines = prd_text.splitlines(keepends=True)

    try:
        start, end = _find_section(lines)
    except ValueError:
        print("WARNING: Tech-stack section not found in PRD.md", file=sys.stderr)
        # Write a stub so downstream steps know extraction was attempted.
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            "# Tech Stack Extract\n\n"
            "> Section not found in PRD.md — manual review required.\n",
            encoding="utf-8",
        )
        print("Section not found — wrote stub output")
        return 0

    extracted_lines = lines[start:end]
    extracted_text = "".join(extracted_lines)

    # ------------------------------------------------------------------
    # Write output
    # ------------------------------------------------------------------
    output_path.parent.mkdir(parents=True, exist_ok=True)

    header = (
        "<!-- Auto-generated by extract_prd_tech_stack.py -->\n"
        f"<!-- Source: {os.path.relpath(prd_path, project_dir)} "
        f"(lines {start + 1}–{end}) -->\n\n"
    )
    output_path.write_text(header + extracted_text, encoding="utf-8")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    techs = _extract_mentioned_technologies(extracted_text)
    line_count = len(extracted_lines)

    print(f"Section found: lines {start + 1}–{end} of PRD.md")
    print(f"Line count: {line_count}")
    print(f"Key technologies ({len(techs)}): {', '.join(techs)}")
    print(f"Output: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
