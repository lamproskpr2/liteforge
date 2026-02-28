/**
 * LiteForge Vite Plugin Types
 * 
 * Type definitions for the JSX transform plugin.
 */

import type { Plugin } from 'vite';

// =============================================================================
// Plugin Options
// =============================================================================

/**
 * Options for the LiteForge Vite plugin
 */
export interface LiteForgePluginOptions {
  /** File extensions to transform (default: ['.tsx', '.jsx']) */
  extensions?: string[];
  /** Enable HMR support (default: true in dev mode) */
  hmr?: boolean;
  /** Import source for h() and Fragment (default: '@liteforge/runtime') */
  importSource?: string;
  /** 
   * Enable template extraction optimization.
   * - 'auto': enabled in production, disabled in development (default)
   * - true: always enabled
   * - false: always disabled
   */
  templateExtraction?: boolean | 'auto';
}

/**
 * Resolved options with defaults applied
 */
export interface ResolvedPluginOptions {
  extensions: string[];
  hmr: boolean;
  importSource: string;
  templateExtraction: boolean | 'auto';
}

// =============================================================================
// Transform Context
// =============================================================================

/**
 * Context passed during transformation
 */
export interface TransformContext {
  /** The file ID being transformed */
  id: string;
  /** Whether we're in development mode */
  isDev: boolean;
  /** Resolved plugin options */
  options: ResolvedPluginOptions;
}

/**
 * Source map object (compatible with Rollup/Vite and Babel)
 */
export interface SourceMap {
  version: number;
  sources: string[];
  names: string[];
  sourceRoot?: string | undefined;
  sourcesContent?: string[] | undefined;
  mappings: string;
  file?: string | undefined;
}

/**
 * Result of a transform operation
 */
export interface TransformResult {
  /** The transformed code */
  code: string;
  /** Source map (if available) */
  map?: SourceMap | null;
  /** Whether JSX was found and transformed */
  hasJsx: boolean;
  /** Whether Fragment was used */
  hasFragment: boolean;
}

// =============================================================================
// JSX Transform State
// =============================================================================

/**
 * State tracked during JSX transformation
 */
export interface JsxTransformState {
  /** Whether any JSX was found */
  hasJsx: boolean;
  /** Whether Fragment (<>...</>) was used */
  hasFragment: boolean;
  /** Whether h import already exists */
  hasHImport: boolean;
  /** Whether Fragment import already exists */
  hasFragmentImport: boolean;
  /** The import source to use */
  importSource: string;
}

// =============================================================================
// Vite Plugin Type
// =============================================================================

/**
 * The LiteForge Vite plugin type
 */
export type LiteForgePlugin = Plugin;
