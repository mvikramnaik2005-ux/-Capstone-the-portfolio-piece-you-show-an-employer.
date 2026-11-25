"""Layered input validation, prompt injection defense, and safety guardrails."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from response_schema import SafeAIResponse


MAX_INPUT_CHARS = 4000

SUPPORTED_TOPICS = (
    "Python",
    "C Programming",
    "Java",
    "SQL",
    "Data Structures and Algorithms",
    "Artificial Intelligence",
    "Machine Learning",
    "Deep Learning",
    "Generative AI",
)

SUPPORTED_TOPICS_MESSAGE = (
    "I can only assist with Programming and Artificial Intelligence topics, including: "
    + ", ".join(SUPPORTED_TOPICS)
    + "."
)


@dataclass(frozen=True)
class GuardrailCheckResult:
    """Outcome of deterministic Layer 1 input and safety inspection."""

    passed_precheck: bool
    sanitized_input: str
    blocked_response: Optional[SafeAIResponse] = None
    matched_rule: Optional[str] = None


_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+|your\s+)?(previous|prior|above|system)\s+(instructions?|rules?|prompts?)", re.I),
    re.compile(r"disregard\s+(all\s+|your\s+)?(previous|system)\s+(instructions?|directives?)", re.I),
    re.compile(r"(reveal|show|print|repeat|leak|output|dump)\s+(your\s+)?(system\s+prompt|hidden\s+instructions?|developer\s+prompt|configuration|api\s*key)", re.I),
    re.compile(r"you\s+are\s+now\s+(dan|an?\s+unrestricted|jailbroken|evil|developer\s+mode)", re.I),
    re.compile(r"(act|behave|pretend)\s+as\s+if\s+(you\s+have\s+no|there\s+are\s+no)\s+(rules|restrictions|guardrails)", re.I),
    re.compile(r"<\s*/?\s*system\s*>|\[\s*SYSTEM\s*\]|###\s*SYSTEM\s+OVERRIDE", re.I),
]

_UNSAFE_INTENT_PATTERNS = [
    re.compile(r"\b(write|create|build|generate|give\s+me)\b.{0,40}\b(ransomware|keylogger|trojan|worm|malware|spyware|rootkit|exploit\s+payload)\b", re.I),
    re.compile(r"\b(how\s+to\s+)(hack\s+into|bypass\s+authentication|steal\s+(passwords?|credentials?|credit\s+cards?)|ddos|phish)\b", re.I),
    re.compile(r"\b(make|build|synthesize|create)\b.{0,30}\b(bomb|explosive|poison|illegal\s+drug|methamphetamine|weapon)\b", re.I),
    re.compile(r"\b(sql\s+injection\s+payload\s+to\s+dump|attack\s+a\s+production\s+database)\b", re.I),
    re.compile(r"\b(self[- ]harm|suicide\s+methods?)\b", re.I),
]


def sanitize_user_input(raw_input: str) -> str:
    """Normalize control characters without trusting user text."""
    if not isinstance(raw_input, str):
        return ""
    cleaned = raw_input.replace("\x00", "").strip()
    return cleaned


def run_input_guardrails(raw_input: Optional[str]) -> GuardrailCheckResult:
    """Run Layer 1 deterministic checks before calling the LLM.

    Note: Deterministic checks complement—never replace—the semantic classifier
    in assistant.py. No guardrail system can guarantee 100% safety against novel attacks.
    """
    if raw_input is None or not isinstance(raw_input, str):
        return GuardrailCheckResult(
            passed_precheck=False,
            sanitized_input="",
            matched_rule="invalid_type_or_null",
            blocked_response=SafeAIResponse(
                answer="Please enter a valid Programming or Artificial Intelligence question.",
                category="Invalid Input",
                allowed=False,
                refusal_reason="Input was empty or missing.",
                confidence=1.0,
                safety_status="INVALID_INPUT",
            ),
        )

    cleaned = sanitize_user_input(raw_input)
    if not cleaned:
        return GuardrailCheckResult(
            passed_precheck=False,
            sanitized_input="",
            matched_rule="empty_input",
            blocked_response=SafeAIResponse(
                answer="Your input is empty. Please ask a question about Python, C, Java, SQL, DSA, AI, ML, Deep Learning, or Generative AI.",
                category="Invalid Input",
                allowed=False,
                refusal_reason="Empty or whitespace-only input is not permitted.",
                confidence=1.0,
                safety_status="INVALID_INPUT",
            ),
        )

    if len(cleaned) > MAX_INPUT_CHARS:
        return GuardrailCheckResult(
            passed_precheck=False,
            sanitized_input=cleaned[:MAX_INPUT_CHARS],
            matched_rule="max_length_exceeded",
            blocked_response=SafeAIResponse(
                answer=(
                    f"Your input exceeds the maximum allowed length of {MAX_INPUT_CHARS} characters "
                    f"(received {len(cleaned)} characters). Please shorten your question and try again."
                ),
                category="Invalid Input",
                allowed=False,
                refusal_reason=f"Input length ({len(cleaned)}) exceeded {MAX_INPUT_CHARS} character limit.",
                confidence=1.0,
                safety_status="INVALID_INPUT",
            ),
        )

    for pattern in _INJECTION_PATTERNS:
        if pattern.search(cleaned):
            return GuardrailCheckResult(
                passed_precheck=False,
                sanitized_input=cleaned,
                matched_rule=f"prompt_injection:{pattern.pattern[:40]}",
                blocked_response=SafeAIResponse(
                    answer=(
                        "I cannot follow instructions that attempt to override system rules or "
                        "reveal internal configuration. " + SUPPORTED_TOPICS_MESSAGE
                    ),
                    category="Prompt Injection",
                    allowed=False,
                    refusal_reason="Detected prompt injection or system-instruction exfiltration attempt.",
                    confidence=0.98,
                    safety_status="INJECTION_BLOCKED",
                ),
            )

    for pattern in _UNSAFE_INTENT_PATTERNS:
        if pattern.search(cleaned):
            return GuardrailCheckResult(
                passed_precheck=False,
                sanitized_input=cleaned,
                matched_rule=f"unsafe_intent:{pattern.pattern[:40]}",
                blocked_response=SafeAIResponse(
                    answer=(
                        "I cannot assist with harmful, malicious, or illegal activities such as "
                        "creating malware, unauthorized system exploitation, or dangerous materials. "
                        + SUPPORTED_TOPICS_MESSAGE
                    ),
                    category="Unsafe",
                    allowed=False,
                    refusal_reason="Request involves harmful, malicious, or illegal activity.",
                    confidence=0.99,
                    safety_status="UNSAFE_REFUSED",
                ),
            )

    return GuardrailCheckResult(
        passed_precheck=True,
        sanitized_input=cleaned,
    )
