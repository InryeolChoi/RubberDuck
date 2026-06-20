# 개발 진행 계획 (ROADMAP)

RubberDuck 프로젝트의 작업 순서를 정리한 문서입니다. 각 단계는 위에서부터 순서대로 진행하며, 완료 시 체크박스를 채웁니다.

> 참고 문서: [AGENTS.md](AGENTS.md) · [ENVIRONMENT.md](ENVIRONMENT.md) · [docs/design.md](docs/design.md)

---

## 0단계. 프로젝트 준비 (공통)

- [x] 저장소 기본 문서 정리 (`README.md`, `AGENTS.md`)
- [x] 작업 순서 문서 작성 (`ROADMAP.md`) ← 현재 문서
- [x] 인프라/환경 요구 사항 문서 작성 (`ENVIRONMENT.md`)
- [ ] 브랜치 전략 합의 (`feature/...` 단위 브랜치 + PR)
- [x] API 계약(엔드포인트·요청/응답 스키마) 초안 합의 ([docs/design.md](docs/design.md))
- [x] 데이터 모델 설계 (Task / UserContext / ContextCheckIn) 및 값 형태 확정

## 1단계. 스캐폴딩 (공통)

- [x] `frontend/` TypeScript 프로젝트 초기화 (Vite + React + TS, 빌드/린트 설정)
- [x] `backend/` FastAPI 프로젝트 초기화 (`app/main.py`, `pyproject.toml`)
- [x] 백엔드 가상환경 생성 (uv, Python 3.12) 및 헬스 체크 엔드포인트
- [x] `backend/.gitignore`, 환경 변수 템플릿(`.env.example`) 추가
- [x] 프론트엔드 로컬 빌드 확인 (Node 20.20.2)

## 2단계. 백엔드 기초 (개발자 B)

- [x] Azure PostgreSQL Flexible Server 생성 (`rubberduck-pg-8435`, koreacentral, PG16, 비밀번호 인증 / 연결 검증 완료)
- [x] SQLAlchemy 모델 + Alembic 마이그레이션 (`Task` / `UserContext` / `ContextCheckIn` + `User`, Azure DB에 테이블 생성 완료)
- [x] 할 일 CRUD API 구현
  - [x] `GET /api/tasks` 목록 조회
  - [x] `POST /api/tasks` 생성
  - [x] `PATCH /api/tasks/{id}` 수정(사분면 이동 포함)
  - [x] `DELETE /api/tasks/{id}` 삭제
- [x] 맥락 API 구현 (고정값 / 체크인 / 추세)
- [x] 사분면(중요도·긴급도) 파생 및 검증 로직
- [x] 백엔드 단위 테스트 (`pytest`)

## 3단계. 프론트엔드 기초 (개발자 A)

- [ ] 기본 레이아웃 및 라우팅 구성
- [ ] 백엔드 API 연동 모듈 (fetch/axios)
- [ ] 할 일 목록 상태 관리

## 4단계. 핵심 기능 1 — 아이젠하워 매트릭스 (개발자 A)

- [ ] 화면을 4분할(Q1~Q4)하는 매트릭스 UI
- [ ] 할 일 카드 렌더링
- [ ] 사분면 간 이동(드래그앤드롭) 인터랙션
- [ ] 이동 시 백엔드 `PATCH /tasks/{id}` 동기화

## 5단계. 핵심 기능 2 — 러버덕 인터랙션

- [ ] (A) 화면 중앙 러버덕 캐릭터 렌더링 및 기본 애니메이션
- [ ] (B) Copilot SDK 연동 및 반응 로직 API 설계
- [ ] (B) 사용자 상태/행동 → 러버덕 반응 메시지 생성
- [ ] (A) 러버덕 반응(애니메이션·메시지) UI 표시

## 6단계. 추가 기능 (추후 확정)

- [ ] 세 번째 기능 정의
- [ ] 설계 및 구현

## 7단계. 통합 & 배포 (개발자 B 주도)

- [ ] 프론트엔드·백엔드 통합 테스트
- [ ] Azure 배포 준비 (인프라 구성, 환경 변수)
- [ ] Azure 배포 및 동작 확인

---

## 역할 요약

| 단계 | 주 담당 |
|------|---------|
| 0~1단계 | 공통 |
| 2단계 (백엔드 CRUD) | 개발자 B |
| 3·4단계 (프론트엔드/매트릭스) | 개발자 A |
| 5단계 (러버덕) | A(렌더링) + B(Copilot SDK) |
| 7단계 (배포) | 개발자 B |
