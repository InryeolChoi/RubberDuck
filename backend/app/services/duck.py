"""계층 2 — 러버덕 추론(자연어 메시지) 서비스.

계층 1(규칙 점수)의 결과와 맥락을 받아, 러버덕이 건넬 자연어 한마디를 만든다.

설계 원칙:
- **공급자 비종속**: Copilot SDK / Azure OpenAI 등 외부 LLM을 붙일 수 있는 확장
  지점을 두되, 자격증명이 없어도 항상 동작하는 **결정적 폴백**을 기본 제공한다.
- 지금은 폴백만으로 완결 동작. `COPILOT_SDK_TOKEN`(또는 Azure OpenAI 키)이
  설정되면 `_generate_with_llm`을 구현해 교체할 수 있다.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models import ContextCheckIn, UserContext, WeatherSnapshot
from app.services import llm
from app.services.recommend import ScoredTask, quadrant_of

VALID_MOODS = {"encouraging", "calm", "cheer", "focus"}


@dataclass
class DuckMessage:
    """러버덕이 건넬 메시지."""

    message: str
    mood: str  # encouraging | calm | cheer | focus
    source: str  # fallback | copilot-sdk | azure-openai


def _weather_clause(weather: WeatherSnapshot | None) -> str:
    if weather is None or weather.temperature_c is None:
        return ""
    temp = round(float(weather.temperature_c))
    cond = weather.condition or ""
    humid = weather.humidity_pct
    if humid is not None and temp >= 28 and humid >= 70:
        return f"오늘 {temp}°C에 습도 {humid}%라 좀 끈적해. 가볍게 가자. "
    if cond and any(k in cond for k in ("비", "눈", "소나기", "뇌우")):
        return f"밖은 {cond}이니 실내 일에 집중하기 딱 좋아. "
    if 15 <= temp <= 24:
        return f"{temp}°C로 날씨가 좋아 기분 좋게 시작해보자. "
    return ""


def _fallback_message(
    top: ScoredTask | None,
    *,
    checkin: ContextCheckIn | None,
    context: UserContext | None,
    weather: WeatherSnapshot | None,
) -> DuckMessage:
    """LLM 없이 템플릿으로 만드는 결정적 메시지."""
    weather_part = _weather_clause(weather)

    if top is None:
        return DuckMessage(
            message=f"{weather_part}삐약! 지금은 할 일이 비어 있어. 잠깐 쉬어도 좋아 🦆",
            mood="calm",
            source="fallback",
        )

    title = top.task.title
    quad = quadrant_of(top.task)
    energy = checkin.energy_level if checkin else None
    lead_reason = top.reasons[0] if top.reasons else ""

    if energy is not None and energy <= 2:
        mood = "calm"
        tone = "에너지가 낮아 보여. 부담 적은 것부터 천천히 가자."
    elif quad == "Q1":
        mood = "focus"
        tone = "지금 가장 중요하고 급한 일이야. 이거 하나에 집중!"
    else:
        mood = "encouraging"
        tone = "이거 하나만 끝내도 한결 가벼워질 거야."

    reason_part = f" ({lead_reason})" if lead_reason else ""
    message = f"{weather_part}삐약! 지금은 ‘{title}’부터 어때?{reason_part} {tone} 🦆"
    return DuckMessage(message=message, mood=mood, source="fallback")


def _llm_available() -> bool:
    return llm.llm_available()


def _build_prompt(
    top: ScoredTask | None,
    *,
    checkin: ContextCheckIn | None,
    context: UserContext | None,
    weather: WeatherSnapshot | None,
    scored: list[ScoredTask],
) -> list[dict[str, str]]:
    """러버덕 페르소나 + 현재 맥락을 담은 채팅 메시지를 구성한다."""
    system = (
        "너는 사용자의 책상 위 '러버덕' 친구야. 생산성 앱에서 사용자가 지금 무엇부터 "
        "할지 정하도록 돕는다. 한국어로, 따뜻하고 짧게(최대 2문장) 말한다. 가끔 '삐약'이나 "
        "🦆를 자연스럽게 섞되 과하지 않게. 사용자를 다그치지 말고 부담을 덜어주는 톤으로. "
        "반드시 JSON으로만 답한다: "
        '{"message": "<한국어 한두 문장>", "mood": "encouraging|calm|cheer|focus"}'
    )

    lines: list[str] = []
    if context is not None:
        if context.job:
            lines.append(f"- 직업: {context.job}")
        if context.chronotype is not None:
            lines.append(f"- 크로노타입: {context.chronotype.value}")
    if checkin is not None:
        if checkin.energy_level is not None:
            lines.append(f"- 현재 에너지(1~5): {checkin.energy_level}")
        if checkin.mood is not None:
            lines.append(f"- 현재 기분(1~5): {checkin.mood}")
        if checkin.available_minutes is not None:
            lines.append(f"- 가용 시간: {checkin.available_minutes}분")
    if weather is not None and weather.temperature_c is not None:
        cond = weather.condition or ""
        humid = (
            f"·습도 {weather.humidity_pct}%" if weather.humidity_pct is not None else ""
        )
        lines.append(f"- 날씨: {round(float(weather.temperature_c))}°C {cond}{humid}")

    if top is not None:
        reasons = "; ".join(top.reasons) if top.reasons else "근거 없음"
        lines.append(
            f"- 추천 1순위 할 일: '{top.task.title}' "
            f"(사분면 {quadrant_of(top.task)}, 근거: {reasons})"
        )
        others = [s.task.title for s in scored[1:3]]
        if others:
            lines.append(f"- 다음 후보: {', '.join(others)}")
    else:
        lines.append("- 지금은 할 일이 비어 있음")

    user = "현재 맥락:\n" + "\n".join(lines) + "\n\n이 상황에 맞는 러버덕 한마디를 만들어줘."
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _generate_with_llm(
    top: ScoredTask | None,
    *,
    checkin: ContextCheckIn | None,
    context: UserContext | None,
    weather: WeatherSnapshot | None,
    scored: list[ScoredTask],
) -> DuckMessage | None:
    """LLM(Copilot SDK / Azure OpenAI)으로 러버덕 메시지를 생성한다.

    호출/파싱 실패 시 None을 반환해 폴백으로 위임한다.
    """
    messages = _build_prompt(
        top, checkin=checkin, context=context, weather=weather, scored=scored
    )
    data = llm.chat_json(messages, temperature=0.8, max_tokens=200)
    if not data:
        return None

    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return None
    mood = data.get("mood")
    if mood not in VALID_MOODS:
        mood = "encouraging"

    return DuckMessage(
        message=message.strip(),
        mood=mood,
        source=llm.llm_provider() or "fallback",
    )


def make_duck_message(
    scored: list[ScoredTask],
    *,
    checkin: ContextCheckIn | None,
    context: UserContext | None,
    weather: WeatherSnapshot | None = None,
) -> DuckMessage:
    """추천 결과를 바탕으로 러버덕 메시지를 만든다(LLM 가능 시 사용, 아니면 폴백)."""
    top = scored[0] if scored else None
    if _llm_available():
        result = _generate_with_llm(
            top,
            checkin=checkin,
            context=context,
            weather=weather,
            scored=scored,
        )
        if result is not None:
            return result
    return _fallback_message(top, checkin=checkin, context=context, weather=weather)


def _reply_fallback(note: str | None, task_title: str | None) -> DuckMessage:
    """대화형 응답의 결정적 폴백."""
    if task_title:
        return DuckMessage(
            message=f"삐약! ‘{task_title}’ 말이지? 너무 크게 생각 말고 첫 5분만 시작해보자 🦆",
            mood="encouraging",
            source="fallback",
        )
    if note and note.strip():
        return DuckMessage(
            message="삐약, 마음 충분히 이해해. 지금 할 수 있는 가장 작은 한 걸음부터 같이 해보자 🦆",
            mood="calm",
            source="fallback",
        )
    return DuckMessage(
        message="삐약! 차근차근 하나씩 해보자 🦆",
        mood="encouraging",
        source="fallback",
    )


def make_duck_reply(
    note: str | None,
    *,
    task_title: str | None = None,
    checkin: ContextCheckIn | None = None,
    context: UserContext | None = None,
) -> DuckMessage:
    """사용자의 한마디(note)에 러버덕이 대화하듯 답한다(LLM 가능 시 사용, 아니면 폴백)."""
    if not _llm_available():
        return _reply_fallback(note, task_title)

    system = (
        "너는 사용자의 책상 위 '러버덕' 친구야. 사용자가 털어놓는 말에 한국어로 따뜻하고 "
        "짧게(최대 2문장) 공감하고, 부담을 덜어주는 작은 행동을 제안한다. 가끔 '삐약'이나 "
        "🦆를 자연스럽게 섞되 과하지 않게. 다그치지 않는다. JSON으로만 답해: "
        '{"message": "<한국어 한두 문장>", "mood": "encouraging|calm|cheer|focus"}'
    )
    ctx_lines: list[str] = []
    if checkin is not None:
        if checkin.energy_level is not None:
            ctx_lines.append(f"에너지(1~5): {checkin.energy_level}")
        if checkin.mood is not None:
            ctx_lines.append(f"기분(1~5): {checkin.mood}")
    if task_title:
        ctx_lines.append(f"관련 할 일: {task_title}")
    ctx = (" / ".join(ctx_lines)) if ctx_lines else "추가 맥락 없음"

    user = f"사용자: {note or '(말없이 러버덕을 톡 누름)'}\n현재 맥락: {ctx}"
    data = llm.chat_json(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.8,
        max_tokens=200,
    )
    if not data:
        return _reply_fallback(note, task_title)

    message = data.get("message")
    if not isinstance(message, str) or not message.strip():
        return _reply_fallback(note, task_title)
    mood = data.get("mood")
    if mood not in VALID_MOODS:
        mood = "encouraging"
    return DuckMessage(
        message=message.strip(),
        mood=mood,
        source=llm.llm_provider() or "fallback",
    )
