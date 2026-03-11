# Research 4: External AI Integration — Aggressive (On-Device & Multi-Model)

> **Branch Perspective**: "The future is on-device AI + multi-model orchestration. We maximize AI capabilities by leveraging every available channel."
> **Date**: 2026-03-10
> **Constraint**: OpenAI/Gemini must NOT use API connections — subscription/browser/on-device only.
> **Context**: Balanced-Tech Stack v1.0 (Node.js 22 LTS, Next.js 15, PG 16, Redis 7.2, Drizzle ORM, KataGo CPU Eigen)

---

## 1. Chrome Built-in AI / Gemini Nano On-Device (DEEP DIVE)

### 1.1 Current State (March 2026)

Chrome's built-in AI has reached a critical inflection point. As of Chrome 140+, Google is expanding Gemini Nano to CPU-only devices (no GPU required), dramatically broadening the addressable device pool across Windows, macOS, and Linux.

**API Maturity Status:**

| API | Status | Chrome Version | Notes |
|-----|--------|---------------|-------|
| **Translator API** | **Stable** | Chrome 138+ | Expert model (not Gemini Nano), on-device |
| **Language Detector API** | **Stable** | Chrome 138+ | Paired with Translator |
| **Summarizer API** | **Stable** | Chrome 138+ | Gemini Nano powered |
| **Prompt API** | **Stable (Extensions)** | Chrome 138+ | Extensions only; web pages still experimental |
| **Writer API** | **Origin Trial** | Chrome 139+ | Gemini Nano powered |
| **Rewriter API** | **Origin Trial** | Chrome 139+ | Gemini Nano powered |
| **Proofreader API** | **Early Preview** | Chrome 141+ | EPP participants only |
| **Prompt API (Multimodal)** | **Early Preview** | -- | EPP participants only |

**Language Support (Gemini Nano / Prompt API):**
- Chrome 140: **English, Spanish, Japanese** only
- Korean: **NOT supported yet** — critical limitation for our Go app's Korean user base
- Translator API (expert model): Broader language support including CJK languages, but Korean availability must be verified via `Translator.availability()` at runtime

**Platform Support:**
- Windows 10/11, macOS 13+ (Ventura+), Linux, ChromeOS (Chromebook Plus)
- **NOT supported**: Android, iOS, non-Chromebook Plus ChromeOS
- CPU inference added in Chrome 140 (previously GPU-only)

### 1.2 Capabilities for a Go App

| Use Case | API | Feasibility | Notes |
|----------|-----|-------------|-------|
| Move explanation generation | Prompt API | **Medium** | English only; 3-language limit; small model = limited Go knowledge |
| Game summary after match | Summarizer API | **High** | Feed structured game data, get natural language summary |
| Real-time translation (EN→KO) | Translator API | **Uncertain** | Korean support unconfirmed; expert model, not Gemini Nano |
| Board position classification | Prompt API | **Low** | Gemini Nano optimized for text, not spatial/strategic reasoning |
| User input reformulation | Rewriter API | **Medium** | Origin trial; could refine user comments/reviews |
| SGF notation explanation | Prompt API | **Medium** | Can parse text patterns, but Go domain knowledge is shallow |

### 1.3 Performance Benchmarks

| Metric | Gemini Nano (On-Device) | Cloud API (Gemini Flash) | Cloud API (Claude Haiku) |
|--------|------------------------|--------------------------|--------------------------|
| Latency (TTFT) | **<100ms** (sub-100ms median) | ~200ms | ~640ms |
| Throughput | ~10-20 tok/s (CPU) | 274 tok/s | 79-96 tok/s |
| Cost per request | **$0.00** | ~$0.0001 | ~$0.0005 |
| Quality (reasoning) | Low (small model) | High | High |
| Privacy | **Full** (no data leaves device) | Cloud | Cloud |
| Offline capability | **Yes** | No | No |

### 1.4 Real-World Examples

1. **Policybazaar & JioHotstar** — Used Translator + Language Detector APIs for multilingual experiences in production Chrome apps (Google developer blog case study)
2. **Google Chrome Built-in AI Challenge 2025** — 500+ submissions using Gemini Nano APIs (Devpost competition)
3. **web-katrain** — Browser-based KaTrain clone using TensorFlow.js + WebGPU/WASM for in-browser KataGo analysis (community project, demonstrates Go AI in browser is viable)

### 1.5 Implementation Approach for Our Go App

```
Phase 1 (Month 1-2): Feature detection + graceful degradation
├── Check API availability: ai.languageModel.capabilities()
├── Download Gemini Nano on first use (automatic by Chrome)
├── Use Summarizer API for post-game summaries (English)
├── Translator API for EN→KO (if available; fallback to Claude)
└── Prompt API for simple move annotations in Extensions context

Phase 2 (Month 3-4): Progressive enhancement
├── Writer API for generating study notes from game data
├── Offline analysis mode using cached Prompt API
└── Client-side SGF annotation without server round-trip

Phase 3 (Month 5-6): Korean language (if supported)
├── Monitor Chrome 142+ for Korean Prompt API support
├── Translator API Korean pair verification
└── Full on-device Korean game commentary pipeline
```

### 1.6 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Korean not supported in Prompt API | **High** (our primary market) | Claude API fallback for Korean content |
| Desktop-only (no mobile) | **High** (mobile users 60%+) | Server-side fallback for mobile; PWA detection |
| Experimental APIs may change | **Medium** | Feature detection + abstraction layer |
| Model too small for Go reasoning | **Medium** | Use only for text tasks, not game analysis |
| Chrome-only (no Firefox/Safari) | **Medium** | Progressive enhancement, not dependency |

**Verdict**: Use as **progressive enhancement layer** for cost savings on text tasks. NEVER depend on it for core functionality.

---

## 2. Claude API Maximization (Primary Cloud AI)

### 2.1 Model Lineup & Pricing (March 2026)

| Model | Input/1M tokens | Output/1M tokens | Speed (TTFT) | Speed (tok/s) | Best For |
|-------|-----------------|-------------------|--------------|---------------|----------|
| **Haiku 4.5** | $1.00 | $5.00 | ~640ms | 79-96 | Bulk move explanations, template enhancement |
| **Sonnet 4.6** | $3.00 | $15.00 | ~800ms | 60-80 | Complex game analysis, teaching content |
| **Opus 4.6** | $5.00 | $25.00 | ~1.2s | 40-60 | Deep strategic commentary (premium feature) |
| **Opus 4.6 Fast** | $30.00 | $150.00 | ~600ms | 80+ | Real-time premium analysis (if needed) |

### 2.2 Cost Optimization Stack

#### Prompt Caching (90% Cost Reduction)

Prompt caching is the single most impactful cost optimization for our Go app. Here's why:

**Go App Caching Architecture:**
```
System Prompt (CACHED — 2,000+ tokens)
├── "You are a Go/baduk expert commentator..."
├── Go rules reference (Tromp-Taylor)
├── KataGo output format specification
├── Response format (JSON structured output)
└── Teaching methodology guidelines

+ KataGo Analysis Result (DYNAMIC — 200-500 tokens)
├── Board position data
├── Win rate, score lead
├── Top 5 candidate moves with visit counts
└── Ownership map

= Output: Natural language explanation (200-400 tokens)
```

**Cost Calculation (1,000 game analyses/day using Haiku 4.5):**

| Scenario | Input Cost | Output Cost | Daily Total | Monthly |
|----------|-----------|-------------|-------------|---------|
| No caching | $2.00 | $2.50 | $4.50 | **$135** |
| With prompt caching (90% read hits) | $0.25 | $2.50 | $2.75 | **$82.50** |
| + Batch API (50% off async) | $0.13 | $1.25 | $1.38 | **$41.25** |
| **Stacked: Cache + Batch** | **$0.13** | **$1.25** | **$1.38** | **$41.25** |

**Implementation:**
```typescript
// Prompt caching with cache_control breakpoint
const response = await anthropic.messages.create({
  model: "claude-haiku-4-5-20260301",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: GO_EXPERT_SYSTEM_PROMPT, // 2,000+ tokens, stable
      cache_control: { type: "ephemeral" } // 5-min TTL
    }
  ],
  messages: [
    {
      role: "user",
      content: `Analyze this KataGo output:\n${katagoJSON}`
    }
  ]
});
```

**Cache Mechanics:**
- Minimum 1,024 tokens to cache (Sonnet/Opus models)
- Cache write: 1.25x base input price (first request)
- Cache read: 0.1x base input price (subsequent requests within 5 min)
- At 100+ requests with same system prompt, savings approach **90%**
- 5-minute TTL resets on each cache hit

#### Batch API (50% Discount)

For non-real-time analysis (post-game review, daily puzzles, content generation):

```typescript
// Batch API for async game analysis
const batch = await anthropic.beta.messages.batches.create({
  requests: gameAnalyses.map((game, i) => ({
    custom_id: `game-${game.id}`,
    params: {
      model: "claude-haiku-4-5-20260301",
      max_tokens: 1024,
      system: GO_EXPERT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: game.katagoOutput }]
    }
  }))
});
// Results available within 1 hour (most complete <1hr), max 24hr window
// 100,000 requests per batch, 256MB max
```

**Batch Use Cases for Go App:**
- Post-game full-move analysis (overnight batch)
- Daily puzzle explanations (batch generate for next day)
- Teaching content generation (weekly batch)
- Opening database commentary (one-time batch)

#### 3-Tier Model Strategy (Confirmed from Phase 4)

| Tier | Model | Usage % | Trigger | Cost/request |
|------|-------|---------|---------|-------------|
| T1 | Haiku 4.5 | 80% | Standard move explanations, quick analysis | ~$0.003 |
| T2 | Sonnet 4.6 | 15% | Complex positions, teaching moments, user questions | ~$0.012 |
| T3 | Template V1 | 5% | Simple pattern matches, fallback | $0.00 |

**Routing Logic:**
```typescript
function selectModel(context: AnalysisContext): ModelTier {
  // Template: simple patterns (atari, capture, ko)
  if (context.isSimplePattern) return 'template-v1';

  // Sonnet: complex positions or explicit user questions
  if (context.isComplexPosition || context.hasUserQuestion) return 'sonnet-4.6';

  // Haiku: everything else (80% of traffic)
  return 'haiku-4.5';
}
```

### 2.3 Extended Thinking for Premium Analysis

Claude Opus 4.6 supports adaptive thinking — Claude dynamically determines when and how deeply to reason. For premium game analysis:

```typescript
const response = await anthropic.messages.create({
  model: "claude-opus-4-6-20260301",
  max_tokens: 16000,
  thinking: { type: "enabled", budget_tokens: 10000 },
  messages: [{
    role: "user",
    content: `Deep analysis of this critical game moment:\n${positionData}`
  }]
});
```

- **Interleaved thinking**: Claude can think between tool calls (e.g., query KataGo, think, query again)
- **Structured outputs**: Available via `structured-outputs-2025-11-13` beta header
- **Cost**: ~$0.15-0.30 per deep analysis (premium feature only)

### 2.4 Real-World Examples

1. **AI-Generated Game Commentary Survey (arXiv 2506.17294)** — Documents hybrid template + LLM approach for sports commentary, directly applicable to Go
2. **ZBaduk.com** — Review baduk games with AI analysis (existing market player using cloud AI)
3. **AI Sensei** — Play and review Go games for free, demonstrating LLM + engine fusion

### 2.5 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| API costs scale with users | **Medium** | Prompt caching + batch + tiered models |
| Rate limiting at scale | **Low** | Batch API for non-real-time; queue management |
| Model quality regression | **Low** | Pin model versions, A/B test upgrades |
| Latency for real-time play | **Medium** | Pre-compute likely moves; async overlay |

**Verdict**: Claude API is the **primary programmatic AI backbone**. The 3-tier model strategy with prompt caching and batch API makes it economically viable at scale.

---

## 3. MCP (Model Context Protocol) for Tool Integration

### 3.1 Current State (March 2026)

MCP has won. It is the de facto standard for connecting AI systems to tools and data:

- **97M+ monthly SDK downloads** (npm)
- **5,800+ MCP servers**, 300+ MCP clients in ecosystem
- **Adopted by**: Anthropic (creator), OpenAI, Google DeepMind, Microsoft
- **Governance**: Donated to Linux Foundation's Agentic AI Foundation (AAIF) in Dec 2025
- **Spec version**: November 2025 specification (security-focused, enterprise-ready)
- **Official TypeScript SDK**: `@modelcontextprotocol/typescript-sdk`

### 3.2 MCP Architecture for Our Go App

```
┌─────────────────────────────────────────────┐
│                MCP Client                    │
│     (Claude API / Claude Code / IDE)         │
└─────────┬───────────────┬──────────────┬────┘
          │               │              │
     ┌────▼────┐   ┌──────▼─────┐  ┌────▼────────┐
     │ KataGo  │   │  Game DB   │  │  Teaching    │
     │  MCP    │   │   MCP      │  │  Content     │
     │ Server  │   │  Server    │  │  MCP Server  │
     └────┬────┘   └──────┬─────┘  └────┬────────┘
          │               │              │
     ┌────▼────┐   ┌──────▼─────┐  ┌────▼────────┐
     │ KataGo  │   │ PostgreSQL │  │ Markdown/    │
     │ Process │   │   16       │  │ SGF Files    │
     │ (IPC)   │   │            │  │              │
     └─────────┘   └────────────┘  └─────────────┘
```

#### KataGo MCP Server (Custom Build)

```typescript
// src/mcp-servers/katago/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "katago-analysis",
  version: "1.0.0",
});

// Tool: Analyze a board position
server.tool(
  "analyze_position",
  "Analyze a Go board position using KataGo engine",
  {
    board: z.array(z.array(z.number())).describe("19x19 board state (0=empty, 1=black, 2=white)"),
    nextPlayer: z.enum(["B", "W"]),
    maxVisits: z.number().default(500),
    komi: z.number().default(7.5),
  },
  async ({ board, nextPlayer, maxVisits, komi }) => {
    const analysis = await katagoProcess.analyze({
      board, nextPlayer, maxVisits, komi,
      rules: "tromp-taylor"
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          winRate: analysis.rootInfo.winrate,
          scoreLead: analysis.rootInfo.scoreLead,
          topMoves: analysis.moveInfos.slice(0, 5).map(m => ({
            move: m.move,
            visits: m.visits,
            winRate: m.winrate,
            scoreLead: m.scoreLead,
          })),
          ownership: analysis.ownership,
        })
      }]
    };
  }
);

// Tool: Compare two candidate moves
server.tool(
  "compare_moves",
  "Compare two candidate moves and explain the difference",
  {
    board: z.array(z.array(z.number())),
    moveA: z.string(),
    moveB: z.string(),
    nextPlayer: z.enum(["B", "W"]),
  },
  async ({ board, moveA, moveB, nextPlayer }) => {
    // Run KataGo analysis focused on both moves
    const analysis = await katagoProcess.analyze({
      board, nextPlayer, maxVisits: 1000,
      analyzeMoves: [moveA, moveB],
    });
    return { content: [{ type: "text", text: JSON.stringify(analysis) }] };
  }
);
```

#### Why MCP for KataGo?

| Benefit | Description |
|---------|-------------|
| **Standardized interface** | Any MCP client (Claude, IDEs, custom apps) can use KataGo |
| **Tool composition** | Claude can chain: analyze position → compare moves → generate explanation |
| **Schema validation** | Zod schemas enforce correct board state format |
| **Streaming support** | MCP supports SSE for long-running analysis |
| **Security** | November 2025 spec adds OAuth, resource indicators, token scoping |
| **Reusability** | Same server works for development (Claude Code) and production (API) |

### 3.3 Real-World MCP Examples

1. **Chess-MCP (arvid-berndtsson/Chess-MCP)** — Full chess engine + game server via MCP, supports position analysis and AI play. Direct architectural analog for our KataGo MCP server.
2. **Stockfish MCP Servers** — Multiple implementations integrating Stockfish chess engine via MCP for position evaluation and best-move computation.
3. **BGG MCP (kkjdaniel/bgg-mcp)** — BoardGameGeek data access via MCP, demonstrating board game domain integration.

### 3.4 Implementation Approach

```
Month 1: KataGo MCP Server (stdio transport)
├── Wrap KataGo Analysis Engine Mode in MCP tool interface
├── Tools: analyze_position, compare_moves, evaluate_sequence
├── Resources: game_rules, scoring_reference
└── Test with Claude Code + MCP Inspector

Month 2: Game DB MCP Server
├── Tools: get_game_history, get_player_stats, search_positions
├── Resources: opening_database, joseki_patterns
└── Connect to PostgreSQL via Drizzle ORM

Month 3: Production Integration
├── MCP servers as child processes of Next.js backend
├── Claude API calls with tool_use pointing to MCP tools
├── HTTP/SSE transport for remote access
└── Monitoring + logging integration
```

### 3.5 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| MCP spec still evolving | **Low** | Foundation governance ensures stability; pin SDK version |
| Overhead vs direct IPC | **Low** | JSON serialization overhead negligible for Go analysis (ms) |
| Security for public-facing servers | **Medium** | Use November 2025 spec auth; internal-only for Phase 1 |

**Verdict**: MCP is a **must-adopt** for KataGo integration. The Chess-MCP precedent proves the pattern works for board game engines.

---

## 4. Multi-Model Orchestration WITHOUT OpenAI/Gemini API

### 4.1 The Subscription Leverage Strategy

The user has active subscriptions to ChatGPT and Gemini. Here's how to leverage them WITHOUT API calls:

#### Channel 1: HARPA AI (Browser Automation Bridge)

HARPA AI is the most viable bridge between subscriptions and programmatic access:

| Feature | Detail |
|---------|--------|
| **What it does** | Chrome extension that piggybacks on your existing ChatGPT/Claude/Gemini logged-in sessions |
| **Free tier** | 10 messages/day, 100 total AI command runs |
| **Paid tier** | From $15/month for higher limits |
| **Key capability** | Web session AI connections — uses YOUR subscription, not API |
| **Automation** | Grid API triggers via Make.com, Zapier, n8n |
| **Page-aware** | Reads current page content, can interact with forms |

**Go App Use Case**: Content team uses HARPA to batch-generate Go teaching articles using ChatGPT subscription, then imports into CMS.

#### Channel 2: Chrome Auto Browse (Gemini 3)

Google's Auto Browse (launched January 2026) for Google AI subscribers:
- Autonomous task completion via Gemini 3 AI side panel
- Available to Premium subscribers only ($19.99/month Google AI Pro)
- Can browse, extract, and synthesize information

**Go App Use Case**: Research competitor features, gather Go strategy content, automated market monitoring.

#### Channel 3: ChatGPT Atlas Browser

OpenAI's dedicated AI browser (launched October 2025):
- Agent Mode for multi-step autonomous tasks
- Requires ChatGPT subscription ($20/month Plus)
- Chrome extension compatible
- Project Mariner (Google) as competitor

**Go App Use Case**: Autonomous research tasks, content curation for Go teaching materials.

### 4.2 On-Device Models for Offline Features

#### Gemini Nano (Chrome Built-in)
- See Section 1 above
- Best for: Text summarization, simple explanations
- **Zero cost**, runs in Chrome

#### WebLLM (MLC-AI)
- Runs open-source LLMs (Llama 3, Phi 3, Gemma, Mistral, Qwen) entirely in-browser
- **WebGPU acceleration** — approaches native GPU speed
- Supports quantized models up to ~3B parameters on consumer hardware
- **Zero API cost**

```typescript
// WebLLM integration for offline Go commentary
import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Phi-3.5-mini-instruct-q4f16_1-MLC", {
  initProgressCallback: (progress) => {
    console.log(`Loading model: ${progress.text}`);
  }
});

const reply = await engine.chat.completions.create({
  messages: [
    { role: "system", content: "You are a Go/baduk teacher explaining moves to beginners." },
    { role: "user", content: `KataGo says Q16 is the best move with 67% win rate. Why?` }
  ],
  temperature: 0.7,
});
```

**Performance (WebLLM on consumer hardware):**

| Model | Size | RAM | Speed (WebGPU) | Speed (WASM fallback) | Quality |
|-------|------|-----|----------------|----------------------|---------|
| Phi-3.5-mini-q4 | 1.8GB | 4GB | ~15-25 tok/s | ~3-5 tok/s | Good for simple explanations |
| Gemma-2B-q4 | 1.2GB | 3GB | ~20-30 tok/s | ~5-8 tok/s | Decent for classification |
| Llama-3.2-1B-q4 | 0.7GB | 2GB | ~30-40 tok/s | ~8-12 tok/s | Fast, lower quality |

#### ONNX Runtime Web
- Production-grade runtime for ML models in browser
- WebGPU backend: ~20x over multi-threaded CPU
- Can run custom fine-tuned models for Go-specific tasks

**Go App Use Case**: Client-side position classification model (opening/midgame/endgame), pattern recognition for common shapes (ladder, snapback, ko).

### 4.3 The Multi-Model Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Go App Frontend                        │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Chrome       │  │ WebLLM       │  │ ONNX Runtime    │ │
│  │ Built-in AI  │  │ (Phi-3.5/    │  │ Web (Custom     │ │
│  │ (Gemini Nano)│  │  Gemma/Llama)│  │  Go Models)     │ │
│  │              │  │              │  │                  │ │
│  │ • Summarize  │  │ • Offline    │  │ • Pattern       │ │
│  │ • Translate  │  │   commentary │  │   recognition   │ │
│  │ • Detect lang│  │ • Quick      │  │ • Position      │ │
│  │              │  │   explanations│ │   classification│ │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│         │ FREE             │ FREE              │ FREE     │
│         └────────┬─────────┘                   │          │
│                  │ On-Device Layer              │          │
├──────────────────┼─────────────────────────────┼──────────┤
│                  │ Cloud Layer                  │          │
│  ┌───────────────▼─────────────────────────────▼────────┐│
│  │              Model Router / Orchestrator              ││
│  │                                                       ││
│  │  if (offline || simpleTask) → On-Device              ││
│  │  if (standardAnalysis)      → Claude Haiku 4.5       ││
│  │  if (complexAnalysis)       → Claude Sonnet 4.6      ││
│  │  if (premiumDeepDive)       → Claude Opus 4.6        ││
│  │  if (templateMatch)         → Template V1 (no LLM)   ││
│  └──────────────────────────────────────────────────────┘│
│                                                           │
│  ┌─────────────────┐  ┌────────────────┐                 │
│  │ Claude API      │  │ Batch API      │                 │
│  │ (Real-time)     │  │ (Async, 50%    │                 │
│  │ + Prompt Cache  │  │  discount)     │                 │
│  └─────────────────┘  └────────────────┘                 │
└──────────────────────────────────────────────────────────┘

Subscription Channels (Manual/Semi-automated):
┌────────────────────────────────────────────┐
│  ChatGPT Plus ($20/mo) — Content creation  │
│  Google AI Pro ($20/mo) — Research/browse   │
│  HARPA AI (Free/Paid) — Automation bridge  │
└────────────────────────────────────────────┘
```

### 4.4 Cost Comparison: API vs Subscription vs On-Device

| Channel | Monthly Cost | Requests/mo | Cost/Request | Latency | Quality |
|---------|-------------|-------------|-------------|---------|---------|
| **On-Device (Gemini Nano)** | $0 | Unlimited | $0.000 | <100ms | Low-Medium |
| **On-Device (WebLLM Phi-3.5)** | $0 | Unlimited | $0.000 | 500ms-2s | Medium |
| **Claude Haiku 4.5 (cached)** | ~$41/mo | 30,000 | $0.0014 | 640ms | High |
| **Claude Sonnet 4.6** | ~$25/mo | 5,000 | $0.005 | 800ms | Very High |
| **Claude Batch (Haiku)** | ~$21/mo | 30,000 | $0.0007 | 1-24hr | High |
| **ChatGPT Plus subscription** | $20/mo | ~100/day* | $0.007 | 1-3s | Very High |
| **Google AI Pro subscription** | $20/mo | ~150/day* | $0.004 | 1-2s | High |
| **HARPA Free** | $0 | 10/day | $0.000 | 2-5s | Varies |

*Subscription rate limits vary; estimates based on typical usage patterns.

**Monthly Total (Aggressive Stack):**
- Claude API (Haiku+Sonnet): ~$66/mo
- On-Device (Gemini Nano + WebLLM): $0/mo
- Existing subscriptions (ChatGPT + Gemini): $40/mo (already paid)
- HARPA Free tier: $0/mo
- **Total incremental: ~$66/mo** (Claude API only)

---

## 5. Go-Specific AI Applications

### 5.1 On-Device Move Validation (No Server Round-Trip)

**Architecture:**
```typescript
// Client-side move validation using ONNX Runtime Web
class ClientSideMoveValidator {
  private session: ort.InferenceSession;

  async init() {
    // Load quantized model (~500KB) for basic Go rule validation
    this.session = await ort.InferenceSession.create(
      '/models/go-rules-validator-q8.onnx',
      { executionProviders: ['webgpu', 'wasm'] }
    );
  }

  async isLegalMove(board: number[][], move: [number, number], player: number): boolean {
    // Pure rule validation (suicide, ko, occupied) — no AI needed
    // This should be deterministic logic, not ML
    return validateGoRules(board, move, player); // ~0.1ms
  }

  async classifyPosition(board: number[][]): PositionType {
    // ML model for position classification
    const tensor = new ort.Tensor('float32', board.flat(), [1, 19, 19]);
    const results = await this.session.run({ input: tensor });
    return interpretClassification(results); // ~5-10ms with WebGPU
  }
}
```

**Key Insight**: Basic move validation (legality check) should be pure algorithmic logic, not ML. Reserve ML for:
- Position phase classification (opening/middle/endgame)
- Pattern recognition (common shapes: ladder, net, snapback, ko fight)
- Difficulty estimation (for puzzle generation)

**Performance:**
- Rule validation: <1ms (pure JavaScript, Tromp-Taylor rules)
- Position classification (ONNX): 5-10ms (WebGPU), 20-50ms (WASM)
- Pattern recognition: 10-20ms (WebGPU)
- **Zero server round-trips** for all above

### 5.2 Client-Side Game Analysis Caching

```typescript
// IndexedDB cache for game analyses
class AnalysisCache {
  private db: IDBDatabase;

  async cacheAnalysis(positionHash: string, analysis: GameAnalysis) {
    // Hash the board state for deduplication
    // Same positions across games share cached analysis
    await this.db.put('analyses', {
      hash: positionHash,
      analysis,
      timestamp: Date.now(),
      ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  async getCachedAnalysis(positionHash: string): GameAnalysis | null {
    const cached = await this.db.get('analyses', positionHash);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.analysis; // ~1ms vs 640ms+ from API
    }
    return null;
  }
}
```

**Cache Hit Rate Estimate:**
- Opening moves (first 30): **70-80%** hit rate (common openings repeat)
- Midgame positions: **10-20%** hit rate (high variation)
- Endgame: **30-40%** hit rate (common endgame patterns)
- **Weighted average: ~35-45% hit rate**, saving ~35% of API calls

### 5.3 AI-Powered Natural Language Game Commentary

**The Hybrid Template + LLM Approach** (validated by arXiv 2506.17294):

```
KataGo Analysis Output
        │
        ▼
┌─────────────────┐
│  Pattern Matcher │ ← Template V1 (5% traffic, $0 cost)
│  (Deterministic) │   "Black captures 3 stones at D4"
└────────┬────────┘   "White plays a ladder at K10"
         │
    Not matched?
         │
         ▼
┌─────────────────┐
│  Claude Haiku    │ ← Standard explanation (80% traffic)
│  4.5 + Cache    │   "This move strengthens Black's
│                  │    framework on the right side while
│  System prompt:  │    threatening to reduce White's
│  Go expert +     │    territory on the bottom."
│  Teaching style  │
└────────┬────────┘
         │
    Complex position?
         │
         ▼
┌─────────────────┐
│  Claude Sonnet   │ ← Deep analysis (15% traffic)
│  4.6 + Extended  │   Multi-paragraph strategic analysis
│  Thinking        │   with move sequences and variations
└─────────────────┘
```

**Commentary Quality Tiers:**

| Tier | Model | Avg Tokens | Latency | Cost | Content |
|------|-------|-----------|---------|------|---------|
| Basic | Template V1 | 20-50 | <10ms | $0 | Factual: "captures", "connects", "extends" |
| Standard | Haiku 4.5 | 100-200 | 640ms | ~$0.001 | Strategic context + teaching explanation |
| Deep | Sonnet 4.6 | 300-500 | 1.5s | ~$0.006 | Variations, strategic alternatives, pro-game references |
| Premium | Opus 4.6 | 500-1000 | 3s | ~$0.025 | Dan-level strategic essay with reading sequences |

### 5.4 Real-Time Position Evaluation Overlay

**Architecture:**
```
Browser (Real-time overlay)
├── Canvas layer: Board rendering (React Canvas)
├── Overlay layer: Win rate bar + territory map
├── WebSocket: Receives KataGo analysis from server
└── On-device: Gemini Nano for instant text annotation

Server
├── KataGo process: Continuous analysis (500 visits/move)
├── BullMQ: Analysis job queue
├── WebSocket server: Broadcasts to connected clients
└── Redis: Caches recent analyses

Update cycle:
1. Move played → WebSocket → Server
2. KataGo analysis (3-8s) → Redis cache
3. Server → WebSocket → All spectators
4. Client renders: win rate, territory, top moves
5. On-device Gemini Nano: Quick text annotation (<100ms)
```

**Evaluation Overlay Components:**

| Component | Data Source | Update Frequency | Render Method |
|-----------|-----------|-----------------|---------------|
| Win rate bar | KataGo rootInfo.winrate | Per move | CSS gradient bar |
| Territory map | KataGo ownership[] | Per move | Canvas heatmap overlay |
| Top 5 moves | KataGo moveInfos | Per move | SVG markers on board |
| Score estimate | KataGo rootInfo.scoreLead | Per move | Text overlay |
| Move quality | Delta between played & best | Per move | Color-coded (green/yellow/red) |
| Text annotation | Gemini Nano / Claude | Per move | Side panel text |

**Latency Budget:**
- KataGo analysis: 3-8s (CPU Eigen, 500 visits)
- WebSocket broadcast: ~50ms
- Client render: ~16ms (60fps)
- Text annotation (on-device): <100ms
- **Total: 3-8s per move** (dominated by KataGo)
- **Phase 2 (GPU)**: 0.3-1s per move with GPU backend

### 5.5 Real-World Go App AI Integration Examples

1. **web-katrain** (Sir-Teo/web-katrain) — Browser-based KaTrain with in-browser KataGo via TensorFlow.js + WebGPU/WASM. Proves KataGo can run in-browser for analysis.
2. **BadukAI** (aki65.github.io) — Web app with KataGo + LeelaZero for analysis. Multiple AI engines in one interface.
3. **AI Sensei** (ai-sensei.com) — Free Go game review platform. Cloud AI analysis with natural language feedback.
4. **ZBaduk** (zbaduk.com) — Review baduk games with AI. Established player in the market.
5. **KaTrain** (sanderland/katrain) — Desktop KataGo training tool. Our UX benchmark for analysis features.

---

## 6. Conclusion: Recommended Aggressive AI Stack

### 6.1 Technology Stack

```
┌─────────────────────────────────────────────────────┐
│            AGGRESSIVE AI INTEGRATION STACK            │
│                                                       │
│  LAYER 1: On-Device (FREE, instant)                  │
│  ├── Chrome Built-in AI (Gemini Nano)                │
│  │   └── Summarizer + Translator + Prompt (Ext)      │
│  ├── WebLLM (Phi-3.5-mini or Gemma-2B, quantized)   │
│  │   └── Offline commentary + quick explanations     │
│  ├── ONNX Runtime Web                                │
│  │   └── Position classification + pattern detection │
│  └── Pure JS: Tromp-Taylor rule validation           │
│                                                       │
│  LAYER 2: Cloud AI — Claude API (PRIMARY)            │
│  ├── Haiku 4.5 (80%) — bulk explanations             │
│  ├── Sonnet 4.6 (15%) — complex analysis             │
│  ├── Opus 4.6 (premium only) — deep strategic        │
│  ├── Prompt Caching (90% cost reduction)             │
│  ├── Batch API (50% discount for async)              │
│  └── Extended Thinking (premium feature)             │
│                                                       │
│  LAYER 3: Template Engine (FALLBACK, $0)             │
│  └── Template V1 — pattern-matched explanations      │
│                                                       │
│  LAYER 4: MCP Integration                            │
│  ├── KataGo MCP Server (custom, TypeScript)          │
│  ├── Game DB MCP Server (PG 16 + Drizzle)            │
│  └── @modelcontextprotocol/sdk v1.x                  │
│                                                       │
│  LAYER 5: Subscription Channels (MANUAL)             │
│  ├── ChatGPT Plus ($20/mo) — content generation      │
│  ├── Google AI Pro ($20/mo) — research + Auto Browse  │
│  └── HARPA AI (Free) — subscription automation bridge │
└─────────────────────────────────────────────────────┘
```

### 6.2 Monthly Cost Estimate

| Item | Phase 1 (Month 1-3) | Phase 2 (Month 4-6) | At Scale (MAU 8K) |
|------|---------------------|---------------------|-------------------|
| Claude Haiku 4.5 (cached) | $15 | $30 | $41 |
| Claude Sonnet 4.6 | $5 | $15 | $25 |
| Claude Opus 4.6 (premium) | $0 | $5 | $10 |
| Claude Batch API | $0 | $10 | $21 |
| On-Device (Gemini Nano + WebLLM) | $0 | $0 | $0 |
| Existing subscriptions | $40* | $40* | $40* |
| HARPA AI | $0 | $0 | $0 |
| **Total** | **$60** | **$100** | **$137** |

*Already paid by user — not incremental cost.

**Incremental AI cost: $20-97/month** (Claude API only)

### 6.3 Implementation Timeline

```
Month 1: Foundation
├── Template V1 engine (pattern-matched explanations)
├── Claude Haiku 4.5 integration with prompt caching
├── KataGo MCP Server (stdio transport)
├── Client-side Tromp-Taylor rule validation
└── IndexedDB analysis cache

Month 2: On-Device Layer
├── Chrome Built-in AI feature detection + graceful degradation
├── Summarizer API for post-game summaries
├── WebLLM integration (Phi-3.5-mini) for offline mode
├── ONNX Runtime Web for position classification
└── Model router: on-device → cloud fallback

Month 3: Cloud Optimization
├── Claude Batch API for overnight analysis generation
├── 3-tier model routing (Template → Haiku → Sonnet)
├── Prompt caching optimization (system prompt engineering)
├── Game DB MCP Server
└── Real-time evaluation overlay (WebSocket + Canvas)

Month 4: Advanced Features
├── Extended thinking for premium deep analysis
├── Writer/Rewriter API integration (if stable)
├── Translator API for EN↔KO (if Korean supported)
├── Multi-move commentary pipeline
└── HARPA automation for content batch generation

Month 5: Polish & Scale
├── A/B test model tiers (quality vs cost)
├── Cache hit rate optimization
├── Batch API expansion (daily puzzles, opening DB)
├── Performance profiling (on-device vs cloud latency)
└── Korean language fallback finalization

Month 6: Production Hardening
├── Rate limiting + circuit breakers for Claude API
├── On-device model update strategy
├── MCP server monitoring + health checks
├── Cost alerting ($100/mo threshold)
└── Documentation + API versioning
```

### 6.4 Risk/Reward Assessment

| Dimension | Score (1-10) | Assessment |
|-----------|:----------:|------------|
| **Innovation** | **9** | Multi-layer AI (on-device + cloud + MCP) is cutting-edge for Go apps |
| **Cost Efficiency** | **8** | On-device = $0; Claude caching = 90% savings; existing subscriptions leveraged |
| **Technical Risk** | **6** | Chrome Built-in AI still maturing; Korean support uncertain; WebLLM quality varies |
| **User Experience** | **8** | Instant on-device responses + high-quality cloud analysis = best of both worlds |
| **Scalability** | **7** | On-device offloads server; Claude API scales linearly; batch reduces peaks |
| **Competitive Advantage** | **9** | No existing Go app has this multi-layer AI architecture |
| **Implementation Complexity** | **5** | 5 layers to maintain; feature detection logic; fallback chains |
| **Reliability** | **6** | On-device APIs experimental; multiple fallback paths needed |
| **Market Readiness** | **7** | Claude API production-ready; MCP mature; on-device emerging |
| **Overall Risk/Reward** | **7.2** | High reward with manageable risk through fallback architecture |

### 6.5 Key Differentiators vs Competitors

| Feature | Our App (Aggressive Stack) | OGS | Fox Baduk | AI Sensei |
|---------|---------------------------|-----|-----------|-----------|
| On-device AI | Gemini Nano + WebLLM | None | None | None |
| Offline analysis | Yes (WebLLM + cached) | No | No | No |
| Natural language commentary | Claude 3-tier + on-device | None | Basic | Basic |
| MCP-based tool integration | KataGo + GameDB via MCP | N/A | N/A | N/A |
| Multi-model orchestration | 5-layer stack | Single model | Proprietary | Single model |
| Zero-cost AI tier | Gemini Nano + WebLLM | No | No | No |
| Real-time eval overlay | WebSocket + Canvas | Basic | Yes | Yes |
| Extended thinking analysis | Claude Opus 4.6 | No | No | No |

### 6.6 Critical Decision Points

1. **Korean Language**: If Chrome Built-in AI does not support Korean by Month 4, commit fully to Claude API for all Korean content. Budget impact: +$20/mo.

2. **WebLLM Model Selection**: Phi-3.5-mini offers best quality/size ratio for Go explanations. Test Gemma-2B as alternative. Decision by Month 2 based on Go domain accuracy benchmarks.

3. **MCP Transport**: Start with stdio (local process), migrate to HTTP/SSE in Month 3 for remote KataGo instances. Decision point: single vs multi-server KataGo.

4. **On-Device Fallback Threshold**: If Chrome Built-in AI coverage drops below 60% of users, deprioritize on-device layer and invest in server-side caching instead.

5. **Opus 4.6 Budget Cap**: Set hard limit at $30/mo for premium deep analysis. If demand exceeds, implement queue + daily analysis credit system.

---

## Sources

### Chrome Built-in AI / Gemini Nano
- [Chrome Built-in AI Documentation](https://developer.chrome.com/docs/ai)
- [Expanding built-in AI to more devices with Chrome](https://developer.chrome.com/blog/gemini-nano-cpu-support)
- [Chrome AI Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started)
- [Chrome Built-in AI Challenge 2025](https://googlechromeai2025.devpost.com/)
- [Google I/O 2025: Practical built-in AI with Gemini Nano](https://io.google/2025/explore/technical-session-42/)
- [Gemini Nano in Chrome 137: notes for AI Engineers](https://www.swyx.io/gemini-nano)
- [AI APIs stable and origin trials](https://developer.chrome.com/blog/ai-api-updates-io25)
- [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Chrome Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api)
- [Policybazaar and JioHotstar Translation APIs](https://developer.chrome.com/blog/pb-jiohotstar-translation-ai)

### Claude API
- [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Claude API Pricing 2026 Breakdown](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Claude Haiku 4.5](https://www.anthropic.com/claude/haiku)
- [Claude Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Prompt Caching Strategy for 90% Cost Reduction](https://understandingdata.com/posts/prompt-caching-strategy/)
- [Claude Batch Processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- [Claude Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Claude 4.5 Haiku Benchmarks](https://artificialanalysis.ai/models/claude-4-5-haiku)
- [LLM API Latency Benchmarks 2026](https://www.kunalganglani.com/blog/llm-api-latency-benchmarks-2026)

### MCP (Model Context Protocol)
- [MCP Wikipedia](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- [2026: Enterprise-Ready MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption)
- [MCP Specification Nov 2025](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Enterprise Guide](https://guptadeepak.com/the-complete-guide-to-model-context-protocol-mcp-enterprise-adoption-market-trends-and-implementation-strategies/)
- [A Year of MCP: Internal Experiment to Industry Standard](https://www.pento.ai/blog/a-year-of-mcp-2025-review)
- [Why the Model Context Protocol Won](https://thenewstack.io/why-the-model-context-protocol-won/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Chess-MCP](https://github.com/arvid-berndtsson/Chess-MCP)
- [Build MCP Server in Node.js](https://oneuptime.com/blog/post/2025-12-17-build-mcp-server-nodejs/view)
- [FreecCodeCamp MCP TypeScript Guide](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)

### Multi-Model / On-Device
- [2026 AI Subscription Prices Comparison](https://www.sentisight.ai/ai-price-comparison-gemini-chatgpt-claude-grok/)
- [HARPA AI](https://harpa.ai/)
- [HARPA AI Pricing](https://harpa.ai/pricing)
- [Agentic Browser Landscape 2026](https://www.nohackspod.com/blog/agentic-browser-landscape-2026)
- [WebLLM GitHub](https://github.com/mlc-ai/web-llm)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [AI in Browser with WebGPU 2025](https://aicompetence.org/ai-in-browser-with-webgpu/)
- [Local-First AI Guide](https://www.sitepoint.com/definitive-guide-local-first-ai-2026/)
- [WebGPU Browser AI](https://www.sitepoint.com/webgpu-browser-based-ai-future/)

### Go/Baduk AI
- [web-katrain GitHub](https://github.com/Sir-Teo/web-katrain)
- [KataGo GitHub](https://github.com/lightvector/KataGo)
- [AI-Generated Game Commentary Survey](https://arxiv.org/html/2506.17294v1)
- [AI Sensei](https://ai-sensei.com/)
- [ZBaduk](https://zbaduk.com/)
- [KaTrain](https://github.com/sanderland/katrain)
- [BadukAI](https://aki65.github.io/)
