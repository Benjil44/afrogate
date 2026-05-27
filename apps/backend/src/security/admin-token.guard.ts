import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { RequestWithAuth } from './auth-request';
import { readBearerToken } from './bearer-token';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = readBearerToken(request.headers.authorization);
    request.actor = this.authService.authenticateBearerToken(token);

    return true;
  }
}
