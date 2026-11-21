import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { AlertAdminController } from './alert-admin.controller';
import { AlertScannerService } from './alert-scanner.service';
import { AlertWorkerService } from './alert-worker.service';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Module({
  controllers: [AlertAdminController, AlertController],
  providers: [
    AlertScannerService,
    AlertService,
    AlertWorkerService,
    WebhookDeliveryService,
    RolesGuard,
  ],
  exports: [AlertScannerService, AlertService, AlertWorkerService, WebhookDeliveryService],
})
export class AlertsModule {}
