import type { ServerRowData, Tone } from './dashboard-types';

export function getStorageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value < 10) return 'critical';
  if (value < 20) return 'warning';
  return 'neutral';
}

export function getUsageTone(value: number | null): Tone {
  if (value === null) return 'neutral';
  if (value >= 90) return 'critical';
  if (value >= 75) return 'warning';
  return 'good';
}

export function getScoreClass(score: number): string {
  if (score >= 80) return 'text-afro-green';
  if (score >= 60) return 'text-afro-blue';
  if (score >= 40) return 'text-[#c27a1a]';
  return 'text-[#b91c1c]';
}

export function getWireGuardScoreTone(score: number): Tone {
  if (score >= 85) return 'good';
  if (score >= 70) return 'neutral';
  if (score >= 50) return 'warning';
  return 'critical';
}

export function getHealthTone(score: number): Tone {
  if (score >= 80) return 'good';
  if (score >= 60) return 'neutral';
  if (score >= 40) return 'warning';
  return 'critical';
}

export function countTones(tones: Tone[]): Record<Tone, number> {
  return tones.reduce<Record<Tone, number>>(
    (counts, tone) => ({
      ...counts,
      [tone]: counts[tone] + 1,
    }),
    { good: 0, neutral: 0, warning: 0, critical: 0 },
  );
}

export function serverAccessReady(server: ServerRowData): boolean {
  if (!server.accessProfile || server.accessProfile.bootstrapState !== 'installed') return false;

  const credentialReady =
    typeof server.accessProfile.hasActiveCredential === 'boolean'
      ? server.accessProfile.hasActiveCredential
      : server.accessProfile.hasCredentialRef;

  return Boolean(credentialReady);
}

export function protocolServerApplyTone(status: string): Tone {
  switch (status) {
    case 'applyReady':
      return 'good';
    case 'dryRunReady':
      return 'neutral';
    case 'blocked':
      return 'warning';
    case 'planningOnly':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function protocolServerApplyStepTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'blocked':
      return 'warning';
    case 'future':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function protocolApplyGateTone(status: string): Tone {
  switch (status) {
    case 'passed':
      return 'good';
    case 'blocked':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'future':
    case 'notRequired':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function protocolApplyAdapterStatusTone(status: string): Tone {
  switch (status) {
    case 'ready':
      return 'good';
    case 'unsupported':
    case 'missing':
      return 'critical';
    case 'dryRunOnly':
    case 'disabled':
      return 'neutral';
    default:
      return 'neutral';
  }
}
