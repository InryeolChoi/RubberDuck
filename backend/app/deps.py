"""공용 FastAPI 의존성.

MVP는 단일 사용자 가정이다. 인증을 붙이기 전까지는 기본 사용자 1명을
필요 시 생성해 모든 요청이 그 사용자에 귀속되도록 한다.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def get_current_user(db: Session) -> User:
    """기본 사용자(단일)를 반환하고, 없으면 생성한다."""
    user = db.scalars(select(User).limit(1)).first()
    if user is None:
        user = User()
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
