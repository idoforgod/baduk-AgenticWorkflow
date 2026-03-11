# KataGo Sidecar Binaries

This directory holds the KataGo binary files for each target platform.

## Required Files

Tauri 2.0 expects platform-specific binaries named with the Rust target triple suffix.
The `tauri.conf.json` entry `"binaries/katago"` resolves to:

| Platform              | Expected Filename                                |
|-----------------------|--------------------------------------------------|
| macOS Apple Silicon   | `katago-aarch64-apple-darwin`                    |
| macOS Intel           | `katago-x86_64-apple-darwin`                     |
| Windows x64           | `katago-x86_64-pc-windows-msvc.exe`              |
| Linux x64             | `katago-x86_64-unknown-linux-gnu`                |
| Linux ARM64           | `katago-aarch64-unknown-linux-gnu`               |

## Download KataGo

Download the pre-built KataGo binary from the official releases:
https://github.com/lightvector/KataGo/releases/tag/v1.16.4

Target version: **v1.16.4** (as specified in Step 2 IPC spec).

### Backend variants (in order of performance preference):
1. **Metal** (macOS only) — `katago-v1.16.4-metal-...`
2. **CUDA** (NVIDIA GPU) — `katago-v1.16.4-cuda12...`
3. **OpenCL** (AMD/Intel GPU) — `katago-v1.16.4-opencl-...`
4. **CPU** (fallback) — `katago-v1.16.4-cpu-...`

The `katago_detect_backend` Tauri command selects the best variant at runtime.

## NN Model Files

KataGo requires a neural network model file (`.bin.gz`).
Place model files in `app/src-tauri/resources/`:

Recommended model for production: `kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`
Download from: https://katagotraining.org/networks/

For fast/small model (9x9 games): `kata1-b6c96-s175395328-d26788732.bin.gz`
Download from: https://github.com/lightvector/KataGo/releases

## Placement Checklist

After downloading:
1. Rename the binary to match the Tauri target triple format above.
2. Place in this `binaries/` directory.
3. Make executable: `chmod +x binaries/katago-aarch64-apple-darwin`
4. Place model `.bin.gz` in `src-tauri/resources/models/`
5. Place KataGo config in `src-tauri/resources/config/analysis.cfg`

## Development Without KataGo Binary

For development without a real KataGo binary:
- Use `poc/mock-katago/` — a Node.js mock that speaks the Analysis Engine protocol
- Set `BADUK_KATAGO_MOCK=1` env var to use the stub adapter

## Security Note

KataGo binaries are NOT committed to git (too large, platform-specific).
They are fetched during CI/CD build via the download scripts in `scripts/`.
