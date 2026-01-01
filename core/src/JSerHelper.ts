import {JSONValue} from './CommonData';

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