# Baduk Platform — Landing Page Content

**Version:** v1.0.0
**Audience:** English-speaking Go players, students, and enthusiasts
**Target deployment:** Cloudflare Pages (static HTML/CSS/JS, no server-side rendering required)

---

## SEO Metadata

```html
<title>Baduk Platform — AI-Powered Go Analysis, Completely Offline</title>
<meta name="description" content="Analyze your Go games with KataGo AI. Baduk Platform runs entirely on your computer — no subscription, no cloud, no account required. Free download for macOS, Windows, and Linux." />
<meta name="keywords" content="Go game analysis, Baduk AI, KataGo desktop app, Weiqi software, Go board game, AI move analysis, offline Go analyzer, free Go software" />
<meta property="og:title" content="Baduk Platform — AI-Powered Go Analysis" />
<meta property="og:description" content="Analyze your Go games with KataGo AI. Completely offline. Free for macOS, Windows, and Linux." />
<meta property="og:image" content="/assets/og-preview.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="https://baduk.app" />
```

---

## 1. Hero Section

**Headline:**
> Understand Every Move.

**Subtitle:**
> Baduk Platform brings KataGo's professional-strength AI analysis to your desktop. See the win rate, explore top candidate moves, and get plain-English explanations of why the AI prefers each play. No account. No subscription. Runs entirely on your computer.

**Primary CTA button:** Download for Free
**Secondary CTA link:** View on GitHub

**Hero image alt text:**
> Screenshot of Baduk Platform showing a 19x19 Go board mid-game with the AI analysis panel open on the right, displaying win rate at 63% for Black, top three candidate moves highlighted in blue, and a natural-language explanation reading "D4 is the strongest move because it secures corner territory while threatening the White group's eye space."

---

## 2. Features Section

### Feature 1 — KataGo AI, Bundled Locally

**Icon suggestion:** cpu / processor chip
**Headline:** KataGo Runs On Your Machine

**Description:**
The full KataGo v1.16.4 neural network engine is bundled with the app. Your games never leave your computer. There is no cloud API, no rate limit, and no subscription fee. Analysis is as fast as your hardware allows — Apple Silicon users get GPU acceleration via Metal automatically.

---

### Feature 2 — Plain-English Move Explanations

**Icon suggestion:** message-circle / speech bubble
**Headline:** AI Explanations You Can Actually Read

**Description:**
After each analysis query, the Explanation Engine translates KataGo's numeric output into natural language. Pick your skill level — Beginner, Intermediate, or Advanced — and the explanations adjust accordingly. "This move threatens a ko in the lower left corner" is more useful than "winrate: 0.632."

---

### Feature 3 — Win Rate and Score Charts

**Icon suggestion:** trending-up / line chart
**Headline:** See the Turning Points

**Description:**
Win rate and score lead are charted across every move of the game. Identify the exact move where Black lost the advantage, or see how a sequence of mistakes compounded. Charts update in real time as you navigate the game tree.

---

### Feature 4 — All Standard Board Sizes

**Icon suggestion:** grid / board
**Headline:** 9x9, 13x13, and 19x19

**Description:**
The interactive board renders pixel-perfectly at all three standard sizes. Navigate move history with keyboard shortcuts, replay sequences, and branch into variations. The board is optimized for both small laptop screens and large external displays.

---

### Feature 5 — Game Database with SGF Support

**Icon suggestion:** database / archive
**Headline:** Store and Import Your Games

**Description:**
Every game is saved to a local SQLite database. Import games from SGF files produced by KGS, OGS, or any other Go server. Export your analyzed games back to SGF to share with study partners or post to Go forums.

---

### Feature 6 — Automatic Updates

**Icon suggestion:** refresh-cw / arrows
**Headline:** Always Up to Date

**Description:**
Baduk Platform checks for new versions on startup and installs them with one click. Updates are cryptographically signed — you will never accidentally install a tampered update. No manual downloads required.

---

## 3. AI Explanation Showcase

**Section headline:** What the AI Actually Tells You

**Subsection:** Example Analysis — Move 34, Black D4

```
Win Rate:   Black 63.2%  (+4.1% from previous move)
Score Lead: Black +2.8 points
Top Moves:  1. D4  2. C3  3. Q16

Explanation (Beginner level):
"D4 is the best move in this position. It builds a strong
 connection in the lower-left area while putting pressure
 on White's stones nearby. If Black plays here, White will
 be forced to defend rather than attack."

Explanation (Advanced level):
"D4 maximizes local efficiency by simultaneously securing
 the 3-3 invasion point and creating a forcing sequence
 through C3. White's response at E3 is forced, allowing
 Black to tenuki with sente. The primary variation runs
 D4 → E3 → C3 with 2.8 point territory gain."
```

**Caption:** Explanations adjust to your experience level. The same AI analysis, explained differently.

---

## 4. Platform Availability Section

**Section headline:** Download for Your Platform

### macOS
**Badge:** Apple Silicon + Intel Universal
**Download button:** Download for macOS (v1.0.0)
**File:** Baduk_1.0.0_aarch64.dmg (Apple Silicon) / Baduk_1.0.0_x64.dmg (Intel)
**Note:** Signed and notarized by Apple. Opens without Gatekeeper warnings.
**Requirement:** macOS 11 (Big Sur) or later

### Windows
**Badge:** Windows 10 / 11
**Download button:** Download for Windows (v1.0.0)
**File:** Baduk_1.0.0_x64-setup.exe
**Note:** Code signed. If Windows SmartScreen appears, click "More info" then "Run anyway."
**Requirement:** Windows 10 1809 or later, 64-bit

### Linux
**Badge:** AppImage + .deb
**Download button:** Download for Linux (v1.0.0)
**File:** Baduk_1.0.0_amd64.AppImage
**Note:** Universal AppImage, no installation required. Also available as .deb for Debian/Ubuntu.
**Requirement:** Ubuntu 22.04+ or equivalent glibc 2.35+

**Footer note:** All downloads are free and open source. [View source on GitHub](https://github.com/YOUR_ORG/baduk-platform)

---

## 5. FAQ Section

### Q1: Do I need an internet connection to use Baduk Platform?

**A:** No. KataGo and the AI model are bundled with the app and run entirely on your computer. An internet connection is only needed to download the app initially and to receive automatic updates. Analysis works fully offline.

### Q2: How strong is the AI?

**A:** Baduk Platform uses KataGo v1.16.4 with the kata1-b18c384nbt neural network model. At full settings (2000 visits), it plays at professional strength — stronger than any human player. For everyday analysis, the default setting (200 visits) provides strong amateur-level analysis much faster.

### Q3: Do I need a powerful computer?

**A:** The app runs on any modern computer. An Apple Silicon Mac (M1 or later) or a PC with a GPU provides the best experience. CPU-only analysis works on all hardware but is slower. Minimum: 4GB RAM, 400MB disk space.

### Q4: Is my game data private?

**A:** Yes. All game data is stored locally in a SQLite database on your computer. Nothing is sent to any server unless you have opted in to anonymous crash reporting (PostHog/Sentry). You can disable this in Settings > Privacy. We do not have access to your games.

### Q5: Can I import my games from KGS, OGS, or other Go servers?

**A:** Yes. Baduk Platform imports and exports SGF (Smart Game Format) files, which is the universal format used by KGS, OGS, Fox Go Server, and most other Go platforms. Download your game as an SGF file from your server and open it in Baduk Platform.

---

## Static Site Implementation Notes (Cloudflare Pages)

The landing page is a single-page static site. No server-side rendering or backend required.

**Recommended structure:**
```
/index.html           ← Main landing page
/assets/
  og-preview.png      ← 1200x630 Open Graph preview image
  screenshot-hero.png ← Hero section screenshot (1920x1080)
  icon.png            ← App icon (512x512)
  demo.gif            ← Optional: 30-second feature demo GIF
/download/
  index.html          ← Platform-specific download page (JS detects OS)
/_headers             ← Cloudflare Pages security headers
/_redirects           ← Cloudflare Pages URL redirects
```

**`_headers` (recommended security headers):**
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**OS detection for download buttons (JavaScript snippet):**
```javascript
function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}
```

**GitHub Releases download URLs (v1.0.0):**
- macOS arm64: `https://github.com/YOUR_ORG/baduk-platform/releases/download/v1.0.0/Baduk_1.0.0_aarch64.dmg`
- macOS x64: `https://github.com/YOUR_ORG/baduk-platform/releases/download/v1.0.0/Baduk_1.0.0_x64.dmg`
- Windows: `https://github.com/YOUR_ORG/baduk-platform/releases/download/v1.0.0/Baduk_1.0.0_x64-setup.exe`
- Linux AppImage: `https://github.com/YOUR_ORG/baduk-platform/releases/download/v1.0.0/Baduk_1.0.0_amd64.AppImage`
- Linux deb: `https://github.com/YOUR_ORG/baduk-platform/releases/download/v1.0.0/baduk_1.0.0_amd64.deb`

---

*Step 24 — Release Engineer output. Landing page content ready for static site implementation.*
