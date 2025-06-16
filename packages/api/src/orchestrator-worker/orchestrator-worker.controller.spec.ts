import { Test, TestingModule } from '@nestjs/testing';
import { OrchestratorWorkerController } from './orchestrator-worker.controller';

describe('OrchestratorWorkerController', () => {
  let controller: OrchestratorWorkerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestratorWorkerController],
    }).compile();

    controller = module.get<OrchestratorWorkerController>(
      OrchestratorWorkerController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
