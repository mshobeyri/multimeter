import { validateYamlContent } from './Validate';
import { registerMmtYamlTokenizer } from './yamlTokenizer';
import { KeySuggestionsByParent } from './AutoComplete';
import { readFile } from '../vsAPI';
import { outputExtractor, mockServer, mockParsePack } from 'mmt-core';
import { applyValueAccessor } from 'mmt-core/variableReplacer';
import { dataImportProcessor } from 'mmt-core';
import { detectAutocompleteDocType } from './autocompleteDocType';
import { completionRange, withRange, wordCompletionRange } from './autocompleteRange';
import { matchTokenCompletion, type TokenPrefix } from './autocompleteTokens';
import { parseYamlSectionKeys, parseYamlSectionMap } from './autocompleteYamlSection';

const DEFAULT_EXTRACTION_RULES: Record<string, string> =
    outputExtractor.DEFAULT_EXTRACTION_RULES || {
        body: 'body',
        headers: 'headers',
        cookies: 'cookies',
        status: 'status',
        duration: 'duration',
    };

function collectNestedKeys(obj: any, prefix = ''): string[] {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return [];
    }
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        keys.push(path);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            keys.push(...collectNestedKeys(value, path));
        }
    }
    return keys;
}

function getMockServerRefSuggestions(content: string, namespace: string): Array<{label: string, detail: string, documentation: string}> {
    const suggestions: Array<{label: string, detail: string, documentation: string}> = [];
    const seen = new Set<string>();
    const add = (label: string, detail: string, documentation: string) => {
        const key = label.toLowerCase();
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        suggestions.push({ label, detail, documentation });
    };

    const mock = mockParsePack.yamlToMock(content);
    const endpointPaths: string[] = [];
    if (mock?.endpoints) {
        for (const ep of mock.endpoints as any[]) {
            if (typeof ep?.path === 'string') {
                endpointPaths.push(ep.path);
            }
            const matchBody = ep?.match?.body;
            if (matchBody && namespace === 'body') {
                for (const key of collectNestedKeys(matchBody)) {
                    add(key, 'Request body field', `Substitute from incoming request body: \${body.${key}}`);
                }
            }
            const matchHeaders = ep?.match?.headers;
            if (matchHeaders && namespace === 'header') {
                for (const key of Object.keys(matchHeaders)) {
                    add(key, 'Request header', `Substitute from incoming request header: \${header.${key}}`);
                }
            }
            const matchQuery = ep?.match?.query;
            if (matchQuery && namespace === 'query') {
                for (const key of Object.keys(matchQuery)) {
                    add(key, 'Query parameter', `Substitute from query string: \${query.${key}}`);
                }
            }
        }
    }

    if (namespace === 'url') {
        add('path', 'Request path', `Full request path without query string: \${url.path}`);
        for (const name of mockServer.extractPathParamNames(endpointPaths)) {
            add(name, `Path param :${name}`, `Path parameter from route pattern: \${url.${name}}`);
        }
    } else if (namespace === 'body') {
        for (const key of ['name', 'email', 'id', 'username', 'password', 'message']) {
            add(key, 'Request body field', `Substitute from incoming request body: \${body.${key}}`);
        }
    } else if (namespace === 'header') {
        for (const key of ['authorization', 'content-type', 'x-api-key', 'accept', 'user-agent']) {
            add(key, 'Request header', `Substitute from incoming request header: \${header.${key}}`);
        }
    } else if (namespace === 'query') {
        for (const key of ['page', 'limit', 'q', 'sort']) {
            add(key, 'Query parameter', `Substitute from query string: \${query.${key}}`);
        }
    }

    return suggestions;
}

async function listFiles(folder: string, recursive = true): Promise<string[]> {
    return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (msg && msg.command === 'listFilesResult' && msg.folder === folder) {
                window.removeEventListener('message', handler);
                resolve(Array.isArray(msg.files) ? msg.files : []);
            }
        };
        window.addEventListener('message', handler);
        window.vscode?.postMessage({ command: 'listFiles', folder, recursive });
    });
}

export const handleBeforeMount = (monaco: any) => {
    registerMmtYamlTokenizer(monaco);
    const keySuggestionsByParent = KeySuggestionsByParent(monaco);

    if (!monaco.languages.getLanguages().some((language: any) => language.id === 'http')) {
        monaco.languages.register({ id: 'http' });
    }
    monaco.languages.setMonarchTokensProvider('http', {
        defaultToken: '',
        tokenPostfix: '.http',
        keywords: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'],
        tokenizer: {
            root: [
                [/^\s*###.*$/, 'keyword'],
                [/^\s*(?:#|\/\/|;)\s*@(?:name|title|note|prompt|no-cookie-jar|no-redirect|no-log)\b.*$/, 'annotation'],
                [/^\s*(?:#|\/\/|;).*$/, 'comment'],
                [/^\s*@[A-Za-z_][A-Za-z0-9_.-]*\s*=.*/, 'variable'],
                [/\{\{[^}]+\}\}/, 'variable.predefined'],
                [/^\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)(\s+)(\S+)/, ['keyword', '', 'string.link']],
                [/^\s*[A-Za-z0-9-]+(?=\s*:)/, 'type.identifier'],
                [/>\s*\{%/, 'delimiter', '@script'],
                [/<\s*\{%/, 'delimiter', '@script'],
                [/"([^"\\]|\\.)*$/, 'string.invalid'],
                [/"([^"\\]|\\.)*"/, 'string'],
                [/'([^'\\]|\\.)*'/, 'string'],
                [/\b\d+(?:\.\d+)?\b/, 'number'],
            ],
            script: [
                [/%\}/, 'delimiter', '@pop'],
                [/client\.(?:test|assert|global|environment|variables|log)\b/, 'keyword'],
                [/response\.(?:status|body|headers|cookies)\b/, 'variable.predefined'],
                [/function|const|let|var|return|if|else|true|false|null|undefined/, 'keyword'],
                [/"([^"\\]|\\.)*"/, 'string'],
                [/'([^'\\]|\\.)*'/, 'string'],
                [/\b\d+(?:\.\d+)?\b/, 'number'],
            ],
        },
    });

    const splitPathPrefix = (raw: string): { folder: string; partial: string } => {
        const v = String(raw ?? '');
        // trim leading spaces and optional opening quote
        const trimmed = v.replace(/^\s+/, '').replace(/^["']/, '');
        const lastSlash = trimmed.lastIndexOf('/');
        if (lastSlash < 0) {
            return { folder: '.', partial: trimmed };
        }
        const folder = trimmed.slice(0, lastSlash + 1);
        const partial = trimmed.slice(lastSlash + 1);
        return { folder: folder || '.', partial };
    };

    const getInputsKeysFromModel = (model: any): string[] => {
        return parseYamlSectionKeys(String(model?.getValue?.() ?? ''), 'inputs');
    };

    const getInputTokenSuggestions = (model: any): any[] => {
        const names = getInputsKeysFromModel(model);
        return names.map((name) => ({
            label: 'i:' + name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: 'i:' + name,
            documentation: `Input token i:${name} (from this file's inputs:)`,
            detail: `Input: ${name}`,
        }));
    };

    // --- Import-aware autocomplete helpers ---

    /** Parse the top-level import: map from the document text. Returns { alias: path } */
    const getImportMap = (model: any): Record<string, string> => {
        return parseYamlSectionMap(String(model?.getValue?.() ?? ''), 'import', {
            rootOnly: true,
            requireValue: true,
        });
    };

    /** Scan the document for `- call: alias` + `id: varName` pairs. Returns [{ alias, id }] */
    const getCallIdsWithAliases = (model: any): { alias: string; id: string }[] => {
        try {
            const value = String(model?.getValue?.() ?? '');
            const lines = value.split(/\r?\n/);
            const results: { alias: string; id: string }[] = [];
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                const callMatch = trimmed.match(/^-\s*call:\s*(.+)$/);
                if (!callMatch) { continue; }
                const alias = callMatch[1].trim().replace(/^["']|["']$/g, '');
                const callIndent = lines[i].search(/\S|$/);
                // Look for sibling `id:` at same indent+2 (or same block)
                let id = '';
                for (let j = i + 1; j < lines.length && j < i + 10; j++) {
                    const next = lines[j];
                    if (!next.trim()) { continue; }
                    const nextIndent = next.search(/\S|$/);
                    if (nextIndent <= callIndent) { break; }
                    const idMatch = next.trim().match(/^id:\s*(.+)$/);
                    if (idMatch) {
                        id = idMatch[1].trim().replace(/^["']|["']$/g, '');
                        break;
                    }
                }
                if (id) {
                    results.push({ alias, id });
                }
            }
            return results;
        } catch {
            return [];
        }
    };

    /** Cache for imported data file parsed content */
    const importedDataFileCache = new Map<string, any>();

    const readAndParseDataImportFile = async (path: string): Promise<any | null> => {
        if (importedDataFileCache.has(path)) {
            return importedDataFileCache.get(path) ?? null;
        }
        try {
            const content = await readFile(path);
            if (!content) {
                return null;
            }
            const data = dataImportProcessor.parseDataFile(content, path);
            importedDataFileCache.set(path, data);
            setTimeout(() => importedDataFileCache.delete(path), 10000);
            return data;
        } catch {
            importedDataFileCache.set(path, null);
            setTimeout(() => importedDataFileCache.delete(path), 5000);
            return null;
        }
    };

    const getDataImportRefSuggestions = async (
        model: any,
        tokenSource: string,
        position: any,
    ): Promise<any[] | null> => {
        const dataImportRefMatch = tokenSource.match(
            /\$\{\s*([A-Za-z_][A-Za-z0-9_-]*)((?:\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\])*)\.?([\w.-]*)$/
        );
        if (!dataImportRefMatch) {
            const dataImportStartMatch = tokenSource.match(/\$\{\s*([\w.-]*)$/);
            if (!dataImportStartMatch || dataImportStartMatch[1].includes(':')) {
                return null;
            }
            const prefix = dataImportStartMatch[1].toLowerCase();
            const importMap = getImportMap(model);
            const aliasSuggestions = Object.entries(importMap)
                .filter(([alias, filePath]) =>
                    dataImportProcessor.isDataImportPath(filePath) &&
                    (!prefix || alias.toLowerCase().startsWith(prefix)))
                .map(([alias, filePath]) => ({
                    label: alias,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: alias,
                    detail: `Data import: ${filePath}`,
                    documentation: `Reference imported data with \${${alias}.path}`,
                    sortText: `0${alias}`,
                }));
            if (aliasSuggestions.length === 0) {
                return null;
            }
            const bracePos = tokenSource.lastIndexOf('${');
            const replaceStartColumn = bracePos + 3;
            return withRange(aliasSuggestions, completionRange(position, replaceStartColumn));
        }

        const alias = dataImportRefMatch[1];
        const accessorPath = dataImportRefMatch[2] || '';
        const partialKey = dataImportRefMatch[3] || '';
        const importMap = getImportMap(model);
        const importPath = importMap[alias];
        if (!importPath || !dataImportProcessor.isDataImportPath(importPath)) {
            return null;
        }
        const data = await readAndParseDataImportFile(importPath);
        if (data == null) {
            return null;
        }
        const normalizedAccessor = accessorPath.replace(/^\./, '');
        const parentValue = normalizedAccessor ?
            applyValueAccessor(data, normalizedAccessor) :
            data;
        const suggestions: any[] = [];
        if (parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)) {
            for (const key of Object.keys(parentValue)) {
                if (partialKey && !key.toLowerCase().startsWith(partialKey.toLowerCase())) {
                    continue;
                }
                suggestions.push({
                    label: key,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: key,
                    detail: `Field from ${alias}`,
                    documentation: `Imported data field "${key}" from ${importPath}`,
                    sortText: `0${key}`,
                });
            }
        } else if (Array.isArray(parentValue)) {
            for (let i = 0; i < parentValue.length; i++) {
                const label = String(i);
                if (partialKey && !label.startsWith(partialKey)) {
                    continue;
                }
                suggestions.push({
                    label,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: `[${i}]`,
                    detail: `Index from ${alias}`,
                    documentation: `Imported array index [${i}] from ${importPath}`,
                    sortText: `0${label}`,
                });
            }
        } else if (!normalizedAccessor) {
            const nestedKeys = collectNestedKeys(data)
                .filter((key) => !partialKey || key.toLowerCase().startsWith(partialKey.toLowerCase()));
            for (const key of nestedKeys) {
                suggestions.push({
                    label: key,
                    kind: monaco.languages.CompletionItemKind.Field,
                    insertText: key,
                    detail: `Path from ${alias}`,
                    documentation: `Imported data path "${key}" from ${importPath}`,
                    sortText: `0${key}`,
                });
            }
        }
        if (suggestions.length === 0) {
            return null;
        }
        const dotPos = tokenSource.lastIndexOf('.');
        const replaceStartColumn = dotPos >= 0 ? dotPos + 2 : tokenSource.lastIndexOf('${') + 3;
        return withRange(deduplicateSuggestions(suggestions), completionRange(position, replaceStartColumn));
    };

    /** Cache for imported file parsed data */
    const importedFileCache = new Map<string, { inputs: Record<string, string>; outputs: Record<string, string>; type: string } | null>();

    /** Read and parse an imported .mmt file, extracting its inputs: and outputs: */
    const readAndParseImportedFile = async (path: string): Promise<{ inputs: Record<string, string>; outputs: Record<string, string>; type: string } | null> => {
        if (importedFileCache.has(path)) {
            return importedFileCache.get(path) ?? null;
        }
        try {
            const content = await readFile(path);
            if (!content) { return null; }
            const fileType = detectAutocompleteDocType(content) || '';
            const inputs = parseYamlSectionMap(content, 'inputs', { rootOnly: true });
            const outputs = parseYamlSectionMap(content, 'outputs', { rootOnly: true });
            if (fileType === 'api') {
                for (const [key, rule] of Object.entries(DEFAULT_EXTRACTION_RULES)) {
                    if (!Object.prototype.hasOwnProperty.call(outputs, key)) {
                        outputs[key] = rule;
                    }
                }
            }
            const result = { inputs, outputs, type: fileType };
            importedFileCache.set(path, result);
            // Auto-expire cache after 10 seconds
            setTimeout(() => importedFileCache.delete(path), 10000);
            return result;
        } catch {
            importedFileCache.set(path, null);
            setTimeout(() => importedFileCache.delete(path), 5000);
            return null;
        }
    };

    /**
     * Detect if the cursor is inside the `inputs:` block of a `- call:` step.
     * Returns the call alias if so, null otherwise.
     */
    const getCallAliasForInputsContext = (lines: string[], lineNumber: number, currentIndent: number): string | null => {
        // Walk upward to find `inputs:` then the parent `- call:` line
        let foundInputs = false;
        let inputsIndent = -1;
        for (let i = lineNumber - 2; i >= 0; i--) {
            const line = lines[i];
            if (!line.trim()) { continue; }
            const indent = line.search(/\S|$/);
            const trimmed = line.trim();

            if (!foundInputs) {
                // We're looking for the `inputs:` parent of current line
                if (indent < currentIndent && /^inputs:\s*$/.test(trimmed)) {
                    foundInputs = true;
                    inputsIndent = indent;
                    continue;
                }
                if (indent < currentIndent) {
                    // Some other key at a lower indent — not under inputs
                    return null;
                }
                continue;
            }

            // We found inputs:, now look for the `- call:` parent
            if (indent < inputsIndent) {
                const callMatch = trimmed.match(/^-\s*call:\s*(.+)$/);
                if (callMatch) {
                    return callMatch[1].trim().replace(/^["']|["']$/g, '');
                }
                return null;
            }
        }
        return null;
    };

    // --- End of import-aware autocomplete helpers ---

    /**
     * Detect if the cursor is inside the `expect:` or `debug:` block of a `- call:` step.
     * Returns { alias, field: 'expect' | 'debug' } or null.
     */
    const getCallAliasForCheckContext = (lines: string[], lineNumber: number, currentIndent: number): { alias: string; field: string } | null => {
        let foundField = false;
        let fieldIndent = -1;
        let detectedField = 'expect';
        for (let i = lineNumber - 2; i >= 0; i--) {
            const line = lines[i];
            if (!line.trim()) { continue; }
            const indent = line.search(/\S|$/);
            const trimmed = line.trim();

            if (!foundField) {
                // Looking for expect: or debug: parent of current line
                if (indent < currentIndent && /^expect:\s*$/.test(trimmed)) {
                    foundField = true;
                    fieldIndent = indent;
                    detectedField = 'expect';
                    continue;
                }
                if (indent < currentIndent && /^debug:\s*$/.test(trimmed)) {
                    foundField = true;
                    fieldIndent = indent;
                    detectedField = 'debug';
                    continue;
                }
                if (indent < currentIndent) {
                    return null;
                }
                continue;
            }

            // Found expect/debug, now look for the `- call:` parent
            if (indent < fieldIndent) {
                const callMatch = trimmed.match(/^-\s*call:\s*(.+)$/);
                if (callMatch) {
                    return { alias: callMatch[1].trim().replace(/^["']|["']$/g, ''), field: detectedField };
                }
                return null;
            }
        }
        return null;
    };

    // Helper function to deduplicate suggestions by label
    const deduplicateSuggestions = (suggestions: any[]): any[] => {
        const uniqueLabels = new Set<string>();
        const uniqueSuggestions: any[] = [];

        for (const suggestion of suggestions) {
            if (!uniqueLabels.has(suggestion.label)) {
                uniqueLabels.add(suggestion.label);
                uniqueSuggestions.push(suggestion);
            }
        }

        return uniqueSuggestions;
    };

    const getListPrefixLength = (line: string, wordStartColumn: number): number => {
        if (wordStartColumn <= 1) {
            return 0;
        }

        const slice = line.slice(0, wordStartColumn - 1);
        const match = slice.match(/(-\s*)$/);

        if (!match) {
            return 0;
        }

        const dashIndex = slice.length - match[0].length;

        if (dashIndex === 0 || /\s/.test(slice[dashIndex - 1])) {
            return match[0].length;
        }

        return 0;
    };

    // Determine the parent context for suggestions
    const getParentContext = (lines: string[], currentIndent: number, docType: string | null): string => {
        // Check document type first
        if (currentIndent === 0 && docType) {
            return docType;
        }

        // Look for parent context by indentation
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (!line.trim()) continue;

            const indent = line.search(/\S|$/);
            if (indent < currentIndent) {
                const match = line.trim().match(/^\s*(\w+):/);
                if (match) {
                    return match[1];
                }

                // Handle list items: walk up to find the container key (e.g. steps:)
                // Must respect indentation — skip lines at same/deeper indent.
                if (line.trim().startsWith("- ")) {
                    const listItemIndent = indent;
                    for (let j = i - 1; j >= 0; j--) {
                        const upperLine = lines[j];
                        if (!upperLine.trim()) { continue; }
                        const upperIndent = upperLine.search(/\S|$/);
                        if (upperIndent >= listItemIndent) { continue; }
                        const upperMatch = upperLine.trim().match(/^\s*(\w+):/);
                        if (upperMatch) {
                            return upperMatch[1];
                        }
                        break;
                    }
                }
                break;
            }
        }
        return "root";
    };

    const suiteTestsItemFoldersCache = new Map<string, string[]>();
    const getSuiteTestsItemSuggestions = async (): Promise<any[]> => {
        if (!window?.vscode) {
            return [];
        }
        const folder = '.';
        const cached = suiteTestsItemFoldersCache.get(folder);
        const files = cached ?? await listFiles(folder, true);
        if (!cached) {
            suiteTestsItemFoldersCache.set(folder, files);
        }

        const suggestions = [
            {
                label: 'then',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: `- then`,
                detail: 'Suite barrier',
                documentation: 'Barrier token. Splits suite items into sequential groups.'
            },
            ...files
                .filter((p) => typeof p === 'string' && p.toLowerCase().endsWith('.mmt'))
                .sort((a, b) => a.localeCompare(b))
                .map((p) => ({
                    label: p,
                    kind: monaco.languages.CompletionItemKind.File,
                    insertText: `- ${p}`,
                    detail: 'MMT file',
                    documentation: `Run ${p} as part of the suite`,
                })),
        ];
        return deduplicateSuggestions(suggestions);
    };

    const suiteServersItemFoldersCache = new Map<string, string[]>();
    const getSuiteServersItemSuggestions = async (): Promise<any[]> => {
        if (!window?.vscode) {
            return [];
        }
        const folder = '.';
        const cached = suiteServersItemFoldersCache.get(folder);
        const files = cached ?? await listFiles(folder, true);
        if (!cached) {
            suiteServersItemFoldersCache.set(folder, files);
        }

        const suggestions = files
            .filter((p) => typeof p === 'string' && p.toLowerCase().endsWith('.mmt'))
            .sort((a, b) => a.localeCompare(b))
            .map((p) => ({
                label: p,
                kind: monaco.languages.CompletionItemKind.File,
                insertText: `- ${p}`,
                detail: 'MMT server file',
                documentation: `Start ${p} as a mock server for the suite`,
            }));
        return deduplicateSuggestions(suggestions);
    };

    const importValueFoldersCache = new Map<string, string[]>();
    const getImportValueSuggestions = async (typedValue: string): Promise<any[]> => {
        if (!window?.vscode) {
            return [];
        }
        const { folder, partial } = splitPathPrefix(typedValue);
        const cacheKey = folder;
        const cached = importValueFoldersCache.get(cacheKey);
        const files = cached ?? await listFiles(folder || '.', true);
        if (!cached) {
            importValueFoldersCache.set(cacheKey, files);
        }
        return deduplicateSuggestions(
            files
                .filter((p) => {
                    if (typeof p !== 'string') {
                        return false;
                    }
                    return dataImportProcessor.isImportAutocompletePath(p);
                })
                .filter((p) => {
                    const fileName = String(p).split('/').pop() ?? '';
                    return !partial || fileName.toLowerCase().startsWith(partial.toLowerCase());
                })
                .sort((a, b) => a.localeCompare(b))
                .map((p) => ({
                    label: p,
                    kind: monaco.languages.CompletionItemKind.File,
                    insertText: ` ${p}`,
                    detail: 'MMT, HTTP, Bruno, or data file',
                    documentation: `Import from ${p}`,
                }))
        );
    };

    // Get suggestions for a specific key's value
    const getValueSuggestions = (key: string): any[] => {
        const suggestions: any[] = [];

        // Specific key suggestions
        const byKey = (keySuggestionsByParent as any)?.[key];
        if (Array.isArray(byKey)) {
            suggestions.push(...byKey);
        }

        // If no specific suggestions found, add general suggestions
        if (suggestions.length === 0) {
            suggestions.push(...(keySuggestionsByParent.general || []));
        }

        // Deduplicate and return
        return deduplicateSuggestions(suggestions);
    };

    monaco.languages.registerCompletionItemProvider("yaml", {
        provideCompletionItems: async (model: any, position: any, context: any) => {
            // Only provide completions for YAML language
            if (model.getLanguageId() !== "yaml") {
                return { suggestions: [] };
            }

            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lines = model.getLinesContent().slice(0, lineNumber - 1);

            // Token suggestions: i:/e:/r:/c: and <<i:name>> / <<e:name>> forms.
            const tokenSource = lineContent.slice(0, Math.max(0, position.column - 1));
            const tokenMatch = matchTokenCompletion(tokenSource);
            if (tokenMatch) {
                const replaceStartColumn = tokenMatch.replaceFrom + 1;
                const namespaceItems = [
                    { prefix: 'i' as TokenPrefix, detail: 'Input from this file', doc: '<<i:name>> reads inputs: in this file.' },
                    { prefix: 'e' as TokenPrefix, detail: 'Environment variable', doc: '<<e:name>> reads a workspace environment value.' },
                    { prefix: 'r' as TokenPrefix, detail: 'Random value', doc: '<<r:uuid>> and other r: tokens generate a value at runtime.' },
                    { prefix: 'c' as TokenPrefix, detail: 'Current value', doc: '<<c:timestamp>> and other c: tokens insert the current value.' },
                ];
                let suggestionList: any[];
                if (tokenMatch.prefix === null) {
                    const typed = tokenMatch.typed.toLowerCase();
                    suggestionList = namespaceItems
                        .filter((item) => !typed || item.prefix.startsWith(typed))
                        .map((item) => ({
                            label: `${item.prefix}:`,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: `${item.prefix}:`,
                            detail: item.detail,
                            documentation: item.doc,
                            sortText: `0${item.prefix}`,
                        }));
                } else if (tokenMatch.prefix === 'i') {
                    suggestionList = getInputTokenSuggestions(model);
                } else {
                    const general = keySuggestionsByParent.general || [];
                    suggestionList = general
                        .filter((item: any) => String(item.label || '').startsWith(`${tokenMatch.prefix}:`))
                        .map((item: any) => ({
                            ...item,
                            insertText: String(item.insertText || item.label || '').replace(/^\s+/, ''),
                        }));
                }
                if (suggestionList.length > 0) {
                    return {
                        suggestions: withRange(suggestionList, completionRange(position, replaceStartColumn)),
                    };
                }
            }

            // Data import reference suggestions: ${alias.path}
            const dataImportSuggestions = await getDataImportRefSuggestions(model, tokenSource, position);
            if (dataImportSuggestions) {
                return { suggestions: dataImportSuggestions };
            }

            // Output token suggestions: ${callId.<field>}
            // When user types ${someId. or ${ someId. detect the call id and suggest output fields.
            const docType = detectAutocompleteDocType(model.getValue());
            if (docType === 'test') {
                const outputTokenMatch = tokenSource.match(/\$\{([A-Za-z_][A-Za-z0-9_]*)\.([\w]*)$/);
                if (outputTokenMatch) {
                    const callId = outputTokenMatch[1];
                    const callPairs = getCallIdsWithAliases(model);
                    const callPair = callPairs.find(c => c.id === callId);
                    if (callPair) {
                        const importMap = getImportMap(model);
                        const filePath = importMap[callPair.alias];
                        if (filePath) {
                            const parsed = await readAndParseImportedFile(filePath);
                            const suggestions: any[] = [];
                            if (parsed?.outputs) {
                                for (const [key, rule] of Object.entries(parsed.outputs)) {
                                    suggestions.push({
                                        label: `${callId}.${key}`,
                                        kind: monaco.languages.CompletionItemKind.Field,
                                        insertText: key,
                                        detail: `Output: ${rule || key}`,
                                        documentation: `Extracted output "${key}" from the API response.\nExtraction rule: ${rule || '(default)'}`,
                                        sortText: `0${key}`,
                                    });
                                }
                            }
                            // For test imports, outputs are returned as-is
                            if (parsed?.type === 'test' && parsed?.outputs) {
                                // Already added above
                            }
                            if (suggestions.length > 0) {
                                const dotPos = tokenSource.lastIndexOf('.');
                                const replaceStartColumn = dotPos + 2; // after the dot
                                return {
                                    suggestions: withRange(
                                        deduplicateSuggestions(suggestions),
                                        completionRange(position, replaceStartColumn),
                                    ),
                                };
                            }
                        }
                    }
                }
            }

            // Mock server request reference suggestions: ${url.id}, ${body.name}, ${header.x-api-key}
            if (docType === 'server') {
                const mockRefMatch = tokenSource.match(/\$\{(url|body|header|query)\.([\w.-]*)$/);
                if (mockRefMatch) {
                    const namespace = mockRefMatch[1];
                    const prefix = mockRefMatch[2].toLowerCase();
                    const refSuggestions = getMockServerRefSuggestions(model.getValue(), namespace)
                        .filter(item => !prefix || item.label.toLowerCase().startsWith(prefix))
                        .map(item => ({
                            label: `${namespace}.${item.label}`,
                            kind: monaco.languages.CompletionItemKind.Field,
                            insertText: item.label,
                            detail: item.detail,
                            documentation: item.documentation,
                            sortText: `0${item.label}`,
                        }));
                    if (refSuggestions.length > 0) {
                        const dotPos = tokenSource.lastIndexOf('.');
                        const replaceStartColumn = dotPos + 2;
                        return {
                            suggestions: withRange(
                                deduplicateSuggestions(refSuggestions),
                                completionRange(position, replaceStartColumn),
                            ),
                        };
                    }
                }

                const mockRefStart = tokenSource.match(/\$\{([\w.-]*)$/);
                if (mockRefStart && !mockRefStart[1].includes('.')) {
                    const namespaces = [
                        { ns: 'url', detail: 'Path and path parameters', doc: `Use \${url.id} for path params, \${url.path} for the full path.` },
                        { ns: 'body', detail: 'Request body fields', doc: `Echo JSON/XML body fields, e.g. \${body.name}.` },
                        { ns: 'header', detail: 'Request headers', doc: `Echo request headers, e.g. \${header.authorization}.` },
                        { ns: 'query', detail: 'Query string parameters', doc: `Echo query params, e.g. \${query.page}.` },
                    ];
                    const prefix = mockRefStart[1].toLowerCase();
                    const nsSuggestions = namespaces
                        .filter(item => !prefix || item.ns.startsWith(prefix))
                        .map(item => ({
                            label: `${item.ns}.`,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: `${item.ns}.`,
                            detail: item.detail,
                            documentation: item.doc,
                            sortText: `0${item.ns}`,
                        }));
                    const bracePos = tokenSource.lastIndexOf('${');
                    const replaceStartColumn = bracePos + 3;
                    return {
                        suggestions: withRange(nsSuggestions, completionRange(position, replaceStartColumn)),
                    };
                }
            }

            const currentIndent = lineContent.search(/\S|$/);
            const parentContext = getParentContext(lines, currentIndent, docType);

            const isImportValuePosition = (() => {
                const kvMatch = lineContent.match(/^(\s*)(\w+):\s*(.*)$/);
                if (!kvMatch || parentContext !== 'import') {
                    return false;
                }
                const colonPosition = lineContent.indexOf(':');
                return position.column >= colonPosition + 2;
            })();

            if (context?.triggerCharacter === '+' || context?.triggerCharacter === '/') {
                if (!isImportValuePosition) {
                    return { suggestions: [] };
                }
                if (context.triggerCharacter === '+') {
                    const typedValue = (lineContent.match(/^(\s*)(\w+):\s*(.*)$/)?.[3] ?? '')
                        .replace(/^\s+/, '');
                    if (typedValue === '+') {
                        return {
                            suggestions: [{
                                label: '+/',
                                kind: monaco.languages.CompletionItemKind.File,
                                insertText: '/',
                                detail: 'Project root import',
                                documentation: 'Import from the project root (multimeter.mmt folder). Continue typing to browse files.',
                                range: completionRange(position, position.column),
                            }],
                        };
                    }
                    return { suggestions: [] };
                }
            }

            // Detect whether the cursor is at a value position (after "key: ") on the current line.
            // When true, skip context-specific key suggestions and fall through to the general
            // value-suggestion path so that e:/r:/c: token suggestions are available.
            const cursorAtValuePosition = (() => {
                const kvMatch = lineContent.match(/^(\s*)-?\s*(\w+):\s/);
                if (kvMatch) {
                    const colonIdx = lineContent.indexOf(':', (kvMatch[1]?.length ?? 0));
                    if (colonIdx >= 0 && position.column > colonIdx + 2) {
                        return true;
                    }
                }
                return false;
            })();

            // Call inputs autocomplete: when inside inputs: of a call step, suggest the imported API/test's input keys
            // Example:
            //   - call: login
            //     inputs:
            //       <here>  ← suggest username, password, etc. from login.mmt
            if (docType === 'test' && parentContext === 'inputs' && !cursorAtValuePosition) {
                const allLines = model.getLinesContent();
                const callAlias = getCallAliasForInputsContext(allLines, lineNumber, currentIndent);
                if (callAlias) {
                    const importMap = getImportMap(model);
                    const filePath = importMap[callAlias];
                    if (filePath) {
                        const parsed = await readAndParseImportedFile(filePath);
                        if (parsed?.inputs && Object.keys(parsed.inputs).length > 0) {
                            const suggestionList = Object.entries(parsed.inputs).map(([key, defaultVal]) => ({
                                label: key,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: `${key}: `,
                                detail: defaultVal ? `Default: ${defaultVal}` : `Input parameter`,
                                documentation: `Input "${key}" from ${callAlias} (${filePath})${defaultVal ? `\nDefault value: ${defaultVal}` : ''}`,
                            }));
                            return {
                                suggestions: withRange(
                                    deduplicateSuggestions(suggestionList),
                                    wordCompletionRange(position, model.getWordUntilPosition(position)),
                                ),
                            };
                        }
                    }
                }
            }

            // Call inline expect autocomplete: when inside expect: of a call step,
            // suggest output parameters as map keys (e.g. status_code: , token: ).
            // Example:
            //   - call: login
            //     expect:
            //       <here>  ← suggest status_code: , token: , etc.
            if (docType === 'test' && (parentContext === 'expect' || parentContext === 'debug') && !cursorAtValuePosition) {
                const allLines = model.getLinesContent();
                const callInfo = getCallAliasForCheckContext(allLines, lineNumber, currentIndent);
                if (callInfo) {
                    const importMap = getImportMap(model);
                    const filePath = importMap[callInfo.alias];
                    if (filePath) {
                        const parsed = await readAndParseImportedFile(filePath);
                        const suggestionList: any[] = [];
                        if (parsed?.outputs) {
                            for (const [key, rule] of Object.entries(parsed.outputs)) {
                                const fieldLabel = callInfo.field === 'debug' ? 'Debug' : 'Expect';
                                suggestionList.push({
                                    label: key,
                                    kind: monaco.languages.CompletionItemKind.Field,
                                    insertText: `${key}: `,
                                    detail: `Output: ${rule || key}`,
                                    documentation: `${fieldLabel} output "${key}" from ${callInfo.alias}.\nExtraction rule: ${rule || '(default)'}\nExample:\n  ${callInfo.field}:\n    ${key}: == value`,
                                    sortText: `0${key}`,
                                });
                            }
                        }
                        if (suggestionList.length > 0) {
                            return {
                                suggestions: withRange(
                                    deduplicateSuggestions(suggestionList),
                                    wordCompletionRange(position, model.getWordUntilPosition(position)),
                                ),
                            };
                        }
                    }
                }
            }

            // Test: suggest list items under steps:/stages: when editing a dash line.
            // Example:
            // steps:
            //   - <here>
            // Works even if user already typed "- ".
            if (docType === 'test') {
                const trimmedLine = lineContent.trim();
                const isDashLine = trimmedLine === '-' || trimmedLine.startsWith('- ');
                const isBlankLine = trimmedLine === '';
                if ((parentContext === 'steps' || parentContext === 'stages') && (isDashLine || isBlankLine) && !cursorAtValuePosition) {
                    // For blank lines, check if we're at sibling indent of an existing step item
                    // (i.e. deeper than the dash). If so, skip — the sibling block below will handle it.
                    let isAtSiblingIndent = false;
                    if (isBlankLine && currentIndent > 0) {
                        for (let i = lines.length - 1; i >= 0; i--) {
                            const l = lines[i];
                            if (!l.trim()) { continue; }
                            const indent = l.search(/\S|$/);
                            if (indent >= currentIndent) { continue; }
                            if (indent < currentIndent && l.trim().match(/^-\s*\w+\s*:/)) {
                                isAtSiblingIndent = true;
                            }
                            break;
                        }
                    }
                    if (!isAtSiblingIndent) {
                        const suggestionList = (keySuggestionsByParent.steps || []).map((item: any) => {
                            const insertText = typeof item.insertText === 'string' ? item.insertText : '';
                            if (trimmedLine.startsWith('-')) {
                                // User already has '-' on the line; avoid inserting it twice.
                                if (insertText.startsWith('- ')) {
                                    return { ...item, insertText: insertText.slice(2) };
                                }
                                if (insertText.startsWith('-')) {
                                    return { ...item, insertText: insertText.slice(1) };
                                }
                            }
                            return item;
                        });

                        // On blank lines at step level, also include sibling suggestions
                        // from the previous step (e.g. title/details/report after - check:).
                        // This handles the case where Monaco auto-indents to the dash level,
                        // not the deeper sibling-property level.
                        if (isBlankLine) {
                            for (let i = lines.length - 1; i >= 0; i--) {
                                const l = lines[i];
                                if (!l.trim()) { continue; }
                                const indent = l.search(/\S|$/);
                                // Skip lines deeper than current (sibling properties like title:, id:)
                                if (indent > currentIndent) { continue; }
                                // At or above current indent, check for step pattern
                                const stepMatch = l.trim().match(/^-\s*(call|check|assert|if|for|repeat|data|print|js|set|var|const|let|delay|setenv)\s*:/);
                                if (stepMatch) {
                                    const siblingKey = `step-${stepMatch[1]}`;
                                    const siblingList = keySuggestionsByParent[siblingKey] || [];
                                    for (const sib of siblingList) {
                                        if (!suggestionList.some((s: any) => s.label === sib.label)) {
                                            suggestionList.push({
                                                ...sib,
                                                sortText: `~~~${sib.label}`,
                                            });
                                        }
                                    }
                                }
                                break;
                            }
                        }

                        const wordInfo = model.getWordUntilPosition(position);
                        const baseStartColumn = wordInfo?.startColumn ?? position.column;
                        const baseEndColumn = wordInfo?.endColumn ?? position.column;
                        // If line starts with "- ", replace from after the dash+space.
                        const dashOffset = trimmedLine.startsWith('-')
                            ? Math.min(lineContent.length, lineContent.indexOf('-') + 2)
                            : (baseStartColumn - 1);
                        const dashStart = Math.max(1, dashOffset + 1);

                        return {
                            suggestions: withRange(
                                suggestionList,
                                completionRange(position, dashStart, Math.max(baseEndColumn, dashStart)),
                            ),
                        };
                    }
                }
            }

            // Suite: suggest list items under items:
            //   items:
            //     - <here>
            const trimmed = lineContent.trim();
            const listPrefixLength = getListPrefixLength(lineContent, (model.getWordUntilPosition(position)?.startColumn ?? position.column));
            const inListItemLine = trimmed.startsWith('-') || trimmed === '';
            if (docType === 'suite' && inListItemLine) {
                if (parentContext === 'items' || parentContext === 'tests') {
                    const suggestionList = await getSuiteTestsItemSuggestions();
                    const wordInfo = model.getWordUntilPosition(position);
                    const wordRange = wordCompletionRange(position, wordInfo);
                    return {
                        suggestions: withRange(
                            suggestionList,
                            completionRange(
                                position,
                                Math.max(1, wordRange.startColumn - listPrefixLength),
                                wordRange.endColumn,
                            ),
                        ),
                    };
                }
                if (parentContext === 'servers') {
                    const suggestionList = await getSuiteServersItemSuggestions();
                    const wordInfo = model.getWordUntilPosition(position);
                    const wordRange = wordCompletionRange(position, wordInfo);
                    return {
                        suggestions: withRange(
                            suggestionList,
                            completionRange(
                                position,
                                Math.max(1, wordRange.startColumn - listPrefixLength),
                                wordRange.endColumn,
                            ),
                        ),
                    };
                }
            }

            // Handle value suggestions (after "key: ")
            const keyValueMatch = lineContent.match(/^(\s*)(\w+):\s*(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[2];
                const colonPosition = lineContent.indexOf(':');
                const valueStartColumn = colonPosition + 2;
                const typedValue = keyValueMatch[3] ?? '';

                // Import map values: suggest runnable imports and data files for `import:` entries
                // Example:
                // import:
                //   x: <here>
                if (parentContext === 'import' && position.column >= valueStartColumn) {
                    const suggestionList = await getImportValueSuggestions(typedValue);
                    return {
                        suggestions: withRange(
                            suggestionList,
                            completionRange(position, valueStartColumn, lineContent.length + 1),
                        )
                    };
                }

                // Only suggest values if cursor is after the colon
                if (position.column >= valueStartColumn) {
                    // In test files, report/internal/external keys get report-level values
                    const isReportLevelKey = docType === 'test' && (
                        (key === 'report' && (parentContext === 'steps' || parentContext === 'stages')) ||
                        ((key === 'internal' || key === 'external') && parentContext === 'report')
                    );
                    const isAuthTypeKey = key === 'type' && parentContext === 'auth';
                    const isFormatSideKey = (key === 'request' || key === 'response' || key === 'respond')
                        && parentContext === 'format';
                    const effectiveKey = isReportLevelKey ? 'report-level'
                        : isAuthTypeKey ? 'auth-type'
                        : isFormatSideKey ? 'format-value'
                        : key;
                    const suggestionList = getValueSuggestions(effectiveKey);

                    // When inside expect: or debug:, also suggest inline operators (==, !=, etc.)
                    if (docType === 'test' && (parentContext === 'expect' || parentContext === 'debug')) {
                        suggestionList.push(...(keySuggestionsByParent['expect-value'] || []));
                    }

                    if (suggestionList.length > 0) {
                        return {
                            suggestions: withRange(
                                suggestionList,
                                completionRange(position, valueStartColumn, lineContent.length + 1),
                            )
                        };
                    }
                    return { suggestions: [] };
                }
            }

            // Handle list item value suggestions (after "- key: ")
            const listItemMatch = lineContent.match(/^(\s*)-\s*(\w+):\s*(.*)$/);
            if (listItemMatch) {
                const key = listItemMatch[2];
                const colonPosition = lineContent.lastIndexOf(':');
                const valueStartColumn = colonPosition + 2;
                const typedValue = listItemMatch[3] ?? '';

                // Allow import inside list items too (rare but harmless)
                if (key === 'import' && position.column >= valueStartColumn) {
                    const suggestionList = await getImportValueSuggestions(typedValue);
                    return {
                        suggestions: withRange(
                            suggestionList,
                            completionRange(position, valueStartColumn, lineContent.length + 1),
                        )
                    };
                }

                if (position.column >= valueStartColumn) {
                    const suggestionList = getValueSuggestions(key);

                    if (suggestionList.length > 0) {
                        return {
                            suggestions: withRange(
                                suggestionList,
                                completionRange(position, valueStartColumn, lineContent.length + 1),
                            )
                        };
                    }
                    return { suggestions: [] };
                }
            }

            // Handle object-form check/assert under list items:
            // - check:
            //     <here>
            // Also handles when sibling properties already exist:
            // - check:
            //     actual: something
            //     <here>   ← still suggest expected, operator, etc.
            if (parentContext === 'steps' || parentContext === 'stages') {
                for (let i = lines.length - 1; i >= 0; i--) {
                    const l = lines[i];
                    if (!l.trim()) {
                        continue;
                    }
                    const indent = l.search(/\S|$/);
                    // Skip lines deeper than cursor
                    if (indent > currentIndent) {
                        continue;
                    }
                    // At same indent: skip sibling properties, but check step items (- xxx:)
                    if (indent === currentIndent) {
                        if (!l.trim().startsWith('- ')) {
                            continue; // sibling property like actual:, title: — skip
                        }
                        // dash line at same indent: could be step parent (Monaco auto-indent case)
                    }
                    // Check for - check: or - assert: with no value (object form)
                    const m = l.trim().match(/^-\s*(check|assert):\s*$/);
                    if (m) {
                        const containerKey = m[1];
                        const suggestionList = keySuggestionsByParent[containerKey] || [];
                        if (suggestionList.length > 0) {
                            return {
                                suggestions: withRange(
                                    suggestionList,
                                    wordCompletionRange(position, model.getWordUntilPosition(position)),
                                ),
                            };
                        }
                    }
                    break;
                }
            }

            // Step-sibling suggestions: when the cursor is on a line that is
            // a sibling property of a step list item (e.g. id/inputs after - call:)
            // Example:
            //   - call: login
            //     <cursor>   ← suggest id, inputs
            //   - check: x == 1
            //     <cursor>   ← suggest title, details, report
            if (docType === 'test' && (parentContext === 'steps' || parentContext === 'stages')) {
                const trimmedLine = lineContent.trim();
                // Check if cursor is at sibling indent of a step item:
                // walk up to find the nearest `- <stepType>:` at a lower indent
                const isSiblingCandidate = !trimmedLine.startsWith('- ');
                if (isSiblingCandidate) {
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const l = lines[i];
                        if (!l.trim()) { continue; }
                        const indent = l.search(/\S|$/);
                        // Skip lines deeper than cursor
                        if (indent > currentIndent) { continue; }
                        // At same indent: skip sibling properties, but check step items (- xxx:)
                        if (indent === currentIndent && !l.trim().startsWith('- ')) {
                            continue; // sibling property like id:, title: — skip
                        }
                        // Check for step pattern (at same or lower indent)
                        const stepMatch = l.trim().match(/^-\s*(call|check|assert|if|for|repeat|data|print|js|set|var|const|let|delay|setenv)\s*:/);
                        if (stepMatch) {
                            const stepType = stepMatch[1];
                            const siblingKey = `step-${stepType}`;
                            const suggestionList = keySuggestionsByParent[siblingKey] || [];
                            if (suggestionList.length > 0) {
                                return {
                                    suggestions: withRange(
                                        deduplicateSuggestions(suggestionList),
                                        wordCompletionRange(position, model.getWordUntilPosition(position)),
                                    ),
                                };
                            }
                        }
                        break;
                    }
                }
            }

            // Get parent-specific suggestions and deduplicate
            // When inside report: of a test step, use step-report suggestions (internal/external)
            // instead of type: report file-level suggestions
            const effectiveContext = (parentContext === 'report' && docType === 'test')
                ? 'step-report'
                : parentContext === 'format'
                    ? 'format-keys'
                    : parentContext;
            const parentSuggestions = keySuggestionsByParent[effectiveContext] || [];
            const baseSuggestions = deduplicateSuggestions(parentSuggestions);

            const wordInfo = model.getWordUntilPosition(position);
            const baseStartColumn = wordInfo?.startColumn ?? position.column;
            const baseEndColumn = wordInfo?.endColumn ?? position.column;
            const listPrefixLength2 = getListPrefixLength(lineContent, baseStartColumn);

            const suggestions = baseSuggestions.map(item => {
                const insertText = typeof item.insertText === 'string' ? item.insertText.trimStart() : '';
                const needsListPrefix = insertText.startsWith('-');
                const startColumn = needsListPrefix
                    ? Math.max(1, baseStartColumn - listPrefixLength2)
                    : baseStartColumn;

                return {
                    ...item,
                    documentation: item.documentation,
                    range: completionRange(position, startColumn, baseEndColumn),
                };
            });

            return { suggestions };
        },
        triggerCharacters: ["\n", " ", ":", "-", ".", "$", "{", "+", "/", "<"],
    });

    // Validation setup
    let validationTimeout: NodeJS.Timeout;

    const validateModel = (model: any) => {
        if (model.getLanguageId() !== "yaml") return;

        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
            const content = model.getValue();
            const markers = validateYamlContent(content);
            monaco.editor.setModelMarkers(model, 'mmt-validation', markers);
        }, 500);
    };

    // Register validation for new and existing models
    monaco.editor.onDidCreateModel((model: any) => {
        if (model.getLanguageId() === "yaml") {
            validateModel(model);
            model.onDidChangeContent(() => validateModel(model));
        }
    });

    // Validate existing YAML models
    monaco.editor.getModels().forEach((model: any) => {
        if (model.getLanguageId() === "yaml") {
            validateModel(model);
            model.onDidChangeContent(() => validateModel(model));
        }
    });
};