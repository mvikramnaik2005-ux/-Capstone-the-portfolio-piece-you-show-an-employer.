import React, { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type { EvaluationCase, EvaluationPayload, EvaluationResult } from '../types/safeai';

interface EvaluationViewProps {
  cases: EvaluationCase[];
  evaluation: EvaluationPayload | null;
  onRunLiveEvaluation: () => Promise<void>;
  isRunningEval: boolean;
  evalProgress: { completed: number; total: number } | null;
}

type GroupFilter = 'all' | 'programming' | 'ai_ml' | 'off_topic' | 'unsafe_injection' | 'failed';

export const EvaluationView: React.FC<EvaluationViewProps> = ({
  cases,
  evaluation,
  onRunLiveEvaluation,
  isRunningEval,
  evalProgress,
}) => {
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [selectedRow, setSelectedRow] = useState<EvaluationResult | null>(null);

  const metrics = evaluation?.metrics;
  const results = evaluation?.results ?? [];

  const filteredResults = useMemo(() => {
    if (filter === 'all') return results;
    if (filter === 'failed') return results.filter((r) => !r.passed);
    return results.filter((r) => r.group === filter);
  }, [filter, results]);

  const filterTabs: Array<{ id: GroupFilter; label: string }> = [
    { id: 'all', label: `All (${results.length})` },
    { id: 'programming', label: 'Programming' },
    { id: 'ai_ml', label: 'AI / ML' },
    { id: 'off_topic', label: 'Off-Topic' },
    { id: 'unsafe_injection', label: 'Unsafe / Injection' },
    {
      id: 'failed',
      label: `Failed (${results.filter((r) => !r.passed).length})`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            24-Case Evaluation Suite
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {evaluation?.evaluation_mode === 'live_run'
              ? `Live run completed at ${new Date(evaluation.generated_at).toLocaleTimeString()}`
              : 'Showing baseline reference evaluation results. Re-run live against Gemini API to verify real-time behavior.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onRunLiveEvaluation}
          disabled={isRunningEval || cases.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {isRunningEval && evalProgress
            ? `Evaluating ${evalProgress.completed} / ${evalProgress.total}...`
            : 'Run Live Evaluation'}
        </button>
      </section>

      {isRunningEval && evalProgress && (
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-mono tabular-nums">
            <span>Executing evaluation dataset sequentially against backend guardrails & LLM</span>
            <span>
              {evalProgress.completed} / {evalProgress.total}
            </span>
          </div>
          <div className="h-1.5 bg-[#0B1120] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-150"
              style={{
                width: `${Math.round((evalProgress.completed / Math.max(1, evalProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 6 Evaluation Metrics */}
      {metrics && (
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
            <p className="text-xs text-slate-400">Total Test Cases</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
              {metrics.total_test_cases}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
            <p className="text-xs text-slate-400">Passed Cases</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-400 mt-1.5">
              {metrics.passed_test_cases}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
            <p className="text-xs text-slate-400">Failed Cases</p>
            <p
              className={`text-2xl font-semibold font-mono tabular-nums mt-1.5 ${
                metrics.failed_test_cases > 0 ? 'text-red-400' : 'text-slate-100'
              }`}
            >
              {metrics.failed_test_cases}
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
            <p className="text-xs text-slate-400">Accuracy</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
              {metrics.accuracy_percentage.toFixed(1)}%
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
            <p className="text-xs text-slate-400">Off-Topic Rejection</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
              {metrics.off_topic_rejection_rate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
            <p className="text-xs text-slate-400">Unsafe Rejection</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1.5">
              {metrics.unsafe_request_rejection_rate.toFixed(1)}%
            </p>
          </div>
        </section>
      )}

      {/* Results Table */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B1120] border border-[#1E293B] rounded-md">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400">
            Click any row to inspect expected vs. actual behavior.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B1120] border-b border-[#1E293B] text-slate-400">
                <th className="py-2.5 px-4 font-medium">Test ID</th>
                <th className="py-2.5 px-4 font-medium">User Input</th>
                <th className="py-2.5 px-4 font-medium">Expected</th>
                <th className="py-2.5 px-4 font-medium">Actual Status</th>
                <th className="py-2.5 px-4 font-medium text-right">Tokens</th>
                <th className="py-2.5 px-4 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {filteredResults.map((row) => (
                <tr
                  key={row.test_id}
                  onClick={() => setSelectedRow(selectedRow?.test_id === row.test_id ? null : row)}
                  className="hover:bg-[#0B1120]/70 cursor-pointer h-10"
                >
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-200 whitespace-nowrap">
                    {row.test_id}
                  </td>
                  <td className="py-2.5 px-4 text-slate-200 max-w-md truncate">
                    {row.user_input}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                    {row.expected_category}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {row.safety_status}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-400 whitespace-nowrap">
                    {row.total_tokens.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 px-4 font-mono tabular-nums text-right font-semibold whitespace-nowrap ${
                      row.passed ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {row.passed ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedRow && (
          <div className="p-5 border-t border-[#1E293B] bg-[#0B1120] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-slate-100">
                {selectedRow.test_id} · {selectedRow.expected_category}
              </span>
              <span
                className={`font-mono font-semibold ${
                  selectedRow.passed ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {selectedRow.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
            <p className="text-slate-200">
              <span className="text-slate-400">Input: </span>
              {selectedRow.user_input}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-400">Expected Behavior: </span>
              {selectedRow.expected_behavior}
            </p>
            <p className="text-slate-300 font-mono">
              <span className="text-slate-400 font-sans">Actual Behavior: </span>
              {selectedRow.actual_behavior}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
