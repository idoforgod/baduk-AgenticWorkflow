# =============================================================================
# windows-sign.ps1 — Windows Code Signing via SignTool
# =============================================================================
#
# Purpose:
#   Sign a Windows installer (.msi or .exe) using an EV (Extended Validation)
#   or OV (Organization Validation) code signing certificate via Microsoft's
#   SignTool.exe. Includes a trusted timestamp so the signature remains valid
#   after the certificate expires.
#
# Required environment variables:
#   WINDOWS_CERTIFICATE_PATH      — Path to the .pfx certificate file
#                                   OR base64-encoded .pfx content (auto-detected)
#   WINDOWS_CERTIFICATE_PASSWORD  — Password protecting the .pfx file
#
# Optional environment variables:
#   ARTIFACT_PATH    — Path to the .msi or .exe to sign (overrides $args[0])
#   TIMESTAMP_SERVER — RFC 3161 timestamp server URL
#                      Default: http://timestamp.sectigo.com (Sectigo)
#   SIGNTOOL_PATH    — Full path to SignTool.exe if not on PATH
#
# Usage from PowerShell:
#   $env:WINDOWS_CERTIFICATE_PATH = "cert.pfx"
#   $env:WINDOWS_CERTIFICATE_PASSWORD = "secret"
#   $env:ARTIFACT_PATH = "target\release\bundle\msi\Baduk_1.0.0_x64_en-US.msi"
#   .\scripts\windows-sign.ps1
#
# Usage from GitHub Actions (runner: windows-latest):
#   - name: Sign installer
#     shell: pwsh
#     env:
#       WINDOWS_CERTIFICATE_PATH: ${{ secrets.WINDOWS_CERTIFICATE_PATH }}
#       WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
#       ARTIFACT_PATH: ${{ steps.build.outputs.installer_path }}
#     run: .\scripts\windows-sign.ps1
#
# Idempotency:
#   Re-signing an already-signed binary overwrites the previous signature.
#   Safe to re-run.
#
# SmartScreen reputation note:
#   A freshly issued certificate has no SmartScreen reputation. Until the
#   binary accumulates enough downloads, users may see a "Windows protected
#   your PC" warning. Mitigations:
#     1. Use an EV certificate — EV certs receive immediate SmartScreen trust.
#     2. Submit the binary to Microsoft's malware sample portal for pre-screening.
#     3. Document the warning in release notes with screenshot + bypass instructions.
#   See: docs below for unsigned-build fallback UX.
#
# References:
#   https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool
#   https://learn.microsoft.com/en-us/windows-hardware/drivers/install/authenticode
#   https://support.sectigo.com/articles/Knowledge/Sectigo-Timestamping-Servers
# =============================================================================

#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Helper: Write colored status messages ─────────────────────────────────────
function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "--- $Message ---" -ForegroundColor Cyan
}

function Write-Success {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Fail {
  param([string]$Message)
  Write-Host "[FAIL] $Message" -ForegroundColor Red
  exit 1
}

# ── 1. Validate required environment variables ────────────────────────────────

Write-Host "=== Windows Code Signing ===" -ForegroundColor Yellow

$CertInput = $env:WINDOWS_CERTIFICATE_PATH
$CertPassword = $env:WINDOWS_CERTIFICATE_PASSWORD
$ArtifactPath = if ($env:ARTIFACT_PATH) { $env:ARTIFACT_PATH } elseif ($args.Count -gt 0) { $args[0] } else { $null }

if (-not $CertInput) {
  Write-Fail "WINDOWS_CERTIFICATE_PATH must be set (path to .pfx or base64-encoded content)"
}
if (-not $CertPassword) {
  Write-Fail "WINDOWS_CERTIFICATE_PASSWORD must be set"
}
if (-not $ArtifactPath) {
  Write-Fail "ARTIFACT_PATH must be set (path to .msi or .exe)"
}
if (-not (Test-Path $ArtifactPath)) {
  Write-Fail "Artifact not found at: $ArtifactPath"
}

# ── 2. Locate SignTool.exe ────────────────────────────────────────────────────

Write-Step "Locating SignTool.exe"

$SignToolPath = $env:SIGNTOOL_PATH

if (-not $SignToolPath) {
  # Search common Windows SDK locations (latest first)
  $SearchPaths = @(
    "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe",
    "C:\Program Files (x86)\Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe",
    "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe",
    "C:\Program Files (x86)\Windows Kits\8.1\bin\x64\signtool.exe"
  )

  foreach ($Path in $SearchPaths) {
    if (Test-Path $Path) {
      $SignToolPath = $Path
      break
    }
  }

  # Fall back to PATH
  if (-not $SignToolPath) {
    $SignToolPath = (Get-Command signtool.exe -ErrorAction SilentlyContinue)?.Source
  }
}

if (-not $SignToolPath -or -not (Test-Path $SignToolPath)) {
  Write-Fail "SignTool.exe not found. Install the Windows SDK or set SIGNTOOL_PATH."
}

Write-Success "SignTool found: $SignToolPath"

# ── 3. Prepare the certificate ────────────────────────────────────────────────

Write-Step "Preparing certificate"

$TempCertPath = $null
$CertPathToUse = $null

# Detect if input is a file path or base64-encoded content
if (Test-Path $CertInput) {
  # Direct file path (local signing, or file mounted in CI)
  $CertPathToUse = $CertInput
  Write-Success "Using certificate from file: $CertPathToUse"
} else {
  # Assume base64-encoded (as stored in GitHub Actions secrets)
  Write-Host "Input is base64-encoded — decoding to temporary file..."
  $TempCertPath = [System.IO.Path]::GetTempFileName() + ".pfx"
  [System.IO.File]::WriteAllBytes($TempCertPath, [Convert]::FromBase64String($CertInput))
  $CertPathToUse = $TempCertPath
  Write-Success "Certificate decoded to: $TempCertPath"
}

# ── 4. Configure timestamp server ────────────────────────────────────────────

$TimestampServer = if ($env:TIMESTAMP_SERVER) {
  $env:TIMESTAMP_SERVER
} else {
  # Sectigo (formerly Comodo) RFC 3161 timestamp server
  # Alternatives:
  #   http://timestamp.digicert.com (DigiCert)
  #   http://tsa.starfieldtech.com (Starfield / GoDaddy)
  #   http://timestamp.globalsign.com/scripts/timstamp.dll (GlobalSign)
  "http://timestamp.sectigo.com"
}

Write-Host "Timestamp server: $TimestampServer"

# ── 5. Sign the artifact ──────────────────────────────────────────────────────

Write-Step "Signing artifact: $ArtifactPath"

# SignTool arguments:
#   sign        — signing operation
#   /fd sha256  — file digest algorithm (SHA-256 required for modern Windows)
#   /td sha256  — timestamp digest algorithm
#   /tr         — RFC 3161 timestamp server URL
#   /f          — certificate file path
#   /p          — certificate password
#   /v          — verbose output
#   /d          — description string (appears in UAC prompt)
#   /du         — description URL (product homepage)
try {
  & "$SignToolPath" sign `
    /fd sha256 `
    /td sha256 `
    /tr "$TimestampServer" `
    /f "$CertPathToUse" `
    /p "$CertPassword" `
    /d "Baduk Platform" `
    /du "https://baduk.app" `
    /v `
    "$ArtifactPath"

  if ($LASTEXITCODE -ne 0) {
    Write-Fail "SignTool failed with exit code $LASTEXITCODE"
  }
  Write-Success "Artifact signed: $ArtifactPath"
} finally {
  # Always clean up the temporary certificate file
  if ($TempCertPath -and (Test-Path $TempCertPath)) {
    Remove-Item $TempCertPath -Force
    Write-Host "Temporary certificate file removed."
  }
}

# ── 6. Verify the signature ───────────────────────────────────────────────────

Write-Step "Verifying signature"

& "$SignToolPath" verify /pa /v "$ArtifactPath"

if ($LASTEXITCODE -ne 0) {
  Write-Fail "Signature verification failed with exit code $LASTEXITCODE"
}

Write-Success "Signature verification passed."

# ── 7. Report final status ────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Windows Code Signing COMPLETE ===" -ForegroundColor Green
Write-Host "  Artifact  : $ArtifactPath" -ForegroundColor Green
Write-Host "  Signed    : Yes (SHA-256)" -ForegroundColor Green
Write-Host "  Timestamped: Yes ($TimestampServer)" -ForegroundColor Green
Write-Host ""
Write-Host "SmartScreen reputation note:" -ForegroundColor Yellow
Write-Host "  New OV certificates may show a SmartScreen warning until the binary" -ForegroundColor Yellow
Write-Host "  accumulates download reputation. EV certificates bypass this immediately." -ForegroundColor Yellow
Write-Host "  See: outputs/step-24-release-notes.md > Known Limitations" -ForegroundColor Yellow

# =============================================================================
# FALLBACK: SmartScreen Warning UX Documentation (for unsigned/OV builds)
# =============================================================================
#
# If the build is unsigned or uses a new OV certificate without reputation:
#
# User experience on Windows:
#   1. User downloads Baduk_1.0.0_x64-setup.exe
#   2. Windows displays: "Windows protected your PC"
#      "Microsoft Defender SmartScreen prevented an unrecognized app from starting."
#   3. User can click "More info" -> "Run anyway" to proceed.
#
# Release notes must include:
#   "If Windows displays a SmartScreen warning, click 'More info' then 'Run anyway'.
#    This warning appears because our certificate is new. We are an open-source
#    project — you can verify the source code at github.com/YOUR_ORG/baduk-platform."
#
# To suppress this warning faster:
#   1. Submit the binary to Microsoft's malware portal:
#      https://www.microsoft.com/en-us/wdsi/filesubmission
#   2. Upgrade to an EV (Extended Validation) certificate.
#      EV certificates receive immediate SmartScreen reputation.
#
# =============================================================================
