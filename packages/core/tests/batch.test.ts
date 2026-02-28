import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { effect } from '../src/effect.js';
import { batch } from '../src/batch.js';
import { computed } from '../src/computed.js';

describe('batch', () => {
  describe('deferred notifications', () => {
    it('should run effect only once after batch', () => {
      const a = signal(1);
      const b = signal(2);
      const spy = vi.fn();

      effect(() => {
        spy(a() + b());
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(3);

      batch(() => {
        a.set(10);
        b.set(20);
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(30);
    });

    it('should batch many updates', () => {
      const signals = Array.from({ length: 10 }, (_, i) => signal(i));
      const spy = vi.fn();

      effect(() => {
        spy(signals.reduce((sum, s) => sum + s(), 0));
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(45); // 0+1+2+...+9

      batch(() => {
        for (let i = 0; i < signals.length; i++) {
          signals[i]!.set(i * 10);
        }
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(450);
    });
  });

  describe('nested batches', () => {
    it('should support nested batches', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      const spy = vi.fn();

      effect(() => {
        spy(a() + b() + c());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      batch(() => {
        a.set(10);
        batch(() => {
          b.set(20);
          batch(() => {
            c.set(30);
          });
          // Still in outer batch, no flush yet
        });
        // Still in outer batch, no flush yet
      });
      // Outermost batch ends, flush

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(60);
    });

    it('should only flush at outermost batch', () => {
      const count = signal(0);
      const values: number[] = [];

      effect(() => {
        values.push(count());
      });

      expect(values).toEqual([0]);

      batch(() => {
        count.set(1);
        expect(values).toEqual([0]); // Not flushed yet

        batch(() => {
          count.set(2);
          expect(values).toEqual([0]); // Still not flushed
        });

        expect(values).toEqual([0]); // Inner batch ended, but still in outer
        count.set(3);
      });

      // Now flushed
      expect(values).toEqual([0, 3]);
    });
  });

  describe('with computeds', () => {
    it('should batch computed updates', () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a() + b());
      const spy = vi.fn();

      effect(() => {
        spy(sum());
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(3);

      batch(() => {
        a.set(10);
        b.set(20);
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(30);
    });

    it('should handle chain of computeds in batch', () => {
      const count = signal(1);
      const doubled = computed(() => count() * 2);
      const quadrupled = computed(() => doubled() * 2);
      const spy = vi.fn();

      effect(() => {
        spy(quadrupled());
      });

      expect(spy).toHaveBeenCalledWith(4);

      batch(() => {
        count.set(2);
        count.set(3);
        count.set(4);
      });

      // Should only run once with final value
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(16);
    });
  });

  describe('error handling', () => {
    it('should still flush even if batch function throws', () => {
      const count = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(count());
      });

      expect(() => {
        batch(() => {
          count.set(1);
          throw new Error('oops');
        });
      }).toThrow('oops');

      // Batch should still have flushed
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(1);
    });
  });

  describe('deduplication', () => {
    it('should deduplicate multiple updates to same signal', () => {
      const count = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(count());
      });

      batch(() => {
        count.set(1);
        count.set(2);
        count.set(3);
        count.set(4);
        count.set(5);
      });

      // Effect should run only once after batch (with final value)
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(5);
    });
  });
});
