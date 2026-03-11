#!/usr/bin/env python3
"""Merge Steps 1–4 research outputs into a unified input for Step 6 architecture.

Scans outputs/ for step-01 through step-04 artefacts (.md, .yaml), extracts
key sections, and merges them into a single structured document at
outputs/preprocessed/step-06-research-merged.md.

Usage:
    python scripts/merge_research_outputs.py [--project-dir /path/to/project]

Exit codes:
    0 — success (even if some files are missing)
    1 — unexpected error
"""

from __future__ import annotations

import argparse
import glob as globmod
import os
import re
import sys
from pathlib import Path
from typing import NamedTuple


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

class SourceFile(NamedTuple):
    step: str           # e.g. "step-01"
    path: Path
    extension: str      # ".md" or ".yaml"


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------

_STEP_PREFIXES = ["step-01", "step-02", "step-03", "step-04"]

_GLOB_PATTERNS = [
    "step-01-*.md",
    "step-02-*.md",
    "step-03-*.yaml",
    "step-03-*.md",
    "step-04-*.md",
    "step-04-*.yaml",
]


def _discover_files(outputs_dir: Path) -> list[SourceFile]:
    """Find all matching research output files."""
    found: list[SourceFile] = []
    for pattern in _GLOB_PATTERNS:
        for path_str in sorted(globmod.glob(str(outputs_dir / pattern))):
            p = Path(path_str)
            # Determine step prefix
            for prefix in _STEP_PREFIXES:
                if p.name.startswith(prefix):
                    found.append(SourceFile(step=prefix, path=p, extension=p.suffix))
                    break
    # Deduplicate (same file might match multiple patterns)
    seen: set[str] = set()
    deduped: list[SourceFile] = []
    for sf in found:
        if str(sf.path) not in seen:
            seen.add(str(sf.path))
            deduped.append(sf)
    return deduped


# ---------------------------------------------------------------------------
# Content extraction
# ---------------------------------------------------------------------------

_STEP_DESCRIPTIONS: dict[str, str] = {
    "step-01": "Step 1 — Technology Research & Build Verification",
    "step-02": "Step 2 — KataGo IPC Protocol & GPU Detection",
    "step-03": "Step 3 — Domain Knowledge Schema (DKS)",
    "step-04": "Step 4 — Template Engine Design",
}

_STEP_KEY_TOPICS: dict[str, list[str]] = {
    "step-01": [
        "Technology constraints",
        "Compatibility issues",
        "Build results",
        "Dependency audit",
    ],
    "step-02": [
        "KataGo IPC protocol summary",
        "GPU detection strategy",
        "Process lifecycle management",
        "Error handling / circuit breaker",
    ],
    "step-03": [
        "DKS entity count",
        "Rule summary",
        "Edge cases list",
        "Scoring rules",
    ],
    "step-04": [
        "Template pattern categories",
        "Coverage methodology",
        "Fallback rules",
        "3-tier explanation levels",
    ],
}

# Cross-reference map: step output → architecture decisions it informs
_CROSS_REFERENCES: dict[str, list[str]] = {
    "step-01": [
        "Module boundaries (Modular Monolith)",
        "Build toolchain (Vite + Tauri)",
        "Database choice confirmation (SQLite + Drizzle)",
    ],
    "step-02": [
        "KataGo sidecar architecture",
        "IPC message format / Zod validation schema",
        "GPU/CPU fallback decision tree",
    ],
    "step-03": [
        "Database schema (Step 7)",
        "Rule engine interface design",
        "Domain type definitions",
    ],
    "step-04": [
        "Template engine module structure",
        "Explanation tier routing",
        "High-risk position handling (life/death, ko, seki)",
    ],
}


def _extract_headings(text: str) -> list[str]:
    """Return all markdown headings found in *text*."""
    return [
        line.strip()
        for line in text.splitlines()
        if re.match(r"^#{1,6}\s", line)
    ]


def _first_n_lines(text: str, n: int = 30) -> str:
    """Return up to the first *n* non-empty lines of *text*."""
    lines = [l for l in text.splitlines() if l.strip()]
    return "\n".join(lines[:n])


def _count_yaml_keys(text: str) -> int:
    """Rough count of top-level YAML keys (lines starting with a word + colon)."""
    return sum(1 for line in text.splitlines() if re.match(r"^\w[\w_-]*\s*:", line))


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------

def _build_merged_document(
    sources: list[SourceFile],
    outputs_dir: Path,
    project_dir: Path,
) -> str:
    """Build the merged markdown document."""
    parts: list[str] = []

    parts.append("# Step 6 Research Merge — Unified Architecture Input\n")
    parts.append(
        "> Auto-generated by `merge_research_outputs.py`.\n"
        "> This document merges Steps 1–4 research artefacts for Step 6 architecture design.\n"
    )

    # Table of contents
    parts.append("## Table of Contents\n")
    for prefix in _STEP_PREFIXES:
        desc = _STEP_DESCRIPTIONS.get(prefix, prefix)
        step_sources = [s for s in sources if s.step == prefix]
        status = f"({len(step_sources)} file(s))" if step_sources else "(missing)"
        parts.append(f"- [{desc}](#{prefix}) {status}")
    parts.append(f"- [Cross-Reference Index](#cross-references)")
    parts.append(f"- [Gap Analysis](#gaps)\n")

    # Per-step sections
    for prefix in _STEP_PREFIXES:
        desc = _STEP_DESCRIPTIONS.get(prefix, prefix)
        parts.append(f"---\n\n## <a id=\"{prefix}\"></a>{desc}\n")

        step_sources = [s for s in sources if s.step == prefix]

        if not step_sources:
            parts.append(f"> **Not yet available.** No {prefix}-* files found in outputs/.\n")
            parts.append("**Expected key topics:**\n")
            for topic in _STEP_KEY_TOPICS.get(prefix, []):
                parts.append(f"- {topic}")
            parts.append("")
            continue

        # Key topics checklist
        parts.append("**Key topics to extract:**\n")
        for topic in _STEP_KEY_TOPICS.get(prefix, []):
            parts.append(f"- [ ] {topic}")
        parts.append("")

        for sf in step_sources:
            rel = os.path.relpath(sf.path, project_dir)
            parts.append(f"### Source: `{rel}`\n")

            try:
                content = sf.path.read_text(encoding="utf-8")
            except OSError as exc:
                parts.append(f"> Read error: {exc}\n")
                continue

            file_size = len(content)
            line_count = content.count("\n")

            if sf.extension == ".yaml":
                key_count = _count_yaml_keys(content)
                parts.append(f"- Format: YAML ({key_count} top-level keys, {line_count} lines)\n")
                parts.append("```yaml")
                parts.append(_first_n_lines(content, n=50))
                if line_count > 50:
                    parts.append(f"\n# ... ({line_count - 50} more lines)")
                parts.append("```\n")
            else:
                headings = _extract_headings(content)
                parts.append(f"- Format: Markdown ({line_count} lines, {file_size:,} bytes)")
                if headings:
                    parts.append(f"- Headings ({len(headings)}):")
                    for h in headings[:20]:
                        parts.append(f"  - {h}")
                    if len(headings) > 20:
                        parts.append(f"  - ... and {len(headings) - 20} more")
                parts.append("")

                # Include full content (it's research output, not huge)
                parts.append("<details><summary>Full content</summary>\n")
                parts.append(content)
                parts.append("\n</details>\n")

    # Cross-reference index
    parts.append("---\n\n## <a id=\"cross-references\"></a>Cross-Reference Index\n")
    parts.append(
        "Which step outputs feed into which architecture decisions:\n"
    )
    for prefix in _STEP_PREFIXES:
        desc = _STEP_DESCRIPTIONS.get(prefix, prefix)
        parts.append(f"### {desc}\n")
        refs = _CROSS_REFERENCES.get(prefix, [])
        for ref in refs:
            parts.append(f"- → {ref}")
        parts.append("")

    # Gap analysis
    parts.append("---\n\n## <a id=\"gaps\"></a>Gap Analysis\n")
    missing = [p for p in _STEP_PREFIXES if not any(s.step == p for s in sources)]
    if missing:
        parts.append("**Missing step outputs:**\n")
        for m in missing:
            desc = _STEP_DESCRIPTIONS.get(m, m)
            parts.append(f"- ⚠ {desc}")
        parts.append(
            "\nArchitecture design (Step 6) can proceed with available data, "
            "but the gaps above should be filled for completeness.\n"
        )
    else:
        parts.append("All step outputs (1–4) are available. No gaps detected.\n")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Merge Steps 1-4 research outputs for Step 6 architecture",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: cwd)",
    )
    args = parser.parse_args(argv)
    project_dir: Path = args.project_dir.resolve()

    outputs_dir = project_dir / "outputs"
    output_path = outputs_dir / "preprocessed" / "step-06-research-merged.md"

    # Discover source files
    sources = _discover_files(outputs_dir)

    # Build merged document
    merged = _build_merged_document(sources, outputs_dir, project_dir)

    # Write
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(merged, encoding="utf-8")

    # Summary
    total_size = 0
    for sf in sources:
        try:
            total_size += sf.path.stat().st_size
        except OSError:
            pass

    steps_found = sorted(set(s.step for s in sources))
    steps_missing = [p for p in _STEP_PREFIXES if p not in steps_found]

    print(f"Files merged: {len(sources)}")
    if sources:
        print(f"  Steps present: {', '.join(steps_found)}")
    if steps_missing:
        print(f"  Steps missing: {', '.join(steps_missing)}")
    print(f"Total source content: {total_size:,} bytes")
    print(f"Output: {os.path.relpath(output_path, project_dir)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
