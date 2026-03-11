# Baduk Platform — GitHub README Content

*This file contains the optimized README content for the GitHub repository homepage.*
*Copy the content below into the repository's README.md when publishing.*

---

<!-- README.md content starts here -->

# Baduk Platform

[![CI](https://github.com/YOUR_ORG/baduk-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/baduk-platform/actions/workflows/ci.yml)
[![Release](https://github.com/YOUR_ORG/baduk-platform/actions/workflows/release.yml/badge.svg)](https://github.com/YOUR_ORG/baduk-platform/actions/workflows/release.yml)
[![Latest Release](https://img.shields.io/github/v/release/YOUR_ORG/baduk-platform)](https://github.com/YOUR_ORG/baduk-platform/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/YOUR_ORG/baduk-platform/total)](https://github.com/YOUR_ORG/baduk-platform/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: macOS | Windows | Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](https://github.com/YOUR_ORG/baduk-platform/releases/latest)

AI-powered Go (Baduk) analysis with the KataGo neural network engine.
Runs completely offline — no subscription, no account, no cloud required.

![Baduk Platform Hero Screenshot](docs/assets/screenshot-hero.png)
*Screenshot: 19x19 board analysis with AI win rate chart and natural-language explanations*

---

## Features

- **KataGo AI bundled locally** — Full KataGo v1.16.4 runs on your machine. GPU-accelerated on Apple Silicon (Metal), NVIDIA/AMD (OpenCL), with CPU fallback.
- **Natural-language explanations** — Move analysis translated into plain English at Beginner, Intermediate, or Advanced level.
- **Win rate and score charting** — Track position advantage across every move of the game.
- **All board sizes** — 9x9, 13x13, and 19x19 supported.
- **Game database with SGF** — Import and export games in SGF format (KGS, OGS, Fox Go compatible).
- **Auto-update** — One-click updates, cryptographically signed by the Tauri signing key.

---

## Quick Start

### Download (Recommended)

Download the latest release for your platform:

| Platform | Download | Requirements |
|----------|----------|--------------|
| macOS (Apple Silicon) | [Baduk_1.0.0_aarch64.dmg](https://github.com/YOUR_ORG/baduk-platform/releases/latest) | macOS 11+ |
| macOS (Intel) | [Baduk_1.0.0_x64.dmg](https://github.com/YOUR_ORG/baduk-platform/releases/latest) | macOS 11+ |
| Windows 10/11 | [Baduk_1.0.0_x64-setup.exe](https://github.com/YOUR_ORG/baduk-platform/releases/latest) | Windows 10 1809+ |
| Linux (AppImage) | [Baduk_1.0.0_amd64.AppImage](https://github.com/YOUR_ORG/baduk-platform/releases/latest) | Ubuntu 22.04+ |
| Linux (Debian/Ubuntu) | [baduk_1.0.0_amd64.deb](https://github.com/YOUR_ORG/baduk-platform/releases/latest) | Ubuntu 22.04+ |

All releases are signed and notarized. See [release notes](app/outputs/step-24-release-notes.md) for installation help.

### Build from Source

**Prerequisites:** Node.js 20+, Rust stable, system dependencies (see below)

```bash
# Clone the repository
git clone https://github.com/YOUR_ORG/baduk-platform.git
cd baduk-platform/app

# Install Node dependencies
npm install

# Download KataGo sidecar binary for your platform
# (macOS example — see scripts/download-katago.sh for all platforms)
KATAGO_VERSION=v1.16.4 \
KATAGO_ASSET=katago-v1.16.4-macos-metal-arm64 \
KATAGO_BINARY_NAME=katago-aarch64-apple-darwin \
TARGET_OS=macOS \
  bash scripts/download-katago.sh

# Start development server
npm run tauri:dev

# Build release binary
npm run tauri:build
```

**Linux prerequisites:**
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libssl-dev pkg-config libfuse2
```

---

## Screenshots

| Board + Analysis | Win Rate Chart | AI Explanations |
|-----------------|----------------|-----------------|
| ![Board screenshot](docs/assets/screenshot-board.png) | ![Chart screenshot](docs/assets/screenshot-chart.png) | ![Explanation screenshot](docs/assets/screenshot-explanation.png) |
| *19x19 mid-game position* | *Win rate over 80 moves* | *Beginner-level explanation* |

*Screenshots pending: add to `docs/assets/` after first UI build.*

---

## Architecture

```
app/
├── src/                    # React 19 + TypeScript frontend
│   ├── board-ui/           # SVG board rendering + gesture handling
│   ├── game-engine/        # Game state management (Zustand)
│   ├── rules-engine/       # Go rules (captures, ko, territory scoring)
│   ├── katago-bridge/      # KataGo IPC protocol (JSON over stdin/stdout)
│   ├── explanation-engine/ # AI output → natural language translation
│   ├── analytics/          # Win rate + score charting (Recharts)
│   ├── gamification/       # Difficulty presets
│   └── db/                 # SQLite data layer (Tauri IPC)
└── src-tauri/              # Rust backend (Tauri 2.0)
    ├── binaries/           # KataGo sidecar binary (per platform)
    └── resources/          # KataGo neural network model + config
```

**Tech stack:** Tauri 2.0 · React 19 · TypeScript · Vite 7 · Zustand · Zod · Drizzle ORM · Recharts · i18next

---

## Development

```bash
cd app

# Run all tests (1223 tests)
npm test

# Watch mode
npm run test:watch

# Lint + format check
npm run lint

# TypeScript type check
npm run type-check

# Fix lint issues
npm run lint:fix
```

**Test coverage:** 1223 tests across 20 test files covering rules engine, KataGo bridge, explanation engine, game store, analytics, settings, security audit, and CI/CD configuration.

---

## Contributing

Contributions are welcome. Before opening a pull request:

1. **Fork** the repository and create a feature branch.
2. **Run the full test suite:** `npm test` — all 1223 tests must pass.
3. **Run lint:** `npm run lint` — zero Biome errors required.
4. **Run type check:** `npm run type-check` — no TypeScript errors.
5. **Write tests** for any new behavior.
6. **Open a PR** with a clear description of the change and why it is needed.

For significant changes (new features, architecture changes), please open an issue first to discuss the approach.

**Good first issues:** Look for the `good-first-issue` label on the Issues page.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

KataGo is licensed separately under its own license: [github.com/lightvector/KataGo](https://github.com/lightvector/KataGo/blob/master/LICENSE).

---

## Acknowledgments

- [KataGo](https://github.com/lightvector/KataGo) by David J. Wu — the AI engine powering all analysis.
- [Tauri](https://tauri.app/) — cross-platform desktop app framework.
- The Go / Baduk / Weiqi community for decades of game records and theory.

<!-- README.md content ends here -->

---

*Step 24 — Release Engineer output. README content ready for GitHub repository.*
