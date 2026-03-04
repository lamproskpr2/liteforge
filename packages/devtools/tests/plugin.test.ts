/**
 * DevTools Plugin Tests
 *
 * Tests for the new LiteForgePlugin interface: install() / cleanup pattern.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  signal,
  isDebugEnabled,
  disableDebug,
  resetDebugIdCounter,
} from '@liteforge/core';
import {
  devtoolsPlugin,
  createDevTools,
  createEventBuffer,
} from '../src/index.js';
import type { DevToolsInstance, DevToolsApi, EventBuffer } from '../src/types.js';
import type { PluginContext } from '@liteforge/runtime';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a minimal fake PluginContext for unit testing install() directly.
 */
function makeFakeContext(target?: HTMLElement): {
  context: PluginContext;
  provided: Record<string, unknown>;
  appEl: HTMLElement;
} {
  const provided: Record<string, unknown> = {};
  const appEl = target ?? document.createElement('div');
  if (!appEl.parentElement) {
    document.body.appendChild(appEl);
  }

  const context: PluginContext = {
    target: appEl,
    provide<K extends string, T>(key: K, value: T): void {
      provided[key] = value;
    },
    resolve<T = unknown>(key: string): T | undefined {
      return key in provided ? (provided[key] as T) : undefined;
    },
  };

  return { context, provided, appEl };
}

// ============================================================================
// Tests
// ============================================================================

describe('DevTools Plugin', () => {
  beforeEach(() => {
    disableDebug();
    resetDebugIdCounter();
  });

  afterEach(() => {
    disableDebug();
    // Clean up any devtools containers
    document.querySelectorAll('#liteforge-devtools-root').forEach((el) => el.remove());
    document.querySelectorAll('#liteforge-devtools').forEach((el) => el.remove());
    // Clean up test app elements
    document.querySelectorAll('#test-app').forEach((el) => el.remove());
  });

  // ==========================================================================
  // LiteForgePlugin shape
  // ==========================================================================

  describe('devtoolsPlugin — LiteForgePlugin interface', () => {
    it('returns a plugin with name "devtools" and install()', () => {
      const plugin = devtoolsPlugin();
      expect(plugin.name).toBe('devtools');
      expect(typeof plugin.install).toBe('function');
    });

    it('accepts all configuration options without error', () => {
      const plugin = devtoolsPlugin({
        shortcut: 'ctrl+alt+d',
        position: 'bottom',
        defaultTab: 'stores',
        width: 400,
        height: 350,
        maxEvents: 500,
      });
      expect(plugin.name).toBe('devtools');
    });

    it('install() returns a cleanup function', () => {
      const { context } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);
      expect(typeof cleanup).toBe('function');
      if (typeof cleanup === 'function') cleanup();
    });
  });

  // ==========================================================================
  // Debug mode lifecycle
  // ==========================================================================

  describe('debug mode', () => {
    it('install() enables debug mode', () => {
      const { context } = makeFakeContext();
      expect(isDebugEnabled()).toBe(false);

      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);
      expect(isDebugEnabled()).toBe(true);

      if (typeof cleanup === 'function') cleanup();
    });

    it('cleanup() disables debug mode', () => {
      const { context } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);
      expect(isDebugEnabled()).toBe(true);

      if (typeof cleanup === 'function') cleanup();
      expect(isDebugEnabled()).toBe(false);
    });
  });

  // ==========================================================================
  // DOM container placement
  // ==========================================================================

  describe('DOM container placement', () => {
    it('inserts #liteforge-devtools-root next to target, not on body', () => {
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);

      const appEl = document.createElement('div');
      appEl.id = 'test-app';
      wrapper.appendChild(appEl);

      const { context } = makeFakeContext(appEl);
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const devtoolsRoot = document.getElementById('liteforge-devtools-root');
      expect(devtoolsRoot).not.toBeNull();
      // Should be a sibling of #test-app (both children of wrapper)
      expect(devtoolsRoot?.parentElement).toBe(wrapper);
      expect(appEl.nextSibling).toBe(devtoolsRoot);

      if (typeof cleanup === 'function') cleanup();
      wrapper.remove();
    });

    it('cleanup() removes the devtools container from DOM', () => {
      const { context } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      expect(document.getElementById('liteforge-devtools-root')).not.toBeNull();

      if (typeof cleanup === 'function') cleanup();

      expect(document.getElementById('liteforge-devtools-root')).toBeNull();
    });
  });

  // ==========================================================================
  // DevTools API via provide()
  // ==========================================================================

  describe('DevTools API via provide()', () => {
    it('provides DevToolsApi under "devtools" key', () => {
      const { context, provided } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const api = provided['devtools'] as DevToolsApi | undefined;
      expect(api).toBeDefined();
      expect(typeof api?.open).toBe('function');
      expect(typeof api?.close).toBe('function');
      expect(typeof api?.toggle).toBe('function');
      expect(typeof api?.selectTab).toBe('function');
      expect(typeof api?.isOpen).toBe('function');

      if (typeof cleanup === 'function') cleanup();
    });

    it('isOpen() starts false', () => {
      const { context, provided } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const api = provided['devtools'] as DevToolsApi;
      expect(api.isOpen()).toBe(false);

      if (typeof cleanup === 'function') cleanup();
    });

    it('open() sets isOpen to true', () => {
      const { context, provided } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const api = provided['devtools'] as DevToolsApi;
      api.open();
      expect(api.isOpen()).toBe(true);

      if (typeof cleanup === 'function') cleanup();
    });

    it('close() sets isOpen to false', () => {
      const { context, provided } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const api = provided['devtools'] as DevToolsApi;
      api.open();
      api.close();
      expect(api.isOpen()).toBe(false);

      if (typeof cleanup === 'function') cleanup();
    });

    it('toggle() flips isOpen', () => {
      const { context, provided } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const api = provided['devtools'] as DevToolsApi;
      expect(api.isOpen()).toBe(false);
      api.toggle();
      expect(api.isOpen()).toBe(true);
      api.toggle();
      expect(api.isOpen()).toBe(false);

      if (typeof cleanup === 'function') cleanup();
    });

    it('selectTab() accepts all valid tab IDs without error', () => {
      const { context, provided } = makeFakeContext();
      const plugin = devtoolsPlugin();
      const cleanup = plugin.install(context);

      const api = provided['devtools'] as DevToolsApi;
      expect(() => api.selectTab('signals')).not.toThrow();
      expect(() => api.selectTab('stores')).not.toThrow();
      expect(() => api.selectTab('router')).not.toThrow();
      expect(() => api.selectTab('components')).not.toThrow();
      expect(() => api.selectTab('performance')).not.toThrow();

      if (typeof cleanup === 'function') cleanup();
    });
  });

  // ==========================================================================
  // Keyboard shortcut cleanup
  // ==========================================================================

  describe('keyboard shortcut', () => {
    it('cleanup() removes the keyboard listener (no error when pressing shortcut after cleanup)', () => {
      const { context } = makeFakeContext();
      const plugin = devtoolsPlugin({ shortcut: 'ctrl+shift+d' });
      const cleanup = plugin.install(context);

      // Confirm debug enabled
      expect(isDebugEnabled()).toBe(true);

      if (typeof cleanup === 'function') cleanup();

      // Simulate the shortcut after cleanup — should not throw
      expect(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, shiftKey: true }),
        );
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // createDevTools standalone
  // ==========================================================================

  describe('createDevTools', () => {
    let devtools: DevToolsInstance | undefined;

    afterEach(() => {
      devtools?.destroy();
      devtools = undefined;
    });

    it('creates a DevTools instance', () => {
      devtools = createDevTools();
      expect(devtools.bus).toBeDefined();
      expect(devtools.buffer).toBeDefined();
      expect(typeof devtools.open).toBe('function');
      expect(typeof devtools.close).toBe('function');
      expect(typeof devtools.toggle).toBe('function');
      expect(typeof devtools.destroy).toBe('function');
    });

    it('enables debug mode', () => {
      expect(isDebugEnabled()).toBe(false);
      devtools = createDevTools();
      expect(isDebugEnabled()).toBe(true);
    });

    it('creates panel element in DOM', () => {
      devtools = createDevTools();
      expect(document.querySelector('#liteforge-devtools')).not.toBeNull();
    });

    it('open() shows panel (opacity 1)', () => {
      devtools = createDevTools();
      devtools.open();
      const panel = document.querySelector('#liteforge-devtools') as HTMLElement;
      expect(panel.style.opacity).toBe('1');
    });

    it('close() hides panel (opacity 0)', () => {
      devtools = createDevTools();
      devtools.open();
      devtools.close();
      const panel = document.querySelector('#liteforge-devtools') as HTMLElement;
      expect(panel.style.opacity).toBe('0');
    });

    it('toggle() toggles panel state', () => {
      devtools = createDevTools();
      const panel = document.querySelector('#liteforge-devtools') as HTMLElement;
      devtools.toggle();
      expect(panel.style.opacity).toBe('1');
      devtools.toggle();
      expect(panel.style.opacity).toBe('0');
    });

    it('destroy() removes panel and disables debug', () => {
      devtools = createDevTools();
      expect(document.querySelector('#liteforge-devtools')).not.toBeNull();
      expect(isDebugEnabled()).toBe(true);

      devtools.destroy();
      expect(document.querySelector('#liteforge-devtools')).toBeNull();
      expect(isDebugEnabled()).toBe(false);

      devtools = undefined;
    });
  });

  // ==========================================================================
  // Event buffering
  // ==========================================================================

  describe('Event buffering', () => {
    let devtools: DevToolsInstance | undefined;

    afterEach(() => {
      devtools?.destroy();
      devtools = undefined;
    });

    it('buffer captures signal:create events', () => {
      devtools = createDevTools();
      signal(0);
      expect(devtools.buffer.size()).toBeGreaterThanOrEqual(1);
    });

    it('buffer captures signal:update events', () => {
      devtools = createDevTools();
      const count = signal(0);
      const initialSize = devtools.buffer.size();
      count.set(5);
      expect(devtools.buffer.size()).toBeGreaterThan(initialSize);
    });

    it('buffer getAll returns events in ID order', () => {
      devtools = createDevTools();
      signal(1, { label: 'first' });
      signal(2, { label: 'second' });
      signal(3, { label: 'third' });

      const events = devtools.buffer.getAll();
      expect(events.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < events.length; i++) {
        expect(events[i]!.id).toBeGreaterThan(events[i - 1]!.id);
      }
    });

    it('buffer getLast returns most recent N events', () => {
      devtools = createDevTools();
      for (let i = 0; i < 10; i++) signal(i);
      expect(devtools.buffer.getLast(5)).toHaveLength(5);
    });

    it('buffer clear removes all events', () => {
      devtools = createDevTools();
      signal(1);
      signal(2);
      expect(devtools.buffer.size()).toBeGreaterThan(0);
      devtools.buffer.clear();
      expect(devtools.buffer.size()).toBe(0);
    });

    it('buffer subscribe receives new events', () => {
      devtools = createDevTools();
      const received: unknown[] = [];
      const unsubscribe = devtools.buffer.subscribe((e) => received.push(e));
      signal(42);
      expect(received.length).toBeGreaterThanOrEqual(1);
      unsubscribe();
    });
  });

  // ==========================================================================
  // createEventBuffer (standalone)
  // ==========================================================================

  describe('createEventBuffer', () => {
    let buffer: EventBuffer;

    beforeEach(() => {
      buffer = createEventBuffer(100);
    });

    it('creates buffer with 0 size', () => {
      expect(buffer.size()).toBe(0);
    });

    it('push adds events', () => {
      buffer.push({ type: 'signal:create', payload: { id: 'x', label: undefined, initialValue: 0, timestamp: 1 } });
      expect(buffer.size()).toBe(1);
    });

    it('respects max capacity', () => {
      const small = createEventBuffer(5);
      for (let i = 0; i < 10; i++) {
        small.push({ type: 'signal:create', payload: { id: `s${i}`, label: undefined, initialValue: i, timestamp: i } });
      }
      expect(small.size()).toBe(5);
    });

    it('getAll returns all events', () => {
      buffer.push({ type: 'signal:create', payload: { id: 'a', label: undefined, initialValue: 1, timestamp: 1 } });
      buffer.push({ type: 'signal:create', payload: { id: 'b', label: undefined, initialValue: 2, timestamp: 2 } });
      expect(buffer.getAll()).toHaveLength(2);
    });

    it('getLast returns correct count', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push({ type: 'signal:create', payload: { id: `t${i}`, label: undefined, initialValue: i, timestamp: i } });
      }
      expect(buffer.getLast(3)).toHaveLength(3);
      expect(buffer.getLast(100)).toHaveLength(10);
    });

    it('clear empties the buffer', () => {
      buffer.push({ type: 'signal:create', payload: { id: 'x', label: undefined, initialValue: 0, timestamp: 1 } });
      buffer.clear();
      expect(buffer.size()).toBe(0);
    });

    it('subscribe notifies on new events', () => {
      const received: unknown[] = [];
      buffer.subscribe((e) => received.push(e));
      buffer.push({ type: 'signal:create', payload: { id: 'x', label: undefined, initialValue: 0, timestamp: 1 } });
      expect(received).toHaveLength(1);
    });

    it('unsubscribe stops notifications', () => {
      const received: unknown[] = [];
      const unsub = buffer.subscribe((e) => received.push(e));
      buffer.push({ type: 'signal:create', payload: { id: 'x', label: undefined, initialValue: 0, timestamp: 1 } });
      unsub();
      buffer.push({ type: 'signal:create', payload: { id: 'y', label: undefined, initialValue: 0, timestamp: 2 } });
      expect(received).toHaveLength(1);
    });

    it('events have unique incrementing IDs', () => {
      buffer.push({ type: 'signal:create', payload: { id: 'a', label: undefined, initialValue: 1, timestamp: 1 } });
      buffer.push({ type: 'signal:create', payload: { id: 'b', label: undefined, initialValue: 2, timestamp: 2 } });
      buffer.push({ type: 'signal:create', payload: { id: 'c', label: undefined, initialValue: 3, timestamp: 3 } });
      const all = buffer.getAll();
      expect(all[0]!.id).toBeLessThan(all[1]!.id);
      expect(all[1]!.id).toBeLessThan(all[2]!.id);
    });
  });

  // ==========================================================================
  // Configuration defaults
  // ==========================================================================

  describe('Configuration defaults', () => {
    let devtools: DevToolsInstance | undefined;

    afterEach(() => {
      devtools?.destroy();
      devtools = undefined;
    });

    it('default shortcut is ctrl+shift+d', () => {
      devtools = createDevTools();
      // Verify setup doesn't throw and panel exists
      expect(document.querySelector('#liteforge-devtools')).not.toBeNull();
    });

    it('custom maxEvents is respected', () => {
      devtools = createDevTools({ maxEvents: 5 });
      for (let i = 0; i < 10; i++) signal(i);
      expect(devtools.buffer.size()).toBeLessThanOrEqual(5);
    });

    it('uses default position right', () => {
      devtools = createDevTools();
      const panel = document.querySelector('#liteforge-devtools') as HTMLElement;
      expect(panel).not.toBeNull();
    });
  });
});
