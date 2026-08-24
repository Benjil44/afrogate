import { ArrayMaxSize, IsArray } from 'class-validator';
import type { EdgeUsageDelta, EdgeUsageReport } from '@afrows/shared';

/**
 * Only the envelope is validated here (deltas is a bounded array). Per-row
 * validation/clamping is delegated to EdgeService.applyUsage so a single bad
 * row is IGNORED rather than 400-ing the whole batch — the Germany agent
 * reports best-effort and must not lose a good batch to one malformed delta.
 * Elements are intentionally left un-nested-validated so class-validator's
 * whitelist does not strip their fields before the service reads them.
 */
export class EdgeUsageReportDto implements EdgeUsageReport {
  @IsArray()
  @ArrayMaxSize(5000)
  deltas!: EdgeUsageDelta[];
}
