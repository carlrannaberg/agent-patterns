import AgentInteraction from '../components/AgentInteraction';

export default function MultiStepToolUsagePage() {
  return (
    <AgentInteraction
      apiEndpoint="multi-step-tool-usage"
      title="Multi-Step Tool Usage"
      description="This pattern demonstrates multi-step tool usage where complex math problems are solved using calculation tools across multiple steps."
      placeholder="Enter a complex math problem that requires multiple calculation steps..."
    />
  );
}