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
  const isGraphQL = explicitProtocol === 'graphql';
  // GraphQL compiles to HTTP transport
  const protocolExpr = isGraphQL ? `'graphql'` :
      (explicitProtocol ? `'${explicitProtocol}'` : `protocolFromUrl_(__resolvedUrl)`);

  // GraphQL: override method, headers, and body
  const effectiveMethod = isGraphQL ? 'post' : (replaced.method || '');
  if (isGraphQL) {
    // Ensure Content-Type is set to application/json
    const hasContentType = Object.keys(replaced.headers || {}).some(
        k => k.toLowerCase() === 'content-type');
    if (!hasContentType) {
      replaced.headers = replaced.headers || {};
      replaced.headers['Content-Type'] = 'application/json';
      headers = Object.entries(replaced.headers)
                    .map(([k, v]) => `"${k}": ${toTemplateWithEnvs(String(v))}`)
                    .join(', ');
    }
  }

  // Build GraphQL body: { query, variables, operationName }
  let graphqlBodyExpr = '';
  if (isGraphQL && ctx.api.graphql) {
    const gql = replaced.graphql || ctx.api.graphql;
    const operationStr = toTemplateWithEnvs(String(gql.operation || ''));
    const variablesEntries = Object.entries(gql.variables || {});
    let variablesExpr = '{}';
    if (variablesEntries.length > 0) {
      const varParts = variablesEntries.map(([k, v]) => `"${k}": ${toJsValue(v)}`).join(', ');
      variablesExpr = `{ ${varParts} }`;
    }
    const opNamePart = gql.operationName
        ? `, operationName: ${toTemplateWithEnvs(gql.operationName)}`
        : '';
    graphqlBodyExpr = `JSON.stringify({ query: ${operationStr}, variables: ${variablesExpr}${opNamePart} })`;
  }

  const bodyExpr = isGraphQL && graphqlBodyExpr
      ? graphqlBodyExpr
      : toTemplateWithEnvs(formattedBody);

  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const __resolvedUrl = ${toTemplateWithEnvs(String(replaced.url || ''))};
  const req_ = {
    url: __resolvedUrl,
    protocol: ${protocolExpr},
    method: '${effectiveMethod}',
    query: ${queryParams ? '{ ' + queryParams + ' }' : '{}'},
    headers: ${headers ? '{ ' + headers + ' }' : '{}'},
    body: ${bodyExpr}
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
${isGraphQL ? `
  // GraphQL error detection: if response contains errors array, mark as failed
  try {
    const __gqlBody = typeof res_?.body === 'string' ? JSON.parse(res_.body) : res_?.body;
    if (__gqlBody && Array.isArray(__gqlBody.errors) && __gqlBody.errors.length > 0) {
      const __gqlErrors = __gqlBody.errors.map(e => e.message || JSON.stringify(e)).join('; ');
      console.error('GraphQL Errors:\\n' + __gqlBody.errors.map(e => '  - ' + (e.message || JSON.stringify(e))).join('\\n'));
      const err = new Error('GraphQL errors: ' + __gqlErrors);
      err.graphqlErrors = __gqlBody.errors;
      throw err;
    }
  } catch (e) {
    if (e && e.graphqlErrors) { throw e; }
  }
` : ''}
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
