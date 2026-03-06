import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

function readCss(file: string): string {
  return readFileSync(resolve(pkgRoot, 'css', file), 'utf-8');
}

describe('base.css', () => {
  const css = readCss('base.css');

  it('file exists and is non-empty', () => {
    expect(css.length).toBeGreaterThan(500);
  });

  it('defines primitive tokens under :root', () => {
    expect(css).toContain('--lf-prim-neutral-0');
    expect(css).toContain('--lf-prim-blue-600');
    expect(css).toContain('--lf-prim-mocha-base');
  });

  it('defines semantic color tokens under :root', () => {
    expect(css).toContain('--lf-color-bg');
    expect(css).toContain('--lf-color-accent');
    expect(css).toContain('--lf-color-text');
    expect(css).toContain('--lf-color-border');
  });

  it('defines radius tokens', () => {
    expect(css).toContain('--lf-radius-md');
    expect(css).toContain('--lf-radius-lg');
  });

  it('defines spacing tokens', () => {
    expect(css).toContain('--lf-space-4');
    expect(css).toContain('--lf-space-8');
  });

  it('defines typography tokens', () => {
    expect(css).toContain('--lf-font-sans');
    expect(css).toContain('--lf-text-base');
  });

  it('defines z-index tokens', () => {
    expect(css).toContain('--lf-z-modal');
    expect(css).toContain('--lf-z-dropdown');
  });

  it('defines shadow tokens', () => {
    expect(css).toContain('--lf-shadow-md');
    expect(css).toContain('--lf-shadow-xl');
  });
});

describe('dark.css', () => {
  const css = readCss('dark.css');

  it('file exists and is non-empty', () => {
    expect(css.length).toBeGreaterThan(500);
  });

  it('has [data-theme="dark"] selector', () => {
    expect(css).toContain('[data-theme="dark"]');
  });

  it('has .dark class selector', () => {
    expect(css).toContain('.dark');
  });

  it('has @media (prefers-color-scheme: dark) block', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('has :root:not([data-theme="light"]) guard in media query', () => {
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it('has [data-theme="light"] explicit light override', () => {
    expect(css).toContain('[data-theme="light"]');
  });

  it('overrides --lf-color-bg in dark selectors', () => {
    expect(css).toContain('--lf-color-bg');
  });

  it('references Catppuccin Mocha primitive tokens in dark overrides', () => {
    expect(css).toContain('var(--lf-prim-mocha-crust)');
    expect(css).toContain('var(--lf-prim-mocha-text)');
    expect(css).toContain('var(--lf-prim-mocha-blue)');
  });
});

describe('reset.css', () => {
  const css = readCss('reset.css');

  it('file exists and is non-empty', () => {
    expect(css.length).toBeGreaterThan(100);
  });

  it('sets box-sizing: border-box', () => {
    expect(css).toContain('box-sizing: border-box');
  });

  it('resets margin and padding', () => {
    expect(css).toContain('margin: 0');
    expect(css).toContain('padding: 0');
  });
});

describe('index.css', () => {
  const css = readCss('index.css');

  it('file exists', () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it('imports base.css', () => {
    expect(css).toContain('@import');
    expect(css).toContain('base.css');
  });

  it('imports dark.css', () => {
    expect(css).toContain('dark.css');
  });
});
