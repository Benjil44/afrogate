import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';
import { METRICS_REPOSITORY } from './metrics/metrics.repository';
import { MetricsService } from './metrics/metrics.service';
import { PostgresMetricsRepository } from './metrics/postgres-metrics.repository';
import { AdminTokenGuard } from './security/admin-token.guard';
import { AgentTokenGuard } from './security/agent-token.guard';
import { RolesGuard } from './security/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    MetricsService,
    AdminTokenGuard,
    AgentTokenGuard,
    RolesGuard,
    PostgresMetricsRepository,
    {
      provide: METRICS_REPOSITORY,
      useExisting: PostgresMetricsRepository,
    },
  ],
})
export class AppModule {}
