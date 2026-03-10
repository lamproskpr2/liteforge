---
"@liteforge/calendar": patch
---

fix(calendar): complete dark mode CSS token override + toolbar weekend toggle guard

**Dark mode CSS** (`css/styles.css`): The dark mode block previously only overrode 4 of 14 `--lf-cal-*` tokens, leaving most of the calendar with light-mode colors in dark themes. All tokens are now correctly overridden in both `[data-theme="dark"]/.dark` and `@media (prefers-color-scheme: dark)`:
- `--lf-cal-bg`, `--lf-cal-border`, `--lf-cal-header-bg`, `--lf-cal-header-color`
- `--lf-cal-now-color`, `--lf-cal-now-dot-color`
- `--lf-cal-event-default-bg`, `--lf-cal-event-default-color`
- `--lf-cal-selection-bg`, `--lf-cal-selection-border`
- `--lf-cal-time-color`, `--lf-cal-scrollbar-thumb`
- `--lf-cal-color-danger`

**Toolbar** (`toolbar.ts`): The weekend toggle button now respects `toolbarConfig.showWeekendToggle !== false`. Previously it was rendered unconditionally whenever `onToggleWeekends` and `weekendsVisible` were set, ignoring the config option.
