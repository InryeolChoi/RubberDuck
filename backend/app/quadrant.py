"""사분면 파생 로직 (프론트 deriveQuadrant와 동일한 임계값 3)."""

from typing import Literal

QuadrantId = Literal["Q1", "Q2", "Q3", "Q4"]

THRESHOLD = 3


def derive_quadrant(importance: int, urgency: int) -> QuadrantId:
    """중요도·급함(1~5)에서 사분면을 파생한다. 임계값은 3."""
    important = importance >= THRESHOLD
    urgent = urgency >= THRESHOLD
    if important and urgent:
        return "Q1"
    if important and not urgent:
        return "Q2"
    if not important and urgent:
        return "Q3"
    return "Q4"
