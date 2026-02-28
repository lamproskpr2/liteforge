/**
 * LiteForge DevTools Event Buffer
 *
 * A circular buffer (ring buffer) for storing debug events.
 * IMPORTANT: This module must NOT use LiteForge signals to avoid
 * infinite loops (buffer receives signal events → creates more signals).
 */

import type { DebugEvent } from '@liteforge/core';
import type { EventBuffer, StoredEvent } from './types.js';

// ============================================================================
// Circular Buffer Implementation
// ============================================================================

/**
 * Create a circular event buffer with a fixed maximum size.
 *
 * @param maxSize - Maximum number of events to store
 * @returns An event buffer instance
 */
export function createEventBuffer(maxSize: number): EventBuffer {
  // Internal storage
  const events: StoredEvent[] = [];
  let nextId = 0;
  let startIndex = 0;
  let count = 0;

  // Subscriber callbacks (no signals to avoid debug event loops)
  const subscribers = new Set<(event: StoredEvent) => void>();

  /**
   * Add an event to the buffer.
   * If the buffer is full, the oldest event is overwritten.
   */
  function push(event: DebugEvent): void {
    const storedEvent: StoredEvent = {
      id: nextId++,
      event,
    };

    if (count < maxSize) {
      // Buffer not full yet, just append
      events.push(storedEvent);
      count++;
    } else {
      // Buffer is full, overwrite oldest
      const insertIndex = (startIndex + count) % maxSize;
      events[insertIndex] = storedEvent;
      startIndex = (startIndex + 1) % maxSize;
    }

    // Notify subscribers
    for (const callback of subscribers) {
      try {
        callback(storedEvent);
      } catch (error) {
        console.error('[DevTools] Error in event subscriber:', error);
      }
    }
  }

  /**
   * Get all stored events in chronological order (oldest first).
   */
  function getAll(): StoredEvent[] {
    if (count < maxSize) {
      // Buffer not full yet, events are in order
      return [...events];
    }

    // Buffer is full, need to reorder from ring buffer
    const result: StoredEvent[] = [];
    for (let i = 0; i < count; i++) {
      const index = (startIndex + i) % maxSize;
      const event = events[index];
      if (event) {
        result.push(event);
      }
    }
    return result;
  }

  /**
   * Get the last N events (newest first).
   */
  function getLast(n: number): StoredEvent[] {
    const all = getAll();
    return all.slice(-n).reverse();
  }

  /**
   * Clear all events from the buffer.
   */
  function clear(): void {
    events.length = 0;
    startIndex = 0;
    count = 0;
  }

  /**
   * Get the current number of events in the buffer.
   */
  function size(): number {
    return count;
  }

  /**
   * Subscribe to new events.
   * Returns an unsubscribe function.
   */
  function subscribe(callback: (event: StoredEvent) => void): () => void {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  }

  return {
    push,
    getAll,
    getLast,
    clear,
    size,
    subscribe,
  };
}
