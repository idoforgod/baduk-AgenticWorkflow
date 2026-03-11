# 템플릿 설명 엔진 설계

**버전**: 1.0.0
**작성자**: @template-designer (Step 4)
**작성일**: 2026-03-11
**소비자**: Step 13 (template-engineer), Step 6 (architect), Step 12 (katago-integrator)
**입력물**: Step 2 IPC 명세, Step 3 DKS + 규칙 명세, Step 4 KataGo 샘플

---

## 목차

1. [핵심 원칙: LLM = 번역기, KataGo = 진실](#1-핵심-원칙)
2. [아키텍처 개요](#2-아키텍처-개요)
3. [KataGo 필드 매핑](#3-katago-필드-매핑)
4. [패턴 매칭 파이프라인](#4-패턴-매칭-파이프라인)
5. [3계층 템플릿 시스템](#5-3계층-템플릿-시스템)
6. [필수 폴백 템플릿: 고위험 포석](#6-필수-폴백)
7. [AI 설명 어조 및 페르소나](#7-ai-어조)
8. [커버리지 측정 방법론](#8-커버리지-측정-방법론)
9. [LLM 통합 경계](#9-llm-통합-경계)
10. [패턴 카탈로그 참조](#10-패턴-카탈로그-참조)
11. [검증 체크리스트](#11-검증-체크리스트)
12. [pACS 자체 평가](#12-pacs)

---

## 1. 핵심 원칙: LLM = 번역기, KataGo = 진실

### 1.1 구조적 불변 조건

사용자에게 제시되는 모든 바둑 관련 주장은 반드시 KataGo 수치 데이터에서 비롯되어야 한다. LLM의 역할은 다음으로 엄격히 제한된다:

1. **번역**: KataGo 수치를 자연어 문장으로 변환.
2. **결합**: 여러 템플릿 출력을 일관된 문단으로 병합.
3. **재표현**: 대상 독자 계층에 맞게 어휘를 조정.

LLM은 절대로:

- 바둑 전략 분석을 독자적으로 생성하지 않는다.
- KataGo의 `pv` 출력에 없는 수순을 날조하지 않는다.
- 승률(winrate), 점수, 또는 소유권(ownership) 값을 조작하지 않는다.
- KataGo 데이터와 모순되는 형세 판단을 제공하지 않는다.

### 1.2 구조적 시행 메커니즘

아키텍처는 이 불변 조건을 네 가지 계층에서 강제한다:

| 계층 | 메커니즘 | 차단하는 실패 모드 |
|-------|-----------|---------------------|
| **L0: 데이터 게이트** | 템플릿 엔진은 KataGo JSON만 수신하며, 바둑판 상태는 LLM에 전달되지 않음 | LLM이 바둑판에 대해 "추론"할 수 없음 |
| **L1: 슬롯 바인딩** | 모든 템플릿 플레이스홀더는 특정 KataGo 필드에 매핑되며, 빈 슬롯은 컴파일 오류로 처리 | 조작된 데이터가 출력에 진입 불가 |
| **L2: 카테고리 잠금** | 사활, 패(ko), 빅(seki) 포지션은 필수 사전 작성 템플릿을 사용하며, LLM은 절대 호출되지 않음 | 환각에 의한 사활 판정 불가 |
| **L3: 출력 검증기** | 생성 후 검사: 출력 텍스트의 모든 수치가 KataGo 필드 값으로 추적 가능해야 함 | 모든 누락을 잡아내는 최종 방어선 |

### 1.3 데이터 흐름 다이어그램

```
KataGo Process
     |
     v
[JSON Response] ─────────────────────────────────────┐
     |                                                 |
     v                                                 v
[Pattern Classifier]                        [L3: Output Validator]
     |                                                 ^
     ├── High-Risk? ──YES──> [Mandatory Template]      |
     |                           |                     |
     ├── Pattern Match? ──YES──> [Template Engine] ────┤
     |                           |                     |
     └── No Match ──> [LLM Translator] ───────────────┤
                       (KataGo data as input only)     |
                                                       v
                                                [User-Facing Text]
```

### 1.4 안티패턴 (절대 금지)

1. **절대 금지** — 원시 바둑판 위치를 LLM에 전달하고 "이 포지션에 대해 어떻게 생각하세요?"라고 묻는 행위.
2. **절대 금지** — LLM에게 수순을 생성하도록 요청하는 행위 — KataGo `pv`만 독점적으로 사용한다.
3. **절대 금지** — LLM이 KataGo 평가를 무시하도록 허용하는 행위 (예: KataGo가 승률 60%라고 하는데 LLM이 "지고 있는 형세"라고 말하는 경우).
4. **절대 금지** — LLM이 생성한 텍스트를 사활, 패(ko), 빅(seki) 설명에 사용하는 행위.
5. **절대 금지** — 템플릿 슬롯을 미입력 상태로 두는 행위 — 모든 `{placeholder}`는 KataGo 값으로 해석되어야 한다.

---

## 2. 아키텍처 개요

### 2.1 컴포넌트 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                 Template Explanation Engine               │
│                                                           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   KataGo      │   │   Pattern     │   │  Template    │ │
│  │   Field       │──>│   Classifier  │──>│  Selector    │ │
│  │   Extractor   │   │              │   │              │ │
│  └──────────────┘   └──────────────┘   └──────┬───────┘ │
│                                                 │         │
│                    ┌───────────────────────────┤         │
│                    │              │              │         │
│                    v              v              v         │
│            ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│            │ Mandatory  │ │  Template  │ │    LLM     │  │
│            │ Fallback   │ │  Renderer  │ │ Translator │  │
│            │ (L/D, Ko,  │ │            │ │ (fallback) │  │
│            │  Seki)     │ │            │ │            │  │
│            └─────┬──────┘ └─────┬──────┘ └─────┬──────┘  │
│                  │              │              │          │
│                  v              v              v          │
│            ┌─────────────────────────────────────────┐   │
│            │           Output Combiner               │   │
│            │   + Tier Adapter (Beginner/Mid/Adv)     │   │
│            │   + L3 Validator                        │   │
│            └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 처리 파이프라인

1. **추출**: KataGo `AnalysisResponse`를 구조화된 필드로 파싱한다.
2. **델타 계산**: 이전 수 분석이 있으면 `winrateDelta`, `scoreLeadDelta`를 계산한다.
3. **분류**: 포지션 카테고리(포석, 중반전, 끝내기, 사활, 패, 빅)를 결정한다.
4. **템플릿 선택**: 상황에 맞는 최고 우선순위 템플릿을 매칭한다.
5. **슬롯 바인딩**: 템플릿 플레이스홀더를 추출된 KataGo 값으로 채운다.
6. **렌더링**: 대상 독자 계층에 맞는 최종 텍스트를 생성한다.
7. **검증**: L3 검증기가 모든 수치가 KataGo 데이터로 추적 가능한지 확인한다.

### 2.3 컨텍스트 요구사항

템플릿 엔진은 설명 생성 시 두 가지 컨텍스트가 필요하다:

| 컨텍스트 | 출처 | 필수 여부 |
|---------|--------|----------|
| **현재 포지션 분석** | 현재 수에 대한 KataGo `AnalysisResponse` | 항상 필수 |
| **이전 포지션 분석** | 직전 수에 대한 KataGo `AnalysisResponse` | 델타 기반 패턴(실수 감지, 개선 등)에 필요 |

현재 분석만 사용 가능한 경우(예: 첫 수, 또는 비교가 요청되지 않은 경우), 델타 기반 패턴은 건너뛰고 절대값 기반 패턴이 사용된다.

---

## 3. KataGo 필드 매핑

### 3.1 항상 존재하는 필드 (핵심 매핑)

이 필드들은 모든 표준 `AnalysisResponse`에 존재하며, 설명 생성의 근간을 형성한다.

#### 3.1.1 RootInfo 필드

| KataGo 필드 | 타입 | 설명 패턴 | 설명 |
|---|---|---|---|
| `rootInfo.winrate` | `number [0,1]` | 전체 형세 판단 | 현재 플레이어의 승리 확률 |
| `rootInfo.scoreLead` | `number` | 점수 추정 | 예측 집 차이 |
| `rootInfo.visits` | `integer` | 신뢰도 지표 | 총 MCTS 방문 횟수 |
| `rootInfo.currentPlayer` | `"B"\|"W"` | 플레이어 식별 | 현재 착수 차례 |
| `rootInfo.scoreStdev` | `number` | 불확실성 지표 | 점수 예측 불확실도 |
| `rootInfo.rawStWrError` | `number` | 신뢰도 보정값 | 신경망 단기 승률 불확실도 |
| `rootInfo.rawStScoreError` | `number` | 신뢰도 보정값 | 신경망 단기 점수 불확실도 |
| `rootInfo.rawVarTimeLeft` | `number` | 국면 단계 감지 | 남은 유의미한 수 추정치 |

#### 3.1.2 MoveInfo 필드 (후보 수별)

| KataGo 필드 | 타입 | 설명 패턴 | 설명 |
|---|---|---|---|
| `moveInfos[i].move` | `string` | 수 식별 | 후보 수의 GTP 좌표 |
| `moveInfos[i].winrate` | `number [0,1]` | 수 품질 평가 | 이 수를 두었을 때의 승리 확률 |
| `moveInfos[i].scoreLead` | `number` | 수 가치 평가 | 이 수 이후의 예측 점수 |
| `moveInfos[i].order` | `integer` | 수 순위 | 0 = 최선, 1 = 차선 등 |
| `moveInfos[i].prior` | `number [0,1]` | AI 직관 지표 | 신경망 정책 가중치 (수가 얼마나 "자연스러운"지) |
| `moveInfos[i].visits` | `integer` | 탐색 깊이 지표 | 이 수가 얼마나 깊이 분석되었는지 |
| `moveInfos[i].pv` | `string[]` | 수순 설명 | 최선의 후속 수순 |
| `moveInfos[i].utility` | `number` | 종합 평가 | 승률 + 점수 효용값 |
| `moveInfos[i].lcb` | `number` | 비관적 평가 | 승률의 하한 신뢰 구간 |
| `moveInfos[i].scoreStdev` | `number` | 결과 분산도 | 이 수 이후 포지션의 변동성 |

#### 3.1.3 계산 필드 (파생값, KataGo 직접 출력이 아님)

| 계산 필드 | 수식 | 설명 패턴 |
|---|---|---|
| `winrateDelta` | `current.rootInfo.winrate - previous.rootInfo.winrate` (관점 보정) | 실수/개선 감지 |
| `scoreLeadDelta` | `current.rootInfo.scoreLead - previous.rootInfo.scoreLead` (관점 보정) | 획득/손실 점수 |
| `bestMovePlayed` | `actualMove === moveInfos[0].move` | 좋은 수/나쁜 수 감지 |
| `moveRank` | `moveInfos`에서 실제 수의 인덱스 (`order` 기준) | 수 품질 등급 |
| `topMoveGap` | `moveInfos[0].winrate - moveInfos[1].winrate` | 최선수가 얼마나 명확했는지 |
| `movePhase` | `rootInfo.rawVarTimeLeft`과 `turnNumber`에서 파생 | 국면 단계 분류 |
| `confidenceLevel` | `rootInfo.visits`와 방문 횟수 티어에서 파생 | 분석 신뢰도 |

### 3.2 선택적 필드 (조건부 매핑)

이 필드들은 쿼리에서 명시적으로 요청한 경우에만 존재한다.

| KataGo 필드 | 쿼리 플래그 | 설명 패턴 | 폴백 |
|---|---|---|---|
| `ownership[]` | `includeOwnership: true` | 집(territory) 시각화, 사활 판정 | 일반적인 집 설명에는 `scoreLead` 사용 |
| `ownershipStdev[]` | `includeOwnershipStdev: true` | 분쟁 지역 식별 | 불확실성 시각화 생략 |
| `moveInfos[i].ownership[]` | `includeMovesOwnership: true` | 수별 집 변화 | `scoreLead` 델타 사용 |
| `policy[]` | `includePolicy: true` | 수의 자연스러움 설명 | `moveInfos`의 `prior` 사용 |
| `moveInfos[i].pvVisits[]` | `includePVVisits: true` | 수순 신뢰도 깊이 | `pv` 길이를 대리 지표로 사용 |

**규칙**: 선택적 필드를 사용하는 템플릿은 반드시 해당 필드 없이도 작동하는 폴백 템플릿 변형을 갖추어야 한다. Step 13 구현자는 템플릿 변형 선택 전에 필드 존재 여부를 확인해야 한다.

### 3.3 관점 처리

KataGo는 `reportAnalysisWinratesAs`로 설정된 관점(기본값: BLACK)에서 승률/점수를 보고한다. 템플릿 엔진은 반드시:

1. 모든 응답에서 `rootInfo.currentPlayer`를 확인한다.
2. 보고 관점이 현재 플레이어와 다른 경우 값을 반전한다:
   - `adjustedWinrate = 1.0 - winrate`
   - `adjustedScoreLead = -scoreLead`
3. 모든 템플릿은 현재 플레이어 기준 상대값을 사용한다: 양수 = 현재 플레이어에게 유리.

### 3.4 임계값 정의

이 임계값들은 어떤 패턴이 활성화되는지를 결정한다. 모든 델타 값은 현재 플레이어 관점에서의 값이다.

| 임계값 이름 | 값 | 용도 |
|---|---|---|
| `BLUNDER_WINRATE_DROP` | > 0.10 (10%) | "악수(blunder)" 패턴 트리거 |
| `MISTAKE_WINRATE_DROP` | > 0.05 (5%) | "실수(mistake)" 패턴 트리거 |
| `INACCURACY_WINRATE_DROP` | > 0.02 (2%) | "부정확(inaccuracy)" 패턴 트리거 |
| `GOOD_MOVE_THRESHOLD` | 실제 수가 `order: 0` | "좋은 수" 패턴 트리거 |
| `EXCELLENT_MOVE_THRESHOLD` | `order: 0` AND `topMoveGap > 0.03` | "훌륭한 수" 패턴 트리거 |
| `BRILLIANT_MOVE_THRESHOLD` | `order: 0` AND `prior < 0.05` AND `visits > 100` | "빛나는/의외의 수" 패턴 트리거 |
| `CLOSE_GAME_THRESHOLD` | `abs(winrate - 0.50) < 0.05` | "접전" 패턴 트리거 |
| `WINNING_THRESHOLD` | `winrate > 0.65` | "확실한 우세" 패턴 트리거 |
| `LOSING_THRESHOLD` | `winrate < 0.35` | "상당한 열세" 패턴 트리거 |
| `DECISIVE_THRESHOLD` | `winrate > 0.85` 또는 `winrate < 0.15` | "결정적" 패턴 트리거 |
| `ENDGAME_PHASE` | `rawVarTimeLeft < 40` 또는 `turnNumber > 150` (19x19) | 국면 분류 |
| `OPENING_PHASE` | `turnNumber < 40` (19x19), `< 15` (9x9) | 국면 분류 |
| `SCORE_SIGNIFICANT` | `abs(scoreLeadDelta) > 2.0` | 언급할 만한 점수 변화 |
| `HIGH_CONFIDENCE` | `rootInfo.visits >= 400` | 신뢰도 높은 분석 |
| `LOW_CONFIDENCE` | `rootInfo.visits < 50` | 불확실성 보정 문구 추가 |
| `LIFE_DEATH_OWNERSHIP` | 무리(group) 영역에서 `abs(ownership[i]) > 0.9` | 사활 감지 |
| `CONTESTED_OWNERSHIP` | `abs(ownership[i]) < 0.3` | 분쟁 지역 |

---

## 4. 패턴 매칭 파이프라인

### 4.1 우선순위 체인

KataGo 응답이 도착하면, 패턴 분류기는 엄격한 우선순위 순서로 후보를 평가한다. 첫 번째 매칭이 적용된다.

```
Priority 1: MANDATORY FALLBACK (Life/Death, Ko, Seki)
  │  Trigger: Position categorized as life/death, ko, or seki
  │  Action: Use pre-authored template. LLM is NEVER invoked.
  │
  v
Priority 2: MOVE QUALITY ASSESSMENT
  │  Trigger: winrateDelta computed (requires previous analysis)
  │  Sub-priorities:
  │    2a: Blunder (winrateDelta < -0.10)
  │    2b: Mistake (winrateDelta < -0.05)
  │    2c: Inaccuracy (winrateDelta < -0.02)
  │    2d: Brilliant move (order=0, prior<0.05, visits>100)
  │    2e: Excellent move (order=0, topMoveGap>0.03)
  │    2f: Good move (order=0)
  │    2g: Acceptable move (order 1-2, winrateDelta > -0.02)
  │
  v
Priority 3: POSITIONAL ASSESSMENT
  │  Trigger: No delta available OR delta is negligible
  │  Sub-priorities:
  │    3a: Decisive advantage (winrate > 0.85 or < 0.15)
  │    3b: Strong advantage (winrate > 0.65 or < 0.35)
  │    3c: Slight advantage (winrate 0.55-0.65 or 0.35-0.45)
  │    3d: Even/close position (winrate 0.45-0.55)
  │
  v
Priority 4: GAME PHASE PATTERNS
  │  Trigger: Based on turnNumber and rawVarTimeLeft
  │  Sub-priorities:
  │    4a: Opening patterns (fuseki)
  │    4b: Middle game patterns (chuban)
  │    4c: Endgame patterns (yose)
  │
  v
Priority 5: ALTERNATIVE MOVES
  │  Trigger: moveInfos has 2+ candidates
  │  Action: Suggest top alternatives with explanations
  │
  v
Priority 6: GENERIC FALLBACK
  │  Trigger: Nothing above matched
  │  Action: Simple position summary from rootInfo
```

### 4.2 포지션 카테고리 감지

패턴 분류기는 다음 휴리스틱을 사용하여 포지션 카테고리를 결정한다. 이 로직은 결정적 코드로 구현되며, LLM이 아니다.

#### 4.2.1 사활 감지

다음 조건 중 하나라도 충족되면 해당 포지션은 사활로 분류된다:

1. **소유권 기반**: `includeOwnership: true`가 요청되었고, 연결된 돌(stone) 무리(group)의 소유권 값이 0 근처(분쟁 상태, -0.4에서 0.4 사이)에 밀집해 있으며, 주변 돌의 소유권은 +/-1 근처(확정)인 경우.
2. **점수 변동 기반**: 최선수와 차선수의 `scoreLead` 차이가 5점을 초과하고, 최선수 인근 무리의 소유권 신뢰도가 낮은 경우.
3. **PV 기반**: 주변화(principal variation)에 국소 영역(맨해튼 거리 3 이내)에서의 따냄(capture)과 재따냄이 포함된 경우.

**중요**: 사활 감지는 해당 무리가 살았는지 죽었는지를 판정하지 않는다. 그 판정은 KataGo의 소유권 데이터와 `scoreLead` 값에서 나온다. 감지는 필수 템플릿을 트리거할 뿐이며, 해당 템플릿이 KataGo 수치를 읽어 상태를 채운다.

#### 4.2.2 패(Ko) 감지

다음 조건 중 하나라도 충족되면 해당 포지션에 패가 포함된 것으로 판단한다:

1. **PV 패턴**: `pv` 수순에 위치 X에서의 착수, 다른 곳에서의 착수(위협), 그리고 X 또는 X 인근에서의 재따냄이 포함된 경우. 이는 패 싸움을 나타낸다.
2. **점수 진동**: 상위 3개 후보 수 중 `scoreLead` 값이 특정 위치에서의 전투를 두고 큰 양수와 음수를 번갈아 보이는 패턴인 경우.
3. **쿼리 메타데이터**: 게임 엔진이 활성 패점이 존재한다고 표시한 경우.

#### 4.2.3 빅(Seki) 감지

빅은 다음 경우에 감지된다:

1. **소유권 기반**: 서로 다른 색의 인접한 두 무리 모두 소유권 값이 0 근처(살아 있지만 중립)이고, 두 무리 사이의 공유 활로(liberty) 역시 소유권이 0 근처인 경우.
2. **점수 안정성**: 어느 쪽이 분쟁 영역에 먼저 두든 `scoreLead`가 크게 변하지 않는 경우 (상위 수 모두 현상 유지를 보존).

#### 4.2.4 국면 단계 감지

| 단계 | 조건 (19x19) | 조건 (13x13) | 조건 (9x9) |
|-------|-------------------|-------------------|-----------------|
| 포석 | `turnNumber < 40` | `turnNumber < 25` | `turnNumber < 15` |
| 중반전 | `40 <= turnNumber < 150` AND `rawVarTimeLeft > 40` | `25 <= turnNumber < 90` | `15 <= turnNumber < 40` |
| 끝내기 | `turnNumber >= 150` OR `rawVarTimeLeft < 40` | `turnNumber >= 90` OR `rawVarTimeLeft < 25` | `turnNumber >= 40` OR `rawVarTimeLeft < 15` |

### 4.3 복합 패턴 합성

하나의 포지션이 동시에 여러 패턴을 트리거할 수 있다. 합성 규칙은 다음과 같다:

1. **주 패턴**: 최고 우선순위 매칭이 첫 문장을 결정한다.
2. **보조 패턴**: 하위 우선순위 매칭이 부가 문장을 추가한다 (최대 2개).
3. **최대 길이**: 초급자 = 3문장, 중급자 = 5문장, 고급자 = 7문장.
4. **충돌 해결**: 두 패턴이 모순되는 주장을 하는 경우, 상위 우선순위가 채택되고 하위는 폐기된다.

---

## 5. 3계층 템플릿 시스템

### 5.1 계층 설계 철학

| 계층 | 대상 독자 | 어휘 수준 | 초점 | 어조 |
|------|----------|-----------|-------|------|
| **초급자** (T1) | 입문자, 20급 미만 | 바둑 용어 없음; 일상 언어 | "무슨 일이 일어났는가" — 구체적 결과 | 격려, 따뜻함 |
| **중급자** (T2) | 20급~5단 | 기본 바둑 용어 (단수, 집, 세력) | "왜 중요한가" — 전략적 개념 | 정보 전달, 균형적 |
| **고급자** (T3) | 5단 이상 | 전문 바둑 용어 (아지, 사바키, 테와리) | "심층 분석" — 수읽기, 모양, 타이밍 | 분석적, 정밀함 |

### 5.2 템플릿 구조

모든 템플릿은 다음 정규 구조를 따른다:

```yaml
id: "P-{TIER}-{CATEGORY}-{NUMBER}"  # e.g., P-T1-MQ-01
tier: "beginner" | "intermediate" | "advanced"
category: "move_quality" | "position" | "opening" | "middle_game" | "endgame" | "life_death" | "ko" | "seki" | "alternative" | "generic"
trigger:
  conditions:                    # ALL conditions must be true (AND logic)
    - field: "winrateDelta"      # KataGo field or computed field
      operator: "<"             # <, >, <=, >=, ==, !=, in, between
      value: -0.10              # threshold value
  requires_optional:             # list of optional KataGo fields needed
    - "ownership"               # if listed, fallback template used when absent
  requires_delta: true|false    # whether previous-move analysis is needed
template:
  text: "..."                    # template text with {placeholders}
  slots:                         # mapping from placeholder to KataGo field
    move: "moveInfos[0].move"
    winrate_pct: "computed.winrateDelta * 100"
    best_move: "moveInfos[0].move"
fallback_id: "P-T1-MQ-01-fb"   # ID of fallback template (if this one needs optional data)
mandatory: false                 # true = pre-authored, LLM bypass
```

### 5.3 플레이스홀더 해석 규칙

1. 템플릿 텍스트의 모든 `{placeholder}`는 `slots`에 대응하는 항목이 반드시 있어야 한다.
2. 모든 `slots` 항목은 KataGo 응답 필드 경로 또는 정의된 수식을 가진 계산 필드에 매핑되어야 한다.
3. 숫자 플레이스홀더는 계층 규칙에 따라 포맷된다:
   - 초급자: 정수로 반올림 (`{winrate_pct}` = "62")
   - 중급자: 소수점 한 자리 ("62.3")
   - 고급자: 소수점 한 자리 + 추가 컨텍스트 ("62.3% [LCB: 58.1%]")
4. 수 위치 플레이스홀더 (`{move}`, `{best_move}`)는 항상 GTP 표기법을 사용한다.
5. PV 수순 플레이스홀더는 다음과 같이 포맷된다: "Q12 -> R10 -> Q10" (초급자는 처음 2수, 중급자는 처음 3수, 고급자는 최대 5수를 표시).

### 5.4 템플릿 카탈로그 요약

전체 카탈로그는 동반 파일 `outputs/step-04-pattern-catalog.yaml`에 있다. 다음은 카테고리 및 계층별 요약이다:

| 카테고리 | 초급자 (T1) | 중급자 (T2) | 고급자 (T3) | 합계 |
|----------|:---:|:---:|:---:|:---:|
| 수 품질 | 7 | 7 | 7 | 21 |
| 형세 판단 | 4 | 4 | 4 | 12 |
| 포석 | 3 | 3 | 3 | 9 |
| 중반전 | 3 | 3 | 3 | 9 |
| 끝내기 | 3 | 3 | 3 | 9 |
| 사활 (필수) | 3 | 3 | 3 | 9 |
| 패 (필수) | 2 | 2 | 2 | 6 |
| 빅 (필수) | 1 | 1 | 1 | 3 |
| 대안 수 | 2 | 2 | 2 | 6 |
| 일반 / 신뢰도 | 2 | 2 | 2 | 6 |
| **계층별 합계** | **30** | **30** | **30** | **90** |

각 계층은 30개 패턴을 보유하며, 계층당 최소 요구사항인 20개를 초과한다.

---

## 6. 필수 폴백 템플릿: 고위험 포지션

### 6.1 설계 근거

사활, 패(ko), 빅(seki)은 잘못된 설명이 학습자에게 가장 큰 피해를 주는 세 가지 카테고리이다. LLM은 바둑에 대한 이해가 전혀 없으며, 이런 포지션에 대해 그럴듯하지만 틀린 분석을 날조할 수밖에 없다. 따라서:

- **필수 템플릿은 바둑에 정통한 엔지니어가 사전 작성한다.**
- **이 카테고리들에 대해 LLM은 생성 경로에서 구조적으로 배제된다.**
- **템플릿 엔진은 분기를 하드코딩한다: 카테고리가 {life_death, ko, seki}이면 필수 템플릿을 직접 사용한다.**

### 6.2 사활 템플릿

사활 템플릿은 KataGo의 소유권 기반 무리 상태 판정을 보고한다. 수읽기를 설명하려 하지 않는다(그것은 바둑 이해를 필요로 한다). 대신 KataGo가 해당 무리의 가능성에 대해 말하는 바를 보고한다.

**감지 입력**: `ownership[]` 배열 (사용 가능한 경우) 또는 수 사이의 `scoreLead` 변동.

**템플릿 패밀리**:

| ID | 트리거 | 초급자 텍스트 |
|---|---|---|
| `P-T1-LD-01` | 무리 소유권 > 0.7 (살아 있음) | "This group of stones is safe. It has enough room to survive." |
| `P-T1-LD-02` | 무리 소유권 < -0.7 (죽어 있음) | "This group of stones is in danger. The computer thinks it will be captured." |
| `P-T1-LD-03` | 무리 소유권 -0.4에서 0.4 사이 (미결정) | "This group's fate is not decided yet. The next few moves will determine if it survives." |

각 항목에는 점진적으로 상세해지는 중급자 및 고급자 변형이 있다. 전체 세트는 패턴 카탈로그를 참조하라.

**소유권 데이터가 없을 때의 폴백**: `scoreLead` 크기를 사용한다. 최선수가 `scoreLead` 변동 > 8점인 국소 전투를 포함하면, 사활로 분류하고 간소화된 템플릿을 사용한다.

### 6.3 패(Ko) 템플릿

패 템플릿은 패 싸움이 진행 중임을 설명하고, KataGo의 점수 차이를 기반으로 이해관계를 보고한다.

| ID | 트리거 | 초급자 텍스트 |
|---|---|---|
| `P-T1-KO-01` | 패 감지, 이해관계 > 5점 | "A special kind of fight (called 'ko') is happening here. Both players are taking turns trying to win this area. It is worth about {ko_value} points." |
| `P-T1-KO-02` | 패 감지, 이해관계 <= 5점 | "There is a small back-and-forth fight here. It is worth about {ko_value} points." |

### 6.4 빅(Seki) 템플릿

빅 템플릿은 어느 쪽 무리도 상대를 잡을 수 없음을 설명한다.

| ID | 트리거 | 초급자 텍스트 |
|---|---|---|
| `P-T1-SK-01` | 빅 감지 | "Both groups of stones here are alive. Neither player can capture the other without losing their own stones. They will both stay on the board." |

### 6.5 필수 템플릿 시행

Step 13 구현자는 다음 코드 수준 불변 조건을 반드시 시행해야 한다:

```typescript
function generateExplanation(analysis: AnalysisResponse, category: PositionCategory, tier: Tier): string {
  // MANDATORY: high-risk categories NEVER go through LLM
  if (category === 'life_death' || category === 'ko' || category === 'seki') {
    return renderMandatoryTemplate(analysis, category, tier);
    // ^^^ This path NEVER calls the LLM. It uses only pre-authored templates + KataGo data.
  }

  // Standard path: template matching with LLM fallback
  const template = findBestTemplate(analysis, category, tier);
  if (template) {
    return renderTemplate(template, analysis);
  }

  // LLM fallback: ONLY for non-high-risk categories
  return llmTranslate(analysis, tier);
  // ^^^ LLM receives ONLY KataGo data. It CANNOT access the board or generate moves.
}
```

---

## 7. AI 설명 어조 및 페르소나

### 7.1 미결 항목 해결: PRD 11.2 #6

PRD는 AI 설명 어조를 분석적, 격려적, 소크라테스식 세 가지 후보가 있는 미결 항목으로 기재하고 있다. 분석 후, 대상 독자 계층에 따라 달라지는 **하이브리드 접근 방식**을 권장한다.

### 7.2 권장안: 계층별 적응형 어조

| 계층 | 주 어조 | 보조 어조 | 근거 |
|------|-------------|---------------|-----------|
| **초급자** | 격려적 | 정보 전달적 | 초급자에게는 학습을 지속하기 위한 긍정적 강화가 필요하다. 혹독한 분석은 이탈을 유발한다. 언어 학습 앱(Duolingo) 연구에 따르면 격려는 유지율을 30% 이상 높인다. |
| **중급자** | 정보 전달적 | 소크라테스식 (경도) | 중급자는 개념 이해를 원한다. "만약 이렇게 두면 어떻게 될까요?" 같은 간간이 던지는 질문은 거만함 없이 사고를 촉진한다. |
| **고급자** | 분석적 | 중립/정밀 | 고급자는 격려가 아닌 데이터를 원한다. 정밀성, 간결성, 수치적 상세함을 선호한다. |

### 7.3 템플릿에서의 어조 구현

**초급자 예시**:
- 좋은 수: "Nice choice! This move keeps you in a strong position."
- 실수: "This move lost some advantage, but do not worry — there is still a good game ahead."
- 악수: "Careful! This move gave away a significant lead. Let us look at what might have been better."

**중급자 예시**:
- 좋은 수: "Good move. {move} maintains your territorial advantage at {scoreLead} points."
- 실수: "This move dropped your win rate by {winrate_delta_pct}%. The engine preferred {best_move}, which would keep the pressure on."
- 악수: "A significant mistake. Playing at {best_move} instead would have maintained a {best_winrate_pct}% win rate. The key sequence: {pv_sequence}."

**고급자 예시**:
- 좋은 수: "{move} — optimal. WR: {winrate_pct}% [LCB: {lcb_pct}%], Score: {scoreLead}. Policy prior: {prior_pct}%."
- 실수: "Suboptimal. Delta: -{winrate_delta_pct}% WR, -{score_delta} pts. Best: {best_move} (V:{visits}, PV: {pv_sequence}). {alternatives_count} alternatives within 2% WR."
- 악수: "Blunder: -{winrate_delta_pct}% WR, -{score_delta} pts. Critical line: {pv_sequence}. Position shifts from {prev_assessment} to {curr_assessment}."

### 7.4 페르소나 정의: "교수 조교"

AI 설명 시스템은 **인내심 있는 교수 조교**의 페르소나를 채택한다. 이 조교는:

- 자신의 역할이 선생님(KataGo)의 분석을 번역하는 것이지, 자기 의견을 제시하는 것이 아님을 안다.
- 학생의 수준에 맞게 어휘와 상세도를 조정한다.
- 발전을 칭찬하고 실수를 학습 기회로 프레이밍한다 (초급자 계층).
- 중급자 계층에서는 실행 가능한 통찰("다음에는 이런 점을 살펴보세요...")을 제공한다.
- 고급자 계층에서는 정밀하고 경제적인 분석을 전달한다.

### 7.5 LLM이 할 수 있는 것 vs. 할 수 없는 것

| 할 수 있는 것 | 할 수 없는 것 |
|--------|-----------|
| 다양성을 위해 템플릿 출력을 재표현 | 바둑 전략이나 분석을 생성 |
| 여러 템플릿 출력을 자연스러운 문단으로 결합 | KataGo의 수치 데이터와 모순 |
| 계층 가이드라인 내에서 격식/비격식 조정 | KataGo `pv`에 없는 수순 날조 |
| 설명 구간 사이에 전환 문구 추가 | KataGo 데이터 없이 수의 좋고 나쁨을 주장 |
| GTP 좌표를 사람이 읽기 쉬운 형태로 변환 ("오른쪽 상단 귀") | KataGo 데이터가 보여주는 것 이상으로 포지션이 왜 사활인지 설명 |
| 격려/분석적 프레이밍을 바꿔 표현 | 필수 템플릿을 자체 텍스트로 대체 |

---

## 8. 커버리지 측정 방법론

### 8.1 커버리지 정의

**커버리지** = LLM 폴백 없이 템플릿만으로 완전히 설명할 수 있는 KataGo 분석 응답의 비율.

공식:

```
Coverage = (positions explained by templates only) / (total positions analyzed) * 100%
```

다음 조건을 모두 충족하면 해당 포지션은 "템플릿만으로 설명 가능"하다:
1. 최소 하나의 템플릿 트리거 조건이 KataGo 응답 데이터와 매칭된다.
2. 모든 템플릿 슬롯이 사용 가능한 KataGo 필드로 채워질 수 있다.
3. 출력 텍스트 생성에 LLM 호출이 필요하지 않다.

### 8.2 목표

**최소 커버리지: 80%** (대표 기보 샘플 기준).

### 8.3 측정 방법론

#### 8.3.1 샘플 구성

1. 난이도별 **50개 기보**를 수집한다:
   - 10개 기보: 9x9 초급자 수준
   - 15개 기보: 19x19 아마추어 (급위~저단)
   - 15개 기보: 19x19 아마추어 (중단~고단)
   - 10개 기보: 19x19 프로
2. 각 기보에 대해 모든 수를 KataGo "표준" 방문 횟수 티어(200회 방문)로 분석한다.
3. 이로써 약 **50개 기보 x ~200수/기보 = ~10,000개 포지션 분석**이 생성된다.

#### 8.3.2 측정 절차

코퍼스의 각 KataGo 분석 응답에 대해:

1. 패턴 분류기를 실행하여 포지션 카테고리를 결정한다.
2. 우선순위 체인(4.1절)을 사용하여 템플릿 매칭을 시도한다.
3. 결과를 기록한다:
   - `TEMPLATE_HIT`: 템플릿이 매칭되고 모든 슬롯이 채워짐.
   - `TEMPLATE_PARTIAL`: 템플릿이 매칭되었으나 부재한 선택적 필드가 필요함; 폴백 템플릿 사용.
   - `LLM_REQUIRED`: 매칭되는 템플릿 없음; LLM 폴백이 필요.
   - `MANDATORY_HIT`: 포지션이 고위험 카테고리; 필수 템플릿 사용.

4. 커버리지를 산출한다:
   ```
   coverage = (TEMPLATE_HIT + TEMPLATE_PARTIAL + MANDATORY_HIT) / total * 100%
   ```

#### 8.3.3 카테고리별 커버리지 분석

커버리지를 포지션 카테고리별로 추적하여 격차를 식별한다:

| 카테고리 | 예상 커버리지 | 비고 |
|----------|:---:|---|
| 수 품질 (델타 포함) | 95%+ | 잘 정의된 임계값이 모든 델타 범위를 커버 |
| 형세 판단 (델타 없음) | 90%+ | 승률 범위가 포괄적 |
| 포석 | 85%+ | 일반적인 패턴이 잘 커버됨 |
| 중반전 | 75%+ | 변동성 최대; 일부 복잡한 전투에 LLM 필요 가능 |
| 끝내기 | 90%+ | 끝내기는 주로 점수 계산에 관한 것 |
| 사활 | 100% | 필수 템플릿, 항상 적중 |
| 패 | 100% | 필수 템플릿, 항상 적중 |
| 빅 | 100% | 필수 템플릿, 항상 적중 |

### 8.4 커버리지 확장 전략

커버리지 격차가 식별된 경우:

1. **미스 분석**: 어떤 KataGo 데이터가 있었는가? 왜 매칭되는 템플릿이 없었는가?
2. **새 패턴 설계**: 이 경우를 포착할 트리거 조건을 정의한다.
3. **템플릿 작성**: 초급자, 중급자, 고급자 변형을 작성한다.
4. **카탈로그에 추가**: `pattern-catalog.yaml`에 고유 ID로 포함한다.
5. **재측정**: 커버리지 측정을 재실행하여 개선을 확인한다.
6. **반복 주기**: 개발 중에는 월간, 출시 후에는 분기별.

### 8.5 커버리지 격차 범주 (예상)

샘플 데이터와 바둑 기보 구조의 분석을 기반으로, 다음 영역에서 확장이 필요할 것으로 예상된다:

| 격차 영역 | 이유 | 완화 방안 |
|----------|-----|------------|
| 복잡한 중반전 전투 | 다양한 형태와 전술이 가능 | 범용 "전투" 템플릿으로 시작하고, 데이터 축적에 따라 확장 |
| 다중 무리 상호작용 | 템플릿이 단일 무리에 초점을 맞추도록 설계됨 | "{loc1}과 {loc2}의 무리 모두에 영향을 미치는 수" 템플릿 추가 |
| 비정형 포석 | 템플릿이 표준 포석을 전제로 함 | 범용 평가가 포함된 포석 기본 템플릿 추가 |
| 매우 접전인 끝내기 | 작은 델타를 흥미롭게 서술하기 어려움 | 접전 끝내기용 "한 집이라도 중요합니다" 템플릿 추가 |

---

## 9. LLM 통합 경계

### 9.1 LLM이 호출되는 시점

LLM은 다음 경우에만 호출된다:

1. KataGo 응답에 매칭되는 템플릿이 없는 경우 (커버리지 격차).
2. 해당 포지션이 고위험 카테고리(사활, 패, 빅)에 속하지 않는 경우.
3. 시스템에 컨텍스트로 제공할 KataGo 데이터가 있는 경우.

### 9.2 LLM 입력 계약

LLM이 호출될 때, 다음 내용을 포함한 구조화된 프롬프트를 수신한다:

```
You are a Go game explanation assistant. Your role is to translate the following
KataGo analysis into a {tier}-level explanation.

RULES:
- Use ONLY the data provided below. Do not add strategic analysis.
- Do not invent move sequences. Use only the PV sequences given.
- Do not claim a move is good or bad without citing the winrate/score values.
- Keep your explanation to {max_sentences} sentences.

KATAGO DATA:
- Current player: {currentPlayer}
- Win rate: {winrate}%
- Score lead: {scoreLead} points
- Best move: {bestMove} (winrate: {bestWinrate}%, score: {bestScore})
- Played move: {playedMove} (winrate: {playedWinrate}%, score: {playedScore})
- Best sequence: {pvSequence}
- Winrate change from previous move: {winrateDelta}%
- Score change from previous move: {scoreLeadDelta} points

Write the explanation:
```

### 9.3 LLM 출력 검증 (L3)

LLM이 텍스트를 생성한 후, L3 검증기는 다음을 검사한다:

1. **수치 일치**: 출력에 언급된 모든 백분율 또는 점수 값이 KataGo 데이터의 값과 일치해야 한다 (반올림 허용 오차 0.5%).
2. **수 일치**: 언급된 모든 수 좌표가 KataGo `moveInfos` 또는 `pv` 배열에 나타나야 한다.
3. **판단 일관성**: 텍스트가 "우세"라고 하면 승률이 > 0.52여야 한다. "열세"라고 하면 승률이 < 0.48이어야 한다. "호각"이라고 하면 승률이 0.48~0.52여야 한다.
4. **금지 문구 없음**: 출력에 "내 생각에는", "내 의견으로는", "나라면 이렇게 두겠다" 같은 문구가 포함되지 않아야 한다 (LLM은 바둑에 대한 의견을 가질 수 없다).

검증에 실패하면, 잠재적으로 부정확한 LLM 출력을 표시하는 대신 범용 템플릿으로 폴백한다.

### 9.4 LLM 선택

번역용 LLM은 범용 언어 모델이어야 한다. 바둑 특화 파인튜닝은 필요하지도 바람직하지도 않다 (파인튜닝이 모델에게 바둑 분석을 생성하도록 가르칠 수 있으며, 이는 핵심 원칙을 위반한다). 권장: 애플리케이션의 기존 LLM 통합을 사용하거나, 비용 효율성을 위해 경량 모델(GPT-4o-mini, Claude 3.5 Haiku)을 사용한다.

---

## 10. 패턴 카탈로그 참조

전체 패턴 카탈로그는 동반 파일에 정의되어 있다:

**`outputs/step-04-pattern-catalog.yaml`**

카탈로그는 카테고리별로 정리된 90개 패턴(계층당 30개)을 포함한다. 각 패턴은 다음을 포함한다:

- `P-{TIER}-{CATEGORY}-{NUMBER}` 규칙을 따르는 고유 ID.
- KataGo 필드와 계산값을 참조하는 트리거 조건.
- `{placeholder}` 문법을 사용한 템플릿 텍스트.
- 플레이스홀더를 데이터 소스에 매핑하는 슬롯 정의.
- 사활, 패, 빅 패턴에 대한 필수 플래그.
- 선택적 KataGo 필드가 필요한 템플릿을 위한 폴백 ID.

### 10.1 패턴 ID 규칙

```
P - T{tier} - {category_code} - {sequence}
│    │          │                  │
│    │          │                  └── 01, 02, 03...
│    │          └── MQ (move quality), PA (position assessment),
│    │              OP (opening), MG (middle game), EG (endgame),
│    │              LD (life/death), KO (ko), SK (seki),
│    │              AL (alternative), GN (generic)
│    └── 1 (beginner), 2 (intermediate), 3 (advanced)
└── Pattern prefix
```

### 10.2 교차 참조: 패턴과 KataGo 필드 연결

이 표는 각 패턴 카테고리가 의존하는 KataGo 필드를 보여준다:

| 카테고리 | 필수 필드 | 선택적 필드 |
|----------|----------------|-----------------|
| 수 품질 (MQ) | `winrate`, `scoreLead`, `order`, `pv`, `prior` | `ownership` |
| 형세 판단 (PA) | `rootInfo.winrate`, `rootInfo.scoreLead`, `rootInfo.visits` | `ownership` |
| 포석 (OP) | `moveInfos[*].move`, `moveInfos[*].winrate`, `pv` | `policy` |
| 중반전 (MG) | `moveInfos[*].move`, `winrate`, `scoreLead`, `pv` | `ownership`, `moveInfos[*].ownership` |
| 끝내기 (EG) | `scoreLead`, `scoreLeadDelta`, `pv` | `ownership` |
| 사활 (LD) | `scoreLead`, `winrate`, `pv` | `ownership` (강력 권장) |
| 패 (KO) | `scoreLead`, `pv`, `moveInfos[*].move` | `ownership` |
| 빅 (SK) | `scoreLead`, `winrate` | `ownership` (강력 권장) |
| 대안 수 (AL) | `moveInfos[0..2].*` | 없음 |
| 일반 (GN) | `rootInfo.winrate`, `rootInfo.scoreLead` | 없음 |

---

## 11. 검증 체크리스트

| # | 요구사항 | 상태 | 근거 |
|---|------------|:------:|----------|
| 1 | 모든 KataGo 분석 출력 필드(`winrate`, `scoreLead`, `order`, `prior`, `visits`, `pv`)가 패턴에 매핑됨 | PASS | 3.1절에서 모든 핵심 필드 매핑; 3.2절에서 선택적 필드 매핑 |
| 2 | 계층당 >= 20개 패턴을 포함한 3계층 템플릿 카탈로그 | PASS | 계층당 30개 패턴 = 총 90개 (5.4절) |
| 3 | 사활, 패, 빅에 대한 고위험 포지션 필수 폴백 규칙 | PASS | 6절에서 코드 수준 시행이 포함된 필수 템플릿 정의 |
| 4 | 핵심 원칙 "LLM = 번역기, KataGo = 진실"이 구조적으로 반영됨 | PASS | 1절에서 4계층 시행(L0-L3) 정의; 9절에서 LLM 경계 정의 |
| 5 | 커버리지 80%+ 방법론 정의 | PASS | 8절에서 지표, 측정, 확장 전략 정의 |
| 6 | Step 13 구현 가능: 패턴 카탈로그가 직접 사용 가능한 형식으로 제공 | PASS | 트리거 조건, 슬롯, 템플릿 텍스트를 포함한 YAML 카탈로그 |
| 7 | AI 설명 어조 해결 (PRD 미결 항목 11.2 #6) | PASS | 7절에서 계층별 적응형 어조 권장: 격려적/정보 전달적/분석적 |

---

## 12. pACS 자체 평가

### 충실도 (F): 90

**근거**: 본 설계는 네 개의 독립 계층(L0-L3)을 통해 "LLM = 번역기, KataGo = 진실"을 구조적으로 강제한다. 필수 폴백 메커니즘은 사활, 패, 빅을 사전 작성 템플릿에 하드코딩하여, 가장 위험한 카테고리에서 LLM이 바둑 분석을 환각하는 것을 구조적으로 불가능하게 만든다. LLM 통합 경계(9절)는 바둑판 상태 접근을 차단하는 명시적 입력 계약을 지정한다. 경미한 위험: L3 출력 검증기는 설계되었지만 아직 구현되지 않았으며, 그 효과는 Step 13 구현 품질에 의존한다.

### 완성도 (C): 88

**근거**: 카탈로그는 90개 패턴(계층당 30개)을 포함하여 최소 60개 패턴 요건을 초과한다. 모든 필수 카테고리(사활, 패, 빅)가 세 계층 전체에 걸쳐 템플릿을 갖추고 있다. 커버리지 방법론은 샘플 구성, 측정 절차, 확장 전략과 함께 완전히 명세되었다. Step 2 IPC 명세의 모든 KataGo 응답 필드가 매핑되었다. AI 어조 미결 항목이 근거와 함께 해결되었다. 경미한 격차: 실제 기보 데이터가 커버리지 격차를 드러내면 패턴 카탈로그의 확장이 불가피하겠지만, 확장 전략은 정의되어 있다.

### 논리적 일관성 (L): 87

**근거**: 우선순위 체인(4.1절)은 상호 배타적(첫 번째 매칭 적용)이면서 포괄적(범용 폴백이 모든 것을 포착)으로 설계되었다. 트리거 조건은 KataGo 필드에 연결된 측정 가능한 임계값을 사용한다. 템플릿 구조는 90개 패턴 전체에서 일관적이다. 계층 시스템은 어휘 중복 없이 깔끔하게 분리되어 있다. 경미한 위험: 포지션 카테고리 감지(4.2절)의 일부 엣지 케이스가 실제 데이터로 튜닝이 필요한 휴리스틱에 의존한다.

### pACS 점수: min(90, 88, 87) = **87 GREEN**
