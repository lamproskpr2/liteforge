/**
 * Singleton Tests for defineStore
 * 
 * Verifies that defineStore returns the same instance for the same store name,
 * eliminating the need for manual singleton wrappers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { defineStore, storeRegistry } from '../src/index.js';

describe('defineStore Singleton', () => {
  beforeEach(() => {
    storeRegistry.clear();
  });

  it('returns same instance for same name', () => {
    const store1 = defineStore('singleton-test-1', {
      state: { count: 0 },
    });
    const store2 = defineStore('singleton-test-1', {
      state: { count: 0 },
    });

    expect(store1).toBe(store2);
  });

  it('preserves state when re-accessed', () => {
    const store1 = defineStore('singleton-test-2', {
      state: { count: 0 },
    });
    store1.count.set(42);

    const store2 = defineStore('singleton-test-2', {
      state: { count: 0 },
    });
    expect(store2.count()).toBe(42);
  });

  it('different names create different instances', () => {
    const store1 = defineStore('singleton-a', { state: { x: 1 } });
    const store2 = defineStore('singleton-b', { state: { x: 2 } });

    expect(store1).not.toBe(store2);
    expect(store1.x()).toBe(1);
    expect(store2.x()).toBe(2);
  });

  it('singleton works across multiple imports (simulated)', () => {
    // Simulating what happens when the same store is imported in multiple files
    function createUserStore() {
      return defineStore('users', {
        state: {
          currentUser: null as { name: string } | null,
        },
        actions: (state) => ({
          setUser(name: string) {
            state.currentUser.set({ name });
          },
        }),
      });
    }

    // First "import"
    const userStoreA = createUserStore();
    userStoreA.setUser('Alice');

    // Second "import" in another file
    const userStoreB = createUserStore();
    
    // Should be the same instance with same state
    expect(userStoreA).toBe(userStoreB);
    expect(userStoreB.currentUser()).toEqual({ name: 'Alice' });
  });

  it('allows fresh store after unregister', () => {
    const store1 = defineStore('fresh-after-unregister', {
      state: { value: 'first' },
    });
    expect(store1.value()).toBe('first');

    storeRegistry.unregister('fresh-after-unregister');

    const store2 = defineStore('fresh-after-unregister', {
      state: { value: 'second' },
    });

    // After unregister, a new store is created
    expect(store2.value()).toBe('second');
  });
});

describe('Flat Store API', () => {
  beforeEach(() => {
    storeRegistry.clear();
  });

  it('exposes state signals directly on store', () => {
    const store = defineStore('flat-1', {
      state: { count: 0, name: 'test' },
    });

    // State signals are directly on the store
    expect(store.count()).toBe(0);
    expect(store.name()).toBe('test');
    expect(typeof store.count.set).toBe('function');
    expect(typeof store.count.update).toBe('function');
  });

  it('exposes getters directly on store', () => {
    const store = defineStore('flat-2', {
      state: { count: 5 },
      getters: (state) => ({
        doubled: () => state.count() * 2,
      }),
    });

    // Getters are directly on the store
    expect(store.doubled()).toBe(10);
  });

  it('exposes actions directly on store', () => {
    const store = defineStore('flat-3', {
      state: { count: 0 },
      actions: (state) => ({
        increment() { state.count.update(n => n + 1); },
      }),
    });

    // Actions are directly on the store
    store.increment();
    expect(store.count()).toBe(1);
  });

  it('has $name meta property', () => {
    const store = defineStore('flat-4', { state: { x: 0 } });
    expect(store.$name).toBe('flat-4');
  });

  it('has $reset method', () => {
    const store = defineStore('flat-5', {
      state: { count: 0, name: 'initial' },
    });

    store.count.set(99);
    store.name.set('changed');
    store.$reset();

    expect(store.count()).toBe(0);
    expect(store.name()).toBe('initial');
  });

  it('has $snapshot method', () => {
    const store = defineStore('flat-6', {
      state: { count: 42, name: 'test' },
    });

    const snap = store.$snapshot();
    expect(snap).toEqual({ count: 42, name: 'test' });
  });

  it('state, getters, and actions coexist on flat API', () => {
    const store = defineStore('flat-complete', {
      state: {
        items: [] as string[],
        loading: false,
      },
      getters: (state) => ({
        count: () => state.items().length,
        isEmpty: () => state.items().length === 0,
      }),
      actions: (state) => ({
        add(item: string) {
          state.items.update(list => [...list, item]);
        },
        clear() {
          state.items.set([]);
        },
        setLoading(value: boolean) {
          state.loading.set(value);
        },
      }),
    });

    // All on the same level
    expect(store.items()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.count()).toBe(0);
    expect(store.isEmpty()).toBe(true);
    
    store.add('hello');
    expect(store.items()).toEqual(['hello']);
    expect(store.count()).toBe(1);
    expect(store.isEmpty()).toBe(false);

    store.clear();
    expect(store.items()).toEqual([]);
    expect(store.isEmpty()).toBe(true);
  });
});
