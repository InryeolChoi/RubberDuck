"""데이터베이스 엔진 · 세션 · 베이스 정의."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    """모든 ORM 모델의 베이스 클래스."""


# pool_pre_ping: 끊긴 커넥션을 자동 감지(클라우드 DB 권장)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """요청 단위 DB 세션을 제공하는 FastAPI 의존성."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
