# @liteforge/modal

## 0.2.0

### Minor Changes

- feat(modal): add @liteforge/modal package

  Signal-based modal system with zero external dependencies.

  - `createModal({ config, component })` — imperative API with reactive `isOpen` signal, `open()`, `close()`, `toggle()`, `destroy()`
  - `ModalProvider()` — single DOM portal container, mount once in app root
  - `confirm()`, `alert()`, `prompt()` — Promise-based convenience presets
  - Focus trap (Tab/Shift+Tab cycles inside modal), focus restored on close
  - CSS transitions (opacity + translate), `transitionend`-based removal
  - ESC and backdrop-click close support (configurable)
  - BEM class naming (`lf-modal-*`), CSS variables for theming
  - Full dark mode support via `[data-theme="dark"]`
  - `unstyled: true` opt-out for custom styling
  - Size variants: `sm` (400px), `md` (560px), `lg` (720px), `xl` (1000px), `full`
