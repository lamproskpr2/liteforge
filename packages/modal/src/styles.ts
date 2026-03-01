/**
 * @liteforge/modal - Default CSS Theme
 *
 * Minimal, clean default styles using CSS variables.
 * Injected once when the first modal provider is created (unless unstyled: true).
 */

let stylesInjected = false

const DEFAULT_STYLES = `
/* ─── CSS Variables (Customizable) ─────────────────────────── */

:root {
  --lf-modal-backdrop: rgba(0, 0, 0, 0.5);
  --lf-modal-bg: #ffffff;
  --lf-modal-border-radius: 10px;
  --lf-modal-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  --lf-modal-header-bg: #f8fafc;
  --lf-modal-header-color: #1e293b;
  --lf-modal-body-color: #374151;
  --lf-modal-close-color: #6b7280;
  --lf-modal-z-index: 1000;
}

/* ─── Provider ─────────────────────────────────────────────── */

.lf-modal-provider {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: var(--lf-modal-z-index);
}

/* ─── Overlay ──────────────────────────────────────────────── */

.lf-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--lf-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  opacity: 0;
  transition: opacity 0.2s ease;
  padding: 16px;
  box-sizing: border-box;
}

.lf-modal-overlay--open {
  opacity: 1;
}

/* ─── Size Variants ────────────────────────────────────────── */

.lf-modal-overlay--sm .lf-modal { max-width: 400px; }
.lf-modal-overlay--md .lf-modal { max-width: 560px; }
.lf-modal-overlay--lg .lf-modal { max-width: 720px; }
.lf-modal-overlay--xl .lf-modal { max-width: 1000px; }
.lf-modal-overlay--full .lf-modal { max-width: 100vw; margin: 0; border-radius: 0; }

/* ─── Modal ────────────────────────────────────────────────── */

.lf-modal {
  background: var(--lf-modal-bg);
  border-radius: var(--lf-modal-border-radius);
  box-shadow: var(--lf-modal-shadow);
  width: 100%;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  transform: translateY(-8px);
  transition: transform 0.2s ease;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.lf-modal-overlay--open .lf-modal {
  transform: translateY(0);
}

/* ─── Header ───────────────────────────────────────────────── */

.lf-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--lf-modal-header-bg);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.lf-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--lf-modal-header-color);
  line-height: 1.4;
}

.lf-modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--lf-modal-close-color);
  font-size: 18px;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.lf-modal-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--lf-modal-header-color);
}

/* ─── Body ─────────────────────────────────────────────────── */

.lf-modal-body {
  padding: 20px;
  color: var(--lf-modal-body-color);
  font-size: 14px;
  line-height: 1.6;
  overflow-y: auto;
}

/* ─── Dark Mode Support ────────────────────────────────────── */

[data-theme="dark"] {
  --lf-modal-backdrop: rgba(0, 0, 0, 0.7);
  --lf-modal-bg: #1e1e2e;
  --lf-modal-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  --lf-modal-header-bg: #181825;
  --lf-modal-header-color: #cdd6f4;
  --lf-modal-body-color: #a6adc8;
  --lf-modal-close-color: #6c7086;
}
`

/**
 * Inject default styles into the document head.
 * Called automatically when the first ModalProvider is created (unless unstyled: true).
 */
export function injectDefaultStyles(): void {
  if (stylesInjected) return
  if (typeof document === 'undefined') return // SSR safety

  const style = document.createElement('style')
  style.id = 'lf-modal-styles'
  style.textContent = DEFAULT_STYLES
  document.head.appendChild(style)

  stylesInjected = true
}

/**
 * Reset styles injection flag (for testing)
 */
export function resetStylesInjection(): void {
  stylesInjected = false
  const existing = document.getElementById('lf-modal-styles')
  if (existing) {
    existing.remove()
  }
}
