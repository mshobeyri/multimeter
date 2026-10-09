import {resolveRequestedAgainst} from './fileHelper';
import {parseCacheExpiryAtMs} from './JSerHelper';
import {isOmitSentinel} from './omitKeyword';
import {applyValueAccessor} from './variableReplacer';

/**
 * Per-run process environment store.
 *
 * Workspace / file / CLI env is the source. At run start we copy those values
 * into this store. Strings that look like relative `.mmt` paths (`./…mmt`)
 * become async getter functions at copy time only — a later `setenv` of the
 * same path string stays a plain string. `e:` reads call those functions
 * (cache honored inside); the source env is never mutated.
 */
export type EnvFileRunner = (resolvedPath: string) => Promise<{
  outputs?: Record<string, any>|null;
  /** Output keys in YAML declaration order (excluding `_`). */
  outputKeys?: string[];
  /** Raw `cache:` from the target file (duration / timestamp). */
  cache?: unknown;
}>;

export interface EnvStore {
  values: Record<string, any>;
  /**
   * Injected after create. File-backed getters call this to run the `.mmt`.
   * Shared across suite children; not copied from source env.
   */
  runEnvFile?: EnvFileRunner;
  /** Resolve `./x.mmt` for file-backed getters (usually vs env file path). */
  resolveFilePath?: (rawPath: string) => string;
}

export interface CreateEnvStoreOptions {
  resolveFilePath?: (rawPath: string) => string;
}

const ENV_FILE_PATH_KEY = '__mmtEnvFilePath';

/** Source-env path that becomes a getter on process-store copy. */
export function isEnvFilePathValue(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith('./') && /\.mmt$/i.test(trimmed);
}

export function envFilePathOfGetter(value: unknown): string|undefined {
  if (typeof value !== 'function') {
    return undefined;
  }
  const path = (value as any)[ENV_FILE_PATH_KEY];
  return typeof path === 'string' ? path : undefined;
}

/**
 * First declared output key from the YAML `outputs:` map (key order),
 * excluding API metadata `_`. Falls back to insertion order on `outputs`.
 */
export function firstEnvFileOutput(
    outputs: Record<string, any>|null|undefined,
    declaredKeys?: string[]): any {
  if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) {
    return null;
  }
  const ordered = (declaredKeys && declaredKeys.length > 0) ?
      declaredKeys :
      Object.keys(outputs);
  for (const key of ordered) {
    if (!key || key === '_') {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(outputs, key)) {
      continue;
    }
    const value = outputs[key];
    if (typeof value === 'undefined' || value === null || isOmitSentinel(value)) {
      continue;
    }
    return value;
  }
  return null;
}

function makeEnvFileGetter(store: EnvStore, rawPath: string): () => Promise<any> {
  let cached: {value: any; expiresAt: number}|undefined;
  /**
   * Parallel suite items / simultaneous `e:` reads share one run. A boolean
   * `resolving` flag used to return `null` for the second caller — wrong.
   * Cycle A→e:A is exotic; prefer sharing over nulling concurrent readers.
   */
  let inFlight: Promise<any>|undefined;
  const path = rawPath.trim();
  const getter = async () => {
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      return cached.value;
    }
    if (inFlight) {
      return inFlight;
    }
    const runner = store.runEnvFile;
    if (typeof runner !== 'function') {
      return null;
    }
    const resolvedPath =
        store.resolveFilePath ? store.resolveFilePath(path) : path;
    inFlight = (async () => {
      try {
        const result = await runner(resolvedPath);
        const value = firstEnvFileOutput(result?.outputs, result?.outputKeys);
        const expiresAt = parseCacheExpiryAtMs(result?.cache as any, Date.now());
        if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) &&
            expiresAt > Date.now()) {
          cached = {value, expiresAt};
        } else {
          cached = undefined;
        }
        return value;
      } finally {
        inFlight = undefined;
      }
    })();
    return inFlight;
  };
  (getter as any)[ENV_FILE_PATH_KEY] = path;
  return getter;
}

/** Flatten process values back to plain source-shaped data for VU clones. */
export function plainEnvValuesForClone(values?: Record<string, any>):
    Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, value] of Object.entries(values || {})) {
    const filePath = envFilePathOfGetter(value);
    out[name] = filePath !== undefined ? filePath : value;
  }
  return out;
}

/**
 * Copy `initial` into a new process store. Matching `./…mmt` strings become
 * async getters; everything else is copied as-is. Source remains untouched.
 */
export function createEnvStore(
    initial?: Record<string, any>,
    options?: CreateEnvStoreOptions): EnvStore {
  const store: EnvStore = {
    values: {},
    resolveFilePath: options?.resolveFilePath,
  };
  for (const [name, value] of Object.entries(initial || {})) {
    if (isEnvFilePathValue(value)) {
      store.values[name] = makeEnvFileGetter(store, value);
    } else {
      store.values[name] = value;
    }
  }
  return store;
}

export function createEnvStoreFromRun(params: {
  initial?: Record<string, any>;
  envvarFilePath?: string;
  filePath?: string;
  projectRoot?: string;
}): EnvStore {
  const {initial, envvarFilePath, filePath, projectRoot} = params;
  return createEnvStore(initial, {
    resolveFilePath: (rawPath: string) => resolveRequestedAgainst(
        envvarFilePath || filePath, rawPath, projectRoot),
  });
}

/** Isolated snapshot for load-test VUs (setenv must not cross VUs). */
export function cloneEnvStore(store?: EnvStore, fallback?: Record<string, any>):
    EnvStore {
  const plain = store ? plainEnvValuesForClone(store.values) :
                        {...(fallback || {})};
  const cloned = createEnvStore(plain, {
    resolveFilePath: store?.resolveFilePath,
  });
  if (store?.runEnvFile) {
    cloned.runEnvFile = store.runEnvFile;
  }
  return cloned;
}

/** Read one process-store value (await file-backed getters). */
export async function readEnvStoreValue(
    store: EnvStore|undefined, name: string, accessor?: string): Promise<any> {
  if (!store || !name ||
      !Object.prototype.hasOwnProperty.call(store.values, name)) {
    return undefined;
  }
  let value = store.values[name];
  if (typeof value === 'function') {
    value = await value();
  }
  if (value === undefined) {
    return undefined;
  }
  if (accessor) {
    return applyValueAccessor(value, accessor);
  }
  return value;
}
