import { Module } from '@nestjs/common';
import { OrchestratorWorkerController } from './orchestrator-worker.controller';
import { OrchestratorWorkerService } from './orchestrator-worker.service';

@Module({
  controllers: [OrchestratorWorkerController],
  providers: [OrchestratorWorkerService],
})
export class OrchestratorWorkerModule {}
