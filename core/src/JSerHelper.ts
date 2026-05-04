import {JSONValue} from './CommonData';
import {Type} from './CommonData';
import {toTemplateValueJs} from './variableReplacer';

export function indentLines(str: string): string {
  return str.split('\n').map(line => '  ' + line).join('\n').slice(2);
}

export const toInputsParams =
    (inputs: Record<string, JSONValue>, operator: string) => {
      const formattedInputs =
          Object.entries(inputs ?? {})
              .map(([key, value]) => {
                let formatted: string;
                if (typeof value === 'string') {
                  formatted = toTemplateValueJs(value);
                } else if (typeof value === 'object') {
                  formatted = JSON.stringify(value);
                } else {
                  formatted = String(value);
                }
                return `${key}${operator}${formatted}`;
              })
              .join(', ');
      return formattedInputs;
    };

export const fileType = (path: string, content: string): Type => {
  if (path.endsWith('.csv')) {
    return 'csv';
  }

  if (!path.endsWith('.mmt')) {
    return null;
  }

  if (content.includes('type: api')) {
    return 'api';
  }
  if (content.includes('type: test')) {
    return 'test';
  }
  if (content.includes('type: suite')) {
    return 'suite';
  }
  if (content.includes('type: loadtest')) {
    return 'loadtest';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  if (content.includes('type: server')) {
    return 'server';
  }
  if (content.includes('type: report')) {
    return 'report';
  }
  return null;
};

/**
 * Convert a numeric value with a time unit suffix to milliseconds.
 * Supported units: ns, ms, s, m, h. Defaults to ms if no unit provided.
 */
export function timeUnitToMs(value: number, unit: string): number {
  switch (unit) {
    case 'ns': return value / 1e6;
    case 'ms': return value;
    case 's':  return value * 1000;
    case 'm':  return value * 60 * 1000;
    case 'h':  return value * 60 * 60 * 1000;
    default:   return value;
  }
}

/**
 * Normalize a token name: split camelCase, replace hyphens/spaces with
 * underscores, and lowercase everything.
 * e.g. "firstName" → "first_name", "my-token" → "my_token"
 */
export function normalizeTokenName(name: string): string {
  return name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
}

// Convert a string to lowercase and replace spaces with underscores
export function toLowerUnderscore(input: string): string {
  if (input === undefined || input === null) {
    return '';
  }
  return String(input).replace(/ /g, '_').toLowerCase();
}