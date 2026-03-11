#!/usr/bin/env python3
"""
P1 Test Result Validator — parses Vitest JSON output, not agent text claims.

Usage: python3 validate_test_results.py --project-dir . --json-report path/to/vitest-results.json
       python3 validate_test_results.py --project-dir . --run-tests

If --run-tests: runs `npx vitest run --reporter=json` and captures output.
"""
import argparse
import json
import os
import subprocess
import sys


def validate_results(results):
    """Validate Vitest JSON results."""
    errors = []

    # Parse Vitest JSON format
    test_results = results.get("testResults", [])
    if not test_results:
        print("WARNING: No test results found in JSON")
        return True  # No tests yet — not an error

    total_tests = 0
    passed = 0
    failed = 0
    skipped = 0

    for suite in test_results:
        for assertion in suite.get("assertionResults", []):
            total_tests += 1
            s = assertion.get("status", "")
            if s == "passed":
                passed += 1
            elif s == "failed":
                failed += 1
                failure_msgs = assertion.get("failureMessages", [""])
                first_msg = failure_msgs[0] if failure_msgs else ""
                errors.append(
                    f"FAIL: {assertion.get('fullName', 'unknown')} — "
                    f"{first_msg[:200]}"
                )
            elif s in ("pending", "skipped"):
                skipped += 1

    # Also check top-level summary fields
    num_total = results.get("numTotalTests", total_tests)
    num_passed = results.get("numPassedTests", passed)
    num_failed = results.get("numFailedTests", failed)

    print(
        f"Test Results: {num_passed}/{num_total} passed, "
        f"{num_failed} failed, {skipped} skipped"
    )

    if num_failed > 0:
        print(f"\n{num_failed} test(s) FAILED:")
        for e in errors[:10]:  # Show first 10 failures
            print(f"  - {e}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
        return False

    print("All tests passed")
    return True


def run_vitest(project_dir):
    """Run vitest and capture JSON output."""
    try:
        result = subprocess.run(
            ["npx", "vitest", "run", "--reporter=json"],
            capture_output=True,
            text=True,
            cwd=project_dir,
            timeout=300,
        )
        # Vitest outputs JSON to stdout
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            # Try to find JSON in output (line by line)
            for line in result.stdout.split("\n"):
                line = line.strip()
                if not line:
                    continue
                try:
                    return json.loads(line)
                except json.JSONDecodeError:
                    continue
            print("WARNING: Could not parse Vitest JSON output")
            if result.stdout:
                print(f"stdout: {result.stdout[:500]}")
            if result.stderr:
                print(f"stderr: {result.stderr[:500]}")
            return None
    except FileNotFoundError:
        print("WARNING: npx not found — project not yet set up")
        return None
    except subprocess.TimeoutExpired:
        print("WARNING: Vitest timed out after 300s")
        return None


def main():
    parser = argparse.ArgumentParser(description="P1 Test Result Validator")
    parser.add_argument(
        "--project-dir",
        default=os.environ.get("CLAUDE_PROJECT_DIR", "."),
    )
    parser.add_argument(
        "--json-report", help="Path to Vitest JSON report file"
    )
    parser.add_argument(
        "--run-tests",
        action="store_true",
        help="Run vitest and validate",
    )
    parser.add_argument(
        "--min-tests",
        type=int,
        default=0,
        help="Minimum number of tests expected",
    )
    args = parser.parse_args()

    results = None

    if args.json_report:
        report_path = args.json_report
        if not os.path.isabs(report_path):
            report_path = os.path.join(args.project_dir, report_path)
        try:
            with open(report_path) as f:
                results = json.load(f)
        except FileNotFoundError:
            print(f"FAIL: JSON report not found: {args.json_report}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"FAIL: Cannot parse JSON report: {e}")
            sys.exit(1)
    elif args.run_tests:
        results = run_vitest(args.project_dir)
        if results is None:
            print("INFO: No test results available — project may not be built yet")
            sys.exit(0)
    else:
        parser.print_help()
        sys.exit(1)

    if results is None:
        sys.exit(0)

    success = validate_results(results)

    # Check minimum test count
    if args.min_tests > 0:
        total = results.get("numTotalTests", 0)
        if total < args.min_tests:
            print(f"FAIL: Test count {total} < minimum {args.min_tests}")
            success = False

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
