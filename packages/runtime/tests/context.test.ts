import { describe, it, expect, beforeEach } from 'vitest';
import {
  use,
  hasContext,
  pushContext,
  popContext,
  initAppContext,
  clearContext,
  getContextDepth,
  withContext,
} from '../src/context.js';

describe('context', () => {
  beforeEach(() => {
    clearContext();
  });

  describe('initAppContext', () => {
    it('should initialize app-level context', () => {
      initAppContext({ api: 'api-client', theme: 'dark' });

      expect(use('api')).toBe('api-client');
      expect(use('theme')).toBe('dark');
    });

    it('should clear existing context on init', () => {
      initAppContext({ first: 'value' });
      pushContext({ second: 'value' });

      initAppContext({ new: 'context' });

      expect(getContextDepth()).toBe(1);
      expect(use('new')).toBe('context');
      expect(hasContext('first')).toBe(false);
    });
  });

  describe('use', () => {
    it('should return value from context', () => {
      initAppContext({ key: 'value' });
      expect(use('key')).toBe('value');
    });

    it('should throw if key not found', () => {
      initAppContext({});
      expect(() => use('missing')).toThrow('Context key "missing" not found');
    });

    it('should return typed value', () => {
      initAppContext({ count: 42 });
      const count = use<number>('count');
      expect(count).toBe(42);
    });
  });

  describe('hasContext', () => {
    it('should return true if key exists', () => {
      initAppContext({ key: 'value' });
      expect(hasContext('key')).toBe(true);
    });

    it('should return false if key does not exist', () => {
      initAppContext({});
      expect(hasContext('missing')).toBe(false);
    });

    it('should check all scopes', () => {
      initAppContext({ app: 'value' });
      pushContext({ component: 'value' });

      expect(hasContext('app')).toBe(true);
      expect(hasContext('component')).toBe(true);
    });
  });

  describe('pushContext / popContext', () => {
    it('should add a new scope', () => {
      initAppContext({ app: 'app-value' });
      pushContext({ component: 'component-value' });

      expect(getContextDepth()).toBe(2);
      expect(use('app')).toBe('app-value');
      expect(use('component')).toBe('component-value');
    });

    it('should allow overriding values in child scope', () => {
      initAppContext({ theme: 'light' });
      pushContext({ theme: 'dark' });

      expect(use('theme')).toBe('dark');
    });

    it('should restore parent scope on pop', () => {
      initAppContext({ theme: 'light' });
      pushContext({ theme: 'dark' });

      expect(use('theme')).toBe('dark');

      popContext();

      expect(use('theme')).toBe('light');
    });

    it('should support multiple nested scopes', () => {
      initAppContext({ level: 0 });
      pushContext({ level: 1 });
      pushContext({ level: 2 });
      pushContext({ level: 3 });

      expect(getContextDepth()).toBe(4);
      expect(use('level')).toBe(3);

      popContext();
      expect(use('level')).toBe(2);

      popContext();
      expect(use('level')).toBe(1);

      popContext();
      expect(use('level')).toBe(0);
    });
  });

  describe('withContext', () => {
    it('should run function within a scope', () => {
      initAppContext({ value: 'outer' });

      const result = withContext({ value: 'inner' }, () => {
        return use('value');
      });

      expect(result).toBe('inner');
      expect(use('value')).toBe('outer');
    });

    it('should auto-pop scope even on error', () => {
      initAppContext({ value: 'outer' });

      expect(() => {
        withContext({ value: 'inner' }, () => {
          throw new Error('test error');
        });
      }).toThrow('test error');

      expect(getContextDepth()).toBe(1);
      expect(use('value')).toBe('outer');
    });

    it('should support nested withContext calls', () => {
      initAppContext({ a: 1 });

      withContext({ b: 2 }, () => {
        expect(use('a')).toBe(1);
        expect(use('b')).toBe(2);

        withContext({ c: 3 }, () => {
          expect(use('a')).toBe(1);
          expect(use('b')).toBe(2);
          expect(use('c')).toBe(3);
        });

        expect(hasContext('c')).toBe(false);
      });

      expect(hasContext('b')).toBe(false);
    });
  });

  describe('clearContext', () => {
    it('should remove all context scopes', () => {
      initAppContext({ app: 'value' });
      pushContext({ first: 'value' });
      pushContext({ second: 'value' });

      clearContext();

      expect(getContextDepth()).toBe(0);
    });
  });

  describe('getContextDepth', () => {
    it('should return 0 when no context', () => {
      expect(getContextDepth()).toBe(0);
    });

    it('should track depth correctly', () => {
      initAppContext({});
      expect(getContextDepth()).toBe(1);

      pushContext({});
      expect(getContextDepth()).toBe(2);

      pushContext({});
      expect(getContextDepth()).toBe(3);

      popContext();
      expect(getContextDepth()).toBe(2);
    });
  });
});
