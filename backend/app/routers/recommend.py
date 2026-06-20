"""추천(Recommendations) 라우터 — docs/design.md 4.7.

계층1(규칙 점수)으로 '지금 할 일'을 정렬하고, 계층2(러버덕 추론)로 자연어
한마디를 덧붙인다. 저장된 고정값·최근 체크인·최근 날씨를 모두 활용한다.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import ContextCheckIn, Task, TaskStatus, UserContext, WeatherSnapshot
from app.schemas import (
    DuckMessageRead,
    RecommendationContext,
    RecommendationItem,
    RecommendationResponse,
)
from app.services.duck import make_duck_message
from app.services.recommend import quadrant_of, recommend

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def build_recommendations(
    db: Session, *, limit: int = 5, include_duck: bool = True
) -> RecommendationResponse:
    """추천 응답을 구성한다(라우터·duck에서 공용)."""
    user = get_current_user(db)

    tasks = list(
        db.scalars(
            select(Task)
            .where(Task.user_id == user.id, Task.status != TaskStatus.done)
        ).all()
    )
    checkin = db.scalars(
        select(ContextCheckIn)
        .where(ContextCheckIn.user_id == user.id)
        .order_by(ContextCheckIn.recorded_at.desc())
        .limit(1)
    ).first()
    context = db.scalars(
        select(UserContext).where(UserContext.user_id == user.id).limit(1)
    ).first()
    weather = db.scalars(
        select(WeatherSnapshot)
        .where(WeatherSnapshot.user_id == user.id)
        .order_by(WeatherSnapshot.recorded_at.desc())
        .limit(1)
    ).first()

    now = datetime.now(timezone.utc)
    scored = recommend(
        tasks, checkin=checkin, context=context, weather=weather, now=now, limit=limit
    )

    items = [
        RecommendationItem(
            id=str(s.task.id),
            title=s.task.title,
            quadrant=quadrant_of(s.task),
            importance=s.task.importance,
            urgency=s.task.urgency,
            score=s.score,
            reasons=s.reasons,
            suggested_action=s.suggested_action,
            estimated_minutes=s.task.estimated_minutes,
            deadline=s.task.deadline,
            tags=list(s.task.tags or []),
        )
        for s in scored
    ]

    ctx = RecommendationContext(
        energy_level=checkin.energy_level if checkin else None,
        available_minutes=checkin.available_minutes if checkin else None,
        temperature_c=float(weather.temperature_c)
        if weather and weather.temperature_c is not None
        else None,
        humidity_pct=weather.humidity_pct if weather else None,
        weather_condition=weather.condition if weather else None,
    )

    duck = None
    if include_duck:
        msg = make_duck_message(
            scored, checkin=checkin, context=context, weather=weather
        )
        duck = DuckMessageRead(message=msg.message, mood=msg.mood, source=msg.source)

    return RecommendationResponse(
        generated_at=now, context=ctx, items=items, duck=duck
    )


@router.get("", response_model=RecommendationResponse)
def get_recommendations(
    limit: int = Query(default=5, ge=1, le=20),
    include_duck: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    """지금 할 일 추천 + 러버덕 메시지."""
    return build_recommendations(db, limit=limit, include_duck=include_duck)
