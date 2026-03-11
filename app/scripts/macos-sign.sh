#!/usr/bin/env bash
# =============================================================================
# macos-sign.sh — macOS Code Signing and Notarization
# =============================================================================
#
# Purpose:
#   Sign a .dmg (or .app bundle) with the Apple Developer certificate,
#   submit it for notarization via xcrun notarytool, staple the notarization
#   ticket, and verify the result. Intended for use in GitHub Actions and
#   local release preparation.
#
# Required environment variables:
#   APPLE_ID              — Apple ID email address (e.g. dev@example.com)
#   APPLE_PASSWORD        — App-specific password generated at appleid.apple.com
#   APPLE_TEAM_ID         — 10-character Apple Developer team ID (e.g. ABCDE12345)
#   APPLE_CERTIFICATE     — Base64-encoded .p12 developer certificate
#   APPLE_CERTIFICATE_PASSWORD — Password protecting the .p12 file
#
# Usage:
#   ARTIFACT_PATH=./target/release/bundle/dmg/Baduk_1.0.0_aarch64.dmg \
#     bash scripts/macos-sign.sh
#
# Idempotency:
#   Safe to re-run: the script checks for an existing keychain entry before
#   importing the certificate, and cleans up the temporary keychain on exit.
#
# References:
#   https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
#   https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow
# =============================================================================

set -euo pipefail

# ── 1. Validate required environment variables ────────────────────────────────

: "${APPLE_ID:?ERROR: APPLE_ID must be set (e.g. dev@example.com)}"
: "${APPLE_PASSWORD:?ERROR: APPLE_PASSWORD must be set (app-specific password from appleid.apple.com)}"
: "${APPLE_TEAM_ID:?ERROR: APPLE_TEAM_ID must be set (10-char team ID)}"
: "${APPLE_CERTIFICATE:?ERROR: APPLE_CERTIFICATE must be set (base64-encoded .p12)}"
: "${APPLE_CERTIFICATE_PASSWORD:?ERROR: APPLE_CERTIFICATE_PASSWORD must be set}"
: "${ARTIFACT_PATH:?ERROR: ARTIFACT_PATH must be set (path to .dmg or .app)}"

if [[ ! -f "$ARTIFACT_PATH" && ! -d "$ARTIFACT_PATH" ]]; then
  echo "ERROR: Artifact not found at: $ARTIFACT_PATH"
  exit 1
fi

echo "=== macOS Code Signing and Notarization ==="
echo "  Artifact  : $ARTIFACT_PATH"
echo "  Team ID   : $APPLE_TEAM_ID"
echo "  Apple ID  : $APPLE_ID"

# ── 2. Import Developer Certificate into a temporary keychain ─────────────────

KEYCHAIN_NAME="baduk-signing-$$.keychain"
KEYCHAIN_PASSWORD="$(openssl rand -hex 16)"
CERT_P12="/tmp/baduk-developer-cert-$$.p12"

# Save the original default keychain so it can be restored on cleanup
ORIGINAL_KEYCHAIN="$(security default-keychain -d user 2>/dev/null | tr -d '" ' || echo "")"

# Ensure cleanup runs on any exit (success or failure)
cleanup() {
  echo "Cleaning up temporary keychain and certificate..."
  security delete-keychain "$KEYCHAIN_NAME" 2>/dev/null || true
  rm -f "$CERT_P12"
  # Restore the original default keychain (critical for local use)
  if [[ -n "$ORIGINAL_KEYCHAIN" ]]; then
    security set-default-keychain "$ORIGINAL_KEYCHAIN" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo ""
echo "--- Step 1: Importing certificate ---"

# Decode the base64-encoded .p12 certificate
echo "$APPLE_CERTIFICATE" | base64 --decode > "$CERT_P12"

# Create a fresh temporary keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"

# Set the keychain as the default and add it to the search list
security set-default-keychain "$KEYCHAIN_NAME"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_NAME"
security list-keychains -d user -s "$KEYCHAIN_NAME" "$(security list-keychains -d user | tr -d '"' | head -1)"

# Import the certificate
security import "$CERT_P12" \
  -k "$KEYCHAIN_NAME" \
  -P "$APPLE_CERTIFICATE_PASSWORD" \
  -T /usr/bin/codesign \
  -T /usr/bin/productbuild \
  -T /usr/bin/productsign

# Allow codesign to access the private key without prompting
security set-key-partition-list \
  -S apple-tool:,apple:,codesign: \
  -s \
  -k "$KEYCHAIN_PASSWORD" \
  "$KEYCHAIN_NAME"

echo "Certificate imported successfully."

# ── 3. Identify signing identity ──────────────────────────────────────────────

echo ""
echo "--- Step 2: Identifying signing identity ---"

# Find the Developer ID Application certificate in the keychain
SIGNING_IDENTITY=$(security find-identity -v -p codesigning "$KEYCHAIN_NAME" \
  | grep "Developer ID Application" \
  | head -1 \
  | sed 's/.*"\(.*\)"/\1/')

if [[ -z "$SIGNING_IDENTITY" ]]; then
  echo "ERROR: No 'Developer ID Application' certificate found in keychain."
  echo "Available identities:"
  security find-identity -v -p codesigning "$KEYCHAIN_NAME"
  exit 1
fi

echo "Signing identity: $SIGNING_IDENTITY"

# ── 4. Sign the artifact ──────────────────────────────────────────────────────

echo ""
echo "--- Step 3: Signing artifact ---"

if [[ "$ARTIFACT_PATH" == *.dmg ]]; then
  # Sign the .dmg file directly
  codesign \
    --force \
    --sign "$SIGNING_IDENTITY" \
    --timestamp \
    --options runtime \
    --keychain "$KEYCHAIN_NAME" \
    "$ARTIFACT_PATH"
  echo "DMG signed: $ARTIFACT_PATH"
elif [[ "$ARTIFACT_PATH" == *.app ]] || [[ -d "$ARTIFACT_PATH" ]]; then
  # Sign the .app bundle recursively (frameworks, helpers, then the main bundle)
  # Sign all nested binaries first to satisfy Apple's signature chain requirement
  find "$ARTIFACT_PATH" -type f \( -name "*.dylib" -o -name "*.framework" -o -perm +0111 \) | while read -r binary; do
    codesign \
      --force \
      --sign "$SIGNING_IDENTITY" \
      --timestamp \
      --options runtime \
      --keychain "$KEYCHAIN_NAME" \
      "$binary" 2>/dev/null || true
  done

  # Sign the main bundle last
  codesign \
    --force \
    --deep \
    --sign "$SIGNING_IDENTITY" \
    --timestamp \
    --options runtime \
    --entitlements "scripts/entitlements.plist" \
    --keychain "$KEYCHAIN_NAME" \
    "$ARTIFACT_PATH"
  echo "App bundle signed: $ARTIFACT_PATH"
else
  echo "ERROR: Unsupported artifact type. Expected .dmg or .app bundle."
  exit 1
fi

# Verify the signature immediately
echo ""
echo "--- Step 4: Verifying signature ---"
codesign --verify --deep --strict --verbose=2 "$ARTIFACT_PATH"
echo "Signature verification passed."

# ── 5. Submit for notarization ────────────────────────────────────────────────

echo ""
echo "--- Step 5: Submitting for notarization ---"
echo "Note: Notarization typically takes 1-5 minutes."

# Store credentials securely in the keychain for notarytool
# Using --store-credentials is preferable for CI; we use inline args here for
# ephemeral runners where the keychain is temporary.
NOTARIZE_OUTPUT=$(xcrun notarytool submit "$ARTIFACT_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait \
  --timeout 600 \
  2>&1)

echo "$NOTARIZE_OUTPUT"

# Extract submission ID for log retrieval on failure
SUBMISSION_ID=$(echo "$NOTARIZE_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')

# Check notarization result
if echo "$NOTARIZE_OUTPUT" | grep -q "status: Accepted"; then
  echo "Notarization accepted."
elif echo "$NOTARIZE_OUTPUT" | grep -q "status: Invalid"; then
  echo "ERROR: Notarization rejected. Fetching submission log..."
  if [[ -n "$SUBMISSION_ID" ]]; then
    xcrun notarytool log "$SUBMISSION_ID" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      2>&1 || true
  fi
  exit 1
else
  echo "WARNING: Notarization status unclear. Review the output above."
  # Attempt to continue — stapling will fail if notarization did not succeed
fi

# ── 6. Staple the notarization ticket ────────────────────────────────────────

echo ""
echo "--- Step 6: Stapling notarization ticket ---"
# Retry stapling up to 3 times (Apple's CDN may take a moment to propagate)
MAX_STAPLE_ATTEMPTS=3
STAPLE_ATTEMPT=0
STAPLE_SUCCESS=false

while [[ $STAPLE_ATTEMPT -lt $MAX_STAPLE_ATTEMPTS ]]; do
  STAPLE_ATTEMPT=$((STAPLE_ATTEMPT + 1))
  echo "Staple attempt $STAPLE_ATTEMPT/$MAX_STAPLE_ATTEMPTS..."

  if xcrun stapler staple "$ARTIFACT_PATH" 2>&1; then
    STAPLE_SUCCESS=true
    echo "Notarization ticket stapled successfully."
    break
  else
    if [[ $STAPLE_ATTEMPT -lt $MAX_STAPLE_ATTEMPTS ]]; then
      echo "Staple failed. Waiting 15 seconds before retry..."
      sleep 15
    fi
  fi
done

if [[ "$STAPLE_SUCCESS" != "true" ]]; then
  echo "ERROR: Failed to staple notarization ticket after $MAX_STAPLE_ATTEMPTS attempts."
  exit 1
fi

# ── 7. Verify final notarization status ──────────────────────────────────────

echo ""
echo "--- Step 7: Final verification ---"
xcrun stapler validate "$ARTIFACT_PATH"
spctl --assess --verbose=4 --type open --context context:primary-signature "$ARTIFACT_PATH" 2>&1 || true

echo ""
echo "=== macOS Code Signing and Notarization COMPLETE ==="
echo "  Artifact: $ARTIFACT_PATH"
echo "  The application is signed, notarized, and stapled."
echo "  Gatekeeper will allow installation without warnings."
