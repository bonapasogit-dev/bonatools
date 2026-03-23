/**
 * Shared test utilities for HTTP client test suites.
 */

import { vi } from 'vitest';
import type { Logger } from '../src/types';

/** Creates a mock logger with vi.fn() implementations for all log methods. */
export function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}
