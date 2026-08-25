import parseYaml, {packYaml, parseYamlDoc, stringifyYamlDocument} from './markupConvertor';
import {setYamlRoot} from './yamlAstMerge';
import {
  EnvCaCertificate,
  EnvCertificates,
  EnvClientCertificate,
  EnvData,
  EnvSetting,
  EnvVariableValue,
} from './EnvData';
import {isNonEmptyObject} from './safer';

const VALID_ENV_ROOT_KEYS = new Set([
  'type', 'import', 'variables', 'presets', 'setting', 'certificates',
]);

const CLIENT_CERT_KEY_ORDER = [
  'name', 'host', 'cert', 'key', 'pfx', 'passphrase_plain', 'passphrase_env',
];
const CERTIFICATES_KEY_ORDER = ['server_ca', 'clients'];
const SETTING_HTTP_KEY_ORDER = ['version', 'timeout'];

function reorderKeys(obj: Record<string, any>, order: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of order) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  for (const key of Object.keys(obj)) {
    if (!order.includes(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

function parseVariableValue(raw: unknown): EnvVariableValue | undefined {
  if (Array.isArray(raw)) {
    return raw as EnvVariableValue;
  }
  if (raw && typeof raw === 'object') {
    return {...(raw as Record<string, string | number | boolean | null | undefined>)};
  }
  return undefined;
}

function parseVariables(doc: any): Record<string, EnvVariableValue> | undefined {
  const raw = doc?.variables;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const variables: Record<string, EnvVariableValue> = {};
  for (const [name, value] of Object.entries(raw)) {
    const parsed = parseVariableValue(value);
    if (parsed !== undefined) {
      variables[name] = parsed;
    }
  }
  return Object.keys(variables).length > 0 ? variables : undefined;
}

function parsePresets(doc: any): EnvData['presets'] {
  const raw = doc?.presets;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  return {...raw};
}

function parseSetting(doc: any): EnvSetting | undefined {
  const raw = doc?.setting;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const setting: EnvSetting = {};
  if (raw.http && typeof raw.http === 'object' && !Array.isArray(raw.http)) {
    setting.http = reorderKeys({...raw.http}, SETTING_HTTP_KEY_ORDER);
  }
  return setting.http ? setting : undefined;
}

function parseClientCertificate(raw: any): EnvClientCertificate {
  const client: Record<string, any> = {
    name: typeof raw?.name === 'string' ? raw.name : String(raw?.name ?? ''),
    host: typeof raw?.host === 'string' ? raw.host : String(raw?.host ?? ''),
  };
  if (typeof raw?.cert === 'string') {
    client.cert = raw.cert;
  }
  if (typeof raw?.key === 'string') {
    client.key = raw.key;
  }
  if (typeof raw?.pfx === 'string') {
    client.pfx = raw.pfx;
  }
  if (typeof raw?.passphrase_plain === 'string') {
    client.passphrase_plain = raw.passphrase_plain;
  }
  if (typeof raw?.passphrase_env === 'string') {
    client.passphrase_env = raw.passphrase_env;
  }
  return reorderKeys(client, CLIENT_CERT_KEY_ORDER) as EnvClientCertificate;
}

function parseCertificates(doc: any): EnvCertificates | undefined {
  const raw = doc?.certificates;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const certificates: EnvCertificates = {};
  if (raw.server_ca !== undefined && raw.server_ca !== null) {
    if (typeof raw.server_ca === 'string') {
      certificates.server_ca = raw.server_ca;
    } else if (typeof raw.server_ca === 'object' && !Array.isArray(raw.server_ca)) {
      certificates.server_ca = {...raw.server_ca} as EnvCaCertificate;
    }
  }
  if (Array.isArray(raw.clients)) {
    certificates.clients = raw.clients
        .filter((entry: unknown) => entry && typeof entry === 'object')
        .map((entry: any) => parseClientCertificate(entry));
  }
  return Object.keys(certificates).length > 0 ? certificates : undefined;
}

export function yamlToEnv(rawYaml: string): EnvData {
  const doc = parseYaml(rawYaml || '') || {};
  const type = typeof doc?.type === 'string' ? doc.type : '';
  if (type !== 'env') {
    throw new Error('Not an environment document');
  }

  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(doc)) {
    if (!VALID_ENV_ROOT_KEYS.has(key)) {
      extra[key] = doc[key];
    }
  }

  const env: EnvData = {
    type: 'env',
    import: doc.import && typeof doc.import === 'object' && !Array.isArray(doc.import) ?
      {...doc.import} :
      undefined,
    variables: parseVariables(doc),
    presets: parsePresets(doc),
    setting: parseSetting(doc),
    certificates: parseCertificates(doc),
  };
  if (Object.keys(extra).length > 0) {
    env.extra = extra;
  }
  return env;
}

function serializeClientCertificate(client: EnvClientCertificate): Record<string, any> {
  const obj: Record<string, any> = {};
  if (client.name) {
    obj.name = client.name;
  }
  if (client.host) {
    obj.host = client.host;
  }
  if (client.cert) {
    obj.cert = client.cert;
  }
  if (client.key) {
    obj.key = client.key;
  }
  if (client.pfx) {
    obj.pfx = client.pfx;
  }
  if (client.passphrase_plain) {
    obj.passphrase_plain = client.passphrase_plain;
  }
  if (client.passphrase_env) {
    obj.passphrase_env = client.passphrase_env;
  }
  return reorderKeys(obj, CLIENT_CERT_KEY_ORDER);
}

function serializeCertificates(certificates: EnvCertificates): Record<string, any> {
  const obj: Record<string, any> = {};
  if (certificates.server_ca !== undefined) {
    obj.server_ca = certificates.server_ca;
  }
  if (Array.isArray(certificates.clients) && certificates.clients.length > 0) {
    obj.clients = certificates.clients.map(serializeClientCertificate);
  }
  return reorderKeys(obj, CERTIFICATES_KEY_ORDER);
}

function serializeSetting(setting: EnvSetting): Record<string, any> {
  const obj: Record<string, any> = {};
  if (setting.http && typeof setting.http === 'object') {
    obj.http = reorderKeys({...setting.http}, SETTING_HTTP_KEY_ORDER);
  }
  return obj;
}

export function envToYaml(env: EnvData, originalYaml?: string): string {
  const yamlObj: Record<string, any> = {
    type: env.type,
  };
  if (isNonEmptyObject(env.import)) {
    yamlObj.import = env.import;
  }
  if (env.variables && Object.keys(env.variables).length > 0) {
    yamlObj.variables = env.variables;
  }
  if (env.presets && Object.keys(env.presets).length > 0) {
    yamlObj.presets = env.presets;
  }
  if (env.setting) {
    const setting = serializeSetting(env.setting);
    if (Object.keys(setting).length > 0) {
      yamlObj.setting = setting;
    }
  }
  if (env.certificates) {
    const certificates = serializeCertificates(env.certificates);
    if (Object.keys(certificates).length > 0) {
      yamlObj.certificates = certificates;
    }
  }
  if (env.extra) {
    for (const [key, value] of Object.entries(env.extra)) {
      yamlObj[key] = value;
    }
  }
  return packYaml(yamlObj, originalYaml);
}

export type EnvYamlPatch = {
  import?: EnvData['import'];
  variables?: EnvData['variables'];
  presets?: EnvData['presets'];
  setting?: EnvSetting;
  certificates?: EnvCertificates;
};

/**
 * Update selected env root keys on the YAML document AST so comments stay
 * stuck to their keys, same as formatMmtYamlAst.
 */
export function patchEnvYaml(rawYaml: string, patch: EnvYamlPatch): string {
  const doc = parseYamlDoc(rawYaml || '');
  if ('import' in patch) {
    setYamlRoot(
        doc, 'import', isNonEmptyObject(patch.import) ? patch.import : undefined);
  }
  if ('variables' in patch) {
    const variables = patch.variables && Object.keys(patch.variables).length > 0 ?
      patch.variables :
      undefined;
    setYamlRoot(doc, 'variables', variables);
  }
  if ('presets' in patch) {
    const presets = patch.presets && Object.keys(patch.presets).length > 0 ?
      patch.presets :
      undefined;
    setYamlRoot(doc, 'presets', presets);
  }
  if ('setting' in patch) {
    const setting = patch.setting ? serializeSetting(patch.setting) : undefined;
    setYamlRoot(
        doc, 'setting', setting && Object.keys(setting).length > 0 ? setting : undefined);
  }
  if ('certificates' in patch) {
    const certificates = patch.certificates ?
      serializeCertificates(patch.certificates) :
      undefined;
    setYamlRoot(
        doc,
        'certificates',
        certificates && Object.keys(certificates).length > 0 ? certificates : undefined);
  }
  return stringifyYamlDocument(doc);
}
