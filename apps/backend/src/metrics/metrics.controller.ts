import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { LatestMetricsResponse, ServerMetricSnapshot } from '@afrogate/shared';
import { AgentTokenGuard } from '../security/agent-token.guard';
import { MetricsIngestDto } from './dto/metrics-ingest.dto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  @UseGuards(AgentTokenGuard)
  ingest(@Body() payload: MetricsIngestDto): Promise<ServerMetricSnapshot> {
    return this.metricsService.record(payload);
  }

  @Get('latest')
  async latest(): Promise<LatestMetricsResponse> {
    return {
      servers: await this.metricsService.listLatest(),
    };
  }
}
