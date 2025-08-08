import { InterfaceData } from './api/APIData';
import { safeList } from './safer';
import { loadEnvVariables } from './workspaceStorage';

export type Parameter = Record<string, string | number | boolean>;

// Utility to normalize inputs to a consistent array format
function normalizeInputs(inputs: Parameter[] | Parameter): Array<{ name: string; value: any }> {
  if (Array.isArray(inputs)) {
    return inputs as any;
  }
  return safeList(Object.entries(inputs)).map(([name, value]) => ({ name, value }));
}

// Generic replacement function
function replaceRefs(
  obj: any,
  pattern: RegExp,
  wrapper: (key: string, found?: { name: string; value: any }) => string | number,
  inputs: Array<{ name: string; value: any }>
): any {
  if (typeof obj === 'string') {
    return obj.replace(pattern, (_, key) => {
      const found = inputs.find(input => input.name === key);
      // Ensure the replacement is always a string
      return String(wrapper(key, found));
    });
  }

  if (Array.isArray(obj)) {
    return safeList(obj).map(item => replaceRefs(item, pattern, wrapper, inputs));
  }

  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      safeList(Object.entries(obj)).map(([k, v]) => [k, replaceRefs(v, pattern, wrapper, inputs)])
    );
  }

  return obj;
}

// Specific replacers
export function replaceInputRefsWithBrace(obj: any, inputs: Parameter[] | Parameter): any {
  return replaceRefs(
    obj,
    /<i:([a-zA-Z0-9_]+)>/g,
    (key, found) => found ? String(found.value) : `i:${key}`,
    normalizeInputs(inputs)
  );
}

export function replaceInputRefsWithQuotes(obj: any, inputs: Parameter[] | Parameter): any {
  return replaceRefs(
    obj,
    /"i:([a-zA-Z0-9_]+)"/g,
    (key, found) => {
      if (!found) {
        return `"i:${key}"`;
      }
      return typeof found.value === 'string' ? `"${found.value}"` : found.value;
    },
    normalizeInputs(inputs)
  );
}

export function replaceInputRefsWithNone(obj: any, inputs: Parameter[] | Parameter): any {
  return replaceRefs(
    obj,
    /i:([a-zA-Z0-9_]+)/g,
    (key, found) => found ? found.value : `i:${key}`,
    normalizeInputs(inputs)
  );
}

export function replaceEnvRefsWithBrace(obj: any, inputs: Parameter[] | Parameter): any {
  return replaceRefs(
    obj,
    /<e:([a-zA-Z0-9_]+)>/g,
    (key, found) => found ? String(found.value) : `e:${key}`,
    normalizeInputs(inputs)
  );
}

export function replaceEnvRefsWithQuotes(obj: any, inputs: Parameter[] | Parameter): any {
  return replaceRefs(
    obj,
    /"e:([a-zA-Z0-9_]+)"/g,
    (key, found) => {
      if (!found) {
        return `"e:${key}"`;
      }
      return typeof found.value === 'string' ? `"${found.value}"` : found.value;
    },
    normalizeInputs(inputs)
  );
}

export function replaceEnvRefsWithNone(obj: any, inputs: Parameter[] | Parameter): any {
  return replaceRefs(
    obj,
    /e:([a-zA-Z0-9_]+)/g,
    (key, found) => found ? found.value : `e:${key}`,
    normalizeInputs(inputs)
  );
}

// Wrapper for async env replacement
export function replaceEnvRefs(obj: InterfaceData, callback: (result: any) => void) {
  loadEnvVariables(vars => {
    if(!vars || vars.length === 0) {
      return callback(obj);
    }
    // Parse numbers and booleans if possible, otherwise keep as string
    const envs: Parameter = Object.fromEntries(
      safeList(vars).map(({ name, value }) => {
        if (value === "true") { return [name, true]; }
        if (value === "false") { return [name, false]; }
        const num = Number(value);
        return [name, isNaN(num) ? value : num];
      })
    );

    const replaced = [
      replaceEnvRefsWithBrace,
      replaceEnvRefsWithQuotes,
      replaceEnvRefsWithNone
    ].reduce((acc, fn) => fn(acc, envs), obj);

    callback(replaced);
  });
}

// Replaces all references (inputs first, then environment vars)
export function replaceAllRefs(
  iface: InterfaceData,
  defaults: Parameter[],
  inputs: Parameter[],
  callback: (result: any) => void
) {
  const mergedInputs = Object.assign(
    {},
    ...(defaults || []),
    ...(inputs || [])
  );

  const replacedIface = [
    replaceInputRefsWithBrace,
    replaceInputRefsWithQuotes,
    replaceInputRefsWithNone
  ].reduce((acc, fn) => fn(acc, mergedInputs), iface);

  replaceEnvRefs(replacedIface, callback);
}