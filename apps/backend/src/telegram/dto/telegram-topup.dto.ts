import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectTelegramTopupDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
