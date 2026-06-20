"""Pydantic 요청/응답 스키마 (docs/design.md 4장 기준)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Chronotype, CommuteStatus, TaskStatus
from app.quadrant import QuadrantId, derive_quadrant

# --------------------------------------------------------------------------- #
# Task (4.1)
# --------------------------------------------------------------------------- #


class TaskCreate(BaseModel):
    """할 일 생성 요청."""

    title: str = Field(min_length=1)
    importance: int = Field(ge=1, le=5)
    urgency: int = Field(ge=1, le=5)
    deadline: datetime | None = None
    is_sudden: bool = False
    is_next: bool = False
    estimated_minutes: int | None = Field(default=None, ge=1)
    tags: list[str] = Field(default_factory=list)
    status: TaskStatus = TaskStatus.todo


class TaskUpdate(BaseModel):
    """할 일 수정 요청 (모든 필드 선택)."""

    title: str | None = Field(default=None, min_length=1)
    importance: int | None = Field(default=None, ge=1, le=5)
    urgency: int | None = Field(default=None, ge=1, le=5)
    deadline: datetime | None = None
    is_sudden: bool | None = None
    is_next: bool | None = None
    estimated_minutes: int | None = Field(default=None, ge=1)
    tags: list[str] | None = None
    status: TaskStatus | None = None


class TaskParseRequest(BaseModel):
    """자연어 문장 → 할 일 초안 요청."""

    text: str = Field(min_length=1, max_length=500)


class TaskDraft(BaseModel):
    """파싱된 할 일 초안 (POST /api/tasks에 그대로 쓸 수 있는 형태)."""

    title: str
    importance: int = Field(ge=1, le=5)
    urgency: int = Field(ge=1, le=5)
    deadline: datetime | None = None
    estimated_minutes: int | None = None
    is_sudden: bool = False
    tags: list[str] = Field(default_factory=list)


class TaskParseResponse(BaseModel):
    """자연어 파싱 응답 — 초안 + 출처 표기."""

    draft: TaskDraft
    source: str  # fallback | copilot-sdk | azure-openai
    note: str | None = None


class TaskRead(BaseModel):
    """할 일 응답 (사분면은 파생값으로 포함)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    importance: int
    urgency: int
    quadrant: QuadrantId
    deadline: datetime | None
    is_sudden: bool
    is_next: bool
    estimated_minutes: int | None
    tags: list[str]
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

    @classmethod
    def from_task(cls, task) -> "TaskRead":  # noqa: ANN001
        """ORM Task -> 응답 스키마 (quadrant 파생 포함)."""
        return cls(
            id=str(task.id),
            title=task.title,
            importance=task.importance,
            urgency=task.urgency,
            quadrant=derive_quadrant(task.importance, task.urgency),
            deadline=task.deadline,
            is_sudden=task.is_sudden,
            is_next=task.is_next,
            estimated_minutes=task.estimated_minutes,
            tags=list(task.tags or []),
            status=task.status,
            created_at=task.created_at,
            updated_at=task.updated_at,
            completed_at=task.completed_at,
        )


# --------------------------------------------------------------------------- #
# UserContext 고정값 (4.2)
# --------------------------------------------------------------------------- #


class UserContextUpdate(BaseModel):
    """고정값 갱신 요청 (PUT)."""

    job: str | None = None
    commute_status: CommuteStatus | None = None
    base_stamina: int | None = Field(default=None, ge=1, le=5)
    recent_issues: str | None = None
    chronotype: Chronotype | None = None
    priority_values: str | None = None
    work_life_ratio: int | None = Field(default=None, ge=0, le=100)


class UserContextRead(BaseModel):
    """고정값 응답."""

    model_config = ConfigDict(from_attributes=True)

    job: str | None
    commute_status: CommuteStatus | None
    base_stamina: int | None
    recent_issues: str | None
    chronotype: Chronotype | None
    priority_values: str | None
    work_life_ratio: int | None
    updated_at: datetime
    created_at: datetime


# --------------------------------------------------------------------------- #
# ContextCheckIn 변화값 (4.3)
# --------------------------------------------------------------------------- #


class CheckInCreate(BaseModel):
    """체크인 1건 기록 요청."""

    mood: int | None = Field(default=None, ge=1, le=5)
    energy_level: int | None = Field(default=None, ge=1, le=5)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    sleep_quality: int | None = Field(default=None, ge=1, le=5)
    available_minutes: int | None = Field(default=None, ge=0)
    recorded_at: datetime | None = None


class CheckInRead(BaseModel):
    """체크인 응답."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    recorded_at: datetime
    mood: int | None
    energy_level: int | None
    sleep_hours: float | None
    sleep_quality: int | None
    available_minutes: int | None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Trends 추세 (4.4)
# --------------------------------------------------------------------------- #


class TrendPoint(BaseModel):
    """추세 한 지점."""

    t: str
    avg: float | None
    count: int


class TrendRead(BaseModel):
    """지표별 추세 응답."""

    metric: str
    bucket: str
    points: list[TrendPoint]


class TrendInsightRead(BaseModel):
    """추세 + 자연어 인사이트 응답."""

    metric: str
    bucket: str
    summary: str
    source: str  # fallback | copilot-sdk | azure-openai
    points: list[TrendPoint]


# --------------------------------------------------------------------------- #
# Duck 반응 (4.5, placeholder)
# --------------------------------------------------------------------------- #


class DuckReactRequest(BaseModel):
    """러버덕 반응 요청 (추후 Copilot SDK 연동)."""

    task_id: str | None = None
    note: str | None = None


class DuckReactResponse(BaseModel):
    """러버덕 반응 응답."""

    message: str
    mood: str
    source: str = "fallback"  # fallback | copilot-sdk | azure-openai


# --------------------------------------------------------------------------- #
# Weather 날씨 (4.6) — 외부 데이터(Open-Meteo)
# --------------------------------------------------------------------------- #


class WeatherFetchRequest(BaseModel):
    """좌표를 받아 Open-Meteo에서 현재 날씨를 가져와 저장."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class WeatherManualCreate(BaseModel):
    """외부 호출 없이 날씨 값을 직접 저장(테스트/오프라인)."""

    temperature_c: float | None = None
    humidity_pct: int | None = Field(default=None, ge=0, le=100)
    condition: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    source: str = "manual"
    recorded_at: datetime | None = None


class WeatherRead(BaseModel):
    """날씨 스냅샷 응답."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    recorded_at: datetime
    latitude: float | None
    longitude: float | None
    temperature_c: float | None
    humidity_pct: int | None
    condition: str | None
    source: str | None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Recommendations 추천 (4.7) — 계층1 점수 + 계층2 러버덕 메시지
# --------------------------------------------------------------------------- #


class RecommendationItem(BaseModel):
    """추천된 할 일 1건 (점수·근거 포함)."""

    id: str
    title: str
    quadrant: QuadrantId
    importance: int
    urgency: int
    score: float
    reasons: list[str]
    suggested_action: str
    estimated_minutes: int | None
    deadline: datetime | None
    tags: list[str]


class RecommendationContext(BaseModel):
    """추천에 사용한 맥락 요약."""

    energy_level: int | None = None
    available_minutes: int | None = None
    temperature_c: float | None = None
    humidity_pct: int | None = None
    weather_condition: str | None = None


class DuckMessageRead(BaseModel):
    """러버덕 메시지(계층2)."""

    message: str
    mood: str
    source: str


class RecommendationResponse(BaseModel):
    """추천 응답."""

    generated_at: datetime
    context: RecommendationContext
    items: list[RecommendationItem]
    duck: DuckMessageRead | None = None
