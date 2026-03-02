import { createComponent } from '@liteforge/runtime';

export interface ApiRow {
  name: string;
  type: string;
  default?: string;
  description: string;
}

interface ApiTableProps {
  rows: ApiRow[];
}

export const ApiTable = createComponent<ApiTableProps>({
  name: 'ApiTable',
  component({ props }) {
    return (
      <div class="overflow-x-auto rounded-lg border border-neutral-800 my-4">
        <table class="w-full text-sm text-left">
          <thead class="bg-neutral-900 text-neutral-400 text-xs uppercase tracking-wider">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="px-4 py-3">Type</th>
              <th class="px-4 py-3">Default</th>
              <th class="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, i) => (
              <tr class={i % 2 === 0 ? 'bg-neutral-950' : 'bg-neutral-900/50'}>
                <td class="px-4 py-3 font-mono text-indigo-300 whitespace-nowrap">{row.name}</td>
                <td class="px-4 py-3 font-mono text-emerald-400 whitespace-nowrap text-xs">{row.type}</td>
                <td class="px-4 py-3 font-mono text-amber-400 text-xs">{row.default ?? '—'}</td>
                <td class="px-4 py-3 text-neutral-300">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
});
