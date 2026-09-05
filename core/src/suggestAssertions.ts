import {ExpectMap} from './TestData';
import {JSONValue} from './CommonData';

export type SuggestAssertionsStyle = 'expect' | 'assert' | 'both';

export interface SuggestAssertionsInput {
  /** Call/http step id used in ${id.field} assert expressions. */
  stepId?: string;
  /** HTTP status to expect (default 200 when omitted but body/outputs present). */
  status?: number;
  /** API outputs map: name → extractor (used for != null expects). */
  outputs?: Record<string, string>;
  /** Parsed response body (JSON object/array/scalar). */
  body?: JSONValue;
  style?: SuggestAssertionsStyle;
  /** Cap fields suggested from body walk (default 12). */
  maxFields?: number;
}

export interface SuggestAssertionsResult {
  stepId: string;
  expect: ExpectMap;
  assertLines: string[];
  /** Ready-to-paste YAML fragment for a call step's expect: block. */
  expectYaml: string;
  /** Ready-to-paste assert steps. */
  assertYaml: string;
  /** Combined patch hint for agents. */
  patchHint: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function quoteYamlScalar(value: string | number | boolean): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === '') {
    return '""';
  }
  if (/^[=!<>]/.test(value) || /[:#{}[\],&*?|>!%@`]/.test(value) ||
      /\s/.test(value) || value === 'null' || value === 'true' ||
      value === 'false') {
    return JSON.stringify(value);
  }
  return value;
}

function formatExpectValue(value: string | number | boolean): string {
  if (typeof value === 'string' &&
      (/^!= /.test(value) || /^[=<>]/.test(value) || value === 'omit')) {
    return value;
  }
  return quoteYamlScalar(value);
}

function collectBodyExpects(
    body: JSONValue, maxFields: number): Array<{key: string; value: string | number | boolean}> {
  const out: Array<{key: string; value: string | number | boolean}> = [];

  const push = (key: string, value: string | number | boolean) => {
    if (out.length >= maxFields) {
      return;
    }
    out.push({key, value});
  };

  const walk = (node: JSONValue, prefix: string, depth: number) => {
    if (out.length >= maxFields || depth > 2) {
      return;
    }
    if (node === null || node === undefined) {
      if (prefix) {
        push(prefix, '== null');
      }
      return;
    }
    if (typeof node === 'string') {
      if (prefix) {
        if (node.length <= 64) {
          push(prefix, node);
        } else {
          push(prefix, '!= null');
        }
      }
      return;
    }
    if (typeof node === 'number' || typeof node === 'boolean') {
      if (prefix) {
        push(prefix, node);
      }
      return;
    }
    if (Array.isArray(node)) {
      if (prefix) {
        push(prefix, '!= null');
      }
      return;
    }
    if (isPlainObject(node)) {
      const keys = Object.keys(node);
      if (prefix && keys.length === 0) {
        push(prefix, '!= null');
        return;
      }
      for (const key of keys) {
        if (out.length >= maxFields) {
          break;
        }
        const next = prefix ? `${prefix}.${key}` : `body.${key}`;
        const child = node[key] as JSONValue;
        if (isPlainObject(child) || Array.isArray(child)) {
          if (depth >= 2) {
            push(next, '!= null');
          } else {
            walk(child, next, depth + 1);
          }
        } else {
          walk(child, next, depth + 1);
        }
      }
    }
  };

  walk(body, '', 0);
  return out;
}

function buildExpectYaml(expect: ExpectMap): string {
  const lines = ['    expect:'];
  for (const [key, value] of Object.entries(expect)) {
    if (Array.isArray(value)) {
      lines.push(`      ${key}:`);
      for (const item of value) {
        lines.push(`        - ${formatExpectValue(item as any)}`);
      }
      continue;
    }
    lines.push(`      ${key}: ${formatExpectValue(value as any)}`);
  }
  return lines.join('\n');
}

function buildAssertYaml(lines: string[]): string {
  return lines.map(line => `- assert: ${line}`).join('\n');
}

/**
 * Suggest compact expect/assert patches from API outputs and/or a response body.
 * Designed for AI agents: small YAML patches, not full file rewrites.
 */
export function suggestAssertions(input: SuggestAssertionsInput): SuggestAssertionsResult {
  const stepId = (input.stepId || 'step').trim() || 'step';
  const style = input.style || 'both';
  const maxFields = input.maxFields && input.maxFields > 0 ? input.maxFields : 12;
  const expect: ExpectMap = {};

  const status = input.status ??
      ((input.body !== undefined || (input.outputs && Object.keys(input.outputs).length > 0)) ?
           200 :
           undefined);
  if (typeof status === 'number') {
    expect.status = status;
  }

  for (const key of Object.keys(input.outputs || {})) {
    expect[key] = '!= null';
  }

  if (input.body !== undefined) {
    for (const entry of collectBodyExpects(input.body, maxFields)) {
      if (expect[entry.key] === undefined) {
        expect[entry.key] = entry.value as any;
      }
    }
  }

  const assertLines: string[] = [];
  if (typeof expect.status === 'number') {
    assertLines.push(`\${${stepId}.status} == ${expect.status}`);
  }
  for (const [key, value] of Object.entries(expect)) {
    if (key === 'status') {
      continue;
    }
    if (typeof value === 'string' && value.startsWith('!=')) {
      assertLines.push(`\${${stepId}.${key}} ${value}`);
    } else if (typeof value === 'string' && value.startsWith('==')) {
      assertLines.push(`\${${stepId}.${key}} ${value}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      assertLines.push(`\${${stepId}.${key}} == ${value}`);
    } else if (typeof value === 'string') {
      assertLines.push(`\${${stepId}.${key}} == ${JSON.stringify(value)}`);
    } else {
      assertLines.push(`\${${stepId}.${key}} != null`);
    }
  }

  const expectYaml = Object.keys(expect).length > 0 ? buildExpectYaml(expect) : '';
  const assertYaml = assertLines.length > 0 ? buildAssertYaml(assertLines) : '';
  const parts: string[] = [];
  if ((style === 'expect' || style === 'both') && expectYaml) {
    parts.push('Patch call step expect:\n' + expectYaml);
  }
  if ((style === 'assert' || style === 'both') && assertYaml) {
    parts.push('Or add assert steps:\n' + assertYaml);
  }
  const patchHint = parts.join('\n\n') ||
      'No assertions suggested — provide outputs and/or a JSON body.';

  return {
    stepId,
    expect: style === 'assert' ? {} : expect,
    assertLines: style === 'expect' ? [] : assertLines,
    expectYaml: style === 'assert' ? '' : expectYaml,
    assertYaml: style === 'expect' ? '' : assertYaml,
    patchHint,
  };
}
