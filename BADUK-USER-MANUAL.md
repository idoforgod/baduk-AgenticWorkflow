# Baduk Platform: User Manual

KataGo AI 대국 + 실시간 정책망 분석 데스크톱 바둑 앱 사용 매뉴얼.

> 아키텍처 상세: [`BADUK-ARCHITECTURE-AND-PHILOSOPHY.md`](BADUK-ARCHITECTURE-AND-PHILOSOPHY.md)
> 프로젝트 개요: [`README.md`](README.md)

---

## 1. 사전 요구사항

### 필수

| 항목 | 최소 버전 | 확인 명령 |
|------|----------|----------|
| Node.js | 18+ | `node --version` |
| Rust | stable | `rustc --version` |
| Tauri CLI | 2.x | `cargo install tauri-cli` |

### 권장 (KataGo GPU 가속)

| 항목 | 설명 |
|------|------|
| Apple Silicon (M1/M2/M3/M4) | Metal GPU 백엔드 자동 사용 |
| macOS 13+ | Metal 3 지원 |

> KataGo는 CPU로도 동작하지만, GPU 가속 시 분석 속도가 10배 이상 향상된다.

---

## 2. 설치

### 방법 1: 한 줄 자동 설치 (권장)

```bash
git clone https://github.com/idoforgod/baduk-AgenticWorkflow.git
cd baduk-AgenticWorkflow/app
bash scripts/auto-update-katago.sh
```

자동 수행 내역:
1. GitHub에서 최신 KataGo 릴리스 확인
2. macOS Metal aarch64 바이너리 다운로드
3. 모델 파일 설치 (g170-b20c256x2, ~87MB)
4. Tauri 앱 빌드
5. `/Applications/Baduk.app`에 설치 + 실행

### 방법 2: 수동 설치

```bash
# 1. 소스 다운로드
git clone https://github.com/idoforgod/baduk-AgenticWorkflow.git
cd baduk-AgenticWorkflow/app

# 2. 의존성 설치
npm install

# 3. KataGo 바이너리 배치 (수동)
# GitHub에서 다운로드: https://github.com/lightvector/KataGo/releases
# macOS Metal aarch64 ZIP 선택
# 압축 해제 후 katago 바이너리를 다음 경로에 복사:
mkdir -p src-tauri/binaries
cp /path/to/katago src-tauri/binaries/katago-aarch64-apple-darwin
chmod +x src-tauri/binaries/katago-aarch64-apple-darwin

# 4. 모델 파일 배치 (수동)
# g170-b20c256x2-s5303129600-d1228401921.bin.gz 다운로드
mkdir -p src-tauri/resources/models
cp /path/to/model.bin.gz src-tauri/resources/models/default-model.bin.gz

# 5. 빌드 + 실행
npx tauri build
open src-tauri/target/release/bundle/macos/Baduk.app
```

---

## 3. 실행

### 프로덕션 앱

```bash
# 이미 설치된 경우
open /Applications/Baduk.app

# Claude Code에서 (자동 업데이트 포함)
/play
```

### 개발 모드

```bash
cd baduk-AgenticWorkflow/app
npm install
npx tauri dev
```

개발 모드에서는 React Hot Reload가 활성화되어, 코드 수정 시 자동 반영된다.

---

## 4. 게임 플레이

### 4.1 Quick Go (빠른 시작)

1. 홈 화면에서 **Quick Go** 선택
2. 보드 크기 선택: 9×9 (초보), 13×13 (중급), 19×19 (표준)
3. 난이도 선택 → 게임 시작

### 4.2 대국 조작

| 조작 | 설명 |
|------|------|
| **탭 (Tap)** | 착수할 위치 미리보기 (반투명 돌 표시) |
| **확인 (Confirm)** | 미리보기 위치에 착수 확정 |
| **패스 (Pass)** | 차례 넘기기 |
| **기권 (Resign)** | 게임 포기 |

Tap-Preview-Confirm 방식으로 오조작을 방지한다.

### 4.3 AI 대국

- **플레이어**: 흑(B) — 사용자
- **AI**: 백(W) — KataGo (200 visits) 또는 랜덤 폴백
- AI가 착수하면 약 0.4초 후 자동으로 응수

KataGo가 Ready 상태가 아니면 가중 랜덤 AI로 자동 폴백한다 (3선/4선 선호 가중치).

### 4.4 실시간 분석

대국 중 매 수마다 KataGo 분석이 자동 실행된다:

- **상위 5개 후보 수** 표시 (정책망 확률)
- **승률** (흑/백 각각)
- **점수 리드** (목 단위)
- **SVG 오버레이**로 바둑판 위에 시각화

### 4.5 설명 티어

Settings에서 설명 수준을 선택할 수 있다:

| 티어 | 대상 | 설명 내용 |
|------|------|----------|
| **Beginner** | 30급~15급 | "이 수는 좋은 수입니다" 수준의 간단한 평가 |
| **Intermediate** | 15급~5단 | 승률 변화, 최선수와의 비교, 영역 분석 |
| **Advanced** | 5단~ | PV 전체, 정책 확률, LCB, 수치 상세 |

---

## 5. KataGo 업데이트

### 자동 업데이트

```bash
# 터미널에서
cd baduk-AgenticWorkflow/app
bash scripts/auto-update-katago.sh

# Claude Code에서
/play
```

스크립트가 수행하는 작업:
1. 현재 설치된 KataGo 버전 확인
2. GitHub API로 최신 릴리스 태그 조회
3. 버전 비교 → 새 버전이면 다운로드
4. macOS Metal aarch64 ZIP에서 바이너리 추출
5. `src-tauri/binaries/`에 복사 + `chmod +x`
6. 새 모델이 동봉된 경우 함께 업데이트
7. Tauri 앱 재빌드 + `/Applications/`에 설치
8. 앱 실행

### 수동 업데이트

1. [KataGo Releases](https://github.com/lightvector/KataGo/releases)에서 최신 버전 다운로드
2. `katago-vX.X.X-metal-macos-aarch64.zip` 선택
3. 압축 해제 → `katago` 바이너리를 `src-tauri/binaries/katago-aarch64-apple-darwin`에 복사
4. `chmod +x` 실행
5. `npx tauri build`로 재빌드

### 버전 확인

```bash
# 바이너리 직접 확인
./src-tauri/binaries/katago-aarch64-apple-darwin version

# 앱 내에서
# Settings > About 에서 KataGo 버전 표시
```

---

## 6. 설정

### 6.1 게임 설정

| 항목 | 옵션 | 기본값 |
|------|------|--------|
| 보드 크기 | 9×9, 13×13, 19×19 | 19×19 |
| 코미 | 0.5~9.5 (0.5 단위) | 7.5 |
| 규칙 | Tromp-Taylor | Tromp-Taylor |
| 모드 | vs-AI, vs-Human | vs-AI |

### 6.2 AI 설정

| 항목 | 설명 | 기본값 |
|------|------|--------|
| 방문 횟수 (visits) | 높을수록 강하지만 느림 | 200 |
| GPU 백엔드 | Metal (Apple Silicon) | 자동 감지 |

### 6.3 언어 설정

| 언어 | 코드 |
|------|------|
| 한국어 | ko |
| English | en |
| 日本語 | ja |

시스템 언어를 자동 감지하며, Settings에서 수동 변경 가능.

---

## 7. 개발 가이드

### 7.1 프로젝트 구조

```
app/
├── src/                          React + TypeScript 프론트엔드
│   ├── core/                     공유 인터페이스 (Layer 0)
│   ├── rules-engine/             Tromp-Taylor 규칙 (Layer 2)
│   ├── explanation-engine/       3-tier 설명 (Layer 2)
│   ├── katago-bridge/            KataGo IPC (Layer 2)
│   ├── game-engine/              Zustand 상태 관리 (Layer 3)
│   ├── board-ui/                 SVG 바둑판 (Layer 4)
│   ├── hooks/                    useAiOpponent, useKataGoAnalysis
│   ├── screens/                  6개 화면
│   ├── features/                 Quick Go, 게이미피케이션
│   ├── i18n/                     다국어 (en/ko/ja)
│   └── components/               공통 UI 컴포넌트
├── src-tauri/                    Rust 백엔드
│   ├── src/
│   │   ├── lib.rs                앱 진입점 (29개 명령 등록)
│   │   ├── katago.rs             KataGoProcess 타입 + 유틸리티
│   │   ├── db.rs                 SQLite 초기화 + 마이그레이션
│   │   └── commands/             7개 모듈, 29개 Tauri 명령
│   ├── binaries/                 KataGo 사이드카 바이너리 (gitignored)
│   └── resources/                설정 + 모델 파일 (gitignored)
├── scripts/
│   └── auto-update-katago.sh     KataGo 자동 업데이트
└── package.json
```

### 7.2 개발 명령어

```bash
# 개발 서버 (HMR)
npx tauri dev

# 타입 체크
npm run type-check

# 테스트
npm run test              # 1회 실행
npm run test:watch        # 워치 모드

# 린팅 + 포매팅
npm run lint              # 검사
npm run lint:fix          # 자동 수정
npm run format            # 포매팅

# 프로덕션 빌드
npx tauri build
```

### 7.3 Tauri 명령 추가 가이드

1. `src-tauri/src/commands/` 에 해당 모듈 파일에 함수 추가
2. `#[tauri::command]` 어트리뷰트 적용
3. `src-tauri/src/lib.rs`의 `invoke_handler`에 등록
4. 프론트엔드에서 `invoke('command_name', { params })` 호출

### 7.4 테스트

| 영역 | 프레임워크 | 실행 |
|------|-----------|------|
| 프론트엔드 단위 | Vitest + jsdom | `npm run test` |
| 규칙 엔진 | Vitest | `npm run test` (130+ 케이스) |
| 설명 엔진 | Vitest | `npm run test` |
| Rust 백엔드 | cargo test | `cd src-tauri && cargo test` |

---

## 8. 문제 해결 (Troubleshooting)

### KataGo가 오프라인으로 표시됨

**증상**: AI Analysis가 "Offline"으로 표시, AI가 랜덤으로 플레이

**해결**:
1. KataGo 바이너리 존재 확인: `ls -la src-tauri/binaries/katago-aarch64-apple-darwin`
2. 실행 권한 확인: `chmod +x src-tauri/binaries/katago-aarch64-apple-darwin`
3. 모델 파일 확인: `ls -la src-tauri/resources/models/default-model.bin.gz`
4. 직접 실행 테스트: `./src-tauri/binaries/katago-aarch64-apple-darwin version`
5. 재빌드: `npx tauri build`

### AI가 너무 약함

**증상**: KataGo Ready인데 AI가 초보 수준으로 플레이

**원인**: AI 대국 훅이 KataGo 분석 대신 랜덤 폴백을 사용 중

**해결**:
1. KataGo 상태 확인 (앱 내 상태 표시)
2. 콘솔 로그에서 `tryKataGoMove` 에러 확인
3. KataGo가 `Ready` 또는 `Analyzing` 상태인지 확인

### 빌드 실패

**증상**: `npx tauri build` 에러

**해결**:
```bash
# Rust 툴체인 업데이트
rustup update stable

# node_modules 재설치
rm -rf node_modules && npm install

# Cargo 캐시 정리
cd src-tauri && cargo clean && cd ..

# 재빌드
npx tauri build
```

### GitHub API 접근 실패

**증상**: 자동 업데이트 스크립트에서 "GitHub API 접근 실패"

**해결**: 네트워크 연결 확인. 오프라인 환경에서는 현재 버전으로 바로 앱을 실행한다.

---

## 9. Slash Commands

Claude Code에서 사용할 수 있는 명령어:

| 명령 | 설명 |
|------|------|
| `/play` | KataGo 자동 업데이트 + 앱 빌드 + 실행 |
| `/install` | Hook 인프라 검증 |
| `/maintenance` | 건강 검진 + doc-code 동기화 |

---

## 10. 파일 위치 요약

| 항목 | 경로 |
|------|------|
| 앱 바이너리 | `/Applications/Baduk.app` |
| 게임 DB | `~/Library/Application Support/com.baduk.app/baduk.db` |
| KataGo 바이너리 (소스) | `app/src-tauri/binaries/katago-aarch64-apple-darwin` |
| KataGo 모델 (소스) | `app/src-tauri/resources/models/default-model.bin.gz` |
| KataGo 설정 | `app/src-tauri/resources/katago-config.cfg` |
| i18n 번역 파일 | `app/src/i18n/locales/{en,ko,ja}.json` |

---

**Built with [AgenticWorkflow](https://github.com/idoforgod/AgenticWorkflow)** — AI 에이전트 워크플로우 자동화 프레임워크
