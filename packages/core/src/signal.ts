/**
 * LiteForge Signal
 *
 * A Signal is a reactive primitive that holds a value.
 * Reading a signal inside an effect automatically subscribes to changes.
 * Writing to a signal notifies all subscribers.
 */

import {
  type TaggedSubscriber,
  getCurrentObserver,
  notifySubscribers,
  startBatch,
  endBatch,
} from './internals.js';
import {
  generateDebugId,
  emitSignalCreate,
  emitSignalUpdate,
} from './debug.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a signal.
 */
export interface SignalOptions {
  /** Debug label for DevTools. If not provided, an auto-generated ID is used. */
  label?: string;
  /**
   * Mark signal as internal (DevTools-owned).
   * Internal signals don't emit debug events to avoid infinite loops.
   * @internal
   */
  __internal?: boolean;
}

/**
 * A Signal is a callable function (getter) with set/update methods.
 */
export interface Signal<T> {
  /** Read the current value. Auto-subscribes active observers. */
  (): T;
  /** Set a new value. Notifies subscribers if value changed. */
  set(value: T): void;
  /** Update value using a function. Notifies subscribers if value changed. */
  update(fn: (current: T) => T): void;
  /** Peek at the value without subscribing. */
  peek(): T;
  /** Debug ID for DevTools. */
  readonly __debugId: string;
  /** Debug label for DevTools. */
  readonly __debugLabel: string | undefined;
}

/**
 * Read-only signal interface (used by computed).
 */
export interface ReadonlySignal<T> {
  /** Read the current value. Auto-subscribes active observers. */
  (): T;
  /** Peek at the value without subscribing. */
  peek(): T;
  /** Debug ID for DevTools. */
  readonly __debugId: string;
  /** Debug label for DevTools. */
  readonly __debugLabel: string | undefined;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a new reactive signal.
 *
 * @param initialValue - The initial value of the signal
 * @param options - Optional configuration including debug label
 * @returns A signal that can be read, set, and updated
 *
 * @example
 * ```ts
 * const count = signal(0);
 * count();                    // read → 0
 * count.set(5);               // write
 * count.update(n => n + 1);   // update → 6
 *
 * // With debug label
 * const name = signal('John', { label: 'userName' });
 * ```
 */
export function signal<T>(initialValue: T, options?: SignalOptions): Signal<T> {
  let value = initialValue;

  // Debug info
  const debugLabel = options?.label;
  const debugId = debugLabel ?? generateDebugId('signal');
  const isInternal = options?.__internal === true;

  // Set of tagged subscribers to call when value changes
  const subscribers: Set<TaggedSubscriber> = new Set();

  // Map from execute function to tagged subscriber (for efficient removal)
  const subscriberMap: Map<() => void, TaggedSubscriber> = new Map();

  // Emit creation event (zero cost if debug not enabled, skip for internal signals)
  if (!isInternal) {
    emitSignalCreate(debugId, debugLabel, initialValue);
  }

  // The getter function - also serves as the signal itself
  const read = (): T => {
    // If there's an active observer, subscribe it
    const observer = getCurrentObserver();
    if (observer) {
      let taggedSub = subscriberMap.get(observer.execute);
      if (!taggedSub) {
        taggedSub = { fn: observer.execute, isEffect: observer.isEffect };
        subscriberMap.set(observer.execute, taggedSub);
      }
      subscribers.add(taggedSub);
      // Track this subscription for cleanup
      observer.dependencies.add(subscribers);
    }
    return value;
  };

  // Set a new value
  const set = (newValue: T): void => {
    // Only notify if value actually changed
    if (!Object.is(value, newValue)) {
      const oldValue = value;
      value = newValue;

      // Emit update event (zero cost if debug not enabled, skip for internal signals)
      if (!isInternal) {
        emitSignalUpdate(debugId, debugLabel, oldValue, newValue);
      }

      // Wrap in implicit batch to handle diamond dependencies properly
      startBatch();
      try {
        notifySubscribers(subscribers);
      } finally {
        endBatch();
      }
    }
  };

  // Update using a function
  const update = (fn: (current: T) => T): void => {
    set(fn(value));
  };

  // Peek without subscribing
  const peek = (): T => value;

  // Attach methods to the getter function
  read.set = set;
  read.update = update;
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

  return read as Signal<T>;
}
