import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@assetflow.io' },
    update: {},
    create: {
      name: 'Kavitha Raman',
      email: 'admin@assetflow.io',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('Bootstrap admin ready: admin@assetflow.io / Admin@123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
