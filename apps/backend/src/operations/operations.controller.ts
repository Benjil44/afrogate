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
  ApplyRouteDecisionPreviewResponse,
  AdminOutboundSummary,
  AdminSessionResponse,
  AdminOutboundsResponse,
  AdminServerDetail,
  AdminServersResponse,
  AdminProtocolServerApplyEventDetailResponse,
  AdminProtocolServerApplyEventsResponse,
  AdminProtocolSetupSummary,
  AdminRouteAssignmentSummary,
  AdminRouteDecisionEventDetailResponse,
  AdminRouteDecisionEventsResponse,
  AdminRouteDecisionPreviewResponse,
  AdminRouteSettingsSummary,
  AdminRouteQualityAnalyticsResponse,
  StoreServerCredentialResponse,
  AdminSecretRefSummary,
  AdminSettingsResponse,
  AdminUserSummary,
  AdminUsersResponse,
  ProvisionProtocolSetupResponse,
  RecordProtocolServerApplyResponse,
  RecordRouteDecisionPreviewResponse,
  RequestProtocolServerApplyResponse,
  RouteFailoverEventsResponse,
} from '@afrogate/shared';
import { AuthService } from '../auth/auth.service';
import { CreateAdminUserDto, UpdateAdminUserDto, UpdateAdminUserPasswordDto } from '../auth/dto/admin-user.dto';
import { AdminTokenGuard } from '../security/admin-token.guard';
import type { RequestWithAuth } from '../security/auth-request';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { CreateOutboundDto, MoveOutboundDto, UpdateOutboundDto } from './dto/outbound.dto';
import { CreateServerCredentialDto, CreateServerDto, UpdateServerDto } from './dto/server.dto';
import {
  ApplyRouteDecisionPreviewDto,
  CreateProtocolSetupDto,
  CreateSettingsSecretDto,
  RecordProtocolServerApplyDto,
  RecordRouteDecisionPreviewDto,
  RequestProtocolServerApplyDto,
  UpsertRouteAssignmentDto,
  UpsertRouteSettingsDto,
} from './dto/settings.dto';
import { OperationsService } from './operations.service';

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class OperationsController {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly authService: AuthService,
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
  listUsers(@Req() request: RequestWithAuth): Promise<AdminUsersResponse> {
    return this.authService.listAdminUsers(request.actor);
  }

  @Post('users')
  @Roles('admin')
  createUser(
    @Body() payload: CreateAdminUserDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminUserSummary> {
    return this.authService.createAdminUser(request.actor, payload);
  }

  @Patch('users/:id')
  @Roles('admin')
  updateUser(
    @Param('id') id: string,
    @Body() payload: UpdateAdminUserDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminUserSummary> {
    return this.authService.updateAdminUser(request.actor, id, payload);
  }

  @Patch('users/:id/password')
  @Roles('admin')
  updateUserPassword(
    @Param('id') id: string,
    @Body() payload: UpdateAdminUserPasswordDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminUserSummary> {
    return this.authService.updateAdminUserPassword(request.actor, id, payload);
  }

  @Delete('users/:id')
  @Roles('admin')
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

  @Get('settings')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getSettings(@Query('routeGroup') routeGroup?: string): Promise<AdminSettingsResponse> {
    return this.operationsService.getSettings(routeGroup);
  }

  @Get('route-quality/analytics')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getRouteQualityAnalytics(
    @Query('routeGroup') routeGroup?: string,
    @Query('rangeHours') rangeHours?: string,
  ): Promise<AdminRouteQualityAnalyticsResponse> {
    return this.operationsService.getRouteQualityAnalytics(
      routeGroup,
      this.operationsService.normalizeRouteAnalyticsRangeHours(rangeHours),
    );
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
