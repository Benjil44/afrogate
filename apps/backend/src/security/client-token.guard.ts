import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import type { RequestWithClientAuth } from './auth-request';
import { readBearerToken } from './bearer-token';

@Injectable()
export class ClientTokenGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!process.env.DATABASE_URL) {
      throw new ServiceUnavailableException('Client token lookup requires database access');
    }

    const request = context.switchToHttp().getRequest<RequestWithClientAuth>();
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Client token is required');
    }

    request.clientActor = await this.billingService.authenticateClientAccessToken(token);
    return true;
  }
}
