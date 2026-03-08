/**
 * @liteforge/i18n — Types
 */

export type TranslationValue = string;
export type TranslationTree = {
  [key: string]: TranslationValue | TranslationTree;
};

export type Locale = string;

export type InterpolationParams = Record<string, string | number>;

/**
 * Recursively extract all dot-notation leaf keys from a translation object.
 *
 * @example
 * type Keys = ExtractKeys<{ nav: { app: string; core: string }; title: string }>
 * // → 'nav.app' | 'nav.core' | 'title'
 *
 * When T is the default Record<string, string>, ExtractKeys<T> resolves to
 * `string`, preserving full backward compatibility for untyped usage.
 */
export type ExtractKeys<T, Prefix extends string = ''> =
  T extends string
    ? Prefix
    : {
        [K in keyof T & string]:
          ExtractKeys<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
      }[keyof T & string];

export interface I18nApi<T extends Record<string, unknown> = Record<string, string>> {
  /** Current locale signal accessor */
  locale(): Locale;
  /** Set locale and (re-)load translations */
  setLocale(locale: Locale): Promise<void>;
  /** Translate a dot-notation key — typed to only accept known keys when T is provided */
  t(key: ExtractKeys<T>, params?: InterpolationParams, count?: number): string;
}

export type LocaleLoader = (locale: Locale) => Promise<TranslationTree>;

export interface I18nPluginOptions {
  /** Default locale to load on startup */
  defaultLocale: Locale;
  /** Fallback locale used when a key is missing in current locale */
  fallbackLocale?: Locale;
  /** Function that returns the translation tree for a given locale */
  load: LocaleLoader;
  /** Whether to persist the locale choice in localStorage (default: true) */
  persist?: boolean;
  /** localStorage key name (default: 'lf-locale') */
  storageKey?: string;
}
