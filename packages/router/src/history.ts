import type {
  History,
  HistoryEntry,
  HistoryListener,
  Location,
  NavigationTarget,
} from './types.js';
import { createLocation, normalizePath, stringifyQuery } from './route-matcher.js';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique key for history entries
 */
function createKey(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Convert NavigationTarget to a href string
 */
export function targetToHref(target: NavigationTarget, base: string = ''): string {
  if (typeof target === 'string') {
    // If already absolute, return as is
    if (target.startsWith('/')) {
      return target;
    }
    // Relative path - join with base
    return normalizePath(base + '/' + target);
  }

  let href = target.path;
  if (target.query && Object.keys(target.query).length > 0) {
    href += '?' + stringifyQuery(target.query);
  }
  if (target.hash) {
    href += '#' + target.hash;
  }
  return href;
}

// =============================================================================
// Memory History
// =============================================================================

export interface MemoryHistoryOptions {
  /** Initial entries (defaults to ['/']) */
  initialEntries?: string[];
  /** Initial index (defaults to last entry) */
  initialIndex?: number;
}

/**
 * Create a memory-based history for testing and SSR
 */
export function createMemoryHistory(options: MemoryHistoryOptions = {}): History {
  const { initialEntries = ['/'], initialIndex } = options;

  // Initialize entries
  const entries: HistoryEntry[] = initialEntries.map((path) => {
    const questionIndex = path.indexOf('?');
    const hashIndex = path.indexOf('#');
    
    let pathname = path;
    let search = '';
    let hash = '';
    
    if (hashIndex >= 0) {
      hash = path.slice(hashIndex + 1);
      pathname = path.slice(0, hashIndex);
    }
    
    if (questionIndex >= 0 && (hashIndex < 0 || questionIndex < hashIndex)) {
      const searchEnd = hashIndex >= 0 ? hashIndex : path.length;
      search = path.slice(questionIndex + 1, searchEnd);
      pathname = path.slice(0, questionIndex);
    }
    
    return {
      path: normalizePath(pathname),
      search,
      hash,
      state: null,
      key: createKey(),
    };
  });

  // Current index in the history stack
  let index = initialIndex ?? entries.length - 1;

  // Listeners for location changes
  const listeners = new Set<HistoryListener>();

  // Get current location from entry
  function getLocation(): Location {
    const entry = entries[index]!;
    let href = entry.path;
    if (entry.search) href += '?' + entry.search;
    if (entry.hash) href += '#' + entry.hash;

    return createLocation(href, entry.state);
  }

  // Notify all listeners
  function notifyListeners(action: 'push' | 'replace' | 'pop') {
    const location = getLocation();
    for (const listener of listeners) {
      listener(location, action);
    }
  }

  // Parse target into entry components
  function parseTarget(target: NavigationTarget): Omit<HistoryEntry, 'key'> {
    const location = createLocation(target);
    return {
      path: location.path,
      search: location.search,
      hash: location.hash,
      state: location.state,
    };
  }

  const history: History = {
    get location() {
      return getLocation();
    },

    push(target: NavigationTarget) {
      const parsed = parseTarget(target);
      const entry: HistoryEntry = {
        ...parsed,
        key: createKey(),
      };

      // Remove any forward entries
      entries.splice(index + 1);

      // Add new entry
      entries.push(entry);
      index = entries.length - 1;

      notifyListeners('push');
    },

    replace(target: NavigationTarget) {
      const parsed = parseTarget(target);
      const entry: HistoryEntry = {
        ...parsed,
        key: createKey(),
      };

      // Replace current entry
      entries[index] = entry;

      notifyListeners('replace');
    },

    back() {
      this.go(-1);
    },

    forward() {
      this.go(1);
    },

    go(delta: number) {
      const newIndex = index + delta;

      // Bounds check
      if (newIndex < 0 || newIndex >= entries.length) {
        return;
      }

      index = newIndex;
      notifyListeners('pop');
    },

    listen(listener: HistoryListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    createHref(target: NavigationTarget) {
      return targetToHref(target);
    },

    destroy() {
      listeners.clear();
    },
  };

  return history;
}

// =============================================================================
// Browser History
// =============================================================================

/* v8 ignore start - Browser-only code, tested with Playwright */

export interface BrowserHistoryOptions {
  /** Base path for all routes (e.g., '/app') */
  base?: string;
}

/**
 * Create a browser-based history using the History API
 */
export function createBrowserHistory(options: BrowserHistoryOptions = {}): History {
  const { base = '' } = options;
  const normalizedBase = base ? normalizePath(base) : '';

  // Listeners for location changes
  const listeners = new Set<HistoryListener>();

  // Get current location from window.location
  function getLocation(): Location {
    let path = window.location.pathname;

    // Remove base from path
    if (normalizedBase && path.startsWith(normalizedBase)) {
      path = path.slice(normalizedBase.length) || '/';
    }

    const href = path + window.location.search + window.location.hash;
    return createLocation(href, window.history.state);
  }

  // Notify all listeners
  function notifyListeners(action: 'push' | 'replace' | 'pop') {
    const location = getLocation();
    for (const listener of listeners) {
      listener(location, action);
    }
  }

  // Handle popstate events (back/forward navigation)
  function handlePopState() {
    notifyListeners('pop');
  }

  // Add popstate listener
  window.addEventListener('popstate', handlePopState);

  // Build full URL with base
  function buildUrl(target: NavigationTarget): string {
    const href = targetToHref(target);
    if (normalizedBase) {
      // Don't double-add base
      if (href.startsWith(normalizedBase)) {
        return href;
      }
      return normalizedBase + (href.startsWith('/') ? href : '/' + href);
    }
    return href;
  }

  const history: History = {
    get location() {
      return getLocation();
    },

    push(target: NavigationTarget) {
      const url = buildUrl(target);
      const state = typeof target === 'object' ? target.state : undefined;

      window.history.pushState(state ?? null, '', url);
      notifyListeners('push');
    },

    replace(target: NavigationTarget) {
      const url = buildUrl(target);
      const state = typeof target === 'object' ? target.state : undefined;

      window.history.replaceState(state ?? null, '', url);
      notifyListeners('replace');
    },

    back() {
      window.history.back();
    },

    forward() {
      window.history.forward();
    },

    go(delta: number) {
      window.history.go(delta);
    },

    listen(listener: HistoryListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    createHref(target: NavigationTarget) {
      return buildUrl(target);
    },

    destroy() {
      window.removeEventListener('popstate', handlePopState);
      listeners.clear();
    },
  };

  return history;
}

// =============================================================================
// Hash History
// =============================================================================

export interface HashHistoryOptions {
  /** Hash prefix (defaults to '#') */
  hashPrefix?: string;
}

/**
 * Create a hash-based history using the URL hash
 * Useful for environments where you can't configure the server
 */
export function createHashHistory(options: HashHistoryOptions = {}): History {
  const { hashPrefix = '#' } = options;

  // Listeners for location changes
  const listeners = new Set<HistoryListener>();

  // Get current location from hash
  function getLocation(): Location {
    let hash = window.location.hash;

    // Remove hash prefix
    if (hash.startsWith(hashPrefix)) {
      hash = hash.slice(hashPrefix.length);
    }

    // Ensure leading slash
    if (!hash.startsWith('/')) {
      hash = '/' + hash;
    }

    return createLocation(hash, window.history.state);
  }

  // Notify all listeners
  function notifyListeners(action: 'push' | 'replace' | 'pop') {
    const location = getLocation();
    for (const listener of listeners) {
      listener(location, action);
    }
  }

  // Handle hashchange events
  function handleHashChange() {
    notifyListeners('pop');
  }

  // Add hashchange listener
  window.addEventListener('hashchange', handleHashChange);

  // Build hash URL
  function buildHashUrl(target: NavigationTarget): string {
    const href = targetToHref(target);
    return hashPrefix + href;
  }

  const history: History = {
    get location() {
      return getLocation();
    },

    push(target: NavigationTarget) {
      const url = buildHashUrl(target);
      const state = typeof target === 'object' ? target.state : undefined;

      // Use pushState to enable state while still using hash
      window.history.pushState(state ?? null, '', url);
      notifyListeners('push');
    },

    replace(target: NavigationTarget) {
      const url = buildHashUrl(target);
      const state = typeof target === 'object' ? target.state : undefined;

      window.history.replaceState(state ?? null, '', url);
      notifyListeners('replace');
    },

    back() {
      window.history.back();
    },

    forward() {
      window.history.forward();
    },

    go(delta: number) {
      window.history.go(delta);
    },

    listen(listener: HistoryListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    createHref(target: NavigationTarget) {
      return buildHashUrl(target);
    },

    destroy() {
      window.removeEventListener('hashchange', handleHashChange);
      listeners.clear();
    },
  };

  return history;
}

/* v8 ignore stop */
