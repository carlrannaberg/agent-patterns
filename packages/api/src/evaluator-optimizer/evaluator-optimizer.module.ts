import { Module } from '@nestjs/common';
import { EvaluatorOptimizerController } from './evaluator-optimizer.controller';
import { EvaluatorOptimizerService } from './evaluator-optimizer.service';

@Module({
  controllers: [EvaluatorOptimizerController],
  providers: [EvaluatorOptimizerService],
})
export class EvaluatorOptimizerModule {}
