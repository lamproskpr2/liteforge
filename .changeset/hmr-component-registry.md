---
"@liteforge/runtime": minor
"@liteforge/vite-plugin": patch
---

feat(hmr): component registry architecture for reliable hot module replacement

Replaces the signal-driven HMR approach with a simpler component registry:

- Every `createComponent()` call registers its definition in a `componentRegistry` Map
- On Vite HMR, the module is re-evaluated → registry updated with latest code
- `fullRerender()` tears down and remounts the app; all factories read the latest
  definition at call-time, including `setup()`, `component()`, `mounted()` etc.
- Stores and router survive every re-render as module-level singletons
- Layout edits now update instantly without a page reload
- `setup()`-defined values (table columns, signals) update correctly after HMR
- Removed ~370 lines of complexity: instance tracking, outlet transplanting,
  layout detection, `HotComponentState`, `createHotComponent`, `clearHotComponents`
- `fullRerender()` is debounced 50 ms and preserves scroll position

**Breaking (internal):** `HMRHandler` no longer has a `components` field.
The `HMRInstance` type alias has been removed. The `HMRHandler.handleUpdate`
method was renamed from `.update()` in the vite-plugin generated code.
