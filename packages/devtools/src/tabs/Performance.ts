/**
 * LiteForge DevTools - Performance Tab
 *
 * Performance counters and metrics.
 */

import type { Signal } from '@liteforge/core';
import { signal, effect } from '../internals.js';
import {
  scrollContainerStyles,
  colors,
} from '../styles.js';
import type { EventBuffer, PanelState, PerformanceCounters } from '../types.js';

// ============================================================================
// Performance Tab
// ============================================================================

/**
 * Tab result with cleanup function
 */
export interface TabResult {
  element: HTMLElement;
  dispose: () => void;
}

/**
 * Create the Performance tab content.
 */
export function createPerformanceTab(
  buffer: EventBuffer,
  state: Signal<PanelState>
): TabResult {
  // Track all cleanup functions
  const cleanups: Array<() => void> = [];

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';

  // Counters section
  const countersSection = document.createElement('div');
  countersSection.style.padding = '16px';
  countersSection.style.display = 'grid';
  countersSection.style.gridTemplateColumns = 'repeat(2, 1fr)';
  countersSection.style.gap = '12px';
  container.appendChild(countersSection);

  // Track counters
  const counters = signal<PerformanceCounters>({
    totalSignals: 0,
    activeEffects: 0,
    mountedComponents: 0,
    signalUpdatesPerSecond: 0,
    effectExecutionsPerSecond: 0,
  });

  // Track updates for rate calculation
  const recentSignalUpdates: number[] = [];
  const recentEffectRuns: number[] = [];
  const activeEffectIds = new Set<string>();
  const mountedComponentIds = new Set<string>();

  // Subscribe to events
  const unsubscribe = buffer.subscribe((entry) => {
    if (state().isPaused) return;

    const now = performance.now();
    const event = entry.event;

    // Use switch for proper discriminated union narrowing
    switch (event.type) {
      case 'signal:create':
        counters.update(c => ({ ...c, totalSignals: c.totalSignals + 1 }));
        break;

      case 'signal:update':
        recentSignalUpdates.push(now);
        // Remove old entries
        while (recentSignalUpdates.length > 0 && recentSignalUpdates[0]! < now - 5000) {
          recentSignalUpdates.shift();
        }
        break;

      case 'effect:run':
        // TypeScript now knows event.payload is EffectRunPayload
        activeEffectIds.add(event.payload.id);
        recentEffectRuns.push(now);
        // Remove old entries
        while (recentEffectRuns.length > 0 && recentEffectRuns[0]! < now - 5000) {
          recentEffectRuns.shift();
        }
        counters.update(c => ({ ...c, activeEffects: activeEffectIds.size }));
        break;

      case 'effect:dispose':
        // TypeScript now knows event.payload is EffectDisposePayload
        activeEffectIds.delete(event.payload.id);
        counters.update(c => ({ ...c, activeEffects: activeEffectIds.size }));
        break;

      case 'component:mount':
        // TypeScript now knows event.payload is ComponentMountPayload
        mountedComponentIds.add(event.payload.id);
        counters.update(c => ({ ...c, mountedComponents: mountedComponentIds.size }));
        break;

      case 'component:unmount':
        // TypeScript now knows event.payload is ComponentUnmountPayload
        mountedComponentIds.delete(event.payload.id);
        counters.update(c => ({ ...c, mountedComponents: mountedComponentIds.size }));
        break;
    }
  });
  cleanups.push(unsubscribe);

  // Update rates every second
  const intervalId = setInterval(() => {
    const now = performance.now();
    const signalUpdatesLast5s = recentSignalUpdates.filter(t => t > now - 5000).length;
    const effectRunsLast5s = recentEffectRuns.filter(t => t > now - 5000).length;

    counters.update(c => ({
      ...c,
      signalUpdatesPerSecond: Math.round(signalUpdatesLast5s / 5),
      effectExecutionsPerSecond: Math.round(effectRunsLast5s / 5),
    }));
  }, 1000);
  cleanups.push(() => clearInterval(intervalId));

  // Create counter cards
  const cards: HTMLElement[] = [];

  function createCounterCard(label: string, getValue: (c: PerformanceCounters) => number | string, color: string): HTMLElement {
    const card = document.createElement('div');
    card.style.background = colors.bgSecondary;
    card.style.borderRadius = '6px';
    card.style.padding = '12px';
    card.style.textAlign = 'center';

    const valueEl = document.createElement('div');
    valueEl.style.fontSize = '24px';
    valueEl.style.fontWeight = 'bold';
    valueEl.style.color = color;
    valueEl.textContent = '0';
    card.appendChild(valueEl);

    const labelEl = document.createElement('div');
    labelEl.style.fontSize = '11px';
    labelEl.style.color = colors.textMuted;
    labelEl.style.marginTop = '4px';
    labelEl.textContent = label;
    card.appendChild(labelEl);

    cards.push(card);

    // Update value reactively
    const stopEffect = effect(() => {
      const c = counters();
      valueEl.textContent = String(getValue(c));
    });
    cleanups.push(stopEffect);

    return card;
  }

  countersSection.appendChild(createCounterCard('Total Signals', c => c.totalSignals, colors.accent));
  countersSection.appendChild(createCounterCard('Active Effects', c => c.activeEffects, colors.success));
  countersSection.appendChild(createCounterCard('Mounted Components', c => c.mountedComponents, colors.codeBoolean));
  countersSection.appendChild(createCounterCard('Signal Updates/s', c => c.signalUpdatesPerSecond, colors.warning));
  countersSection.appendChild(createCounterCard('Effect Runs/s', c => c.effectExecutionsPerSecond, colors.warning));
  countersSection.appendChild(createCounterCard('Total Events', () => buffer.size(), colors.textSecondary));

  // Stats section
  const statsSection = document.createElement('div');
  statsSection.setAttribute('style', scrollContainerStyles);
  statsSection.style.flex = '1';
  statsSection.style.borderTop = `1px solid ${colors.border}`;
  container.appendChild(statsSection);

  const statsLabel = document.createElement('div');
  statsLabel.textContent = 'Performance Tips:';
  statsLabel.style.color = colors.textMuted;
  statsLabel.style.fontSize = '10px';
  statsLabel.style.marginBottom = '8px';
  statsSection.appendChild(statsLabel);

  const tips = document.createElement('div');
  tips.style.fontSize = '11px';
  tips.style.lineHeight = '1.6';
  tips.style.color = colors.textSecondary;
  tips.innerHTML = `
    <p style="margin: 0 0 8px 0;">High signal updates/s may indicate:</p>
    <ul style="margin: 0; padding-left: 16px;">
      <li>Signals updating too frequently</li>
      <li>Effects creating update loops</li>
      <li>Missing batch() calls</li>
    </ul>
    <p style="margin: 12px 0 8px 0;">High effect runs/s may indicate:</p>
    <ul style="margin: 0; padding-left: 16px;">
      <li>Effects with too many dependencies</li>
      <li>Diamond dependency patterns</li>
    </ul>
  `;
  statsSection.appendChild(tips);

  return {
    element: container,
    dispose: () => {
      for (const fn of cleanups) fn();
    },
  };
}
