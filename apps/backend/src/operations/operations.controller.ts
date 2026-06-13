import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminAlertsResponse,
  AdminAuditLogsResponse,
  AdminBackupRestorePlanResponse,
  AdminBackupStatusResponse,
  AdminPermissionsResponse,
  AdminReportsSummaryResponse,
  ApplyRouteDecisionPreviewResponse,
  AdminOutboundSummary,
  AdminOutboundSubscriptionSummary,
  AdminOutboundTestResult,
  AdminOutboundsAutoTestState,
  AdminSessionResponse,
  AdminOutboundsResponse,
  AdminServerDetail,
  AdminServerInterfaceSummary,
  AdminServerInterfacesResponse,
  AdminServersResponse,
  AdminProtocolServerApplyEventDetailResponse,
  AdminProtocolServerApplyEventsResponse,
  AdminProtocolSetupSummary,
  AdminIncidentTimelineResponse,
  AdminRouteCanaryStatusResponse,
  AdminRouteAssignmentSummary,
  AdminRouteDecisionEventDetailResponse,
  AdminRouteDecisionEventsResponse,
  AdminRouteDecisionPreviewResponse,
  AdminRouteSettingsSummary,
  AdminRouteHealthHistoryResponse,
  AdminRouteQualityAnalyticsResponse,
  StoreServerCredentialResponse,
  AdminSecretRefSummary,
  AdminSettingsResponse,
  AdminTelegramBotSettingsResponse,
  AdminTelegramBotTestResponse,
  AdminTunnelSummary,
  AdminTunnelsResponse,
  AdminUserSummary,
  AdminUsersResponse,
  ProvisionProtocolSetupResponse,
  RecordProtocolServerApplyResponse,
  RecordRouteDecisionPreviewResponse,
  RequestProtocolServerApplyResponse,
  RouteFailoverEventsResponse,
} from '@afrows/shared';
import { AuditService } from '../audit/audit.service';
import { BackupStatusService } from '../backups/backup-status.service';
import { AuthService } from '../auth/auth.service';
import { CreateAdminUserDto, UpdateAdminUserDto, UpdateAdminUserPasswordDto } from '../auth/dto/admin-user.dto';
import { AdminTokenGuard } from '../security/admin-token.guard';
import type { RequestWithAuth } from '../security/auth-request';
import { Permissions, Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import {
  CreateOutboundDto,
  CreateOutboundSubscriptionDto,
  MoveOutboundDto,
  UpdateOutboundDto,
} from './dto/outbound.dto';
import { CreateServerCredentialDto, CreateServerDto, UpdateServerDto } from './dto/server.dto';
import {
  CreateServerInterfaceDto,
  CreateTunnelDto,
  UpdateServerInterfaceDto,
  UpdateTunnelDto,
} from './dto/tunnel.dto';
import {
  ApplyRouteDecisionPreviewDto,
  CreateProtocolSetupDto,
  CreateSettingsSecretDto,
  RecordProtocolServerApplyDto,
  RecordRouteDecisionPreviewDto,
  RequestProtocolServerApplyDto,
  UpdateTelegramBotSettingsDto,
  UpsertRouteAssignmentDto,
  UpsertRouteSettingsDto,
} from './dto/settings.dto';
import { OperationsService } from './operations.service';
import { AdminReportsService } from '../reports/admin-reports.service';
import { TelegramBotConfigService } from '../telegram/telegram-bot-config.service';

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class OperationsController {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly backupStatusService: BackupStatusService,
    private readonly adminReportsService: AdminReportsService,
    private readonly telegramBotConfigService: TelegramBotConfigService,
  ) {}

  @Get('session')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getSession(@Req() request: RequestWithAuth): AdminSessionResponse {
    return {
      actor: {
        id: request.actor?.id ?? 'bootstrap-admin',
        username: request.actor?.username,
        role: request.actor?.role ?? 'owner',
        type: 'admin',
        isSuperAdmin: request.actor?.isSuperAdmin,
      },
      mfaReady: true,
      mfaRequired: false,
      issuedAt: request.actor?.sessionIssuedAt ?? new Date().toISOString(),
      expiresAt: request.actor?.sessionExpiresAt ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    };
  }

  @Get('servers')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listServers(): Promise<AdminServersResponse> {
    return {
      servers: await this.operationsService.listServers(),
    };
  }

  @Get('users')
  @Roles('admin')
  @Permissions('adminUsers:read')
  listUsers(@Req() request: RequestWithAuth): Promise<AdminUsersResponse> {
    return this.authService.listAdminUsers(request.actor);
  }

  @Get('permissions')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  @Permissions('dashboard:read')
  getPermissions(@Req() request: RequestWithAuth): AdminPermissionsResponse {
    return this.authService.getAdminPermissions(request.actor);
  }

  @Get('audit-logs')
  @Roles('admin', 'supervisor', 'auditor')
  async listAuditLogs(
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminAuditLogsResponse> {
    return {
      auditLogs: await this.auditService.listAuditLogs({
        action,
        actorId,
        actorType,
        limit,
        targetId,
        targetType,
      }),
    };
  }

  @Get('backups/status')
  @Roles('admin', 'supervisor', 'auditor')
  @Permissions('backups:read')
  async getBackupStatus(): Promise<AdminBackupStatusResponse> {
    return {
      backup: await this.backupStatusService.getStatus(),
    };
  }

  @Get('backups/restore-plan')
  @Roles('admin', 'supervisor', 'auditor')
  @Permissions('backups:read')
  async getBackupRestorePlan(): Promise<AdminBackupRestorePlanResponse> {
    return {
      restorePlan: await this.backupStatusService.getRestorePlan(),
    };
  }

  @Get('reports/summary')
  @Roles('admin', 'supervisor', 'auditor')
  @Permissions('reports:read')
  getReportsSummary(@Query('rangeHours') rangeHours?: string): Promise<AdminReportsSummaryResponse> {
    return this.adminReportsService.getSummary(this.operationsService.normalizeRouteAnalyticsRangeHours(rangeHours));
  }

  @Post('users')
  @Roles('admin')
  @Permissions('adminUsers:write')
  createUser(
    @Body() payload: CreateAdminUserDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminUserSummary> {
    return this.authService.createAdminUser(request.actor, payload);
  }

  @Patch('users/:id')
  @Roles('admin')
  @Permissions('adminUsers:write')
  updateUser(
    @Param('id') id: string,
    @Body() payload: UpdateAdminUserDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminUserSummary> {
    return this.authService.updateAdminUser(request.actor, id, payload);
  }

  @Patch('users/:id/password')
  @Roles('admin')
  @Permissions('adminUsers:write')
  updateUserPassword(
    @Param('id') id: string,
    @Body() payload: UpdateAdminUserPasswordDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminUserSummary> {
    return this.authService.updateAdminUserPassword(request.actor, id, payload);
  }

  @Delete('users/:id')
  @Roles('admin')
  @Permissions('adminUsers:write')
  @HttpCode(204)
  deleteUser(
    @Param('id') id: string,
    @Req() request: RequestWithAuth,
  ): Promise<void> {
    return this.authService.deleteAdminUser(request.actor, id);
  }

  @Get('servers/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getServer(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminServerDetail> {
    return this.operationsService.getServer(id);
  }

  @Post('servers')
  @Roles('admin')
  createServer(
    @Body() payload: CreateServerDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminServerDetail> {
    return this.operationsService.createServer(payload, request.actor);
  }

  @Patch('servers/:id')
  @Roles('admin')
  updateServer(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateServerDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminServerDetail> {
    return this.operationsService.updateServer(id, payload, request.actor);
  }

  @Delete('servers/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteServer(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<void> {
    return this.operationsService.deleteServer(id, request.actor);
  }

  @Post('servers/:id/credentials')
  @Roles('admin')
  storeServerCredential(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: CreateServerCredentialDto,
    @Req() request: RequestWithAuth,
  ): Promise<StoreServerCredentialResponse> {
    return this.operationsService.storeServerCredential(id, payload, request.actor);
  }

  @Get('server-interfaces')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listServerInterfaces(
    @Query('serverId') serverId?: string,
    @Query('operator') operator?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminServerInterfacesResponse> {
    return {
      interfaces: await this.operationsService.listServerInterfaces({
        serverId: this.operationsService.normalizeUuidQuery(serverId, 'serverId'),
        operator,
        status,
        limit: this.operationsService.normalizeLimit(limit, 200, 500),
      }),
    };
  }

  @Get('server-interfaces/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getServerInterface(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminServerInterfaceSummary> {
    return this.operationsService.getServerInterface(id);
  }

  @Post('server-interfaces')
  @Roles('admin')
  createServerInterface(
    @Body() payload: CreateServerInterfaceDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminServerInterfaceSummary> {
    return this.operationsService.createServerInterface(payload, request.actor);
  }

  @Patch('server-interfaces/:id')
  @Roles('admin')
  updateServerInterface(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateServerInterfaceDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminServerInterfaceSummary> {
    return this.operationsService.updateServerInterface(id, payload, request.actor);
  }

  @Delete('server-interfaces/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteServerInterface(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<void> {
    return this.operationsService.deleteServerInterface(id, request.actor);
  }

  @Get('tunnels')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listTunnels(
    @Query('serverId') serverId?: string,
    @Query('routeGroup') routeGroup?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminTunnelsResponse> {
    return {
      tunnels: await this.operationsService.listTunnels({
        serverId: this.operationsService.normalizeUuidQuery(serverId, 'serverId'),
        routeGroup,
        status,
        limit: this.operationsService.normalizeLimit(limit, 200, 500),
      }),
    };
  }

  @Get('tunnels/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getTunnel(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminTunnelSummary> {
    return this.operationsService.getTunnel(id);
  }

  @Post('tunnels')
  @Roles('admin')
  createTunnel(
    @Body() payload: CreateTunnelDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTunnelSummary> {
    return this.operationsService.createTunnel(payload, request.actor);
  }

  @Patch('tunnels/:id')
  @Roles('admin')
  updateTunnel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateTunnelDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTunnelSummary> {
    return this.operationsService.updateTunnel(id, payload, request.actor);
  }

  @Delete('tunnels/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteTunnel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<void> {
    return this.operationsService.deleteTunnel(id, request.actor);
  }

  @Get('outbounds')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listOutbounds(
    @Query('serverId') serverId?: string,
    @Query('routeGroup') routeGroup?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminOutboundsResponse> {
    return {
      outbounds: await this.operationsService.listOutbounds({
        serverId: this.operationsService.normalizeUuidQuery(serverId, 'serverId'),
        routeGroup,
        limit: this.operationsService.normalizeLimit(limit, 200, 500),
      }),
    };
  }

  @Get('outbounds/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getOutbound(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminOutboundSummary> {
    return this.operationsService.getOutbound(id);
  }

  @Get('alerts')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('sourceType') sourceType?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminAlertsResponse> {
    return {
      alerts: await this.operationsService.listAlerts({
        status,
        severity,
        sourceType,
        limit: this.operationsService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Get('incidents/timeline')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  @Permissions('alerts:read', 'routes:read')
  getIncidentTimeline(
    @Query('rangeHours') rangeHours?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminIncidentTimelineResponse> {
    return this.operationsService.getIncidentTimeline(
      this.operationsService.normalizeIncidentTimelineRangeHours(rangeHours),
      this.operationsService.normalizeLimit(limit, 100, 200),
    );
  }

  @Get('settings')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getSettings(@Query('routeGroup') routeGroup?: string): Promise<AdminSettingsResponse> {
    return this.operationsService.getSettings(routeGroup);
  }

  @Get('settings/telegram-bot')
  @Roles('superadmin')
  async getTelegramBotSettings(@Req() request: RequestWithAuth): Promise<AdminTelegramBotSettingsResponse> {
    return {
      telegramBot: await this.telegramBotConfigService.getSettingsSummary(request.actor),
    };
  }

  @Patch('settings/telegram-bot')
  @Roles('superadmin')
  async updateTelegramBotSettings(
    @Body() payload: UpdateTelegramBotSettingsDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTelegramBotSettingsResponse> {
    return {
      telegramBot: await this.telegramBotConfigService.updateSettings(payload, request.actor),
    };
  }

  @Post('settings/telegram-bot/test')
  @Roles('superadmin')
  testTelegramBotConnection(@Req() request: RequestWithAuth): Promise<AdminTelegramBotTestResponse> {
    return this.telegramBotConfigService.testConnection(request.actor);
  }

  @Get('route-quality/analytics')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  @Permissions('routes:read')
  getRouteQualityAnalytics(
    @Query('routeGroup') routeGroup?: string,
    @Query('rangeHours') rangeHours?: string,
  ): Promise<AdminRouteQualityAnalyticsResponse> {
    return this.operationsService.getRouteQualityAnalytics(
      routeGroup,
      this.operationsService.normalizeRouteAnalyticsRangeHours(rangeHours),
    );
  }

  @Get('route-health/history')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  @Permissions('routes:read')
  getRouteHealthHistory(
    @Query('routeGroup') routeGroup?: string,
    @Query('rangeHours') rangeHours?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminRouteHealthHistoryResponse> {
    return this.operationsService.getRouteHealthHistory(
      routeGroup,
      this.operationsService.normalizeRouteAnalyticsRangeHours(rangeHours),
      this.operationsService.normalizeLimit(limit, 48, 500),
    );
  }

  @Get('route-canary/status')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  @Permissions('routes:read')
  getRouteCanaryStatus(
    @Query('routeGroup') routeGroup?: string,
    @Query('assignmentKey') assignmentKey?: string,
  ): Promise<AdminRouteCanaryStatusResponse> {
    return this.operationsService.getRouteCanaryStatus(routeGroup, assignmentKey);
  }

  @Get('route-decisions/preview')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getRouteDecisionPreview(
    @Query('routeGroup') routeGroup?: string,
    @Query('assignmentKey') assignmentKey?: string,
  ): Promise<AdminRouteDecisionPreviewResponse> {
    return this.operationsService.getRouteDecisionPreview(routeGroup, assignmentKey);
  }

  @Get('route-decisions/events')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listRouteDecisionEvents(
    @Query('routeGroup') routeGroup?: string,
    @Query('assignmentKey') assignmentKey?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminRouteDecisionEventsResponse> {
    return {
      events: await this.operationsService.listRouteDecisionEvents({
        routeGroup,
        assignmentKey,
        limit: this.operationsService.normalizeLimit(limit, 25, 100),
      }),
    };
  }

  @Get('route-decisions/events/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async getRouteDecisionEvent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminRouteDecisionEventDetailResponse> {
    return {
      event: await this.operationsService.getRouteDecisionEventDetail(id),
    };
  }

  @Post('route-decisions/preview-events')
  @Roles('admin')
  recordRouteDecisionPreview(
    @Body() payload: RecordRouteDecisionPreviewDto,
    @Req() request: RequestWithAuth,
  ): Promise<RecordRouteDecisionPreviewResponse> {
    return this.operationsService.recordRouteDecisionPreview(payload, request.actor);
  }

  @Post('route-decisions/apply-preview')
  @Roles('admin')
  applyRouteDecisionPreview(
    @Body() payload: ApplyRouteDecisionPreviewDto,
    @Req() request: RequestWithAuth,
  ): Promise<ApplyRouteDecisionPreviewResponse> {
    return this.operationsService.applyRouteDecisionPreview(payload, request.actor);
  }

  @Get('route-assignments/current')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getRouteAssignment(
    @Query('routeGroup') routeGroup?: string,
    @Query('assignmentKey') assignmentKey?: string,
  ): Promise<AdminRouteAssignmentSummary> {
    return this.operationsService.getRouteAssignmentSummary(routeGroup, assignmentKey);
  }

  @Patch('route-assignments/current')
  @Roles('admin')
  updateRouteAssignment(
    @Body() payload: UpsertRouteAssignmentDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminRouteAssignmentSummary> {
    return this.operationsService.upsertRouteAssignment(payload, request.actor);
  }

  @Get('settings/protocol-apply-events')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listProtocolApplyEvents(
    @Query('protocolSetupId') protocolSetupId?: string,
    @Query('routeGroup') routeGroup?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminProtocolServerApplyEventsResponse> {
    return {
      events: await this.operationsService.listProtocolApplyEvents({
        protocolSetupId: this.operationsService.normalizeUuidQuery(protocolSetupId, 'protocolSetupId'),
        routeGroup,
        limit: this.operationsService.normalizeLimit(limit, 10, 50),
      }),
    };
  }

  @Get('settings/protocol-apply-events/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async getProtocolApplyEvent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminProtocolServerApplyEventDetailResponse> {
    return {
      event: await this.operationsService.getProtocolApplyEventDetail(id),
    };
  }

  @Post('settings/protocol-setups')
  @Roles('admin')
  createProtocolSetup(
    @Body() payload: CreateProtocolSetupDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminProtocolSetupSummary> {
    return this.operationsService.createProtocolSetup(payload, request.actor);
  }

  @Post('settings/protocol-setups/:id/provision')
  @Roles('admin')
  provisionProtocolSetup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<ProvisionProtocolSetupResponse> {
    return this.operationsService.provisionProtocolSetup(id, request.actor);
  }

  @Post('settings/protocol-setups/:id/server-apply/dry-run')
  @Roles('admin')
  recordProtocolServerApplyDryRun(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: RecordProtocolServerApplyDto,
    @Req() request: RequestWithAuth,
  ): Promise<RecordProtocolServerApplyResponse> {
    return this.operationsService.recordProtocolServerApplyDryRun(id, payload ?? {}, request.actor);
  }

  @Post('settings/protocol-setups/:id/server-apply/live-request')
  @Roles('admin')
  requestProtocolServerApply(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: RequestProtocolServerApplyDto,
    @Req() request: RequestWithAuth,
  ): Promise<RequestProtocolServerApplyResponse> {
    return this.operationsService.requestProtocolServerApply(id, payload ?? {}, request.actor);
  }

  @Post('settings/secrets')
  @Roles('admin')
  createSettingsSecret(
    @Body() payload: CreateSettingsSecretDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminSecretRefSummary> {
    return this.operationsService.createSettingsSecret(payload, request.actor);
  }

  @Patch('settings/route')
  @Roles('admin')
  updateRouteSettings(
    @Body() payload: UpsertRouteSettingsDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminRouteSettingsSummary> {
    return this.operationsService.upsertRouteSettings(payload, request.actor);
  }

  @Post('outbounds')
  @Roles('admin')
  createOutbound(
    @Body() payload: CreateOutboundDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminOutboundSummary> {
    return this.operationsService.createOutbound(payload, request.actor);
  }

  @Patch('outbounds/:id')
  @Roles('admin')
  updateOutbound(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateOutboundDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminOutboundSummary> {
    return this.operationsService.updateOutbound(id, payload, request.actor);
  }

  @Post('outbounds/:id/move')
  @Roles('admin')
  moveOutbound(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: MoveOutboundDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminOutboundSummary> {
    return this.operationsService.moveOutbound(id, payload.direction, request.actor);
  }

  @Delete('outbounds/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteOutbound(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<void> {
    return this.operationsService.deleteOutbound(id, request.actor);
  }

  @Get('outbound-subscriptions')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listOutboundSubscriptions(): Promise<{ subscriptions: AdminOutboundSubscriptionSummary[] }> {
    return { subscriptions: await this.operationsService.listOutboundSubscriptions() };
  }

  @Post('outbound-subscriptions')
  @Roles('admin')
  addOutboundSubscription(
    @Body() payload: CreateOutboundSubscriptionDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminOutboundSubscriptionSummary> {
    return this.operationsService.addOutboundSubscription(payload, request.actor);
  }

  @Post('outbound-subscriptions/:id/refresh')
  @Roles('admin')
  refreshOutboundSubscription(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminOutboundSubscriptionSummary> {
    return this.operationsService.refreshOutboundSubscription(id, request.actor);
  }

  @Delete('outbound-subscriptions/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteOutboundSubscription(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<void> {
    return this.operationsService.deleteOutboundSubscription(id, request.actor);
  }

  @Post('outbounds/test-all')
  @Roles('admin')
  testAllOutbounds(): Promise<{ requested: number }> {
    return this.operationsService.requestAllOutboundTests();
  }

  @Post('outbounds/:id/test')
  @Roles('admin')
  testOutbound(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminOutboundTestResult> {
    return this.operationsService.requestOutboundTest(id);
  }

  @Get('outbound-test-settings')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getOutboundTestSettings(): Promise<AdminOutboundsAutoTestState> {
    return this.operationsService.getOutboundTestSettings();
  }

  @Patch('outbound-test-settings')
  @Roles('admin')
  setOutboundTestSettings(@Body() body: { enabled?: boolean }): Promise<AdminOutboundsAutoTestState> {
    return this.operationsService.setOutboundTestSettings(Boolean(body?.enabled));
  }

  @Get('route-failover-events')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listRouteFailoverEvents(
    @Query('routeGroup') routeGroup?: string,
    @Query('limit') limit?: string,
  ): Promise<RouteFailoverEventsResponse> {
    return {
      events: await this.operationsService.listRouteFailoverEvents({
        routeGroup,
        limit: this.operationsService.normalizeLimit(limit, 100, 500),
      }),
    };
  }
}
