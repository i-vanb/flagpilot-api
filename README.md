# FlagPilot API

FlagPilot API is a production-style backend for managing and evaluating feature flags.

It provides a JWT-protected Management API for dashboard users and a separate API-key-protected SDK API for runtime feature flag evaluation.

The project is built with NestJS, TypeScript, PostgreSQL, Prisma, JWT authentication, hashed API keys, audit logs, and a deterministic feature flag evaluation engine.

## Technical Highlights

This backend demonstrates:

- modular NestJS architecture;
- PostgreSQL and Prisma domain modeling;
- JWT-protected Management API;
- API-key-protected SDK API;
- organization-scoped admin resources;
- project/environment-scoped SDK access;
- feature flag targeting rules;
- deterministic percentage rollout;
- audit logging;
- seed data and local development setup;
- unit-tested pure evaluation engine.

## What FlagPilot Does

FlagPilot allows teams to manage feature flags across projects and environments.

It supports:

- organizations and owner users;
- projects;
- environments;
- boolean feature flags;
- per-environment flag configuration;
- targeting rules;
- deterministic percentage rollout;
- SDK evaluation API;
- batch flag evaluation;
- API key management;
- audit logs.

Example SDK evaluation response:

```json
{
  "flagKey": "new-kiosk-payment-screen",
  "enabled": true,
  "reason": "TARGETING_MATCH"
}
```

## Tech Stack

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- Prisma 7
- `@prisma/adapter-pg`
- Docker Compose
- JWT
- Passport
- bcrypt
- class-validator
- Jest
- ESLint
- Prettier

## Architecture

FlagPilot is implemented as a modular monolith.

The application is deployed as one backend, but the code is split into clear business modules.

```text
src/
├── api-keys/
├── audit-logs/
├── auth/
├── common/
├── environments/
├── evaluation/
├── flags/
├── prisma/
├── projects/
└── sdk/
```

### Main Boundaries

```text
Management API   -> JWT authentication
SDK API          -> API key authentication
Evaluation Core  -> pure TypeScript business logic
Database Layer   -> Prisma + PostgreSQL
```

### Why Modular Monolith?

A modular monolith is a good fit for this stage of the product.

It keeps the backend:

- easy to run locally;
- easy to deploy;
- easy to understand;
- easy to test;
- separated by business responsibility;
- ready for future extraction of specific modules.

Possible future extractions:

- standalone evaluation service;
- Redis-backed SDK config cache;
- audit event pipeline;
- edge evaluation layer;
- public JavaScript SDK.

Microservices are intentionally not used at this stage. They would add distributed-system complexity before the product actually needs it.

## Domain Model

```text
Organization
  -> User
  -> Project
       -> Environment
       -> FeatureFlag
            -> FlagEnvironmentConfig
                 -> TargetingRule
       -> ApiKey
       -> AuditLog
```

### Important Invariants

- Project keys are unique inside an organization.
- Environment keys are unique inside a project.
- Feature flag keys are unique inside a project.
- Every flag can have one config per environment.
- New projects automatically get `development`, `staging`, and `production` environments.
- New environments automatically get disabled configs for existing flags.
- New flags automatically get disabled configs for existing environments.
- Admin resources are scoped by organization.
- SDK evaluation is scoped by API key project and optional environment binding.

## Evaluation Engine

The evaluation engine is implemented as a pure TypeScript module.

It does not depend on:

- NestJS;
- Prisma;
- PostgreSQL;
- HTTP;
- controllers;
- guards.

This makes the engine deterministic, easy to unit test, and reusable outside the NestJS runtime.

Supported operators:

```text
EQUALS
NOT_EQUALS
IN
NOT_IN
PERCENTAGE_ROLLOUT
```

Supported evaluation reasons:

```text
FLAG_NOT_FOUND
ENVIRONMENT_NOT_FOUND
FLAG_DISABLED
TARGETING_MATCH
TARGETING_NO_MATCH
ROLLOUT_MATCH
ROLLOUT_NO_MATCH
DEFAULT_VALUE
```

### Evaluation Semantics

Evaluation order is deterministic:

1. If the flag does not exist, return `enabled=false`, `reason=FLAG_NOT_FOUND`.
2. If the flag has no config for `context.environment`, return `enabled=false`, `reason=ENVIRONMENT_NOT_FOUND`.
3. If the environment config is disabled, return `enabled=false`, `reason=FLAG_DISABLED`.
4. Evaluate targeting rules in stored order.
5. Return `enabled=true` on the first matching rule.
6. If rules exist but none match, return the config `defaultValue` with the last non-match reason, such as `TARGETING_NO_MATCH` or `ROLLOUT_NO_MATCH`.
7. If there are no rules, return the config `defaultValue` with `reason=DEFAULT_VALUE`.

Percentage rollout is stable for the same attribute value. The engine hashes the selected context attribute and buckets it into `0..99`.

Example:

```json
{
  "enabled": false,
  "reason": "ROLLOUT_NO_MATCH"
}
```

## Requirements

Recommended:

- Node.js `20+`
- npm `10+`
- Docker
- Docker Compose

The current local development environment was verified with Node.js 22.

## Environment

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose | Local example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma and the app | `postgresql://flagpilot:flagpilot@localhost:5434/flagpilot?schema=public` |
| `JWT_SECRET` | Secret for signing management JWT access tokens | `dev_secret_change_me` |
| `API_KEY_PEPPER` | Server-side pepper for hashing SDK API keys | `dev_api_key_pepper_change_me` |
| `PORT` | Optional HTTP port | `3000` |

Security notes:

- Do not commit `.env`.
- Use different secrets per environment.
- Use long random values for `JWT_SECRET` and `API_KEY_PEPPER`.
- Changing `API_KEY_PEPPER` invalidates existing API keys because stored hashes will no longer match raw keys.

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

If your compose file uses another service name, run:

```bash
docker compose up -d
```

### 3. Run migrations

```bash
npx prisma migrate dev
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Seed demo data

```bash
npx prisma db seed
```

### 6. Start the API

```bash
npm run start:dev
```

The API runs at:

```text
http://localhost:3000
```

Root check:

```bash
curl http://localhost:3000
```

## Demo Seed Data

`prisma/seed.ts` creates:

- Organization: `FlagPilot Demo Organization`
- Organization slug: `flagpilot-demo`
- User: `admin@flagpilot.dev`
- Password: `password123`
- Project: `plai-platform`
- Environments:
    - `development`
    - `staging`
    - `production`
- Demo SDK API key:
    - `fp_live_demo_123456789`
- Demo flags:
    - `new-kiosk-payment-screen`
    - `new-booking-flow`
    - `admin-analytics-panel`
    - `new-checkout`
    - `dev-debug-toolbar`

Login after seeding:

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@flagpilot.dev",
    "password": "password123"
  }'
```

Store the returned token:

```bash
export TOKEN="PASTE_ACCESS_TOKEN_HERE"
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run start` | Start NestJS without watch mode |
| `npm run start:dev` | Start NestJS with watch mode |
| `npm run start:debug` | Start with debugger and watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run compiled app from `dist/main` |
| `npm run lint` | Run ESLint |
| `npm run format` | Format source and test files |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npx prisma migrate dev` | Apply/create local migrations |
| `npx prisma migrate deploy` | Apply migrations in CI/production-like environments |
| `npx prisma db seed` | Run seed script |
| `npx prisma studio` | Open Prisma Studio |

## Authentication Model

FlagPilot uses two separate authentication models.

### Management API

Management endpoints use JWT.

```http
Authorization: Bearer <jwt-access-token>
```

Used for:

```text
/auth/me
/projects
/environments
/flags
/configs
/rules
/api-keys
/audit-logs
```

### SDK API

SDK evaluation endpoints use API keys.

```http
x-api-key: <raw-sdk-api-key>
```

Used for:

```text
/sdk/evaluate
/sdk/evaluate/batch
```

This separation is intentional:

```text
Dashboard users      -> JWT
Client applications  -> API keys
```

## Management API

Base URL for local development:

```text
http://localhost:3000
```

### Auth

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | none | Create an organization and owner user |
| `POST` | `/auth/login` | none | Login and receive JWT |
| `GET` | `/auth/me` | JWT | Return current user |

Register payload:

```json
{
  "email": "owner@example.com",
  "name": "Owner",
  "password": "password123",
  "organizationName": "Example Inc",
  "organizationSlug": "example-inc"
}
```

Login payload:

```json
{
  "email": "admin@flagpilot.dev",
  "password": "password123"
}
```

Login example:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@flagpilot.dev",
    "password": "password123"
  }'
```

Get current user:

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Projects

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/projects` | List projects for current organization |
| `POST` | `/projects` | Create project and default environments |
| `GET` | `/projects/:projectId` | Get project details with environments, flags, and API keys |
| `PATCH` | `/projects/:projectId` | Update project metadata |
| `DELETE` | `/projects/:projectId` | Delete project |

Create project:

```bash
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App",
    "key": "mobile-app",
    "description": "Feature flags for mobile clients"
  }'
```

Default environments are created automatically:

```text
development
staging
production
```

Project keys must be kebab-case, for example:

```text
plai-platform
mobile-app
admin-dashboard
```

### Environments

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/projects/:projectId/environments` | List environments in a project |
| `POST` | `/projects/:projectId/environments` | Create environment and default disabled configs for existing flags |
| `PATCH` | `/environments/:environmentId` | Update environment name |
| `DELETE` | `/environments/:environmentId` | Delete non-default environment |

Default environments cannot be deleted:

```text
development
staging
production
```

Create environment:

```bash
curl -X POST http://localhost:3000/projects/PROJECT_ID/environments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "QA",
    "key": "qa"
  }'
```

When a new environment is created, disabled configs are automatically created for all existing flags.

### Feature Flags

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/projects/:projectId/flags` | List flags with configs and rules |
| `POST` | `/projects/:projectId/flags` | Create flag and default disabled configs for existing environments |
| `GET` | `/flags/:flagId` | Get one flag with project, configs, and rules |
| `PATCH` | `/flags/:flagId` | Update flag metadata |
| `DELETE` | `/flags/:flagId` | Delete flag |
| `GET` | `/flags/:flagId/configs` | List per-environment configs for a flag |
| `PATCH` | `/flags/:flagId/configs/:environmentId` | Update per-environment config |

Create flag:

```bash
curl -X POST http://localhost:3000/projects/PROJECT_ID/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-profile-page",
    "name": "New Profile Page",
    "description": "Enables redesigned profile page"
  }'
```

When a flag is created, disabled configs are automatically created for all project environments.

Update flag config:

```bash
curl -X PATCH http://localhost:3000/flags/FLAG_ID/configs/ENVIRONMENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "defaultValue": false
  }'
```

Meaning:

```text
enabled: true        -> flag can be evaluated
defaultValue: false  -> flag is off unless a rule matches
```

### Targeting Rules

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/configs/:configId/rules` | Create targeting rule |
| `PATCH` | `/rules/:ruleId` | Update targeting rule |
| `DELETE` | `/rules/:ruleId` | Delete targeting rule |

Supported operators:

| Operator | Required fields | Behavior |
| --- | --- | --- |
| `EQUALS` | `attribute`, `values` | Match when context attribute equals first value |
| `NOT_EQUALS` | `attribute`, `values` | Match when context attribute does not equal first value |
| `IN` | `attribute`, `values` | Match when context attribute is in values |
| `NOT_IN` | `attribute`, `values` | Match when context attribute is not in values |
| `PERCENTAGE_ROLLOUT` | `attribute`, `rolloutPercentage` | Deterministically bucket context attribute into rollout percentage |

Create targeting rule:

```bash
curl -X POST http://localhost:3000/configs/CONFIG_ID/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attribute": "role",
    "operator": "EQUALS",
    "values": ["admin"]
  }'
```

Create percentage rollout rule:

```bash
curl -X POST http://localhost:3000/configs/CONFIG_ID/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attribute": "userId",
    "operator": "PERCENTAGE_ROLLOUT",
    "rolloutPercentage": 10
  }'
```

### API Keys

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/projects/:projectId/api-keys` | List project API keys without raw secrets |
| `POST` | `/projects/:projectId/api-keys` | Create SDK API key |
| `POST` | `/api-keys/:apiKeyId/rotate` | Rotate SDK API key and return new raw key |
| `DELETE` | `/api-keys/:apiKeyId` | Revoke SDK API key |

Create API key:

```bash
curl -X POST http://localhost:3000/projects/PROJECT_ID/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production SDK Key",
    "environmentId": "PRODUCTION_ENVIRONMENT_ID"
  }'
```

If `environmentId` is set, the key can only evaluate flags for that environment.

If `environmentId` is omitted, the key is project-scoped and the request context selects the environment.

Example response:

```json
{
  "apiKey": {
    "id": "api_key_id",
    "name": "Production SDK Key",
    "prefix": "fp_live_abc123",
    "projectId": "project_id",
    "environmentId": "environment_id",
    "revokedAt": null,
    "lastUsedAt": null
  },
  "rawKey": "fp_live_abc123..."
}
```

Important:

```text
rawKey is shown only once.
Only keyHash and prefix are stored in the database.
```

Rotate API key:

```bash
curl -X POST http://localhost:3000/api-keys/API_KEY_ID/rotate \
  -H "Authorization: Bearer $TOKEN"
```

Rotating a key invalidates the previous raw key.

Revoke API key:

```bash
curl -X DELETE http://localhost:3000/api-keys/API_KEY_ID \
  -H "Authorization: Bearer $TOKEN"
```

Revoked keys can no longer access SDK endpoints.

### Audit Logs

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/projects/:projectId/audit-logs` | Last 100 audit events for a project |
| `GET` | `/flags/:flagId/audit-logs` | Last 100 audit events for a flag |

Project audit logs:

```bash
curl http://localhost:3000/projects/PROJECT_ID/audit-logs \
  -H "Authorization: Bearer $TOKEN"
```

Flag audit logs:

```bash
curl http://localhost:3000/flags/FLAG_ID/audit-logs \
  -H "Authorization: Bearer $TOKEN"
```

Audit logs are created for:

```text
Project create/update/delete
Environment create/update/delete
Flag create/update/delete
Flag config update
Targeting rule create/update/delete
API key create/rotate/revoke
```

## SDK Evaluation API

SDK endpoints use `x-api-key` and do not use JWT.

### Evaluate One Flag

```bash
curl -s -X POST http://localhost:3000/sdk/evaluate \
  -H "Content-Type: application/json" \
  -H "x-api-key: fp_live_demo_123456789" \
  -d '{
    "flagKey": "new-kiosk-payment-screen",
    "context": {
      "environment": "production",
      "kioskId": "KIOSK-102",
      "companyId": "COMPANY-1",
      "role": "admin",
      "country": "GE",
      "userId": "user-123"
    }
  }'
```

Response:

```json
{
  "flagKey": "new-kiosk-payment-screen",
  "enabled": true,
  "reason": "TARGETING_MATCH"
}
```

### Evaluate Multiple Flags

```bash
curl -s -X POST http://localhost:3000/sdk/evaluate/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: fp_live_demo_123456789" \
  -d '{
    "flagKeys": [
      "new-kiosk-payment-screen",
      "admin-analytics-panel",
      "new-checkout",
      "missing-flag"
    ],
    "context": {
      "environment": "production",
      "kioskId": "KIOSK-102",
      "role": "admin",
      "userId": "user-123"
    }
  }'
```

Response:

```json
{
  "flags": {
    "new-kiosk-payment-screen": {
      "enabled": true,
      "reason": "TARGETING_MATCH"
    },
    "admin-analytics-panel": {
      "enabled": true,
      "reason": "TARGETING_MATCH"
    },
    "new-checkout": {
      "enabled": false,
      "reason": "ROLLOUT_NO_MATCH"
    },
    "missing-flag": {
      "enabled": false,
      "reason": "FLAG_NOT_FOUND"
    }
  }
}
```

Batch evaluation avoids unnecessary network calls when a client application needs multiple flags at once.

## Demo Feature Flags

Seed includes several demo flags.

### `new-kiosk-payment-screen`

```text
production: ON
rule: kioskId IN ["KIOSK-102", "KIOSK-218"]
```

### `new-booking-flow`

```text
staging: ON
production: OFF
```

### `admin-analytics-panel`

```text
production: ON
rule: role EQUALS "admin"
```

### `new-checkout`

```text
production: ON
rule: 10% rollout by userId
```

### `dev-debug-toolbar`

```text
development: ON
defaultValue: true
```

## Database And Prisma

Schema file:

```text
prisma/schema.prisma
```

Migration directory:

```text
prisma/migrations
```

Seed file:

```text
prisma/seed.ts
```

Useful Prisma commands:

```bash
npx prisma migrate dev
npx prisma migrate deploy
npx prisma db seed
npx prisma studio
```

Use `migrate dev` locally.

Use `migrate deploy` in CI/CD or production-like environments.

## Testing

Run all unit tests:

```bash
npm test
```

Run evaluation engine tests only:

```bash
npx jest src/evaluation/engine/__tests__/evaluate-flag.spec.ts
```

Run coverage:

```bash
npm run test:cov
```

Before opening a PR or pushing a final version, run:

```bash
npm run lint
npm test
npm run build
```

The most important tests cover the pure evaluation engine, because that is the core business logic of the product.

## Security Notes

Implemented:

- JWT authentication for Management API;
- API key authentication for SDK API;
- raw API keys are not stored;
- API keys are hashed with a server-side pepper;
- API keys can be rotated;
- API keys can be revoked;
- management resources are scoped by organization;
- SDK evaluation is scoped by API key project and optional environment;
- audit logs track important changes.

Not yet implemented:

- refresh tokens;
- granular role-based permissions;
- rate limiting;
- request throttling;
- production-grade secret management;
- pagination;
- OpenAPI documentation;
- CI pipeline;
- integration tests.

## Production Notes

- Run migrations with `npx prisma migrate deploy`, not `migrate dev`.
- Set strong `JWT_SECRET` and `API_KEY_PEPPER` values from a secret manager.
- Keep `API_KEY_PEPPER` stable across deployments unless you intentionally rotate and recreate all SDK keys.
- Terminate TLS at the edge or load balancer.
- Restrict database network access to the API runtime.
- Add rate limiting and request logging before exposing public SDK endpoints at scale.
- Add pagination before large tenant usage.
- Audit log endpoints currently return the latest 100 entries.

## Known Gaps / Next Engineering Targets

This is a backend MVP, not a full SaaS product.

Next engineering targets:

- add OpenAPI / Swagger documentation;
- add pagination and filtering;
- add refresh token rotation;
- add role-based access control;
- add rate limiting for SDK endpoints;
- add integration tests;
- add CI workflow;
- add Redis caching for SDK config reads;
- add public JavaScript SDK;
- add frontend Admin Dashboard;
- add frontend-friendly response mappers.

## Why This Project Matters

FlagPilot demonstrates backend and full-stack architecture skills beyond basic CRUD.

It shows:

- domain modeling;
- modular NestJS architecture;
- Prisma schema design;
- JWT authentication;
- API key security;
- organization scoping;
- audit logging;
- deterministic rollout logic;
- testable business rules;
- SDK-style API design;
- clean separation between framework code and core evaluation logic.

The result is not just a collection of endpoints. It is the backend foundation of a real feature flag platform with access boundaries, evaluation behavior, auditability, and room for future scaling.