/**
 * LiteForge HMR Runtime - Component Registry Architecture
 *
 * Architecture:
 * 1. Every createComponent() call registers the definition in componentRegistry
 * 2. On Vite HMR, the module is re-evaluated → createComponent() runs again →
 *    registry is updated with the latest definition
 * 3. fullRerender() tears down and remounts the app; every factory reads the
 *    latest definition from the registry at call-time
 * 4. Stores survive (defineStore singleton registry)
 * 5. Router survives (singleton object captured in createApp closure)
 */

import type { ComponentDefinition } from './types.js';

// =============================================================================
// Types
// =============================================================================

/** HMR Handler interface */
export interface HMRHandler {
  /** Handle a module update from Vite */
  handleUpdate: (moduleUrl: string, newModule: Record<string, unknown> | null) => void;
  /** Full app re-render function (set by createApp) */
  fullRerender: (() => void) | null;
}

// =============================================================================
// Global State
// =============================================================================

declare global {
  interface Window {
    __LITEFORGE_HMR__?: HMRHandler;
    __LITEFORGE_HMR_TIMER__?: ReturnType<typeof setTimeout>;
    __LITEFORGE_HMR_COOLDOWN__?: ReturnType<typeof setTimeout>;
  }
  interface ImportMeta {
    env?: {
      DEV?: boolean;
      PROD?: boolean;
      MODE?: string;
    };
  }
}

/** Registry: hmrId → latest ComponentDefinition. Updated on every module re-evaluation. */
const componentRegistry = new Map<string, ComponentDefinition<Record<string, unknown>, unknown, unknown>>();


// =============================================================================
// Registry API
// =============================================================================

export function registerComponent(
  hmrId: string,
  definition: ComponentDefinition<Record<string, unknown>, unknown, unknown>
): void {
  componentRegistry.set(hmrId, definition);
}

export function getLatestDefinition(
  hmrId: string
): ComponentDefinition<Record<string, unknown>, unknown, unknown> | undefined {
  return componentRegistry.get(hmrId);
}

// =============================================================================
// HMR Handler
// =============================================================================

/**
 * Handle a module update from Vite.
 * At this point Vite has already re-evaluated the module, so createComponent()
 * has run and the registry already contains the latest definition.
 * We always trigger a full app re-render: stores + router are singletons and
 * survive, while all factories read fresh definitions from the registry.
 */
function handleHMRUpdate(moduleUrl: string, newModule: Record<string, unknown> | null): void {
  console.log('[LiteForge HMR] 🔄 Module updated:', moduleUrl);

  if (!newModule) {
    console.warn('[LiteForge HMR] No new module received, skipping update for:', moduleUrl);
    return;
  }

  // Walk exports to log what changed
  let hasComponents = false;
  for (const exportValue of Object.values(newModule)) {
    if (
      exportValue &&
      typeof exportValue === 'function' &&
      (exportValue as { __liteforge_component?: boolean }).__liteforge_component
    ) {
      hasComponents = true;
      break;
    }
  }

  if (hasComponents) {
    console.log(`[LiteForge HMR] 🧩 Component(s) updated in ${moduleUrl}`);
  } else {
    console.log(`[LiteForge HMR] ⚡ Non-component module updated: ${moduleUrl}`);
  }

  // Guard on window so state survives module re-evaluation.
  // Vite sends hot-update twice for the same file when it is accepted both
  // directly (self-accepting boundary) and by a parent module that also has
  // an HMR boundary. Block all updates while a rerender is already queued or
  // is in its post-render cooldown period.
  if (window.__LITEFORGE_HMR_TIMER__ !== undefined || window.__LITEFORGE_HMR_COOLDOWN__ !== undefined) {
    return;
  }

  window.__LITEFORGE_HMR_TIMER__ = setTimeout(() => {
    delete window.__LITEFORGE_HMR_TIMER__;
    const handler = window.__LITEFORGE_HMR__;
    if (handler?.fullRerender) {
      console.log('[LiteForge HMR] 🔄 Triggering full app re-render (stores + router preserved)...');
      handler.fullRerender();
    } else {
      console.warn('[LiteForge HMR] ⚠️ No fullRerender registered, skipping update');
    }
  }, 50);
}

// =============================================================================
// Init / Get
// =============================================================================

/**
 * Initialize the HMR handler.
 */
export function initHMR(): HMRHandler {
  if (typeof window === 'undefined') {
    // SSR environment
    return {
      handleUpdate: () => {},
      fullRerender: null,
    };
  }

  // Return existing handler if already initialized
  if (window.__LITEFORGE_HMR__) {
    return window.__LITEFORGE_HMR__;
  }

  const handler: HMRHandler = {
    handleUpdate: handleHMRUpdate,
    fullRerender: null,
  };

  window.__LITEFORGE_HMR__ = handler;
  console.log('[LiteForge HMR] 🔥 Component registry HMR initialized');

  return handler;
}

/**
 * Get the HMR handler.
 */
export function getHMRHandler(): HMRHandler | null {
  if (typeof window === 'undefined') return null;
  return window.__LITEFORGE_HMR__ ?? initHMR();
}

// Auto-initialize in development
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  initHMR();
}
