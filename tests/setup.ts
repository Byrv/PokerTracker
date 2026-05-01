import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// Make any unhandled console.error fail the test.
const originalError = console.error;
console.error = (...args: unknown[]) => {
  originalError(...args);
  throw new Error('console.error was called: ' + JSON.stringify(args));
};

vi.stubGlobal('crypto', crypto); // ensure available
