/**
 * @liteforge/theme — Token definitions
 *
 * `ThemeTokens` describes every semantic CSS variable as a TypeScript interface
 * so callers get autocomplete and type-safety when overriding tokens via
 * `injectTheme({ tokens: { ... } })`.
 *
 * `TOKEN_MAP` is the canonical list of `[key, cssVar]` tuples used by
 * `injectTheme()` to turn a `Partial<ThemeTokens>` into inline CSS.
 */

/**
 * All semantic tokens that can be overridden via `injectTheme()`.
 * Keys mirror the CSS variable names with camelCase conversion.
 */
export interface ThemeTokens {
  /* Backgrounds */
  colorBg: string;
  colorBgSubtle: string;
  colorBgMuted: string;
  colorBgOverlay: string;

  /* Surfaces */
  colorSurface: string;
  colorSurfaceRaised: string;

  /* Borders */
  colorBorder: string;
  colorBorderStrong: string;

  /* Text */
  colorText: string;
  colorTextMuted: string;
  colorTextSubtle: string;
  colorTextOnAccent: string;

  /* Accent */
  colorAccent: string;
  colorAccentHover: string;
  colorAccentSubtle: string;

  /* Status */
  colorSuccess: string;
  colorSuccessBg: string;
  colorDanger: string;
  colorDangerBg: string;
  colorWarning: string;
  colorWarningBg: string;

  /* Radius */
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radiusFull: string;

  /* Spacing */
  space1: string;
  space2: string;
  space3: string;
  space4: string;
  space5: string;
  space6: string;
  space8: string;
  space10: string;
  space12: string;

  /* Typography */
  fontSans: string;
  fontMono: string;

  textXs: string;
  textSm: string;
  textBase: string;
  textMd: string;
  textLg: string;
  textXl: string;
  text2xl: string;

  fontRegular: string;
  fontMedium: string;
  fontSemibold: string;
  fontBold: string;

  /* Shadows */
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowXl: string;

  /* Transitions */
  transitionFast: string;
  transitionBase: string;
  transitionSlow: string;

  /* Z-index */
  zBase: string;
  zRaised: string;
  zDropdown: string;
  zSticky: string;
  zModal: string;
  zToast: string;
  zTooltip: string;
}

/**
 * Maps every `ThemeTokens` key to its CSS variable name.
 * Ordered to match the base.css declaration order.
 */
export const TOKEN_MAP: ReadonlyArray<readonly [keyof ThemeTokens, string]> = [
  /* Backgrounds */
  ['colorBg',           '--lf-color-bg'],
  ['colorBgSubtle',     '--lf-color-bg-subtle'],
  ['colorBgMuted',      '--lf-color-bg-muted'],
  ['colorBgOverlay',    '--lf-color-bg-overlay'],

  /* Surfaces */
  ['colorSurface',       '--lf-color-surface'],
  ['colorSurfaceRaised', '--lf-color-surface-raised'],

  /* Borders */
  ['colorBorder',       '--lf-color-border'],
  ['colorBorderStrong', '--lf-color-border-strong'],

  /* Text */
  ['colorText',        '--lf-color-text'],
  ['colorTextMuted',   '--lf-color-text-muted'],
  ['colorTextSubtle',  '--lf-color-text-subtle'],
  ['colorTextOnAccent','--lf-color-text-on-accent'],

  /* Accent */
  ['colorAccent',       '--lf-color-accent'],
  ['colorAccentHover',  '--lf-color-accent-hover'],
  ['colorAccentSubtle', '--lf-color-accent-subtle'],

  /* Status */
  ['colorSuccess',    '--lf-color-success'],
  ['colorSuccessBg',  '--lf-color-success-bg'],
  ['colorDanger',     '--lf-color-danger'],
  ['colorDangerBg',   '--lf-color-danger-bg'],
  ['colorWarning',    '--lf-color-warning'],
  ['colorWarningBg',  '--lf-color-warning-bg'],

  /* Radius */
  ['radiusSm',   '--lf-radius-sm'],
  ['radiusMd',   '--lf-radius-md'],
  ['radiusLg',   '--lf-radius-lg'],
  ['radiusXl',   '--lf-radius-xl'],
  ['radiusFull', '--lf-radius-full'],

  /* Spacing */
  ['space1',  '--lf-space-1'],
  ['space2',  '--lf-space-2'],
  ['space3',  '--lf-space-3'],
  ['space4',  '--lf-space-4'],
  ['space5',  '--lf-space-5'],
  ['space6',  '--lf-space-6'],
  ['space8',  '--lf-space-8'],
  ['space10', '--lf-space-10'],
  ['space12', '--lf-space-12'],

  /* Typography */
  ['fontSans', '--lf-font-sans'],
  ['fontMono', '--lf-font-mono'],

  ['textXs',   '--lf-text-xs'],
  ['textSm',   '--lf-text-sm'],
  ['textBase', '--lf-text-base'],
  ['textMd',   '--lf-text-md'],
  ['textLg',   '--lf-text-lg'],
  ['textXl',   '--lf-text-xl'],
  ['text2xl',  '--lf-text-2xl'],

  ['fontRegular',  '--lf-font-regular'],
  ['fontMedium',   '--lf-font-medium'],
  ['fontSemibold', '--lf-font-semibold'],
  ['fontBold',     '--lf-font-bold'],

  /* Shadows */
  ['shadowSm', '--lf-shadow-sm'],
  ['shadowMd', '--lf-shadow-md'],
  ['shadowLg', '--lf-shadow-lg'],
  ['shadowXl', '--lf-shadow-xl'],

  /* Transitions */
  ['transitionFast', '--lf-transition-fast'],
  ['transitionBase', '--lf-transition-base'],
  ['transitionSlow', '--lf-transition-slow'],

  /* Z-index */
  ['zBase',     '--lf-z-base'],
  ['zRaised',   '--lf-z-raised'],
  ['zDropdown', '--lf-z-dropdown'],
  ['zSticky',   '--lf-z-sticky'],
  ['zModal',    '--lf-z-modal'],
  ['zToast',    '--lf-z-toast'],
  ['zTooltip',  '--lf-z-tooltip'],
] as const;
