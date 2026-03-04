/**
 * Internal plugin context factory.
 *
 * Creates a PluginContext backed by a shared appContext object.
 * provide() writes into appContext; resolve() reads from it.
 */

import type { PluginContext } from './types.js';

export function createPluginContext(
  target: HTMLElement,
  appContext: Record<string, unknown>,
): PluginContext {
  return {
    target,
    provide<K extends string, T>(key: K, value: T): void {
      appContext[key] = value;
    },
    resolve<T = unknown>(key: string): T | undefined {
      return key in appContext ? (appContext[key] as T) : undefined;
    },
  };
}
