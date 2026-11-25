export type SafetyStatus =
  | 'SAFE'
  | 'OFF_TOPIC_REFUSED'
  | 'UNSAFE_REFUSED'
  | 'INJECTION_BLOCKED'
  | 'INVALID_INPUT'
  | 'VALIDATION_ERROR'
  | 'API_ERROR';

export interface SafeAIResponse {
  answer: string;
  category: string;
  allowed: boolean;
  refusal_reason: string | null;
  confidence: number;
  safety_status: SafetyStatus;
}

export interface AssistantTurnResult {
  response: SafeAIResponse;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  guardrail_stage: string;
  latency_ms: number;
  model: string;
}

export interface ChatEntry {
  id: string;
  timestamp: string;
  user_input: string;
  result: AssistantTurnResult;
}

export interface SafetyLogEntry {
  id: string;
  timestamp: string;
  source: 'chat' | 'probe' | 'evaluation' | 'diagnostics';
  input_preview: string;
  category: string;
  allowed: boolean;
  safety_status: SafetyStatus;
  refusal_reason: string | null;
  guardrail_stage: string;
  confidence: number;
}

export interface EvaluationCase {
  test_id: string;
  group: 'programming' | 'ai_ml' | 'off_topic' | 'unsafe_injection';
  user_input: string;
  expected_category: string;
  expected_allowed: boolean;
  expected_behavior: string;
}

export interface EvaluationResult extends EvaluationCase {
  actual_category: string;
  actual_behavior: string;
  allowed: boolean;
  safety_status: SafetyStatus;
  confidence: number;
  passed: boolean;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  latency_ms?: number;
}

export interface EvaluationMetrics {
  total_test_cases: number;
  passed_test_cases: number;
  failed_test_cases: number;
  accuracy_percentage: number;
  off_topic_rejection_rate: number;
  unsafe_request_rejection_rate: number;
}

export interface EvaluationPayload {
  generated_at: string;
  evaluation_mode: 'baseline_reference' | 'live_run';
  note?: string;
  metrics: EvaluationMetrics;
  results: EvaluationResult[];
}

export interface PricingConfig {
  input_price_per_1m: number;
  output_price_per_1m: number;
}

export interface UsageEvent {
  id: string;
  timestamp: string;
  source: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
}

export interface UsageSummary {
  model: string;
  api_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_price_per_1m: number;
  output_price_per_1m: number;
  estimated_cost_usd: number;
  billing_disclaimer: string;
  events: UsageEvent[];
}

export interface DiagnosticCheckItem {
  id: number;
  name: string;
  input_summary: string;
  expected: string;
  actual_status: SafetyStatus;
  allowed: boolean;
  passed: boolean;
  detail: string;
}

export interface RepoFileEntry {
  path: string;
  language: string;
  content: string;
}
