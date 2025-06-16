import { Module } from '@nestjs/common';
import { ParallelProcessingController } from './parallel-processing.controller';
import { ParallelProcessingService } from './parallel-processing.service';

@Module({
  controllers: [ParallelProcessingController],
  providers: [ParallelProcessingService],
})
export class ParallelProcessingModule {}
