import { APISchema, EnvSchema, TestSchema, SuiteSchema, LoadTestSchema, DocSchema, MockSchema, ReportSchema, GeneralSchema } from './Schema';
import { parseDocument } from 'yaml';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, verbose: true });

type YamlPosition = { line: number; column: number };
type PathPositionEntry = { key?: YamlPosition; value?: YamlPosition };
type YamlPathPositionMap = Map<string, PathPositionEntry>;

const offsetToLineColumn = (content: string, offset: number): YamlPosition => {
    if (offset <= 0) {
        return { line: 1, column: 1 };
    }
    let line = 1;
    let lineStart = 0;
    const limit = Math.min(offset, content.length);
    for (let i = 0; i < limit; i++) {
        if (content.charCodeAt(i) === 10) {
            line += 1;
            lineStart = i + 1;
        }
    }
    return { line, column: offset - lineStart + 1 };
};

const getRangeStartOffset = (node: any): number | undefined => {
    if (Array.isArray(node?.range) && typeof node.range[0] === 'number') {
        return node.range[0];
    }
    return undefined;
};

const isYamlPair = (item: any): boolean => {
    return Boolean(item && item.key !== undefined && item.value !== undefined);
};

const isYamlMap = (node: any): boolean => {
    const items = Array.isArray(node?.items) ? node.items : [];
    return items.length > 0 && isYamlPair(items[0]);
};

const appendObjectPath = (path: string, key: string): string => {
    if (!path) {
        return `.${key}`;
    }
    return `${path}.${key}`;
};

const appendArrayPath = (path: string, index: number): string => {
    return `${path}[${index}]`;
};

const pathLookupKeys = (path: string): string[] => {
    const normalized = normalizeAjvDataPath(path);
    if (!normalized) {
        return ['', '.'];
    }
    const keys = new Set<string>([normalized]);
    if (normalized.startsWith('.')) {
        keys.add(normalized.slice(1));
    } else {
        keys.add(`.${normalized}`);
    }
    if (normalized.startsWith('/')) {
        keys.add(normalizeAjvDataPath(normalized));
    }
    return Array.from(keys);
};

const normalizeAjvDataPath = (path: string): string => {
    if (!path || path === '/') {
        return '';
    }
    if (path.startsWith('.')) {
        return path;
    }
    if (!path.startsWith('/')) {
        return `.${path}`;
    }
    const parts = path.split('/').filter(Boolean);
    let result = '';
    for (const part of parts) {
        if (/^\d+$/.test(part)) {
            result += `[${part}]`;
        } else {
            result += `.${part}`;
        }
    }
    return result;
};

const joinAjvPath = (base: string, segment: string): string => {
    const normalizedBase = normalizeAjvDataPath(base);
    if (!normalizedBase) {
        return `.${segment}`;
    }
    return `${normalizedBase}.${segment}`;
};

const recordPathPosition = (
    map: YamlPathPositionMap,
    path: string,
    part: 'key' | 'value',
    node: any,
    content: string
): void => {
    const offset = getRangeStartOffset(node);
    if (typeof offset !== 'number') {
        return;
    }
    const position = offsetToLineColumn(content, offset);
    for (const key of pathLookupKeys(path)) {
        const existing = map.get(key) || {};
        if (part === 'key') {
            existing.key = position;
        } else {
            existing.value = position;
        }
        map.set(key, existing);
    }
};

const collectYamlPathPositions = (
    node: any,
    content: string,
    path: string,
    map: YamlPathPositionMap
): void => {
    if (!node) {
        return;
    }

    const items: any[] = Array.isArray(node.items) ? node.items : [];
    if (items.length > 0) {
        if (isYamlMap(node)) {
            for (const pair of items) {
                const keyValue = pair?.key?.value;
                if (keyValue === undefined || keyValue === null) {
                    continue;
                }
                const key = String(keyValue);
                const childPath = appendObjectPath(path, key);
                recordPathPosition(map, childPath, 'key', pair.key, content);
                collectYamlPathPositions(pair.value, content, childPath, map);
            }
            return;
        }
        items.forEach((item, index) => {
            const childPath = appendArrayPath(path, index);
            recordPathPosition(map, childPath, 'value', item, content);
            collectYamlPathPositions(item, content, childPath, map);
        });
        return;
    }

    recordPathPosition(map, path, 'value', node, content);
};

const buildYamlPathPositionMap = (doc: any, content: string): YamlPathPositionMap => {
    const map: YamlPathPositionMap = new Map();
    collectYamlPathPositions(doc.contents, content, '', map);
    return map;
};

const getAjvErrorDataPath = (error: any): string => {
    const base = normalizeAjvDataPath((error as any).instancePath || (error as any).dataPath || '');
    if (error.keyword === 'additionalProperties' && typeof error.params?.additionalProperty === 'string') {
        return joinAjvPath(base, error.params.additionalProperty);
    }
    if (error.keyword === 'required' && typeof error.params?.missingProperty === 'string') {
        return joinAjvPath(base, error.params.missingProperty);
    }
    return base;
};

const getErrorPositionPart = (error: any): 'key' | 'value' => {
    if (error.keyword === 'additionalProperties' || error.keyword === 'required') {
        return 'key';
    }
    return 'value';
};

const resolveErrorPosition = (
    content: string,
    pathMap: YamlPathPositionMap,
    error: any,
    fallbackPath?: string
): YamlPosition => {
    const dataPath = getAjvErrorDataPath(error);
    const part = getErrorPositionPart(error);
    for (const key of pathLookupKeys(dataPath)) {
        const entry = pathMap.get(key);
        const position = part === 'key' ? entry?.key : entry?.value;
        if (position) {
            return position;
        }
        if (entry?.key) {
            return entry.key;
        }
        if (entry?.value) {
            return entry.value;
        }
    }
    if (fallbackPath) {
        for (const key of pathLookupKeys(fallbackPath)) {
            const entry = pathMap.get(key);
            if (entry?.key) {
                return entry.key;
            }
            if (entry?.value) {
                return entry.value;
            }
        }
    }
    return { line: 1, column: 1 };
};

const isHttpApiDocument = (parsedContent: any): boolean => {
    if (!parsedContent || parsedContent.type !== 'api') {
        return false;
    }
    if (parsedContent.protocol) {
        return parsedContent.protocol === 'http';
    }
    const url = typeof parsedContent.url === 'string' ? parsedContent.url.trim().toLowerCase() : '';
    return !/^(wss?|grpcs?):\/\//.test(url);
};

const isTopLevelMethodRequiredError = (error: any): boolean => {
    return error?.keyword === 'required' && error?.params?.missingProperty === 'method' &&
        ((error as any).instancePath || (error as any).dataPath || '') === '';
};

const isTopLevelGraphqlRequiredError = (error: any): boolean => {
    return error?.keyword === 'required' && error?.params?.missingProperty === 'graphql' &&
        ((error as any).instancePath || (error as any).dataPath || '') === '';
};

const isSchemaBranchError = (error: any): boolean => {
    return error?.keyword === 'if';
};

const DATA_IMPORT_EXTENSIONS = ['.json', '.yaml', '.yml', '.csv'];
const WHOLE_DATA_IMPORT_REF_RE = /^\$\{\s*([A-Za-z_][A-Za-z0-9_-]*)(?:\.[A-Za-z_][A-Za-z0-9_-]*|\[(?:-?\d+(?::-?\d*)?|[A-Za-z_][A-Za-z0-9_]*)\])*\s*\}$/;

const isDataImportPath = (pathValue: unknown): boolean => {
    const lower = String(pathValue ?? '').trim().toLowerCase().split(/[?#]/, 1)[0];
    return DATA_IMPORT_EXTENSIONS.some(ext => lower.endsWith(ext));
};

const getImportedDataAliases = (parsedContent: any): Set<string> => {
    const aliases = new Set<string>();
    const imports = parsedContent?.import;
    if (!imports || typeof imports !== 'object' || Array.isArray(imports)) {
        return aliases;
    }
    for (const [alias, importPath] of Object.entries(imports)) {
        if (typeof alias === 'string' && isDataImportPath(importPath)) {
            aliases.add(alias);
        }
    }
    return aliases;
};

const getValueAtAjvPath = (root: any, path: string): any => {
    if (!path || path === '/') {
        return root;
    }
    if (path.startsWith('/')) {
        const parts = path.split('/').slice(1).map(part =>
            part.replace(/~1/g, '/').replace(/~0/g, '~')
        );
        return parts.reduce((current, part) => current == null ? undefined : current[part], root);
    }

    const normalized = normalizeAjvDataPath(path).replace(/^\./, '');
    if (!normalized) {
        return root;
    }
    const parts = normalized
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter(Boolean);
    return parts.reduce((current, part) => current == null ? undefined : current[part], root);
};

const isWholeDataImportReference = (value: unknown, dataAliases: Set<string>): boolean => {
    if (typeof value !== 'string') {
        return false;
    }
    const match = value.match(WHOLE_DATA_IMPORT_REF_RE);
    return Boolean(match && dataAliases.has(match[1]));
};

const isDataImportReferenceSchemaError = (
    error: any,
    parsedContent: any,
    dataAliases: Set<string>
): boolean => {
    if (!['type', 'enum', 'anyOf', 'oneOf'].includes(String(error?.keyword))) {
        return false;
    }
    const path = (error as any).instancePath || (error as any).dataPath || '';
    return isWholeDataImportReference(getValueAtAjvPath(parsedContent, path), dataAliases);
};

const formatValidationMessage = (path: string, message: string | undefined): string => {
    const text = message || 'is invalid';
    return path ? `${path}: ${text}` : text;
};

export const validateYamlContent = (content: string): any[] => {
    const errors: any[] = [];

    try {
        const doc = parseDocument(content);
        const parsedContent = doc.toJS();

        if (!parsedContent) {
            return errors;
        }

        const pathMap = buildYamlPathPositionMap(doc, content);
        const dataAliases = getImportedDataAliases(parsedContent);

        // Validate against schema
        let validate = ajv.compile(GeneralSchema);
        if (parsedContent.type && parsedContent.type === 'api') {
            validate = ajv.compile(APISchema);
        } else if (parsedContent.type && parsedContent.type === 'env') {
            validate = ajv.compile(EnvSchema);
        } else if (parsedContent.type && parsedContent.type === 'test') {
            validate = ajv.compile(TestSchema);
        } else if (parsedContent.type && parsedContent.type === 'suite') {
            validate = ajv.compile(SuiteSchema);
        } else if (parsedContent.type && parsedContent.type === 'loadtest') {
            validate = ajv.compile(LoadTestSchema);
        } else if (parsedContent.type && parsedContent.type === 'doc') {
            validate = ajv.compile(DocSchema);
        } else if (parsedContent.type && parsedContent.type === 'server') {
            validate = ajv.compile(MockSchema);
        } else if (parsedContent.type && parsedContent.type === 'report') {
            validate = ajv.compile(ReportSchema);
        }
        const isValid = validate(parsedContent);

        if (!isValid && validate.errors) {
            validate.errors.forEach(error => {
                if (isSchemaBranchError(error)) {
                    return;
                }
                if (isDataImportReferenceSchemaError(error, parsedContent, dataAliases)) {
                    return;
                }
                if (isTopLevelMethodRequiredError(error) && !isHttpApiDocument(parsedContent)) {
                    return;
                }
                if (isTopLevelGraphqlRequiredError(error) && parsedContent?.protocol === 'graphql') {
                    const { line, column } = resolveErrorPosition(content, pathMap, error, '.protocol');
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: 'protocol "graphql" requires a graphql.operation block; body is not used for GraphQL requests',
                        source: 'mmt-validation'
                    });
                    return;
                }
                if (
                    error.keyword === "additionalProperties" &&
                    typeof (error.params as any).additionalProperty === "string"
                ) {
                    const { line, column } = resolveErrorPosition(content, pathMap, error);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `Invalid property "${(error.params as any).additionalProperty}"`,
                        source: 'mmt-validation'
                    });
                } else if (error.keyword === "enum") {
                    const { line, column } = resolveErrorPosition(content, pathMap, error);
                    const dataPath = (error as any).instancePath || (error as any).dataPath || '';
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `Invalid value for property "${dataPath}", expected one of: ${(error.params as any).allowedValues ? (error.params as any).allowedValues.join(', ') : (error.params as any).allowedValue}`,
                        source: 'mmt-validation'
                    });
                } else {
                    const path = (error as any).instancePath || (error as any).dataPath || '';
                    const { line, column } = resolveErrorPosition(content, pathMap, error);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: formatValidationMessage(path, error.message),
                        source: 'mmt-validation'
                    });
                }
            });
        }

        return errors;
    } catch (yamlError: any) {
        // YAML parsing error from YAML library
        const line = yamlError.linePos?.[0]?.line || yamlError.source?.start?.line || 1;
        const column = yamlError.linePos?.[0]?.col || yamlError.source?.start?.col || 1;

        errors.push({
            severity: 8,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + 10,
            message: `YAML Parse Error: ${yamlError.message}`,
            source: 'yaml-syntax'
        });

        return errors;
    }
};
