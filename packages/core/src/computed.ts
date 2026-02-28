/**
 * LiteForge Computed
 *
 * A Computed is a read-only signal derived from other signals.
 * It lazily evaluates and caches its value until dependencies change.
 */

import {
  type Observer,
  type TaggedSubscriber,
  observerStack,
  getCurrentObserver,
  notifySubscribers,
} from './internals.js';
import type { ReadonlySignal } from './signal.js';
import {
  generateDebugId,
  emitComputedRecalc,
} from './debug.js';

// ============================================================================
// Types
// ============================================================================

/** Function that computes the derived value */
export type ComputeFn<T> = () => T;

/** Options for creating a computed value. */
export interface ComputedOptions {
  /** Debug label for DevTools. If not provided, an auto-generated ID is used. */
  label?: string;
  /**
   * Mark computed as internal (DevTools-owned).
   * Internal computeds don't emit debug events to avoid infinite loops.
   * @internal
   */
  __internal?: boolean;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a computed (derived) signal.
 *
 * The computation only runs when the value is read AND dependencies have changed.
 * The result is cached until a dependency changes.
 *
 * @param fn - Function that computes the derived value
 * @param options - Optional configuration including debug label
 * @returns A read-only signal
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const doubled = computed(() => count() * 2);
 *
 * doubled(); // → 0 (computed on first read)
 * count.set(5);
 * doubled(); // → 10 (recomputed because count changed)
 * doubled(); // → 10 (cached, not recomputed)
 *
 * // With debug label
 * const tripled = computed(() => count() * 3, { label: 'tripled' });
 * ```
 */
export function computed<T>(
  fn: ComputeFn<T>,
  options?: ComputedOptions
): ReadonlySignal<T> {
  let value: T;
  let dirty = true; // Start dirty so first read computes

  // Debug info
  const debugLabel = options?.label;
  const debugId = debugLabel ?? generateDebugId('computed');
  const isInternal = options?.__internal === true;

  // Subscribers to this computed (other effects/computeds that read us)
  const subscribers: Set<TaggedSubscriber> = new Set();

  // Map from execute function to tagged subscriber (for efficient removal)
  const subscriberMap: Map<() => void, TaggedSubscriber> = new Map();

  // Track our own dependencies
  const observer: Observer = {
    execute: markDirty,
    cleanup: () => {}, // Computeds don't need cleanup
    dependencies: new Set(),
    isEffect: false, // Mark as computed for synchronous dirty propagation
  };

  /**
   * Mark as dirty and notify downstream subscribers.
   * Called when any upstream dependency changes.
   */
  function markDirty(): void {
    if (!dirty) {
      dirty = true;
      // Notify our subscribers that we might have changed
      // Computeds are notified synchronously, effects are scheduled
      notifySubscribers(subscribers);
    }
  }

  /**
   * Recompute the value if dirty.
   */
  function recompute(): void {
    // Clear old dependencies
    for (const depSet of observer.dependencies) {
      for (const sub of depSet) {
        if (sub.fn === observer.execute) {
          depSet.delete(sub);
          break;
        }
      }
    }
    observer.dependencies.clear();

    // Track new dependencies during computation
    observerStack.push(observer);
    const startTime = performance.now();
    try {
      value = fn();
    } finally {
      observerStack.pop();
    }
    const duration = performance.now() - startTime;

    // Emit recalc event (zero cost if debug not enabled, skip for internal)
    if (!isInternal) {
      emitComputedRecalc(debugId, debugLabel, value, duration);
    }

    dirty = false;
  }

  /**
   * Read the computed value.
   */
  function read(): T {
    // Subscribe the current observer to this computed
    const currentObserver = getCurrentObserver();
    if (currentObserver) {
      let taggedSub = subscriberMap.get(currentObserver.execute);
      if (!taggedSub) {
        taggedSub = {
          fn: currentObserver.execute,
          isEffect: currentObserver.isEffect,
        };
        subscriberMap.set(currentObserver.execute, taggedSub);
      }
      subscribers.add(taggedSub);
      currentObserver.dependencies.add(subscribers);
    }

    // Recompute if necessary
    if (dirty) {
      recompute();
    }

    return value;
  }

  /**
   * Peek at the value without subscribing.
   */
  function peek(): T {
    if (dirty) {
      recompute();
    }
    return value;
  }

  // Attach peek method
  read.peek = peek;

  // Attach debug info (read-only)
  Object.defineProperty(read, '__debugId', {
    value: debugId,
    writable: false,
    enumerable: false,
  });
  Object.defineProperty(read, '__debugLabel', {
    value: debugLabel,
    writable: false,
    enumerable: false,
  });

  return read as ReadonlySignal<T>;
}
