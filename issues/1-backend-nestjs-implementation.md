# Issue 1: Backend (Nest.js) Implementation

## Requirement
Implement a Nest.js backend with six distinct agent pattern modules, each demonstrating different AI interaction patterns using the Vercel AI SDK with streaming capabilities.

## Acceptance Criteria
- [ ] Enable CORS in `main.ts` in the `api` package
- [ ] Implement **Sequential Processing Module** (`/sequential-processing`) with controller and service for marketing copy generation with quality evaluation
- [ ] Implement **Routing Module** (`/routing`) with controller and service for customer query classification and routing
- [ ] Implement **Parallel Processing Module** (`/parallel-processing`) with controller and service for concurrent code reviews (security, performance, maintainability)
- [ ] Implement **Orchestrator-Worker Module** (`/orchestrator-worker`) with controller and service for feature implementation planning
- [ ] Implement **Evaluator-Optimizer Module** (`/evaluator-optimizer`) with controller and service for iterative translation improvement
- [ ] Implement **Multi-Step Tool Usage Module** (`/multi-step-tool-usage`) with controller and service for mathematical problem solving with tools
- [ ] All modules must use `streamObject` for streaming JSON responses
- [ ] Environment variables properly configured with `dotenv` for `GOOGLE_GENERATIVE_AI_API_KEY`

