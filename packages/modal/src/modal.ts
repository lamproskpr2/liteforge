import { signal } from '@liteforge/core';
import type {
  ModalConfig,
  CreateModalOptions,
  CreateModalOptionsNoData,
  ModalResult,
  ModalResultNoData,
} from './types.js';

// ─── Modal Registry ─────────────────────────────────────────

export interface ModalEntry {
  id: symbol;
  options: Required<ModalConfig>;
  contentFn: () => Node;
  isOpen: ReturnType<typeof signal<boolean>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  open: (data?: any) => void;
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

// Overload 1: without data — open() with no args (backwards compat)
export function createModal(opts: CreateModalOptionsNoData): ModalResultNoData;
// Overload 2: with data — open(data) required, component receives data
export function createModal<TData>(opts: CreateModalOptions<TData>): ModalResult<TData>;

// Implementation
export function createModal<TData = never>(
  opts: CreateModalOptions<TData> | CreateModalOptionsNoData,
): ModalResult<TData> | ModalResultNoData {
  const cfg: ModalConfig = opts.config ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentFn = opts.component as (data?: any) => Node;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentData: any = undefined;

  const entry: ModalEntry = {
    id: Symbol(),
    options: resolvedOptions,
    contentFn: () => {
      if (!contentNode) {
        contentNode = contentFn(currentData);
      }
      return contentNode;
    },
    isOpen: isOpenSignal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    open(data?: any) {
      if (disposed) return;
      previousFocus = document.activeElement;
      // Store data and reset content so component() is re-invoked with fresh data.
      currentData = data;
      contentNode = null;
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
