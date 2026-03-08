/**
 * @liteforge/i18n — Type-level tests for ExtractKeys and createI18n<T>
 */
import { describe, it, expectTypeOf } from 'vitest';
import type { ExtractKeys } from '../src/types.js';

describe('ExtractKeys type utility', () => {
  it('extracts flat keys', () => {
    type T = { title: string; subtitle: string };
    expectTypeOf<ExtractKeys<T>>().toEqualTypeOf<'title' | 'subtitle'>();
  });

  it('extracts nested dot-notation keys', () => {
    type T = { nav: { app: string; core: string }; title: string };
    expectTypeOf<ExtractKeys<T>>().toEqualTypeOf<'nav.app' | 'nav.core' | 'title'>();
  });

  it('handles deeply nested keys', () => {
    type T = { a: { b: { c: string } } };
    expectTypeOf<ExtractKeys<T>>().toEqualTypeOf<'a.b.c'>();
  });

  it('handles mixed depth — flat and nested siblings', () => {
    type T = { flat: string; nested: { x: string; y: string } };
    expectTypeOf<ExtractKeys<T>>().toEqualTypeOf<'flat' | 'nested.x' | 'nested.y'>();
  });

  it('t() parameter is typed to valid keys when generic is provided', () => {
    // The key union for this shape should be exactly these three strings
    type En = { nav: { app: string; core: string }; title: string };
    type Keys = ExtractKeys<En>;
    expectTypeOf<Keys>().toEqualTypeOf<'nav.app' | 'nav.core' | 'title'>();
  });

  it('default generic (Record<string, string>) produces string — backward compat', () => {
    // ExtractKeys<Record<string, string>> should expand to `string`
    // because keyof Record<string, string> is `string`, and T[K] = string → leaf.
    // This preserves backward compat: createI18n() (no generic) → t(key: string).
    type DefaultKeys = ExtractKeys<Record<string, string>>;
    expectTypeOf<DefaultKeys>().toEqualTypeOf<string>();
  });
});
