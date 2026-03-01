import { CodeBlock } from './CodeBlock.js';

export interface LiveExampleOptions {
  title: string;
  description?: string;
  component: () => Node;
  code: string;
  language?: string;
}

export function LiveExample(opts: LiveExampleOptions): Node {
  const wrap = document.createElement('div');
  wrap.className = 'my-6 rounded-xl border border-neutral-800 overflow-hidden';

  // Header
  const header = document.createElement('div');
  header.className = 'px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 flex items-center gap-2';

  const dot = document.createElement('span');
  dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';

  const titleEl = document.createElement('span');
  titleEl.className = 'text-xs text-neutral-400 font-medium';
  titleEl.textContent = opts.title;

  header.appendChild(dot);
  header.appendChild(titleEl);

  if (opts.description !== undefined) {
    const desc = document.createElement('span');
    desc.className = 'text-xs text-neutral-600 ml-1';
    desc.textContent = `— ${opts.description}`;
    header.appendChild(desc);
  }

  // Preview
  const preview = document.createElement('div');
  preview.className = 'p-5 bg-neutral-950/60';
  preview.appendChild(opts.component());

  // Source
  const source = document.createElement('div');
  source.className = 'border-t border-neutral-800';
  source.appendChild(CodeBlock({ code: opts.code, language: opts.language ?? 'tsx' }));

  wrap.appendChild(header);
  wrap.appendChild(preview);
  wrap.appendChild(source);
  return wrap;
}
