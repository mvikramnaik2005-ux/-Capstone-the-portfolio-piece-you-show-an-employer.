import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { PricingConfig, UsageSummary } from '../types/safeai';

interface TokenUsageViewProps {
  usage: UsageSummary;
  onUpdatePricing: (pricing: PricingConfig) => Promise<void>;
  onResetUsage: () => Promise<void>;
}

const PRICING_PRESETS: Array<{ label: string; input: number; output: number }> = [
  { label: 'Gemini Flash Ref ($0.10 / $0.40)', input: 0.1, output: 0.4 },
  { label: 'OpenAI gpt-4o-mini ($0.15 / $0.60)', input: 0.15, output: 0.6 },
  { label: 'OpenAI gpt-4o ($2.50 / $10.00)', input: 2.5, output: 10.0 },
];

export const TokenUsageView: React.FC<TokenUsageViewProps> = ({
  usage,
  onUpdatePricing,
  onResetUsage,
}) => {
  const [inRate, setInRate] = useState(String(usage.input_price_per_1m));
  const [outRate, setOutRate] = useState(String(usage.output_price_per_1m));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInRate(String(usage.input_price_per_1m));
    setOutRate(String(usage.output_price_per_1m));
  }, [usage.input_price_per_1m, usage.output_price_per_1m]);

  const applyPricing = async (inVal: number, outVal: number) => {
    setSaving(true);
    try {
      await onUpdatePricing({
        input_price_per_1m: Math.max(0, inVal),
        output_price_per_1m: Math.max(0, outVal),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedIn = Number.parseFloat(inRate);
    const parsedOut = Number.parseFloat(outRate);
    if (!Number.isFinite(parsedIn) || !Number.isFinite(parsedOut)) return;
    await applyPricing(parsedIn, parsedOut);
  };

  const inputRatio =
    usage.total_tokens > 0
      ? Math.round((usage.input_tokens / usage.total_tokens) * 100)
      : 50;
  const outputRatio = usage.total_tokens > 0 ? 100 - inputRatio : 50;

  return (
    <div className="space-y-6">
      {/* Estimated vs Actual Billing Notice */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-slate-100">
              Token Usage and Cost Estimation
            </h2>
            <p className="text-sm text-amber-300/90 mt-1.5 leading-relaxed">
              Estimated Cost vs. Actual Billed Cost: {usage.billing_disclaimer}
            </p>
          </div>
          <button
            type="button"
            onClick={onResetUsage}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 border border-[#1E293B] rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Session Usage
          </button>
        </div>
      </section>

      {/* 5 Usage KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
          <p className="text-xs text-slate-400">API Calls</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
            {usage.api_calls.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
          <p className="text-xs text-slate-400">Input Tokens</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
            {usage.input_tokens.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
          <p className="text-xs text-slate-400">Output Tokens</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
            {usage.output_tokens.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
          <p className="text-xs text-slate-400">Total Tokens</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
            {usage.total_tokens.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
          <p className="text-xs text-slate-400">Estimated Cost (USD)</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-400 mt-1.5">
            ${usage.estimated_cost_usd.toFixed(6)}
          </p>
        </div>
      </section>

      {/* Configurable Pricing + Token Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <section className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Configurable Model Pricing (USD / 1M Tokens)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Active model: <span className="font-mono text-slate-200">{usage.model}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRICING_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPricing(preset.input, preset.output)}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#0B1120] border border-[#1E293B] rounded-md hover:border-blue-500/60 transition-colors whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form onSubmit={handlePricingSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Input ($ / 1M)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={inRate}
                onChange={(e) => setInRate(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-md px-3 py-2 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Output ($ / 1M)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={outRate}
                onChange={(e) => setOutRate(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#1E293B] rounded-md px-3 py-2 text-sm font-mono tabular-nums text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Apply Rates'}
            </button>
          </form>
        </section>

        <section className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Token Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Split between prompt input tokens and generated completion tokens.
            </p>
          </div>

          <div className="space-y-3">
            <div className="h-3 bg-[#0B1120] rounded-full overflow-hidden flex border border-[#1E293B]">
              <div
                className="bg-blue-500 h-full transition-all duration-200"
                style={{ width: `${inputRatio}%` }}
              />
              <div
                className="bg-emerald-500 h-full transition-all duration-200"
                style={{ width: `${outputRatio}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-blue-400">
                Input: {usage.input_tokens.toLocaleString()} ({usage.total_tokens ? inputRatio : 0}%)
              </span>
              <span className="text-emerald-400">
                Output: {usage.output_tokens.toLocaleString()} ({usage.total_tokens ? outputRatio : 0}%)
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#1E293B] text-xs text-slate-400 flex items-center justify-between font-mono tabular-nums">
            <span>Layer 1 Blocked Calls (0 tokens)</span>
            <span>Never billed</span>
          </div>
        </section>
      </div>

      {/* API Call Ledger */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">
            API Token Ledger
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {usage.events.length} calls recorded
          </span>
        </div>

        {usage.events.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No live API calls recorded in this session yet. Send a question in Chat Assistant or run Evaluation to observe real token telemetry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0B1120] border-b border-[#1E293B] text-slate-400">
                  <th className="py-2.5 px-4 font-medium">Time</th>
                  <th className="py-2.5 px-4 font-medium">Source</th>
                  <th className="py-2.5 px-4 font-medium">Model</th>
                  <th className="py-2.5 px-4 font-medium text-right">Input</th>
                  <th className="py-2.5 px-4 font-medium text-right">Output</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total</th>
                  <th className="py-2.5 px-4 font-medium text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {usage.events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#0B1120]/60 h-10">
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-4 text-slate-200 capitalize">{evt.source}</td>
                    <td className="py-2 px-4 font-mono text-slate-300">{evt.model}</td>
                    <td className="py-2 px-4 font-mono tabular-nums text-right text-slate-300">
                      {evt.input_tokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-right text-slate-300">
                      {evt.output_tokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-right text-slate-100 font-medium">
                      {evt.total_tokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-right text-emerald-400">
                      ${evt.estimated_cost_usd.toFixed(6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
