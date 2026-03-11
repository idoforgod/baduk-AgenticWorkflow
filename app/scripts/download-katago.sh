#!/usr/bin/env bash
# download-katago.sh
#
# Downloads the correct KataGo binary for the current CI target platform and
# places it in src-tauri/binaries/ using Tauri's target-triple naming convention.
#
# Required environment variables (set by the GitHub Actions workflow):
#   KATAGO_VERSION     — e.g. "v1.16.4"
#   KATAGO_ASSET       — GitHub release asset name stem (without extension)
#   KATAGO_BINARY_NAME — Destination filename in src-tauri/binaries/
#   TARGET_OS          — Runner OS ("macOS", "Windows", "Linux")
#
# Usage (from the app/ directory):
#   bash ../scripts/download-katago.sh
#
# Tauri sidecar naming convention:
#   src-tauri/binaries/katago-{rust-target-triple}[.exe on Windows]
# See: https://tauri.app/v1/guides/building/sidecar/

set -euo pipefail

# ── Validate required environment variables ───────────────────────────────────
: "${KATAGO_VERSION:?ERROR: KATAGO_VERSION must be set}"
: "${KATAGO_ASSET:?ERROR: KATAGO_ASSET must be set}"
: "${KATAGO_BINARY_NAME:?ERROR: KATAGO_BINARY_NAME must be set}"
: "${TARGET_OS:?ERROR: TARGET_OS must be set}"

KATAGO_RELEASE_BASE="https://github.com/lightvector/KataGo/releases/download/${KATAGO_VERSION}"
BINARY_DIR="src-tauri/binaries"
DEST="${BINARY_DIR}/${KATAGO_BINARY_NAME}"

mkdir -p "$BINARY_DIR"

# ── Skip if binary already exists (cache hit from Cargo/actions/cache) ────────
if [[ -f "$DEST" && -s "$DEST" ]]; then
  echo "KataGo binary already present: $DEST ($(wc -c < "$DEST") bytes). Skipping download."
  exit 0
fi

echo "Downloading KataGo ${KATAGO_VERSION} for ${TARGET_OS}..."
echo "  Asset stem : ${KATAGO_ASSET}"
echo "  Destination: ${DEST}"

# ── Determine download URL and extraction logic per platform ──────────────────
case "$TARGET_OS" in
  macOS)
    # macOS: KataGo is distributed as a zip archive containing the binary.
    # The Metal backend binary is preferred (GPU-accelerated via Apple Metal).
    # CPU fallback: katago-v1.16.4-macos-cpu-x86_or_arm64
    ARCHIVE_URL="${KATAGO_RELEASE_BASE}/${KATAGO_ASSET}.zip"
    ARCHIVE_FILE="/tmp/katago-download.zip"
    EXTRACT_DIR="/tmp/katago-extract"

    echo "Fetching: $ARCHIVE_URL"
    curl -L --retry 3 --retry-delay 5 --fail -o "$ARCHIVE_FILE" "$ARCHIVE_URL"

    rm -rf "$EXTRACT_DIR"
    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ARCHIVE_FILE" -d "$EXTRACT_DIR"

    # Find the katago binary inside the extracted archive.
    # Upstream zip structure: katago (no extension) at archive root or in subdir.
    KATAGO_BIN=$(find "$EXTRACT_DIR" -name "katago" -type f | head -1)
    if [[ -z "$KATAGO_BIN" ]]; then
      echo "ERROR: Could not locate 'katago' binary in extracted archive."
      echo "Archive contents:"
      find "$EXTRACT_DIR" -type f
      exit 1
    fi

    cp "$KATAGO_BIN" "$DEST"
    chmod +x "$DEST"
    rm -f "$ARCHIVE_FILE"
    rm -rf "$EXTRACT_DIR"
    ;;

  Linux)
    # Linux: KataGo is distributed as a zip archive.
    # We prefer the OpenCL build for broad GPU compatibility; CPU is the fallback.
    ARCHIVE_URL="${KATAGO_RELEASE_BASE}/${KATAGO_ASSET}.zip"
    ARCHIVE_FILE="/tmp/katago-download.zip"
    EXTRACT_DIR="/tmp/katago-extract"

    echo "Fetching: $ARCHIVE_URL"
    curl -L --retry 3 --retry-delay 5 --fail -o "$ARCHIVE_FILE" "$ARCHIVE_URL"

    rm -rf "$EXTRACT_DIR"
    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ARCHIVE_FILE" -d "$EXTRACT_DIR"

    KATAGO_BIN=$(find "$EXTRACT_DIR" -name "katago" -type f | head -1)
    if [[ -z "$KATAGO_BIN" ]]; then
      echo "ERROR: Could not locate 'katago' binary in extracted archive."
      find "$EXTRACT_DIR" -type f
      exit 1
    fi

    cp "$KATAGO_BIN" "$DEST"
    chmod +x "$DEST"
    rm -f "$ARCHIVE_FILE"
    rm -rf "$EXTRACT_DIR"
    ;;

  Windows)
    # Windows: KataGo is distributed as a zip archive containing katago.exe.
    # The MSVC build is required for compatibility with Tauri's Windows runner.
    ARCHIVE_URL="${KATAGO_RELEASE_BASE}/${KATAGO_ASSET}.zip"
    ARCHIVE_FILE="${TEMP:-/tmp}/katago-download.zip"
    EXTRACT_DIR="${TEMP:-/tmp}/katago-extract"

    echo "Fetching: $ARCHIVE_URL"
    curl -L --retry 3 --retry-delay 5 --fail -o "$ARCHIVE_FILE" "$ARCHIVE_URL"

    rm -rf "$EXTRACT_DIR"
    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ARCHIVE_FILE" -d "$EXTRACT_DIR"

    # Windows binary is named katago.exe
    KATAGO_BIN=$(find "$EXTRACT_DIR" -name "katago.exe" -type f | head -1)
    if [[ -z "$KATAGO_BIN" ]]; then
      echo "ERROR: Could not locate 'katago.exe' in extracted archive."
      find "$EXTRACT_DIR" -type f
      exit 1
    fi

    cp "$KATAGO_BIN" "$DEST"
    rm -f "$ARCHIVE_FILE"
    rm -rf "$EXTRACT_DIR"
    ;;

  *)
    echo "ERROR: Unsupported TARGET_OS='${TARGET_OS}'. Expected: macOS, Linux, or Windows."
    exit 1
    ;;
esac

# ── Verify the binary was placed correctly ────────────────────────────────────
if [[ ! -f "$DEST" ]]; then
  echo "ERROR: Binary not found at expected destination: $DEST"
  exit 1
fi

BINARY_SIZE=$(wc -c < "$DEST")
echo "KataGo binary ready: $DEST (${BINARY_SIZE} bytes)"

# Sanity check: binary must be non-trivial (> 1MB) to catch corrupt downloads.
MIN_SIZE=$((1 * 1024 * 1024))
if [[ "$BINARY_SIZE" -lt "$MIN_SIZE" ]]; then
  echo "ERROR: Binary is suspiciously small (${BINARY_SIZE} bytes < 1MB). Download may be corrupt."
  exit 1
fi

echo "KataGo sidecar ready for Tauri bundling."
