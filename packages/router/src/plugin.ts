/**
 * @liteforge/router — routerPlugin
 *
 * Wraps a Router instance (or RouterOptions) as a formal LiteForgePlugin.
 * Registers the router under the 'router' key in the app context and
 * triggers initial navigation as part of the plugin lifecycle.
 */

import type { LiteForgePlugin, PluginContext } from '@liteforge/runtime';
import type { Router, RouterOptions } from './types.js';
import { createRouter } from './router.js';

function isRouter(input: RouterOptions | Router): input is Router {
  return 'navigate' in input && typeof (input as unknown as Record<string, unknown>).navigate === 'function';
}

/**
 * Create a router plugin from either:
 * - `RouterOptions` — the plugin creates a router internally
 * - An existing `Router` instance — for cases where the router is built externally
 *   (e.g. `createAppRouter()` factory that registers guards/middleware)
 */
export function routerPlugin(optionsOrRouter: RouterOptions | Router): LiteForgePlugin {
  const router = isRouter(optionsOrRouter)
    ? optionsOrRouter
    : createRouter(optionsOrRouter);

  return {
    name: 'router',
    install(context: PluginContext): () => void {
      context.provide('router', router);

      // Trigger initial navigation so route guards + components resolve.
      // createRouter already syncs state, but navigate() runs middleware/guards.
      void router.navigate(router.location().href);

      return () => {
        router.destroy();
      };
    },
  };
}

declare module '@liteforge/runtime' {
  interface PluginRegistry {
    router: Router;
  }
}
