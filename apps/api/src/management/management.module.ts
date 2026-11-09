import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { DevelopersController } from './developers.controller';
import { DevelopersService } from './developers.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  controllers: [
    DevelopersController,
    ClientsController,
    ContractsController,
    AssignmentsController,
    PerformanceController,
  ],
  providers: [
    DevelopersService,
    ClientsService,
    ContractsService,
    AssignmentsService,
    PerformanceService,
  ],
})
export class ManagementModule {}
