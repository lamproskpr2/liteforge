import { createComponent } from '@liteforge/runtime';
import { Link } from '@liteforge/router';
import { CodeBlock } from '../components/CodeBlock.js';

interface PackageCard {
  name: string;
  href: string;
  description: string;
  badge: string;
  badgeColor: string;
}

const PACKAGES: PackageCard[] = [
  { name: 'core', href: '/core', description: 'Signals, computed, effects — the reactive foundation', badge: 'foundation', badgeColor: 'bg-violet-500/20 text-violet-300' },
  { name: 'runtime', href: '/runtime', description: 'Components, JSX, lifecycle, control flow', badge: 'foundation', badgeColor: 'bg-violet-500/20 text-violet-300' },
  { name: 'router', href: '/router', description: 'Client-side routing with guards and lazy loading', badge: 'routing', badgeColor: 'bg-blue-500/20 text-blue-300' },
  { name: 'query', href: '/query', description: 'Data fetching with automatic caching and invalidation', badge: 'data', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
  { name: 'client', href: '/client', description: 'TypeScript-first HTTP client with resource CRUD', badge: 'data', badgeColor: 'bg-emerald-500/20 text-emerald-300' },
  { name: 'form', href: '/form', description: 'Form state management with Zod validation', badge: 'ui', badgeColor: 'bg-amber-500/20 text-amber-300' },
  { name: 'table', href: '/table', description: 'Reactive data grid with sort, filter, pagination', badge: 'ui', badgeColor: 'bg-amber-500/20 text-amber-300' },
  { name: 'calendar', href: '/calendar', description: 'Scheduling calendar with 4 views and drag & drop', badge: 'ui', badgeColor: 'bg-amber-500/20 text-amber-300' },
];

// Use variable to prevent vite-plugin HMR transform from injecting __hmrId into demo strings
const _cc = 'createComponent';
const QUICKSTART = `import { signal, computed } from '@liteforge/core';
import { ${_cc} } from '@liteforge/runtime';

const Counter = ${_cc}({
  name: 'Counter',
  component() {
    const count = signal(0);
    const doubled = computed(() => count() * 2);

    return (
      <div>
        <button onclick={() => count.update(n => n + 1)}>
          Count: {() => count()}
        </button>
        <p>Doubled: {() => doubled()}</p>
      </div>
    );
  },
});`;

export const Overview = createComponent({
  name: 'Overview',
  component() {
    return (
      <div>
        {/* Hero */}
        <div class="mb-14">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-4">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Signals-based · No Virtual DOM · TypeScript-first
          </div>

          <h1 class="text-4xl font-bold text-white mb-3 tracking-tight">
            LiteForge
          </h1>
          <p class="text-lg text-neutral-400 leading-relaxed max-w-xl mb-6">
            A modular frontend framework built around fine-grained reactivity.
            Direct DOM updates, zero virtual DOM overhead, and a clean component model.
          </p>

          <div class="flex flex-wrap gap-3">
            {Link({ href: '/core', children: (
              <span class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                Get started →
              </span>
            )})}
            <a
              href="https://github.com/schildw3rk/liteforge"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 rounded-lg border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
            >
              GitHub ↗
            </a>
          </div>
        </div>

        {/* Feature highlights */}
        <div class="grid grid-cols-2 gap-3 mb-12">
          {[
            { icon: '⚡', title: 'Fine-grained reactivity', desc: 'Signal-based — only what changed re-renders' },
            { icon: '🚫', title: 'No Virtual DOM', desc: 'Direct DOM manipulation, no diffing overhead' },
            { icon: '🔷', title: 'TypeScript-first', desc: 'Strict types everywhere, zero any in public APIs' },
            { icon: '📦', title: 'Modular packages', desc: 'Use only what you need — each package is standalone' },
          ].map(f => (
            <div class="p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
              <div class="text-xl mb-2">{f.icon}</div>
              <p class="text-sm font-semibold text-white mb-0.5">{f.title}</p>
              <p class="text-xs text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <div class="mb-12">
          <h2 class="text-lg font-semibold text-white mb-1">Quick start</h2>
          <p class="text-sm text-neutral-400 mb-3">A reactive counter in 15 lines:</p>
          {CodeBlock({ code: QUICKSTART, language: 'tsx' })}
        </div>

        {/* Package map */}
        <div class="mb-10">
          <h2 class="text-lg font-semibold text-white mb-4">Packages</h2>
          <div class="grid grid-cols-1 gap-2">
            {PACKAGES.map(pkg => (
              <div>
                {Link({
                  href: pkg.href,
                  children: (
                    <div class="flex items-center justify-between p-3 rounded-lg border border-neutral-800 hover:border-neutral-600 bg-neutral-900/40 hover:bg-neutral-900 transition-all group">
                      <div class="flex items-center gap-3">
                        <span class="font-mono text-sm text-indigo-300 group-hover:text-indigo-200">
                          @liteforge/{pkg.name}
                        </span>
                        <span class="text-xs text-neutral-500">{pkg.description}</span>
                      </div>
                      <span class={`text-[0.65rem] px-1.5 py-0.5 rounded font-medium ${pkg.badgeColor}`}>
                        {pkg.badge}
                      </span>
                    </div>
                  ),
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
});
