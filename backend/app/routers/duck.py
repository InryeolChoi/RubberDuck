"""러버덕 반응 라우터 — docs/design.md 4.5.

/react는 사용자의 한마디에 러버덕이 대화하듯 답하고(LLM 가능 시 사용, 아니면 폴백),
/recommend는 저장된 맥락·날씨를 활용해 '지금 할 일'을 골라 자연어 메시지를 만든다.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import ContextCheckIn, Task, UserContext
from app.routers.recommend import build_recommendations
from app.schemas import DuckReactRequest, DuckReactResponse, RecommendationResponse
from app.services.duck import make_duck_reply

router = APIRouter(prefix="/api/duck", tags=["duck"])


@router.post("/react", response_model=DuckReactResponse)
def react(payload: DuckReactRequest, db: Session = Depends(get_db)) -> DuckReactResponse:
    """사용자의 한마디(note)에 러버덕이 대화하듯 반응한다.

    저장된 최근 체크인·고정값과(있으면) 지정한 할 일 제목을 맥락으로 활용한다.
    LLM 자격증명이 없으면 결정적 폴백 메시지로 응답한다.
    """
    user = get_current_user(db)
    checkin = db.scalars(
        select(ContextCheckIn)
        .where(ContextCheckIn.user_id == user.id)
        .order_by(ContextCheckIn.recorded_at.desc())
        .limit(1)
    ).first()
    context = db.scalars(
        select(UserContext).where(UserContext.user_id == user.id).limit(1)
    ).first()

    task_title: str | None = None
    if payload.task_id:
        try:
            tid = uuid.UUID(payload.task_id)
        except ValueError:
            tid = None
        if tid is not None:
            task = db.get(Task, tid)
            if task is not None and task.user_id == user.id:
                task_title = task.title

    msg = make_duck_reply(
        payload.note, task_title=task_title, checkin=checkin, context=context
    )
    return DuckReactResponse(message=msg.message, mood=msg.mood, source=msg.source)


@router.get("/recommend", response_model=RecommendationResponse)
def recommend_with_duck(
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """저장된 맥락·날씨 기반 추천 + 러버덕 메시지."""
    return build_recommendations(db, limit=limit, include_duck=True)
