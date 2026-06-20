"""체크인 추세의 자연어 인사이트 서비스(계층 2 보조).

`/api/context/trends`가 만든 시계열 포인트를 받아 사람이 읽을 한 줄 요약을 만든다.
LLM이 있으면 맥락을 반영한 문장을, 없으면 첫·마지막 값 비교 기반 결정적 요약을 낸다.
"""

from __future__ import annotations

from app.schemas import TrendPoint
from app.services import llm

METRIC_LABELS_KO = {
    "mood": "기분",
    "energy_level": "에너지",
    "sleep_hours": "수면 시간",
    "sleep_quality": "수면의 질",
    "available_minutes": "가용 시간",
}


def _non_null(points: list[TrendPoint]) -> list[TrendPoint]:
    return [p for p in points if p.avg is not None]


def _fallback_summary(metric: str, points: list[TrendPoint]) -> str:
    label = METRIC_LABELS_KO.get(metric, metric)
    valid = _non_null(points)
    if not valid:
        return f"아직 {label} 데이터가 부족해 추세를 말하기 일러요. 체크인을 조금만 더 쌓아봐요 🦆"
    if len(valid) == 1:
        return f"최근 {label}는 평균 {valid[0].avg}예요. 비교할 기록이 더 쌓이면 추세를 보여줄게요."

    first, last = valid[0].avg, valid[-1].avg
    assert first is not None and last is not None
    diff = round(last - first, 2)
    span = len(valid)
    if abs(diff) < 0.3:
        return f"최근 {span}개 구간 동안 {label}는 평균 {last} 안팎으로 비교적 안정적이에요."
    direction = "올랐어요" if diff > 0 else "낮아졌어요"
    return f"최근 {span}개 구간 동안 {label}가 {first} → {last}로 {direction}({'+' if diff > 0 else ''}{diff})."


def summarize_trend(metric: str, points: list[TrendPoint]) -> tuple[str, str]:
    """(요약 문장, source)를 돌려준다. LLM 실패 시 폴백 문장."""
    fallback = _fallback_summary(metric, points)
    if not llm.llm_available() or not _non_null(points):
        return fallback, "fallback"

    label = METRIC_LABELS_KO.get(metric, metric)
    series = ", ".join(
        f"{p.t}={p.avg}" for p in points if p.avg is not None
    )
    system = (
        "너는 생산성 앱의 러버덕 친구야. 사용자의 컨디션 지표 시계열을 보고 한국어로 "
        "따뜻하게 한 문장(최대 2문장)으로 추세를 요약하고, 필요하면 부드러운 제안을 더해. "
        "수치를 과하게 나열하지 말고 핵심 흐름만. JSON으로만 답해: "
        '{"summary": "<한국어 요약>"}'
    )
    user = f"지표: {label}({metric})\n시계열(구간=평균): {series}"
    data = llm.chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.5,
        max_tokens=200,
    )
    if not data:
        return fallback, "fallback"
    summary = data.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        return fallback, "fallback"
    return summary.strip(), llm.llm_provider() or "fallback"
