import { describe, it, expect, vi } from 'vitest';
import { signal } from '../src/signal.js';
import { computed } from '../src/computed.js';
import { effect } from '../src/effect.js';
import { batch } from '../src/batch.js';
import { onCleanup } from '../src/cleanup.js';

describe('integration tests', () => {
  describe('diamond dependency problem', () => {
    /**
     * Diamond dependency graph:
     *
     *       A
     *      / \
     *     B   C
     *      \ /
     *       D
     *
     * When A changes, D should only update ONCE, not twice.
     */
    it('should handle diamond dependency (A -> B,C -> D)', () => {
      const a = signal(1);
      const b = computed(() => a() * 2);
      const c = computed(() => a() * 3);
      const d = computed(() => b() + c());
      const spy = vi.fn();

      effect(() => {
        spy(d());
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(5); // 2 + 3

      a.set(2);

      // D should only run once with correct value
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(10); // 4 + 6
    });

    it('should handle deeper diamond with batch', () => {
      const a = signal(1);
      const b = computed(() => a() + 1);
      const c = computed(() => a() + 2);
      const d = computed(() => b() + c());
      const e = computed(() => d() * 2);
      const spy = vi.fn();

      effect(() => {
        spy(e());
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(10); // ((1+1) + (1+2)) * 2 = 10

      batch(() => {
        a.set(5);
      });

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(26); // ((5+1) + (5+2)) * 2 = 26
    });
  });

  describe('memory and cleanup', () => {
    it('should not hold references after dispose', () => {
      const count = signal(0);
      const dispose = effect(() => {
        count();
      });

      dispose();

      // After dispose, setting should not cause any issues
      count.set(1);
      count.set(2);
      count.set(3);

      // No errors means no stale references
      expect(count()).toBe(3);
    });

    it('should clean up subscriptions when dependencies change', () => {
      const condition = signal(true);
      const a = signal(1);
      const b = signal(2);
      const cleanupA = vi.fn();
      const cleanupB = vi.fn();
      const spy = vi.fn();

      effect(() => {
        if (condition()) {
          spy('a', a());
          onCleanup(cleanupA);
        } else {
          spy('b', b());
          onCleanup(cleanupB);
        }
      });

      expect(spy).toHaveBeenCalledWith('a', 1);

      // Switch to b
      condition.set(false);
      expect(cleanupA).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('b', 2);

      // a should no longer be tracked
      a.set(100);
      expect(spy).toHaveBeenCalledTimes(2); // No additional call

      // b should be tracked
      b.set(20);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(cleanupB).toHaveBeenCalledTimes(1);
    });

    it('should clean up properly with nested effects', () => {
      const outer = signal(0);
      const inner = signal(0);
      const cleanupOuter = vi.fn();
      const cleanupInner = vi.fn();

      const dispose = effect(() => {
        outer();
        onCleanup(cleanupOuter);

        effect(() => {
          inner();
          onCleanup(cleanupInner);
        });
      });

      expect(cleanupOuter).not.toHaveBeenCalled();
      expect(cleanupInner).not.toHaveBeenCalled();

      inner.set(1);
      expect(cleanupInner).toHaveBeenCalledTimes(1);
      expect(cleanupOuter).not.toHaveBeenCalled();

      outer.set(1);
      expect(cleanupOuter).toHaveBeenCalledTimes(1);
      // Note: inner effect cleanup is called because outer re-runs and creates new inner

      dispose();
      expect(cleanupOuter).toHaveBeenCalledTimes(2);
    });
  });

  describe('complex dependency graphs', () => {
    it('should handle many signals feeding into one computed', () => {
      const signals = Array.from({ length: 20 }, (_, i) => signal(i));
      const sum = computed(() => signals.reduce((acc, s) => acc + s(), 0));
      const spy = vi.fn();

      effect(() => {
        spy(sum());
      });

      expect(spy).toHaveBeenCalledWith(190); // 0+1+2+...+19

      signals[0]!.set(100);
      expect(spy).toHaveBeenCalledWith(290);

      batch(() => {
        for (let i = 0; i < signals.length; i++) {
          signals[i]!.set(i * 2);
        }
      });

      expect(spy).toHaveBeenCalledWith(380); // 0+2+4+...+38
    });

    it('should handle one signal feeding into many computeds', () => {
      const source = signal(1);
      const computeds = Array.from({ length: 10 }, (_, i) =>
        computed(() => source() * (i + 1))
      );
      const spies = computeds.map(() => vi.fn());

      computeds.forEach((c, i) => {
        effect(() => {
          spies[i]!(c());
        });
      });

      // Initial values
      spies.forEach((spy, i) => {
        expect(spy).toHaveBeenCalledWith(i + 1);
      });

      source.set(2);

      // Updated values
      spies.forEach((spy, i) => {
        expect(spy).toHaveBeenCalledWith((i + 1) * 2);
      });
    });

    it('should handle circular-looking but acyclic graph', () => {
      // A -> B -> C
      //      ^    |
      //      +----+ (C reads B, B reads A)
      // This is actually NOT circular - C depends on B which depends on A

      const a = signal(1);
      const b = computed(() => a() + 10);
      const c = computed(() => b() + 100);
      const spy = vi.fn();

      effect(() => {
        spy({ a: a(), b: b(), c: c() });
      });

      expect(spy).toHaveBeenCalledWith({ a: 1, b: 11, c: 111 });

      a.set(2);
      expect(spy).toHaveBeenCalledWith({ a: 2, b: 12, c: 112 });
    });
  });

  describe('real-world patterns', () => {
    it('should handle todo list pattern', () => {
      interface Todo {
        id: number;
        text: string;
        completed: boolean;
      }

      const todos = signal<Todo[]>([
        { id: 1, text: 'Learn LiteForge', completed: false },
        { id: 2, text: 'Build app', completed: false },
      ]);

      const filter = signal<'all' | 'active' | 'completed'>('all');

      const filteredTodos = computed(() => {
        const list = todos();
        switch (filter()) {
          case 'active':
            return list.filter((t) => !t.completed);
          case 'completed':
            return list.filter((t) => t.completed);
          default:
            return list;
        }
      });

      const activeCount = computed(
        () => todos().filter((t) => !t.completed).length
      );

      const renderSpy = vi.fn();

      effect(() => {
        renderSpy({
          filtered: filteredTodos(),
          active: activeCount(),
        });
      });

      expect(renderSpy).toHaveBeenCalledWith({
        filtered: todos(),
        active: 2,
      });

      // Complete a todo
      todos.update((list) =>
        list.map((t) => (t.id === 1 ? { ...t, completed: true } : t))
      );

      expect(activeCount()).toBe(1);

      // Filter
      filter.set('completed');
      expect(filteredTodos()).toHaveLength(1);
      expect(filteredTodos()[0]!.id).toBe(1);
    });

    it('should handle form state pattern', () => {
      const form = {
        username: signal(''),
        email: signal(''),
        password: signal(''),
      };

      const errors = computed(() => {
        const errs: string[] = [];
        if (form.username().length < 3) errs.push('Username too short');
        if (!form.email().includes('@')) errs.push('Invalid email');
        if (form.password().length < 8) errs.push('Password too short');
        return errs;
      });

      const isValid = computed(() => errors().length === 0);
      const spy = vi.fn();

      effect(() => {
        spy({ valid: isValid(), errors: errors() });
      });

      expect(isValid()).toBe(false);
      expect(errors()).toHaveLength(3);

      batch(() => {
        form.username.set('john');
        form.email.set('john@example.com');
        form.password.set('secretpassword');
      });

      expect(isValid()).toBe(true);
      expect(errors()).toHaveLength(0);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should handle counter with history pattern', () => {
      const count = signal(0);
      const history = signal<number[]>([0]);

      // Effect to track history
      effect(() => {
        const current = count();
        const hist = history.peek(); // peek to avoid circular dependency
        if (hist[hist.length - 1] !== current) {
          history.set([...hist, current]);
        }
      });

      count.set(1);
      count.set(2);
      count.set(3);

      expect(history()).toEqual([0, 1, 2, 3]);

      // Can undo by setting count back
      count.set(history()[history().length - 2]!);
      expect(count()).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle signal set during effect execution', () => {
      const a = signal(0);
      const b = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(a());
        if (a() < 3) {
          b.set(b.peek() + 1);
        }
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(b()).toBe(1);

      a.set(1);
      expect(b()).toBe(2);

      a.set(5);
      expect(b()).toBe(2); // No change because a >= 3
    });

    it('should handle rapid sequential updates', () => {
      const count = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(count());
      });

      for (let i = 1; i <= 100; i++) {
        count.set(i);
      }

      expect(count()).toBe(100);
      expect(spy).toHaveBeenCalledTimes(101); // initial + 100 updates
    });

    it('should handle effect that disposes itself', () => {
      const count = signal(0);
      let disposeRef: (() => void) | undefined;

      disposeRef = effect(() => {
        if (count() >= 3) {
          disposeRef?.();
        }
      });

      count.set(1);
      count.set(2);
      count.set(3); // Should dispose
      count.set(4); // Should not trigger effect

      expect(count()).toBe(4);
    });

    it('should handle undefined and null signal values', () => {
      const nullable = signal<string | null | undefined>(undefined);
      const spy = vi.fn();

      effect(() => {
        spy(nullable());
      });

      expect(spy).toHaveBeenCalledWith(undefined);

      nullable.set(null);
      expect(spy).toHaveBeenCalledWith(null);

      nullable.set('value');
      expect(spy).toHaveBeenCalledWith('value');

      nullable.set(undefined);
      expect(spy).toHaveBeenCalledWith(undefined);
    });
  });
});
