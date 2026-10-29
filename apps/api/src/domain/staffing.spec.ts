import { isOccupiedAssignment, occupiedAssignmentWhere, startOfToday } from './staffing';

describe('staffing assignment rules', () => {
  const today = startOfToday(new Date('2026-10-29T12:00:00.000Z'));

  it('treats active, ending, and transition assignments as occupied', () => {
    for (const status of ['active', 'ending', 'transition']) {
      expect(
        isOccupiedAssignment(
          {
            status,
            startDate: new Date('2026-10-01T00:00:00.000Z'),
            endDate: null,
          },
          today,
        ),
      ).toBe(true);
    }
  });

  it('does not treat future or completed assignments as occupied', () => {
    expect(
      isOccupiedAssignment(
        {
          status: 'active',
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: null,
        },
        today,
      ),
    ).toBe(false);

    expect(
      isOccupiedAssignment(
        {
          status: 'completed',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: null,
        },
        today,
      ),
    ).toBe(false);
  });

  it('uses the same occupied states in database filters', () => {
    expect(occupiedAssignmentWhere(today)).toEqual({
      status: { in: ['active', 'ending', 'transition'] },
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    });
  });
});
