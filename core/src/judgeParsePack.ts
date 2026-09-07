import {AuthConfig} from './APIData';
import {JudgeData, JudgeDefaults, JudgeEngineId, JudgeOptions} from './JudgeData';
import parseYaml, {packYaml, parseYamlStrict} from './markupConvertor';

const VALID_JUDGE_ROOT_KEYS = new Set([
  'type', 'title', 'description', 'tags', 'engine', 'model', 'url', 'auth',
  'options', 'defaults',
]);

const KNOWN_ENGINES = new Set<string>([
  'ollama', 'openai', 'anthropic', 'google', 'azure-openai',
]);

const JUDGE_KEY_ORDER = [
  'type', 'title', 'description', 'tags', 'engine', 'model', 'url', 'auth',
  'options', 'defaults',
];

export {JUDGE_KEY_ORDER};

function reorderKeys(obj: Record<string, any>, order: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of order) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  for (const key of Object.keys(obj)) {
    if (!(key in result)) {
      result[key] = obj[key];
    }
  }
  return result;
}

function parseOptions(raw: any): JudgeOptions|undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  return {...raw} as JudgeOptions;
}

function parseDefaults(raw: any): JudgeDefaults|undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const defaults: JudgeDefaults = {};
  if (raw.checks && typeof raw.checks === 'object' && !Array.isArray(raw.checks)) {
    defaults.checks = {...raw.checks};
  }
  if (Array.isArray(raw.criteria)) {
    defaults.criteria = raw.criteria.map((c: any) => String(c ?? '')).filter(Boolean);
  }
  return defaults;
}

function parseAuth(raw: any): AuthConfig|undefined {
  if (raw === 'none') {
    return 'none';
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  if (typeof raw.type !== 'string' || !raw.type.trim()) {
    return undefined;
  }
  return {...raw} as AuthConfig;
}

export function yamlToJudge(yamlContent: string): JudgeData {
  const obj = parseYaml(yamlContent) as any;
  return objectToJudge(obj);
}

export function yamlToJudgeStrict(yamlContent: string): JudgeData {
  const obj = parseYamlStrict(yamlContent) as any;
  const judge = objectToJudge(obj);
  const errors = validateJudgeObject(obj);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return judge;
}

export function objectToJudge(obj: any): JudgeData {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid judge file: expected a YAML object');
  }
  const engine = String(obj.engine ?? '').trim();
  const model = String(obj.model ?? '').trim();
  const url = String(obj.url ?? '').trim();
  const judge: JudgeData = {
    type: 'judge',
    engine: engine as JudgeEngineId,
    model,
    url,
  };
  if (typeof obj.title === 'string') {
    judge.title = obj.title;
  }
  if (typeof obj.description === 'string') {
    judge.description = obj.description;
  }
  if (Array.isArray(obj.tags)) {
    judge.tags = obj.tags.map((t: any) => String(t));
  }
  const auth = parseAuth(obj.auth);
  if (auth !== undefined) {
    judge.auth = auth;
  }
  const options = parseOptions(obj.options);
  if (options) {
    judge.options = options;
  }
  const defaults = parseDefaults(obj.defaults);
  if (defaults && (defaults.checks || defaults.criteria?.length)) {
    judge.defaults = defaults;
  }
  return judge;
}

export function validateJudgeObject(obj: any): string[] {
  const errors: string[] = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return ['Judge file must be a YAML object'];
  }
  if (obj.type !== 'judge') {
    errors.push('type must be "judge"');
  }
  for (const key of Object.keys(obj)) {
    if (!VALID_JUDGE_ROOT_KEYS.has(key)) {
      errors.push(`Unknown key "${key}"`);
    }
  }
  if (!String(obj.engine ?? '').trim()) {
    errors.push('engine is required');
  } else if (!KNOWN_ENGINES.has(String(obj.engine).trim())) {
    // Soft: unknown engines allowed for forward compat; runtime registry fails if missing.
  }
  if (!String(obj.model ?? '').trim()) {
    errors.push('model is required');
  }
  if (!String(obj.url ?? '').trim()) {
    errors.push('url is required');
  } else if (typeof obj.url !== 'string') {
    errors.push('url must be a string');
  }
  if (obj.auth != null && obj.auth !== 'none' &&
      (typeof obj.auth !== 'object' || Array.isArray(obj.auth))) {
    errors.push('auth must be an object or "none"');
  } else if (obj.auth && typeof obj.auth === 'object' && !obj.auth.type) {
    errors.push('auth.type is required');
  }
  if (obj.options != null && (typeof obj.options !== 'object' || Array.isArray(obj.options))) {
    errors.push('options must be an object');
  }
  if (obj.defaults != null && (typeof obj.defaults !== 'object' || Array.isArray(obj.defaults))) {
    errors.push('defaults must be an object');
  }
  return errors;
}

export function judgeToYaml(judge: JudgeData, originalYaml?: string): string {
  const yamlObj: Record<string, any> = {
    type: 'judge',
    engine: judge.engine,
    model: judge.model,
    url: judge.url,
  };
  if (judge.title) {
    yamlObj.title = judge.title;
  }
  if (judge.description) {
    yamlObj.description = judge.description;
  }
  if (judge.tags?.length) {
    yamlObj.tags = judge.tags;
  }
  if (judge.auth !== undefined) {
    yamlObj.auth = judge.auth;
  }
  if (judge.options && Object.keys(judge.options).length > 0) {
    yamlObj.options = judge.options;
  }
  if (judge.defaults) {
    yamlObj.defaults = judge.defaults;
  }
  return packYaml(reorderKeys(yamlObj, JUDGE_KEY_ORDER), originalYaml);
}

export function isJudgeEngineId(value: string): value is JudgeEngineId {
  return KNOWN_ENGINES.has(value);
}
