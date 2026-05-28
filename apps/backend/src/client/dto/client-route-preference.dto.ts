import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  CLIENT_ROUTE_PREFERENCE_MODES,
  CLIENT_ROUTE_SCORE_PROFILES,
} from '../../billing/dto/customer-account.dto';

export class UpdateOwnClientRoutePreferenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  routeGroup?: string;

  @IsOptional()
  @IsIn(CLIENT_ROUTE_PREFERENCE_MODES)
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  detectedCountryCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  preferredExitCountryCode?: string | null;

  @IsOptional()
  @IsUUID()
  preferredOutboundId?: string | null;

  @IsOptional()
  @IsIn(CLIENT_ROUTE_SCORE_PROFILES)
  scoreProfile?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoDetectCountry?: boolean;
}
