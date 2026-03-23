export function isNodeRuntime(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.versions !== 'undefined' &&
    typeof process.versions.node === 'string'
  );
}

export function isBrowserRuntime(): boolean {
  const g = globalThis as Record<string, unknown>;
  return (
    typeof g.window !== 'undefined' &&
    typeof g.document !== 'undefined'
  );
}

export function hasFetchApi(): boolean {
  return typeof fetch === 'function';
}
