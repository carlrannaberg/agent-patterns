# Issue 1: Frontend (React) Implementation

## Requirement
Implement a React frontend application with Material UI that provides interactive interfaces for each of the six agent patterns, using the Vercel AI SDK's `useObject` hook for streaming data consumption.

## Acceptance Criteria
- [ ] Configure `react-router-dom` with routes for each of the six patterns
- [ ] Create a main `Layout` component with navigation links to each pattern's page
- [ ] Create a reusable `AgentInteraction` component that:
  - Uses the `useObject` hook to manage state and API communication
  - Includes a `react-textarea-autosize` input and a submit button
  - Displays the streamed `object` from the hook in a `<pre>` tag
- [ ] Create six page components, each using `AgentInteraction` and providing the correct API endpoint path:
  - Sequential Processing page
  - Routing page
  - Parallel Processing page
  - Orchestrator-Worker page
  - Evaluator-Optimizer page
  - Multi-Step Tool Usage page

