# RubberDuck 프론트엔드 설계 문서

프론트엔드(개발자 A)가 나중에 바로 구현을 시작할 수 있도록 **화면 구조, 컴포넌트,
상태, API 연동 계약**을 정의한다. 백엔드 API는 모두 구현·검증 완료 상태다.

> 관련 문서: [docs/design.md](./design.md) (DB·API) · [AGENTS.md](../AGENTS.md) · [ROADMAP.md](../ROADMAP.md)
> 테마 코드: [frontend/src/theme/quadrants.ts](../frontend/src/theme/quadrants.ts) · [frontend/src/theme/tags.ts](../frontend/src/theme/tags.ts)

---

## 1. 기술 스택 / 전제

- **Vite + React + TypeScript** (이미 스캐폴딩됨: [frontend/](../frontend))
- API 베이스 URL: `import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'`
- 모든 시각은 ISO 8601(UTC). 화면 표시 시 로컬 타임존으로 변환.
- MVP는 단일 사용자 — 인증 헤더 없음. (추후 토큰 추가)
- CORS: 백엔드가 `http://localhost:5173`(Vite 기본) 허용.
- **LLM(Copilot SDK/Azure OpenAI)**: 러버덕 메시지·자연어 파싱·추세 인사이트·대화형 반응에
  사용. 응답의 `source`(`fallback`|`copilot-sdk`|`azure-openai`)로 출처를 구분한다.
  자격증명이 없어도 모든 엔드포인트는 폴백으로 동일 스키마를 반환하므로 프론트 분기 불필요.

---

## 2. 화면 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│  헤더: 로고 · 오늘 날짜 · [체크인] · [날씨 새로고침]          │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│   아이젠하워 매트릭스 (2×2)   │   사이드 패널                  │
│   ┌───────────┬───────────┐  │   ┌────────────────────────┐ │
│   │ Q1 중요·급 │ Q2 중요·비급│  │   │ 🦆 러버덕 (중앙 강조)   │ │
│   │           │           │  │   │   말풍선 = duck.message │ │
│   ├───────────┼───────────┤  │   ├────────────────────────┤ │
│   │ Q3 비중·급 │ Q4 비중·비급│  │   │ "지금 할 일" 추천 리스트 │ │
│   │           │           │  │   │  (items, score·reasons)│ │
│   └───────────┴───────────┘  │   ├────────────────────────┤ │
│                              │   │ 맥락 요약 / 날씨 칩      │ │
│                              │   └────────────────────────┘ │
└──────────────────────────────┴──────────────────────────────┘
```

- **러버덕은 화면 중앙(또는 사이드 상단)에 크게** 배치하고, `duck.mood`에 따라
  애니메이션/표정을 바꾼다. 말풍선 텍스트는 추천 API의 `duck.message`.

---

## 3. 컴포넌트 트리 (제안)

```
<App>
 ├─ <Header>                       // 날짜, 체크인 버튼, 날씨 새로고침
 ├─ <MatrixBoard>                  // 2×2 그리드
 │   └─ <QuadrantCell quadrant>    // Q1~Q4, 색은 QUADRANTS[q]
 │        └─ <TaskCard task>       // 드래그 가능
 │             └─ <TagChip tag>    // TAGS[tagId]
 ├─ <SidePanel>
 │   ├─ <RubberDuck mood message/> // duck.mood, duck.message
 │   ├─ <RecommendationList items/>// "지금 할 일"
 │   │    └─ <RecommendationCard/> // score, reasons[], suggested_action
 │   └─ <ContextSummary context/>  // energy, available_minutes, 날씨 칩
 ├─ <TaskEditorModal>              // 생성/수정 (importance, urgency, est_minutes, tags...)
 └─ <CheckInModal>                 // mood, energy, sleep, available_minutes
```

---

## 4. 테마 (코드와 1:1)

### 4.1 사분면 색 — `QUADRANTS[QuadrantId]`
| Q | 정의 | 권장 행동 | accent | bg | border |
|---|------|-----------|--------|----|--------|
| Q1 | 중요 & 급함 | 즉시 처리 | `#dc2626` | `#fef2f2` | `#fecaca` |
| Q2 | 중요 & 비급함 | 계획 세우기 | `#2563eb` | `#eff6ff` | `#bfdbfe` |
| Q3 | 비중요 & 급함 | 위임 / 빠르게 | `#d97706` | `#fffbeb` | `#fde68a` |
| Q4 | 비중요 & 비급함 | 줄이기 / 제거 | `#6b7280` | `#f9fafb` | `#e5e7eb` |

- 사분면 파생은 `deriveQuadrant(importance, urgency)` 재사용(백엔드와 동일 규칙, 임계값 3).

### 4.2 태그 칩 — `TAGS[TagId]`
- priority(우선순위/강조): `deadline`🔥 · `key`⭐ · `quick`⚡ · `blocked`⛔ · `delegate`🤝 · `someday`💤
- category(분류): `work`💼 · `personal`🏠 · `study`📚 · `health`🩺
- 각 칩의 `color`/`bg`/`icon`/`label`은 `tags.ts`를 그대로 사용. `task.tags`는 **id 문자열 배열**.

---

## 5. 상태(State) 설계

| 상태 | 출처 API | 갱신 시점 |
|------|----------|-----------|
| `tasks` | `GET /api/tasks` | 앱 로드 / 생성·수정·삭제 후 |
| `fixedContext` | `GET /api/context/fixed` | 앱 로드 / 고정값 저장 후 |
| `latestCheckin` | `GET /api/context/checkins/latest` | 앱 로드 / 체크인 후 |
| `latestWeather` | `GET /api/context/weather/latest` | 앱 로드 / 날씨 새로고침 후 |
| `recommendation` | `GET /api/recommendations` | 앱 로드 / 위 4개 변경 후 재요청 |

> 권장: React Query(TanStack Query)로 캐싱·무효화. 추천은 tasks/checkin/weather가
> 바뀌면 `invalidate`해서 다시 가져온다.

---

## 6. API 연동 계약 (프론트가 호출할 것)

베이스: `/api`. 응답 스키마는 [docs/design.md 4장](./design.md#4-rest-api-설계) 참고.

### 6.1 할 일
```ts
GET    /api/tasks?status=&quadrant=Q1&is_next=   // 목록
POST   /api/tasks                                 // 생성 (201)
POST   /api/tasks/parse                           // 자연어 → 할 일 초안(LLM, 폴백 보장)
GET    /api/tasks/{id}
PATCH  /api/tasks/{id}                            // 사분면 이동 = importance/urgency 변경
DELETE /api/tasks/{id}                            // 204
```
TaskCreate 본문:
```ts
{
  title: string;            // 필수
  importance: 1|2|3|4|5;
  urgency: 1|2|3|4|5;
  deadline?: string|null;   // ISO
  is_sudden?: boolean;
  is_next?: boolean;
  estimated_minutes?: number|null; // ≥1, 추천 시간 적합도에 사용
  tags?: TagId[];
  status?: 'todo'|'doing'|'done';
}
```
- **드래그앤드롭으로 사분면 이동** = 도착 사분면에 맞춰 `importance`/`urgency`를
  PATCH(예: Q1로 옮기면 둘 다 ≥3). 응답의 `quadrant`로 재배치 확인.
- 응답 TaskRead에는 `quadrant`(파생)와 `estimated_minutes`가 포함된다.

#### 자연어 빠른 추가 — `POST /api/tasks/parse`
사용자가 "내일까지 보고서 마무리, 급함"처럼 한 문장을 입력하면 LLM이 할 일 초안을
만들어 준다. **초안일 뿐 자동 저장하지 않는다** — 폼에 채워 사용자가 확인 후 `POST /api/tasks`로 확정한다.
```ts
// 요청
POST /api/tasks/parse   { text: string }   // 1~500자
// 응답
{
  draft: {
    title: string;
    importance: 1|2|3|4|5;
    urgency: 1|2|3|4|5;
    deadline: string|null;        // ISO (상대 표현 "내일" 등을 절대 시각으로 해석)
    estimated_minutes: number|null;
    is_sudden: boolean;
    tags: TagId[];
  };
  source: 'fallback'|'copilot-sdk'|'azure-openai';
  note: string|null;              // 폴백 사유 등(예: "LLM 미설정")
}
```
- UI 권장: 할 일 추가 모달 상단에 **"문장으로 추가"** 입력칸 → 호출 후 `draft`로 폼 프리필.
  `source==='fallback'`이면 "기본값으로 채웠어요" 같은 보조 안내.

### 6.2 맥락 — 고정값 / 체크인 / 추세
```ts
GET /api/context/fixed
PUT /api/context/fixed            // job, commute_status, base_stamina, chronotype, ...
POST /api/context/checkins        // mood, energy_level, sleep_hours, available_minutes
GET  /api/context/checkins?from=&to=&limit=
GET  /api/context/checkins/latest
GET  /api/context/trends?metric=energy_level&bucket=day          // 그래프용(숫자 시계열)
GET  /api/context/trends/insight?metric=energy_level&bucket=day  // 그래프 + 자연어 요약(LLM)
```
#### 추세 인사이트 — `GET /api/context/trends/insight`
`/trends`와 같은 쿼리에 **러버덕 한 줄 요약**을 더해 준다. 그래프 옆/아래 캡션으로 쓰기 좋다.
```ts
{
  metric: string;
  bucket: 'day'|'week';
  summary: string;       // 예: "최근 5개 구간 동안 에너지가 3.0 → 2.5로 낮아졌어요(-0.5)."
  source: 'fallback'|'copilot-sdk'|'azure-openai';
  points: Array<{ t: string; avg: number|null; count: number }>;
}
```
- 데이터가 적으면 폴백이 "체크인을 더 쌓아봐요" 식으로 안내하므로 빈 상태 처리에 그대로 활용 가능.

### 6.3 날씨 (외부 데이터)
```ts
POST /api/context/weather         // { latitude, longitude } → Open-Meteo에서 가져와 저장 (201)
POST /api/context/weather/manual  // 값 직접 저장 (테스트/오프라인)
GET  /api/context/weather/latest  // 최신 스냅샷
```
- "날씨 새로고침" 버튼: 브라우저 Geolocation으로 좌표 얻어 `POST /api/context/weather` 호출.
  실패(거부/오프라인) 시 기본 좌표(예: 서울 37.5665, 126.978)로 폴백.
- 응답: `{ temperature_c, humidity_pct, condition, source, recorded_at }` → 날씨 칩에 표시.

### 6.4 추천 ("지금 할 일") + 러버덕
```ts
GET /api/recommendations?limit=5&include_duck=true
GET /api/duck/recommend           // 동일 응답(러버덕 관점 진입점)
POST /api/duck/react              // 사용자 한마디에 대화형 반응(LLM, 폴백 보장)
```
#### 대화형 러버덕 — `POST /api/duck/react`
사용자가 러버덕을 누르거나 한마디 입력하면, 저장된 최근 체크인·고정값과(지정 시) 할 일 제목을
맥락으로 공감 · 제안한다. LLM이 없으면 결정적 폴백 메시지.
```ts
// 요청 (둘 다 선택)
POST /api/duck/react   { note?: string; task_id?: string }
// 응답
{ message: string; mood: 'encouraging'|'calm'|'cheer'|'focus'; source: 'fallback'|'copilot-sdk'|'azure-openai' }
```
- 용례: 러버덕 클릭 → "오늘 너무 막막해" 입력 → 공감 한마디. 특정 할 일 카드에서 물어보면 `task_id` 전달.
RecommendationResponse:
```ts
{
  generated_at: string;
  context: {
    energy_level: number|null;
    available_minutes: number|null;
    temperature_c: number|null;
    humidity_pct: number|null;
    weather_condition: string|null;
  };
  items: Array<{
    id: string;
    title: string;
    quadrant: 'Q1'|'Q2'|'Q3'|'Q4';
    importance: number;
    urgency: number;
    score: number;          // 높을수록 먼저
    reasons: string[];      // 사람이 읽는 근거 칩으로 표시
    suggested_action: string; // '지금 처리' | '위임 검토' | '대기 (선행 해결 후)' | '나중에'
    estimated_minutes: number|null;
    deadline: string|null;
    tags: TagId[];
  }>;
  duck: { message: string; mood: string; source: string } | null;
}
```
- **RecommendationCard**: 제목 + 점수 배지 + `reasons`를 작은 칩으로 + `suggested_action` 라벨.
  카드 클릭 → 해당 할 일을 매트릭스에서 하이라이트.
- **RubberDuck**: `duck.message`를 말풍선에, `duck.mood`(`calm`/`focus`/`encouraging`/`cheer`)로
  표정·애니메이션 전환. `source`가 `fallback`이면 규칙 기반, `copilot-sdk`/`azure-openai`면 LLM 생성.
  > 서버에 `COPILOT_SDK_TOKEN`(또는 Azure OpenAI 키)이 설정되면 추천 메시지·파싱·추세 인사이트·
  > 대화형 반응이 모두 LLM 경로로 바뀜다. 키가 없어도 폴백으로 동일 스키마로 완결 동작.

---

## 7. 러버덕 상호작용(mood) 매핑

| mood | 의미 | 표정/애니메이션 제안 |
|------|------|----------------------|
| `calm` | 에너지 낮음 / 할 일 없음 | 느린 깜빡임, 부드러운 색 |
| `focus` | Q1(중요·급함) 집중 권유 | 집중 표정, 살짝 강조 |
| `encouraging` | 일반 추천 | 미소, 가벼운 흔들림 |
| `cheer` | 완료 축하(향후) | 점프/하트 |

- 트리거: 앱 로드, 체크인 완료, 날씨 갱신, 할 일 완료 시 추천 재요청 → `duck.message` 갱신.
- **대화형 트리거**: 러버덕 클릭 또는 한마디 입력 → `POST /api/duck/react` → 말풍선 갱신
  (응답 `source`로 LLM/폴백 구분). 입력창은 선택 사항이며, 빈 입력으로 눌러도 폴백이 답한다.

---

## 8. 구현 순서(프론트 권장)

1. API 클라이언트(`src/api.ts`) + 타입 정의(위 스키마 그대로)
2. `<MatrixBoard>` + `<TaskCard>` + `<TagChip>` (읽기 전용 표시)
3. 생성/수정 모달 + 드래그앤드롭(사분면 이동 = PATCH)
   - (선택) "문장으로 추가": `POST /api/tasks/parse` → 초안으로 모달 프리필
4. `<CheckInModal>` + 날씨 새로고침 버튼
5. `<RecommendationList>` + `<RubberDuck>` (추천 API 연동)
   - 대화형: 러버덕 클릭/입력 → `POST /api/duck/react` → 말풍선 갱신
6. 추세 그래프(`/trends`) + 인사이트 한 줄(`/trends/insight`) — 선택

> 백엔드는 모두 동작/검증 완료. 러버덕 메시지·자연어 파싱·추세 인사이트·대화형 반응은
> LLM(Copilot SDK/Azure OpenAI) 경로를 쓰되, 자격증명이 없어도 동일 스키마의 폴백으로 동작한다.
> 프론트는 위 계약만 지키면 되고, `source` 필드로 LLM/폴백을 구분해 표시할 수 있다.
