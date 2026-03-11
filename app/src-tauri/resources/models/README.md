# KataGo Neural Network Models

Place KataGo `.bin.gz` model files in this directory.

## Recommended Models

### Production (Best Quality)
`kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`
- Architecture: b18c384nbt (18 blocks, 384 channels)
- Strength: ~9 dan on 19x19
- Size: ~84 MB
- Download: https://katagotraining.org/networks/

### Fast (Low-Latency Play, 9x9 Quick Go)
`kata1-b6c96-s175395328-d26788732.bin.gz`
- Architecture: b6c96 (6 blocks, 96 channels)
- Strength: Strong kyu on 9x9
- Size: ~5 MB
- Download: https://github.com/lightvector/KataGo/releases

### Human SL Model (Optional)
`b18c384nbt-humanv0.bin.gz`
- Used with -human-model flag for human-like move generation
- Required for difficulty levels 1-15 in Step 12 30-level difficulty system
- Download: https://github.com/lightvector/KataGo/releases/tag/v1.15.0

## Configuration

Set the active model path in the Tauri app via:
- Settings → AI Engine → Model
- Default: searches for any `.bin.gz` file in this directory

The `katago_initialize` Tauri command receives the model path as a parameter.
