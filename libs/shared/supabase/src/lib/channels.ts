export const SUPABASE_CHANNELS = {
  metrics: (edgeNodeId: string) => `edge:${edgeNodeId}:metrics`,
  alerts: (edgeNodeId: string) => `edge:${edgeNodeId}:alerts`,
  cameraSignal: (edgeNodeId: string) => `edge:${edgeNodeId}:camera:signal`,
  intercomSignal: (edgeNodeId: string) => `edge:${edgeNodeId}:intercom:signal`,
  auditLog: () => `audit:log`,
} as const;

export const SUPABASE_EVENTS = {
  metricsUpdate: 'metrics:update',
  alertNew: 'alert:new',
  cameraOffer: 'camera:offer',
  cameraAnswer: 'camera:answer',
  cameraIce: 'camera:ice',
  cameraSwitch: 'camera:switch',
  cameraEnd: 'camera:end',
  intercomOffer: 'intercom:offer',
  intercomAnswer: 'intercom:answer',
  intercomIce: 'intercom:ice',
  intercomMute: 'intercom:mute',
  intercomEnd: 'intercom:end',
} as const;