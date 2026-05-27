import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { AdminLoginResponse } from '@afrogate/shared';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() payload: AdminLoginDto): Promise<AdminLoginResponse> {
    return this.authService.login(payload.username, payload.password);
  }
}
