import { PrismaClient, PricingType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Needs Database Seed (Safe Reference Data)...');

  // 1. System Roles
  const superAdminRole = await prisma.roleDefinition.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with full platform oversight',
      isSystem: true,
    },
  });

  await prisma.roleDefinition.upsert({
    where: { name: 'OPERATIONS' },
    update: {},
    create: {
      name: 'OPERATIONS',
      description: 'Operations Manager for provider verification and dispatch oversight',
      isSystem: true,
    },
  });

  await prisma.roleDefinition.upsert({
    where: { name: 'SUPPORT' },
    update: {},
    create: {
      name: 'SUPPORT',
      description: 'Customer and Provider Support Agent',
      isSystem: true,
    },
  });

  await prisma.roleDefinition.upsert({
    where: { name: 'FINANCE' },
    update: {},
    create: {
      name: 'FINANCE',
      description: 'Financial Auditor for ledger, refunds and payouts',
      isSystem: true,
    },
  });

  console.log('✅ System roles seeded');

  // 2. Foundational Permissions
  const permissionsList = [
    { action: 'users:read', module: 'users', description: 'View user accounts' },
    { action: 'users:write', module: 'users', description: 'Modify user accounts' },
    { action: 'providers:verify', module: 'providers', description: 'Approve or reject provider KYC' },
    { action: 'providers:suspend', module: 'providers', description: 'Suspend active provider' },
    { action: 'catalog:manage', module: 'catalog', description: 'Create and edit service catalog' },
    { action: 'bookings:manage', module: 'bookings', description: 'Manage and override bookings' },
    { action: 'payments:refund', module: 'payments', description: 'Execute customer refunds' },
    { action: 'payouts:approve', module: 'wallet', description: 'Approve provider payouts' },
    { action: 'coupons:manage', module: 'coupons', description: 'Create and manage coupons' },
    { action: 'audit:read', module: 'audit', description: 'View audit logs' },
  ];

  for (const perm of permissionsList) {
    const createdPerm = await prisma.permission.upsert({
      where: { action: perm.action },
      update: {},
      create: perm,
    });

    // Link all permissions to superAdmin role
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: createdPerm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: createdPerm.id,
      },
    });
  }

  console.log('✅ System permissions seeded');

  // 3. Service Categories & Base Catalog
  const categoriesData = [
    {
      name: 'AC Repair & Servicing',
      slug: 'ac-repair',
      description: 'Air conditioner servicing, installation, and gas refilling',
      services: [
        {
          name: 'AC Master Servicing',
          slug: 'ac-master-servicing',
          description: 'Comprehensive cleaning and jet-wash servicing for split ACs',
          basePrice: 1200.0,
          pricingType: PricingType.FIXED,
          durationMinutes: 90,
        },
        {
          name: 'AC Gas Top-up',
          slug: 'ac-gas-topup',
          description: 'High-purity refrigerant top-up with leak inspection',
          basePrice: 1800.0,
          pricingType: PricingType.FIXED,
          durationMinutes: 60,
        },
      ],
    },
    {
      name: 'Plumbing & Sanitary',
      slug: 'plumbing',
      description: 'Water pipe repair, faucet fixing, and sanitary fittings',
      services: [
        {
          name: 'Water Pipe Leakage Repair',
          slug: 'pipe-leak-repair',
          description: 'Leak detection and PVC/GI pipe replacement',
          basePrice: 500.0,
          pricingType: PricingType.HOURLY,
          durationMinutes: 60,
        },
      ],
    },
    {
      name: 'Electrical & Wiring',
      slug: 'electrical',
      description: 'Electricians for wiring, switches, and appliance fixes',
      services: [
        {
          name: 'Ceiling Fan Installation',
          slug: 'fan-installation',
          description: 'Safe ceiling fan mounting and regulator wiring',
          basePrice: 350.0,
          pricingType: PricingType.FIXED,
          durationMinutes: 45,
        },
      ],
    },
    {
      name: 'Home Cleaning',
      slug: 'home-cleaning',
      description: 'Residential cleaning, disinfection, and sanitation',
      services: [
        {
          name: 'Deep Home Cleaning',
          slug: 'deep-home-cleaning',
          description: 'Full house deep cleaning with industrial floor scrubbers',
          basePrice: 2500.0,
          pricingType: PricingType.CUSTOM_QUOTE,
          durationMinutes: 180,
        },
      ],
    },
  ];

  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
    });

    for (const s of cat.services) {
      await prisma.service.upsert({
        where: { slug: s.slug },
        update: {},
        create: {
          categoryId: category.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          basePrice: s.basePrice,
          pricingType: s.pricingType,
          durationMinutes: s.durationMinutes,
        },
      });
    }
  }

  console.log('✅ Service categories and reference catalog seeded');
  console.log('🌱 Safe reference data seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
