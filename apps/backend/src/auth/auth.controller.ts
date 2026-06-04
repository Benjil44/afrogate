import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { AdminLoginResponse } from '@afrows/shared';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'auth-login', max: 12, windowMs: 60_000 })
  login(@Body() payload: AdminLoginDto): Promise<AdminLoginResponse> {
    return this.authService.login(payload.username, payload.password);
  }
}
