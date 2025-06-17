export enum AgentPattern {
  SEQUENTIAL_PROCESSING = 'sequential-processing',
  ROUTING = 'routing',
  PARALLEL_PROCESSING = 'parallel-processing',
  ORCHESTRATOR_WORKER = 'orchestrator-worker',
  EVALUATOR_OPTIMIZER = 'evaluator-optimizer',
  MULTI_STEP_TOOL_USAGE = 'multi-step-tool-usage',
}

export const AGENT_PATTERN_NAMES: Record<AgentPattern, string> = {
  [AgentPattern.SEQUENTIAL_PROCESSING]: 'Sequential Processing',
  [AgentPattern.ROUTING]: 'Routing',
  [AgentPattern.PARALLEL_PROCESSING]: 'Parallel Processing',
  [AgentPattern.ORCHESTRATOR_WORKER]: 'Orchestrator-Worker',
  [AgentPattern.EVALUATOR_OPTIMIZER]: 'Evaluator-Optimizer',
  [AgentPattern.MULTI_STEP_TOOL_USAGE]: 'Multi-Step Tool Usage',
};
