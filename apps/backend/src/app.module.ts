import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AgentHeartbeatController } from './agents/agent-heartbeat.controller';
import { AgentsController } from './agents/agents.controller';
import { AgentsService } from './agents/agents.service';
import { AlertEngineService } from './alerts/alert-engine.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { PayPalPaymentService } from './billing/paypal-payment.service';
import { PayPalWebhookController } from './billing/paypal-webhook.controller';
import { ClientController } from './client/client.controller';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { METRICS_REPOSITORY } from './metrics/metrics.repository';
import { MetricsService } from './metrics/metrics.service';
import { PostgresMetricsRepository } from './metrics/postgres-metrics.repository';
import { AlertNotificationService } from './notifications/alert-notification.service';
import { TelegramAlertService } from './notifications/telegram-alert.service';
import { AuditService } from './audit/audit.service';
import { BackupStatusService } from './backups/backup-status.service';
import { OperationsController } from './operations/operations.controller';
import { OperationsService } from './operations/operations.service';
import { RouteQualityAggregationService } from './operations/route-quality-aggregation.service';
import { OutboundHealthService } from './outbound/outbound-health.service';
import { OutboundHttpService } from './outbound/outbound-http.service';
import { AdminTokenGuard } from './security/admin-token.guard';
import { AgentTokenGuard } from './security/agent-token.guard';
import { RolesGuard } from './security/roles.guard';
import { ClientTokenGuard } from './security/client-token.guard';
import { RateLimitGuard } from './security/rate-limit.guard';
import { RateLimitService } from './security/rate-limit.service';
import { SecretVaultService } from './security/secret-vault.service';
import { TelegramBotController } from './telegram/telegram-bot.controller';
import { TelegramBotConfigService } from './telegram/telegram-bot-config.service';
import { TelegramBotService } from './telegram/telegram-bot.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
  ],
  controllers: [
    AgentHeartbeatController,
    AgentsController,
    AuthController,
    BillingController,
    ClientController,
    HealthController,
    MetricsController,
    OperationsController,
    PayPalWebhookController,
    TelegramBotController,
  ],
  providers: [
    AgentsService,
    AlertEngineService,
    AlertNotificationService,
    AuditService,
    AuthService,
    BackupStatusService,
    BillingService,
    PayPalPaymentService,
    MetricsService,
    OperationsService,
    RouteQualityAggregationService,
    OutboundHealthService,
    OutboundHttpService,
    AdminTokenGuard,
    AgentTokenGuard,
    ClientTokenGuard,
    RateLimitGuard,
    RateLimitService,
    RolesGuard,
    SecretVaultService,
    PostgresMetricsRepository,
    TelegramAlertService,
    TelegramBotConfigService,
    TelegramBotService,
    {
      provide: METRICS_REPOSITORY,
      useExisting: PostgresMetricsRepository,
    },
  ],
})
export class AppModule {}
