"""Pydantic response schema and validation helpers for SafeAI."""

from __future__ import annotations

import json
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


SafetyStatus = Literal[
    "SAFE",
    "OFF_TOPIC_REFUSED",
    "UNSAFE_REFUSED",
    "INJECTION_BLOCKED",
    "INVALID_INPUT",
    "VALIDATION_ERROR",
    "API_ERROR",
]


class SafeAIResponse(BaseModel):
    """Structured output contract enforced on every SafeAI response."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    answer: str = Field(
        ...,
        min_length=1,
        description="Helpful domain answer or polite refusal explanation.",
    )
    category: str = Field(
        ...,
        min_length=1,
        description="Classified domain or guardrail category.",
    )
    allowed: bool = Field(
        ...,
        description="Whether the user request was permitted within domain and safety policies.",
    )
    refusal_reason: Optional[str] = Field(
        default=None,
        description="Explicit reason if the request was refused; null when allowed.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0.",
    )
    safety_status: SafetyStatus = Field(
        ...,
        description="Machine-readable safety outcome tag.",
    )

    @field_validator("refusal_reason")
    @classmethod
    def validate_refusal_consistency(
        cls, value: Optional[str], info
    ) -> Optional[str]:
        allowed = info.data.get("allowed")
        if allowed is False and (value is None or not value.strip()):
            raise ValueError("refusal_reason must be provided when allowed is False.")
        return value


def parse_and_validate_response(raw_payload: str | dict) -> SafeAIResponse:
    """Parse raw model output (JSON string or dict) and validate with Pydantic."""
    if isinstance(raw_payload, str):
        parsed = json.loads(raw_payload)
    elif isinstance(raw_payload, dict):
        parsed = raw_payload
    else:
        raise ValueError(f"Unsupported response payload type: {type(raw_payload).__name__}")

    return SafeAIResponse.model_validate(parsed)


def build_fallback_error_response(
    reason: str,
    safety_status: SafetyStatus = "VALIDATION_ERROR",
    category: str = "System Error",
) -> SafeAIResponse:
    """Create a safe, schema-compliant fallback response on validation or API failure."""
    return SafeAIResponse(
        answer=(
            "I could not complete that request safely due to an internal validation "
            f"or upstream service issue ({reason}). Please try rephrasing your question."
        ),
        category=category,
        allowed=False,
        refusal_reason=reason,
        confidence=1.0,
        safety_status=safety_status,
    )
