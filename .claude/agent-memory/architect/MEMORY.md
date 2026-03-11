# Architect Agent Memory

## Baduk Platform Architecture Key Decisions

- **Architecture**: Modular monolith with 10 modules, 4 layers (Infra, Domain, App, Feature)
- **DAG verified acyclic**: topological sort completes in 4 levels
- **game-engine does NOT depend on katago-bridge**: Feature layer coordinates both
- **explanation-engine depends only on core**: Pure transformation function, receives AnalysisResponse as params
- **SQLite via Rust-side rusqlite**: Not better-sqlite3 in webview (Step 1 constraint)
- **Rules engine in TypeScript**: Not Rust (performance sufficient, unified testing)
- **DI strategy**: Simple factory at bootstrap, not container
- **29 Tauri commands**: grouped by module prefix (`storage_*`, `katago_*`, `game_*`, etc.)

## Key File Paths

- Architecture SOT: `outputs/step-06-architecture-design.md`
- Step 1 tech validation: `outputs/step-01-tech-validation-report.md`
- Step 2 KataGo IPC: `outputs/step-02-katago-ipc-spec.md`
- Step 3 rules spec: `outputs/step-03-rules-spec.md`
- Step 4 template engine: `outputs/step-04-template-engine-design.md`

## Module Dependency Summary

```
core (0 deps) <- ALL modules
storage (1: core) <- game-engine, gamification
rules-engine (1: core) <- game-engine
katago-bridge (1: core) <- feature layer only
game-engine (3: core, rules-engine, storage) <- gamification
explanation-engine (1: core) <- feature layer only
analytics (1: core) <- feature layer only
gamification (3: core, storage, game-engine) <- none
board-ui (1: core) <- UI compositions
i18n (1: core) <- UI compositions
```

## Patterns Worth Remembering

- Merged research file at `outputs/preprocessed/step-06-research-merged.md` is >256KB; read individual step files instead
- Step 2 TypeScript types for KataGo are in Section 5 (lines ~600-860)
- Step 3 entity catalog has 85 entities (E01-E85) across 13 categories
- Step 4 has 90 patterns (30 per tier) with 6-priority classification chain
