import { describe, it, expect, vi } from 'vitest';
import { createMemoryHistory, targetToHref } from '../src/history.js';

// =============================================================================
// createMemoryHistory
// =============================================================================

describe('createMemoryHistory', () => {
  it('creates history with default initial entry', () => {
    const history = createMemoryHistory();
    expect(history.location.path).toBe('/');
  });

  it('creates history with custom initial entries', () => {
    const history = createMemoryHistory({
      initialEntries: ['/home', '/about', '/contact'],
    });
    // Should start at the last entry
    expect(history.location.path).toBe('/contact');
  });

  it('creates history with custom initial index', () => {
    const history = createMemoryHistory({
      initialEntries: ['/home', '/about', '/contact'],
      initialIndex: 1,
    });
    expect(history.location.path).toBe('/about');
  });

  it('parses initial entries with query strings', () => {
    const history = createMemoryHistory({
      initialEntries: ['/search?q=test'],
    });
    expect(history.location.path).toBe('/search');
    expect(history.location.search).toBe('q=test');
    expect(history.location.query).toEqual({ q: 'test' });
  });

  it('parses initial entries with hash', () => {
    const history = createMemoryHistory({
      initialEntries: ['/page#section'],
    });
    expect(history.location.path).toBe('/page');
    expect(history.location.hash).toBe('section');
  });

  it('parses initial entries with query and hash', () => {
    const history = createMemoryHistory({
      initialEntries: ['/page?foo=bar#section'],
    });
    expect(history.location.path).toBe('/page');
    expect(history.location.search).toBe('foo=bar');
    expect(history.location.hash).toBe('section');
  });
});

describe('memory history navigation', () => {
  it('push adds new entry', () => {
    const history = createMemoryHistory();
    history.push('/about');
    expect(history.location.path).toBe('/about');
  });

  it('push removes forward entries', () => {
    const history = createMemoryHistory();
    history.push('/page1');
    history.push('/page2');
    history.back();
    expect(history.location.path).toBe('/page1');

    history.push('/page3');
    expect(history.location.path).toBe('/page3');

    // Forward should not work (page2 was removed)
    history.forward();
    expect(history.location.path).toBe('/page3');
  });

  it('replace updates current entry', () => {
    const history = createMemoryHistory();
    history.push('/page1');
    history.replace('/page1-updated');
    expect(history.location.path).toBe('/page1-updated');

    // Back should go to initial entry
    history.back();
    expect(history.location.path).toBe('/');
  });

  it('back navigates to previous entry', () => {
    const history = createMemoryHistory();
    history.push('/page1');
    history.push('/page2');
    history.back();
    expect(history.location.path).toBe('/page1');
  });

  it('forward navigates to next entry', () => {
    const history = createMemoryHistory();
    history.push('/page1');
    history.push('/page2');
    history.back();
    history.forward();
    expect(history.location.path).toBe('/page2');
  });

  it('go navigates by delta', () => {
    const history = createMemoryHistory();
    history.push('/page1');
    history.push('/page2');
    history.push('/page3');

    history.go(-2);
    expect(history.location.path).toBe('/page1');

    history.go(2);
    expect(history.location.path).toBe('/page3');
  });

  it('go does nothing for out-of-bounds delta', () => {
    const history = createMemoryHistory();
    history.push('/page1');

    history.go(-10);
    expect(history.location.path).toBe('/page1');

    history.go(10);
    expect(history.location.path).toBe('/page1');
  });

  it('push with object target', () => {
    const history = createMemoryHistory();
    history.push({
      path: '/search',
      query: { q: 'test' },
      hash: 'results',
    });

    expect(history.location.path).toBe('/search');
    expect(history.location.query).toEqual({ q: 'test' });
    expect(history.location.hash).toBe('results');
  });

  it('push preserves state', () => {
    const history = createMemoryHistory();
    history.push({
      path: '/page',
      state: { scrollPos: 100 },
    });

    expect(history.location.state).toEqual({ scrollPos: 100 });
  });
});

describe('memory history listeners', () => {
  it('listen is called on push', () => {
    const history = createMemoryHistory();
    const listener = vi.fn();

    history.listen(listener);
    history.push('/page1');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/page1' }),
      'push'
    );
  });

  it('listen is called on replace', () => {
    const history = createMemoryHistory();
    const listener = vi.fn();

    history.listen(listener);
    history.replace('/page1');

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/page1' }),
      'replace'
    );
  });

  it('listen is called on pop (back/forward)', () => {
    const history = createMemoryHistory();
    history.push('/page1');

    const listener = vi.fn();
    history.listen(listener);

    history.back();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/' }),
      'pop'
    );
  });

  it('unsubscribe stops listener', () => {
    const history = createMemoryHistory();
    const listener = vi.fn();

    const unsubscribe = history.listen(listener);
    history.push('/page1');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    history.push('/page2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('multiple listeners are supported', () => {
    const history = createMemoryHistory();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    history.listen(listener1);
    history.listen(listener2);
    history.push('/page1');

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});

describe('memory history utilities', () => {
  it('createHref creates href from string', () => {
    const history = createMemoryHistory();
    expect(history.createHref('/about')).toBe('/about');
  });

  it('createHref creates href from object', () => {
    const history = createMemoryHistory();
    const href = history.createHref({
      path: '/search',
      query: { q: 'test' },
      hash: 'results',
    });
    expect(href).toBe('/search?q=test#results');
  });

  it('destroy clears listeners', () => {
    const history = createMemoryHistory();
    const listener = vi.fn();

    history.listen(listener);
    history.destroy();
    history.push('/page1');

    expect(listener).not.toHaveBeenCalled();
  });
});

// =============================================================================
// targetToHref
// =============================================================================

describe('targetToHref', () => {
  it('returns string path as-is if absolute', () => {
    expect(targetToHref('/about')).toBe('/about');
  });

  it('joins relative path with base', () => {
    expect(targetToHref('about', '/app')).toBe('/app/about');
  });

  it('handles object target', () => {
    const href = targetToHref({
      path: '/search',
      query: { q: 'test', page: '1' },
      hash: 'results',
    });
    expect(href).toContain('/search');
    expect(href).toContain('q=test');
    expect(href).toContain('#results');
  });

  it('handles object target without query or hash', () => {
    expect(targetToHref({ path: '/page' })).toBe('/page');
  });
});
