
import {JSONValue} from 'mmt-core/CommonData';

export const valueToString = (val: JSONValue): string => {
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
      return `"${val}"`;
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
    if (val.toLowerCase() === 'true') {
      return true;
    }
    if (val.toLowerCase() === 'false') {
      return false;
    }
    const num = Number(val);
    if (!isNaN(num) && val.trim() !== '') {
      return num;
    }
    // Try to parse JSON objects/arrays
    if ((val.startsWith('{') && val.endsWith('}')) ||
        (val.startsWith('[') && val.endsWith(']'))) {
      try {
        return JSON.parse(val);
      } catch {
        // Fall through to return as string
      }
    }
    if (val.startsWith('"') && val.endsWith('"')) {
      let trimmed = val.slice(1, -1);
      if (trimmed.toLowerCase() === 'true') {
        return 'true';
      }
      if (trimmed.toLowerCase() === 'false') {
        return 'false';
      }
      const num = Number(trimmed);
      if (!isNaN(num) && trimmed.trim() !== '') {
        return `${trimmed}`;
      }
    }
    return val;  // Return as string
  }
  return val;  // Fallback
};
