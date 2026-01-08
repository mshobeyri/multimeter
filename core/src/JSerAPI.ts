import {APIData} from './APIData';
import {JSONRecord} from './CommonData';
import {indentLines, toInputsParams} from './JSerHelper';
import {formatBody} from './markupConvertor';
import {replaceAllRefs} from './variableReplacer';

export interface APIContext {
  api: APIData, name: string, inputs: JSONRecord, envVars: JSONRecord
}

export const apiToJSfunc = async(ctx: APIContext): Promise<string> => {
  const inputParams = toInputsParams(ctx.api.inputs || {}, ' = ');

  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.api.inputs ?? {}).map(key => [key, `\${${key}}`]));

  const extractRules = ctx.api.outputs || ctx.api.outputs || {};

  let replaced =
      replaceAllRefs(ctx.api, paramsAsObj, ctx.inputs, ctx.envVars ?? {});

  let formattedBody =
      formatBody(replaced.format || 'json', replaced.body || '', false);
  // Replace placeholders with JSON.stringify(var) so non-strings are not quoted
  try {
    if (typeof formattedBody === 'string') {
      const entries = Object.entries(ctx.api.inputs ?? {});
      for (const [name, value] of entries) {
        // Replace "${name}" -> ${JSON.stringify(name)}
        const quoted = new RegExp(`\"\\$\\{${name}\\}\"`, 'g');
        if (typeof value === 'string') {
          formattedBody =
              (formattedBody as string).replace(quoted, '"${' + name + '}"');
        } else {
          formattedBody =
              (formattedBody as string).replace(quoted, '${' + name + '}');
        }
      }
    }
  } catch {
  }

  // Helpers to build template literals with env variable slots safely
  const escapeBackticks = (s: string) => String(s ?? '').replace(/`/g, '\\`');
  const toTemplateWithEnvs = (s: string) => {
    const src = String(s ?? '');
    // Normalize env tokens to envVariables.NAME first
    let withEnv =
        src.replace(/<<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>>/g, 'envVariables.$1')
            .replace(/<\s*e:([A-Za-z_][A-Za-z0-9_]*)\s*>/g, 'envVariables.$1')
            .replace(/\be:\{([A-Za-z_][A-Za-z0-9_]*)\}/g, 'envVariables.$1')
            .replace(
                /\be:([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_])/g,
                'envVariables.$1');
    // Inject ${envVariables.NAME}, avoiding double-wrapping
    withEnv = withEnv.replace(
        /envVariables\.([A-Za-z_][A-Za-z0-9_]*)/g, (m, name, offset, str) => {
          if (offset >= 2 && str[offset - 2] === '$' &&
              str[offset - 1] === '{') {
            return m;  // already ${envVariables.name}
          }
          return '${envVariables.' + name + '}';
        });
    // Collapse nested patterns if any
    withEnv = withEnv.replace(
        /\$\{\s*\$\{\s*envVariables\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\s*\}/g,
        '${envVariables.$1}');
    return '`' + escapeBackticks(withEnv) + '`';
  };

  if (replaced.cookies && Object.keys(replaced.cookies).length > 0) {
    let cookies = Object.entries(replaced.cookies || {})
                      .map(([k, v]) => `${k}=${v}`)
                      .join('; ');
    replaced.headers = replaced.headers || {};
    replaced.headers['Cookie'] = cookies;
  }

  let headers = Object.entries(replaced.headers || {})
                    .map(([k, v]) => `"${k}": ${toTemplateWithEnvs(String(v))}`)
                    .join(', ');

  const toJsValue = (value: any): string => {
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'string') {
      return toTemplateWithEnvs(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(value);
    }
    if (value === null) {
      return 'null';
    }
    return JSON.stringify(value);
  };

  const queryParams = Object.entries(replaced.query || {})
                          .filter(([, v]) => v !== undefined)
                          .map(([k, v]) => `"${k}": ${toJsValue(v)}`)
                          .join(', ');

  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const req_ = {
    url: ${toTemplateWithEnvs(String(replaced.url || ''))},
    protocol: '${ctx.api.protocol}',
    method: '${replaced.method}',
    query: ${queryParams ? '{ ' + queryParams + ' }' : '{}'},
    headers: ${headers ? '{ ' + headers + ' }' : '{}'},
    body: ${toTemplateWithEnvs(formattedBody)}
  };

  const res_ = await send_(req_);

  const output_ = extractOutputs_(
    {
      type: 'auto',
      body: res_?.body,
      headers: res_?.headers || {},
      cookies: res_?.cookies || {}
    },
    ${indentLines(indentLines(JSON.stringify(extractRules, null, 2)))}
  );

  output_.statusCode_ = res_?.status || 0;
  output_.details_ = JSON.stringify({
    request: req_,
    response: res_
  }, null, 2);
  return output_;
};`;
};
