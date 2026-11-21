import {
  type ForecastContract,
  type ForecastDeveloper,
  availabilityFor,
  buildForecast,
  buildTimeline,
  scoreCandidate,
} from './forecast';

const TODAY = new Date('2026-03-02T00:00:00.000Z');

function daysFromToday(days: number): Date {
  return new Date(TODAY.getTime() + days * 24 * 60 * 60 * 1000);
}

function developer(overrides: Partial<ForecastDeveloper> = {}): ForecastDeveloper {
  return {
    id: 'dev-1',
    name: 'Ana Developer',
    role: 'Software Engineer',
    seniority: 'senior',
    benchSince: null,
    skills: [{ name: 'React', level: 'advanced', yearsExp: 4 }],
    assignments: [],
    performance: null,
    ...overrides,
  };
}

function contract(overrides: Partial<ForecastContract> = {}): ForecastContract {
  return {
    id: 'contract-1',
    developerId: 'dev-1',
    clientId: 'client-1',
    clientName: 'Acme',
    clientIndustry: 'fintech',
    startDate: daysFromToday(-180),
    endDate: daysFromToday(14),
    status: 'active',
    billingRate: 100_000,
    ...overrides,
  };
}

describe('availabilityFor', () => {
  it('treats a developer without an active assignment as available today', () => {
    const result = availabilityFor(developer(), TODAY);

    expect(result.onBenchNow).toBe(true);
    expect(result.freeFrom).toEqual(TODAY);
  });

  it('frees a developer the day after the current assignment ends', () => {
    const result = availabilityFor(
      developer({
        assignments: [
          {
            clientId: 'client-1',
            clientName: 'Acme',
            clientIndustry: 'fintech',
            startDate: daysFromToday(-60),
            endDate: daysFromToday(10),
            status: 'active',
          },
        ],
      }),
      TODAY,
    );

    expect(result.onBenchNow).toBe(false);
    expect(result.freeFrom?.toISOString().slice(0, 10)).toBe('2026-03-13');
  });

  it('keeps a developer occupied when an assignment has no end date', () => {
    const result = availabilityFor(
      developer({
        assignments: [
          {
            clientId: 'client-1',
            clientName: 'Acme',
            clientIndustry: 'fintech',
            startDate: daysFromToday(-60),
            endDate: null,
            status: 'active',
          },
        ],
      }),
      TODAY,
    );

    expect(result.onBenchNow).toBe(false);
    expect(result.freeFrom).toBeNull();
  });

  it('ignores assignments that already ended', () => {
    const result = availabilityFor(
      developer({
        assignments: [
          {
            clientId: 'client-1',
            clientName: 'Acme',
            clientIndustry: 'fintech',
            startDate: daysFromToday(-120),
            endDate: daysFromToday(-5),
            status: 'active',
          },
        ],
      }),
      TODAY,
    );

    expect(result.onBenchNow).toBe(true);
  });
});

describe('buildTimeline', () => {
  it('grows bench capacity as assignments end and counts weekly openings', () => {
    const developers = [
      developer({ id: 'dev-1' }),
      developer({
        id: 'dev-2',
        assignments: [
          {
            clientId: 'client-1',
            clientName: 'Acme',
            clientIndustry: 'fintech',
            startDate: daysFromToday(-60),
            endDate: daysFromToday(10),
            status: 'active',
          },
        ],
      }),
    ];

    const timeline = buildTimeline(
      developers,
      [{ endDate: daysFromToday(3) }, { endDate: daysFromToday(12) }],
      TODAY,
      4,
    );

    expect(timeline).toHaveLength(4);
    expect(timeline[0]).toMatchObject({ onBench: 1, openings: 1, utilizationRate: 50 });
    expect(timeline[1]).toMatchObject({ onBench: 1, openings: 1, utilizationRate: 50 });
    expect(timeline[2]).toMatchObject({ onBench: 2, openings: 0, utilizationRate: 0 });
    expect(timeline[3]).toMatchObject({ onBench: 2, openings: 0, utilizationRate: 0 });
  });
});

describe('scoreCandidate', () => {
  const opening = {
    clientId: 'client-1',
    clientName: 'Acme',
    clientIndustry: 'fintech',
    endDate: daysFromToday(14),
    requiredSkills: [{ name: 'React', level: 'advanced' }],
    developerSeniority: 'senior',
  };

  it('prefers a bench developer with matching skills and client experience', () => {
    const candidate = developer({
      id: 'dev-2',
      name: 'Bench Developer',
      seniority: 'senior',
      benchSince: daysFromToday(-45),
      assignments: [
        {
          clientId: 'client-1',
          clientName: 'Acme',
          clientIndustry: 'fintech',
          startDate: daysFromToday(-300),
          endDate: daysFromToday(-100),
          status: 'completed',
        },
      ],
    });

    const scored = scoreCandidate(candidate, opening, TODAY);

    expect(scored.confidence).toBe('strong');
    expect(scored.matchedSkills).toEqual(['React']);
    expect(scored.missingSkills).toEqual([]);
    expect(scored.reasons).toContain('On bench - available immediately');
    expect(scored.reasons).toContain('Has Acme experience');
    expect(scored.reasons).toContain('Matches the senior level');
    expect(scored.reasons).toContain('On the bench for 45 days');
  });

  it('penalizes a candidate who is still assigned when the opening starts', () => {
    const candidate = developer({
      id: 'dev-3',
      assignments: [
        {
          clientId: 'client-2',
          clientName: 'Other',
          clientIndustry: 'retail',
          startDate: daysFromToday(-60),
          endDate: daysFromToday(60),
          status: 'active',
        },
      ],
    });

    const scored = scoreCandidate(candidate, opening, TODAY);

    expect(scored.availableFrom?.toISOString().slice(0, 10)).toBe('2026-05-02');
    expect(scored.reasons).toContain('Still assigned when the opening starts');
  });

  it('marks a candidate without the required skills as a weak match', () => {
    const scored = scoreCandidate(
      developer({ id: 'dev-4', skills: [{ name: 'Java', level: 'expert', yearsExp: 6 }] }),
      opening,
      TODAY,
    );

    expect(scored.confidence).toBe('weak');
    expect(scored.missingSkills).toEqual(['React']);
  });
});

describe('buildForecast', () => {
  it('summarizes openings, bench pool, and projected utilization', () => {
    const outgoing = developer({
      id: 'dev-1',
      name: 'Outgoing Developer',
      benchSince: null,
      skills: [{ name: 'React', level: 'expert', yearsExp: 5 }],
      assignments: [
        {
          clientId: 'client-1',
          clientName: 'Acme',
          clientIndustry: 'fintech',
          startDate: daysFromToday(-120),
          endDate: daysFromToday(20),
          status: 'active',
        },
      ],
    });
    const benched = developer({
      id: 'dev-2',
      name: 'Benched Developer',
      benchSince: daysFromToday(-45),
      skills: [{ name: 'React', level: 'advanced', yearsExp: 3 }],
    });

    const forecast = buildForecast({
      developers: [outgoing, benched],
      contracts: [
        contract({ id: 'contract-1', developerId: 'dev-1', endDate: daysFromToday(14) }),
        contract({
          id: 'contract-2',
          developerId: 'dev-1',
          status: 'renewing',
          endDate: daysFromToday(30),
        }),
      ],
      today: TODAY,
      weeks: 8,
    });

    expect(forecast.horizonWeeks).toBe(8);
    expect(forecast.today).toBe('2026-03-02');
    expect(forecast.summary).toMatchObject({
      developers: 2,
      onBenchNow: 1,
      benchOver30Days: 1,
      openings: 2,
      clientsAffected: 1,
    });
    expect(forecast.timeline).toHaveLength(8);
    expect(forecast.openings).toHaveLength(2);
    expect(forecast.openings[0]).toMatchObject({
      contractId: 'contract-1',
      developer: 'Outgoing Developer',
      client: 'Acme',
      daysUntilEnd: 14,
      renewalLikely: false,
    });
    expect(forecast.openings[1]).toMatchObject({ contractId: 'contract-2', renewalLikely: true });
    expect(forecast.openings[0]?.recommendations[0]).toMatchObject({
      name: 'Benched Developer',
      confidence: 'strong',
    });
    expect(forecast.benchPool).toEqual([
      expect.objectContaining({ name: 'Benched Developer', benchDays: 45 }),
    ]);
  });

  it('ignores contracts outside the horizon and expired contracts', () => {
    const forecast = buildForecast({
      developers: [developer()],
      contracts: [
        contract({ id: 'too-far', endDate: daysFromToday(120) }),
        contract({ id: 'expired', status: 'expired', endDate: daysFromToday(-5) }),
      ],
      today: TODAY,
      weeks: 4,
    });

    expect(forecast.openings).toHaveLength(0);
    expect(forecast.summary.openings).toBe(0);
  });

  it('limits openings to one client when a client filter is applied', () => {
    const forecast = buildForecast({
      developers: [developer()],
      contracts: [
        contract({ id: 'contract-1', clientId: 'client-1' }),
        contract({ id: 'contract-2', clientId: 'client-2', clientName: 'Other' }),
      ],
      today: TODAY,
      weeks: 8,
      clientId: 'client-2',
    });

    expect(forecast.openings).toHaveLength(1);
    expect(forecast.openings[0]?.contractId).toBe('contract-2');
  });
});
