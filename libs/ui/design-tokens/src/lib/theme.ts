import { COLORS, HUD, SPACING, Z_INDEX } from './tokens';

export type SeverityTone = 'ok' | 'warning' | 'critical' | 'info';

export const TONE_COLORS: Record<SeverityTone, string> = {
  ok: COLORS.ok,
  warning: COLORS.warning,
  critical: COLORS.danger,
  info: COLORS.accentSecondary,
};

export interface PanelStyle {
  background: string;
  borderColor: string;
  borderWidthPx: number;
  paddingPx: number;
  zIndex: number;
}

export const PANEL_STYLE: PanelStyle = {
  background: COLORS.bgPanel,
  borderColor: COLORS.border,
  borderWidthPx: HUD.panelBorderPx,
  paddingPx: SPACING.panelPadding,
  zIndex: Z_INDEX.panel,
};

export const STATUS_BADGE_LABELS = {
  online: 'ONLINE',
  standby: 'STANDBY',
  degraded: 'REVISAR',
  offline: 'OFFLINE',
  rebooting: 'REBOOT',
} as const;