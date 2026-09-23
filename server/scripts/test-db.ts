import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true },
  });
  const bases = await prisma.base.count();
  const purchases = await prisma.purchase.count();
  console.log(JSON.stringify({ users, bases, purchases }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
