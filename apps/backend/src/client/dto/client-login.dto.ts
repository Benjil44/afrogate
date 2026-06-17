import { IsString, MaxLength, MinLength } from 'class-validator';

export class ClientLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
