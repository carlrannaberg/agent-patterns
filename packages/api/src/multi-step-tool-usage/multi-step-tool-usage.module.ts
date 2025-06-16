import { Module } from '@nestjs/common';
import { MultiStepToolUsageController } from './multi-step-tool-usage.controller';
import { MultiStepToolUsageService } from './multi-step-tool-usage.service';

@Module({
  controllers: [MultiStepToolUsageController],
  providers: [MultiStepToolUsageService],
})
export class MultiStepToolUsageModule {}
