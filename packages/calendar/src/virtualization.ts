/**
 * @liteforge/calendar - Virtual Scroll / Windowed Rendering
 *
 * Buckets timed events by time-slot and filters to only the visible
 * vertical viewport before the render loop, keeping DOM node count
 * bounded regardless of total event count.
 *
 * All-day events are never virtualized — they live in the all-day row,
 * not the scrollable time grid.
 */

import { signal } from '@liteforge/core'
import type { Signal } from '@liteforge/core'
import type { CalendarEvent } from './types.js'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VisibleTimeRange {
  /** Minutes from midnight, e.g. 480 = 08:00 */
  startMinutes: number
  /** Minutes from midnight, e.g. 1080 = 18:00 */
  endMinutes: number
  /** Extra minutes to pre-render outside the visible area on each side */
  overscanMinutes: number
}

export interface VirtualizationConfig {
  /** Enable virtualization (default: true) */
  enabled?: boolean
  /** Min event count before virtualization activates (default: 100) */
  threshold?: number
  /** Overscan buffer in minutes (default: 60) */
  overscanMinutes?: number
}

/** Map from slot-index → events whose start falls in that slot */
export type EventBucket<T extends CalendarEvent> = Map<number, T[]>

// ─── Stable event key ──────────────────────────────────────────────────────

/**
 * Stable string key for a calendar event occurrence.
 * Recurring occurrences already have `::` in their id from the RRULE engine.
 */
export function getEventKey(event: CalendarEvent): string {
  return `${event.id}::${event.start.getTime()}`
}

// ─── Event bucketing ───────────────────────────────────────────────────────

/**
 * Bucket events by which time-slot their start time falls in.
 * Slot index = floor(minutesFromMidnight / slotDuration).
 *
 * O(n) — one pass over all events. Lookup per slot is O(1).
 */
export function bucketEvents<T extends CalendarEvent>(
  events: T[],
  slotDuration: number,
): EventBucket<T> {
  const bucket: EventBucket<T> = new Map()
  for (const event of events) {
    const minutes = event.start.getHours() * 60 + event.start.getMinutes()
    const slotIndex = Math.floor(minutes / slotDuration)
    let list = bucket.get(slotIndex)
    if (!list) {
      list = []
      bucket.set(slotIndex, list)
    }
    list.push(event)
  }
  return bucket
}

// ─── Visible-range filter ──────────────────────────────────────────────────

/**
 * Filter events to those that overlap the effective visible window
 * (visible range expanded by overscan on both sides).
 *
 * An event overlaps if: event.startMinutes < windowEnd && event.endMinutes > windowStart
 * Uses minutes-from-midnight comparisons — no Date allocation.
 */
export function filterEventsByTimeRange<T extends CalendarEvent>(
  events: T[],
  range: VisibleTimeRange,
): T[] {
  const windowStart = range.startMinutes - range.overscanMinutes
  const windowEnd   = range.endMinutes   + range.overscanMinutes

  return events.filter((event) => {
    const startMins = event.start.getHours() * 60 + event.start.getMinutes()
    const endMins   = event.end.getHours()   * 60 + event.end.getMinutes()

    // Midnight-spanning events: end < start means it crosses midnight.
    // Treat as ending at 1440 (end of day) for windowing purposes.
    const effectiveEnd = endMins <= startMins ? 1440 : endMins

    return startMins < windowEnd && effectiveEnd > windowStart
  })
}

// ─── Scroll-driven visible-range signal ────────────────────────────────────

const FRAME_MS = 16 // one animation frame

/**
 * Create a signal tracking the current visible time range and a scroll
 * handler to update it. The handler is debounced to one frame (16 ms).
 *
 * @param dayStart      - first hour of the time grid (e.g. 8)
 * @param dayEnd        - last hour of the time grid (e.g. 20)
 * @param slotDuration  - minutes per slot (e.g. 30)
 * @param overscan      - overscan buffer in minutes (default: 60)
 */
export function createScrollHandler(
  dayStart: number,
  dayEnd: number,
  slotDuration: number,
  overscan: number = 60,
): {
  visibleRange: Signal<VisibleTimeRange>
  onScroll: (scrollTop: number, containerHeight: number) => void
  dispose: () => void
} {
  const totalMinutes = (dayEnd - dayStart) * 60
  // Slot height in pixels (mirrors the CSS formula used by the views)
  const slotHeight = Math.round((slotDuration / 30) * 40)
  const pxPerMinute = slotHeight / slotDuration

  const visibleRange = signal<VisibleTimeRange>({
    startMinutes: dayStart * 60,
    endMinutes: dayEnd * 60,
    overscanMinutes: overscan,
  })

  let timer: ReturnType<typeof setTimeout> | null = null

  function compute(scrollTop: number, containerHeight: number): VisibleTimeRange {
    const startMins = dayStart * 60 + Math.floor(scrollTop / pxPerMinute)
    const endMins   = startMins + Math.ceil(containerHeight / pxPerMinute)
    return {
      startMinutes: Math.max(dayStart * 60, startMins),
      endMinutes:   Math.min(dayStart * 60 + totalMinutes, endMins),
      overscanMinutes: overscan,
    }
  }

  function onScroll(scrollTop: number, containerHeight: number): void {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      visibleRange.set(compute(scrollTop, containerHeight))
    }, FRAME_MS)
  }

  function dispose(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { visibleRange, onScroll, dispose }
}

// ─── Should-virtualize gate ────────────────────────────────────────────────

const DEFAULT_THRESHOLD   = 100
const DEFAULT_OVERSCAN_MS = 60

/**
 * Resolve the effective virtualization config with defaults.
 */
export function resolveVirtConfig(cfg: VirtualizationConfig | undefined): {
  enabled: boolean
  threshold: number
  overscanMinutes: number
} {
  return {
    enabled:        cfg?.enabled        ?? true,
    threshold:      cfg?.threshold      ?? DEFAULT_THRESHOLD,
    overscanMinutes: cfg?.overscanMinutes ?? DEFAULT_OVERSCAN_MS,
  }
}

/**
 * Return true if virtualization should activate for this event list.
 */
export function shouldVirtualize(
  eventCount: number,
  cfg: VirtualizationConfig | undefined,
): boolean {
  const { enabled, threshold } = resolveVirtConfig(cfg)
  return enabled && eventCount >= threshold
}
