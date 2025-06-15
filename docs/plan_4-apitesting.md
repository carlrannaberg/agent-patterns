# Plan for Issue 4: API Testing

This document outlines the step-by-step plan to complete `issues/4-apitesting.md`.

## Implementation Plan

- [ ] 4.1 Configure Vitest in the `api` package
  - [ ] Install Vitest as dev dependency
  - [ ] Add test scripts to package.json
  - [ ] Configure vitest.config.ts
- [ ] 4.2 Write API tests for each of the six endpoints, mocking the AI SDK calls to ensure the services are wired correctly
  - [ ] Sequential Processing API test
  - [ ] Routing API test
  - [ ] Parallel Processing API test
  - [ ] Orchestrator-Worker API test
  - [ ] Evaluator-Optimizer API test
  - [ ] Multi-Step Tool Usage API test

## Testing Strategy

### Test Structure
Each test suite will:
- Mock AI SDK functions (`generateText`, `generateObject`, `streamObject`)
- Test controller endpoints with sample payloads
- Verify response structure and status codes
- Ensure services are properly injected and called

### Mock Strategy  
- Mock `@ai-sdk/google` to return predictable responses
- Mock streaming responses for testing frontend integration
- Use Jest-style mocking with vi.mock()

### Test Cases
For each endpoint:
- Valid input handling
- Response structure validation
- Error handling
- Service method calls verification
- CORS headers verification