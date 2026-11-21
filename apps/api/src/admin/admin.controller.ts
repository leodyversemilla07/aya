import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { actorFromRequest } from '../audit/audit';
import type { AuthenticatedRequest } from '../auth/request';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOrThrow } from '../management/management.http';
import {
  adminUserListQuerySchema,
  auditLogListQuerySchema,
  updateUserRoleSchema,
} from './admin.schemas';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  listUsers(@Query() query: unknown) {
    return this.service.listUsers(parseOrThrow(adminUserListQuerySchema, query));
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateUserRole(
      id,
      parseOrThrow(updateUserRoleSchema, body),
      actorFromRequest(request),
      request.requestId,
    );
  }

  @Get('audit-logs')
  listAuditLogs(@Query() query: unknown) {
    return this.service.listAuditLogs(parseOrThrow(auditLogListQuerySchema, query));
  }
}
