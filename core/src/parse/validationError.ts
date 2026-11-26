/**
 * Structural / contract failure while preparing a file to run (bad YAML shape,
 * unknown keys, missing imports, etc.). Distinct from assertion/check failures
 * and from unexpected runtime exceptions.
 */
export class ValidationError extends Error {
  readonly kind = 'validation' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const FILE_IMPORT_KINDS = new Set([
  'missing-file',
  'circular-import',
  'invalid-path',
  'load-failed',
]);

/**
 * True for typed validation failures. Uses `kind` / `name` duck-typing so parse,
 * import, and runner layers can recognize each other without circular imports.
 */
export function isValidationError(e: unknown): boolean {
  if (!e || typeof e !== 'object') {
    return false;
  }
  const kind = (e as {kind?: unknown}).kind;
  if (kind === 'validation' || kind === 'import-error') {
    return true;
  }
  if (typeof kind === 'string' && FILE_IMPORT_KINDS.has(kind)) {
    return true;
  }
  const name = (e as {name?: unknown}).name;
  return name === 'ValidationError' || name === 'ImportCodeError' ||
      name === 'FileImportError';
}
