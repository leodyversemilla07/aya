import type { LlmResponse, LlmToolCall } from '../../llm/llm.service';
import type { EvaluationScenario } from './types';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toolCall(name: string, args: Record<string, unknown>, id: string): LlmToolCall {
  return { id, name, args };
}

function toolStep(name: string, args: Record<string, unknown>, id: string): LlmResponse {
  return {
    content: '',
    toolCalls: [toolCall(name, args, id)],
    usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
  };
}

function answerStep(content: string): LlmResponse {
  return {
    content,
    toolCalls: [],
    usage: { inputTokens: 80, outputTokens: 60, totalTokens: 140 },
  };
}

export function createEvaluationScenarios(now = new Date()): EvaluationScenario[] {
  const today = formatDate(now);

  return [
    {
      id: 'bench-react-developer',
      description: 'Finds a React developer who is currently available on the bench.',
      turns: [
        {
          prompt: 'Which React developer is available on the bench right now?',
          expectations: {
            toolSequence: ['query_roster'],
            arguments: [{ callIndex: 0, contains: { skills: ['React'], onBench: true } }],
            response: {
              includes: ['Rico Tan'],
              excludes: ['Juan Dela Cruz', 'Pedro Reyes', 'Bea Villanueva'],
            },
            groundedEntities: ['Rico Tan'],
          },
        },
      ],
      replay: [
        toolStep('query_roster', { skills: ['React'], onBench: true }, 'replay-bench-react-tool'),
        answerStep('Rico Tan is the React developer currently available on the bench.'),
      ],
    },
    {
      id: 'senior-node-developers',
      description: 'Filters the roster by a skill and seniority.',
      turns: [
        {
          prompt: 'List senior developers who have Node.js experience.',
          expectations: {
            toolSequence: ['query_roster'],
            arguments: [{ callIndex: 0, contains: { skills: ['Node.js'], seniority: 'senior' } }],
            response: {
              includes: ['Ana Garcia', 'Juan Dela Cruz'],
              excludes: ['Rico Tan'],
            },
            groundedEntities: ['Ana Garcia', 'Juan Dela Cruz'],
          },
        },
      ],
      replay: [
        toolStep(
          'query_roster',
          { skills: ['Node.js'], seniority: 'senior' },
          'replay-senior-node-tool',
        ),
        answerStep(
          'The senior developers with Node.js experience are Ana Garcia and Juan Dela Cruz.',
        ),
      ],
    },
    {
      id: 'match-react-typescript-team',
      description: 'Ranks a React and TypeScript team for a new project.',
      turns: [
        {
          prompt: 'Match two developers with React and TypeScript for a project starting today.',
          expectations: {
            toolSequence: ['match_developers'],
            arguments: [
              {
                callIndex: 0,
                contains: {
                  requiredSkills: ['React', 'TypeScript'],
                  startDate: today,
                  teamSize: 2,
                },
              },
            ],
            response: {
              includes: ['Juan Dela Cruz', 'Bea Villanueva'],
              excludes: ['Rico Tan'],
            },
            groundedEntities: ['Juan Dela Cruz', 'Bea Villanueva'],
          },
        },
      ],
      replay: [
        toolStep(
          'match_developers',
          {
            requiredSkills: ['React', 'TypeScript'],
            startDate: today,
            teamSize: 2,
          },
          'replay-match-react-typescript-tool',
        ),
        answerStep(
          'Juan Dela Cruz is the strongest match, followed by Bea Villanueva for the React and TypeScript team.',
        ),
      ],
    },
    {
      id: 'unionbank-utilization',
      description: 'Calculates utilization for a named client.',
      turns: [
        {
          prompt: 'What is the current utilization at UnionBank?',
          expectations: {
            toolSequence: ['get_utilization'],
            arguments: [{ callIndex: 0, contains: { clientName: 'UnionBank' } }],
            response: {
              includesAny: [['100%', 'fully utilized', '3 of 3']],
            },
            groundedEntities: ['UnionBank'],
          },
        },
      ],
      replay: [
        toolStep(
          'get_utilization',
          { clientName: 'UnionBank' },
          'replay-unionbank-utilization-tool',
        ),
        answerStep('UnionBank is fully utilized at 100% (3 of 3 developers).'),
      ],
    },
    {
      id: 'contracts-expiring-in-thirty-days',
      description: 'Finds contracts expiring within a bounded window.',
      turns: [
        {
          prompt: 'Which contracts expire in the next 30 days?',
          expectations: {
            toolSequence: ['check_contracts'],
            arguments: [{ callIndex: 0, contains: { expiringWithin: 30 } }],
            groundedEntities: ['Bea Villanueva', 'Juan Dela Cruz', 'Jerome Bautista'],
          },
        },
      ],
      replay: [
        toolStep('check_contracts', { expiringWithin: 30 }, 'replay-expiring-contracts-tool'),
        answerStep(
          'Bea Villanueva expires in 5 days, Juan Dela Cruz in 10 days, and Jerome Bautista in 25 days.',
        ),
      ],
    },
    {
      id: 'unionbank-team-performance',
      description: 'Retrieves team performance for a client.',
      turns: [
        {
          prompt: 'Show me the performance records for the UnionBank team.',
          expectations: {
            toolSequence: ['get_performance'],
            arguments: [{ callIndex: 0, contains: { clientName: 'UnionBank' } }],
            groundedEntities: ['Ana Garcia', 'Juan Dela Cruz', 'Miguel Aquino'],
          },
        },
      ],
      replay: [
        toolStep(
          'get_performance',
          { clientName: 'UnionBank' },
          'replay-unionbank-performance-tool',
        ),
        answerStep(
          'The UnionBank performance records cover Ana Garcia, Juan Dela Cruz, and Miguel Aquino.',
        ),
      ],
    },
    {
      id: 'long-bench-alert',
      description: 'Reads bench-risk alerts without requesting every alert type.',
      turns: [
        {
          prompt: 'Are there developers who have been on the bench too long?',
          expectations: {
            toolSequence: ['get_alerts'],
            arguments: [{ callIndex: 0, contains: { type: 'bench' } }],
            response: {
              includesAny: [['45 days', '45-day']],
            },
            groundedEntities: ['Rico Tan'],
          },
        },
      ],
      replay: [
        toolStep('get_alerts', { type: 'bench' }, 'replay-bench-alert-tool'),
        answerStep(
          'Rico Tan has been on the bench for 45 days and should be prioritized for staffing.',
        ),
      ],
    },
    {
      id: 'all-staffing-alerts',
      description: 'Scans bench, contract, and performance risks together.',
      turns: [
        {
          prompt: 'Give me all current staffing alerts.',
          expectations: {
            toolSequence: ['get_alerts'],
            groundedEntities: ['Rico Tan', 'Bea Villanueva', 'Juan Dela Cruz'],
          },
        },
      ],
      replay: [
        toolStep('get_alerts', { type: 'all' }, 'replay-all-alerts-tool'),
        answerStep(
          'The alert scan includes bench risk for Rico Tan and contract risk for Bea Villanueva and Juan Dela Cruz.',
        ),
      ],
    },
    {
      id: 'ambiguous-client-contracts',
      description: 'Asks for clarification when a client name is ambiguous.',
      turns: [
        {
          prompt: 'Check the contracts for Bank.',
          expectations: {
            toolSequence: ['check_contracts'],
            arguments: [{ callIndex: 0, contains: { clientName: 'Bank' } }],
            response: {
              includesAny: [['multiple clients', 'which client', 'clarify']],
            },
            errorResultCalls: [0],
          },
        },
      ],
      replay: [
        toolStep('check_contracts', { clientName: 'Bank' }, 'replay-ambiguous-bank-tool'),
        answerStep(
          'Multiple clients matched Bank. Please clarify whether you mean UnionBank or Metrobank.',
        ),
      ],
    },
    {
      id: 'multi-turn-bench-follow-up',
      description: 'Uses conversation history for a bench-focused follow-up.',
      turns: [
        {
          prompt: 'Find developers with React experience.',
          expectations: {
            toolSequence: ['query_roster'],
            arguments: [{ callIndex: 0, contains: { skills: ['React'] } }],
            response: {
              includes: ['Juan Dela Cruz', 'Pedro Reyes', 'Bea Villanueva', 'Rico Tan'],
            },
            groundedEntities: ['Juan Dela Cruz', 'Pedro Reyes', 'Bea Villanueva', 'Rico Tan'],
          },
        },
        {
          prompt: 'Which of them is currently on the bench?',
          expectations: {
            toolSequence: ['query_roster'],
            arguments: [{ callIndex: 0, contains: { skills: ['React'], onBench: true } }],
            response: {
              includes: ['Rico Tan'],
              excludes: ['Juan Dela Cruz', 'Pedro Reyes', 'Bea Villanueva'],
            },
            groundedEntities: ['Rico Tan'],
          },
        },
      ],
      replay: [
        toolStep('query_roster', { skills: ['React'] }, 'replay-multi-turn-roster-tool'),
        answerStep(
          'The React developers are Juan Dela Cruz, Pedro Reyes, Bea Villanueva, and Rico Tan.',
        ),
        toolStep(
          'query_roster',
          { skills: ['React'], onBench: true },
          'replay-multi-turn-bench-tool',
        ),
        answerStep('Rico Tan is the one who is currently on the bench.'),
      ],
    },
    {
      id: 'no-developer-match',
      description: 'Explains an empty roster result without inventing candidates.',
      turns: [
        {
          prompt: 'Do we have any developers with COBOL experience?',
          expectations: {
            toolSequence: ['query_roster'],
            arguments: [{ callIndex: 0, contains: { skills: ['COBOL'] } }],
            response: {
              includesAny: [['no developers', 'no matching', 'nobody', 'no one']],
            },
            emptyResultCalls: [0],
          },
        },
      ],
      replay: [
        toolStep('query_roster', { skills: ['COBOL'] }, 'replay-no-match-tool'),
        answerStep('There are no developers matching the COBOL skill requirement.'),
      ],
    },
    {
      id: 'capacity-forecast-backfill',
      description: 'Forecasts upcoming openings and recommends a backfill from the bench.',
      turns: [
        {
          prompt:
            'Which contracts end in the next 8 weeks, and who from the bench should backfill them?',
          expectations: {
            toolSequence: ['forecast_capacity'],
            arguments: [{ callIndex: 0, contains: { weeks: 8 } }],
            response: {
              includesAny: [['UnionBank', 'Rico Tan']],
            },
            groundedEntities: ['UnionBank', 'Rico Tan'],
          },
        },
      ],
      replay: [
        toolStep('forecast_capacity', { weeks: 8 }, 'replay-capacity-forecast-tool'),
        answerStep(
          'The forecast shows Juan Dela Cruz leaving UnionBank soon, and Rico Tan is the recommended backfill from the bench.',
        ),
      ],
    },
    {
      id: 'unknown-client-error',
      description: 'Handles a missing client safely and asks for a correction.',
      turns: [
        {
          prompt: 'Show me developers currently assigned to Nonexistent Client.',
          expectations: {
            toolSequence: ['query_roster'],
            arguments: [{ callIndex: 0, contains: { currentClient: 'Nonexistent Client' } }],
            response: {
              includesAny: [['could not find', 'no client', 'not found', 'does not exist']],
            },
            errorResultCalls: [0],
          },
        },
      ],
      replay: [
        toolStep(
          'query_roster',
          { currentClient: 'Nonexistent Client' },
          'replay-unknown-client-tool',
        ),
        answerStep(
          'I could not find a client named Nonexistent Client. Please confirm the client name.',
        ),
      ],
    },
  ];
}
