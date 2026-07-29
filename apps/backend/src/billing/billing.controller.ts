import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  AdminBillingCatalogResponse,
  AdminBillingSettingsResponse,
  AdminGbPriceResponse,
  AdminResellerGbChargeResponse,
  AdminResellerGbQuoteResponse,
  AdminResellerImpersonationResponse,
  AdminResellerTopupRequestResponse,
  AdminResellerTopupRequestsResponse,
  AdminCurrentPanelImportConfigsResponse,
  AdminCurrentPanelImportPreviewResponse,
  AdminCurrentPanelUsageSyncResponse,
  AdminCurrentPanelVolumeChargeResponse,
  AdminRewardedAdSettingsResponse,
  AdminClientAccessTokensResponse,
  AdminClientConfigSummary,
  AdminClientConfigsExportResponse,
  AdminClientRoutePreferenceResponse,
  AdminClientSubscriptionCredentialResponse,
  AdminClientSubscriptionCredentialsResponse,
  AdminClientUsageEventsResponse,
  AdminCustomerAccountDetail,
  AdminCustomerDevicesResponse,
  AdminAllocatePaymentOrderResponse,
  AdminAdjustCustomerGemsResponse,
  AdminCustomerGemsLedgerResponse,
  AdminIssueClientAccessTokenResponse,
  AdminCustomerAccountsResponse,
  AdminPayPalPaymentOrderResponse,
  AdminPaymentMethodSummary,
  AdminPaymentMethodsResponse,
  AdminPaymentOrderSummary,
  AdminPaymentOrdersResponse,
  AdminPaymentProviderAdapterSummary,
  AdminPaymentProviderCheckoutResponse,
  AdminRecordClientUsageResponse,
  AdminResellerAccountSummary,
  AdminResellerAccountsResponse,
  AdminResellerPackageQuoteResponse,
  AdminResellerPackageSaleResponse,
  AdminResellerWalletActionResponse,
  AdminResellerWalletLedgerResponse,
  AdminResellerWorkspaceResponse,
  AdminVolumePackageSummary,
  AdminVolumePackagesResponse,
} from '@afrows/shared';
import type { RequestWithAuth } from '../security/auth-request';
import { AdminTokenGuard } from '../security/admin-token.guard';
import { Permissions, Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { AuthService } from '../auth/auth.service';
import { BillingService } from './billing.service';
import {
  AdjustCustomerGemsDto,
  CurrentPanelImportConfigsDto,
  CurrentPanelImportPreviewDto,
  CurrentPanelUsageSyncDto,
  CurrentPanelVolumeChargeDto,
  CreateClientUsageEventDto,
  CreateClientConfigDto,
  CreateCustomerAccountDto,
  MergeCustomerAccountDto,
  SetCustomerAccountPasswordDto,
  SetEgressTierPriceDto,
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
  CreatePaymentProviderCheckoutDto,
  CreatePaymentMethodDto,
  CreatePaymentOrderDto,
  CreateVolumePackageDto,
  UpdateBillingSettingsDto,
  UpdateGbPriceDto,
  UpdateRewardedAdSettingsDto,
  UpdatePaymentMethodDto,
  UpdatePaymentOrderStatusDto,
  UpdateVolumePackageDto,
} from './dto/billing.dto';
import {
  CreateResellerAccountDto,
  CreateResellerGbChargeDto,
  CreateResellerPackageSaleDto,
  CreateResellerTopupRequestDto,
  RejectResellerTopupDto,
  DebitResellerWalletForPackageDto,
  TopUpResellerWalletDto,
  UpdateResellerAccountDto,
} from './dto/reseller.dto';

/** Multer-populated upload; typed locally to avoid a @types/multer dependency. */
interface UploadedReceiptFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Controller('admin')
@UseGuards(AdminTokenGuard, RolesGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly authService: AuthService,
  ) {}

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

  /**
   * The current per-GB price (the platform's cost per decimal GB). Readable by any
   * admin role for display; the reseller per-GB sale + reseller panel use it.
   */
  @Get('billing/gb-price')
  @Roles('superadmin', 'admin', 'supervisor', 'support', 'auditor')
  getGbPrice(): Promise<AdminGbPriceResponse> {
    return this.billingService.getGbPrice();
  }

  /** Set the current per-GB price. Superadmin only; audited (`billing.gb_price.update`). */
  @Patch('billing/gb-price')
  @Roles('superadmin')
  updateGbPrice(
    @Body() payload: UpdateGbPriceDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminGbPriceResponse> {
    return this.billingService.updateGbPrice(payload, request.actor);
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

  @Get('payment-provider-adapters')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  listPaymentProviderAdapters(): AdminPaymentProviderAdapterSummary[] {
    return this.billingService.listPaymentProviderAdapters();
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

  @Post('payment-orders/:id/provider/checkout')
  @Roles('admin')
  createPaymentProviderCheckout(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: CreatePaymentProviderCheckoutDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminPaymentProviderCheckoutResponse> {
    return this.billingService.createPaymentProviderCheckout(id, payload, request.actor);
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

  @Get('reseller/workspace')
  @Roles('reseller')
  @Permissions('billing:read', 'customers:read', 'resellerWallet:read')
  async getResellerWorkspace(@Req() request: RequestWithAuth): Promise<AdminResellerWorkspaceResponse> {
    return {
      workspace: await this.billingService.getResellerWorkspace(request.actor),
    };
  }

  @Post('reseller/customer-accounts')
  @Roles('reseller')
  @Permissions('customers:write')
  createResellerCustomerAccount(
    @Body() payload: CreateCustomerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.createResellerCustomerAccount(payload, request.actor);
  }

  @Post('reseller/package-sales')
  @Roles('reseller')
  @Permissions('customers:write', 'resellerWallet:read')
  createResellerPackageSale(
    @Body() payload: CreateResellerPackageSaleDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerPackageSaleResponse> {
    return this.billingService.createResellerPackageSale(payload, request.actor);
  }

  /** Preview a per-GB sale for the current reseller: cost debited + kept markup. */
  @Get('reseller/gb-quote')
  @Roles('reseller')
  @Permissions('billing:read', 'resellerWallet:read')
  async quoteResellerGbCharge(
    @Query('gb') gb: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerGbQuoteResponse> {
    return { quote: await this.billingService.quoteResellerGbCharge(request.actor, Number(gb)) };
  }

  /**
   * Grant a customer N GB. Debits the reseller wallet N × currentGbPrice (the cost);
   * the reseller keeps cost × marginBps as markup (informational, not debited).
   */
  @Post('reseller/gb-charges')
  @Roles('reseller')
  @Permissions('customers:write', 'resellerWallet:read')
  createResellerGbCharge(
    @Body() payload: CreateResellerGbChargeDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerGbChargeResponse> {
    return this.billingService.createResellerGbCharge(payload, request.actor);
  }

  /** Reseller requests a card-to-card wallet top-up (amount + receipt image upload). */
  @Post('reseller/wallet/topup-requests')
  @Roles('reseller')
  @Permissions('resellerWallet:read')
  @UseInterceptors(
    FileInterceptor('receipt', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      // Receipts are card-to-card photos; only accept images (reject PDFs, HTML, etc.).
      fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, accept: boolean) => void) => {
        if (/^image\//i.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Receipt must be an image file'), false);
        }
      },
    }),
  )
  async createResellerTopupRequest(
    @UploadedFile() file: UploadedReceiptFile | undefined,
    @Body() payload: CreateResellerTopupRequestDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerTopupRequestResponse> {
    const receipt = file ? { buffer: file.buffer, contentType: file.mimetype } : null;
    return { request: await this.billingService.createResellerTopupRequest(payload, receipt, request.actor) };
  }

  /** The current reseller's own wallet top-up requests (newest first). */
  @Get('reseller/wallet/topup-requests')
  @Roles('reseller')
  @Permissions('resellerWallet:read')
  async listResellerTopupRequests(
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerTopupRequestsResponse> {
    return { requests: await this.billingService.listResellerTopupRequestsForActor(request.actor) };
  }

  /** The current reseller's own receipt image (IDOR-guarded to the actor's account). */
  @Get('reseller/wallet/topup-requests/:id/receipt')
  @Roles('reseller')
  @Permissions('resellerWallet:read')
  async getOwnResellerTopupReceipt(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<StreamableFile> {
    const { buffer, contentType } = await this.billingService.getResellerTopupReceiptForActor(id, request.actor);
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `inline; filename="receipt-${id}"`,
    });
  }

  @Patch('reseller/customer-accounts/:id')
  @Roles('reseller')
  @Permissions('customers:write')
  updateResellerCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateCustomerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.updateResellerCustomerAccount(id, payload, request.actor);
  }

  @Get('resellers')
  @Roles('admin', 'supervisor', 'support')
  async listResellers(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<AdminResellerAccountsResponse> {
    return {
      resellers: await this.billingService.listResellerAccounts({
        status,
        search,
        limit: this.billingService.normalizeLimit(limit, 100, 500),
      }),
    };
  }

  @Get('resellers/:id')
  @Roles('admin', 'supervisor', 'support')
  getReseller(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminResellerAccountSummary> {
    return this.billingService.getResellerAccount(id);
  }

  @Post('resellers')
  @Roles('admin')
  createReseller(
    @Body() payload: CreateResellerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerAccountSummary> {
    return this.billingService.createResellerAccount(payload, request.actor);
  }

  @Patch('resellers/:id')
  @Roles('admin')
  updateReseller(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: UpdateResellerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerAccountSummary> {
    return this.billingService.updateResellerAccount(id, payload, request.actor);
  }

  @Get('resellers/:id/wallet-ledger')
  @Roles('admin', 'supervisor')
  async listResellerWalletLedger(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('limit') limit?: string,
  ): Promise<AdminResellerWalletLedgerResponse> {
    return {
      entries: await this.billingService.listResellerWalletLedger(
        id,
        this.billingService.normalizeLimit(limit, 100, 500),
      ),
    };
  }

  @Get('resellers/:id/package-quote')
  @Roles('admin', 'supervisor', 'support')
  async quoteResellerPackage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('volumePackageId', new ParseUUIDPipe({ version: '4' })) volumePackageId: string,
  ): Promise<AdminResellerPackageQuoteResponse> {
    return {
      quote: await this.billingService.quoteResellerPackage(id, volumePackageId),
    };
  }

  @Post('resellers/:id/wallet/topups')
  @Roles('admin')
  topUpResellerWallet(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: TopUpResellerWalletDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerWalletActionResponse> {
    return this.billingService.topUpResellerWallet(id, payload, request.actor);
  }

  @Post('resellers/:id/wallet/package-debits')
  @Roles('admin')
  debitResellerWalletForPackage(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: DebitResellerWalletForPackageDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerWalletActionResponse> {
    return this.billingService.debitResellerWalletForPackage(id, payload, request.actor);
  }

  /**
   * Seller oversight: list a given seller's customers + usage (used/quota, status).
   * Reuses the reseller-scoped customer-account filter for the superadmin drill-down.
   */
  @Get('resellers/:id/customers')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listResellerCustomers(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminCustomerAccountsResponse> {
    return { accounts: await this.billingService.listResellerCustomerAccountsForAdmin(id) };
  }

  /**
   * Superadmin "Sign in as seller": mint a reseller-scoped session for the seller's
   * login user so the superadmin can open that seller's panel. Audited
   * (`reseller.impersonate`); the caller keeps their own admin session to return.
   */
  @Post('resellers/:id/impersonate')
  @Roles('superadmin')
  async impersonateReseller(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerImpersonationResponse> {
    const reseller = await this.billingService.getResellerAccount(id);
    const session = await this.authService.createResellerImpersonationSession(
      request.actor,
      reseller.adminUserId,
      { resellerAccountId: reseller.id },
    );
    return { session, reseller };
  }

  // Reseller card-to-card wallet top-up approval queue (mirrors the Telegram Top-ups).
  @Get('reseller-topups')
  @Roles('admin', 'supervisor', 'support')
  async listResellerTopupRequestsAdmin(
    @Query('status') status?: string,
  ): Promise<AdminResellerTopupRequestsResponse> {
    return { requests: await this.billingService.listAdminResellerTopupRequests(status) };
  }

  @Post('reseller-topups/:id/approve')
  @Roles('admin')
  async approveResellerTopup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerTopupRequestResponse> {
    return { request: await this.billingService.approveResellerTopupRequest(id, request.actor) };
  }

  @Post('reseller-topups/:id/reject')
  @Roles('admin')
  async rejectResellerTopup(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: RejectResellerTopupDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminResellerTopupRequestResponse> {
    return { request: await this.billingService.rejectResellerTopupRequest(id, body.reason ?? null, request.actor) };
  }

  // Receipt IMAGES contain card/PII; restrict the view to admin, matching the
  // approve/reject gating. The list endpoint above stays admin/supervisor/support.
  @Get('reseller-topups/:id/receipt')
  @Roles('admin')
  async getResellerTopupReceipt(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    const { buffer, contentType } = await this.billingService.getResellerTopupReceipt(id);
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `inline; filename="receipt-${id}"`,
    });
  }

  @Get('customer-accounts')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async listCustomerAccounts(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('archived') archived?: string,
  ): Promise<AdminCustomerAccountsResponse> {
    return {
      accounts: await this.billingService.listCustomerAccounts({
        status,
        search,
        archived: archived === 'only' || archived === 'all' ? archived : 'active',
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

  @Post('current-panels/import-configs')
  @Roles('admin')
  importCurrentPanelConfigs(
    @Body() payload: CurrentPanelImportConfigsDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCurrentPanelImportConfigsResponse> {
    return this.billingService.importCurrentPanelConfigs(payload, request.actor);
  }

  @Post('current-panels/sync-usage')
  @Roles('admin')
  syncCurrentPanelUsage(
    @Body() payload: CurrentPanelUsageSyncDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCurrentPanelUsageSyncResponse> {
    return this.billingService.syncCurrentPanelUsage(payload, request.actor);
  }

  @Post('current-panels/charge-volume')
  @Roles('admin')
  chargeCurrentPanelVolume(
    @Body() payload: CurrentPanelVolumeChargeDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCurrentPanelVolumeChargeResponse> {
    return this.billingService.chargeCurrentPanelVolume(payload, request.actor);
  }

  @Get('customer-accounts/:id/client-configs/export')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  exportCustomerClientConfigs(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<AdminClientConfigsExportResponse> {
    return this.billingService.exportCustomerClientConfigs(id, request.actor);
  }

  @Get('customer-accounts/:id')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.getCustomerAccount(id);
  }

  @Get('customer-accounts/:id/devices')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getCustomerDevices(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminCustomerDevicesResponse> {
    return this.billingService.getCustomerDevices(id);
  }

  @Post('customer-accounts')
  @Roles('admin')
  createCustomerAccount(
    @Body() payload: CreateCustomerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.createCustomerAccount(payload, request.actor);
  }

  @Post('customer-accounts/:id/reset-password')
  @Roles('admin')
  resetCustomerAccountPassword(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: SetCustomerAccountPasswordDto,
    @Req() request: RequestWithAuth,
  ): Promise<{ generatedPassword: string }> {
    return this.billingService.resetCustomerAccountPassword(id, request.actor, body?.password ?? null);
  }

  @Get('egress-tier-prices')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  getEgressTierPrices(@Req() request: RequestWithAuth) {
    return this.billingService.getEgressTierPrices(request.actor);
  }

  @Patch('egress-tier-prices')
  @Roles('admin')
  setEgressTierPrice(@Body() body: SetEgressTierPriceDto, @Req() request: RequestWithAuth) {
    return this.billingService.setEgressTierPrice(body.tier, body.price, body.currency, request.actor);
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

  @Delete('customer-accounts/:id')
  @Roles('admin')
  deleteCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<{ deleted: boolean }> {
    return this.billingService.deleteCustomerAccount(id, request.actor);
  }

  @Post('customer-accounts/:id/restore')
  @Roles('admin')
  restoreCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<{ restored: boolean }> {
    return this.billingService.restoreCustomerAccount(id, request.actor);
  }

  /**
   * Merge the source account (:id) INTO the target real account, moving its
   * remaining GB, gems, client_configs, telegram link + phone and referrals over,
   * then archiving the source. Returns the updated TARGET detail.
   */
  @Post('customer-accounts/:id/merge')
  @Roles('admin')
  mergeCustomerAccount(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: MergeCustomerAccountDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminCustomerAccountDetail> {
    return this.billingService.mergeCustomerAccount(id, payload.targetAccountId, request.actor);
  }

  @Post('customer-accounts/:id/gems')
  @Roles('admin')
  async adjustCustomerGems(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() payload: AdjustCustomerGemsDto,
    @Req() request: RequestWithAuth,
  ): Promise<AdminAdjustCustomerGemsResponse> {
    return this.billingService.adjustCustomerGems(id, payload.delta, payload.reason, request.actor);
  }

  @Get('customer-accounts/:id/gems/ledger')
  @Roles('admin', 'supervisor', 'support', 'auditor')
  async getCustomerGemsLedger(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminCustomerGemsLedgerResponse> {
    const entries = await this.billingService.getCustomerGemsLedger(id, 50);
    return {
      customerAccountId: id,
      entries: entries.map((entry) => ({
        id: entry.id,
        delta: entry.delta,
        reason: entry.reason,
        ref: entry.ref,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
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

  @Get('client-configs/:id/entry-link')
  @Roles('admin')
  getClientConfigEntryLink(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ link: string | null }> {
    return this.billingService.getClientConfigEntryLink(id);
  }

  @Get('client-configs/:id/wireguard-config')
  @Roles('admin')
  getClientConfigWireguardConfig(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ configText: string; qrSvg: string }> {
    return this.billingService.getWireguardConfigForClientConfig(id);
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

  @Delete('client-configs/:id')
  @Roles('admin')
  deleteClientConfig(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: RequestWithAuth,
  ): Promise<{ deleted: boolean }> {
    return this.billingService.deleteClientConfig(id, request.actor);
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
