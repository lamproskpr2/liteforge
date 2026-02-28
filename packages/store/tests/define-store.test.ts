import { describe, it, expect, beforeEach } from 'vitest';
import { effect } from '@liteforge/core';
import { defineStore, storeRegistry } from '../src/index.js';

describe('defineStore', () => {
  beforeEach(() => {
    // Clear registry before each test
    storeRegistry.clear();
  });

  describe('basic store creation', () => {
    it('should create a store with state', () => {
      const store = defineStore('counter', {
        state: {
          count: 0,
          label: 'test',
        },
      });

      expect(store.$name).toBe('counter');
      expect(store.count()).toBe(0);
      expect(store.label()).toBe('test');
    });

    it('should create state properties as signals', () => {
      const store = defineStore('signals', {
        state: {
          value: 10,
        },
      });

      // Read with ()
      expect(store.value()).toBe(10);

      // Write with .set()
      store.value.set(20);
      expect(store.value()).toBe(20);

      // Update with .update()
      store.value.update(v => v + 5);
      expect(store.value()).toBe(25);
    });

    it('should handle various state types', () => {
      interface User {
        id: number;
        name: string;
      }

      const store = defineStore('types', {
        state: {
          string: 'hello',
          number: 42,
          boolean: true,
          null: null as null | string,
          array: [1, 2, 3],
          object: { foo: 'bar' } as Record<string, string>,
          nested: { user: { id: 1, name: 'John' } as User },
        },
      });

      expect(store.string()).toBe('hello');
      expect(store.number()).toBe(42);
      expect(store.boolean()).toBe(true);
      expect(store.null()).toBe(null);
      expect(store.array()).toEqual([1, 2, 3]);
      expect(store.object()).toEqual({ foo: 'bar' });
      expect(store.nested()).toEqual({ user: { id: 1, name: 'John' } });
    });
  });

  describe('getters', () => {
    it('should create getters from state', () => {
      const store = defineStore('getters', {
        state: {
          items: [1, 2, 3, 4, 5],
          filter: 'all' as 'all' | 'even' | 'odd',
        },
        getters: (state) => ({
          count: () => state.items().length,
          sum: () => state.items().reduce((a, b) => a + b, 0),
          filtered: () => {
            const filter = state.filter();
            const items = state.items();
            if (filter === 'even') return items.filter(i => i % 2 === 0);
            if (filter === 'odd') return items.filter(i => i % 2 !== 0);
            return items;
          },
        }),
      });

      expect(store.count()).toBe(5);
      expect(store.sum()).toBe(15);
      expect(store.filtered()).toEqual([1, 2, 3, 4, 5]);

      store.filter.set('even');
      expect(store.filtered()).toEqual([2, 4]);

      store.filter.set('odd');
      expect(store.filtered()).toEqual([1, 3, 5]);
    });

    it('should update getters when state changes', () => {
      const store = defineStore('reactive-getters', {
        state: {
          count: 0,
        },
        getters: (state) => ({
          doubled: () => state.count() * 2,
          isPositive: () => state.count() > 0,
        }),
      });

      expect(store.doubled()).toBe(0);
      expect(store.isPositive()).toBe(false);

      store.count.set(5);
      expect(store.doubled()).toBe(10);
      expect(store.isPositive()).toBe(true);

      store.count.set(-3);
      expect(store.doubled()).toBe(-6);
      expect(store.isPositive()).toBe(false);
    });

    it('should support getters with arguments', () => {
      const store = defineStore('arg-getters', {
        state: {
          users: [
            { id: 1, name: 'Alice', role: 'admin' },
            { id: 2, name: 'Bob', role: 'user' },
            { id: 3, name: 'Charlie', role: 'admin' },
          ],
        },
        getters: (state) => ({
          byId: (id: number) => state.users().find(u => u.id === id),
          byRole: (role: string) => state.users().filter(u => u.role === role),
        }),
      });

      expect(store.byId(1)).toEqual({ id: 1, name: 'Alice', role: 'admin' });
      expect(store.byId(99)).toBeUndefined();
      expect(store.byRole('admin')).toHaveLength(2);
      expect(store.byRole('user')).toHaveLength(1);
    });
  });

  describe('actions', () => {
    it('should create actions that modify state', () => {
      const store = defineStore('actions', {
        state: {
          count: 0,
        },
        actions: (state) => ({
          increment() {
            state.count.update(c => c + 1);
          },
          decrement() {
            state.count.update(c => c - 1);
          },
          setCount(value: number) {
            state.count.set(value);
          },
        }),
      });

      expect(store.count()).toBe(0);

      store.increment();
      expect(store.count()).toBe(1);

      store.increment();
      store.increment();
      expect(store.count()).toBe(3);

      store.decrement();
      expect(store.count()).toBe(2);

      store.setCount(100);
      expect(store.count()).toBe(100);
    });

    it('should support async actions', async () => {
      const store = defineStore('async-actions', {
        state: {
          loading: false,
          data: null as string | null,
          error: null as string | null,
        },
        actions: (state) => ({
          async fetchData() {
            state.loading.set(true);
            state.error.set(null);
            try {
              // Simulate async operation
              await new Promise(r => setTimeout(r, 10));
              state.data.set('fetched data');
            } catch (e) {
              state.error.set(e instanceof Error ? e.message : String(e));
            } finally {
              state.loading.set(false);
            }
          },
          async fetchWithError() {
            state.loading.set(true);
            try {
              await new Promise((_, reject) => setTimeout(() => reject(new Error('Network error')), 10));
            } catch (e) {
              state.error.set(e instanceof Error ? e.message : String(e));
            } finally {
              state.loading.set(false);
            }
          },
        }),
      });

      expect(store.loading()).toBe(false);
      expect(store.data()).toBe(null);

      const fetchPromise = store.fetchData();
      expect(store.loading()).toBe(true);

      await fetchPromise;
      expect(store.loading()).toBe(false);
      expect(store.data()).toBe('fetched data');

      await store.fetchWithError();
      expect(store.error()).toBe('Network error');
    });

    it('should allow actions to call other actions', () => {
      const store = defineStore('chained-actions', {
        state: {
          value: 0,
        },
        actions: (state) => {
          const increment = () => state.value.update(v => v + 1);
          const incrementBy = (amount: number) => {
            for (let i = 0; i < amount; i++) {
              increment();
            }
          };
          return { increment, incrementBy };
        },
      });

      store.incrementBy(5);
      expect(store.value()).toBe(5);
    });
  });

  describe('$reset', () => {
    it('should reset state to initial values', () => {
      const store = defineStore('resettable', {
        state: {
          count: 0,
          items: [] as string[],
          user: null as { name: string } | null,
        },
      });

      store.count.set(100);
      store.items.set(['a', 'b', 'c']);
      store.user.set({ name: 'John' });

      expect(store.count()).toBe(100);
      expect(store.items()).toEqual(['a', 'b', 'c']);
      expect(store.user()).toEqual({ name: 'John' });

      store.$reset();

      expect(store.count()).toBe(0);
      expect(store.items()).toEqual([]);
      expect(store.user()).toBe(null);
    });

    it('should deep clone initial values on reset', () => {
      const store = defineStore('deep-reset', {
        state: {
          nested: { value: 1 },
          array: [{ id: 1 }],
        },
      });

      // Mutate the objects
      store.nested.set({ value: 999 });
      store.array.set([{ id: 2 }, { id: 3 }]);

      store.$reset();

      // Should be back to initial values
      expect(store.nested()).toEqual({ value: 1 });
      expect(store.array()).toEqual([{ id: 1 }]);

      // Verify it's a new object, not the same reference
      const nested1 = store.nested();
      store.$reset();
      const nested2 = store.nested();
      expect(nested1).not.toBe(nested2);
    });
  });

  describe('$snapshot', () => {
    it('should return plain object of current state', () => {
      const store = defineStore('snapshot', {
        state: {
          count: 0,
          name: 'test',
          items: [1, 2, 3],
        },
      });

      const snapshot = store.$snapshot();

      expect(snapshot).toEqual({
        count: 0,
        name: 'test',
        items: [1, 2, 3],
      });

      // Modify state and check new snapshot
      store.count.set(10);
      store.items.set([4, 5, 6]);

      const snapshot2 = store.$snapshot();
      expect(snapshot2).toEqual({
        count: 10,
        name: 'test',
        items: [4, 5, 6],
      });
    });
  });

  describe('$watch', () => {
    it('should watch a specific state key', () => {
      const store = defineStore('watchable', {
        state: {
          count: 0,
          name: 'test',
        },
      });

      const countChanges: Array<{ newValue: number; oldValue: number }> = [];
      const unwatch = store.$watch('count', (newValue, oldValue) => {
        countChanges.push({ newValue, oldValue });
      });

      store.count.set(1);
      store.count.set(2);
      store.count.set(3);

      expect(countChanges).toEqual([
        { newValue: 1, oldValue: 0 },
        { newValue: 2, oldValue: 1 },
        { newValue: 3, oldValue: 2 },
      ]);

      // Changes to other keys shouldn't trigger
      store.name.set('changed');
      expect(countChanges).toHaveLength(3);

      // Unwatch should stop notifications
      unwatch();
      store.count.set(100);
      expect(countChanges).toHaveLength(3);
    });
  });

  describe('$onChange', () => {
    it('should watch any state key change', () => {
      const store = defineStore('onchange', {
        state: {
          a: 1,
          b: 'hello',
          c: true,
        },
      });

      const changes: Array<{ key: string; newValue: unknown; oldValue: unknown }> = [];
      const unwatch = store.$onChange((key, newValue, oldValue) => {
        changes.push({ key, newValue, oldValue });
      });

      store.a.set(2);
      store.b.set('world');
      store.c.set(false);

      expect(changes).toEqual([
        { key: 'a', newValue: 2, oldValue: 1 },
        { key: 'b', newValue: 'world', oldValue: 'hello' },
        { key: 'c', newValue: false, oldValue: true },
      ]);

      unwatch();
      store.a.set(999);
      expect(changes).toHaveLength(3);
    });
  });

  describe('store variants', () => {
    it('should work without getters', () => {
      const store = defineStore('no-getters', {
        state: {
          value: 0,
        },
        actions: (state) => ({
          increment() {
            state.value.update(v => v + 1);
          },
        }),
      });

      expect(store.value()).toBe(0);
      store.increment();
      expect(store.value()).toBe(1);
    });

    it('should work without actions', () => {
      const store = defineStore('no-actions', {
        state: {
          count: 0,
        },
        getters: (state) => ({
          doubled: () => state.count() * 2,
        }),
      });

      expect(store.doubled()).toBe(0);
      store.count.set(5);
      expect(store.doubled()).toBe(10);
    });

    it('should work with only state (minimal store)', () => {
      const store = defineStore('minimal', {
        state: {
          value: 42,
        },
      });

      expect(store.value()).toBe(42);
      store.value.set(100);
      expect(store.value()).toBe(100);
      
      store.$reset();
      expect(store.value()).toBe(42);
    });
  });

  describe('reactivity integration', () => {
    it('should work with effects from @liteforge/core', () => {
      const store = defineStore('effect-test', {
        state: {
          count: 0,
        },
      });

      const values: number[] = [];
      const cleanup = effect(() => {
        values.push(store.count());
      });

      store.count.set(1);
      store.count.set(2);
      store.count.set(3);

      expect(values).toEqual([0, 1, 2, 3]);

      cleanup();
    });

    it('getters should be reactive in effects', () => {
      const store = defineStore('getter-effect', {
        state: {
          items: [1, 2, 3],
        },
        getters: (state) => ({
          sum: () => state.items().reduce((a, b) => a + b, 0),
        }),
      });

      const sums: number[] = [];
      const cleanup = effect(() => {
        sums.push(store.sum());
      });

      store.items.set([1, 2, 3, 4]);
      store.items.set([10, 20]);

      expect(sums).toEqual([6, 10, 30]);

      cleanup();
    });
  });
});
