import {InterfaceData} from './api/APIData';
import {loadEnvVariables} from './workspaceStorage';

// 1. Replace all i:<param> with the value from inputs


export type Parameter = {
  [key: string]: string|number|boolean
};

export function replaceInputRefs(
    obj: any, inputs: Parameter[]|Record<string, string|number|boolean>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: any}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(/"i:([a-zA-Z0-9_]+)"/g, (_, key) => {
      const found = inputArr.find(input => input.name === key);
      if (found === undefined) {
        return `"i:${key}"`;
      }
      if (typeof found.value === 'string') {
        return `"${found.value}"`;
      }
      if (typeof found.value === 'number' || typeof found.value === 'boolean') {
        return found.value;
      }
      return found.value;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceInputRefs(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceInputRefs(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}

// 2. Replace all e:<param> with the value from envs loaded from workspace
// storage (async)
export function replaceEnvRefs(
    obj: InterfaceData, callback: (result: any) => void) {
  loadEnvVariables((vars) => {
    const envs: Record<string, string> = {};
    vars.forEach(({name, value}) => {
      envs[name] = value;
    });
    const replaced = (function recur(o: any): any {
      if (typeof o === 'string') {
        return o.replace(/"e:([a-zA-Z0-9_]+)"/g, (_, key) => {
          const found = envs[key];
          if (found === undefined) {
            return `"i:${key}"`;
          }
          if (typeof found === 'string') {
            return `"${found}"`;
          }
          if (typeof found === 'number' || typeof found === 'boolean') {
            return found;
          }
          return found;
        });
      }
      else if (Array.isArray(o)) {
        return o.map(item => recur(item));
      } else if (o && typeof o === 'object') {
        const result: any = {};
        for (const k in o) {
          result[k] = recur(o[k]);
        }
        return result;
      }
      return o;
    })(obj);
    callback(replaced);
  });
}

// 3. Replace i:<var> with input vars, then e:<var> with workspace saved vars
// (async)
export function replaceAllRefs(
    iface: InterfaceData, defaults: Parameter[], inputs: Parameter[],
    callback: (result: any) => void) {
  const flatDefaults = defaults && defaults.length > 0 ?
      defaults.reduce((acc, cur) => ({...acc, ...cur})) :
      {};
  const flatInputs = inputs && inputs.length > 0 ?
      inputs.reduce((acc, cur) => ({...acc, ...cur})) :
      {};

  const mergedInputs = {...flatDefaults, ...flatInputs};

  console.log('Merged inputs:', mergedInputs, iface.body);

  const replacedInputs = replaceInputRefs(iface, mergedInputs);
  replaceEnvRefs(replacedInputs, callback);
}