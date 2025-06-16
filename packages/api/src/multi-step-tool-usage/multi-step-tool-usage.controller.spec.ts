import { Test, TestingModule } from '@nestjs/testing';
import { MultiStepToolUsageController } from './multi-step-tool-usage.controller';

describe('MultiStepToolUsageController', () => {
  let controller: MultiStepToolUsageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultiStepToolUsageController],
    }).compile();

    controller = module.get<MultiStepToolUsageController>(
      MultiStepToolUsageController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
