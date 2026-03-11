#!/usr/bin/env python3
"""
P1 Deterministic Step Metadata Provider — query_step.py

Hallucination prevention: Encodes the COMPLETE step execution matrix from
workflow.md as a Python data structure. Orchestrator calls this INSTEAD of
interpreting orchestration-protocol.md (markdown).

Principle: "LLM = Orchestrator (coordinator), Python = truth source"

Usage:
    python3 query_step.py --step N
    python3 query_step.py --step N --check-deps --project-dir .
    python3 query_step.py --pipeline --project-dir .

Modes:
    --step N          Return step metadata as JSON (agent, type, scripts, etc.)
    --check-deps      Check if upstream dependency outputs exist on disk
    --pipeline        Show full 25-step dependency graph with satisfaction status

P1 Compliance: All data is hardcoded from workflow.md (deterministic).
SOT Compliance: Read-only — checks file existence, never writes.
"""
import argparse
import json
import os
import sys

# =============================================================================
# STEP_MATRIX — Single Source of Truth for step metadata
# Encoded from prompt/workflow.md (authoritative) + cross-verified with
# .claude/skills/workflow-executor/references/orchestration-protocol.md
#
# IMPORTANT: orchestration-protocol.md had MISSING data (Step 1 post-processing).
# This script is the CORRECTED, COMPLETE, DETERMINISTIC reference.
# =============================================================================

STEP_MATRIX = {
    1: {
        "name": "Technology Stack Validation PoC",
        "phase": "research",
        "type": "agent",
        "agent": "tech-validator",
        "model": "sonnet",
        "team": None,
        "pre_processing": ["scripts/extract_prd_tech_stack.py"],
        "post_processing": ["scripts/extract_tech_constraints.py"],
        "review": ["fact-checker"],
        "translation": True,
        "upstream_deps": [],
        "outputs": {
            "report": "outputs/step-01-tech-validation-report.md",
            "report_ko": "outputs/step-01-tech-validation-report.ko.md",
        },
    },
    2: {
        "name": "KataGo Analysis Engine Research",
        "phase": "research",
        "type": "agent",
        "agent": "katago-researcher",
        "model": "opus",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": ["fact-checker"],
        "translation": True,
        "upstream_deps": [],
        "outputs": {
            "spec": "outputs/step-02-katago-ipc-spec.md",
            "spec_ko": "outputs/step-02-katago-ipc-spec.ko.md",
        },
    },
    3: {
        "name": "Baduk Domain Knowledge Construction",
        "phase": "research",
        "type": "agent",
        "agent": "domain-expert",
        "model": "opus",
        "team": None,
        "pre_processing": [],
        "post_processing": [
            "python3 .claude/hooks/scripts/validate_domain_knowledge.py "
            "--project-dir . --check-output --step 3"
        ],
        "review": ["fact-checker"],
        "translation": True,
        "upstream_deps": [],
        "outputs": {
            "dks": "outputs/step-03-domain-knowledge.yaml",
            "rules_spec": "outputs/step-03-rules-spec.md",
            "rules_spec_ko": "outputs/step-03-rules-spec.ko.md",
        },
    },
    4: {
        "name": "Template Explanation Engine Design",
        "phase": "research",
        "type": "agent",
        "agent": "template-designer",
        "model": "opus",
        "team": None,
        "pre_processing": ["scripts/collect_katago_samples.py"],
        "post_processing": [],
        "review": ["reviewer", "fact-checker"],
        "translation": True,
        "upstream_deps": [2, 3],
        "outputs": {
            "design": "outputs/step-04-template-engine-design.md",
            "catalog": "outputs/step-04-pattern-catalog.yaml",
            "design_ko": "outputs/step-04-template-engine-design.ko.md",
        },
    },
    5: {
        "name": "Research Review & Direction Approval",
        "phase": "research",
        "type": "human",
        "agent": None,
        "model": None,
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [1, 2, 3, 4],
        "outputs": {},
        "command": "/review-research",
        "autopilot_rule": "auto-approve if all Step 1-4 pACS >= 70",
    },
    6: {
        "name": "System Architecture Design",
        "phase": "planning",
        "type": "agent",
        "agent": "architect",
        "model": "opus",
        "team": None,
        "pre_processing": ["scripts/merge_research_outputs.py"],
        "post_processing": [
            "python3 .claude/hooks/scripts/validate_traceability.py "
            "--project-dir . --check-output --step 6"
        ],
        "review": ["reviewer"],
        "translation": True,
        "upstream_deps": [1, 2, 3, 4],
        "outputs": {
            "design": "outputs/step-06-architecture-design.md",
            "design_ko": "outputs/step-06-architecture-design.ko.md",
        },
    },
    7: {
        "name": "Data Model & Interface Contracts",
        "phase": "planning",
        "type": "agent",
        "agent": "schema-designer",
        "model": "opus",
        "team": None,
        "pre_processing": ["scripts/extract_entities_from_dks.py"],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": True,
        "upstream_deps": [3, 6],
        "outputs": {
            "data_model": "outputs/step-07-data-model.md",
            "schema_ts": "outputs/step-07-schema.ts",
            "interfaces_ts": "outputs/step-07-interfaces.ts",
            "data_model_ko": "outputs/step-07-data-model.ko.md",
        },
    },
    8: {
        "name": "Test Strategy & Parallel Execution Plan",
        "phase": "planning",
        "type": "agent",
        "agent": "strategy-planner",
        "model": "sonnet",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": True,
        "upstream_deps": [3, 6, 7],
        "outputs": {
            "test_strategy": "outputs/step-08-test-strategy.md",
            "parallel_plan": "outputs/step-08-parallel-plan.md",
            "test_strategy_ko": "outputs/step-08-test-strategy.ko.md",
        },
    },
    9: {
        "name": "Architecture & Plan Approval",
        "phase": "planning",
        "type": "human",
        "agent": None,
        "model": None,
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [6, 7, 8],
        "outputs": {},
        "command": "/review-architecture",
        "autopilot_rule": "auto-approve if all Step 6-8 pACS >= 70 and DAG acyclic",
    },
    10: {
        "name": "Project Scaffolding",
        "phase": "m1",
        "type": "team",
        "agent": None,
        "model": None,
        "team": "m1-scaffold",
        "teammates": [
            {
                "name": "scaffold-frontend",
                "model": "sonnet",
                "prompt": (
                    "Set up Vite + React 19 + TypeScript strict + Tailwind CSS 4 "
                    "+ shadcn/ui + Zustand + Biome v2.3 + Vitest. Create project "
                    "structure matching Step 6 module boundaries."
                ),
            },
            {
                "name": "scaffold-backend",
                "model": "sonnet",
                "prompt": (
                    "Set up Tauri 2.0 with Rust sidecar configuration. Configure "
                    "SQLite + Drizzle ORM with Step 7 schema. Set up KataGo "
                    "sidecar binary path configuration."
                ),
            },
        ],
        "join_verification": "npm run tauri build succeeds",
        "checkpoint": "standard",
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [6, 7, 8],
        "outputs": {},
    },
    11: {
        "name": "Core Modules — Rules Engine + Data Layer",
        "phase": "m1",
        "type": "team",
        "agent": None,
        "model": None,
        "team": "m1-core",
        "teammates": [
            {
                "name": "rules-engineer",
                "model": "opus",
                "prompt": (
                    "Implement Tromp-Taylor rules engine in TypeScript. "
                    "1D Uint8Array board. Zobrist hashing. 130+ tests. "
                    "Reference: outputs/step-03-rules-spec.md"
                ),
            },
            {
                "name": "data-engineer",
                "model": "sonnet",
                "prompt": (
                    "Implement SQLite data layer + GameReducer. Drizzle ORM "
                    "from Step 7 schema. SGF export. "
                    "Reference: outputs/step-07-schema.ts"
                ),
            },
        ],
        "join_verification": "Combined test suite passes, no interface conflicts",
        "checkpoint": "dense",
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [3, 7, 8, 10],
        "outputs": {},
    },
    12: {
        "name": "KataGo Integration",
        "phase": "m1",
        "type": "agent",
        "agent": "katago-integrator",
        "model": "opus",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [2, 7, 10, 11],
        "outputs": {},
        "human_review_protocol": {
            "enabled": True,
            "max_iterations": 3,
            "automation_rate": "20-30%",
            "description": "KataGo IPC correctness review",
        },
    },
    13: {
        "name": "Template Explanation Engine V1",
        "phase": "m1",
        "type": "agent",
        "agent": "template-engineer",
        "model": "opus",
        "team": None,
        "pre_processing": ["scripts/prepare_katago_test_data.py"],
        "post_processing": [],
        "review": ["reviewer", "fact-checker"],
        "translation": False,
        "upstream_deps": [2, 4, 7, 12],
        "outputs": {},
    },
    14: {
        "name": "Golden Dataset Validation",
        "phase": "m1",
        "type": "human",
        "agent": None,
        "model": None,
        "team": None,
        "pre_processing": ["scripts/generate_template_outputs.py"],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [13],
        "outputs": {},
        "command": "/validate-golden-dataset",
        "autopilot_rule": (
            "auto-approve if coverage >= 80% AND high-risk fallback 100% "
            "AND no factual errors"
        ),
    },
    15: {
        "name": "M1 Integration & Cross-Module Testing",
        "phase": "m1",
        "type": "agent",
        "agent": "integration-tester",
        "model": "sonnet",
        "team": None,
        "pre_processing": [],
        "post_processing": [
            "python3 .claude/hooks/scripts/validate_traceability.py "
            "--project-dir . --check-output --step 15"
        ],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [11, 12, 13],
        "outputs": {
            "report": "outputs/step-15-m1-integration-report.md",
        },
    },
    16: {
        "name": "M1 Go/No-Go Gate",
        "phase": "m1",
        "type": "human",
        "agent": None,
        "model": None,
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [15],
        "outputs": {},
        "command": "/go-no-go M1",
        "autopilot_rule": "MANUAL — Go/No-Go gates require user decision",
        "is_manual_gate": True,
    },
    17: {
        "name": "UI/UX Implementation",
        "phase": "m2",
        "type": "team",
        "agent": None,
        "model": None,
        "team": "m2-ui",
        "teammates": [
            {
                "name": "board-developer",
                "model": "opus",
                "prompt": (
                    "Go board SVG UI. Fork Shudan. 20 components. KaTrain colors. "
                    "9x9/13x13/19x19. Tap-Preview-Confirm. Pinch-zoom."
                ),
            },
            {
                "name": "screen-developer",
                "model": "sonnet",
                "prompt": (
                    "Application screens: Home, Game, Analysis, Settings, QuickGo, "
                    "Onboarding. React Router + Zustand. Responsive + dark/light."
                ),
            },
            {
                "name": "i18n-developer",
                "model": "sonnet",
                "prompt": (
                    "react-i18next with en/ko/ja. Extract all UI strings. "
                    "Language detection and switching."
                ),
            },
        ],
        "join_verification": "All UI modules render, navigation works, i18n switches",
        "checkpoint": "dense",
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [6, 7, 11, 15],
        "outputs": {},
    },
    18: {
        "name": "Quick Go MVP",
        "phase": "m2",
        "type": "agent",
        "agent": "game-developer",
        "model": "opus",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [11, 12, 13, 17],
        "outputs": {},
    },
    19: {
        "name": "Multi-platform Build & CI/CD",
        "phase": "m2",
        "type": "agent",
        "agent": "devops-engineer",
        "model": "sonnet",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [1, 6],
        "outputs": {},
    },
    20: {
        "name": "Analytics & Monitoring Integration",
        "phase": "m2",
        "type": "agent",
        "agent": "integration-developer",
        "model": "sonnet",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [6, 7, 19],
        "outputs": {},
    },
    21: {
        "name": "Integration Testing & Hardening",
        "phase": "m2",
        "type": "agent",
        "agent": "qa-engineer",
        "model": "sonnet",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [15, 18, 19, 20],
        "outputs": {
            "report": "outputs/step-21-qa-report.md",
        },
    },
    22: {
        "name": "M2 Go/No-Go Gate",
        "phase": "m2",
        "type": "human",
        "agent": None,
        "model": None,
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [21],
        "outputs": {},
        "command": "/go-no-go M2",
        "autopilot_rule": "MANUAL — Go/No-Go gates require user decision",
        "is_manual_gate": True,
    },
    23: {
        "name": "Final Features & Polish",
        "phase": "m3",
        "type": "team",
        "agent": None,
        "model": None,
        "team": "m3-features",
        "teammates": [
            {
                "name": "onboarding-developer",
                "model": "opus",
                "prompt": (
                    "Zero-to-First-Game onboarding. Interactive tutorial. "
                    "5 minutes, 70%+ completion. Anonymous-first."
                ),
            },
            {
                "name": "gamification-developer",
                "model": "sonnet",
                "prompt": (
                    "Daily quests, XP/level, streaks, badges. "
                    "Store in local SQLite."
                ),
            },
            {
                "name": "optimization-engineer",
                "model": "sonnet",
                "prompt": (
                    "Bundle size optimization, KataGo startup optimization, "
                    "SQLite WAL tuning, React rendering optimization."
                ),
            },
        ],
        "join_verification": "Full regression passes, app size <100MB",
        "checkpoint": "dense",
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": False,
        "upstream_deps": [7, 21],
        "outputs": {},
    },
    24: {
        "name": "Code Signing & Release Preparation",
        "phase": "m3",
        "type": "agent",
        "agent": "release-engineer",
        "model": "sonnet",
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": ["reviewer"],
        "translation": True,
        "upstream_deps": [19, 21, 23],
        "outputs": {
            "release_notes": "outputs/step-24-release-notes.md",
            "release_notes_ko": "outputs/step-24-release-notes.ko.md",
        },
    },
    25: {
        "name": "M3 Go/No-Go — Final Launch Decision",
        "phase": "m3",
        "type": "human",
        "agent": None,
        "model": None,
        "team": None,
        "pre_processing": [],
        "post_processing": [],
        "review": [],
        "translation": False,
        "upstream_deps": [24],
        "outputs": {},
        "command": "/go-no-go M3",
        "autopilot_rule": "MANUAL — Final launch requires user decision",
        "is_manual_gate": True,
    },
}

# Total steps constant
TOTAL_STEPS = 25


def _check_sot_step_completion(step_num, project_dir):
    """Check if SOT records a step as completed (has output entry).

    Read-only SOT access. Checks if outputs.step-N exists in state.yaml.
    Uses regex parsing (no PyYAML dependency) for P1 determinism.
    Returns True if step is recorded, False otherwise.
    """
    sot_candidates = [
        os.path.join(project_dir, ".claude", "state.yaml"),
        os.path.join(project_dir, "state.yaml"),
    ]
    for sot_path in sot_candidates:
        if not os.path.isfile(sot_path):
            continue
        try:
            with open(sot_path, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception:
            continue
        # Check if outputs section has step-N entry (uncommented)
        import re
        pattern = rf'^\s+step-{step_num}\b'
        for line in content.split('\n'):
            stripped = line.lstrip()
            if stripped.startswith('#'):
                continue  # Skip commented-out lines
            if re.match(pattern, line):
                return True
        return False
    return False


def get_step(step_num):
    """Return step metadata as dict. Returns None if step not found."""
    return STEP_MATRIX.get(step_num)


def check_deps(step_num, project_dir):
    """Check if all upstream dependency outputs exist on disk.

    Returns dict with:
        satisfied: bool — all deps have outputs
        missing: list — missing output file paths
        deps_checked: list — upstream step numbers
    """
    step = STEP_MATRIX.get(step_num)
    if not step:
        return {"error": f"Step {step_num} not found in STEP_MATRIX"}

    deps = step.get("upstream_deps", [])
    if not deps:
        return {"satisfied": True, "missing": [], "deps_checked": []}

    missing = []
    for dep_step in deps:
        dep = STEP_MATRIX.get(dep_step)
        if not dep:
            continue
        outputs = dep.get("outputs", {})
        if not outputs:
            # Team/human/impl steps without explicit file outputs:
            # Fall back to SOT completion check — read state.yaml to see
            # if step was recorded as completed in outputs map.
            sot_completed = _check_sot_step_completion(dep_step, project_dir)
            if not sot_completed:
                missing.append({
                    "step": dep_step,
                    "output_key": "_sot_completion",
                    "expected_path": f"(SOT outputs.step-{dep_step} not recorded)",
                })
            continue
        for key, path in outputs.items():
            # Skip Korean translations for dependency checks
            if key.endswith("_ko"):
                continue
            full_path = os.path.join(project_dir, path)
            if not os.path.isfile(full_path):
                missing.append({
                    "step": dep_step,
                    "output_key": key,
                    "expected_path": path,
                })

    return {
        "satisfied": len(missing) == 0,
        "missing": missing,
        "deps_checked": deps,
    }


def pipeline_status(project_dir):
    """Show full 25-step pipeline with dependency satisfaction status."""
    result = []
    for step_num in range(1, TOTAL_STEPS + 1):
        step = STEP_MATRIX[step_num]
        deps = check_deps(step_num, project_dir)
        result.append({
            "step": step_num,
            "name": step["name"],
            "phase": step["phase"],
            "type": step["type"],
            "agent_or_team": step.get("agent") or step.get("team") or "—",
            "deps_satisfied": deps.get("satisfied", True),
            "missing_deps": deps.get("missing", []),
        })
    return result


def main():
    parser = argparse.ArgumentParser(
        description="P1 Deterministic Step Metadata Provider"
    )
    parser.add_argument("--step", type=int, help="Step number (1-25)")
    parser.add_argument(
        "--check-deps", action="store_true",
        help="Check upstream dependency outputs exist"
    )
    parser.add_argument(
        "--pipeline", action="store_true",
        help="Show full pipeline dependency status"
    )
    parser.add_argument(
        "--project-dir",
        default=os.environ.get("CLAUDE_PROJECT_DIR", "."),
        help="Project root directory"
    )
    args = parser.parse_args()

    project_dir = os.path.abspath(args.project_dir)

    if args.pipeline:
        result = {
            "mode": "pipeline",
            "total_steps": TOTAL_STEPS,
            "steps": pipeline_status(project_dir),
        }
    elif args.step is not None:
        if args.step < 1 or args.step > TOTAL_STEPS:
            result = {"error": f"Step must be 1-{TOTAL_STEPS}, got {args.step}"}
        else:
            step_data = get_step(args.step)
            result = {"mode": "step", "step": args.step, **step_data}
            if args.check_deps:
                result["dependency_check"] = check_deps(args.step, project_dir)
    else:
        parser.print_help()
        sys.exit(1)

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
