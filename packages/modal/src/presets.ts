import { createModal } from './modal.js';
import type { ModalConfig } from './types.js';

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
        msg.style.margin = '0 0 20px';
        msg.textContent = message;
        wrapper.appendChild(msg);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:14px';
        cancelBtn.addEventListener('click', () => {
          if (!resolved) { resolved = true; modal.close(); resolve(false); }
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;font-size:14px';
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
        msg.style.margin = '0 0 20px';
        msg.textContent = message;
        wrapper.appendChild(msg);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;justify-content:flex-end';

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;font-size:14px';
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
        msg.style.margin = '0 0 12px';
        msg.textContent = message;
        wrapper.appendChild(msg);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue ?? '';
        input.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;margin-bottom:16px';
        wrapper.appendChild(input);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;font-size:14px';
        cancelBtn.addEventListener('click', () => {
          if (!resolved) { resolved = true; modal.close(); modal.destroy(); resolve(null); }
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'padding:8px 16px;border:none;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;font-size:14px';
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
