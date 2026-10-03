# Backend API

A maintainable NestJS foundation for the Computación en Internet III backend workshop. This initial version deliberately contains infrastructure only: configuration, PostgreSQL connectivity, API documentation, a health endpoint, testing, and team automation.

## Team

| Member | GitHub |
|---|---|
| Developer 1 | @username |
| Developer 2 | @username |
| Developer 3 | @username |

## Tech Stack

- Node.js 24 LTS, TypeScript, NestJS, and npm
- PostgreSQL 17, TypeORM, and migration-ready persistence
- Jest and Supertest
- Swagger/OpenAPI and Postman
- ESLint, Prettier, Husky, and GitHub Actions

## Requirements

- Node.js 24 LTS (Node.js 22 or newer is accepted by the package)
- npm
- Docker Desktop or another Docker Compose-compatible runtime

## Installation

```bash
npm install
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` for the second command. Replace development placeholders before using the project outside a local environment.

## Environment Variables

All supported variables are documented in `.env.example`. Startup validates database and future JWT settings with Joi and fails early when a required value is missing. `.env` and its variants are ignored by Git; only `.env.example` is committed.

## Database

TypeORM reads its connection exclusively from environment variables. `synchronize` and automatic migration execution are disabled. Future schema changes must be represented by migrations in `src/database/migrations`; repeatable seed orchestration belongs in `src/database/seeds`.

Once entities exist, migrations can be managed with the standalone TypeORM data source:

```bash
npm run migration:generate -- src/database/migrations/DescribeChange
npm run migration:run
npm run migration:revert
```

## Running the Application

Start PostgreSQL, then the API:

```bash
docker compose up -d
npm run start:dev
```

- API health: <http://localhost:3000/api/health>
- Swagger UI: <http://localhost:3000/api/docs>

The global `ValidationPipe` strips no data silently: it transforms valid DTO input, allows only declared properties, and rejects unexpected properties with `forbidNonWhitelisted`. This makes malformed client payloads visible during development and keeps the API contract strict.

## Swagger

Swagger uses the title **Backend API**, version **1.0**, and includes Bearer JWT support for the later authentication milestone. Controllers should use OpenAPI decorators as endpoints are added.

## Testing

```bash
npm test
npm run test:watch
npm run test:e2e
npm run test:cov
npm run lint
npm run build
```

The initial E2E smoke test boots the Nest HTTP application and checks `GET /api/health`. It replaces only the TypeORM data-source provider because health does not depend on persistence, keeping this fast check runnable without external infrastructure. Future persistence E2E tests should use the PostgreSQL instance configured through the environment; CI already supplies that service.

## Coverage

Coverage output is written to `coverage/`. An 80% threshold is intentionally not enforced while the codebase is only a skeleton. Add a global `coverageThreshold` to the `jest` section of `package.json` once substantive modules exist, and then enforce the course requirement without artificial tests.

## Postman

Import both files from `postman/`. Select **Backend API - Local** and run the Health request. The collection contains no credentials or tokens.

## Docker

`compose.yml` starts only PostgreSQL because containerizing the Nest development process adds little value at this stage. It includes persistent storage and a readiness healthcheck.

Useful commands:

```bash
docker compose up -d
docker compose ps
docker compose down
```

## Git Workflow

Use `feature/*`, `fix/*`, `test/*`, `docs/*`, or `chore/*` branches from `develop`, followed by a pull request into `develop`. Promote reviewed milestones from `develop` to `main`. See `CONTRIBUTING.md` for commits, reviews, local pre-push checks, CI, and required GitHub branch protection.

## Project Structure

```text
src/
├── common/       # Shared cross-cutting building blocks
├── config/       # Typed application and environment configuration
├── database/     # TypeORM setup, migrations, and seeds
└── modules/      # Feature modules (health plus auth/users placeholders)
test/             # End-to-end tests and their environment setup
postman/          # Shareable API collection and local environment
```

## Deployment

No cloud provider has been selected and no deployment is performed yet. After the team chooses a provider, add a reviewed `.github/workflows/deploy.yml` that deploys only after CI succeeds and obtains credentials from GitHub secrets or workload identity.

## License / Academic Context

This repository is an academic project for Computación en Internet III. It is currently marked `UNLICENSED`; the team should choose a license only if distribution is intended and university policy allows it.
