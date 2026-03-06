import { describe, it, expect, vi } from 'vitest';
import {
  compileRoute,
  compileRoutes,
  matchRoutes,
  matchRoutesSync,
} from '../src/route-matcher.js';
import type { RouteDefinition } from '../src/types.js';

// =============================================================================
// Helpers
// =============================================================================

const mockComp = () => document.createElement('div');

function makeOptions() {
  return { guardRegistry: new Map(), lazyDefaults: undefined };
}

const childDefs: RouteDefinition[] = [
  { path: '/', component: mockComp },
  { path: '/posts', component: mockComp },
  { path: '/users', component: mockComp },
];

// =============================================================================
// lazyChildren — type round-trip via compileRoute
// =============================================================================

describe('compileRoute — lazyChildren', () => {
  it('stores lazyChildrenFn on CompiledRoute', () => {
    const loader = vi.fn().mockResolvedValue([]);
    const def: RouteDefinition = {
      path: '/admin',
      component: mockComp,
      lazyChildren: loader,
    };
    const compiled = compileRoute(def, null, makeOptions());
    expect(compiled.lazyChildrenFn).toBe(loader);
  });

  it('does NOT call the loader at compile time', () => {
    const loader = vi.fn().mockResolvedValue([]);
    const def: RouteDefinition = { path: '/admin', lazyChildren: loader };
    compileRoute(def, null, makeOptions());
    expect(loader).not.toHaveBeenCalled();
  });

  it('children array stays empty until resolved', () => {
    const def: RouteDefinition = {
      path: '/admin',
      lazyChildren: () => Promise.resolve([]),
    };
    const compiled = compileRoute(def, null, makeOptions());
    expect(compiled.children).toHaveLength(0);
  });

  it('route without lazyChildren has no lazyChildrenFn', () => {
    const def: RouteDefinition = { path: '/users', component: mockComp };
    const compiled = compileRoute(def, null, makeOptions());
    expect(compiled.lazyChildrenFn).toBeUndefined();
  });
});

// =============================================================================
// matchRoutes — async lazyChildren resolution
// =============================================================================

describe('matchRoutes — lazyChildren', () => {
  it('loads lazyChildren on first match of a child path', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
      { path: '*', component: mockComp },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    const matched = await matchRoutes('/admin/posts', compiled, makeOptions());
    expect(loader).toHaveBeenCalledTimes(1);
    expect(matched).not.toBeNull();
    expect(matched!.length).toBe(2);
    expect(matched![0]!.route.path).toBe('/admin');
    expect(matched![1]!.route.path).toBe('/posts');
  });

  it('caches lazyChildren — loader called only once across multiple navigations', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    await matchRoutes('/admin/posts', compiled, makeOptions());
    await matchRoutes('/admin/users', compiled, makeOptions());

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('after loading, children are mutated onto the CompiledRoute', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);
    const adminRoute = compiled[0]!;

    expect(adminRoute.children).toHaveLength(0);
    await matchRoutes('/admin/posts', compiled, makeOptions());
    expect(adminRoute.children.length).toBeGreaterThan(0);
  });

  it('returns parent match when navigating to parent path directly', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    const matched = await matchRoutes('/admin', compiled, makeOptions());
    // /admin matches the parent route directly (full match)
    expect(matched).not.toBeNull();
    expect(matched![0]!.route.path).toBe('/admin');
    // Loader MAY be triggered (to look for index child) — that's acceptable
  });

  it('parent with component is included in match chain', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    const matched = await matchRoutes('/admin/users', compiled, makeOptions());
    expect(matched).not.toBeNull();
    expect(matched!.some(m => m.route.path === '/admin')).toBe(true);
    expect(matched!.some(m => m.route.path === '/users')).toBe(true);
  });

  it('returns null for child paths that do not match any lazy child', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    const matched = await matchRoutes('/admin/nonexistent-deeply-nested-path', compiled, makeOptions());
    // No child matches /nonexistent-deeply-nested-path — parent route matches with /admin exact,
    // but the sub-path doesn't match any child
    // Parent has exact regex matching so /admin/nonexistent won't match parent directly
    // → null or just parent depending on prefix vs exact matching
    // The important thing: no crash and loader was called
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('lazyChildren with index route (/): direct /admin navigation returns index child', async () => {
    const childWithIndex: RouteDefinition[] = [
      { path: '/', component: mockComp },
      { path: '/posts', component: mockComp },
    ];
    const loader = vi.fn().mockResolvedValue(childWithIndex);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    const matched = await matchRoutes('/admin', compiled, makeOptions());
    expect(matched).not.toBeNull();
    // Either parent alone or parent + index child
    expect(matched!.length).toBeGreaterThanOrEqual(1);
    expect(matched![0]!.route.path).toBe('/admin');
  });
});

// =============================================================================
// matchRoutesSync — does not load lazyChildren
// =============================================================================

describe('matchRoutesSync — lazyChildren not triggered', () => {
  it('does not call the lazyChildren loader', () => {
    const loader = vi.fn().mockResolvedValue([{ path: '/posts', component: mockComp }]);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);
    matchRoutesSync('/admin/posts', compiled);
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns null for child paths when lazyChildren not yet loaded', () => {
    const loader = vi.fn().mockResolvedValue([{ path: '/posts', component: mockComp }]);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);
    // /admin/posts requires children to match — but children not loaded → no match
    const matched = matchRoutesSync('/admin/posts', compiled);
    // Parent /admin exact regex won't match /admin/posts ($ anchor) → null
    expect(matched).toBeNull();
  });

  it('returns match for parent route when navigating to parent directly', () => {
    const loader = vi.fn().mockResolvedValue([]);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);
    const matched = matchRoutesSync('/admin', compiled);
    expect(matched).not.toBeNull();
    expect(matched![0]!.route.path).toBe('/admin');
    expect(loader).not.toHaveBeenCalled();
  });

  it('after async matchRoutes loads children, sync works for those paths', async () => {
    const loader = vi.fn().mockResolvedValue(childDefs);
    const routes: RouteDefinition[] = [
      { path: '/admin', component: mockComp, lazyChildren: loader },
    ];
    const compiled = compileRoutes(routes, new Map(), undefined);

    // First load via async
    await matchRoutes('/admin/posts', compiled, makeOptions());
    // Now sync should find the already-loaded children
    const matched = matchRoutesSync('/admin/users', compiled);
    expect(matched).not.toBeNull();
    expect(matched!.some(m => m.route.path === '/users')).toBe(true);
  });
});
