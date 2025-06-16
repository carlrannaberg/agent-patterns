import { Test, TestingModule } from '@nestjs/testing';
import { MultiStepToolUsageService } from './multi-step-tool-usage.service';

describe('MultiStepToolUsageService', () => {
  let service: MultiStepToolUsageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MultiStepToolUsageService],
    }).compile();

    service = module.get<MultiStepToolUsageService>(MultiStepToolUsageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
