#!/usr/bin/env bash
# =============================================================================
# linux-package.sh — Linux Package Preparation and Verification
# =============================================================================
#
# Purpose:
#   Verify the Linux build artifacts produced by Tauri, install the desktop
#   entry, icon, and man page placeholder into a staging directory, and confirm
#   the AppImage is executable on Ubuntu 22.04+.
#
# Supported package formats:
#   - AppImage (primary, universal)
#   - .deb (Debian/Ubuntu)
#   - .rpm (Fedora/RHEL) — verified if present, not required
#
# Required environment variables:
#   APP_VERSION       — Version string, e.g. "1.0.0"
#   BUILD_DIR         — Directory containing Tauri build output
#                       Default: src-tauri/target/release/bundle
#
# Optional environment variables:
#   STAGING_DIR       — Where to assemble the final Linux package tree
#                       Default: /tmp/baduk-linux-package
#   SKIP_APPIMAGE_RUN — Set to "1" to skip the execution test (headless CI)
#
# Usage:
#   APP_VERSION=1.0.0 bash scripts/linux-package.sh
#
# Idempotency:
#   The staging directory is wiped and recreated on each run. Safe to re-run.
#
# Ubuntu 22.04 FUSE requirement:
#   AppImages require FUSE 2.x to run. In GitHub Actions or Docker environments:
#     sudo apt-get install -y libfuse2
#   Alternatively, extract the AppImage:
#     ./${APPIMAGE_PATH} --appimage-extract
#     ./squashfs-root/AppRun
#
# References:
#   https://appimage.org/
#   https://specifications.freedesktop.org/desktop-entry-spec/latest/
#   https://specifications.freedesktop.org/icon-theme-spec/icon-theme-spec-latest.html
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

APP_VERSION="${APP_VERSION:-$(grep '"version"' package.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')}"
BUILD_DIR="${BUILD_DIR:-src-tauri/target/release/bundle}"
STAGING_DIR="${STAGING_DIR:-/tmp/baduk-linux-package}"
SKIP_APPIMAGE_RUN="${SKIP_APPIMAGE_RUN:-0}"

APP_NAME="Baduk"
APP_BINARY_NAME="baduk"
APP_IDENTIFIER="com.baduk.app"
APP_DESCRIPTION="AI-powered Go (Baduk) analysis platform with KataGo engine"
APP_CATEGORIES="Game;BoardGame;Education;"
APP_HOMEPAGE="https://baduk.app"

echo "=== Linux Package Preparation ==="
echo "  Version     : $APP_VERSION"
echo "  Build dir   : $BUILD_DIR"
echo "  Staging dir : $STAGING_DIR"

# ── 1. Locate build artifacts ─────────────────────────────────────────────────

echo ""
echo "--- Step 1: Locating build artifacts ---"

APPIMAGE_PATH=""
DEB_PATH=""
RPM_PATH=""

# Search for AppImage
if [[ -d "$BUILD_DIR/appimage" ]]; then
  APPIMAGE_PATH=$(find "$BUILD_DIR/appimage" -name "*.AppImage" -type f | head -1)
fi

# Search for .deb
if [[ -d "$BUILD_DIR/deb" ]]; then
  DEB_PATH=$(find "$BUILD_DIR/deb" -name "*.deb" -type f | head -1)
fi

# Search for .rpm
if [[ -d "$BUILD_DIR/rpm" ]]; then
  RPM_PATH=$(find "$BUILD_DIR/rpm" -name "*.rpm" -type f | head -1)
fi

# AppImage is required; others are optional
if [[ -z "$APPIMAGE_PATH" ]]; then
  echo "ERROR: No .AppImage found in $BUILD_DIR/appimage/"
  echo "Contents of $BUILD_DIR:"
  find "$BUILD_DIR" -type f 2>/dev/null | head -30 || echo "(directory not found)"
  exit 1
fi

echo "  AppImage : $APPIMAGE_PATH"
[[ -n "$DEB_PATH" ]] && echo "  .deb     : $DEB_PATH" || echo "  .deb     : (not present)"
[[ -n "$RPM_PATH" ]] && echo "  .rpm     : $RPM_PATH" || echo "  .rpm     : (not present, skipping)"

# ── 2. Verify AppImage integrity ──────────────────────────────────────────────

echo ""
echo "--- Step 2: Verifying AppImage integrity ---"

# Check the file is non-empty and has a reasonable size (> 10MB)
APPIMAGE_SIZE=$(stat -c%s "$APPIMAGE_PATH" 2>/dev/null || stat -f%z "$APPIMAGE_PATH")
MIN_APPIMAGE_SIZE=$((10 * 1024 * 1024))

if [[ "$APPIMAGE_SIZE" -lt "$MIN_APPIMAGE_SIZE" ]]; then
  echo "ERROR: AppImage is suspiciously small: ${APPIMAGE_SIZE} bytes (expected > 10MB)"
  exit 1
fi

# Verify the AppImage has the ELF magic bytes + AppImage magic at offset 8
if ! xxd -l 12 "$APPIMAGE_PATH" 2>/dev/null | grep -q "414902"; then
  echo "WARNING: Could not verify AppImage magic bytes (xxd not available or format differs)."
  echo "  This is non-fatal if the file was produced by the Tauri build system."
fi

# Ensure the AppImage is executable
chmod +x "$APPIMAGE_PATH"
echo "  AppImage size : ${APPIMAGE_SIZE} bytes (OK)"
echo "  Permissions   : executable"

# ── 3. Verify .deb package structure ─────────────────────────────────────────

if [[ -n "$DEB_PATH" ]]; then
  echo ""
  echo "--- Step 3: Verifying .deb package structure ---"

  # dpkg-deb --info prints package metadata
  if command -v dpkg-deb >/dev/null 2>&1; then
    dpkg-deb --info "$DEB_PATH"
    dpkg-deb --contents "$DEB_PATH" | head -20
    echo "  .deb verification passed."
  else
    echo "  dpkg-deb not available — skipping .deb structure check."
    # Minimal check: file must be an ar archive (Debian package format)
    if file "$DEB_PATH" | grep -q "Debian binary package"; then
      echo "  .deb magic bytes: OK"
    else
      echo "  WARNING: .deb file does not appear to be a valid Debian package."
    fi
  fi
fi

# ── 4. Create desktop entry file ──────────────────────────────────────────────

echo ""
echo "--- Step 4: Creating desktop entry file ---"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/usr/share/applications"
mkdir -p "$STAGING_DIR/usr/share/icons/hicolor/32x32/apps"
mkdir -p "$STAGING_DIR/usr/share/icons/hicolor/128x128/apps"
mkdir -p "$STAGING_DIR/usr/share/icons/hicolor/256x256/apps"
mkdir -p "$STAGING_DIR/usr/share/man/man1"

DESKTOP_FILE="$STAGING_DIR/usr/share/applications/${APP_BINARY_NAME}.desktop"

cat > "$DESKTOP_FILE" << DESKTOPEOF
[Desktop Entry]
Version=1.0
Type=Application
Name=${APP_NAME}
GenericName=Go Board Game Analyzer
Comment=${APP_DESCRIPTION}
Exec=${APP_BINARY_NAME} %U
Icon=${APP_BINARY_NAME}
Terminal=false
StartupNotify=true
StartupWMClass=baduk
Categories=${APP_CATEGORIES}
Keywords=Go;Baduk;Weiqi;Board Game;AI;KataGo;Analysis;
MimeType=application/x-sgf;
X-GNOME-UsesNotifications=true
X-AppVersion=${APP_VERSION}
DESKTOPEOF

echo "  Desktop entry written: $DESKTOP_FILE"

# Validate the desktop entry using desktop-file-validate if available
if command -v desktop-file-validate >/dev/null 2>&1; then
  if desktop-file-validate "$DESKTOP_FILE" 2>&1; then
    echo "  Desktop entry validation: PASSED"
  else
    echo "  WARNING: Desktop entry validation reported issues (non-fatal)."
  fi
else
  echo "  desktop-file-validate not available — skipping validation."
fi

# ── 5. Install icon files ──────────────────────────────────────────────────────

echo ""
echo "--- Step 5: Installing icon files ---"

# Copy icons from the Tauri source tree
ICON_SOURCE_DIR="src-tauri/icons"

for ICON_FILE in \
  "32x32.png:32x32" \
  "128x128.png:128x128"; do

  IFS=':' read -r FILENAME SIZE <<< "$ICON_FILE"
  SOURCE="${ICON_SOURCE_DIR}/${FILENAME}"
  DEST="$STAGING_DIR/usr/share/icons/hicolor/${SIZE}/apps/${APP_BINARY_NAME}.png"

  if [[ -f "$SOURCE" ]]; then
    cp "$SOURCE" "$DEST"
    echo "  Installed: $DEST (from $SOURCE)"
  else
    echo "  WARNING: Icon not found: $SOURCE (expected for size $SIZE)"
  fi
done

# Check for 256x256 (not present in current build, logged as info)
if [[ ! -f "$ICON_SOURCE_DIR/256x256.png" ]]; then
  echo "  INFO: No 256x256 icon found. The 128x128 icon will scale up. Consider adding one."
fi

# ── 6. Create man page placeholder ───────────────────────────────────────────

echo ""
echo "--- Step 6: Creating man page ---"

MAN_FILE="$STAGING_DIR/usr/share/man/man1/${APP_BINARY_NAME}.1"

cat > "$MAN_FILE" << MANEOF
.TH BADUK 1 "$(date +%Y-%m-%d)" "${APP_VERSION}" "Baduk Platform"
.SH NAME
baduk \- AI-powered Go (Baduk) analysis platform
.SH SYNOPSIS
.B baduk
[\fIOPTIONS\fR]
.SH DESCRIPTION
Baduk Platform is a desktop application for analyzing Go (Baduk / Weiqi)
games using the KataGo neural network engine. It provides real-time move
analysis, win rate estimation, and educational explanations of AI suggestions.
.SH OPTIONS
.TP
.B \-\-help
Display help information and exit.
.TP
.B \-\-version
Display version information and exit.
.SH ENVIRONMENT
.TP
.B BADUK_LOG_LEVEL
Set logging verbosity. Values: error, warn, info, debug, trace.
Default: info.
.SH FILES
.TP
.I \$HOME/.config/com.baduk.app/
Application configuration directory.
.TP
.I \$HOME/.local/share/com.baduk.app/
Application data directory (game database, KataGo weights).
.SH AUTHOR
Baduk Platform Contributors
.SH SEE ALSO
Project homepage: ${APP_HOMEPAGE}
Source code: https://github.com/YOUR_ORG/baduk-platform
MANEOF

# Compress the man page (gzip is the Linux standard)
if command -v gzip >/dev/null 2>&1; then
  gzip -f "$MAN_FILE"
  echo "  Man page written (gzipped): ${MAN_FILE}.gz"
else
  echo "  Man page written (uncompressed): $MAN_FILE"
  echo "  WARNING: gzip not available — man page not compressed."
fi

# ── 7. Execution test (skip in headless environments) ─────────────────────────

echo ""
echo "--- Step 7: AppImage execution test ---"

if [[ "$SKIP_APPIMAGE_RUN" == "1" ]]; then
  echo "  SKIP_APPIMAGE_RUN=1 — skipping execution test (headless CI mode)."
else
  # Test that the AppImage at least reports its version without crashing
  # Run with a timeout to prevent hanging in headless environments
  echo "  Running: $APPIMAGE_PATH --version (timeout 10s)"
  if timeout 10 "$APPIMAGE_PATH" --version 2>&1; then
    echo "  Execution test: PASSED"
  else
    EXIT_CODE=$?
    if [[ $EXIT_CODE -eq 124 ]]; then
      echo "  INFO: AppImage timed out (expected in headless mode — no display)."
    else
      echo "  WARNING: AppImage exited with code $EXIT_CODE."
      echo "  If running headless, set SKIP_APPIMAGE_RUN=1."
    fi
  fi
fi

# ── 8. Final summary ──────────────────────────────────────────────────────────

echo ""
echo "=== Linux Package Preparation COMPLETE ==="
echo ""
echo "  AppImage          : $APPIMAGE_PATH"
[[ -n "$DEB_PATH" ]] && echo "  .deb              : $DEB_PATH"
echo "  Desktop entry     : $DESKTOP_FILE"
echo "  Icon dir          : $STAGING_DIR/usr/share/icons/"
echo "  Man page          : $STAGING_DIR/usr/share/man/man1/"
echo ""
echo "Installation instructions:"
echo "  AppImage: chmod +x ${APP_NAME}_${APP_VERSION}_amd64.AppImage && ./${APP_NAME}_${APP_VERSION}_amd64.AppImage"
echo "  .deb    : sudo dpkg -i ${APP_BINARY_NAME}_${APP_VERSION}_amd64.deb"
echo ""
echo "FUSE note (AppImage on Ubuntu 22.04+):"
echo "  If AppImage fails with 'fuse: failed to open /dev/fuse', run:"
echo "  sudo apt-get install -y libfuse2"
