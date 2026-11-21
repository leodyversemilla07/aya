import type { LlmResponse } from '../../llm/llm.service';

export type EvaluationMode = 'replay' | 'live';

export type EvaluationCheckCategory = 'tool' | 'arguments' | 'response' | 'grounding' | 'runtime';

export interface EvaluationResponseExpectations {
  includes?: string[];
  includesAny?: string[][];
  excludes?: string[];
}

export interface EvaluationArgumentExpectation {
  callIndex: number;
  contains: Record<string, unknown>;
}

export interface EvaluationTurnExpectations {
  toolSequence: string[];
  arguments?: EvaluationArgumentExpectation[];
  response?: EvaluationResponseExpectations;
  groundedEntities?: string[];
  emptyResultCalls?: number[];
  errorResultCalls?: number[];
}

export interface EvaluationTurn {
  prompt: string;
  expectations: EvaluationTurnExpectations;
}

export interface EvaluationScenario {
  id: string;
  description: string;
  turns: EvaluationTurn[];
  replay: LlmResponse[];
}

export interface EvaluationCheck {
  id: string;
  category: EvaluationCheckCategory;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface EvaluationToolCallResult {
  index: number;
  name: string;
  args: Record<string, unknown>;
  valid: boolean;
  result?: unknown;
}

export interface EvaluationUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface EvaluationTurnResult {
  prompt: string;
  response: string;
  durationMs: number;
  toolCalls: EvaluationToolCallResult[];
  completionCount: number;
  usage: EvaluationUsage;
  checks: EvaluationCheck[];
  passed: boolean;
  error?: string;
}

export interface EvaluationScenarioResult {
  id: string;
  description: string;
  passed: boolean;
  turns: EvaluationTurnResult[];
  error?: string;
}

export interface EvaluationMetrics {
  scenarioCount: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarioPassRate: number;
  toolSelectionAccuracy: number;
  argumentValidity: number;
  argumentExpectationRate: number;
  groundingRate: number;
  responseAccuracy: number;
  totalToolCalls: number;
  validToolCalls: number;
  totalTokens: number;
  averageTokens: number;
  averageDurationMs: number;
  p95DurationMs: number;
}

export interface EvaluationBaselineThresholds {
  scenarioPassRate: number;
  toolSelectionAccuracy: number;
  argumentValidity: number;
  argumentExpectationRate: number;
  groundingRate: number;
  responseAccuracy: number;
}

export interface EvaluationBaseline {
  version: number;
  mode: EvaluationMode;
  thresholds: EvaluationBaselineThresholds;
}

export interface EvaluationBaselineResult {
  checked: boolean;
  passed: boolean;
  failures: string[];
}

export interface EvaluationReport {
  version: number;
  passed: boolean;
  mode: EvaluationMode;
  provider: string;
  model: string;
  generatedAt: string;
  metrics: EvaluationMetrics;
  baseline: EvaluationBaselineResult;
  scenarios: EvaluationScenarioResult[];
}
