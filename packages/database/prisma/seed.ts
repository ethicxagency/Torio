import { PrismaClient, MembershipRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: "org:read", name: "View Organization", module: "organization" },
  { key: "org:update", name: "Update Organization", module: "organization" },
  { key: "team:read", name: "View Team", module: "team" },
  { key: "team:invite", name: "Invite Team Members", module: "team" },
  { key: "team:manage", name: "Manage Team Roles", module: "team" },
  { key: "inbox:read", name: "View Inbox", module: "inbox" },
  { key: "inbox:reply", name: "Reply to Conversations", module: "inbox" },
  { key: "inbox:assign", name: "Assign Conversations", module: "inbox" },
  { key: "inbox:close", name: "Close Conversations", module: "inbox" },
  { key: "customers:read", name: "View Customers", module: "customers" },
  { key: "customers:update", name: "Update Customers", module: "customers" },
  { key: "tags:manage", name: "Manage Tags", module: "tags" },
  { key: "notes:manage", name: "Manage Notes", module: "notes" },
  { key: "knowledge:read", name: "View Knowledge Base", module: "knowledge" },
  { key: "knowledge:manage", name: "Manage Knowledge Base", module: "knowledge" },
  { key: "channels:read", name: "View Channels", module: "channels" },
  { key: "channels:manage", name: "Manage Channels", module: "channels" },
  { key: "ai:read", name: "View AI Settings", module: "ai" },
  { key: "ai:manage", name: "Manage AI Settings", module: "ai" },
  { key: "analytics:read", name: "View Analytics", module: "analytics" },
  { key: "billing:read", name: "View Billing", module: "billing" },
  { key: "billing:manage", name: "Manage Billing", module: "billing" },
  { key: "settings:manage", name: "Manage Settings", module: "settings" },
];

const ROLE_PERMISSIONS: Record<MembershipRole, string[]> = {
  OWNER: PERMISSIONS.map((p) => p.key),
  ADMIN: PERMISSIONS.filter((p) => !p.key.startsWith("billing:manage")).map((p) => p.key),
  AGENT: [
    "inbox:read",
    "inbox:reply",
    "inbox:close",
    "customers:read",
    "customers:update",
    "tags:manage",
    "notes:manage",
    "knowledge:read",
    "analytics:read",
  ],
};

const PLANS = [
  {
    name: "Starter",
    slug: "starter",
    description: "For small shops getting started with omnichannel messaging",
    priceMonthly: 1499,
    priceYearly: 14990,
    maxAgents: 2,
    maxChannels: 2,
    maxMessages: 2000,
    maxAiReplies: 500,
    maxStorageMb: 500,
    features: ["Unified Inbox", "AI Support (Basic)", "2 Channels", "Email Support"],
    sortOrder: 1,
  },
  {
    name: "Growth",
    slug: "growth",
    description: "For growing eCommerce brands with team collaboration",
    priceMonthly: 3999,
    priceYearly: 39990,
    maxAgents: 5,
    maxChannels: 3,
    maxMessages: 10000,
    maxAiReplies: 3000,
    maxStorageMb: 2000,
    features: ["All Starter features", "Team Collaboration", "Knowledge Base", "Analytics", "Priority Support"],
    sortOrder: 2,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "For agencies and high-volume merchants",
    priceMonthly: 9999,
    priceYearly: 99990,
    maxAgents: 25,
    maxChannels: 10,
    maxMessages: 100000,
    maxAiReplies: 20000,
    maxStorageMb: 10000,
    features: ["All Growth features", "Unlimited AI Training", "API Access", "Dedicated Support", "Custom Integrations"],
    sortOrder: 3,
  },
];

async function main() {
  console.log("Seeding permissions...");
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, module: perm.module },
      create: perm,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.key, p.id]));

  console.log("Seeding role permissions...");
  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS) as [MembershipRole, string[]][]) {
    for (const key of keys) {
      const permissionId = permMap[key];
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId } },
        update: {},
        create: { role, permissionId },
      });
    }
  }

  console.log("Seeding plans...");
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@mango.app";
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD ?? "changeme-in-production";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  console.log("Seeding platform admin...");
  await prisma.platformAdmin.upsert({
    where: { email: adminEmail },
    update: { passwordHash, name: "Platform Admin" },
    create: {
      email: adminEmail,
      passwordHash,
      name: "Platform Admin",
    },
  });

  const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@torio.app";
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? "demo123456";
  const demoPasswordHash = await bcrypt.hash(demoPassword, 12);
  const starterPlan = await prisma.plan.findFirst({
    where: { slug: "starter", isActive: true },
  });

  if (!starterPlan) {
    throw new Error("Starter plan not found. Seed plans before creating demo user.");
  }

  console.log("Seeding demo user...");
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      passwordHash: demoPasswordHash,
      name: "Demo User",
      emailVerifiedAt: now,
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: demoEmail,
      passwordHash: demoPasswordHash,
      name: "Demo User",
      emailVerifiedAt: now,
    },
  });

  const demoOrgSlug = "demo-store";
  const demoOrg = await prisma.organization.upsert({
    where: { slug: demoOrgSlug },
    update: {
      name: "Demo Store",
      industry: "Fashion",
      website: "https://demo.torio.app",
      onboardingStep: "COMPLETED",
      onboardingCompletedAt: now,
      status: "ACTIVE",
      deletedAt: null,
    },
    create: {
      name: "Demo Store",
      slug: demoOrgSlug,
      country: "BD",
      timezone: "Asia/Dhaka",
      currency: "BDT",
      industry: "Fashion",
      website: "https://demo.torio.app",
      onboardingStep: "COMPLETED",
      onboardingCompletedAt: now,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
      },
    },
    update: {
      role: MembershipRole.OWNER,
      isActive: true,
      deletedAt: null,
    },
    create: {
      organizationId: demoOrg.id,
      userId: demoUser.id,
      role: MembershipRole.OWNER,
    },
  });

  const existingSubscription = await prisma.subscription.findFirst({
    where: { organizationId: demoOrg.id },
  });

  if (existingSubscription) {
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        planId: starterPlan.id,
        status: "TRIALING",
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        trialEndsAt: trialEnd,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        organizationId: demoOrg.id,
        planId: starterPlan.id,
        status: "TRIALING",
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        trialEndsAt: trialEnd,
      },
    });
  }

  await prisma.aiSettings.upsert({
    where: { organizationId: demoOrg.id },
    update: {},
    create: { organizationId: demoOrg.id },
  });

  await prisma.brainSettings.upsert({
    where: { organizationId: demoOrg.id },
    update: {},
    create: { organizationId: demoOrg.id },
  });

  console.log("Seeding demo Torio Brain...");
  const demoCategories = [
    {
      type: "BUSINESS_INFO" as const,
      title: "Business Information",
      sortOrder: 1,
      entries: [
        { key: "business_name", label: "Business Name", value: "Demo Store" },
        { key: "business_description", label: "Business Description", value: "Fashion eCommerce store for Bangladesh customers." },
        { key: "industry", label: "Industry", value: "Fashion" },
      ],
    },
    {
      type: "SHIPPING" as const,
      title: "Shipping Information",
      sortOrder: 2,
      entries: [
        { key: "shipping_areas", label: "Shipping Areas", value: "Cash On Delivery available all over Bangladesh" },
        { key: "delivery_time", label: "Delivery Time", value: "Delivery usually takes 2 to 5 business days" },
        { key: "delivery_charge", label: "Delivery Charge", value: "Inside Dhaka: 80 BDT, Outside Dhaka: 130 BDT" },
        { key: "international_shipping", label: "International Shipping", value: "We do not ship outside Bangladesh" },
      ],
    },
    {
      type: "PAYMENT" as const,
      title: "Payment Information",
      sortOrder: 3,
      entries: [
        { key: "cash_on_delivery", label: "Cash On Delivery", value: "Cash On Delivery is available nationwide" },
        { key: "mobile_banking", label: "Mobile Banking", value: "We accept bKash, Nagad, and Rocket" },
      ],
    },
  ];

  for (const cat of demoCategories) {
    const category = await prisma.brainCategory.upsert({
      where: { organizationId_type: { organizationId: demoOrg.id, type: cat.type } },
      update: { title: cat.title, sortOrder: cat.sortOrder },
      create: {
        organizationId: demoOrg.id,
        type: cat.type,
        title: cat.title,
        sortOrder: cat.sortOrder,
      },
    });

    for (const [index, entry] of cat.entries.entries()) {
      await prisma.brainEntry.upsert({
        where: {
          organizationId_categoryId_key: {
            organizationId: demoOrg.id,
            categoryId: category.id,
            key: entry.key,
          },
        },
        update: { value: entry.value, label: entry.label },
        create: {
          organizationId: demoOrg.id,
          categoryId: category.id,
          key: entry.key,
          label: entry.label,
          value: entry.value,
          sortOrder: index,
        },
      });
    }
  }

  await prisma.brainRule.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        name: "No same-day delivery",
        description: "Never promise same-day delivery.",
        rule: "Never promise same-day delivery.",
        type: "SHIPPING",
        priority: 10,
      },
      {
        organizationId: demoOrg.id,
        name: "Mention COD",
        description: "Always mention Cash On Delivery availability.",
        rule: "Always mention Cash On Delivery availability.",
        type: "PAYMENT",
        priority: 5,
      },
      {
        organizationId: demoOrg.id,
        name: "Bangladesh only",
        description: "We only deliver inside Bangladesh.",
        rule: "We only deliver inside Bangladesh.",
        type: "SHIPPING",
        priority: 8,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.brainFAQ.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        question: "How long does delivery take?",
        answer: "Delivery usually takes 2 to 5 business days.",
      },
      {
        organizationId: demoOrg.id,
        question: "Do you deliver outside Bangladesh?",
        answer: "No, we only deliver inside Bangladesh.",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding demo Product Memory...");
  const poloShirt = await prisma.productMemory.create({
    data: {
      organizationId: demoOrg.id,
      name: "Classic Polo Shirt",
      sku: "POLO-001",
      category: "Shirts",
      brand: "Demo Store",
      price: 890,
      salePrice: 790,
      description: "Premium cotton polo shirt for everyday wear.",
      features: ["100% cotton", "Breathable fabric", "Regular fit"],
      benefits: ["Comfortable all day", "Easy to maintain", "Versatile styling"],
      specifications: "Fabric: Cotton · Fit: Regular · Care: Machine wash",
      stockStatus: "IN_STOCK",
      productUrl: "https://demo.torio.app/products/classic-polo-shirt",
      images: ["https://demo.torio.app/images/polo-black.jpg"],
      attributes: {
        create: [
          { organizationId: demoOrg.id, key: "color", value: "Black" },
          { organizationId: demoOrg.id, key: "size", value: "M, L, XL" },
          { organizationId: demoOrg.id, key: "material", value: "Cotton" },
        ],
      },
      faqs: {
        create: [
          {
            organizationId: demoOrg.id,
            question: "Is this available in black?",
            answer: "Yes, the Classic Polo Shirt is available in black.",
          },
          {
            organizationId: demoOrg.id,
            question: "What is the material?",
            answer: "It is made from 100% premium cotton.",
          },
        ],
      },
    },
  });

  await prisma.productMemory.create({
    data: {
      organizationId: demoOrg.id,
      name: "Premium Denim Jeans",
      sku: "JEANS-002",
      category: "Pants",
      brand: "Demo Store",
      price: 1490,
      description: "Stretch denim jeans with modern slim fit.",
      features: ["Stretch denim", "Slim fit", "Five-pocket design"],
      benefits: ["Flexible movement", "Durable construction"],
      stockStatus: "IN_STOCK",
      attributes: {
        create: [
          { organizationId: demoOrg.id, key: "color", value: "Blue" },
          { organizationId: demoOrg.id, key: "size", value: "30, 32, 34" },
        ],
      },
    },
  });

  console.log(`Demo products ready, including ${poloShirt.name}`);

  console.log("Seeding demo Order Memory...");
  const demoCustomer = await prisma.customer.upsert({
    where: { id: "demo-customer-rabiul" },
    update: {
      fullName: "Rabiul Hasan",
      phone: "+8801712345678",
      status: "CUSTOMER",
    },
    create: {
      id: "demo-customer-rabiul",
      organizationId: demoOrg.id,
      fullName: "Rabiul Hasan",
      phone: "+8801712345678",
      whatsappNumber: "+8801712345678",
      status: "CUSTOMER",
      firstContactAt: new Date(),
      lastContactAt: new Date(),
    },
  });

  const demoOrder = await prisma.orderMemory.upsert({
    where: {
      organizationId_orderNumber: {
        organizationId: demoOrg.id,
        orderNumber: "ORD-1001",
      },
    },
    update: {
      status: "OUT_FOR_DELIVERY",
      courier: "Pathao",
      trackingNumber: "PTH-778899",
    },
    create: {
      organizationId: demoOrg.id,
      customerId: demoCustomer.id,
      orderNumber: "ORD-1001",
      status: "OUT_FOR_DELIVERY",
      courier: "Pathao",
      trackingNumber: "PTH-778899",
      paymentMethod: "Cash on Delivery",
      orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      orderValue: 790,
      items: {
        create: [
          {
            organizationId: demoOrg.id,
            productId: poloShirt.id,
            productName: poloShirt.name,
            quantity: 1,
            unitPrice: 790,
          },
        ],
      },
    },
  });

  await prisma.customerInsight.upsert({
    where: { customerId: demoCustomer.id },
    update: {
      totalOrders: 1,
      totalRevenue: 790,
      lastPurchaseAt: demoOrder.orderDate,
      favoriteProducts: [poloShirt.name],
      repeatPurchaseBehavior: "First-time buyer",
      computedAt: new Date(),
    },
    create: {
      organizationId: demoOrg.id,
      customerId: demoCustomer.id,
      totalOrders: 1,
      totalRevenue: 790,
      lastPurchaseAt: demoOrder.orderDate,
      favoriteProducts: [poloShirt.name],
      repeatPurchaseBehavior: "First-time buyer",
    },
  });

  console.log(`Demo order ready: ${demoOrder.orderNumber} for ${demoCustomer.fullName}`);

  console.log(`Demo user ready: ${demoEmail} / ${demoPassword}`);

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
