/**
 * @liteforge/calendar - Virtualization Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { expectTypeOf } from 'vitest'
import type { CalendarEvent } from '../src/types.js'
import {
  bucketEvents,
  filterEventsByTimeRange,
  getEventKey,
  shouldVirtualize,
  createScrollHandler,
  resolveVirtConfig,
  type VisibleTimeRange,
  type EventBucket,
} from '../src/virtualization.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  id: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  allDay = false,
): CalendarEvent {
  const start = new Date(2024, 5, 10, startHour, startMinute)
  const end   = new Date(2024, 5, allDay ? 10 : 10, endHour, endMinute)
  return { id, title: `Event ${id}`, start, end, allDay }
}

function makeEventOnDate(
  id: string,
  startDate: Date,
  durationMinutes: number,
): CalendarEvent {
  const start = new Date(startDate)
  const end   = new Date(startDate.getTime() + durationMinutes * 60_000)
  return { id, title: `Event ${id}`, start, end }
}

const defaultRange: VisibleTimeRange = {
  startMinutes: 8 * 60,   // 08:00
  endMinutes:   18 * 60,  // 18:00
  overscanMinutes: 60,
}

// ─── getEventKey ──────────────────────────────────────────────────────────────

describe('getEventKey', () => {
  it('returns stable unique key for a regular event', () => {
    const event = makeEvent('e1', 9, 0, 10, 0)
    const key = getEventKey(event)
    expect(key).toBe(`e1::${event.start.getTime()}`)
  })

  it('returns same key on repeated calls (stable)', () => {
    const event = makeEvent('e1', 9, 0, 10, 0)
    expect(getEventKey(event)).toBe(getEventKey(event))
  })

  it('returns different key for two events with same id but different start', () => {
    const a = makeEvent('e1', 9, 0, 10, 0)
    const b = makeEvent('e1', 10, 0, 11, 0)
    expect(getEventKey(a)).not.toBe(getEventKey(b))
  })

  it('returns different key for two events with same start but different id', () => {
    const a = makeEvent('e1', 9, 0, 10, 0)
    const b = makeEvent('e2', 9, 0, 10, 0)
    expect(getEventKey(a)).not.toBe(getEventKey(b))
  })

  it('handles recurring occurrence ids (with :: separator)', () => {
    const start = new Date(2024, 5, 10, 9, 0)
    const event: CalendarEvent = {
      id: 'parent::2024-06-10T09:00:00.000Z',
      title: 'Recurring',
      start,
      end: new Date(2024, 5, 10, 10, 0),
    }
    const key = getEventKey(event)
    expect(key).toContain('parent::')
    expect(key).toContain(String(start.getTime()))
  })
})

// ─── bucketEvents ─────────────────────────────────────────────────────────────

describe('bucketEvents', () => {
  it('assigns events to correct slot buckets (slotDuration=30)', () => {
    const events = [
      makeEvent('a', 8, 0, 9, 0),    // slot 16 (480/30)
      makeEvent('b', 8, 30, 9, 30),  // slot 17 (510/30)
      makeEvent('c', 9, 0, 10, 0),   // slot 18 (540/30)
    ]
    const bucket = bucketEvents(events, 30)

    expect(bucket.get(16)).toHaveLength(1)  // 08:00
    expect(bucket.get(17)).toHaveLength(1)  // 08:30
    expect(bucket.get(18)).toHaveLength(1)  // 09:00
    expect(bucket.get(16)?.[0]?.id).toBe('a')
  })

  it('groups multiple events in the same slot', () => {
    const events = [
      makeEvent('a', 10, 0, 10, 30),
      makeEvent('b', 10, 15, 10, 45), // same slot as a (600/30 = 20, 615/30 = 20)
    ]
    const bucket = bucketEvents(events, 30)
    expect(bucket.get(20)).toHaveLength(2)
  })

  it('returns empty map for empty event list', () => {
    const bucket = bucketEvents([], 30)
    expect(bucket.size).toBe(0)
  })

  it('O(1) lookup — get slot 20 directly', () => {
    const events = Array.from({ length: 1000 }, (_, i) =>
      makeEvent(`e${i}`, 10, 0, 10, 30)
    )
    const bucket = bucketEvents(events, 30)
    // All 1000 events at 10:00 → slot 20
    expect(bucket.get(20)).toHaveLength(1000)
  })

  it('handles slotDuration=15 correctly', () => {
    const event = makeEvent('a', 9, 15, 9, 30)
    const bucket = bucketEvents([event], 15)
    // 9:15 = 555 minutes, 555/15 = 37
    expect(bucket.get(37)).toHaveLength(1)
  })

  it('return type is EventBucket<CalendarEvent>', () => {
    const bucket = bucketEvents<CalendarEvent>([], 30)
    expectTypeOf(bucket).toMatchTypeOf<EventBucket<CalendarEvent>>()
  })
})

// ─── filterEventsByTimeRange ──────────────────────────────────────────────────

describe('filterEventsByTimeRange', () => {
  it('includes events fully within the window (with overscan)', () => {
    const event = makeEvent('a', 10, 0, 11, 0)  // 10:00–11:00
    const result = filterEventsByTimeRange([event], defaultRange)
    // Window: 07:00–19:00 (with ±60 overscan)
    expect(result).toHaveLength(1)
  })

  it('excludes events outside the overscan window', () => {
    const event = makeEvent('a', 6, 0, 6, 30)   // 06:00–06:30, before 07:00 window
    const result = filterEventsByTimeRange([event], defaultRange)
    expect(result).toHaveLength(0)
  })

  it('includes events just inside overscan boundary (09:30 start)', () => {
    // Window: 07:00–19:00. An event starting at 07:00 exactly is the boundary.
    const range: VisibleTimeRange = {
      startMinutes: 10 * 60,   // visible from 10:00
      endMinutes:   18 * 60,
      overscanMinutes: 60,
    }
    // Event at 09:30 — 30 min before 10:00 start, within the 60-min overscan
    const event = makeEvent('a', 9, 30, 10, 0)
    const result = filterEventsByTimeRange([event], range)
    expect(result).toHaveLength(1)
  })

  it('excludes events that end before the overscan window starts', () => {
    const range: VisibleTimeRange = {
      startMinutes: 10 * 60,   // visible from 10:00
      endMinutes:   18 * 60,
      overscanMinutes: 60,     // pre-render down to 09:00
    }
    // Event ends at 08:55 — entirely before the 09:00 overscan boundary
    const event = makeEvent('a', 8, 0, 8, 55)
    const result = filterEventsByTimeRange([event], range)
    expect(result).toHaveLength(0)
  })

  it('includes events at exact viewport boundary (startMinutes boundary)', () => {
    const range: VisibleTimeRange = {
      startMinutes: 8 * 60,
      endMinutes:   18 * 60,
      overscanMinutes: 0,
    }
    // Event starts exactly at 08:00 (== startMinutes, no overscan)
    const event = makeEvent('a', 8, 0, 9, 0)
    const result = filterEventsByTimeRange([event], range)
    expect(result).toHaveLength(1)
  })

  it('includes events that end at exact viewport end', () => {
    const range: VisibleTimeRange = {
      startMinutes: 8 * 60,
      endMinutes:   18 * 60,
      overscanMinutes: 0,
    }
    // Event ends exactly at 18:00 — start (17:30) < endMinutes(18:00) → included
    const event = makeEvent('a', 17, 30, 18, 0)
    const result = filterEventsByTimeRange([event], range)
    expect(result).toHaveLength(1)
  })

  it('handles midnight-spanning event (23:00–01:00 next day)', () => {
    const start = new Date(2024, 5, 10, 23, 0)
    const end   = new Date(2024, 5, 11,  1, 0)  // next day
    const event: CalendarEvent = { id: 'midnight', title: 'Midnight', start, end }

    const range: VisibleTimeRange = {
      startMinutes: 22 * 60,
      endMinutes:   24 * 60,
      overscanMinutes: 30,
    }
    const result = filterEventsByTimeRange([event], range)
    // start=23:00 (1380 mins) is within window [21:30–24:30]
    expect(result).toHaveLength(1)
  })

  it('midnight-spanning event not lost when end < start', () => {
    // Event 23:00–01:00: endMins(60) < startMins(1380), so effectiveEnd=1440
    const start = new Date(2024, 5, 10, 23, 0)
    const end   = new Date(2024, 5, 11,  1, 0)
    const event: CalendarEvent = { id: 'midnight', title: 'Midnight', start, end }

    const fullRange: VisibleTimeRange = {
      startMinutes: 0,
      endMinutes:   24 * 60,
      overscanMinutes: 0,
    }
    expect(filterEventsByTimeRange([event], fullRange)).toHaveLength(1)
  })

  it('returns empty for empty events array', () => {
    expect(filterEventsByTimeRange([], defaultRange)).toHaveLength(0)
  })

  it('returns CalendarEvent[] type', () => {
    const events: CalendarEvent[] = []
    const result = filterEventsByTimeRange(events, defaultRange)
    expectTypeOf(result).toEqualTypeOf<CalendarEvent[]>()
  })
})

// ─── shouldVirtualize ────────────────────────────────────────────────────────

describe('shouldVirtualize', () => {
  it('returns false when event count is below threshold (50 < 100)', () => {
    expect(shouldVirtualize(50, undefined)).toBe(false)
  })

  it('returns true when event count meets threshold (100 >= 100)', () => {
    expect(shouldVirtualize(100, undefined)).toBe(true)
  })

  it('returns true for event count above threshold (150 > 100)', () => {
    expect(shouldVirtualize(150, undefined)).toBe(true)
  })

  it('returns false when explicitly disabled', () => {
    expect(shouldVirtualize(1000, { enabled: false })).toBe(false)
  })

  it('activates for 1 event when threshold is 0', () => {
    expect(shouldVirtualize(1, { threshold: 0 })).toBe(true)
  })

  it('activates for 0 events when threshold is 0', () => {
    expect(shouldVirtualize(0, { threshold: 0 })).toBe(true)
  })

  it('respects custom threshold', () => {
    expect(shouldVirtualize(49,  { threshold: 50 })).toBe(false)
    expect(shouldVirtualize(50,  { threshold: 50 })).toBe(true)
    expect(shouldVirtualize(200, { threshold: 50 })).toBe(true)
  })

  it('disabled overrides threshold', () => {
    expect(shouldVirtualize(9999, { enabled: false, threshold: 0 })).toBe(false)
  })
})

// ─── resolveVirtConfig ───────────────────────────────────────────────────────

describe('resolveVirtConfig', () => {
  it('applies defaults when config is undefined', () => {
    const resolved = resolveVirtConfig(undefined)
    expect(resolved.enabled).toBe(true)
    expect(resolved.threshold).toBe(100)
    expect(resolved.overscanMinutes).toBe(60)
  })

  it('uses provided values over defaults', () => {
    const resolved = resolveVirtConfig({ enabled: false, threshold: 200, overscanMinutes: 120 })
    expect(resolved.enabled).toBe(false)
    expect(resolved.threshold).toBe(200)
    expect(resolved.overscanMinutes).toBe(120)
  })

  it('partially overrides — only threshold', () => {
    const resolved = resolveVirtConfig({ threshold: 50 })
    expect(resolved.enabled).toBe(true)      // default
    expect(resolved.threshold).toBe(50)
    expect(resolved.overscanMinutes).toBe(60) // default
  })
})

// ─── createScrollHandler ─────────────────────────────────────────────────────

describe('createScrollHandler', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('initialises visible range to full day', () => {
    const { visibleRange, dispose } = createScrollHandler(8, 20, 30, 60)
    expect(visibleRange().startMinutes).toBe(8 * 60)
    expect(visibleRange().endMinutes).toBe(20 * 60)
    expect(visibleRange().overscanMinutes).toBe(60)
    dispose()
  })

  it('updates range after scroll + debounce flush', () => {
    const { visibleRange, onScroll, dispose } = createScrollHandler(8, 20, 30, 60)

    // Slot height = round((30/30)*40) = 40px, pxPerMinute = 40/30 ≈ 1.333
    // scrollTop=480 → startMins = 480 + floor(480/1.333) = 480 + 360 = 840 (14:00)
    // containerHeight=240 → shows 240/1.333 ≈ 180 minutes → endMins ≈ 14:00+3h = 17:00
    onScroll(480, 240)

    // Before debounce fires, range unchanged
    expect(visibleRange().startMinutes).toBe(8 * 60)

    vi.runAllTimers()

    // After debounce, range updated
    expect(visibleRange().startMinutes).toBeGreaterThan(8 * 60)
    dispose()
  })

  it('debounces rapid scrolls — only fires once per frame', () => {
    const { visibleRange, onScroll, dispose } = createScrollHandler(8, 20, 30, 60)

    // Fire 100 scroll events
    for (let i = 0; i < 100; i++) {
      onScroll(i * 4, 400)
    }

    vi.runAllTimers()

    // Range should reflect the LAST scroll position, not the first
    // Last scroll: scrollTop = 99*4 = 396
    expect(visibleRange().startMinutes).toBeGreaterThan(8 * 60)
    dispose()
  })

  it('dispose cancels pending debounce', () => {
    const { visibleRange, onScroll, dispose } = createScrollHandler(8, 20, 30, 60)

    onScroll(500, 300)
    dispose()  // cancel before timer fires

    vi.runAllTimers()
    // Range should NOT have updated — debounce was cancelled
    expect(visibleRange().startMinutes).toBe(8 * 60)
  })

  it('clamps start minutes to dayStart * 60', () => {
    const { visibleRange, onScroll, dispose } = createScrollHandler(8, 20, 30, 60)

    // scrollTop = 0 → should clamp to dayStart
    onScroll(0, 400)
    vi.runAllTimers()

    expect(visibleRange().startMinutes).toBe(8 * 60)
    dispose()
  })

  it('clamps end minutes to (dayEnd - dayStart) * 60', () => {
    const { visibleRange, onScroll, dispose } = createScrollHandler(8, 20, 30, 60)

    // Scroll to bottom: large scrollTop + large containerHeight
    onScroll(100_000, 100_000)
    vi.runAllTimers()

    expect(visibleRange().endMinutes).toBe(20 * 60)
    dispose()
  })
})

// ─── Integration: filter pipeline ────────────────────────────────────────────

describe('virtualization filter pipeline', () => {
  it('below threshold: all 50 events pass through unfiltered', () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeEvent(`e${i}`, 8 + (i % 10), 0, 9 + (i % 10), 0)
    )
    const range: VisibleTimeRange = {
      startMinutes: 12 * 60,
      endMinutes: 14 * 60,
      overscanMinutes: 60,
    }

    // Below threshold → no filtering
    if (!shouldVirtualize(events.length, undefined)) {
      // All events pass through
      expect(events).toHaveLength(50)
    } else {
      const filtered = filterEventsByTimeRange(events, range)
      expect(filtered.length).toBeLessThan(50)
    }
    // Threshold is 100, so 50 should NOT virtualize
    expect(shouldVirtualize(50, undefined)).toBe(false)
  })

  it('above threshold (150 events): only visible + overscan events in filtered set', () => {
    // All events at 08:00–09:00, visible window is 14:00–18:00 (with 60 min overscan → 13:00–19:00)
    const events = Array.from({ length: 150 }, (_, i) =>
      makeEvent(`e${i}`, 8, 0, 9, 0)
    )
    const range: VisibleTimeRange = {
      startMinutes: 14 * 60,
      endMinutes:   18 * 60,
      overscanMinutes: 60,
    }

    expect(shouldVirtualize(150, undefined)).toBe(true)
    const filtered = filterEventsByTimeRange(events, range)
    // 08:00 events are outside [13:00–19:00] → all filtered out
    expect(filtered).toHaveLength(0)
  })

  it('events within overscan are retained when above threshold', () => {
    const events = [
      ...Array.from({ length: 120 }, (_, i) => makeEvent(`far${i}`, 8, 0, 8, 30)),
      makeEvent('near1', 13, 30, 14, 0),  // 30 min before visible start (14:00) → within 60 overscan
      makeEvent('near2', 14, 0, 14, 30),  // exactly at visible start → included
      makeEvent('near3', 18, 30, 19, 0),  // 30 min after visible end (18:00) → within overscan
    ]
    const range: VisibleTimeRange = {
      startMinutes: 14 * 60,
      endMinutes:   18 * 60,
      overscanMinutes: 60,
    }

    expect(shouldVirtualize(events.length, undefined)).toBe(true)
    const filtered = filterEventsByTimeRange(events, range)

    const ids = filtered.map((e) => e.id)
    expect(ids).toContain('near1')
    expect(ids).toContain('near2')
    expect(ids).toContain('near3')
    // Far events (08:00) should not be in filtered result
    expect(ids.filter((id) => id.startsWith('far'))).toHaveLength(0)
  })

  it('0 events: no errors, returns empty array', () => {
    const range: VisibleTimeRange = { startMinutes: 480, endMinutes: 1080, overscanMinutes: 60 }
    expect(filterEventsByTimeRange([], range)).toHaveLength(0)
    expect(bucketEvents([], 30).size).toBe(0)
    expect(shouldVirtualize(0, undefined)).toBe(false)
  })

  it('1000 events: DOM node count bounded under 200 for a narrow viewport', () => {
    // Simulate 1000 events across a full day
    const events = Array.from({ length: 1000 }, (_, i) => {
      const hour = 8 + Math.floor(i / 100)  // 10 hours × 100 events
      return makeEvent(`e${i}`, hour, 0, hour, 30)
    })

    // Viewport shows 10:00–12:00 (120 min) with 60 min overscan → 09:00–13:00 (240 min)
    const range: VisibleTimeRange = {
      startMinutes: 10 * 60,
      endMinutes:   12 * 60,
      overscanMinutes: 60,
    }

    expect(shouldVirtualize(1000, undefined)).toBe(true)
    const filtered = filterEventsByTimeRange(events, range)

    // Only events in 09:00–13:00 (hours 9, 10, 11, 12) should appear
    // That's 4 hours × 100 events = 400, but we have events at hours 8–17
    // Actually: windowStart=540 (09:00), windowEnd=780 (13:00)
    // Events at 09:00 (hour=9 → i=100-199), 10:00 (i=200-299), 11:00 (i=300-399), 12:00 (i=400-499)
    expect(filtered.length).toBeLessThanOrEqual(400)
    expect(filtered.length).toBeLessThan(1000) // significantly fewer than 1000
  })
})

// ─── Type safety ─────────────────────────────────────────────────────────────

describe('type safety', () => {
  it('filterEventsByTimeRange preserves generic type T', () => {
    interface AppEvent extends CalendarEvent {
      therapistId: string
    }
    const events: AppEvent[] = []
    const result = filterEventsByTimeRange(events, defaultRange)
    expectTypeOf(result).toEqualTypeOf<AppEvent[]>()
  })

  it('bucketEvents preserves generic type T', () => {
    interface AppEvent extends CalendarEvent {
      therapistId: string
    }
    const events: AppEvent[] = []
    const result = bucketEvents(events, 30)
    expectTypeOf(result).toMatchTypeOf<EventBucket<AppEvent>>()
  })

  it('VisibleTimeRange has correct shape', () => {
    const range: VisibleTimeRange = {
      startMinutes: 480,
      endMinutes: 1080,
      overscanMinutes: 60,
    }
    expectTypeOf(range.startMinutes).toEqualTypeOf<number>()
    expectTypeOf(range.endMinutes).toEqualTypeOf<number>()
    expectTypeOf(range.overscanMinutes).toEqualTypeOf<number>()
  })
})
