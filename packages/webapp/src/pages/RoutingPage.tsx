import AgentInteraction from '../components/AgentInteraction';

export default function RoutingPage() {
  return (
    <AgentInteraction
      apiEndpoint="routing"
      title="Routing"
      description="This pattern demonstrates intelligent routing where customer queries are classified and routed to specialized handlers for appropriate responses."
      placeholder="Enter a customer query (e.g., 'I want to return my product', 'How do I use feature X?', 'What are your pricing plans?')..."
    />
  );
}