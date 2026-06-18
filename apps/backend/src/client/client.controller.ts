import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type {
  ClientEgressModeResponse,
  ClientGamingModeResponse,
  ClientRewardedAdClaimResponse,
  ClientRewardedAdStatusResponse,
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceResponse,
  ClientSubscriptionResponse,
} from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { ClientTokenGuard } from '../security/client-token.guard';
import type { ClientAuthActor, RequestWithClientAuth } from '../security/auth-request';
import { UpdateOwnClientRoutePreferenceDto } from './dto/client-route-preference.dto';
import { SetEgressModeDto } from './dto/egress-mode.dto';
import { SetGamingModeDto } from './dto/gaming-mode.dto';
import { ClaimRewardedAdDto } from './dto/rewarded-ad.dto';

@Controller('client')
@UseGuards(ClientTokenGuard)
export class ClientController {
  constructor(private readonly billingService: BillingService) {}

  @Get('me')
  getProfile(@Req() request: RequestWithClientAuth): Promise<ClientPortalProfileResponse> {
    return this.billingService.getClientPortalProfile(this.requireClientActor(request));
  }

  @Get('rewarded-ads')
  async getRewardedAdStatus(@Req() request: RequestWithClientAuth): Promise<ClientRewardedAdStatusResponse> {
    return {
      rewardedAds: await this.billingService.getClientRewardedAdStatus(this.requireClientActor(request)),
    };
  }

  @Post('rewarded-ads/claim')
  claimRewardedAd(
    @Req() request: RequestWithClientAuth,
    @Body() payload: ClaimRewardedAdDto,
  ): Promise<ClientRewardedAdClaimResponse> {
    return this.billingService.claimClientRewardedAd(this.requireClientActor(request), payload);
  }

  @Get('route-preference')
  async getRoutePreference(
    @Req() request: RequestWithClientAuth,
    @Query('routeGroup') routeGroup?: string,
  ): Promise<ClientRoutePreferenceResponse> {
    return {
      routePreference: await this.billingService.getClientOwnedRoutePreference(
        this.requireClientActor(request),
        routeGroup,
      ),
    };
  }

  @Patch('route-preference')
  async updateRoutePreference(
    @Req() request: RequestWithClientAuth,
    @Body() payload: UpdateOwnClientRoutePreferenceDto,
  ): Promise<ClientRoutePreferenceResponse> {
    return {
      routePreference: await this.billingService.upsertClientOwnedRoutePreference(
        this.requireClientActor(request),
        payload,
      ),
    };
  }

  @Get('route-options')
  getRouteOptions(
    @Req() request: RequestWithClientAuth,
    @Query('routeGroup') routeGroup?: string,
  ): Promise<ClientRouteOptionsResponse> {
    return this.billingService.listClientRouteOptions(this.requireClientActor(request), routeGroup);
  }

  @Get('subscription')
  getSubscription(
    @Req() request: RequestWithClientAuth,
    @Query('routeGroup') routeGroup?: string,
  ): Promise<ClientSubscriptionResponse> {
    return this.billingService.getClientSubscription(this.requireClientActor(request), routeGroup);
  }

  @Get('egress-mode')
  async getEgressMode(@Req() request: RequestWithClientAuth): Promise<ClientEgressModeResponse> {
    return { mode: await this.billingService.getEgressMode(this.requireClientActor(request)) };
  }

  @Patch('egress-mode')
  async setEgressMode(
    @Req() request: RequestWithClientAuth,
    @Body() payload: SetEgressModeDto,
  ): Promise<ClientEgressModeResponse> {
    return { mode: await this.billingService.setEgressMode(this.requireClientActor(request), payload.mode) };
  }

  @Get('gaming-mode')
  async getGamingMode(@Req() request: RequestWithClientAuth): Promise<ClientGamingModeResponse> {
    return { gaming: await this.billingService.getGamingMode(this.requireClientActor(request)) };
  }

  @Patch('gaming-mode')
  async setGamingMode(
    @Req() request: RequestWithClientAuth,
    @Body() payload: SetGamingModeDto,
  ): Promise<ClientGamingModeResponse> {
    return { gaming: await this.billingService.setGamingMode(this.requireClientActor(request), payload.enabled) };
  }

  @Get('wireguard-usage')
  getWireguardUsage(
    @Req() request: RequestWithClientAuth,
  ): Promise<{ rxBytes: number; txBytes: number; lastHandshakeAt: string | null }> {
    return this.billingService.getClientWireguardUsage(this.requireClientActor(request));
  }

  private requireClientActor(request: RequestWithClientAuth): ClientAuthActor {
    if (!request.clientActor) {
      throw new Error('Client actor missing after ClientTokenGuard');
    }

    return request.clientActor;
  }
}
