import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const hasBrowserWindow = typeof document !== 'undefined' && typeof window !== 'undefined' && window !== globalThis;

if (hasBrowserWindow) {
  afterEach(() => { cleanup(); window.localStorage.clear(); });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => window.localStorage,
  });
}
