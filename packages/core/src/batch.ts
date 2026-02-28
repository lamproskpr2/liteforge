/**
 * LiteForge Batch
 *
 * Batch multiple signal updates together to avoid redundant effect executions.
 */

import { startBatch, endBatch } from './internals.js';

/**
 * Batch multiple signal updates together.
 *
 * Effects will only be notified once after the batch completes,
 * even if multiple signals are updated. Supports nested batches.
 *
 * @param fn - Function containing signal updates to batch
 *
 * @example
 * ```ts
 * const firstName = signal('John');
 * const lastName = signal('Doe');
 *
 * effect(() => {
 *   console.log(firstName(), lastName());
 * });
 * // logs: "John Doe"
 *
 * batch(() => {
 *   firstName.set('Jane');
 *   lastName.set('Smith');
 * });
 * // logs: "Jane Smith" (only once, not twice)
 * ```
 */
export function batch(fn: () => void): void {
  startBatch();
  try {
    fn();
  } finally {
    endBatch();
  }
}
