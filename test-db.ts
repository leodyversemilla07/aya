import { prisma } from './packages/db/src/index.ts';

// Test database connection
async function testDb() {
  console.log('Testing PostgreSQL connection...');
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully');
    
    // Create a test developer
    const dev = await prisma.developer.create({
      data: {
        name: 'Alice Chen',
        email: 'alice@dev.com',
        role: 'Full Stack Developer',
        seniority: 'senior',
        benchSince: new Date(),
      },
    });
    console.log('✅ Created test developer:', dev.name);
    
    // Query all developers
    const devs = await prisma.developer.findMany();
    console.log('✅ Found', devs.length, 'developers');
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

testDb();
