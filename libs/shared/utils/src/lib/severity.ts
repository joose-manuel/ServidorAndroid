export type SeverityLevel = 'ok' | 'warning' | 'critical';

export function severityFromLatencyMs(latencyMs: number, alertMs = 300): SeverityLevel {
  if (latencyMs >= alertMs) return 'critical';
  if (latencyMs >= alertMs * 0.7) return 'warning';
  return 'ok';
}

export function severityFromPacketLoss(percent: number): SeverityLevel {
  if (percent >= 5) return 'critical';
  if (percent >= 1) return 'warning';
  return 'ok';
}

export function severityFromBattery(levelPercent: number): SeverityLevel {
  if (levelPercent < 15) return 'critical';
  if (levelPercent < 30) return 'warning';
  return 'ok';
}