/**
 * LiteForge Store Registry
 *
 * Singleton registry that all stores auto-register with.
 * Enables global state inspection, serialization, and plugin management.
 */

import { effect } from '@liteforge/core';
import type {
  StoreRegistry,
  StoreInternal,
  StoreInspection,
  StorePlugin,
  GlobalChangeCallback,
  StateDefinition,
  GettersDefinition,
  ActionsDefinition,
  Store,
  SignalifiedState,
} from './types.js';

// ============================================================================
// Registry Implementation
// ============================================================================

/**
 * Create the store registry singleton.
 */
function createStoreRegistry(): StoreRegistry {
  // Internal store map
  const stores = new Map<string, StoreInternal>();

  // Registered plugins
  const plugins: StorePlugin[] = [];

  // Global change listeners
  const globalListeners = new Set<GlobalChangeCallback>();

  // Track subscriber count per store (for inspection)
  const subscriberCounts = new Map<string, number>();

  // Track cleanup functions for store watchers
  const storeWatcherCleanups = new Map<string, () => void>();

  /**
   * Set up watchers for a store's state to notify plugins and global listeners.
   */
  function setupStoreWatchers(name: string, store: StoreInternal): void {
    const state = store.$getState();
    const cleanups: Array<() => void> = [];

    // Watch each state property
    for (const key of Object.keys(state)) {
      let previousValue: unknown;
      let isFirstRun = true;

      const cleanup = effect(() => {
        const signal = state[key];
        if (signal) {
          const currentValue = signal();

          if (!isFirstRun) {
            // Notify global listeners
            for (const listener of globalListeners) {
              listener(name, key, currentValue, previousValue);
            }

            // Notify plugins
            notifyPluginsOfChange(name, key, currentValue, previousValue);
          }

          previousValue = currentValue;
          isFirstRun = false;
        }
      });

      cleanups.push(cleanup);
    }

    // Store cleanup function
    storeWatcherCleanups.set(name, () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  }

  /**
   * Notify applicable plugins of a state change.
   */
  function notifyPluginsOfChange(
    storeName: string,
    key: string,
    newValue: unknown,
    oldValue: unknown
  ): void {
    for (const plugin of plugins) {
      // Check if plugin applies to this store
      if (plugin.stores && !plugin.stores.includes(storeName)) {
        continue;
      }

      // Check if plugin includes this key
      if (plugin.include) {
        const storeKeys = plugin.include[storeName];
        if (storeKeys && !storeKeys.includes(key)) {
          continue;
        }
      }

      // Call plugin handler
      plugin.onStateChange?.(storeName, key, newValue, oldValue);
    }
  }

  /**
   * Notify applicable plugins that a store was reset.
   */
  function notifyPluginsOfReset(storeName: string): void {
    for (const plugin of plugins) {
      // Check if plugin applies to this store
      if (plugin.stores && !plugin.stores.includes(storeName)) {
        continue;
      }

      plugin.onReset?.(storeName);
    }
  }

  /**
   * Initialize plugins for a newly registered store.
   */
  function initializePluginsForStore(name: string, store: StoreInternal): void {
    const state = store.$getState() as SignalifiedState<StateDefinition>;

    for (const plugin of plugins) {
      // Check if plugin applies to this store
      if (plugin.stores && !plugin.stores.includes(name)) {
        continue;
      }

      plugin.onInit?.(name, state);
    }
  }

  // ========================================
  // Public API
  // ========================================

  function register<
    S extends StateDefinition,
    G extends GettersDefinition,
    A extends ActionsDefinition,
  >(name: string, store: StoreInternal<S, G, A>): StoreInternal<S, G, A> | null {
    // Singleton semantics: if store already exists, return it
    const existing = stores.get(name);
    if (existing) {
      // Development warning (Vite sets import.meta.env.DEV)
      if (typeof globalThis !== 'undefined' && 
          (globalThis as { __DEV__?: boolean }).__DEV__ !== false) {
        console.warn(
          `[LiteForge] Store "${name}" already defined. Returning existing instance.`
        );
      }
      return existing as StoreInternal<S, G, A>;
    }

    stores.set(name, store as StoreInternal);
    subscriberCounts.set(name, 0);

    // Set up watchers for this store
    setupStoreWatchers(name, store as StoreInternal);

    // Initialize plugins for this store
    initializePluginsForStore(name, store as StoreInternal);

    return null; // null means new store was created
  }

  function unregister(name: string): void {
    // Clean up watchers
    const cleanup = storeWatcherCleanups.get(name);
    if (cleanup) {
      cleanup();
      storeWatcherCleanups.delete(name);
    }

    stores.delete(name);
    subscriberCounts.delete(name);
  }

  function clear(): void {
    // Clean up all watchers
    for (const cleanup of storeWatcherCleanups.values()) {
      cleanup();
    }
    storeWatcherCleanups.clear();

    stores.clear();
    subscriberCounts.clear();
  }

  function get<
    S extends StateDefinition,
    G extends GettersDefinition,
    A extends ActionsDefinition,
  >(name: string): Store<S, G, A> | undefined {
    return stores.get(name) as Store<S, G, A> | undefined;
  }

  function list(): string[] {
    return Array.from(stores.keys());
  }

  function snapshot(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};

    for (const [name, store] of stores) {
      result[name] = store.$snapshot();
    }

    return result;
  }

  function inspect(name: string): StoreInspection | undefined {
    const store = stores.get(name);
    if (!store) {
      return undefined;
    }

    // Get current getter values
    const getterNames = store.$getGetterNames();
    const getters: Record<string, unknown> = {};
    // Access store properties dynamically - safe cast through unknown
    const storeObj = store as unknown as Record<string, unknown>;
    for (const getterName of getterNames) {
      const getter = storeObj[getterName];
      if (typeof getter === 'function') {
        try {
          // Only call no-arg getters for inspection
          if ((getter as (...args: unknown[]) => unknown).length === 0) {
            getters[getterName] = (getter as () => unknown)();
          } else {
            getters[getterName] = '[function with args]';
          }
        } catch {
          getters[getterName] = '[error]';
        }
      }
    }

    return {
      name,
      state: store.$snapshot(),
      getters,
      actions: store.$getActionNames(),
      subscriberCount: subscriberCounts.get(name) ?? 0,
    };
  }

  function onAnyChange(callback: GlobalChangeCallback): () => void {
    globalListeners.add(callback);

    // Increment subscriber counts
    for (const name of stores.keys()) {
      const count = subscriberCounts.get(name) ?? 0;
      subscriberCounts.set(name, count + 1);
    }

    return () => {
      globalListeners.delete(callback);

      // Decrement subscriber counts
      for (const name of stores.keys()) {
        const count = subscriberCounts.get(name) ?? 0;
        subscriberCounts.set(name, Math.max(0, count - 1));
      }
    };
  }

  function reset(name: string): void {
    const store = stores.get(name);
    if (store) {
      store.$reset();
      notifyPluginsOfReset(name);
    }
  }

  function resetAll(): void {
    for (const [name, store] of stores) {
      store.$reset();
      notifyPluginsOfReset(name);
    }
  }

  function serialize(): string {
    return JSON.stringify(snapshot());
  }

  function hydrate(json: string): void {
    const data = JSON.parse(json) as Record<string, Record<string, unknown>>;

    for (const [storeName, storeData] of Object.entries(data)) {
      const store = stores.get(storeName);
      if (store) {
        const state = store.$getState();
        for (const [key, value] of Object.entries(storeData)) {
          const signal = state[key];
          if (signal) {
            // Value from JSON is already a valid StateValue (primitive, array, or object)
            signal.set(value as typeof signal extends { set: (v: infer V) => void } ? V : never);
          }
        }
      }
    }
  }

  function use(plugin: StorePlugin): void {
    plugins.push(plugin);

    // Initialize plugin for all existing stores
    for (const [name, store] of stores) {
      // Check if plugin applies to this store
      if (plugin.stores && !plugin.stores.includes(name)) {
        continue;
      }

      const state = store.$getState() as SignalifiedState<StateDefinition>;
      plugin.onInit?.(name, state);
    }
  }

  function $notifyChange(
    storeName: string,
    key: string,
    newValue: unknown,
    oldValue: unknown
  ): void {
    // Notify global listeners
    for (const listener of globalListeners) {
      listener(storeName, key, newValue, oldValue);
    }

    // Notify plugins
    notifyPluginsOfChange(storeName, key, newValue, oldValue);
  }

  function $notifyReset(storeName: string): void {
    notifyPluginsOfReset(storeName);
  }

  function $getPlugins(): StorePlugin[] {
    return [...plugins];
  }

  function $clearPlugins(): void {
    plugins.length = 0;
  }

  return {
    register,
    unregister,
    clear,
    get,
    list,
    snapshot,
    inspect,
    onAnyChange,
    reset,
    resetAll,
    serialize,
    hydrate,
    use,
    $notifyChange,
    $notifyReset,
    $getPlugins,
    $clearPlugins,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global store registry singleton.
 * All stores auto-register here when created.
 */
export const storeRegistry = createStoreRegistry();
