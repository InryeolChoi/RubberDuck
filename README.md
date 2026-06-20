# RubberDuck 🦆

생산성 향상을 위한 할 일 관리 앱. **아이젠하워 매트릭스**로 업무를 중요도·긴급도 4분할로 정리하고,
화면 중앙의 **러버덕 캐릭터**가 사용자의 맥락에 맞춰 반응하며 집중을 돕습니다.

> 관련 문서: [AGENTS.md](AGENTS.md) · [ROADMAP.md](ROADMAP.md) · [ENVIRONMENT.md](ENVIRONMENT.md) · [docs/design.md](docs/design.md)

---

## 핵심 기능

1. **아이젠하워 매트릭스 (4분할 할 일 관리)**
   - 중요도(importance) × 긴급도(urgency) 두 축으로 화면을 4개 사분면(Q1~Q4)으로 분할
   - Q1: 중요 & 긴급 / Q2: 중요 & 비긴급 / Q3: 비중요 & 긴급 / Q4: 비중요 & 비긴급
   - 할 일을 사분면 간에 드래그앤드롭으로 이동하며 우선순위를 정리
   - 사분면(quadrant)은 저장하지 않고 importance·urgency 값으로 파생
2. **러버덕 인터랙션**
   - 화면 중앙의 러버덕이 사용자 상태/행동에 따라 애니메이션·메시지로 반응
   - GitHub Copilot SDK를 활용해 맥락에 맞는 피드백 제공 (ROADMAP 5단계)
3. **맥락(context) 기반 우선순위 보조**
   - **고정값(UserContext)**: 직업·출퇴근·체력 등 거의 변하지 않는 정보
   - **변화값(ContextCheckIn)**: 기분·에너지·수면 등 켤 때마다 누적 기록되는 시계열
   - 변화값 추세를 계산해 우선순위 판단 및 고정값 조정을 보조

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | TypeScript, React, Vite |
| 백엔드 | FastAPI (Python 3.12) |
| 데이터베이스 | Azure Database for PostgreSQL – Flexible Server (PostgreSQL 16) |
| 인증 | Microsoft Entra 인증 + Managed Identity (비밀번호 없음) |
| AI | GitHub Copilot SDK |
| 배포 | Azure |

자세한 런타임 버전은 [ENVIRONMENT.md](ENVIRONMENT.md)를 참고하세요.

---

## 디렉터리 구조

```
.
├── frontend/          # TypeScript + React 프론트엔드 (Vite)
│   └── src/
│       └── theme/     # 사분면(quadrants) · 태그(tags) 색/아이콘 매핑
├── backend/           # FastAPI 백엔드
│   ├── app/           # 애플리케이션 코드 (main.py 등)
│   └── tests/         # pytest 테스트
├── docs/
│   └── design.md      # DB 스키마 + REST API 설계
├── AGENTS.md          # AI 코딩 에이전트 작업 가이드
├── ROADMAP.md         # 개발 진행 계획
├── ENVIRONMENT.md     # 인프라 / 개발 환경 요구 사항
└── README.md
```

---

## 빠른 시작

### 백엔드 (FastAPI)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://localhost:8000
```

### 프론트엔드 (TypeScript)

```bash
cd frontend
nvm use 20            # Node 20 LTS (20.19+)
npm install
npm run dev           # http://localhost:5173
```

환경 변수는 `.env`(로컬) / Azure 앱 설정(배포)으로 관리하며, 비밀 값은 커밋하지 않습니다.
템플릿은 `.env.example`을 참고하세요.

---

## 데이터 모델 (요약)

- **task** — 할 일 (`importance`, `urgency`, `deadline`, `status`, `tags` 등)
- **user_context** — 사용자 고정값 (직업·출퇴근·체력·크로노타입 등)
- **context_checkin** — 변화값 시계열 (기분·에너지·수면·가용 시간)

전체 스키마와 REST API 명세는 [docs/design.md](docs/design.md)에 정리되어 있습니다.

---

## 개발 규칙

- 기능 단위 브랜치(`feature/...`)에서 작업 후 PR로 병합
- 커밋 메시지는 명령형 현재 시제 (예: `Add task quadrant view`)
- 들여쓰기: 스페이스 2칸 (Python은 4칸)
- 프론트엔드·백엔드의 API 계약 변경 시 양쪽을 함께 업데이트
- 비밀 값(API 키·토큰)은 환경 변수로만 관리

자세한 내용은 [AGENTS.md](AGENTS.md)를 참고하세요.

---

## 역할 분담

| 담당 | 영역 |
|------|------|
| 개발자 A | 프론트엔드 (매트릭스 UI, 러버덕 렌더링, API 연동) |
| 개발자 B | 백엔드 (REST API, PostgreSQL, Copilot SDK 연동, Azure 배포) |
