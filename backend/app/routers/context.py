"""맥락(Context) 라우터 — 고정값(4.2)·체크인(4.3)·추세(4.4)."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.db import get_db
from app.models import ContextCheckIn, UserContext, WeatherSnapshot
from app.schemas import (
    CheckInCreate,
    CheckInRead,
    TrendInsightRead,
    TrendPoint,
    TrendRead,
    UserContextRead,
    UserContextUpdate,
    WeatherFetchRequest,
    WeatherManualCreate,
    WeatherRead,
)
from app.services import weather as weather_service
from app.services.insight import summarize_trend

router = APIRouter(prefix="/api/context", tags=["context"])

# 추세 계산이 허용된 수치형 지표 (SQL injection 방지를 위한 화이트리스트)
TREND_METRICS = {
    "mood": ContextCheckIn.mood,
    "energy_level": ContextCheckIn.energy_level,
    "sleep_hours": ContextCheckIn.sleep_hours,
    "sleep_quality": ContextCheckIn.sleep_quality,
    "available_minutes": ContextCheckIn.available_minutes,
}


# --------------------------------------------------------------------------- #
# 4.2 고정값
# --------------------------------------------------------------------------- #


@router.get("/fixed", response_model=UserContextRead)
def get_fixed_context(db: Session = Depends(get_db)):
    """현재 고정값 조회."""
    user = get_current_user(db)
    ctx = db.scalars(
        select(UserContext).where(UserContext.user_id == user.id)
    ).first()
    if ctx is None:
        raise HTTPException(status_code=404, detail="UserContext not set")
    return ctx


@router.put("/fixed", response_model=UserContextRead)
def put_fixed_context(payload: UserContextUpdate, db: Session = Depends(get_db)):
    """고정값 갱신(없으면 생성)."""
    user = get_current_user(db)
    ctx = db.scalars(
        select(UserContext).where(UserContext.user_id == user.id)
    ).first()
    data = payload.model_dump(exclude_unset=True)
    if ctx is None:
        ctx = UserContext(user_id=user.id, **data)
        db.add(ctx)
    else:
        for field, value in data.items():
            setattr(ctx, field, value)
    db.commit()
    db.refresh(ctx)
    return ctx


# --------------------------------------------------------------------------- #
# 4.3 체크인
# --------------------------------------------------------------------------- #


@router.post("/checkins", response_model=CheckInRead, status_code=201)
def create_checkin(payload: CheckInCreate, db: Session = Depends(get_db)):
    """체크인 1건 기록."""
    user = get_current_user(db)
    data = payload.model_dump(exclude_unset=True)
    checkin = ContextCheckIn(user_id=user.id, **data)
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return _checkin_read(checkin)


@router.get("/checkins", response_model=list[CheckInRead])
def list_checkins(
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """기간 체크인 조회 (쿼리: from, to, limit)."""
    user = get_current_user(db)
    stmt = select(ContextCheckIn).where(ContextCheckIn.user_id == user.id)
    if from_ is not None:
        stmt = stmt.where(ContextCheckIn.recorded_at >= from_)
    if to is not None:
        stmt = stmt.where(ContextCheckIn.recorded_at <= to)
    stmt = stmt.order_by(ContextCheckIn.recorded_at.desc()).limit(limit)
    return [_checkin_read(c) for c in db.scalars(stmt).all()]


@router.get("/checkins/latest", response_model=CheckInRead)
def latest_checkin(db: Session = Depends(get_db)):
    """가장 최근 체크인."""
    user = get_current_user(db)
    checkin = db.scalars(
        select(ContextCheckIn)
        .where(ContextCheckIn.user_id == user.id)
        .order_by(ContextCheckIn.recorded_at.desc())
        .limit(1)
    ).first()
    if checkin is None:
        raise HTTPException(status_code=404, detail="No check-ins yet")
    return _checkin_read(checkin)


# --------------------------------------------------------------------------- #
# 4.4 추세
# --------------------------------------------------------------------------- #


@router.get("/trends", response_model=TrendRead)
def get_trends(
    metric: str = Query(...),
    bucket: str = Query(default="day", pattern="^(day|week)$"),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    db: Session = Depends(get_db),
):
    """지표별 추세 (쿼리: metric, bucket, from, to)."""
    user = get_current_user(db)
    points = _compute_trend_points(db, user.id, metric, bucket, from_, to)
    return TrendRead(metric=metric, bucket=bucket, points=points)


@router.get("/trends/insight", response_model=TrendInsightRead)
def get_trend_insight(
    metric: str = Query(...),
    bucket: str = Query(default="day", pattern="^(day|week)$"),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    db: Session = Depends(get_db),
):
    """지표별 추세 + 러버덕 자연어 인사이트 (LLM 가능 시 사용, 아니면 폴백)."""
    user = get_current_user(db)
    points = _compute_trend_points(db, user.id, metric, bucket, from_, to)
    summary, source = summarize_trend(metric, points)
    return TrendInsightRead(
        metric=metric, bucket=bucket, summary=summary, source=source, points=points
    )


def _compute_trend_points(
    db: Session,
    user_id,  # noqa: ANN001
    metric: str,
    bucket: str,
    from_: datetime | None,
    to: datetime | None,
) -> list[TrendPoint]:
    """체크인 시계열을 버킷 평균으로 집계해 TrendPoint 목록을 만든다."""
    if metric not in TREND_METRICS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported metric. Choose one of: {', '.join(TREND_METRICS)}",
        )
    column = TREND_METRICS[metric]
    period = func.date_trunc(bucket, ContextCheckIn.recorded_at)

    stmt = (
        select(
            period.label("period"),
            func.avg(column).label("avg_val"),
            func.count(column).label("cnt"),
        )
        .where(ContextCheckIn.user_id == user_id)
        .group_by(period)
        .order_by(period)
    )
    if from_ is not None:
        stmt = stmt.where(ContextCheckIn.recorded_at >= from_)
    if to is not None:
        stmt = stmt.where(ContextCheckIn.recorded_at <= to)

    rows = db.execute(stmt).all()
    return [
        TrendPoint(
            t=row.period.date().isoformat(),
            avg=round(float(row.avg_val), 2) if row.avg_val is not None else None,
            count=int(row.cnt),
        )
        for row in rows
    ]


# --------------------------------------------------------------------------- #
# 4.6 날씨 (외부 데이터)
# --------------------------------------------------------------------------- #


@router.post("/weather", response_model=WeatherRead, status_code=201)
def fetch_and_store_weather(
    payload: WeatherFetchRequest, db: Session = Depends(get_db)
):
    """좌표로 Open-Meteo에서 현재 날씨를 가져와 저장."""
    user = get_current_user(db)
    try:
        reading = weather_service.fetch_current_weather(
            payload.latitude, payload.longitude
        )
    except Exception as exc:  # 외부 API 실패는 502로 전달
        raise HTTPException(
            status_code=502, detail=f"날씨 API 호출 실패: {exc}"
        ) from exc
    snapshot = WeatherSnapshot(
        user_id=user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        temperature_c=reading.temperature_c,
        humidity_pct=reading.humidity_pct,
        condition=reading.condition,
        source=reading.source,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return _weather_read(snapshot)


@router.post("/weather/manual", response_model=WeatherRead, status_code=201)
def store_weather_manual(
    payload: WeatherManualCreate, db: Session = Depends(get_db)
):
    """외부 호출 없이 날씨 값을 직접 저장(테스트/오프라인)."""
    user = get_current_user(db)
    snapshot = WeatherSnapshot(
        user_id=user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        temperature_c=payload.temperature_c,
        humidity_pct=payload.humidity_pct,
        condition=payload.condition,
        source=payload.source,
    )
    if payload.recorded_at is not None:
        snapshot.recorded_at = payload.recorded_at
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return _weather_read(snapshot)


@router.get("/weather/latest", response_model=WeatherRead)
def latest_weather(db: Session = Depends(get_db)):
    """가장 최근 날씨 스냅샷."""
    user = get_current_user(db)
    snapshot = db.scalars(
        select(WeatherSnapshot)
        .where(WeatherSnapshot.user_id == user.id)
        .order_by(WeatherSnapshot.recorded_at.desc())
        .limit(1)
    ).first()
    if snapshot is None:
        raise HTTPException(status_code=404, detail="No weather data yet")
    return _weather_read(snapshot)


# --------------------------------------------------------------------------- #
# 헬퍼
# --------------------------------------------------------------------------- #


def _weather_read(w: WeatherSnapshot) -> WeatherRead:
    """ORM WeatherSnapshot -> 응답 스키마(Numeric 형변환)."""
    return WeatherRead(
        id=str(w.id),
        recorded_at=w.recorded_at,
        latitude=float(w.latitude) if w.latitude is not None else None,
        longitude=float(w.longitude) if w.longitude is not None else None,
        temperature_c=float(w.temperature_c)
        if w.temperature_c is not None
        else None,
        humidity_pct=w.humidity_pct,
        condition=w.condition,
        source=w.source,
        created_at=w.created_at,
    )


def _checkin_read(c: ContextCheckIn) -> CheckInRead:
    """ORM 체크인 -> 응답 스키마 (id/sleep_hours 형변환)."""
    return CheckInRead(
        id=str(c.id),
        recorded_at=c.recorded_at,
        mood=c.mood,
        energy_level=c.energy_level,
        sleep_hours=float(c.sleep_hours) if c.sleep_hours is not None else None,
        sleep_quality=c.sleep_quality,
        available_minutes=c.available_minutes,
        created_at=c.created_at,
    )
