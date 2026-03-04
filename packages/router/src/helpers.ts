/**
 * @liteforge/router — Component Helpers
 *
 * Convenience functions for accessing router state inside components.
 */

import { use } from '@liteforge/runtime';
import type { Router } from './types.js';

/**
 * Returns a reactive getter for a named route parameter.
 *
 * @example
 * ```ts
 * setup() {
 *   const postId = useParam('id');
 *   const query = createQuery({ key: () => ['post', postId()], fn: () => fetchPost(postId()) });
 *   return { query };
 * }
 * ```
 */
export function useParam(name: string): () => string | undefined {
  const router = use<Router>('router');
  return () => router.params()[name];
}
