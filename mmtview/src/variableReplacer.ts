import {InterfaceData} from './api/APIData';
import {JSONRecord} from './CommonData';
import {safeList, toKVObject} from './safer';

// Generic replacement function
function replaceRefs(
    obj: any, pattern: RegExp,
    wrapper: (key: string, found?: any) => string | number,
    inputs: Record<string, any>): any {
  if (typeof obj === 'string') {
    return obj.replace(pattern, (_, key) => {
      const found = inputs[key];
      return String(wrapper(key, found));
    });
  }

  if (Array.isArray(obj)) {
    return safeList(obj).map(
        item => replaceRefs(item, pattern, wrapper, inputs));
  }

  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
        safeList(Object.entries(obj))
            .map(([k, v]) => [k, replaceRefs(v, pattern, wrapper, inputs)]));
  }

  return obj;
}

// Specific replacers
export function replaceInputRefsWithBrace(obj: any, inputs: any): any {
  return replaceRefs(obj, /<([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)>/g, (key, found) => {
    return found !== undefined ? String(found) : `<${key}>`;
  }, inputs);
}

export function replaceInputRefsWithQuotes(obj: any, inputs: any): any {
  return replaceRefs(obj, /"([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)"/g, (key, found) => {
    return found !== undefined ? `"${String(found)}"` : `"${key}"`;
  }, inputs);
}

export function replaceInputRefsWithNone(obj: any, inputs: any): any {
  return replaceRefs(obj, /([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)/g, (key, found) => {
    return found !== undefined ? String(found) : key;
  }, inputs);
}

// Replaces all references (inputs first, then environment vars)
export function replaceAllRefs(
    iface: InterfaceData, defaults: JSONRecord, inputs: JSONRecord,
    envs: JSONRecord): any {
  const mergedInputs = Object.assign({}, defaults, toKVObject(inputs));

  // Prepend "i:" to all keys from defaults and inputs
  const inputsWithPrefix = Object.fromEntries(
      Object.entries(mergedInputs).map(([key, value]) => [`i:${key}`, value]));

  // Prepend "e:" to all keys from envs
  const envsWithPrefix = Object.fromEntries(
      Object.entries(toKVObject(envs)).map(([key,
                                             value]) => [`e:${key}`, value]));

  // Merge both prefixed objects
  const allVariables = Object.assign({}, inputsWithPrefix, envsWithPrefix);

  // Now replace all references using the merged variables
  let replacedIface = replaceInputRefsWithBrace(iface, allVariables);
  replacedIface = replaceInputRefsWithQuotes(replacedIface, allVariables);
  replacedIface = replaceInputRefsWithNone(replacedIface, allVariables);

  return replacedIface;
}