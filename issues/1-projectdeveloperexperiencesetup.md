# Issue 1: Project & Developer Experience Setup

## Requirement
Set up the project foundation with monorepo structure, code quality tooling, and all necessary dependencies for both backend (Nest.js) and frontend (React/Vite) applications.

## Acceptance Criteria
- [x] Git monorepo initialized with `pnpm workspaces` (`packages/api`, `packages/webapp`)
- [x] Nest.js app created in `packages/api` and React/Vite app in `packages/webapp`
- [x] Code Quality Tooling: ESLint, TypeScript, Husky, and lint-staged configured at project root
- [x] Backend Dependencies: `dotenv`, `@ai-sdk/google@alpha`, `zod`, `mathjs` installed in `api`
- [x] Frontend Dependencies: `ai@alpha`, `@ai-sdk/react@alpha`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize` installed in `webapp`

