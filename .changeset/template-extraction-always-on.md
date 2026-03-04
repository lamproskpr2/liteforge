---
"@liteforge/vite-plugin": minor
---

feat(vite-plugin): template extraction always-on + for-transform single-pass optimization

- **Breaking default change**: `templateExtraction` now defaults to `true` (was `'auto'`).
  Dev and prod now use the same code path — no more "works in prod but not dev" surprises.
  Set `templateExtraction: false` only when debugging JSX transform issues.

- **For-transform rewrite**: Single-pass walker with identity-short-circuits.
  `rewriteParamRefs` returns the original node unchanged when no param reference is found,
  eliminating a separate pre-scan pass per JSX attribute. Idempotent: `item()` calls are
  left as-is so the rewrite is safe to call on already-transformed code.

- **Template visitor**: Enter-phase confirmed correct with clarifying comments explaining
  why `analyzeElement` must run before child JSX nodes are replaced.

- **Regression tests**: Added Group I — nested JSX in expression children (e.g. `.map()` callbacks).
