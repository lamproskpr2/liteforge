import { createComponent } from '@liteforge/runtime';
import { DocSection } from '../components/DocSection.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { ApiTable } from '../components/ApiTable.js';
import type { ApiRow } from '../components/ApiTable.js';

const SETUP_CODE = `import { createClient } from '@liteforge/client';

const client = createClient({
  baseUrl: 'https://api.example.com',
  headers: { 'X-App-Version': '1.0' },
  timeout: 15_000,
  retry: 2,
});

// Shorthand HTTP methods
const user = await client.get<User>('/users/42');
const created = await client.post<User>('/users', { name: 'Anna' });
await client.delete('/users/42');`;

const RESOURCE_CODE = `const patients = client.resource<Patient, NewPatient>('patients');

// Typed CRUD operations
const list    = await patients.getList({ page: 1, pageSize: 20 });
const patient = await patients.getOne(42);
const created = await patients.create({ name: 'Anna', dob: '1990-01-15' });
const updated = await patients.update(42, { name: 'Anna M.' });
await patients.delete(42);

// Custom actions
await patients.action('discharge', { reason: 'recovered' }, 42);
// → POST /patients/42/discharge

// Raw request within resource path
await patients.custom({ method: 'GET', path: 'count' });
// → GET /patients/count`;

const QUERY_CLIENT_CODE = `import { createClient } from '@liteforge/client';
import { createQuery, createMutation } from '@liteforge/query';

// createClient with query → returns QueryClient
// resource() returns QueryResource — use* methods guaranteed, no ! needed
const client = createClient({
  baseUrl: 'https://api.example.com',
  query: { createQuery, createMutation },
});

const patients = client.resource<Patient, NewPatient>('patients');

// TypeScript knows these exist — no optional chaining needed
const listQuery  = patients.useList(() => ({ page: page(), pageSize: 20 }));
const oneQuery   = patients.useOne(42);
const createMut  = patients.useCreate();
const updateMut  = patients.useUpdate();
const deleteMut  = patients.useDelete();

listQuery.data()       // Patient[] | undefined (via ListResponse)
listQuery.isLoading()  // boolean
createMut.mutate({ name: 'Anna', dob: '1990-01-15' });`;

const INTERCEPTOR_CODE = `// Auth token injection
client.addInterceptor({
  onRequest: (config) => ({
    ...config,
    headers: {
      ...config.headers,
      Authorization: \`Bearer \${getToken()}\`,
    },
  }),
});

// 401 → refresh token and retry
client.addInterceptor({
  onResponseError: async (error) => {
    if (error.status === 401) {
      await refreshToken();
      return error.retry();  // re-execute the original request
    }
    throw error;
  },
});

// Remove an interceptor
const remove = client.addInterceptor({ onRequest: logRequest });
remove(); // no more logging`;

const MIDDLEWARE_CODE = `// Middleware wraps the entire request execution
const timingMiddleware: Middleware = async (config, next) => {
  const start = performance.now();
  const result = await next(config);
  console.log(\`\${config.method} \${config.url} — \${(performance.now() - start).toFixed(0)}ms\`);
  return result;
};

client.use(timingMiddleware);`;

const CONTRAST_CODE = `// ❌ Level 1: Manual fetch — maximum boilerplate
const patients = signal<Patient[]>([]);
const loading  = signal(false);
const error    = signal<Error | null>(null);

async function fetchPatients() {
  loading.set(true);
  try {
    const res = await fetch('/api/patients', {
      headers: { Authorization: \`Bearer \${token}\` },
    });
    if (!res.ok) throw new Error(res.statusText);
    patients.set(await res.json());
  } catch (e) { error.set(e as Error); }
  finally { loading.set(false); }
}

// ✓ Level 2: createClient — DX improvement
const patient = await client.get<Patient>('/patients/42');

// ✓ Level 3: resource() — typed CRUD, no URL strings
const patient = await client.resource<Patient>('patients').getOne(42);

// ✓ Level 4: QueryClient — reactive, cached, no state management
const query = client.resource<Patient>('patients').useOne(42);
query.data(); query.isLoading(); query.error();`;

const CLIENT_API: ApiRow[] = [
  { name: 'baseUrl', type: 'string', description: 'Base URL prepended to all request paths' },
  { name: 'headers', type: 'Record<string, string>', default: '{}', description: 'Default headers merged into every request' },
  { name: 'timeout', type: 'number', default: '30000', description: 'Request timeout in milliseconds' },
  { name: 'retry', type: 'number', default: '0', description: 'Number of retries on 5xx or network errors (exponential backoff)' },
  { name: 'query', type: '{ createQuery, createMutation }', default: 'undefined', description: 'Pass to get QueryClient — resource() returns QueryResource with use* methods' },
];

export const ClientPage = createComponent({
  name: 'ClientPage',
  component() {
    return (
      <div>
        <div class="mb-10">
          <p class="text-xs font-mono text-neutral-500 mb-1">@liteforge/client</p>
          <h1 class="text-3xl font-bold text-white mb-2">HTTP Client</h1>
          <p class="text-neutral-400 leading-relaxed max-w-xl">
            TypeScript-first HTTP client. Zero dependencies. Go from raw fetch to fully reactive,
            cached CRUD operations in 4 levels of progressively better DX.
          </p>
          <CodeBlock code={`pnpm add @liteforge/client`} language="bash" />
          <CodeBlock code={`import { createClient, ApiError } from '@liteforge/client';`} language="typescript" />
        </div>

        <DocSection
          title="Progressive DX — 4 levels"
          id="contrast"
          description="Start with raw fetch, graduate to client → resource → QueryClient as your needs grow."
        >
          <CodeBlock code={CONTRAST_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="createClient()"
          id="create-client"
          description="Creates a typed HTTP client with default headers, timeout, and retry. Without query option returns Client; with query returns QueryClient."
        >
          <div>
            <CodeBlock code={SETUP_CODE} language="typescript" />
            <ApiTable rows={CLIENT_API} />
          </div>
        </DocSection>

        <DocSection
          title="resource() — typed CRUD"
          id="resource"
          description="Binds a resource name to a base path and exposes strongly-typed CRUD methods. No URL strings in your components."
        >
          <CodeBlock code={RESOURCE_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="QueryClient — reactive resources"
          id="query-client"
          description="Pass { query } to createClient() to get a QueryClient. resource() then returns QueryResource — use* methods are required (not optional), no ! needed."
        >
          <CodeBlock code={QUERY_CLIENT_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="Interceptors"
          id="interceptors"
          description="Intercept every request and response. Perfect for auth token injection, retry-on-401, or global error handling."
        >
          <CodeBlock code={INTERCEPTOR_CODE} language="typescript" />
        </DocSection>

        <DocSection
          title="Middleware"
          id="middleware"
          description="Middleware wraps the entire request pipeline — useful for timing, logging, or request transformation."
        >
          <CodeBlock code={MIDDLEWARE_CODE} language="typescript" />
        </DocSection>
      </div>
    );
  },
});
