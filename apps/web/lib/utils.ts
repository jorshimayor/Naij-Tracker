import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { BillStage } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STAGE_LABELS: Record<BillStage, string> = {
  INTRODUCED: 'Introduced',
  FIRST_READING: 'First reading',
  SECOND_READING: 'Second reading',
  COMMITTEE: 'Committee',
  THIRD_READING: 'Third reading',
  PASSED: 'Passed',
  TRANSMITTED: 'Transmitted',
  ASSENTED: 'Assented',
  WITHDRAWN: 'Withdrawn',
  LAPSED: 'Lapsed',
};

export function stageLabel(stage: BillStage): string {
  return STAGE_LABELS[stage] ?? stage;
}

const STAGE_ORDER: BillStage[] = [
  'INTRODUCED', 'FIRST_READING', 'SECOND_READING', 'COMMITTEE',
  'THIRD_READING', 'PASSED', 'TRANSMITTED', 'ASSENTED',
];

export function stageProgress(stage: BillStage): number {
  const i = STAGE_ORDER.indexOf(stage);
  if (i === -1) return 0;
  return Math.round(((i + 1) / STAGE_ORDER.length) * 100);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
