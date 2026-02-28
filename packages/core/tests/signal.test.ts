import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { effect } from '../src/effect.js';

describe('signal', () => {
  describe('reading and writing', () => {
    it('should return initial value when read', () => {
      const count = signal(0);
      expect(count()).toBe(0);
    });

    it('should return updated value after set', () => {
      const count = signal(0);
      count.set(5);
      expect(count()).toBe(5);
    });

    it('should update value using update function', () => {
      const count = signal(10);
      count.update((n) => n + 5);
      expect(count()).toBe(15);
    });

    it('should handle different value types', () => {
      const str = signal('hello');
      const bool = signal(true);
      const obj = signal({ x: 1 });
      const arr = signal([1, 2, 3]);
      const nullable = signal<string | null>(null);

      expect(str()).toBe('hello');
      expect(bool()).toBe(true);
      expect(obj()).toEqual({ x: 1 });
      expect(arr()).toEqual([1, 2, 3]);
      expect(nullable()).toBe(null);

      nullable.set('value');
      expect(nullable()).toBe('value');
    });
  });

  describe('peek', () => {
    it('should return value without subscribing', () => {
      const count = signal(0);
      const spy = vi.fn();

      effect(() => {
        // peek should not create subscription
        spy(count.peek());
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(0);

      count.set(5);
      // Effect should NOT re-run because we used peek
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Object.is comparison', () => {
    it('should not notify subscribers when value is the same', () => {
      const count = signal(5);
      const spy = vi.fn();

      effect(() => {
        spy(count());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      count.set(5); // same value
      expect(spy).toHaveBeenCalledTimes(1); // should not re-run

      count.set(6); // different value
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should handle NaN correctly', () => {
      const value = signal(NaN);
      const spy = vi.fn();

      effect(() => {
        spy(value());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      value.set(NaN); // Object.is(NaN, NaN) is true
      expect(spy).toHaveBeenCalledTimes(1); // should not re-run
    });

    it('should distinguish +0 and -0', () => {
      const value = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(value());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      value.set(-0); // Object.is(0, -0) is false
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should always notify for object references (unless same ref)', () => {
      const obj = signal({ x: 1 });
      const spy = vi.fn();

      effect(() => {
        spy(obj());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      obj.set({ x: 1 }); // different reference
      expect(spy).toHaveBeenCalledTimes(2);

      const ref = obj();
      obj.set(ref); // same reference
      expect(spy).toHaveBeenCalledTimes(2); // should not re-run
    });
  });

  describe('multiple subscribers', () => {
    it('should notify all subscribers', () => {
      const count = signal(0);
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      const spy3 = vi.fn();

      effect(() => spy1(count()));
      effect(() => spy2(count()));
      effect(() => spy3(count()));

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);

      count.set(1);

      expect(spy1).toHaveBeenCalledTimes(2);
      expect(spy2).toHaveBeenCalledTimes(2);
      expect(spy3).toHaveBeenCalledTimes(2);
    });

    it('should handle subscriber removal during notification', () => {
      const count = signal(0);
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      let dispose2: (() => void) | undefined;

      effect(() => {
        spy1(count());
      });

      dispose2 = effect(() => {
        spy2(count());
        if (count() === 1) {
          dispose2?.();
        }
      });

      count.set(1);
      count.set(2);

      // spy2 disposed itself on count() === 1, so it shouldn't run for 2
      expect(spy1).toHaveBeenCalledTimes(3);
      expect(spy2).toHaveBeenCalledTimes(2);
    });
  });
});
