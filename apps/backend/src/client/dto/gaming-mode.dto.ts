import { IsBoolean } from 'class-validator';

export class SetGamingModeDto {
  @IsBoolean()
  enabled!: boolean;
}
