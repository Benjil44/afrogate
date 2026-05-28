import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class IssueClientAccessTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @IsOptional()
  @IsBoolean()
  revokeExistingTokens?: boolean;
}
