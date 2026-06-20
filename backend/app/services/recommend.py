"""계층 1 — 규칙 기반 '지금 할 일' 점수화.

고정값(UserContext)·변화값(ContextCheckIn)·할 일(Task)을 조합해 각 할 일에
'지금 점수'를 매기고, 사람이 읽을 수 있는 근거(reasons)와 권장 행동
(suggested_action)을 함께 만든다. 외부 서비스 의존 없음(결정적·테스트 가능).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.models import ContextCheckIn, Task, TaskStatus, UserContext, WeatherSnapshot
from app.quadrant import derive_quadrant

# --------------------------------------------------------------------------- #
# 가중치 (튜닝 지점)
# --------------------------------------------------------------------------- #
W_IMPORTANCE = 6.0          # 중요도 1점당
W_URGENCY = 6.0             # 긴급도 1점당
W_DEADLINE_OVERDUE = 40.0   # 마감 초과
W_DEADLINE_24H = 25.0       # 24시간 이내
W_DEADLINE_72H = 12.0       # 72시간 이내
W_TIME_FIT = 12.0           # 가용 시간 내 완료 가능
W_TIME_OVERFLOW = -15.0     # 가용 시간 초과
W_ENERGY_QUICK = 10.0       # 에너지 낮을 때 짧은 일 가점
W_ENERGY_HEAVY = -12.0      # 에너지 낮을 때 무거운 일 감점
W_CHRONO_MATCH = 8.0        # 크로노타입과 시간대 일치 시 중요한 일 가점
W_TAG_DEADLINE = 8.0
W_TAG_QUICK_LOWENERGY = 8.0
W_TAG_BLOCKED = -50.0       # 대기/막힘 → 지금은 강등
W_TAG_SOMEDAY = -20.0
LOW_ENERGY = 2              # 이하이면 '에너지 낮음'
HEAVY_IMPORTANCE = 4        # 이상이면 '무거운 일'

# 날씨 시그널
W_WEATHER_DISCOMFORT_QUICK = 8.0   # 불쾌지수 높음 → 짧은 일 가점
W_WEATHER_DISCOMFORT_HEAVY = -8.0  # 불쾌지수 높음 → 무거운 일 감점
W_WEATHER_PLEASANT_OUTDOOR = 10.0  # 쾌적 → 야외/운동 가점
W_WEATHER_BAD_OUTDOOR = -12.0      # 악천후 → 야외 감점
HOT_TEMP_C = 28.0
HIGH_HUMIDITY = 70
PLEASANT_TEMP_MIN = 15.0
PLEASANT_TEMP_MAX = 24.0
OUTDOOR_TAGS = {"health", "personal", "outdoor"}
BAD_CONDITION_KEYWORDS = ("비", "눈", "소나기", "뇌우", "우박")


@dataclass
class ScoredTask:
    """점수화 결과 1건."""

    task: Task
    score: float
    reasons: list[str] = field(default_factory=list)
    suggested_action: str = "지금 처리"


def _hours_until(deadline: datetime, now: datetime) -> float:
    return (deadline - now).total_seconds() / 3600.0


def score_task(
    task: Task,
    *,
    checkin: ContextCheckIn | None,
    context: UserContext | None,
    weather: WeatherSnapshot | None = None,
    now: datetime,
) -> ScoredTask:
    """할 일 1건의 '지금 점수'와 근거를 계산한다."""
    reasons: list[str] = []
    score = task.importance * W_IMPORTANCE + task.urgency * W_URGENCY
    tags = set(task.tags or [])

    # 1) 마감 임박도
    if task.deadline is not None:
        hours = _hours_until(task.deadline, now)
        if hours < 0:
            score += W_DEADLINE_OVERDUE
            reasons.append(f"마감 {abs(round(hours))}시간 초과")
        elif hours <= 24:
            score += W_DEADLINE_24H
            reasons.append(f"마감 {round(hours)}시간 전")
        elif hours <= 72:
            score += W_DEADLINE_72H
            reasons.append(f"마감 {round(hours / 24, 1)}일 전")

    # 2) 가용 시간 적합도
    avail = checkin.available_minutes if checkin else None
    est = task.estimated_minutes
    if avail is not None and est is not None:
        if est <= avail:
            score += W_TIME_FIT
            reasons.append(f"{est}분이면 끝 (여유 {avail}분)")
        else:
            score += W_TIME_OVERFLOW
            reasons.append(f"{est}분 필요 > 여유 {avail}분 (지금 끝내긴 빠듯)")

    # 3) 현재 에너지 적합도
    energy = checkin.energy_level if checkin else None
    if energy is not None and energy <= LOW_ENERGY:
        is_quick = "quick" in tags or (est is not None and est <= 15)
        if is_quick:
            score += W_ENERGY_QUICK
            reasons.append("에너지 낮음 → 짧은 일 먼저")
        elif task.importance >= HEAVY_IMPORTANCE:
            score += W_ENERGY_HEAVY
            reasons.append("에너지 낮음 → 무거운 일은 뒤로")

    # 4) 크로노타입 × 현재 시간대
    if context is not None and context.chronotype is not None:
        hour = now.astimezone().hour
        is_morning_slot = 5 <= hour < 12
        is_evening_slot = 18 <= hour < 24
        chrono = context.chronotype.value
        if (
            (chrono == "morning" and is_morning_slot)
            or (chrono == "evening" and is_evening_slot)
        ) and task.importance >= HEAVY_IMPORTANCE:
            score += W_CHRONO_MATCH
            reasons.append("집중 시간대 → 중요한 일 적기")

    # 5) 태그 보정
    if "deadline" in tags:
        score += W_TAG_DEADLINE
    if "quick" in tags and energy is not None and energy <= LOW_ENERGY:
        score += W_TAG_QUICK_LOWENERGY
    if "blocked" in tags:
        score += W_TAG_BLOCKED
        reasons.append("⛔ 대기/막힘 → 지금은 진행 불가")
    if "someday" in tags:
        score += W_TAG_SOMEDAY

    # 6) 날씨 보정 (외부 데이터)
    if weather is not None:
        temp = float(weather.temperature_c) if weather.temperature_c is not None else None
        humidity = weather.humidity_pct
        condition = weather.condition or ""
        is_outdoor = bool(tags & OUTDOOR_TAGS)
        # 6-1) 불쾌지수: 고온 + 고습 → 집중 저하
        if (
            temp is not None
            and humidity is not None
            and temp >= HOT_TEMP_C
            and humidity >= HIGH_HUMIDITY
        ):
            is_quick = "quick" in tags or (est is not None and est <= 15)
            if is_quick:
                score += W_WEATHER_DISCOMFORT_QUICK
                reasons.append(f"무더위({round(temp)}°C·습도 {humidity}%) → 가벼운 일 먼저")
            elif task.importance >= HEAVY_IMPORTANCE:
                score += W_WEATHER_DISCOMFORT_HEAVY
                reasons.append(f"무더위({round(temp)}°C·습도 {humidity}%) → 무거운 일은 뒤로")
        # 6-2) 야외/운동 성격 일과 날씨 궁합
        if is_outdoor:
            is_bad = any(k in condition for k in BAD_CONDITION_KEYWORDS)
            is_pleasant = (
                temp is not None
                and PLEASANT_TEMP_MIN <= temp <= PLEASANT_TEMP_MAX
                and (humidity is None or humidity < HIGH_HUMIDITY)
                and not is_bad
            )
            if is_bad:
                score += W_WEATHER_BAD_OUTDOOR
                reasons.append(f"악천후({condition}) → 야외 활동은 미루기")
            elif is_pleasant:
                score += W_WEATHER_PLEASANT_OUTDOOR
                reasons.append(f"쾌적한 날씨({round(temp)}°C) → 야외/운동 적기")

    # 권장 행동
    if "blocked" in tags:
        suggested = "대기 (선행 해결 후)"
    elif "delegate" in tags:
        suggested = "위임 검토"
    elif "someday" in tags:
        suggested = "나중에"
    else:
        suggested = "지금 처리"

    return ScoredTask(
        task=task,
        score=round(score, 1),
        reasons=reasons,
        suggested_action=suggested,
    )


def recommend(
    tasks: list[Task],
    *,
    checkin: ContextCheckIn | None,
    context: UserContext | None,
    weather: WeatherSnapshot | None = None,
    now: datetime | None = None,
    limit: int = 5,
) -> list[ScoredTask]:
    """완료되지 않은 할 일을 점수순으로 정렬해 상위 N개를 반환한다."""
    now = now or datetime.now(timezone.utc)
    scored = [
        score_task(t, checkin=checkin, context=context, weather=weather, now=now)
        for t in tasks
        if t.status != TaskStatus.done
    ]
    scored.sort(key=lambda s: s.score, reverse=True)
    return scored[:limit]


def quadrant_of(task: Task) -> str:
    """할 일의 사분면(파생)."""
    return derive_quadrant(task.importance, task.urgency)
