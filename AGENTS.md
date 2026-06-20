# AGENTS.md

이 파일은 AI 코딩 에이전트(GitHub Copilot 등)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

- **이름**: RubberDuck
- **설명**: 생산성 향상을 위한 할 일 관리 앱. 아이젠하워 매트릭스로 업무를 분류하고, 중앙의 러버덕 캐릭터가 사용자에게 반응하며 집중을 돕는다.
- **주요 언어/프레임워크**:
  - 프론트엔드: TypeScript
  - 백엔드: FastAPI (Python)
  - 데이터베이스: PostgreSQL (필요 시)
  - AI: GitHub Copilot SDK

## 핵심 기능

1. **아이젠하워 매트릭스 (4분할 할 일 관리)**
   - 중요도(Importance)와 긴급도(Urgency)를 기준으로 화면을 4개 사분면으로 분할한다.
   - Q1: 중요 & 긴급 / Q2: 중요 & 비긴급 / Q3: 비중요 & 긴급 / Q4: 비중요 & 비긴급
   - 할 일을 사분면 간에 이동(드래그앤드롭 등)하며 정리할 수 있다.
2. **러버덕 인터랙션**
   - 화면 중앙에 러버덕을 배치하고, 사용자의 행동/상태에 따라 반응(애니메이션·메시지 등)한다.
   - Copilot SDK를 활용해 러버덕이 맥락에 맞는 피드백을 제공한다.
3. **추가 기능** (추후 확정)

## 디렉터리 구조

```
.
├── frontend/          # TypeScript 프론트엔드
├── backend/           # FastAPI 백엔드
│   └── app/
├── README.md
└── AGENTS.md
```

(코드가 추가되면 주요 폴더와 역할을 여기에 업데이트하세요)

## 역할 분담 (개발자 2명)

- **개발자 A — 프론트엔드**
  - TypeScript 기반 UI 구현
  - 아이젠하워 매트릭스 4분할 화면 및 할 일 이동 인터랙션
  - 러버덕 캐릭터 렌더링 및 반응 애니메이션
  - 백엔드 API 연동
- **개발자 B — 백엔드**
  - FastAPI 기반 REST API 구현
  - PostgreSQL 데이터 모델링 및 마이그레이션
  - GitHub Copilot SDK 연동(러버덕 반응 로직 등)
  - 인증·배포(Azure) 준비

> 두 사람의 작업이 겹치는 API 계약(엔드포인트·요청/응답 스키마)은 사전에 합의하고 문서화한다.

## 개발 환경 설정

```bash
# 백엔드 (FastAPI)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 프론트엔드 (TypeScript)
cd frontend
npm install
npm run dev
```

## 빌드 & 테스트

```bash
# 프론트엔드
npm run build      # 빌드
npm test           # 테스트
npm run lint       # 린트

# 백엔드
pytest             # 테스트
ruff check .       # 린트
```

## 코드 컨벤션

- 들여쓰기: 스페이스 2칸 (Python은 4칸)
- 변경한 코드에만 주석/타입을 추가하고, 무관한 리팩터링은 피합니다.
- 커밋 메시지는 명령형 현재 시제로 작성합니다. (예: "Add task quadrant view")
- 브랜치 전략: 기능 단위 브랜치(`feature/...`)를 만들어 작업 후 PR로 병합합니다.

## 에이전트 작업 규칙

- 파일을 수정하기 전에 먼저 읽고 맥락을 이해합니다.
- 요청받은 범위를 벗어난 변경은 하지 않습니다.
- 비밀 값(API 키, 토큰 등)은 코드에 하드코딩하지 않고 환경 변수로 관리합니다.
- 프론트엔드와 백엔드의 API 계약을 변경할 때는 양쪽을 함께 업데이트합니다.

## 배포

- **대상**: Azure
- (배포 방식이 정해지면 여기에 명령어와 절차를 정리하세요)
