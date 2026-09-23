import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import type { App } from 'supertest/types';

const serviceToken = 'runtime-control-test-service-token';

type CreatedSession = {
  session: { id: string; expiresAt: string };
  sessionToken: string;
  sdk: { apiKey: string; environment: string };
  state: { navigationEnabled: boolean; rolloutPercentage: number };
};

type DemoActivity = {
  kind: 'PERSISTED_AUDIT';
  label: 'CONFIG UPDATED' | 'RULE UPDATED';
  flagKey: string;
};

type SessionMutationResponse = {
  state: { navigationEnabled: boolean; rolloutPercentage: number };
  activity: DemoActivity[];
};

type BatchEvaluationResponse = {
  flags: Record<string, { enabled: boolean; reason: string }>;
};

describe('Runtime Control demo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let clientSequence = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  async function createSession(): Promise<CreatedSession> {
    clientSequence += 1;
    const response = await request(app.getHttpServer())
      .post('/demo/sessions')
      .set('x-demo-service-token', serviceToken)
      .set('x-demo-client-id', `e2e-client-${clientSequence}`)
      .expect(201);

    return response.body as CreatedSession;
  }

  function demoRequest(path: string, session: CreatedSession) {
    return request(app.getHttpServer())
      .post(path)
      .set('x-demo-service-token', serviceToken)
      .set('x-demo-session-token', session.sessionToken);
  }

  async function evaluate(
    session: CreatedSession,
    flagKeys: string[],
    context: { userId: 'sam' | 'alex'; plan: 'free' | 'pro' },
    apiKey = session.sdk.apiKey,
  ) {
    const response = await demoRequest('/demo/sdk/evaluate/batch', session)
      .set('x-api-key', apiKey)
      .send({
        flagKeys,
        context: { environment: 'demo', ...context },
      })
      .expect(201);

    return (response.body as BatchEvaluationResponse).flags;
  }

  it('creates a session and returns real baseline evaluations', async () => {
    const session = await createSession();
    const flags = await evaluate(
      session,
      ['new-navigation', 'instant-search', 'pro-recommendations'],
      { userId: 'sam', plan: 'free' },
    );

    expect(session.state).toMatchObject({
      navigationEnabled: false,
      rolloutPercentage: 0,
    });
    expect(flags['new-navigation']).toEqual({
      enabled: false,
      reason: 'FLAG_DISABLED',
    });
    expect(flags['instant-search']).toEqual({
      enabled: false,
      reason: 'ROLLOUT_NO_MATCH',
    });
    expect(flags['pro-recommendations']).toEqual({
      enabled: false,
      reason: 'TARGETING_NO_MATCH',
    });
  });

  it('mutates navigation and records persisted audit', async () => {
    const session = await createSession();
    const mutation = await demoRequest('/demo/navigation', session)
      .send({ enabled: true })
      .expect(201);
    const flags = await evaluate(session, ['new-navigation'], {
      userId: 'sam',
      plan: 'free',
    });

    const body = mutation.body as SessionMutationResponse;

    expect(body.state.navigationEnabled).toBe(true);
    expect(body.activity[0]).toMatchObject({
      kind: 'PERSISTED_AUDIT',
      label: 'CONFIG UPDATED',
      flagKey: 'new-navigation',
    });
    expect(flags['new-navigation']).toEqual({
      enabled: true,
      reason: 'DEFAULT_VALUE',
    });
  });

  it('uses deterministic rollout for Sam and Alex', async () => {
    const session = await createSession();
    await demoRequest('/demo/rollout', session)
      .send({ percentage: 50 })
      .expect(201);

    const sam = await evaluate(session, ['instant-search'], {
      userId: 'sam',
      plan: 'free',
    });
    const alex = await evaluate(session, ['instant-search'], {
      userId: 'alex',
      plan: 'free',
    });

    expect(sam['instant-search']).toEqual({
      enabled: true,
      reason: 'ROLLOUT_MATCH',
    });
    expect(alex['instant-search']).toEqual({
      enabled: false,
      reason: 'ROLLOUT_NO_MATCH',
    });
  });

  it('evaluates fixed plan targeting', async () => {
    const session = await createSession();
    const free = await evaluate(session, ['pro-recommendations'], {
      userId: 'sam',
      plan: 'free',
    });
    const pro = await evaluate(session, ['pro-recommendations'], {
      userId: 'sam',
      plan: 'pro',
    });

    expect(free['pro-recommendations']).toEqual({
      enabled: false,
      reason: 'TARGETING_NO_MATCH',
    });
    expect(pro['pro-recommendations']).toEqual({
      enabled: true,
      reason: 'TARGETING_MATCH',
    });
  });

  it('resets only the current session', async () => {
    const session = await createSession();
    await demoRequest('/demo/navigation', session)
      .send({ enabled: true })
      .expect(201);
    await demoRequest('/demo/rollout', session)
      .send({ percentage: 100 })
      .expect(201);

    const reset = await demoRequest('/demo/reset', session).expect(201);
    const flags = await evaluate(
      session,
      ['new-navigation', 'instant-search'],
      { userId: 'sam', plan: 'free' },
    );

    expect((reset.body as SessionMutationResponse).state).toMatchObject({
      navigationEnabled: false,
      rolloutPercentage: 0,
    });
    expect(flags['new-navigation'].reason).toBe('FLAG_DISABLED');
    expect(flags['instant-search'].reason).toBe('ROLLOUT_NO_MATCH');
  });

  it('isolates two sessions and rejects cross-session API keys', async () => {
    const first = await createSession();
    const second = await createSession();
    await demoRequest('/demo/navigation', first)
      .send({ enabled: true })
      .expect(201);

    const firstFlags = await evaluate(first, ['new-navigation'], {
      userId: 'sam',
      plan: 'free',
    });
    const secondFlags = await evaluate(second, ['new-navigation'], {
      userId: 'sam',
      plan: 'free',
    });

    expect(firstFlags['new-navigation'].enabled).toBe(true);
    expect(secondFlags['new-navigation'].enabled).toBe(false);

    await demoRequest('/demo/sdk/evaluate/batch', first)
      .set('x-api-key', second.sdk.apiKey)
      .send({
        flagKeys: ['new-navigation'],
        context: { environment: 'demo', userId: 'sam', plan: 'free' },
      })
      .expect(401);
  });

  it('rejects invalid sessions and forbidden rollout values', async () => {
    const session = await createSession();

    await request(app.getHttpServer())
      .post('/demo/navigation')
      .set('x-demo-service-token', serviceToken)
      .set('x-demo-session-token', 'invalid')
      .send({ enabled: true })
      .expect(401);

    await demoRequest('/demo/rollout', session)
      .send({ percentage: 25 })
      .expect(400);

    await demoRequest('/demo/sdk/evaluate/batch', session)
      .set('x-api-key', session.sdk.apiKey)
      .send({
        flagKeys: ['arbitrary-flag'],
        context: { environment: 'demo', userId: 'sam', plan: 'free' },
      })
      .expect(400);
  });

  it('deletes expired session data', async () => {
    const session = await createSession();
    const stored = await prisma.demoSession.findUniqueOrThrow({
      where: { id: session.session.id },
    });
    await prisma.demoSession.update({
      where: { id: session.session.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await demoRequest('/demo/navigation', session)
      .send({ enabled: true })
      .expect(410);

    expect(
      await prisma.demoSession.findUnique({
        where: { id: session.session.id },
      }),
    ).toBeNull();
    expect(
      await prisma.project.findUnique({ where: { id: stored.projectId } }),
    ).toBeNull();
  });

  afterAll(async () => {
    const sessions = await prisma.demoSession.findMany();

    for (const session of sessions) {
      await prisma.auditLog.deleteMany({
        where: { projectId: session.projectId },
      });
      await prisma.demoSession.deleteMany({ where: { id: session.id } });
      await prisma.project.deleteMany({ where: { id: session.projectId } });
    }

    await prisma.organization.deleteMany({
      where: { slug: 'runtime-control-demo' },
    });
    await app.close();
  });
});
