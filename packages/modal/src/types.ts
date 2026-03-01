import type { Signal } from '@liteforge/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalConfig {
  title?: string;
  size?: ModalSize;
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  unstyled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface CreateModalOptions {
  config?: ModalConfig;
  component: () => Node;
}

/** @deprecated Use CreateModalOptions object form instead */
export type ModalOptions = ModalConfig;

export interface ModalResult {
  isOpen: Signal<boolean>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
}
