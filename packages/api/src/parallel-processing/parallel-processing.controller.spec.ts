import { Test, TestingModule } from '@nestjs/testing';
import { ParallelProcessingController } from './parallel-processing.controller';

describe('ParallelProcessingController', () => {
  let controller: ParallelProcessingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParallelProcessingController],
    }).compile();

    controller = module.get<ParallelProcessingController>(
      ParallelProcessingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
