---
"@liteforge/runtime": patch
---

`ComponentFactory` call signature now uses optional props (`props?: InputP`). Components without defined props can now be called as `MyComponent()` instead of requiring `MyComponent({})`.
