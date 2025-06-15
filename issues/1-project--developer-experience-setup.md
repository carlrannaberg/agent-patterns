# Issue 1: Project & Developer Experience Setup

## Requirement
Initialize a complete monorepo development environment with proper tooling, workspace structure, and quality controls for building AI agent patterns.

## Acceptance Criteria
- Git monorepo initialized with `pnpm workspaces` (`packages/api`, `packages/webapp`)
- Nest.js app created in `packages/api`
- React/Vite app created in `packages/webapp`
- Code Quality Tooling: ESLint, TypeScript, Husky, and lint-staged configured at project root
- Dependencies installed in both packages:
  - API: `dotenv`, `@ai-sdk/google@alpha`, `zod`, `mathjs`
  - Webapp: `ai@alpha`, `@ai-sdk/react@alpha`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize`

