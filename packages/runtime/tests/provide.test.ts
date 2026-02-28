import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@liteforge/core';
import {
  createComponent,
  createApp,
  clearContext,
} from '../src/index.js';

describe('component provide', () => {
  let container: HTMLElement;

  beforeEach(() => {
    clearContext();
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should provide context to component function', async () => {
    let capturedTheme: string | undefined;

    const Child = createComponent({
      component: ({ use }) => {
        capturedTheme = use('theme');
        return document.createTextNode(`Theme: ${capturedTheme}`);
      },
    });

    const Parent = createComponent({
      provide: () => ({ theme: 'dark' }),
      component: () => {
        const childInstance = Child({});
        const div = document.createElement('div');
        childInstance.mount(div);
        return div;
      },
    });

    await createApp({
      root: Parent,
      target: '#app',
      context: { theme: 'light' },
    });

    // Child should see the overridden theme from parent
    expect(capturedTheme).toBe('dark');
  });

  it('should access parent context in provide', async () => {
    const Parent = createComponent({
      provide: ({ use }) => {
        const baseUrl = use<string>('baseUrl');
        return {
          api: { baseUrl, version: 'v2' },
        };
      },
      component: ({ use }) => {
        const api = use<{ baseUrl: string; version: string }>('api');
        return document.createTextNode(`${api.baseUrl}/${api.version}`);
      },
    });

    await createApp({
      root: Parent,
      target: '#app',
      context: { baseUrl: 'https://api.example.com' },
    });

    expect(container.textContent).toBe('https://api.example.com/v2');
  });

  it('should support nested provides', async () => {
    const values: string[] = [];

    const Inner = createComponent({
      provide: () => ({ level: 'inner' }),
      component: ({ use }) => {
        values.push(`Inner sees: ${use('level')}`);
        return document.createTextNode('Inner');
      },
    });

    const Middle = createComponent({
      provide: () => ({ level: 'middle' }),
      component: ({ use }) => {
        values.push(`Middle sees: ${use('level')}`);
        const innerInstance = Inner({});
        const div = document.createElement('div');
        innerInstance.mount(div);
        return div;
      },
    });

    const Outer = createComponent({
      provide: () => ({ level: 'outer' }),
      component: ({ use }) => {
        values.push(`Outer sees: ${use('level')}`);
        const middleInstance = Middle({});
        const div = document.createElement('div');
        middleInstance.mount(div);
        return div;
      },
    });

    await createApp({
      root: Outer,
      target: '#app',
      context: { level: 'app' },
    });

    expect(values).toEqual([
      'Outer sees: outer',
      'Middle sees: middle',
      'Inner sees: inner',
    ]);
  });

  it('should not affect sibling components', async () => {
    const values: string[] = [];

    const ChildA = createComponent({
      provide: () => ({ value: 'from-A' }),
      component: ({ use }) => {
        values.push(`ChildA: ${use('value')}`);
        return document.createTextNode('A');
      },
    });

    const ChildB = createComponent({
      component: ({ use }) => {
        values.push(`ChildB: ${use('value')}`);
        return document.createTextNode('B');
      },
    });

    const Parent = createComponent({
      component: () => {
        const div = document.createElement('div');
        const instanceA = ChildA({});
        const instanceB = ChildB({});
        instanceA.mount(div);
        instanceB.mount(div);
        return div;
      },
    });

    await createApp({
      root: Parent,
      target: '#app',
      context: { value: 'from-app' },
    });

    // ChildA should see its own provided value
    // ChildB should see the app-level value (not affected by ChildA's provide)
    expect(values).toContain('ChildA: from-A');
    expect(values).toContain('ChildB: from-app');
  });

  it('should provide signals in context', async () => {
    const theme = signal('light');

    const Child = createComponent({
      component: ({ use }) => {
        const themeSignal = use<typeof theme>('theme');
        return document.createTextNode(themeSignal());
      },
    });

    const Parent = createComponent({
      provide: () => ({ theme }),
      component: () => {
        const div = document.createElement('div');
        const childInstance = Child({});
        childInstance.mount(div);
        return div;
      },
    });

    await createApp({
      root: Parent,
      target: '#app',
    });

    expect(container.textContent).toContain('light');
  });
});
