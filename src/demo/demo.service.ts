import {
  BadRequestException,
  GoneException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  type DemoSession,
  Prisma,
  RuleOperator,
} from '@prisma/client';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { ApiKeyHasherService } from '../api-keys/api-key-hasher.service';
import { PrismaService } from '../prisma/prisma.service';
import { SdkService } from '../sdk/sdk.service';
import type { EvaluateFlagDto } from '../sdk/dto/evaluate-flag.dto';
import type { EvaluateFlagsBatchDto } from '../sdk/dto/evaluate-flags-batch.dto';
import { DemoRateLimitService } from './demo-rate-limit.service';

const DEMO_TTL_MS = 10 * 60 * 1_000;
const DEMO_FLAG_KEYS = [
  'new-navigation',
  'instant-search',
  'pro-recommendations',
] as const;
const DEMO_FLAG_KEY_SET = new Set<string>(DEMO_FLAG_KEYS);
const DEMO_ENVIRONMENT = 'demo';

type DemoState = {
  navigationEnabled: boolean;
  rolloutPercentage: number;
  expiresAt: string;
};

@Injectable()
export class DemoService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly apiKeyHasher: ApiKeyHasherService,
    private readonly sdkService: SdkService,
    private readonly rateLimits: DemoRateLimitService,
  ) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired().catch(() => undefined);
    }, 60_000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  async createSession(clientId: string) {
    if (!clientId || clientId.length > 128) {
      throw new BadRequestException('Valid demo client id is required');
    }

    this.rateLimits.consume('session-create', clientId, 5, DEMO_TTL_MS);
    await this.cleanupExpired();

    const sessionId = randomUUID();
    const sessionToken = `rt_session_${randomBytes(32).toString('hex')}`;
    const tokenHash = this.hashSessionToken(sessionToken);
    const rawApiKey = this.apiKeyHasher.generateRawKey();
    const apiKeyHash = this.apiKeyHasher.hash(rawApiKey);
    const apiKeyPrefix = this.apiKeyHasher.getPrefix(rawApiKey);
    const expiresAt = new Date(Date.now() + DEMO_TTL_MS);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { slug: 'runtime-control-demo' },
        update: { name: 'Runtime Control Demo' },
        create: {
          name: 'Runtime Control Demo',
          slug: 'runtime-control-demo',
        },
      });

      const project = await tx.project.create({
        data: {
          organizationId: organization.id,
          name: 'Product Discovery Session',
          key: `product-discovery-${sessionId}`,
          description: 'Ephemeral Runtime Control showcase session',
        },
      });

      const environment = await tx.environment.create({
        data: {
          projectId: project.id,
          name: 'Demo',
          key: DEMO_ENVIRONMENT,
        },
      });

      await this.createFlag(tx, {
        projectId: project.id,
        environmentId: environment.id,
        key: 'new-navigation',
        name: 'New navigation',
        enabled: false,
        defaultValue: true,
      });

      const searchFlag = await this.createFlag(tx, {
        projectId: project.id,
        environmentId: environment.id,
        key: 'instant-search',
        name: 'Instant search',
        enabled: true,
        defaultValue: false,
      });

      await tx.targetingRule.create({
        data: {
          configId: searchFlag.configId,
          attribute: 'userId',
          operator: RuleOperator.PERCENTAGE_ROLLOUT,
          values: [],
          rolloutPercentage: 0,
        },
      });

      const recommendationsFlag = await this.createFlag(tx, {
        projectId: project.id,
        environmentId: environment.id,
        key: 'pro-recommendations',
        name: 'Pro recommendations',
        enabled: true,
        defaultValue: false,
      });

      await tx.targetingRule.create({
        data: {
          configId: recommendationsFlag.configId,
          attribute: 'plan',
          operator: RuleOperator.EQUALS,
          values: ['pro'],
          rolloutPercentage: null,
        },
      });

      const apiKey = await tx.apiKey.create({
        data: {
          name: 'Runtime Control session key',
          keyHash: apiKeyHash,
          prefix: apiKeyPrefix,
          organizationId: organization.id,
          projectId: project.id,
          environmentId: environment.id,
        },
      });

      const session = await tx.demoSession.create({
        data: {
          id: sessionId,
          tokenHash,
          projectId: project.id,
          environmentId: environment.id,
          apiKeyId: apiKey.id,
          clientId,
          expiresAt,
        },
      });

      return { session };
    });

    return {
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt.toISOString(),
      },
      sessionToken,
      sdk: {
        apiKey: rawApiKey,
        environment: DEMO_ENVIRONMENT,
      },
      state: await this.getStateForSession(result.session),
      activity: [],
    };
  }

  async getSessionState(sessionToken: string) {
    const session = await this.requireSession(sessionToken);
    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt.toISOString(),
      },
      state: await this.getStateForSession(session),
      activity: await this.getActivityForSession(session),
    };
  }

  async setNavigation(sessionToken: string, enabled: boolean) {
    const session = await this.requireSession(sessionToken);
    this.rateLimits.consume('mutation', session.id, 60, 60_000);

    await this.prisma.$transaction(async (tx) => {
      const flag = await this.findFlagConfig(tx, session, 'new-navigation');
      const before = { enabled: flag.config.enabled };
      const updated = await tx.flagEnvironmentConfig.update({
        where: { id: flag.config.id },
        data: { enabled, defaultValue: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: flag.organizationId,
          projectId: session.projectId,
          flagId: flag.id,
          action: AuditAction.UPDATE,
          entityType: 'FlagEnvironmentConfig',
          entityId: flag.config.id,
          before,
          after: { enabled: updated.enabled },
        },
      });
    });

    return this.composeSessionResponse(session);
  }

  async setRollout(sessionToken: string, percentage: 0 | 50 | 100) {
    const session = await this.requireSession(sessionToken);
    this.rateLimits.consume('mutation', session.id, 60, 60_000);

    await this.prisma.$transaction(async (tx) => {
      const flag = await this.findFlagConfig(tx, session, 'instant-search');
      const rule = await tx.targetingRule.findFirst({
        where: {
          configId: flag.config.id,
          operator: RuleOperator.PERCENTAGE_ROLLOUT,
        },
      });

      if (!rule) {
        throw new BadRequestException('Demo rollout rule is unavailable');
      }

      const before = { rolloutPercentage: rule.rolloutPercentage };
      const updated = await tx.targetingRule.update({
        where: { id: rule.id },
        data: { rolloutPercentage: percentage },
      });

      await tx.auditLog.create({
        data: {
          organizationId: flag.organizationId,
          projectId: session.projectId,
          flagId: flag.id,
          action: AuditAction.UPDATE,
          entityType: 'TargetingRule',
          entityId: rule.id,
          before,
          after: { rolloutPercentage: updated.rolloutPercentage },
        },
      });
    });

    return this.composeSessionResponse(session);
  }

  async reset(sessionToken: string) {
    const session = await this.requireSession(sessionToken);
    this.rateLimits.consume('mutation', session.id, 60, 60_000);

    await this.prisma.$transaction(async (tx) => {
      const navigation = await this.findFlagConfig(
        tx,
        session,
        'new-navigation',
      );
      const search = await this.findFlagConfig(tx, session, 'instant-search');
      const rollout = await tx.targetingRule.findFirst({
        where: {
          configId: search.config.id,
          operator: RuleOperator.PERCENTAGE_ROLLOUT,
        },
      });

      const updatedNavigation = await tx.flagEnvironmentConfig.update({
        where: { id: navigation.config.id },
        data: { enabled: false, defaultValue: true },
      });

      await tx.auditLog.create({
        data: {
          organizationId: navigation.organizationId,
          projectId: session.projectId,
          flagId: navigation.id,
          action: AuditAction.UPDATE,
          entityType: 'FlagEnvironmentConfig',
          entityId: navigation.config.id,
          before: { enabled: navigation.config.enabled },
          after: { enabled: updatedNavigation.enabled },
        },
      });

      if (rollout) {
        const updatedRollout = await tx.targetingRule.update({
          where: { id: rollout.id },
          data: { rolloutPercentage: 0 },
        });

        await tx.auditLog.create({
          data: {
            organizationId: search.organizationId,
            projectId: session.projectId,
            flagId: search.id,
            action: AuditAction.UPDATE,
            entityType: 'TargetingRule',
            entityId: rollout.id,
            before: { rolloutPercentage: rollout.rolloutPercentage },
            after: { rolloutPercentage: updatedRollout.rolloutPercentage },
          },
        });
      }
    });

    return this.composeSessionResponse(session);
  }

  async evaluateFlag(
    sessionToken: string,
    apiKey: string,
    dto: EvaluateFlagDto,
  ) {
    const session = await this.requireSession(sessionToken);
    this.rateLimits.consume('evaluation', session.id, 180, 60_000);
    this.validateFlagKeys([dto.flagKey]);
    this.validateContext(dto.context);
    await this.verifySessionApiKey(session, apiKey);

    return this.sdkService.evaluateFlag({
      flagKey: dto.flagKey,
      context: {
        environment: DEMO_ENVIRONMENT,
        ...dto.context,
      },
      projectId: session.projectId,
      environmentId: session.environmentId,
    });
  }

  async evaluateBatch(
    sessionToken: string,
    apiKey: string,
    dto: EvaluateFlagsBatchDto,
  ) {
    const session = await this.requireSession(sessionToken);
    this.rateLimits.consume('evaluation', session.id, 180, 60_000);
    this.validateFlagKeys(dto.flagKeys);
    this.validateContext(dto.context);
    await this.verifySessionApiKey(session, apiKey);

    return this.sdkService.evaluateFlagsBatch({
      flagKeys: dto.flagKeys,
      context: {
        environment: DEMO_ENVIRONMENT,
        ...dto.context,
      },
      projectId: session.projectId,
      environmentId: session.environmentId,
    });
  }

  async cleanupExpired(now = new Date()) {
    const expired = await this.prisma.demoSession.findMany({
      where: { expiresAt: { lte: now } },
    });

    for (const session of expired) {
      await this.deleteSession(session);
    }

    return { deleted: expired.length };
  }

  private async composeSessionResponse(session: DemoSession) {
    return {
      state: await this.getStateForSession(session),
      activity: await this.getActivityForSession(session),
    };
  }

  private async createFlag(
    tx: Prisma.TransactionClient,
    params: {
      projectId: string;
      environmentId: string;
      key: string;
      name: string;
      enabled: boolean;
      defaultValue: boolean;
    },
  ) {
    const flag = await tx.featureFlag.create({
      data: {
        projectId: params.projectId,
        key: params.key,
        name: params.name,
      },
    });
    const config = await tx.flagEnvironmentConfig.create({
      data: {
        flagId: flag.id,
        environmentId: params.environmentId,
        enabled: params.enabled,
        defaultValue: params.defaultValue,
      },
    });

    return { flagId: flag.id, configId: config.id };
  }

  private async requireSession(sessionToken: string): Promise<DemoSession> {
    if (!sessionToken) {
      throw new UnauthorizedException('Missing demo session');
    }

    const session = await this.prisma.demoSession.findUnique({
      where: { tokenHash: this.hashSessionToken(sessionToken) },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid demo session');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.deleteSession(session);
      throw new GoneException('Demo session expired');
    }

    return session;
  }

  private async verifySessionApiKey(session: DemoSession, rawApiKey: string) {
    if (!rawApiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: session.apiKeyId,
        projectId: session.projectId,
        environmentId: session.environmentId,
        prefix: this.apiKeyHasher.getPrefix(rawApiKey),
        keyHash: this.apiKeyHasher.hash(rawApiKey),
        revokedAt: null,
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid session API key');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  }

  private validateFlagKeys(flagKeys: string[]) {
    const unique = [...new Set(flagKeys)];

    if (
      unique.length === 0 ||
      unique.length > DEMO_FLAG_KEYS.length ||
      unique.some((flagKey) => !DEMO_FLAG_KEY_SET.has(flagKey))
    ) {
      throw new BadRequestException('Unsupported demo flag key');
    }
  }

  private validateContext(context: Record<string, string | number | boolean>) {
    if (JSON.stringify(context).length > 512) {
      throw new BadRequestException('Evaluation context is too large');
    }

    const allowedKeys = new Set(['environment', 'userId', 'plan']);
    const hasUnexpectedKey = Object.keys(context).some(
      (key) => !allowedKeys.has(key),
    );

    if (hasUnexpectedKey) {
      throw new BadRequestException('Unsupported evaluation context');
    }

    if (
      context.environment !== undefined &&
      context.environment !== DEMO_ENVIRONMENT
    ) {
      throw new BadRequestException('Unsupported demo environment');
    }

    if (
      context.userId !== undefined &&
      !['sam', 'alex'].includes(String(context.userId))
    ) {
      throw new BadRequestException('Unsupported demo user');
    }

    if (
      context.plan !== undefined &&
      !['free', 'pro'].includes(String(context.plan))
    ) {
      throw new BadRequestException('Unsupported demo plan');
    }
  }

  private async getStateForSession(session: DemoSession): Promise<DemoState> {
    const flags = await this.prisma.featureFlag.findMany({
      where: { projectId: session.projectId },
      include: {
        configs: {
          where: { environmentId: session.environmentId },
          include: { rules: true },
        },
      },
    });
    const navigation = flags.find((flag) => flag.key === 'new-navigation');
    const search = flags.find((flag) => flag.key === 'instant-search');
    const rollout = search?.configs[0]?.rules.find(
      (rule) => rule.operator === RuleOperator.PERCENTAGE_ROLLOUT,
    );

    return {
      navigationEnabled: navigation?.configs[0]?.enabled ?? false,
      rolloutPercentage: rollout?.rolloutPercentage ?? 0,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private async getActivityForSession(session: DemoSession) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        projectId: session.projectId,
        entityType: { in: ['FlagEnvironmentConfig', 'TargetingRule'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        flag: { select: { key: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      kind: 'PERSISTED_AUDIT' as const,
      label:
        log.entityType === 'TargetingRule' ? 'RULE UPDATED' : 'CONFIG UPDATED',
      flagKey: log.flag?.key ?? 'unknown',
      value: log.after,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  private async findFlagConfig(
    tx: Prisma.TransactionClient,
    session: DemoSession,
    flagKey: string,
  ) {
    const flag = await tx.featureFlag.findFirst({
      where: { projectId: session.projectId, key: flagKey },
      include: {
        project: { select: { organizationId: true } },
        configs: { where: { environmentId: session.environmentId } },
      },
    });

    if (!flag || !flag.configs[0]) {
      throw new BadRequestException('Demo flag configuration is unavailable');
    }

    return {
      ...flag,
      config: flag.configs[0],
      organizationId: flag.project.organizationId,
    };
  }

  private async deleteSession(session: DemoSession) {
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { projectId: session.projectId } });
      await tx.demoSession.deleteMany({ where: { id: session.id } });
      await tx.project.deleteMany({ where: { id: session.projectId } });
    });
  }

  private hashSessionToken(token: string): string {
    const secret = this.config.get<string>('DEMO_TOKEN_SECRET');

    if (!secret) {
      throw new Error('DEMO_TOKEN_SECRET is not defined');
    }

    return createHmac('sha256', secret).update(token).digest('hex');
  }
}
