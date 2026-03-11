# Strategy Planner Agent Memory

## Project: Baduk Platform

### Key Architecture Facts (verified from Step 6)
- 10 modules, 4 layers: core (L1) → rules-engine + katago-bridge (L2) → game-engine + explanation-engine (L3) → gamification (L4)
- Critical path: core → rules-engine → game-engine → gamification (4 levels deep)
- rules-engine has zero external dependencies (pure TypeScript, no Tauri IPC)
- katago-bridge communicates with KataGo via Tauri sidecar (Rust-side process management)
- explanation-engine is a pure transformation (AnalysisResponse → ExplanationOutput), NOT a real-time KataGo caller
- 29 total Tauri commands across all modules

### Interface Contracts (from Step 7)
- 6 interfaces: IRulesEngine (9 methods), IKatagoBridge (12), IExplanationEngine (5), IGameEngine (12), IGamificationService (10), IStoragePort (10)
- Result<T, E> error pattern used everywhere — discriminated union
- step-07-interfaces.ts is the SOT; never modify in feature branches

### Rules Engine Test Count
- 178 test categories defined across 11 categories
- Categories: board creation (8), placement (22), single capture (15), multi-group capture (12), suicide (10), simple ko (15), superko (12), scoring (22), game flow (12), group ops (10), edge cases (40)
- DKS edge cases EC-01 through EC-20 all have at least 2 tests each

### Key Test Strategy Decisions
- rules-engine: 100% branch coverage target (mathematical correctness, non-negotiable)
- KataGo oracle: 20 positions, Type A discrepancies (KataGo says legal, engine says illegal) block integration gate
- E2E: 12 Playwright scenarios (1 more than minimum), Tauri WebDriver
- Step 11 agents (rules-engineer + data-engineer) are fully independent — no shared files

### Branch and Integration Patterns
- Branch naming: feat/{module-name}
- Merge windows: Monday and Thursday only (prevents simultaneous merge chaos)
- 5-week timeline with 4 milestone gates (G1-G4)
- Gate G2 (rules-engine + katago-bridge) is the critical blocker for game-engine
- Package.json changes require dedicated chore/ branch — never in feat/ branches

### Common File Conflict Prevention
- Directory ownership is absolute (no overlapping)
- step-07-interfaces.ts = READ-ONLY for all feature branches
- package.json: sequential chore/ branches only
- src/core/types/: owned by @rules-engineer, read-only after scaffold

### Details file
- See `patterns.md` for extended notes on test category distribution
