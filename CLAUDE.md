# CLAUDE.md – LiteForge Framework

## Project Overview

We are building **LiteForge** – a modern frontend framework with the following core principles:

- **No Virtual DOM** – Direct, fine-grained DOM manipulation via Signals/Effects
- **JSX Syntax** – Custom Vite plugin transforms JSX to direct DOM operations at build-time
- **Signals-based Reactivity** – Automatic dependency tracking, no manual subscriptions
- **Zero-Flicker Architecture** – Components render ONLY when async data is fully loaded
- **Unified Context System** – No provider wrapping, no prop drilling, one `use()` function
- **Built-in Router** – With guards, middleware, preloading, and transitions
- **Store System** – With global registry for full state inspection

**Tech Stack:** TypeScript, Vite, JSX, no external runtime dependencies (we build everything ourselves).

**Target:** < 5kb gzipped core runtime.

---

## Architecture Overview

```
liteforge/
├── packages/
│   ├── core/                # Reactivity: signal(), computed(), effect(), batch()
│   ├── runtime/             # DOM Renderer, createComponent(), Lifecycle, use()
│   ├── store/               # defineStore(), storeRegistry
│   ├── router/              # Router, Guards, Middleware, Link, Route
│   ├── vite-plugin/         # JSX → DOM transform, template extraction, HMR
│   └── devtools/            # DevTools panel with time-travel debugging
├── create-liteforge/        # CLI scaffolding tool (later phase)
├── examples/
│   └── starter/             # Demo app using all features
├── tsconfig.json
├── package.json             # Monorepo root
└── vitest.config.ts
```

Use a **pnpm workspace monorepo**. Each package is independently publishable.

---

## Phase 1: Reactivity Core (`packages/core`)

This is the foundation. Everything else builds on this. Implement in this order:

### 1.1 Signal

```ts
const count = signal(0);
count();                    // read → returns 0
count.set(5);               // write → notifies all subscribers
count.update(n => n + 1);   // functional update
```

**Internals:**
- Global `observerStack` (array) tracks the currently running Effect/Computed
- Each Signal holds a `Set<() => void>` of subscriber functions
- On read (`count()`): if there's an active observer on the stack, add it to subscribers
- On write (`count.set()`): if value changed (Object.is comparison), notify all subscribers
- Signal is a callable function (the getter) with `.set()` and `.update()` methods attached

### 1.2 Effect

```ts
const dispose = effect(() => {
  console.log(count());  // auto-subscribes to count
});
dispose(); // cleanup, remove all subscriptions
```

**Internals:**
- Pushes itself onto `observerStack` before running the callback
- Pops itself after callback finishes
- Before each re-run: clears old subscriptions to avoid stale dependencies
- Returns a dispose function that cleans up all subscriptions
- Supports nested effects (stack-based)

### 1.3 Computed

```ts
const doubled = computed(() => count() * 2);
doubled(); // read-only signal, lazy evaluation
```

**Internals:**
- Implemented as a Signal + Effect combo internally
- Lazy: only re-computes when read AND dependencies have changed
- Uses a dirty flag to track if recomputation is needed
- Read-only: no `.set()` or `.update()`

### 1.4 Batch

```ts
batch(() => {
  count.set(1);
  name.set('Max');
}); // subscribers notified only once after batch completes
```

**Internals:**
- Global `batchDepth` counter
- During batch: collect all pending notifications but don't fire them
- When outermost batch ends (depth reaches 0): fire all pending notifications once
- Supports nested batches

### 1.5 Cleanup in Effects

```ts
effect(() => {
  const handler = () => console.log(count());
  window.addEventListener('resize', handler);

  // Cleanup runs before next effect execution and on dispose
  onCleanup(() => window.removeEventListener('resize', handler));
});
```

### Tests (Vitest)

Write comprehensive tests for:
- Signal read/write/update
- Effect auto-subscription and re-run
- Computed lazy evaluation and caching
- Batch deferred notifications
- Nested effects
- Cleanup functions
- Diamond dependency problem (A → B, A → C, B+C → D: D should only update once)
- Memory: disposed effects should not hold references

---

## Phase 2: DOM Runtime (`packages/runtime`)

### 2.1 createComponent Factory

This is the central API. A component is defined as an object passed to `createComponent()`:

```tsx
export const MyComponent = createComponent({
  // Optional: prop definitions with defaults
  props: {
    userId: { type: Number, required: true },
    showAvatar: { type: Boolean, default: true },
  },

  // PHASE 1 – SETUP (synchronous, runs first)
  // Create signals, local state. No DOM access. No async.
  setup({ props, use }) {
    const editMode = signal(false);
    const theme = use('theme'); // Access app-level context
    return { editMode, theme };
  },

  // PHASE 2 – LOAD (async, runs before render)
  // Fetch data. Component is NOT rendered until this resolves.
  // Return value becomes `data` in component function.
  async load({ props, setup, use }) {
    const api = use('api');
    const user = await api.get(`/users/${props.userId}`);
    return { user };
  },

  // PLACEHOLDER – shown IMMEDIATELY while load() is running
  placeholder: ({ props }) => <div class="skeleton shimmer" />,

  // ERROR – shown if load() rejects
  error: ({ error, retry }) => (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={retry}>Retry</button>
    </div>
  ),

  // PHASE 3 – COMPONENT (renders only when load() resolved)
  // `data` is GUARANTEED to be available. No null checks needed.
  component: ({ props, data, setup, use }) => (
    <div>
      <h1>{data.user.name}</h1>
    </div>
  ),

  // PHASE 4 – MOUNTED (after component is in the DOM)
  // `el` = root DOM node. For animations, event listeners, third-party libs.
  // Return a cleanup function (optional).
  mounted({ el, props, data, setup, use }) {
    const analytics = use('analytics');
    analytics.track('component_mounted');
    el.classList.add('fade-in');
    return () => { /* cleanup */ };
  },

  // PHASE 5 – DESTROYED (when component is removed from DOM)
  destroyed({ props, setup }) {
    console.log('cleaned up');
  },

  // SCOPED CONTEXT – provide additional or override context for children
  provide: ({ use }) => ({
    api: createAdminApiClient(),
  }),
});
```

**Lifecycle Flow:**
```
createComponent() called
  → setup()              [sync, create local signals]
  → placeholder shown    [immediately in DOM]
  → load()               [async, fetch data]
      ├── success → component()  [replaces placeholder in DOM]
      │              → mounted()  [post-render, DOM access]
      └── error   → error()      [replaces placeholder, retry available]
  → destroyed()          [when removed from DOM, cleanup]
```

**Key behaviors:**
- Components WITHOUT `load` skip the placeholder phase entirely and render immediately
- `use()` is passed via args in ALL lifecycle phases: `setup`, `load`, `component`, `mounted`, and `provide`
- `retry` in error view re-triggers `load()` and shows placeholder again
- The placeholder-to-component swap must be a clean DOM node replacement (no flicker)

### 2.2 Context System (`use()`)

```ts
// App-level context defined in createApp()
const app = createApp({
  context: {
    api: createApiClient({ baseUrl: '/api' }),
    auth: createAuth(),
    theme: signal('dark'),
    i18n: createI18n({ locale: 'de' }),
  },
  stores: [uiStore, userStore],
  plugins: [toastPlugin],
  root: App,
  target: '#app',
});
```

**Internals:**
- Context is a simple Map/object stored at app level
- `use(key)` looks up the context chain: component → parent → ... → app root
- Components with `provide` create a new context layer (child scope)
- Child scopes inherit from parent and can override specific keys
- Stores are auto-registered under `use('store:<name>')`
- Plugins extend context with their own keys

**No provider components. No wrapping. No nesting. Just `use('key')`.**

### 2.3 Control Flow Components

Since we have no VDOM, we need explicit control flow components that manage DOM insertion/removal:

```tsx
// Conditional rendering
<Show when={condition()} fallback={<FallbackContent />}>
  <Content />
</Show>

// List rendering (keyed)
<For each={items()} key="id">
  {(item, index) => <li>{item.name}</li>}
</For>

// Switch/Match
<Switch fallback={<Default />}>
  <Match when={value() === 'a'}><ViewA /></Match>
  <Match when={value() === 'b'}><ViewB /></Match>
</Switch>

// Dynamic component
<Dynamic component={currentView()} props={{ id: 42 }} />
```

**Internals:**
- `<Show>` uses an Effect that watches `when`. On change, it swaps the DOM subtree.
- `<For>` uses a keyed reconciliation algorithm (NOT full VDOM diff, only for the list).
- These are the ONLY places where DOM insertion/removal logic lives.

---

## Phase 3: Store System (`packages/store`)

### 3.1 defineStore

```ts
export const userStore = defineStore('users', {
  state: {
    currentUser: null as User | null,
    list: [] as User[],
    loading: false,
    error: null as string | null,
  },

  getters: (state) => ({
    isLoggedIn: () => state.currentUser() !== null,
    admins: () => state.list().filter(u => u.role === 'admin'),
    byId: (id: string) => state.list().find(u => u.id === id),
  }),

  actions: (state, use) => ({
    async fetchUsers() {
      state.loading.set(true);
      try {
        const api = use('api');
        state.list.set(await api.get('/users'));
      } catch (e) {
        state.error.set(e.message);
      } finally {
        state.loading.set(false);
      }
    },
  }),
});
```

**Internals:**
- `state` properties are automatically converted to Signals
- `getters` are Computed values
- `actions` receive the signal-ified state + `use()` for context access
- Each store auto-registers in the global `storeRegistry`

### 3.2 Store Registry

```ts
storeRegistry.list();                    // → ['ui', 'users', 'cart']
storeRegistry.snapshot();                // → full app state as plain object
storeRegistry.inspect('users');          // → state, getters, actions, metadata
storeRegistry.onAnyChange(callback);     // → global change listener
storeRegistry.reset('cart');             // → reset to initial state
storeRegistry.resetAll();                // → reset ALL stores
storeRegistry.serialize();               // → JSON string
storeRegistry.hydrate(jsonString);       // → restore state from JSON
```

---

## Phase 4: Router (`packages/router`)

### 4.1 Route Definition

```ts
const app = createApp({
  router: {
    middleware: [loggerMiddleware],
    routes: [
      { path: '/', component: Home },
      { path: '/users/:id', component: UserDetail, guard: 'auth' },
      {
        path: '/admin',
        component: AdminLayout,
        guard: ['auth', 'role:admin'],
        children: [
          { path: '/', component: AdminDashboard },
          { path: '/users', component: AdminUsers },
        ],
      },
      { path: '*', component: NotFound },
    ],
  },
});
```

### 4.2 Guards

```ts
const authGuard = defineGuard('auth', ({ to, from, use }) => {
  const auth = use('auth');
  if (!auth.isAuthenticated()) return `/login?redirect=${to.path}`;
  return true;
});

// Parameterized guard: 'role:admin' → param = 'admin'
const roleGuard = defineGuard('role', ({ to, from, use, param }) => {
  return use('auth').hasRole(param) || '/unauthorized';
});
```

### 4.3 Router API in Components

```ts
const router = use('router');
router.navigate('/path');
router.back();
router.path();        // Signal: current path
router.params();      // Signal: { id: '42' }
router.query();       // Signal: { search: 'foo' }
```

### 4.4 Components

```tsx
<Link href="/about" activeClass="active">About</Link>
<Route path="/users/:id" component={UserDetail} />
```

### 4.5 Navigation Flow

```
User navigates → Middleware (global) → Guards (route) → Preload data → Transition animation → Component render
```

---

## Phase 5: Vite Plugin (`packages/vite-plugin`)

### What the developer writes:

```tsx
function Counter() {
  const count = signal(0);
  return (
    <div class="counter">
      <h1>Count: {count()}</h1>
      <button onClick={() => count.update(n => n + 1)}>+1</button>
    </div>
  );
}
```

### What the plugin compiles it to:

```js
function Counter() {
  const count = signal(0);
  const _el = _template('<div class="counter"><h1></h1><button>+1</button></div>');
  const _h1 = _el.firstChild;
  const _btn = _h1.nextSibling;

  _effect(() => { _h1.textContent = `Count: ${count()}`; });
  _btn.addEventListener('click', () => count.update(n => n + 1));

  return _el;
}
```

### Plugin responsibilities:
1. **JSX Transform** – compile JSX to direct DOM creation calls
2. **Template Extraction** – static HTML parts become cloneable templates
3. **Signal Detection** – detect signal reads in JSX expressions, wrap in effects
4. **HMR** – component-level hot module replacement
5. **Tree Shaking** – unused features eliminated

---

## Phase 6: DevTools (`packages/devtools`)

### 6.1 DevTools Plugin

```ts
import { devtoolsPlugin } from '@liteforge/devtools';

const app = await createApp({
  root: App,
  target: '#app',
  plugins: [
    devtoolsPlugin({
      shortcut: 'ctrl+shift+d',  // Toggle panel
      position: 'right',          // 'right' | 'bottom' | 'floating'
      defaultTab: 'signals',
    }),
  ],
});
```

### 6.2 Features

- **Signals Tab** – Live view of all signals with labels, values, update counts
- **Stores Tab** – Store state tree with time-travel debugging
- **Router Tab** – Navigation history, guard results, timing
- **Components Tab** – Component tree with mount/unmount tracking
- **Performance Tab** – Signal updates/sec, effect executions, component counts

### 6.3 Time-Travel Debugging

```
History entries are clickable:
  01:00:01  currentUser: null → {...}  [⏪ Restore]
  01:00:02  loading: true → false       [⏪ Restore]

Click "Restore" → app state jumps to that point in time
Click "↻ Current" → returns to latest state
```

**Internals:**
- Each history entry stores a full state snapshot from BEFORE the change
- `preTimeTravelSnapshots` Map saves state before first time-travel action
- `store.$restore(snapshot)` applies the snapshot to all store signals
- Visual feedback: green flash on restore, gold border on active entry

---

## Coding Standards

- **Language:** TypeScript strict mode, no `any` unless absolutely necessary
- **Testing:** Vitest for all packages, aim for high coverage on core and runtime
- **Naming:** concise variable names in internals (i, el, fn), descriptive names in public API
- **Exports:** each package has a clean public API via index.ts barrel exports
- **No external runtime dependencies** in core, runtime, store, router
- **Build tool dependencies** (Vite, etc.) are devDependencies only
- **Comments:** document WHY, not WHAT – the code should be self-explanatory

---

## Implementation Order

```
1. packages/core          → signal, computed, effect, batch, onCleanup
                            + full test suite
2. packages/runtime       → createComponent, use(), context, lifecycle
                            + Show, For, Switch, Dynamic
                            + full test suite
3. packages/store         → defineStore, storeRegistry
                            + full test suite
4. packages/router        → Router, Route, Link, guards, middleware
                            + full test suite
5. packages/vite-plugin   → JSX transform, template extraction, HMR
6. packages/devtools      → DevTools panel, time-travel debugging
                            + full test suite
7. examples/starter       → demo app showcasing all features
8. create-liteforge       → CLI scaffolding tool
```

**Start with Phase 1. Do not skip ahead. Each phase must have passing tests before moving on.**

---

## Important Design Decisions

1. **Zero-flicker rendering:** Components with async `load()` show a placeholder first, then swap to the rendered component ONLY when data is available. The component function receives `data` as a guaranteed non-null value.

2. **No provider wrapping:** Context is a flat object defined once at app creation. `use('key')` retrieves from the nearest scope. Components can extend/override scope via `provide`.

3. **Stores are Signals:** Every state property in a store becomes a Signal. Getters become Computed values. This means stores are automatically reactive everywhere.

4. **Guards are functions:** A guard returns `true` (allow), `false` (block), or a `string` (redirect path). Parameterized guards like `'role:admin'` pass the param to the guard function.

5. **The global store registry** enables full app state inspection at any time – this is a first-class feature, not an afterthought.