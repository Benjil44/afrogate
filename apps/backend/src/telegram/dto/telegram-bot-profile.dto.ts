import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TELEGRAM_PROFILE_LIMITS } from '../telegram-profile';

/**
 * Publish request for the bot-profile publisher. Each field is optional; only
 * provided, changed fields are forwarded to Telegram. Length caps mirror the
 * Telegram Bot API (name 64, short_description 120, description 512) and are the
 * same constants the pure planner enforces.
 */
export class UpdateTelegramBotProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(TELEGRAM_PROFILE_LIMITS.name)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TELEGRAM_PROFILE_LIMITS.shortDescription)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TELEGRAM_PROFILE_LIMITS.description)
  description?: string;
}
