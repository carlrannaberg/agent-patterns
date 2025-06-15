# Issue 1: Project & Developer Experience Setup

## Requirement
Set up the foundational project structure, monorepo configuration, and developer experience tooling for the Agent Patterns repository.

## Acceptance Criteria
- [ ] Initialize a Git monorepo with `pnpm workspaces` (`packages/api`, `packages/webapp`)
- [ ] Create the Nest.js app in `packages/api` and the React/Vite app in `packages/webapp`
- [ ] Install and configure ESLint, TypeScript, Husky, and lint-staged at the project root with corresponding scripts
- [ ] Install required dependencies:
  - In `api`: `dotenv`, `@ai-sdk/google@alpha`, `zod`, and `mathjs`
  - In `webapp`: `ai@alpha`, `@ai-sdk/react@alpha`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize`

