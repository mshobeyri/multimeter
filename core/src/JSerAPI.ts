import {APIData, AuthConfig} from './APIData';
import {JSONRecord, requestFormat} from './CommonData';
import {indentLines, toInputsParams} from './JSerHelper';
import {contentTypeForFormat, formatBody} from './markupConvertor';
import {stripOmitFromRequest} from './omitKeyword';
import {DEFAULT_EXTRACTION_RULES} from './outputExtractor';
import {
  embedDynamicTokensAsJsInterpolations,
  replaceAllRefs,
  toTemplateWithEnvVars,
} from './variableReplacer';

export interface APIContext {
  api: APIData, name: string, inputs: JSONRecord, envVars: JSONRecord,
  reportOutputKeys?: string[]
}

export const apiToJSfunc = async(ctx: APIContext): Promise<string> => {
  const inputParams = toInputsParams(ctx.api.inputs || {}, ' = ');

  const paramsAsObj: Record<string, string> = Object.fromEntries(
      Object.keys(ctx.api.inputs ?? {}).map(key => [key, `\${${key}}`]));

  const userExtractRules = ctx.api.outputs && typeof ctx.api.outputs === 'object' && !Array.isArray(ctx.api.outputs)
    ? ctx.api.outputs
    : {};
  const reportOutputKeys = Array.isArray(ctx.reportOutputKeys)
    ? ctx.reportOutputKeys
    : ctx.api.outputs && typeof ctx.api.outputs === 'object' && !Array.isArray(ctx.api.outputs)
      ? Object.keys(ctx.api.outputs)
      : [];

  let replaced =
      replaceAllRefs(ctx.api, paramsAsObj, ctx.inputs, ctx.envVars ?? {});
  replaced = stripOmitFromRequest(replaced);

  const reqFormatForBody = requestFormat(replaced.format);
  // URLSearchParams percent-encodes the whole value, which would turn leftover
  // `e:VAR` / `r:` / `c:` tokens into `e%3AVAR` and hide them from later
  // template rewriting. Convert them to `${...}` first (JSON/XML keep tokens
  // readable without this).
  if (reqFormatForBody === 'urlencoded' && replaced.body != null) {
    replaced = {
      ...replaced,
      body: embedDynamicTokensAsJsInterpolations(replaced.body),
    };
  }

  let formattedBody =
      formatBody(reqFormatForBody, replaced.body || '', false);
  // Replace placeholders with JSON.stringify(var) so non-strings are not quoted
  try {
    if (typeof formattedBody === 'string') {
      const reqFormat = reqFormatForBody;
      if (reqFormat === 'urlencoded') {
        // URLSearchParams encodes `${name}` → %24%7Bname%7D, which would be
        // sent literally. Restore JS interpolations that re-encode at runtime.
        formattedBody = restoreUrlEncodedJsPlaceholders(formattedBody);
      }
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
  const isGrpc = explicitProtocol === 'grpc';

  // gRPC: generate completely different code path
  if (isGrpc && ctx.api.grpc) {
    return generateGrpcFunction(ctx, replaced, inputParams, userExtractRules, toTemplateWithEnvs, toJsValue, authCode, headers, reportOutputKeys);
  }

  // GraphQL compiles to HTTP transport
  const protocolExpr = isGraphQL ? `'graphql'` :
      (explicitProtocol ? `'${explicitProtocol}'` : `protocolFromUrl_(__resolvedUrl)`);

  // GraphQL: override method, headers, and body
  const effectiveMethod = isGraphQL ? 'post' : (replaced.method || '');
  const reqFormat = requestFormat(replaced.format);
  const isBinaryRequest = !isGraphQL && reqFormat === 'binary';
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
  } else if (reqFormat === 'urlencoded' || reqFormat === 'binary') {
    // Form and binary bodies are not detectable from shape alone (unlike JSON/XML)
    const hasContentType = Object.keys(replaced.headers || {}).some(
        k => k.toLowerCase() === 'content-type');
    if (!hasContentType) {
      replaced.headers = replaced.headers || {};
      replaced.headers['Content-Type'] = contentTypeForFormat(reqFormat);
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

  const binaryPathSource = typeof replaced.body === 'string'
      ? replaced.body.trim()
      : (replaced.body == null ? '' : String(replaced.body));
  const binaryPathExpr = toTemplateWithEnvs(binaryPathSource);
  const bodyExpr = isGraphQL && graphqlBodyExpr
      ? graphqlBodyExpr
      : isBinaryRequest
        ? '__binaryBody_'
        : toTemplateWithEnvs(formattedBody);

  const binaryLoadLines = isBinaryRequest
      ? `  const __binaryPath_ = ${binaryPathExpr};
  const __binaryBody_ = await readBinaryFile_(__binaryPath_);
`
      : '';
  const detailsRequestExpr = isBinaryRequest
      ? `{ ...req_, body: '<binary ' + __binaryBody_.length + ' bytes path=' + __binaryPath_ + '>' }`
      : 'req_';

  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const __resolvedUrl = ${toTemplateWithEnvs(String(replaced.url || ''))};
${binaryLoadLines}  const req_ = {
    url: __resolvedUrl,
    protocol: ${protocolExpr},
    method: '${effectiveMethod}',
    timeout: ${typeof replaced.timeout === 'number' ? JSON.stringify(replaced.timeout) : 'undefined'},
    query: ${queryParams ? '{ ' + queryParams + ' }' : '{}'},
    headers: ${headers ? '{ ' + headers + ' }' : '{}'},
    body: ${bodyExpr}
  };
${authCode}
  const res_ = await send_(req_);

  const __extractSource_ = {
      type: 'auto',
      body: res_?.body,
      headers: res_?.headers || {},
      cookies: res_?.cookies || {},
      status: res_?.status || 0,
      duration: res_?.duration || 0,
      details: JSON.stringify({ request: ${detailsRequestExpr}, response: res_ }, null, 2)
    };
  const __defaultOutput_ = extractOutputs_(
    __extractSource_,
    ${indentLines(indentLines(JSON.stringify(DEFAULT_EXTRACTION_RULES, null, 2)))}
  );
  const output_ = extractOutputs_(
    __extractSource_,
    ${indentLines(indentLines(JSON.stringify(userExtractRules, null, 2)))}
  );

  output_['_'] = {
    ...__defaultOutput_,
    details: JSON.stringify({ request: ${detailsRequestExpr}, response: res_ }, null, 2),
    status: res_?.status || 0,
    duration: res_?.duration || 0,
    reportOutputKeys: ${JSON.stringify(reportOutputKeys)}
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
      err.mmtApiOutputs = output_;
      throw err;
    }
  } catch (e) {
    if (e && e.graphqlErrors) { throw e; }
  }
` : ''}
  return output_;
};`;
};

/**
 * After urlencoded formatting, `${expr}` becomes `%24%7Bexpr%7D` and would be
 * sent as a literal. Turn those back into runtime interpolations that encode
 * the resolved value (same idea as the JSON `"${name}"` rewrite above).
 *
 * URLSearchParams encodes spaces as `+` (not `%20`). decodeURIComponent does
 * not treat `+` as space, so expressions like `__mmt_access(x, '[1:2]')`
 * would become `__mmt_access(x,+'[1:2]')` (unary-plus → NaN) and silently
 * drop the slice accessor. Normalize `+` → `%20` before decoding.
 */
export function restoreUrlEncodedJsPlaceholders(encodedBody: string): string {
  return String(encodedBody ?? '').replace(/%24%7B([\s\S]*?)%7D/gi, (_match, innerEnc: string) => {
    let inner: string;
    try {
      inner = decodeURIComponent(String(innerEnc || '').replace(/\+/g, '%20'));
    } catch {
      return _match;
    }
    if (!inner.trim()) {
      return _match;
    }
    return `\${encodeURIComponent(String(${inner} ?? ''))}`;
  });
}

function generateGrpcFunction(
    ctx: APIContext,
    replaced: APIData,
    inputParams: string,
    userExtractRules: Record<string, string>,
    toTpl: (s: string) => string,
    toJsValue: (v: any) => string,
    authCode: string,
    headers: string,
    reportOutputKeys: string[],
): string {
  const grpc = replaced.grpc || ctx.api.grpc!;
  const protoExpr = grpc.proto ? toTpl(grpc.proto) : `'reflect'`;
  const serviceExpr = toTpl(grpc.service);
  const methodExpr = toTpl(grpc.method);
  const streamExpr = grpc.stream ? `'${grpc.stream}'` : 'undefined';

  // Build message object
  let messageExpr = '{}';
  if (grpc.message && typeof grpc.message === 'object') {
    const msgParts = Object.entries(grpc.message)
        .map(([k, v]) => `"${k}": ${toJsValue(v)}`)
        .join(', ');
    messageExpr = `{ ${msgParts} }`;
  }

  // For gRPC, headers become metadata
  // Auth also contributes to metadata via the same authCode
  return `const ${ctx.name} = async ({ ${inputParams} } = {}) => {
  const __resolvedUrl = ${toTpl(String(replaced.url || ''))};
  const req_ = {
    url: __resolvedUrl,
    protocol: 'grpc',
    method: 'grpc',
    query: {},
    headers: ${headers ? '{ ' + headers + ' }' : '{}'},
    body: ${messageExpr}
  };
${authCode}
  const __grpcReq = {
    url: __resolvedUrl,
    proto: ${protoExpr},
    service: ${serviceExpr},
    method: ${methodExpr},
    metadata: req_.headers,
    message: ${messageExpr},
    stream: ${streamExpr}
  };
  const __grpcRes = await sendGrpc_(__grpcReq);

  // Parse gRPC response message
  let __grpcMessage = {};
  try {
    __grpcMessage = typeof __grpcRes.body === 'string' ? JSON.parse(__grpcRes.body) : __grpcRes.body;
  } catch { __grpcMessage = __grpcRes.body; }

  const __extractSource_ = {
      type: 'json',
      body: __grpcMessage,
      headers: __grpcRes.metadata || {},
      cookies: {},
      status: __grpcRes.status || 0,
      duration: __grpcRes.duration || 0,
      details: JSON.stringify({ request: __grpcReq, response: __grpcRes }, null, 2),
      message: __grpcMessage,
      metadata: __grpcRes.metadata || {}
    };
  const __defaultOutput_ = extractOutputs_(
    __extractSource_,
    ${indentLines(indentLines(JSON.stringify(DEFAULT_EXTRACTION_RULES, null, 2)))}
  );
  const output_ = extractOutputs_(
    __extractSource_,
    ${indentLines(indentLines(JSON.stringify(userExtractRules, null, 2)))}
  );

  output_['_'] = {
    ...__defaultOutput_,
    details: JSON.stringify({ request: __grpcReq, response: __grpcRes }, null, 2),
    status: __grpcRes.status || 0,
    duration: __grpcRes.duration || 0,
    reportOutputKeys: ${JSON.stringify(reportOutputKeys)}
  };

  return output_;
};`;
}

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
