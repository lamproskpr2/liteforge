/**
 * LiteForge createComponent
 *
 * The central factory for creating reactive components with full lifecycle support.
 *
 * Lifecycle Flow:
 * 1. setup()      - Synchronous, create local signals
 * 2. placeholder  - Shown immediately (if load exists)
 * 3. load()       - Async data fetching
 * 4. component()  - Render (only when load resolved)
 * 5. mounted()    - After DOM insertion
 * 6. destroyed()  - On unmount
 */


import {
  generateDebugId,
  emitComponentMount,
  emitComponentUnmount,
} from '@liteforge/core';
import type {
  ComponentDefinition,
  ComponentFactory,
  ComponentInstance,
  PropDefinition,
  InputPropsFromSchema,
  Simplify,
} from './types.js';
import { use, withContext } from './context.js';

// Track parent component for debug hierarchy
let currentParentComponentId: string | undefined;

// ============================================================================
// Component State Enum
// ============================================================================

const enum ComponentState {
  Created,
  Loading,
  Loaded,
  Error,
  Mounted,
  Unmounted,
}

// ============================================================================
// createComponent Implementation
// ============================================================================

/**
 * Create a component factory from a component definition.
 *
 * @param definition - The component definition object
 * @returns A component factory function
 *
 * @example
 * ```ts
 * const MyComponent = createComponent({
 *   props: { name: { type: String, required: true } },
 *   setup({ props }) {
 *     const count = signal(0);
 *     return { count };
 *   },
 *   component({ props, setup }) {
 *     return <div>Hello {props.name}, count: {setup.count()}</div>;
 *   },
 * });
 * ```
 */
// Overload 1: With props schema - computes which props are optional based on defaults
export function createComponent<
  Schema extends Record<string, PropDefinition<unknown>>,
  P extends { [K in keyof Schema]: Schema[K] extends PropDefinition<infer T> ? T : never },
  D = undefined,
  S = undefined,
>(
  definition: ComponentDefinition<P, D, S> & { props: Schema }
): ComponentFactory<P, Simplify<InputPropsFromSchema<Schema, P>>>;

// Overload 2: Without props schema - all props use the inferred P type directly
export function createComponent<
  P extends Record<string, unknown> = Record<string, unknown>,
  D = undefined,
  S = undefined,
>(definition: ComponentDefinition<P, D, S>): ComponentFactory<P, P>;

// Implementation
export function createComponent<
  P extends Record<string, unknown>,
  D,
  S,
>(definition: ComponentDefinition<P, D, S>): ComponentFactory<P, Partial<P>> {
  const factory = (inputProps: Partial<P>): ComponentInstance => {
    return createComponentInstance(definition, inputProps as P);
  };

  // Mark as LiteForge component for detection
  (factory as ComponentFactory<P, Partial<P>>).__liteforge_component = true;

  return factory as ComponentFactory<P, Partial<P>>;
}

/**
 * Create an instance of a component with full lifecycle management.
 */
function createComponentInstance<
  P extends Record<string, unknown>,
  D,
  S,
>(
  definition: ComponentDefinition<P, D, S>,
  inputProps: P
): ComponentInstance {
  // Debug info - extract component name from definition
  // Priority: 1. explicit name property, 2. component function name (if meaningful), 3. fallback
  // Skip generic names like 'component' or empty strings
  const funcName = definition.component.name;
  const componentName = definition.name 
    ?? (funcName && funcName !== 'component' && funcName !== '' ? funcName : 'Component');
  const componentId = generateDebugId(componentName);
  const parentId = currentParentComponentId;

  // State
  let state = ComponentState.Created;
  let currentNode: Node | null = null;
  let parentElement: Element | null = null;
  let beforeNode: Node | null = null;
  let props = resolveProps(definition.props, inputProps);
  let setupResult: S | undefined;
  let loadedData: D | undefined;
  let mountedCleanup: (() => void) | void;
  const hasProvide = Boolean(definition.provide);
  let provideContext: Record<string, unknown> | undefined;

  // ========================================
  // Phase 1: Setup (synchronous)
  // ========================================
  if (definition.setup) {
    setupResult = definition.setup({ props, use });
  }

  // ========================================
  // Lifecycle Methods
  // ========================================

  function mount(parent: Element, before: Node | null = null): void {
    if (state === ComponentState.Unmounted) {
      throw new Error('Cannot mount an unmounted component');
    }

    parentElement = parent;
    beforeNode = before;

    // Set up provide context if defined
    if (hasProvide && definition.provide) {
      provideContext = definition.provide({ use });
    }

    // Track parent component for nested components
    const previousParentId = currentParentComponentId;
    currentParentComponentId = componentId;

    // Run within context scope
    const mountWithContext = () => {
      if (definition.load) {
        // Has async loading - show placeholder first
        state = ComponentState.Loading;
        renderPlaceholder();
        startLoading();
      } else {
        // No loading - render directly
        state = ComponentState.Loaded;
        loadedData = undefined as D;
        renderComponent();
      }
    };

    if (hasProvide && provideContext) {
      withContext(provideContext, mountWithContext);
    } else {
      mountWithContext();
    }

    // Restore parent component tracking
    currentParentComponentId = previousParentId;

    // Emit mount event (zero cost if debug not enabled)
    emitComponentMount(componentId, componentName, parentId);
  }

  function unmount(): void {
    if (state === ComponentState.Unmounted) return;

    // Run destroyed callback
    if (definition.destroyed) {
      definition.destroyed({ props, setup: setupResult as S });
    }

    // Run mounted cleanup
    if (mountedCleanup) {
      mountedCleanup();
      mountedCleanup = undefined;
    }

    // Remove from DOM
    if (currentNode && currentNode.parentNode) {
      currentNode.parentNode.removeChild(currentNode);
    }

    currentNode = null;
    parentElement = null;
    state = ComponentState.Unmounted;

    // Emit unmount event (zero cost if debug not enabled)
    emitComponentUnmount(componentId, componentName);
  }

  function getNode(): Node | null {
    return currentNode;
  }

  function updateProps(newProps: Record<string, unknown>): void {
    props = resolveProps(definition.props, newProps as P);
    // In a full implementation, this would trigger a re-render
    // For now, props are static after initial render
  }

  // ========================================
  // Internal Methods
  // ========================================

  function renderPlaceholder(): void {
    if (!parentElement) return;

    let placeholderNode: Node;

    if (definition.placeholder) {
      placeholderNode = definition.placeholder({ props });
    } else {
      // Default placeholder is an empty comment node
      placeholderNode = document.createComment('loading');
    }

    insertNode(placeholderNode);
  }

  function renderComponent(): void {
    if (!parentElement) return;
    if (state === ComponentState.Unmounted) return;

    const render = () => {
      const node = definition.component({
        props,
        data: loadedData as D,
        setup: setupResult as S,
        use,
      });

      insertNode(node);
      state = ComponentState.Mounted;

      // Phase 4: mounted callback
      if (definition.mounted && currentNode instanceof Element) {
        mountedCleanup = definition.mounted({
          el: currentNode,
          props,
          data: loadedData as D,
          setup: setupResult as S,
          use,
        });
      }
    };

    if (hasProvide && provideContext) {
      withContext(provideContext, render);
    } else {
      render();
    }
  }

  function renderError(error: Error): void {
    if (!parentElement) return;
    if (state === ComponentState.Unmounted) return;

    state = ComponentState.Error;

    if (definition.error) {
      const errorNode = definition.error({
        props,
        error,
        retry: () => {
          // Re-attempt loading
          state = ComponentState.Loading;
          renderPlaceholder();
          startLoading();
        },
      });
      insertNode(errorNode);
    } else {
      // Default error: show a text node with the error message
      const errorNode = document.createTextNode(`Error: ${error.message}`);
      insertNode(errorNode);
    }
  }

  function startLoading(): void {
    if (!definition.load) return;

    definition
      .load({
        props,
        setup: setupResult as S,
        use,
      })
      .then((data) => {
        if (state === ComponentState.Unmounted) return;
        loadedData = data;
        state = ComponentState.Loaded;
        renderComponent();
      })
      .catch((error: unknown) => {
        if (state === ComponentState.Unmounted) return;
        renderError(error instanceof Error ? error : new Error(String(error)));
      });
  }

  function insertNode(newNode: Node): void {
    if (!parentElement) return;

    // Remove old node if exists
    if (currentNode && currentNode.parentNode) {
      currentNode.parentNode.removeChild(currentNode);
    }

    // Insert new node
    if (beforeNode) {
      parentElement.insertBefore(newNode, beforeNode);
    } else {
      parentElement.appendChild(newNode);
    }

    currentNode = newNode;
  }

  return {
    mount,
    unmount,
    getNode,
    updateProps,
  };
}

// ============================================================================
// Prop Resolution
// ============================================================================

/**
 * Resolve props with defaults and type checking.
 */
function resolveProps<P extends Record<string, unknown>>(
  propsSchema: Record<string, { default?: unknown; required?: boolean }> | undefined,
  inputProps: P
): P {
  if (!propsSchema) {
    return inputProps;
  }

  const resolved = { ...inputProps } as Record<string, unknown>;

  for (const [key, propDef] of Object.entries(propsSchema)) {
    if (!(key in resolved) || resolved[key] === undefined) {
      // Apply default if available
      if ('default' in propDef) {
        resolved[key] =
          typeof propDef.default === 'function'
            ? (propDef.default as () => unknown)()
            : propDef.default;
      } else if (propDef.required) {
        console.warn(`Required prop "${key}" is missing`);
      }
    }
  }

  return resolved as P;
}

// ============================================================================
// Utility: Check if value is a component factory
// ============================================================================

/**
 * Check if a value is a LiteForge component factory.
 */
export function isComponentFactory(value: unknown): value is ComponentFactory<Record<string, unknown>> {
  return (
    typeof value === 'function' &&
    (value as ComponentFactory<Record<string, unknown>>).__liteforge_component === true
  );
}
