const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean up existing data to allow re-seeding
  await prisma.importAnomaly.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.expenseShare.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const userConfigs = [
    { name: 'Aisha', email: 'aisha@example.com' },
    { name: 'Rohan', email: 'rohan@example.com' },
    { name: 'Priya', email: 'priya@example.com' },
    { name: 'Meera', email: 'meera@example.com' },
    { name: 'Sam', email: 'sam@example.com' },
    { name: 'Dev', email: 'dev@example.com' },
  ];

  const users = {};
  for (const config of userConfigs) {
    const user = await prisma.user.create({
      data: {
        name: config.name,
        email: config.email,
        passwordHash,
      },
    });
    users[config.name] = user;
    console.log(`Created user: ${config.name} (${config.email})`);
  }

  // 3. Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Flat Shared Expenses',
      description: 'Shared expenses for the flat and trip since Feb 2026',
    },
  });
  console.log(`Created group: ${group.name}`);

  // 4. Create Group Memberships (with specific timelines)
  // February Start Date
  const febStart = new Date('2026-02-01T00:00:00Z');
  // Meera left at the end of March
  const meeraLeft = new Date('2026-03-31T23:59:59Z');
  // Sam joined mid-April (e.g. 15th April)
  const samJoined = new Date('2026-04-15T00:00:00Z');
  // Dev joined for the Goa Trip in early March
  const devJoined = new Date('2026-03-01T00:00:00Z');

  const memberships = [
    { userId: users['Aisha'].id, joinedAt: febStart, leftAt: null },
    { userId: users['Rohan'].id, joinedAt: febStart, leftAt: null },
    { userId: users['Priya'].id, joinedAt: febStart, leftAt: null },
    { userId: users['Meera'].id, joinedAt: febStart, leftAt: meeraLeft },
    { userId: users['Sam'].id, joinedAt: samJoined, leftAt: null },
    { userId: users['Dev'].id, joinedAt: devJoined, leftAt: null },
  ];

  for (const m of memberships) {
    const name = Object.keys(users).find(key => users[key].id === m.userId);
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: m.userId,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
      },
    });
    console.log(`Added membership for ${name}: Joined ${m.joinedAt.toISOString().split('T')[0]}, Left: ${m.leftAt ? m.leftAt.toISOString().split('T')[0] : 'Active'}`);
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
