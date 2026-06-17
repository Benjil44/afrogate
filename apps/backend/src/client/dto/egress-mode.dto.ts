import { IsIn } from 'class-validator';
import { EGRESS_MODES, type EgressMode } from '@afrows/shared';

export class SetEgressModeDto {
  @IsIn(EGRESS_MODES as readonly string[])
  mode!: EgressMode;
}
