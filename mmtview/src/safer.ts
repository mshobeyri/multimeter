
import {Parameter} from './CommonData';

export function safeList(value: any): any[] {
  return value && Array.isArray(value) ? value : [];
}

export function isList(value: any): value is any[] {
  return value && Array.isArray(value);
}

export function safeListCopy(value: any): any[] {
  return value && Array.isArray(value) ? [...value] : [];
}

export function extractParameterKeys(parameters: Parameter[]): string[] {
  if (!parameters || !Array.isArray(parameters)) {
    return [];
  }

  return parameters.flatMap(param => param ? Object.keys(param) : [])
      .filter(key => key && key !== 'undefined');
}

export function isNonEmptyList(value: any): value is any[] {
  return isList(value) && value.length > 0;
}

export function toKVObject(value: any): Record<string, string> {
  return isNonEmptyList(value) ?
      value.reduce((acc, cur) => ({...acc, ...cur}), {}) :
      {};
}