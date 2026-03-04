---
"@liteforge/runtime": patch
---

fix(runtime): set sideEffects to true to prevent tree-shaking of createApp()

`"sideEffects": false` caused bundlers (Rollup/Vite) to tree-shake the
`createApp()` call when its return value was not used, resulting in a blank
page at runtime. `createApp()` mounts the app into the DOM — it is inherently
a side-effectful operation.
