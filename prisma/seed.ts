import 'dotenv/config';
import { PrismaClient, RuleOperator } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const organization = await prisma.organization.upsert({
    where: {
      slug: 'flagpilot-demo',
    },
    update: {},
    create: {
      name: 'FlagPilot Demo Organization',
      slug: 'flagpilot-demo',
    },
  });

  await prisma.user.upsert({
    where: {
      email: 'admin@flagpilot.dev',
    },
    update: {},
    create: {
      email: 'admin@flagpilot.dev',
      passwordHash,
      name: 'Demo Admin',
      role: 'OWNER',
      organizationId: organization.id,
    },
  });

  const project = await prisma.project.upsert({
    where: {
      organizationId_key: {
        organizationId: organization.id,
        key: 'plai-platform',
      },
    },
    update: {},
    create: {
      name: 'PLAI Platform',
      key: 'plai-platform',
      description: 'Demo project for FlagPilot',
      organizationId: organization.id,
    },
  });

  const production = await prisma.environment.upsert({
    where: {
      projectId_key: {
        projectId: project.id,
        key: 'production',
      },
    },
    update: {},
    create: {
      name: 'Production',
      key: 'production',
      projectId: project.id,
    },
  });

  const demoRawApiKey = 'fp_live_demo_123456789';

  const apiKeyPepper = process.env.API_KEY_PEPPER;

  if (!apiKeyPepper) {
    throw new Error('API_KEY_PEPPER is not defined');
  }

  const demoApiKeyHash = createHash('sha256')
    .update(`${demoRawApiKey}.${apiKeyPepper}`)
    .digest('hex');

  await prisma.apiKey.upsert({
    where: {
      id: 'demo-sdk-api-key',
    },
    update: {
      keyHash: demoApiKeyHash,
      prefix: demoRawApiKey.slice(0, 16),
      organizationId: organization.id,
      projectId: project.id,
      environmentId: production.id,
      revokedAt: null,
    },
    create: {
      id: 'demo-sdk-api-key',
      name: 'Demo Production SDK Key',
      keyHash: demoApiKeyHash,
      prefix: demoRawApiKey.slice(0, 16),
      organizationId: organization.id,
      projectId: project.id,
      environmentId: production.id,
    },
  });

  console.log(`Demo SDK API key: ${demoRawApiKey}`);

  const staging = await prisma.environment.upsert({
    where: {
      projectId_key: {
        projectId: project.id,
        key: 'staging',
      },
    },
    update: {},
    create: {
      name: 'Staging',
      key: 'staging',
      projectId: project.id,
    },
  });

  const development = await prisma.environment.upsert({
    where: {
      projectId_key: {
        projectId: project.id,
        key: 'development',
      },
    },
    update: {},
    create: {
      name: 'Development',
      key: 'development',
      projectId: project.id,
    },
  });

  await createFlagWithConfigs({
    projectId: project.id,
    key: 'new-kiosk-payment-screen',
    name: 'New Kiosk Payment Screen',
    configs: [
      {
        environmentId: production.id,
        enabled: true,
        defaultValue: false,
        rules: [
          {
            attribute: 'kioskId',
            operator: RuleOperator.IN,
            values: ['KIOSK-102', 'KIOSK-218'],
          },
        ],
      },
    ],
  });

  await createFlagWithConfigs({
    projectId: project.id,
    key: 'new-booking-flow',
    name: 'New Booking Flow',
    configs: [
      {
        environmentId: staging.id,
        enabled: true,
        defaultValue: true,
        rules: [],
      },
      {
        environmentId: production.id,
        enabled: false,
        defaultValue: false,
        rules: [],
      },
    ],
  });

  await createFlagWithConfigs({
    projectId: project.id,
    key: 'admin-analytics-panel',
    name: 'Admin Analytics Panel',
    configs: [
      {
        environmentId: production.id,
        enabled: true,
        defaultValue: false,
        rules: [
          {
            attribute: 'role',
            operator: RuleOperator.EQUALS,
            values: ['admin'],
          },
        ],
      },
    ],
  });

  await createFlagWithConfigs({
    projectId: project.id,
    key: 'new-checkout',
    name: 'New Checkout',
    configs: [
      {
        environmentId: production.id,
        enabled: true,
        defaultValue: false,
        rules: [
          {
            attribute: 'userId',
            operator: RuleOperator.PERCENTAGE_ROLLOUT,
            values: [],
            rolloutPercentage: 10,
          },
        ],
      },
    ],
  });

  // Просто чтобы development не болтался как заброшенная декорация.
  await createFlagWithConfigs({
    projectId: project.id,
    key: 'dev-debug-toolbar',
    name: 'Developer Debug Toolbar',
    configs: [
      {
        environmentId: development.id,
        enabled: true,
        defaultValue: true,
        rules: [],
      },
    ],
  });

  console.log('Seed completed');
}

type CreateFlagWithConfigsParams = {
  projectId: string;
  key: string;
  name: string;
  configs: Array<{
    environmentId: string;
    enabled: boolean;
    defaultValue: boolean;
    rules: Array<{
      attribute: string;
      operator: RuleOperator;
      values: string[];
      rolloutPercentage?: number;
    }>;
  }>;
};

async function createFlagWithConfigs(params: CreateFlagWithConfigsParams) {
  const flag = await prisma.featureFlag.upsert({
    where: {
      projectId_key: {
        projectId: params.projectId,
        key: params.key,
      },
    },
    update: {
      name: params.name,
    },
    create: {
      projectId: params.projectId,
      key: params.key,
      name: params.name,
    },
  });

  for (const configInput of params.configs) {
    const config = await prisma.flagEnvironmentConfig.upsert({
      where: {
        flagId_environmentId: {
          flagId: flag.id,
          environmentId: configInput.environmentId,
        },
      },
      update: {
        enabled: configInput.enabled,
        defaultValue: configInput.defaultValue,
      },
      create: {
        flagId: flag.id,
        environmentId: configInput.environmentId,
        enabled: configInput.enabled,
        defaultValue: configInput.defaultValue,
      },
    });

    await prisma.targetingRule.deleteMany({
      where: {
        configId: config.id,
      },
    });

    if (configInput.rules.length > 0) {
      await prisma.targetingRule.createMany({
        data: configInput.rules.map((rule) => ({
          configId: config.id,
          attribute: rule.attribute,
          operator: rule.operator,
          values: rule.values,
          rolloutPercentage: rule.rolloutPercentage,
        })),
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
