#!/usr/bin/env python3
"""
P1 Step Output Validator — validates step output structure against JSON Schema.

Usage: python3 validate_step_output.py --project-dir . --step N --output-json FILE

Validates that step completion data conforms to step-schemas/step-NN.json.
Note: Uses a minimal JSON Schema validator (no jsonschema pip package needed).
"""
import argparse
import json
import os
import sys


def validate_required(data, schema, path="", root_schema=None):
    """Minimal JSON Schema required field validator."""
    errors = []

    if root_schema is None:
        root_schema = schema

    if not isinstance(schema, dict):
        return errors

    # Resolve $ref
    if "$ref" in schema:
        ref_path = schema["$ref"]
        if ref_path.startswith("#/$defs/"):
            def_name = ref_path.split("/")[-1]
            defs = root_schema.get("$defs", {})
            if def_name in defs:
                schema = defs[def_name]
            else:
                errors.append(f"{path}: unresolved $ref {ref_path}")
                return errors

    # Check type
    expected_type = schema.get("type")
    if expected_type:
        type_map = {
            "object": dict,
            "array": list,
            "string": str,
            "integer": int,
            "number": (int, float),
            "boolean": bool,
        }
        if expected_type in type_map:
            if not isinstance(data, type_map[expected_type]):
                errors.append(
                    f"{path}: expected {expected_type}, got {type(data).__name__}"
                )
                return errors

    # Check const
    if "const" in schema:
        if data != schema["const"]:
            errors.append(
                f"{path}: expected const {schema['const']!r}, got {data!r}"
            )

    # Check enum
    if "enum" in schema:
        if data not in schema["enum"]:
            errors.append(
                f"{path}: value {data!r} not in enum {schema['enum']}"
            )

    # Check minimum
    if "minimum" in schema and isinstance(data, (int, float)):
        if data < schema["minimum"]:
            errors.append(
                f"{path}: {data} < minimum {schema['minimum']}"
            )

    # Check maximum
    if "maximum" in schema and isinstance(data, (int, float)):
        if data > schema["maximum"]:
            errors.append(
                f"{path}: {data} > maximum {schema['maximum']}"
            )

    # Check minLength
    if "minLength" in schema and isinstance(data, str):
        if len(data) < schema["minLength"]:
            errors.append(
                f"{path}: string length {len(data)} < minLength {schema['minLength']}"
            )

    # Check minItems
    if "minItems" in schema and isinstance(data, list):
        if len(data) < schema["minItems"]:
            errors.append(
                f"{path}: array length {len(data)} < minItems {schema['minItems']}"
            )

    # Check required fields and properties
    if expected_type == "object" and isinstance(data, dict):
        for field in schema.get("required", []):
            if field not in data:
                errors.append(f"{path}.{field}: required field missing")

        # Validate properties
        props = schema.get("properties", {})
        for field, field_schema in props.items():
            if field in data:
                errors.extend(
                    validate_required(
                        data[field],
                        field_schema,
                        f"{path}.{field}",
                        root_schema,
                    )
                )

    # Check array items
    if expected_type == "array" and isinstance(data, list):
        items_schema = schema.get("items")
        if items_schema:
            for idx, item in enumerate(data):
                errors.extend(
                    validate_required(
                        item,
                        items_schema,
                        f"{path}[{idx}]",
                        root_schema,
                    )
                )

    return errors


def main():
    parser = argparse.ArgumentParser(
        description="P1 Step Output Validator"
    )
    parser.add_argument(
        "--project-dir",
        default=os.environ.get("CLAUDE_PROJECT_DIR", "."),
    )
    parser.add_argument("--step", type=int, required=True)
    parser.add_argument(
        "--output-json",
        required=True,
        help="Path to step output JSON",
    )
    args = parser.parse_args()

    # Load schema
    schema_path = os.path.join(
        args.project_dir, "step-schemas", f"step-{args.step:02d}.json"
    )
    if not os.path.exists(schema_path):
        print(f"WARNING: No schema found for step {args.step} — skipping")
        sys.exit(0)

    try:
        with open(schema_path) as f:
            schema = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: Malformed schema file: {e}")
        sys.exit(1)

    # Load output
    output_path = args.output_json
    if not os.path.isabs(output_path):
        output_path = os.path.join(args.project_dir, output_path)

    if not os.path.exists(output_path):
        print(f"FAIL: Output file not found: {args.output_json}")
        sys.exit(1)

    try:
        with open(output_path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"FAIL: Malformed output JSON: {e}")
        sys.exit(1)

    # Validate
    errors = validate_required(data, schema)

    if errors:
        print(f"FAIL: Step {args.step} output validation FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print(f"PASS: Step {args.step} output conforms to schema")
        sys.exit(0)


if __name__ == "__main__":
    main()
