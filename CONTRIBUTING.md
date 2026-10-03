# Contributing

This repository is designed for a three-person university team. Every contributor must use their own GitHub account and author their own commits. Do not rewrite authorship or manufacture contributions.

## Branch strategy

- `main` contains reviewed, releasable work.
- `develop` is the integration branch.
- Create short-lived branches from `develop`: `feature/<description>`, `fix/<description>`, `test/<description>`, `docs/<description>`, or `chore/<description>`.
- Open `feature/* -> develop` pull requests. Promote milestones through a separate `develop -> main` pull request.
- Do not develop directly on `main`.

Examples: `feature/auth-jwt`, `feature/users`, `feature/roles`, `test/auth-e2e`, and `docs/swagger`.

## Working agreement

1. Pull the latest `develop` and create a focused branch.
2. Keep pull requests small and limited to one concern.
3. Add or update tests and API documentation with the implementation.
4. Run `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build` before requesting review.
5. Request review from at least one teammate and merge only after CI passes.

Husky runs lint and unit tests locally before a push. GitHub Actions independently validates every pull request and pushes to `main` or `develop` on the remote server. Local hooks are helpful but can be bypassed, so CI and branch protection remain authoritative.

## Commits

Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, and `ci:`. Add an optional scope when it clarifies ownership.

Examples:

- `feat(auth): add jwt authentication`
- `feat(users): add user registration`
- `test(auth): add login integration tests`
- `docs(api): document authentication endpoints`
- `ci(github): add continuous integration workflow`

Do not squash other contributors' work automatically. Preserve meaningful authorship and review history.

## GitHub branch protection

Repository files cannot enforce branch protections. Configure these in GitHub:

- `main`: require a pull request, required CI status checks, prevent force pushes, and prevent deletion.
- `develop`: require a pull request and required CI status checks.
