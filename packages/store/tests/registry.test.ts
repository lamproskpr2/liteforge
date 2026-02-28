import { describe, it, expect, beforeEach } from 'vitest';
import { defineStore, storeRegistry } from '../src/index.js';

describe('storeRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    storeRegistry.clear();
  });

  describe('store registration', () => {
    it('should auto-register stores on creation', () => {
      expect(storeRegistry.list()).toEqual([]);

      defineStore('store1', { state: { value: 1 } });
      expect(storeRegistry.list()).toContain('store1');

      defineStore('store2', { state: { value: 2 } });
      expect(storeRegistry.list()).toContain('store2');
      expect(storeRegistry.list()).toHaveLength(2);
    });

    it('should return existing store for duplicate name (singleton)', () => {
      const store1 = defineStore('duplicate', { state: { value: 1 } });
      store1.value.set(42);

      // Second call returns the SAME instance
      const store2 = defineStore('duplicate', { state: { value: 2 } });
      
      expect(store1).toBe(store2);
      expect(store2.value()).toBe(42); // Preserves state from first instance
    });

    it('should allow re-registration after unregister', () => {
      const store1 = defineStore('reuse', { state: { value: 1 } });
      expect(store1.value()).toBe(1);

      storeRegistry.unregister('reuse');
      expect(storeRegistry.list()).not.toContain('reuse');

      const store2 = defineStore('reuse', { state: { value: 2 } });
      expect(store2.value()).toBe(2);
    });
  });

  describe('list()', () => {
    it('should return all registered store names', () => {
      defineStore('alpha', { state: { a: 1 } });
      defineStore('beta', { state: { b: 2 } });
      defineStore('gamma', { state: { c: 3 } });

      const names = storeRegistry.list();
      expect(names).toHaveLength(3);
      expect(names).toContain('alpha');
      expect(names).toContain('beta');
      expect(names).toContain('gamma');
    });

    it('should return empty array when no stores registered', () => {
      expect(storeRegistry.list()).toEqual([]);
    });
  });

  describe('snapshot()', () => {
    it('should return all state as plain objects', () => {
      defineStore('users', {
        state: {
          currentUser: null as { name: string } | null,
          list: [] as Array<{ id: number; name: string }>,
        },
      });

      defineStore('ui', {
        state: {
          sidebarOpen: true,
          theme: 'dark',
        },
      });

      const snapshot = storeRegistry.snapshot();

      expect(snapshot).toEqual({
        users: {
          currentUser: null,
          list: [],
        },
        ui: {
          sidebarOpen: true,
          theme: 'dark',
        },
      });
    });

    it('should reflect current state values', () => {
      const store = defineStore('dynamic', {
        state: { count: 0 },
      });

      expect(storeRegistry.snapshot()).toEqual({ dynamic: { count: 0 } });

      store.count.set(10);
      expect(storeRegistry.snapshot()).toEqual({ dynamic: { count: 10 } });

      store.count.set(99);
      expect(storeRegistry.snapshot()).toEqual({ dynamic: { count: 99 } });
    });
  });

  describe('inspect()', () => {
    it('should return detailed store info', () => {
      defineStore('inspectable', {
        state: {
          count: 0,
          items: [] as string[],
        },
        getters: (state) => ({
          isEmpty: () => state.items().length === 0,
          total: () => state.count(),
        }),
        actions: (state) => ({
          increment() {
            state.count.update(c => c + 1);
          },
          addItem(item: string) {
            state.items.update(items => [...items, item]);
          },
        }),
      });

      const info = storeRegistry.inspect('inspectable');

      expect(info).toBeDefined();
      expect(info?.name).toBe('inspectable');
      expect(info?.state).toEqual({ count: 0, items: [] });
      expect(info?.getters).toEqual({ isEmpty: true, total: 0 });
      expect(info?.actions).toEqual(['increment', 'addItem']);
    });

    it('should return undefined for non-existent store', () => {
      expect(storeRegistry.inspect('nonexistent')).toBeUndefined();
    });

    it('should mark getters with args as [function with args]', () => {
      defineStore('arg-getters', {
        state: {
          users: [{ id: 1, name: 'Alice' }],
        },
        getters: (state) => ({
          byId: (id: number) => state.users().find(u => u.id === id),
        }),
      });

      const info = storeRegistry.inspect('arg-getters');
      expect(info?.getters).toEqual({ byId: '[function with args]' });
    });
  });

  describe('onAnyChange()', () => {
    it('should fire on any state change across any store', () => {
      const store1 = defineStore('watch1', { state: { a: 1 } });
      const store2 = defineStore('watch2', { state: { b: 2 } });

      const changes: Array<{
        storeName: string;
        key: string;
        newValue: unknown;
        oldValue: unknown;
      }> = [];

      const unsubscribe = storeRegistry.onAnyChange((storeName, key, newValue, oldValue) => {
        changes.push({ storeName, key, newValue, oldValue });
      });

      store1.a.set(10);
      store2.b.set(20);
      store1.a.set(100);

      expect(changes).toEqual([
        { storeName: 'watch1', key: 'a', newValue: 10, oldValue: 1 },
        { storeName: 'watch2', key: 'b', newValue: 20, oldValue: 2 },
        { storeName: 'watch1', key: 'a', newValue: 100, oldValue: 10 },
      ]);

      unsubscribe();
      store1.a.set(999);
      expect(changes).toHaveLength(3); // No new changes after unsubscribe
    });
  });

  describe('reset()', () => {
    it('should reset a single store to initial state', () => {
      const store = defineStore('resettable', {
        state: {
          count: 0,
          items: [] as string[],
        },
      });

      store.count.set(100);
      store.items.set(['a', 'b', 'c']);

      storeRegistry.reset('resettable');

      expect(store.count()).toBe(0);
      expect(store.items()).toEqual([]);
    });

    it('should not affect other stores', () => {
      const store1 = defineStore('reset1', { state: { value: 0 } });
      const store2 = defineStore('reset2', { state: { value: 0 } });

      store1.value.set(10);
      store2.value.set(20);

      storeRegistry.reset('reset1');

      expect(store1.value()).toBe(0);
      expect(store2.value()).toBe(20);
    });
  });

  describe('resetAll()', () => {
    it('should reset all stores to initial state', () => {
      const store1 = defineStore('resetAll1', { state: { a: 1 } });
      const store2 = defineStore('resetAll2', { state: { b: 2 } });
      const store3 = defineStore('resetAll3', { state: { c: 3 } });

      store1.a.set(100);
      store2.b.set(200);
      store3.c.set(300);

      storeRegistry.resetAll();

      expect(store1.a()).toBe(1);
      expect(store2.b()).toBe(2);
      expect(store3.c()).toBe(3);
    });
  });

  describe('serialize()', () => {
    it('should produce valid JSON', () => {
      defineStore('serialize1', { state: { count: 42 } });
      defineStore('serialize2', { state: { name: 'test', active: true } });

      const json = storeRegistry.serialize();

      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed).toEqual({
        serialize1: { count: 42 },
        serialize2: { name: 'test', active: true },
      });
    });
  });

  describe('hydrate()', () => {
    it('should restore state from JSON', () => {
      const store1 = defineStore('hydrate1', { state: { count: 0 } });
      const store2 = defineStore('hydrate2', { state: { name: '' } });

      const json = JSON.stringify({
        hydrate1: { count: 999 },
        hydrate2: { name: 'restored' },
      });

      storeRegistry.hydrate(json);

      expect(store1.count()).toBe(999);
      expect(store2.name()).toBe('restored');
    });

    it('should ignore unknown stores in JSON', () => {
      defineStore('known', { state: { value: 0 } });

      const json = JSON.stringify({
        known: { value: 42 },
        unknown: { foo: 'bar' },
      });

      // Should not throw
      expect(() => storeRegistry.hydrate(json)).not.toThrow();
    });

    it('should ignore unknown keys in JSON', () => {
      const store = defineStore('partial', { state: { a: 1, b: 2 } });

      const json = JSON.stringify({
        partial: { a: 100, unknownKey: 'ignored' },
      });

      storeRegistry.hydrate(json);

      expect(store.a()).toBe(100);
      expect(store.b()).toBe(2); // Unchanged
    });
  });

  describe('unregister()', () => {
    it('should remove a store from registry', () => {
      defineStore('removable', { state: { value: 1 } });
      expect(storeRegistry.list()).toContain('removable');

      storeRegistry.unregister('removable');
      expect(storeRegistry.list()).not.toContain('removable');
    });

    it('should clean up watchers when unregistered', () => {
      const store = defineStore('watchCleanup', { state: { value: 0 } });

      const changes: unknown[] = [];
      const unsubscribe = storeRegistry.onAnyChange((_, __, newValue) => {
        changes.push(newValue);
      });

      store.value.set(1);
      expect(changes).toContain(1);

      storeRegistry.unregister('watchCleanup');

      // Create a new store with same name
      const store2 = defineStore('watchCleanup', { state: { value: 0 } });
      store2.value.set(2);

      // Should still receive updates for the new store
      expect(changes).toContain(2);

      unsubscribe();
    });
  });

  describe('clear()', () => {
    it('should remove all stores', () => {
      defineStore('clear1', { state: { a: 1 } });
      defineStore('clear2', { state: { b: 2 } });
      defineStore('clear3', { state: { c: 3 } });

      expect(storeRegistry.list()).toHaveLength(3);

      storeRegistry.clear();

      expect(storeRegistry.list()).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should retrieve a store by name', () => {
      defineStore('gettable', { state: { value: 42 } });
      const retrieved = storeRegistry.get<{ value: number }>('gettable');

      expect(retrieved).toBeDefined();
      expect(retrieved?.value()).toBe(42);
    });

    it('should return undefined for non-existent store', () => {
      expect(storeRegistry.get('nonexistent')).toBeUndefined();
    });
  });
});
