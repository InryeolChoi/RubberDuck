"""RubberDuck FastAPI 애플리케이션 진입점."""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(
    title="RubberDuck API",
    description="생산성 향상을 위한 할 일 관리 앱의 백엔드 API",
    version="0.1.0",
)

# 프론트엔드(개발 서버) 오리진 허용
cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """서비스 상태 확인용 헬스 체크 엔드포인트."""
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    """루트 엔드포인트."""
    return {"message": "RubberDuck API에 오신 것을 환영합니다 🦆"}
