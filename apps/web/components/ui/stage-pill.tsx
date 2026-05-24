import { Badge } from './badge';
import { stageLabel } from '@/lib/utils';
import type { BillStage } from '@/lib/types';

const STAGE_VARIANT: Record<BillStage, 'slate' | 'green' | 'amber' | 'red'> = {
  INTRODUCED: 'slate',
  FIRST_READING: 'slate',
  SECOND_READING: 'amber',
  COMMITTEE: 'amber',
  THIRD_READING: 'amber',
  PASSED: 'green',
  TRANSMITTED: 'green',
  ASSENTED: 'green',
  WITHDRAWN: 'red',
  LAPSED: 'red',
};

export function StagePill({ stage }: { stage: BillStage }) {
  return <Badge variant={STAGE_VARIANT[stage]}>{stageLabel(stage)}</Badge>;
}
