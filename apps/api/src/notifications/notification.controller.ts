import { Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/request';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOrThrow } from '../management/management.http';
import { notificationListQuerySchema } from './notification.schemas';
import { NotificationService } from './notification.service';

@Controller('notifications')
@Roles('admin', 'manager', 'viewer')
@UseGuards(RolesGuard)
export class NotificationController {
  constructor(@Inject(NotificationService) private readonly service: NotificationService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    return this.service.list(
      this.service.userIdFromRequest(request),
      parseOrThrow(notificationListQuerySchema, query),
    );
  }

  @Get('unread-count')
  unreadCount(@Req() request: AuthenticatedRequest) {
    return this.service.unreadCount(this.service.userIdFromRequest(request));
  }

  @Post('read-all')
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.service.markAllRead(this.service.userIdFromRequest(request));
  }

  @Post(':id/read')
  markRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.markRead(this.service.userIdFromRequest(request), id);
  }
}
