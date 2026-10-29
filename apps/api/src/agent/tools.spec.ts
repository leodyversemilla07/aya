import { schemas } from './tools';

describe('tool schemas', () => {
  it('accepts nullable optional values emitted by some model providers', () => {
    expect(schemas.get_alerts.safeParse({ type: null }).success).toBe(true);
    expect(
      schemas.match_developers.safeParse({
        requiredSkills: ['React'],
        startDate: '2026-11-01',
        teamSize: null,
      }).success,
    ).toBe(true);
  });

  it('still rejects invalid values', () => {
    expect(schemas.get_alerts.safeParse({ type: 'unknown' }).success).toBe(false);
    expect(
      schemas.match_developers.safeParse({
        requiredSkills: [],
        startDate: 'not-a-date',
        teamSize: 0,
      }).success,
    ).toBe(false);
  });

  it('bounds tool collection sizes', () => {
    expect(
      schemas.query_roster.safeParse({ skills: Array.from({ length: 21 }, () => 'React') }).success,
    ).toBe(false);
  });
});
