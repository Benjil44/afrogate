import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { AgentHeartbeatResponse } from '@afrows/shared';
import { AgentTokenGuard } from '../security/agent-token.guard';
import type { RequestWithAuth } from '../security/auth-request';
import { AgentHeartbeatDto } from './dto/agent-heartbeat.dto';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentHeartbeatController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('heartbeat')
  @UseGuards(AgentTokenGuard)
  heartbeat(
    @Body() payload: AgentHeartbeatDto,
    @Req() request: RequestWithAuth,
  ): Promise<AgentHeartbeatResponse> {
    return this.agentsService.heartbeat(payload, request.actor);
  }
}
