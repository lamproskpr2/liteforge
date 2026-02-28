/**
 * Debug Bus Tests
 *
 * Tests for the debug event system and emit helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDebugBus,
  enableDebug,
  disableDebug,
  isDebugEnabled,
  generateDebugId,
  resetDebugIdCounter,
  emitSignalCreate,
  emitSignalUpdate,
  emitEffectRun,
  emitEffectDispose,
  emitComputedRecalc,
  signal,
  effect,
  computed,
} from '../src/index.js';
import type { DebugBus, SignalCreatePayload, SignalUpdatePayload } from '../src/index.js';

describe('Debug Bus', () => {
  let bus: DebugBus;

  beforeEach(() => {
    disableDebug();
    resetDebugIdCounter();
    bus = createDebugBus();
  });

  afterEach(() => {
    bus.dispose();
    disableDebug();
  });

  describe('createDebugBus', () => {
    it('should create a debug bus instance', () => {
      expect(bus).toBeDefined();
      expect(typeof bus.on).toBe('function');
      expect(typeof bus.emit).toBe('function');
      expect(typeof bus.dispose).toBe('function');
    });

    it('should emit events to subscribers', () => {
      const events: SignalCreatePayload[] = [];

      bus.on('signal:create', (payload) => {
        events.push(payload);
      });

      bus.emit('signal:create', {
        id: 'test-1',
        label: 'count',
        initialValue: 0,
        timestamp: 100,
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        id: 'test-1',
        label: 'count',
        initialValue: 0,
        timestamp: 100,
      });
    });

    it('should support multiple subscribers for same event type', () => {
      let count1 = 0;
      let count2 = 0;

      bus.on('signal:create', () => {
        count1++;
      });
      bus.on('signal:create', () => {
        count2++;
      });

      bus.emit('signal:create', {
        id: 'test',
        label: undefined,
        initialValue: 0,
        timestamp: 100,
      });

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('should return unsubscribe function', () => {
      let count = 0;

      const unsubscribe = bus.on('signal:update', () => {
        count++;
      });

      bus.emit('signal:update', {
        id: 'test',
        label: undefined,
        oldValue: 0,
        newValue: 1,
        timestamp: 100,
      });

      expect(count).toBe(1);

      unsubscribe();

      bus.emit('signal:update', {
        id: 'test',
        label: undefined,
        oldValue: 1,
        newValue: 2,
        timestamp: 200,
      });

      expect(count).toBe(1); // Still 1, not 2
    });

    it('should handle errors in callbacks without crashing', () => {
      let called = false;

      bus.on('signal:create', () => {
        throw new Error('Test error');
      });

      bus.on('signal:create', () => {
        called = true;
      });

      // Should not throw
      expect(() => {
        bus.emit('signal:create', {
          id: 'test',
          label: undefined,
          initialValue: 0,
          timestamp: 100,
        });
      }).not.toThrow();

      // Second callback should still be called
      expect(called).toBe(true);
    });

    it('should clear all subscriptions on dispose', () => {
      let count = 0;

      bus.on('signal:create', () => {
        count++;
      });

      bus.dispose();

      bus.emit('signal:create', {
        id: 'test',
        label: undefined,
        initialValue: 0,
        timestamp: 100,
      });

      expect(count).toBe(0);
    });
  });

  describe('enableDebug / disableDebug', () => {
    it('should set global debug bus on enableDebug', () => {
      expect(globalThis.__LITEFORGE_DEBUG__).toBeUndefined();

      const debug = enableDebug();

      expect(globalThis.__LITEFORGE_DEBUG__).toBe(debug);
      expect(isDebugEnabled()).toBe(true);
    });

    it('should remove global debug bus on disableDebug', () => {
      enableDebug();
      expect(isDebugEnabled()).toBe(true);

      disableDebug();

      expect(globalThis.__LITEFORGE_DEBUG__).toBeUndefined();
      expect(isDebugEnabled()).toBe(false);
    });

    it('should return existing bus if already enabled', () => {
      const bus1 = enableDebug();
      const bus2 = enableDebug();

      expect(bus1).toBe(bus2);
    });
  });

  describe('generateDebugId', () => {
    it('should generate unique IDs', () => {
      resetDebugIdCounter();

      const id1 = generateDebugId('signal');
      const id2 = generateDebugId('signal');
      const id3 = generateDebugId('effect');

      expect(id1).toBe('signal_1');
      expect(id2).toBe('signal_2');
      expect(id3).toBe('effect_3');
    });

    it('should be reset by resetDebugIdCounter', () => {
      generateDebugId('test');
      generateDebugId('test');

      resetDebugIdCounter();

      const id = generateDebugId('test');
      expect(id).toBe('test_1');
    });
  });

  describe('Emit helpers (zero cost when disabled)', () => {
    it('should not throw when debug is disabled', () => {
      disableDebug();

      expect(() => {
        emitSignalCreate('id', 'label', 42);
        emitSignalUpdate('id', 'label', 1, 2);
        emitEffectRun('id', 'label', [], 10);
        emitEffectDispose('id');
        emitComputedRecalc('id', 'label', 'value', 5);
      }).not.toThrow();
    });

    it('should emit when debug is enabled', () => {
      const debug = enableDebug();
      const events: Array<{ type: string }> = [];

      debug.on('signal:create', () => events.push({ type: 'signal:create' }));
      debug.on('signal:update', () => events.push({ type: 'signal:update' }));

      emitSignalCreate('id', 'label', 42);
      emitSignalUpdate('id', 'label', 1, 2);

      expect(events).toHaveLength(2);
      expect(events[0]?.type).toBe('signal:create');
      expect(events[1]?.type).toBe('signal:update');
    });
  });

  describe('Signal debug integration', () => {
    beforeEach(() => {
      resetDebugIdCounter();
    });

    it('should emit signal:create when creating a signal with debug enabled', () => {
      const debug = enableDebug();
      const events: SignalCreatePayload[] = [];

      debug.on('signal:create', (payload) => {
        events.push(payload);
      });

      const count = signal(0, { label: 'count' });

      expect(events).toHaveLength(1);
      expect(events[0]?.label).toBe('count');
      expect(events[0]?.initialValue).toBe(0);
      expect(count.__debugLabel).toBe('count');
    });

    it('should emit signal:update when signal value changes', () => {
      const debug = enableDebug();
      const updates: SignalUpdatePayload[] = [];

      debug.on('signal:update', (payload) => {
        updates.push(payload);
      });

      const count = signal(0, { label: 'count' });
      count.set(1);
      count.set(2);

      expect(updates).toHaveLength(2);
      expect(updates[0]?.oldValue).toBe(0);
      expect(updates[0]?.newValue).toBe(1);
      expect(updates[1]?.oldValue).toBe(1);
      expect(updates[1]?.newValue).toBe(2);
    });

    it('should not emit signal:update when value is same', () => {
      const debug = enableDebug();
      const updates: SignalUpdatePayload[] = [];

      debug.on('signal:update', (payload) => {
        updates.push(payload);
      });

      const count = signal(0);
      count.set(0); // Same value

      expect(updates).toHaveLength(0);
    });

    it('should auto-generate ID when no label provided', () => {
      enableDebug();
      const s = signal(42);

      expect(s.__debugId).toMatch(/^signal_\d+$/);
      expect(s.__debugLabel).toBeUndefined();
    });
  });

  describe('Effect debug integration', () => {
    it('should emit effect:run when effect executes', () => {
      const debug = enableDebug();
      const runs: Array<{ id: string; label: string | undefined }> = [];

      debug.on('effect:run', (payload) => {
        runs.push({ id: payload.id, label: payload.label });
      });

      const dispose = effect(() => {
        // Effect runs immediately
      }, { label: 'myEffect' });

      expect(runs).toHaveLength(1);
      expect(runs[0]?.label).toBe('myEffect');

      dispose();
    });

    it('should emit effect:dispose when effect is disposed', () => {
      const debug = enableDebug();
      const disposes: string[] = [];

      debug.on('effect:dispose', (payload) => {
        disposes.push(payload.id);
      });

      const dispose = effect(() => {}, { label: 'test' });

      expect(disposes).toHaveLength(0);

      dispose();

      expect(disposes).toHaveLength(1);
    });

    it('should emit effect:run on re-execution', () => {
      const debug = enableDebug();
      let runCount = 0;

      debug.on('effect:run', () => {
        runCount++;
      });

      const count = signal(0);
      const dispose = effect(() => {
        count(); // Subscribe
      });

      expect(runCount).toBe(1);

      count.set(1);

      expect(runCount).toBe(2);

      dispose();
    });
  });

  describe('Computed debug integration', () => {
    it('should emit computed:recalc when computed recalculates', () => {
      const debug = enableDebug();
      const recalcs: Array<{ value: unknown }> = [];

      debug.on('computed:recalc', (payload) => {
        recalcs.push({ value: payload.value });
      });

      const count = signal(5);
      const doubled = computed(() => count() * 2, { label: 'doubled' });

      // First read triggers computation
      expect(doubled()).toBe(10);
      expect(recalcs).toHaveLength(1);
      expect(recalcs[0]?.value).toBe(10);

      // Cached read, no recalc
      expect(doubled()).toBe(10);
      expect(recalcs).toHaveLength(1);

      // Change dependency, mark dirty
      count.set(10);

      // Next read triggers recalc
      expect(doubled()).toBe(20);
      expect(recalcs).toHaveLength(2);
      expect(recalcs[1]?.value).toBe(20);
    });
  });
});
