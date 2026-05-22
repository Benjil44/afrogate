import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AgentTokenGuard } from '../security/agent-token.guard';
import { MetricsIngestDto } from './dto/metrics-ingest.dto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  @UseGuards(AgentTokenGuard)
  ingest(@Body() payload: MetricsIngestDto) {
    return this.metricsService.record(payload);
  }

  @Get('latest')
  latest() {
    return {
      servers: this.metricsService.listLatest(),
    };
  }
}
