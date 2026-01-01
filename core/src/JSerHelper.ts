import {JSONValue} from './CommonData';
import {Type} from './CommonData';

export function indentLines(str: string): string {
  return str.split('\n').map(line => '  ' + line).join('\n').slice(2);
}

export const toInputsParams =
    (inputs: Record<string, JSONValue>, operator: string) => {
      const formattedInputs =
          Object.entries(inputs ?? {})
              .map(
                  ([key, value]) => `${key}${operator}${
                      typeof value === 'string'     ? '`' + value + '`' :
                          typeof value === 'object' ? JSON.stringify(value) :
                                                      value}`)
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
  if (content.includes('type: var')) {
    return 'var';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  return null;
};

// Convert a string to lowercase and replace spaces with underscores
export function toLowerUnderscore(input: string): string {
  if (input === undefined || input === null) {
    return '';
  }
  return String(input).replace(/ /g, '_').toLowerCase();
}