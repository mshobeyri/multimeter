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

export function isNonEmptyObject(value: any): value is Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

export function isNonEmptyList(value: any): value is any[] {
  return isList(value) && value.length > 0;
}

export function toKVObject(value: any): Record<string, string> {
  return isNonEmptyList(value) ?
      value.reduce((acc, cur) => ({...acc, ...cur}), {}) :
      {};
}
export function toKVList(obj: Record<string, string>): any[] {
  return Object.entries(obj).map(([key, value]) => ({ [key]: value }));
}