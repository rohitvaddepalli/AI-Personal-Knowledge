from __future__ import annotations

from app.llm.providers.openai_compatible import OpenAICompatibleProvider


class CustomProvider(OpenAICompatibleProvider):
    name = "custom"
