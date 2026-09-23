import bcrypt from 'bcryptjs';
import { PrismaClient, Role, EquipmentType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Military Asset Management System...');

  await prisma.auditLog.deleteMany();
  await prisma.expenditure.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.inventoryBalance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.base.deleteMany();

  const [north, south, east] = await Promise.all([
    prisma.base.create({
      data: { name: 'Fort Apex', code: 'FAX', location: 'Northern Command' },
    }),
    prisma.base.create({
      data: { name: 'Camp Sentinel', code: 'CSN', location: 'Southern Command' },
    }),
    prisma.base.create({
      data: { name: 'Base Horizon', code: 'BHZ', location: 'Eastern Command' },
    }),
  ]);

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [admin, commander, logistics] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@mams.mil',
        passwordHash,
        name: 'System Administrator',
        rank: 'Col',
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: 'commander.fax@mams.mil',
        passwordHash,
        name: 'Base Commander Apex',
        rank: 'Lt Col',
        role: Role.BASE_COMMANDER,
        baseId: north.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'logistics.fax@mams.mil',
        passwordHash,
        name: 'Logistics Officer Apex',
        rank: 'Capt',
        role: Role.LOGISTICS_OFFICER,
        baseId: north.id,
      },
    }),
  ]);

  const [humvee, rifle, ammo, radio] = await Promise.all([
    prisma.asset.create({
      data: {
        name: 'M1165 HMMWV',
        equipmentType: EquipmentType.VEHICLE,
        unit: 'vehicle',
        serialPrefix: 'HMMWV',
      },
    }),
    prisma.asset.create({
      data: {
        name: 'M4 Carbine',
        equipmentType: EquipmentType.WEAPON,
        unit: 'weapon',
        serialPrefix: 'M4',
      },
    }),
    prisma.asset.create({
      data: {
        name: '5.56mm Ball',
        equipmentType: EquipmentType.AMMUNITION,
        unit: 'round',
        serialPrefix: '556B',
      },
    }),
    prisma.asset.create({
      data: {
        name: 'AN/PRC-152 Radio',
        equipmentType: EquipmentType.OTHER,
        unit: 'unit',
        serialPrefix: 'PRC152',
      },
    }),
  ]);

  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  };

  // Purchases
  await prisma.purchase.create({
    data: {
      baseId: north.id,
      assetId: humvee.id,
      quantity: 12,
      unitCost: 220000,
      vendor: 'Defense Procurement Agency',
      purchasedAt: daysAgo(40),
      createdById: logistics.id,
    },
  });
  await prisma.purchase.create({
    data: {
      baseId: north.id,
      assetId: rifle.id,
      quantity: 200,
      unitCost: 1200,
      vendor: 'Armory Supply Co',
      purchasedAt: daysAgo(35),
      createdById: logistics.id,
    },
  });
  await prisma.purchase.create({
    data: {
      baseId: north.id,
      assetId: ammo.id,
      quantity: 50000,
      unitCost: 0.45,
      vendor: 'Ordnance Depot',
      purchasedAt: daysAgo(30),
      createdById: logistics.id,
    },
  });
  await prisma.purchase.create({
    data: {
      baseId: south.id,
      assetId: rifle.id,
      quantity: 150,
      unitCost: 1200,
      purchasedAt: daysAgo(28),
      createdById: admin.id,
    },
  });
  await prisma.purchase.create({
    data: {
      baseId: east.id,
      assetId: radio.id,
      quantity: 40,
      unitCost: 6500,
      purchasedAt: daysAgo(20),
      createdById: admin.id,
    },
  });

  // Transfers
  await prisma.transfer.create({
    data: {
      fromBaseId: north.id,
      toBaseId: south.id,
      assetId: rifle.id,
      quantity: 25,
      transferredAt: daysAgo(15),
      notes: 'Reinforcement allotment',
      createdById: logistics.id,
      status: 'COMPLETED',
    },
  });
  await prisma.transfer.create({
    data: {
      fromBaseId: north.id,
      toBaseId: east.id,
      assetId: ammo.id,
      quantity: 10000,
      transferredAt: daysAgo(10),
      notes: 'Training support',
      createdById: logistics.id,
      status: 'COMPLETED',
    },
  });
  await prisma.transfer.create({
    data: {
      fromBaseId: south.id,
      toBaseId: north.id,
      assetId: rifle.id,
      quantity: 5,
      transferredAt: daysAgo(5),
      notes: 'Return of surplus',
      createdById: admin.id,
      status: 'COMPLETED',
    },
  });

  // Inventory balances (derived from seed movements)
  // North: humvee 12; rifle 200-25+5=180; ammo 50000-10000=40000
  // South: rifle 150+25-5=170
  // East: radio 40; ammo 10000
  const balances = [
    { baseId: north.id, assetId: humvee.id, quantity: 12 },
    { baseId: north.id, assetId: rifle.id, quantity: 170 }, // after assign/expend below adjust
    { baseId: north.id, assetId: ammo.id, quantity: 38000 },
    { baseId: south.id, assetId: rifle.id, quantity: 170 },
    { baseId: east.id, assetId: radio.id, quantity: 40 },
    { baseId: east.id, assetId: ammo.id, quantity: 10000 },
  ];

  // Assignments & expenditures at North
  await prisma.assignment.create({
    data: {
      baseId: north.id,
      assetId: rifle.id,
      quantity: 10,
      personnelName: 'Sgt. Rivera',
      personnelId: 'SVC-88421',
      assignedAt: daysAgo(8),
      createdById: commander.id,
    },
  });
  await prisma.expenditure.create({
    data: {
      baseId: north.id,
      assetId: ammo.id,
      quantity: 2000,
      reason: 'Live-fire exercise',
      expendedAt: daysAgo(7),
      createdById: commander.id,
    },
  });

  // Final balances reflecting assignment (10 rifles) + expenditure (2000 ammo)
  balances[1].quantity = 170; // rifles: 200 - 25 + 5 - 10 assigned = 170
  balances[2].quantity = 38000; // ammo: 50000 - 10000 - 2000 = 38000

  for (const b of balances) {
    await prisma.inventoryBalance.create({ data: b });
  }

  console.log('Seed complete.');
  console.log('\nDemo logins (password: Password123!):');
  console.log('  Admin:              admin@mams.mil');
  console.log('  Base Commander:     commander.fax@mams.mil  (Fort Apex)');
  console.log('  Logistics Officer:  logistics.fax@mams.mil  (Fort Apex)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
