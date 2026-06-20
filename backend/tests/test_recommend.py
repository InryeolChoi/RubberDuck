"""계층1 점수 서비스 단위 테스트 (DB 비의존, 결정적)."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.models import TaskStatus
from app.services.recommend import recommend, score_task


def _task(**kw):
    """테스트용 가짜 Task (ORM 대신 SimpleNamespace)."""
    base = dict(
        id="t-1",
        title="할 일",
        importance=3,
        urgency=3,
        deadline=None,
        is_sudden=False,
        is_next=False,
        estimated_minutes=None,
        tags=[],
        status=TaskStatus.todo,
    )
    base.update(kw)
    return SimpleNamespace(**base)


NOW = datetime(2026, 6, 20, 9, 0, tzinfo=timezone.utc)


def test_importance_urgency_base() -> None:
    high = score_task(
        _task(importance=5, urgency=5), checkin=None, context=None, now=NOW
    )
    low = score_task(
        _task(importance=1, urgency=1), checkin=None, context=None, now=NOW
    )
    assert high.score > low.score


def test_deadline_overdue_boost() -> None:
    overdue = score_task(
        _task(deadline=NOW - timedelta(hours=2)),
        checkin=None,
        context=None,
        now=NOW,
    )
    none = score_task(_task(), checkin=None, context=None, now=NOW)
    assert overdue.score > none.score
    assert any("마감" in r for r in overdue.reasons)


def test_low_energy_prefers_quick() -> None:
    checkin = SimpleNamespace(energy_level=1, available_minutes=30)
    quick = score_task(
        _task(estimated_minutes=10, tags=["quick"]),
        checkin=checkin,
        context=None,
        now=NOW,
    )
    heavy = score_task(
        _task(importance=5, estimated_minutes=120),
        checkin=checkin,
        context=None,
        now=NOW,
    )
    assert quick.score > heavy.score


def test_weather_discomfort_signal() -> None:
    checkin = SimpleNamespace(energy_level=1, available_minutes=30)
    weather = SimpleNamespace(temperature_c=32.0, humidity_pct=80, condition="흐림")
    quick = score_task(
        _task(estimated_minutes=10, tags=["quick"]),
        checkin=checkin,
        context=None,
        weather=weather,
        now=NOW,
    )
    assert any("무더위" in r or "짧은 일" in r for r in quick.reasons)


def test_blocked_demoted_and_done_excluded() -> None:
    blocked = score_task(
        _task(importance=5, urgency=5, tags=["blocked"]),
        checkin=None,
        context=None,
        now=NOW,
    )
    assert any("막힘" in r or "대기" in r for r in blocked.reasons)

    tasks = [
        _task(id="done", status=TaskStatus.done, importance=5, urgency=5),
        _task(id="todo", importance=3, urgency=3),
    ]
    ranked = recommend(tasks, checkin=None, context=None, now=NOW)
    assert all(s.task.id != "done" for s in ranked)
