import { createComponent } from '@liteforge/runtime';
import { DocSection } from '../components/DocSection.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { ApiTable } from '../components/ApiTable.js';
import type { ApiRow } from '../components/ApiTable.js';

const SETUP_CODE = `import { createRouter, createBrowserHistory } from '@liteforge/router';
import { createApp } from '@liteforge/runtime';
import { App } from './App.js';

const router = createRouter({
  history: createBrowserHistory(),
  routes: [
    { path: '/',          component: HomePage },
    { path: '/patients',  component: PatientListPage },
    { path: '/patients/:id', component: PatientDetailPage },
    { path: '*',          component: NotFoundPage },
  ],
});

await createApp({ root: App, target: '#app', router });`;

const NESTED_CODE = `{
  path: '/dashboard',
  component: DashboardLayout,   // renders <RouterOutlet />
  children: [
    { path: '/',          component: DashboardHome },
    { path: '/patients',  component: PatientList },
    { path: '/settings',  component: Settings },
  ],
}`;

const LAZY_CODE = `// Routes are lazy-loaded automatically — just use inline imports
{
  path: '/reports',
  component: () => import('./pages/Reports.js'),
  export: 'ReportsPage',          // named export from module
  loading: () => <Spinner />,     // shown while loading
  lazy: { delay: 150, timeout: 8000 },
}`;

const LINK_CODE = `import { Link, RouterOutlet } from '@liteforge/router';

// Renders an <a> tag — activeClass applied when route matches
Link({
  href: '/patients',
  children: 'Patients',
  activeClass: 'font-bold text-indigo-400',
})

// Renders matched child route
RouterOutlet()`;

const GUARD_CODE = `import { defineGuard } from '@liteforge/router';

const authGuard = defineGuard('auth', async ({ to }) => {
  if (!isAuthenticated()) {
    return \`/login?redirect=\${encodeURIComponent(to.path)}\`;
  }
  return true;
});

// Apply to a route or group
{
  path: '/admin',
  component: AdminLayout,
  guard: authGuard,
  children: [ ... ],
}`;

const MIDDLEWARE_CODE = `import { defineMiddleware } from '@liteforge/router';

const titleMiddleware = defineMiddleware('title', async (ctx, next) => {
  await next();
  const route = ctx.matched[ctx.matched.length - 1];
  const title = route?.route.meta?.title as string ?? 'MyApp';
  document.title = title;
});

const router = createRouter({
  routes,
  history: createBrowserHistory(),
  middleware: [titleMiddleware],
});`;

const PARAMS_CODE = `import { getActiveRouter } from '@liteforge/router';

// Inside a component:
const router = use<Router>('router');

// Access current params (reactive)
const patientId = computed(() => router.currentRoute()?.params['id'] ?? '');

// Navigate programmatically
router.navigate('/patients/42');
router.navigate({ path: '/patients', query: { filter: 'active' } });
router.back();`;

const ROUTE_API: ApiRow[] = [
  { name: 'path', type: 'string', description: 'Route path. Use :param for dynamic segments, * for wildcard' },
  { name: 'component', type: 'ComponentFactory | () => Promise', description: 'Component factory or lazy import function' },
  { name: 'export', type: 'string', description: 'Named export to use from a lazy-loaded module' },
  { name: 'guard', type: 'RouteGuard | RouteGuard[]', description: 'Guard(s) that must pass before navigation completes' },
  { name: 'children', type: 'RouteDefinition[]', description: 'Nested routes rendered inside parent\'s RouterOutlet' },
  { name: 'meta', type: 'Record<string, unknown>', description: 'Arbitrary metadata accessible in middleware and guards' },
  { name: 'loading', type: '() => Node', description: 'Component shown while lazy module is loading' },
  { name: 'lazy', type: '{ delay?, timeout? }', description: 'Override global lazy loading config for this route' },
];

export const RouterPage = createComponent({
  name: 'RouterPage',
  component() {
    return (
      <div>
        <div class="mb-10">
          <p class="text-xs font-mono text-neutral-500 mb-1">@liteforge/router</p>
          <h1 class="text-3xl font-bold text-white mb-2">Router</h1>
          <p class="text-neutral-400 leading-relaxed max-w-xl">
            Client-side routing with nested routes, lazy loading, route guards, and middleware.
            The docs app you're reading uses it right now.
          </p>
          {CodeBlock({ code: `pnpm add @liteforge/router`, language: 'bash' })}
          {CodeBlock({ code: `import { createRouter, createBrowserHistory, Link, RouterOutlet } from '@liteforge/router';`, language: 'typescript' })}
        </div>

        {DocSection({
          title: 'Setup',
          id: 'setup',
          description: 'Create a router instance and pass it to createApp(). Routes are matched top-to-bottom.',
          children: (
            <div>
              {CodeBlock({ code: SETUP_CODE, language: 'typescript' })}
              {ApiTable({ rows: ROUTE_API })}
            </div>
          ),
        })}

        {DocSection({
          title: 'Nested routes',
          id: 'nested',
          description: 'Parent components render RouterOutlet() where child routes are mounted. Useful for layouts with sidebars, tabs, or shared headers.',
          children: CodeBlock({ code: NESTED_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Lazy loading',
          id: 'lazy',
          description: 'Use inline import() expressions directly in route definitions — the router handles wrapping automatically.',
          children: CodeBlock({ code: LAZY_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Link & RouterOutlet',
          id: 'link',
          description: 'Link renders an <a> tag with active state detection. RouterOutlet is where matched child routes render.',
          children: CodeBlock({ code: LINK_CODE, language: 'tsx' }),
        })}

        {DocSection({
          title: 'Guards',
          id: 'guards',
          description: 'Guards run before navigation completes. Return true to allow, a redirect path to redirect, or false to cancel.',
          children: CodeBlock({ code: GUARD_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Middleware',
          id: 'middleware',
          description: 'Middleware wraps every navigation. Use it for logging, document title updates, analytics, or scroll restoration.',
          children: CodeBlock({ code: MIDDLEWARE_CODE, language: 'typescript' }),
        })}

        {DocSection({
          title: 'Route params & navigation',
          id: 'params',
          description: 'Access route params and query strings reactively. Navigate programmatically with router.navigate().',
          children: CodeBlock({ code: PARAMS_CODE, language: 'typescript' }),
        })}
      </div>
    );
  },
});
