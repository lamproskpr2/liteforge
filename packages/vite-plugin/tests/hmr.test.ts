/**
 * Tests for HMR support
 */

import { describe, it, expect } from 'vitest';
import {
  generateHmrCode,
  appendHmrCode,
  hasHmrAcceptance,
} from '../src/hmr.js';

// =============================================================================
// generateHmrCode Tests
// =============================================================================

describe('generateHmrCode', () => {
  it('generates HMR acceptance code', () => {
    const code = generateHmrCode();
    expect(code).toContain('import.meta.hot');
    expect(code).toContain('import.meta.hot.accept()');
  });

  it('wraps in if statement for safety', () => {
    const code = generateHmrCode();
    expect(code).toContain('if (import.meta.hot)');
  });
});

// =============================================================================
// appendHmrCode Tests
// =============================================================================

describe('appendHmrCode', () => {
  it('appends HMR code to existing code', () => {
    const original = 'const x = 1;';
    const result = appendHmrCode(original);
    expect(result).toContain(original);
    expect(result).toContain('import.meta.hot');
  });

  it('places HMR code at the end', () => {
    const original = 'const x = 1;';
    const result = appendHmrCode(original);
    const hmrIndex = result.indexOf('import.meta.hot');
    const originalEnd = original.length;
    expect(hmrIndex).toBeGreaterThan(originalEnd - 1);
  });
});

// =============================================================================
// hasHmrAcceptance Tests
// =============================================================================

describe('hasHmrAcceptance', () => {
  it('returns true if code has HMR acceptance', () => {
    const code = `
      const x = 1;
      if (import.meta.hot) {
        import.meta.hot.accept();
      }
    `;
    expect(hasHmrAcceptance(code)).toBe(true);
  });

  it('returns false if code has no HMR acceptance', () => {
    const code = 'const x = 1;';
    expect(hasHmrAcceptance(code)).toBe(false);
  });

  it('returns false for partial HMR code', () => {
    const code = `
      if (import.meta.hot) {
        // No accept call
      }
    `;
    expect(hasHmrAcceptance(code)).toBe(false);
  });
});
