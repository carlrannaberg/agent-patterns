import AgentInteraction from '../components/AgentInteraction';

export default function OrchestratorWorkerPage() {
  return (
    <AgentInteraction
      apiEndpoint="orchestrator-worker"
      title="Orchestrator-Worker"
      description="This pattern demonstrates an orchestrator managing multiple workers. The orchestrator plans feature implementation and coordinates specialized workers for different tasks."
      placeholder="Describe a feature you'd like to implement (e.g., 'Add user authentication', 'Create a dashboard', 'Implement file upload')..."
    />
  );
}