import {JSONValue} from './CommonData';
import {Type} from './CommonData';
import {normalizeEnvTokens} from './variableReplacer';

export function indentLines(str: string): string {
  return str.split('\n').map(line => '  ' + line).join('\n').slice(2);
}

/**
 * Convert a string value to a template literal expression, resolving e:, r:,
 * and c: tokens to runtime references (envVariables.X, random/current tokens).
 */
function toTemplateValue(value: string): string {
  let result = value;

  // Full match patterns: if the entire string is a single token reference
  const fullEnvAngle = /^<<e:([A-Za-z_][A-Za-z0-9_]*)>>$/;
  const fullEnvPlain = /^e:([A-Za-z_][A-Za-z0-9_]*)$/;
  const fullRandAngle = /^<<r:([A-Za-z_][A-Za-z0-9_\-]*)>>$/;
  const fullRandPlain = /^r:([A-Za-z_][A-Za-z0-9_\-]*)$/;
  const fullCurrAngle = /^<<c:([A-Za-z_][A-Za-z0-9_\-]*)>>$/;
  const fullCurrPlain = /^c:([A-Za-z_][A-Za-z0-9_\-]*)$/;

  // Check for full env match first
  let m = fullEnvAngle.exec(result) || fullEnvPlain.exec(result);
  if (m && m[1]) {
    return `envVariables.${m[1]}`;
  }

  // Check for full random match - generate a runtime call
  m = fullRandAngle.exec(result) || fullRandPlain.exec(result);
  if (m && m[1]) {
    return `__mmt_random('${m[1]}')`;
  }

  // Check for full current match - generate a runtime call
  m = fullCurrAngle.exec(result) || fullCurrPlain.exec(result);
  if (m && m[1]) {
    return `__mmt_current('${m[1]}')`;
  }

  // For partial occurrences, convert to template literal with ${...}
  // Normalize all e: token forms to envVariables.VAR, then wrap in ${...}
  const normalized = normalizeEnvTokens(result);
  result = normalized.replace(
      /envVariables\.([A-Za-z_][A-Za-z0-9_]*)/g, (m, name, offset, str) => {
        if (offset >= 2 && str[offset - 2] === '$' && str[offset - 1] === '{') {
          return m;
        }
        return '${envVariables.' + name + '}';
      });
  // Handle <<r:token>> style
  result = result.replace(/<<r:([A-Za-z_][A-Za-z0-9_\-]*)>>/g, "${__mmt_random('$1')}");
  // Handle r:token style (plain)
  result = result.replace(/\br:([A-Za-z_][A-Za-z0-9_\-]*)(?![A-Za-z0-9_\-])/g, "${__mmt_random('$1')}");
  // Handle <<c:token>> style
  result = result.replace(/<<c:([A-Za-z_][A-Za-z0-9_\-]*)>>/g, "${__mmt_current('$1')}");
  // Handle c:token style (plain)
  result = result.replace(/\bc:([A-Za-z_][A-Za-z0-9_\-]*)(?![A-Za-z0-9_\-])/g, "${__mmt_current('$1')}");

  return '`' + result.replace(/`/g, '\\`') + '`';
}

export const toInputsParams =
    (inputs: Record<string, JSONValue>, operator: string) => {
      const formattedInputs =
          Object.entries(inputs ?? {})
              .map(([key, value]) => {
                let formatted: string;
                if (typeof value === 'string') {
                  formatted = toTemplateValue(value);
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
  if (content.includes('type: var')) {
    return 'var';
  }
  if (content.includes('type: env')) {
    return 'env';
  }
  if (content.includes('type: server')) {
    return 'server';
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