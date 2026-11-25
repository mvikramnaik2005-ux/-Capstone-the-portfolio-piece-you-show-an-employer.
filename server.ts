import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  askSafeAI,
  computeEvaluationMetrics,
  gradeEvaluationCase,
  listPythonRepoFiles,
  loadTestCases,
  runDiagnosticsSuite,
  runInputGuardrails,
  store,
} from './server/safeai.ts';
import type { EvaluationPayload, EvaluationResult } from './src/types/safeai.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Main Chat Assistant endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const message = req.body?.message;
      const result = await askSafeAI(message, 'chat');
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected server error';
      res.status(500).json({ error: msg });
    }
  });

  // Guardrail probe endpoint (dry-run Layer 1 or full pipeline)
  app.post('/api/guardrails/probe', async (req, res) => {
    try {
      const input = req.body?.input;
      const mode = req.body?.mode === 'full' ? 'full' : 'precheck';

      if (mode === 'precheck') {
        const pre = runInputGuardrails(input);
        res.json({
          mode: 'precheck',
          passed_precheck: pre.passed,
          matched_rule: pre.matchedRule ?? null,
          blocked_response: pre.blockedResponse ?? null,
        });
        return;
      }

      const result = await askSafeAI(input, 'probe');
      res.json({
        mode: 'full',
        result,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Guardrail probe failed';
      res.status(500).json({ error: msg });
    }
  });

  // Safety audit logs
  app.get('/api/safety/logs', (_req, res) => {
    res.json({ logs: store.safetyLogs });
  });

  // 10-scenario diagnostics runner
  app.post('/api/diagnostics/run-10', async (_req, res) => {
    try {
      const checks = await runDiagnosticsSuite();
      res.json({
        checks,
        usage: store.getUsageSummary(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Diagnostics failed';
      res.status(500).json({ error: msg });
    }
  });

  // Evaluation dataset & baseline/latest results
  app.get('/api/evaluation', (_req, res) => {
    const cases = loadTestCases();
    const evaluation = store.latestEvaluation;
    res.json({
      cases,
      evaluation,
    });
  });

  // Evaluate a single test case live
  app.post('/api/evaluation/case', async (req, res) => {
    try {
      const testId = String(req.body?.test_id ?? '');
      const cases = loadTestCases();
      const target = cases.find((c) => c.test_id === testId);
      if (!target) {
        res.status(404).json({ error: `Test case ${testId} not found.` });
        return;
      }
      const turn = await askSafeAI(target.user_input, 'evaluation');
      const graded = gradeEvaluationCase(target, turn);
      res.json({
        result: graded,
        usage: store.getUsageSummary(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Case evaluation failed';
      res.status(500).json({ error: msg });
    }
  });

  // Save completed live evaluation results in session store
  app.post('/api/evaluation/save', (req, res) => {
    const results = req.body?.results as EvaluationResult[] | undefined;
    if (!Array.isArray(results) || results.length === 0) {
      res.status(400).json({ error: 'Evaluation results array is required.' });
      return;
    }
    const metrics = computeEvaluationMetrics(results);
    const payload: EvaluationPayload = {
      generated_at: new Date().toISOString(),
      evaluation_mode: 'live_run',
      note: 'Live evaluation run executed via SafeAI backend pipeline.',
      metrics,
      results,
    };
    store.latestEvaluation = payload;
    res.json({ evaluation: payload });
  });

  // Usage & Cost tracking endpoints
  app.get('/api/usage', (_req, res) => {
    res.json(store.getUsageSummary());
  });

  app.post('/api/usage/pricing', (req, res) => {
    const inPrice = Number(req.body?.input_price_per_1m);
    const outPrice = Number(req.body?.output_price_per_1m);
    if (!Number.isFinite(inPrice) || inPrice < 0 || !Number.isFinite(outPrice) || outPrice < 0) {
      res.status(400).json({ error: 'Prices must be non-negative finite numbers.' });
      return;
    }
    store.pricing = {
      input_price_per_1m: inPrice,
      output_price_per_1m: outPrice,
    };
    res.json(store.getUsageSummary());
  });

  app.post('/api/usage/reset', (_req, res) => {
    store.resetUsage();
    res.json(store.getUsageSummary());
  });

  // Read-only Python repository explorer endpoint (strict allowlist + path confinement)
  app.get('/api/repo/files', (_req, res) => {
    try {
      const files = listPythonRepoFiles();
      res.json({ files });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to read repository files';
      res.status(500).json({ error: msg });
    }
  });

  // Vite middleware for dev, static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeAI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SafeAI server:', err);
  process.exit(1);
});
