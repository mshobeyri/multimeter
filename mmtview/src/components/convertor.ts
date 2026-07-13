
import {JSONValue} from 'mmt-core/CommonData';
import {isOmitSentinel, OMIT_SENTINEL} from 'mmt-core/omitKeyword';

export const valueToString = (val: JSONValue | undefined): string => {
  if (val === undefined) {
    return '';
  }
  if (val === null) {
    return 'null';
  }
  if (isOmitSentinel(val)) {
    return 'omit';
  }
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
      return `"${val}"`;
    }
    if (val.toLowerCase() === 'null') {
      return '"null"';
    }
    if (val.toLowerCase() === 'omit') {
      return '"omit"';
    }
    if (val.trim() !== '' && !isNaN(Number(val))) {
      return `"${val}"`;
    }
    return val;
  }
  if (typeof val === 'boolean') {
    return val.toString();
  }
  if (typeof val === 'number') {
    return val.toString();
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
};

export const stringToValue = (val: string): JSONValue => {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'string') {
    const t = val.trim();

    if ((t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith('\'') && t.endsWith('\''))) {
      return t.slice(1, -1);
    }

    if (t === 'omit') {
      return OMIT_SENTINEL;
    }
    if (t === 'null') {
      return null;
    }
    if (t.toLowerCase() === 'true') {
      return true;
    }
    if (t.toLowerCase() === 'false') {
      return false;
    }
    const num = Number(t);
    if (!isNaN(num) && t !== '') {
      return num;
    }
    if ((t.startsWith('{') && t.endsWith('}')) ||
        (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return JSON.parse(t);
      } catch {
        // Fall through to return as string
      }
    }
    return val;
  }
  return val;
};
