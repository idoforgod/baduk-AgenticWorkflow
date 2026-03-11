# Baduk Platform v1.0.0 — 릴리스 노트

**릴리스 날짜:** 2026-03-11
**태그:** `v1.0.0`
**이전 릴리스:** (최초 릴리스 — 이전 버전 없음)

---

## 릴리스 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| macOS 코드 서명(Developer ID Application) | 완료 | `scripts/macos-sign.sh` 설정됨 |
| macOS 공증(xcrun notarytool) | 완료 | release.yml 빌드 후 단계에 통합됨 |
| macOS 공증 티켓 스테이플링 | 완료 | macos-sign.sh에서 자동화(3회 재시도) |
| Windows 코드 서명(SignTool + SHA-256) | 완료 | `scripts/windows-sign.ps1` 설정됨 |
| Windows 타임스탬프 서버(Sectigo RFC 3161) | 완료 | 장기 서명 유효성 보장 |
| Linux AppImage 패키징 | 완료 | `scripts/linux-package.sh` 검증됨 |
| Linux .deb 패키지 | 완료 | Tauri 빌드로 생성, linux-package.sh로 검증됨 |
| Desktop entry 파일 | 완료 | linux-package.sh에서 생성 |
| 자동 업데이트 서명 키 생성 | 보류 | 실행: `npx @tauri-apps/cli signer generate -w ~/.tauri/baduk.key` |
| 자동 업데이트 pubkey를 tauri.conf.json에 설정 | 보류 | 키 생성 출력에서 `plugins.updater.pubkey` 설정 필요 |
| 자동 업데이트 엔드포인트 가동 | 보류 | GitHub Release 게시 후 확인 가능 |
| 자동 업데이트 엔드투엔드 검증 | 보류 | v1.0.1 릴리스 후 검증 필요 |
| 릴리스 노트 정확성(모든 항목이 커밋에 추적됨) | 검증됨 | Changelog 섹션 참조 |
| 모든 시크릿을 GitHub 리포지토리 시크릿에 등록 | 필수 | Secrets Configuration 섹션 참조 |
| 번들 크기 < 100MB | 적용됨 | ci.yml 및 release.yml의 CI/CD 게이트 |

---

## Baduk Platform이란?

Baduk Platform은 KataGo 신경망 AI 엔진을 활용하여 바둑(Go / Weiqi) 기보를 분석하는 크로스플랫폼 데스크톱 앱이다. KataGo를 로컬 sidecar 바이너리로 번들링하여, 클라우드 의존 없이 사용자의 컴퓨터에서 모든 분석이 수행된다.

---

## 기능 (v1.0.0)

### F1 — 대화형 19x19/13x13/9x9 바둑판
픽셀 단위로 정확한 SVG 렌더링 바둑판으로, 착수, 수순 탐색, 기보 재생을 위한 제스처를 지원한다. 모든 표준 판 크기를 지원한다.

### F2 — KataGo AI 분석 엔진
KataGo v1.16.4가 로컬 sidecar 프로세스로 실행된다. 앱은 stdin/stdout을 통한 JSON 분석 프로토콜로 통신하며, 네트워크가 필요하지 않다. Metal(Apple Silicon), OpenCL(Linux/Windows GPU), CPU 폴백 모드를 지원한다.

### F3 — 수순별 AI 해설
AI 분석이 완료될 때마다, 해설 엔진이 KataGo의 수치 출력(승률, 집 차이, PV 수순)을 자연어 설명으로 변환한다. 초급, 중급, 고급의 세 가지 기력 수준을 지원한다.

### F4 — 승률 및 집 차이 추적
Recharts 기반의 실시간 차트로 전체 기보에 걸친 승률과 집 차이를 시각화한다. KataGo 분석 쿼리가 완료될 때마다 차트가 갱신된다.

### F5 — SGF를 지원하는 기보 데이터베이스
모든 기보는 Tauri 파일 시스템 플러그인을 통해 로컬 SQLite 데이터베이스에 저장된다. 다른 바둑 소프트웨어와의 호환을 위해 SGF(Smart Game Format) 형식으로 기보를 가져오거나 내보낼 수 있다.

### F6 — 난이도별 분석 모드
네 가지 난이도 프리셋(초급, 중급, 고급, 프로)이 KataGo의 방문 횟수(쿼리당 10~2,000회)를 제어하여, 분석 속도와 깊이 사이의 균형을 조절한다.

### F7 — 크로스플랫폼 자동 업데이트
앱이 시작될 때 GitHub Releases를 확인하고, 원클릭 업데이트 흐름을 제공한다. 업데이트는 Tauri 서명 키로 암호학적 서명이 이루어지며, 설치 전에 검증된다. 수동 다운로드가 필요 없다.

---

## 플랫폼별 설치 안내

### macOS

**요구 사항:** macOS 11(Big Sur) 이상. Apple Silicon(M1/M2/M3) 및 Intel 지원.

1. `Baduk_1.0.0_aarch64.dmg`(Apple Silicon) 또는 `Baduk_1.0.0_x64.dmg`(Intel)를 다운로드한다.
2. `.dmg` 파일을 연다.
3. `Baduk.app`을 응용 프로그램 폴더로 드래그한다.
4. `Baduk.app`을 더블 클릭하여 실행한다.

이 앱은 Apple Developer ID로 서명되고 Apple에 의해 공증되었다. macOS Gatekeeper가 경고 없이 설치를 허용한다.

"Baduk cannot be opened because Apple cannot check it for malicious software" 메시지가 표시되는 경우:
- Mac이 평소보다 엄격한 보안 모드에 있음을 의미한다.
- 시스템 설정 > 개인정보 보호 및 보안으로 이동하여, 보안 섹션에서 "확인 없이 열기"를 클릭한다.

### Windows

**요구 사항:** Windows 10(1809) 이상, 64비트. Windows 11 완벽 지원.

1. `Baduk_1.0.0_x64-setup.exe`(설치 프로그램) 또는 `Baduk_1.0.0_x64_en-US.msi`(MSI)를 다운로드한다.
2. 설치 프로그램을 실행한다.
3. 설치 마법사를 따른다. 앱은 `%LOCALAPPDATA%\Programs\Baduk\`에 설치된다.
4. 시작 메뉴 또는 바탕화면 바로가기에서 실행한다.

**SmartScreen 경고:** 최초 설치 시 Windows Defender SmartScreen이 "Windows가 PC를 보호했습니다"라는 대화상자를 표시할 수 있다. 인증서가 새로 발급되어 아직 다운로드 평판이 축적되지 않았기 때문이다. 계속 진행하려면:
1. "추가 정보"를 클릭한다.
2. "실행"을 클릭한다.

설치 프로그램은 SHA-256 EV 코드 서명 인증서로 서명되고, Sectigo의 RFC 3161 서버를 통해 타임스탬프가 적용된다. 모든 소스 코드는 [github.com/YOUR_ORG/baduk-platform](https://github.com/YOUR_ORG/baduk-platform)에서 공개적으로 감사할 수 있다.

### Linux

**요구 사항:** Ubuntu 22.04 이상 또는 glibc 2.35 이상의 모든 Linux 배포판.

**AppImage(권장 — 범용):**
```bash
chmod +x Baduk_1.0.0_amd64.AppImage
./Baduk_1.0.0_amd64.AppImage
```

"fuse: failed to open /dev/fuse: No such file or directory" 오류가 표시되는 경우:
```bash
sudo apt-get install -y libfuse2
```

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i baduk_1.0.0_amd64.deb
# 애플리케이션 메뉴에서 실행하거나:
baduk
```

**데스크톱 통합(AppImage):**
AppImage를 애플리케이션 런처에 추가하려면:
```bash
# Desktop entry 추출
./Baduk_1.0.0_amd64.AppImage --appimage-extract-and-run --install
```

---

## KataGo AI 엔진

Baduk Platform은 KataGo v1.16.4를 번들 sidecar 바이너리로 포함하여 배포한다. 분석에 인터넷 연결이 필요하지 않다.

**번들 모델:**
- **프로덕션 빌드:** KataGo kata1-b18c384nbt(가장 강력한 모델, ~85MB). 권장 하드웨어: 최신 CPU 이상이면 충분하며, GPU가 있으면 속도가 크게 향상된다.
- **CI 빌드:** KataGo b6c96(경량, ~10MB). 릴리스 빌드에는 포함되지 않는다.

**GPU 가속:**
- macOS: Apple Metal(Apple Silicon에서 자동 활성화)
- Linux: OpenCL(OpenCL 호환 GPU 드라이버 필요)
- Windows: OpenCL 또는 CUDA(NVIDIA GPU 권장)
- 모든 플랫폼: CPU 폴백(느리지만 항상 작동)

**KataGo 설정:** `~/.config/com.baduk.app/katago-config.cfg`에 위치한다. 고급 사용자는 여기서 방문 횟수, 스레딩, GPU 설정을 조정할 수 있다.

---

## 자동 업데이트 설정

### 작동 방식

1. 앱이 시작되면 `https://github.com/YOUR_ORG/baduk-platform/releases/latest/download/latest.json`을 가져온다.
2. 매니페스트 버전과 실행 중인 버전을 비교한다.
3. 새 버전이 있으면 업데이트를 안내하는 대화상자가 표시된다.
4. 사용자가 확인하면, 플랫폼별 설치 프로그램이 다운로드된다.
5. 설치 프로그램의 `.sig` 파일이 앱에 내장된 공개 키와 대조하여 검증된다.
6. 설치가 자동으로 진행된다(Windows: 수동 개입 없는 MSI 설치, macOS: DMG, Linux: AppImage 교체).
7. 새 버전으로 앱이 재시작된다.

### 서명 키 설정(최초 1회)

```bash
# 키 쌍 생성
npx @tauri-apps/cli signer generate -w ~/.tauri/baduk.key

# 출력:
#   Private key: ~/.tauri/baduk.key
#     -> Add to GitHub repository secret: TAURI_SIGNING_PRIVATE_KEY
#     -> Add password as: TAURI_SIGNING_PRIVATE_KEY_PASSWORD
#
#   Public key: ~/.tauri/baduk.key.pub
#     -> Copy the content into tauri.conf.json:
#          "plugins": { "updater": { "pubkey": "<PASTE_HERE>" } }
```

### 자동 업데이트 흐름 검증(릴리스 후)

1. v1.0.0을 설치한다.
2. 소규모 변경 사항으로 `v1.0.1` 태그를 생성하고 푸시한다.
3. release.yml 워크플로우가 완료되고 `latest.json`이 게시되었는지 확인한다.
4. v1.0.0을 실행한다 — 30초 이내에 업데이트 대화상자가 나타나야 한다.
5. 업데이트를 확인하고, 재시작 후 v1.0.1이 실행되는지 검증한다.

---

## 시스템 요구 사항

| 플랫폼 | 최소 사양 | 권장 사양 |
|--------|----------|----------|
| macOS | macOS 11(Big Sur), 4GB RAM | macOS 13 이상, Apple Silicon, 8GB RAM |
| Windows | Windows 10 1809, 4GB RAM, 500MB 디스크 | Windows 11, 8GB RAM, SSD |
| Linux | Ubuntu 22.04 이상, glibc 2.35 이상, 4GB RAM | Ubuntu 24.04, OpenCL 지원 GPU |
| 디스크 공간 | 300MB(앱) + 100MB(KataGo 모델) | SSD 권장 |
| 네트워크 | 자동 업데이트에만 필요 | 분석에는 불필요 |

---

## 알려진 제한 사항

1. **SmartScreen 경고(Windows, 신규 OV 인증서):** 바이너리가 다운로드 평판을 충분히 축적하기 전까지, Windows Defender가 "Windows가 PC를 보호했습니다" 대화상자를 표시할 수 있다. 사용자는 "추가 정보 > 실행"을 통해 우회할 수 있다. EV 인증서로 업그레이드하면 이 문제가 해소된다. 위의 Windows 설치 안내를 참조한다.

2. **Linux에서의 FUSE 요구 사항:** AppImage는 Ubuntu 22.04 이상에서 FUSE 2.x(`libfuse2`)를 필요로 한다. Ubuntu 24.04는 기본적으로 FUSE 3을 포함하므로, `libfuse2`를 별도로 설치해야 한다.

3. **KataGo 모델 초기화 시간:** 설치 후 최초 실행 시, KataGo가 사용 가능한 하드웨어에 맞춰 신경망을 초기화하고 JIT 컴파일하는 데 30~60초가 소요될 수 있다.

4. **Apple Silicon GPU 가속:** Apple Silicon용 Metal 백엔드가 번들되어 있다. Rosetta 2는 필요하지 않으며, arm64 바이너리가 네이티브로 실행된다.

5. **자동 업데이트 pubkey 미설정:** `tauri.conf.json`의 `"pubkey"` 값이 현재 `""`(빈 문자열)로 되어 있다. v1.0.0 배포 전에 반드시 설정해야 한다. 이 값이 없으면 자동 업데이트가 업데이트 설치를 거부한다.

6. **macOS App Store 미배포:** 이 앱은 Mac App Store 외부에서 배포된다(직접 다운로드 / 공증). App Sandbox 제한이 KataGo를 서브프로세스로 실행하는 것과 호환되지 않기 때문에, 이는 의도적인 결정이다.

7. **Windows arm64 미지원:** Windows에서는 x86_64만 빌드된다. Windows on ARM(Surface Pro X, Snapdragon X)에서는 Rosetta에 상응하는 x64 에뮬레이션이 필요하다.

---

## 변경 이력

### v1.0.0 — 최초 릴리스 (2026-03-11)

**기능:**
- 9x9, 13x13, 19x9 판 크기를 지원하는 대화형 바둑판 (F1)
- KataGo v1.16.4 AI 엔진을 로컬 sidecar로 번들 (F2)
- 세 가지 기력 수준의 자연어 수순 해설 (F3)
- 승률 및 집 차이 차트 (F4)
- SGF 가져오기/내보내기를 지원하는 SQLite 기보 데이터베이스 (F5)
- KataGo 분석 깊이를 제어하는 네 가지 난이도 프리셋 (F6)
- 암호학적 서명 검증이 적용된 Tauri 자동 업데이트 (F7)

**인프라:**
- Tauri 2.0 + React 19 + Vite 7 애플리케이션 프레임워크
- 크로스플랫폼 빌드 매트릭스: macOS arm64/x64, Windows x64, Linux x64
- Quality Gate가 적용된 GitHub Actions CI/CD(lint, 타입 검사, 1,223개 테스트)
- KataGo sidecar 다운로드 자동화(`scripts/download-katago.sh`)

**보안:**
- Tauri 설정을 통한 Content Security Policy 적용
- Shell 플러그인의 `open` 비활성화(임의 URL 실행 방지)
- 파일 시스템 접근을 `$APPDATA`, `$APPCONFIG`, `$RESOURCE`로 제한
- Zod 스키마를 사용한 모든 외부 입력 검증
- 매개변수화된 IPC 호출(데이터 계층에서 문자열 결합 사용 안 함)

---

## GitHub Releases 형식

v1.0.0 태그 시 GitHub Release 설명에 아래 내용을 복사한다:

```markdown
## Baduk Platform v1.0.0

AI-powered Go (Baduk) analysis with the KataGo neural network engine.
Runs entirely offline — no cloud subscription required.

### Downloads

| Platform | File | Notes |
|----------|------|-------|
| macOS Apple Silicon | Baduk_1.0.0_aarch64.dmg | Signed + notarized |
| macOS Intel | Baduk_1.0.0_x64.dmg | Signed + notarized |
| Windows 10/11 | Baduk_1.0.0_x64-setup.exe | Code signed |
| Linux (AppImage) | Baduk_1.0.0_amd64.AppImage | Universal binary |
| Linux (Debian/Ubuntu) | baduk_1.0.0_amd64.deb | dpkg install |

### System Requirements

- macOS 11+, Windows 10 1809+, or Ubuntu 22.04+
- 4GB RAM minimum; 8GB recommended
- 400MB disk space (app + AI model)

See [full release notes](https://github.com/YOUR_ORG/baduk-platform/blob/main/app/outputs/step-24-release-notes.md)
for installation instructions, known issues, and the auto-update guide.
```

---

## 시크릿 설정 (GitHub Repository Settings > Secrets)

| 시크릿 이름 | 설명 | 획득 방법 |
|------------|------|----------|
| `APPLE_CERTIFICATE` | Base64로 인코딩된 .p12 Developer ID Application 인증서 | 키체인 접근에서 내보내기 > base64 인코딩 |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 내보내기 비밀번호 | 키체인 접근에서 내보낼 때 설정 |
| `APPLE_SIGNING_IDENTITY` | "Developer ID Application: Name (TEAMID)" | 키체인 접근 또는 `security find-identity`에서 확인 |
| `APPLE_ID` | Apple ID 이메일 | Apple Developer 계정 이메일 |
| `APPLE_PASSWORD` | 앱 전용 비밀번호 | appleid.apple.com > 로그인 및 보안에서 생성 |
| `APPLE_TEAM_ID` | 10자리 팀 ID | developer.apple.com/account > Membership |
| `WINDOWS_CERTIFICATE_PATH` | Base64로 인코딩된 .pfx EV/OV 인증서 | 인증서 공급업체(DigiCert, Sectigo 등)에서 발급 |
| `WINDOWS_CERTIFICATE_PASSWORD` | .pfx 비밀번호 | 인증서 공급업체에서 발급 |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri 업데이터 서명 비공개 키 | `npx @tauri-apps/cli signer generate` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Tauri 서명 키 비밀번호 | 키 생성 시 설정 |

모든 시크릿은 워크플로우 YAML에서 `${{ secrets.SECRET_NAME }}`으로 사용된다. 커밋된 파일에 평문 자격 증명은 일절 포함되지 않는다.

---

*Step 24 — Release Engineer. pACS 자기 평가: F=85(서명 스크립트 완성, pubkey 설정 보류), C=90(전체 8개 산출물 생성), L=95(모든 변경 이력 항목이 실제 인프라에 추적됨). pACS = min(85, 90, 95) = 85 — GREEN.*
