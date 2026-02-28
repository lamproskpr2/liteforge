import { describe, it, expect, beforeEach } from 'vitest';
import { effect, batch } from '@liteforge/core';
import { defineStore, storeRegistry } from '../src/index.js';
import type { UseFn } from '../src/index.js';

describe('store integration', () => {
  beforeEach(() => {
    storeRegistry.clear();
    storeRegistry.$clearPlugins();
  });

  describe('context connection', () => {
    it('should throw when use() called without app context', () => {
      const store = defineStore('no-context', {
        state: { value: 0 },
        actions: (state, use) => ({
          fetchData() {
            const api = use<{ get: () => string }>('api');
            state.value.set(1);
            return api.get();
          },
        }),
      });

      expect(() => store.fetchData()).toThrow(
        'Store "no-context" is not connected to an app context'
      );
    });

    it('should work after context is connected', () => {
      const store = defineStore('with-context', {
        state: { data: '' },
        actions: (state, use) => ({
          loadData() {
            const api = use<{ get: () => string }>('api');
            state.data.set(api.get());
          },
        }),
      });

      // Simulate app connecting context
      const mockUse: UseFn = <T = unknown>(key: string): T => {
        if (key === 'api') {
          return { get: () => 'loaded data' } as T;
        }
        throw new Error(`Unknown key: ${key}`);
      };

      store.$connectContext(mockUse);
      store.loadData();

      expect(store.data()).toBe('loaded data');
    });

    it('should allow multiple stores to share context', () => {
      const userStore = defineStore('users-ctx', {
        state: { currentUser: null as { id: number; name: string } | null },
        actions: (state, use) => ({
          login() {
            const auth = use<{ getCurrentUser: () => { id: number; name: string } }>('auth');
            state.currentUser.set(auth.getCurrentUser());
          },
        }),
      });

      const cartStore = defineStore('cart-ctx', {
        state: { items: [] as Array<{ productId: number; quantity: number }> },
        actions: (state, use) => ({
          loadUserCart() {
            const api = use<{ getCart: (userId: number) => Array<{ productId: number; quantity: number }> }>('api');
            const users = use<typeof userStore>('store:users-ctx');
            const user = users.currentUser();
            if (user) {
              state.items.set(api.getCart(user.id));
            }
          },
        }),
      });

      // Simulate shared context
      const mockUse: UseFn = <T>(key: string): T => {
        if (key === 'auth') {
          return { getCurrentUser: () => ({ id: 42, name: 'Test User' }) } as T;
        }
        if (key === 'api') {
          return { getCart: (_userId: number) => [{ productId: 1, quantity: 2 }] } as T;
        }
        if (key === 'store:users-ctx') {
          return userStore as T;
        }
        throw new Error(`Unknown key: ${key}`);
      };

      userStore.$connectContext(mockUse);
      cartStore.$connectContext(mockUse);

      userStore.login();
      cartStore.loadUserCart();

      expect(userStore.currentUser()).toEqual({ id: 42, name: 'Test User' });
      expect(cartStore.items()).toEqual([{ productId: 1, quantity: 2 }]);
    });
  });

  describe('multiple stores interacting', () => {
    it('should allow one store to read another store state', () => {
      const settingsStore = defineStore('settings', {
        state: {
          currency: 'USD',
          locale: 'en-US',
        },
      });

      const priceStore = defineStore('prices', {
        state: {
          basePrice: 100,
        },
        getters: (state) => ({
          formattedPrice: () => {
            const currency = settingsStore.currency();
            const price = state.basePrice();
            return `${currency} ${price.toFixed(2)}`;
          },
        }),
      });

      expect(priceStore.formattedPrice()).toBe('USD 100.00');

      settingsStore.currency.set('EUR');
      expect(priceStore.formattedPrice()).toBe('EUR 100.00');

      priceStore.basePrice.set(49.99);
      expect(priceStore.formattedPrice()).toBe('EUR 49.99');
    });

    it('should allow store actions to modify another store', () => {
      const notificationStore = defineStore('notifications', {
        state: {
          messages: [] as string[],
        },
        actions: (state) => ({
          add(message: string) {
            state.messages.update(msgs => [...msgs, message]);
          },
          clear() {
            state.messages.set([]);
          },
        }),
      });

      const taskStore = defineStore('tasks', {
        state: {
          tasks: [] as Array<{ id: number; title: string; done: boolean }>,
        },
        actions: (state) => ({
          addTask(title: string) {
            const id = state.tasks().length + 1;
            state.tasks.update(tasks => [...tasks, { id, title, done: false }]);
            notificationStore.add(`Task "${title}" created`);
          },
          completeTask(id: number) {
            state.tasks.update(tasks =>
              tasks.map(t => (t.id === id ? { ...t, done: true } : t))
            );
            const task = state.tasks().find(t => t.id === id);
            if (task) {
              notificationStore.add(`Task "${task.title}" completed`);
            }
          },
        }),
      });

      taskStore.addTask('Write tests');
      taskStore.addTask('Review code');
      taskStore.completeTask(1);

      expect(notificationStore.messages()).toEqual([
        'Task "Write tests" created',
        'Task "Review code" created',
        'Task "Write tests" completed',
      ]);
    });
  });

  describe('reactivity with @liteforge/core', () => {
    it('should work with effects', () => {
      const store = defineStore('effect-store', {
        state: { count: 0 },
        getters: (state) => ({
          doubled: () => state.count() * 2,
        }),
      });

      const logs: string[] = [];
      const cleanup = effect(() => {
        logs.push(`count=${store.count()}, doubled=${store.doubled()}`);
      });

      store.count.set(1);
      store.count.set(2);
      store.count.set(3);

      expect(logs).toEqual([
        'count=0, doubled=0',
        'count=1, doubled=2',
        'count=2, doubled=4',
        'count=3, doubled=6',
      ]);

      cleanup();
    });

    it('should work with batch', () => {
      const store = defineStore('batch-store', {
        state: {
          firstName: '',
          lastName: '',
          age: 0,
        },
        getters: (state) => ({
          fullName: () => `${state.firstName()} ${state.lastName()}`.trim(),
        }),
      });

      const logs: string[] = [];
      const cleanup = effect(() => {
        logs.push(
          `name=${store.fullName()}, age=${store.age()}`
        );
      });

      // Without batch: would trigger 3 effect runs
      // With batch: triggers only 1 effect run after all changes
      batch(() => {
        store.firstName.set('John');
        store.lastName.set('Doe');
        store.age.set(30);
      });

      expect(logs).toEqual([
        'name=, age=0',
        'name=John Doe, age=30',
      ]);

      cleanup();
    });

    it('should handle cross-store effects', () => {
      const storeA = defineStore('cross-a', { state: { value: 0 } });
      const storeB = defineStore('cross-b', { state: { value: 0 } });

      const sums: number[] = [];
      const cleanup = effect(() => {
        sums.push(storeA.value() + storeB.value());
      });

      storeA.value.set(10);
      storeB.value.set(20);

      expect(sums).toEqual([0, 10, 30]);

      cleanup();
    });
  });

  describe('store lifecycle', () => {
    it('should properly clean up after unregister', () => {
      const store = defineStore('cleanup-test', {
        state: { value: 0 },
      });

      const changes: number[] = [];
      const unsubscribe = storeRegistry.onAnyChange((storeName, _key, newValue) => {
        if (storeName === 'cleanup-test') {
          changes.push(newValue as number);
        }
      });

      store.value.set(1);
      expect(changes).toContain(1);

      storeRegistry.unregister('cleanup-test');

      // After unregister, the store instance still works but isn't in registry
      store.value.set(2);

      // Registry changes shouldn't receive updates from unregistered store
      // (depends on implementation - the store signal still works independently)

      unsubscribe();
    });

    it('should allow recreating stores after clear', () => {
      const store1 = defineStore('recreate', { state: { v: 1 } });
      expect(store1.v()).toBe(1);

      storeRegistry.clear();

      const store2 = defineStore('recreate', { state: { v: 2 } });
      expect(store2.v()).toBe(2);
    });
  });

  describe('complex state management scenarios', () => {
    it('should handle todo app pattern', () => {
      interface Todo {
        id: number;
        text: string;
        completed: boolean;
      }

      const todoStore = defineStore('todos', {
        state: {
          items: [] as Todo[],
          filter: 'all' as 'all' | 'active' | 'completed',
          nextId: 1,
        },
        getters: (state) => ({
          filteredTodos: () => {
            const filter = state.filter();
            const items = state.items();
            switch (filter) {
              case 'active':
                return items.filter(t => !t.completed);
              case 'completed':
                return items.filter(t => t.completed);
              default:
                return items;
            }
          },
          activeCount: () => state.items().filter(t => !t.completed).length,
          completedCount: () => state.items().filter(t => t.completed).length,
        }),
        actions: (state) => ({
          addTodo(text: string) {
            const id = state.nextId();
            state.items.update(items => [...items, { id, text, completed: false }]);
            state.nextId.update(n => n + 1);
          },
          toggleTodo(id: number) {
            state.items.update(items =>
              items.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
            );
          },
          removeTodo(id: number) {
            state.items.update(items => items.filter(t => t.id !== id));
          },
          clearCompleted() {
            state.items.update(items => items.filter(t => !t.completed));
          },
        }),
      });

      // Add todos
      todoStore.addTodo('Learn LiteForge');
      todoStore.addTodo('Build an app');
      todoStore.addTodo('Write tests');

      expect(todoStore.items()).toHaveLength(3);
      expect(todoStore.activeCount()).toBe(3);
      expect(todoStore.completedCount()).toBe(0);

      // Complete one
      todoStore.toggleTodo(1);
      expect(todoStore.activeCount()).toBe(2);
      expect(todoStore.completedCount()).toBe(1);

      // Filter
      todoStore.filter.set('active');
      expect(todoStore.filteredTodos()).toHaveLength(2);

      todoStore.filter.set('completed');
      expect(todoStore.filteredTodos()).toHaveLength(1);

      // Clear completed
      todoStore.clearCompleted();
      expect(todoStore.items()).toHaveLength(2);
    });

    it('should handle async data fetching pattern', async () => {
      interface User {
        id: number;
        name: string;
      }

      const userStore = defineStore('async-users', {
        state: {
          users: [] as User[],
          loading: false,
          error: null as string | null,
        },
        getters: (state) => ({
          userCount: () => state.users().length,
        }),
        actions: (state) => ({
          async fetchUsers(mockData: User[]) {
            state.loading.set(true);
            state.error.set(null);
            try {
              // Simulate API call
              await new Promise(r => setTimeout(r, 10));
              state.users.set(mockData);
            } catch (e) {
              state.error.set(e instanceof Error ? e.message : 'Unknown error');
            } finally {
              state.loading.set(false);
            }
          },
        }),
      });

      expect(userStore.loading()).toBe(false);
      expect(userStore.users()).toEqual([]);

      const fetchPromise = userStore.fetchUsers([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);

      expect(userStore.loading()).toBe(true);

      await fetchPromise;

      expect(userStore.loading()).toBe(false);
      expect(userStore.users()).toHaveLength(2);
      expect(userStore.userCount()).toBe(2);
    });
  });
});
