import { prisma } from '@workspace/db';
import { executeTool } from '../src/agent/tools';

const DAY_MS = 24 * 60 * 60 * 1000;

type ToolRow = Record<string, unknown>;

describe('staffing tools (e2e)', () => {
  const suffix = Date.now().toString(36);
  const alphaClientName = `Alpha Bank ${suffix}`;
  const betaClientName = `Beta Bank ${suffix}`;
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

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

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
});
