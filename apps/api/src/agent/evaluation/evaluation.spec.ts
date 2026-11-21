import type { LlmResponse } from '../../llm/llm.service';
import { schemas } from '../tools';
import { containsSubset, evaluateTurn } from './runner';
import { createEvaluationScenarios } from './scenarios';

describe('agent evaluation fixtures', () => {
  it('uses valid arguments for every replayed tool call', () => {
    for (const scenario of createEvaluationScenarios(new Date('2026-11-21T00:00:00.000Z'))) {
      const replayedCalls = scenario.replay.flatMap((response) => response.toolCalls);
      const expectedCalls = scenario.turns.reduce(
        (count, turn) => count + turn.expectations.toolSequence.length,
        0,
      );

      expect(replayedCalls).toHaveLength(expectedCalls);
      for (const call of replayedCalls) {
        const schema = schemas[call.name as keyof typeof schemas];
        expect(schema).toBeDefined();
        expect(schema.safeParse(call.args).success).toBe(true);
      }
    }
  });

  it('matches partial nested arguments and array subsets', () => {
    expect(
      containsSubset(
        { requiredSkills: ['React', 'TypeScript'], teamSize: 3 },
        { requiredSkills: ['React', 'TypeScript'] },
      ),
    ).toBe(true);
    expect(containsSubset({ requiredSkills: ['React'] }, { requiredSkills: ['Vue'] })).toBe(false);
    expect(containsSubset({ availableAfter: null }, { availableAfter: null })).toBe(true);
  });

  it('evaluates tool selection, arguments, response, and grounding', () => {
    const completion: LlmResponse = {
      content: 'Rico Tan is available.',
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    };
    const result = evaluateTurn(
      {
        prompt: 'Who is on the bench?',
        expectations: {
          toolSequence: ['query_roster'],
          arguments: [{ callIndex: 0, contains: { skills: ['React'], onBench: true } }],
          response: { includes: ['Rico Tan'], excludes: ['Juan Dela Cruz'] },
          groundedEntities: ['Rico Tan'],
        },
      },
      {
        response: completion.content,
        toolCalls: [
          {
            index: 0,
            name: 'query_roster',
            args: { skills: ['React'], onBench: true },
            valid: true,
            result: [{ name: 'Rico Tan', onBench: true }],
          },
        ],
        completions: [completion],
      },
    );

    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.usage.totalTokens).toBe(15);
  });

  it('fails when a grounded entity is absent from the tool result', () => {
    const result = evaluateTurn(
      {
        prompt: 'Who is on the bench?',
        expectations: {
          toolSequence: ['query_roster'],
          groundedEntities: ['Rico Tan'],
        },
      },
      {
        response: 'Rico Tan is available.',
        toolCalls: [
          {
            index: 0,
            name: 'query_roster',
            args: {},
            valid: true,
            result: [{ name: 'Bea Villanueva' }],
          },
        ],
        completions: [],
      },
    );

    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === 'grounded_entity_0')?.passed).toBe(false);
  });
});
