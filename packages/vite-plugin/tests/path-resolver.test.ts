/**
 * Tests for path-resolver.ts
 * 
 * Tests DOM path calculation for navigating from template root to dynamic nodes.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { extractElementInfo } from '../src/template-extractor.js';
import { resolvePaths, pathToAccessor } from '../src/path-resolver.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse JSX and get the first JSX element
 */
function parseJsx(code: string): t.JSXElement {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  
  let result: t.JSXElement | null = null;
  
  function traverse(node: t.Node): void {
    if (result) return;
    if (t.isJSXElement(node)) {
      result = node;
      return;
    }
    for (const key of Object.keys(node)) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            traverse(item as t.Node);
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        traverse(value as t.Node);
      }
    }
  }
  
  traverse(ast);
  if (!result) throw new Error('No JSX element found');
  return result;
}

/**
 * Get element info from JSX code
 */
function getInfo(code: string) {
  return extractElementInfo(parseJsx(code));
}

// =============================================================================
// Path Resolution Tests
// =============================================================================

describe('Path Resolution', () => {
  it('creates empty path for root element with dynamic attrs', () => {
    const info = getInfo('<div class={theme()}>Static</div>');
    const resolution = resolvePaths(info);
    
    const rootPath = resolution.paths.find(p => p.varName === '_el');
    expect(rootPath).toBeDefined();
    expect(rootPath?.steps).toHaveLength(0);
    expect(rootPath?.targetType).toBe('attribute');
  });
  
  it('creates firstChild path for first dynamic child', () => {
    const info = getInfo('<div>{dynamic()}</div>');
    const resolution = resolvePaths(info);
    
    const childPath = resolution.paths.find(p => p.targetType === 'child');
    expect(childPath).toBeDefined();
    expect(childPath?.steps).toEqual(['firstChild']);
  });
  
  it('creates nextSibling path for second child', () => {
    const info = getInfo('<div><span>A</span>{dynamic()}</div>');
    const resolution = resolvePaths(info);
    
    // The dynamic child is the second child (after <span>)
    const childPath = resolution.paths.find(p => p.targetType === 'child');
    expect(childPath).toBeDefined();
    expect(childPath?.steps).toContain('nextSibling');
  });
  
  it('creates nested path for deeply nested element', () => {
    const info = getInfo('<div><section><span class={x}></span></section></div>');
    const resolution = resolvePaths(info);
    
    // Path to span: div -> firstChild (section) -> firstChild (span)
    const spanPath = resolution.paths.find(p => 
      p.attrNames && p.attrNames.includes('class')
    );
    expect(spanPath).toBeDefined();
    expect(spanPath?.steps).toContain('firstChild');
  });
});

// =============================================================================
// Declaration Generation Tests
// =============================================================================

describe('Declaration Generation', () => {
  it('generates declaration for child path', () => {
    const info = getInfo('<div>{dynamic()}</div>');
    const resolution = resolvePaths(info);
    
    // Should have a declaration for the dynamic child
    expect(resolution.declarations.length).toBeGreaterThanOrEqual(1);
    
    const decl = resolution.declarations[0];
    expect(decl).toContain('const _el');
    expect(decl).toContain('firstChild');
  });
  
  it('generates optimized declarations reusing prefixes', () => {
    const info = getInfo(`
      <div>
        <section>
          {a()}
          {b()}
        </section>
      </div>
    `);
    const resolution = resolvePaths(info);
    
    // Should generate declarations that build on each other
    const declarations = resolution.declarations.join('\n');
    expect(declarations).toContain('firstChild');
  });
  
  it('skips declaration for root element', () => {
    const info = getInfo('<div class={theme()}>Static</div>');
    const resolution = resolvePaths(info);
    
    // Root is _el, no declaration needed (it's the clone result)
    const rootDecl = resolution.declarations.find(d => 
      d.includes('const _el =') && !d.includes('_el.')
    );
    expect(rootDecl).toBeUndefined();
  });
});

// =============================================================================
// Path to Accessor Tests
// =============================================================================

describe('pathToAccessor', () => {
  it('returns root var for empty path', () => {
    expect(pathToAccessor([])).toBe('_el');
    expect(pathToAccessor([], 'root')).toBe('root');
  });
  
  it('generates single step accessor', () => {
    expect(pathToAccessor(['firstChild'])).toBe('_el.firstChild');
    expect(pathToAccessor(['nextSibling'])).toBe('_el.nextSibling');
  });
  
  it('generates multi-step accessor', () => {
    expect(pathToAccessor(['firstChild', 'nextSibling'])).toBe(
      '_el.firstChild.nextSibling'
    );
  });
  
  it('uses custom root variable', () => {
    expect(pathToAccessor(['firstChild'], '_root')).toBe('_root.firstChild');
  });
});

// =============================================================================
// Complex Structure Tests
// =============================================================================

describe('Complex Structures', () => {
  it('handles multiple dynamic children', () => {
    const info = getInfo('<div>{a()}{b()}{c()}</div>');
    const resolution = resolvePaths(info);
    
    const childPaths = resolution.paths.filter(p => p.targetType === 'child');
    expect(childPaths).toHaveLength(3);
  });
  
  it('handles mixed static and dynamic children', () => {
    const info = getInfo('<div>Static {dynamic()} More</div>');
    const resolution = resolvePaths(info);
    
    // Only the dynamic expression needs a path
    const childPaths = resolution.paths.filter(p => p.targetType === 'child');
    expect(childPaths).toHaveLength(1);
  });
  
  it('handles element with dynamic attr in child', () => {
    const info = getInfo(`
      <div>
        <button onClick={fn}>Click</button>
      </div>
    `);
    const resolution = resolvePaths(info);
    
    const buttonPath = resolution.paths.find(p => 
      p.attrNames && p.attrNames.includes('onClick')
    );
    expect(buttonPath).toBeDefined();
    expect(buttonPath?.steps).toContain('firstChild');
  });
  
  it('handles multiple event handlers on same element', () => {
    const info = getInfo('<button onClick={a} onMouseOver={b}>Text</button>');
    const resolution = resolvePaths(info);
    
    const buttonPath = resolution.paths.find(p => p.varName === '_el');
    expect(buttonPath?.attrNames).toContain('onClick');
    expect(buttonPath?.attrNames).toContain('onMouseOver');
  });
  
  it('handles sibling elements with different dynamic content', () => {
    const info = getInfo(`
      <div>
        <span class={a}></span>
        <span onClick={b}></span>
      </div>
    `);
    const resolution = resolvePaths(info);
    
    // Should have paths for both spans
    const attrPaths = resolution.paths.filter(p => p.targetType === 'attribute');
    expect(attrPaths.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('handles empty element', () => {
    const info = getInfo('<div></div>');
    const resolution = resolvePaths(info);
    
    // No dynamic content, no paths needed
    expect(resolution.paths).toHaveLength(0);
    expect(resolution.declarations).toHaveLength(0);
  });
  
  it('handles deeply nested single path', () => {
    const info = getInfo(`
      <div>
        <section>
          <article>
            <p>{text()}</p>
          </article>
        </section>
      </div>
    `);
    const resolution = resolvePaths(info);
    
    const textPath = resolution.paths.find(p => p.targetType === 'child');
    expect(textPath).toBeDefined();
    // Path should traverse: firstChild (section) -> firstChild (article) -> firstChild (p) -> firstChild (text)
    expect(textPath?.steps.length).toBeGreaterThan(0);
  });
  
  it('handles spread attribute', () => {
    const info = getInfo('<div {...props}>Text</div>');
    const resolution = resolvePaths(info);
    
    // Spread needs a path for the root element
    const rootPath = resolution.paths.find(p => p.varName === '_el');
    expect(rootPath).toBeDefined();
  });
});
