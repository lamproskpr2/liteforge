import { describe, it, expect } from 'vitest';
import { TOKEN_MAP } from '../src/tokens.js';
import type { ThemeTokens } from '../src/tokens.js';

describe('TOKEN_MAP', () => {
  it('is a non-empty readonly array', () => {
    expect(Array.isArray(TOKEN_MAP)).toBe(true);
    expect(TOKEN_MAP.length).toBeGreaterThan(0);
  });

  it('every entry is a [string, string] tuple', () => {
    for (const [key, cssVar] of TOKEN_MAP) {
      expect(typeof key).toBe('string');
      expect(typeof cssVar).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      expect(cssVar.length).toBeGreaterThan(0);
    }
  });

  it('all CSS variable names start with --lf-', () => {
    for (const [, cssVar] of TOKEN_MAP) {
      expect(cssVar.startsWith('--lf-')).toBe(true);
    }
  });

  it('all keys are valid ThemeTokens keys', () => {
    const sampleTokens: Partial<ThemeTokens> = {
      colorBg: '#fff',
      colorAccent: '#3b82f6',
      radiusMd: '6px',
    };
    for (const key of Object.keys(sampleTokens)) {
      const found = TOKEN_MAP.find(([k]) => k === key);
      expect(found).toBeDefined();
    }
  });

  it('has no duplicate keys', () => {
    const keys = TOKEN_MAP.map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate CSS variable names', () => {
    const vars = TOKEN_MAP.map(([, v]) => v);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it('includes expected semantic color tokens', () => {
    const vars = TOKEN_MAP.map(([, v]) => v);
    expect(vars).toContain('--lf-color-bg');
    expect(vars).toContain('--lf-color-accent');
    expect(vars).toContain('--lf-color-text');
    expect(vars).toContain('--lf-color-border');
    expect(vars).toContain('--lf-color-danger');
    expect(vars).toContain('--lf-color-success');
  });

  it('includes radius tokens', () => {
    const vars = TOKEN_MAP.map(([, v]) => v);
    expect(vars).toContain('--lf-radius-sm');
    expect(vars).toContain('--lf-radius-md');
    expect(vars).toContain('--lf-radius-lg');
  });

  it('includes spacing tokens', () => {
    const vars = TOKEN_MAP.map(([, v]) => v);
    expect(vars).toContain('--lf-space-1');
    expect(vars).toContain('--lf-space-4');
    expect(vars).toContain('--lf-space-8');
  });

  it('includes z-index tokens', () => {
    const vars = TOKEN_MAP.map(([, v]) => v);
    expect(vars).toContain('--lf-z-modal');
    expect(vars).toContain('--lf-z-dropdown');
    expect(vars).toContain('--lf-z-tooltip');
  });

  it('includes typography tokens', () => {
    const vars = TOKEN_MAP.map(([, v]) => v);
    expect(vars).toContain('--lf-font-sans');
    expect(vars).toContain('--lf-text-base');
    expect(vars).toContain('--lf-font-semibold');
  });
});
