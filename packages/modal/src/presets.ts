import { createModal } from './modal.js';
import type { ModalConfig } from './types.js';

// ─── Shared button/input styles using modal CSS variables ────

function styleBtn(btn: HTMLButtonElement, variant: 'primary' | 'secondary'): void {
  btn.style.cssText = [
    'display:inline-flex;align-items:center;justify-content:center',
    'padding:6px 16px;border-radius:6px;font-size:14px;font-weight:500',
    'cursor:pointer;transition:opacity 0.15s;border:none',
    variant === 'primary'
      ? 'background:#4f46e5;color:#fff'
      : 'background:transparent;color:var(--lf-modal-header-color);border:1px solid rgba(128,128,128,0.35)',
  ].join(';');
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
}

function styleInput(input: HTMLInputElement): void {
  input.style.cssText = [
    'width:100%;box-sizing:border-box',
    'padding:8px 10px;border-radius:6px;font-size:14px',
    'background:rgba(0,0,0,0.25);color:var(--lf-modal-header-color)',
    'border:1px solid rgba(128,128,128,0.35)',
    'outline:none;margin-bottom:16px',
  ].join(';');
  input.addEventListener('focus', () => { input.style.borderColor = '#4f46e5'; });
  input.addEventListener('blur',  () => { input.style.borderColor = 'rgba(128,128,128,0.35)'; });
}

function styleMsg(msg: HTMLParagraphElement): void {
  msg.style.cssText = 'margin:0 0 20px;color:var(--lf-modal-body-color);font-size:14px;line-height:1.6';
}

// ─── confirm() ───────────────────────────────────────────────

export function confirm(
  message: string,
  config?: Partial<ModalConfig>
): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const modal = createModal({
      config: {
        title: 'Confirm',
        size: 'sm',
        closable: false,
        closeOnBackdrop: false,
        closeOnEsc: false,
        ...config,
      },
      component: () => {
        const wrapper = document.createElement('div');

        const msg = document.createElement('p');
        styleMsg(msg);
        msg.textContent = message;
        wrapper.appendChild(msg);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        styleBtn(cancelBtn, 'secondary');
        cancelBtn.addEventListener('click', () => {
          if (!resolved) { resolved = true; modal.close(); resolve(false); }
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        styleBtn(okBtn, 'primary');
        okBtn.addEventListener('click', () => {
          if (!resolved) { resolved = true; modal.close(); resolve(true); }
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        wrapper.appendChild(actions);

        return wrapper;
      },
    });

    modal.open();

    // Resolve false if closed externally
    const origClose = modal.close;
    modal.close = () => {
      origClose();
      if (!resolved) { resolved = true; resolve(false); }
    };
  }).then((result) => result as boolean);
}

// ─── alert() ─────────────────────────────────────────────────

export function alert(
  message: string,
  config?: Partial<ModalConfig>
): Promise<void> {
  return new Promise<void>((resolve) => {
    const modal = createModal({
      config: {
        title: 'Alert',
        size: 'sm',
        closable: false,
        closeOnBackdrop: false,
        closeOnEsc: false,
        ...config,
      },
      component: () => {
        const wrapper = document.createElement('div');

        const msg = document.createElement('p');
        styleMsg(msg);
        msg.textContent = message;
        wrapper.appendChild(msg);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;justify-content:flex-end';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        styleBtn(okBtn, 'primary');
        okBtn.addEventListener('click', () => {
          modal.close();
          modal.destroy();
          resolve();
        });

        actions.appendChild(okBtn);
        wrapper.appendChild(actions);

        return wrapper;
      },
    });

    modal.open();
  });
}

// ─── prompt() ────────────────────────────────────────────────

export function prompt(
  message: string,
  defaultValue?: string,
  config?: Partial<ModalConfig>
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const modal = createModal({
      config: {
        title: 'Input',
        size: 'sm',
        closable: false,
        closeOnBackdrop: false,
        closeOnEsc: false,
        ...config,
      },
      component: () => {
        const wrapper = document.createElement('div');

        const msg = document.createElement('p');
        msg.style.cssText = 'margin:0 0 12px;color:var(--lf-modal-body-color);font-size:14px';
        msg.textContent = message;
        wrapper.appendChild(msg);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue ?? '';
        styleInput(input);
        setTimeout(() => input.focus(), 50);
        wrapper.appendChild(input);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        styleBtn(cancelBtn, 'secondary');
        cancelBtn.addEventListener('click', () => {
          if (!resolved) { resolved = true; modal.close(); modal.destroy(); resolve(null); }
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        styleBtn(okBtn, 'primary');
        okBtn.addEventListener('click', () => {
          if (!resolved) { resolved = true; modal.close(); modal.destroy(); resolve(input.value); }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !resolved) {
            resolved = true;
            modal.close();
            modal.destroy();
            resolve(input.value);
          }
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        wrapper.appendChild(actions);

        return wrapper;
      },
    });

    modal.open();
  });
}
