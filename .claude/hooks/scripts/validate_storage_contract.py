#!/usr/bin/env python3
"""
validate_storage_contract.py — Anti-Hallucination Layer 2
=========================================================
Cross-validates Rust storage structs against TypeScript Zod schemas.

Parses:
  - app/src-tauri/src/commands/storage.rs  (Rust structs with serde camelCase)
  - app/src/db/schema/storage-schemas.ts   (Zod schemas)

Verifies:
  1. Field name 1:1 correspondence (Rust snake_case → camelCase == Zod field)
  2. Type compatibility (i64↔z.number().int(), f64↔z.number(), etc.)
  3. Nullable alignment (Option<T> ↔ .nullable())
  4. Field count equality per struct

Exit codes:
  0 — All contracts valid
  1 — Contract violation detected

Usage:
  python3 validate_storage_contract.py
  python3 validate_storage_contract.py --verbose
"""

import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
RUST_FILE = PROJECT_ROOT / "app" / "src-tauri" / "src" / "commands" / "storage.rs"
ZOD_FILE = PROJECT_ROOT / "app" / "src" / "db" / "schema" / "storage-schemas.ts"

# Map Rust struct name → Zod schema name
STRUCT_TO_SCHEMA = {
    "SaveGamePayload": "SaveGamePayloadSchema",
    "MovePayload": "MovePayloadSchema",
    "GameSummary": "GameSummarySchema",
    "GameRecord": "GameRecordSchema",
    "GameFilter": "GameFilterSchema",
}

# Rust type → expected Zod type pattern
TYPE_MAP = {
    "String": r"z\.string\(\)",
    "i64": r"z\.number\(\)\.int\(\)",
    "f64": r"z\.number\(\)",
    "bool": r"z\.boolean\(\)",
}

VERBOSE = "--verbose" in sys.argv


def log(msg: str) -> None:
    if VERBOSE:
        print(f"  [DEBUG] {msg}")


# ---------------------------------------------------------------------------
# Rust Parser
# ---------------------------------------------------------------------------

def snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase (matching serde rename_all = camelCase)."""
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def parse_rust_structs(source: str) -> dict[str, list[dict]]:
    """
    Extract fields from Rust structs that have #[serde(rename_all = "camelCase")].
    Returns: { struct_name: [{ name, camel_name, rust_type, optional, vec }] }
    """
    structs: dict[str, list[dict]] = {}

    # Find struct blocks with serde camelCase
    # Pattern: #[derive(...Serialize, Deserialize...)]
    #          #[serde(rename_all = "camelCase")]
    #          pub struct StructName { ... }
    struct_pattern = re.compile(
        r'#\[serde\(rename_all\s*=\s*"camelCase"\)\]\s*'
        r'pub\s+struct\s+(\w+)\s*\{([^}]+)\}',
        re.DOTALL,
    )

    for match in struct_pattern.finditer(source):
        struct_name = match.group(1)
        body = match.group(2)

        fields = []
        # Match: pub field_name: Type,
        field_pattern = re.compile(r'pub\s+(\w+)\s*:\s*([^,\n]+)')
        for field_match in field_pattern.finditer(body):
            raw_name = field_match.group(1)
            raw_type = field_match.group(2).strip().rstrip(",").strip()

            # Detect Option<T>
            optional = raw_type.startswith("Option<")
            inner_type = raw_type
            if optional:
                inner_type = re.sub(r'^Option<(.+)>$', r'\1', raw_type)

            # Detect Vec<T>
            vec = inner_type.startswith("Vec<")
            if vec:
                inner_type = re.sub(r'^Vec<(.+)>$', r'\1', inner_type)

            fields.append({
                "name": raw_name,
                "camel_name": snake_to_camel(raw_name),
                "rust_type": inner_type,
                "optional": optional,
                "vec": vec,
                "raw_type": raw_type,
            })
            log(f"Rust {struct_name}.{raw_name} → {snake_to_camel(raw_name)} : {raw_type}")

        structs[struct_name] = fields

    return structs


# ---------------------------------------------------------------------------
# Zod Parser
# ---------------------------------------------------------------------------

def parse_zod_schemas(source: str) -> dict[str, list[dict]]:
    """
    Extract fields from Zod schemas (z.object({ ... })).
    Returns: { schema_name: [{ name, nullable, array, zod_type }] }
    """
    schemas: dict[str, list[dict]] = {}

    # Find: export const SchemaName = z.object({ ... })
    schema_pattern = re.compile(
        r'export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\{([^}]+)\}\)',
        re.DOTALL,
    )

    for match in schema_pattern.finditer(source):
        schema_name = match.group(1)
        body = match.group(2)

        fields = []
        # Match: fieldName: z.something(),
        field_pattern = re.compile(r'(\w+)\s*:\s*(z\.[^,\n]+)')
        for field_match in field_pattern.finditer(body):
            field_name = field_match.group(1)
            zod_expr = field_match.group(2).strip().rstrip(",").strip()

            nullable = ".nullable()" in zod_expr
            optional = ".optional()" in zod_expr
            is_array = zod_expr.startswith("z.array(")

            fields.append({
                "name": field_name,
                "nullable": nullable,
                "optional": optional,
                "array": is_array,
                "zod_type": zod_expr,
            })
            log(f"Zod {schema_name}.{field_name} : {zod_expr}")

        schemas[schema_name] = fields

    return schemas


# ---------------------------------------------------------------------------
# Contract Validation
# ---------------------------------------------------------------------------

def validate_contracts(
    rust_structs: dict[str, list[dict]],
    zod_schemas: dict[str, list[dict]],
) -> list[str]:
    """Validate Rust struct ↔ Zod schema correspondence. Returns error messages."""
    errors: list[str] = []

    for rust_name, zod_name in STRUCT_TO_SCHEMA.items():
        if rust_name not in rust_structs:
            errors.append(f"MISSING: Rust struct '{rust_name}' not found in storage.rs")
            continue
        if zod_name not in zod_schemas:
            errors.append(f"MISSING: Zod schema '{zod_name}' not found in storage-schemas.ts")
            continue

        rust_fields = rust_structs[rust_name]
        zod_fields = zod_schemas[zod_name]

        # Build lookup maps
        rust_by_camel = {f["camel_name"]: f for f in rust_fields}
        zod_by_name = {f["name"]: f for f in zod_fields}

        # Check field count
        if len(rust_fields) != len(zod_fields):
            errors.append(
                f"COUNT: {rust_name} has {len(rust_fields)} fields, "
                f"{zod_name} has {len(zod_fields)} fields"
            )

        # Check each Rust field exists in Zod
        for rf in rust_fields:
            camel = rf["camel_name"]
            if camel not in zod_by_name:
                errors.append(
                    f"MISSING_FIELD: {rust_name}.{rf['name']} "
                    f"(→ {camel}) not found in {zod_name}"
                )
                continue

            zf = zod_by_name[camel]

            # Check nullable alignment
            if rf["optional"] and not zf["nullable"] and not zf["optional"]:
                errors.append(
                    f"NULLABLE: {rust_name}.{rf['name']} is Option<> "
                    f"but {zod_name}.{camel} is not .nullable()/.optional()"
                )
            if not rf["optional"] and zf["nullable"]:
                errors.append(
                    f"NULLABLE: {rust_name}.{rf['name']} is NOT Option<> "
                    f"but {zod_name}.{camel} has .nullable()"
                )

            # Check Vec alignment
            if rf["vec"] and not zf["array"]:
                errors.append(
                    f"ARRAY: {rust_name}.{rf['name']} is Vec<> "
                    f"but {zod_name}.{camel} is not z.array()"
                )
            if not rf["vec"] and zf["array"]:
                errors.append(
                    f"ARRAY: {rust_name}.{rf['name']} is NOT Vec<> "
                    f"but {zod_name}.{camel} is z.array()"
                )

            # Check base type compatibility
            base_type = rf["rust_type"]
            if base_type in TYPE_MAP:
                expected_pattern = TYPE_MAP[base_type]
                # Strip nullable/optional/array wrappers for type check
                zod_base = zf["zod_type"]
                zod_base = zod_base.replace(".nullable()", "").replace(".optional()", "")
                if zod_base.startswith("z.array("):
                    # Extract inner type from z.array(InnerSchema)
                    pass  # Skip base type check for array items (checked by schema ref)
                elif not re.search(expected_pattern, zod_base):
                    errors.append(
                        f"TYPE: {rust_name}.{rf['name']} ({base_type}) expects "
                        f"'{expected_pattern}' but got '{zf['zod_type']}'"
                    )

        # Check each Zod field exists in Rust
        for zf in zod_fields:
            if zf["name"] not in rust_by_camel:
                errors.append(
                    f"EXTRA_FIELD: {zod_name}.{zf['name']} "
                    f"has no matching field in {rust_name}"
                )

    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print("=" * 60)
    print("Storage Contract Validator (Anti-Hallucination L2)")
    print("=" * 60)

    # Check files exist
    if not RUST_FILE.exists():
        print(f"ERROR: Rust file not found: {RUST_FILE}")
        return 1
    if not ZOD_FILE.exists():
        print(f"ERROR: Zod file not found: {ZOD_FILE}")
        return 1

    rust_source = RUST_FILE.read_text(encoding="utf-8")
    zod_source = ZOD_FILE.read_text(encoding="utf-8")

    print(f"\nParsing: {RUST_FILE.name}")
    rust_structs = parse_rust_structs(rust_source)
    print(f"  Found {len(rust_structs)} struct(s): {', '.join(rust_structs.keys())}")

    print(f"\nParsing: {ZOD_FILE.name}")
    zod_schemas = parse_zod_schemas(zod_source)
    print(f"  Found {len(zod_schemas)} schema(s): {', '.join(zod_schemas.keys())}")

    print("\nValidating contracts...")
    errors = validate_contracts(rust_structs, zod_schemas)

    if errors:
        print(f"\n{'!' * 60}")
        print(f"CONTRACT VIOLATIONS: {len(errors)}")
        print(f"{'!' * 60}")
        for i, err in enumerate(errors, 1):
            print(f"  [{i}] {err}")
        return 1

    # Print summary
    print(f"\n{'=' * 60}")
    print("ALL CONTRACTS VALID")
    print(f"{'=' * 60}")
    for rust_name, zod_name in STRUCT_TO_SCHEMA.items():
        if rust_name in rust_structs and zod_name in zod_schemas:
            n = len(rust_structs[rust_name])
            print(f"  [OK] {rust_name} ({n} fields) ↔ {zod_name} ({n} fields)")
        else:
            print(f"  [SKIP] {rust_name} or {zod_name} not found")

    return 0


if __name__ == "__main__":
    sys.exit(main())
