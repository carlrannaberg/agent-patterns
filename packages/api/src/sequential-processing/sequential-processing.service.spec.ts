import { Test, TestingModule } from '@nestjs/testing';
import { SequentialProcessingService } from './sequential-processing.service';

describe('SequentialProcessingService', () => {
  let service: SequentialProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequentialProcessingService],
    }).compile();

    service = module.get<SequentialProcessingService>(
      SequentialProcessingService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
