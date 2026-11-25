import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Coins,
  FileSpreadsheet,
  Menu,
  MessageSquare,
  Shield,
  X,
} from 'lucide-react';
import { ChatAssistantView } from './components/ChatAssistantView';
import { EvaluationView } from './components/EvaluationView';
import { GuardrailsView } from './components/GuardrailsView';
import { ReportAndRepoView } from './components/ReportAndRepoView';
import { TokenUsageView } from './components/TokenUsageView';
import type {
  AssistantTurnResult,
  ChatEntry,
  EvaluationCase,
  EvaluationPayload,
  EvaluationResult,
  PricingConfig,
  RepoFileEntry,
  SafetyLogEntry,
  UsageSummary,
} from './types/safeai';

type NavTab = 'chat' | 'guardrails' | 'evaluation' | 'usage' | 'report';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof MessageSquare }> = [
  { id: 'chat', label: 'Chat Assistant', icon: MessageSquare },
  { id: 'guardrails', label: 'Safety and Guardrails', icon: Shield },
  { id: 'evaluation', label: 'Evaluation Dashboard', icon: BarChart3 },
  { id: 'usage', label: 'Token Usage Dashboard', icon: Coins },
  { id: 'report', label: 'Evaluation Report', icon: FileSpreadsheet },
];

const SUPPORTED_TOPICS = [
  'Python',
  'C Programming',
  'Java',
  'SQL',
  'Data Structures & Algorithms',
  'Artificial Intelligence',
  'Machine Learning',
  'Deep Learning',
  'Generative AI',
];

const INITIAL_USAGE: UsageSummary = {
  model: 'gemini-4-hydrogen',
  api_calls: 0,
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  input_price_per_1m: 0.1,
  output_price_per_1m: 0.4,
  estimated_cost_usd: 0,
  billing_disclaimer:
    'Estimated cost is calculated locally from recorded API token counts and configurable per-1M rates. It is an estimate only—check your API provider billing console for actual billed charges.',
  events: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [safetyLogs, setSafetyLogs] = useState<SafetyLogEntry[]>([]);
  const [evalCases, setEvalCases] = useState<EvaluationCase[]>([]);
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalProgress, setEvalProgress] = useState<{ completed: number; total: number } | null>(null);

  const [usage, setUsage] = useState<UsageSummary>(INITIAL_USAGE);
  const [repoFiles, setRepoFiles] = useState<RepoFileEntry[]>([]);

  const refreshTelemetry = useCallback(async () => {
    try {
      const [usageRes, logsRes] = await Promise.all([
        fetch('/api/usage'),
        fetch('/api/safety/logs'),
      ]);
      if (usageRes.ok) {
        const usageData = (await usageRes.json()) as UsageSummary;
        setUsage(usageData);
      }
      if (logsRes.ok) {
        const logsData = (await logsRes.json()) as { logs: SafetyLogEntry[] };
        setSafetyLogs(logsData.logs);
      }
    } catch {
      // Non-fatal refresh error
    }
  }, []);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [evalRes, repoRes] = await Promise.all([
          fetch('/api/evaluation'),
          fetch('/api/repo/files'),
        ]);
        if (evalRes.ok) {
          const data = (await evalRes.json()) as {
            cases: EvaluationCase[];
            evaluation: EvaluationPayload | null;
          };
          setEvalCases(data.cases);
          setEvaluation(data.evaluation);
        }
        if (repoRes.ok) {
          const repoData = (await repoRes.json()) as { files: RepoFileEntry[] };
          setRepoFiles(repoData.files);
        }
        await refreshTelemetry();
      } catch {
        setErrorBanner('Unable to initialize backend telemetry.');
      }
    };
    void loadInitial();
  }, [refreshTelemetry]);

  const handleSendMessage = async (message: string) => {
    setIsSending(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        throw new Error(`Chat API error (${res.status})`);
      }
      const turn = (await res.json()) as AssistantTurnResult;
      const entry: ChatEntry = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        user_input: message,
        result: turn,
      };
      setChatHistory((prev) => [...prev, entry]);
      await refreshTelemetry();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to communicate with SafeAI server.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRunLiveEvaluation = async () => {
    if (evalCases.length === 0 || isRunningEval) return;
    setIsRunningEval(true);
    setErrorBanner(null);
    setEvalProgress({ completed: 0, total: evalCases.length });

    const liveResults: EvaluationResult[] = [];
    try {
      for (let i = 0; i < evalCases.length; i += 1) {
        const current = evalCases[i];
        const res = await fetch('/api/evaluation/case', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test_id: current.test_id }),
        });
        if (!res.ok) {
          throw new Error(`Evaluation failed on ${current.test_id}`);
        }
        const data = (await res.json()) as {
          result: EvaluationResult;
          usage: UsageSummary;
        };
        liveResults.push(data.result);
        setUsage(data.usage);
        setEvalProgress({ completed: i + 1, total: evalCases.length });
      }

      const saveRes = await fetch('/api/evaluation/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: liveResults }),
      });
      if (saveRes.ok) {
        const saved = (await saveRes.json()) as { evaluation: EvaluationPayload };
        setEvaluation(saved.evaluation);
      }
      await refreshTelemetry();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Live evaluation run interrupted.');
    } finally {
      setIsRunningEval(false);
      setEvalProgress(null);
    }
  };

  const handleUpdatePricing = async (pricing: PricingConfig) => {
    const res = await fetch('/api/usage/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pricing),
    });
    if (res.ok) {
      const updated = (await res.json()) as UsageSummary;
      setUsage(updated);
    }
  };

  const handleResetUsage = async () => {
    const res = await fetch('/api/usage/reset', { method: 'POST' });
    if (res.ok) {
      const updated = (await res.json()) as UsageSummary;
      setUsage(updated);
    }
  };

  const activeNavMeta = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  const renderPrimaryAction = () => {
    if (activeTab === 'chat') {
      return (
        <button
          type="button"
          onClick={() => setChatHistory([])}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
        >
          New Session
        </button>
      );
    }
    if (activeTab === 'evaluation') {
      return (
        <button
          type="button"
          onClick={handleRunLiveEvaluation}
          disabled={isRunningEval}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          {isRunningEval ? 'Running Suite...' : 'Run Evaluation'}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setActiveTab('chat')}
        className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
      >
        Open Assistant
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-[#F1F5F9] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#111827] border-r border-[#1E293B]">
        <div>
          <div className="h-14 px-5 flex items-center border-b border-[#1E293B]">
            <span className="text-base font-bold tracking-tight text-white font-display whitespace-nowrap">
              SafeAI
            </span>
          </div>

          <nav className="p-3 space-y-1" aria-label="Primary Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#0B1120]/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mx-4 my-3 border-t border-[#1E293B] pt-4">
            <p className="text-xs font-medium text-slate-300 mb-2">
              Supported Domain
            </p>
            <ul className="space-y-1 text-xs text-slate-400">
              {SUPPORTED_TOPICS.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="p-4 border-t border-[#1E293B] space-y-2 text-xs text-slate-400">
          <div className="flex items-center justify-between font-mono tabular-nums">
            <span>Session Tokens</span>
            <span className="text-slate-200">{usage.total_tokens.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between font-mono tabular-nums">
            <span>Est. Cost</span>
            <span className="text-emerald-400">${usage.estimated_cost_usd.toFixed(5)}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Guardrails reduce risk via layered validation; no system guarantees 100% safety.
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 bg-[#111827] border-r border-[#1E293B] flex flex-col justify-between z-10">
            <div>
              <div className="h-14 px-5 flex items-center justify-between border-b border-[#1E293B]">
                <span className="text-base font-bold text-white">SafeAI</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="p-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-400'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 3-Zone Top Bar */}
        <header className="h-14 px-6 border-b border-[#1E293B] bg-[#111827] flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm whitespace-nowrap truncate">
              <span className="text-slate-400">SafeAI</span>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-100 truncate">
                {activeNavMeta.label}
              </h1>
            </div>
          </div>

          <div className="hidden md:block text-xs text-slate-400 whitespace-nowrap shrink-0">
            Programming &amp; AI Domain Assistant
          </div>

          <div className="shrink-0">{renderPrimaryAction()}</div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-[1280px] w-full mx-auto">
          {errorBanner && (
            <div className="mb-6 p-3.5 bg-red-950/40 border border-red-900/60 rounded-md flex items-center justify-between gap-4 text-xs text-red-200">
              <span>{errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-red-300 hover:text-white underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'chat' && (
            <ChatAssistantView
              chatHistory={chatHistory}
              isSending={isSending}
              onSendMessage={handleSendMessage}
              onClearHistory={() => setChatHistory([])}
            />
          )}

          {activeTab === 'guardrails' && (
            <GuardrailsView
              safetyLogs={safetyLogs}
              onProbeCompleted={refreshTelemetry}
            />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationView
              cases={evalCases}
              evaluation={evaluation}
              onRunLiveEvaluation={handleRunLiveEvaluation}
              isRunningEval={isRunningEval}
              evalProgress={evalProgress}
            />
          )}

          {activeTab === 'usage' && (
            <TokenUsageView
              usage={usage}
              onUpdatePricing={handleUpdatePricing}
              onResetUsage={handleResetUsage}
            />
          )}

          {activeTab === 'report' && (
            <ReportAndRepoView evaluation={evaluation} repoFiles={repoFiles} />
          )}
        </main>
      </div>
    </div>
  );
}
