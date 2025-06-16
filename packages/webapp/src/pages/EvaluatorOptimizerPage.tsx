import AgentInteraction from '../components/AgentInteraction';

export default function EvaluatorOptimizerPage() {
  return (
    <AgentInteraction
      apiEndpoint="evaluator-optimizer"
      title="Evaluator-Optimizer"
      description="This pattern demonstrates iterative improvement where translations are evaluated and optimized through multiple rounds for enhanced quality."
      placeholder="Enter text to translate with iterative quality improvement. Use [target: language] to specify target language (default: Spanish)..."
    />
  );
}