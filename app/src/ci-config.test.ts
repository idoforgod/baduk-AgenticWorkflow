/**
 * ci-config.test.ts
 *
 * Validates that the CI/CD configuration files are structurally correct and
 * meet the requirements of Step 19 (Multi-platform Build & CI/CD).
 *
 * These are static-analysis tests: they read config files from disk and assert
 * expected keys, values, and structural invariants — no network or build
 * toolchain required.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── Path constants ────────────────────────────────────────────────────────────
// __dirname resolves to the source file's directory at vitest runtime.
// The test file lives at:  <repo>/app/src/ci-config.test.ts
//   APP_ROOT  = <repo>/app/           → one level up  (..)
//   REPO_ROOT = <repo>/               → two levels up (../..)
// The .github/ directory lives at REPO_ROOT.
const APP_ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(__dirname, '../..')

const CI_WORKFLOW = resolve(REPO_ROOT, '.github/workflows/ci.yml')
const RELEASE_WORKFLOW = resolve(REPO_ROOT, '.github/workflows/release.yml')
const TAURI_CONF = resolve(APP_ROOT, 'src-tauri/tauri.conf.json')
const DOWNLOAD_SCRIPT = resolve(APP_ROOT, 'scripts/download-katago.sh')
const BINARIES_DIR = resolve(APP_ROOT, 'src-tauri/binaries')

// ── Helpers ───────────────────────────────────────────────────────────────────
function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readText(path))
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Step 19 — CI/CD Configuration Validation', () => {
  // ── Test 1: CI workflow file exists ────────────────────────────────────────
  it('CI workflow file exists at .github/workflows/ci.yml', () => {
    expect(existsSync(CI_WORKFLOW)).toBe(true)
  })

  // ── Test 2: Release workflow file exists ───────────────────────────────────
  it('Release workflow file exists at .github/workflows/release.yml', () => {
    expect(existsSync(RELEASE_WORKFLOW)).toBe(true)
  })

  // ── Test 3: CI workflow contains 3-platform build matrix ──────────────────
  it('CI workflow defines build matrix for macOS, Windows, and Linux', () => {
    const content = readText(CI_WORKFLOW)
    expect(content).toContain('macos-latest')
    expect(content).toContain('windows-latest')
    expect(content).toContain('ubuntu-latest')
  })

  // ── Test 4: CI workflow has quality gates job ──────────────────────────────
  it('CI workflow includes lint, type-check, and test quality gates', () => {
    const content = readText(CI_WORKFLOW)
    expect(content).toContain('npm run lint')
    expect(content).toContain('npm run type-check')
    expect(content).toContain('npm test')
  })

  // ── Test 5: CI workflow checks bundle size budget ─────────────────────────
  it('CI workflow enforces 100MB bundle size budget', () => {
    const content = readText(CI_WORKFLOW)
    // The size check uses arithmetic: 100 * 1024 * 1024
    expect(content).toContain('100 * 1024 * 1024')
  })

  // ── Test 6: CI workflow downloads KataGo per-platform ─────────────────────
  it('CI workflow downloads platform-specific KataGo sidecar binary', () => {
    const content = readText(CI_WORKFLOW)
    expect(content).toContain('download-katago.sh')
    // Each platform must have a unique binary name
    expect(content).toContain('katago-aarch64-apple-darwin')
    expect(content).toContain('katago-x86_64-apple-darwin')
    expect(content).toContain('katago-x86_64-pc-windows-msvc.exe')
    expect(content).toContain('katago-x86_64-unknown-linux-gnu')
  })

  // ── Test 7: Release workflow triggers on version tags only ────────────────
  it('Release workflow triggers exclusively on v* version tags', () => {
    const content = readText(RELEASE_WORKFLOW)
    // Must contain tag-based trigger
    expect(content).toContain('tags:')
    expect(content).toMatch(/v\[0-9\]/)
    // Must NOT trigger on arbitrary pushes or PRs
    expect(content).not.toContain('branches:\n  push:')
  })

  // ── Test 8: Release workflow includes publish step ─────────────────────────
  it('Release workflow has publish step to un-draft the release', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('draft: false')
    expect(content).toContain('publish')
  })

  // ── Test 9: Tauri config has externalBin for KataGo ───────────────────────
  it('tauri.conf.json declares KataGo as an externalBin sidecar', () => {
    const conf = readJson(TAURI_CONF) as {
      bundle?: { externalBin?: string[] }
    }
    expect(conf.bundle).toBeDefined()
    expect(Array.isArray(conf.bundle?.externalBin)).toBe(true)
    // Must include the katago sidecar entry
    const bins = conf.bundle?.externalBin ?? []
    const hasKatago = bins.some((b) => b.includes('katago'))
    expect(hasKatago).toBe(true)
  })

  // ── Test 10: Tauri config has updater plugin configured ───────────────────
  it('tauri.conf.json has updater plugin with GitHub Releases endpoint', () => {
    const conf = readJson(TAURI_CONF) as {
      plugins?: { updater?: { endpoints?: string[] } }
    }
    expect(conf.plugins?.updater).toBeDefined()
    const endpoints = conf.plugins?.updater?.endpoints ?? []
    expect(endpoints.length).toBeGreaterThan(0)
    // Endpoint must reference GitHub Releases
    const hasGithubEndpoint = endpoints.some((e) => e.includes('github.com'))
    expect(hasGithubEndpoint).toBe(true)
  })

  // ── Test 11: Tauri config targets "all" platforms ─────────────────────────
  it('tauri.conf.json bundle targets is set to "all"', () => {
    const conf = readJson(TAURI_CONF) as {
      bundle?: { targets?: string }
    }
    expect(conf.bundle?.targets).toBe('all')
  })

  // ── Test 12: Download script exists and is non-empty ──────────────────────
  it('download-katago.sh exists and contains platform handling logic', () => {
    expect(existsSync(DOWNLOAD_SCRIPT)).toBe(true)
    const content = readText(DOWNLOAD_SCRIPT)
    // Must handle all three OS cases
    expect(content).toContain('macOS')
    expect(content).toContain('Linux')
    expect(content).toContain('Windows')
    // Must validate environment variables
    expect(content).toContain('KATAGO_VERSION')
    expect(content).toContain('KATAGO_BINARY_NAME')
  })

  // ── Test 13: Download script validates corrupt downloads ──────────────────
  it('download-katago.sh rejects suspiciously small binaries', () => {
    const content = readText(DOWNLOAD_SCRIPT)
    // Must have a minimum size sanity check
    expect(content).toContain('1 * 1024 * 1024')
    expect(content).toContain('corrupt')
  })

  // ── Test 14: CI workflow does not store secrets in plain text ─────────────
  it('CI workflow uses ${{ secrets.* }} references, not plain-text credentials', () => {
    const content = readText(CI_WORKFLOW)
    // Signing keys must come from secrets context
    expect(content).toContain('secrets.TAURI_SIGNING_PRIVATE_KEY')
    expect(content).toContain('secrets.APPLE_CERTIFICATE')
    // No raw key material in the file
    expect(content).not.toMatch(/-----BEGIN .* KEY-----/)
  })

  // ── Test 15: src-tauri/binaries directory exists ──────────────────────────
  it('src-tauri/binaries directory exists for KataGo sidecar placement', () => {
    expect(existsSync(BINARIES_DIR)).toBe(true)
  })

  // ── Test 16: CI workflow uploads artifacts for each platform ──────────────
  it('CI workflow uploads build artifacts for all platforms', () => {
    const content = readText(CI_WORKFLOW)
    expect(content).toContain('upload-artifact')
    // Each platform has a unique artifact name suffix
    expect(content).toContain('macos-arm64')
    expect(content).toContain('macos-x86_64')
    expect(content).toContain('windows-x86_64')
    expect(content).toContain('linux-x86_64')
  })

  // ── Test 17: Release workflow quality gates block release builds ──────────
  it('Release workflow build job depends on quality gates passing', () => {
    const content = readText(RELEASE_WORKFLOW)
    // Build job must declare quality as a dependency via `needs:`
    // Find the build job section and check it lists quality in needs
    expect(content).toContain('needs: [quality, create-release]')
  })

  // ── Test 18: CI workflow has concurrency cancellation ─────────────────────
  it('CI workflow cancels in-flight runs for the same branch', () => {
    const content = readText(CI_WORKFLOW)
    expect(content).toContain('concurrency:')
    expect(content).toContain('cancel-in-progress: true')
  })
})
