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
