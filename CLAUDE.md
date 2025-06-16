# Agent Patterns Project

## Project Context
- **Architecture**: Monorepo with npm workspaces (`packages/api`, `packages/webapp`)
- **Purpose**: AI agent patterns implementation using NestJS backend + React frontend
- **AI SDK**: Vercel AI SDK with Google's Gemini models
- **Communication**: Streaming JSON responses using `streamObject`/`useObject`

## Development Commands
- `npm run lint` - ESLint checking
- `npm run type-check` - TypeScript type checking
- `npm run dev` - Start development servers for all packages
- `npm run build` - Build all packages

## Project Scripts
- `npm run issue` - Create new issues using scripts/create-issue.sh
- `npm run claude` - Run Claude with context using scripts/claude-context.sh

## Key Dependencies
**Backend (NestJS)**:
- `@ai-sdk/google` - Google Gemini AI integration
- `zod` - Schema validation
- `mathjs` - Mathematical computations
- `dotenv` - Environment variables

**Frontend (React)**:
- `ai/react` - AI SDK React hooks (`useObject`)
- `@mui/material` - Material-UI components
- `react-router-dom` - Client-side routing
- `react-textarea-autosize` - Auto-resizing textarea

## Agent Patterns (6 modules)
1. **Sequential Processing** - Marketing copy generation with quality evaluation
2. **Routing** - Customer query classification and specialized responses
3. **Parallel Processing** - Code review with security/performance/maintainability analysis
4. **Orchestrator-Worker** - Feature implementation planning and execution
5. **Evaluator-Optimizer** - Translation with iterative quality improvement
6. **Multi-Step Tool Usage** - Math problem solving with calculation tools

## Architecture Notes
- CORS enabled in NestJS for frontend communication
- Each pattern implemented as separate NestJS module with controller/service
- Frontend uses `useObject` hook to consume streamed responses
- Environment variables in `packages/api/.env` (GOOGLE_GENERATIVE_AI_API_KEY)