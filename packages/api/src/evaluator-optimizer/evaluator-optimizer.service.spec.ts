import { Test, TestingModule } from '@nestjs/testing';
import { EvaluatorOptimizerService } from './evaluator-optimizer.service';

describe('EvaluatorOptimizerService', () => {
  let service: EvaluatorOptimizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EvaluatorOptimizerService],
    }).compile();

    service = module.get<EvaluatorOptimizerService>(EvaluatorOptimizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
