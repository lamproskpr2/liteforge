/**
 * @liteforge/devtools
 *
 * DevTools panel for debugging LiteForge applications.
 */

// Plugin
export { devtoolsPlugin, createDevTools } from './plugin.js';

// Types from plugin (time-travel related)
export type {
  DevToolsStore,
  DevToolsStoreMap,
  StandaloneDevToolsConfig,
} from './plugin.js';

// Types
export type {
  DevToolsConfig,
  ResolvedDevToolsConfig,
  DevToolsInstance,
  DevToolsApi,
  SignalGetter,
  PanelPosition,
  TabId,
  PanelState,
  EventBuffer,
  StoredEvent,
  SignalInfo,
  StoreInfo,
  StoreHistoryEntry,
  NavigationInfo,
  ComponentInfo,
  PerformanceCounters,
} from './types.js';

// Buffer (for advanced usage)
export { createEventBuffer } from './buffer.js';
