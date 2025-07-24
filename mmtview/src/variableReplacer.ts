import {InterfaceData} from './api/APIData';
import {loadEnvVariables} from './workspaceStorage';

// 1. Replace all i:<param> with the value from inputs


export type Parameter = {
  [key: string]: string|number|boolean
};

export function replaceInputRefsWithBrace(
    obj: any, inputs: Parameter[]|Record<string, string|number|boolean>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: any}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(/<i:([a-zA-Z0-9_]+)>/g, (_, key) => {
      const found = inputArr.find(input => input.name === key);
      if (found === undefined) {
        return `i:${key}`;
      }
      if (typeof found.value === 'string') {
        return found.value;
      }
      if (typeof found.value === 'number' || typeof found.value === 'boolean') {
        return String(found.value);
      }
      return found.value;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceInputRefsWithBrace(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceInputRefsWithBrace(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}

export function replaceInputRefsWithQuotes(
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
    return obj.map(item => replaceInputRefsWithQuotes(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceInputRefsWithQuotes(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}


export function replaceInputRefsWithNone(
    obj: any, inputs: Parameter[]|Record<string, string|number|boolean>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: any}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(/i:([a-zA-Z0-9_]+)/g, (_, key) => {
      const found = inputArr.find(input => input.name === key);
      if (found === undefined) {
        return `i:${key}`;
      }
      if (typeof found.value === 'string') {
        return `${found.value}`;
      }
      if (typeof found.value === 'number' || typeof found.value === 'boolean') {
        return found.value;
      }
      return found.value;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceInputRefsWithNone(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceInputRefsWithNone(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}


export function replaceEnvRefsWithBrace(
    obj: any, inputs: Parameter[]|Record<string, string|number|boolean>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: any}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(/<e:([a-zA-Z0-9_]+)>/g, (_, key) => {
      const found = inputArr.find(input => input.name === key);
      if (found === undefined) {
        return `e:${key}`;
      }
      if (typeof found.value === 'string') {
        return found.value;
      }
      if (typeof found.value === 'number' || typeof found.value === 'boolean') {
        return String(found.value);
      }
      return found.value;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceEnvRefsWithBrace(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceEnvRefsWithBrace(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}

export function replaceEnvRefsWithQuotes(
    obj: any, inputs: Parameter[]|Record<string, string|number|boolean>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: any}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(/"e:([a-zA-Z0-9_]+)"/g, (_, key) => {
      const found = inputArr.find(input => input.name === key);
      if (found === undefined) {
        return `"e:${key}"`;
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
    return obj.map(item => replaceEnvRefsWithQuotes(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceEnvRefsWithQuotes(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}


export function replaceEnvRefsWithNone(
    obj: any, inputs: Parameter[]|Record<string, string|number|boolean>): any {
  // Convert inputs to array if it's an object
  let inputArr: Array<{name: string; value: any}> = [];
  if (Array.isArray(inputs)) {
    inputArr = inputs as any;
  } else if (inputs && typeof inputs === 'object') {
    inputArr = Object.entries(inputs).map(([name, value]) => ({name, value}));
  }

  if (typeof obj === 'string') {
    return obj.replace(/e:([a-zA-Z0-9_]+)/g, (_, key) => {
      const found = inputArr.find(input => input.name === key);
      if (found === undefined) {
        return `e:${key}`;
      }
      if (typeof found.value === 'string') {
        return `${found.value}`;
      }
      if (typeof found.value === 'number' || typeof found.value === 'boolean') {
        return found.value;
      }
      return found.value;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceEnvRefsWithNone(item, inputArr));
  } else if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceEnvRefsWithNone(obj[k], inputArr);
    }
    return result;
  }
  return obj;
}

export function replaceEnvRefs(
    obj: InterfaceData, callback: (result: any) => void) {
  loadEnvVariables((vars) => {
    const envs: Record<string, string|number|boolean> = {};
    vars.forEach(({name, value}) => {
      envs[name] = value;
    });
    console.log('Loaded environment variables:', envs);
    let replaced = replaceEnvRefsWithBrace(obj, envs);
    replaced = replaceEnvRefsWithQuotes(replaced, envs);
    replaced = replaceEnvRefsWithNone(replaced, envs);
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

  console.log('Merged inputs:', mergedInputs);
  

  let replacedIface = iface;
  replacedIface = replaceInputRefsWithBrace(replacedIface, mergedInputs);
  replacedIface = replaceInputRefsWithQuotes(replacedIface, mergedInputs);
  replacedIface = replaceInputRefsWithNone(replacedIface, mergedInputs);
  replaceEnvRefs(replacedIface, callback);
}