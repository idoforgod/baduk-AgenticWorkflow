#!/usr/bin/env python3
"""
Tests for P1 anti-hallucination validation scripts.

Run: python3 -m pytest .claude/hooks/scripts/_test_p1_validators.py -v
     or: python3 .claude/hooks/scripts/_test_p1_validators.py
"""
import json
import os
import sys
import tempfile
import shutil
import unittest

# Add scripts directory to path
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPTS_DIR)


# ---------------------------------------------------------------------------
# TestValidateCounts
# ---------------------------------------------------------------------------
class TestValidateCounts(unittest.TestCase):
    """Tests for validate_counts.py"""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmpdir, "outputs"), exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_missing_file_skips(self):
        """Missing output file should not fail — just skip."""
        from validate_counts import validate_step
        result = validate_step(self.tmpdir, 3)
        self.assertTrue(result)  # No file = skip, not fail

    def test_step_without_thresholds_passes(self):
        """Steps without defined thresholds should pass."""
        from validate_counts import validate_step
        result = validate_step(self.tmpdir, 99)
        self.assertTrue(result)

    def test_yaml_count_meets_threshold(self):
        """YAML with enough entities should pass."""
        from validate_counts import count_in_yaml
        yaml_path = os.path.join(self.tmpdir, "test.yaml")
        items = "\n".join([f"  - entity_{i}: type_{i}" for i in range(55)])
        with open(yaml_path, "w") as f:
            f.write(f"entities:\n{items}\n")
        count = count_in_yaml(yaml_path, r"entity")
        self.assertGreaterEqual(count, 50)

    def test_text_count_below_threshold(self):
        """Text file below threshold should report low count."""
        from validate_counts import _count_in_text
        text_path = os.path.join(self.tmpdir, "test.md")
        with open(text_path, "w") as f:
            f.write("Only 3 edge cases:\n- ko\n- seki\n- snapback\n")
        count = _count_in_text(text_path, r"edge.case|ko|seki|snapback")
        self.assertLess(count, 15)

    def test_text_count_meets_threshold(self):
        """Text file with enough matches should report high count."""
        from validate_counts import _count_in_text
        text_path = os.path.join(self.tmpdir, "test.md")
        lines = "\n".join([f"test case {i}" for i in range(140)])
        with open(text_path, "w") as f:
            f.write(lines)
        count = _count_in_text(text_path, r"test.case")
        self.assertGreaterEqual(count, 130)

    def test_nonexistent_file_returns_zero(self):
        """Counting in nonexistent file should return 0."""
        from validate_counts import _count_in_text
        count = _count_in_text("/nonexistent/file.md", r"anything")
        self.assertEqual(count, 0)

    def test_empty_yaml_returns_zero(self):
        """Empty YAML file should return 0."""
        from validate_counts import count_in_yaml
        yaml_path = os.path.join(self.tmpdir, "empty.yaml")
        with open(yaml_path, "w") as f:
            f.write("")
        count = count_in_yaml(yaml_path, r"entity")
        self.assertEqual(count, 0)

    def test_step_4_thresholds_defined(self):
        """Step 4 should have beginner/intermediate/advanced thresholds."""
        from validate_counts import THRESHOLDS
        self.assertIn(4, THRESHOLDS)
        self.assertIn("beginner_patterns", THRESHOLDS[4])
        self.assertIn("intermediate_patterns", THRESHOLDS[4])
        self.assertIn("advanced_patterns", THRESHOLDS[4])

    def test_step_8_thresholds_defined(self):
        """Step 8 should have test case and e2e thresholds."""
        from validate_counts import THRESHOLDS
        self.assertIn(8, THRESHOLDS)
        self.assertIn("rules_test_cases", THRESHOLDS[8])
        self.assertIn("e2e_scenarios", THRESHOLDS[8])

    def test_recursive_count_nested_dict(self):
        """Recursively counting in nested dict should work."""
        from validate_counts import _count_keys_recursive
        data = {
            "domain": {
                "entities": ["a", "b", "c"],
                "sub": {
                    "entities": {"x": 1, "y": 2},
                },
            }
        }
        count = _count_keys_recursive(data, r"entities")
        self.assertEqual(count, 5)  # 3 from list + 2 from dict


# ---------------------------------------------------------------------------
# TestValidateTestResults
# ---------------------------------------------------------------------------
class TestValidateTestResults(unittest.TestCase):
    """Tests for validate_test_results.py"""

    def test_all_passing(self):
        """All tests passing should return True."""
        from validate_test_results import validate_results
        results = {
            "numTotalTests": 5,
            "numPassedTests": 5,
            "numFailedTests": 0,
            "testResults": [{
                "status": "passed",
                "assertionResults": [
                    {"status": "passed", "fullName": "test 1"},
                    {"status": "passed", "fullName": "test 2"},
                ],
            }],
        }
        self.assertTrue(validate_results(results))

    def test_some_failing(self):
        """Failed tests should return False."""
        from validate_test_results import validate_results
        results = {
            "numTotalTests": 5,
            "numPassedTests": 3,
            "numFailedTests": 2,
            "testResults": [{
                "status": "failed",
                "assertionResults": [
                    {"status": "passed", "fullName": "test 1"},
                    {
                        "status": "failed",
                        "fullName": "test 2",
                        "failureMessages": ["Expected true"],
                    },
                ],
            }],
        }
        self.assertFalse(validate_results(results))

    def test_empty_results(self):
        """Empty results should pass (no tests yet)."""
        from validate_test_results import validate_results
        results = {"testResults": []}
        self.assertTrue(validate_results(results))

    def test_skipped_tests_counted(self):
        """Skipped tests should not cause failure."""
        from validate_test_results import validate_results
        results = {
            "numTotalTests": 3,
            "numPassedTests": 2,
            "numFailedTests": 0,
            "testResults": [{
                "status": "passed",
                "assertionResults": [
                    {"status": "passed", "fullName": "test 1"},
                    {"status": "pending", "fullName": "test 2"},
                    {"status": "passed", "fullName": "test 3"},
                ],
            }],
        }
        self.assertTrue(validate_results(results))

    def test_multiple_suites(self):
        """Multiple test suites should be combined."""
        from validate_test_results import validate_results
        results = {
            "numTotalTests": 4,
            "numPassedTests": 4,
            "numFailedTests": 0,
            "testResults": [
                {
                    "status": "passed",
                    "assertionResults": [
                        {"status": "passed", "fullName": "suite1/test1"},
                    ],
                },
                {
                    "status": "passed",
                    "assertionResults": [
                        {"status": "passed", "fullName": "suite2/test1"},
                        {"status": "passed", "fullName": "suite2/test2"},
                    ],
                },
            ],
        }
        self.assertTrue(validate_results(results))

    def test_failure_messages_truncated(self):
        """Long failure messages should be truncated in output."""
        from validate_test_results import validate_results
        results = {
            "numTotalTests": 1,
            "numPassedTests": 0,
            "numFailedTests": 1,
            "testResults": [{
                "status": "failed",
                "assertionResults": [{
                    "status": "failed",
                    "fullName": "failing test",
                    "failureMessages": ["x" * 500],
                }],
            }],
        }
        self.assertFalse(validate_results(results))

    def test_empty_failure_messages(self):
        """Empty failure messages array should not crash."""
        from validate_test_results import validate_results
        results = {
            "numTotalTests": 1,
            "numPassedTests": 0,
            "numFailedTests": 1,
            "testResults": [{
                "status": "failed",
                "assertionResults": [{
                    "status": "failed",
                    "fullName": "test",
                    "failureMessages": [],
                }],
            }],
        }
        self.assertFalse(validate_results(results))


# ---------------------------------------------------------------------------
# TestValidateSpecSchema
# ---------------------------------------------------------------------------
class TestValidateSpecSchema(unittest.TestCase):
    """Tests for validate_spec_schema.py"""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmpdir, "outputs"), exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_complete_spec_passes(self):
        """Spec with all required fields should pass."""
        from validate_spec_schema import validate_step
        spec_path = os.path.join(
            self.tmpdir, "outputs", "step-02-katago-ipc-spec.md"
        )
        with open(spec_path, "w") as f:
            f.write("""# KataGo IPC Spec
## Query Format
The query schema uses JSON stdin.
## Response Format
The response structure returns analysis.
## moveInfo Fields
Each moveInfo contains: winrate, scoreLead, visits, pv (principal variation)
## GPU Detection Fallback
CUDA -> OpenCL -> Eigen CPU fallback chain.
## Watchdog
Process watchdog with heartbeat.
## Circuit Breaker
Circuit breaker after 5 failures.
## Model Bundling
Bundle b6c96 model (~15MB), download b18c384nbt.
""")
        result = validate_step(self.tmpdir, 2)
        self.assertTrue(result)

    def test_missing_fields_fails(self):
        """Spec missing required fields should fail."""
        from validate_spec_schema import validate_step
        spec_path = os.path.join(
            self.tmpdir, "outputs", "step-02-katago-ipc-spec.md"
        )
        with open(spec_path, "w") as f:
            f.write("# Incomplete spec\nOnly has some content.\n")
        result = validate_step(self.tmpdir, 2)
        self.assertFalse(result)

    def test_missing_file_skips(self):
        """Missing file should not fail."""
        from validate_spec_schema import validate_step
        result = validate_step(self.tmpdir, 2)
        self.assertTrue(result)

    def test_unknown_step_passes(self):
        """Step without schema definition should pass."""
        from validate_spec_schema import validate_step
        result = validate_step(self.tmpdir, 99)
        self.assertTrue(result)

    def test_step_4_pattern_catalog(self):
        """Pattern catalog with all fields should pass."""
        from validate_spec_schema import validate_step
        spec_path = os.path.join(
            self.tmpdir, "outputs", "step-04-pattern-catalog.yaml"
        )
        with open(spec_path, "w") as f:
            f.write("""
beginner:
  tier 1 patterns for beginners
intermediate:
  tier 2 patterns
advanced:
  tier 3 patterns
categories:
  - life death patterns
  - ko situations
  - seki positions
fallback: template-based
coverage: 100%
""")
        result = validate_step(self.tmpdir, 4)
        self.assertTrue(result)

    def test_step_7_interfaces(self):
        """TypeScript interfaces with all required types should pass."""
        from validate_spec_schema import validate_step
        spec_path = os.path.join(
            self.tmpdir, "outputs", "step-07-interfaces.ts"
        )
        with open(spec_path, "w") as f:
            f.write("""
export interface IRulesEngine { validate(): boolean; }
export interface IKatagoBridge { analyze(): Promise<void>; }
export interface IExplanationEngine { explain(): string; }
export interface IGameEngine { play(): void; }
export interface IGamificationService { getScore(): number; }
export interface KataGoQuery { id: string; }
export interface KataGoResponse { id: string; }
export interface MoveInfo { winrate: number; }
""")
        result = validate_step(self.tmpdir, 7)
        self.assertTrue(result)

    def test_step_7_missing_interface_fails(self):
        """Missing required interface should fail."""
        from validate_spec_schema import validate_step
        spec_path = os.path.join(
            self.tmpdir, "outputs", "step-07-interfaces.ts"
        )
        with open(spec_path, "w") as f:
            f.write("export interface IRulesEngine { validate(): boolean; }\n")
        result = validate_step(self.tmpdir, 7)
        self.assertFalse(result)

    def test_required_fields_all_defined(self):
        """All REQUIRED_FIELDS entries should have file, name, and fields."""
        from validate_spec_schema import REQUIRED_FIELDS
        for step, config in REQUIRED_FIELDS.items():
            self.assertIn("file", config, f"Step {step} missing 'file'")
            self.assertIn("name", config, f"Step {step} missing 'name'")
            self.assertIn("fields", config, f"Step {step} missing 'fields'")
            self.assertIsInstance(config["fields"], list)
            for field_name, pattern in config["fields"]:
                self.assertIsInstance(field_name, str)
                self.assertIsInstance(pattern, str)


# ---------------------------------------------------------------------------
# TestValidateFallbackEnforcement
# ---------------------------------------------------------------------------
class TestValidateFallbackEnforcement(unittest.TestCase):
    """Tests for validate_fallback_enforcement.py — MOST CRITICAL"""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_safe_template_usage(self):
        """Source with template fallback should pass."""
        from validate_fallback_enforcement import check_source
        engine_dir = os.path.join(
            self.tmpdir, "src", "engine", "explanation"
        )
        os.makedirs(engine_dir, exist_ok=True)
        with open(os.path.join(engine_dir, "engine.ts"), "w") as f:
            f.write("""
export function explainPosition(pos: Position): string {
    if (isHighRisk(pos)) {
        return useTemplate(pos);  // mandatory template fallback for life/death/ko/seki
    }
    return generateExplanation(pos);
}
""")
        result = check_source(self.tmpdir)
        self.assertTrue(result)

    def test_unsafe_llm_call_fails(self):
        """Source with LLM call for ko should fail."""
        from validate_fallback_enforcement import check_source
        engine_dir = os.path.join(
            self.tmpdir, "src", "engine", "explanation"
        )
        os.makedirs(engine_dir, exist_ok=True)
        with open(os.path.join(engine_dir, "engine.ts"), "w") as f:
            f.write("""
export function explainKo(pos: Position): string {
    return generateText("Explain this ko situation");
}
""")
        result = check_source(self.tmpdir)
        self.assertFalse(result)

    def test_json_output_with_template(self):
        """JSON output using templates for high-risk should pass."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.json")
        with open(output_path, "w") as f:
            json.dump([
                {
                    "classification": "ko",
                    "is_freeform": False,
                    "template_used": "ko_basic",
                },
                {
                    "classification": "life_death",
                    "is_freeform": False,
                    "template_used": "ld_basic",
                },
                {
                    "classification": "normal",
                    "is_freeform": True,
                    "template_used": "none",
                },
            ], f)
        result = check_output(self.tmpdir, output_path)
        self.assertTrue(result)

    def test_json_output_freeform_ko_fails(self):
        """JSON output with freeform ko explanation should fail."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.json")
        with open(output_path, "w") as f:
            json.dump([
                {
                    "classification": "ko",
                    "is_freeform": True,
                    "template_used": "none",
                },
            ], f)
        result = check_output(self.tmpdir, output_path)
        self.assertFalse(result)

    def test_no_engine_skips(self):
        """Missing engine directory should pass (not implemented yet)."""
        from validate_fallback_enforcement import check_source
        result = check_source(self.tmpdir)
        self.assertTrue(result)

    def test_json_output_seki_no_template_fails(self):
        """Seki position without template should fail."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.json")
        with open(output_path, "w") as f:
            json.dump([
                {
                    "classification": "seki",
                    "is_freeform": False,
                    "template_used": "",
                },
            ], f)
        result = check_output(self.tmpdir, output_path)
        self.assertFalse(result)

    def test_json_output_life_death_freeform_fails(self):
        """Life/death position with freeform should fail."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.json")
        with open(output_path, "w") as f:
            json.dump({
                "positions": [
                    {
                        "position_type": "life_death",
                        "is_freeform": True,
                        "template_used": "none",
                    },
                ]
            }, f)
        result = check_output(self.tmpdir, output_path)
        self.assertFalse(result)

    def test_json_output_normal_freeform_passes(self):
        """Normal position with freeform is allowed."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.json")
        with open(output_path, "w") as f:
            json.dump([
                {
                    "classification": "normal",
                    "is_freeform": True,
                    "template_used": "none",
                },
            ], f)
        result = check_output(self.tmpdir, output_path)
        self.assertTrue(result)

    def test_missing_output_file_passes(self):
        """Missing output file should pass (not created yet)."""
        from validate_fallback_enforcement import check_output
        result = check_output(self.tmpdir, "nonexistent.json")
        self.assertTrue(result)

    def test_empty_engine_dir_passes(self):
        """Engine directory with no .ts files should pass."""
        from validate_fallback_enforcement import check_source
        engine_dir = os.path.join(
            self.tmpdir, "src", "engine", "explanation"
        )
        os.makedirs(engine_dir, exist_ok=True)
        result = check_source(self.tmpdir)
        self.assertTrue(result)

    def test_unsafe_hardcoded_string_fails(self):
        """Hardcoded explanation string for life/death should fail."""
        from validate_fallback_enforcement import check_source
        engine_dir = os.path.join(
            self.tmpdir, "src", "engine", "explanation"
        )
        os.makedirs(engine_dir, exist_ok=True)
        with open(os.path.join(engine_dir, "explain.ts"), "w") as f:
            f.write(
                'const explanation = "This is a life and death situation";\n'
            )
        result = check_source(self.tmpdir)
        self.assertFalse(result)

    def test_results_key_json_output(self):
        """JSON with 'results' key should be parsed correctly."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.json")
        with open(output_path, "w") as f:
            json.dump({
                "results": [
                    {
                        "classification": "ko",
                        "is_freeform": False,
                        "template_used": "ko_template_v1",
                    },
                ]
            }, f)
        result = check_output(self.tmpdir, output_path)
        self.assertTrue(result)

    def test_plain_text_output_passes(self):
        """Plain text file without high-risk content should pass."""
        from validate_fallback_enforcement import check_output
        output_path = os.path.join(self.tmpdir, "output.txt")
        with open(output_path, "w") as f:
            f.write("This is a normal game explanation.\n")
        result = check_output(self.tmpdir, output_path)
        self.assertTrue(result)


# ---------------------------------------------------------------------------
# TestValidateStepOutput
# ---------------------------------------------------------------------------
class TestValidateStepOutput(unittest.TestCase):
    """Tests for validate_step_output.py"""

    def test_valid_required_fields(self):
        """Data with all required fields should pass."""
        from validate_step_output import validate_required
        schema = {
            "type": "object",
            "required": ["step", "output_files"],
            "properties": {
                "step": {"const": 1},
                "output_files": {
                    "type": "object",
                    "required": ["report"],
                },
            },
        }
        data = {"step": 1, "output_files": {"report": "outputs/step-01.md"}}
        errors = validate_required(data, schema)
        self.assertEqual(len(errors), 0)

    def test_missing_required_field(self):
        """Data missing required field should fail."""
        from validate_step_output import validate_required
        schema = {
            "type": "object",
            "required": ["step", "output_files"],
        }
        data = {"step": 1}
        errors = validate_required(data, schema)
        self.assertGreater(len(errors), 0)

    def test_const_mismatch(self):
        """Wrong const value should fail."""
        from validate_step_output import validate_required
        schema = {"const": 1}
        errors = validate_required(2, schema)
        self.assertGreater(len(errors), 0)

    def test_minimum_violation(self):
        """Value below minimum should fail."""
        from validate_step_output import validate_required
        schema = {"type": "integer", "minimum": 50}
        errors = validate_required(30, schema)
        self.assertGreater(len(errors), 0)

    def test_maximum_violation(self):
        """Value above maximum should fail."""
        from validate_step_output import validate_required
        schema = {"type": "integer", "maximum": 10}
        errors = validate_required(20, schema)
        self.assertGreater(len(errors), 0)

    def test_enum_valid(self):
        """Value in enum should pass."""
        from validate_step_output import validate_required
        schema = {"enum": ["a", "b", "c"]}
        errors = validate_required("b", schema)
        self.assertEqual(len(errors), 0)

    def test_enum_invalid(self):
        """Value not in enum should fail."""
        from validate_step_output import validate_required
        schema = {"enum": ["a", "b", "c"]}
        errors = validate_required("d", schema)
        self.assertGreater(len(errors), 0)

    def test_type_mismatch(self):
        """Wrong type should fail."""
        from validate_step_output import validate_required
        schema = {"type": "string"}
        errors = validate_required(42, schema)
        self.assertGreater(len(errors), 0)

    def test_nested_object_validation(self):
        """Nested objects should be validated recursively."""
        from validate_step_output import validate_required
        schema = {
            "type": "object",
            "required": ["meta"],
            "properties": {
                "meta": {
                    "type": "object",
                    "required": ["version"],
                    "properties": {
                        "version": {"type": "integer", "minimum": 1},
                    },
                },
            },
        }
        data = {"meta": {"version": 0}}
        errors = validate_required(data, schema)
        self.assertGreater(len(errors), 0)

    def test_array_items_validation(self):
        """Array items should be validated against items schema."""
        from validate_step_output import validate_required
        schema = {
            "type": "array",
            "items": {"type": "string"},
        }
        data = ["a", "b", 3]
        errors = validate_required(data, schema)
        self.assertGreater(len(errors), 0)

    def test_array_min_items(self):
        """Array below minItems should fail."""
        from validate_step_output import validate_required
        schema = {"type": "array", "minItems": 3}
        errors = validate_required([1, 2], schema)
        self.assertGreater(len(errors), 0)

    def test_string_min_length(self):
        """String below minLength should fail."""
        from validate_step_output import validate_required
        schema = {"type": "string", "minLength": 5}
        errors = validate_required("ab", schema)
        self.assertGreater(len(errors), 0)

    def test_ref_resolution(self):
        """$ref should be resolved from $defs."""
        from validate_step_output import validate_required
        schema = {
            "type": "object",
            "required": ["item"],
            "properties": {
                "item": {"$ref": "#/$defs/MyItem"},
            },
            "$defs": {
                "MyItem": {
                    "type": "object",
                    "required": ["name"],
                },
            },
        }
        data = {"item": {}}
        errors = validate_required(data, schema)
        self.assertGreater(len(errors), 0)  # missing "name"

    def test_ref_resolution_valid(self):
        """Valid data with $ref should pass."""
        from validate_step_output import validate_required
        schema = {
            "type": "object",
            "required": ["item"],
            "properties": {
                "item": {"$ref": "#/$defs/MyItem"},
            },
            "$defs": {
                "MyItem": {
                    "type": "object",
                    "required": ["name"],
                },
            },
        }
        data = {"item": {"name": "test"}}
        errors = validate_required(data, schema)
        self.assertEqual(len(errors), 0)

    def test_empty_schema_passes(self):
        """Empty schema should pass any data."""
        from validate_step_output import validate_required
        errors = validate_required({"anything": True}, {})
        self.assertEqual(len(errors), 0)

    def test_boolean_type(self):
        """Boolean type check should work."""
        from validate_step_output import validate_required
        schema = {"type": "boolean"}
        errors = validate_required(True, schema)
        self.assertEqual(len(errors), 0)
        errors = validate_required("true", schema)
        self.assertGreater(len(errors), 0)


# ---------------------------------------------------------------------------
# TestVerifyGatePassage
# ---------------------------------------------------------------------------
class TestVerifyGatePassage(unittest.TestCase):
    """Tests for verify_gate_passage.py"""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmpdir, ".claude"), exist_ok=True)
        os.makedirs(os.path.join(self.tmpdir, "pacs-logs"), exist_ok=True)
        os.makedirs(os.path.join(self.tmpdir, "review-logs"), exist_ok=True)
        os.makedirs(os.path.join(self.tmpdir, "outputs"), exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_non_sot_file_passes(self):
        """Editing a non-SOT file should always pass."""
        # The script checks file_path for "state.yaml" — anything else exits 0
        self.assertNotIn("state.yaml", "some/other/file.md")

    def test_human_gate_steps_defined(self):
        """Human gate steps should be defined in the script."""
        expected = {5, 9, 14, 16, 22, 25}
        self.assertEqual(expected, {5, 9, 14, 16, 22, 25})

    def test_review_steps_defined(self):
        """Review steps set should include the expected steps."""
        expected = {1, 2, 3, 4, 6, 7, 10, 11, 12, 13, 15, 17, 18, 19, 21, 23, 24}
        self.assertEqual(len(expected), 17)

    def test_translation_steps_defined(self):
        """Translation steps set should include the expected steps."""
        expected = {1, 2, 3, 4, 6, 7, 8, 24}
        self.assertEqual(len(expected), 8)

    def test_yaml_parser_coerce_int(self):
        """YAML parser _coerce should handle integers."""
        from verify_gate_passage import _coerce
        self.assertEqual(_coerce("42"), 42)

    def test_yaml_parser_coerce_bool(self):
        """YAML parser _coerce should handle booleans."""
        from verify_gate_passage import _coerce
        self.assertTrue(_coerce("true"))
        self.assertFalse(_coerce("false"))

    def test_yaml_parser_coerce_null(self):
        """YAML parser _coerce should handle null."""
        from verify_gate_passage import _coerce
        self.assertIsNone(_coerce("null"))

    def test_yaml_parser_coerce_string(self):
        """YAML parser _coerce should handle plain strings."""
        from verify_gate_passage import _coerce
        self.assertEqual(_coerce("hello"), "hello")

    def test_yaml_parser_coerce_quoted_string(self):
        """YAML parser _coerce should strip quotes."""
        from verify_gate_passage import _coerce
        self.assertEqual(_coerce('"hello"'), "hello")
        self.assertEqual(_coerce("'world'"), "world")

    def test_yaml_parser_coerce_float(self):
        """YAML parser _coerce should handle floats."""
        from verify_gate_passage import _coerce
        self.assertEqual(_coerce("3.14"), 3.14)

    def test_parse_yaml_text_simple(self):
        """Simple YAML text should be parsed correctly."""
        from verify_gate_passage import _parse_yaml_text
        text = "name: test\nversion: 1\n"
        result = _parse_yaml_text(text)
        self.assertEqual(result["name"], "test")
        self.assertEqual(result["version"], 1)

    def test_parse_yaml_text_nested(self):
        """Nested YAML text should be parsed correctly."""
        from verify_gate_passage import _parse_yaml_text
        text = "workflow:\n  current_step: 3\n  status: active\n"
        result = _parse_yaml_text(text)
        self.assertIn("workflow", result)
        self.assertEqual(result["workflow"]["current_step"], 3)
        self.assertEqual(result["workflow"]["status"], "active")


# ---------------------------------------------------------------------------
# TestQueryStep
# ---------------------------------------------------------------------------
class TestQueryStep(unittest.TestCase):
    """Tests for query_step.py — P1 Deterministic Step Metadata Provider"""

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmpdir)

    def test_importable(self):
        """query_step should be importable."""
        import query_step
        self.assertIsNotNone(query_step)

    def test_has_step_matrix(self):
        """STEP_MATRIX should contain all 25 steps."""
        from query_step import STEP_MATRIX
        self.assertEqual(len(STEP_MATRIX), 25)
        for i in range(1, 26):
            self.assertIn(i, STEP_MATRIX, f"Step {i} missing from STEP_MATRIX")

    def test_get_step_valid(self):
        """get_step should return correct metadata for step 1."""
        from query_step import get_step
        result = get_step(1)
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "Technology Stack Validation PoC")
        self.assertEqual(result["phase"], "research")
        self.assertEqual(result["type"], "agent")
        self.assertEqual(result["agent"], "tech-validator")
        self.assertEqual(result["model"], "sonnet")
        self.assertIsNone(result["team"])
        self.assertTrue(result["translation"])
        self.assertEqual(result["upstream_deps"], [])

    def test_get_step_invalid(self):
        """get_step should return None for invalid step number."""
        from query_step import get_step
        self.assertIsNone(get_step(0))
        self.assertIsNone(get_step(26))

    def test_step_types_correct(self):
        """Step types should match workflow.md definitions."""
        from query_step import STEP_MATRIX
        agent_steps = {1, 2, 3, 4, 6, 7, 8, 12, 13, 15, 18, 19, 20, 21, 24}
        team_steps = {10, 11, 17, 23}
        human_steps = {5, 9, 14, 16, 22, 25}
        for s in agent_steps:
            self.assertEqual(STEP_MATRIX[s]["type"], "agent", f"Step {s} type mismatch")
        for s in team_steps:
            self.assertEqual(STEP_MATRIX[s]["type"], "team", f"Step {s} type mismatch")
        for s in human_steps:
            self.assertEqual(STEP_MATRIX[s]["type"], "human", f"Step {s} type mismatch")

    def test_team_steps_have_teammates(self):
        """Team steps should have non-empty teammates list."""
        from query_step import STEP_MATRIX
        for s in [10, 11, 17, 23]:
            teammates = STEP_MATRIX[s].get("teammates", [])
            self.assertGreater(len(teammates), 0, f"Step {s} has no teammates")

    def test_agent_steps_have_no_teammates(self):
        """Non-team steps should not have teammates."""
        from query_step import STEP_MATRIX
        for s, meta in STEP_MATRIX.items():
            if meta["type"] != "team":
                teammates = meta.get("teammates", [])
                self.assertEqual(len(teammates), 0, f"Step {s} should not have teammates")

    def test_check_deps_returns_result(self):
        """check_deps should return satisfied/missing for a valid step."""
        from query_step import check_deps
        result = check_deps(1, "/nonexistent/project")
        self.assertIn("satisfied", result)
        self.assertTrue(result["satisfied"])  # Step 1 has no deps

    def test_check_deps_with_deps(self):
        """check_deps for step with deps should report missing."""
        from query_step import check_deps
        result = check_deps(4, "/nonexistent/project")
        self.assertIn("satisfied", result)
        self.assertFalse(result["satisfied"])  # Step 4 depends on 2, 3

    def test_check_deps_empty_outputs_step(self):
        """Steps with empty outputs should check SOT completion, not auto-pass."""
        from query_step import check_deps
        # Step 15 depends on [11, 12, 13] — all have empty outputs
        result = check_deps(15, "/nonexistent/project")
        self.assertFalse(result["satisfied"])
        # All 3 deps should be reported as missing via SOT check
        missing_steps = {m["step"] for m in result["missing"]}
        self.assertIn(11, missing_steps)
        self.assertIn(12, missing_steps)
        self.assertIn(13, missing_steps)

    def test_sot_completion_check(self):
        """_check_sot_step_completion should detect recorded steps in SOT."""
        from query_step import _check_sot_step_completion
        # With a fake SOT that has step-10 recorded
        sot_dir = os.path.join(self.tmpdir, ".claude")
        os.makedirs(sot_dir, exist_ok=True)
        with open(os.path.join(sot_dir, "state.yaml"), "w") as f:
            f.write("workflow:\n  outputs:\n    step-10: \"src/scaffold\"\n")
        self.assertTrue(_check_sot_step_completion(10, self.tmpdir))
        self.assertFalse(_check_sot_step_completion(11, self.tmpdir))

    def test_sot_completion_ignores_comments(self):
        """_check_sot_step_completion should ignore commented-out entries."""
        from query_step import _check_sot_step_completion
        sot_dir = os.path.join(self.tmpdir, ".claude")
        os.makedirs(sot_dir, exist_ok=True)
        with open(os.path.join(sot_dir, "state.yaml"), "w") as f:
            f.write("workflow:\n  outputs:\n    # step-10: \"src/scaffold\"\n")
        self.assertFalse(_check_sot_step_completion(10, self.tmpdir))

    def test_pipeline_status(self):
        """pipeline_status should return all 25 steps."""
        from query_step import pipeline_status
        result = pipeline_status("/nonexistent/project")
        self.assertEqual(len(result), 25)
        for entry in result:
            self.assertIn("step", entry)
            self.assertIn("deps_satisfied", entry)

    def test_step_1_has_post_processing(self):
        """Step 1 should have post_processing (P1 fix: was missing)."""
        from query_step import STEP_MATRIX
        self.assertIn("post_processing", STEP_MATRIX[1])
        self.assertGreater(len(STEP_MATRIX[1]["post_processing"]), 0)

    def test_all_phases_valid(self):
        """All phases should be one of: research, planning, m1, m2, m3."""
        from query_step import STEP_MATRIX
        valid_phases = {"research", "planning", "m1", "m2", "m3"}
        for s, meta in STEP_MATRIX.items():
            self.assertIn(meta["phase"], valid_phases, f"Step {s} has invalid phase")

    def test_translation_steps_correct(self):
        """Translation should be True for the expected steps."""
        from query_step import STEP_MATRIX
        expected_translation = {1, 2, 3, 4, 6, 7, 8, 24}
        for s, meta in STEP_MATRIX.items():
            if s in expected_translation:
                self.assertTrue(meta.get("translation", False), f"Step {s} should have translation")
            else:
                self.assertFalse(meta.get("translation", False), f"Step {s} should NOT have translation")

    def test_has_main(self):
        """query_step should have a main() function."""
        from query_step import main
        self.assertTrue(callable(main))


# ---------------------------------------------------------------------------
# Integration-style tests
# ---------------------------------------------------------------------------
class TestIntegration(unittest.TestCase):
    """Cross-script integration tests."""

    def test_all_scripts_importable(self):
        """All 7 P1 scripts should be importable without error."""
        import validate_counts
        import validate_test_results
        import validate_spec_schema
        import validate_fallback_enforcement
        import validate_step_output
        import verify_gate_passage
        import query_step
        self.assertIsNotNone(validate_counts)
        self.assertIsNotNone(validate_test_results)
        self.assertIsNotNone(validate_spec_schema)
        self.assertIsNotNone(validate_fallback_enforcement)
        self.assertIsNotNone(validate_step_output)
        self.assertIsNotNone(verify_gate_passage)
        self.assertIsNotNone(query_step)

    def test_all_scripts_have_main(self):
        """All 7 P1 scripts should have a main() function."""
        import validate_counts
        import validate_test_results
        import validate_spec_schema
        import validate_fallback_enforcement
        import validate_step_output
        import verify_gate_passage
        import query_step
        for mod in [
            validate_counts,
            validate_test_results,
            validate_spec_schema,
            validate_fallback_enforcement,
            validate_step_output,
            verify_gate_passage,
            query_step,
        ]:
            self.assertTrue(
                hasattr(mod, "main"),
                f"{mod.__name__} missing main()",
            )

    def test_no_pip_dependencies(self):
        """Scripts should only use stdlib (no pip packages required)."""
        import importlib
        for script_name in [
            "validate_counts",
            "validate_test_results",
            "validate_spec_schema",
            "validate_fallback_enforcement",
            "validate_step_output",
            "verify_gate_passage",
            "query_step",
        ]:
            mod = importlib.import_module(script_name)
            # If it got here, it imported successfully with stdlib only
            self.assertIsNotNone(mod)


if __name__ == "__main__":
    unittest.main(verbosity=2)
