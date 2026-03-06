/**
 * UI Store - Manages UI state like theme, sidebar, notifications
 * 
 * Demonstrates:
 * - Simple synchronous state management
 * - Derived state via getters
 * - Persistent preferences
 * - NO singleton wrapper needed - defineStore handles it!
 */

import { defineStore } from 'liteforge/store';
import { hasTitleOverride } from 'liteforge/router';

// =============================================================================
// Types
// =============================================================================

export type Theme = 'light' | 'dark' | 'system';

// =============================================================================
// Store - Direct export, no wrapper needed!
// =============================================================================

export const uiStore = defineStore('ui', {
  state: {
    theme: 'system' as Theme,
    sidebarOpen: true,
    pageTitle: 'LiteForge Demo',
  },

  getters: (state) => ({
    /** Get the effective theme (resolves 'system' to actual theme) */
    effectiveTheme: (): 'light' | 'dark' => {
      const theme = state.theme();
      if (theme === 'light' || theme === 'dark') return theme;

      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    },

    /** Check if sidebar is collapsed */
    isSidebarCollapsed: () => !state.sidebarOpen(),
  }),

  actions: (state) => {
    const applyTheme = () => {
      const theme = state.theme();
      const effective = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

      document.documentElement.setAttribute('data-theme', effective);
    };

    return {
      setTheme(theme: Theme) {
        state.theme.set(theme);
        localStorage.setItem('liteforge_theme', theme);
        applyTheme();
      },

      applyTheme,

      toggleSidebar() {
        state.sidebarOpen.update(open => !open);
      },

      setPageTitle(title: string) {
        state.pageTitle.set(title);
        if (!hasTitleOverride()) {
          document.title = `${title} | LiteForge Demo`;
        }
      },

      initialize() {
        const storedTheme = localStorage.getItem('liteforge_theme') as Theme | null;
        if (storedTheme) {
          state.theme.set(storedTheme);
        }
        applyTheme();

        if (window.matchMedia) {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (state.theme() === 'system') {
              applyTheme();
            }
          });
        }
      },
    };
  },
});
