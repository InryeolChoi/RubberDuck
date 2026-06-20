# 인프라 / 개발 환경 요구 사항

RubberDuck 프로젝트를 개발·실행·배포할 때 사용하는 런타임 버전과 도구를 정의합니다.
AI 에이전트와 개발자는 이 문서의 버전을 기준으로 환경을 맞춥니다.

> 관련 문서: [AGENTS.md](AGENTS.md) · [ROADMAP.md](ROADMAP.md)

---

## 런타임 버전

| 도구 | 권장 버전 | 비고 |
|------|-----------|------|
| Python | **3.12.x** | 백엔드(FastAPI). 3.13+는 일부 라이브러리 호환성 미확정이므로 3.12 LTS급 사용 |
| Node.js | **20.19+ (LTS, 권장 20.20.x)** | 프론트엔드(TypeScript) 빌드/실행. Vite 8은 Node 20.19+ 필요 |
| npm | **10.x** | Node 20에 포함 |
| PostgreSQL | **16.x** | 필요 시 사용. 로컬은 Docker 컨테이너 권장 |
| Docker | **24+** | 로컬 DB 및 배포 이미지 빌드 |
| Git | **2.4+** | 버전 관리 |

> 로컬 머신에 Python 3.14가 설치되어 있더라도, 프로젝트 가상환경은 **3.12**로 고정한다.
> (예: `pyenv install 3.12` 또는 `uv python install 3.12`)

## 백엔드 (FastAPI)

- **언어/런타임**: Python 3.12
- **핵심 패키지** (`backend/requirements.txt` 에 고정):
  - `fastapi`
  - `uvicorn[standard]`
  - `pydantic` v2
  - `sqlalchemy` 2.x (PostgreSQL 사용 시)
  - `psycopg[binary]` (PostgreSQL 드라이버)
  - `python-dotenv`
- **개발 도구**:
  - `pytest` (테스트)
  - `ruff` (린트/포매팅)
- **가상환경**:
  ```bash
  cd backend
  python3.12 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  ```

## 프론트엔드 (TypeScript)

- **런타임**: Node.js 20 LTS
- **패키지 매니저**: npm 10
- **TypeScript**: 5.x
- **버전 고정**: `.nvmrc` 에 `20` 명시(최신 20.x 패치 사용), `package.json`의 `engines` 필드로 Node 버전 강제
  ```json
  "engines": { "node": ">=20.19 <21 || >=22.12" }
  ```
  > Vite 8이 Node 20.19+ 를 요구하므로 20.16 같은 구버전에서는 `nvm install 20` 으로 업데이트한다.

## 데이터베이스 (PostgreSQL, 필요 시)

- **버전**: PostgreSQL 16
- **로컬 실행** (Docker 권장, `psql` 미설치여도 가능):
  ```bash
  docker run --name rubberduck-db \
    -e POSTGRES_USER=rubberduck \
    -e POSTGRES_PASSWORD=changeme \
    -e POSTGRES_DB=rubberduck \
    -p 5432:5432 -d postgres:16
  ```
- **연결 문자열**은 환경 변수 `DATABASE_URL` 로 주입한다.

## 환경 변수

비밀 값은 코드에 하드코딩하지 않고 `.env`(로컬) / Azure 앱 설정(배포)으로 관리한다.
`.env.example` 템플릿을 저장소에 포함한다.

| 변수 | 설명 | 예시 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql+psycopg://rubberduck:changeme@localhost:5432/rubberduck` |
| `COPILOT_SDK_TOKEN` | GitHub Copilot SDK 토큰 | (비밀, 커밋 금지) |
| `BACKEND_CORS_ORIGINS` | 허용할 프론트엔드 오리진 | `http://localhost:5173` |
| `VITE_API_BASE_URL` | 프론트엔드가 호출할 API 주소 | `http://localhost:8000` |

## 배포 (Azure)

- **대상 런타임**: 위 버전과 동일 (Python 3.12 / Node 20)
- 배포 시 Docker 이미지 또는 Azure 런타임 스택을 동일 버전으로 맞춘다.
- 구체적인 배포 서비스·절차는 추후 [AGENTS.md](AGENTS.md) 배포 섹션에 정리한다.

---

## 현재 로컬 환경 (참고)

| 도구 | 감지된 버전 | 프로젝트 기준과 차이 |
|------|-------------|----------------------|
| Python | 3.14.2 | → 프로젝트는 3.12 가상환경 사용 권장 |
| Node.js | 20.16.0 → **20.20.2** | ✅ Vite 8 요구사항(20.19+) 충족 (nvm으로 업그레이드)
| npm | 10.8.1 | ✅ 일치 |
| Docker | 29.2.1 | ✅ 사용 가능 |
| PostgreSQL CLI | 미설치 | Docker 컨테이너로 대체 가능 |
| Git | 2.50.1 | ✅ 사용 가능 |
