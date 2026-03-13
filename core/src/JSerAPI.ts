import {APIData} from './APIData';
import {JSONRecord} from './CommonData';
import {indentLines, toInputsParams} from './JSerHelper';
import {formatBody} from './markupConvertor';
import {replaceAllRefs, toTemplateWithEnvVars} from './variableReplacer';

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

  const toTemplateWithEnvs = toTemplateWithEnvVars;

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

  // Generate protocol resolution: use explicit protocol if provided,
  // otherwise infer from the resolved URL at runtime
  const explicitProtocol = ctx.api.protocol;
  const protocolExpr = explicitProtocol ?
      `'${explicitProtocol}'` :
      `protocolFromUrl_(__resolvedUrl)`;

  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const __resolvedUrl = ${toTemplateWithEnvs(String(replaced.url || ''))};
  const req_ = {
    url: __resolvedUrl,
    protocol: ${protocolExpr},
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
      cookies: res_?.cookies || {},
      status: res_?.status || 0,
      duration: res_?.duration || 0,
      details: JSON.stringify({ request: req_, response: res_ }, null, 2)
    },
    ${indentLines(indentLines(JSON.stringify(extractRules, null, 2)))}
  );

  output_['_'] = {
    details: JSON.stringify({ request: req_, response: res_ }, null, 2),
    status: res_?.status || 0,
    duration: res_?.duration || 0
  };

  return output_;
};`;
};
