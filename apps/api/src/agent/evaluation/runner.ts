import { randomUUID } from 'node:crypto';
import { prisma } from '@workspace/db';
import { type LlmResponse, LlmService } from '../../llm/llm.service';
import { AgentService } from '../agent.service';
import { schemas } from '../tools';
import { createEvaluationScenarios } from './scenarios';
import type {
  EvaluationBaseline,
  EvaluationBaselineResult,
  EvaluationCheck,
  EvaluationMetrics,
  EvaluationMode,
  EvaluationReport,
  EvaluationScenario,
  EvaluationScenarioResult,
  EvaluationToolCallResult,
  EvaluationTurn,
  EvaluationTurnExpectations,
  EvaluationTurnResult,
  EvaluationUsage,
} from './types';

export class ReplayLlmService {
  private index = 0;

  constructor(private readonly responses: LlmResponse[]) {}

  async chat(): Promise<LlmResponse> {
    return this.nextResponse();
  }

  async chatStream(
    _messages: unknown[],
    _tools: unknown,
    onDelta: (delta: string) => void,
  ): Promise<LlmResponse> {
    const response = this.nextResponse();
    if (response.content) onDelta(response.content);
    return response;
  }

  private nextResponse(): LlmResponse {
    const response = this.responses[this.index];
    if (!response) {
      throw new Error(`The replay fixture ran out of responses after ${this.index} completion(s).`);
    }
    this.index++;
    return response;
  }
}

export interface EvaluationRunOptions {
  mode: EvaluationMode;
  scenarios?: EvaluationScenario[];
  liveLlmService?: LlmService;
  provider?: string;
  model?: string;
  baseline?: EvaluationBaseline;
  applyBaseline?: boolean;
  now?: Date;
}

interface CapturedTurn {
  response: string;
  toolCalls: EvaluationToolCallResult[];
  completions: LlmResponse[];
  error?: string;
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase();
}

export function containsSubset(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null;
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.every((expectedItem) =>
        actual.some((actualItem) => containsSubset(actualItem, expectedItem)),
      )
    );
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
      containsSubset((actual as Record<string, unknown>)[key], value),
    );
  }
  return Object.is(actual, expected);
}

function resultText(result: unknown): string {
  if (result === undefined) return '';
  try {
    return JSON.stringify(result) ?? String(result);
  } catch {
    return String(result);
  }
}

function isErrorResult(result: unknown): boolean {
  return (
    result !== null &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    typeof (result as { error?: unknown }).error === 'string'
  );
}

function check(
  id: string,
  category: EvaluationCheck['category'],
  passed: boolean,
  expected: unknown,
  actual: unknown,
  message: string,
): EvaluationCheck {
  return { id, category, passed, expected, actual, message };
}

export function evaluateTurn(turn: EvaluationTurn, captured: CapturedTurn): EvaluationTurnResult {
  const expectations: EvaluationTurnExpectations = turn.expectations;
  const checks: EvaluationCheck[] = [];
  const actualSequence = captured.toolCalls.map((call) => call.name);

  checks.push(
    check(
      'tool_sequence',
      'tool',
      actualSequence.join('\u0000') === expectations.toolSequence.join('\u0000'),
      expectations.toolSequence,
      actualSequence,
      'Tool sequence evaluation.',
    ),
  );

  for (const [index, expectation] of (expectations.arguments ?? []).entries()) {
    const actualCall = captured.toolCalls[expectation.callIndex];
    const passed = actualCall ? containsSubset(actualCall.args, expectation.contains) : false;
    checks.push(
      check(
        `arguments_${index}`,
        'arguments',
        passed,
        expectation.contains,
        actualCall?.args ?? null,
        `Tool call ${expectation.callIndex} argument evaluation.`,
      ),
    );
  }

  const response = captured.response;
  const normalizedResponse = normalizeText(response);
  const responseExpectations = expectations.response;

  for (const [index, expectedText] of (responseExpectations?.includes ?? []).entries()) {
    const passed = normalizedResponse.includes(normalizeText(expectedText));
    checks.push(
      check(
        `response_includes_${index}`,
        'response',
        passed,
        expectedText,
        response,
        `Required response text "${expectedText}" evaluation.`,
      ),
    );
  }

  for (const [index, alternatives] of (responseExpectations?.includesAny ?? []).entries()) {
    const passed = alternatives.some((alternative) =>
      normalizedResponse.includes(normalizeText(alternative)),
    );
    checks.push(
      check(
        `response_includes_any_${index}`,
        'response',
        passed,
        alternatives,
        response,
        `Accepted response alternatives (${alternatives.join(', ')}) evaluation.`,
      ),
    );
  }

  for (const [index, forbiddenText] of (responseExpectations?.excludes ?? []).entries()) {
    const passed = !normalizedResponse.includes(normalizeText(forbiddenText));
    checks.push(
      check(
        `response_excludes_${index}`,
        'response',
        passed,
        forbiddenText,
        response,
        `Forbidden response text "${forbiddenText}" evaluation.`,
      ),
    );
  }

  const combinedToolResults = captured.toolCalls.map((call) => resultText(call.result)).join('\n');
  for (const [index, entity] of (expectations.groundedEntities ?? []).entries()) {
    const inToolResult = normalizeText(combinedToolResults).includes(normalizeText(entity));
    const inResponse = normalizedResponse.includes(normalizeText(entity));
    checks.push(
      check(
        `grounded_entity_${index}`,
        'grounding',
        inToolResult && inResponse,
        { entity, inToolResult, inResponse },
        { entity, inToolResult, inResponse },
        `Entity "${entity}" grounding evaluation.`,
      ),
    );
  }

  for (const [index, callIndex] of (expectations.emptyResultCalls ?? []).entries()) {
    const result = captured.toolCalls[callIndex]?.result;
    const passed = Array.isArray(result) && result.length === 0;
    checks.push(
      check(
        `empty_result_${index}`,
        'grounding',
        passed,
        [],
        result ?? null,
        `Tool call ${callIndex} empty-result evaluation.`,
      ),
    );
  }

  for (const [index, callIndex] of (expectations.errorResultCalls ?? []).entries()) {
    const result = captured.toolCalls[callIndex]?.result;
    const passed = isErrorResult(result);
    checks.push(
      check(
        `error_result_${index}`,
        'grounding',
        passed,
        { error: 'string' },
        result ?? null,
        `Tool call ${callIndex} error-result evaluation.`,
      ),
    );
  }

  if (captured.error) {
    checks.push(
      check('runtime', 'runtime', false, null, captured.error, 'Evaluation turn runtime.'),
    );
  }

  const usage = usageFromCompletions(captured.completions);
  return {
    prompt: turn.prompt,
    response,
    durationMs: 0,
    toolCalls: captured.toolCalls,
    completionCount: captured.completions.length,
    usage,
    checks,
    passed: checks.every((item) => item.passed),
    ...(captured.error ? { error: captured.error } : {}),
  };
}

export function usageFromCompletions(completions: LlmResponse[]): EvaluationUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  for (const completion of completions) {
    const usage = completion.usage;
    if (!usage) continue;
    inputTokens += usage.inputTokens ?? 0;
    outputTokens += usage.outputTokens ?? 0;
    totalTokens += usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  }

  return { inputTokens, outputTokens, totalTokens };
}

function categoryAccuracy(
  checks: EvaluationCheck[],
  category: EvaluationCheck['category'],
): number {
  const matching = checks.filter((item) => item.category === category);
  if (matching.length === 0) return 1;
  return matching.filter((item) => item.passed).length / matching.length;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function calculateMetrics(scenarios: EvaluationScenarioResult[]): EvaluationMetrics {
  const turns = scenarios.flatMap((scenario) => scenario.turns);
  const checks = turns.flatMap((turn) => turn.checks);
  const toolCalls = turns.flatMap((turn) => turn.toolCalls);
  const durations = turns.map((turn) => turn.durationMs);
  const totalTokens = turns.reduce((sum, turn) => sum + turn.usage.totalTokens, 0);
  const passedScenarios = scenarios.filter((scenario) => scenario.passed).length;

  return {
    scenarioCount: scenarios.length,
    passedScenarios,
    failedScenarios: scenarios.length - passedScenarios,
    scenarioPassRate: scenarios.length > 0 ? passedScenarios / scenarios.length : 0,
    toolSelectionAccuracy: categoryAccuracy(checks, 'tool'),
    argumentValidity:
      toolCalls.length > 0
        ? toolCalls.filter((toolCall) => toolCall.valid).length / toolCalls.length
        : 0,
    argumentExpectationRate: categoryAccuracy(checks, 'arguments'),
    groundingRate: categoryAccuracy(checks, 'grounding'),
    responseAccuracy: categoryAccuracy(checks, 'response'),
    totalToolCalls: toolCalls.length,
    validToolCalls: toolCalls.filter((toolCall) => toolCall.valid).length,
    totalTokens,
    averageTokens: scenarios.length > 0 ? totalTokens / scenarios.length : 0,
    averageDurationMs:
      turns.length > 0 ? durations.reduce((sum, duration) => sum + duration, 0) / turns.length : 0,
    p95DurationMs: percentile(durations, 95),
  };
}

export function compareBaseline(
  metrics: EvaluationMetrics,
  baseline: EvaluationBaseline,
): EvaluationBaselineResult {
  const failures: string[] = [];
  const comparisons: Array<{
    metric: keyof EvaluationBaseline['thresholds'];
    threshold: number;
    actual: number;
  }> = [
    {
      metric: 'scenarioPassRate',
      threshold: baseline.thresholds.scenarioPassRate,
      actual: metrics.scenarioPassRate,
    },
    {
      metric: 'toolSelectionAccuracy',
      threshold: baseline.thresholds.toolSelectionAccuracy,
      actual: metrics.toolSelectionAccuracy,
    },
    {
      metric: 'argumentValidity',
      threshold: baseline.thresholds.argumentValidity,
      actual: metrics.argumentValidity,
    },
    {
      metric: 'argumentExpectationRate',
      threshold: baseline.thresholds.argumentExpectationRate,
      actual: metrics.argumentExpectationRate,
    },
    {
      metric: 'groundingRate',
      threshold: baseline.thresholds.groundingRate,
      actual: metrics.groundingRate,
    },
    {
      metric: 'responseAccuracy',
      threshold: baseline.thresholds.responseAccuracy,
      actual: metrics.responseAccuracy,
    },
  ];

  for (const comparison of comparisons) {
    if (comparison.actual < comparison.threshold) {
      failures.push(
        `${comparison.metric} ${comparison.actual.toFixed(3)} is below baseline ${comparison.threshold.toFixed(3)}.`,
      );
    }
  }

  return { checked: true, passed: failures.length === 0, failures };
}

export async function runEvaluation(options: EvaluationRunOptions): Promise<EvaluationReport> {
  const scenarios = options.scenarios ?? createEvaluationScenarios(options.now);
  const runId = randomUUID();
  const scenarioResults: EvaluationScenarioResult[] = [];

  for (const scenario of scenarios) {
    const llmService =
      options.mode === 'replay'
        ? (new ReplayLlmService(scenario.replay) as unknown as LlmService)
        : options.liveLlmService;
    if (!llmService) {
      throw new Error('A live LLM service is required when running live evaluations.');
    }

    const agentService = new AgentService(llmService);
    const accessSubject = `agent-eval:${runId}:${scenario.id}`;
    const turnResults: EvaluationTurnResult[] = [];
    let conversationId: string | undefined;

    try {
      for (const turn of scenario.turns) {
        const captured: CapturedTurn = {
          response: '',
          toolCalls: [],
          completions: [],
        };
        const localToolIndexes = new Map<number, number>();
        const startedAt = performance.now();

        try {
          const result = await agentService.chat(
            turn.prompt,
            conversationId,
            undefined,
            undefined,
            accessSubject,
            {
              onToolCall: ({ index, call }) => {
                const globalIndex = captured.toolCalls.length;
                localToolIndexes.set(index, globalIndex);
                const schema = schemas[call.name as keyof typeof schemas];
                captured.toolCalls.push({
                  index: globalIndex,
                  name: call.name,
                  args: call.args,
                  valid: schema ? schema.safeParse(call.args).success : false,
                });
              },
              onToolResult: ({ index, result }) => {
                const globalIndex = localToolIndexes.get(index);
                const toolCall = captured.toolCalls[globalIndex ?? index];
                if (toolCall) toolCall.result = result;
              },
              onCompletion: (response) => captured.completions.push(response),
            },
          );
          conversationId = result.conversationId;
          captured.response = result.content;
        } catch (error) {
          captured.error = error instanceof Error ? error.message : String(error);
        }

        const turnResult = evaluateTurn(turn, captured);
        turnResult.durationMs = performance.now() - startedAt;
        turnResults.push(turnResult);
        if (captured.error) break;
      }
    } finally {
      await prisma.conversation.deleteMany({ where: { accessSubject } });
    }

    scenarioResults.push({
      id: scenario.id,
      description: scenario.description,
      passed:
        turnResults.length === scenario.turns.length && turnResults.every((turn) => turn.passed),
      turns: turnResults,
    });
  }

  const metrics = calculateMetrics(scenarioResults);
  const baseline =
    options.mode === 'replay' && options.applyBaseline !== false && options.baseline
      ? compareBaseline(metrics, options.baseline)
      : { checked: false, passed: true, failures: [] };

  return {
    version: 1,
    passed: scenarioResults.every((scenario) => scenario.passed) && baseline.passed,
    mode: options.mode,
    provider: options.provider ?? (options.mode === 'replay' ? 'replay' : 'unknown'),
    model: options.model ?? (options.mode === 'replay' ? 'fixtures' : 'unknown'),
    generatedAt: (options.now ?? new Date()).toISOString(),
    metrics,
    baseline,
    scenarios: scenarioResults,
  };
}
