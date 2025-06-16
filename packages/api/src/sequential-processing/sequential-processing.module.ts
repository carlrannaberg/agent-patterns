import { Module } from '@nestjs/common';
import { SequentialProcessingController } from './sequential-processing.controller';
import { SequentialProcessingService } from './sequential-processing.service';

@Module({
  controllers: [SequentialProcessingController],
  providers: [SequentialProcessingService],
})
export class SequentialProcessingModule {}
