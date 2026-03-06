/**
 * @liteforge/theme — injectTheme()
 *
 * Programmatically inject the LiteForge theme CSS tokens into the document
 * and optionally override individual token values.
 *
 * This is the runtime companion to the CSS files. You can use either:
 *   - CSS import:  import '@liteforge/theme/css'
 *   - JS runtime:  injectTheme()           ← calls this function
 *
 * The JS approach allows lazy injection (e.g. inside a plugin) and supports
 * runtime token overrides without writing any CSS.
 */

import type { ThemeTokens } from './tokens.js';
import { TOKEN_MAP } from './tokens.js';

export interface InjectThemeOptions {
  /**
   * Selector on which to apply token overrides.
   * @default ':root'
   */
  target?: string;

  /**
   * Token overrides — only the keys you provide will be changed.
   * Applied as inline CSS custom property declarations on `target`.
   */
  tokens?: Partial<ThemeTokens>;

  /**
   * If true, skip injecting the base CSS file (useful if you already
   * import the CSS via a bundler import).
   * @default false
   */
  skipCss?: boolean;

  /**
   * Nonce for CSP-protected environments. Applied to the injected
   * `<style>` element when `skipCss` is false.
   */
  nonce?: string;
}

let _cssInjected = false;

/**
 * The full base + dark theme CSS as a string.
 * Generated from the content of css/base.css + css/dark.css at build time
 * by the bundler (or inlined here for the JS-only runtime path).
 *
 * NOTE: Kept minimal here — the canonical source of truth is the CSS files.
 * For production use, import the CSS files directly via your bundler.
 * This inline copy is a convenience for plugin-driven injection.
 */
const INLINE_CSS = `
/* @liteforge/theme — injected by injectTheme() */
/* For the full token source see: @liteforge/theme/css/base and @liteforge/theme/css/dark */

:root {
  --lf-prim-neutral-0:#ffffff;--lf-prim-neutral-50:#f8fafc;--lf-prim-neutral-100:#f1f5f9;
  --lf-prim-neutral-200:#e2e8f0;--lf-prim-neutral-300:#cbd5e1;--lf-prim-neutral-400:#94a3b8;
  --lf-prim-neutral-500:#64748b;--lf-prim-neutral-600:#475569;--lf-prim-neutral-700:#334155;
  --lf-prim-neutral-800:#1e293b;--lf-prim-neutral-900:#0f172a;--lf-prim-neutral-950:#020617;
  --lf-prim-blue-100:#dbeafe;--lf-prim-blue-200:#bfdbfe;--lf-prim-blue-300:#93c5fd;
  --lf-prim-blue-400:#60a5fa;--lf-prim-blue-500:#3b82f6;--lf-prim-blue-600:#2563eb;--lf-prim-blue-700:#1d4ed8;
  --lf-prim-green-100:#dcfce7;--lf-prim-green-200:#bbf7d0;--lf-prim-green-500:#22c55e;--lf-prim-green-600:#16a34a;
  --lf-prim-red-100:#fee2e2;--lf-prim-red-200:#fecaca;--lf-prim-red-500:#ef4444;--lf-prim-red-600:#dc2626;
  --lf-prim-orange-100:#ffedd5;--lf-prim-orange-500:#f97316;
  --lf-prim-mocha-base:#1e1e2e;--lf-prim-mocha-mantle:#181825;--lf-prim-mocha-crust:#11111b;
  --lf-prim-mocha-surface0:#313244;--lf-prim-mocha-surface1:#45475a;
  --lf-prim-mocha-text:#cdd6f4;--lf-prim-mocha-subtext:#a6adc8;
  --lf-prim-mocha-blue:#89b4fa;--lf-prim-mocha-green:#a6e3a1;--lf-prim-mocha-red:#f38ba8;--lf-prim-mocha-yellow:#f9e2af;

  --lf-color-bg:var(--lf-prim-neutral-0);--lf-color-bg-subtle:var(--lf-prim-neutral-50);
  --lf-color-bg-muted:var(--lf-prim-neutral-100);--lf-color-bg-overlay:rgba(0,0,0,0.5);
  --lf-color-surface:var(--lf-prim-neutral-0);--lf-color-surface-raised:var(--lf-prim-neutral-50);
  --lf-color-border:var(--lf-prim-neutral-200);--lf-color-border-strong:var(--lf-prim-neutral-300);
  --lf-color-text:var(--lf-prim-neutral-800);--lf-color-text-muted:var(--lf-prim-neutral-500);
  --lf-color-text-subtle:var(--lf-prim-neutral-400);--lf-color-text-on-accent:var(--lf-prim-neutral-0);
  --lf-color-accent:var(--lf-prim-blue-600);--lf-color-accent-hover:var(--lf-prim-blue-700);
  --lf-color-accent-subtle:var(--lf-prim-blue-100);
  --lf-color-success:var(--lf-prim-green-600);--lf-color-success-bg:var(--lf-prim-green-100);
  --lf-color-danger:var(--lf-prim-red-600);--lf-color-danger-bg:var(--lf-prim-red-100);
  --lf-color-warning:var(--lf-prim-orange-500);--lf-color-warning-bg:var(--lf-prim-orange-100);
  --lf-radius-sm:4px;--lf-radius-md:6px;--lf-radius-lg:8px;--lf-radius-xl:12px;--lf-radius-full:9999px;
  --lf-space-1:4px;--lf-space-2:8px;--lf-space-3:12px;--lf-space-4:16px;--lf-space-5:20px;
  --lf-space-6:24px;--lf-space-8:32px;--lf-space-10:40px;--lf-space-12:48px;
  --lf-font-sans:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  --lf-font-mono:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
  --lf-text-xs:11px;--lf-text-sm:13px;--lf-text-base:14px;--lf-text-md:16px;
  --lf-text-lg:18px;--lf-text-xl:20px;--lf-text-2xl:24px;
  --lf-font-regular:400;--lf-font-medium:500;--lf-font-semibold:600;--lf-font-bold:700;
  --lf-shadow-sm:0 1px 2px rgba(0,0,0,0.05);--lf-shadow-md:0 4px 12px rgba(0,0,0,0.1);
  --lf-shadow-lg:0 8px 24px rgba(0,0,0,0.12);--lf-shadow-xl:0 20px 60px rgba(0,0,0,0.15);
  --lf-transition-fast:0.1s ease;--lf-transition-base:0.2s ease;--lf-transition-slow:0.3s ease;
  --lf-z-base:0;--lf-z-raised:10;--lf-z-dropdown:100;--lf-z-sticky:200;
  --lf-z-modal:1000;--lf-z-toast:1100;--lf-z-tooltip:1200;
}

[data-theme="dark"],.dark {
  --lf-color-bg:var(--lf-prim-mocha-crust);--lf-color-bg-subtle:var(--lf-prim-mocha-mantle);
  --lf-color-bg-muted:var(--lf-prim-mocha-base);--lf-color-bg-overlay:rgba(0,0,0,0.7);
  --lf-color-surface:var(--lf-prim-mocha-base);--lf-color-surface-raised:var(--lf-prim-mocha-surface0);
  --lf-color-border:var(--lf-prim-mocha-surface0);--lf-color-border-strong:var(--lf-prim-mocha-surface1);
  --lf-color-text:var(--lf-prim-mocha-text);--lf-color-text-muted:var(--lf-prim-mocha-subtext);
  --lf-color-text-subtle:var(--lf-prim-mocha-surface1);--lf-color-text-on-accent:var(--lf-prim-mocha-base);
  --lf-color-accent:var(--lf-prim-mocha-blue);--lf-color-accent-hover:#7aa2f7;
  --lf-color-accent-subtle:rgba(137,180,250,0.15);
  --lf-color-success:var(--lf-prim-mocha-green);--lf-color-success-bg:rgba(166,227,161,0.15);
  --lf-color-danger:var(--lf-prim-mocha-red);--lf-color-danger-bg:rgba(243,139,168,0.15);
  --lf-color-warning:var(--lf-prim-mocha-yellow);--lf-color-warning-bg:rgba(249,226,175,0.15);
  --lf-shadow-sm:0 1px 2px rgba(0,0,0,0.2);--lf-shadow-md:0 4px 12px rgba(0,0,0,0.4);
  --lf-shadow-lg:0 8px 24px rgba(0,0,0,0.5);--lf-shadow-xl:0 20px 60px rgba(0,0,0,0.6);
}

@media (prefers-color-scheme:dark) {
  :root:not([data-theme="light"]) {
    --lf-color-bg:var(--lf-prim-mocha-crust);--lf-color-bg-subtle:var(--lf-prim-mocha-mantle);
    --lf-color-bg-muted:var(--lf-prim-mocha-base);--lf-color-bg-overlay:rgba(0,0,0,0.7);
    --lf-color-surface:var(--lf-prim-mocha-base);--lf-color-surface-raised:var(--lf-prim-mocha-surface0);
    --lf-color-border:var(--lf-prim-mocha-surface0);--lf-color-border-strong:var(--lf-prim-mocha-surface1);
    --lf-color-text:var(--lf-prim-mocha-text);--lf-color-text-muted:var(--lf-prim-mocha-subtext);
    --lf-color-text-subtle:var(--lf-prim-mocha-surface1);--lf-color-text-on-accent:var(--lf-prim-mocha-base);
    --lf-color-accent:var(--lf-prim-mocha-blue);--lf-color-accent-hover:#7aa2f7;
    --lf-color-accent-subtle:rgba(137,180,250,0.15);
    --lf-color-success:var(--lf-prim-mocha-green);--lf-color-success-bg:rgba(166,227,161,0.15);
    --lf-color-danger:var(--lf-prim-mocha-red);--lf-color-danger-bg:rgba(243,139,168,0.15);
    --lf-color-warning:var(--lf-prim-mocha-yellow);--lf-color-warning-bg:rgba(249,226,175,0.15);
    --lf-shadow-sm:0 1px 2px rgba(0,0,0,0.2);--lf-shadow-md:0 4px 12px rgba(0,0,0,0.4);
    --lf-shadow-lg:0 8px 24px rgba(0,0,0,0.5);--lf-shadow-xl:0 20px 60px rgba(0,0,0,0.6);
  }
}

[data-theme="light"] {
  --lf-color-bg:var(--lf-prim-neutral-0);--lf-color-bg-subtle:var(--lf-prim-neutral-50);
  --lf-color-bg-muted:var(--lf-prim-neutral-100);--lf-color-bg-overlay:rgba(0,0,0,0.5);
  --lf-color-surface:var(--lf-prim-neutral-0);--lf-color-surface-raised:var(--lf-prim-neutral-50);
  --lf-color-border:var(--lf-prim-neutral-200);--lf-color-border-strong:var(--lf-prim-neutral-300);
  --lf-color-text:var(--lf-prim-neutral-800);--lf-color-text-muted:var(--lf-prim-neutral-500);
  --lf-color-text-subtle:var(--lf-prim-neutral-400);--lf-color-text-on-accent:var(--lf-prim-neutral-0);
  --lf-color-accent:var(--lf-prim-blue-600);--lf-color-accent-hover:var(--lf-prim-blue-700);
  --lf-color-accent-subtle:var(--lf-prim-blue-100);
  --lf-color-success:var(--lf-prim-green-600);--lf-color-success-bg:var(--lf-prim-green-100);
  --lf-color-danger:var(--lf-prim-red-600);--lf-color-danger-bg:var(--lf-prim-red-100);
  --lf-color-warning:var(--lf-prim-orange-500);--lf-color-warning-bg:var(--lf-prim-orange-100);
  --lf-shadow-sm:0 1px 2px rgba(0,0,0,0.05);--lf-shadow-md:0 4px 12px rgba(0,0,0,0.1);
  --lf-shadow-lg:0 8px 24px rgba(0,0,0,0.12);--lf-shadow-xl:0 20px 60px rgba(0,0,0,0.15);
}
`;

/**
 * Inject the LiteForge theme into the document.
 *
 * Idempotent — calling it multiple times is safe; the CSS is only injected
 * once. Token overrides are re-applied on every call so they can be used
 * to update tokens at runtime.
 */
export function injectTheme(options: InjectThemeOptions = {}): void {
  if (typeof document === 'undefined') return;

  const { target = ':root', tokens, skipCss = false, nonce } = options;

  if (!skipCss && !_cssInjected) {
    const style = document.createElement('style');
    style.id = 'lf-theme';
    style.textContent = INLINE_CSS;
    if (nonce) style.setAttribute('nonce', nonce);
    document.head.appendChild(style);
    _cssInjected = true;
  }

  if (tokens && Object.keys(tokens).length > 0) {
    const el = target === ':root'
      ? document.documentElement
      : (document.querySelector(target) as HTMLElement | null);

    if (!el) return;

    for (const [key, cssVar] of TOKEN_MAP) {
      const value = tokens[key];
      if (value !== undefined) {
        el.style.setProperty(cssVar, value);
      }
    }
  }
}

/**
 * Reset the injection flag (for testing).
 */
export function resetThemeInjection(): void {
  _cssInjected = false;
  if (typeof document !== 'undefined') {
    document.getElementById('lf-theme')?.remove();
  }
}
