import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import type { EvaluationPayload, RepoFileEntry } from '../types/safeai';

interface ReportAndRepoViewProps {
  evaluation: EvaluationPayload | null;
  repoFiles: RepoFileEntry[];
}

function escapeCsvField(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const ReportAndRepoView: React.FC<ReportAndRepoViewProps> = ({
  evaluation,
  repoFiles,
}) => {
  const [selectedPath, setSelectedPath] = useState<string>(
    repoFiles[0]?.path ?? 'safeai-assistant/README.md'
  );
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const activeFile = useMemo(
    () => repoFiles.find((f) => f.path === selectedPath) ?? repoFiles[0] ?? null,
    [repoFiles, selectedPath]
  );

  const csvContent = useMemo(() => {
    const results = evaluation?.results ?? [];
    const headers = [
      'test_id',
      'group',
      'user_input',
      'expected_category',
      'expected_behavior',
      'actual_category',
      'actual_behavior',
      'allowed',
      'safety_status',
      'confidence',
      'passed',
      'total_tokens',
      'estimated_cost_usd',
    ];
    const lines = [headers.join(',')];
    for (const row of results) {
      lines.push(
        headers.map((h) => escapeCsvField((row as unknown as Record<string, unknown>)[h])).join(',')
      );
    }
    return lines.join('\n');
  }, [evaluation]);

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleCopyFile = async (file: RepoFileEntry) => {
    await navigator.clipboard.writeText(file.content);
    setCopiedPath(file.path);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Report Export Header */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Evaluation Report &amp; Python Repository Export
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Download structured CSV or JSON evaluation reports and inspect the complete GitHub-ready Python/Streamlit codebase (`safeai-guardrailed-assistant`).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!evaluation}
            onClick={() =>
              triggerDownload('evaluation_report.csv', csvContent, 'text/csv;charset=utf-8;')
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV Report
          </button>
          <button
            type="button"
            disabled={!evaluation}
            onClick={() =>
              triggerDownload(
                'evaluation_results.json',
                JSON.stringify(evaluation, null, 2),
                'application/json'
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 border border-[#1E293B] bg-[#0B1120] rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download JSON Results
          </button>
        </div>
      </section>

      {/* CSV Preview */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1E293B] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            CSV Report Preview (reports/evaluation_report.csv)
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {evaluation?.results.length ?? 0} rows
          </span>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-300 bg-[#0B1120] overflow-x-auto max-h-64 leading-relaxed">
          {csvContent}
        </pre>
      </section>

      {/* Python / Streamlit / OpenAI Repository Explorer */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Standalone Python / Streamlit Repository (safeai-assistant/)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Complete modular source ready for public GitHub repository `safeai-guardrailed-assistant`.
            </p>
          </div>
          {activeFile && (
            <button
              type="button"
              onClick={() => handleCopyFile(activeFile)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 border border-[#1E293B] bg-[#0B1120] rounded-md hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
            >
              {copiedPath === activeFile.path ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy File
                </>
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#1E293B] bg-[#0B1120] divide-y divide-[#1E293B]">
            {repoFiles.map((file) => {
              const isSelected = activeFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full text-left px-4 py-2.5 text-xs font-mono flex items-center gap-2 transition-colors ${
                    isSelected
                      ? 'bg-blue-600/15 text-blue-300 font-medium'
                      : 'text-slate-300 hover:bg-[#111827]'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 bg-[#0B1120] overflow-auto max-h-[520px]">
            {activeFile ? (
              <pre className="p-4 text-xs font-mono text-slate-200 leading-relaxed whitespace-pre">
                {activeFile.content}
              </pre>
            ) : (
              <div className="p-8 text-sm text-slate-400">Loading repository files...</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
