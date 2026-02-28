/**
 * Edge case tests for the JSX transform
 */

import { describe, it, expect } from 'vitest';
import { transform, transformCode } from '../src/transform.js';

const defaultOptions = {
  extensions: ['.tsx', '.jsx'],
  hmr: false,
  importSource: '@liteforge/runtime',
  templateExtraction: false as const,
};

// =============================================================================
// Empty and Self-Closing Elements
// =============================================================================

describe('Empty and Self-Closing Elements', () => {
  it('handles empty element: <div></div>', () => {
    const output = transformCode('<div></div>');
    expect(output).toContain('h("div"');
    expect(output).toContain('null');
  });

  it('handles self-closing element: <div />', () => {
    const output = transformCode('<div />');
    expect(output).toContain('h("div"');
    expect(output).toContain('null');
  });

  it('handles self-closing component: <Icon name="check" />', () => {
    const output = transformCode('<Icon name="check" />');
    expect(output).toContain('h(Icon');
    expect(output).toContain('"name"');
    expect(output).toContain('"check"');
  });

  it('handles void HTML elements', () => {
    const output = transformCode('<input type="text" />');
    expect(output).toContain('h("input"');
    expect(output).toContain('"type"');
    expect(output).toContain('"text"');
  });

  it('handles br element', () => {
    const output = transformCode('<br />');
    expect(output).toContain('h("br"');
  });

  it('handles hr element', () => {
    const output = transformCode('<hr />');
    expect(output).toContain('h("hr"');
  });
});

// =============================================================================
// Nested Ternaries
// =============================================================================

describe('Nested Ternaries', () => {
  it('handles nested ternaries in props', () => {
    const input = `
      <div class={
        isError() 
          ? 'error' 
          : isWarning() 
            ? 'warning' 
            : 'normal'
      }>
        Content
      </div>
    `;
    const output = transformCode(input);

    expect(output).toContain('"class"');
    expect(output).toContain('=>');
    expect(output).toContain('isError()');
    expect(output).toContain('isWarning()');
    // Babel may use single quotes in output
    expect(output.includes("'error'") || output.includes('"error"')).toBe(true);
    expect(output.includes("'warning'") || output.includes('"warning"')).toBe(true);
    expect(output.includes("'normal'") || output.includes('"normal"')).toBe(true);
  });

  it('handles ternaries in children', () => {
    const input = `
      <div>
        {isLoggedIn() ? <Dashboard /> : <Login />}
      </div>
    `;
    const output = transformCode(input);

    expect(output).toContain('h("div"');
    expect(output).toContain('isLoggedIn()');
    expect(output).toContain('h(Dashboard');
    expect(output).toContain('h(Login');
  });
});

// =============================================================================
// Spread Props
// =============================================================================

describe('Spread Props Edge Cases', () => {
  it('handles multiple spread props', () => {
    const output = transformCode('<div {...attrs1} {...attrs2}>Content</div>');
    expect(output).toContain('...attrs1');
    expect(output).toContain('...attrs2');
  });

  it('handles spread with static props', () => {
    const output = transformCode('<div class="base" {...attrs} id="main">Content</div>');
    expect(output).toContain('"class": "base"');
    expect(output).toContain('...attrs');
    expect(output).toContain('"id": "main"');
  });

  it('handles spread with dynamic props', () => {
    const output = transformCode('<div {...attrs} class={theme()}>Content</div>');
    expect(output).toContain('...attrs');
    expect(output).toContain('"class"');
    expect(output).toContain('=>');
  });
});

// =============================================================================
// Mixed Content
// =============================================================================

describe('Mixed Content', () => {
  it('handles mixed static and dynamic children', () => {
    const output = transformCode('<div>Hello {name()} World</div>');
    expect(output).toContain('"Hello"');
    expect(output).toContain('name()');
    expect(output).toContain('"World"');
  });

  it('handles multiple dynamic children', () => {
    const output = transformCode('<div>{firstName()} {lastName()}</div>');
    expect(output).toContain('firstName()');
    expect(output).toContain('lastName()');
  });

  it('handles elements between text', () => {
    const output = transformCode('<div>Before <strong>Middle</strong> After</div>');
    expect(output).toContain('"Before"');
    expect(output).toContain('h("strong"');
    expect(output).toContain('"Middle"');
    expect(output).toContain('"After"');
  });
});

// =============================================================================
// Deeply Nested JSX
// =============================================================================

describe('Deeply Nested JSX', () => {
  it('handles deeply nested elements', () => {
    const input = `
      <div>
        <section>
          <article>
            <header>
              <h1>Title</h1>
            </header>
            <p>Content</p>
          </article>
        </section>
      </div>
    `;
    const output = transformCode(input);

    expect(output).toContain('h("div"');
    expect(output).toContain('h("section"');
    expect(output).toContain('h("article"');
    expect(output).toContain('h("header"');
    expect(output).toContain('h("h1"');
    expect(output).toContain('h("p"');
  });

  it('handles deeply nested components', () => {
    const input = `
      <App>
        <Layout>
          <Page>
            <Section>
              <Card>
                <Title>Hello</Title>
              </Card>
            </Section>
          </Page>
        </Layout>
      </App>
    `;
    const output = transformCode(input);

    expect(output).toContain('h(App');
    expect(output).toContain('h(Layout');
    expect(output).toContain('h(Page');
    expect(output).toContain('h(Section');
    expect(output).toContain('h(Card');
    expect(output).toContain('h(Title');
  });
});

// =============================================================================
// JSX in Various Contexts
// =============================================================================

describe('JSX in Various Contexts', () => {
  it('handles JSX in variable assignments', () => {
    const output = transformCode('const el = <div>Hello</div>;');
    expect(output).toContain('const el = h("div"');
  });

  it('handles JSX returned from arrow functions', () => {
    const output = transformCode('const render = () => <div>Hello</div>;');
    expect(output).toContain('h("div"');
  });

  it('handles JSX returned from regular functions', () => {
    const input = `
      function Component() {
        return <div>Hello</div>;
      }
    `;
    const output = transformCode(input);
    expect(output).toContain('return h("div"');
  });

  it('handles JSX in conditional return', () => {
    const input = `
      function Component() {
        if (condition) {
          return <First />;
        }
        return <Second />;
      }
    `;
    const output = transformCode(input);
    expect(output).toContain('return h(First');
    expect(output).toContain('return h(Second');
  });

  it('handles JSX in array', () => {
    const input = 'const items = [<div>A</div>, <div>B</div>];';
    const output = transformCode(input);
    expect(output).toContain('h("div", null, "A")');
    expect(output).toContain('h("div", null, "B")');
  });
});

// =============================================================================
// Multiple JSX Roots
// =============================================================================

describe('Multiple JSX Roots', () => {
  it('handles multiple JSX roots in one file', () => {
    const input = `
      const header = <header>Header</header>;
      const main = <main>Main</main>;
      const footer = <footer>Footer</footer>;
    `;
    const output = transformCode(input);

    expect(output).toContain('h("header"');
    expect(output).toContain('h("main"');
    expect(output).toContain('h("footer"');
    
    // Should only have one import
    const importCount = (output.match(/import \{/g) ?? []).length;
    expect(importCount).toBe(1);
  });
});

// =============================================================================
// Non-JSX Files
// =============================================================================

describe('Non-JSX Files', () => {
  it('skips non-JSX files', () => {
    const code = `
      const x = 1 + 2;
      const obj = { foo: 'bar' };
      function add(a, b) { return a + b; }
    `;
    const result = transform(code, defaultOptions);
    expect(result.hasJsx).toBe(false);
    expect(result.code).toBe(code);
  });

  it('preserves non-JSX code unchanged', () => {
    const code = 'const x = a < b && c > d;'; // Less than and greater than, not JSX
    const result = transform(code, defaultOptions);
    // This should still work because mightContainJsx does a simple regex
    // that might match, but the actual parse will reveal no JSX
    expect(result.code).toContain('const x = a < b && c > d');
  });
});

// =============================================================================
// Comments in JSX
// =============================================================================

describe('Comments in JSX', () => {
  it('handles JSX comments', () => {
    const input = `
      <div>
        {/* This is a comment */}
        <span>Content</span>
      </div>
    `;
    const output = transformCode(input);
    expect(output).toContain('h("div"');
    expect(output).toContain('h("span"');
  });
});

// =============================================================================
// Event Handler Edge Cases
// =============================================================================

describe('Event Handler Edge Cases', () => {
  it('handles various event handlers', () => {
    const input = `
      <input 
        onClick={() => {}}
        onInput={(e) => {}}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onFocus={onFocus}
      />
    `;
    const output = transformCode(input);

    // All event handlers should be present, none double-wrapped
    expect(output).toContain('"onClick"');
    expect(output).toContain('"onInput"');
    expect(output).toContain('"onKeyDown"');
    expect(output).toContain('"onMouseEnter"');
    expect(output).toContain('"onFocus"');
  });

  it('does NOT wrap event handlers even with dynamic references', () => {
    const input = '<button onClick={handlers.click}>Click</button>';
    const output = transformCode(input);

    // onClick should be handlers.click directly, not wrapped
    expect(output).toContain('"onClick": handlers.click');
  });
});

// =============================================================================
// Special Characters
// =============================================================================

describe('Special Characters', () => {
  it('handles special characters in text', () => {
    const output = transformCode('<div>Hello &amp; World</div>');
    expect(output).toContain('h("div"');
  });

  it('handles emoji in text', () => {
    const output = transformCode('<div>Hello World</div>');
    expect(output).toContain('h("div"');
  });

  it('handles unicode in text', () => {
    const output = transformCode('<div>Привет мир</div>');
    expect(output).toContain('h("div"');
  });
});

// =============================================================================
// Namespaced Components
// =============================================================================

describe('Namespaced Components', () => {
  it('handles Namespace.Component syntax', () => {
    const output = transformCode('<UI.Button>Click</UI.Button>');
    expect(output).toContain('h(UI.Button');
  });

  it('handles deeply nested namespaces', () => {
    const output = transformCode('<UI.Forms.Input.Text />');
    expect(output).toContain('h(UI.Forms.Input.Text');
  });
});
