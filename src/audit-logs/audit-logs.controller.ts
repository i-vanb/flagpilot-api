import { Controller, Get, Param } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';

@Controller()
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('projects/:projectId/audit-logs')
  findByProject(@Param('projectId') projectId: string) {
    return this.auditLogsService.findByProject(projectId);
  }

  @Get('flags/:flagId/audit-logs')
  findByFlag(@Param('flagId') flagId: string) {
    return this.auditLogsService.findByFlag(flagId);
  }
}
