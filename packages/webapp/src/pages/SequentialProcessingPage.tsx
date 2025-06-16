import AgentInteraction from '../components/AgentInteraction';

export default function SequentialProcessingPage() {
  return (
    <AgentInteraction
      apiEndpoint="sequential-processing"
      title="Sequential Processing"
      description="This pattern demonstrates sequential processing where tasks are executed one after another. The system generates marketing copy and then evaluates its quality in sequence."
      placeholder="Enter a product or service you'd like to create marketing copy for..."
    />
  );
}