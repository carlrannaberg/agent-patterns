import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SequentialProcessingPage from './pages/SequentialProcessingPage';
import RoutingPage from './pages/RoutingPage';
import ParallelProcessingPage from './pages/ParallelProcessingPage';
import OrchestratorWorkerPage from './pages/OrchestratorWorkerPage';
import EvaluatorOptimizerPage from './pages/EvaluatorOptimizerPage';
import MultiStepToolUsagePage from './pages/MultiStepToolUsagePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="sequential-processing" element={<SequentialProcessingPage />} />
        <Route path="routing" element={<RoutingPage />} />
        <Route path="parallel-processing" element={<ParallelProcessingPage />} />
        <Route path="orchestrator-worker" element={<OrchestratorWorkerPage />} />
        <Route path="evaluator-optimizer" element={<EvaluatorOptimizerPage />} />
        <Route path="multi-step-tool-usage" element={<MultiStepToolUsagePage />} />
      </Route>
    </Routes>
  );
}

export default App;
