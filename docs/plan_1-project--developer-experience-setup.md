# Plan for Issue 1: Project & Developer Experience Setup

This document outlines the step-by-step plan to complete `issues/1-project--developer-experience-setup.md`.

## Implementation Plan

- [ ] 1.1 Initialize a Git monorepo with `pnpm workspaces` (`packages/api`, `packages/webapp`)
- [ ] 1.2 Create the Nest.js app in `packages/api` and the React/Vite app in `packages/webapp`
- [ ] 1.3 **Code Quality Tooling**: Install and configure ESLint, TypeScript, Husky, and lint-staged at the project root with corresponding scripts
- [ ] 1.4 **Dependencies**
  - [ ] 1.4.1 In `api`: install `dotenv`, `@ai-sdk/google@alpha`, `zod`, and `mathjs`
  - [ ] 1.4.2 In `webapp`: install `ai@alpha`, `@ai-sdk/react@alpha`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize`

## Technical Notes
- **Monorepo**: Use `pnpm workspaces` to manage the `api` (backend) and `webapp` (frontend) packages
- **Backend**: A Nest.js application. Each agent pattern will be implemented in its own module
- **Frontend**: A React.js application built with Vite and Material UI. Each pattern will have its own page
- **Environment Variables**: Use `dotenv` for API keys in the backend. The `.env` file in `packages/api` should contain `GOOGLE_GENERATIVE_AI_API_KEY=your-api-key`
- **Code Quality**: Use ESLint, and Husky with lint-staged for a consistent and high-quality codebase
