/**
 * Internal reactive primitives for DevTools.
 *
 * These wrappers automatically set __internal: true to prevent
 * debug event emission, avoiding infinite loops where DevTools
 * would receive events from its own signals/effects/computeds.
 */

import {
  signal as coreSignal,
  effect as coreEffect,
  computed as coreComputed,
} from '@liteforge/core';
import type {
  Signal,
  ReadonlySignal,
  SignalOptions,
  EffectFn,
  EffectOptions,
  DisposeFn,
  ComputeFn,
  ComputedOptions,
} from '@liteforge/core';

/**
 * Create an internal signal that doesn't emit debug events.
 */
export function signal<T>(
  initialValue: T,
  options?: Omit<SignalOptions, '__internal'>
): Signal<T> {
  return coreSignal(initialValue, { ...options, __internal: true });
}

/**
 * Create an internal effect that doesn't emit debug events.
 */
export function effect(
  fn: EffectFn,
  options?: Omit<EffectOptions, '__internal'>
): DisposeFn {
  return coreEffect(fn, { ...options, __internal: true });
}

/**
 * Create an internal computed that doesn't emit debug events.
 */
export function computed<T>(
  fn: ComputeFn<T>,
  options?: Omit<ComputedOptions, '__internal'>
): ReadonlySignal<T> {
  return coreComputed(fn, { ...options, __internal: true });
}
