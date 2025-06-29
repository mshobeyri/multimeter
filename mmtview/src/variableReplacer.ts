import { loadEnvVariables } from "./workspaceStorage";

// 1. Replace all i:<param> with the value from inputs
export function replaceInputRefs(obj: any, inputs: Record<string, string>): any {
  if (typeof obj === "string") {
    return obj.replace(/i:([a-zA-Z0-9_]+)/g, (_, key) =>
      inputs[key] !== undefined ? inputs[key] : `i:${key}`
    );
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceInputRefs(item, inputs));
  } else if (obj && typeof obj === "object") {
    const result: any = {};
    for (const k in obj) {
      result[k] = replaceInputRefs(obj[k], inputs);
    }
    return result;
  }
  return obj;
}

// 2. Replace all e:<param> with the value from envs loaded from workspace storage (async)
export function replaceEnvRefs(obj: any, callback: (result: any) => void) {
  loadEnvVariables((vars) => {
    const envs: Record<string, string> = {};
    vars.forEach(({ name, value }) => {
      envs[name] = value;
    });
    const replaced = (function recur(o: any): any {
      if (typeof o === "string") {
        return o.replace(/e:([a-zA-Z0-9_]+)/g, (_, key) =>
          envs[key] !== undefined ? envs[key] : `e:${key}`
        );
      } else if (Array.isArray(o)) {
        return o.map(item => recur(item));
      } else if (o && typeof o === "object") {
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

// 3. Replace i:<var> with input vars, then e:<var> with workspace saved vars (async)
export function replaceAllRefs(obj: any, inputs: Record<string, string>, callback: (result: any) => void) {
  const replacedInputs = replaceInputRefs(obj, inputs);
  replaceEnvRefs(replacedInputs, callback);
}