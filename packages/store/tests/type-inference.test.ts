/**
 * Type Inference Tests for defineStore
 * 
 * These tests verify that TypeScript correctly infers types from state definitions
 * without requiring manual type annotations or casts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { defineStore, storeRegistry } from '../src/index.js';

describe('defineStore Type Inference', () => {
  beforeEach(() => {
    storeRegistry.clear();
  });

  describe('state signal types', () => {
    it('infers state signal types from initial values', () => {
      const store = defineStore('type-test-1', {
        state: {
          count: 0,
          name: 'test',
          active: true,
          items: [] as string[],
        },
      });

      // These assignments verify TypeScript infers correct types
      const count: number = store.count();
      const name: string = store.name();
      const active: boolean = store.active();
      const items: string[] = store.items();

      expect(count).toBe(0);
      expect(name).toBe('test');
      expect(active).toBe(true);
      expect(items).toEqual([]);
    });

    it('preserves union types from type assertions', () => {
      type Theme = 'light' | 'dark' | 'system';
      type Status = 'idle' | 'loading' | 'success' | 'error';

      const store = defineStore('type-test-unions', {
        state: {
          theme: 'system' as Theme,
          status: 'idle' as Status,
        },
      });

      // Type assertions should preserve the union type
      const theme: Theme = store.theme();
      const status: Status = store.status();

      expect(theme).toBe('system');
      expect(status).toBe('idle');

      // Setting values within the union should work
      store.theme.set('dark');
      store.status.set('loading');

      expect(store.theme()).toBe('dark');
      expect(store.status()).toBe('loading');
    });

    it('handles nullable types correctly', () => {
      interface User {
        id: string;
        name: string;
      }

      const store = defineStore('type-test-nullable', {
        state: {
          currentUser: null as User | null,
          error: null as string | null,
        },
      });

      // Nullable types should be preserved
      const user: User | null = store.currentUser();
      const error: string | null = store.error();

      expect(user).toBe(null);
      expect(error).toBe(null);

      // Setting a value
      store.currentUser.set({ id: '1', name: 'Alice' });
      expect(store.currentUser()).toEqual({ id: '1', name: 'Alice' });

      // Setting back to null
      store.currentUser.set(null);
      expect(store.currentUser()).toBe(null);
    });

    it('widens boolean literals correctly', () => {
      const store = defineStore('type-test-boolean', {
        state: {
          loading: false,
          active: true,
          visible: false,
        },
      });

      // Boolean literals should widen to boolean
      const loading: boolean = store.loading();
      const active: boolean = store.active();
      const visible: boolean = store.visible();

      expect(loading).toBe(false);
      expect(active).toBe(true);
      expect(visible).toBe(false);

      // Should be able to set to any boolean value
      store.loading.set(true);
      store.active.set(false);
      
      expect(store.loading()).toBe(true);
      expect(store.active()).toBe(false);
    });

    it('widens number literals correctly', () => {
      const store = defineStore('type-test-number', {
        state: {
          count: 0,
          limit: 100,
          offset: 0,
        },
      });

      // Number literals should widen to number
      const count: number = store.count();
      const limit: number = store.limit();
      const offset: number = store.offset();

      expect(count).toBe(0);
      expect(limit).toBe(100);
      expect(offset).toBe(0);

      // Should be able to set to any number
      store.count.set(42);
      store.limit.set(999);
      
      expect(store.count()).toBe(42);
      expect(store.limit()).toBe(999);
    });
  });

  describe('getters type inference', () => {
    it('infers getter return types', () => {
      const store = defineStore('type-test-getters', {
        state: { count: 0 },
        getters: (state) => ({
          doubled: () => state.count() * 2,
          isPositive: () => state.count() > 0,
          label: () => `Count: ${state.count()}`,
        }),
      });

      // Getter return types should be inferred
      const doubled: number = store.doubled();
      const isPositive: boolean = store.isPositive();
      const label: string = store.label();

      expect(doubled).toBe(0);
      expect(isPositive).toBe(false);
      expect(label).toBe('Count: 0');
    });

    it('provides typed state in getters callback', () => {
      interface User {
        id: string;
        name: string;
        role: 'admin' | 'user';
      }

      const store = defineStore('type-test-getter-state', {
        state: {
          users: [] as User[],
          currentUserId: null as string | null,
        },
        getters: (state) => ({
          // state.users() returns User[]
          names: () => state.users().map(u => u.name),
          admins: () => state.users().filter(u => u.role === 'admin'),
          // Getter with argument
          byId: (id: string) => state.users().find(u => u.id === id),
          // Using nullable state
          currentUser: () => {
            const id = state.currentUserId();
            if (!id) return null;
            return state.users().find(u => u.id === id) ?? null;
          },
        }),
      });

      const names: string[] = store.names();
      const admins: User[] = store.admins();
      
      expect(names).toEqual([]);
      expect(admins).toEqual([]);
    });

    it('getters work with union types from state', () => {
      type Theme = 'light' | 'dark' | 'system';

      const store = defineStore('type-test-getter-union', {
        state: {
          theme: 'system' as Theme,
        },
        getters: (state) => ({
          // state.theme() should be Theme, not string
          effectiveTheme: (): 'light' | 'dark' => {
            const theme = state.theme(); // Should be Theme
            if (theme === 'light' || theme === 'dark') return theme;
            return 'light';
          },
          isDarkMode: () => {
            const theme = state.theme();
            return theme === 'dark';
          },
        }),
      });

      const effective: 'light' | 'dark' = store.effectiveTheme();
      const isDark: boolean = store.isDarkMode();

      expect(effective).toBe('light');
      expect(isDark).toBe(false);
    });
  });

  describe('actions type inference', () => {
    it('provides typed state in actions callback', () => {
      const store = defineStore('type-test-actions', {
        state: {
          items: [] as string[],
          count: 0,
        },
        actions: (state) => ({
          add(item: string) {
            // state.items is Signal<string[]>
            state.items.update(list => [...list, item]);
          },
          clear() {
            // state.items.set() accepts string[]
            state.items.set([]);
          },
          increment() {
            // state.count.update() receives number
            state.count.update(n => n + 1);
          },
        }),
      });

      store.add('hello');
      expect(store.items()).toEqual(['hello']);
      
      store.add('world');
      expect(store.items()).toEqual(['hello', 'world']);
      
      store.clear();
      expect(store.items()).toEqual([]);

      store.increment();
      expect(store.count()).toBe(1);
    });

    it('actions work with union types', () => {
      type Status = 'idle' | 'loading' | 'success' | 'error';

      const store = defineStore('type-test-action-union', {
        state: {
          status: 'idle' as Status,
          error: null as string | null,
        },
        actions: (state) => ({
          setLoading() {
            state.status.set('loading');
          },
          setSuccess() {
            state.status.set('success');
            state.error.set(null);
          },
          setError(message: string) {
            state.status.set('error');
            state.error.set(message);
          },
        }),
      });

      store.setLoading();
      expect(store.status()).toBe('loading');

      store.setError('Something went wrong');
      expect(store.status()).toBe('error');
      expect(store.error()).toBe('Something went wrong');

      store.setSuccess();
      expect(store.status()).toBe('success');
      expect(store.error()).toBe(null);
    });
  });

  describe('$name meta property', () => {
    it('has $name meta property', () => {
      const store = defineStore('meta-test', { state: { x: 0 } });
      expect(store.$name).toBe('meta-test');
    });
  });
});
