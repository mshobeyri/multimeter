/**
 * Export Multimeter `.mmt` (api / test / suite / env) → Postman Collection v2.1
 * or Postman environment JSON. Exit-grade: valid files over complete fidelity.
 */
import {APIData, AuthConfig} from '../data/APIData';
import {requestFormat} from '../data/CommonData';
import {EnvData, EnvPresetGroup, EnvVariableValue} from '../data/EnvData';
import {ExpectMap, ExpectValue, splitCheckOperatorPrefix, TestData, TestFlowStep} from '../data/TestData';
import {fileType} from '../jser/JSerHelper';
import {yamlToAPI} from '../parse/apiParsePack';
import {yamlToEnv} from '../parse/envParsePack';
import {getTestFlowStepType, yamlToTest} from '../parse/testParsePack';
import {yamlToSuite} from '../parse/suiteParsePack';
import {resolveRelativeTo, basename as pathBasename} from '../runner/runCommon';
import {buildSuiteHierarchyFromSuiteFile} from '../suite/suiteHierarchy';
import type {SuiteHierarchyNode} from '../data/SuiteData';
import {lookupPostmanDynamicName} from './postmanConvertor';
import {parseExpectValue} from '../jser/JSerTestFlow';

const POSTMAN_COLLECTION_SCHEMA =
    'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

export type PostmanExportKind = 'collection' | 'environment';
export type PostmanSourceType = 'api' | 'test' | 'suite' | 'env';

export interface ConvertedPostmanFile {
  path: string;
  kind: PostmanExportKind;
  content: string;
  warnings?: string[];
}

export interface ConvertToPostmanOptions {
  sourcePath?: string;
  /** Required for test/suite import resolution. Unused for api/env-only. */
  fileLoader?: (path: string) => Promise<string> | string;
  projectRoot?: string;
}

export interface ConvertToPostmanResult {
  sourceType: PostmanSourceType;
  title?: string;
  files: ConvertedPostmanFile[];
  warnings: string[];
}

type PostmanHeader = {key: string; value: string; type?: string};
type PostmanQuery = {key: string; value: string; disabled?: boolean};
type PostmanUrl = {
  raw: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQuery[];
  variable?: Array<{key: string; value: string}>;
};
type PostmanEvent = {
  listen: 'test' | 'prerequest';
  script: {type: 'text/javascript'; exec: string[]};
};
type PostmanRequest = {
  method?: string;
  header?: PostmanHeader[];
  url?: string | PostmanUrl;
  body?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  description?: string;
};
type PostmanItem = {
  name: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
  event?: PostmanEvent[];
  description?: string;
};

type WarningSink = {warnings: string[]};

function pushWarn(sink: WarningSink, message: string): void {
  if (!sink.warnings.includes(message)) {
    sink.warnings.push(message);
  }
}

function slugify(value: string): string {
  const s = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return s || 'export';
}

function titleFromPath(sourcePath?: string): string {
  if (!sourcePath) {
    return 'Multimeter export';
  }
  const base = pathBasename(sourcePath).replace(/\.mmt$/i, '');
  return base || 'Multimeter export';
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

/** Reverse of Postman→MMT random map: `uuid` → `$guid`, etc. Prefer $guid over $randomUUID. */
const MMT_RANDOM_TO_POSTMAN: Record<string, string> = (() => {
  const preferred: Record<string, string> = {
    uuid: '$guid',
    epoch: '$timestamp',
    int: '$randomInt',
    float: '$randomFloat',
    bool: '$randomBoolean',
    alphanumeric: '$randomAlphaNumeric',
    color: '$randomColor',
    hex_color: '$randomHexColor',
    email: '$randomEmail',
    username: '$randomUserName',
    password: '$randomPassword',
    domain: '$randomDomainName',
    url: '$randomUrl',
    ip: '$randomIP',
    ipv6: '$randomIPv6',
    mac: '$randomMACAddress',
    user_agent: '$randomUserAgent',
    phone: '$randomPhoneNumber',
    first_name: '$randomFirstName',
    last_name: '$randomLastName',
    full_name: '$randomFullName',
    company: '$randomCompanyName',
    job_title: '$randomJobTitle',
    postal_code: '$randomZipCode',
    street_address: '$randomStreetAddress',
    city: '$randomCity',
    country: '$randomCountry',
    latitude: '$randomLatitude',
    longitude: '$randomLongitude',
    weekday: '$randomWeekday',
    month: '$randomMonth',
    date_future: '$randomDateFuture',
    date_past: '$randomDatePast',
    word: '$randomLoremWord',
    sentence: '$randomLoremSentence',
    paragraph: '$randomLoremParagraph',
    string: '$randomFileName',
  };
  // Validate preferred names still match import map where possible.
  for (const [mmt, postman] of Object.entries(preferred)) {
    const back = lookupPostmanDynamicName(postman);
    if (back && back !== mmt) {
      // keep preferred; import map may alias
    }
  }
  return preferred;
})();

/** Dotted paths: allow hyphens (headers.content-type) and numeric segments (body.items.0.id). */
const PATH_SEGMENT_RE = '(?:[A-Za-z_][A-Za-z0-9_-]*|\\d+)';
const SIMPLE_PATH_RE = new RegExp(
    `^(body|headers|header|status|statusCode|status_code)(\\.${PATH_SEGMENT_RE})*$`);
const BARE_DOT_PATH_RE = new RegExp(`^[A-Za-z_][A-Za-z0-9_-]*(?:\\.${PATH_SEGMENT_RE})*$`);
const TOKEN_WHOLE_RE = /^(e|i|r|o|c):([A-Za-z_][\w.-]*)$/;
const EMBEDDED_TOKEN_RE = /<<\s*([eirc]):([A-Za-z_][\w.-]*)\s*>>/g;
const BARE_TOKEN_RE = /\b([eirc]):([A-Za-z_][\w.-]*)\b/g;

export function translateMmtTokenToPostman(input: string, sink?: WarningSink): string {
  if (typeof input !== 'string' || !input) {
    return input;
  }
  const whole = TOKEN_WHOLE_RE.exec(input.trim());
  if (whole) {
    return tokenToMustache(whole[1], whole[2], sink);
  }
  let out = input.replace(EMBEDDED_TOKEN_RE, (_m, prefix: string, name: string) => {
    return tokenToMustache(prefix, name, sink);
  });
  out = out.replace(BARE_TOKEN_RE, (m, prefix: string, name: string) => {
    // Avoid rewriting inside already-replaced {{…}} — BARE after EMBEDDED is fine.
    if (m.includes('{{')) {
      return m;
    }
    return tokenToMustache(prefix, name, sink);
  });
  return out;
}

function tokenToMustache(prefix: string, name: string, sink?: WarningSink): string {
  if (prefix === 'r') {
    const postman = MMT_RANDOM_TO_POSTMAN[name];
    if (postman) {
      return `{{${postman}}}`;
    }
    pushWarn(sink || {warnings: []}, `Unsupported random token r:${name} left as {{${name}}}`);
    return `{{${name}}}`;
  }
  if (prefix === 'c') {
    pushWarn(sink || {warnings: []}, `Current token c:${name} exported as {{${name}}} — verify in Postman`);
    return `{{${name}}}`;
  }
  // e: / i: / o: → {{name}} (o: usually rewritten via setenv; keep usable)
  const base = name.split('.')[0];
  if (name.includes('[') || name.includes(':') && name.indexOf(':') > 0) {
    pushWarn(sink || {warnings: []}, `Complex token ${prefix}:${name} simplified to {{${base}}}`);
  }
  return `{{${name.includes('.') ? name : base}}}`;
}

function translateDeep(value: unknown, sink: WarningSink, inputs?: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return translateStringWithInputs(value, sink, inputs);
  }
  if (Array.isArray(value)) {
    return value.map((v) => translateDeep(v, sink, inputs));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = translateDeep(v, sink, inputs);
    }
    return out;
  }
  return value;
}

function translateStringWithInputs(
    value: string, sink: WarningSink, inputs?: Record<string, unknown>): string {
  const trimmed = value.trim();
  const whole = TOKEN_WHOLE_RE.exec(trimmed);
  if (whole && whole[1] === 'i' && inputs && Object.prototype.hasOwnProperty.call(inputs, whole[2])) {
    const resolved = inputs[whole[2]];
    if (resolved === undefined || resolved === null) {
      return '';
    }
    if (typeof resolved === 'string') {
      return translateMmtTokenToPostman(resolved, sink);
    }
    return String(resolved);
  }
  if (whole && whole[1] === 'i') {
    return `{{${whole[2]}}}`;
  }
  let out = translateMmtTokenToPostman(value, sink);
  if (inputs) {
    for (const [key, raw] of Object.entries(inputs)) {
      const repl = raw === undefined || raw === null ? '' :
          (typeof raw === 'string' ? translateMmtTokenToPostman(raw, sink) : String(raw));
      out = out.split(`{{${key}}}`).join(repl);
    }
  }
  return out;
}

function buildUrl(rawUrl: string, query?: Record<string, string>, sink?: WarningSink): PostmanUrl {
  const translated = translateMmtTokenToPostman(String(rawUrl || ''), sink);
  const queryEntries: PostmanQuery[] = [];
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      queryEntries.push({
        key,
        value: translateMmtTokenToPostman(String(value ?? ''), sink),
      });
    }
  }

  // Avoid URL() when mustache / incomplete hosts are present.
  const hasMustache = translated.includes('{{');
  let protocol: string | undefined;
  let host: string[] | undefined;
  let pathParts: string[] | undefined;
  let raw = translated;

  const protoMatch = /^(https?|wss?):\/\//i.exec(translated);
  if (protoMatch && !hasMustache) {
    try {
      const u = new URL(translated);
      protocol = u.protocol.replace(':', '');
      host = u.hostname.split('.').filter(Boolean);
      pathParts = u.pathname.replace(/^\//, '').split('/').filter((p) => p.length > 0);
      if (u.searchParams && queryEntries.length === 0) {
        u.searchParams.forEach((v, k) => {
          queryEntries.push({key: k, value: v});
        });
      }
      if (queryEntries.length > 0) {
        const q = queryEntries.map((e) => `${encodeURIComponent(e.key)}=${e.value}`).join('&');
        raw = `${u.origin}${u.pathname}${q ? `?${q}` : ''}`;
        // Keep mustache unencoded if somehow present
        raw = raw.replace(/%7B%7B/g, '{{').replace(/%7D%7D/g, '}}');
      } else {
        raw = u.toString();
      }
    } catch {
      // fall through
    }
  } else if (protoMatch) {
    protocol = protoMatch[1].toLowerCase();
    const rest = translated.slice(protoMatch[0].length);
    const slash = rest.indexOf('/');
    const hostPart = slash >= 0 ? rest.slice(0, slash) : rest.split('?')[0];
    const pathAndQuery = slash >= 0 ? rest.slice(slash) : '';
    host = hostPart.split('.').filter(Boolean);
    const pathOnly = pathAndQuery.split('?')[0];
    pathParts = pathOnly.replace(/^\//, '').split('/').filter((p) => p.length > 0);
    if (queryEntries.length > 0) {
      const q = queryEntries.map((e) => `${e.key}=${e.value}`).join('&');
      raw = `${translated.split('?')[0]}?${q}`;
    }
  }

  const url: PostmanUrl = {raw};
  if (protocol) {
    url.protocol = protocol;
  }
  if (host && host.length) {
    url.host = host;
  }
  if (pathParts && pathParts.length) {
    url.path = pathParts;
  }
  if (queryEntries.length) {
    url.query = queryEntries;
  }
  return url;
}

function mapAuth(auth: AuthConfig | undefined, sink: WarningSink): Record<string, unknown> | undefined {
  if (!auth || auth === 'none') {
    return undefined;
  }
  if (auth.type === 'bearer') {
    return {
      type: 'bearer',
      bearer: [{key: 'token', value: translateMmtTokenToPostman(auth.token, sink), type: 'string'}],
    };
  }
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      basic: [
        {key: 'username', value: translateMmtTokenToPostman(auth.username, sink), type: 'string'},
        {key: 'password', value: translateMmtTokenToPostman(auth.password, sink), type: 'string'},
      ],
    };
  }
  if (auth.type === 'api-key') {
    const location = auth.query ? 'query' : 'header';
    const keyName = auth.query || auth.header || 'X-Api-Key';
    return {
      type: 'apikey',
      apikey: [
        {key: 'key', value: keyName, type: 'string'},
        {key: 'value', value: translateMmtTokenToPostman(auth.value, sink), type: 'string'},
        {key: 'in', value: location, type: 'string'},
      ],
    };
  }
  if (auth.type === 'oauth2') {
    pushWarn(sink, 'OAuth2 auth exported as bearer placeholder — configure grant in Postman');
    return {
      type: 'oauth2',
      oauth2: [
        {key: 'grant_type', value: 'client_credentials', type: 'string'},
        {key: 'accessTokenUrl', value: translateMmtTokenToPostman(auth.token_url, sink), type: 'string'},
        {key: 'clientId', value: translateMmtTokenToPostman(auth.client_id, sink), type: 'string'},
        {key: 'clientSecret', value: translateMmtTokenToPostman(auth.client_secret, sink), type: 'string'},
        ...(auth.scope ?
            [{key: 'scope', value: translateMmtTokenToPostman(auth.scope, sink), type: 'string'}] :
            []),
      ],
    };
  }
  return undefined;
}

function formFieldValue(value: unknown, sink: WarningSink, inputs?: Record<string, unknown>): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return translateStringWithInputs(value, sink, inputs);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(translateDeep(value, sink, inputs));
}

function mapUrlencodedBody(
    body: unknown, sink: WarningSink, inputs?: Record<string, unknown>): Record<string, unknown> {
  const entries: Array<{key: string; value: string}> = [];
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      entries.push({key, value: formFieldValue(value, sink, inputs)});
    }
  } else if (Array.isArray(body)) {
    for (const part of body) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      const row = part as Record<string, unknown>;
      const key = String(row.name ?? row.key ?? '');
      if (!key) {
        continue;
      }
      entries.push({key, value: formFieldValue(row.value, sink, inputs)});
    }
  } else if (typeof body === 'string') {
    pushWarn(sink, 'urlencoded body was a string — exported as raw text');
    return {
      mode: 'raw',
      raw: translateStringWithInputs(body, sink, inputs),
      options: {raw: {language: 'text'}},
    };
  }
  return {mode: 'urlencoded', urlencoded: entries};
}

function mapMultipartBody(
    body: unknown, sink: WarningSink, inputs?: Record<string, unknown>): Record<string, unknown> {
  const formdata: Array<Record<string, unknown>> = [];
  if (Array.isArray(body)) {
    for (const part of body) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      const row = part as Record<string, unknown>;
      const key = String(row.name ?? row.key ?? '');
      if (!key) {
        continue;
      }
      if (typeof row.file === 'string' && row.file) {
        formdata.push({
          key,
          type: 'file',
          src: translateStringWithInputs(row.file, sink, inputs),
        });
        pushWarn(
            sink,
            `multipart file part "${key}" references ${row.file} — re-attach the file in Postman if the path does not resolve`);
      } else {
        formdata.push({
          key,
          type: 'text',
          value: formFieldValue(row.value, sink, inputs),
        });
      }
    }
  } else if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      formdata.push({key, type: 'text', value: formFieldValue(value, sink, inputs)});
    }
  } else {
    pushWarn(sink, 'multipart body shape not recognized — exported empty formdata');
  }
  return {mode: 'formdata', formdata};
}

function mapBody(
    api: APIData, sink: WarningSink, inputs?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (api.protocol === 'graphql' || api.graphql) {
    const g = api.graphql;
    const query = g?.operation ? translateStringWithInputs(g.operation, sink, inputs) : '';
    const variables = g?.variables ?
        JSON.stringify(translateDeep(g.variables, sink, inputs), null, 2) :
        '';
    return {
      mode: 'graphql',
      graphql: {query, variables},
    };
  }
  if (api.body === undefined || api.body === null || api.body === '') {
    return undefined;
  }

  const format = requestFormat(api.format);

  if (format === 'urlencoded') {
    return mapUrlencodedBody(api.body, sink, inputs);
  }
  if (format === 'multipart') {
    return mapMultipartBody(api.body, sink, inputs);
  }
  if (format === 'binary') {
    if (typeof api.body === 'string') {
      pushWarn(
          sink,
          `binary body references ${api.body} — re-attach the file in Postman if the path does not resolve`);
      return {
        mode: 'file',
        file: {src: translateStringWithInputs(api.body, sink, inputs)},
      };
    }
    pushWarn(sink, 'binary body was not a file path — exported as raw');
  }

  if (typeof api.body === 'object') {
    const translated = translateDeep(api.body, sink, inputs);
    const language = format === 'xml' || format === 'xmle' ? 'xml' :
        (format === 'text' || format === 'html' ? 'text' : 'json');
    if (language !== 'json') {
      // Object bodies for xml/text are uncommon; still stringify for a valid request.
      return {
        mode: 'raw',
        raw: typeof translated === 'string' ? translated : JSON.stringify(translated, null, 2),
        options: {raw: {language}},
      };
    }
    return {
      mode: 'raw',
      raw: JSON.stringify(translated, null, 2),
      options: {raw: {language: 'json'}},
    };
  }

  const raw = translateStringWithInputs(String(api.body), sink, inputs);
  if (format === 'xml' || format === 'xmle') {
    return {mode: 'raw', raw, options: {raw: {language: 'xml'}}};
  }
  if (format === 'text' || format === 'html' || format === 'none') {
    return {mode: 'raw', raw, options: {raw: {language: 'text'}}};
  }
  const looksJson = raw.trim().startsWith('{') || raw.trim().startsWith('[');
  return {
    mode: 'raw',
    raw,
    options: {raw: {language: looksJson ? 'json' : 'text'}},
  };
}

function jsStringLiteral(value: unknown): string {
  return JSON.stringify(value);
}

function pathSegmentAccess(segment: string): string {
  if (/^\d+$/.test(segment)) {
    return `[${segment}]`;
  }
  return `[${jsStringLiteral(segment)}]`;
}

function jsonPathExpr(field: string): string {
  // field like body.token → json["token"]; body.items.0.id → json["items"][0]["id"]
  if (field === 'body') {
    return 'json';
  }
  if (field.startsWith('body.')) {
    const parts = field.slice(5).split('.');
    return 'json' + parts.map(pathSegmentAccess).join('');
  }
  if (field.startsWith('headers.') || field.startsWith('header.')) {
    const name = field.split('.').slice(1).join('.');
    return `pm.response.headers.get(${jsStringLiteral(name)})`;
  }
  return `json[${jsStringLiteral(field)}]`;
}

function isSimpleExpectField(field: string): boolean {
  return SIMPLE_PATH_RE.test(field) || field === 'status' || field === 'statusCode' ||
      field === 'status_code';
}

function isDefinedExpect(expected: ExpectValue, operator: string): boolean {
  if (operator !== '==' && operator !== 'defined') {
    return false;
  }
  if (typeof expected === 'string') {
    const t = expected.trim().toLowerCase();
    return t === 'defined' || t === 'exists';
  }
  return false;
}

function expectToScripts(field: string, rawValue: ExpectValue, sink: WarningSink): string[] {
  if (!isSimpleExpectField(field)) {
    pushWarn(sink, `Skipped expect on non-simple path: ${field}`);
    return [];
  }
  const values: ExpectValue[] = Array.isArray(rawValue) &&
          rawValue.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') &&
          (rawValue as unknown[]).some(
              (v) => typeof v === 'string' && !!splitCheckOperatorPrefix(String(v).trim())) ?
      (rawValue as ExpectValue[]) :
      [rawValue];

  const lines: string[] = [];
  for (const value of values) {
    const parsed = parseExpectValue(value);
    const {operator, expected} = parsed;

    if (field === 'status' || field === 'statusCode' || field === 'status_code') {
      if ((operator === '==' || operator === '===') &&
          (typeof expected === 'number' ||
           (typeof expected === 'string' && /^\d+$/.test(expected.trim())))) {
        const code = typeof expected === 'number' ? expected : Number(expected.trim());
        lines.push(
            `pm.test("status ${code}", function () { pm.response.to.have.status(${code}); });`);
        continue;
      }
      pushWarn(sink, `Skipped non-simple status expect: ${field}`);
      continue;
    }

    if (isDefinedExpect(expected, operator) ||
        (typeof expected === 'string' && expected.trim().toLowerCase() === 'defined')) {
      if (field.startsWith('headers.') || field.startsWith('header.')) {
        const name = field.split('.').slice(1).join('.');
        lines.push(
            `pm.test(${jsStringLiteral(`${field} exists`)}, function () { pm.expect(pm.response.headers.get(${jsStringLiteral(name)})).to.exist; });`);
      } else {
        lines.push(
            `pm.test(${jsStringLiteral(`${field} exists`)}, function () { const json = pm.response.json(); pm.expect(${jsonPathExpr(field)}).to.exist; });`);
      }
      continue;
    }

    if (operator !== '==' && operator !== '===') {
      pushWarn(sink, `Skipped expect with operator ${operator} on ${field}`);
      continue;
    }

    // Skip token RHS
    if (typeof expected === 'string' &&
        (TOKEN_WHOLE_RE.test(expected.trim()) || expected.includes('<<') || expected.includes('o:'))) {
      pushWarn(sink, `Skipped expect with runtime token on ${field}`);
      continue;
    }

    if (field.startsWith('headers.') || field.startsWith('header.')) {
      const name = field.split('.').slice(1).join('.');
      lines.push(
          `pm.test(${jsStringLiteral(`${field}`)}, function () { pm.expect(pm.response.headers.get(${jsStringLiteral(name)})).to.eql(${jsStringLiteral(expected)}); });`);
      continue;
    }

    if (field === 'body' || field.startsWith('body.')) {
      lines.push(
          `pm.test(${jsStringLiteral(field)}, function () { const json = pm.response.json(); pm.expect(${jsonPathExpr(field)}).to.eql(${jsStringLiteral(expected)}); });`);
      continue;
    }

    pushWarn(sink, `Skipped expect on ${field}`);
  }
  return lines;
}

function expectMapToScripts(map: ExpectMap | undefined, sink: WarningSink): string[] {
  if (!map || typeof map !== 'object') {
    return [];
  }
  const lines: string[] = [];
  for (const [field, value] of Object.entries(map)) {
    lines.push(...expectToScripts(field, value as ExpectValue, sink));
  }
  return lines;
}

/** Map setenv extraction expression to a Postman JS value expression. */
function setenvExprToJs(expression: string, sink: WarningSink): string | undefined {
  const expr = String(expression || '').trim();
  if (!expr) {
    return undefined;
  }
  // Literals
  if (/^(\d+(\.\d+)?|true|false)$/.test(expr)) {
    return expr;
  }
  if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
    return jsStringLiteral(expr.slice(1, -1));
  }
  // o:body.token / body.token / status
  let path = expr;
  if (path.startsWith('o:')) {
    path = path.slice(2);
  }
  if (TOKEN_WHOLE_RE.test(expr) && !expr.startsWith('o:')) {
    pushWarn(sink, `Skipped setenv expression with token: ${expression}`);
    return undefined;
  }
  if (!isSimpleExpectField(path) && path !== 'body' && !path.startsWith('body.')) {
    // allow outputs-style paths like body.token / items.0.id
    if (!BARE_DOT_PATH_RE.test(path)) {
      pushWarn(sink, `Skipped complex setenv expression: ${expression}`);
      return undefined;
    }
  }
  if (path === 'status' || path === 'statusCode' || path === 'status_code') {
    return 'pm.response.code';
  }
  if (path.startsWith('headers.') || path.startsWith('header.')) {
    const name = path.split('.').slice(1).join('.');
    return `pm.response.headers.get(${jsStringLiteral(name)})`;
  }
  if (path === 'body') {
    return 'pm.response.json()';
  }
  if (path.startsWith('body.')) {
    return `(function(){ const json = pm.response.json(); return ${jsonPathExpr(path)}; })()`;
  }
  // bare field → treat as body.field
  return `(function(){ const json = pm.response.json(); return json[${jsStringLiteral(path)}]; })()`;
}

function setenvToScripts(
    setenv: Record<string, unknown> | undefined,
    outputs: Record<string, string> | undefined,
    sink: WarningSink): string[] {
  if (!setenv || typeof setenv !== 'object') {
    return [];
  }
  const lines: string[] = [];
  for (const [envKey, raw] of Object.entries(setenv)) {
    if (!envKey) {
      continue;
    }
    let expression = typeof raw === 'string' ? raw : '';
    if (!expression) {
      continue;
    }
    // Legacy: setenv value is an outputs key name
    if (outputs && Object.prototype.hasOwnProperty.call(outputs, expression)) {
      expression = outputs[expression];
    }
    const js = setenvExprToJs(expression, sink);
    if (!js) {
      continue;
    }
    lines.push(
        `pm.collectionVariables.set(${jsStringLiteral(envKey)}, String(${js} ?? ''));`);
  }
  return lines;
}

function buildEvents(testLines: string[]): PostmanEvent[] | undefined {
  if (!testLines.length) {
    return undefined;
  }
  return [{
    listen: 'test',
    script: {type: 'text/javascript', exec: testLines},
  }];
}

function apiToPostmanItem(
    api: APIData,
    name: string,
    sink: WarningSink,
    extras?: {
      inputs?: Record<string, unknown>;
      expect?: ExpectMap;
      require?: ExpectMap;
      setenv?: Record<string, unknown>;
      description?: string;
    }): PostmanItem | undefined {
  const protocol = api.protocol || 'http';
  if (protocol === 'grpc') {
    pushWarn(sink, `Skipped gRPC API: ${name}`);
    return undefined;
  }

  const inputs = extras?.inputs;
  let urlRaw = String(api.url || '');
  urlRaw = translateStringWithInputs(urlRaw, sink, inputs);

  const query: Record<string, string> = {};
  if (api.query) {
    for (const [k, v] of Object.entries(api.query)) {
      query[k] = translateStringWithInputs(String(v ?? ''), sink, inputs);
    }
  }

  const headers: PostmanHeader[] = [];
  if (api.headers) {
    for (const [k, v] of Object.entries(api.headers)) {
      headers.push({
        key: k,
        value: translateStringWithInputs(String(v ?? ''), sink, inputs),
        type: 'text',
      });
    }
  }

  const request: PostmanRequest = {
    method: (api.method || (protocol === 'ws' ? 'GET' : 'GET')).toUpperCase(),
    header: headers,
    url: buildUrl(urlRaw, query, sink),
  };

  const auth = mapAuth(api.auth, sink);
  if (auth) {
    request.auth = auth;
  }

  const body = mapBody(api, sink, inputs);
  if (body) {
    request.body = body;
  }

  if (protocol === 'ws') {
    pushWarn(
        sink,
        `WebSocket "${name}": exported as Postman request (URL/headers/body as first message). Multi-message live flows may need manual edits.`);
    if (!request.description) {
      request.description =
          'Exported from Multimeter WebSocket API. Verify handshake and messages in Postman.';
    }
  }

  if (extras?.description) {
    request.description = extras.description;
  }

  const testLines: string[] = [];
  testLines.push(...expectMapToScripts(extras?.expect, sink));
  testLines.push(...expectMapToScripts(extras?.require, sink));
  // API-level setenv + call-level setenv
  testLines.push(...setenvToScripts(api.setenv as Record<string, unknown> | undefined, api.outputs, sink));
  testLines.push(...setenvToScripts(extras?.setenv, api.outputs, sink));

  const item: PostmanItem = {name, request};
  const events = buildEvents(testLines);
  if (events) {
    item.event = events;
  }
  return item;
}

async function loadYaml(
    fileLoader: ConvertToPostmanOptions['fileLoader'],
    path: string,
    sink: WarningSink): Promise<string | undefined> {
  if (!fileLoader) {
    pushWarn(sink, `Cannot resolve import ${path}: fileLoader not provided`);
    return undefined;
  }
  try {
    return await fileLoader(path);
  } catch {
    pushWarn(sink, `Failed to load ${path}`);
    return undefined;
  }
}

function walkTestSteps(
    steps: TestFlowStep[] | undefined,
    imports: Record<string, string>,
    ownerPath: string,
    projectRoot: string | undefined,
    fileLoader: ConvertToPostmanOptions['fileLoader'],
    sink: WarningSink,
    items: PostmanItem[]): Promise<void> {
  return (async () => {
    if (!Array.isArray(steps)) {
      return;
    }
    for (const step of steps) {
      const stepType = getTestFlowStepType(step);
      if (stepType === 'call') {
        const callStep = step as any;
        const alias = String(callStep.call || '');
        const importPath = imports[alias];
        if (!importPath) {
          pushWarn(sink, `Call "${alias}" has no import — skipped`);
          continue;
        }
        const resolved = resolveRelativeTo(importPath, ownerPath, projectRoot);
        const raw = await loadYaml(fileLoader, resolved, sink);
        if (!raw) {
          continue;
        }
        const kind = fileType(resolved, raw);
        if (kind !== 'api') {
          pushWarn(sink, `Import "${alias}" is ${kind || 'unknown'}, not api — skipped`);
          continue;
        }
        let api: APIData;
        try {
          api = yamlToAPI(raw);
        } catch (e: any) {
          pushWarn(sink, `Failed to parse API ${resolved}: ${e?.message || e}`);
          continue;
        }
        const name = callStep.title || callStep.id || alias;
        const item = apiToPostmanItem(api, name, sink, {
          inputs: callStep.inputs,
          expect: callStep.expect,
          require: callStep.require,
          setenv: callStep.setenv,
        });
        if (item) {
          items.push(item);
        }
        continue;
      }
      if (stepType === 'setenv') {
        const map = (step as any).setenv as Record<string, unknown> | undefined;
        const last = items[items.length - 1];
        if (!last?.request) {
          pushWarn(sink, 'Standalone setenv step skipped (no preceding request to attach scripts to)');
          continue;
        }
        const lines = setenvToScripts(map, undefined, sink);
        if (!lines.length) {
          continue;
        }
        const existing = last.event?.find((e) => e.listen === 'test');
        if (existing) {
          existing.script.exec.push(...lines);
        } else {
          last.event = buildEvents(lines);
        }
        continue;
      }
      if (stepType === 'stage' || stepType === 'steps' || stepType === 'step') {
        const nested = (step as any).steps as TestFlowStep[] | undefined;
        await walkTestSteps(nested, imports, ownerPath, projectRoot, fileLoader, sink, items);
        continue;
      }
      if (stepType === 'if') {
        pushWarn(sink, 'if step: exporting then-branch without condition');
        await walkTestSteps((step as any).steps, imports, ownerPath, projectRoot, fileLoader, sink, items);
        const elseSteps = (step as any).else as TestFlowStep[] | undefined;
        if (Array.isArray(elseSteps) && elseSteps.length) {
          pushWarn(sink, 'if else-branch: exporting steps without condition (flattened after then)');
          await walkTestSteps(elseSteps, imports, ownerPath, projectRoot, fileLoader, sink, items);
        }
        continue;
      }
      if (stepType === 'for' || stepType === 'repeat') {
        pushWarn(sink, `${stepType} step: exporting inner steps once (loop not mapped)`);
        await walkTestSteps((step as any).steps, imports, ownerPath, projectRoot, fileLoader, sink, items);
        continue;
      }
      if (stepType === 'check' || stepType === 'assert') {
        pushWarn(sink, `${stepType} step skipped — use inline expect on call for export`);
        continue;
      }
      if (stepType === 'js' || stepType === 'judge' || stepType === 'delay' || stepType === 'print' ||
          stepType === 'run' || stepType === 'http') {
        pushWarn(sink, `${stepType} step skipped in Postman export`);
        continue;
      }
    }
  })();
}

async function testToPostmanItems(
    test: TestData,
    ownerPath: string,
    options: ConvertToPostmanOptions,
    sink: WarningSink): Promise<PostmanItem[]> {
  const imports = (test.import && typeof test.import === 'object') ? test.import : {};
  const items: PostmanItem[] = [];
  if (Array.isArray((test as any).steps)) {
    await walkTestSteps(
        (test as any).steps, imports, ownerPath, options.projectRoot, options.fileLoader, sink, items);
  }
  if (Array.isArray((test as any).stages)) {
    for (const stage of (test as any).stages) {
      await walkTestSteps(
          stage?.steps, imports, ownerPath, options.projectRoot, options.fileLoader, sink, items);
    }
  }
  return items;
}

async function hierarchyToItems(
    node: SuiteHierarchyNode,
    options: ConvertToPostmanOptions,
    sink: WarningSink): Promise<PostmanItem[]> {
  if (node.kind === 'missing' || node.kind === 'cycle' || node.kind === 'server') {
    if (node.kind === 'missing') {
      pushWarn(sink, `Missing suite entry: ${node.path}`);
    }
    return [];
  }
  if (node.kind === 'group') {
    // Multimeter wraps sequential/parallel segments as groups. Postman has no
    // parallel groups — flatten children into the parent folder/collection.
    pushWarn(sink, 'Suite group/parallel segment flattened (Postman runs sequentially)');
    const children: PostmanItem[] = [];
    for (const child of node.children || []) {
      children.push(...await hierarchyToItems(child, options, sink));
    }
    return children;
  }
  if (node.kind === 'suite') {
    const children: PostmanItem[] = [];
    for (const child of node.children || []) {
      children.push(...await hierarchyToItems(child, options, sink));
    }
    // Root suite is handled by caller; nested suites become folders
    return [{
      name: node.title || pathBasename(node.path).replace(/\.mmt$/i, '') || 'Suite',
      item: children,
    }];
  }
  if (node.kind === 'test') {
    const raw = await loadYaml(options.fileLoader, node.path, sink);
    if (!raw) {
      return [];
    }
    let test: TestData;
    try {
      test = yamlToTest(raw);
    } catch (e: any) {
      pushWarn(sink, `Failed to parse test ${node.path}: ${e?.message || e}`);
      return [];
    }
    const items = await testToPostmanItems(test, node.path, options, sink);
    const folderName = node.title || test.title || pathBasename(node.path).replace(/\.mmt$/i, '');
    return [{name: folderName, item: items}];
  }
  if (node.kind === 'api') {
    const raw = await loadYaml(options.fileLoader, node.path, sink);
    if (!raw) {
      return [];
    }
    try {
      const api = yamlToAPI(raw);
      const item = apiToPostmanItem(api, node.title || api.title || pathBasename(node.path), sink);
      return item ? [item] : [];
    } catch (e: any) {
      pushWarn(sink, `Failed to parse API ${node.path}: ${e?.message || e}`);
      return [];
    }
  }
  return [];
}

function defaultEnvValue(value: EnvVariableValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const first = value[0];
    return first === undefined || first === null ? '' : String(first);
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '';
    }
    const first = (value as Record<string, unknown>)[keys[0]];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      return JSON.stringify(first);
    }
    return first === undefined || first === null ? '' : String(first);
  }
  return '';
}

function resolvePresetValues(
    env: EnvData, group: EnvPresetGroup, presetName: string, sink: WarningSink): Record<string, string> {
  const mapping = group[presetName];
  const out: Record<string, string> = {};
  if (!mapping || typeof mapping !== 'object') {
    return out;
  }
  const variables = env.variables || {};
  for (const [varName, presetVal] of Object.entries(mapping)) {
    const def = variables[varName];
    if (def && typeof def === 'object' && !Array.isArray(def)) {
      const choiceKey = String(presetVal);
      const choice = (def as Record<string, unknown>)[choiceKey];
      if (choice !== undefined) {
        out[varName] = typeof choice === 'object' ? JSON.stringify(choice) : String(choice);
        continue;
      }
    }
    out[varName] = presetVal === null || presetVal === undefined ? '' : String(presetVal);
  }
  // Fill remaining variables with defaults
  for (const [varName, def] of Object.entries(variables)) {
    if (!(varName in out)) {
      const v = defaultEnvValue(def);
      if (typeof def === 'string' && (def.startsWith('$') || def.startsWith('./'))) {
        pushWarn(sink, `Env var ${varName} is live/OS-backed — exported empty (was ${def})`);
        out[varName] = '';
      } else {
        out[varName] = v;
      }
    }
  }
  return out;
}

function buildEnvironmentFile(
    name: string, values: Record<string, string>, fileName: string): ConvertedPostmanFile {
  const valuesList = Object.entries(values).map(([key, value]) => ({
    key,
    value,
    type: 'default',
    enabled: true,
  }));
  return {
    path: fileName,
    kind: 'environment',
    content: prettyJson({
      id: slugify(name),
      name,
      values: valuesList,
      _postman_variable_scope: 'environment',
    }),
  };
}

function envToPostmanFiles(env: EnvData, sourcePath: string | undefined, sink: WarningSink): ConvertedPostmanFile[] {
  const baseTitle = (env as any).title || titleFromPath(sourcePath);
  const slug = slugify(baseTitle);
  const files: ConvertedPostmanFile[] = [];
  const variables = env.variables || {};

  const defaults: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'string' && (value.startsWith('$') || value.startsWith('./'))) {
      pushWarn(sink, `Env var ${key} is live/OS-backed — exported empty`);
      defaults[key] = '';
    } else {
      defaults[key] = defaultEnvValue(value);
    }
  }

  const presets = env.presets;
  if (presets && typeof presets === 'object') {
    for (const [groupName, group] of Object.entries(presets)) {
      if (!group || typeof group !== 'object') {
        continue;
      }
      for (const presetName of Object.keys(group)) {
        const values = resolvePresetValues(env, group, presetName, sink);
        const name = `${baseTitle} / ${groupName} / ${presetName}`;
        files.push(buildEnvironmentFile(
            name, values, `${slug}-${slugify(groupName)}-${slugify(presetName)}.postman_environment.json`));
      }
    }
  }

  if (files.length === 0) {
    files.push(buildEnvironmentFile(baseTitle, defaults, `${slug}.postman_environment.json`));
  }
  return files;
}

function collectMustacheVars(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value))) {
      const name = match[1].trim();
      // Skip Postman dynamics ({{$guid}}) and empty.
      if (!name || name.startsWith('$')) {
        continue;
      }
      into.add(name);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectMustacheVars(entry, into);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectMustacheVars(entry, into);
    }
  }
}

function wrapCollection(name: string, items: PostmanItem[], description?: string): Record<string, unknown> {
  const variables = new Set<string>();
  collectMustacheVars(items, variables);
  const collection: Record<string, unknown> = {
    info: {
      name,
      description: description || 'Exported from Multimeter',
      schema: POSTMAN_COLLECTION_SCHEMA,
    },
    item: items,
  };
  if (variables.size > 0) {
    collection.variable = [...variables].sort().map((key) => ({key, value: ''}));
  }
  return collection;
}

/**
 * Convert a Multimeter `.mmt` document to Postman collection and/or environment files.
 */
export async function convertToPostman(
    rawFile: string,
    options: ConvertToPostmanOptions = {}): Promise<ConvertToPostmanResult> {
  const sink: WarningSink = {warnings: []};
  const sourcePath = options.sourcePath || '';
  const kind = fileType(sourcePath || 'file.mmt', rawFile);

  if (kind === 'env') {
    const env = yamlToEnv(rawFile);
    const files = envToPostmanFiles(env, sourcePath, sink);
    return {
      sourceType: 'env',
      title: titleFromPath(sourcePath),
      files,
      warnings: sink.warnings,
    };
  }

  if (kind === 'api') {
    const api = yamlToAPI(rawFile);
    const name = api.title || titleFromPath(sourcePath);
    const item = apiToPostmanItem(api, name, sink);
    if (!item) {
      return {sourceType: 'api', title: name, files: [], warnings: sink.warnings};
    }
    const collection = wrapCollection(name, [item]);
    return {
      sourceType: 'api',
      title: name,
      files: [{
        path: `${slugify(name)}.postman_collection.json`,
        kind: 'collection',
        content: prettyJson(collection),
        warnings: sink.warnings.length ? [...sink.warnings] : undefined,
      }],
      warnings: sink.warnings,
    };
  }

  if (kind === 'test') {
    if (!options.fileLoader) {
      throw new Error('fileLoader is required to convert type: test');
    }
    const test = yamlToTest(rawFile);
    const name = test.title || titleFromPath(sourcePath);
    const items = await testToPostmanItems(test, sourcePath, options, sink);
    const collection = wrapCollection(name, items);
    return {
      sourceType: 'test',
      title: name,
      files: [{
        path: `${slugify(name)}.postman_collection.json`,
        kind: 'collection',
        content: prettyJson(collection),
        warnings: sink.warnings.length ? [...sink.warnings] : undefined,
      }],
      warnings: sink.warnings,
    };
  }

  if (kind === 'suite') {
    if (!options.fileLoader) {
      throw new Error('fileLoader is required to convert type: suite');
    }
    const suite = yamlToSuite(rawFile);
    const name = suite.title || titleFromPath(sourcePath);
    const loader = options.fileLoader;
    const hierarchy = await buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: sourcePath,
      suiteRawText: rawFile,
      fileLoader: async (p: string) => Promise.resolve(loader!(p)),
      projectRoot: options.projectRoot,
    });
    const items: PostmanItem[] = [];
    for (const child of hierarchy.children || []) {
      items.push(...await hierarchyToItems(child, options, sink));
    }
    pushWarn(
        sink,
        'Suite parallel groups (then) are flattened; Postman collections run sequentially.');
    const collection = wrapCollection(
        name, items, suite.description || 'Exported from Multimeter suite');
    return {
      sourceType: 'suite',
      title: name,
      files: [{
        path: `${slugify(name)}.postman_collection.json`,
        kind: 'collection',
        content: prettyJson(collection),
        warnings: sink.warnings.length ? [...sink.warnings] : undefined,
      }],
      warnings: sink.warnings,
    };
  }

  throw new Error(
      `Unsupported .mmt type for Postman export: ${kind || 'unknown'}. Supported: api, test, suite, env.`);
}
