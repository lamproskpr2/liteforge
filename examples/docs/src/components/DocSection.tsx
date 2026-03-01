export interface DocSectionOptions {
  title: string;
  description?: string;
  id?: string;
  children?: Node | Node[] | undefined;
}

export function DocSection(opts: DocSectionOptions): Node {
  const section = document.createElement('section');
  if (opts.id !== undefined) section.id = opts.id;
  section.className = 'py-8 border-b border-neutral-800 last:border-0';

  const heading = document.createElement('div');
  heading.className = 'flex items-center gap-2 mb-2';

  const h2 = document.createElement('h2');
  h2.className = 'text-xl font-semibold text-white';
  h2.textContent = opts.title;
  heading.appendChild(h2);

  if (opts.id !== undefined) {
    const anchor = document.createElement('a');
    anchor.href = `#${opts.id}`;
    anchor.className = 'text-neutral-600 hover:text-indigo-400 transition-colors text-sm';
    anchor.setAttribute('aria-label', `Link to ${opts.title}`);
    anchor.textContent = '#';
    heading.appendChild(anchor);
  }

  section.appendChild(heading);

  if (opts.description !== undefined) {
    const p = document.createElement('p');
    p.className = 'text-neutral-400 text-sm leading-relaxed mb-4';
    p.textContent = opts.description;
    section.appendChild(p);
  }

  if (opts.children !== undefined) {
    if (Array.isArray(opts.children)) {
      for (const child of opts.children) section.appendChild(child);
    } else {
      section.appendChild(opts.children);
    }
  }

  return section;
}
