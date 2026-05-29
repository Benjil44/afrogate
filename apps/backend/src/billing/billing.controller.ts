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
  AdminBillingCatalogResponse,
  AdminBillingSettingsResponse,
  AdminCurrentPanelImportPreviewResponse,
  AdminRewardedAdSettingsResponse,
  AdminClientAccessTokensResponse,
  AdminClientConfigSummary,
  AdminClientRoutePreferenceResponse,
  AdminClientSubscriptionCredentialResponse,
  AdminClientSubscriptionCredentialsResponse,
  AdminClientUsageEventsResponse,
  AdminCustomerAccountDetail,
  AdminAllocatePaymentOrderResponse,
  AdminIssueClientAccessTokenResponse,
  AdminCustomerAccountsResponse,
  AdminPayPalPaymentOrderResponse,
  AdminPaymentMethodSummary,
  AdminPaymentMethodsResponse,
  AdminPaymentOrderSummary,
  AdminPaymentOrdersResponse,
  AdminRecordClientUsageResponse,
  AdminVolumePackageSummary,
  AdminVolumePackagesResponse,
} from '@afrogate/shared';
import type { RequestWithAuth } from '../security/auth-request';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { BillingService } from './billing.service';
import {
  CurrentPanelImportPreviewDto,
  CreateClientUsageEventDto,
  CreateClientConfigDto,
  CreateCustomerAccountDto,
  UpdateClientConfigDto,
  UpdateCustomerAccountDto,
  UpsertClientSubscriptionCredentialDto,
  UpsertClientRoutePreferenceDto,
} from './dto/customer-account.dto';
import { IssueClientAccessTokenDto } from './dto/client-access-token.dto';
import {
  AllocatePaymentOrderDto,
  CapturePayPalPaymentOrderDto,
  CreatePayPalCheckoutDto,
  CreatePaymentMethodDto,
  CreatePaymentOrderDto,
  CreateVolumePackageDto,
  UpdateBillingSettingsDto,
  UpdateRewardedAdSettingsDto,
  UpdatePaymentMethodDto,
  UpdatePaymentOrderStatusDto,
  UpdateVolumePackageDto,
} from './dto/billing.dto';

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('billing/catalog')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getBillingCatalog(): Promise<AdminBillingCatalogResponse> {
    return this.billingService.getBillingCatalog();
  }

  @Get('billing/settings')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async getBillingSettings(): Promise<AdminBillingSettingsResponse> {
    return {
      settings: await this.billingService.getBillingSettings(),
    };
  }

  @Patch('billing/settings')
  @Roles('admin')
  async updateBillingSettings(
    @Body() payload: UpdateBillingSettingsDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminBillingSettingsResponse> {
    return {
      settings: await this.billingService.updateBillingSettings(payload, request.actor),
    };
  }

  @Get('rewarded-ads/settings')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async getRewardedAdSettings(): Promise<AdminRewardedAdSettingsResponse> {
    return {
      rewardedAds: await this.billingService.getAdminRewardedAdSettings(),
    };
  }

  @Patch('rewarded-ads/settings')
  @Roles('admin')
  async updateRewardedAdSettings(
    @Body() payload: UpdateRewardedAdSettingsDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminRewardedAdSettingsResponse> {
    return {
      rewardedAds: await this.billingService.updateRewardedAdSettings(payload, request.actor),
    };
  }

  @Get('volume-packages')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listVolumePackages(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminVolumePackagesResponse> {
    return {
      packages: await this.billingService.listVolumePackages({
        status,
        limit: this.billingService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Get('volume-packages/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getVolumePackage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminVolumePackageSummary> {
    return this.billingService.getVolumePackage(id);
  }

  @Post('volume-packages')
  @Roles('admin')
  createVolumePackage(
    @Body() payload: CreateVolumePackageDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminVolumePackageSummary> {
    return this.billingService.createVolumePackage(payload, request.actor);
  }

  @Patch('volume-packages/:id')
  @Roles('admin')
  updateVolumePackage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateVolumePackageDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminVolumePackageSummary> {
    return this.billingService.updateVolumePackage(id, payload, request.actor);
  }

  @Get('payment-methods')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listPaymentMethods(
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminPaymentMethodsResponse> {
    return {
      paymentMethods: await this.billingService.listPaymentMethods({
        status,
        provider,
        limit: this.billingService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Get('payment-methods/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getPaymentMethod(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminPaymentMethodSummary> {
    return this.billingService.getPaymentMethod(id);
  }

  @Post('payment-methods')
  @Roles('admin')
  createPaymentMethod(
    @Body() payload: CreatePaymentMethodDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPaymentMethodSummary> {
    return this.billingService.createPaymentMethod(payload, request.actor);
  }

  @Patch('payment-methods/:id')
  @Roles('admin')
  updatePaymentMethod(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdatePaymentMethodDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPaymentMethodSummary> {
    return this.billingService.updatePaymentMethod(id, payload, request.actor);
  }

  @Get('payment-orders')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listPaymentOrders(
    @Query('status') status?: string,
    @Query('customerAccountId') customerAccountId?: string,
    @Query('paymentMethodId') paymentMethodId?: string,
    @Query('provider') provider?: string,
    @Query('allocationStatus') allocationStatus?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminPaymentOrdersResponse> {
    return {
      paymentOrders: await this.billingService.listPaymentOrders({
        status,
        customerAccountId,
        paymentMethodId,
        provider,
        allocationStatus,
        limit: this.billingService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Get('payment-orders/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getPaymentOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminPaymentOrderSummary> {
    return this.billingService.getPaymentOrder(id);
  }

  @Post('payment-orders')
  @Roles('admin')
  createPaymentOrder(
    @Body() payload: CreatePaymentOrderDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPaymentOrderSummary> {
    return this.billingService.createPaymentOrder(payload, request.actor);
  }

  @Post('payment-orders/:id/allocate')
  @Roles('admin')
  allocatePaymentOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: AllocatePaymentOrderDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminAllocatePaymentOrderResponse> {
    return this.billingService.allocatePaymentOrder(id, payload, request.actor);
  }

  @Post('payment-orders/:id/paypal/checkout')
  @Roles('admin')
  createPayPalCheckout(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: CreatePayPalCheckoutDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPayPalPaymentOrderResponse> {
    return this.billingService.createPayPalCheckout(id, payload, request.actor);
  }

  @Post('payment-orders/:id/paypal/capture')
  @Roles('admin')
  capturePayPalPaymentOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: CapturePayPalPaymentOrderDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPayPalPaymentOrderResponse> {
    return this.billingService.capturePayPalPaymentOrder(id, payload, request.actor);
  }

  @Patch('payment-orders/:id/status')
  @Roles('admin')
  updatePaymentOrderStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdatePaymentOrderStatusDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPaymentOrderSummary> {
    return this.billingService.updatePaymentOrderStatus(id, payload, request.actor);
  }

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

  @Post('current-panels/import-preview')
  @Roles('admin')
  previewCurrentPanelImport(
    @Body() payload: CurrentPanelImportPreviewDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCurrentPanelImportPreviewResponse> {
    return this.billingService.previewCurrentPanelImport(payload, request.actor);
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

  @Get('client-configs/:id/usage-events')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listClientUsageEvents(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('source') source?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminClientUsageEventsResponse> {
    return {
      events: await this.billingService.listClientUsageEvents(id, {
        source,
        limit: this.billingService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Post('client-configs/:id/usage-events')
  @Roles('admin')
  recordClientUsageEvent(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: CreateClientUsageEventDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminRecordClientUsageResponse> {
    return this.billingService.recordClientUsageEvent(id, payload, request.actor);
  }

  @Get('client-configs/:id/access-tokens')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listClientAccessTokens(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminClientAccessTokensResponse> {
    return {
      tokens: await this.billingService.listClientAccessTokens(id),
    };
  }

  @Post('client-configs/:id/access-tokens')
  @Roles('admin')
  async issueClientAccessToken(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: IssueClientAccessTokenDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminIssueClientAccessTokenResponse> {
    return {
      token: await this.billingService.issueClientAccessToken(id, payload, request.actor),
    };
  }

  @Patch('client-access-tokens/:id/revoke')
  @Roles('admin')
  revokeClientAccessToken(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientAccessTokensResponse> {
    return this.billingService.revokeClientAccessToken(id, request.actor);
  }

  @Get('client-configs/:id/subscription-credentials')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listClientSubscriptionCredentials(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminClientSubscriptionCredentialsResponse> {
    return {
      credentials: await this.billingService.listClientSubscriptionCredentials(id),
    };
  }

  @Post('client-configs/:id/subscription-credentials')
  @Roles('admin')
  async upsertClientSubscriptionCredential(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpsertClientSubscriptionCredentialDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientSubscriptionCredentialResponse> {
    return {
      credential: await this.billingService.upsertClientSubscriptionCredential(id, payload, request.actor),
    };
  }

  @Patch('client-subscription-credentials/:id/revoke')
  @Roles('admin')
  async revokeClientSubscriptionCredential(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientSubscriptionCredentialResponse> {
    return {
      credential: await this.billingService.revokeClientSubscriptionCredential(id, request.actor),
    };
  }

  @Get('client-configs/:id/route-preference')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async getClientRoutePreference(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('routeGroup') routeGroup?: string,
  ): Promise<AdminClientRoutePreferenceResponse> {
    return {
      routePreference: await this.billingService.getClientRoutePreference(id, routeGroup),
    };
  }

  @Patch('client-configs/:id/route-preference')
  @Roles('admin')
  async upsertClientRoutePreference(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpsertClientRoutePreferenceDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientRoutePreferenceResponse> {
    return {
      routePreference: await this.billingService.upsertClientRoutePreference(id, payload, request.actor),
    };
  }
}
