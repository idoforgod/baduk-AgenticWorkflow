# External AI Integration Research — Aggressive Technology Analysis

**Version**: 1.0
**Date**: 2026-03-10
**Perspective**: Aggressive Technology Analyst — cutting-edge external AI integrations beyond primary Claude API
**Pre-conditions**: Tech Stack v1.0 (Node.js 22, Next.js 15, PG 16, Redis 7.2, Drizzle, Coolify+Hetzner), Claude API (Haiku/Sonnet) as primary LLM
**Critical Constraint**: OpenAI and Gemini must NOT use API connection — subscription-based access only (ChatGPT Plus/Pro, Gemini Advanced)
**Target**: MAU 8K, built entirely by AI agents

---

## Table of Contents

1. [On-Device AI (Gemini Nano / Chrome Built-in AI)](#1-on-device-ai)
2. [Multi-Model Orchestration](#2-multi-model-orchestration)
3. [Specialized Go/Game AI Services](#3-specialized-gogame-ai-services)
4. [AI-Powered Features Beyond Explanation](#4-ai-powered-features-beyond-explanation)
5. [Edge AI / WebAssembly](#5-edge-ai--webassembly)
6. [Integration Priority Matrix](#6-integration-priority-matrix)
7. [Cost Projection at MAU 8K](#7-cost-projection-at-mau-8k)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. On-Device AI

### 1.1 Gemini Nano via Chrome Built-in AI APIs

Gemini Nano is a lightweight LLM that runs **entirely on the user's machine** inside Chrome. No API key. No server cost. No network latency. Google ships the model directly as part of Chrome, downloaded on first use.

#### Current API Surface (as of Chrome 138 stable, March 2026)

| API | Status | What It Does | Baduk App Use Case |
|-----|--------|-------------|-------------------|
| **Prompt API** | Stable (Extensions only, Chrome 138+) | Free-form natural language prompts to Gemini Nano | Quick move explanations, UI text generation, terminology lookup |
| **Summarizer API** | Stable (Chrome 138+) | Generate summaries in various formats | Summarize game reviews, compress analysis results |
| **Translator API** | Stable (Chrome 138+) | Language translation (EN, ES, JP supported in Chrome 140+) | Real-time UI translation for Korean/English/Japanese users |
| **Language Detector API** | Stable (Chrome 138+) | Detect input language | Auto-detect user language preference |
| **Writer API** | Origin Trial | Generate new content per writing task | Generate teaching content snippets |
| **Rewriter API** | Origin Trial | Revise and restructure existing text | Simplify complex explanations for beginners |
| **Proofreader API** | EPP Only | Check grammar/style | Polish user-generated content |

#### Technical Specifications

| Spec | Value | Impact |
|------|-------|--------|
| Context window | **6,144 tokens** (~4,600 words) | Sufficient for single-move explanations, NOT for full game reviews |
| Per-prompt limit | ~1,024 tokens input | Short prompts only — no full game SGF input |
| Latency | **Sub-100ms** for short prompts | Perceived as instant — superior to any cloud API |
| Languages | EN, ES, JP (Chrome 140+) | Korean NOT yet supported as of March 2026 |
| Model download | ~1.7GB one-time | Users need decent storage; transparent background download |
| Platform support | Windows 10+, macOS 13+, Linux, ChromeOS | No iOS, No Android Chrome (yet) |
| GPU requirement | None (CPU support added late 2025) | Works on CPUs — expanded device coverage |

#### Concrete Baduk App Use Cases

1. **Instant move classification**: "Is this move an invasion, reduction, or approach?" — sub-100ms response, no server call
2. **Terminology tooltips**: Hover over "joseki" and get an instant on-device definition
3. **Quick summary of analysis**: Summarize a 500-word Claude-generated review into 2 sentences for mobile view
4. **UI text generation**: Generate contextual hints like "You lost 3.2 points here. Consider the knight's move at D16."
5. **Language switching**: Real-time translation of UI elements (EN/JP only for now — Korean gap is a blocker)

#### What Gemini Nano CANNOT Do for a Baduk App

- **Full game analysis**: 6K context window cannot hold a 250-move SGF + analysis
- **Deep reasoning**: Nano is optimized for classification/summarization, NOT multi-step strategic reasoning
- **Korean language**: Not supported as of March 2026 — critical blocker for Korean users
- **Mobile**: No Chrome Android/iOS support — our mobile users get zero benefit
- **Reliability**: Model availability depends on Chrome's download and user settings

#### Real-World Examples of Chrome Built-in AI

1. **Mentelo** (Chrome AI Challenge 2025 winner): Interactive Chrome Extension for instant on-page tech support
2. **Trail**: Offline trail companion — navigation and exploration without internet
3. **EduAdapt**: Transforms web pages into neurodivergent-friendly reading (ADHD/dyslexia)
4. **Chrome Safe Browsing**: Google's own production use — Gemini Nano detects tech support scam pages
5. **BrowseBack**: Browser with "photographic memory" — recalls previously visited content

#### Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Technical Feasibility | **7/10** | Stable APIs exist, but Extensions-only for Prompt API is limiting for a web app |
| Implementation Complexity | Low-Medium | Standard JavaScript APIs; complexity in graceful fallback |
| Monthly Cost at MAU 8K | **$0** | Zero server cost — runs entirely on user device |
| Risk | **Medium-High** | Chrome-only lock-in, no Korean, no mobile, model quality uncertain for Go domain |
| Timeline | 2-3 weeks (basic), 4-6 weeks (full integration with fallback) |

---

### 1.2 Alternative: WebLLM (In-Browser LLM via WebGPU)

If Chrome Built-in AI is too restrictive (Extensions-only, no Korean), **WebLLM** is the open-source alternative. It runs arbitrary LLMs in the browser via WebGPU with no server.

| Feature | WebLLM | Gemini Nano (Chrome) |
|---------|--------|---------------------|
| Model choice | Any ONNX/GGUF model (Qwen, Phi, Llama, etc.) | Gemini Nano only |
| Browser support | Chrome, Edge, Firefox 141+, Safari 26 (WebGPU) | Chrome only |
| API compatibility | OpenAI-compatible chat completions | Proprietary Chrome APIs |
| Performance | 80% of native; small models at 20-60 tok/s | Sub-100ms for short prompts |
| Model size | 0.5B-3B practical in browser (~1-4GB download) | ~1.7GB fixed |
| Korean support | Yes (Qwen2.5, multilingual models) | No |
| Offline | Yes | Yes |

**Recommendation**: WebLLM with **Qwen2.5-0.5B-Instruct** (quantized q4) as a fallback/complement to Gemini Nano. It solves the Korean language gap and works across browsers.

---

## 2. Multi-Model Orchestration

### 2.1 Architecture: Claude API (Primary) + On-Device (Secondary)

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                ┌──────▼──────┐
                │   Router    │
                │ (Next.js)   │
                └──────┬──────┘
                       │
           ┌───────────┼───────────────┐
           │           │               │
    ┌──────▼──────┐ ┌──▼───────┐ ┌────▼─────────┐
    │ On-Device   │ │ Claude   │ │ Claude       │
    │ Gemini Nano │ │ Haiku    │ │ Sonnet       │
    │ or WebLLM   │ │ 4.5      │ │ 4.5/4.6      │
    │             │ │          │ │              │
    │ FREE        │ │ $1/$5    │ │ $3/$15       │
    │ <100ms      │ │ ~300ms   │ │ ~800ms       │
    │ 6K context  │ │ 200K ctx │ │ 200K ctx     │
    │ Simple Q    │ │ Medium Q │ │ Complex Q    │
    └─────────────┘ └──────────┘ └──────────────┘
```

### 2.2 Routing Decision Tree

```
User request arrives
│
├── Is it a UI tooltip / term definition / quick classification?
│   ├── YES → On-Device (Gemini Nano / WebLLM)
│   │         Cost: $0, Latency: <100ms
│   └── NO ↓
│
├── Is it a single-move explanation (< 500 tokens context)?
│   ├── YES → Claude Haiku 4.5
│   │         Cost: ~$0.003/request, Latency: ~300ms
│   └── NO ↓
│
├── Is it a full game review / teaching explanation / complex strategy?
│   ├── YES → Claude Sonnet 4.5/4.6
│   │         Cost: ~$0.02-0.05/request, Latency: ~800ms
│   └── NO ↓
│
├── Is it content generation (lesson, problem set, article)?
│   └── YES → Claude Sonnet 4.5 (Batch API, 50% discount)
│             Cost: ~$0.01-0.025/request, Latency: async
│
└── Fallback: Claude Haiku 4.5
```

### 2.3 Cost Optimization with On-Device Offloading

Assuming MAU 8K, with ~40K LLM requests/month:

| Scenario | On-Device % | Haiku % | Sonnet % | Monthly Cost |
|----------|------------|---------|----------|-------------|
| All Claude (no on-device) | 0% | 70% | 30% | ~$680 |
| Moderate offload | 30% | 50% | 20% | ~$420 |
| Aggressive offload | 50% | 35% | 15% | ~$290 |

**On-device offloading can cut LLM costs by 40-57%** while improving perceived latency for simple queries.

### 2.4 MCP (Model Context Protocol) for Tool Integration

MCP is the open standard (now under the Linux Foundation's AAIF) for connecting AI to external tools and data. As of March 2026:

- **97 million+ monthly SDK downloads**, 10,000+ active servers
- Supported by Claude, ChatGPT, Cursor, Gemini, VS Code, Copilot
- HTTP Streamable transport is the recommended standard in 2026
- OAuth 2.1 authorization built in

**Baduk App MCP Use Cases**:

| MCP Server | Function | Value |
|------------|----------|-------|
| KataGo MCP Server | Claude directly queries KataGo analysis engine | LLM can request specific positions for analysis |
| SGF Parser MCP Server | Parse/navigate game records as structured data | LLM navigates game trees without raw SGF parsing |
| Game Database MCP Server | Query historical pro games | "Show me games where this joseki appeared" |
| User Progress MCP Server | Access user's study history and ratings | Personalized explanations based on user level |

Building custom MCP servers for KataGo and SGF data would allow Claude to **autonomously explore game positions** rather than receiving pre-computed analysis. This is architecturally significant — it turns the LLM from a text formatter into an active analyst.

### 2.5 Subscription-Based ChatGPT/Gemini Integration — TOS Analysis

**VERDICT: Programmatic access to subscription accounts is PROHIBITED and HIGH-RISK.**

#### OpenAI Terms of Service (Updated January 2025)

OpenAI explicitly prohibits:
- "Automatically or programmatically extracting data or Output"
- "Interfering with or disrupting services, including circumventing rate limits or restrictions"
- Using "automated bots or scripts to scrape the API or chat interface"

**Consequence**: Account suspension/permanent ban. Refund of unused subscription only.

#### Google Gemini Terms of Service

Similar restrictions apply. Automated access to the consumer Gemini interface is not sanctioned.

#### Legal Alternatives for Subscription Accounts

| Approach | Legality | Practical Value |
|----------|----------|----------------|
| Browser automation (Selenium/Playwright) | **PROHIBITED** | Account will be banned |
| Custom GPTs / Gemini Gems | **ALLOWED** | Limited — cannot integrate back into app programmatically |
| Manual copy-paste workflows | **ALLOWED** | Zero automation value |
| ChatGPT Canvas / Gemini in Docs | **ALLOWED** | Content creation tool for team, not user-facing |
| **Use subscriptions for internal R&D only** | **RECOMMENDED** | Team uses ChatGPT Plus and Gemini Advanced for prompt engineering, testing, content ideation — but all user-facing calls go through Claude API |

**Recommendation**: Use ChatGPT Plus and Gemini Advanced subscriptions exclusively for:
1. Prompt engineering and A/B testing before deploying to Claude API
2. Content ideation (lesson plans, problem sets) that get manually curated
3. Competitive analysis (testing what other LLMs produce for Go queries)
4. Do NOT build any automated pipeline touching these subscription services.

---

## 3. Specialized Go/Game AI Services

### 3.1 KataGo Server (goban-app/katago-server)

A production-ready REST API server for KataGo written in **Rust (Axum)**.

| Feature | Detail |
|---------|--------|
| Language | Rust + Tokio async runtime |
| API | Versioned REST (`/api/v1/`) with RFC 7807 error handling |
| Analysis | Win probability, score estimates, move candidates with visits/priors |
| Territory | Detailed ownership predictions per intersection |
| Deployment | Docker images for CPU and GPU |
| Config | TOML config files + environment variables |
| Process | Automatic KataGo process lifecycle management |

**Assessment**: This is directly relevant — instead of building a custom Node.js wrapper around KataGo, we could deploy this Rust server and have our Next.js backend call it. The Rust implementation would be faster and more resource-efficient than a Node.js child_process approach.

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **9/10** |
| Implementation Complexity | Low (Docker deploy) |
| Monthly Cost | $0 (self-hosted on existing Hetzner) |
| Risk | Low — open source, actively maintained |
| Timeline | 1-2 weeks to deploy and integrate |

### 3.2 Board Recognition (Photo to SGF)

Multiple open-source solutions exist for converting photographs of Go boards to SGF:

| Tool | Platform | Technology | Quality |
|------|----------|-----------|---------|
| **Baduk Cap** | iOS | Native image recognition | Best-in-class; live capture, auto-move detection, Bluetooth remote |
| **BadukAI** | Android | ML-based detection | Good; handles partial boards |
| **img2sgf** | Python (CLI) | OpenCV | Designed for printed diagrams |
| **GBR (Go Board Recognition)** | Python | OpenCV + ML | Handles photo recognition |
| **LizGoban SGF from Image** | Web | Semi-automatic | Browser-based, user-guided |
| **Kifu-Snap** | Web | Automatic recognition | Video stream support planned |

**Baduk App Integration Strategy**:

1. **Phase 1**: Integrate a Python-based recognizer (GBR or img2sgf) as a server-side microservice
2. **Phase 2**: Build a browser-based recognizer using TensorFlow.js + a custom CNN trained on Go board images
3. **Phase 3**: Real-time video recognition for OTB (over-the-board) game recording

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **7/10** (server-side), **5/10** (browser-based) |
| Implementation Complexity | Medium (Phase 1), High (Phase 2-3) |
| Monthly Cost | $0 (self-hosted) |
| Risk | Medium — accuracy varies with lighting/angle; user expectations are high |
| Timeline | 3-4 weeks (Phase 1), 8-12 weeks (Phase 2) |

### 3.3 Go-Specific AI Services Landscape

| Service | URL | What It Does | Integration Potential |
|---------|-----|-------------|---------------------|
| **KataGo Distributed Training** | katagotraining.org | Crowd-sourced training — latest networks | Download latest models for our server |
| **ZBaduk** | zbaduk.com | AI game review platform | Competitor — study their UX, not integrate |
| **BadukPop** | badukpop.com | Learn & play with AI | Competitor — gamification reference |
| **AhQ Go** | Play Store | 7 playing styles (cosmic, warlike, etc.) | Feature reference for personality system |
| **OGS (Online-Go)** | online-go.com | Platform with KataGo integration | Community integration potential |

**No commercially available Go-specific LLM API exists as of March 2026.** The explanation layer remains an unserved market — which validates our competitive thesis.

---

## 4. AI-Powered Features Beyond Explanation

### 4.1 AI-Generated Teaching Content

#### Tsumego (Problem) Generation

KataGo + Claude can generate teaching problems programmatically:

```
Pipeline:
1. KataGo analyzes position → identifies critical sequences
2. Extract "life-and-death" or "best move" sub-positions
3. Claude generates:
   - Problem statement ("Black to play and live")
   - Hint system (3 progressive hints)
   - Detailed solution explanation
   - Common mistakes and why they fail
4. Store in problem database with difficulty rating
```

**Implementation**: Claude Sonnet (Batch API) generates content offline. Each problem costs ~$0.02-0.04 to generate. A library of 1,000 problems costs ~$20-40 one-time.

#### Lesson Generation

| Lesson Type | Source | AI Role | Cost/Lesson |
|-------------|--------|---------|-------------|
| Opening principles | Pro game database | Claude explains patterns, generates exercises | ~$0.10 |
| Joseki study | KataGo + SGF database | Claude explains when/why to use each joseki | ~$0.15 |
| Endgame technique | KataGo endgame analysis | Claude breaks down counting and technique | ~$0.08 |
| Game review lesson | User's own games | Claude + KataGo create personalized lessons | ~$0.20 |

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **9/10** |
| Implementation Complexity | Medium |
| Monthly Cost | ~$50-100 for continuous content generation |
| Risk | Low — worst case is mediocre content quality, easily filtered |
| Timeline | 4-6 weeks |

### 4.2 AI-Powered Opponent Personality

KataGo v1.15+ already ships **Human SL models** that can imitate players of specific ranks and eras:

| Profile | Configuration | Playing Character |
|---------|--------------|-------------------|
| `preaz_5d` | Pre-AlphaZero 5-dan | Classical, territory-oriented |
| `rank_1d` | Modern 1-dan style | AI-influenced openings, human middle game |
| `proyear_1980` | Pro style circa 1980 | Kobayashi/Takemiya era influence |
| `proyear_2020` | Pro style circa 2020 | AI-influenced, modern joseki |
| `rank_15k` | 15-kyu imitation | Realistic beginner opponent |

**Beyond KataGo's built-in profiles**, we can build personalities:

| Personality | Implementation | User Value |
|-------------|---------------|------------|
| **"The Attacker"** | KataGo with aggressive PDA settings + fight-seeking evaluation | Trains defensive skills |
| **"The Teacher"** | KataGo at rank_N+3 + Claude explaining its moves in real-time | Interactive learning partner |
| **"Historical Pro"** | proyear_XXXX profiles + Claude providing era-appropriate commentary | Educational/entertainment |
| **"The Trickster"** | Human SL model at user's rank + occasional deliberate overplays | Punish-the-mistake training |

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **9/10** — KataGo HumanSL already implements the core |
| Implementation Complexity | Medium (configuration + Claude commentary integration) |
| Monthly Cost | $0 additional (KataGo runs on existing GPU) |
| Risk | Low |
| Timeline | 3-4 weeks (basic), 6-8 weeks (with Claude commentary) |

### 4.3 Voice Commentary (TTS)

Two viable options for generating voice commentary of game reviews:

#### Option A: ElevenLabs

| Spec | Detail |
|------|--------|
| Quality | Industry-leading naturalness; 13+ voice styles |
| Latency | Real-time streaming available |
| Languages | Multilingual (Korean, English, Japanese) |
| Pricing | Scale plan: $330/month (millions of credits); ~1,000 credits = 1 minute audio |
| Custom voices | Professional voice cloning available |

#### Option B: OpenAI TTS (API)

| Spec | Detail |
|------|--------|
| Quality | High quality; 13 distinct voices |
| Latency | Real-time streaming (gpt-realtime) |
| Pricing | Standard: $15/1M characters; HD: $30/1M characters; GPT-4o mini TTS: ~$0.015/minute |
| Note | **This IS an API** — the constraint against OpenAI API is about LLM text generation, not TTS. Verify with team whether TTS API is also excluded. |

#### Cost Estimate for Voice Commentary at MAU 8K

Assume 10% of users use voice (800 users), average 5 minutes of commentary per session, 4 sessions/month:

- Total: 800 x 5 x 4 = 16,000 minutes/month
- ElevenLabs: ~$160-250/month (Scale plan with credits)
- OpenAI TTS: 16,000 min x $0.015 = ~$240/month

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **8/10** |
| Implementation Complexity | Medium (TTS integration + audio streaming) |
| Monthly Cost | $160-250/month |
| Risk | Low-Medium — voice quality is good; user adoption uncertain |
| Timeline | 3-4 weeks |

### 4.4 Image Generation for Marketing/Content

| Use Case | Tool | Cost | Quality |
|----------|------|------|---------|
| Board position → artistic rendering | Flux.2 (self-hosted) or DALL-E 3 | $0 (self-hosted) or ~$0.04/image | High |
| Social media content | Midjourney (subscription) | $10/month | Highest |
| In-app decorative elements | Stable Diffusion 3.5 (self-hosted) | $0 (self-hosted) | Good |
| User profile avatars | Small fine-tuned model | $0 (after training) | Medium |

**Realistic assessment**: Image generation is a "nice to have" for marketing, NOT a core feature. Recommend using the team's existing subscriptions (Midjourney, etc.) for manual content creation rather than building an automated pipeline.

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **8/10** |
| Implementation Complexity | Low (manual) to High (automated pipeline) |
| Monthly Cost | $10-30 (subscription) or $0 (self-hosted) |
| Risk | Low |
| Timeline | N/A for manual; 4-6 weeks for automated |

---

## 5. Edge AI / WebAssembly

### 5.1 Browser-Based KataGo (Web-KaTrain Precedent)

**Web-KaTrain** (by Sir-Teo, announced January 2026 on OGS Forum) proves that KataGo-level analysis can run in the browser:

| Component | Technology |
|-----------|-----------|
| UI Framework | React |
| State Management | Zustand |
| Neural Network Inference | TensorFlow.js |
| GPU Acceleration | WebGPU (primary) |
| CPU Fallback | WASM |
| Repository | github.com/Sir-Teo/web-katrain |

**What this means for our app**: It is technically proven that KataGo analysis can run client-side. However, browser-based analysis is significantly weaker than server-side GPU analysis:

| Metric | Server (RTX 4000) | Browser (WebGPU, mid-range GPU) | Browser (WASM/CPU) |
|--------|-------------------|--------------------------------|-------------------|
| Visits/sec | ~1,300 | ~50-150 (estimate) | ~5-15 |
| Network model | b28c512 possible | b6c96 or b10c128 max | b6c96 only |
| Analysis depth | Deep (500+ visits) | Shallow (50-100 visits) | Minimal (10-30 visits) |
| Use case | Production analysis | Quick preview / offline | Emergency fallback |

**Recommended strategy**: Use browser-based KataGo as an **offline fallback** and **instant preview**, with full analysis on the server GPU.

### 5.2 ONNX Runtime Web + WebGPU

ONNX Runtime Web with WebGPU backend delivers:

- **20x speedup** vs. multithreaded CPU in browser
- **FP16 support** reduces GPU memory usage
- Supports complex ML workloads (transformers, CNNs)
- Available in Chrome/Edge (v113+), Firefox (v141+), Safari Technology Preview

**Baduk App Use Cases for ONNX Runtime Web**:

| Use Case | Model | Size | Feasibility |
|----------|-------|------|-------------|
| Board position evaluation (quick) | Custom small CNN | ~5-20MB | **High** |
| Stone/board detection from camera | MobileNet/EfficientNet | ~20-50MB | **High** |
| Move prediction (top-3 candidates) | Small policy network | ~10-30MB | **Medium** |
| Simple life-and-death solver | Custom classifier | ~5-10MB | **High** |

### 5.3 TensorFlow.js + WebGPU

Performance characteristics:

| Metric | WebGL (legacy) | WebGPU (current) |
|--------|---------------|-----------------|
| Inference speed | Baseline | **3x faster** (general), **10x faster** (transformers) |
| FP16 support | No | Yes |
| Compute shaders | No | Yes |
| Browser support | Universal | Chrome, Edge, Firefox 141+, Safari 26 |

TensorFlow.js is the proven choice for browser-based neural network inference, with the Web-KaTrain project validating its use for Go-specific models.

### 5.4 Transformers.js for In-Browser NLP

Transformers.js (by Hugging Face) can run small NLP models directly in the browser:

| Model | Size (q4) | Speed (WebGPU) | Use Case |
|-------|-----------|---------------|----------|
| Qwen2.5-0.5B-Instruct | ~350MB | 20-40 tok/s | Short text generation, classification |
| Phi-3-mini (3.8B) | ~2.5GB | 10-20 tok/s | Medium complexity reasoning |
| SmolVLM | ~500MB | Varies | Vision tasks (board recognition) |

**Key advantage**: OpenAI-compatible API, works in a single HTML file, zero server cost, data stays on device.

### 5.5 Edge AI Assessment Summary

| Technology | Feasibility | Best Use in Baduk App | Cost |
|------------|-------------|----------------------|------|
| Web-KaTrain approach (TF.js + WebGPU) | **8/10** | Offline analysis preview, quick evaluations | $0 |
| ONNX Runtime Web | **8/10** | Board detection, simple evaluations | $0 |
| Transformers.js | **7/10** | In-browser text generation for tooltips | $0 |
| WebLLM | **7/10** | Offline LLM explanations | $0 |
| Gemini Nano (Chrome Built-in) | **7/10** | Instant classifications, summaries | $0 |

| Criterion | Score |
|-----------|-------|
| Technical Feasibility | **8/10** (collectively) |
| Implementation Complexity | Medium-High (multiple technologies to integrate) |
| Monthly Cost | **$0** |
| Risk | Medium — browser compatibility, device capability variance, model quality |
| Timeline | 6-10 weeks for a comprehensive edge AI layer |

---

## 6. Integration Priority Matrix

Ranked by **impact-to-effort ratio** and **competitive advantage**:

| Priority | Integration | Impact | Effort | Cost/mo | Competitive Moat |
|----------|------------|--------|--------|---------|------------------|
| **P0** | KataGo HumanSL opponent personalities | 10 | Low | $0 | **HIGH** — no competitor ships rank/era-calibrated opponents |
| **P0** | Claude API multi-tier routing (Haiku/Sonnet) | 9 | Medium | $290-680 | **HIGH** — explanation quality is the core product |
| **P1** | KataGo REST server (Rust, goban-app) | 8 | Low | $0 | Medium — better architecture, faster analysis |
| **P1** | AI-generated teaching content (batch) | 8 | Medium | $50-100 | **HIGH** — 1000+ personalized problems at ~$30 |
| **P2** | MCP servers for KataGo + SGF data | 7 | Medium | $0 | **HIGH** — Claude autonomously explores game positions |
| **P2** | On-device AI (Gemini Nano + WebLLM fallback) | 7 | Medium | $0 | Medium — cost savings, instant tooltips |
| **P2** | Browser-based KataGo preview (TF.js/WebGPU) | 7 | High | $0 | Medium — offline capability, instant preview |
| **P3** | Voice commentary (ElevenLabs or OpenAI TTS) | 6 | Medium | $160-250 | Medium — differentiated UX, accessibility |
| **P3** | Board recognition (photo to SGF) | 6 | High | $0 | Medium — "scan your OTB game" feature |
| **P4** | Image generation for marketing | 4 | Low | $10-30 | Low — nice to have |

---

## 7. Cost Projection at MAU 8K

### Monthly Recurring AI Costs

| Service | Optimistic | Expected | Pessimistic |
|---------|-----------|----------|-------------|
| Claude API (Haiku + Sonnet, with on-device offloading) | $290 | $420 | $680 |
| Teaching content generation (batch) | $30 | $50 | $100 |
| Voice commentary (optional) | $0 | $160 | $250 |
| Image generation (manual, subscription) | $10 | $20 | $30 |
| On-device AI | $0 | $0 | $0 |
| KataGo (self-hosted GPU) | $0 | $0 | $0 |
| **Total External AI** | **$330** | **$650** | **$1,060** |

### Infrastructure (already budgeted separately)

| Service | Monthly Cost |
|---------|-------------|
| Hetzner GEX44 (GPU server) | ~$90 |
| Hetzner CX22 (app server, if separate) | ~$8 |
| Coolify (self-hosted) | $0 |

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

- [ ] Deploy KataGo REST server (goban-app/katago-server) on Hetzner GPU
- [ ] Implement Claude API multi-tier routing (Haiku for simple, Sonnet for complex)
- [ ] Configure KataGo HumanSL profiles (5 personalities minimum)
- [ ] Build prompt caching layer for Claude API (90% cost reduction on repeated contexts)

### Phase 2: Intelligence Layer (Weeks 5-8)

- [ ] Build MCP server for KataGo analysis engine
- [ ] Build MCP server for SGF game data
- [ ] Implement AI teaching content generation pipeline (Batch API)
- [ ] Generate initial problem library (500+ problems)

### Phase 3: Edge AI (Weeks 9-12)

- [ ] Integrate Gemini Nano / Chrome Built-in AI for desktop users
- [ ] Implement WebLLM fallback for non-Chrome browsers
- [ ] Build browser-based KataGo preview (TF.js + WebGPU)
- [ ] Implement graceful degradation chain: Gemini Nano → WebLLM → Claude Haiku

### Phase 4: Enhancement (Weeks 13-16)

- [ ] Voice commentary integration (ElevenLabs or OpenAI TTS)
- [ ] Board recognition MVP (server-side, photo upload)
- [ ] Advanced opponent personality system (Claude commentary during play)
- [ ] Content generation automation (weekly new problems and lessons)

---

## Key Decision Points

### Decision 1: OpenAI TTS API — Is It Excluded?

The constraint says "OpenAI must NOT use API connection." Does this apply to ALL OpenAI APIs (including TTS), or only to LLM text generation APIs? If TTS is allowed, OpenAI TTS at $0.015/minute is competitive with ElevenLabs. **Needs team decision.**

### Decision 2: KataGo Server — Build vs. Adopt

Option A: Use goban-app/katago-server (Rust) as-is — lower effort, proven, faster
Option B: Build custom Node.js wrapper — more control, matches team's stack
**Recommendation**: Option A (adopt Rust server). The 1-2 week deployment cost is negligible, and Rust's performance advantage is real.

### Decision 3: Edge AI Priority

Edge AI (Gemini Nano, WebLLM, browser KataGo) provides $0 marginal cost but adds complexity. At MAU 8K, the Claude API cost savings (~$200-400/month) must be weighed against 6-10 weeks of implementation time.
**Recommendation**: Implement in Phase 3, after the core product is solid. The cost savings become more compelling at MAU 20K+.

### Decision 4: Voice Commentary — Launch Feature or Post-Launch?

Voice commentary is a differentiator but not a core feature. At $160-250/month, it is affordable but adds implementation complexity.
**Recommendation**: Post-launch feature (Phase 4). Focus on text-based explanations first.

---

## Sources

### On-Device AI / Chrome Built-in AI
- [The Prompt API | Chrome for Developers](https://developer.chrome.com/docs/ai/prompt-api)
- [Chrome's Built-In AI: Gemini Nano Complete Guide](https://www.flaming.codes/posts/chrome-gemini-nano-built-in-ai)
- [Built-in AI APIs | Chrome for Developers](https://developer.chrome.com/docs/ai/built-in-apis)
- [Summarize with built-in AI | Chrome for Developers](https://developer.chrome.com/docs/ai/summarizer-api)
- [Writer API | Chrome for Developers](https://developer.chrome.com/docs/ai/writer-api)
- [Rewriter API | Chrome for Developers](https://developer.chrome.com/docs/ai/rewriter-api)
- [Winners of the Built-in AI Challenge 2025](https://developer.chrome.com/blog/ai-challenge-winners-2025)
- [Expanding built-in AI to more devices with Chrome](https://developer.chrome.com/blog/gemini-nano-cpu-support)
- [Gemini Nano in Chrome 137: notes for AI Engineers](https://www.swyx.io/gemini-nano)
- [Maximum Token Limits for Gemini Nano APIs](https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/WO2NIK_9Ue4)
- [Half a year later: what Built-in AI on Chrome can do today](https://thangman22.com/2025/08/29/half-a-year-has-passed-lets-see-what-built-in-ai-on-chrome-can-do-today/)
- [Getting Started with Chrome's window.ai Prompt API](https://www.sitepoint.com/chrome-window-ai-prompt-api-tutorial/)

### Multi-Model Orchestration / MCP
- [Introducing the Model Context Protocol | Anthropic](https://www.anthropic.com/news/model-context-protocol)
- [Model Context Protocol (MCP) 2026: The Complete Guide](https://calmops.com/ai/model-context-protocol-mcp-2026-complete-guide/)
- [Model Context Protocol - Wikipedia](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)

### Claude API Pricing
- [Pricing - Claude API Docs](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude API Pricing Calculator (Mar 2026)](https://costgoat.com/pricing/claude-api)
- [Claude API Pricing — Opus 4.6, Sonnet 4.6, Haiku Token Costs](https://www.tldl.io/resources/anthropic-api-pricing)

### KataGo / Go AI
- [goban-app/katago-server (Rust REST API)](https://github.com/goban-app/katago-server)
- [KataGo v1.15.x - new human-like play and analysis](https://forums.online-go.com/t/katago-v1-15-x-new-human-like-play-and-analysis/52489)
- [KataGo HumanSL Release](https://github.com/lightvector/KataGo/releases/tag/v1.15.0)
- [KataGo GTP Extensions](https://github.com/lightvector/KataGo/blob/master/docs/GTP_Extensions.md)
- [KataGo Human5K Example Config](https://github.com/lightvector/KataGo/blob/master/cpp/configs/gtp_human5k_example.cfg)
- [AI is rewiring how the world's best Go players think | MIT Technology Review](https://www.technologyreview.com/2026/02/27/1133624/ai-is-rewiring-how-the-worlds-best-go-players-think/)
- [AhQ Go - 7 playing styles](https://play.google.com/store/apps/details?id=cn.ezandroid.aq.preview&hl=en_US)

### Board Recognition
- [Baduk Cap (iOS)](https://apps.apple.com/ca/app/baduk-cap/id896353586)
- [BadukAI (Android)](https://aki65.github.io/)
- [img2sgf - Python OpenCV](https://github.com/hanysz/img2sgf)
- [GBR - Go Board Recognition](https://github.com/skolchin/gbr)
- [Kifu-Snap](https://www.remi-coulom.fr/kifu-snap/)
- [LizGoban SGF from Image](https://kaorahi.github.io/lizgoban/src/sgf_from_image/)

### Edge AI / WebAssembly
- [Web-KaTrain (Sir-Teo)](https://github.com/Sir-Teo/web-katrain)
- [Web-KaTrain Announcement (OGS Forum)](https://forums.online-go.com/t/web-katrain-browser-based-katrain-clone-with-in-browser-katago-analysis-webgpu-wasm/59096)
- [ONNX Runtime Web - Using WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)
- [AI in Browser with WebGPU: 2025 Developer Guide](https://aicompetence.org/ai-in-browser-with-webgpu/)
- [WebGPU in 2025: In-Browser AI That's Actually Useful](https://ai.plainenglish.io/webgpu-in-2025-in-browser-ai-thats-actually-useful-281bbaadaf6f)
- [TensorFlow.js Platform and Environment](https://www.tensorflow.org/js/guide/platform_environment)
- [Transformers.js v3: WebGPU Support](https://huggingface.co/blog/transformersjs-v3)
- [WebLLM (GitHub)](https://github.com/mlc-ai/web-llm)
- [WebLLM Documentation](https://webllm.mlc.ai/docs/)

### TTS / Voice
- [ElevenLabs API Pricing](https://elevenlabs.io/pricing/api)
- [ElevenLabs Pricing Breakdown 2026](https://flexprice.io/blog/elevenlabs-pricing-breakdown)
- [OpenAI TTS Pricing](https://platform.openai.com/docs/pricing)
- [OpenAI TTS Pricing Calculator (Mar 2026)](https://costgoat.com/pricing/openai-tts)
- [ElevenLabs vs OpenAI TTS Comparison](https://vapi.ai/blog/elevenlabs-vs-openai)

### TOS / Legal
- [OpenAI Terms of Use](https://openai.com/policies/row-terms-of-use/)
- [OpenAI Usage Policies](https://openai.com/policies/usage-policies/)
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)

### Image Generation
- [AI Image Generation in 2025](https://vestig.oragenai.com/topics/image-generation/post_20251128_160203.html)
- [Best Open-Source AI Image Generation Models in 2026](https://www.pixazo.ai/blog/top-open-source-image-generation-models)

### Go Teaching / Tsumego
- [GoMagic - Go Problems](https://gomagic.org/go-problems/)
- [Tsumego-hero](https://tsumego-hero.com/)
- [AI designing tsumego (OGS Forum)](https://forums.online-go.com/t/artificial-intelligence-designing-tsumego/44802)
- [style.baduk.org](https://style.baduk.org/)
