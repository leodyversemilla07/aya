import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getProviderConfig } from '@workspace/ai';
import { prisma } from '@workspace/db';
import { getServerEnv } from '@workspace/env';
import { LlmService } from '../../llm/llm.service';
import { runEvaluation } from './runner';
import { createEvaluationScenarios } from './scenarios';
import type { EvaluationBaseline, EvaluationMode, EvaluationReport } from './types';

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function parseMode(value: string | undefined): EvaluationMode {
  const mode = value ?? 'replay';
  if (mode !== 'replay' && mode !== 'live') {
    throw new Error(`Unsupported evaluation mode "${mode}". Use replay or live.`);
  }
  return mode;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (!serialized) return String(value);
  return serialized.length > 240 ? `${serialized.slice(0, 237)}...` : serialized;
}

function printReport(report: EvaluationReport, reportPath: string): void {
  console.log(`\nAgent evaluation (${report.mode})`);
  console.log('='.repeat(72));

  for (const scenario of report.scenarios) {
    const marker = scenario.passed ? 'PASS' : 'FAIL';
    console.log(`${marker.padEnd(4)}  ${scenario.id}`);
    if (!scenario.passed) {
      for (const turn of scenario.turns) {
        for (const item of turn.checks.filter((check) => !check.passed)) {
          console.log(
            `      - ${item.message} Expected ${formatValue(item.expected)}, got ${formatValue(item.actual)}`,
          );
        }
      }
      if (scenario.error) console.log(`      - ${scenario.error}`);
    }
  }

  const metrics = report.metrics;
  console.log('\nMetrics');
  console.log(`  Scenarios:       ${metrics.passedScenarios}/${metrics.scenarioCount} passed`);
  console.log(`  Tool selection:  ${formatPercent(metrics.toolSelectionAccuracy)}`);
  console.log(`  Argument validity: ${formatPercent(metrics.argumentValidity)}`);
  console.log(`  Argument expectations: ${formatPercent(metrics.argumentExpectationRate)}`);
  console.log(`  Grounding:       ${formatPercent(metrics.groundingRate)}`);
  console.log(`  Response checks: ${formatPercent(metrics.responseAccuracy)}`);
  console.log(`  Tool calls:      ${metrics.validToolCalls}/${metrics.totalToolCalls} valid`);
  console.log(`  Tokens:          ${Math.round(metrics.totalTokens)} total`);
  console.log(
    `  Latency:         ${metrics.averageDurationMs.toFixed(1)}ms average, ${metrics.p95DurationMs.toFixed(1)}ms p95`,
  );

  if (report.baseline.checked) {
    console.log(
      `  Baseline:        ${report.baseline.passed ? 'passed' : report.baseline.failures.join(' ')}`,
    );
  }

  console.log(`\nReport: ${reportPath}`);
}

async function main(): Promise<void> {
  const mode = parseMode(argumentValue('mode'));
  const scenarioId = argumentValue('scenario');
  const reportPath = resolve(
    process.cwd(),
    argumentValue('report') ?? `evaluation/reports/${mode}.json`,
  );

  // Loading the server environment also loads the root .env file, which makes
  // provider credentials available to the live evaluation mode.
  getServerEnv();

  let provider = 'replay';
  let model = 'fixtures';
  let liveLlmService: LlmService | undefined;
  if (mode === 'live') {
    const config = getProviderConfig();
    provider = config.provider;
    model = config.model;
    liveLlmService = new LlmService();
  }

  const baselinePath = resolve(__dirname, '../../../evaluation/baseline.json');
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as EvaluationBaseline;
  const allScenarios = createEvaluationScenarios();
  const scenarios = scenarioId
    ? allScenarios.filter((scenario) => scenario.id === scenarioId)
    : allScenarios;
  if (scenarios.length === 0) {
    throw new Error(`No evaluation scenario matched "${scenarioId}".`);
  }

  const report = await runEvaluation({
    mode,
    scenarios,
    liveLlmService,
    provider,
    model,
    baseline,
    applyBaseline: !scenarioId,
  });

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  printReport(report, reportPath);

  if (!report.passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
