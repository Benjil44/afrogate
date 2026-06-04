import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { AgentRegistrationResponse, AgentTokenRotationResponse } from '@afrows/shared';
import { AdminTokenGuard } from '../security/admin-token.guard';
import type { RequestWithAuth } from '../security/auth-request';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { AgentsService } from './agents.service';
import { RegisterAgentDto } from './dto/register-agent.dto';
import { RotateAgentTokenDto } from './dto/rotate-agent-token.dto';

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

  @Post(':serverId/tokens/rotate')
  @Roles('admin')
  rotateToken(
    @Param('serverId', new ParseUUIDPipe({ version: '4' })) serverId: string,
    @Body() payload: RotateAgentTokenDto | undefined,
    @Req() request: RequestWithAuth,
  ): Promise<AgentTokenRotationResponse> {
    return this.agentsService.rotateToken(serverId, payload ?? {}, request.actor);
  }
}
