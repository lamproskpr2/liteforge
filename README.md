# LiteForge

A signals-based frontend framework with no virtual DOM, zero external dependencies, and TypeScript-first APIs.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why LiteForge?

- **No Virtual DOM** — Direct, surgical DOM updates via Signals and Effects
- **Zero-Flicker Architecture** — Components render only when async data is fully loaded
- **Fine-Grained Reactivity** — Automatic dependency tracking, no manual subscriptions
- **JSX Syntax** — Familiar developer experience with build-time optimization
- **Unified Context System** — One `use()` function for stores, router, and services
- **Type-Safe by Default** — Full TypeScript, strict mode, no `any` in public APIs
- **Zero External Dependencies** — Every package has zero runtime deps

## Packages

| Package | Version | Size (gzip) | Tests | Description |
|---------|---------|-------------|-------|-------------|
| [@liteforge/core](packages/core) | 0.2.0 | ~6kb | 120 | Reactive primitives: signal, computed, effect, batch |
| [@liteforge/runtime](packages/runtime) | 0.2.0 | ~12kb | 239 | Components, lifecycle, control flow (Show, For, Switch) |
| [@liteforge/store](packages/store) | 0.2.0 | ~5kb | 150 | State management with registry and time-travel |
| [@liteforge/router](packages/router) | 0.2.0 | ~20kb | 344 | Routing with guards, middleware, lazy loading, scroll behavior |
| [@liteforge/query](packages/query) | 0.2.0 | ~5kb | 67 | Data fetching with caching and mutations |
| [@liteforge/form](packages/form) | 0.2.0 | ~4kb | 48 | Form management with Zod validation |
| [@liteforge/table](packages/table) | 0.2.0 | ~8kb | 61 | Data tables with sorting, filtering, pagination |
| [@liteforge/calendar](packages/calendar) | 0.2.0 | ~22kb | 184 | Scheduling calendar with drag & drop and 4 views |
| [@liteforge/client](packages/client) | 0.2.0 | ~8kb | 72 | TypeScript-first HTTP client with interceptors and CRUD resources |
| [@liteforge/modal](packages/modal) | 0.2.0 | ~4kb | 21 | Modal system with focus trap, transitions, and promise presets |
| [@liteforge/vite-plugin](packages/vite-plugin) | 0.2.0 | ~15kb | 275 | JSX transform and build optimization |
| [@liteforge/devtools](packages/devtools) | 0.2.0 | ~16kb | 100 | Debug panel with 5 tabs and time-travel |

**1,591 tests across all packages.**

## Architecture

```
core  (no deps)
├── runtime       — components, JSX, control flow
├── store         — global state
├── router        — client-side routing
├── query         — data fetching
├── form          — form management
├── table         — data tables
├── calendar      — scheduling calendar
├── client        — HTTP client
└── modal         — modal system

vite-plugin       — standalone build transform
devtools          — depends on core + store
```

## Quick Start

```bash
npm install @liteforge/core @liteforge/runtime @liteforge/vite-plugin
```

**vite.config.ts**

```ts
import { defineConfig } from 'vite'
import liteforge from '@liteforge/vite-plugin'

export default defineConfig({
  plugins: [liteforge()]
})
```

**main.tsx**

```tsx
import { createApp } from '@liteforge/runtime';
import { App } from './App.js';

await createApp({ root: App, target: '#app' });
```

## Core Concepts

### Signals

```ts
import { signal, computed, effect } from '@liteforge/core'

const count = signal(0)
const doubled = computed(() => count() * 2)

effect(() => {
  console.log(`Count: ${count()}, doubled: ${doubled()}`)
})

count.set(5)           // → "Count: 5, doubled: 10"
count.update(n => n + 1)
```

### Components

```tsx
import { createComponent } from '@liteforge/runtime'

const UserProfile = createComponent({
  async load({ props }) {
    const user = await fetch(`/api/users/${props.userId}`).then(r => r.json())
    return { user }
  },

  placeholder: () => <div class="skeleton" />,

  component: ({ data }) => (
    <div>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </div>
  ),
})
```

### Router

```ts
import { createRouter, createBrowserHistory } from '@liteforge/router'

const router = createRouter({
  history: createBrowserHistory(),
  scrollBehavior: 'top',   // 'top' | 'none' | (to, from) => void
  routes: [
    { path: '/', component: Home },
    { path: '/users/:id', component: () => import('./UserDetail.js') },
    {
      path: '/admin',
      component: AdminLayout,
      guard: 'auth',
      children: [{ path: '/', component: Dashboard }],
    },
  ],
})
```

### Store

```ts
import { defineStore } from '@liteforge/store'

const userStore = defineStore('users', {
  state: { currentUser: null, list: [] },
  getters: (state) => ({
    isLoggedIn: () => state.currentUser() !== null,
  }),
  actions: (state) => ({
    async fetchUsers() {
      state.list.set(await fetch('/api/users').then(r => r.json()))
    },
  }),
})
```

### Query

```ts
import { createQuery, createMutation } from '@liteforge/query'

const users = createQuery({
  key: 'users',
  fn: () => fetch('/api/users').then(r => r.json()),
  staleTime: 5 * 60 * 1000,
})

users.data()       // Signal<User[]>
users.isLoading()  // Signal<boolean>
users.refetch()

const addUser = createMutation({
  fn: (data) => api.createUser(data),
  invalidate: ['users'],
})
```

### HTTP Client

```ts
import { createClient } from '@liteforge/client'

const client = createClient({ baseUrl: 'https://api.example.com' })

// Low-level
const todo = await client.get<Todo>('/todos/1')

// Resource-based CRUD
const posts = client.resource<Post>('posts')
await posts.getList({ page: 1, pageSize: 20 })
await posts.getOne(42)
await posts.create({ title: 'Hello', body: '...' })
await posts.update(42, { title: 'Updated' })
await posts.delete(42)

// Interceptors
client.addInterceptor({
  onRequest: (config) => ({ ...config, headers: { ...config.headers, Authorization: `Bearer ${token}` } }),
  onResponseError: (error) => { if (error.status === 401) redirect('/login'); throw error; },
})
```

### Modal

```ts
import { createModal, confirm, alert } from '@liteforge/modal'

// Declarative
const dialog = createModal({
  title: 'Edit User',
  content: () => <EditUserForm />,
})
dialog.open()

// Promise presets
const confirmed = await confirm({ title: 'Delete?', message: 'This cannot be undone.' })
await alert({ title: 'Done', message: 'User deleted.' })
```

### Control Flow

```tsx
import { Show, For, Switch, Match } from '@liteforge/runtime'

<Show when={() => user()}>
  <UserCard user={user} />
</Show>

<For each={() => items()}>
  {(item) => <li>{item.name}</li>}
</For>

<Switch fallback={<NotFound />}>
  <Match when={() => status() === 'loading'}>Loading...</Match>
  <Match when={() => status() === 'error'}>Error!</Match>
</Switch>
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build:packages

# Run all tests (1,591 tests)
pnpm test

# Type check all packages
pnpm typecheck:all

# Run starter demo app
pnpm --filter starter dev

# Run docs app
pnpm --filter docs dev
```

## Bundle Sizes

| Setup | Size (gzip) |
|-------|-------------|
| Minimal (core only) | ~6kb |
| Core + Runtime | ~18kb |
| Core + Runtime + Store + Router | ~43kb |
| Full stack (+ query + client + modal) | ~60kb |

## Status

> **LiteForge is in active early development (v0.2.x).** APIs may change between minor versions. I use it in my own production projects, but if you adopt it today, expect some rough edges.

LiteForge is a personal framework born from real frustration with React's re-rendering model and Vue's adapter overhead. I built it because I wanted a tool that works the way I think — signals that directly update the DOM, no virtual DOM diffing, no magic.

I'm actively building real applications on top of it (scheduling software, business tools, DevOps dashboards), so the framework evolves based on actual needs, not theoretical purity.

**What works well today:** Core reactivity, routing, state management, forms, data tables, calendar, HTTP client, and modals — all battle-tested through my own projects.

**What's still maturing:** Documentation, edge cases in complex layouts, and the ecosystem around it.

If you find it useful, feel free to use it. If you find a bug, I'd appreciate an issue. PRs are welcome but please open an issue first.

## Built with AI

I want to be transparent: LiteForge was developed with significant AI assistance. I used Claude (Anthropic) as a development partner throughout the entire process — from architecture decisions to implementation, testing, and documentation.

**What that means in practice:**
- I designed the API, made all architecture decisions, and defined what the framework should do
- AI helped write implementation code, tests, and documentation based on my specifications
- Every feature was reviewed, tested, and validated by me in real browser environments
- The framework reflects my opinions and preferences as a developer, not generic AI output

I believe AI-assisted development is the future of how software gets built. Being upfront about it is more honest than pretending otherwise. The code quality speaks for itself — 1,591 tests, TypeScript strict mode, zero external dependencies.

## About

LiteForge is built and maintained by [SchildW3rk](https://schildw3rk.dev) — a one-person software studio from Salzburg, Austria.

## License

MIT — see [LICENSE](LICENSE) for details.
