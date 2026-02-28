/**
 * @liteforge/store
 *
 * State management built on signals.
 */

// ============================================================================
// Core API
// ============================================================================

export { defineStore } from './define-store.js';
export { storeRegistry } from './registry.js';
export { defineStorePlugin } from './plugins.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Store types
  Store,
  StoreDefinition,
  StoreInternal,
  StoreInternalMethods,
  StoreMetadata,
  StoreInspection,

  // State types
  StateDefinition,
  StateValue,
  SignalifiedState,

  // Getter types
  GetterFn,
  GettersDefinition,
  GettersFactory,

  // Action types
  ActionFn,
  ActionsDefinition,
  ActionsFactory,

  // Plugin types
  StorePlugin,

  // Registry types
  StoreRegistry,
  GlobalChangeCallback,

  // Callback types
  WatchCallback,
  OnChangeCallback,

  // Context types
  UseFn,

  // Utility types
  ExtractState,
  ExtractGetters,
  ExtractActions,
} from './types.js';
