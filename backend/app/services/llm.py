"""공급자 비종속 LLM 클라이언트.

GitHub Copilot(GitHub Models, OpenAI 호환 엔드포인트) 또는 Azure OpenAI를
같은 `openai` SDK로 호출한다. 자격증명이 없으면 항상 `None`을 돌려주어
호출부가 결정적 폴백으로 안전하게 위임할 수 있게 한다.

환경 변수:
- `COPILOT_SDK_TOKEN`        GitHub PAT(`models:read`) — GitHub Models 사용
- `COPILOT_SDK_BASE_URL`     (선택) 기본 ``https://models.github.ai/inference``
- `COPILOT_SDK_MODEL`        (선택) 기본 ``openai/gpt-4o-mini``
- `AZURE_OPENAI_API_KEY`     Azure OpenAI 키
- `AZURE_OPENAI_ENDPOINT`    예: ``https://<resource>.openai.azure.com``
- `AZURE_OPENAI_DEPLOYMENT`  배포(모델) 이름
- `AZURE_OPENAI_API_VERSION` (선택) 기본 ``2024-10-21``
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_GITHUB_BASE_URL = "https://models.github.ai/inference"
DEFAULT_GITHUB_MODEL = "openai/gpt-4o-mini"
DEFAULT_AZURE_API_VERSION = "2024-10-21"

# 공급자 식별자(러버덕 메시지 등의 source 표기에 재사용)
PROVIDER_COPILOT = "copilot-sdk"
PROVIDER_AZURE = "azure-openai"


def llm_provider() -> str | None:
    """설정된 자격증명에 따라 사용할 공급자 이름을 돌려준다(없으면 None)."""
    if os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT"):
        return PROVIDER_AZURE
    if os.getenv("COPILOT_SDK_TOKEN"):
        return PROVIDER_COPILOT
    return None


def llm_available() -> bool:
    """LLM 호출이 가능한지(자격증명 존재 여부)."""
    return llm_provider() is not None


def _build_client() -> tuple[Any, str] | None:
    """(client, model) 쌍을 구성한다. 실패하면 None."""
    provider = llm_provider()
    if provider is None:
        return None

    try:
        if provider == PROVIDER_AZURE:
            from openai import AzureOpenAI

            client = AzureOpenAI(
                api_key=os.environ["AZURE_OPENAI_API_KEY"],
                azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
                api_version=os.getenv(
                    "AZURE_OPENAI_API_VERSION", DEFAULT_AZURE_API_VERSION
                ),
            )
            model = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
            return client, model

        from openai import OpenAI

        client = OpenAI(
            api_key=os.environ["COPILOT_SDK_TOKEN"],
            base_url=os.getenv("COPILOT_SDK_BASE_URL", DEFAULT_GITHUB_BASE_URL),
        )
        model = os.getenv("COPILOT_SDK_MODEL", DEFAULT_GITHUB_MODEL)
        return client, model
    except Exception:  # noqa: BLE001 - 어떤 설정 오류든 폴백으로 위임
        logger.exception("LLM 클라이언트 구성 실패")
        return None


def chat(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.7,
    max_tokens: int = 400,
    json_mode: bool = False,
) -> str | None:
    """채팅 완성 호출. 성공 시 본문 텍스트, 실패/미설정 시 None.

    호출부는 반드시 None을 폴백으로 처리해야 한다(LLM은 선택적 고도화).
    """
    built = _build_client()
    if built is None:
        return None
    client, model = built

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        resp = client.chat.completions.create(**kwargs)
        content = resp.choices[0].message.content
        return content.strip() if content else None
    except Exception:  # noqa: BLE001 - 네트워크/요율/응답 오류는 폴백으로
        logger.exception("LLM 호출 실패 — 폴백 사용")
        return None


def chat_json(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.4,
    max_tokens: int = 500,
) -> dict[str, Any] | None:
    """JSON 응답을 기대하는 호출. 파싱 실패 시 None."""
    raw = chat(messages, temperature=temperature, max_tokens=max_tokens, json_mode=True)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError):
        logger.warning("LLM JSON 파싱 실패: %s", raw[:200])
        return None
