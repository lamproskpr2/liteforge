/**
 * LiteForge Effect
 *
 * An Effect is a reactive function that automatically re-runs
 * when any signal it reads changes.
 */

import {
  type Observer,
  type TaggedSubscriber,
  observerStack,
  runCleanups,
} from './internals.js';
import {
  generateDebugId,
  emitEffectRun,
  emitEffectDispose,
} from './debug.js';

// ============================================================================
// Types
// ============================================================================

/** Function passed to effect() */
export type EffectFn = () => void | (() => void);

/** Dispose function returned by effect() */
export type DisposeFn = () => void;

/** Options for creating an effect. */
export interface EffectOptions {
  /** Debug label for DevTools. If not provided, an auto-generated ID is used. */
  label?: string;
  /**
   * Mark effect as internal (DevTools-owned).
   * Internal effects don't emit debug events to avoid infinite loops.
   * @internal
   */
  __internal?: boolean;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a reactive effect that re-runs when dependencies change.
 *
 * @param fn - The effect function to run. Can return a cleanup function.
 * @param options - Optional configuration including debug label
 * @returns A dispose function to stop the effect and clean up.
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * const dispose = effect(() => {
 *   console.log('Count:', count()); // auto-subscribes
 * });
 *
 * count.set(1); // logs: "Count: 1"
 * dispose();    // stops the effect
 * count.set(2); // nothing logged
 *
 * // With debug label
 * effect(() => console.log(count()), { label: 'countLogger' });
 * ```
 */
export function effect(fn: EffectFn, options?: EffectOptions): DisposeFn {
  let disposed = false;
  let returnedCleanup: (() => void) | void;

  // Debug info
  const debugLabel = options?.label;
  const debugId = debugLabel ?? generateDebugId('effect');
  const isInternal = options?.__internal === true;

  const observer: Observer = {
    execute,
    cleanup,
    dependencies: new Set(),
    isEffect: true, // Mark as effect for proper scheduling
  };

  function execute(): void {
    if (disposed) return;

    // Clean up from previous run
    cleanup();

    // Clear old dependencies before re-running
    // (new dependencies will be collected during execution)
    for (const depSet of observer.dependencies) {
      // Find and remove our tagged subscriber
      for (const sub of depSet) {
        if (sub.fn === observer.execute) {
          depSet.delete(sub);
          break;
        }
      }
    }
    observer.dependencies.clear();

    // Push onto stack so signals know to subscribe us
    observerStack.push(observer);

    const startTime = performance.now();
    try {
      // Run the effect function
      returnedCleanup = fn();
    } finally {
      // Pop from stack
      observerStack.pop();
    }
    const duration = performance.now() - startTime;

    // Emit run event with dependency info (zero cost if debug not enabled, skip for internal)
    if (!isInternal) {
      const dependencyIds = collectDependencyIds(observer.dependencies);
      emitEffectRun(debugId, debugLabel, dependencyIds, duration);
    }
  }

  function cleanup(): void {
    // Run returned cleanup from last execution
    if (returnedCleanup) {
      returnedCleanup();
      returnedCleanup = undefined;
    }
    // Run any registered cleanups via onCleanup()
    runCleanups(observer);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;

    // Emit dispose event (zero cost if debug not enabled, skip for internal)
    if (!isInternal) {
      emitEffectDispose(debugId);
    }

    // Run all cleanups
    cleanup();

    // Remove from all signal subscriber sets
    for (const depSet of observer.dependencies) {
      for (const sub of depSet) {
        if (sub.fn === observer.execute) {
          depSet.delete(sub);
          break;
        }
      }
    }
    observer.dependencies.clear();
  }

  // Run immediately
  execute();

  return dispose;
}

/**
 * Collect debug IDs from dependencies.
 * This tries to find the signal's debug ID from its subscriber set.
 */
function collectDependencyIds(
  dependencies: Set<Set<TaggedSubscriber>>
): string[] {
  const ids: string[] = [];

  // We can't directly get the signal from its subscriber set,
  // but we track dependency count for debugging
  let depIndex = 0;
  for (const _depSet of dependencies) {
    ids.push(`dep_${depIndex++}`);
  }

  return ids;
}
