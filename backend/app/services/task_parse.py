"""자연어 → 할 일 초안 파싱 서비스(계층 2 보조).

사용자가 "내일까지 보고서 마무리, 급함"처럼 자유 문장을 입력하면 LLM이
`title / importance / urgency / deadline / estimated_minutes / tags`를 추론해
할 일 생성(POST /api/tasks)에 바로 쓸 수 있는 초안을 만든다.

LLM 자격증명이 없으면 결정적 폴백(제목=입력, 중요도·긴급도 3)으로 동작한다.
초안은 어디까지나 '제안'이며 최종 확정은 사용자가 한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.services import llm

# design.md 4.6 — 허용 태그(화이트리스트)
ALLOWED_TAGS = {
    "deadline",
    "key",
    "quick",
    "blocked",
    "delegate",
    "someday",
    "work",
    "personal",
    "study",
    "health",
}


@dataclass
class ParsedTask:
    """파싱된 할 일 초안."""

    title: str
    importance: int = 3
    urgency: int = 3
    deadline: datetime | None = None
    estimated_minutes: int | None = None
    is_sudden: bool = False
    tags: list[str] = field(default_factory=list)
    source: str = "fallback"
    note: str | None = None


def _clamp_scale(value: object, default: int = 3) -> int:
    try:
        n = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return max(1, min(5, n))


def _parse_deadline(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _clean_tags(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for t in value:
        if isinstance(t, str) and t in ALLOWED_TAGS and t not in out:
            out.append(t)
    return out


def _fallback(text: str, *, note: str) -> ParsedTask:
    title = text.strip()[:200] or "새 할 일"
    return ParsedTask(title=title, source="fallback", note=note)


def parse_task(text: str, *, now: datetime | None = None) -> ParsedTask:
    """자유 문장에서 할 일 초안을 만든다(LLM 가능 시 사용, 아니면 폴백)."""
    text = (text or "").strip()
    if not text:
        return ParsedTask(title="새 할 일", source="fallback", note="입력이 비어 있음")

    if not llm.llm_available():
        return _fallback(text, note="LLM 미설정 — 기본값으로 초안 생성")

    now = now or datetime.now(timezone.utc)
    system = (
        "너는 생산성 앱의 입력 도우미다. 사용자의 한국어 자유 문장을 분석해 할 일 초안을 "
        "JSON으로만 만든다. 스키마:\n"
        '{"title": str, "importance": 1~5, "urgency": 1~5, '
        '"deadline": ISO8601 문자열 또는 null, "estimated_minutes": 정수 또는 null, '
        '"is_sudden": bool, "tags": 문자열 배열}\n'
        "규칙: importance=중요도, urgency=긴급도(마감 임박/즉시성). 마감 표현이 있으면 "
        f"현재 시각({now.isoformat()})을 기준으로 deadline을 절대 시각으로 계산한다. "
        "tags는 다음에서만 고른다: "
        f"{', '.join(sorted(ALLOWED_TAGS))}. 확실하지 않은 값은 보수적으로 둔다."
    )
    data = llm.chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        temperature=0.2,
        max_tokens=300,
    )
    if not data:
        return _fallback(text, note="LLM 응답 없음 — 폴백 사용")

    title = data.get("title")
    if not isinstance(title, str) or not title.strip():
        title = text[:200]

    est = data.get("estimated_minutes")
    estimated_minutes = est if isinstance(est, int) and est > 0 else None

    return ParsedTask(
        title=title.strip()[:200],
        importance=_clamp_scale(data.get("importance")),
        urgency=_clamp_scale(data.get("urgency")),
        deadline=_parse_deadline(data.get("deadline")),
        estimated_minutes=estimated_minutes,
        is_sudden=bool(data.get("is_sudden", False)),
        tags=_clean_tags(data.get("tags")),
        source=llm.llm_provider() or "fallback",
        note=None,
    )
