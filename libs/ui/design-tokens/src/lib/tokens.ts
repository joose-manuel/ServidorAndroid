/**
 * Design tokens — retro telemetry / CRT terminal aesthetic.
 * Mirrors the values declared in Documentacion_UXUI_Retro.docx,
 * section 2.1 (Tokens de color para desarrollo).
 *
 * Use these constants in TypeScript (Angular/Ionic) and import the
 * sibling .scss files for stylesheet consumption.
 */

export const COLORS = {
  bgBase: '#05070A',
  bgPanel: '#0A0E14',
  border: '#1C2530',
  accent: '#FF7A1A',
  accentSecondary: '#41E0D1',
  ok: '#39FF88',
  warning: '#FFD23F',
  danger: '#FF4D4D',
  textPrimary: '#D7DEE3',
  textMuted: '#5C6773',
} as const;

export const TYPOGRAPHY = {
  fontFamilyMono: `'JetBrains Mono', 'Space Mono', 'Liberation Mono', ui-monospace, monospace`,
  fontFamilyUi: `'JetBrains Mono', 'Space Mono', 'Liberation Mono', ui-monospace, monospace`,
  weights: { regular: 400, medium: 500, bold: 700 },
  sizes: { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, h2: 24, h1: 32, display: 40 },
} as const;

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  panelPadding: 16,
} as const;

export const RADIUS = {
  none: 0,
  sm: 2,
  md: 4,
} as const;

export const GRID = {
  cellSizePx: 28,
  opacity: 0.06,
  color: COLORS.accent,
} as const;

export const HUD = {
  bracketSizePx: 14,
  bracketThicknessPx: 2,
  panelBorderPx: 1,
  cursorBlinkMs: 1000,
  badgePxHeight: 22,
} as const;

export const Z_INDEX = {
  grid: 0,
  panel: 10,
  corner: 11,
  header: 100,
  modal: 1000,
  toast: 1100,
} as const;

export const BREAKPOINTS = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;