/**
 * Integration tests - Full component transforms
 */

import { describe, it, expect } from 'vitest';
import { transformCode } from '../src/transform.js';

// =============================================================================
// Full Component Transforms
// =============================================================================

describe('Full Component Transform', () => {
  it('transforms a complete Counter component with signals', () => {
    const input = `
      function Counter() {
        const count = signal(0);
        return (
          <div class="counter">
            <h1>Count: {count()}</h1>
            <button onClick={() => count.update(n => n + 1)}>+1</button>
          </div>
        );
      }
    `;
    const output = transformCode(input);

    // Should have h import
    expect(output).toContain("import { h } from '@liteforge/runtime'");

    // Should have h() calls
    expect(output).toContain('h("div"');
    expect(output).toContain('h("h1"');
    expect(output).toContain('h("button"');

    // Dynamic child should be wrapped
    expect(output).toContain('=>');
    expect(output).toContain('count()');

    // Event handler should NOT be double-wrapped
    const onClickMatches = output.match(/onClick/g);
    expect(onClickMatches?.length).toBe(1);
  });

  it('transforms component with Show control flow', () => {
    const input = `
      function UserGreeting() {
        const user = signal(null);
        return (
          <Show 
            when={user() !== null} 
            fallback={<p>Please log in</p>}
          >
            <h1>Welcome, {user().name}!</h1>
          </Show>
        );
      }
    `;
    const output = transformCode(input);

    expect(output).toContain('h(Show');
    expect(output).toContain('"when"');
    expect(output).toContain('"fallback"');
    expect(output).toContain('h("p"');
    expect(output).toContain('h("h1"');
  });

  it('transforms component with For list rendering', () => {
    const input = `
      function UserList() {
        const users = signal([]);
        return (
          <ul class="user-list">
            <For each={users()}>
              {(user, index) => (
                <li class={index() % 2 === 0 ? 'even' : 'odd'}>
                  {user.name}
                </li>
              )}
            </For>
          </ul>
        );
      }
    `;
    const output = transformCode(input);

    expect(output).toContain('h("ul"');
    expect(output).toContain('h(For');
    expect(output).toContain('"each"');
    expect(output).toContain('h("li"');
    // Render prop should be preserved
    expect(output).toContain('(user, index) =>');
  });

  it('transforms component with nested components', () => {
    const input = `
      function App() {
        return (
          <Layout>
            <Header title="My App" />
            <main>
              <Sidebar />
              <Content />
            </main>
            <Footer />
          </Layout>
        );
      }
    `;
    const output = transformCode(input);

    expect(output).toContain('h(Layout');
    expect(output).toContain('h(Header');
    expect(output).toContain('h("main"');
    expect(output).toContain('h(Sidebar');
    expect(output).toContain('h(Content');
    expect(output).toContain('h(Footer');
  });

  it('handles fragments correctly', () => {
    const input = `
      function MultipleElements() {
        return (
          <>
            <Header />
            <main>Content</main>
            <Footer />
          </>
        );
      }
    `;
    const output = transformCode(input);

    expect(output).toContain('import { h, Fragment }');
    expect(output).toContain('h(Fragment');
    expect(output).toContain('h(Header');
    expect(output).toContain('h("main"');
    expect(output).toContain('h(Footer');
  });

  it('auto-imports h and Fragment', () => {
    const input = `
      const element = <div>Hello</div>;
      const fragment = <>World</>;
    `;
    const output = transformCode(input);

    // Should have single import with both h and Fragment
    expect(output).toContain("import { h, Fragment } from '@liteforge/runtime'");
    // Should not have duplicate imports
    const importCount = (output.match(/import \{/g) ?? []).length;
    expect(importCount).toBe(1);
  });

  it('distinguishes HTML elements from Components', () => {
    const input = `
      const html = <div class="container"><span>Text</span></div>;
      const component = <UserCard name={user().name}><Avatar /></UserCard>;
    `;
    const output = transformCode(input);

    // HTML elements get string tags
    expect(output).toContain('h("div"');
    expect(output).toContain('h("span"');
    // Components get identifier tags
    expect(output).toContain('h(UserCard');
    expect(output).toContain('h(Avatar');
  });

  it('preserves non-JSX code unchanged', () => {
    const input = `
      import { signal } from '@liteforge/core';
      
      const count = signal(0);
      
      function increment() {
        count.update(n => n + 1);
      }
      
      const element = <div>{count()}</div>;
    `;
    const output = transformCode(input);

    // Original imports should be preserved
    expect(output).toContain("import { signal } from '@liteforge/core'");
    // Signal creation should be preserved
    expect(output).toContain('const count = signal(0)');
    // Function should be preserved
    expect(output).toContain('function increment()');
    // Babel may add parentheses: (n) => n + 1
    expect(output).toContain('count.update(');
    // JSX should be transformed
    expect(output).toContain('h("div"');
  });
});

// =============================================================================
// Complex Expression Tests
// =============================================================================

describe('Complex Expressions', () => {
  it('wraps ternary expressions in props', () => {
    const input = '<div class={isActive() ? "active" : "inactive"}>Content</div>';
    const output = transformCode(input);

    expect(output).toContain('"class"');
    expect(output).toContain('=>');
    expect(output).toContain('isActive()');
    expect(output).toContain('?');
    expect(output).toContain('"active"');
    expect(output).toContain('"inactive"');
  });

  it('wraps binary expressions in props', () => {
    const input = '<div data-count={count() * 2 + offset()}>Content</div>';
    const output = transformCode(input);

    expect(output).toContain('"data-count"');
    expect(output).toContain('=>');
    expect(output).toContain('count()');
    expect(output).toContain('offset()');
  });

  it('wraps logical expressions in props', () => {
    const input = '<div hidden={!isVisible() && shouldHide()}>Content</div>';
    const output = transformCode(input);

    expect(output).toContain('"hidden"');
    expect(output).toContain('=>');
    expect(output).toContain('isVisible()');
    expect(output).toContain('shouldHide()');
  });

  it('wraps member expressions in props', () => {
    const input = '<div data-id={user.profile.id}>Content</div>';
    const output = transformCode(input);

    expect(output).toContain('"data-id"');
    expect(output).toContain('=>');
    expect(output).toContain('user.profile.id');
  });

  it('wraps template literals with expressions in children', () => {
    const input = '<div>{`Hello, ${user().name}! You have ${count()} messages.`}</div>';
    const output = transformCode(input);

    expect(output).toContain('=>');
    expect(output).toContain('user().name');
    expect(output).toContain('count()');
  });
});

// =============================================================================
// TypeScript Support Tests
// =============================================================================

describe('TypeScript Support', () => {
  it('handles typed components', () => {
    const input = `
      interface Props {
        name: string;
        count: number;
      }
      
      function MyComponent(props: Props) {
        return <div>{props.name}: {props.count}</div>;
      }
    `;
    const output = transformCode(input);

    expect(output).toContain('h("div"');
    expect(output).toContain('props.name');
    expect(output).toContain('props.count');
  });

  it('handles generic components', () => {
    const input = `
      function List<T>(props: { items: T[], render: (item: T) => JSX.Element }) {
        return <ul>{props.items.map(props.render)}</ul>;
      }
    `;
    const output = transformCode(input);

    expect(output).toContain('h("ul"');
  });

  it('handles type assertions', () => {
    const input = `
      const element = <div data-value={value as number}>Content</div>;
    `;
    const output = transformCode(input);

    expect(output).toContain('h("div"');
    expect(output).toContain('"data-value"');
  });
});
