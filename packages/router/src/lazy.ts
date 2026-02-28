import type { 
  RouteComponent, 
  LazyComponent, 
  LazyImportFn,
  RouteLazyConfig,
  LazyDefaults,
} from './types.js';

// =============================================================================
// Lazy Loading
// =============================================================================

/**
 * Options for lazy component loading
 */
export interface LazyOptions {
  /** Custom loading component shown while loading */
  loading?: () => Node;
  /** Custom error component shown on failure */
  error?: (error: Error, retry: () => void) => Node;
  /** Timeout in milliseconds before showing error (0 = no timeout) */
  timeout?: number;
  /** 
   * Delay in milliseconds before showing loading state (default: 200).
   * If the component loads before this threshold, loading state is never shown.
   * Set to 0 to show loading state immediately.
   */
  delay?: number;
  /** Minimum time to show loading state (prevents flash) */
  minLoadTime?: number;
  /** Whether to prefetch the component immediately */
  prefetch?: boolean;
}

/**
 * State of a lazy component
 */
type LazyState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; component: RouteComponent }
  | { status: 'error'; error: Error };

/**
 * Create a lazy-loaded component
 * 
 * The returned function acts as a LazyComponent that can be used in route definitions.
 * It provides caching, error handling, and prefetching capabilities.
 * 
 * @example
 * ```ts
 * // Basic usage
 * const LazyDashboard = lazy(() => import('./pages/Dashboard'));
 * 
 * // With options
 * const LazySettings = lazy(
 *   () => import('./pages/Settings'),
 *   {
 *     loading: () => document.createTextNode('Loading settings...'),
 *     timeout: 5000,
 *   }
 * );
 * 
 * // In route definition
 * const routes = [
 *   { path: '/dashboard', component: LazyDashboard },
 *   { path: '/settings', component: LazySettings },
 * ];
 * 
 * // Prefetch component
 * LazyDashboard.prefetch();
 * ```
 */
export function lazy(
  loader: () => Promise<{ default: RouteComponent } | RouteComponent>,
  options: LazyOptions = {}
): LazyComponent & {
  prefetch: () => Promise<void>;
  isLoaded: () => boolean;
  getLoaded: () => RouteComponent | undefined;
  reset: () => void;
} {
  const state: { current: LazyState } = { current: { status: 'idle' } };
  let loadPromise: Promise<{ default: RouteComponent } | RouteComponent> | null = null;

  /**
   * Load the component with caching
   */
  async function load(): Promise<{ default: RouteComponent } | RouteComponent> {
    // Return cached if already loaded
    if (state.current.status === 'loaded') {
      return { default: state.current.component };
    }

    // Return existing promise if already loading
    if (loadPromise) {
      return loadPromise;
    }

    state.current = { status: 'loading' };

    // Track timing for minLoadTime
    const startTime = Date.now();

    // Create the loading promise with optional timeout
    const timeoutPromise = options.timeout && options.timeout > 0
      ? new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Lazy component load timed out after ${options.timeout}ms`)), options.timeout)
        )
      : null;

    loadPromise = (async () => {
      try {
        // Race against timeout if specified
        const result = timeoutPromise 
          ? await Promise.race([loader(), timeoutPromise])
          : await loader();

        // Enforce minimum load time to prevent flash
        if (options.minLoadTime && options.minLoadTime > 0) {
          const elapsed = Date.now() - startTime;
          const remaining = options.minLoadTime - elapsed;
          if (remaining > 0) {
            await new Promise(resolve => setTimeout(resolve, remaining));
          }
        }

        // Extract component from result
        const component = 'default' in result ? result.default : result;
        state.current = { status: 'loaded', component };
        
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        state.current = { status: 'error', error: err };
        loadPromise = null; // Allow retry
        throw err;
      }
    })();

    return loadPromise;
  }

  /**
   * Prefetch the component without rendering
   */
  async function prefetch(): Promise<void> {
    try {
      await load();
    } catch {
      // Silently ignore prefetch errors
    }
  }

  /**
   * Check if component is loaded
   */
  function isLoaded(): boolean {
    return state.current.status === 'loaded';
  }

  /**
   * Get the loaded component synchronously.
   * Returns undefined if not loaded yet.
   * This avoids the microtask delay of using .then() on a resolved Promise.
   */
  function getLoaded(): RouteComponent | undefined {
    if (state.current.status === 'loaded') {
      return state.current.component;
    }
    return undefined;
  }

  /**
   * Reset state to idle (for retry)
   */
  function reset(): void {
    state.current = { status: 'idle' };
    loadPromise = null;
  }

  // Trigger prefetch immediately if requested
  if (options.prefetch) {
    // Use setTimeout to avoid blocking
    setTimeout(prefetch, 0);
  }

  // Return function that acts as LazyComponent
  const wrapper = load as LazyComponent & {
    prefetch: () => Promise<void>;
    isLoaded: () => boolean;
    getLoaded: () => RouteComponent | undefined;
    reset: () => void;
    __lazyState: LazyState;
    __loader: typeof loader;
    __options: LazyOptions;
  };

  wrapper.prefetch = prefetch;
  wrapper.isLoaded = isLoaded;
  wrapper.getLoaded = getLoaded;
  wrapper.reset = reset;

  // Expose internal state for debugging/testing
  Object.defineProperty(wrapper, '__lazyState', {
    get: () => state.current,
    enumerable: false,
  });
  Object.defineProperty(wrapper, '__loader', {
    value: loader,
    enumerable: false,
  });
  Object.defineProperty(wrapper, '__options', {
    value: options,
    enumerable: false,
  });

  return wrapper;
}

// =============================================================================
// Prefetching Utilities
// =============================================================================

/**
 * Prefetch multiple lazy components
 * 
 * @example
 * ```ts
 * // Prefetch all admin pages
 * prefetchAll([LazyAdminDashboard, LazyAdminUsers, LazyAdminSettings]);
 * ```
 */
export async function prefetchAll(
  components: Array<LazyComponent & { prefetch?: () => Promise<void> }>
): Promise<void> {
  await Promise.all(
    components.map(component => {
      if ('prefetch' in component && typeof component.prefetch === 'function') {
        return component.prefetch();
      }
      // For plain LazyComponent, just call it to trigger load
      return component().catch(() => {/* ignore */});
    })
  );
}

/**
 * Extended lazy component with utility methods
 */
export interface LazyComponentWithMethods {
  /** Call the lazy loader to get the component */
  (): Promise<{ default: RouteComponent } | RouteComponent>;
  /** Prefetch the component */
  prefetch: () => Promise<void>;
  /** Check if the component is loaded */
  isLoaded: () => boolean;
  /** Get the loaded component synchronously (undefined if not loaded) */
  getLoaded: () => RouteComponent | undefined;
  /** Reset the lazy component state */
  reset: () => void;
  /** Internal: options passed to lazy() */
  readonly __options?: LazyOptions;
}

/**
 * Check if a component is a lazy component
 */
export function isLazyComponent(
  component: unknown
): component is LazyComponentWithMethods {
  return (
    typeof component === 'function' &&
    'prefetch' in component &&
    'isLoaded' in component &&
    'reset' in component
  );
}

/**
 * Get the delay option from a lazy component (default: 200ms)
 */
export function getLazyDelay(component: LazyComponentWithMethods): number {
  const options = component.__options;
  return options?.delay ?? 200;
}

/**
 * Get the loading component from a lazy component
 */
export function getLazyLoading(component: LazyComponentWithMethods): (() => Node) | undefined {
  return component.__options?.loading;
}

/**
 * Get the error component from a lazy component
 */
export function getLazyError(component: LazyComponentWithMethods): ((error: Error, retry: () => void) => Node) | undefined {
  return component.__options?.error;
}

// =============================================================================
// Preload Link Helpers
// =============================================================================

/**
 * Create a preload function that prefetches lazy components on link hover
 * 
 * @example
 * ```ts
 * const preloadOnHover = createPreloadOnHover({
 *   '/dashboard': LazyDashboard,
 *   '/settings': LazySettings,
 * });
 * 
 * // Attach to link element
 * linkElement.addEventListener('mouseenter', () => preloadOnHover('/dashboard'));
 * ```
 */
export function createPreloadOnHover(
  componentMap: Record<string, LazyComponent & { prefetch?: () => Promise<void> }>
): (path: string) => void {
  const prefetched = new Set<string>();

  return (path: string) => {
    // Already prefetched
    if (prefetched.has(path)) return;

    const component = componentMap[path];
    if (!component) return;

    prefetched.add(path);

    if ('prefetch' in component && typeof component.prefetch === 'function') {
      component.prefetch();
    } else {
      component().catch(() => {/* ignore */});
    }
  };
}

/**
 * Create an intersection observer that prefetches lazy components when links enter viewport
 * 
 * @example
 * ```ts
 * const observer = createPreloadOnVisible({
 *   '/dashboard': LazyDashboard,
 *   '/settings': LazySettings,
 * });
 * 
 * // Observe link elements
 * document.querySelectorAll('a[href]').forEach(link => {
 *   observer.observe(link, link.getAttribute('href')!);
 * });
 * 
 * // Cleanup when done
 * observer.disconnect();
 * ```
 */
export function createPreloadOnVisible(
  componentMap: Record<string, LazyComponent & { prefetch?: () => Promise<void> }>,
  options: IntersectionObserverInit = {}
): {
  observe: (element: Element, path: string) => void;
  unobserve: (element: Element) => void;
  disconnect: () => void;
} {
  const prefetched = new Set<string>();
  const elementPathMap = new WeakMap<Element, string>();

  /* v8 ignore start */
  // IntersectionObserver is only available in browsers
  let observer: IntersectionObserver | null = null;
  
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const path = elementPathMap.get(entry.target);
        if (!path || prefetched.has(path)) continue;

        const component = componentMap[path];
        if (!component) continue;

        prefetched.add(path);
        observer!.unobserve(entry.target);

        if ('prefetch' in component && typeof component.prefetch === 'function') {
          component.prefetch();
        } else {
          component().catch(() => {/* ignore */});
        }
      }
    }, options);
  }
  /* v8 ignore stop */

  return {
    observe(element: Element, path: string) {
      elementPathMap.set(element, path);
      /* v8 ignore next */
      observer?.observe(element);
    },
    unobserve(element: Element) {
      elementPathMap.delete(element);
      /* v8 ignore next */
      observer?.unobserve(element);
    },
    disconnect() {
      /* v8 ignore next */
      observer?.disconnect();
    },
  };
}

// =============================================================================
// Inline Lazy Import Support
// =============================================================================

/**
 * Type guard: check if a value is a function that can be used as a component
 */
function isComponentFunction(value: unknown): value is RouteComponent {
  return typeof value === 'function';
}

/**
 * Resolve the component export from a dynamically imported module.
 * 
 * @param module - The imported module object
 * @param exportName - Optional named export to use (default: 'default')
 * @returns The resolved component function
 * @throws Error if no component can be found in the module
 * 
 * Resolution order:
 * 1. If exportName is specified, use that export
 * 2. If module has 'default' export, use that
 * 3. Use the first function export found (convenience fallback)
 */
export function resolveModuleExport(
  module: Record<string, unknown>,
  exportName?: string
): RouteComponent {
  // 1. Explicit named export
  if (exportName !== undefined) {
    const exported = module[exportName];
    if (!isComponentFunction(exported)) {
      throw new Error(
        `Export "${exportName}" not found or not a function in lazy-loaded module. ` +
        `Available exports: ${Object.keys(module).join(', ')}`
      );
    }
    return exported;
  }

  // 2. Default export
  if ('default' in module && isComponentFunction(module.default)) {
    return module.default;
  }

  // 3. First function export (fallback)
  for (const key of Object.keys(module)) {
    const value = module[key];
    if (isComponentFunction(value)) {
      return value;
    }
  }

  throw new Error(
    `No component found in lazy-loaded module. ` +
    `Available exports: ${Object.keys(module).join(', ')}`
  );
}

/**
 * Check if a component is a pre-wrapped lazy component (created with lazy()).
 * This is the existing lazy() wrapper with prefetch/isLoaded/reset methods.
 */
export function isWrappedLazyComponent(
  component: unknown
): component is LazyComponentWithMethods {
  return (
    typeof component === 'function' &&
    'prefetch' in component &&
    'isLoaded' in component &&
    'reset' in component
  );
}

/**
 * Check if a component is an inline lazy import function.
 * 
 * An inline lazy import is a zero-argument function that returns a Promise.
 * We detect this by calling the function and checking if it returns a thenable.
 * The result is cached so we only detect once.
 * 
 * Note: This is a heuristic. Static components that return Promises would be
 * incorrectly detected as lazy. However, this is rare in practice since
 * components should return DOM nodes synchronously.
 */
const detectedLazyCache = new WeakMap<object, boolean>();

export function detectInlineLazyImport(
  component: unknown
): component is LazyImportFn {
  // Must be a function
  if (typeof component !== 'function') {
    return false;
  }

  // Check cache
  if (detectedLazyCache.has(component)) {
    return detectedLazyCache.get(component) === true;
  }

  // Already wrapped with lazy() - not an inline import
  if (isWrappedLazyComponent(component)) {
    detectedLazyCache.set(component, false);
    return false;
  }

  // Inline lazy imports are zero-argument functions
  // Static components also have length 0 if they don't use props
  // We'll use a different heuristic: check function body for 'import('
  // This is not 100% reliable but works for the common case
  const fnString = component.toString();
  const looksLikeImport = fnString.includes('import(') || fnString.includes('import (');
  
  detectedLazyCache.set(component, looksLikeImport);
  return looksLikeImport;
}

/**
 * Wrap an inline lazy import with the lazy() function.
 * 
 * This converts: `() => import('./Component.js')`
 * Into a full lazy component with loading states, caching, etc.
 * 
 * @param importFn - The inline import function
 * @param exportName - Named export to use from the module
 * @param routeLazyConfig - Per-route lazy config
 * @param globalDefaults - Global lazy defaults from router options
 */
export function wrapInlineLazy(
  importFn: LazyImportFn,
  exportName: string | undefined,
  routeLazyConfig: RouteLazyConfig | undefined,
  globalDefaults: LazyDefaults | undefined
): LazyComponent & LazyComponentWithMethods {
  // Merge route config with global defaults
  const delay = routeLazyConfig?.delay ?? globalDefaults?.delay ?? 200;
  const timeout = routeLazyConfig?.timeout ?? globalDefaults?.timeout ?? 10000;
  const minLoadTime = routeLazyConfig?.minLoadTime ?? globalDefaults?.minLoadTime;
  const loading = globalDefaults?.loading;
  const error = globalDefaults?.error;

  // Create a loader that resolves the export
  const loader = async (): Promise<{ default: RouteComponent }> => {
    const module = await importFn();
    const component = resolveModuleExport(module, exportName);
    return { default: component };
  };

  // Build options
  const options: LazyOptions = {
    delay,
    timeout,
  };

  if (minLoadTime !== undefined) {
    options.minLoadTime = minLoadTime;
  }

  if (loading !== undefined) {
    options.loading = () => {
      // Call the loading component
      const result = loading();
      // If it's a Node, return it; otherwise create a text node
      if (result instanceof Node) {
        return result;
      }
      return document.createTextNode('Loading...');
    };
  }

  if (error !== undefined) {
    options.error = error;
  }

  return lazy(loader, options);
}

/**
 * Process a route component during compilation.
 * 
 * - If it's a static component, return as-is
 * - If it's already wrapped with lazy(), return as-is
 * - If it's an inline lazy import, wrap it with lazy()
 * 
 * @param component - The route component to process
 * @param exportName - Named export to use (for inline lazy)
 * @param routeLazyConfig - Per-route lazy config
 * @param globalDefaults - Global lazy defaults
 * @returns The processed component (either original or wrapped)
 */
export function processRouteComponent(
  component: RouteComponent | LazyComponent | LazyImportFn | undefined,
  exportName: string | undefined,
  routeLazyConfig: RouteLazyConfig | undefined,
  globalDefaults: LazyDefaults | undefined
): RouteComponent | LazyComponent | undefined {
  if (component === undefined) {
    return undefined;
  }

  // Already a pre-wrapped lazy component
  if (isWrappedLazyComponent(component)) {
    return component;
  }

  // Detect inline lazy import
  if (detectInlineLazyImport(component)) {
    return wrapInlineLazy(component, exportName, routeLazyConfig, globalDefaults);
  }

  // Static component - return as-is
  return component;
}
