import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type {
  AdminRouterConnectConfigResponse,
  AdminRouterCredentialResponse,
  AdminRouterModemActionResponse,
  AdminRouterMutationResponse,
  AdminRouterStatusResponse,
  AdminRouterWgUsageResponse,
  AdminRoutersResponse,
} from '@afrows/shared';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { RoutersService } from './routers.service';
import {
  CreateMikroTikRouterDto,
  ReconnectModemDto,
  SetMikroTikModeDto,
  SetWgRateDto,
  UpdateMikroTikRouterDto,
} from './dto/router.dto';

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class RoutersController {
  constructor(private readonly routersService: RoutersService) {}

  @Get('routers')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  list(): Promise<AdminRoutersResponse> {
    return this.routersService.listRouters();
  }

  @Get('routers/:id/status')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  status(@Param('id') id: string): Promise<AdminRouterStatusResponse> {
    return this.routersService.getStatus(id);
  }

  @Post('routers')
  @Roles('admin')
  create(@Body() payload: CreateMikroTikRouterDto): Promise<AdminRouterMutationResponse> {
    return this.routersService.create(payload);
  }

  @Patch('routers/:id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() payload: UpdateMikroTikRouterDto): Promise<AdminRouterMutationResponse> {
    return this.routersService.update(id, payload);
  }

  @Delete('routers/:id')
  @Roles('admin')
  remove(@Param('id') id: string): Promise<{ removed: boolean }> {
    return this.routersService.remove(id);
  }

  @Post('routers/:id/mode')
  @Roles('admin', 'supervisor')
  setMode(@Param('id') id: string, @Body() payload: SetMikroTikModeDto): Promise<AdminRouterMutationResponse> {
    return this.routersService.setMode(id, payload.mode);
  }

  @Post('routers/:id/modems/reconnect')
  @Roles('admin', 'supervisor')
  reconnectModem(
    @Param('id') id: string,
    @Body() payload: ReconnectModemDto,
  ): Promise<AdminRouterModemActionResponse> {
    return this.routersService.reconnectModem(id, payload.interface);
  }

  @Get('routers/:id/credential')
  @Roles('admin')
  credential(@Param('id') id: string): Promise<AdminRouterCredentialResponse> {
    return this.routersService.revealCredential(id);
  }

  @Post('routers/:id/rotate-password')
  @Roles('admin')
  rotatePassword(@Param('id') id: string): Promise<AdminRouterCredentialResponse> {
    return this.routersService.rotatePassword(id);
  }

  @Get('routers/:id/connect-config')
  @Roles('admin')
  connectConfig(@Param('id') id: string): Promise<AdminRouterConnectConfigResponse> {
    return this.routersService.connectConfig(id);
  }

  @Get('routers/:id/wg-usage')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  wgUsage(@Param('id') id: string, @Query('days') days?: string): Promise<AdminRouterWgUsageResponse> {
    return this.routersService.getWgUsage(id, Number(days) || 30);
  }

  @Post('routers/:id/wg-rate')
  @Roles('admin', 'supervisor')
  setWgRate(@Param('id') id: string, @Body() payload: SetWgRateDto): Promise<AdminRouterWgUsageResponse> {
    return this.routersService.setWgRate(id, payload.peerKey, payload.pricePerGb, payload.label ?? null, payload.currency ?? null);
  }
}
