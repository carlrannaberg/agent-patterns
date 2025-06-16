import { Test, TestingModule } from '@nestjs/testing';
import { SequentialProcessingController } from './sequential-processing.controller';

describe('SequentialProcessingController', () => {
  let controller: SequentialProcessingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SequentialProcessingController],
    }).compile();

    controller = module.get<SequentialProcessingController>(
      SequentialProcessingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
