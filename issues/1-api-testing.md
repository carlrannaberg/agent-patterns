# Issue 1: API Testing

## Requirement
Implement comprehensive API testing for all six agent pattern endpoints using Vitest, ensuring proper service wiring and functionality while mocking AI SDK calls.

## Acceptance Criteria
- [ ] Configure Vitest in the `api` package
- [ ] Write API tests for each of the six endpoints:
  - `/sequential-processing` - Test marketing copy generation flow
  - `/routing` - Test customer query classification and routing
  - `/parallel-processing` - Test concurrent code review functionality
  - `/orchestrator-worker` - Test feature implementation planning
  - `/evaluator-optimizer` - Test iterative translation improvement
  - `/multi-step-tool-usage` - Test mathematical problem solving
- [ ] Mock AI SDK calls to ensure services are wired correctly
- [ ] All tests pass and validate proper request/response handling

