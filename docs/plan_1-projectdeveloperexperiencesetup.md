# Plan for Issue 1: Project & Developer Experience Setup

This document outlines the step-by-step plan to complete `issues/1-projectdeveloperexperiencesetup.md`.

## Implementation Plan

- [x] 1.1 Initialize a Git monorepo with `pnpm workspaces` (`packages/api`, `packages/webapp`)
- [x] 1.2 Create the Nest.js app in `packages/api` and the React/Vite app in `packages/webapp`
- [x] 1.3 **Code Quality Tooling**: Install and configure ESLint, TypeScript, Husky, and lint-staged at the project root with corresponding scripts
- [x] 1.4 **Dependencies**
  - [x] 1.4.1 In `api`: install `dotenv`, `@ai-sdk/google@alpha`, `zod`, and `mathjs`
  - [x] 1.4.2 In `webapp`: install `ai@alpha`, `@ai-sdk/react@alpha`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize`
