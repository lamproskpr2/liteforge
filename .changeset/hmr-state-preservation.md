---
"@liteforge/vite-plugin": minor
"@liteforge/runtime": minor
---

Component-level HMR with state preservation

- Components hot-replace without full page reload
- `setup()` signals preserve their values (form inputs, toggles, counters)
- Global stores preserve state (singleton registry pattern)
- Router keeps current route
- Scroll position maintained
- DevTools stays open

Implementation:
- Vite plugin injects `__hmrId` into `createComponent()` calls
- Runtime tracks mounted instances and re-renders with new component function
- `setup()` result (signals) passed to new render, preserving reactivity
