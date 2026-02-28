/**
 * LiteForge HMR Support
 * 
 * Hot Module Replacement integration for LiteForge components.
 * In Phase 1, we use a simple approach: accept updates and trigger a full
 * component remount. State preservation will come in a later phase.
 */

// =============================================================================
// HMR Code Injection
// =============================================================================

/**
 * Generate HMR acceptance code to append to a module
 */
export function generateHmrCode(): string {
  return `
if (import.meta.hot) {
  import.meta.hot.accept();
}
`;
}

/**
 * Append HMR code to the transformed output
 */
export function appendHmrCode(code: string): string {
  return code + generateHmrCode();
}

/**
 * Check if code already has HMR acceptance
 */
export function hasHmrAcceptance(code: string): boolean {
  return code.includes('import.meta.hot.accept');
}
