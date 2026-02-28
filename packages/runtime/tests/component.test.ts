import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@liteforge/core';
import {
  createComponent,
  isComponentFactory,
  initAppContext,
  clearContext,
} from '../src/index.js';

describe('createComponent', () => {
  let container: HTMLElement;

  beforeEach(() => {
    clearContext();
    initAppContext({});
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('basic component', () => {
    it('should create a component factory', () => {
      const MyComponent = createComponent({
        component: () => document.createTextNode('Hello'),
      });

      expect(typeof MyComponent).toBe('function');
      expect(isComponentFactory(MyComponent)).toBe(true);
    });

    it('should render simple component', () => {
      const MyComponent = createComponent({
        component: () => document.createTextNode('Hello World'),
      });

      const instance = MyComponent({});
      instance.mount(container);

      expect(container.textContent).toBe('Hello World');
    });

    it('should render element component', () => {
      const MyComponent = createComponent({
        component: () => {
          const div = document.createElement('div');
          div.className = 'test';
          div.textContent = 'Content';
          return div;
        },
      });

      const instance = MyComponent({});
      instance.mount(container);

      expect(container.innerHTML).toBe('<div class="test">Content</div>');
    });
  });

  describe('props', () => {
    it('should pass props to component', () => {
      const MyComponent = createComponent({
        component: ({ props }) => {
          return document.createTextNode(`Hello ${props.name}`);
        },
      });

      const instance = MyComponent({ name: 'World' });
      instance.mount(container);

      expect(container.textContent).toBe('Hello World');
    });

    it('should apply default props', () => {
      const MyComponent = createComponent({
        props: {
          name: { type: String, default: 'Default' },
          count: { type: Number, default: 0 },
        },
        component: ({ props }) => {
          return document.createTextNode(`${props.name}: ${props.count}`);
        },
      });

      const instance = MyComponent({} as { name: string; count: number });
      instance.mount(container);

      expect(container.textContent).toBe('Default: 0');
    });

    it('should override defaults with provided props', () => {
      const MyComponent = createComponent({
        props: {
          name: { type: String, default: 'Default' },
        },
        component: ({ props }) => {
          return document.createTextNode(props.name as string);
        },
      });

      const instance = MyComponent({ name: 'Custom' });
      instance.mount(container);

      expect(container.textContent).toBe('Custom');
    });

    it('should support function defaults', () => {
      const MyComponent = createComponent({
        props: {
          items: { type: Array, default: () => [] },
        },
        component: ({ props }) => {
          return document.createTextNode(JSON.stringify(props.items));
        },
      });

      // Props with defaults are now properly typed as optional
      const instance1 = MyComponent({});

      instance1.mount(container);
      expect(container.textContent).toBe('[]');
    });
  });

  describe('setup', () => {
    it('should run setup and pass result to component', () => {
      const setupSpy = vi.fn(() => ({ count: signal(0) }));

      const MyComponent = createComponent({
        setup: setupSpy,
        component: ({ setup }) => {
          return document.createTextNode(`Count: ${setup.count()}`);
        },
      });

      const instance = MyComponent({});
      instance.mount(container);

      expect(setupSpy).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('Count: 0');
    });

    it('should receive props in setup', () => {
      const MyComponent = createComponent({
        setup: ({ props }) => ({
          greeting: `Hello ${props.name}`,
        }),
        component: ({ setup }) => {
          return document.createTextNode(setup.greeting);
        },
      });

      const instance = MyComponent({ name: 'World' });
      instance.mount(container);

      expect(container.textContent).toBe('Hello World');
    });
  });

  describe('lifecycle - mounted', () => {
    it('should call mounted after component is in DOM', () => {
      const mountedSpy = vi.fn();

      const MyComponent = createComponent({
        component: () => {
          const div = document.createElement('div');
          div.id = 'test-el';
          return div;
        },
        mounted: ({ el }) => {
          mountedSpy(el.id);
        },
      });

      const instance = MyComponent({});
      expect(mountedSpy).not.toHaveBeenCalled();

      instance.mount(container);
      expect(mountedSpy).toHaveBeenCalledWith('test-el');
    });

    it('should receive all args in mounted', () => {
      const mountedSpy = vi.fn();

      const MyComponent = createComponent({
        setup: () => ({ value: 42 }),
        component: () => document.createElement('div'),
        mounted: ({ el, props, setup }) => {
          mountedSpy({ hasEl: !!el, props, setup });
        },
      });

      const instance = MyComponent({ name: 'test' });
      instance.mount(container);

      expect(mountedSpy).toHaveBeenCalledWith({
        hasEl: true,
        props: { name: 'test' },
        setup: { value: 42 },
      });
    });

    it('should run mounted cleanup on unmount', () => {
      const cleanupSpy = vi.fn();

      const MyComponent = createComponent({
        component: () => document.createElement('div'),
        mounted: () => cleanupSpy,
      });

      const instance = MyComponent({});
      instance.mount(container);
      expect(cleanupSpy).not.toHaveBeenCalled();

      instance.unmount();
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle - destroyed', () => {
    it('should call destroyed on unmount', () => {
      const destroyedSpy = vi.fn();

      const MyComponent = createComponent({
        component: () => document.createTextNode('test'),
        destroyed: destroyedSpy,
      });

      const instance = MyComponent({});
      instance.mount(container);
      expect(destroyedSpy).not.toHaveBeenCalled();

      instance.unmount();
      expect(destroyedSpy).toHaveBeenCalledTimes(1);
    });

    it('should receive props and setup in destroyed', () => {
      const destroyedSpy = vi.fn();

      const MyComponent = createComponent({
        setup: () => ({ value: 'setup-value' }),
        component: () => document.createTextNode('test'),
        destroyed: ({ props, setup }) => {
          destroyedSpy({ props, setup });
        },
      });

      const instance = MyComponent({ name: 'test' });
      instance.mount(container);
      instance.unmount();

      expect(destroyedSpy).toHaveBeenCalledWith({
        props: { name: 'test' },
        setup: { value: 'setup-value' },
      });
    });
  });

  describe('unmount', () => {
    it('should remove node from DOM', () => {
      const MyComponent = createComponent({
        component: () => document.createTextNode('test'),
      });

      const instance = MyComponent({});
      instance.mount(container);
      expect(container.textContent).toBe('test');

      instance.unmount();
      expect(container.textContent).toBe('');
    });

    it('should be safe to call multiple times', () => {
      const destroyedSpy = vi.fn();

      const MyComponent = createComponent({
        component: () => document.createTextNode('test'),
        destroyed: destroyedSpy,
      });

      const instance = MyComponent({});
      instance.mount(container);

      instance.unmount();
      instance.unmount();
      instance.unmount();

      expect(destroyedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNode', () => {
    it('should return current DOM node', () => {
      const MyComponent = createComponent({
        component: () => {
          const div = document.createElement('div');
          div.id = 'my-node';
          return div;
        },
      });

      const instance = MyComponent({});
      expect(instance.getNode()).toBeNull();

      instance.mount(container);
      const node = instance.getNode() as HTMLElement;
      expect(node.id).toBe('my-node');
    });

    it('should return null after unmount', () => {
      const MyComponent = createComponent({
        component: () => document.createElement('div'),
      });

      const instance = MyComponent({});
      instance.mount(container);
      expect(instance.getNode()).not.toBeNull();

      instance.unmount();
      expect(instance.getNode()).toBeNull();
    });
  });

  describe('insertBefore', () => {
    it('should insert before specified node', () => {
      const existing = document.createElement('span');
      existing.textContent = 'existing';
      container.appendChild(existing);

      const MyComponent = createComponent({
        component: () => document.createTextNode('inserted'),
      });

      const instance = MyComponent({});
      instance.mount(container, existing);

      expect(container.innerHTML).toBe('inserted<span>existing</span>');
    });
  });
});

describe('isComponentFactory', () => {
  it('should return true for component factories', () => {
    const MyComponent = createComponent({
      component: () => document.createTextNode('test'),
    });

    expect(isComponentFactory(MyComponent)).toBe(true);
  });

  it('should return false for regular functions', () => {
    const fn = () => document.createTextNode('test');
    expect(isComponentFactory(fn)).toBe(false);
  });

  it('should return false for non-functions', () => {
    expect(isComponentFactory(null)).toBe(false);
    expect(isComponentFactory(undefined)).toBe(false);
    expect(isComponentFactory({})).toBe(false);
    expect(isComponentFactory('string')).toBe(false);
  });
});
