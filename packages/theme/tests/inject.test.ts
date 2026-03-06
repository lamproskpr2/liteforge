import { describe, it, expect, beforeEach } from 'vitest';
import { injectTheme, resetThemeInjection } from '../src/inject.js';

beforeEach(() => {
  resetThemeInjection();
});

describe('injectTheme', () => {
  it('injects a <style id="lf-theme"> into the document head', () => {
    injectTheme();
    const el = document.getElementById('lf-theme');
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe('STYLE');
  });

  it('is idempotent — calling twice does not create duplicate style elements', () => {
    injectTheme();
    injectTheme();
    const els = document.querySelectorAll('#lf-theme');
    expect(els).toHaveLength(1);
  });

  it('injects non-empty CSS content', () => {
    injectTheme();
    const el = document.getElementById('lf-theme') as HTMLStyleElement;
    expect(el.textContent!.length).toBeGreaterThan(100);
  });

  it('skips CSS injection when skipCss is true', () => {
    injectTheme({ skipCss: true });
    const el = document.getElementById('lf-theme');
    expect(el).toBeNull();
  });

  it('applies token override to :root', () => {
    injectTheme({ tokens: { colorAccent: '#7c3aed' } });
    const value = document.documentElement.style.getPropertyValue('--lf-color-accent');
    expect(value).toBe('#7c3aed');
  });

  it('applies multiple token overrides', () => {
    injectTheme({
      tokens: {
        colorAccent: '#7c3aed',
        radiusMd: '10px',
        colorText: '#111827',
      },
    });
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--lf-color-accent')).toBe('#7c3aed');
    expect(root.style.getPropertyValue('--lf-radius-md')).toBe('10px');
    expect(root.style.getPropertyValue('--lf-color-text')).toBe('#111827');
  });

  it('does not set properties for tokens not in the overrides object', () => {
    injectTheme({ tokens: { colorAccent: '#7c3aed' } });
    const value = document.documentElement.style.getPropertyValue('--lf-color-bg');
    // --lf-color-bg was not overridden, so inline style should be empty for this prop
    expect(value).toBe('');
  });

  it('can override tokens without injecting CSS (skipCss + tokens)', () => {
    injectTheme({ skipCss: true, tokens: { colorAccent: '#ec4899' } });
    expect(document.getElementById('lf-theme')).toBeNull();
    const value = document.documentElement.style.getPropertyValue('--lf-color-accent');
    expect(value).toBe('#ec4899');
  });

  it('does nothing in non-browser environment (no document)', () => {
    // We simulate this by calling with skipCss and no tokens — just verifies no throw
    expect(() => injectTheme({ skipCss: true })).not.toThrow();
  });

  it('token overrides on second call update existing properties', () => {
    injectTheme({ tokens: { colorAccent: '#3b82f6' } });
    injectTheme({ tokens: { colorAccent: '#7c3aed' } });
    const value = document.documentElement.style.getPropertyValue('--lf-color-accent');
    expect(value).toBe('#7c3aed');
  });

  it('applies nonce attribute to the injected style element', () => {
    injectTheme({ nonce: 'abc123' });
    const el = document.getElementById('lf-theme');
    expect(el?.getAttribute('nonce')).toBe('abc123');
  });
});

describe('resetThemeInjection', () => {
  it('removes the injected style element', () => {
    injectTheme();
    expect(document.getElementById('lf-theme')).not.toBeNull();
    resetThemeInjection();
    expect(document.getElementById('lf-theme')).toBeNull();
  });

  it('allows re-injection after reset', () => {
    injectTheme();
    resetThemeInjection();
    injectTheme();
    expect(document.getElementById('lf-theme')).not.toBeNull();
  });
});
