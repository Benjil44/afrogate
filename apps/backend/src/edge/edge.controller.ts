import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { EdgeDeClientsResponse, EdgeUsageResponse } from '@afrows/shared';
import { EdgeTokenGuard } from '../security/edge-token.guard';
import { EdgeUsageReportDto } from './dto/edge-usage.dto';
import { EdgeService } from './edge.service';

/**
 * Ireland half of the Germany edge-sync API (reached by the Germany data-plane
 * agent over Cloudflare). Every route is guarded by EdgeTokenGuard, so the
 * whole surface is inert until AFROWS_EDGE_TOKEN is configured. Global prefix
 * `api` makes these /api/edge/de/clients and /api/edge/de/usage.
 */
@Controller('edge/de')
@UseGuards(EdgeTokenGuard)
export class EdgeController {
  constructor(private readonly edgeService: EdgeService) {}

  @Get('clients')
  async listClients(): Promise<EdgeDeClientsResponse> {
    return { clients: await this.edgeService.listActiveDeClients() };
  }

  @Post('usage')
  async reportUsage(@Body() payload: EdgeUsageReportDto): Promise<EdgeUsageResponse> {
    return { applied: await this.edgeService.applyUsage(payload.deltas) };
  }
}
