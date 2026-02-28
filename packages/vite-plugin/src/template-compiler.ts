/**
 * Template Compiler
 * 
 * Generates hydration code that combines:
 * 1. Template string (cloned via _template())
 * 2. DOM path accessors (el.firstChild.nextSibling chains)
 * 3. Dynamic content insertion (_insert, _setProp, _addEventListener)
 * 
 * The generated code clones a static template and then hydrates the dynamic parts.
 */

import * as t from '@babel/types';
import type { ElementInfo, ChildInfo, TemplateAnalysis } from './template-extractor.js';
import { generateTemplateString } from './template-extractor.js';
import type { DomPath, PathStep } from './path-resolver.js';
import { resolvePaths } from './path-resolver.js';
import { isEventHandler } from './utils.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of compiling a template
 */
export interface CompiledTemplate {
  /** The template variable name (e.g., "_tmpl$1") */
  templateVar: string;
  /** The template literal call: _template('<div>...</div>') */
  templateDeclaration: t.VariableDeclaration;
  /** The IIFE or statements that clone and hydrate the template */
  hydratedExpression: t.Expression;
  /** Set of runtime imports needed */
  requiredImports: Set<string>;
}

/**
 * Context for compilation
 */
interface CompileContext {
  /** Counter for generating unique template names */
  templateCounter: number;
  /** Counter for generating unique element names within a template */
  elementCounter: number;
  /** Required runtime imports */
  requiredImports: Set<string>;
  /** The original JSX element (for extracting expressions) */
  originalElement: t.JSXElement;
}

// =============================================================================
// Compile Entry Point
// =============================================================================

/**
 * Compile a template analysis into executable code
 */
export function compileTemplate(
  analysis: TemplateAnalysis,
  templateCounter: number
): CompiledTemplate {
  const ctx: CompileContext = {
    templateCounter,
    elementCounter: 0,
    requiredImports: new Set(['_template']),
    originalElement: analysis.root.node,
  };
  
  const templateVar = `_tmpl$${templateCounter}`;
  
  // Generate the HTML template string
  const htmlString = generateTemplateString(analysis.root);
  
  // Create template declaration: const _tmpl$1 = _template('<div>...</div>');
  const templateDeclaration = t.variableDeclaration('const', [
    t.variableDeclarator(
      t.identifier(templateVar),
      t.callExpression(
        t.identifier('_template'),
        [t.stringLiteral(htmlString)]
      )
    ),
  ]);
  
  // Resolve DOM paths for hydration
  const pathResolution = resolvePaths(analysis.root);
  
  // Generate hydration code
  const hydratedExpression = generateHydrationCode(
    ctx,
    templateVar,
    analysis.root,
    pathResolution
  );
  
  return {
    templateVar,
    templateDeclaration,
    hydratedExpression,
    requiredImports: ctx.requiredImports,
  };
}

// =============================================================================
// Hydration Code Generation
// =============================================================================

/**
 * Generate the hydration code as an IIFE that:
 * 1. Clones the template
 * 2. Gets references to dynamic nodes
 * 3. Sets up dynamic props, events, and children
 * 4. Returns the root element
 */
function generateHydrationCode(
  ctx: CompileContext,
  templateVar: string,
  info: ElementInfo,
  pathResolution: { paths: DomPath[]; declarations: string[] }
): t.Expression {
  const statements: t.Statement[] = [];
  
  // Clone the template: const _el = _tmpl$1();
  statements.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier('_el'),
        t.callExpression(t.identifier(templateVar), [])
      ),
    ])
  );
  
  // Add DOM path declarations
  for (const decl of pathResolution.declarations) {
    // Parse the declaration string into an AST node
    const declStatement = parseDeclaration(decl);
    if (declStatement) {
      statements.push(declStatement);
    }
  }
  
  // Generate hydration for root element (dynamic props/events)
  const rootHydration = generateElementHydration(ctx, info, '_el');
  statements.push(...rootHydration);
  
  // Generate hydration for child elements with dynamic content
  for (const path of pathResolution.paths) {
    if (path.steps.length === 0) {
      // Root element - already handled above
      continue;
    }
    
    // Find the corresponding element or child info
    const targetInfo = findTargetByPath(info, path.steps);
    if (targetInfo) {
      if (targetInfo.type === 'element' && targetInfo.elementInfo) {
        const hydration = generateElementHydration(
          ctx,
          targetInfo.elementInfo,
          path.varName
        );
        statements.push(...hydration);
      } else if (targetInfo.type === 'expression' || targetInfo.type === 'fragment') {
        // Dynamic child expression
        const insertStatement = generateChildInsert(ctx, targetInfo, path.varName);
        if (insertStatement) {
          statements.push(insertStatement);
        }
      }
    }
  }
  
  // Return the root element
  statements.push(t.returnStatement(t.identifier('_el')));
  
  // Wrap in IIFE: (() => { ... })()
  return t.callExpression(
    t.arrowFunctionExpression([], t.blockStatement(statements)),
    []
  );
}

/**
 * Parse a declaration string like "const _el2 = _el.firstChild.nextSibling;"
 */
function parseDeclaration(decl: string): t.VariableDeclaration | null {
  // Extract parts using regex
  const match = decl.match(/const\s+(\w+)\s*=\s*(\w+)\.(.+);/);
  if (!match) return null;
  
  const [, varName, baseVar, accessorChain] = match;
  if (!varName || !baseVar || !accessorChain) return null;
  
  // Build the member expression chain
  const steps = accessorChain.split('.');
  let expr: t.Expression = t.identifier(baseVar);
  
  for (const step of steps) {
    expr = t.memberExpression(expr, t.identifier(step));
  }
  
  return t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(varName), expr),
  ]);
}

/**
 * Generate hydration statements for an element's dynamic props and events
 */
function generateElementHydration(
  ctx: CompileContext,
  info: ElementInfo,
  varName: string
): t.Statement[] {
  const statements: t.Statement[] = [];
  
  // Handle dynamic attributes
  for (const attrName of info.dynamicAttrs) {
    const attrExpr = findAttributeExpression(info.node, attrName);
    if (attrExpr) {
      ctx.requiredImports.add('_setProp');
      statements.push(
        t.expressionStatement(
          t.callExpression(t.identifier('_setProp'), [
            t.identifier(varName),
            t.stringLiteral(attrName),
            attrExpr,
          ])
        )
      );
    }
  }
  
  // Handle event handlers
  for (const eventAttr of info.eventHandlers) {
    const handler = findAttributeExpression(info.node, eventAttr);
    if (handler) {
      ctx.requiredImports.add('_addEventListener');
      // Convert onClick → click
      const eventName = eventAttr.slice(2).toLowerCase();
      statements.push(
        t.expressionStatement(
          t.callExpression(t.identifier('_addEventListener'), [
            t.identifier(varName),
            t.stringLiteral(eventName),
            handler,
          ])
        )
      );
    }
  }
  
  // Handle spread props (requires special handling at runtime)
  if (info.hasSpread) {
    const spreadExpr = findSpreadExpression(info.node);
    if (spreadExpr) {
      ctx.requiredImports.add('_spread');
      statements.push(
        t.expressionStatement(
          t.callExpression(t.identifier('_spread'), [
            t.identifier(varName),
            spreadExpr,
          ])
        )
      );
    }
  }
  
  // Handle dynamic children
  for (const child of info.children) {
    if (!child.isStatic) {
      const childHydration = generateChildHydration(ctx, child, varName);
      if (childHydration) {
        statements.push(childHydration);
      }
    }
  }
  
  return statements;
}

/**
 * Generate hydration for a dynamic child
 */
function generateChildHydration(
  ctx: CompileContext,
  child: ChildInfo,
  parentVar: string
): t.Statement | null {
  if (child.type === 'expression') {
    // Get the expression from the original JSX node
    if (t.isJSXExpressionContainer(child.node)) {
      const expr = child.node.expression;
      if (!t.isJSXEmptyExpression(expr)) {
        ctx.requiredImports.add('_insert');
        // Wrap in getter if it could be reactive
        const insertValue = wrapForReactivity(expr);
        return t.expressionStatement(
          t.callExpression(t.identifier('_insert'), [
            t.identifier(parentVar),
            insertValue,
          ])
        );
      }
    }
  }
  
  if (child.type === 'element' && child.elementInfo && child.elementInfo.isComponent) {
    // Component children need h() call, not template extraction
    // This should be handled by falling back to h() for this subtree
    // For now, skip - components aren't extracted into templates
  }
  
  return null;
}

/**
 * Generate _insert call for a dynamic child in resolved path
 */
function generateChildInsert(
  ctx: CompileContext,
  child: ChildInfo,
  varName: string
): t.Statement | null {
  if (child.type === 'expression' && t.isJSXExpressionContainer(child.node)) {
    const expr = child.node.expression;
    if (!t.isJSXEmptyExpression(expr)) {
      ctx.requiredImports.add('_insert');
      const insertValue = wrapForReactivity(expr);
      // _insert uses the parent of the marker node
      return t.expressionStatement(
        t.callExpression(t.identifier('_insert'), [
          t.memberExpression(t.identifier(varName), t.identifier('parentNode')),
          insertValue,
          t.identifier(varName), // marker
        ])
      );
    }
  }
  return null;
}

/**
 * Wrap an expression in a getter for reactivity if needed
 */
function wrapForReactivity(expr: t.Expression): t.Expression {
  // Check if the expression potentially contains signal reads
  // Simple heuristic: call expressions or member expressions might be reactive
  if (
    t.isCallExpression(expr) ||
    t.isMemberExpression(expr) ||
    t.isTemplateLiteral(expr) ||
    t.isBinaryExpression(expr) ||
    t.isConditionalExpression(expr) ||
    t.isLogicalExpression(expr)
  ) {
    // Wrap in arrow function: () => expr
    return t.arrowFunctionExpression([], expr);
  }
  
  // Identifiers that are not literals might be reactive
  if (t.isIdentifier(expr)) {
    // Could be a signal - wrap to be safe
    return t.arrowFunctionExpression([], expr);
  }
  
  // Literals are static
  return expr;
}

// =============================================================================
// AST Helpers
// =============================================================================

/**
 * Find an attribute expression in the JSX element
 */
function findAttributeExpression(
  element: t.JSXElement,
  attrName: string
): t.Expression | null {
  for (const attr of element.openingElement.attributes) {
    if (t.isJSXAttribute(attr)) {
      const name = t.isJSXIdentifier(attr.name) 
        ? attr.name.name 
        : `${attr.name.namespace.name}:${attr.name.name.name}`;
      
      if (name === attrName && attr.value) {
        if (t.isJSXExpressionContainer(attr.value)) {
          const expr = attr.value.expression;
          if (!t.isJSXEmptyExpression(expr)) {
            // For event handlers, don't wrap
            if (isEventHandler(attrName)) {
              return expr;
            }
            // For other props, wrap for reactivity
            return wrapForReactivity(expr);
          }
        } else if (t.isStringLiteral(attr.value)) {
          return attr.value;
        }
      }
    }
  }
  return null;
}

/**
 * Find spread expression in JSX element
 */
function findSpreadExpression(element: t.JSXElement): t.Expression | null {
  for (const attr of element.openingElement.attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      return attr.argument;
    }
  }
  return null;
}

/**
 * Find a target element or child by following a path
 */
function findTargetByPath(
  info: ElementInfo,
  steps: PathStep[]
): ChildInfo | null {
  if (steps.length === 0) {
    return null;
  }
  
  let currentChildren = info.children;
  let childIndex = 0;
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    if (step === 'firstChild') {
      childIndex = 0;
    } else if (step === 'nextSibling') {
      childIndex++;
    }
    
    const child = currentChildren[childIndex];
    if (!child) {
      return null;
    }
    
    // If this is the last step, return the child
    if (i === steps.length - 1) {
      return child;
    }
    
    // If there are more steps, descend into element children
    if (child.type === 'element' && child.elementInfo) {
      currentChildren = child.elementInfo.children;
      // Reset for firstChild of nested element
    } else {
      return null;
    }
  }
  
  return null;
}

// =============================================================================
// Top-Level Module Declarations
// =============================================================================

/**
 * Generate module-level template declarations
 * These should be hoisted to the top of the module for efficiency
 */
export function generateModuleTemplates(
  templates: Map<number, string>
): t.Statement[] {
  const statements: t.Statement[] = [];
  
  for (const [id, html] of templates) {
    statements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(`_tmpl$${id}`),
          t.callExpression(t.identifier('_template'), [t.stringLiteral(html)])
        ),
      ])
    );
  }
  
  return statements;
}

/**
 * Generate import statement for template runtime functions
 */
export function generateTemplateImports(
  requiredImports: Set<string>,
  importSource: string
): t.ImportDeclaration {
  const specifiers = Array.from(requiredImports).map((name) =>
    t.importSpecifier(t.identifier(name), t.identifier(name))
  );
  
  return t.importDeclaration(specifiers, t.stringLiteral(importSource));
}
