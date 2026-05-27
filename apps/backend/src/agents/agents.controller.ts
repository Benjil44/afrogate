import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { AgentRegistrationResponse } from '@afrogate/shared';
import { AdminTokenGuard } from '../security/admin-token.guard';
import type { RequestWithAuth } from '../security/auth-request';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { AgentsService } from './agents.service';
import { RegisterAgentDto } from './dto/register-agent.dto';

@Controller('agents')
@UseGuards(AdminTokenGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('register')
  @Roles('admin')
  register(
    @Body() payload: RegisterAgentDto,
    @Req() request: RequestWithAuth,
  ): Promise<AgentRegistrationResponse> {
    return this.agentsService.register(payload, request.actor);
  }
}
