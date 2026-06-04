import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { AdminTenantBrandSettingsResponse } from '@afrows/shared';
import type { RequestWithAuth } from '../security/auth-request';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Permissions, Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { AdminTenantBrandingService } from './admin-tenant-branding.service';
import { UpdateTenantBrandingDto } from './dto/tenant-branding.dto';

@Controller('admin/tenant-branding')
@UseGuards(AdminTokenGuard, RolesGuard)
export class AdminTenantBrandingController {
  constructor(private readonly tenantBranding: AdminTenantBrandingService) {}

  @Get()
  @Roles('admin', 'supervisor', 'support', 'auditor')
  @Permissions('tenantBranding:read')
  async getSettings(): Promise<AdminTenantBrandSettingsResponse> {
    return {
      branding: await this.tenantBranding.getSettings(),
    };
  }

  @Patch()
  @Roles('admin')
  @Permissions('tenantBranding:write')
  async updateSettings(
    @Body() payload: UpdateTenantBrandingDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminTenantBrandSettingsResponse> {
    return {
      branding: await this.tenantBranding.updateSettings(payload, request.actor),
    };
  }
}
