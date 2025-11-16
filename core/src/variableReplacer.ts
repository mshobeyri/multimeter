import {APIData} from './APIData';
import {JSONRecord} from './CommonData';
import {RANDOM_TOKEN_MAP} from './Random';
import {safeList} from './safer';
import {TestData} from './TestData';

// Replacement modes enum
enum ReplacementMode {
  BRACE = 'brace',    // <key> format
  QUOTES = 'quotes',  // "key" format
  NONE = 'none'       // key format
}

function replaceRefs(
    obj: any, pattern: RegExp, mode: ReplacementMode,
    inputs: Record<string, any>): any {
  if (typeof obj === 'string') {
    // Build anchored (non-global) pattern for full-string variable match based
    const anchored = mode === ReplacementMode.BRACE ?
        /^<<([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)>>$/ :
        /^([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)$/;

    const full = anchored.exec(obj);
    if (full && full[1]) {
      const key = full[1];
      const found = inputs[key];
      if (found !== undefined) {
        // Return the original type for complete string replacement
        return found;
      }
      // If not found, return the key literal
      return key;
    }

    // For partial replacements or multiple matches, convert to string
    return obj.replace(pattern, (match, key) => {
      const found = inputs[key];
      if (found === undefined) {
        return key;
      }
      return String(found);
    });
  }

  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return safeList(obj).map(item => replaceRefs(item, pattern, mode, inputs));
  }

  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
        safeList(Object.entries(obj))
            .map(([k, v]) => [k, replaceRefs(v, pattern, mode, inputs)]));
  }

  return obj;
}

// Specific replacers using flags
export function replaceInputRefsWithBrace(obj: any, inputs: any): any {
  return replaceRefs(
      obj, /<<([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)>>/g, ReplacementMode.BRACE, inputs);
}

export function replaceInputRefsWithNone(obj: any, inputs: any): any {
  return replaceRefs(
      obj, /([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)/g, ReplacementMode.NONE, inputs);
}

// Replaces all references (inputs first, then environment vars)
export function replaceAllRefs(
    iface: any, defaults: JSONRecord, inputs: JSONRecord,
    envs: JSONRecord): any {
  const mergedInputs = Object.assign({}, defaults, inputs);

  // Prepend "i:" to all keys from defaults and inputs
  const inputsWithPrefix = Object.fromEntries(
      Object.entries(mergedInputs).map(([key, value]) => [`i:${key}`, value]));

  // Prepend "e:" to all keys from envs
  const envsWithPrefix = Object.fromEntries(
      Object.entries(envs).map(([key, value]) => [`e:${key}`, value]));

  // Prepend "r:" to all keys from envs
  const mmtVariablesPrefix = Object.fromEntries(
      Object.entries(RANDOM_TOKEN_MAP).map(([key,
                                             value]) => [`r:${key}`, value()]));


  // Merge both prefixed objects
  const allVariables =
      Object.assign({}, inputsWithPrefix, envsWithPrefix, mmtVariablesPrefix);
  // Now replace all references using the merged variables
  let replacedIface = replaceInputRefsWithBrace(iface, allVariables);
  replacedIface = replaceInputRefsWithNone(replacedIface, allVariables);

  return replacedIface;
}