/**
 * LiteForge Cleanup
 *
 * Register cleanup functions to run before an effect re-executes
 * or when the effect is disposed.
 */

import { registerCleanup } from './internals.js';

/**
 * Register a cleanup function for the current effect.
 *
 * The cleanup function will be called:
 * - Before the effect re-runs (when dependencies change)
 * - When the effect is disposed
 *
 * @param fn - The cleanup function to register
 * @throws Error if called outside of an effect
 *
 * @example
 * ```ts
 * effect(() => {
 *   const handler = () => console.log(count());
 *   window.addEventListener('resize', handler);
 *
 *   onCleanup(() => {
 *     window.removeEventListener('resize', handler);
 *   });
 * });
 * ```
 */
export function onCleanup(fn: () => void): void {
  registerCleanup(fn);
}
