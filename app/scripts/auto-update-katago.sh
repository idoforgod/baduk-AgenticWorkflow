#!/usr/bin/env bash
# =============================================================================
# auto-update-katago.sh — KataGo 자동 업데이트 + 빌드 + 실행
# =============================================================================
# 사용법: bash scripts/auto-update-katago.sh
# (app/ 디렉토리에서 실행)
#
# 동작:
#   1. 현재 설치된 KataGo 버전 확인
#   2. GitHub API로 최신 릴리스 확인
#   3. 버전 비교 → 최신이면 다운로드+교체
#   4. 모델 파일 최신 여부 확인 (옵션)
#   5. Tauri 빌드
#   6. /Applications/에 설치 + 실행
# =============================================================================

set -euo pipefail

# ── 경로 설정 ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"  # app/
BINARY_DIR="${APP_DIR}/src-tauri/binaries"
BINARY_NAME="katago-aarch64-apple-darwin"
BINARY_PATH="${BINARY_DIR}/${BINARY_NAME}"
INSTALLED_APP="/Applications/Baduk.app"
INSTALLED_BINARY="${INSTALLED_APP}/Contents/MacOS/katago"

GITHUB_REPO="lightvector/KataGo"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"

# macOS Metal aarch64 asset 패턴
ASSET_PATTERN="katago-.*metal.*macos.*aarch64"

# ── 색상 출력 ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Step 1: 현재 버전 확인 ───────────────────────────────────────────────────
info "현재 KataGo 버전 확인 중..."

CURRENT_VERSION="none"
if [[ -f "$BINARY_PATH" ]]; then
  CURRENT_VERSION=$("$BINARY_PATH" version 2>&1 | head -1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
  ok "현재 바이너리 버전: ${CURRENT_VERSION} (${BINARY_PATH})"
elif [[ -f "$INSTALLED_BINARY" ]]; then
  CURRENT_VERSION=$("$INSTALLED_BINARY" version 2>&1 | head -1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
  ok "설치된 앱 버전: ${CURRENT_VERSION}"
else
  warn "KataGo 바이너리를 찾을 수 없음 — 신규 설치"
fi

# ── Step 2: GitHub 최신 릴리스 확인 ──────────────────────────────────────────
info "GitHub 최신 릴리스 확인 중... (${GITHUB_REPO})"

RELEASE_JSON=$(curl -sf "$GITHUB_API" 2>/dev/null || echo "")
if [[ -z "$RELEASE_JSON" ]]; then
  error "GitHub API 접근 실패 (네트워크 확인)"
  echo "  오프라인 모드로 진행합니다."
  LATEST_VERSION="$CURRENT_VERSION"
else
  LATEST_VERSION=$(echo "$RELEASE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tag_name','unknown'))" 2>/dev/null || echo "unknown")
  ok "최신 릴리스: ${LATEST_VERSION}"
fi

# ── Step 3: 버전 비교 ────────────────────────────────────────────────────────
NEEDS_UPDATE=false

if [[ "$CURRENT_VERSION" == "none" || "$CURRENT_VERSION" == "unknown" ]]; then
  info "KataGo 미설치 → 다운로드 필요"
  NEEDS_UPDATE=true
elif [[ "$LATEST_VERSION" == "unknown" ]]; then
  info "최신 버전 확인 불가 → 현재 버전 유지"
elif [[ "$CURRENT_VERSION" != "$LATEST_VERSION" ]]; then
  info "업데이트 발견: ${CURRENT_VERSION} → ${LATEST_VERSION}"
  NEEDS_UPDATE=true
else
  ok "이미 최신 버전입니다 (${CURRENT_VERSION})"
fi

# ── Step 4: 다운로드 + 교체 ──────────────────────────────────────────────────
NEEDS_BUILD=false

if [[ "$NEEDS_UPDATE" == "true" && -n "$RELEASE_JSON" ]]; then
  info "macOS Metal aarch64 바이너리 검색 중..."

  # GitHub release assets에서 Metal macOS aarch64 ZIP 찾기
  ASSET_URL=$(echo "$RELEASE_JSON" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    name = asset['name'].lower()
    if 'metal' in name and 'macos' in name and 'aarch64' in name and name.endswith('.zip'):
        print(asset['browser_download_url'])
        break
" 2>/dev/null || echo "")

  if [[ -z "$ASSET_URL" ]]; then
    # 패턴 매칭 실패 시 모든 assets 출력
    warn "Metal macOS aarch64 에셋을 자동으로 찾지 못했습니다."
    echo "  사용 가능한 에셋:"
    echo "$RELEASE_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for asset in data.get('assets', []):
    print(f'    - {asset[\"name\"]}')" 2>/dev/null || true
    error "자동 다운로드 실패. 수동으로 다운로드해 주세요."
  else
    info "다운로드: ${ASSET_URL}"
    ARCHIVE="/tmp/katago-latest.zip"
    EXTRACT="/tmp/katago-extract-latest"

    curl -L --retry 3 --retry-delay 5 --fail --progress-bar -o "$ARCHIVE" "$ASSET_URL"
    ok "다운로드 완료 ($(du -h "$ARCHIVE" | cut -f1))"

    # 압축 해제
    rm -rf "$EXTRACT"
    mkdir -p "$EXTRACT"
    unzip -q "$ARCHIVE" -d "$EXTRACT"

    # katago 바이너리 찾기
    KATAGO_BIN=$(find "$EXTRACT" -name "katago" -type f ! -name "*.py" ! -name "*.cfg" | head -1)
    if [[ -z "$KATAGO_BIN" ]]; then
      error "압축 파일에서 katago 바이너리를 찾을 수 없음"
      find "$EXTRACT" -type f
    else
      # 복사 + 권한 설정
      mkdir -p "$BINARY_DIR"
      cp "$KATAGO_BIN" "$BINARY_PATH"
      chmod +x "$BINARY_PATH"

      # 검증
      NEW_VERSION=$("$BINARY_PATH" version 2>&1 | head -1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
      ok "바이너리 업데이트 완료: ${NEW_VERSION} ($(du -h "$BINARY_PATH" | cut -f1))"
      NEEDS_BUILD=true

      # 새 모델이 동봉된 경우 복사
      NEW_MODEL=$(find "$EXTRACT" -name "*.bin.gz" -type f | head -1)
      if [[ -n "$NEW_MODEL" ]]; then
        MODEL_DIR="${APP_DIR}/src-tauri/resources/models"
        mkdir -p "$MODEL_DIR"
        cp "$NEW_MODEL" "${MODEL_DIR}/default-model.bin.gz"
        ok "모델 파일도 업데이트됨: $(du -h "${MODEL_DIR}/default-model.bin.gz" | cut -f1)"
      fi
    fi

    # 정리
    rm -f "$ARCHIVE"
    rm -rf "$EXTRACT"
  fi
fi

# ── Step 5: Tauri 빌드 ───────────────────────────────────────────────────────
if [[ "$NEEDS_BUILD" == "true" ]]; then
  info "Tauri 앱 빌드 중... (업데이트 적용)"
  cd "$APP_DIR"
  npx tauri build 2>&1 | tail -5

  # /Applications/에 설치
  pkill -9 -f "baduk" 2>/dev/null || true
  sleep 1
  rm -rf "$INSTALLED_APP"
  cp -R "${APP_DIR}/src-tauri/target/release/bundle/macos/Baduk.app" "$INSTALLED_APP"
  ok "앱 설치 완료: ${INSTALLED_APP}"
else
  info "빌드 불필요 (변경 없음)"
fi

# ── Step 6: 앱 실행 ──────────────────────────────────────────────────────────
if [[ -d "$INSTALLED_APP" ]]; then
  info "Baduk 앱 실행 중..."
  open "$INSTALLED_APP"
  ok "게임을 시작하세요! 🎮"
else
  warn "설치된 앱이 없습니다. 먼저 빌드해 주세요: cd app && npx tauri build"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  KataGo: ${LATEST_VERSION:-$CURRENT_VERSION}"
echo "  Backend: Metal (Apple Silicon)"
echo "  App: ${INSTALLED_APP}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
