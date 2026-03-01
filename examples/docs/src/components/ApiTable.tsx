export interface ApiRow {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export function ApiTable(opts: { rows: ApiRow[] }): Node {
  const wrapper = document.createElement('div');
  wrapper.className = 'overflow-x-auto rounded-lg border border-neutral-800 my-4';

  const table = document.createElement('table');
  table.className = 'w-full text-sm text-left';

  const thead = document.createElement('thead');
  thead.className = 'bg-neutral-900 text-neutral-400 text-xs uppercase tracking-wider';
  const headerRow = document.createElement('tr');
  for (const label of ['Name', 'Type', 'Default', 'Description']) {
    const th = document.createElement('th');
    th.className = 'px-4 py-3';
    th.textContent = label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  opts.rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/50';

    const cells: Array<{ text: string; cls: string }> = [
      { text: row.name,          cls: 'px-4 py-3 font-mono text-indigo-300 whitespace-nowrap' },
      { text: row.type,          cls: 'px-4 py-3 font-mono text-emerald-400 whitespace-nowrap text-xs' },
      { text: row.default ?? '—', cls: 'px-4 py-3 font-mono text-amber-400 text-xs' },
      { text: row.description,   cls: 'px-4 py-3 text-neutral-300' },
    ];

    for (const cell of cells) {
      const td = document.createElement('td');
      td.className = cell.cls;
      td.textContent = cell.text;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrapper.appendChild(table);
  return wrapper;
}
