import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { RotateAgentTokenRequest } from '@afrows/shared';

export class RotateAgentTokenDto implements RotateAgentTokenRequest {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tokenName?: string;
}
