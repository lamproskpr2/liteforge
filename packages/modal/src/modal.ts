import { signal } from '@liteforge/core';
import type { ModalConfig, CreateModalOptions, ModalResult } from './types.js';

// ─── Modal Registry ─────────────────────────────────────────

export interface ModalEntry {
  id: symbol;
  options: Required<ModalConfig>;
  contentFn: () => Node;
  isOpen: ReturnType<typeof signal<boolean>>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
}

/**
 * Global singleton key — ensures all Vite module instances share the same
 * registry even when ESM module isolation creates separate module scopes
 * (e.g. main.tsx and lazy-loaded page chunks in dev mode).
 */
const REGISTRY_KEY = '__lfModalRegistry__';
const VERSION_KEY = '__lfModalVersion__';

type GlobalWithModal = typeof globalThis & {
  [REGISTRY_KEY]?: Set<ModalEntry>;
  [VERSION_KEY]?: ReturnType<typeof signal<number>>;
};

const g = globalThis as GlobalWithModal;

if (!g[REGISTRY_KEY]) {
  g[REGISTRY_KEY] = new Set<ModalEntry>();
}
if (!g[VERSION_KEY]) {
  g[VERSION_KEY] = signal(0);
}

export const modalRegistry: Set<ModalEntry> = g[REGISTRY_KEY]!;

/**
 * A signal that bumps whenever entries are added/removed from the registry.
 * The provider's effect reads this so it re-runs on registry changes.
 */
export const registryVersion: ReturnType<typeof signal<number>> = g[VERSION_KEY]!;

function bumpRegistry(): void {
  registryVersion.update((v) => v + 1);
}

// ─── Shared ESC listener ─────────────────────────────────────

const ESC_KEY = '__lfModalEsc__';
type GlobalWithEsc = typeof globalThis & { [ESC_KEY]?: boolean };
const ge = globalThis as GlobalWithEsc;

function ensureEscListener(): void {
  if (ge[ESC_KEY]) return;
  ge[ESC_KEY] = true;
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    for (const entry of modalRegistry) {
      if (entry.isOpen() && entry.options.closeOnEsc) {
        entry.close();
        break;
      }
    }
  });
}

// ─── createModal ─────────────────────────────────────────────

export function createModal(opts: CreateModalOptions): ModalResult {
  const cfg: ModalConfig = opts.config ?? {};
  const contentFn = opts.component;

  const resolvedOptions: Required<ModalConfig> = {
    title: cfg.title ?? '',
    size: cfg.size ?? 'md',
    closable: cfg.closable ?? true,
    closeOnBackdrop: cfg.closeOnBackdrop ?? true,
    closeOnEsc: cfg.closeOnEsc ?? true,
    unstyled: cfg.unstyled ?? false,
    styles: cfg.styles ?? {},
    classes: cfg.classes ?? {},
    onOpen: cfg.onOpen ?? (() => {}),
    onClose: cfg.onClose ?? (() => {}),
  };

  const isOpenSignal = signal(false);
  let disposed = false;
  let contentNode: Node | null = null;
  let previousFocus: Element | null = null;

  const entry: ModalEntry = {
    id: Symbol(),
    options: resolvedOptions,
    contentFn: () => {
      if (!contentNode) {
        contentNode = contentFn();
      }
      return contentNode;
    },
    isOpen: isOpenSignal,
    open() {
      if (disposed) return;
      previousFocus = document.activeElement;
      isOpenSignal.set(true);
      resolvedOptions.onOpen();
    },
    close() {
      if (disposed) return;
      isOpenSignal.set(false);
      resolvedOptions.onClose();
      if (previousFocus && (previousFocus as HTMLElement).focus) {
        (previousFocus as HTMLElement).focus();
      }
      previousFocus = null;
    },
    toggle() {
      if (disposed) return;
      if (isOpenSignal()) {
        entry.close();
      } else {
        entry.open();
      }
    },
    destroy() {
      disposed = true;
      if (isOpenSignal()) {
        entry.close();
      }
      modalRegistry.delete(entry);
      bumpRegistry();
    },
  };

  modalRegistry.add(entry);
  bumpRegistry();

  if (typeof document !== 'undefined') {
    ensureEscListener();
  }

  return {
    isOpen: isOpenSignal,
    open: entry.open,
    close: entry.close,
    toggle: entry.toggle,
    destroy: entry.destroy,
  };
}
