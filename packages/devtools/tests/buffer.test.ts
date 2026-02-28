/**
 * Event Buffer Tests
 *
 * Tests for the circular event buffer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEventBuffer } from '../src/buffer.js';
import type { EventBuffer } from '../src/types.js';
import type { DebugEvent } from '@liteforge/core';

describe('Event Buffer', () => {
  let buffer: EventBuffer;

  beforeEach(() => {
    buffer = createEventBuffer(10);
  });

  function createEvent(id: number): DebugEvent {
    return {
      type: 'signal:create',
      payload: {
        id: `signal-${id}`,
        label: `test-${id}`,
        initialValue: id,
        timestamp: id * 100,
      },
    };
  }

  describe('push', () => {
    it('should add events to the buffer', () => {
      buffer.push(createEvent(1));
      buffer.push(createEvent(2));

      expect(buffer.size()).toBe(2);
    });

    it('should respect max size (circular buffer)', () => {
      // Add 15 events to a buffer of size 10
      for (let i = 0; i < 15; i++) {
        buffer.push(createEvent(i));
      }

      expect(buffer.size()).toBe(10);
    });
  });

  describe('getAll', () => {
    it('should return all events in chronological order', () => {
      buffer.push(createEvent(1));
      buffer.push(createEvent(2));
      buffer.push(createEvent(3));

      const events = buffer.getAll();

      expect(events).toHaveLength(3);
      expect(events[0]?.event.payload).toHaveProperty('id', 'signal-1');
      expect(events[1]?.event.payload).toHaveProperty('id', 'signal-2');
      expect(events[2]?.event.payload).toHaveProperty('id', 'signal-3');
    });

    it('should return events in correct order after wrapping', () => {
      // Add 15 events to a buffer of size 10
      for (let i = 0; i < 15; i++) {
        buffer.push(createEvent(i));
      }

      const events = buffer.getAll();

      expect(events).toHaveLength(10);
      // Should have events 5-14 (oldest 0-4 were overwritten)
      expect(events[0]?.event.payload).toHaveProperty('id', 'signal-5');
      expect(events[9]?.event.payload).toHaveProperty('id', 'signal-14');
    });
  });

  describe('getLast', () => {
    it('should return last N events in newest-first order', () => {
      buffer.push(createEvent(1));
      buffer.push(createEvent(2));
      buffer.push(createEvent(3));
      buffer.push(createEvent(4));
      buffer.push(createEvent(5));

      const last3 = buffer.getLast(3);

      expect(last3).toHaveLength(3);
      expect(last3[0]?.event.payload).toHaveProperty('id', 'signal-5'); // Newest first
      expect(last3[1]?.event.payload).toHaveProperty('id', 'signal-4');
      expect(last3[2]?.event.payload).toHaveProperty('id', 'signal-3');
    });

    it('should handle requesting more events than available', () => {
      buffer.push(createEvent(1));
      buffer.push(createEvent(2));

      const last10 = buffer.getLast(10);

      expect(last10).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should remove all events', () => {
      buffer.push(createEvent(1));
      buffer.push(createEvent(2));
      buffer.push(createEvent(3));

      expect(buffer.size()).toBe(3);

      buffer.clear();

      expect(buffer.size()).toBe(0);
      expect(buffer.getAll()).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers when events are added', () => {
      const received: DebugEvent[] = [];

      buffer.subscribe((stored) => {
        received.push(stored.event);
      });

      buffer.push(createEvent(1));
      buffer.push(createEvent(2));

      expect(received).toHaveLength(2);
      expect(received[0]?.payload).toHaveProperty('id', 'signal-1');
      expect(received[1]?.payload).toHaveProperty('id', 'signal-2');
    });

    it('should return unsubscribe function', () => {
      let count = 0;

      const unsubscribe = buffer.subscribe(() => {
        count++;
      });

      buffer.push(createEvent(1));
      expect(count).toBe(1);

      unsubscribe();

      buffer.push(createEvent(2));
      expect(count).toBe(1); // Still 1
    });

    it('should handle errors in callbacks', () => {
      let secondCalled = false;

      buffer.subscribe(() => {
        throw new Error('Test error');
      });

      buffer.subscribe(() => {
        secondCalled = true;
      });

      expect(() => buffer.push(createEvent(1))).not.toThrow();
      expect(secondCalled).toBe(true);
    });
  });

  describe('StoredEvent IDs', () => {
    it('should assign incrementing IDs to events', () => {
      buffer.push(createEvent(1));
      buffer.push(createEvent(2));
      buffer.push(createEvent(3));

      const events = buffer.getAll();

      expect(events[0]?.id).toBe(0);
      expect(events[1]?.id).toBe(1);
      expect(events[2]?.id).toBe(2);
    });

    it('should continue incrementing IDs after buffer wraps', () => {
      for (let i = 0; i < 15; i++) {
        buffer.push(createEvent(i));
      }

      const events = buffer.getAll();

      // IDs should be 5-14 (continuous, not reset)
      expect(events[0]?.id).toBe(5);
      expect(events[9]?.id).toBe(14);
    });
  });
});
