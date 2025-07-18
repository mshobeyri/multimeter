import {InterfaceData} from './api/APIData';
import {Parameter} from './CommonData';
import {loadEnvVariables} from './workspaceStorage';

// 1. Replace all i:<param> with the value from inputs
export function replaceInputRefs(
    obj: any, inputs: Parameter[]|Record<string, string>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: string}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(
        /i:([a-zA-Z0-9_]+)/g,
        (_, key) =>
            inputArr.find(input => input.name === key)?.value || `i:${key}`);
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
        return o.replace(
            /e:([a-zA-Z0-9_]+)/g,
            (_, key) => envs[key] !== undefined ? envs[key] : `e:${key}`);
      } else if (Array.isArray(o)) {
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

  const replacedInputs = replaceInputRefs(iface, mergedInputs);
  replaceEnvRefs(replacedInputs, callback);
}