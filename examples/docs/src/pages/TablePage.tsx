import { createComponent } from '@liteforge/runtime';
import { createTable } from '@liteforge/table';
import { signal } from '@liteforge/core';
import { DocSection } from '../components/DocSection.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { LiveExample } from '../components/LiveExample.js';
import { ApiTable } from '../components/ApiTable.js';
import type { ApiRow } from '../components/ApiTable.js';

// ─── Live example ─────────────────────────────────────────────────────────────

interface Patient {
  id: number;
  name: string;
  age: number;
  status: 'active' | 'inactive' | 'pending';
}

const SAMPLE_PATIENTS: Patient[] = [
  { id: 1, name: 'Anna Müller',   age: 34, status: 'active'   },
  { id: 2, name: 'Tom Weber',     age: 45, status: 'inactive' },
  { id: 3, name: 'Maria Schmidt', age: 28, status: 'active'   },
  { id: 4, name: 'Klaus Fischer', age: 61, status: 'pending'  },
  { id: 5, name: 'Eva Braun',     age: 39, status: 'active'   },
];

function TableExample(): Node {
  const data = signal<Patient[]>(SAMPLE_PATIENTS);

  const table = createTable<Patient>({
    data: () => data(),
    columns: [
      { key: 'id',     header: 'ID',     sortable: true,  cell: (v) => document.createTextNode(String(v)) },
      { key: 'name',   header: 'Name',   sortable: true,  cell: (v) => document.createTextNode(String(v)) },
      { key: 'age',    header: 'Age',    sortable: true,  cell: (v) => document.createTextNode(String(v)) },
      { key: 'status', header: 'Status', sortable: false, cell: (v) => document.createTextNode(String(v)) },
    ],
    pagination: { pageSize: 3 },
    selection: { enabled: true, mode: 'multi' },
  });

  const wrap = document.createElement('div');
  wrap.className = 'space-y-2 text-sm';
  wrap.appendChild(table.Root());
  return wrap;
}

// ─── Code strings ─────────────────────────────────────────────────────────────

const SETUP_CODE = `import { createTable } from '@liteforge/table';
import { signal } from '@liteforge/core';

interface Patient {
  id: number;
  name: string;
  dob: string;
  status: 'active' | 'inactive';
}

const patients = signal<Patient[]>([]);

const table = createTable<Patient>({
  data: () => patients(),
  columns: [
    { key: 'id',     header: 'ID',     sortable: true },
    { key: 'name',   header: 'Name',   sortable: true },
    { key: 'dob',    header: 'DOB',    sortable: true },
    { key: 'status', header: 'Status', sortable: false,
      cell: (value, row) => (
        <span class={\`badge \${row.status}\`}>{value}</span>
      ),
    },
  ],
  pagination: { pageSize: 20 },
  selection:  { enabled: true, mode: 'multi' },
});

// Render — includes table, pagination, and column headers
table.Root()`;

const COLUMNS_CODE = `columns: [
  // Simple column
  { key: 'name', header: 'Name', sortable: true },

  // Custom cell renderer
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    cell: (value, row) => (
      <span class={\`pill pill-\${row.status}\`}>{value}</span>
    ),
  },

  // Actions column (no data key)
  {
    key: '_actions',
    header: '',
    cell: (_value, row) => (
      <button onclick={() => editPatient(row)}>Edit</button>
    ),
  },
]`;

const FILTER_CODE = `createTable({
  data: () => patients(),
  columns: [...],
  filters: [
    {
      type: 'text',
      key: 'name',
      label: 'Search by name',
      placeholder: 'Anna…',
    },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      options: [
        { label: 'Active',   value: 'active'   },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
  ],
})`;

const SELECTION_CODE = `const table = createTable({
  data: () => patients(),
  columns: [...],
  selection: {
    enabled: true,
    mode: 'multi',  // or 'single'
  },
});

// React to selection
table.selectedRows()  // Signal: Patient[]
table.isSelected(row) // Signal: boolean

table.selectAll();
table.clearSelection();`;

const STATE_CODE = `table.sortState()        // { key, direction } | null
table.currentPage()      // number
table.totalPages()       // number
table.pageData()         // current page rows
table.filteredCount()    // total after filters

table.setSort('name', 'asc');
table.setPage(2);
table.setFilter('status', 'active');`;

const LIVE_CODE = `const table = createTable<Patient>({
  data: () => patients(),
  columns: [
    { key: 'name',   header: 'Name',   sortable: true },
    { key: 'age',    header: 'Age',    sortable: true },
    { key: 'status', header: 'Status', sortable: false },
  ],
  pagination: { pageSize: 3 },
  selection:  { enabled: true, mode: 'multi' },
});

table.Root() // renders table + header + pagination`;

const TABLE_API: ApiRow[] = [
  { name: 'data', type: '() => T[]', description: 'Data source — reactive function, re-renders when signal changes' },
  { name: 'columns', type: 'ColumnDef<T>[]', description: 'Column definitions — key, header, sortable, custom cell renderer' },
  { name: 'pagination', type: '{ pageSize: number }', description: 'Enable pagination with given page size' },
  { name: 'selection', type: "{ enabled: boolean, mode: 'single' | 'multi' }", description: 'Row selection mode' },
  { name: 'filters', type: 'FilterDef[]', description: 'Text, select, boolean, or number-range filter definitions' },
];

export const TablePage = createComponent({
  name: 'TablePage',
  component() {
    return (
      <div>
        <div class="mb-10">
          <p class="text-xs font-mono text-neutral-500 mb-1">@liteforge/table</p>
          <h1 class="text-3xl font-bold text-white mb-2">Data Table</h1>
          <p class="text-neutral-400 leading-relaxed max-w-xl">
            Reactive data grid with sorting, filtering, pagination, and row selection.
            Data is a signal — the table automatically re-renders when data changes.
          </p>
          {CodeBlock({ code: `pnpm add @liteforge/table`, language: 'bash' })}
          {CodeBlock({ code: `import { createTable } from '@liteforge/table';`, language: 'typescript' })}
        </div>

        {DocSection({
          title: 'createTable()',
          id: 'create-table',
          description: 'Define columns, data source, and options. Call table.Root() to render.',
          children: (
            <div>
              {CodeBlock({ code: SETUP_CODE, language: 'tsx' })}
              {ApiTable({ rows: TABLE_API })}
            </div>
          ),
        })}

        {DocSection({
          title: 'Column definitions',
          id: 'columns',
          description: 'Each column can have a custom cell renderer for badges, buttons, or any DOM element.',
          children: CodeBlock({ code: COLUMNS_CODE, language: 'tsx' }),
        })}

        {DocSection({
          title: 'Filters',
          id: 'filters',
          description: 'Add search and filter controls with built-in filter types: text, select, boolean, number range.',
          children: CodeBlock({ code: FILTER_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Row selection',
          id: 'selection',
          description: 'Single or multi-select with reactive selectedRows() signal.',
          children: CodeBlock({ code: SELECTION_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Table state',
          id: 'state',
          description: 'All table state (sort, page, filters) is exposed as signals — read or set programmatically.',
          children: CodeBlock({ code: STATE_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Live example',
          id: 'live',
          description: 'Click column headers to sort. Use checkboxes to select rows. Navigate pages.',
          children: LiveExample({
            title: 'Patient list with sort + pagination + selection',
            component: TableExample,
            code: LIVE_CODE,
          }),
        })}
      </div>
    );
  },
});
