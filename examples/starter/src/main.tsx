/**
 * Application Entry Point
 *
 * Bootstraps the LiteForge application using createApp() which handles:
 * - Context setup
 * - Store registration and initialization
 * - Router initialization
 * - Root component mounting
 * - DevTools integration
 * - Debug utilities (in development)
 */

import { createApp } from '@liteforge/runtime';
import { devtoolsPlugin } from '@liteforge/devtools';
import { ModalProvider } from '@liteforge/modal';

// Import app components
import { App } from './App.js';
import { createAppRouter } from './router.js';
import { authStore } from './stores/auth.js';
import { uiStore } from './stores/ui.js';

// Import styles
import './styles.css';

// =============================================================================
// Application Bootstrap
// =============================================================================

const app = await createApp({
  root: App,
  target: '#app',
  router: createAppRouter(),
  stores: [authStore, uiStore],
  
  // DevTools plugin - press Ctrl+Shift+D to open
  plugins: [
    devtoolsPlugin({
      shortcut: 'ctrl+shift+d',  // Keyboard shortcut to toggle panel
      position: 'right',          // Panel position: 'right' | 'bottom' | 'floating'
      defaultTab: 'signals',      // Default tab: 'signals' | 'stores' | 'router' | 'components' | 'performance'
      width: 400,                 // Panel width (for right position)
      maxEvents: 500,             // Max events to keep in buffer
    }),
  ],
  
  context: {
    // Mock API client (in real app, would be actual API client)
    api: {
      baseUrl: '/api',
      get: async (url: string) => {
        console.log(`[API] GET ${url}`);
        return {};
      },
      post: async (url: string, data: unknown) => {
        console.log(`[API] POST ${url}`, data);
        return {};
      },
    },
  },
  debug: true,
});

// Mount the modal portal (renders all open modals outside the component tree)
document.body.appendChild(ModalProvider());

// Log helpful info
console.log('[LiteForge] App mounted. Press Ctrl+Shift+D to open DevTools.');

// Export app instance for debugging/testing
export { app };
