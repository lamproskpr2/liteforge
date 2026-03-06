import type { Signal } from '@liteforge/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalStyles {
  bg?:           string; // --lf-modal-bg
  headerBg?:     string; // --lf-modal-header-bg
  headerColor?:  string; // --lf-modal-header-color
  bodyColor?:    string; // --lf-modal-body-color
  closeColor?:   string; // --lf-modal-close-color
  backdrop?:     string; // --lf-modal-backdrop
  shadow?:       string; // --lf-modal-shadow
  borderRadius?: string; // --lf-modal-border-radius
}

export interface ModalClasses {
  overlay?: string;
  modal?:   string;
  header?:  string;
  title?:   string;
  close?:   string;
  body?:    string;
}

export interface ModalConfig {
  title?: string;
  size?: ModalSize;
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  unstyled?: boolean;
  styles?: ModalStyles;
  classes?: ModalClasses;
  onOpen?: () => void;
  onClose?: () => void;
}

// Overload 1: with data — component receives data
export interface CreateModalOptions<TData> {
  config?: ModalConfig;
  component: (data: TData) => Node;
}

// Overload 2: without data — component takes no arguments (backwards compat)
export interface CreateModalOptionsNoData {
  config?: ModalConfig;
  component: () => Node;
}

/** @deprecated Use CreateModalOptions object form instead */
export type ModalOptions = ModalConfig;

// Result with data: open(data) required
export interface ModalResult<TData> {
  isOpen: Signal<boolean>;
  open: (data: TData) => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
}

// Result without data: open() with no args (backwards compat)
export interface ModalResultNoData {
  isOpen: Signal<boolean>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  destroy: () => void;
}
