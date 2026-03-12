# Baduk Platform — AI Agentic Workflow Automation System

> **제1 목적 (절대 목표)**: 알파고보다 더 뛰어난 바둑 게임 — 로컬 서비스를 **자동으로** 구현하는 "AI agentic workflow automation system"
>
> 이 워크플로우의 모든 단계, 모든 에이전트, 모든 검증은 이 제1 목적에 종속된다.

## Overview

- **Input**: PRD 문서 (`coding-resource/PRD.md`), 4대 심층조사 자료 (`prompt/prd-research-*.md`), AgenticWorkflow parent genome
- **Output**: Fully functional Baduk platform desktop app — Tauri 2.0 (macOS/Windows/Linux), "Why?" AI explanation engine, Quick Go (9×9, 3min), KataGo AI matches (30 levels), Zero-to-First-Game onboarding, gamification, i18n (en/ko/ja)
- **Frequency**: One-time (6-month development lifecycle, M1→M2→M3)
- **Execution**: Hybrid (sequential + Agent Team parallel) — 모듈 경계가 명확한 구간에서 Agent Team 병렬 실행
- **Autopilot**: partial — Go/No-Go 마일스톤 게이트만 수동, 나머지 (human) 단계 자동 승인
- **pACS**: enabled

### Absolute Goal Anchor

> **Every step, every agent, every decision in this workflow serves one purpose:**
> Build a Baduk game platform that surpasses AlphaGo — as a local desktop service — **automatically** via AI agentic workflow.
>
> "AlphaGo 초월" = "더 강한 AI"가 아니라 **"더 잘 설명하는 AI"**. KataGo(프로 9단+)가 이미 충분히 강하다. 유일한 moat는 **"왜 이 수가 좋은/나쁜지" 자연어 해설**이다.

---

## Inherited DNA (Parent Genome)

> This workflow inherits the complete genome of AgenticWorkflow.
> Purpose: Automated software construction of a Baduk platform.
> The genome is identical; only domain-specific genes are differentially expressed.
> See `soul.md §0`.

### Constitutional Principles

**1. Quality Absolutism (품질 절대주의)**
> Speed, token cost, and volume limits are ignored. The sole criterion is the quality of the final Baduk platform.
- AI explanation accuracy must be anchored to KataGo data — no hallucinated Go advice
- Go rules engine must be mathematically complete (Tromp-Taylor, 130+ tests)
- Template explanation coverage ≥80% before M1 gate passage
- Every UI component must serve the "Why?" AI explanation experience

**2. Single-File SOT (단일 파일 진실 원천)**
> `.claude/state.yaml` is the sole state file. Orchestrator or Team Lead is the only writer.
- Agent Team steps: Team Lead holds SOT write lock during team lifetime
- Sequential steps: Orchestrator (main session) writes SOT
- All agents access SOT as read-only
- `active_team` schema tracks parallel execution state

**3. Code Change Protocol (코드 변경 프로토콜)**
> All code changes follow: Intent → Ripple Analysis → Change Design.
- Research/Planning document edits: minor changes (Step 1 only)
- Implementation code changes: standard/major changes (full 3-step CCP)
- **CAP-1**: Think before coding — understand the module's role in the full platform
- **CAP-2**: Simplicity first — prefer established patterns (React 19, Zustand, Drizzle)
- **CAP-3**: Goal-driven execution — every line of code serves the 제1 목적
- **CAP-4**: Surgical changes — modify only what's needed, preserve working code

**Domain Constraints (NEVER DO — PRD §13.1 절대 제약)**
> 1. **자체 AI 엔진 개발 절대 금지** — KataGo(MIT)가 유일한 현실적 선택. Leela Zero 팀도 2019년 중단.
> 2. **OpenAI/Gemini API 사용 불가** — 양사 TOS 명시적 금지. Claude API만 허용 (Phase 2, 사용자 자체 키).
> 3. **월 운영비 $15 한도** — 로컬 앱 P2P 구조로 Phase 1 $2/mo, Phase 2 $7-12/mo.

### Inherited Patterns

| # | DNA Component | Manifestation in This Workflow |
|---|--------------|-------------------------------|
| 1 | 3-Phase Structure | Research (5) → Planning (4) → Implementation (16 across M1/M2/M3) |
| 2 | 4-Layer QA | L0 (Anti-Skip: output ≥100 bytes) → L1 (Verification) → L1.5 (pACS F/C/L) → L2 (Review) |
| 3 | P1 Hallucination Prevention | KataGo = truth source; LLM = translator only; template fallback for 사활/패/세키 |
| 4 | Safety Hooks | `block_destructive_commands.py`, `block_test_file_edit.py` (TDD Guard) |
| 5 | Adversarial Review | `@reviewer` for code outputs, `@fact-checker` for research outputs |
| 6 | Decision Log | All `(human)` decisions logged in `autopilot-logs/step-N-decision.md` |
| 7 | Context Preservation | Session snapshots via `save_context.py` / `restore_context.py` |
| 8 | Cross-Step Traceability | `[trace:step-N]` markers link outputs to their source steps |
| 9 | SOT Pattern | `.claude/state.yaml` with `active_team` schema for Agent Team steps |
| 10 | DKS | Baduk domain knowledge structure (rules, patterns, scoring, KataGo protocol) |

### Domain-Specific Gene Expression

- **CCP (Code Change Protocol)** — 강하게 발현. 소프트웨어 개발 워크플로우의 핵심. 모든 코드 변경에 3단계 프로토콜 적용.
- **DKS (Domain Knowledge Structure)** — 강하게 발현. 바둑 도메인(규칙, 전략 패턴, KataGo 분석 데이터)의 정확한 구조화가 규칙 엔진·해설 엔진 품질을 결정.
- **P1 (Data Refinement)** — 강하게 발현. KataGo JSON 분석 데이터 → 자연어 해설 변환에서 노이즈 제거가 핵심.
- **Safety Hooks** — 강하게 발현. Strategic TDD + SonarQube + Biome 자동 검증 게이트.
- **Agent Team SOT** — 새롭게 발현. 병렬 모듈 개발에서 `active_team` 스키마로 상태 정합성 보장.

---

## Research

### 1. Technology Stack Validation PoC
- **Pre-processing**: `scripts/extract_prd_tech_stack.py` — PRD §5 기술 스택 섹션만 추출하여 정제 (Pattern B: PRD 전체 ~50KB 중 기술 섹션만 필요)
- **Agent**: `@tech-validator` (sonnet)
- **Verification**:
  - [ ] Tauri 2.0 프로젝트가 macOS, Windows, Linux에서 빌드 성공 (3 OS 빌드 로그 포함)
  - [ ] Vite + React 19 + TypeScript strict 개발 서버가 정상 구동
  - [ ] KataGo 바이너리가 Tauri sidecar로 spawn 가능 (프로세스 통신 확인)
  - [ ] SQLite (better-sqlite3) + Drizzle ORM 기본 CRUD 동작 확인
  - [ ] Biome v2.3 린트 + Vitest 테스트 실행 파이프라인 확인
  - [ ] Step 6 아키텍처 설계에 필요한 기술 제약 사항이 모두 문서화됨 (파이프라인 연결)
- **Task**: Build a minimal Tauri 2.0 + Vite + React 19 project that spawns KataGo as a sidecar process, connects to SQLite via Drizzle ORM, and runs Biome lint + Vitest. Verify build success on macOS, Windows, and Linux. Document all compatibility issues, workarounds, and technical constraints. Pay special attention to Tauri 2.0 sidecar configuration for KataGo binary bundling.
- **Output**: `outputs/step-01-tech-validation-report.md`
- **Review**: `@fact-checker` — 기술 호환성 주장의 사실 검증
- **Translation**: `@translator` → `outputs/step-01-tech-validation-report.ko.md`
- **Post-processing**: `scripts/extract_tech_constraints.py` — 기술 제약 사항을 구조화된 YAML로 추출 → Step 6 입력

### 2. KataGo Analysis Engine Research
- **Agent**: `@katago-researcher` (opus)
- **Verification**:
  - [ ] Analysis Engine JSON 프로토콜의 모든 필드가 문서화됨 (query, response, info, moveInfo)
  - [ ] GPU 자동 감지 로직 (CUDA → OpenCL → Eigen 폴백) 순서가 명세됨
  - [ ] 프로세스 생명주기 (spawn, health check, watchdog, circuit breaker) 설계가 포함됨
  - [ ] KataGo 바이너리 번들링 전략 (b6c96 ~15MB 기본, b18c384nbt ~70MB 선택) 명시
  - [ ] visits 단계별 설정 (5/50/500) 및 저사양 대응 (자동 축소 50-100) 전략 포함
  - [ ] Step 12 KataGo 통합 구현에 직접 사용 가능한 IPC 프로토콜 명세 포함 (파이프라인 연결)
- **Task**: Deep-dive research on KataGo v1.16.2 Analysis Engine. Document the complete JSON stdin/stdout protocol (query format, response fields, moveInfo structure). Research GPU auto-detection strategy (CUDA → OpenCL → CPU Eigen fallback). Design process lifecycle: spawn, health monitoring, watchdog with 3s backoff, circuit breaker (5 failures / 10 min). Define NN model bundling: b6c96 (~15MB, bundled) vs b18c384nbt (~70MB, separate download). Define visits tiers: 5 (instant), 50 (quick), 500 (deep). Include hardware benchmark strategy for low-spec auto-adjustment.
- **Output**: `outputs/step-02-katago-ipc-spec.md`
- **Review**: `@fact-checker` — KataGo 프로토콜 정확성 검증 (공식 문서 대조)
- **Translation**: `@translator` → `outputs/step-02-katago-ipc-spec.ko.md`

### 3. Baduk Domain Knowledge Construction
- **Agent**: `@domain-expert` (opus)
- **Verification**:
  - [ ] Tromp-Taylor 규칙 10문장이 완전히 명세되고, 각 문장에 구현 함의(implementation note)가 첨부됨
  - [ ] DKS에 최소 50개 엔티티, 30개 관계, 20개 제약 조건이 포함됨
  - [ ] 에지 케이스 목록: 사활(life/death), 패(ko), 세키(seki), snapback, 만년패 포함 (최소 15개)
  - [ ] Chinese scoring 알고리즘이 단계별로 명세됨
  - [ ] 1D Uint8Array 보드 표현 + Zobrist hashing 설계가 포함됨
  - [ ] Step 11 규칙 엔진 구현과 Step 13 템플릿 엔진에서 직접 참조 가능한 형식 (파이프라인 연결)
- **Task**: Build a comprehensive Baduk Domain Knowledge Structure (DKS). (1) Fully specify Tromp-Taylor rules (10 sentences) with implementation notes for each. (2) Construct DKS YAML: entities (board positions, stones, groups, liberties, territories, eyes), relations (adjacent, captures, contains), constraints (ko rule, superko, suicide prohibition). (3) Document all edge cases: life/death, ko, seki, snapback, eternal ko, bent-four-in-corner. (4) Specify Chinese scoring algorithm step-by-step. (5) Design 1D Uint8Array board representation with Zobrist hashing for O(1) superko detection. (6) Define incremental build order: Place → Capture → Ko → Scoring → Superko. (7) Catalog data sources: CWI Dataset (88,000 pro games — pattern learning), featurecat/go-dataset (21.1M games — large-scale pattern analysis), @sabaki/sgf (npm — SGF parsing/serialization). Define acquisition method and usage for each.
- **Output**: `outputs/step-03-domain-knowledge.yaml` + `outputs/step-03-rules-spec.md`
- **Review**: `@fact-checker` — 바둑 규칙 정확성 검증 (Tromp-Taylor 원문 대조)
- **Translation**: `@translator` → `outputs/step-03-rules-spec.ko.md`
- **Post-processing**: `python3 .claude/hooks/scripts/validate_domain_knowledge.py --project-dir . --check-output --step 3`

### 4. Template Explanation Engine Design
- **Pre-processing**: `scripts/collect_katago_samples.py` — KataGo Analysis Engine 샘플 출력 10개를 수집·정제 (Step 2 IPC 명세 기반)
- **Agent**: `@template-designer` (opus)
- **Verification**:
  - [ ] KataGo 분석 출력의 모든 핵심 필드(winrate, scoreLead, order, prior, visits, pv)가 패턴 매칭에 매핑됨
  - [ ] 3-tier 해설 템플릿이 각 tier별 최소 20개 패턴으로 정의됨 (입문 20+, 중급 20+, 고급 20+)
  - [ ] 고위험 포지션(사활/패/세키) 필수 템플릿 폴백 규칙이 명시됨
  - [ ] 핵심 원칙 "LLM = 번역기, KataGo = 진실의 원천"이 설계에 구조적으로 반영됨
  - [ ] 커버리지 80%+ 달성을 위한 패턴 분류 체계가 포함됨
  - [ ] Step 13 구현에 직접 사용 가능한 패턴 카탈로그 형식 (파이프라인 연결)
- **Task**: Design the "Why?" Template Explanation Engine architecture. (1) Map every KataGo Analysis Engine output field to explanation patterns: winrate delta → good/bad move, scoreLead → territory assessment, top moves → alternative suggestions, pv (principal variation) → "if you play here..." sequences. (2) Create 3-tier template catalog: Beginner (no Go terms, daily language), Intermediate (basic terms like atari, liberty, territory), Advanced (professional analysis: influence, thickness, aji). Minimum 20 patterns per tier. (3) Define mandatory template fallback for high-risk positions: life/death, ko, seki — LLM has ZERO Go understanding, so these MUST use pre-verified templates. (4) Design pattern matching priority: exact match → category match → generic fallback. (5) Define coverage measurement methodology (target: 80%+). (6) Define the AI explanation tone/personality: evaluate analytical vs encouraging vs Socratic style, and recommend the default tone with per-tier variation (e.g., encouraging for beginners, analytical for advanced). This is an open item (PRD §11.2 #6) that must be resolved here for Step 13 implementation.
- **Output**: `outputs/step-04-template-engine-design.md` + `outputs/step-04-pattern-catalog.yaml`
- **Review**: `@reviewer` — 설계 완전성 + `@fact-checker` — 바둑 용어·패턴 정확성
- **Translation**: `@translator` → `outputs/step-04-template-engine-design.ko.md`

### 5. (human) Research Review & Direction Approval
- **Action**: Review all research outputs (Steps 1-4). Verify technology choices, KataGo IPC approach, domain knowledge completeness, template engine design. Approve or request revisions.
- **Command**: `/review-research`
- **Autopilot Default**: Auto-approve if all Step 1-4 pACS scores ≥ 70 (GREEN). Log decision rationale.

---

## Planning

### 6. System Architecture Design
- **Pre-processing**: `scripts/merge_research_outputs.py` — Step 1-4 산출물의 기술 제약·DKS·IPC 명세를 통합 아키텍처 입력으로 병합
- **Agent**: `@architect` (opus)
- **Verification**:
  - [ ] Modular Monolith 아키텍처가 최소 8개 모듈로 분해됨: core, board-ui, game-engine, rules-engine, katago-bridge, explanation-engine, gamification, analytics
  - [ ] Ports/Adapters 패턴이 적용되어 벤더 교체가 1파일 수정으로 가능한 구조
  - [ ] Tauri commands (Rust↔JS) IPC 인터페이스가 모듈별로 정의됨
  - [ ] 모듈 간 의존 그래프가 DAG(비순환)임이 명시됨
  - [ ] Step 1 기술 제약 사항이 모두 반영됨 (source: Step 1)
  - [ ] Step 7 인터페이스 계약 정의에 필요한 모듈 경계가 명확 (파이프라인 연결)
  - [ ] Step 11 Agent Team 병렬 개발에 필요한 모듈 독립성이 보장됨 (파이프라인 연결)
- **Task**: Design the Modular Monolith architecture for the Baduk platform. (1) Define module boundaries: `core` (shared types, utilities), `board-ui` (SVG board, Shudan fork, 20 components), `game-engine` (GameReducer, game flow, timer), `rules-engine` (Tromp-Taylor, scoring, Zobrist), `katago-bridge` (sidecar, IPC, watchdog, GPU detection), `explanation-engine` (template matching, 3-tier generation), `gamification` (quests, levels, streaks, badges), `analytics` (PostHog, Sentry). (2) Apply Ports/Adapters: define port interfaces for KataGo, SQLite, analytics, i18n — each replaceable via single adapter file. (3) Define Tauri command boundaries per module. (4) Produce module dependency DAG ensuring no circular dependencies. (5) Validate parallel development feasibility: rules-engine and katago-bridge must be independently developable with shared interface contracts only.
- **Output**: `outputs/step-06-architecture-design.md`
- **Review**: `@reviewer` — 아키텍처 논리 완전성, 모듈 경계 명확성
- **Translation**: `@translator` → `outputs/step-06-architecture-design.ko.md`
- **Post-processing**: `python3 .claude/hooks/scripts/validate_traceability.py --project-dir . --check-output --step 6` — Step 1 기술 제약 사항 추적성 검증

### 7. Data Model & Interface Contracts
- **Pre-processing**: `scripts/extract_entities_from_dks.py` — Step 3 DKS에서 데이터 엔티티 목록 추출
- **Agent**: `@schema-designer` (opus)
- **Verification**:
  - [ ] SQLite 테이블 최소 6개: users, games, moves, analysis, gamification_progress, settings
  - [ ] Drizzle ORM 스키마가 TypeScript 코드로 작성됨 (마이그레이션 포함)
  - [ ] 모듈 간 TypeScript 인터페이스가 모든 모듈 경계(Step 6)에 대해 정의됨
  - [ ] Zod 검증 스키마가 Tauri command I/O에 대해 정의됨
  - [ ] KataGo Analysis Engine JSON 요청/응답 타입이 TypeScript로 정의됨 (source: Step 2)
  - [ ] Step 10 스캐폴딩에서 즉시 사용 가능한 형식 (파이프라인 연결)
  - [ ] Step 11 Team의 rules-engineer와 data-engineer가 독립 참조 가능한 인터페이스 분리 (파이프라인 연결)
- **Task**: Design the complete data model and interface contracts. (1) SQLite schema: `users` (id, name, level, created_at), `games` (id, board_size, rules, result, started_at, ended_at), `moves` (game_id, move_number, player, coordinate, timestamp — append-only log), `analysis` (game_id, move_number, katago_data JSON, explanation_text, tier), `gamification_progress` (user_id, daily_quests JSON, streaks, badges JSON, xp, level), `settings` (key, value). (2) Drizzle ORM schema in TypeScript with WAL mode configuration. (3) Module interface contracts as TypeScript interfaces + Zod schemas: `IRulesEngine`, `IKatagoBridge`, `IExplanationEngine`, `IGameEngine`, `IGamificationService`. (4) KataGo IPC types: `KataGoQuery`, `KataGoResponse`, `MoveInfo`, `AnalysisResult`. (5) Tauri command types per module with Zod validation.
- **Output**: `outputs/step-07-data-model.md` + `outputs/step-07-schema.ts` + `outputs/step-07-interfaces.ts`
- **Review**: `@reviewer` — 스키마 정규화, 인터페이스 완전성
- **Translation**: `@translator` → `outputs/step-07-data-model.ko.md`

### 8. Test Strategy & Parallel Execution Plan
- **Agent**: `@strategy-planner` (sonnet)
- **Verification**:
  - [ ] Strategic TDD 계획이 모듈별로 정의됨 (테스트 우선 모듈 vs 구현 우선 모듈)
  - [ ] 규칙 엔진 테스트 130+ 케이스가 카테고리별로 분류됨 (place, capture, ko, scoring, superko, edge)
  - [ ] KataGo oracle 교차 검증 방법론이 명세됨
  - [ ] E2E 테스트 시나리오 최소 10개 (Playwright)
  - [ ] Agent Team 병렬 실행을 위한 모듈별 branch 전략이 정의됨
  - [ ] 충돌 방지 규칙: 공유 파일(package.json, tsconfig, types) 수정은 순차 통합 시에만
  - [ ] 통합 주기: 주 1-2회 순차 통합 스케줄
  - [ ] Step 11 Team과 Step 17 Team의 branch 전략이 구체적으로 명시됨 (파이프라인 연결)
- **Task**: Create the test strategy and parallel execution plan. (1) Strategic TDD plan: rules-engine (test-first — mathematical correctness critical), katago-bridge (test-first — IPC reliability critical), explanation-engine (test-first — coverage measurement), game-engine (implementation-first — UI-dependent), board-ui (implementation-first — visual). (2) Rules engine test categories: stone placement (20+), capture mechanics (25+), ko detection (15+), scoring (20+), superko (10+), edge cases (40+). Include KataGo oracle cross-validation: run same positions through KataGo and rules engine, compare results. (3) E2E scenarios: first game flow, Quick Go complete game, AI difficulty adjustment, explanation display, SGF export, onboarding completion, gamification quest, settings change, multi-language switch, offline mode. (4) Parallel execution: module-based branches (`feat/rules-engine`, `feat/katago-bridge`, `feat/data-layer`), interface contracts as merge-conflict firewall, sequential integration schedule (Monday/Thursday merges).
- **Output**: `outputs/step-08-test-strategy.md` + `outputs/step-08-parallel-plan.md`
- **Review**: none
- **Translation**: `@translator` → `outputs/step-08-test-strategy.ko.md`

### 9. (human) Architecture & Plan Approval
- **Action**: Review architecture design (Step 6), data model & interfaces (Step 7), test strategy & parallel plan (Step 8). Approve module boundaries, interface contracts, and parallel execution strategy. This is the last checkpoint before code generation begins.
- **Command**: `/review-architecture`
- **Autopilot Default**: Auto-approve if all Step 6-8 pACS scores ≥ 70 (GREEN) and architecture DAG has no cycles. Log decision rationale.

---

## Implementation — M1: Core Engine (Month 1-2)

> **M1 Go/No-Go 기준**: 템플릿 커버리지 80%+ & 코어 엔진 완성 & Tauri 빌드 3 OS 성공

### 10. (team) Project Scaffolding
- **Team**: `m1-scaffold`
- **Checkpoint Pattern**: standard (≤ 10 turns each)
- **Tasks**:
  - `@scaffold-frontend` (sonnet): Set up Vite + React 19 + TypeScript strict + Tailwind CSS 4 + shadcn/ui + Zustand + Biome v2.3 + Vitest + @use-gesture (touch interaction). Create project structure matching Step 6 module boundaries. Configure path aliases, ESLint→Biome migration, Vitest config. Set up SonarQube Community (SQALE ≤5% threshold) for code quality gate — required by Step 15 and Step 21. Output: `src/` frontend scaffold with working dev server.
  - `@scaffold-backend` (sonnet): Set up Tauri 2.0 with Rust sidecar configuration. Configure SQLite (better-sqlite3, WAL mode) + Drizzle ORM with Step 7 schema. Set up KataGo sidecar binary path configuration. Configure Tauri commands skeleton per Step 6 modules. Output: `src-tauri/` backend scaffold with working Tauri build.
- **Verification**:
  - [ ] `npm run dev` starts Vite dev server without errors
  - [ ] `npm run tauri dev` builds and launches Tauri app window
  - [ ] Drizzle ORM migration runs successfully, creates all 6 tables (source: Step 7)
  - [ ] Biome lint passes with zero warnings on scaffold code
  - [ ] Vitest runs with placeholder test passing
  - [ ] Project structure matches Step 6 module boundaries (source: Step 6)
  - [ ] Step 7 interface contracts (`interfaces.ts`) are importable from all modules (파이프라인 연결)
- **Join**: Team Lead merges both scaffolds, verifies combined `npm run tauri build` succeeds on local OS.
- **SOT**: Team Lead writes `active_team` → `completed_teams` on completion.
- **Output**: Working Tauri 2.0 project scaffold with all tooling configured
- **Review**: `@reviewer` — 프로젝트 구조 일관성, 설정 완전성
- **Translation**: none (code)

### 11. (team) Core Modules — Rules Engine + Data Layer
- **Team**: `m1-core`
- **Checkpoint Pattern**: dense (규칙 엔진은 증분 빌드 — Place→Capture→Ko→Scoring→Superko)
- **Tasks**:
  - `@rules-engineer` (opus): Implement Tromp-Taylor rules engine in TypeScript. (1) 1D Uint8Array board representation. (2) Zobrist hashing for O(1) superko detection. (3) Incremental build: Place stone → Capture logic → Ko detection → Chinese scoring → Superko. (4) Pure functions, no side effects. (5) Write 130+ tests with KataGo oracle cross-validation. Target: 300-500 lines TypeScript. Reference: Step 3 rules spec (`outputs/step-03-rules-spec.md`) and Step 3 DKS (`outputs/step-03-domain-knowledge.yaml`).
    - **Checkpoints** (dense):
      - CP-1: Board representation + stone placement + basic capture (40+ tests)
      - CP-2: Ko detection + Zobrist hashing + Chinese scoring (70+ tests)
      - CP-3: Superko + edge cases + KataGo oracle validation (130+ tests)
  - `@data-engineer` (sonnet): Implement SQLite data layer + GameReducer. (1) Drizzle ORM migrations from Step 7 schema. (2) GameReducer: local game state management with Zustand. (3) Append-only move log with SQLite transactions. (4) Game lifecycle: create → play → end → save. (5) SGF export utility. Reference: Step 7 data model (`outputs/step-07-schema.ts`).
    - **Checkpoints** (dense):
      - CP-1: Drizzle migrations + basic CRUD for all 6 tables
      - CP-2: GameReducer + move log + game lifecycle
      - CP-3: SGF export + integration tests
- **Verification**:
  - [ ] Rules engine: 130+ tests pass, including KataGo oracle cross-validation
  - [ ] Rules engine: Tromp-Taylor 10 rules all implemented and tested (source: Step 3)
  - [ ] Rules engine: Zobrist hashing produces unique hashes for all test positions
  - [ ] Data layer: All 6 tables CRUD operations tested (source: Step 7)
  - [ ] Data layer: GameReducer correctly manages game state transitions
  - [ ] Data layer: SGF export produces valid SGF files parseable by @sabaki/sgf
  - [ ] Both modules import shared interfaces from Step 7 without modification (파이프라인 연결)
  - [ ] Step 12 KataGo 통합에서 rules-engine의 `IRulesEngine` 인터페이스를 직접 사용 가능 (파이프라인 연결)
- **Join**: Team Lead merges both modules, runs combined test suite, verifies no interface conflicts.
- **SOT**: Team Lead writes `active_team` during execution, `completed_teams` on completion.
- **Output**: `src/engine/rules/` + `src/db/` + `src/game/` with full test suites
- **Review**: `@reviewer` — 코드 품질, 테스트 완전성, 인터페이스 준수
- **Translation**: none (code)

### 12. KataGo Integration
- **Agent**: `@katago-integrator` (opus)
- **Verification**:
  - [ ] Tauri sidecar spawn이 macOS/Windows/Linux에서 동작 확인
  - [ ] Analysis Engine JSON 프로토콜 (stdin/stdout) 통신 성공 (query → response 왕복)
  - [ ] GPU 자동 감지 (CUDA → OpenCL → Eigen) 폴백 체인 동작
  - [ ] Watchdog: 3s backoff, 5 failures/10min circuit breaker 구현 및 테스트
  - [ ] worker_threads를 사용한 비블로킹 IPC 구현
  - [ ] visits 3단계 (5/50/500) 구성 가능, 저사양 자동 축소 (50-100) 동작
  - [ ] 30-level difficulty system: visits + noise injection + temperature 조합으로 입문자~프로급 30단계 매핑 구현 및 테스트
  - [ ] NN 모델 로드: b6c96 (번들) 기본, b18c384nbt (다운로드) 선택 가능
  - [ ] HumanSL-ready interface: `IKatagoBridge`에 HumanSL 모델 전환을 위한 Ports/Adapters 확장점 포함 (Phase 2 준비)
  - [ ] Step 2 IPC 명세의 모든 기능이 구현됨 (source: Step 2)
  - [ ] Step 13 템플릿 엔진에서 `IKatagoBridge` 인터페이스로 호출 가능 (파이프라인 연결)
- **Task**: Implement KataGo integration as Tauri sidecar with full process lifecycle management. (1) Sidecar spawn: configure Tauri sidecar for KataGo binary per OS (macOS/Windows/Linux path differences). (2) IPC layer: JSON stdin/stdout protocol via worker_threads for non-blocking communication. Implement query builder (board state → KataGo query JSON) and response parser (KataGo response → typed AnalysisResult). (3) GPU detection: probe CUDA → OpenCL → fall back to CPU Eigen. Store detection result for session. (4) Watchdog: monitor KataGo process health, auto-restart on crash with 3s exponential backoff, circuit breaker after 5 failures in 10 minutes. (5) Visits management: 5 (instant play), 50 (quick analysis), 500 (deep review). Auto-reduce to 50-100 on low-spec hardware based on initial benchmark. (6) Model management: bundle b6c96 (~15MB), provide download UI for b18c384nbt (~70MB). (7) 30-level difficulty system: design and implement a 30-step difficulty mapping from beginner to pro-level, combining KataGo parameters (visits, playoutDoublingAdvantage, noise, temperature). Each level must produce noticeably different playing strength. (8) HumanSL interface preparation: design `IKatagoBridge` with Ports/Adapters extension point for Phase 2 HumanSL model ("AI plays like 5-kyu"), ensuring AnalysisEngine interface supports model switching without breaking existing code. Reference: Step 2 IPC spec (`outputs/step-02-katago-ipc-spec.md`), Step 7 interfaces (`outputs/step-07-interfaces.ts`).
- **Output**: `src/engine/katago/` with full test suite
- **Review**: `@reviewer` — IPC 안정성, 에러 핸들링, 프로세스 관리 로직
- **Translation**: none (code)
- **Post-processing**: Human review cycle — agent produces initial implementation, human reviews KataGo IPC correctness (자동화율 20-30%), agent iterates based on feedback. 최대 3회 반복.

> **Human Review Protocol (KataGo IPC)**:
> 이 단계는 AI 자동화율 20-30% 영역이다. Agent가 초기 구현을 완료한 후:
> 1. Agent → 구현 완료 보고 + pACS 자기 평가
> 2. (human) → KataGo IPC 프로토콜 정확성 검토 + 피드백
> 3. Agent → 피드백 반영 수정
> 4. 반복 (최대 3회) 또는 승인
> Autopilot partial 모드에서 이 human review는 **자동 승인 대상** (Go/No-Go가 아니므로).
> 단, Autopilot 자동 승인 시에도 pACS score < 50이면 에스컬레이션.

### 13. Template Explanation Engine V1
- **Pre-processing**: `scripts/prepare_katago_test_data.py` — Step 2 IPC 명세 기반으로 KataGo 샘플 분석 데이터 20개 생성
- **Agent**: `@template-engineer` (opus)
- **Verification**:
  - [ ] KataGo 분석 JSON → 자연어 해설 변환 파이프라인 완성
  - [ ] 3-tier 템플릿 (입문/중급/고급) 각 20+ 패턴 구현됨 (source: Step 4)
  - [ ] 고위험 포지션 (사활/패/세키) 필수 템플릿 폴백 동작 확인
  - [ ] 템플릿 커버리지 측정 스크립트 포함, 커버리지 ≥ 80% 달성
  - [ ] "LLM = 번역기, KataGo = 진실의 원천" 원칙이 코드 구조에 반영됨
  - [ ] Step 4 패턴 카탈로그의 모든 패턴이 구현됨 (source: Step 4)
  - [ ] Step 18 Quick Go에서 `IExplanationEngine` 인터페이스로 호출 가능 (파이프라인 연결)
- **Task**: Implement the "Why?" Template Explanation Engine V1. (1) KataGo output parser: extract winrate, scoreLead, top moves, principal variation from AnalysisResult. (2) Pattern matcher: classify positions by winrate delta categories (blunder >10%, mistake 5-10%, inaccuracy 2-5%, good <2%), game phase (opening/middle/endgame), tactical patterns (capture, atari, ladder, net). (3) Template engine: select and fill templates based on pattern match + user tier. Implement 3-tier templates from Step 4 pattern catalog. (4) Fallback chain: exact pattern → category match → generic template → "analysis data only" fallback. (5) MANDATORY template fallback for life/death, ko, seki — never generate freeform text for these positions. (6) Coverage measurement: run engine against 200-position test set, compute coverage percentage. Target: ≥80%. Reference: Step 4 design (`outputs/step-04-template-engine-design.md`, `outputs/step-04-pattern-catalog.yaml`).
- **Output**: `src/engine/explanation/` with full test suite + coverage report
- **Review**: `@reviewer` — 패턴 매칭 로직 + `@fact-checker` — 바둑 해설 정확성
- **Translation**: none (code)

### 14. (human) Golden Dataset Validation
- **Pre-processing**: `scripts/generate_template_outputs.py` — 200 포지션에 대한 템플릿 엔진 출력 자동 생성
- **Action**: Validate template explanation engine against 200 golden positions (composition: 입문 50 + 중급 80 + 고급 50 + 고위험 20 사활/패/세키). Dataset constructed by 3-5 단급자 검증 ($500-1,000 일회성 비용). Check: (1) Coverage ≥ 80% (positions with meaningful explanations). (2) 3-tier quality: beginner explanations use no Go terms, intermediate use basic terms, advanced provide professional analysis. (3) High-risk fallback: all 20 life/death, ko, seki positions use template fallback (no freeform). (4) Factual accuracy: explanations are anchored to KataGo data, no hallucinated advice.
- **Command**: `/validate-golden-dataset`
- **Autopilot Default**: Auto-approve if coverage ≥ 80% AND high-risk fallback 100% AND no factual errors detected by automated checks. Manual review of 20 random samples for quality.

### 15. M1 Integration & Cross-Module Testing
- **Agent**: `@integration-tester` (sonnet)
- **Verification**:
  - [ ] 모든 모듈 (rules, katago, data, explanation)이 단일 Tauri 앱에서 통합 동작
  - [ ] 9×9 AI 대국 전체 흐름: 게임 시작 → 수 놓기 → KataGo 응답 → 게임 종료 → 계가 → 저장
  - [ ] 대국 후 분석: 각 수에 대해 KataGo 분석 → 템플릿 해설 생성
  - [ ] SQLite에 게임 데이터 정상 저장 + 불러오기
  - [ ] `npm run tauri build` 3 OS 빌드 성공 (macOS, Windows, Linux)
  - [ ] Biome lint + Vitest + 규칙 엔진 130+ 테스트 전체 통과
  - [ ] SonarQube SQALE ≤ 5% (기술 부채)
- **Task**: Run full M1 integration testing. (1) Cross-module integration: verify rules-engine ↔ katago-bridge ↔ explanation-engine ↔ game-engine ↔ data-layer communication through defined interfaces. (2) E2E scenario: complete 9×9 AI game (start → play 20 moves → end → score → save → analyze → explain). (3) Multi-platform build: run `npm run tauri build` for macOS, Windows, Linux — all must succeed. (4) Quality gates: Biome lint (0 warnings), Vitest (all pass), rules engine (130+ pass), SonarQube (SQALE ≤5%).
- **Output**: `outputs/step-15-m1-integration-report.md` + build artifacts
- **Review**: `@reviewer` — 통합 테스트 완전성, 빌드 결과 검증
- **Translation**: none (test report)
- **Post-processing**: `python3 .claude/hooks/scripts/validate_traceability.py --project-dir . --check-output --step 15` — M1 전체 교차 단계 추적성 검증

### 16. (human) M1 Go/No-Go Gate
- **Action**: Evaluate M1 milestone criteria: (1) Template coverage ≥ 80%. (2) Core engine complete (rules + KataGo + data + explanation). (3) Tauri build succeeds on 3 OS. (4) SonarQube SQALE ≤ 5%. Decide: CONTINUE to M2 or PIVOT (scope reduction).
- **Command**: `/go-no-go M1`
- **Autopilot Default**: **MANUAL** — Go/No-Go 게이트는 반드시 사용자 수동 판단.

---

## Implementation — M2: Playable Beta (Month 3-4)

> **M2 Go/No-Go 기준**: Beta DAU 100+ & 3 OS 빌드 성공

### 17. (team) UI/UX Implementation
- **Team**: `m2-ui`
- **Checkpoint Pattern**: dense (UI 컴포넌트 다수 — 20개)
- **Tasks**:
  - `@board-developer` (opus): Implement the Go board UI. Fork Shudan as SVG React component base. Build 20 components: Board, Stone, Marker, Coordinates, Heatmap, LastMoveMarker, BranchMarker, GhostStone, TerritoryOverlay, DeadStoneMarker, PassButton, ResignButton, UndoButton, TimerDisplay, CaptureCounter, KomiDisplay, PlayerInfo, MoveNavigator, WinRateGraph (Recharts), ExplanationCard. Apply KaTrain color scheme (green→blue→yellow→orange→red). Support 9×9, 13×13, 19×19 boards. Implement Tap-Preview-Confirm 2-step interaction (click/tap to preview → confirm to place) for touch accuracy on 19×19 boards + @use-gesture pinch-zoom for touchscreen laptop support. Design principle: "innovate around the board, not the board itself" — clean, static board preferred. Reference: Step 6 architecture (`outputs/step-06-architecture-design.md`).
    - **Checkpoints** (dense):
      - CP-1: Board + Stone + Coordinates + basic interaction (click to place)
      - CP-2: All 18 classical components + responsive layout
      - CP-3: WinRateGraph + ExplanationCard + KaTrain color integration
  - `@screen-developer` (sonnet): Build application screens and navigation. Screens: HomeScreen, GameScreen (with board integration), AnalysisScreen (with WinRateGraph), SettingsScreen, QuickGoScreen, OnboardingScreen (placeholder). Navigation: React Router with Zustand state sync. Responsive layout with Tailwind CSS 4 + shadcn/ui components for controls, dialogs, forms. Dark/light theme support.
    - **Checkpoints** (dense):
      - CP-1: HomeScreen + GameScreen + basic navigation
      - CP-2: AnalysisScreen + SettingsScreen + all transitions
      - CP-3: Responsive layout + theme support + accessibility basics
  - `@i18n-developer` (sonnet): Implement internationalization with react-i18next. Configure 3 locales: en (primary), ko, ja. Extract all UI strings to translation files. Set up language detection and switching. Ensure all components use `useTranslation` hook.
- **Verification**:
  - [ ] 20 board UI 컴포넌트 모두 구현 + Storybook 또는 visual test 포함
  - [ ] 9×9, 13×13, 19×19 보드 크기 모두 렌더링 정상
  - [ ] Tap-Preview-Confirm: 19×19 보드에서 터치/클릭 시 미리보기 → 확인 2단계 동작 (오클릭 방지)
  - [ ] @use-gesture pinch-zoom: 터치스크린 노트북에서 핀치 줌 동작 확인
  - [ ] WinRateGraph: KaTrain 색상 코드로 승률 변화 시각화
  - [ ] ExplanationCard: 3-tier 해설 표시 (입문/중급/고급 전환 가능)
  - [ ] 모든 화면 간 네비게이션 동작 확인
  - [ ] react-i18next: en/ko/ja 3개 locale 전환 동작
  - [ ] Tailwind CSS 4 + shadcn/ui 스타일 일관성
  - [ ] Step 18 Quick Go에서 GameScreen + Board 컴포넌트 직접 사용 가능 (파이프라인 연결)
- **Join**: Team Lead merges all UI modules, runs visual consistency check, verifies navigation flow.
- **SOT**: Team Lead writes `active_team` during execution, `completed_teams` on completion.
- **Output**: `src/components/` + `src/screens/` + `src/i18n/` with test suites
- **Review**: `@reviewer` — UI 코드 품질, 컴포넌트 구조, 접근성
- **Translation**: none (code, but i18n strings are inherently multilingual)

### 18. Quick Go MVP
- **Agent**: `@game-developer` (opus)
- **Verification**:
  - [ ] 9×9 보드 Quick Go 모드: 게임 시작 → AI 대국 → 3분 타이머 → 계가 → 결과 → AI 해설
  - [ ] 시간 제한: 3분 + 초읽기 (Byoyomi) 동작
  - [ ] AI 난이도: Step 12의 30-level difficulty system에서 Quick Go에 적합한 서브셋 매핑 (source: Step 12)
  - [ ] 대국 종료 후 즉시 "Why?" AI 해설 제공 (ExplanationCard 표시)
  - [ ] rules-engine + katago-bridge + explanation-engine + board-ui 통합 동작 (source: Steps 11-13, 17)
  - [ ] Step 21 통합 테스트에서 Quick Go E2E 시나리오 실행 가능 (파이프라인 연결)
- **Task**: Implement Quick Go (9×9, 3-minute) as the flagship game mode. (1) Game flow: mode selection → board setup (9×9) → timer start (3min + byoyomi) → alternating turns (player vs KataGo) → pass/resign → Chinese scoring → result display → instant AI explanation for key moves. (2) AI difficulty: leverage Step 12's 30-level difficulty system, selecting appropriate levels for Quick Go based on user's current rating/level. Auto-adjust difficulty after each game based on win/loss pattern. (3) Timer: countdown display, byoyomi periods, time-out handling. (4) Post-game: auto-trigger KataGo analysis on blunder moves (winrate delta > 5%), display WinRateGraph + ExplanationCard for top 5 most impactful moves. (5) UX goal: "one game during lunch break" — total experience under 5 minutes including explanation. Reference: M1 modules and Step 17 UI components.
- **Output**: `src/features/quick-go/` with E2E test
- **Review**: `@reviewer` — 게임 흐름 완전성, UX 품질
- **Translation**: none (code)

### 19. Multi-platform Build & CI/CD
- **Agent**: `@devops-engineer` (sonnet)
- **Verification**:
  - [ ] GitHub Actions 워크플로우: macOS, Windows, Linux 빌드 매트릭스 정의
  - [ ] Tauri 번들링: macOS (.dmg), Windows (.msi/.exe), Linux (.AppImage/.deb)
  - [ ] KataGo 바이너리 OS별 번들링 (sidecar 경로 설정)
  - [ ] GitHub Releases에 빌드 아티팩트 자동 업로드
  - [ ] tauri-plugin-updater 자동 업데이트 설정
  - [ ] 빌드 크기: ~100MB 이내 (경량 모델 포함)
- **Task**: Set up multi-platform build pipeline. (1) GitHub Actions: matrix build for macOS (x64 + ARM), Windows (x64), Linux (x64). (2) Tauri bundling: configure per-platform installers (.dmg, .msi, .AppImage). (3) KataGo sidecar: bundle KataGo binary per OS with correct path resolution. Bundle b6c96 model (~15MB). (4) Auto-update: configure tauri-plugin-updater with GitHub Releases as update source. (5) Release workflow: tag → build → test → upload to GitHub Releases. (6) Size budget: total app < 100MB including bundled model.
- **Output**: `.github/workflows/` + `src-tauri/tauri.conf.json` updates
- **Review**: `@reviewer` — CI/CD 파이프라인 안정성
- **Translation**: none (config)

### 20. Analytics & Monitoring Integration
- **Agent**: `@integration-developer` (sonnet)
- **Verification**:
  - [ ] PostHog 클라이언트 SDK: opt-in 텔레메트리, 핵심 이벤트 추적 (game_start, game_end, explanation_viewed, onboarding_step)
  - [ ] Sentry: 데스크톱 크래시 리포팅 + 에러 추적
  - [ ] 개인정보: 모든 데이터 익명화, 서버 전송 opt-in 전용
  - [ ] OS 네이티브 알림 (Tauri notification plugin) 구현
- **Task**: Integrate analytics and monitoring. (1) PostHog: client-side SDK with opt-in consent flow. Track events: `game_started` (board_size, mode), `game_ended` (result, duration), `explanation_viewed` (tier, move_number), `onboarding_step` (step_name, completed), `quick_go_played`. (2) Sentry: desktop crash reporting with source maps. Configure breadcrumbs for debugging. (3) Privacy: all data anonymized, no PII collection, opt-in only. Provide clear privacy settings UI. (4) Notifications: Tauri notification plugin for daily quest reminders and update availability.
- **Output**: `src/analytics/` + `src/notifications/`
- **Review**: none
- **Translation**: none (code)

### 21. Integration Testing & Hardening
- **Agent**: `@qa-engineer` (sonnet)
- **Verification**:
  - [ ] E2E 테스트 10+ 시나리오 (Playwright): first game, Quick Go, analysis, onboarding, settings 등
  - [ ] 성능 프로파일링: KataGo 응답 시간, UI 렌더링 FPS, 메모리 사용량
  - [ ] 3 OS에서 모든 E2E 테스트 통과
  - [ ] Biome lint 0 warnings + Vitest 전체 통과 + SonarQube SQALE ≤ 5%
  - [ ] 보안 감사: Tauri CSP 설정, IPC 입력 검증, SQLite injection 방지
- **Task**: Comprehensive integration testing and hardening. (1) E2E tests (Playwright): first game completion, Quick Go full flow, analysis review, explanation tier switching, SGF export, settings persistence, language switching, offline mode, update check, multiple games in sequence. (2) Performance: profile KataGo response times (target: <2s for visits=50), UI rendering (target: 60 FPS board interaction), memory (target: <400MB total). (3) Security: Tauri CSP configuration, Zod validation on all Tauri command inputs, SQL parameterization verification. (4) Cross-platform: run all tests on macOS, Windows, Linux.
- **Output**: `tests/e2e/` + `outputs/step-21-qa-report.md`
- **Review**: `@reviewer` — 테스트 커버리지, 보안 감사 완전성
- **Translation**: none (test code)

### 22. (human) M2 Go/No-Go Gate
- **Action**: Evaluate M2 milestone criteria: (1) Beta available on 3 OS. (2) Quick Go MVP functional. (3) All E2E tests pass. (4) Performance within targets. (5) Security audit clean. (6) Beta released on GitHub Releases + 10+ external testers recruited (Reddit r/baduk, Discord, baduk forums). (7) PostHog DAU tracking operational — target DAU 100+ within 2 weeks of beta release. Decide: CONTINUE to M3 or PIVOT (UX redesign if DAU < 50).
- **Command**: `/go-no-go M2`
- **Autopilot Default**: **MANUAL** — Go/No-Go 게이트는 반드시 사용자 수동 판단.

---

## Implementation — M3: Public Launch (Month 5-6)

> **M3 Go/No-Go 기준**: DAU 100+ & D7 잔존율 25%+ & 코드 서명 완료

### 23. (team) Final Features & Polish
- **Team**: `m3-features`
- **Checkpoint Pattern**: dense
- **Tasks**:
  - `@onboarding-developer` (opus): Implement Zero-to-First-Game onboarding. Interactive tutorial: rules explanation → place first stone → capture experience → Quick Go 9×9 → AI explanation experience. Target: 5 minutes, 70%+ completion rate. Anonymous-first: no signup required to start. Smooth transition from onboarding to regular game play.
    - **Checkpoints** (dense):
      - CP-1: Tutorial framework + rules explanation step
      - CP-2: Interactive capture experience + Quick Go transition
      - CP-3: Full flow + analytics tracking + completion rate measurement
  - `@gamification-developer` (sonnet): Implement basic gamification system. (1) Daily quests: "Play 1 Quick Go", "View 3 AI explanations", "Review 1 game". (2) Level system: XP-based progression with milestones. (3) Streaks: consecutive play day tracking with visual indicator. (4) Badges: "First Win", "First Review", "Onboarding Complete", "7-Day Streak", "100 Games". Store all progress in local SQLite.
    - **Checkpoints** (dense):
      - CP-1: Quest system + XP/level logic
      - CP-2: Streak tracking + badge system
      - CP-3: UI integration + persistence + analytics events
  - `@optimization-engineer` (sonnet): Performance optimization and app size reduction. (1) Bundle size: tree-shaking, code splitting, lazy loading for non-critical modules. Target: <100MB total. (2) KataGo startup optimization: background initialization, pre-warm on app launch. (3) SQLite WAL mode tuning for concurrent read during analysis. (4) React rendering optimization: memo, useMemo, virtualization for move lists.
- **Verification**:
  - [ ] 온보딩: 5분 이내 완료 가능, 모든 단계 인터랙션 동작
  - [ ] 게이미피케이션: 일일 퀘스트 생성·완료·보상, 레벨업, 스트릭, 뱃지 전체 동작
  - [ ] 성능: 앱 크기 <100MB, KataGo 초기화 <5s, UI 60 FPS
  - [ ] Anonymous-first: 가입 없이 온보딩 → Quick Go → AI 해설 전체 흐름 가능
  - [ ] 모든 진행 데이터가 로컬 SQLite에 저장됨 (source: Step 7 schema)
- **Join**: Team Lead merges all features, runs full regression test suite.
- **SOT**: Team Lead writes `active_team` during execution, `completed_teams` on completion.
- **Output**: `src/features/onboarding/` + `src/features/gamification/` + performance optimizations
- **Review**: `@reviewer` — 코드 품질, UX 흐름
- **Translation**: none (code)

### 24. Code Signing & Release Preparation
- **Agent**: `@release-engineer` (sonnet)
- **Verification**:
  - [ ] macOS: Apple notarization 완료 (Apple Developer $99/yr)
  - [ ] Windows: SmartScreen 대응 UX (unsigned 경고 감수 또는 EV 코드 서명)
  - [ ] Linux: .AppImage + .deb 패키지 생성
  - [ ] GitHub Releases 페이지: 릴리스 노트 + 다운로드 링크 + 설치 가이드
  - [ ] 자동 업데이트: tauri-plugin-updater 최종 동작 확인
  - [ ] 랜딩 페이지 콘텐츠 (Cloudflare) 준비 (텍스트 + 스크린샷)
- **Task**: Prepare for public release. (1) macOS code signing: configure Apple Developer account, notarization workflow in GitHub Actions, test signed .dmg installation. (2) Windows: evaluate EV code signing cost vs unsigned approach, implement SmartScreen bypass UX if unsigned. (3) Linux: finalize .AppImage and .deb packaging. (4) Release page: write release notes highlighting "Why?" AI explanation + Quick Go + free/offline features. (5) Auto-update: end-to-end test of tauri-plugin-updater from old version to new. (6) Landing page: prepare content for Cloudflare-hosted landing page (headline, features, screenshots, download links).
- **Output**: Build configs + signing scripts + `outputs/step-24-release-notes.md`
- **Review**: `@reviewer` — 릴리스 프로세스 완전성
- **Translation**: `@translator` → `outputs/step-24-release-notes.ko.md`

### 25. (human) M3 Go/No-Go — Final Launch Decision
- **Action**: Final launch evaluation: (1) All features (F1-F7) functional. (2) Code signing complete (macOS notarization). (3) All E2E tests pass on 3 OS. (4) Performance targets met. (5) Release notes and landing page ready. (6) KPI measurement: DAU ≥ 100 AND D7 retention ≥ 25% (PostHog cohort). (7) Community outreach: Reddit r/baduk + Discord + baduk forums 게시 완료. (8) GitHub README SEO 최적화 완료. Decide: LAUNCH if all criteria met, DELAY if DAU < 100 or D7 < 25%.
- **Command**: `/go-no-go M3`
- **Autopilot Default**: **MANUAL** — 출시 최종 결정은 반드시 사용자 수동 판단.

---

## Post-Launch Enhancement — AI Coach Commentary System

> **목표**: 매 수마다 따뜻한 코칭 해설을 제공하는 실시간 AI 코치. KataGo 데이터 + 보드 상태를 100% 결정론적 코드로 해석. LLM 개입 ZERO.
>
> **P1 원칙 강화**: "KataGo = 진실의 원천, 결정론적 코드 = 해석기, 사전 작성 템플릿 = 텍스트". 전 파이프라인에 할루시네이션 원천봉쇄.

### 26. Coaching Engine Design
- **Pre-processing**: `scripts/extract_coaching_signals.py` — 기존 KataGo 분석 샘플 20개에서 코칭 가능한 시그널 추출·정제. 에이전트에게 raw JSON이 아닌 구조화된 시그널 테이블만 전달 (P1 원칙: AI 전달 전 Python으로 노이즈 제거)
- **Agent**: `@template-designer` (opus)
- **Verification**:
  - [ ] KataGo 시그널 → 전략적 개념 매핑 테이블 15+ 매핑 정의
  - [ ] 매핑마다 사용하는 시그널 조합 명시 (winrate? ownership? liberties? coordinates?)
  - [ ] 코칭 템플릿 카탈로그 30+ 패턴 (beginner 티어 우선, 한국어)
  - [ ] 전술 분류 알고리즘 설계: 결정론적 if/else 규칙으로만 구성 (LLM/ML 사용 금지)
  - [ ] 격려 상태 머신 설계 (streak, momentum, recovery 전이)
  - [ ] 보드 상태 분석 시그널 정의 (좌표→위치, findGroup→활로, ownership→영역)
  - [ ] "KataGo = 진실의 원천, LLM = 번역기" 원칙이 설계에 구조적으로 반영됨
  - [ ] Step 27 구현에 직접 사용 가능한 형식 (파이프라인 연결)
- **Task**: Design the AI Coach Commentary System for real-time gameplay coaching. (1) Signal-to-Concept Mapping Table: Define deterministic mappings from observable KataGo signals + board state to strategic concepts. Each mapping must specify: input signals, threshold values, output concept. Minimum 15 mappings covering: territory_building, approach, attack, escape, connection, invasion, defense, capture, endgame, brilliant_move, good_move, mistake, momentum_shift, close_game, positional. (2) Coaching Template Catalog: Write 30+ Korean coaching templates for beginner tier. Each template maps to one strategic concept from the mapping table. Tone: warm mentor (이세돌 9단이 초보자에게 가르치는 느낌). Templates use {slot} notation for data injection. Templates are pre-authored text — NO runtime LLM generation. (3) Tactical Classification Algorithm: Design deterministic rules using ONLY: move GTP coordinates, findGroup() liberties, adjacency counts, ownership[], PV analysis, winrate delta, game phase. Must be implementable as pure TypeScript if/else — no ML, no LLM, no probabilistic estimation. (4) Encouragement State Machine: Define states and transitions for adaptive encouragement based on player performance (consecutive good moves → praise, blunder → recovery, momentum shift → excitement). (5) Board State Signals: Define which rules-engine functions are needed (findGroup from board.ts, getAdjacencyTable from board.ts) and how their outputs map to coaching concepts (liberties count → danger level, adjacent opponent count → tactical pressure). Reference: Step 4 (template engine design pattern), Step 2 (KataGo IPC spec), Step 3 (DKS), outputs/step-26-coaching-signals.yaml (pre-processed input).
- **Output**: `outputs/step-26-coaching-design.md` + `outputs/step-26-coaching-catalog.yaml`
- **Review**: `@reviewer` — 설계 완전성, 결정론적 분류 검증 + `@fact-checker` — 바둑 전략 해석 정확성
- **Translation**: `@translator` → `outputs/step-26-coaching-design.ko.md`

### 27. Coaching Engine Implementation
- **Pre-processing**: 없음 (Step 26 산출물이 직접 입력)
- **Agent**: `@template-engineer` (opus)
- **Verification**:
  - [ ] `hooks/useAnalysisStore.ts`: Zustand store로 AnalysisResponse 공유 — `useWinRateStore` 패턴 준수
  - [ ] `coaching/strategic-classifier.ts`: 전술 분류 100% 결정론적 (LLM 호출 ZERO, 확률적 판단 ZERO)
  - [ ] `coaching/coaching-templates.ts`: Step 26 카탈로그의 모든 30+ 패턴 구현
  - [ ] `coaching/coaching-adapter.ts`: ParsedAnalysis + BoardGrid + findGroup + PlayerContext 결합
  - [ ] `hooks/useCoaching.ts`: 매 수(흑/백 모두) 코칭 메시지 생성 확인
  - [ ] `components/board/CoachPanel.tsx`: 채팅 버블 UI, emotion별 스타일링, 접기 가능
  - [ ] `coaching/types.ts`: CoachingMessage, TacticalSituation 등 코칭 전용 타입 (core/interfaces.ts 무수정)
  - [ ] 기존 `useKataGoAnalysis.ts`, `useAiOpponent.ts` 수정 최소화 (각 +3줄, 반환타입 불변)
  - [ ] `screens/GameScreen.tsx` CoachPanel 통합 (+15줄, 기존 컴포넌트 무파괴)
  - [ ] `explanation-engine/*` 전체 무수정 (parseAnalysis import만, 구조 변경 없음)
  - [ ] 기존 전체 테스트 스위트 통과 (회귀 없음)
  - [ ] 코칭 전용 단위 테스트 20+ 케이스
  - [ ] 전술 분류 테스트: 각 TacticalSituation에 최소 3개 테스트
- **Post-processing**: `scripts/validate_coaching_rules.py` — Golden Dataset 50 포지션에 대해 전술 분류 100% 정확도 검증 + 분류↔텍스트 일치성 + 수치 슬롯 ±0.1% 정확도
- **Task**: Implement the AI Coach Commentary System based on Step 26 design. (1) Shared Analysis Store (hooks/useAnalysisStore.ts): Zustand store following useWinRateStore pattern (hooks/useWinRateStore.ts). Stores current + previous AnalysisResponse + moveNumber. Written by useKataGoAnalysis (+1 line in result.ok block) and useAiOpponent (+1 line in result.ok block). Return types unchanged — zero consumer breakage. (2) Strategic Classifier (coaching/strategic-classifier.ts): Implement Step 26's tactical classification algorithm as pure TypeScript. Inputs: ParsedAnalysis + BoardGrid + boardSize + lastMoveIndex + player. Uses: parseAnalysis() from explanation-engine/output-parser (import, no modification), findGroup() from rules-engine/board (import, no modification), getAdjacencyTable() from rules-engine/board (import, no modification). Output: TacticalSituation enum. CONSTRAINT: Every classification path must be deterministic if/else. No randomness, no LLM, no heuristic estimation. (3) Coaching Adapter (coaching/coaching-adapter.ts): Main engine composing: parseAnalysis → strategic classifier → template selection → slot filling → encouragement. Takes AnalysisResponse + BoardGrid + PlayerContext. Returns CoachingMessage. (4) Coaching Templates (coaching/coaching-templates.ts): Compile Step 26 catalog (outputs/step-26-coaching-catalog.yaml) into TypeScript constants. Same structural pattern as explanation-engine/patterns.ts but simpler (concept → template text + slots). (5) Types (coaching/types.ts): CoachingMessage, TacticalSituation, PlayerContext, CoachingEmotion, CoachingType. Separate file — do NOT modify core/interfaces.ts. (6) React Hook (hooks/useCoaching.ts): Subscribes to useAnalysisStore + useGameStore. On analysis update: calls coaching adapter. Manages PlayerContext state (consecutiveGoodMoves, momentum). (7) UI Component (components/board/CoachPanel.tsx): Chat-bubble style, emotion-based styling (positive=green, warning=orange, encouraging=blue), collapsible, auto-scroll, max 5 recent messages visible. (8) GameScreen Integration (screens/GameScreen.tsx): Add CoachPanel to right column above Win Rate Graph. Conditional render. +15 lines. Reference: Step 26 design (outputs/step-26-coaching-design.md, outputs/step-26-coaching-catalog.yaml). Existing code: hooks/useWinRateStore.ts (Zustand pattern), explanation-engine/output-parser.ts (parseAnalysis), rules-engine/board.ts (findGroup, getAdjacencyTable).
- **Output**: `app/src/coaching/` (5 files) + `app/src/hooks/useAnalysisStore.ts` + `app/src/hooks/useCoaching.ts` + `app/src/components/board/CoachPanel.tsx` + minimal modifications to 3 existing files
- **Review**: `@reviewer` — 코드 품질, 결정론적 분류 검증, 기존 시스템 파급 영향
- **Translation**: 없음 (code)

### 28. Coaching Quality Validation
- **Pre-processing**: `scripts/validate_coaching_coverage.py` — 50 Golden 포지션에 대한 코칭 엔진 출력의 커버리지(≥80%)·분류↔텍스트 일치성·수치 정확도(±0.1%)·제네릭 폴백 비율(≤20%) 자동 검증
- **Agent**: `@qa-engineer` (sonnet)
- **Verification**:
  - [ ] Golden Dataset 50 포지션 전수 검증 통과 (opening 15 + middle 20 + endgame 15)
  - [ ] 코칭 메시지 커버리지 ≥ 80% (의미있는 코칭, 제네릭 폴백이 아닌)
  - [ ] 전술 분류 정확도 100% (결정론적 코드이므로 99%가 아닌 100%)
  - [ ] 격려 시스템: 연속 좋은 수 → 칭찬, 실수 후 → 격려 동작 확인
  - [ ] 기존 ExplanationEngine 회귀 없음 (explanation-engine 테스트 전량 통과)
  - [ ] 기존 전체 테스트 스위트 통과 (rules-engine 130+, integration, E2E)
  - [ ] `npm run tauri build` 빌드 성공
- **Post-processing**: `python3 .claude/hooks/scripts/validate_traceability.py --project-dir . --check-output --step 28` — Step 26-28 교차 단계 추적성 검증
- **Task**: Comprehensive quality validation of the coaching engine. (1) Golden Dataset Testing: Run coaching engine against 50 positions (opening 15, middle game 20, endgame 15). For each position verify: tactical classification matches expected, coaching text contains expected keywords, slot values match KataGo data. (2) Regression Testing: Run ALL existing test suites — rules-engine (130+ tests), explanation-engine (pattern matching + coverage), katago-bridge (IPC + response parsing), integration tests (m1-integration), E2E scenarios. All must pass with zero failures. (3) Coaching-Specific Tests: Verify each TacticalSituation has ≥3 test positions covering it. Verify template slot filling accuracy. Verify encouragement state machine transitions. Verify CoachPanel render tests. (4) Build Verification: npm run tauri build on local OS.
- **Output**: `outputs/step-28-coaching-qa-report.md`
- **Review**: `@reviewer` — 검증 완전성
- **Translation**: 없음 (test report)

---

## Claude Code Configuration

### Sub-agents

```yaml
# Research Phase Agents
---
name: tech-validator
description: "Technology stack validation and PoC building"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 30
memory: project
---

---
name: katago-researcher
description: "KataGo Analysis Engine deep-dive research"
model: opus
tools: Read, Write, Glob, Grep, WebSearch, WebFetch
maxTurns: 40
memory: project
---

---
name: domain-expert
description: "Baduk domain knowledge construction and rules specification"
model: opus
tools: Read, Write, Glob, Grep, WebSearch, WebFetch
maxTurns: 40
memory: project
---

---
name: template-designer
description: "Template explanation engine architecture design"
model: opus
tools: Read, Write, Glob, Grep
maxTurns: 40
memory: project
---

# Planning Phase Agents
---
name: architect
description: "System architecture design for modular monolith"
model: opus
tools: Read, Write, Edit, Glob, Grep
maxTurns: 40
memory: project
---

---
name: schema-designer
description: "Database schema and interface contract design"
model: opus
tools: Read, Write, Edit, Glob, Grep
maxTurns: 30
memory: project
---

---
name: strategy-planner
description: "Test strategy and parallel execution planning"
model: sonnet
tools: Read, Write, Glob, Grep
maxTurns: 25
memory: project
---

# Implementation — M1 Agents
---
name: scaffold-frontend
description: "Vite + React 19 + TypeScript project scaffolding"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 25
memory: project
---

---
name: scaffold-backend
description: "Tauri 2.0 + Rust + SQLite project scaffolding"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 25
memory: project
---

---
name: rules-engineer
description: "Tromp-Taylor rules engine implementation with TDD"
model: opus
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 60
memory: project
---

---
name: data-engineer
description: "SQLite data layer and GameReducer implementation"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 40
memory: project
---

---
name: katago-integrator
description: "KataGo sidecar integration with IPC and watchdog"
model: opus
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 60
memory: project
---

---
name: template-engineer
description: "Template explanation engine V1 implementation"
model: opus
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 50
memory: project
---

---
name: integration-tester
description: "Cross-module integration testing and build verification"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 30
memory: project
---

# Implementation — M2 Agents
---
name: board-developer
description: "Go board SVG UI components (Shudan fork)"
model: opus
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 60
memory: project
---

---
name: screen-developer
description: "Application screens and navigation"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 40
memory: project
---

---
name: i18n-developer
description: "Internationalization with react-i18next"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 25
memory: project
---

---
name: game-developer
description: "Quick Go MVP game mode implementation"
model: opus
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 50
memory: project
---

---
name: devops-engineer
description: "Multi-platform build pipeline and CI/CD"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 30
memory: project
---

---
name: integration-developer
description: "Analytics and monitoring integration"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 25
memory: project
---

---
name: qa-engineer
description: "E2E testing, performance profiling, security audit"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 40
memory: project
---

# Implementation — M3 Agents
---
name: onboarding-developer
description: "Zero-to-First-Game onboarding tutorial"
model: opus
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 50
memory: project
---

---
name: gamification-developer
description: "Gamification system (quests, levels, streaks, badges)"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 40
memory: project
---

---
name: optimization-engineer
description: "Performance optimization and bundle size reduction"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 30
memory: project
---

---
name: release-engineer
description: "Code signing, release preparation, landing page"
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Grep
maxTurns: 30
memory: project
---
```

### Agent Teams

```yaml
teams:
  m1-scaffold:
    description: "M1 Project Scaffolding — frontend + backend parallel setup"
    step: 10
    members:
      - agent: "@scaffold-frontend"
        model: sonnet
        task: "Vite + React 19 + TypeScript + Tailwind + Zustand + Biome + Vitest"
      - agent: "@scaffold-backend"
        model: sonnet
        task: "Tauri 2.0 + Rust + SQLite + Drizzle ORM"
    join: "Team Lead merges both scaffolds, verifies combined tauri build"
    checkpoint: standard
    lifecycle: step-scoped

  m1-core:
    description: "M1 Core Modules — Rules Engine + Data Layer parallel development"
    step: 11
    members:
      - agent: "@rules-engineer"
        model: opus
        task: "Tromp-Taylor rules engine (300-500 LoC, 130+ tests)"
      - agent: "@data-engineer"
        model: sonnet
        task: "SQLite + Drizzle + GameReducer + SGF export"
    join: "Team Lead merges both modules, runs combined test suite"
    checkpoint: dense
    lifecycle: step-scoped

  m2-ui:
    description: "M2 UI/UX — Board + Screens + i18n parallel development"
    step: 17
    members:
      - agent: "@board-developer"
        model: opus
        task: "Shudan fork + SVG board + 20 components"
      - agent: "@screen-developer"
        model: sonnet
        task: "Application screens + navigation + responsive layout"
      - agent: "@i18n-developer"
        model: sonnet
        task: "react-i18next (en/ko/ja)"
    join: "Team Lead merges all UI modules, visual consistency check"
    checkpoint: dense
    lifecycle: step-scoped

  m3-features:
    description: "M3 Final Features — Onboarding + Gamification + Optimization parallel"
    step: 23
    members:
      - agent: "@onboarding-developer"
        model: opus
        task: "Zero-to-First-Game interactive tutorial"
      - agent: "@gamification-developer"
        model: sonnet
        task: "Quests + levels + streaks + badges"
      - agent: "@optimization-engineer"
        model: sonnet
        task: "Performance optimization + bundle size reduction"
    join: "Team Lead merges all features, full regression test"
    checkpoint: dense
    lifecycle: step-scoped
```

### SOT (State Management)

- **SOT File**: `.claude/state.yaml`
- **Write Permission**: Orchestrator (sequential steps) or Team Lead (team steps) — single writer at all times
- **Agent Access**: Read-only — agents produce output files, never modify SOT directly
- **Quality Override**: 기본 패턴 적용 (Agent Team은 step-scoped, 팀원 간 SOT 공유 불필요)

```yaml
# .claude/state.yaml — Baduk Platform Workflow SOT
workflow:
  name: "baduk-platform"
  current_step: 1
  status: "in_progress"

  parent_genome:
    source: "AgenticWorkflow"
    version: "2026-03-10"
    inherited_dna:
      - absolute-criteria
      - sot-pattern
      - 3-phase-structure
      - 4-layer-qa
      - safety-hooks
      - adversarial-review
      - decision-log
      - context-preservation
      - cross-step-traceability
      - domain-knowledge-structure

  outputs:
    # Research Phase
    # step-1: "outputs/step-01-tech-validation-report.md"
    # step-1-ko: "outputs/step-01-tech-validation-report.ko.md"
    # step-2: "outputs/step-02-katago-ipc-spec.md"
    # step-2-ko: "outputs/step-02-katago-ipc-spec.ko.md"
    # step-3: "outputs/step-03-domain-knowledge.yaml"
    # step-3-doc: "outputs/step-03-rules-spec.md"
    # step-3-ko: "outputs/step-03-rules-spec.ko.md"
    # step-4: "outputs/step-04-template-engine-design.md"
    # step-4-catalog: "outputs/step-04-pattern-catalog.yaml"
    # step-4-ko: "outputs/step-04-template-engine-design.ko.md"
    # Planning Phase
    # step-6: "outputs/step-06-architecture-design.md"
    # step-6-ko: "outputs/step-06-architecture-design.ko.md"
    # step-7: "outputs/step-07-data-model.md"
    # step-7-schema: "outputs/step-07-schema.ts"
    # step-7-interfaces: "outputs/step-07-interfaces.ts"
    # step-7-ko: "outputs/step-07-data-model.ko.md"
    # step-8: "outputs/step-08-test-strategy.md"
    # step-8-parallel: "outputs/step-08-parallel-plan.md"
    # step-8-ko: "outputs/step-08-test-strategy.ko.md"
    # Implementation — M1
    # step-10: "src/ scaffold (frontend + backend merged)"
    # step-11: "src/engine/rules/ + src/db/ + src/game/"
    # step-12: "src/engine/katago/"
    # step-13: "src/engine/explanation/"
    # step-15: "outputs/step-15-m1-integration-report.md"
    # Implementation — M2
    # step-17: "src/components/ + src/screens/ + src/i18n/"
    # step-18: "src/features/quick-go/"
    # step-19: ".github/workflows/ + tauri.conf.json"
    # step-20: "src/analytics/ + src/notifications/"
    # step-21: "tests/e2e/ + outputs/step-21-qa-report.md"
    # Implementation — M3
    # step-23: "src/features/onboarding/ + src/features/gamification/"
    # step-24: "outputs/step-24-release-notes.md"
    # step-24-ko: "outputs/step-24-release-notes.ko.md"

  pending_human_action:
    step: null
    options: []

  # Agent Team tracking (activated during team steps)
  # active_team:
  #   name: ""
  #   status: "partial"
  #   tasks_completed: []
  #   tasks_pending: []
  #   completed_summaries: {}
  # completed_teams: []

  autopilot:
    enabled: true
    mode: "partial"
    manual_gates: [16, 22, 25]       # Go/No-Go gates — always manual
    auto_approve_threshold: 70        # pACS ≥ 70 → auto-approve
    decision_log_dir: "autopilot-logs/"
    auto_approved_steps: []

  pacs:
    current_step_score: null
    dimensions: { F: null, C: null, L: null }
    weak_dimension: null
    pre_mortem_flag: null
    history: {}

  verification:
    last_verified_step: 0
    retries: {}

  domain_knowledge:
    file: "outputs/step-03-domain-knowledge.yaml"
    entity_count: 0
    relation_count: 0
    constraint_count: 0
    built_at_step: null
    last_validated: null
```

### Hooks

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/block_destructive_commands.py",
          "timeout": 10
        }]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/block_test_file_edit.py",
          "timeout": 10
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx biome check --write \"$(echo $TOOL_INPUT | jq -r '.file_path')\" 2>/dev/null || true",
            "statusMessage": "Biome auto-formatting..."
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/output_secret_filter.py",
          "timeout": 10
        }]
      }
    ],
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/restore_context.py",
          "timeout": 15,
          "statusMessage": "Restoring session context..."
        }]
      }
    ],
    "PreCompact": [
      {
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/save_context.py",
          "timeout": 15,
          "statusMessage": "Saving context before compression..."
        }]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/save_context.py",
          "timeout": 15,
          "statusMessage": "Saving session context..."
        }]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [{
          "type": "command",
          "command": "npx vitest run --reporter=verbose 2>&1 | tail -20",
          "timeout": 120,
          "statusMessage": "Running test suite..."
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/generate_context_summary.py",
          "timeout": 15
        }]
      }
    ],
    "Setup": [
      {
        "hooks": [{
          "type": "command",
          "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/scripts/setup_init.py --init",
          "timeout": 30,
          "statusMessage": "Verifying infrastructure health..."
        }]
      }
    ]
  }
}
```

### Slash Commands

```yaml
commands:
  /review-research:
    description: "Display Research Phase outputs (Steps 1-4) for human review"
    file: ".claude/commands/review-research.md"

  /review-architecture:
    description: "Display Planning Phase outputs (Steps 6-8) for human review"
    file: ".claude/commands/review-architecture.md"

  /validate-golden-dataset:
    description: "Run golden dataset validation on template engine output"
    file: ".claude/commands/validate-golden-dataset.md"

  /go-no-go:
    description: "Evaluate milestone Go/No-Go criteria ($ARGUMENTS = M1|M2|M3)"
    file: ".claude/commands/go-no-go.md"
```

### Required Skills

```yaml
skills:
  - workflow-generator      # Parent — this workflow's generator
  - doctoral-writing        # For research documentation quality (if needed)
```

### MCP Servers

```yaml
mcp_servers: []
# Phase 1: No external MCP servers required
# All operations are local (Tauri desktop app)
# Phase 2 may add: relay-server-mcp, discord-webhook-mcp
```

### Runtime Directories

```yaml
runtime_directories:
  outputs/:                   # Step output files (research, planning, reports)
  verification-logs/:         # step-N-verify.md (L1 verification results)
  autopilot-logs/:            # step-N-decision.md (autopilot auto-approval logs)
  pacs-logs/:                 # step-N-pacs.md (pACS self-assessment results)
  review-logs/:               # step-N-review.md (adversarial review results)
  translations/:              # glossary.yaml + *.ko.md (translator outputs)
  scripts/:                   # Pre/post-processing Python scripts
  tests/e2e/:                 # Playwright E2E tests
```

### Error Handling

```yaml
error_handling:
  on_agent_failure:
    action: retry_with_feedback
    max_attempts: 3
    escalation: human

  on_validation_failure:
    action: retry_or_rollback
    retry_with_feedback: true
    rollback_after: 3

  on_hook_failure:
    action: log_and_continue

  on_context_overflow:
    action: save_and_recover

  on_teammate_failure:
    attempt_1: retry_same_agent
    attempt_2: replace_with_upgrade
    attempt_3: human_escalation

  on_katago_human_review:
    max_iterations: 3
    escalation: "If pACS < 50 after 3 iterations, escalate to full manual implementation"
```

### Autopilot Logs

```yaml
autopilot_logging:
  log_directory: "autopilot-logs/"
  log_format: "step-{N}-decision.md"
  required_fields:
    - step_number
    - checkpoint_type
    - decision
    - rationale
    - timestamp
  template: "references/autopilot-decision-template.md"
  mode: "partial"
  manual_gates: [16, 22, 25]
```

### pACS Logs

```yaml
pacs_logging:
  log_directory: "pacs-logs/"
  log_format: "step-{N}-pacs.md"
  translation_log_format: "step-{N}-translation-pacs.md"
  dimensions: [F, C, L]
  translation_dimensions: [Ft, Ct, Nt]
  scoring: "min-score"
  triggers:
    GREEN: "≥ 70 → auto-proceed"
    YELLOW: "50-69 → proceed with flag"
    RED: "< 50 → rework or escalate"
  protocol: "AGENTS.md §5.4"
```

---

## Appendix A: Step Summary

| Step | Phase | Type | Agent/Team | Key Output |
|------|-------|------|------------|------------|
| 1 | Research | agent | `@tech-validator` | tech-validation-report.md |
| 2 | Research | agent | `@katago-researcher` | katago-ipc-spec.md |
| 3 | Research | agent | `@domain-expert` | domain-knowledge.yaml + rules-spec.md |
| 4 | Research | agent | `@template-designer` | template-engine-design.md + pattern-catalog.yaml |
| 5 | Research | (human) | — | Research direction approval |
| 6 | Planning | agent | `@architect` | architecture-design.md |
| 7 | Planning | agent | `@schema-designer` | data-model.md + schema.ts + interfaces.ts |
| 8 | Planning | agent | `@strategy-planner` | test-strategy.md + parallel-plan.md |
| 9 | Planning | (human) | — | Architecture & plan approval |
| 10 | M1 | (team) | `m1-scaffold` | Project scaffold (frontend + backend) |
| 11 | M1 | (team) | `m1-core` | rules-engine + data-layer |
| 12 | M1 | agent+human | `@katago-integrator` | katago-bridge (agent→human review cycle) |
| 13 | M1 | agent | `@template-engineer` | explanation-engine V1 |
| 14 | M1 | (human) | — | Golden dataset validation (200 positions) |
| 15 | M1 | agent | `@integration-tester` | M1 integration report |
| 16 | M1 | **(human)** | — | **M1 Go/No-Go Gate (MANUAL)** |
| 17 | M2 | (team) | `m2-ui` | board-ui + screens + i18n |
| 18 | M2 | agent | `@game-developer` | Quick Go MVP |
| 19 | M2 | agent | `@devops-engineer` | CI/CD + multi-platform build |
| 20 | M2 | agent | `@integration-developer` | analytics + notifications |
| 21 | M2 | agent | `@qa-engineer` | E2E tests + QA report |
| 22 | M2 | **(human)** | — | **M2 Go/No-Go Gate (MANUAL)** |
| 23 | M3 | (team) | `m3-features` | onboarding + gamification + optimization |
| 24 | M3 | agent | `@release-engineer` | code signing + release preparation |
| 25 | M3 | **(human)** | — | **M3 Go/No-Go — Final Launch (MANUAL)** |

## Appendix B: Agent Team Parallel Execution Map

```
M1 Core Engine ════════════════════════════════════════════════════
  Step 10: (team) ┬─ @scaffold-frontend ──┐
                  └─ @scaffold-backend ───┘→ merge → build verify
  Step 11: (team) ┬─ @rules-engineer ─────┐
                  └─ @data-engineer ──────┘→ merge → test suite
  Step 12: @katago-integrator ←→ (human review) × 3 iterations max
  Step 13: @template-engineer
  Step 14: (human) golden dataset
  Step 15: @integration-tester
  Step 16: (human) ★ M1 Go/No-Go

M2 Playable Beta ══════════════════════════════════════════════════
  Step 17: (team) ┬─ @board-developer ────┐
                  ├─ @screen-developer ───┤→ merge → visual check
                  └─ @i18n-developer ─────┘
  Step 18: @game-developer (Quick Go)
  Step 19: @devops-engineer (CI/CD)
  Step 20: @integration-developer (analytics)
  Step 21: @qa-engineer (E2E + hardening)
  Step 22: (human) ★ M2 Go/No-Go

M3 Public Launch ══════════════════════════════════════════════════
  Step 23: (team) ┬─ @onboarding-developer ────┐
                  ├─ @gamification-developer ───┤→ merge → regression
                  └─ @optimization-engineer ────┘
  Step 24: @release-engineer (signing + release)
  Step 25: (human) ★ M3 Go/No-Go — LAUNCH
```

## Appendix C: AI Automation Rate by Module

| Module | AI Rate | Agent | Human Involvement |
|--------|:-------:|-------|-------------------|
| Frontend (UI, screens) | 85-90% | `@board-developer`, `@screen-developer` | Visual review |
| Backend (CRUD, Tauri cmds) | 80-85% | `@data-engineer`, `@scaffold-backend` | Schema validation |
| Infrastructure/CI/CD | 75-85% | `@devops-engineer` | Build verification |
| Rules engine | 50-60% | `@rules-engineer` | Edge case design |
| Test code | 60-70% | `@qa-engineer` | Test scenario design |
| KataGo IPC | 20-30% | `@katago-integrator` | Protocol design + review cycles |
| LLM prompt/template | 10-20% | `@template-engineer` | Pattern design + golden dataset |
| Code signing | 30-40% | `@release-engineer` | Apple/Windows account setup |

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-10 | Initial design — fully sequential, autopilot disabled |
| 2.0 | 2026-03-10 | Major redesign — Agent Team parallel execution (4 teams), Autopilot partial (Go/No-Go manual), KataGo agent→human review cycle, Golden Dataset (human) in M1, 25 steps (was 30) |
