---
name: start
description: "시작" 명령 스마트 라우터. 사용자가 "시작하자", "시작", "start", "시작하라", "작업을 시작하자", "워크플로우를 시작하자" 등 시작을 알리는 명령어를 입력하면, 등록된 워크플로우를 찾아 진입점으로 안내하고 사용자 모드를 설정합니다.
---

# Start — 스마트 워크플로우 라우터

> **Purpose**: 자연어 "시작" 명령을 인식하여, 등록된 워크플로우의 진입점으로 안내하고 사용자 모드를 설정하는 스마트 라우터.

## Trigger Patterns

다음 패턴 중 하나라도 매칭되면 이 스킬이 활성화됩니다:
- "시작하자", "시작", "시작하라", "시작해", "시작해줘"
- "start", "let's start", "begin"
- "워크플로우를 시작하자", "작업을 시작하자"
- "워크플로우 시작", "작업 시작"

## Execution Protocol

### Step 1: 워크플로우 레지스트리 로드

`.claude/skills/start/references/workflows.yaml`를 Read tool로 읽어 등록된 워크플로우 목록을 확인합니다.

### Step 2: 워크플로우 선택 (라우팅)

| 조건 | 동작 |
|------|------|
| 등록된 워크플로우가 1개 | 해당 워크플로우로 직접 진입 |
| 등록된 워크플로우가 2개 이상 | 사용자에게 선택지 제시 |
| 등록된 워크플로우가 0개 | "등록된 워크플로우가 없습니다. `/workflow-generator`로 먼저 워크플로우를 생성하세요." 안내 |
| 사용자가 특정 워크플로우 이름을 언급 | 해당 워크플로우로 직접 진입 |

**워크플로우 선택 프롬프트** (2개 이상일 때):

```
어떤 워크플로우를 시작하시겠습니까?

  1. [워크플로우 이름] — [설명]
  2. [워크플로우 이름] — [설명]
  ...

번호를 입력하세요:
```

### Step 3: 라우팅 분기

선택된 워크플로우의 `entry_skill` 필드를 확인하여 분기합니다.

#### 경로 A: `entry_skill`이 있는 경우 (직접 스킬 라우팅)

워크플로우에 `entry_skill`이 정의되어 있으면, 해당 스킬로 **직접 핸드오프**합니다.

1. 사용자에게 진입 안내 메시지 표시:
   ```
   [{workflow-name}] 시작합니다.
   ```
2. `entry_skill`에 명시된 스킬(예: `/play`)을 Skill tool로 호출
3. 스킬이 자체적으로 초기화 및 실행을 처리

> 이 경로에서는 SOT 초기화, 사용자 모드 선택, workflow-executor 위임을 **생략**합니다.
> entry_skill이 자체적으로 필요한 초기화를 수행합니다.

#### 경로 B: `entry_skill`이 없는 경우 (워크플로우 실행 파이프라인)

기존 워크플로우 실행 흐름을 따릅니다:

1. **사용자 모드 안내**: `.claude/skills/start/references/user-mode-guide.md`를 Read tool로 읽어 출력
2. **모드 선택 대기**: 사용자의 명시적 선택을 받음
3. **SOT 초기화**: 아래 템플릿으로 `.claude/state.yaml` 생성
4. **워크플로우 진입**: `workflow-executor` 스킬에 위임

**SOT 초기화 템플릿**:

```yaml
workflow:
  name: "{workflow-id}"
  current_step: 1
  status: "in_progress"
  user_mode: "{selected-mode}"  # autopilot | interactive | guided
  outputs: {}
  pending_human_action:
    step: null
    options: []
  active_team: null
  completed_teams: []
  autopilot:
    enabled: {true if autopilot mode}
    mode: "{partial | full}"
    manual_gates: []
    auto_approve_threshold: 70
    decision_log_dir: "autopilot-logs/"
    auto_approved_steps: []
  pacs:
    current_step_score: 0
    dimensions: { F: 0, C: 0, L: 0 }
    history: {}
  verification:
    last_verified_step: 0
    retries: {}
```

### Step 4: 핸드오프 확인

워크플로우 초기화가 완료되면:

- **경로 A**: entry_skill 호출 결과를 사용자에게 전달
- **경로 B**: `workflow-executor` 스킬을 호출하여 Step 1부터 실행 시작

## 라우팅 흐름도

```
사용자: "시작하자"
    │
    ▼
[Start 스킬 활성화]
    │
    ▼
[workflows.yaml 로드]
    │
    ├─ 0개 → "워크플로우 없음" 안내
    ├─ 1개 → 해당 워크플로우 선택
    └─ 2개+ → 사용자에게 선택지 제시
    │
    ▼
[entry_skill 확인]
    │
    ├─ 있음 (예: "play")
    │   → 진입 안내 → /play 스킬 호출
    │
    └─ 없음
        → 사용자 모드 안내 → 모드 선택
        → SOT 초기화 → workflow-executor 위임
```

## NEVER DO

- NEVER skip the workflow registry — 등록되지 않은 워크플로우로 라우팅 금지
- NEVER bypass entry_skill routing — entry_skill이 있으면 반드시 해당 스킬로 라우팅
- NEVER show user mode guide for entry_skill workflows — 경로 A에서는 모드 선택 불필요
- NEVER initialize SOT without user mode selection in Path B — 경로 B에서 모드 미선택 상태에서 진행 금지
