import { prisma } from '@workspace/db';
import { executeTool } from '../src/agent/tools';

const DAY_MS = 24 * 60 * 60 * 1000;

type ToolRow = Record<string, unknown>;

describe('staffing tools (e2e)', () => {
  const suffix = Date.now().toString(36);
  const alphaClientName = `Alpha Bank ${suffix}`;
  const betaClientName = `Beta Bank ${suffix}`;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let alphaClientId = '';
  let betaClientId = '';

  beforeAll(async () => {
    const alphaClient = await prisma.client.create({
      data: { name: alphaClientName, industry: 'banking' },
    });
    const betaClient = await prisma.client.create({
      data: { name: betaClientName, industry: 'banking' },
    });
    alphaClientId = alphaClient.id;
    betaClientId = betaClient.id;

    const endingDeveloper = await prisma.developer.create({
      data: {
        name: `React Developer ${suffix}`,
        email: `react.${suffix}@example.test`,
        role: 'Software Engineer',
        seniority: 'senior',
        skills: {
          create: [
            { name: 'React', level: 'expert', yearsExp: 5 },
            { name: 'TypeScript', level: 'advanced', yearsExp: 4 },
          ],
        },
        assignments: {
          create: {
            clientId: alphaClientId,
            projectName: 'Ending assignment',
            status: 'ending',
            startDate: new Date(today.getTime() - 30 * DAY_MS),
            endDate: null,
          },
        },
      },
    });

    await prisma.developer.create({
      data: {
        name: `React Native Developer ${suffix}`,
        email: `react-native.${suffix}@example.test`,
        role: 'Software Engineer',
        seniority: 'mid',
        skills: {
          create: [{ name: 'React Native', level: 'advanced', yearsExp: 3 }],
        },
        assignments: {
          create: {
            clientId: betaClientId,
            projectName: 'Mobile assignment',
            status: 'active',
            startDate: new Date(today.getTime() - 30 * DAY_MS),
            endDate: null,
          },
        },
      },
    });

    await prisma.developer.create({
      data: {
        name: `Full Stack Developer ${suffix}`,
        email: `full-stack.${suffix}@example.test`,
        role: 'Software Engineer',
        seniority: 'senior',
        skills: {
          create: [
            { name: 'React', level: 'advanced', yearsExp: 4 },
            { name: 'TypeScript', level: 'expert', yearsExp: 5 },
          ],
        },
        assignments: {
          create: {
            clientId: alphaClientId,
            projectName: 'Second assignment',
            status: 'active',
            startDate: new Date(today.getTime() - 30 * DAY_MS),
            endDate: null,
          },
        },
      },
    });

    await prisma.contract.create({
      data: {
        developerId: endingDeveloper.id,
        clientId: alphaClientId,
        startDate: new Date(today.getTime() - 60 * DAY_MS),
        endDate: new Date(today.getTime() + 10 * DAY_MS),
        billingRate: 9000,
        status: 'active',
      },
    });

    expect(endingDeveloper.name).toContain('React Developer');
  });

  afterAll(async () => {
    await prisma.developer.deleteMany({
      where: { email: { endsWith: `${suffix}@example.test` } },
    });
    await prisma.client.deleteMany({
      where: { id: { in: [alphaClientId, betaClientId] } },
    });
  });

  it('matches canonical skills without treating React Native as React', async () => {
    const result = (await executeTool('match_developers', {
      requiredSkills: ['React'],
      startDate: '2030-01-01',
      teamSize: 20,
    })) as ToolRow[];

    const reactDeveloper = result.find(
      (developer) => developer.name === `React Developer ${suffix}`,
    );
    const reactNativeDeveloper = result.find(
      (developer) => developer.name === `React Native Developer ${suffix}`,
    );

    expect(reactDeveloper?.matchedSkills).toContain('React');
    expect(reactNativeDeveloper?.matchedSkills).not.toContain('React');
    expect(reactNativeDeveloper?.missingSkills).toContain('React');
  });

  it('requires every requested roster skill', async () => {
    const result = (await executeTool('query_roster', {
      skills: ['React', 'TypeScript'],
    })) as ToolRow[];

    expect(result.map((developer) => developer.name)).toEqual(
      expect.arrayContaining([`React Developer ${suffix}`, `Full Stack Developer ${suffix}`]),
    );
    expect(result.map((developer) => developer.name)).not.toContain(
      `React Native Developer ${suffix}`,
    );
  });

  it('treats an ending assignment as occupied', async () => {
    const result = (await executeTool('query_roster', { onBench: false })) as ToolRow[];
    expect(result.map((developer) => developer.name)).toContain(`React Developer ${suffix}`);
  });

  it('requires disambiguation for ambiguous client names', async () => {
    const result = await executeTool('check_contracts', { clientName: 'Bank' });
    expect(result).toEqual({
      error: expect.stringContaining('Multiple clients matched'),
    });
  });

  it('resolves client names regardless of casing', async () => {
    const result = (await executeTool('check_contracts', {
      clientName: 'alpha bank',
    })) as ToolRow[];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]?.client).toBe(alphaClientName);
  });

  it('excludes contracts that have not started from an expiry window', async () => {
    const futureClient = await prisma.client.create({
      data: { name: `Future Client ${suffix}`, industry: 'banking' },
    });

    const futureDeveloper = await prisma.developer.create({
      data: {
        name: `Future Developer ${suffix}`,
        email: `future.${suffix}@example.test`,
        role: 'Software Engineer',
        seniority: 'mid',
      },
    });

    try {
      await prisma.contract.create({
        data: {
          developerId: futureDeveloper.id,
          clientId: futureClient.id,
          startDate: new Date(today.getTime() + 5 * DAY_MS),
          endDate: new Date(today.getTime() + 10 * DAY_MS),
          billingRate: 5000,
          status: 'active',
        },
      });

      const result = (await executeTool('check_contracts', {
        expiringWithin: 30,
      })) as ToolRow[];

      expect(result.map((contract) => contract.client)).not.toContain(futureClient.name);
    } finally {
      await prisma.developer.delete({ where: { id: futureDeveloper.id } });
      await prisma.client.delete({ where: { id: futureClient.id } });
    }
  });

  it('counts a developer once per client in the utilization breakdown', async () => {
    const soloClient = await prisma.client.create({
      data: { name: `Solo Client ${suffix}`, industry: 'retail' },
    });

    const soloDeveloper = await prisma.developer.create({
      data: {
        name: `Solo Developer ${suffix}`,
        email: `solo.${suffix}@example.test`,
        role: 'Software Engineer',
        seniority: 'mid',
        assignments: {
          create: [
            {
              clientId: soloClient.id,
              projectName: 'Solo Project A',
              status: 'active',
              startDate: new Date(today.getTime() - 30 * DAY_MS),
              endDate: null,
            },
            {
              clientId: soloClient.id,
              projectName: 'Solo Project B',
              status: 'active',
              startDate: new Date(today.getTime() - 10 * DAY_MS),
              endDate: null,
            },
          ],
        },
      },
    });

    try {
      const result = (await executeTool('get_utilization', {
        clientId: soloClient.id,
      })) as ToolRow & {
        total: number;
        active: number;
        byClient: Record<string, number>;
      };

      expect(result.total).toBe(1);
      expect(result.active).toBe(1);
      expect(result.byClient[soloClient.name]).toBe(1);
    } finally {
      await prisma.developer.delete({ where: { id: soloDeveloper.id } });
      await prisma.client.delete({ where: { id: soloClient.id } });
    }
  });
});
