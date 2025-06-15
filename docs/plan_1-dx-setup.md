# Plan for Issue 1: Project & Developer Experience Setup

This document outlines the step-by-step plan to complete `issues/1-dx-setup.md`.

## 1. Initialize Monorepo

- [ ] Create a root `package.json` and a `pnpm-workspace.yaml` file.
- [ ] The `pnpm-workspace.yaml` should define `packages/*` as the workspace root.

## 2. Create Packages

- [ ] Create the Nest.js app in `packages/api`.
- [ ] Create the React/Vite app in `packages/webapp`.

## 3. Configure Code Quality Tooling

- [ ] Install ESLint, TypeScript, Husky, and lint-staged at the project root.
- [ ] Configure ESLint with a baseline ruleset.
- [ ] Configure `lint-staged` to run ESLint on pre-commit.
- [ ] Configure Husky to use the `lint-staged` hook.

## 4. Install Dependencies

- [ ] In `packages/api`, install `dotenv`, `@ai-sdk/google@alpha`, `zod`, and `mathjs`.
- [ ] In `packages/webapp`, install `ai@alpha`, `@ai-sdk/react@alpha`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-router-dom`, `react-textarea-autosize`.
