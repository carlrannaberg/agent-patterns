# Issue 1: Project & Developer Experience Setup

## Requirement
Set up the monorepo structure and install all necessary tooling for code quality, dependency management, and developer experience.

## Acceptance Criteria
- A `pnpm` workspace is initialized.
- `packages/api` contains a new Nest.js application.
- `packages/webapp` contains a new React/Vite application.
- ESLint, TypeScript, Husky, and lint-staged are configured at the root.
- All required dependencies for both `api` and `webapp` are installed.