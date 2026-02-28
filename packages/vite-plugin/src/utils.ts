/**
 * LiteForge Vite Plugin Utilities
 * 
 * Helper functions for the JSX transform plugin.
 */

import type { LiteForgePluginOptions, ResolvedPluginOptions } from './types.js';

// =============================================================================
// Option Resolution
// =============================================================================

/**
 * Default plugin options
 */
const DEFAULT_OPTIONS: ResolvedPluginOptions = {
  extensions: ['.tsx', '.jsx'],
  hmr: true,
  importSource: '@liteforge/runtime',
  templateExtraction: 'auto',
};

/**
 * Resolve plugin options with defaults
 */
export function resolveOptions(
  options: LiteForgePluginOptions | undefined,
  isDev: boolean
): ResolvedPluginOptions {
  return {
    extensions: options?.extensions ?? DEFAULT_OPTIONS.extensions,
    hmr: options?.hmr ?? (isDev ? DEFAULT_OPTIONS.hmr : false),
    importSource: options?.importSource ?? DEFAULT_OPTIONS.importSource,
    templateExtraction: options?.templateExtraction ?? DEFAULT_OPTIONS.templateExtraction,
  };
}

/**
 * Check if template extraction should be enabled based on options and environment
 */
export function shouldUseTemplateExtraction(
  option: boolean | 'auto',
  isDev: boolean
): boolean {
  if (option === 'auto') {
    // Enable in production, disable in development
    return !isDev;
  }
  return option;
}

// =============================================================================
// File Matching
// =============================================================================

/**
 * Check if a file should be transformed based on its extension
 */
export function shouldTransform(id: string, extensions: string[]): boolean {
  // Remove query parameters (e.g., ?vue&type=script)
  const cleanId = id.split('?')[0] ?? id;
  return extensions.some((ext) => cleanId.endsWith(ext));
}

/**
 * Check if a file is in node_modules
 */
export function isNodeModules(id: string): boolean {
  return id.includes('node_modules');
}

// =============================================================================
// JSX Detection
// =============================================================================

/**
 * Quick check if code might contain JSX (before full parsing)
 * This is a heuristic to avoid parsing files that definitely don't have JSX.
 */
export function mightContainJsx(code: string): boolean {
  // Look for < followed by an identifier or >
  // This catches: <div, <Component, <>
  return /<[A-Za-z>]/.test(code);
}

// =============================================================================
// Prop Name Utilities
// =============================================================================

/**
 * Check if a prop name is an event handler (onClick, onInput, etc.)
 * Event handlers start with "on" followed by an uppercase letter.
 */
export function isEventHandler(propName: string): boolean {
  return propName.length > 2 && propName.startsWith('on') && isUpperCase(propName.charAt(2));
}

/**
 * Check if a character is uppercase
 */
function isUpperCase(char: string): boolean {
  return char >= 'A' && char <= 'Z';
}

/**
 * Check if a tag name is a component (starts with uppercase)
 */
export function isComponent(tagName: string): boolean {
  const firstChar = tagName.charAt(0);
  return isUpperCase(firstChar);
}

// =============================================================================
// Code Generation Helpers
// =============================================================================

/**
 * Create the h() import statement
 */
export function createHImport(importSource: string, needsFragment: boolean): string {
  const imports = needsFragment ? 'h, Fragment' : 'h';
  return `import { ${imports} } from '${importSource}';\n`;
}
