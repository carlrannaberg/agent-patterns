import AgentInteraction from '../components/AgentInteraction';

export default function ParallelProcessingPage() {
  return (
    <AgentInteraction
      apiEndpoint="parallel-processing"
      title="Parallel Processing"
      description="This pattern demonstrates parallel processing where multiple analyses (security, performance, maintainability) are performed simultaneously on code for comprehensive review."
      placeholder="Paste your code here for parallel analysis of security, performance, and maintainability..."
    />
  );
}