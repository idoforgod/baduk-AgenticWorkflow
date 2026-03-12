---
related_agents: [katago-researcher]
cluster: katago
---

# KataGo Integrator Agent Memory

## Key Context
- KataGo sidecar integration with IPC, watchdog, difficulty system
- Backend is compile-time (ship multiple binaries per platform)
- Analysis Engine: line-delimited JSON over stdin/stdout
- Tauri sidecar process management via Rust backend
