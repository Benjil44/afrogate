import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

interface RequestWithHeaders {
  headers: {
    authorization?: string;
  };
}

@Injectable()
export class AgentTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.AFROGATE_AGENT_TOKEN;

    if (!expectedToken || expectedToken === 'change-me-local-token') {
      throw new ServiceUnavailableException('Agent token is not configured');
    }

    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (!token || token !== expectedToken) {
      throw new UnauthorizedException('Invalid agent token');
    }

    return true;
  }
}
