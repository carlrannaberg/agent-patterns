# Agent Patterns

AI agent patterns monorepo demonstrating structured agentic workflows for intelligent automation.

## Overview

This repository implements a **structured agentic workflow system** that combines human planning with AI execution. It demonstrates various agent patterns including sequential processing, routing, parallel processing, orchestrator-worker, and evaluator-optimizer patterns.

## Architecture

- **Backend**: Nest.js API with streaming responses using Vercel AI SDK
- **Frontend**: React + Vite + Material UI with real-time streaming UI
- **Database**: PostgreSQL for persistent storage, Redis for caching and sessions
- **Monorepo**: npm workspaces managing `packages/api` and `packages/webapp`

## Workflow System

This project uses a unique **issue-driven development workflow** optimized for AI collaboration:

### 📋 Issue Management Structure

```
issues/           # Requirements specifications
├── 0-bootstrap-plan.md
├── 1-project-setup.md
└── 2-backend-implementation.md

docs/             # Detailed implementation plans
├── plan_0-bootstrap-plan.md
├── plan_1-project-setup.md
└── plan_2-backend-implementation.md

scripts/          # Automation tooling
├── create-issue.sh      # Generate new issues
├── complete-task.sh     # Mark tasks complete
└── claude-context.sh    # AI agent orchestration

todo.md           # Central task tracker
```

### 🔄 Workflow Process

#### 1. **Issue Creation**
```bash
# Create new issue with templates
npm run issue "Feature Name"
```
- Auto-generates issue ID and file structure
- Creates both requirement spec (`issues/`) and implementation plan (`docs/`)
- Updates central task tracker (`todo.md`)

#### 2. **Bootstrap from Master Plan**
When you have a comprehensive master plan (like `plan-eval.md`), use the bootstrap approach:

```bash
# Create bootstrap issue
npm run issue "Bootstrap [Feature] from Master Plan"
```

Edit the created issue to instruct Claude to decompose your master plan:

```markdown
# Issue X: Bootstrap [Feature] from Master Plan

## Requirement
Read the `[master-plan].md` file and decompose it into structured issues following the existing pattern. Create separate issues for each major phase/component.

## Acceptance Criteria
- [ ] Analyze master plan and identify major implementation phases
- [ ] Create individual issues for each phase using `npm run issue` command
- [ ] Populate each issue with specific requirements from the master plan
- [ ] Create corresponding detailed implementation plans in `docs/`
- [ ] Update `todo.md` with all new tasks
- [ ] Ensure proper sequencing and dependencies between issues
```

#### 3. **AI Execution**
```bash
# Launch autonomous AI agent
npm run claude
```
- Finds next uncompleted task in `todo.md`
- Feeds structured context (issue + plan + todo) to Claude
- Monitors execution via JSON stream
- Auto-commits successful completions
- Loops to next task automatically

#### 4. **Task Completion**
```bash
# Manually mark task complete (if needed)
./scripts/complete-task.sh <issue_number>
```

### 🚀 Getting Started

#### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (for data persistence)
- Redis 6+ (for caching and session management)
- Claude CLI (`npm install -g @anthropic-ai/claude-cli`)
- Google AI API key

#### Installation
```bash
# Clone and install
git clone <repo-url>
cd agent-patterns
npm install

# Set up environment
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-key" > packages/api/.env

# Set up PostgreSQL
# Option 1: Using Docker
docker run --name agent-patterns-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=agent_patterns -p 5432:5432 -d postgres:15

# Option 2: Local PostgreSQL installation
# Create database: createdb agent_patterns

# Set up Redis
# Option 1: Using Docker
docker run --name agent-patterns-redis -p 6379:6379 -d redis:6-alpine

# Option 2: Local Redis installation
# Start Redis: redis-server

# Add database connection to .env
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_patterns" >> packages/api/.env
echo "REDIS_URL=redis://localhost:6379" >> packages/api/.env
```

#### Development
```bash
# Start both API and webapp
npm run dev

# Create new issue
npm run issue "New Feature"

# Bootstrap from master plan
npm run issue "Bootstrap Feature from Master Plan"
# Edit the issue, then run:
npm run claude

# Run autonomous agent
npm run claude
```

### 🎯 Agent Patterns Implemented

1. **Sequential Processing** - Step-by-step task execution with quality evaluation
2. **Routing** - Intelligent request classification and specialized handling
3. **Parallel Processing** - Concurrent task execution with result aggregation
4. **Orchestrator-Worker** - Planning and delegation pattern
5. **Evaluator-Optimizer** - Self-improving iterative refinement
6. **Multi-Step Tool Usage** - Complex tool chains and workflows

### 📁 Project Structure

```
agent-patterns/
├── packages/
│   ├── api/                 # Nest.js backend
│   │   └── src/
│   │       ├── sequential-processing/
│   │       ├── routing/
│   │       ├── parallel-processing/
│   │       ├── orchestrator-worker/
│   │       ├── evaluator-optimizer/
│   │       └── multi-step-tool-usage/
│   └── webapp/              # React frontend
│       └── src/
│           ├── components/
│           └── pages/
├── issues/                  # Task requirements
├── docs/                    # Implementation plans
├── scripts/                 # Automation tools
├── plan.md                  # Original master plan
├── plan-eval.md            # Evaluation framework plan
└── todo.md                  # Task tracker
```

### 🤖 AI Collaboration Features

- **Structured Context**: Issues provide clear requirements, plans provide implementation details
- **Autonomous Execution**: AI can work through entire backlogs independently
- **Bootstrap Capability**: AI can decompose master plans into structured issues
- **Version Control Integration**: Automatic git commits on task completion
- **Stream Monitoring**: Real-time feedback on AI execution progress
- **Error Recovery**: Graceful handling of failed tasks with human intervention points

### 🧪 Testing

```bash
# Run all tests
npm test

# API tests only
npm test --workspace=api

# E2E tests
npm run test:e2e --workspace=api
```

### 📚 Learn More

- [Vercel AI SDK Documentation](https://v5.ai-sdk.dev/)
- [Nest.js Documentation](https://nestjs.com/)
- [Agent Pattern Examples](./docs/)

## Contributing

### For Simple Features (Recommended)
1. Create issue: `npm run issue "Feature Name"`
2. Run autonomous AI agent: `npm run claude`
3. Claude will automatically:
   - Read the issue requirements
   - Follow the implementation plan
   - Write and test the code
   - Commit changes automatically
4. Review the implementation and submit PR

### For Complex Features
1. Create master plan document (e.g., `plan-feature.md`)
2. Create bootstrap issue: `npm run issue "Bootstrap Feature from Master Plan"`
3. Edit the issue to reference your master plan and specify decomposition requirements
4. Run autonomous AI agent: `npm run claude`
5. Claude will automatically:
   - Decompose your master plan into structured issues
   - Create detailed implementation plans
   - Execute each task autonomously
   - Commit progress automatically
6. Monitor progress and intervene if needed
7. Test the completed implementation
8. Submit PR

### AI-Assisted Development Workflow
- **Let Claude do the heavy lifting**: Use `npm run claude` for autonomous implementation
- **Structured planning**: Always start with clear requirements in issues
- **Iterative development**: Claude works through tasks sequentially with automatic commits
- **Human oversight**: Review auto-generated code and provide feedback through new issues

## License

MIT