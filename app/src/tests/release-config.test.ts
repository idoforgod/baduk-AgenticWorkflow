/**
 * release-config.test.ts
 *
 * Step 24 — Release Engineer: Release Configuration Validation
 *
 * Verifies that all release artifacts, signing scripts, documentation, and
 * configuration files are structurally correct and internally consistent.
 *
 * These are static-analysis tests — they read files from disk and assert
 * structural invariants. No network, build toolchain, or runtime required.
 *
 * Test categories:
 *   1. Signing script existence and structure
 *   2. Release notes content and structure
 *   3. Version consistency across configs
 *   4. Auto-updater configuration
 *   5. CI/CD signing integration
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ── Path constants ─────────────────────────────────────────────────────────────
// Test file is at: app/src/tests/release-config.test.ts
// APP_ROOT = app/
// REPO_ROOT = ../  (one level above app/)
const APP_ROOT = resolve(__dirname, '../..')
const REPO_ROOT = resolve(__dirname, '../../..')

const SCRIPTS_DIR = resolve(APP_ROOT, 'scripts')
const OUTPUTS_DIR = resolve(APP_ROOT, 'outputs')
const TAURI_CONF = resolve(APP_ROOT, 'src-tauri/tauri.conf.json')
const PACKAGE_JSON = resolve(APP_ROOT, 'package.json')
const CI_WORKFLOW = resolve(REPO_ROOT, '.github/workflows/ci.yml')
const RELEASE_WORKFLOW = resolve(REPO_ROOT, '.github/workflows/release.yml')

// Script paths
const MACOS_SIGN_SCRIPT = resolve(SCRIPTS_DIR, 'macos-sign.sh')
const WINDOWS_SIGN_SCRIPT = resolve(SCRIPTS_DIR, 'windows-sign.ps1')
const LINUX_PACKAGE_SCRIPT = resolve(SCRIPTS_DIR, 'linux-package.sh')
const GENERATE_MANIFEST_SCRIPT = resolve(SCRIPTS_DIR, 'generate-update-manifest.sh')
const ENTITLEMENTS_PLIST = resolve(SCRIPTS_DIR, 'entitlements.plist')

// Output paths
const RELEASE_NOTES = resolve(OUTPUTS_DIR, 'step-24-release-notes.md')
const LANDING_PAGE = resolve(OUTPUTS_DIR, 'step-24-landing-page-content.md')
const README_CONTENT = resolve(OUTPUTS_DIR, 'step-24-readme-content.md')

// ── Helpers ───────────────────────────────────────────────────────────────────
function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readText(path)) as Record<string, unknown>
}

// ── Test Suite 1: Signing Script Existence ────────────────────────────────────

describe('Release Config 1: Signing scripts exist', () => {
  it('macOS signing script (macos-sign.sh) exists', () => {
    expect(existsSync(MACOS_SIGN_SCRIPT)).toBe(true)
  })

  it('Windows signing script (windows-sign.ps1) exists', () => {
    expect(existsSync(WINDOWS_SIGN_SCRIPT)).toBe(true)
  })

  it('Linux package script (linux-package.sh) exists', () => {
    expect(existsSync(LINUX_PACKAGE_SCRIPT)).toBe(true)
  })

  it('Update manifest generator script exists', () => {
    expect(existsSync(GENERATE_MANIFEST_SCRIPT)).toBe(true)
  })

  it('macOS entitlements.plist exists', () => {
    expect(existsSync(ENTITLEMENTS_PLIST)).toBe(true)
  })
})

// ── Test Suite 2: Signing Script Structure ────────────────────────────────────

describe('Release Config 2: Signing scripts use environment variables for secrets', () => {
  it('macos-sign.sh uses APPLE_ID environment variable (no hardcoded credentials)', () => {
    const content = readText(MACOS_SIGN_SCRIPT)
    expect(content).toContain('APPLE_ID')
    expect(content).toContain('APPLE_PASSWORD')
    expect(content).toContain('APPLE_TEAM_ID')
    // Must not contain real Apple domain credentials (e.g. user@icloud.com or user@apple.com)
    expect(content).not.toMatch(/"[a-zA-Z0-9._%+-]+@(apple|icloud|me)\.[a-zA-Z]{2,}"/)
    // Must not contain a hardcoded 10-character team ID literal in quotes
    expect(content).not.toMatch(/"[A-Z0-9]{10}"/)
  })

  it('macos-sign.sh uses xcrun notarytool for notarization', () => {
    const content = readText(MACOS_SIGN_SCRIPT)
    expect(content).toContain('xcrun notarytool')
    expect(content).toContain('submit')
  })

  it('macos-sign.sh staples the notarization ticket', () => {
    const content = readText(MACOS_SIGN_SCRIPT)
    expect(content).toContain('xcrun stapler staple')
  })

  it('macos-sign.sh verifies signature after signing', () => {
    const content = readText(MACOS_SIGN_SCRIPT)
    expect(content).toContain('codesign --verify')
  })

  it('windows-sign.ps1 uses WINDOWS_CERTIFICATE_PATH and WINDOWS_CERTIFICATE_PASSWORD', () => {
    const content = readText(WINDOWS_SIGN_SCRIPT)
    expect(content).toContain('WINDOWS_CERTIFICATE_PATH')
    expect(content).toContain('WINDOWS_CERTIFICATE_PASSWORD')
    // No hardcoded passwords or certificate content
    expect(content).not.toMatch(/-----BEGIN CERTIFICATE-----/)
  })

  it('windows-sign.ps1 uses SHA-256 digest algorithm', () => {
    const content = readText(WINDOWS_SIGN_SCRIPT)
    expect(content).toContain('sha256')
  })

  it('windows-sign.ps1 includes timestamp server configuration', () => {
    const content = readText(WINDOWS_SIGN_SCRIPT)
    // Must configure an RFC 3161 timestamp server
    expect(content).toContain('timestamp')
    expect(content).toMatch(/http[s]?:\/\/.*timestamp/)
  })

  it('linux-package.sh handles AppImage, deb, and desktop entry', () => {
    const content = readText(LINUX_PACKAGE_SCRIPT)
    expect(content).toContain('AppImage')
    expect(content).toContain('.deb')
    expect(content).toContain('[Desktop Entry]')
  })

  it('linux-package.sh validates AppImage minimum size', () => {
    const content = readText(LINUX_PACKAGE_SCRIPT)
    // Must reject suspiciously small AppImages (< 10MB)
    expect(content).toContain('10 * 1024 * 1024')
  })

  it('generate-update-manifest.sh produces a latest.json with all four platforms', () => {
    const content = readText(GENERATE_MANIFEST_SCRIPT)
    expect(content).toContain('darwin-aarch64')
    expect(content).toContain('darwin-x86_64')
    expect(content).toContain('windows-x86_64')
    expect(content).toContain('linux-x86_64')
  })

  it('entitlements.plist includes network client and library validation disable', () => {
    const content = readText(ENTITLEMENTS_PLIST)
    expect(content).toContain('com.apple.security.network.client')
    expect(content).toContain('com.apple.security.cs.disable-library-validation')
    // Must not enable unnecessary entitlements
    expect(content).not.toContain('com.apple.security.device.camera')
    expect(content).not.toContain('com.apple.security.device.microphone')
  })
})

// ── Test Suite 3: Release Notes Content ──────────────────────────────────────

describe('Release Config 3: Release notes content and structure', () => {
  it('release notes file exists', () => {
    expect(existsSync(RELEASE_NOTES)).toBe(true)
  })

  it('release notes contains version v1.0.0', () => {
    const content = readText(RELEASE_NOTES)
    expect(content).toContain('v1.0.0')
  })

  it('release notes lists all 7 product features (F1-F7)', () => {
    const content = readText(RELEASE_NOTES)
    // All 7 features must be present
    for (let i = 1; i <= 7; i++) {
      expect(content).toContain(`F${i}`)
    }
  })

  it('release notes includes platform installation instructions for all three platforms', () => {
    const content = readText(RELEASE_NOTES)
    expect(content).toContain('macOS')
    expect(content).toContain('Windows')
    expect(content).toContain('Linux')
  })

  it('release notes includes system requirements table', () => {
    const content = readText(RELEASE_NOTES)
    expect(content).toContain('System Requirements')
  })

  it('release notes documents known limitations', () => {
    const content = readText(RELEASE_NOTES)
    expect(content).toContain('Known Limitations')
    // SmartScreen is a real known issue for new Windows certificates
    expect(content).toContain('SmartScreen')
  })

  it('release notes includes secrets configuration table', () => {
    const content = readText(RELEASE_NOTES)
    expect(content).toContain('TAURI_SIGNING_PRIVATE_KEY')
    expect(content).toContain('APPLE_CERTIFICATE')
  })

  it('release notes documents auto-update flow', () => {
    const content = readText(RELEASE_NOTES)
    expect(content).toContain('auto-updat')
    // Must mention the signing key generation command
    expect(content).toContain('signer generate')
  })
})

// ── Test Suite 4: Version Consistency ────────────────────────────────────────

describe('Release Config 4: Version consistency across configs', () => {
  it('tauri.conf.json has a version field', () => {
    const conf = readJson(TAURI_CONF) as { version?: string }
    expect(conf.version).toBeDefined()
    expect(typeof conf.version).toBe('string')
    expect(conf.version!.length).toBeGreaterThan(0)
  })

  it('package.json has a version field', () => {
    const pkg = readJson(PACKAGE_JSON) as { version?: string }
    expect(pkg.version).toBeDefined()
    expect(typeof pkg.version).toBe('string')
  })

  it('tauri.conf.json version matches package.json version', () => {
    const conf = readJson(TAURI_CONF) as { version?: string }
    const pkg = readJson(PACKAGE_JSON) as { version?: string }
    expect(conf.version).toBe(pkg.version)
  })

  it('tauri.conf.json has productName set to Baduk', () => {
    const conf = readJson(TAURI_CONF) as { productName?: string }
    expect(conf.productName).toBe('Baduk')
  })

  it('tauri.conf.json has identifier set (app bundle ID)', () => {
    const conf = readJson(TAURI_CONF) as { identifier?: string }
    expect(conf.identifier).toBeDefined()
    expect(conf.identifier).toContain('baduk')
  })
})

// ── Test Suite 5: Auto-Updater Configuration ─────────────────────────────────

describe('Release Config 5: Auto-updater endpoint configuration', () => {
  it('tauri.conf.json updater plugin has endpoints array', () => {
    const conf = readJson(TAURI_CONF) as {
      plugins?: { updater?: { endpoints?: string[] } }
    }
    expect(conf.plugins?.updater).toBeDefined()
    const endpoints = conf.plugins?.updater?.endpoints ?? []
    expect(Array.isArray(endpoints)).toBe(true)
    expect(endpoints.length).toBeGreaterThan(0)
  })

  it('updater endpoint references GitHub Releases and latest.json', () => {
    const conf = readJson(TAURI_CONF) as {
      plugins?: { updater?: { endpoints?: string[] } }
    }
    const endpoints = conf.plugins?.updater?.endpoints ?? []
    const hasGithubEndpoint = endpoints.some(
      (e) => e.includes('github.com') && e.includes('latest.json')
    )
    expect(hasGithubEndpoint).toBe(true)
  })

  it('updater dialog is enabled (users see an update prompt)', () => {
    const conf = readJson(TAURI_CONF) as {
      plugins?: { updater?: { dialog?: boolean } }
    }
    expect(conf.plugins?.updater?.dialog).toBe(true)
  })

  it('release workflow includes updater json generation (includeUpdaterJson)', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('includeUpdaterJson: true')
  })

  it('generate-update-manifest.sh validates JSON output with python3', () => {
    const content = readText(GENERATE_MANIFEST_SCRIPT)
    // The script must validate the generated manifest
    expect(content).toContain('python3')
    expect(content).toContain('json.load')
  })
})

// ── Test Suite 6: CI/CD Signing Integration ───────────────────────────────────

describe('Release Config 6: CI/CD signing secrets integration', () => {
  it('release.yml references APPLE_CERTIFICATE secret (macOS signing)', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('secrets.APPLE_CERTIFICATE')
  })

  it('release.yml references TAURI_SIGNING_PRIVATE_KEY secret', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('secrets.TAURI_SIGNING_PRIVATE_KEY')
  })

  it('release.yml calls macos-sign.sh for macOS notarization', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('macos-sign.sh')
  })

  it('release.yml calls windows-sign.ps1 for Windows signing', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('windows-sign.ps1')
  })

  it('release.yml calls linux-package.sh for Linux verification', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('linux-package.sh')
  })

  it('release.yml build job depends on quality gates (needs: [quality, create-release])', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).toContain('needs: [quality, create-release]')
  })

  it('release.yml never contains raw key material or hardcoded secrets', () => {
    const content = readText(RELEASE_WORKFLOW)
    expect(content).not.toMatch(/-----BEGIN .* KEY-----/)
    expect(content).not.toMatch(/-----BEGIN CERTIFICATE-----/)
    // No hardcoded Apple IDs or email addresses
    expect(content).not.toMatch(/[a-zA-Z0-9._%+-]+@apple\.com/)
  })

  it('ci.yml uses ${{ secrets.* }} for all signing keys', () => {
    const content = readText(CI_WORKFLOW)
    // Must reference secrets context for signing keys
    expect(content).toContain('secrets.TAURI_SIGNING_PRIVATE_KEY')
    expect(content).toContain('secrets.APPLE_CERTIFICATE')
    // No raw key material
    expect(content).not.toMatch(/-----BEGIN .* KEY-----/)
  })

  it('landing page content file exists with hero section', () => {
    expect(existsSync(LANDING_PAGE)).toBe(true)
    const content = readText(LANDING_PAGE)
    expect(content).toContain('Hero Section')
    expect(content).toContain('Download')
    expect(content).toContain('FAQ')
  })

  it('readme content file exists with badges and quick start', () => {
    expect(existsSync(README_CONTENT)).toBe(true)
    const content = readText(README_CONTENT)
    expect(content).toContain('badge')
    expect(content).toContain('Quick Start')
    expect(content).toContain('Contributing')
  })
})
