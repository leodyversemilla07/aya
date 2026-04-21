import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding Aya database...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.performance.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.developer.deleteMany();
  await prisma.client.deleteMany();

  // ─── Clients ────────────────────────────────────────

  const unionbank = await prisma.client.create({
    data: { name: 'UnionBank', industry: 'fintech' },
  });
  const ayalaMalls = await prisma.client.create({
    data: { name: 'Ayala Malls', industry: 'retail' },
  });
  const robinsons = await prisma.client.create({
    data: { name: 'Robinsons Land', industry: 'real-estate' },
  });
  const metrobank = await prisma.client.create({
    data: { name: 'Metrobank', industry: 'banking' },
  });
  const paymongo = await prisma.client.create({
    data: { name: 'PayMongo', industry: 'fintech' },
  });
  const grover = await prisma.client.create({
    data: { name: 'Groover Delivery', industry: 'logistics' },
  });

  // ─── Contacts ───────────────────────────────────────

  await prisma.contact.createMany({
    data: [
      {
        name: 'Maria Santos',
        role: 'VP Digital',
        email: 'maria@unionbank.ph',
        clientId: unionbank.id,
      },
      {
        name: 'Juan Reyes',
        role: 'Tech Lead',
        email: 'juan@ayalamalls.com.ph',
        clientId: ayalaMalls.id,
      },
      { name: 'Carla Lim', role: 'CTO', email: 'carla@robinsons.com', clientId: robinsons.id },
      {
        name: 'Antonio Cruz',
        role: 'Product Manager',
        email: 'antonio@metrobank.com.ph',
        clientId: metrobank.id,
      },
    ],
  });

  // ─── Developers ─────────────────────────────────────

  const devs = [
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

  for (const devData of devs) {
    const dev = await prisma.developer.create({
      data: {
        name: devData.name,
        email: devData.email,
        role: devData.role,
        seniority: devData.seniority,
      },
    });

    for (const skill of devData.skills) {
      await prisma.skill.create({
        data: {
          name: skill.name,
          level: skill.level,
          yearsExp: skill.yearsExp,
          developerId: dev.id,
        },
      });
    }
  }

  // ─── Assignments ────────────────────────────────────

  const allDevs = await prisma.developer.findMany();

  const assignmentData = [
    {
      devName: 'Juan Dela Cruz',
      clientName: 'UnionBank',
      projectName: 'UnionBank Online v3',
      status: 'active',
    },
    {
      devName: 'Maria Santos',
      clientName: 'Ayala Malls',
      projectName: 'Pasyal Loyalty App',
      status: 'active',
    },
    {
      devName: 'Pedro Reyes',
      clientName: 'Ayala Malls',
      projectName: 'Pasyal Loyalty App',
      status: 'active',
    },
    {
      devName: 'Ana Garcia',
      clientName: 'UnionBank',
      projectName: 'UnionBank Portal',
      status: 'active',
    },
    {
      devName: 'Carlos Mendoza',
      clientName: 'Robinsons Land',
      projectName: 'Robinsons Hotels App',
      status: 'active',
    },
    {
      devName: 'Bea Villanueva',
      clientName: 'Robinsons Land',
      projectName: 'Robinsons Hotels App',
      status: 'active',
    },
    {
      devName: 'Diana Lopez',
      clientName: 'Groover Delivery',
      projectName: 'Groover iOS App',
      status: 'active',
    },
    {
      devName: 'Miguel Aquino',
      clientName: 'UnionBank',
      projectName: 'UnionBank Infra',
      status: 'active',
    },
    {
      devName: 'Katrina Ramos',
      clientName: 'Robinsons Land',
      projectName: 'Robinsons Hotels QA',
      status: 'active',
    },
    {
      devName: 'Jerome Bautista',
      clientName: 'PayMongo',
      projectName: 'PayMongo Dashboard',
      status: 'active',
    },
    {
      devName: 'Patricia Chua',
      clientName: 'Metrobank',
      projectName: 'Metrobank App Design',
      status: 'active',
    },
  ];

  const clientsByName: Record<string, typeof unionbank> = {
    UnionBank: unionbank,
    'Ayala Malls': ayalaMalls,
    'Robinsons Land': robinsons,
    Metrobank: metrobank,
    PayMongo: paymongo,
    'Groover Delivery': grover,
  };

  for (const a of assignmentData) {
    const dev = allDevs.find((d) => d.name === a.devName);
    const client = clientsByName[a.clientName];
    if (dev && client) {
      await prisma.assignment.create({
        data: {
          developerId: dev.id,
          clientId: client.id,
          projectName: a.projectName,
          status: a.status,
          startDate: new Date('2025-10-01'),
          endDate: new Date('2026-09-30'),
        },
      });

      // Set benchSince for Rico (no assignment)
      // He's not in the list, so he stays on bench
    }
  }

  // Rico Tan is not assigned - set as on bench
  const rico = allDevs.find((d) => d.name === 'Rico Tan');
  if (rico) {
    await prisma.developer.update({
      where: { id: rico.id },
      data: { benchSince: new Date('2026-03-15') },
    });
  }

  // ─── Contracts ──────────────────────────────────────

  const contractData = [
    { devName: 'Juan Dela Cruz', clientName: 'UnionBank', rate: 180000, endDate: '2026-04-30' },
    { devName: 'Maria Santos', clientName: 'Ayala Malls', rate: 170000, endDate: '2026-08-31' },
    { devName: 'Pedro Reyes', clientName: 'Ayala Malls', rate: 120000, endDate: '2026-06-30' },
    { devName: 'Ana Garcia', clientName: 'UnionBank', rate: 190000, endDate: '2026-12-31' },
    {
      devName: 'Carlos Mendoza',
      clientName: 'Robinsons Land',
      rate: 220000,
      endDate: '2026-09-30',
    },
    {
      devName: 'Bea Villanueva',
      clientName: 'Robinsons Land',
      rate: 130000,
      endDate: '2026-05-15',
    },
    { devName: 'Diana Lopez', clientName: 'Groover Delivery', rate: 175000, endDate: '2026-07-31' },
    { devName: 'Miguel Aquino', clientName: 'UnionBank', rate: 200000, endDate: '2026-11-30' },
    { devName: 'Katrina Ramos', clientName: 'Robinsons Land', rate: 110000, endDate: '2026-04-20' },
    { devName: 'Jerome Bautista', clientName: 'PayMongo', rate: 125000, endDate: '2026-05-31' },
    { devName: 'Patricia Chua', clientName: 'Metrobank', rate: 160000, endDate: '2026-10-31' },
  ];

  for (const c of contractData) {
    const dev = allDevs.find((d) => d.name === c.devName);
    const client = clientsByName[c.clientName];
    if (dev && client) {
      await prisma.contract.create({
        data: {
          developerId: dev.id,
          clientId: client.id,
          startDate: new Date('2025-10-01'),
          endDate: new Date(c.endDate),
          billingRate: c.rate,
          status: 'active',
        },
      });
    }
  }

  // ─── Performance ────────────────────────────────────

  const perfData = [
    { devName: 'Juan Dela Cruz', velocity: 38, prMerge: 1.1, quality: 92, rating: 4.5 },
    { devName: 'Maria Santos', velocity: 34, prMerge: 1.3, quality: 88, rating: 4.2 },
    { devName: 'Pedro Reyes', velocity: 28, prMerge: 1.8, quality: 82, rating: 3.8 },
    { devName: 'Ana Garcia', velocity: 36, prMerge: 0.9, quality: 95, rating: 4.7 },
    { devName: 'Carlos Mendoza', velocity: 40, prMerge: 1.0, quality: 91, rating: 4.6 },
    { devName: 'Bea Villanueva', velocity: 30, prMerge: 1.5, quality: 85, rating: 4.0 },
    { devName: 'Diana Lopez', velocity: 32, prMerge: 1.4, quality: 89, rating: 4.3 },
    { devName: 'Miguel Aquino', velocity: 0, prMerge: 0.5, quality: 94, rating: 4.8 },
    { devName: 'Katrina Ramos', velocity: 0, prMerge: 1.2, quality: 90, rating: 4.1 },
    { devName: 'Jerome Bautista', velocity: 26, prMerge: 2.0, quality: 78, rating: 3.5 },
    { devName: 'Patricia Chua', velocity: 0, prMerge: 0, quality: 93, rating: 4.4 },
  ];

  for (const p of perfData) {
    const dev = allDevs.find((d) => d.name === p.devName);
    if (dev) {
      await prisma.performance.create({
        data: {
          developerId: dev.id,
          period: '2026-Q1',
          velocity: p.velocity,
          prMergeTime: p.prMerge,
          codeQuality: p.quality,
          clientRating: p.rating,
        },
      });
    }
  }

  console.log('Seed complete!');
  console.log(`  - ${await prisma.client.count()} clients`);
  console.log(`  - ${await prisma.developer.count()} developers`);
  console.log(`  - ${await prisma.skill.count()} skills`);
  console.log(`  - ${await prisma.assignment.count()} assignments`);
  console.log(`  - ${await prisma.contract.count()} contracts`);
  console.log(`  - ${await prisma.performance.count()} performance records`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
