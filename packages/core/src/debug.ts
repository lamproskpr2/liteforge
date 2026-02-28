/**
 * LiteForge Debug Bus
 *
 * A lightweight event bus for DevTools integration.
 * Zero cost when not enabled - all emit calls check a single property.
 */

// ============================================================================
// Debug Event Types — Discriminated Union for Type Safety
// ============================================================================

export interface SignalCreatePayload {
  id: string;
  label: string | undefined;
  initialValue: unknown;
  timestamp: number;
}

export interface SignalUpdatePayload {
  id: string;
  label: string | undefined;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface EffectRunPayload {
  id: string;
  label: string | undefined;
  dependencies: string[];
  duration: number;
  timestamp: number;
}

export interface EffectDisposePayload {
  id: string;
  timestamp: number;
}

export interface ComputedRecalcPayload {
  id: string;
  label: string | undefined;
  value: unknown;
  duration: number;
  timestamp: number;
}

export interface StoreCreatePayload {
  id: string;
  initialState: Record<string, unknown>;
  timestamp: number;
}

export interface StoreStateChangePayload {
  storeId: string;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export interface StoreActionPayload {
  storeId: string;
  action: string;
  args: unknown[];
  timestamp: number;
}

export interface NavigationStartPayload {
  from: string;
  to: string;
  timestamp: number;
}

export interface NavigationEndPayload {
  from: string;
  to: string;
  duration: number;
  guardResults: Array<{ name: string; allowed: boolean }>;
  timestamp: number;
}

export interface GuardRunPayload {
  name: string;
  route: string;
  result: boolean;
  duration: number;
  timestamp: number;
}

export interface ComponentMountPayload {
  id: string;
  name: string;
  parent: string | undefined;
  timestamp: number;
}

export interface ComponentUnmountPayload {
  id: string;
  name: string;
  timestamp: number;
}

/**
 * Discriminated union of all debug events.
 * This ensures type safety when handling events.
 */
export type DebugEvent =
  | { type: 'signal:create'; payload: SignalCreatePayload }
  | { type: 'signal:update'; payload: SignalUpdatePayload }
  | { type: 'effect:run'; payload: EffectRunPayload }
  | { type: 'effect:dispose'; payload: EffectDisposePayload }
  | { type: 'computed:recalc'; payload: ComputedRecalcPayload }
  | { type: 'store:create'; payload: StoreCreatePayload }
  | { type: 'store:stateChange'; payload: StoreStateChangePayload }
  | { type: 'store:action'; payload: StoreActionPayload }
  | { type: 'nav:start'; payload: NavigationStartPayload }
  | { type: 'nav:end'; payload: NavigationEndPayload }
  | { type: 'guard:run'; payload: GuardRunPayload }
  | { type: 'component:mount'; payload: ComponentMountPayload }
  | { type: 'component:unmount'; payload: ComponentUnmountPayload };

/**
 * Extract event type strings.
 */
export type DebugEventType = DebugEvent['type'];

/**
 * Extract payload type for a given event type.
 */
export type PayloadFor<T extends DebugEventType> = Extract<
  DebugEvent,
  { type: T }
>['payload'];

// ============================================================================
// Debug Bus Interface
// ============================================================================

/**
 * Callback type for event listeners.
 */
export type DebugEventCallback<T extends DebugEventType> = (
  payload: PayloadFor<T>
) => void;

/**
 * Unsubscribe function returned by event listeners.
 */
export type Unsubscribe = () => void;

/**
 * The debug bus interface.
 */
export interface DebugBus {
  /**
   * Subscribe to a debug event type.
   * Returns an unsubscribe function.
   */
  on<T extends DebugEventType>(
    type: T,
    callback: DebugEventCallback<T>
  ): Unsubscribe;

  /**
   * Emit a debug event to all subscribers.
   */
  emit<T extends DebugEventType>(type: T, payload: PayloadFor<T>): void;

  /**
   * Dispose the debug bus and clear all subscriptions.
   */
  dispose(): void;

  /**
   * Get the current auto-incrementing ID counter (for debugging).
   */
  getIdCounter(): number;
}

// ============================================================================
// Global Type Declaration
// ============================================================================

/**
 * Extend globalThis to include our debug bus.
 */
declare global {
  // eslint-disable-next-line no-var
  var __LITEFORGE_DEBUG__: DebugBus | undefined;
}

// ============================================================================
// ID Generation
// ============================================================================

let idCounter = 0;

/**
 * Generate a unique ID for signals, effects, and computed values.
 * Used when no label is provided.
 */
export function generateDebugId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

/**
 * Reset the ID counter (for testing).
 */
export function resetDebugIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// Debug Bus Implementation
// ============================================================================

/**
 * Typed event map — each key maps to its specific callback type.
 * This enables fully type-safe event handling without any casts.
 */
type DebugEventMap = {
  [K in DebugEventType]: (payload: PayloadFor<K>) => void;
};

/**
 * Create a new debug bus instance.
 * This is called by enableDebug() to initialize the global bus.
 */
export function createDebugBus(): DebugBus {
  // Typed listeners object — TypeScript knows each key's callback type
  type ListenersStore = { [K in keyof DebugEventMap]?: Array<DebugEventMap[K]> };
  let listeners: ListenersStore = {};

  function on<K extends keyof DebugEventMap>(
    type: K,
    callback: DebugEventMap[K]
  ): Unsubscribe {
    let list = listeners[type];
    if (!list) {
      list = [];
      listeners[type] = list;
    }
    list.push(callback);

    return () => {
      const idx = list.indexOf(callback);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  function emit<K extends keyof DebugEventMap>(
    type: K,
    payload: PayloadFor<K>
  ): void {
    const list = listeners[type];
    if (!list) return;

    for (const callback of list) {
      try {
        callback(payload);
      } catch (error) {
        // Don't let debug callbacks crash the app
        console.error('[LiteForge DevTools] Error in debug callback:', error);
      }
    }
  }

  function dispose(): void {
    // Reset to empty object — no iteration needed
    listeners = {};
  }

  function getIdCounter(): number {
    return idCounter;
  }

  return {
    on,
    emit,
    dispose,
    getIdCounter,
  };
}

// ============================================================================
// Enable/Disable Debug Mode
// ============================================================================

/**
 * Enable debug mode by creating the global debug bus.
 * Called by the DevTools plugin during initialization.
 *
 * @returns The debug bus instance
 */
export function enableDebug(): DebugBus {
  if (!globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__ = createDebugBus();
  }
  return globalThis.__LITEFORGE_DEBUG__;
}

/**
 * Disable debug mode by removing the global debug bus.
 * Called when DevTools are disabled or app is unmounted.
 */
export function disableDebug(): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.dispose();
    globalThis.__LITEFORGE_DEBUG__ = undefined;
  }
}

/**
 * Check if debug mode is enabled.
 */
export function isDebugEnabled(): boolean {
  return globalThis.__LITEFORGE_DEBUG__ !== undefined;
}

// ============================================================================
// Emit Helpers — Zero Cost When Disabled
// ============================================================================

/**
 * Emit a signal:create event if debug is enabled.
 */
export function emitSignalCreate(
  id: string,
  label: string | undefined,
  initialValue: unknown
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('signal:create', {
      id,
      label,
      initialValue,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a signal:update event if debug is enabled.
 */
export function emitSignalUpdate(
  id: string,
  label: string | undefined,
  oldValue: unknown,
  newValue: unknown
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('signal:update', {
      id,
      label,
      oldValue,
      newValue,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit an effect:run event if debug is enabled.
 */
export function emitEffectRun(
  id: string,
  label: string | undefined,
  dependencies: string[],
  duration: number
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('effect:run', {
      id,
      label,
      dependencies,
      duration,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit an effect:dispose event if debug is enabled.
 */
export function emitEffectDispose(id: string): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('effect:dispose', {
      id,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a computed:recalc event if debug is enabled.
 */
export function emitComputedRecalc(
  id: string,
  label: string | undefined,
  value: unknown,
  duration: number
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('computed:recalc', {
      id,
      label,
      value,
      duration,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a store:create event if debug is enabled.
 */
export function emitStoreCreate(
  id: string,
  initialState: Record<string, unknown>
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('store:create', {
      id,
      initialState,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a store:stateChange event if debug is enabled.
 */
export function emitStoreStateChange(
  storeId: string,
  key: string,
  oldValue: unknown,
  newValue: unknown
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('store:stateChange', {
      storeId,
      key,
      oldValue,
      newValue,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a store:action event if debug is enabled.
 */
export function emitStoreAction(
  storeId: string,
  action: string,
  args: unknown[]
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('store:action', {
      storeId,
      action,
      args,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a nav:start event if debug is enabled.
 */
export function emitNavigationStart(from: string, to: string): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('nav:start', {
      from,
      to,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a nav:end event if debug is enabled.
 */
export function emitNavigationEnd(
  from: string,
  to: string,
  duration: number,
  guardResults: Array<{ name: string; allowed: boolean }>
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('nav:end', {
      from,
      to,
      duration,
      guardResults,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a guard:run event if debug is enabled.
 */
export function emitGuardRun(
  name: string,
  route: string,
  result: boolean,
  duration: number
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('guard:run', {
      name,
      route,
      result,
      duration,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a component:mount event if debug is enabled.
 */
export function emitComponentMount(
  id: string,
  name: string,
  parent: string | undefined
): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('component:mount', {
      id,
      name,
      parent,
      timestamp: performance.now(),
    });
  }
}

/**
 * Emit a component:unmount event if debug is enabled.
 */
export function emitComponentUnmount(id: string, name: string): void {
  if (globalThis.__LITEFORGE_DEBUG__) {
    globalThis.__LITEFORGE_DEBUG__.emit('component:unmount', {
      id,
      name,
      timestamp: performance.now(),
    });
  }
}
