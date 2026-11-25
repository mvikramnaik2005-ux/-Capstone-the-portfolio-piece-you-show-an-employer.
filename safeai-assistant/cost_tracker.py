"""Token usage tracking and configurable API cost estimation for SafeAI."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List


# Published reference rates (USD per 1,000,000 tokens). Always keep configurable.
DEFAULT_MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "gpt-4o-mini": {"input_per_1m": 0.15, "output_per_1m": 0.60},
    "gpt-4o": {"input_per_1m": 2.50, "output_per_1m": 10.00},
    "gpt-4.1-mini": {"input_per_1m": 0.40, "output_per_1m": 1.60},
}


@dataclass
class UsageEvent:
    """Single API call token and cost record."""

    timestamp: str
    source: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    estimated_cost_usd: float


@dataclass
class CostTracker:
    """Tracks real token consumption and calculates configurable estimated costs.

    Important: `estimated_cost_usd` is an estimate computed from recorded token counts
    and configured unit prices. It is NOT an actual provider billing invoice.
    """

    model: str = "gpt-4o-mini"
    input_price_per_1m: float = 0.15
    output_price_per_1m: float = 0.60
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    api_calls: int = 0
    events: List[UsageEvent] = field(default_factory=list)

    def configure_pricing(self, input_price_per_1m: float, output_price_per_1m: float) -> None:
        self.input_price_per_1m = max(0.0, float(input_price_per_1m))
        self.output_price_per_1m = max(0.0, float(output_price_per_1m))

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        input_cost = (max(0, input_tokens) / 1_000_000.0) * self.input_price_per_1m
        output_cost = (max(0, output_tokens) / 1_000_000.0) * self.output_price_per_1m
        return round(input_cost + output_cost, 8)

    def record_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        source: str = "chat",
        model: str | None = None,
    ) -> UsageEvent:
        in_tok = max(0, int(input_tokens))
        out_tok = max(0, int(output_tokens))
        tot_tok = in_tok + out_tok
        est_cost = self.calculate_cost(in_tok, out_tok)

        self.input_tokens += in_tok
        self.output_tokens += out_tok
        self.total_tokens += tot_tok
        self.api_calls += 1

        event = UsageEvent(
            timestamp=datetime.now(timezone.utc).isoformat(),
            source=source,
            model=model or self.model,
            input_tokens=in_tok,
            output_tokens=out_tok,
            total_tokens=tot_tok,
            estimated_cost_usd=est_cost,
        )
        self.events.append(event)
        return event

    @property
    def estimated_total_cost_usd(self) -> float:
        return self.calculate_cost(self.input_tokens, self.output_tokens)

    def summary(self) -> Dict[str, object]:
        return {
            "model": self.model,
            "api_calls": self.api_calls,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "input_price_per_1m": self.input_price_per_1m,
            "output_price_per_1m": self.output_price_per_1m,
            "estimated_cost_usd": self.estimated_total_cost_usd,
            "billing_disclaimer": (
                "Estimated cost calculated from recorded token counts and configured per-1M rates. "
                "Check your provider billing dashboard for actual billed charges."
            ),
        }

    def reset(self) -> None:
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_tokens = 0
        self.api_calls = 0
        self.events.clear()
