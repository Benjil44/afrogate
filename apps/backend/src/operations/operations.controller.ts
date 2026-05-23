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
  AdminOutboundSummary,
  AdminOutboundsResponse,
  AdminServerDetail,
  AdminServersResponse,
  RouteFailoverEventsResponse,
} from '@afrogate/shared';
import { AdminTokenGuard } from '../security/admin-token.guard';
import type { RequestWithAuth } from '../security/auth-request';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { CreateOutboundDto, MoveOutboundDto, UpdateOutboundDto } from './dto/outbound.dto';
import { CreateServerDto, UpdateServerDto } from './dto/server.dto';
import { OperationsService } from './operations.service';

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('servers')
  @Roles('admin', 'support', 'auditor')
  async listServers(): Promise<AdminServersResponse> {
    return {
      servers: await this.operationsService.listServers(),
    };
  }

  @Get('servers/:id')
  @Roles('admin', 'support', 'auditor')
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

  @Get('outbounds')
  @Roles('admin', 'support', 'auditor')
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
  @Roles('admin', 'support', 'auditor')
  getOutbound(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminOutboundSummary> {
    return this.operationsService.getOutbound(id);
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
  @Roles('admin', 'support', 'auditor')
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
