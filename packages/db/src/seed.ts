import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function currentQuarter(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function assertSafeToSeed() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    throw new Error(
      'Refusing to seed a production database. Set SEED_FORCE=true to override this guard.',
    );
  }
}

async function seed() {
  assertSafeToSeed();

  const today = startOfToday();
  const quarter = currentQuarter(today);
  console.log(`Seeding Aya demo data for ${today.toISOString().slice(0, 10)}...`);

  // Business data is reset so the demo stays deterministic. Conversations are
  // intentionally preserved unless SEED_RESET_CONVERSATIONS=true is set.
  await prisma.performance.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.developer.deleteMany();
  await prisma.client.deleteMany();

  if (process.env.SEED_RESET_CONVERSATIONS === 'true') {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  }

  // ─── Clients ────────────────────────────────────────

  const clientData = [
    { name: 'UnionBank', industry: 'fintech' },
    { name: 'Ayala Malls', industry: 'retail' },
    { name: 'Robinsons Land', industry: 'real-estate' },
    { name: 'Metrobank', industry: 'banking' },
    { name: 'PayMongo', industry: 'fintech' },
    { name: 'Groover Delivery', industry: 'logistics' },
  ];

  const clientsByName = new Map<string, { id: string; name: string }>();
  for (const client of clientData) {
    const created = await prisma.client.create({ data: client });
    clientsByName.set(created.name, created);
  }

  const clientId = (name: string): string => {
    const client = clientsByName.get(name);
    if (!client) throw new Error(`Unknown client in seed data: ${name}`);
    return client.id;
  };

  // ─── Contacts ───────────────────────────────────────

  await prisma.contact.createMany({
    data: [
      {
        name: 'Maria Santos',
        role: 'VP Digital',
        email: 'maria@unionbank.ph',
        clientId: clientId('UnionBank'),
      },
      {
        name: 'Juan Reyes',
        role: 'Tech Lead',
        email: 'juan@ayalamalls.com.ph',
        clientId: clientId('Ayala Malls'),
      },
      {
        name: 'Carla Lim',
        role: 'CTO',
        email: 'carla@robinsons.com',
        clientId: clientId('Robinsons Land'),
      },
      {
        name: 'Antonio Cruz',
        role: 'Product Manager',
        email: 'antonio@metrobank.com.ph',
        clientId: clientId('Metrobank'),
      },
      {
        name: 'Liza Fernandez',
        role: 'Engineering Manager',
        email: 'liza@paymongo.com',
        clientId: clientId('PayMongo'),
      },
      {
        name: 'Marco Villanueva',
        role: 'Head of Platform',
        email: 'marco@groover.ph',
        clientId: clientId('Groover Delivery'),
      },
    ],
  });

  // ─── Developers ─────────────────────────────────────

  const developers = [
    {
      name: 'Juan Dela Cruz',
      email: 'juan.dc@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'senior',
      skills: [
        { name: 'React', level: 'expert', yearsExp: 5 },
        { name: 'TypeScript', level: 'expert', yearsExp: 4 },
        { name: 'Node.js', level: 'advanced', yearsExp: 3 },
        { name: 'Next.js', level: 'advanced', yearsExp: 3 },
      ],
    },
    {
      name: 'Maria Santos',
      email: 'maria.s@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'senior',
      skills: [
        { name: 'Flutter', level: 'expert', yearsExp: 4 },
        { name: 'Dart', level: 'expert', yearsExp: 4 },
        { name: 'Firebase', level: 'advanced', yearsExp: 3 },
        { name: 'React Native', level: 'intermediate', yearsExp: 2 },
      ],
    },
    {
      name: 'Pedro Reyes',
      email: 'pedro.r@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'mid',
      skills: [
        { name: 'React', level: 'advanced', yearsExp: 3 },
        { name: 'JavaScript', level: 'advanced', yearsExp: 4 },
        { name: 'CSS', level: 'advanced', yearsExp: 4 },
        { name: 'Figma', level: 'intermediate', yearsExp: 2 },
      ],
    },
    {
      name: 'Ana Garcia',
      email: 'ana.g@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'senior',
      skills: [
        { name: 'Node.js', level: 'expert', yearsExp: 5 },
        { name: 'NestJS', level: 'expert', yearsExp: 3 },
        { name: 'PostgreSQL', level: 'advanced', yearsExp: 4 },
        { name: 'Docker', level: 'advanced', yearsExp: 3 },
        { name: 'AWS', level: 'intermediate', yearsExp: 2 },
      ],
    },
    {
      name: 'Carlos Mendoza',
      email: 'carlos.m@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'lead',
      skills: [
        { name: 'Java', level: 'expert', yearsExp: 7 },
        { name: 'Spring Boot', level: 'expert', yearsExp: 5 },
        { name: 'Kotlin', level: 'advanced', yearsExp: 3 },
        { name: 'Kubernetes', level: 'advanced', yearsExp: 3 },
        { name: 'AWS', level: 'advanced', yearsExp: 4 },
      ],
    },
    {
      name: 'Bea Villanueva',
      email: 'bea.v@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'mid',
      skills: [
        { name: 'React', level: 'advanced', yearsExp: 3 },
        { name: 'TypeScript', level: 'advanced', yearsExp: 2 },
        { name: 'Tailwind', level: 'advanced', yearsExp: 2 },
        { name: 'Next.js', level: 'intermediate', yearsExp: 1 },
      ],
    },
    {
      name: 'Rico Tan',
      email: 'rico.t@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'junior',
      skills: [
        { name: 'React', level: 'intermediate', yearsExp: 1 },
        { name: 'JavaScript', level: 'intermediate', yearsExp: 2 },
        { name: 'HTML/CSS', level: 'advanced', yearsExp: 3 },
      ],
    },
    {
      name: 'Diana Lopez',
      email: 'diana.l@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'senior',
      skills: [
        { name: 'Swift', level: 'expert', yearsExp: 5 },
        { name: 'iOS', level: 'expert', yearsExp: 5 },
        { name: 'Objective-C', level: 'advanced', yearsExp: 4 },
        { name: 'React Native', level: 'intermediate', yearsExp: 1 },
      ],
    },
    {
      name: 'Miguel Aquino',
      email: 'miguel.a@whitecloak.com',
      role: 'DevOps Engineer',
      seniority: 'senior',
      skills: [
        { name: 'Docker', level: 'expert', yearsExp: 5 },
        { name: 'Kubernetes', level: 'expert', yearsExp: 4 },
        { name: 'AWS', level: 'expert', yearsExp: 5 },
        { name: 'Terraform', level: 'advanced', yearsExp: 3 },
        { name: 'CI/CD', level: 'expert', yearsExp: 4 },
      ],
    },
    {
      name: 'Katrina Ramos',
      email: 'katrina.r@whitecloak.com',
      role: 'QA Engineer',
      seniority: 'mid',
      skills: [
        { name: 'Selenium', level: 'advanced', yearsExp: 3 },
        { name: 'Cypress', level: 'advanced', yearsExp: 2 },
        { name: 'Postman', level: 'expert', yearsExp: 4 },
        { name: 'Jest', level: 'advanced', yearsExp: 3 },
      ],
    },
    {
      name: 'Jerome Bautista',
      email: 'jerome.b@whitecloak.com',
      role: 'Software Engineer',
      seniority: 'mid',
      skills: [
        { name: 'Flutter', level: 'advanced', yearsExp: 2 },
        { name: 'Dart', level: 'advanced', yearsExp: 2 },
        { name: 'Firebase', level: 'intermediate', yearsExp: 1 },
        { name: 'REST API', level: 'advanced', yearsExp: 3 },
      ],
    },
    {
      name: 'Patricia Chua',
      email: 'patricia.c@whitecloak.com',
      role: 'UI/UX Designer',
      seniority: 'senior',
      skills: [
        { name: 'Figma', level: 'expert', yearsExp: 5 },
        { name: 'UI Design', level: 'expert', yearsExp: 6 },
        { name: 'UX Research', level: 'advanced', yearsExp: 4 },
        { name: 'Prototyping', level: 'expert', yearsExp: 5 },
      ],
    },
  ];

  const developersByName = new Map<string, { id: string; name: string }>();
  for (const developer of developers) {
    const { skills, ...data } = developer;
    const created = await prisma.developer.create({
      data: {
        ...data,
        skills: { create: skills },
      },
    });
    developersByName.set(created.name, created);
  }

  const developerId = (name: string): string => {
    const developer = developersByName.get(name);
    if (!developer) throw new Error(`Unknown developer in seed data: ${name}`);
    return developer.id;
  };

  // Rico is on the bench and has been for 45 days.
  await prisma.developer.update({
    where: { id: developerId('Rico Tan') },
    data: { benchSince: addDays(today, -45) },
  });

  // ─── Assignments ────────────────────────────────────

  const assignmentData = [
    {
      devName: 'Juan Dela Cruz',
      clientName: 'UnionBank',
      projectName: 'UnionBank Online v3',
      endInDays: 90,
    },
    {
      devName: 'Maria Santos',
      clientName: 'Ayala Malls',
      projectName: 'Pasyal Loyalty App',
      endInDays: 150,
    },
    {
      devName: 'Pedro Reyes',
      clientName: 'Ayala Malls',
      projectName: 'Pasyal Loyalty App',
      endInDays: 60,
    },
    {
      devName: 'Ana Garcia',
      clientName: 'UnionBank',
      projectName: 'UnionBank Portal',
      endInDays: 210,
    },
    {
      devName: 'Carlos Mendoza',
      clientName: 'Robinsons Land',
      projectName: 'Robinsons Hotels App',
      endInDays: 120,
    },
    {
      devName: 'Bea Villanueva',
      clientName: 'Robinsons Land',
      projectName: 'Robinsons Hotels App',
      endInDays: 45,
    },
    {
      devName: 'Diana Lopez',
      clientName: 'Groover Delivery',
      projectName: 'Groover iOS App',
      endInDays: 180,
    },
    {
      devName: 'Miguel Aquino',
      clientName: 'UnionBank',
      projectName: 'UnionBank Infra',
      endInDays: 240,
    },
    {
      devName: 'Katrina Ramos',
      clientName: 'Robinsons Land',
      projectName: 'Robinsons Hotels QA',
      endInDays: 30,
    },
    {
      devName: 'Jerome Bautista',
      clientName: 'PayMongo',
      projectName: 'PayMongo Dashboard',
      endInDays: 75,
    },
    {
      devName: 'Patricia Chua',
      clientName: 'Metrobank',
      projectName: 'Metrobank App Design',
      endInDays: 100,
    },
  ];

  for (const assignment of assignmentData) {
    await prisma.assignment.create({
      data: {
        developerId: developerId(assignment.devName),
        clientId: clientId(assignment.clientName),
        projectName: assignment.projectName,
        status: 'active',
        startDate: addMonths(today, -6),
        endDate: addDays(today, assignment.endInDays),
      },
    });
  }

  // ─── Contracts ──────────────────────────────────────

  const contractData = [
    {
      devName: 'Juan Dela Cruz',
      clientName: 'UnionBank',
      rate: 180_000,
      endInDays: 10,
      status: 'active',
    },
    {
      devName: 'Maria Santos',
      clientName: 'Ayala Malls',
      rate: 170_000,
      endInDays: 120,
      status: 'active',
    },
    {
      devName: 'Pedro Reyes',
      clientName: 'Ayala Malls',
      rate: 120_000,
      endInDays: 60,
      status: 'active',
    },
    {
      devName: 'Ana Garcia',
      clientName: 'UnionBank',
      rate: 190_000,
      endInDays: 200,
      status: 'active',
    },
    {
      devName: 'Carlos Mendoza',
      clientName: 'Robinsons Land',
      rate: 220_000,
      endInDays: 150,
      status: 'active',
    },
    {
      devName: 'Bea Villanueva',
      clientName: 'Robinsons Land',
      rate: 130_000,
      endInDays: 5,
      status: 'renewing',
    },
    {
      devName: 'Diana Lopez',
      clientName: 'Groover Delivery',
      rate: 175_000,
      endInDays: 90,
      status: 'active',
    },
    {
      devName: 'Miguel Aquino',
      clientName: 'UnionBank',
      rate: 200_000,
      endInDays: 180,
      status: 'active',
    },
    {
      devName: 'Katrina Ramos',
      clientName: 'Robinsons Land',
      rate: 110_000,
      endInDays: -30,
      status: 'expired',
    },
    {
      devName: 'Jerome Bautista',
      clientName: 'PayMongo',
      rate: 125_000,
      endInDays: 25,
      status: 'active',
    },
    {
      devName: 'Patricia Chua',
      clientName: 'Metrobank',
      rate: 160_000,
      endInDays: 300,
      status: 'active',
    },
  ];

  for (const contract of contractData) {
    await prisma.contract.create({
      data: {
        developerId: developerId(contract.devName),
        clientId: clientId(contract.clientName),
        startDate: addMonths(today, -6),
        endDate: addDays(today, contract.endInDays),
        billingRate: contract.rate,
        status: contract.status,
      },
    });
  }

  // ─── Performance ────────────────────────────────────

  const performanceData = [
    {
      devName: 'Juan Dela Cruz',
      velocity: 38,
      prMerge: 1.1,
      quality: 92,
      rating: 4.5,
      notes: 'Strong delivery and code review habits.',
    },
    {
      devName: 'Maria Santos',
      velocity: 34,
      prMerge: 1.3,
      quality: 88,
      rating: 4.2,
      notes: 'Reliable mobile delivery.',
    },
    {
      devName: 'Pedro Reyes',
      velocity: 28,
      prMerge: 1.8,
      quality: 82,
      rating: 3.8,
      notes: 'Solid contributor; growing into larger features.',
    },
    {
      devName: 'Ana Garcia',
      velocity: 36,
      prMerge: 0.9,
      quality: 95,
      rating: 4.7,
      notes: 'Excellent backend quality and velocity.',
    },
    {
      devName: 'Carlos Mendoza',
      velocity: 40,
      prMerge: 1.0,
      quality: 91,
      rating: 4.6,
      notes: 'Strong technical lead for the account.',
    },
    {
      devName: 'Bea Villanueva',
      velocity: 30,
      prMerge: 1.5,
      quality: 85,
      rating: 4.0,
      notes: 'Consistent frontend delivery.',
    },
    {
      devName: 'Diana Lopez',
      velocity: 32,
      prMerge: 1.4,
      quality: 89,
      rating: 4.3,
      notes: 'Strong iOS ownership.',
    },
    {
      devName: 'Miguel Aquino',
      velocity: 0,
      prMerge: 0.5,
      quality: 94,
      rating: 4.8,
      notes: 'Platform work measured outside sprint velocity.',
    },
    {
      devName: 'Katrina Ramos',
      velocity: 0,
      prMerge: 1.2,
      quality: 90,
      rating: 4.1,
      notes: 'QA automation and release support.',
    },
    {
      devName: 'Jerome Bautista',
      velocity: 26,
      prMerge: 2.0,
      quality: 78,
      rating: 3.5,
      notes: 'Needs support on test coverage and review turnaround.',
    },
    {
      devName: 'Patricia Chua',
      velocity: 0,
      prMerge: 0,
      quality: 93,
      rating: 4.4,
      notes: 'Design work measured by milestone delivery.',
    },
  ];

  for (const performance of performanceData) {
    await prisma.performance.create({
      data: {
        developerId: developerId(performance.devName),
        period: quarter,
        velocity: performance.velocity,
        prMergeTime: performance.prMerge,
        codeQuality: performance.quality,
        clientRating: performance.rating,
        notes: performance.notes,
      },
    });
  }

  const counts = await Promise.all([
    prisma.client.count(),
    prisma.developer.count(),
    prisma.skill.count(),
    prisma.assignment.count(),
    prisma.contract.count(),
    prisma.performance.count(),
  ]);

  console.log('Seed complete!');
  console.log(`  - ${counts[0]} clients`);
  console.log(`  - ${counts[1]} developers`);
  console.log(`  - ${counts[2]} skills`);
  console.log(`  - ${counts[3]} assignments`);
  console.log(`  - ${counts[4]} contracts`);
  console.log(`  - ${counts[5]} performance records (${quarter})`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
