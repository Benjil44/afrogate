import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { AgentHeartbeatRequest } from '@afrogate/shared';

export class AgentHeartbeatDto implements AgentHeartbeatRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostname?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}
