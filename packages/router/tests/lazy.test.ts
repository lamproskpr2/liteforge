import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  lazy,
  prefetchAll,
  isLazyComponent,
  getLazyDelay,
  getLazyLoading,
  getLazyError,
  createPreloadOnHover,
  createPreloadOnVisible,
} from '../src/lazy.js';
import type { RouteComponent, LazyComponent } from '../src/types.js';

// Helper to wait for promises
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock component factory
function createMockComponent(name: string): RouteComponent {
  return () => {
    const div = document.createElement('div');
    div.textContent = name;
    div.id = name.toLowerCase();
    return div;
  };
}

// =============================================================================
// lazy()
// =============================================================================

describe('lazy', () => {
  describe('basic functionality', () => {
    it('creates a lazy component from loader', () => {
      const loader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
      const LazyTest = lazy(loader);

      expect(typeof LazyTest).toBe('function');
      expect(typeof LazyTest.prefetch).toBe('function');
      expect(typeof LazyTest.isLoaded).toBe('function');
      expect(typeof LazyTest.reset).toBe('function');
    });

    it('loads component on first call', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      const LazyTest = lazy(loader);

      expect(LazyTest.isLoaded()).toBe(false);
      
      const result = await LazyTest();
      
      expect(loader).toHaveBeenCalledTimes(1);
      expect(LazyTest.isLoaded()).toBe(true);
      expect('default' in result ? result.default : result).toBe(mockComponent);
    });

    it('caches loaded component', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      const LazyTest = lazy(loader);

      await LazyTest();
      await LazyTest();
      await LazyTest();

      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('returns same promise while loading', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ default: mockComponent }), 10))
      );
      const LazyTest = lazy(loader);

      const promise1 = LazyTest();
      const promise2 = LazyTest();
      const promise3 = LazyTest();

      expect(loader).toHaveBeenCalledTimes(1);
      
      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('supports direct component export (no default)', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve(mockComponent));
      const LazyTest = lazy(loader);

      const result = await LazyTest();
      
      expect(result).toBe(mockComponent);
      expect(LazyTest.isLoaded()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('sets error state on load failure', async () => {
      const error = new Error('Load failed');
      const loader = vi.fn(() => Promise.reject(error));
      const LazyTest = lazy(loader);

      await expect(LazyTest()).rejects.toThrow('Load failed');
      expect(LazyTest.isLoaded()).toBe(false);
    });

    it('allows retry after failure', async () => {
      let callCount = 0;
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        return Promise.resolve({ default: mockComponent });
      });
      const LazyTest = lazy(loader);

      // First attempt fails
      await expect(LazyTest()).rejects.toThrow('First attempt failed');
      
      // Second attempt succeeds
      const result = await LazyTest();
      expect('default' in result ? result.default : result).toBe(mockComponent);
      expect(loader).toHaveBeenCalledTimes(2);
    });

    it('converts non-Error to Error', async () => {
      const loader = vi.fn(() => Promise.reject('string error'));
      const LazyTest = lazy(loader);

      await expect(LazyTest()).rejects.toThrow('string error');
    });
  });

  describe('timeout option', () => {
    it('times out if loading takes too long', async () => {
      const loader = vi.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ default: createMockComponent('Test') }), 200))
      );
      const LazyTest = lazy(loader, { timeout: 50 });

      await expect(LazyTest()).rejects.toThrow('timed out');
    });

    it('loads successfully before timeout', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ default: mockComponent }), 10))
      );
      const LazyTest = lazy(loader, { timeout: 100 });

      const result = await LazyTest();
      expect('default' in result ? result.default : result).toBe(mockComponent);
    });

    it('ignores timeout of 0', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ default: mockComponent }), 10))
      );
      const LazyTest = lazy(loader, { timeout: 0 });

      const result = await LazyTest();
      expect('default' in result ? result.default : result).toBe(mockComponent);
    });
  });

  describe('minLoadTime option', () => {
    it('enforces minimum load time', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      const LazyTest = lazy(loader, { minLoadTime: 50 });

      const start = Date.now();
      await LazyTest();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small timing variance
    });

    it('ignores minLoadTime of 0', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      const LazyTest = lazy(loader, { minLoadTime: 0 });

      const start = Date.now();
      await LazyTest();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(20);
    });

    it('does not add extra time if load already exceeds minLoadTime', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => 
        new Promise(resolve => setTimeout(() => resolve({ default: mockComponent }), 30))
      );
      const LazyTest = lazy(loader, { minLoadTime: 10 });

      const start = Date.now();
      await LazyTest();
      const elapsed = Date.now() - start;

      // Should be around 30ms (load time), not 40ms (load + minLoadTime)
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('prefetch option', () => {
    it('prefetches immediately when option is true', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      
      const LazyTest = lazy(loader, { prefetch: true });
      
      // Wait for prefetch to trigger
      await tick();
      await tick();
      
      expect(loader).toHaveBeenCalledTimes(1);
      expect(LazyTest.isLoaded()).toBe(true);
    });

    it('does not prefetch when option is false', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      
      const LazyTest = lazy(loader, { prefetch: false });
      
      await tick();
      await tick();
      
      expect(loader).not.toHaveBeenCalled();
      expect(LazyTest.isLoaded()).toBe(false);
    });
  });

  describe('prefetch method', () => {
    it('prefetches the component', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      const LazyTest = lazy(loader);

      expect(LazyTest.isLoaded()).toBe(false);
      
      await LazyTest.prefetch();
      
      expect(loader).toHaveBeenCalledTimes(1);
      expect(LazyTest.isLoaded()).toBe(true);
    });

    it('silently ignores prefetch errors', async () => {
      const loader = vi.fn(() => Promise.reject(new Error('Prefetch failed')));
      const LazyTest = lazy(loader);

      // Should not throw
      await expect(LazyTest.prefetch()).resolves.toBeUndefined();
    });
  });

  describe('reset method', () => {
    it('resets state to idle', async () => {
      const mockComponent = createMockComponent('Test');
      const loader = vi.fn(() => Promise.resolve({ default: mockComponent }));
      const LazyTest = lazy(loader);

      await LazyTest();
      expect(LazyTest.isLoaded()).toBe(true);

      LazyTest.reset();
      expect(LazyTest.isLoaded()).toBe(false);
    });

    it('allows reloading after reset', async () => {
      let callCount = 0;
      const loader = vi.fn(() => {
        callCount++;
        return Promise.resolve({ default: createMockComponent(`Test${callCount}`) });
      });
      const LazyTest = lazy(loader);

      await LazyTest();
      expect(loader).toHaveBeenCalledTimes(1);

      LazyTest.reset();
      await LazyTest();
      expect(loader).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// prefetchAll
// =============================================================================

describe('prefetchAll', () => {
  it('prefetches multiple lazy components', async () => {
    const loaders = [
      vi.fn(() => Promise.resolve({ default: createMockComponent('A') })),
      vi.fn(() => Promise.resolve({ default: createMockComponent('B') })),
      vi.fn(() => Promise.resolve({ default: createMockComponent('C') })),
    ];
    
    const LazyA = lazy(loaders[0]!);
    const LazyB = lazy(loaders[1]!);
    const LazyC = lazy(loaders[2]!);

    await prefetchAll([LazyA, LazyB, LazyC]);

    expect(loaders[0]).toHaveBeenCalled();
    expect(loaders[1]).toHaveBeenCalled();
    expect(loaders[2]).toHaveBeenCalled();
    expect(LazyA.isLoaded()).toBe(true);
    expect(LazyB.isLoaded()).toBe(true);
    expect(LazyC.isLoaded()).toBe(true);
  });

  it('handles plain LazyComponent without prefetch method', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
    const plainLazy: LazyComponent = loader;

    // Should not throw
    await prefetchAll([plainLazy]);
    expect(loader).toHaveBeenCalled();
  });

  it('ignores errors during prefetch', async () => {
    const failingLoader = vi.fn(() => Promise.reject(new Error('Failed')));
    const successLoader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
    
    const LazyFail = lazy(failingLoader);
    const LazySuccess = lazy(successLoader);

    // Should not throw
    await prefetchAll([LazyFail, LazySuccess]);
    
    expect(LazySuccess.isLoaded()).toBe(true);
  });
});

// =============================================================================
// isLazyComponent
// =============================================================================

describe('isLazyComponent', () => {
  it('returns true for lazy components', () => {
    const LazyTest = lazy(() => Promise.resolve({ default: createMockComponent('Test') }));
    expect(isLazyComponent(LazyTest)).toBe(true);
  });

  it('returns false for plain functions', () => {
    const plainFn = () => Promise.resolve({ default: createMockComponent('Test') });
    expect(isLazyComponent(plainFn)).toBe(false);
  });

  it('returns false for non-functions', () => {
    expect(isLazyComponent(null)).toBe(false);
    expect(isLazyComponent(undefined)).toBe(false);
    expect(isLazyComponent({})).toBe(false);
    expect(isLazyComponent('string')).toBe(false);
  });

  it('returns false for objects with partial lazy interface', () => {
    const partial = { prefetch: () => Promise.resolve() };
    expect(isLazyComponent(partial)).toBe(false);
  });
});

// =============================================================================
// getLazyDelay
// =============================================================================

describe('getLazyDelay', () => {
  it('returns default delay of 200 when not specified', () => {
    const LazyTest = lazy(() => Promise.resolve({ default: createMockComponent('Test') }));
    expect(getLazyDelay(LazyTest)).toBe(200);
  });

  it('returns configured delay', () => {
    const LazyTest = lazy(
      () => Promise.resolve({ default: createMockComponent('Test') }),
      { delay: 500 }
    );
    expect(getLazyDelay(LazyTest)).toBe(500);
  });

  it('returns 0 when delay is explicitly 0', () => {
    const LazyTest = lazy(
      () => Promise.resolve({ default: createMockComponent('Test') }),
      { delay: 0 }
    );
    expect(getLazyDelay(LazyTest)).toBe(0);
  });
});

// =============================================================================
// getLazyLoading
// =============================================================================

describe('getLazyLoading', () => {
  it('returns undefined when loading not specified', () => {
    const LazyTest = lazy(() => Promise.resolve({ default: createMockComponent('Test') }));
    expect(getLazyLoading(LazyTest)).toBeUndefined();
  });

  it('returns loading function when specified', () => {
    const loadingFn = () => document.createTextNode('Loading...');
    const LazyTest = lazy(
      () => Promise.resolve({ default: createMockComponent('Test') }),
      { loading: loadingFn }
    );
    expect(getLazyLoading(LazyTest)).toBe(loadingFn);
  });
});

// =============================================================================
// getLazyError
// =============================================================================

describe('getLazyError', () => {
  it('returns undefined when error not specified', () => {
    const LazyTest = lazy(() => Promise.resolve({ default: createMockComponent('Test') }));
    expect(getLazyError(LazyTest)).toBeUndefined();
  });

  it('returns error function when specified', () => {
    const errorFn = (err: Error) => document.createTextNode(`Error: ${err.message}`);
    const LazyTest = lazy(
      () => Promise.resolve({ default: createMockComponent('Test') }),
      { error: errorFn }
    );
    expect(getLazyError(LazyTest)).toBe(errorFn);
  });
});

// =============================================================================
// delay option
// =============================================================================

describe('delay option', () => {
  it('stores delay in __options', () => {
    const LazyTest = lazy(
      () => Promise.resolve({ default: createMockComponent('Test') }),
      { delay: 300 }
    );
    
    // Access internal options
    const options = (LazyTest as unknown as { __options: { delay: number } }).__options;
    expect(options.delay).toBe(300);
  });

  it('defaults to 200ms when not specified', () => {
    const LazyTest = lazy(() => Promise.resolve({ default: createMockComponent('Test') }));
    expect(getLazyDelay(LazyTest)).toBe(200);
  });
});

// =============================================================================
// createPreloadOnHover
// =============================================================================

describe('createPreloadOnHover', () => {
  it('prefetches component on hover', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
    const LazyTest = lazy(loader);
    
    const preloadOnHover = createPreloadOnHover({
      '/test': LazyTest,
    });

    preloadOnHover('/test');
    
    await tick();
    expect(loader).toHaveBeenCalled();
  });

  it('only prefetches once per path', () => {
    const loader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
    const LazyTest = lazy(loader);
    
    const preloadOnHover = createPreloadOnHover({
      '/test': LazyTest,
    });

    preloadOnHover('/test');
    preloadOnHover('/test');
    preloadOnHover('/test');
    
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown paths', () => {
    const loader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
    const LazyTest = lazy(loader);
    
    const preloadOnHover = createPreloadOnHover({
      '/test': LazyTest,
    });

    preloadOnHover('/unknown');
    
    expect(loader).not.toHaveBeenCalled();
  });

  it('handles plain LazyComponent', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: createMockComponent('Test') }));
    const plainLazy: LazyComponent = loader;
    
    const preloadOnHover = createPreloadOnHover({
      '/test': plainLazy,
    });

    preloadOnHover('/test');
    
    await tick();
    expect(loader).toHaveBeenCalled();
  });
});

// =============================================================================
// createPreloadOnVisible
// =============================================================================

describe('createPreloadOnVisible', () => {
  it('creates observer with observe/unobserve/disconnect methods', () => {
    const observer = createPreloadOnVisible({});
    
    expect(typeof observer.observe).toBe('function');
    expect(typeof observer.unobserve).toBe('function');
    expect(typeof observer.disconnect).toBe('function');
  });

  it('observe/unobserve/disconnect do not throw without IntersectionObserver', () => {
    const observer = createPreloadOnVisible({});
    const element = document.createElement('div');
    
    // Should not throw even without real IntersectionObserver
    expect(() => observer.observe(element, '/test')).not.toThrow();
    expect(() => observer.unobserve(element)).not.toThrow();
    expect(() => observer.disconnect()).not.toThrow();
  });
});

// =============================================================================
// Integration with RouterOutlet
// =============================================================================

describe('lazy integration', () => {
  it('lazy component works as route component', async () => {
    const mockComponent = createMockComponent('Dashboard');
    const LazyDashboard = lazy(() => Promise.resolve({ default: mockComponent }));

    // Simulate what RouterOutlet does
    const result = await LazyDashboard();
    const component = 'default' in result ? result.default : result;
    
    // Should be able to call the component
    const element = component();
    expect(element.id).toBe('dashboard');
    expect(element.textContent).toBe('Dashboard');
  });

  it('multiple lazy components load independently', async () => {
    const loaders = {
      dashboard: vi.fn(() => Promise.resolve({ default: createMockComponent('Dashboard') })),
      settings: vi.fn(() => Promise.resolve({ default: createMockComponent('Settings') })),
    };

    const LazyDashboard = lazy(loaders.dashboard);
    const LazySettings = lazy(loaders.settings);

    // Load only dashboard
    await LazyDashboard();
    
    expect(loaders.dashboard).toHaveBeenCalled();
    expect(loaders.settings).not.toHaveBeenCalled();
    expect(LazyDashboard.isLoaded()).toBe(true);
    expect(LazySettings.isLoaded()).toBe(false);

    // Load settings
    await LazySettings();
    expect(loaders.settings).toHaveBeenCalled();
    expect(LazySettings.isLoaded()).toBe(true);
  });
});
