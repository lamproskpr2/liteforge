/**
 * LiteForge Store Plugins
 *
 * Plugin system for extending store functionality.
 */

import type { StorePlugin } from './types.js';

// ============================================================================
// Plugin Factory
// ============================================================================

/**
 * Define a store plugin.
 *
 * Plugins can hook into store lifecycle events:
 * - onInit: Called when a store is created/registered
 * - onStateChange: Called when any watched state changes
 * - onReset: Called when a store is reset
 *
 * @param plugin - Plugin definition
 * @returns The plugin (for chaining)
 *
 * @example
 * ```ts
 * const loggerPlugin = defineStorePlugin({
 *   name: 'logger',
 *   onStateChange(storeName, key, newVal, oldVal) {
 *     console.log(`[${storeName}] ${key}:`, oldVal, '→', newVal);
 *   },
 * });
 *
 * storeRegistry.use(loggerPlugin);
 * ```
 */
export function defineStorePlugin(plugin: StorePlugin): StorePlugin {
  // Validate plugin
  if (!plugin.name) {
    throw new Error('Plugin must have a name');
  }

  return plugin;
}
