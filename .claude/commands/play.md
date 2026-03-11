# /play — Baduk 자동 업데이트 + 게임 시작

KataGo 최신 버전을 확인하고, 업데이트가 있으면 자동 적용 후 게임을 시작합니다.

## 실행 순서

1. **현재 KataGo 버전 확인**: `app/src-tauri/binaries/katago-aarch64-apple-darwin` 버전 확인
2. **GitHub 최신 릴리스 확인**: `lightvector/KataGo` 최신 태그와 비교
3. **업데이트 필요 시**: macOS Metal aarch64 ZIP 다운로드 → 바이너리 교체 → `chmod +x`
4. **빌드**: `npx tauri build` (업데이트가 있었을 때만)
5. **설치 + 실행**: `/Applications/Baduk.app`에 복사 후 실행

## 자동 실행 명령어

다음 스크립트를 Bash 도구로 실행하세요:

```bash
cd /Users/cys/Desktop/AIagentsAutomation/baduk-AgenticWorkflow/app && bash scripts/auto-update-katago.sh
```

## 주의사항

- 네트워크 접속 불가 시 현재 버전으로 바로 게임 시작
- 빌드는 업데이트가 있을 때만 수행 (약 30초)
- 이미 최신이면 바로 앱 실행
