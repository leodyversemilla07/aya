import { Module } from '@nestjs/common';
import { AlertsModule } from './alerts.module';

@Module({
  imports: [AlertsModule],
})
export class AlertWorkerModule {}
