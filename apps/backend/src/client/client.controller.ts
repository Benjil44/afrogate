import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type {
  ClientPortalProfileResponse,
  ClientRouteOptionsResponse,
  ClientRoutePreferenceResponse,
} from '@afrogate/shared';
import { BillingService } from '../billing/billing.service';
import { ClientTokenGuard } from '../security/client-token.guard';
import type { ClientAuthActor, RequestWithClientAuth } from '../security/auth-request';
import { UpdateOwnClientRoutePreferenceDto } from './dto/client-route-preference.dto';

@Controller('client')
@UseGuards(ClientTokenGuard)
export class ClientController {
  constructor(private readonly billingService: BillingService) {}

  @Get('me')
  getProfile(@Req() request: RequestWithClientAuth): Promise<ClientPortalProfileResponse> {
    return this.billingService.getClientPortalProfile(this.requireClientActor(request));
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

  private requireClientActor(request: RequestWithClientAuth): ClientAuthActor {
    if (!request.clientActor) {
      throw new Error('Client actor missing after ClientTokenGuard');
    }

    return request.clientActor;
  }
}
