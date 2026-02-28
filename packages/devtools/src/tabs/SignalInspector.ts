/**
 * LiteForge DevTools - Signal Inspector Tab
 *
 * Live feed of signal updates with filtering and inspection.
 */

import type { Signal, DebugEvent } from '@liteforge/core';
import { signal, effect } from '../internals.js';
import {
  scrollContainerStyles,
  eventListStyles,
  getEventItemStyles,
  eventTypeStyles,
  eventContentStyles,
  eventLabelStyles,
  eventTimestampStyles,
  searchBarStyles,
  searchInputStyles,
  getValueStyle,
  colors,
} from '../styles.js';
import type { EventBuffer, PanelState, StoredEvent } from '../types.js';

// ============================================================================
// Signal Inspector
// ============================================================================

/**
 * Tab result with cleanup function
 */
export interface TabResult {
  element: HTMLElement;
  dispose: () => void;
}

/**
 * Create the Signal Inspector tab content.
 */
export function createSignalInspector(
  buffer: EventBuffer,
  state: Signal<PanelState>
): TabResult {
  // Track all cleanup functions
  const cleanups: Array<() => void> = [];

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';

  // Search bar
  const searchBar = document.createElement('div');
  searchBar.setAttribute('style', searchBarStyles);

  const searchInput = document.createElement('input');
  searchInput.setAttribute('style', searchInputStyles);
  searchInput.placeholder = 'Filter signals...';
  searchInput.oninput = () => {
    state.update(s => ({ ...s, filterQuery: searchInput.value }));
  };
  searchBar.appendChild(searchInput);
  container.appendChild(searchBar);

  // Event list container
  const listContainer = document.createElement('div');
  listContainer.setAttribute('style', scrollContainerStyles);
  container.appendChild(listContainer);

  // Event list
  const eventList = document.createElement('div');
  eventList.setAttribute('style', eventListStyles);
  listContainer.appendChild(eventList);

  // Local state for displayed events
  const displayedEvents = signal<StoredEvent[]>([]);

  // Subscribe to new events
  const unsubscribe = buffer.subscribe((storedEvent) => {
    if (state().isPaused) return;

    // Only show signal-related events - use discriminated union
    const event = storedEvent.event;
    if (!isSignalOrComputedEvent(event)) return;

    displayedEvents.update(events => {
      const newEvents = [...events, storedEvent];
      // Keep only last 200 in UI
      if (newEvents.length > 200) {
        newEvents.shift();
      }
      return newEvents;
    });
  });
  cleanups.push(unsubscribe);

  // Effect to render events
  const stopEffect = effect(() => {
    const events = displayedEvents();
    const filter = state().filterQuery.toLowerCase();

    // Clear existing
    eventList.innerHTML = '';

    // Filter and render (newest first)
    const filtered = events
      .filter(e => {
        if (!filter) return true;
        const event = e.event;
        if (!isSignalOrComputedEvent(event)) return false;
        const label = getEventLabel(event);
        const id = getEventId(event);
        return label.toLowerCase().includes(filter) || id.toLowerCase().includes(filter);
      })
      .reverse()
      .slice(0, 100); // Limit displayed events

    for (const stored of filtered) {
      const item = createEventItem(stored);
      eventList.appendChild(item);
    }

    // Show empty message
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = colors.textMuted;
      empty.style.textAlign = 'center';
      empty.style.padding = '20px';
      empty.textContent = events.length === 0 
        ? 'No signal events yet. Interact with the app to see updates.'
        : 'No events match the filter.';
      eventList.appendChild(empty);
    }
  });
  cleanups.push(stopEffect);

  return {
    element: container,
    dispose: () => {
      for (const fn of cleanups) fn();
    },
  };
}

// ============================================================================
// Type Guards
// ============================================================================

type SignalOrComputedEvent = Extract<DebugEvent, 
  | { type: 'signal:create' }
  | { type: 'signal:update' }
  | { type: 'computed:recalc' }
>;

function isSignalOrComputedEvent(event: DebugEvent): event is SignalOrComputedEvent {
  return (
    event.type === 'signal:create' ||
    event.type === 'signal:update' ||
    event.type === 'computed:recalc'
  );
}

function getEventLabel(event: SignalOrComputedEvent): string {
  return event.payload.label ?? '';
}

function getEventId(event: SignalOrComputedEvent): string {
  return event.payload.id;
}

// ============================================================================
// Event Item Rendering
// ============================================================================

/**
 * Create an event item element.
 */
function createEventItem(stored: StoredEvent): HTMLElement {
  const item = document.createElement('div');
  item.setAttribute('style', getEventItemStyles(stored.event.type));

  // Event type
  const typeEl = document.createElement('div');
  typeEl.setAttribute('style', eventTypeStyles);
  typeEl.textContent = stored.event.type;
  item.appendChild(typeEl);

  // Content - use switch to properly narrow the event type
  const content = document.createElement('div');
  content.setAttribute('style', eventContentStyles);

  const event = stored.event;

  // Label/ID
  const labelEl = document.createElement('span');
  labelEl.setAttribute('style', eventLabelStyles);

  // Value element
  const valueEl = document.createElement('span');

  // Timestamp element
  const timeEl = document.createElement('span');
  timeEl.setAttribute('style', eventTimestampStyles);

  // Use switch for proper type narrowing
  switch (event.type) {
    case 'signal:create':
      labelEl.textContent = event.payload.label ?? event.payload.id;
      valueEl.setAttribute('style', getValueStyle(event.payload.initialValue));
      valueEl.textContent = formatValue(event.payload.initialValue);
      timeEl.textContent = formatTimestamp(event.payload.timestamp);
      break;

    case 'signal:update':
      labelEl.textContent = event.payload.label ?? event.payload.id;
      valueEl.setAttribute('style', getValueStyle(event.payload.newValue));
      valueEl.textContent = formatValue(event.payload.oldValue) + ' -> ' + formatValue(event.payload.newValue);
      timeEl.textContent = formatTimestamp(event.payload.timestamp);
      break;

    case 'computed:recalc':
      labelEl.textContent = event.payload.label ?? event.payload.id;
      valueEl.setAttribute('style', getValueStyle(event.payload.value));
      valueEl.textContent = formatValue(event.payload.value);
      timeEl.textContent = formatTimestamp(event.payload.timestamp);
      break;

    default:
      // Other event types - shouldn't reach here due to filter
      labelEl.textContent = 'unknown';
  }

  content.appendChild(labelEl);
  content.appendChild(valueEl);
  content.appendChild(timeEl);

  item.appendChild(content);

  return item;
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`;
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.slice(0, 60) + (json.length > 60 ? '...' : '');
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

/**
 * Format a timestamp for display.
 */
function formatTimestamp(ms: number): string {
  const date = new Date(performance.timeOrigin + ms);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}
