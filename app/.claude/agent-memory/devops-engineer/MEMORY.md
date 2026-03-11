# DevOps Engineer Agent Memory

## Project: Baduk Platform

### Key File Locations

- Tauri config: `app/src-tauri/tauri.conf.json`
- KataGo binaries: `app/src-tauri/binaries/` (Tauri target-triple naming required)
- KataGo models: `app/src-tauri/resources/models/`
- CI workflows: `.github/workflows/` at REPO_ROOT (not inside `app/`)
- Build scripts: `app/scripts/`

### Vitest Path Resolution (Critical)

Test files in `app/src/` use `__dirname` which resolves to the PHYSICAL source file
location at vitest runtime. From `app/src/`:
- `resolve(__dirname, '..')` = `app/` (APP_ROOT)
- `resolve(__dirname, '../..')` = `baduk-AgenticWorkflow/` (REPO_ROOT where `.github/` lives)

This is NOT 2/3 levels as might be expected. Always verify with node -e before writing tests.

### Tauri Sidecar Naming Convention

KataGo binary must be named: `katago-{rust-target-triple}` (no extension on mac/linux,
`.exe` on Windows). Tauri reads `externalBin: ["binaries/katago"]` and resolves to
the appropriate triple at build time.

### CI Build Matrix (4 targets, not 3)

macOS requires TWO builds: `aarch64-apple-darwin` + `x86_64-apple-darwin`.
`macos-latest` is Apple Silicon so cross-compiling x86_64 works without extra setup.
Total matrix: macOS-arm64, macOS-x86_64, Windows-x86_64, Linux-x86_64.

### Size Budget

100MB total bundle limit enforced in CI via arithmetic: `$((100 * 1024 * 1024))`.
B6 model (~10MB) for CI, B18 model (~85MB gzipped) for production release builds.

### Updater pubkey

`tauri.conf.json` updater `pubkey` must remain `""` in source. The actual Ed25519
public key is set at signing time via `TAURI_SIGNING_PRIVATE_KEY` secret.
Document this for release-engineer during onboarding.

### npm audit flag

Use `--omit=dev` to avoid failing on dev-only vulnerabilities in CI.
Use `--audit-level=high` to only fail on high/critical severity.
