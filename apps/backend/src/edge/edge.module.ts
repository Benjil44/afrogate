import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EdgeTokenGuard } from '../security/edge-token.guard';
import { EdgeController } from './edge.controller';
import { EdgeService } from './edge.service';

/**
 * Edge-sync feature module (Ireland half). Provisioning list + usage ingest for
 * the remote Germany data-plane agent, all behind EdgeTokenGuard.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [EdgeController],
  providers: [EdgeService, EdgeTokenGuard],
})
export class EdgeModule {}
