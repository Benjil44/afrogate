import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminClientConfigSummary,
  AdminCustomerAccountDetail,
  AdminCustomerAccountsResponse,
} from '@afrogate/shared';
import type { RequestWithAuth } from '../security/auth-request';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { BillingService } from './billing.service';
import {
  CreateClientConfigDto,
  CreateCustomerAccountDto,
  UpdateClientConfigDto,
  UpdateCustomerAccountDto,
} from './dto/customer-account.dto';

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('customer-accounts')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listCustomerAccounts(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminCustomerAccountsResponse> {
    return {
      accounts: await this.billingService.listCustomerAccounts({
        status,
        search,
        limit: this.billingService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Get('customer-accounts/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.getCustomerAccount(id);
  }

  @Post('customer-accounts')
  @Roles('admin')
  createCustomerAccount(
    @Body() payload: CreateCustomerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.createCustomerAccount(payload, request.actor);
  }

  @Patch('customer-accounts/:id')
  @Roles('admin')
  updateCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateCustomerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.updateCustomerAccount(id, payload, request.actor);
  }

  @Post('customer-accounts/:id/client-configs')
  @Roles('admin')
  createClientConfig(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: CreateClientConfigDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientConfigSummary> {
    return this.billingService.createClientConfig(id, payload, request.actor);
  }

  @Patch('client-configs/:id')
  @Roles('admin')
  updateClientConfig(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateClientConfigDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientConfigSummary> {
    return this.billingService.updateClientConfig(id, payload, request.actor);
  }
}
