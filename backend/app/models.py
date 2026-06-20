"""SQLAlchemy ORM 모델 (docs/design.md 2장 기준)."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class CommuteStatus(str, enum.Enum):
    """근무 형태."""

    remote = "remote"
    office = "office"
    hybrid = "hybrid"


class Chronotype(str, enum.Enum):
    """일주기 유형(아침형/저녁형)."""

    morning = "morning"
    neutral = "neutral"
    evening = "evening"


class TaskStatus(str, enum.Enum):
    """할 일 진행 상태."""

    todo = "todo"
    doing = "doing"
    done = "done"


class User(Base):
    """소유자. MVP에서는 단일 사용자로 시작 가능."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    context: Mapped["UserContext | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    checkins: Mapped[list["ContextCheckIn"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    weather_snapshots: Mapped[list["WeatherSnapshot"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserContext(Base):
    """고정값 맥락 — 거의 변하지 않는 사용자 정보."""

    __tablename__ = "user_context"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    job: Mapped[str | None] = mapped_column(Text)
    commute_status: Mapped[CommuteStatus | None] = mapped_column()
    base_stamina: Mapped[int | None] = mapped_column(SmallInteger)
    recent_issues: Mapped[str | None] = mapped_column(Text)
    chronotype: Mapped[Chronotype | None] = mapped_column()
    priority_values: Mapped[str | None] = mapped_column(Text)
    work_life_ratio: Mapped[int | None] = mapped_column(SmallInteger)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="context")


class ContextCheckIn(Base):
    """변화값 맥락 — 켤 때마다 누적되는 시계열 기록."""

    __tablename__ = "context_checkin"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    mood: Mapped[int | None] = mapped_column(SmallInteger)
    energy_level: Mapped[int | None] = mapped_column(SmallInteger)
    sleep_hours: Mapped[float | None] = mapped_column(Numeric(3, 1))
    sleep_quality: Mapped[int | None] = mapped_column(SmallInteger)
    available_minutes: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="checkins")


class Task(Base):
    """할 일. 사분면(quadrant)은 저장하지 않고 importance·urgency로 파생한다."""

    __tablename__ = "task"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(Text)
    importance: Mapped[int] = mapped_column(SmallInteger)
    urgency: Mapped[int] = mapped_column(SmallInteger)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_sudden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_next: Mapped[bool] = mapped_column(Boolean, default=False)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[TaskStatus] = mapped_column(default=TaskStatus.todo)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="tasks")


class WeatherSnapshot(Base):
    """외부 날씨 시계열 — 기온·습도·날씨 상태를 누적해 추천·분석에 활용한다.

    Open-Meteo(키리스 무료 API) 등 외부 소스에서 가져와 저장한다.
    """

    __tablename__ = "weather_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE")
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    latitude: Mapped[float | None] = mapped_column(Numeric(7, 4))
    longitude: Mapped[float | None] = mapped_column(Numeric(7, 4))
    temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    humidity_pct: Mapped[int | None] = mapped_column(SmallInteger)
    condition: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="weather_snapshots")
