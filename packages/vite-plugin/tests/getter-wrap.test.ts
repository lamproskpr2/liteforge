/**
 * Tests for getter wrapping logic
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import {
  shouldWrapExpression,
  isStaticExpression,
  isLiteralValue,
  wrapInGetter,
  isFunctionCall,
  isBinaryExpression,
  isConditionalExpression,
  isMemberExpression,
  isIdentifier,
  isTemplateLiteralWithExpressions,
  isLogicalExpression,
  isUnaryExpression,
} from '../src/getter-wrap.js';

// =============================================================================
// Helper to parse an expression
// =============================================================================

function parseExpr(code: string): t.Expression {
  // Wrap in parentheses to ensure it's parsed as an expression
  // This handles edge cases like object literals, string literals at start, etc.
  const wrapped = `(${code})`;
  const ast = parse(wrapped, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const stmt = ast.program.body[0];
  if (!stmt || stmt.type !== 'ExpressionStatement') {
    throw new Error('Expected expression statement');
  }
  // Unwrap the parenthesized expression
  const expr = stmt.expression;
  if (t.isParenthesizedExpression(expr)) {
    return expr.expression;
  }
  return expr;
}

// =============================================================================
// shouldWrapExpression Tests
// =============================================================================

describe('shouldWrapExpression', () => {
  describe('should NOT wrap', () => {
    it('string literals', () => {
      const expr = parseExpr('"hello"');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('number literals', () => {
      const expr = parseExpr('42');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('boolean literals (true)', () => {
      const expr = parseExpr('true');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('boolean literals (false)', () => {
      const expr = parseExpr('false');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('null literals', () => {
      const expr = parseExpr('null');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('undefined identifier', () => {
      const expr = parseExpr('undefined');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('arrow functions', () => {
      const expr = parseExpr('() => count()');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('function expressions', () => {
      const expr = parseExpr('function() { return count(); }');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('arrow function with params', () => {
      const expr = parseExpr('(x) => x * 2');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('template literal without expressions', () => {
      const expr = parseExpr('`static text`');
      expect(shouldWrapExpression(expr)).toBe(false);
    });

    it('JSXEmptyExpression', () => {
      // JSXEmptyExpression is tricky to create directly, but we can test via isStaticExpression
      const emptyExpr = t.jsxEmptyExpression();
      expect(shouldWrapExpression(emptyExpr)).toBe(false);
    });
  });

  describe('should wrap', () => {
    it('function calls (signal reads)', () => {
      const expr = parseExpr('count()');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('binary expressions', () => {
      const expr = parseExpr('a() + b()');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('ternary/conditional expressions', () => {
      const expr = parseExpr('isActive() ? "on" : "off"');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('member expressions', () => {
      const expr = parseExpr('user.name');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('identifiers (variable references)', () => {
      const expr = parseExpr('count');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('template literals with expressions', () => {
      const expr = parseExpr('`Count: ${count()}`');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('logical expressions', () => {
      const expr = parseExpr('isA() && isB()');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('unary expressions', () => {
      const expr = parseExpr('!isActive()');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('array expressions', () => {
      const expr = parseExpr('[1, 2, count()]');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('object expressions', () => {
      const expr = parseExpr('{ name: user.name }');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('nested function calls', () => {
      const expr = parseExpr('getUser().name');
      expect(shouldWrapExpression(expr)).toBe(true);
    });

    it('method chains', () => {
      const expr = parseExpr('users().filter(u => u.active)');
      expect(shouldWrapExpression(expr)).toBe(true);
    });
  });
});

// =============================================================================
// isStaticExpression Tests
// =============================================================================

describe('isStaticExpression', () => {
  it('returns true for string literals', () => {
    const expr = parseExpr('"static"');
    expect(isStaticExpression(expr)).toBe(true);
  });

  it('returns true for empty template literals', () => {
    const expr = parseExpr('`static`');
    expect(isStaticExpression(expr)).toBe(true);
  });

  it('returns false for template literals with expressions', () => {
    const expr = parseExpr('`${x}`');
    expect(isStaticExpression(expr)).toBe(false);
  });

  it('returns false for function calls', () => {
    const expr = parseExpr('fn()');
    expect(isStaticExpression(expr)).toBe(false);
  });
});

// =============================================================================
// isLiteralValue Tests
// =============================================================================

describe('isLiteralValue', () => {
  it('returns true for string literal', () => {
    expect(isLiteralValue(t.stringLiteral('hello'))).toBe(true);
  });

  it('returns true for numeric literal', () => {
    expect(isLiteralValue(t.numericLiteral(42))).toBe(true);
  });

  it('returns true for boolean literal', () => {
    expect(isLiteralValue(t.booleanLiteral(true))).toBe(true);
    expect(isLiteralValue(t.booleanLiteral(false))).toBe(true);
  });

  it('returns true for null literal', () => {
    expect(isLiteralValue(t.nullLiteral())).toBe(true);
  });

  it('returns true for undefined identifier', () => {
    expect(isLiteralValue(t.identifier('undefined'))).toBe(true);
  });

  it('returns false for other identifiers', () => {
    expect(isLiteralValue(t.identifier('someVar'))).toBe(false);
  });

  it('returns false for call expressions', () => {
    expect(isLiteralValue(t.callExpression(t.identifier('fn'), []))).toBe(false);
  });
});

// =============================================================================
// wrapInGetter Tests
// =============================================================================

describe('wrapInGetter', () => {
  it('wraps expression in arrow function', () => {
    const expr = parseExpr('count()');
    const wrapped = wrapInGetter(expr);
    
    expect(t.isArrowFunctionExpression(wrapped)).toBe(true);
    expect(wrapped.params).toHaveLength(0);
    expect(t.isCallExpression(wrapped.body)).toBe(true);
  });

  it('wraps identifier in arrow function', () => {
    const expr = parseExpr('value');
    const wrapped = wrapInGetter(expr);
    
    expect(t.isArrowFunctionExpression(wrapped)).toBe(true);
    expect(t.isIdentifier(wrapped.body)).toBe(true);
  });
});

// =============================================================================
// Expression Type Check Tests
// =============================================================================

describe('Expression type checks', () => {
  it('isFunctionCall detects call expressions', () => {
    const expr = parseExpr('fn()');
    expect(isFunctionCall(expr)).toBe(true);
    expect(isFunctionCall(parseExpr('x'))).toBe(false);
  });

  it('isBinaryExpression detects binary operations', () => {
    const expr = parseExpr('a + b');
    expect(isBinaryExpression(expr)).toBe(true);
    expect(isBinaryExpression(parseExpr('x'))).toBe(false);
  });

  it('isConditionalExpression detects ternaries', () => {
    const expr = parseExpr('a ? b : c');
    expect(isConditionalExpression(expr)).toBe(true);
    expect(isConditionalExpression(parseExpr('x'))).toBe(false);
  });

  it('isMemberExpression detects member access', () => {
    const expr = parseExpr('obj.prop');
    expect(isMemberExpression(expr)).toBe(true);
    expect(isMemberExpression(parseExpr('x'))).toBe(false);
  });

  it('isIdentifier detects identifiers', () => {
    const expr = parseExpr('x');
    expect(isIdentifier(expr)).toBe(true);
    expect(isIdentifier(parseExpr('fn()'))).toBe(false);
  });

  it('isTemplateLiteralWithExpressions detects dynamic templates', () => {
    const dynamic = parseExpr('`${x}`');
    const staticTpl = parseExpr('`static`');
    expect(isTemplateLiteralWithExpressions(dynamic)).toBe(true);
    expect(isTemplateLiteralWithExpressions(staticTpl)).toBe(false);
  });

  it('isLogicalExpression detects logical operations', () => {
    const expr = parseExpr('a && b');
    expect(isLogicalExpression(expr)).toBe(true);
    expect(isLogicalExpression(parseExpr('x'))).toBe(false);
  });

  it('isUnaryExpression detects unary operations', () => {
    const expr = parseExpr('!x');
    expect(isUnaryExpression(expr)).toBe(true);
    expect(isUnaryExpression(parseExpr('x'))).toBe(false);
  });
});
