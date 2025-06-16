import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorWorkerService } from './orchestrator-worker.service';

describe('OrchestratorWorkerService', () => {
  let service: OrchestratorWorkerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrchestratorWorkerService],
    }).compile();

    service = module.get<OrchestratorWorkerService>(OrchestratorWorkerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
