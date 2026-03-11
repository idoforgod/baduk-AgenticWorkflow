#!/usr/bin/env python3
"""Extract technology constraints from Step 1 validation report → YAML for Step 6 input."""
import re
import os

REPORT = "outputs/step-01-tech-validation-report.md"
OUTPUT = "outputs/preprocessed/step-01-tech-constraints.yaml"


def main():
    if not os.path.exists(REPORT):
        print(f"ERROR: {REPORT} not found")
        return

    with open(REPORT, "r") as f:
        content = f.read()

    # Extract Section 7: Critical Constraints
    match = re.search(
        r"## 7\. Critical Constraints.*?\n(.*?)(?=\n## |\Z)",
        content,
        re.DOTALL,
    )

    constraints = []
    if match:
        lines = match.group(1).strip().split("\n")
        for line in lines:
            m = re.match(r"\d+\.\s+\*\*(.+?)\*\*:\s+(.+)", line.strip())
            if m:
                constraints.append({"id": m.group(1).strip(), "detail": m.group(2).strip()})

    # Extract version matrix
    versions = {}
    version_section = re.search(
        r"### Frontend \(npm\).*?\n\|.*?\n\|.*?\n(.*?)(?=\n###|\n---|\n##)",
        content,
        re.DOTALL,
    )
    if version_section:
        for line in version_section.group(1).strip().split("\n"):
            cols = [c.strip() for c in line.split("|") if c.strip()]
            if len(cols) >= 3 and cols[0] not in ("Package",):
                versions[cols[0]] = cols[2]

    # Write YAML
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as f:
        f.write("# Auto-generated from Step 1 validation report\n")
        f.write(f"# Source: {REPORT}\n\n")
        f.write("constraints:\n")
        for i, c in enumerate(constraints, 1):
            f.write(f'  - id: "TC-{i}"\n')
            f.write(f'    name: "{c["id"]}"\n')
            f.write(f'    detail: "{c["detail"]}"\n')
        f.write("\nversions:\n")
        for pkg, ver in sorted(versions.items()):
            f.write(f'  "{pkg}": "{ver}"\n')

    print(f"Constraints extracted: {len(constraints)}")
    print(f"Versions extracted: {len(versions)}")
    print(f"Output: {OUTPUT}")


if __name__ == "__main__":
    main()
