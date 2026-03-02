/**
 * LiteForge Control Flow Components
 *
 * Components for conditional rendering and list iteration.
 * These handle DOM insertion/removal reactively based on signals.
 */

import { effect } from '@liteforge/core';
import type { ComponentInstance, ComponentFactory, ComponentFactoryInternal, RenderFunction } from './types.js';
import { isComponentFactory } from './component.js';

// ============================================================================
// Type Discrimination Helper
// ============================================================================

/**
 * Discriminated union for dynamic component types.
 * Helps TypeScript properly narrow between RenderFunction and ComponentFactory.
 */
type DynamicComponentDiscriminator<P extends Record<string, unknown>> =
  | { kind: 'factory'; value: ComponentFactory<P> }
  | { kind: 'render'; value: RenderFunction }
  | { kind: 'null' };

/**
 * Discriminate a dynamic component value into a tagged union.
 * This helps TypeScript narrow types that can't be narrowed with type guards alone.
 */
function discriminateDynamicComponent<P extends Record<string, unknown>>(
  comp: RenderFunction | ComponentFactory<P> | null
): DynamicComponentDiscriminator<P> {
  if (comp === null) {
    return { kind: 'null' };
  }
  if (isComponentFactory(comp)) {
    // Safe cast: isComponentFactory checks for __liteforge_component
    return { kind: 'factory', value: comp as ComponentFactory<P> };
  }
  // If it's not null and not a ComponentFactory, it must be a RenderFunction
  return { kind: 'render', value: comp as RenderFunction };
}

// ============================================================================
// Show Component
// ============================================================================

/**
 * Config for Show component (internal use).
 * Use ShowProps<T> from types.ts for external typing.
 */
export interface ShowConfig<T = unknown> {
  when: (() => T) | T;
  fallback?: () => Node;
  children: (value: NonNullable<T>) => Node;
}

/**
 * Conditionally render children based on a condition.
 * When the condition is truthy, the truthy value is passed to the children callback.
 * 
 * @typeParam T - The type returned by the `when` getter
 *
 * @example
 * ```ts
 * // Boolean condition
 * Show({
 *   when: () => isLoggedIn(),
 *   fallback: () => document.createTextNode('Please log in'),
 *   children: () => createWelcomeMessage(),
 * })
 * 
 * // Value-based condition with type narrowing
 * Show({
 *   when: () => currentUser(),  // User | null
 *   children: (user) => (       // user is User, guaranteed non-null
 *     <h1>{user.name}</h1>
 *   ),
 * })
 * ```
 */
// Debug counter for Show instances
let showInstanceId = 0;

export function Show<T>(config: ShowConfig<T>): Node {
  const { when, fallback, children } = config;

  // Create a marker comment for positioning
  const instanceId = ++showInstanceId;
  const marker = document.createComment(`Show:${instanceId}`);
  let currentNode: Node | null = null;
  let lastValue: T | undefined;
  let hasRendered = false;

  // Resolve the condition to a function
  const getValue = (): T => {
    if (typeof when === 'function') {
      return (when as () => T)();
    }
    return when;
  };

  // Update content based on condition
  function updateContent(): void {
    const parentElement = marker.parentNode as Element;
    if (!parentElement) return;

    const value = getValue();
    
    // Value unchanged (by reference) → nothing to do
    // This handles: same primitive (boolean true/false/null), same object reference
    // Prevents re-rendering when isAdmin() returns same boolean but effect re-runs
    if (hasRendered && Object.is(value, lastValue)) {
      return;
    }
    
    lastValue = value;
    hasRendered = true;

    // Remove old node if it exists
    if (currentNode && currentNode.parentNode) {
      currentNode.parentNode.removeChild(currentNode);
      currentNode = null;
    }

    // Create and insert new node
    const isTruthy = Boolean(value);
    const newNode = isTruthy 
      ? children(value as NonNullable<T>) 
      : fallback?.() ?? null;

    if (newNode) {
      parentElement.insertBefore(newNode, marker.nextSibling);
      currentNode = newNode;
    }
  }

  // Set up reactive effect for updates
  // We use requestAnimationFrame to ensure the marker is in the DOM
  // before the first update (replaces problematic MutationObserver)
  effect(() => {
    // Read the value to track dependencies
    getValue();

    // Only update if marker is in DOM
    if (marker.parentNode) {
      updateContent();
    } else {
      // Marker not in DOM yet - schedule check for next frame
      requestAnimationFrame(() => {
        if (marker.parentNode) {
          updateContent();
        }
      });
    }
  });

  return marker;
}

// ============================================================================
// For Component
// ============================================================================

/**
 * Config for For component (internal use).
 * Use ForProps<T> from types.ts for external typing.
 */
export interface ForConfig<T> {
  each: (() => ReadonlyArray<T>) | (() => T[]) | ReadonlyArray<T> | T[];
  key?: keyof T | ((item: T, index: number) => string | number);
  children: (item: T, index: number) => Node;
  fallback?: () => Node;
}

interface ForItem<T> {
  item: T;
  key: string | number;
  node: Node;
  index: number;
}

/**
 * Render a list of items with keyed reconciliation.
 * 
 * @typeParam T - The item type, inferred from the `each` array
 *
 * @example
 * ```ts
 * For({
 *   each: () => users(),
 *   key: 'id',
 *   children: (user, index) => {
 *     return document.createTextNode(`${index}: ${user.name}`);
 *   },
 *   fallback: () => document.createTextNode('No users'),
 * })
 * ```
 */
export function For<T>(config: ForConfig<T>): Node {
  const { each, key, children, fallback } = config;

  // Create a marker comment for positioning
  const marker = document.createComment('For');
  let items: ForItem<T>[] = [];
  let fallbackNode: Node | null = null;
  let isInitialized = false;

  // Resolve the list to a function
  const getList = (): ReadonlyArray<T> => {
    if (typeof each === 'function') {
      return (each as () => ReadonlyArray<T>)();
    }
    return each;
  };

  // Get key for an item
  const getKey = (item: T, index: number): string | number => {
    if (key === undefined) {
      // For primitives without explicit key, use the value itself to enable proper reconciliation
      // This allows detecting when items at the same index have different values
      if (typeof item === 'string' || typeof item === 'number') {
        return `${index}:${item}`;
      }
      // For objects without key, fall back to index (no reconciliation benefit)
      return index;
    }
    if (typeof key === 'function') {
      return key(item, index);
    }
    return String(item[key]);
  };

  // Remove fallback node if present
  function removeFallback(): void {
    if (fallbackNode && fallbackNode.parentNode) {
      fallbackNode.parentNode.removeChild(fallbackNode);
      fallbackNode = null;
    }
  }

  // Reconcile the list
  function updateList(): void {
    const parentElement = marker.parentNode as Element;
    if (!parentElement) return;

    const list = getList();

    // Handle empty list with fallback
    if (list.length === 0) {
      // Remove all existing items
      for (const oldItem of items) {
        if (oldItem.node.parentNode) {
          oldItem.node.parentNode.removeChild(oldItem.node);
        }
      }
      items = [];

      // Show fallback if provided
      if (fallback && !fallbackNode) {
        fallbackNode = fallback();
        parentElement.insertBefore(fallbackNode, marker.nextSibling);
      }
      return;
    }

    // Remove fallback if list has items
    removeFallback();

    // Build a map of existing items by key
    const existingByKey = new Map<string | number, ForItem<T>>();
    for (const item of items) {
      existingByKey.set(item.key, item);
    }

    // Build new items list
    const newItems: ForItem<T>[] = [];
    const newKeys = new Set<string | number>();

    for (let i = 0; i < list.length; i++) {
      const item = list[i] as T;
      const itemKey = getKey(item, i);
      newKeys.add(itemKey);

      const existing = existingByKey.get(itemKey);

      if (existing) {
        // Reuse existing item, update index
        existing.item = item;
        existing.index = i;
        newItems.push(existing);
      } else {
        // Create new item - pass plain index number
        const node = children(item, i);
        newItems.push({ item, key: itemKey, node, index: i });
      }
    }

    // Remove items that are no longer in the list
    for (const oldItem of items) {
      if (!newKeys.has(oldItem.key)) {
        if (oldItem.node.parentNode) {
          oldItem.node.parentNode.removeChild(oldItem.node);
        }
      }
    }

    // Insert/reorder items in the DOM
    // We need to maintain the correct order after the marker
    let prevNode: Node = marker;

    for (const newItem of newItems) {
      const { node } = newItem;
      const expectedPosition = prevNode.nextSibling;

      if (node !== expectedPosition) {
        // Node is either not in DOM or in wrong position
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
        parentElement.insertBefore(node, prevNode.nextSibling);
      }

      prevNode = node;
    }

    items = newItems;
  }

  // Use MutationObserver to detect when marker is added to DOM
  const observer = new MutationObserver(() => {
    if (marker.parentNode && !isInitialized) {
      isInitialized = true;
      observer.disconnect();
      updateList();
    }
  });

  observer.observe(document, { childList: true, subtree: true });

  // Set up reactive effect for updates
  effect(() => {
    // Read the list to track dependencies
    getList();

    // Only update if marker is in DOM
    if (marker.parentNode) {
      updateList();
    }
  });

  return marker;
}

// ============================================================================
// Switch / Match Components
// ============================================================================

/**
 * A single case in a Switch statement.
 */
export interface MatchCase {
  when: (() => boolean) | boolean;
  render: () => Node;
}

/**
 * Config for Switch component (internal use).
 * Use SwitchProps from types.ts for external typing.
 */
export interface SwitchConfig {
  fallback?: () => Node;
  children: Array<MatchCase>;
}

/**
 * Config for Match helper.
 */
export interface MatchConfig {
  when: (() => boolean) | boolean;
  children: () => Node;
}

/**
 * Render the first matching case, or fallback.
 *
 * @example
 * ```ts
 * Switch({
 *   fallback: () => document.createTextNode('Unknown'),
 *   children: [
 *     Match({ when: () => status() === 'loading', children: () => Spinner() }),
 *     Match({ when: () => status() === 'error', children: () => ErrorView() }),
 *     Match({ when: () => status() === 'success', children: () => SuccessView() }),
 *   ],
 * })
 * ```
 */
export function Switch(config: SwitchConfig): Node {
  const { fallback, children } = config;

  const marker = document.createComment('Switch');
  let currentNode: Node | null = null;
  let currentIndex = -1;
  let isInitialized = false;

  function findMatchIndex(): number {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child) continue;
      const condition = typeof child.when === 'function' ? child.when() : child.when;
      if (condition) {
        return i;
      }
    }
    return fallback ? -2 : -1; // -2 = fallback, -1 = no match
  }

  function updateSwitch(): void {
    const parentElement = marker.parentNode as Element;
    if (!parentElement) return;

    const matchedIndex = findMatchIndex();

    // Only update if the matched case changed
    if (matchedIndex !== currentIndex) {
      // Remove old node
      if (currentNode && currentNode.parentNode) {
        currentNode.parentNode.removeChild(currentNode);
        currentNode = null;
      }

      // Insert new node
      let render: (() => Node) | undefined;
      if (matchedIndex >= 0) {
        render = children[matchedIndex]?.render;
      } else if (matchedIndex === -2) {
        render = fallback;
      }

      if (render) {
        currentNode = render();
        parentElement.insertBefore(currentNode, marker.nextSibling);
      }

      currentIndex = matchedIndex;
    }
  }

  // Use MutationObserver to detect when marker is added to DOM
  const observer = new MutationObserver(() => {
    if (marker.parentNode && !isInitialized) {
      isInitialized = true;
      observer.disconnect();
      updateSwitch();
    }
  });

  observer.observe(document, { childList: true, subtree: true });

  // Set up reactive effect
  effect(() => {
    // Read all conditions to track dependencies
    for (const child of children) {
      if (typeof child.when === 'function') {
        child.when();
      }
    }

    if (marker.parentNode) {
      updateSwitch();
    }
  });

  return marker;
}

/**
 * Helper to create a Match case for Switch.
 * 
 * @example
 * ```ts
 * Match({
 *   when: () => status() === 'active',
 *   children: () => <span>Active</span>,
 * })
 * ```
 */
export function Match(config: MatchConfig): MatchCase {
  return { when: config.when, render: config.children };
}

// ============================================================================
// Dynamic Component
// ============================================================================

/**
 * Configuration for the Dynamic component.
 * The component prop is a getter that returns either:
 * - RenderFunction: A simple () => Node function
 * - ComponentFactory: A LiteForge component from createComponent()
 * - null: No component to render
 */
export interface DynamicConfig<P extends Record<string, unknown>> {
  component: () => RenderFunction | ComponentFactory<P> | null;
  props?: P | (() => P);
}

/**
 * Dynamically render a component based on a signal.
 *
 * @example
 * ```ts
 * Dynamic({
 *   component: () => currentView(),
 *   props: () => ({ id: currentId() }),
 * })
 * ```
 */
export function Dynamic<P extends Record<string, unknown>>(config: DynamicConfig<P>): Node {
  const { component, props } = config;

  const marker = document.createComment('Dynamic');
  let currentNode: Node | null = null;
  let currentComponent: RenderFunction | ComponentFactory<P> | null = null;
  let currentInstance: ComponentInstance | null = null;
  let isInitialized = false;

  const getComponent = (): RenderFunction | ComponentFactory<P> | null => {
    return component();
  };

  const getProps = (): P => {
    if (typeof props === 'function') {
      return props();
    }
    return (props ?? {}) as P;
  };

  function updateDynamic(): void {
    const parentElement = marker.parentNode as Element;
    if (!parentElement) return;

    const comp = getComponent();
    const currentProps = getProps();

    // Check if component changed
    if (comp !== currentComponent) {
      // Unmount old component/remove old node
      if (currentInstance) {
        currentInstance.unmount();
        currentInstance = null;
      }
      if (currentNode && currentNode.parentNode) {
        currentNode.parentNode.removeChild(currentNode);
        currentNode = null;
      }

      // Mount new component using discriminated union for proper type narrowing
      const discriminated = discriminateDynamicComponent(comp);

      if (discriminated.kind === 'factory') {
        currentInstance = (discriminated.value as unknown as ComponentFactoryInternal)(currentProps);
        // Create a temporary container to get the node
        const tempContainer = document.createElement('div');
        currentInstance.mount(tempContainer);
        const node = tempContainer.firstChild;
        if (node) {
          tempContainer.removeChild(node);
          parentElement.insertBefore(node, marker.nextSibling);
          currentNode = node;
        }
      } else if (discriminated.kind === 'render') {
        currentNode = discriminated.value();
        if (currentNode) {
          parentElement.insertBefore(currentNode, marker.nextSibling);
        }
      }
      // kind === 'null' means no component to mount

      currentComponent = comp;
    } else if (currentInstance) {
      // Same component, just update props
      currentInstance.updateProps(currentProps);
    }
  }

  // Use MutationObserver to detect when marker is added to DOM
  const observer = new MutationObserver(() => {
    if (marker.parentNode && !isInitialized) {
      isInitialized = true;
      observer.disconnect();
      updateDynamic();
    }
  });

  observer.observe(document, { childList: true, subtree: true });

  // Set up reactive effect
  effect(() => {
    // Read to track dependencies
    getComponent();
    getProps();

    if (marker.parentNode) {
      updateDynamic();
    }
  });

  return marker;
}
