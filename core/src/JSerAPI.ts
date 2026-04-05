import {APIData, AuthConfig} from './APIData';
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

  // Generate auth code that runs inside the async function body
  const authCode = authToJS(replaced.auth, toTemplateWithEnvs);

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
${authCode}
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

function authToJS(
    auth: AuthConfig | undefined,
    toTpl: (s: string) => string,
): string {
  if (!auth || auth === 'none') {
    return '';
  }
  switch (auth.type) {
    case 'bearer':
      return `  if (!req_.headers["Authorization"]) { req_.headers["Authorization"] = "Bearer " + ${toTpl(auth.token)}; }`;
    case 'basic':
      return `  if (!req_.headers["Authorization"]) { req_.headers["Authorization"] = "Basic " + btoa(${toTpl(auth.username)} + ":" + ${toTpl(auth.password)}); }`;
    case 'api-key':
      if (auth.header) {
        return `  if (!req_.headers[${JSON.stringify(auth.header)}]) { req_.headers[${JSON.stringify(auth.header)}] = ${toTpl(auth.value)}; }`;
      }
      if (auth.query) {
        return `  if (!req_.query[${JSON.stringify(auth.query)}]) { req_.query[${JSON.stringify(auth.query)}] = ${toTpl(auth.value)}; }`;
      }
      return '';
    case 'oauth2':
      return generateOAuth2JS(auth, toTpl);
    default:
      return '';
  }
}

function generateOAuth2JS(
    auth: {token_url: string; client_id: string; client_secret: string; scope?: string},
    toTpl: (s: string) => string,
): string {
  const scopePart = auth.scope
      ? `\n          scope: ${toTpl(auth.scope)},`
      : '';
  return `  if (!req_.headers["Authorization"]) {
    const _tokenResp = await send_({
      url: ${toTpl(auth.token_url)},
      method: "post",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: ${toTpl(auth.client_id)},
          client_secret: ${toTpl(auth.client_secret)},${scopePart}
      }).toString()
    });
    const _tokenData = JSON.parse(_tokenResp.body);
    req_.headers["Authorization"] = "Bearer " + _tokenData.access_token;
  }`;
}
