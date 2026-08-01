import { JSONRecord } from "mmt-core/CommonData";
import { resolveInputsMap } from "mmt-core/variableReplacer";

export function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function envVarsToParameters(envVars: any[]): JSONRecord {
  return (envVars || []).reduce((acc: JSONRecord, envVar: any) => {
    if (envVar && typeof envVar === "object" && typeof envVar.name === "string") {
      acc[envVar.name] = envVar.value;
    }
    return acc;
  }, {} as JSONRecord);
}

/** Resolve `e:` / sibling `i:` tokens in YAML input defaults. */
export function resolveInputDefaults(
  defaults: JSONRecord | undefined,
  envParameters: JSONRecord,
): JSONRecord {
  return resolveInputsMap(
    defaults && typeof defaults === "object" ? defaults as Record<string, any> : {},
    envParameters as Record<string, any>,
  );
}

/**
 * Env refresh: re-resolve YAML defaults into non-dirty keys only.
 * Touched (temporary) input values are left as-is — same idea as API scopes:["env"].
 */
export function applyEnvRefreshToInputs(
  prev: JSONRecord,
  yamlDefaults: JSONRecord | undefined,
  envParameters: JSONRecord,
  dirtyKeys: Set<string>,
): JSONRecord {
  const resolvedDefaults = resolveInputDefaults(yamlDefaults, envParameters);
  const next: JSONRecord = { ...prev };
  let changed = false;

  for (const [key, resolved] of Object.entries(resolvedDefaults)) {
    if (dirtyKeys.has(key)) {
      continue;
    }
    if (!stableEqual(next[key], resolved)) {
      next[key] = resolved;
      changed = true;
    }
  }

  for (const key of Object.keys(next)) {
    if (dirtyKeys.has(key)) {
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(resolvedDefaults, key)) {
      delete next[key];
      changed = true;
    }
  }

  return changed ? next : prev;
}

/**
 * YAML inputs changed: rebuild from defaults, optionally preserving dirty keys.
 */
export function applyYamlInputsRefresh(
  prev: JSONRecord,
  yamlDefaults: JSONRecord | undefined,
  envParameters: JSONRecord,
  dirtyKeys: Set<string>,
  forceReset: boolean,
): JSONRecord {
  const resolvedDefaults = resolveInputDefaults(yamlDefaults, envParameters);
  if (forceReset || dirtyKeys.size === 0) {
    return resolvedDefaults;
  }

  const next: JSONRecord = { ...resolvedDefaults };
  dirtyKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(prev, key)
        && Object.prototype.hasOwnProperty.call(resolvedDefaults, key)) {
      next[key] = prev[key];
    }
  });
  return next;
}

/** Dirty = differs from the last resolved YAML/env baseline (not raw e: tokens). */
export function computeDirtyInputKeys(
  current: JSONRecord,
  resolvedBaseline: JSONRecord,
): Set<string> {
  const dirty = new Set<string>();
  const allKeys = new Set([
    ...Object.keys(resolvedBaseline),
    ...Object.keys(current),
  ]);
  allKeys.forEach((key) => {
    if (!stableEqual(current[key], resolvedBaseline[key])) {
      dirty.add(key);
    }
  });
  return dirty;
}

export function modifiedInputKeysLabel(dirtyKeys: Set<string>): string {
  return Array.from(dirtyKeys).join(", ");
}
