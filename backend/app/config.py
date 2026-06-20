"""애플리케이션 설정 로딩."""

import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
"""SQLAlchemy 연결 문자열 (예: postgresql+psycopg://user:pass@host:5432/db?sslmode=require)."""

BACKEND_CORS_ORIGINS = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")
"""쉼표로 구분된 허용 오리진 목록."""
