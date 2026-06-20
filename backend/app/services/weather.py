"""외부 날씨 데이터 수집 서비스.

Open-Meteo(https://open-meteo.com) — API 키가 필요 없는 무료 날씨 API를 사용한다.
현재 기온(°C), 상대습도(%), 날씨 상태(코드→한글)를 가져온다.

네트워크가 없는 환경(테스트 등)에서는 이 모듈을 호출하지 않고, 라우터에서
수동 입력 페이로드로 직접 저장할 수 있게 분리했다.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_TIMEOUT = 8.0

# WMO weather interpretation code → 한글 상태
# https://open-meteo.com/en/docs (weather_code)
WMO_CONDITION: dict[int, str] = {
    0: "맑음",
    1: "대체로 맑음",
    2: "부분적 구름",
    3: "흐림",
    45: "안개",
    48: "서리 안개",
    51: "약한 이슬비",
    53: "이슬비",
    55: "강한 이슬비",
    61: "약한 비",
    63: "비",
    65: "강한 비",
    66: "어는 비",
    67: "강한 어는 비",
    71: "약한 눈",
    73: "눈",
    75: "강한 눈",
    77: "싸락눈",
    80: "약한 소나기",
    81: "소나기",
    82: "강한 소나기",
    85: "약한 눈 소나기",
    86: "강한 눈 소나기",
    95: "뇌우",
    96: "우박 동반 뇌우",
    99: "강한 우박 동반 뇌우",
}


@dataclass
class WeatherReading:
    """외부 API에서 가져온 현재 날씨 1건."""

    temperature_c: float | None
    humidity_pct: int | None
    condition: str | None
    source: str = "open-meteo"


def condition_from_code(code: int | None) -> str | None:
    if code is None:
        return None
    return WMO_CONDITION.get(int(code), f"코드 {code}")


def fetch_current_weather(
    latitude: float,
    longitude: float,
    *,
    timeout: float = DEFAULT_TIMEOUT,
) -> WeatherReading:
    """Open-Meteo에서 현재 날씨를 가져온다. 실패 시 httpx 예외를 그대로 올린다."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,weather_code",
    }
    resp = httpx.get(OPEN_METEO_URL, params=params, timeout=timeout)
    resp.raise_for_status()
    current = resp.json().get("current", {})
    return WeatherReading(
        temperature_c=current.get("temperature_2m"),
        humidity_pct=current.get("relative_humidity_2m"),
        condition=condition_from_code(current.get("weather_code")),
        source="open-meteo",
    )
