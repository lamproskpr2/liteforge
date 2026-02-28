import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineStore, storeRegistry, defineStorePlugin } from '../src/index.js';

describe('store plugins', () => {
  beforeEach(() => {
    // Clear registry and plugins before each test
    storeRegistry.clear();
    storeRegistry.$clearPlugins();
  });

  describe('defineStorePlugin', () => {
    it('should create a plugin with required properties', () => {
      const plugin = defineStorePlugin({
        name: 'test-plugin',
        onStateChange: vi.fn(),
      });

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.onStateChange).toBeDefined();
    });

    it('should throw if plugin has no name', () => {
      expect(() => {
        defineStorePlugin({
          name: '',
          onStateChange: vi.fn(),
        });
      }).toThrow('Plugin must have a name');
    });
  });

  describe('onInit', () => {
    it('should call onInit when store is created', () => {
      const onInit = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'init-plugin',
          onInit,
        })
      );

      defineStore('init-test', { state: { value: 42 } });

      expect(onInit).toHaveBeenCalledTimes(1);
      expect(onInit).toHaveBeenCalledWith('init-test', expect.any(Object));
    });

    it('should call onInit for stores created after plugin registration', () => {
      const onInit = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'late-plugin',
          onInit,
        })
      );

      defineStore('store1', { state: { a: 1 } });
      defineStore('store2', { state: { b: 2 } });

      expect(onInit).toHaveBeenCalledTimes(2);
    });

    it('should call onInit for existing stores when plugin is registered', () => {
      defineStore('existing1', { state: { a: 1 } });
      defineStore('existing2', { state: { b: 2 } });

      const onInit = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'retroactive-plugin',
          onInit,
        })
      );

      expect(onInit).toHaveBeenCalledTimes(2);
      expect(onInit).toHaveBeenCalledWith('existing1', expect.any(Object));
      expect(onInit).toHaveBeenCalledWith('existing2', expect.any(Object));
    });

    it('should pass signalified state to onInit', () => {
      let capturedState: Record<string, unknown> | null = null;

      storeRegistry.use(
        defineStorePlugin({
          name: 'state-plugin',
          onInit: (_, state) => {
            capturedState = state as Record<string, unknown>;
          },
        })
      );

      defineStore('state-test', { state: { count: 0, name: 'test' } });

      expect(capturedState).not.toBeNull();
      expect(typeof capturedState?.['count']).toBe('function'); // It's a signal
      expect(typeof capturedState?.['name']).toBe('function'); // It's a signal
    });
  });

  describe('onStateChange', () => {
    it('should call onStateChange when state changes', () => {
      const onStateChange = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'change-plugin',
          onStateChange,
        })
      );

      const store = defineStore('change-test', { state: { count: 0 } });

      store.count.set(1);
      store.count.set(2);

      expect(onStateChange).toHaveBeenCalledTimes(2);
      expect(onStateChange).toHaveBeenCalledWith('change-test', 'count', 1, 0);
      expect(onStateChange).toHaveBeenCalledWith('change-test', 'count', 2, 1);
    });

    it('should not call onStateChange for initial values', () => {
      const onStateChange = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'no-initial',
          onStateChange,
        })
      );

      defineStore('no-initial-test', { state: { count: 0 } });

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });

  describe('onReset', () => {
    it('should call onReset when store is reset', () => {
      const onReset = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'reset-plugin',
          onReset,
        })
      );

      const store = defineStore('reset-test', { state: { value: 0 } });
      store.value.set(100);

      storeRegistry.reset('reset-test');

      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onReset).toHaveBeenCalledWith('reset-test');
    });

    it('should call onReset for all stores on resetAll', () => {
      const onReset = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'reset-all-plugin',
          onReset,
        })
      );

      defineStore('reset-all-1', { state: { a: 1 } });
      defineStore('reset-all-2', { state: { b: 2 } });

      storeRegistry.resetAll();

      expect(onReset).toHaveBeenCalledTimes(2);
      expect(onReset).toHaveBeenCalledWith('reset-all-1');
      expect(onReset).toHaveBeenCalledWith('reset-all-2');
    });
  });

  describe('stores filter', () => {
    it('should only apply to listed stores', () => {
      const onStateChange = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'filtered-plugin',
          stores: ['store-a'],
          onStateChange,
        })
      );

      const storeA = defineStore('store-a', { state: { value: 0 } });
      const storeB = defineStore('store-b', { state: { value: 0 } });

      storeA.value.set(1);
      storeB.value.set(2);

      expect(onStateChange).toHaveBeenCalledTimes(1);
      expect(onStateChange).toHaveBeenCalledWith('store-a', 'value', 1, 0);
    });

    it('should not call onInit for non-listed stores', () => {
      const onInit = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'init-filtered',
          stores: ['included'],
          onInit,
        })
      );

      defineStore('included', { state: { a: 1 } });
      defineStore('excluded', { state: { b: 2 } });

      expect(onInit).toHaveBeenCalledTimes(1);
      expect(onInit).toHaveBeenCalledWith('included', expect.any(Object));
    });

    it('should not call onReset for non-listed stores', () => {
      const onReset = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'reset-filtered',
          stores: ['reset-included'],
          onReset,
        })
      );

      defineStore('reset-included', { state: { a: 1 } });
      defineStore('reset-excluded', { state: { b: 2 } });

      storeRegistry.resetAll();

      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onReset).toHaveBeenCalledWith('reset-included');
    });
  });

  describe('include filter', () => {
    it('should only watch listed keys per store', () => {
      const onStateChange = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'key-filtered',
          include: {
            'key-store': ['count'], // Only watch 'count', not 'name'
          },
          onStateChange,
        })
      );

      const store = defineStore('key-store', {
        state: { count: 0, name: 'test' },
      });

      store.count.set(1);
      store.name.set('changed');

      expect(onStateChange).toHaveBeenCalledTimes(1);
      expect(onStateChange).toHaveBeenCalledWith('key-store', 'count', 1, 0);
    });

    it('should watch all keys if store not in include map', () => {
      const onStateChange = vi.fn();

      storeRegistry.use(
        defineStorePlugin({
          name: 'partial-include',
          include: {
            'other-store': ['a'],
          },
          onStateChange,
        })
      );

      const store = defineStore('unfiltered-store', {
        state: { x: 0, y: 0 },
      });

      store.x.set(1);
      store.y.set(2);

      expect(onStateChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('multiple plugins', () => {
    it('should support multiple plugins', () => {
      const plugin1Changes: string[] = [];
      const plugin2Changes: string[] = [];

      storeRegistry.use(
        defineStorePlugin({
          name: 'plugin1',
          onStateChange: (store, key) => {
            plugin1Changes.push(`${store}.${key}`);
          },
        })
      );

      storeRegistry.use(
        defineStorePlugin({
          name: 'plugin2',
          onStateChange: (store, key) => {
            plugin2Changes.push(`${store}.${key}`);
          },
        })
      );

      const store = defineStore('multi-plugin', { state: { value: 0 } });
      store.value.set(1);

      expect(plugin1Changes).toEqual(['multi-plugin.value']);
      expect(plugin2Changes).toEqual(['multi-plugin.value']);
    });

    it('should respect individual plugin filters', () => {
      const plugin1Changes: string[] = [];
      const plugin2Changes: string[] = [];

      storeRegistry.use(
        defineStorePlugin({
          name: 'plugin1',
          stores: ['store-x'],
          onStateChange: (store, key) => {
            plugin1Changes.push(`${store}.${key}`);
          },
        })
      );

      storeRegistry.use(
        defineStorePlugin({
          name: 'plugin2',
          stores: ['store-y'],
          onStateChange: (store, key) => {
            plugin2Changes.push(`${store}.${key}`);
          },
        })
      );

      const storeX = defineStore('store-x', { state: { a: 0 } });
      const storeY = defineStore('store-y', { state: { b: 0 } });

      storeX.a.set(1);
      storeY.b.set(2);

      expect(plugin1Changes).toEqual(['store-x.a']);
      expect(plugin2Changes).toEqual(['store-y.b']);
    });
  });

  describe('practical plugin examples', () => {
    it('should work as a logger plugin', () => {
      const logs: string[] = [];

      storeRegistry.use(
        defineStorePlugin({
          name: 'logger',
          onStateChange: (store, key, newVal, oldVal) => {
            logs.push(`[${store}] ${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
          },
        })
      );

      const store = defineStore('logged', { state: { count: 0 } });
      store.count.set(5);
      store.count.set(10);

      expect(logs).toEqual([
        '[logged] count: 0 → 5',
        '[logged] count: 5 → 10',
      ]);
    });

    it('should work as a persistence plugin pattern', () => {
      // Simulate localStorage
      const storage = new Map<string, string>();

      storeRegistry.use(
        defineStorePlugin({
          name: 'persist',
          include: {
            settings: ['theme', 'language'],
          },
          onInit: (storeName, state) => {
            const saved = storage.get(`store:${storeName}`);
            if (saved) {
              const data = JSON.parse(saved) as Record<string, unknown>;
              for (const [key, value] of Object.entries(data)) {
                const signal = state[key];
                if (signal && typeof signal === 'function') {
                  (signal as { set: (v: unknown) => void }).set(value);
                }
              }
            }
          },
          onStateChange: (storeName) => {
            // In a real plugin, we'd save the relevant keys
            const snapshot = storeRegistry.snapshot()[storeName];
            if (snapshot) {
              storage.set(`store:${storeName}`, JSON.stringify(snapshot));
            }
          },
        })
      );

      const store = defineStore('settings', {
        state: { theme: 'light', language: 'en' },
      });

      store.theme.set('dark');

      // Verify it was "persisted"
      const persisted = storage.get('store:settings');
      expect(persisted).toBeDefined();
      expect(JSON.parse(persisted!)).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });
  });
});
