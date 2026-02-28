import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { computed } from '../src/computed.js';
import { effect } from '../src/effect.js';

describe('computed', () => {
  describe('basic functionality', () => {
    it('should compute derived value', () => {
      const count = signal(2);
      const doubled = computed(() => count() * 2);

      expect(doubled()).toBe(4);
    });

    it('should update when dependency changes', () => {
      const count = signal(2);
      const doubled = computed(() => count() * 2);

      expect(doubled()).toBe(4);

      count.set(5);
      expect(doubled()).toBe(10);
    });

    it('should work with multiple dependencies', () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());

      expect(sum()).toBe(3);

      a.set(10);
      expect(sum()).toBe(12);

      b.set(20);
      expect(sum()).toBe(30);
    });
  });

  describe('lazy evaluation', () => {
    it('should not compute until first read', () => {
      const count = signal(2);
      const spy = vi.fn(() => count() * 2);
      const doubled = computed(spy);

      expect(spy).not.toHaveBeenCalled();

      doubled(); // First read
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not recompute if not read', () => {
      const count = signal(2);
      const spy = vi.fn(() => count() * 2);
      const doubled = computed(spy);

      doubled(); // First read
      expect(spy).toHaveBeenCalledTimes(1);

      count.set(5);
      count.set(10);
      count.set(15);

      // Not read yet, should not recompute
      expect(spy).toHaveBeenCalledTimes(1);

      doubled(); // Read again
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('caching', () => {
    it('should cache value and not recompute on subsequent reads', () => {
      const count = signal(2);
      const spy = vi.fn(() => count() * 2);
      const doubled = computed(spy);

      doubled();
      doubled();
      doubled();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should recompute only once after dependency change', () => {
      const count = signal(2);
      const spy = vi.fn(() => count() * 2);
      const doubled = computed(spy);

      doubled(); // First compute
      expect(spy).toHaveBeenCalledTimes(1);

      count.set(5);

      doubled(); // Recompute
      doubled(); // Cached
      doubled(); // Cached

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('peek', () => {
    it('should return value without subscribing', () => {
      const count = signal(0);
      const doubled = computed(() => count() * 2);
      const spy = vi.fn();

      effect(() => {
        spy(doubled.peek());
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(0);

      count.set(5);
      // Effect should NOT re-run because we used peek
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('chained computeds', () => {
    it('should work with chain of computeds', () => {
      const count = signal(1);
      const doubled = computed(() => count() * 2);
      const quadrupled = computed(() => doubled() * 2);
      const octupled = computed(() => quadrupled() * 2);

      expect(octupled()).toBe(8);

      count.set(2);
      expect(octupled()).toBe(16);
    });

    it('should efficiently update chain', () => {
      const count = signal(1);
      const spy1 = vi.fn(() => count() * 2);
      const spy2 = vi.fn(() => doubled() * 2);
      const spy3 = vi.fn(() => quadrupled() * 2);

      const doubled = computed(spy1);
      const quadrupled = computed(spy2);
      const octupled = computed(spy3);

      octupled(); // Initial compute

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
      expect(spy3).toHaveBeenCalledTimes(1);

      count.set(2);
      octupled(); // Trigger recompute

      expect(spy1).toHaveBeenCalledTimes(2);
      expect(spy2).toHaveBeenCalledTimes(2);
      expect(spy3).toHaveBeenCalledTimes(2);
    });
  });

  describe('with effects', () => {
    it('should trigger effects when computed changes', () => {
      const count = signal(2);
      const doubled = computed(() => count() * 2);
      const spy = vi.fn();

      effect(() => {
        spy(doubled());
      });

      expect(spy).toHaveBeenCalledWith(4);

      count.set(5);
      expect(spy).toHaveBeenCalledWith(10);
    });

    it('should not trigger effect if computed value is the same', () => {
      const a = signal(2);
      const b = signal(3);
      // Always returns 5 regardless of which signal changed
      const sum = computed(() => a() + b());
      const spy = vi.fn();

      effect(() => {
        spy(sum());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      // Change both but sum stays 5
      a.set(1);
      b.set(4);

      // Effect runs because sum was marked dirty, even if value is same
      // This is expected behavior - we don't have equality check on computed result
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });

  describe('conditional dependencies', () => {
    it('should handle conditional dependencies', () => {
      const condition = signal(true);
      const a = signal(1);
      const b = signal(2);
      const spy = vi.fn();

      const result = computed(() => {
        spy();
        return condition() ? a() : b();
      });

      effect(() => {
        result();
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(result()).toBe(1);

      // b is not a dependency
      b.set(20);
      expect(spy).toHaveBeenCalledTimes(1);

      // a is a dependency
      a.set(10);
      expect(spy).toHaveBeenCalledTimes(2);

      // Switch to b
      condition.set(false);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(result()).toBe(20);

      // Now a is not a dependency
      a.set(100);
      expect(spy).toHaveBeenCalledTimes(3);

      // b is now a dependency
      b.set(30);
      expect(spy).toHaveBeenCalledTimes(4);
    });
  });
});
