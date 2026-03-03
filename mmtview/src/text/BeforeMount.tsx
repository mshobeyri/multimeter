import { validateYamlContent } from './Validate';
import { KeySuggestionsByParent } from './AutoComplete';
import { readFile } from '../vsAPI';

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
    const keySuggestionsByParent = KeySuggestionsByParent(monaco);

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
        try {
            const value = String(model?.getValue?.() ?? '');
            const lines = value.split(/\r?\n/);
            let inInputs = false;
            let inputsIndent = 0;
            let childIndent: number | null = null;
            const keys: string[] = [];
            for (const line of lines) {
                if (!line.trim()) {
                    continue;
                }
                const indent = line.search(/\S|$/);
                const trimmed = line.trim();
                if (!inInputs) {
                    if (/^inputs:\s*$/.test(trimmed)) {
                        inInputs = true;
                        inputsIndent = indent;
                        childIndent = null;
                    }
                    continue;
                }

                if (indent <= inputsIndent) {
                    break;
                }

                if (childIndent === null) {
                    childIndent = indent;
                }

                if (indent !== childIndent) {
                    continue;
                }

                const keyMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/);
                if (keyMatch) {
                    keys.push(keyMatch[1]);
                }
            }
            return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
        } catch {
            return [];
        }
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
        try {
            const value = String(model?.getValue?.() ?? '');
            const lines = value.split(/\r?\n/);
            let inImport = false;
            let importIndent = 0;
            let childIndent: number | null = null;
            const map: Record<string, string> = {};
            for (const line of lines) {
                if (!line.trim()) { continue; }
                const indent = line.search(/\S|$/);
                const trimmed = line.trim();
                if (!inImport) {
                    if (/^import:\s*$/.test(trimmed) && indent === 0) {
                        inImport = true;
                        importIndent = indent;
                        childIndent = null;
                    }
                    continue;
                }
                if (indent <= importIndent) { break; }
                if (childIndent === null) { childIndent = indent; }
                if (indent !== childIndent) { continue; }
                const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
                if (m) {
                    map[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
                }
            }
            return map;
        } catch {
            return {};
        }
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
            const lines = content.split(/\r?\n/);
            const inputs: Record<string, string> = {};
            const outputs: Record<string, string> = {};
            let fileType = '';

            // Parse type
            for (const line of lines) {
                const tm = line.trim().match(/^type:\s*(.+)$/);
                if (tm) {
                    fileType = tm[1].trim();
                    break;
                }
            }

            // Parse inputs: section
            let section: 'none' | 'inputs' | 'outputs' = 'none';
            let sectionIndent = 0;
            let childIndent: number | null = null;
            for (const line of lines) {
                if (!line.trim()) { continue; }
                const indent = line.search(/\S|$/);
                const trimmed = line.trim();
                if (/^inputs:\s*$/.test(trimmed) && indent === 0) {
                    section = 'inputs';
                    sectionIndent = indent;
                    childIndent = null;
                    continue;
                }
                if (/^outputs:\s*$/.test(trimmed) && indent === 0) {
                    section = 'outputs';
                    sectionIndent = indent;
                    childIndent = null;
                    continue;
                }
                if (section !== 'none') {
                    if (indent <= sectionIndent && !/^\s*$/.test(line)) {
                        // Check if this is a new top-level key
                        if (indent === 0) {
                            section = 'none';
                            childIndent = null;
                            continue;
                        }
                    }
                    if (indent > sectionIndent) {
                        if (childIndent === null) { childIndent = indent; }
                        if (indent === childIndent) {
                            const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
                            if (m) {
                                const target = section === 'inputs' ? inputs : outputs;
                                target[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
                            }
                        }
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
     * Detect if the cursor is inside the `check:` or `assert:` list of a `- call:` step.
     * Returns { alias, field } where field is 'check' or 'assert', or null otherwise.
     */
    const getCallAliasForCheckContext = (lines: string[], lineNumber: number, currentIndent: number): { alias: string; field: string } | null => {
        let foundField = false;
        let fieldIndent = -1;
        let field = '';
        for (let i = lineNumber - 2; i >= 0; i--) {
            const line = lines[i];
            if (!line.trim()) { continue; }
            const indent = line.search(/\S|$/);
            const trimmed = line.trim();

            if (!foundField) {
                // Looking for check: or assert: parent of current line
                if (indent < currentIndent && /^(check|assert):\s*$/.test(trimmed)) {
                    foundField = true;
                    fieldIndent = indent;
                    field = trimmed.replace(/:.*/, '');
                    continue;
                }
                if (indent < currentIndent) {
                    return null;
                }
                continue;
            }

            // Found check/assert, now look for the `- call:` parent
            if (indent < fieldIndent) {
                const callMatch = trimmed.match(/^-\s*call:\s*(.+)$/);
                if (callMatch) {
                    return { alias: callMatch[1].trim().replace(/^["']|["']$/g, ''), field };
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
    const getParentContext = (lines: string[], currentIndent: number, firstLine: string): string => {
        // Check document type first
        if (currentIndent === 0) {
            if (firstLine === "type: api") return "api";
            if (firstLine === "type: env") return "env";
            if (firstLine === "type: doc") return "doc";
            if (firstLine === "type: test") return "test";
            if (firstLine === "type: suite") return "suite";
            if (firstLine === "type: mock") return "mock";
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
                documentation: 'Barrier token. Splits suite tests into sequential groups.'
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
                .filter((p) => typeof p === 'string' && (p.toLowerCase().endsWith('.mmt') || p.toLowerCase().endsWith('.csv')))
                .filter((p) => {
                    const fileName = String(p).split('/').pop() ?? '';
                    return !partial || fileName.toLowerCase().startsWith(partial.toLowerCase());
                })
                .sort((a, b) => a.localeCompare(b))
                .map((p) => ({
                    label: p,
                    kind: monaco.languages.CompletionItemKind.File,
                    insertText: ` ${p}`,
                    detail: 'MMT or CSV file',
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
        provideCompletionItems: async (model: any, position: any) => {
            // Only provide completions for YAML language
            if (model.getLanguageId() !== "yaml") {
                return { suggestions: [] };
            }

            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lines = model.getLinesContent().slice(0, lineNumber - 1);

            // Token suggestions: i:<name> for current file inputs:
            // Mirror e:/r: behavior from general suggestions but scoped to this document.
            const tokenSource = lineContent.slice(0, Math.max(0, position.column - 1));
            const tokenMatch = tokenSource.match(/(^|\s)(i:)([\w-]*)$/);
            if (tokenMatch) {
                const suggestionList = getInputTokenSuggestions(model);
                const replaceStartColumn = Math.max(1, position.column - tokenMatch[2].length - tokenMatch[3].length);
                return {
                    suggestions: suggestionList.map((item) => ({
                        ...item,
                        range: {
                            startLineNumber: position.lineNumber,
                            startColumn: replaceStartColumn,
                            endLineNumber: position.lineNumber,
                            endColumn: position.column,
                        }
                    }))
                };
            }

            // Output token suggestions: ${callId.<field>}
            // When user types ${someId. or ${ someId. detect the call id and suggest output fields.
            const firstLine = model.getLineContent(1).trim();
            if (firstLine === 'type: test') {
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
                            // Always suggest built-in fields
                            suggestions.push({
                                label: `${callId}.statusCode_`,
                                kind: monaco.languages.CompletionItemKind.Property,
                                insertText: 'statusCode_',
                                detail: 'HTTP status code (number)',
                                documentation: `The HTTP status code returned by the API call (e.g. 200, 404, 500).`,
                                sortText: '~0',
                            });
                            suggestions.push({
                                label: `${callId}.details_`,
                                kind: monaco.languages.CompletionItemKind.Property,
                                insertText: 'details_',
                                detail: 'Full request/response JSON',
                                documentation: `JSON stringified object containing the full request and response details.`,
                                sortText: '~1',
                            });
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
                                    suggestions: deduplicateSuggestions(suggestions).map((item) => ({
                                        ...item,
                                        range: {
                                            startLineNumber: position.lineNumber,
                                            startColumn: replaceStartColumn,
                                            endLineNumber: position.lineNumber,
                                            endColumn: position.column,
                                        }
                                    }))
                                };
                            }
                        }
                    }
                }
            }

            const currentIndent = lineContent.search(/\S|$/);
            const parentContext = getParentContext(lines, currentIndent, firstLine);

            // Call inputs autocomplete: when inside inputs: of a call step, suggest the imported API/test's input keys
            // Example:
            //   - call: login
            //     inputs:
            //       <here>  ← suggest username, password, etc. from login.mmt
            if (firstLine === 'type: test' && parentContext === 'inputs') {
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
                            const wordInfo = model.getWordUntilPosition(position);
                            const baseStartColumn = wordInfo?.startColumn ?? position.column;
                            const baseEndColumn = wordInfo?.endColumn ?? position.column;
                            return {
                                suggestions: deduplicateSuggestions(suggestionList).map((item) => ({
                                    ...item,
                                    range: {
                                        startLineNumber: position.lineNumber,
                                        startColumn: baseStartColumn,
                                        endLineNumber: position.lineNumber,
                                        endColumn: baseEndColumn,
                                    }
                                }))
                            };
                        }
                    }
                }
            }

            // Call inline check/assert autocomplete: when inside check: or assert: list of a call step,
            // suggest output parameters of the called API/test as comparison expressions.
            // Example:
            //   - call: login
            //     check:
            //       - <here>  ← suggest status == , token == , etc.
            if (firstLine === 'type: test' && (parentContext === 'check' || parentContext === 'assert')) {
                const allLines = model.getLinesContent();
                const callInfo = getCallAliasForCheckContext(allLines, lineNumber, currentIndent);
                if (callInfo) {
                    const importMap = getImportMap(model);
                    const filePath = importMap[callInfo.alias];
                    if (filePath) {
                        const parsed = await readAndParseImportedFile(filePath);
                        const suggestionList: any[] = [];
                        // Always suggest built-in fields
                        suggestionList.push({
                            label: 'statusCode_ == ',
                            kind: monaco.languages.CompletionItemKind.Property,
                            insertText: 'statusCode_ == ',
                            detail: 'HTTP status code',
                            documentation: `Check the HTTP status code of the ${callInfo.alias} call.\nExample: statusCode_ == 200`,
                            sortText: '~0',
                        });
                        if (parsed?.outputs) {
                            for (const [key, rule] of Object.entries(parsed.outputs)) {
                                suggestionList.push({
                                    label: `${key} == `,
                                    kind: monaco.languages.CompletionItemKind.Field,
                                    insertText: `${key} == `,
                                    detail: `Output: ${rule || key}`,
                                    documentation: `Check output "${key}" from ${callInfo.alias}.\nExtraction rule: ${rule || '(default)'}`,
                                    sortText: `0${key}`,
                                });
                            }
                        }
                        if (suggestionList.length > 0) {
                            const wordInfo = model.getWordUntilPosition(position);
                            const baseStartColumn = wordInfo?.startColumn ?? position.column;
                            const baseEndColumn = wordInfo?.endColumn ?? position.column;
                            const trimmedLine = lineContent.trim();
                            const dashOffset = trimmedLine.startsWith('-')
                                ? Math.min(lineContent.length, lineContent.indexOf('-') + 2)
                                : (baseStartColumn - 1);
                            return {
                                suggestions: deduplicateSuggestions(suggestionList).map((item) => ({
                                    ...item,
                                    range: {
                                        startLineNumber: position.lineNumber,
                                        startColumn: Math.max(1, dashOffset + 1),
                                        endLineNumber: position.lineNumber,
                                        endColumn: Math.max(baseEndColumn, dashOffset + 1),
                                    }
                                }))
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
            if (firstLine === 'type: test') {
                const trimmedLine = lineContent.trim();
                const isDashLine = trimmedLine === '-' || trimmedLine.startsWith('- ');
                const isBlankLine = trimmedLine === '';
                if ((parentContext === 'steps' || parentContext === 'stages') && (isDashLine || isBlankLine)) {
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

                        return {
                            suggestions: suggestionList.map((item: any) => ({
                                ...item,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: Math.max(1, dashOffset + 1),
                                    endLineNumber: position.lineNumber,
                                    endColumn: Math.max(baseEndColumn, dashOffset + 1),
                                }
                            }))
                        };
                    }
                }
            }

            // Suite: suggest list items under tests:
            //   tests:
            //     - <here>
            const trimmed = lineContent.trim();
            const listPrefixLength = getListPrefixLength(lineContent, (model.getWordUntilPosition(position)?.startColumn ?? position.column));
            const inListItemLine = trimmed.startsWith('-') || trimmed === '';
            if (firstLine === 'type: suite' && inListItemLine) {
                if (parentContext === 'tests') {
                    const suggestionList = await getSuiteTestsItemSuggestions();
                    const wordInfo = model.getWordUntilPosition(position);
                    const baseStartColumn = wordInfo?.startColumn ?? position.column;
                    const baseEndColumn = wordInfo?.endColumn ?? position.column;
                    return {
                        suggestions: suggestionList.map((item) => ({
                            ...item,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: Math.max(1, baseStartColumn - listPrefixLength),
                                endLineNumber: position.lineNumber,
                                endColumn: baseEndColumn,
                            }
                        }))
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

                // Import map values: suggest .mmt files for `import:` / `imports:` entries
                // Example:
                // import:
                //   x: <here>
                if (parentContext === 'import' && position.column >= valueStartColumn) {
                    const suggestionList = await getImportValueSuggestions(typedValue);
                    return {
                        suggestions: suggestionList.map(item => ({
                            ...item,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: valueStartColumn,
                                endLineNumber: position.lineNumber,
                                endColumn: lineContent.length + 1
                            }
                        }))
                    };
                }

                // Only suggest values if cursor is after the colon
                if (position.column >= valueStartColumn) {
                    const suggestionList = getValueSuggestions(key);

                    if (suggestionList.length > 0) {
                        return {
                            suggestions: suggestionList.map(item => ({
                                ...item,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: valueStartColumn,
                                    endLineNumber: position.lineNumber,
                                    endColumn: lineContent.length + 1
                                }
                            }))
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

                // Allow imports inside list items too (rare but harmless)
                if ((key === 'import' || key === 'imports') && position.column >= valueStartColumn) {
                    const suggestionList = await getImportValueSuggestions(typedValue);
                    return {
                        suggestions: suggestionList.map(item => ({
                            ...item,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: valueStartColumn,
                                endLineNumber: position.lineNumber,
                                endColumn: lineContent.length + 1
                            }
                        }))
                    };
                }

                if (position.column >= valueStartColumn) {
                    const suggestionList = getValueSuggestions(key);

                    if (suggestionList.length > 0) {
                        return {
                            suggestions: suggestionList.map(item => ({
                                ...item,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: valueStartColumn,
                                    endLineNumber: position.lineNumber,
                                    endColumn: lineContent.length + 1
                                }
                            }))
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
                            const wordInfo = model.getWordUntilPosition(position);
                            const baseStartColumn = wordInfo?.startColumn ?? position.column;
                            const baseEndColumn = wordInfo?.endColumn ?? position.column;
                            return {
                                suggestions: suggestionList.map((item: any) => ({
                                    ...item,
                                    range: {
                                        startLineNumber: position.lineNumber,
                                        startColumn: baseStartColumn,
                                        endLineNumber: position.lineNumber,
                                        endColumn: baseEndColumn,
                                    }
                                }))
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
            if (firstLine === 'type: test' && (parentContext === 'steps' || parentContext === 'stages')) {
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
                                const wordInfo = model.getWordUntilPosition(position);
                                const baseStartColumn = wordInfo?.startColumn ?? position.column;
                                const baseEndColumn = wordInfo?.endColumn ?? position.column;
                                return {
                                    suggestions: deduplicateSuggestions(suggestionList).map((item: any) => ({
                                        ...item,
                                        range: {
                                            startLineNumber: position.lineNumber,
                                            startColumn: baseStartColumn,
                                            endLineNumber: position.lineNumber,
                                            endColumn: baseEndColumn,
                                        }
                                    }))
                                };
                            }
                        }
                        break;
                    }
                }
            }

            // Get parent-specific suggestions and deduplicate
            const parentSuggestions = keySuggestionsByParent[parentContext] || [];
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
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn,
                        endLineNumber: position.lineNumber,
                        endColumn: baseEndColumn
                    }
                };
            });

            return { suggestions };
        },
        triggerCharacters: ["\n", " ", ":", "-", ".", "$", "{"],
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