import { Test, TestingModule } from '@nestjs/testing';
import { EvaluatorOptimizerController } from './evaluator-optimizer.controller';

describe('EvaluatorOptimizerController', () => {
  let controller: EvaluatorOptimizerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluatorOptimizerController],
    }).compile();

    controller = module.get<EvaluatorOptimizerController>(
      EvaluatorOptimizerController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
