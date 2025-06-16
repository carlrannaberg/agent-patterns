import { Test, TestingModule } from '@nestjs/testing';
import { ParallelProcessingService } from './parallel-processing.service';

describe('ParallelProcessingService', () => {
  let service: ParallelProcessingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParallelProcessingService],
    }).compile();

    service = module.get<ParallelProcessingService>(ParallelProcessingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
