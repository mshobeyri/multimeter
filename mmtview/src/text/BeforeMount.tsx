import { validateYamlContent } from './Validate';
import { KeySuggestionsByParent } from './AutoComplete';

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

    const getInputTokenSuggestions = (model: any, prefixWithSpace: boolean): any[] => {
        const names = getInputsKeysFromModel(model);
        const lead = prefixWithSpace ? ' ' : '';
        return names.map((name) => ({
            label: 'i:' + name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: lead + 'i:' + name,
            documentation: `Input token i:${name} (from this file's inputs:)`,
            detail: `Input: ${name}`,
        }));
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

                // Handle list items
                if (line.trim().startsWith("- ")) {
                    for (let j = i - 1; j >= 0; j--) {
                        const upperLine = lines[j];
                        if (!upperLine.trim()) continue;
                        const upperMatch = upperLine.trim().match(/^\s*(\w+):/);
                        if (upperMatch) {
                            return upperMatch[1];
                        }
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
    const getImportValueSuggestions = async (): Promise<any[]> => {
        if (!window?.vscode) {
            return [];
        }
        const folder = '.';
        const cached = importValueFoldersCache.get(folder);
        const files = cached ?? await listFiles(folder, true);
        if (!cached) {
            importValueFoldersCache.set(folder, files);
        }
        return deduplicateSuggestions(
            files
                .filter((p) => typeof p === 'string' && (p.toLowerCase().endsWith('.mmt') || p.toLowerCase().endsWith('.csv')))
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
        if (key in keySuggestionsByParent) {
            suggestions.push(...keySuggestionsByParent[key]);
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
                const prefixWithSpace = tokenMatch[1] === ' ';
                const suggestionList = getInputTokenSuggestions(model, prefixWithSpace);
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

            const firstLine = model.getLineContent(1).trim();
            const currentIndent = lineContent.search(/\S|$/);
            const parentContext = getParentContext(lines, currentIndent, firstLine);

            // Test: suggest list items under steps:/stages: when editing a dash line.
            // Example:
            // steps:
            //   - <here>
            // Works even if user already typed "- ".
            if (firstLine === 'type: test') {
                const trimmedLine = lineContent.trim();
                const isDashLine = trimmedLine === '-' || trimmedLine.startsWith('- ') || trimmedLine === '';
                if ((parentContext === 'steps' || parentContext === 'stages') && isDashLine) {
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

                // Import map values: suggest .mmt files for `import:` / `imports:` entries
                // Example:
                // import:
                //   x: <here>
                if (parentContext === 'import' && position.column >= valueStartColumn) {
                    const suggestionList = await getImportValueSuggestions();
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

                // Allow imports inside list items too (rare but harmless)
                if ((key === 'import' || key === 'imports') && position.column >= valueStartColumn) {
                    const suggestionList = await getImportValueSuggestions();
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
            // In this case, the YAML parentContext will likely be "steps" (or similar),
            // but we want to offer the check/assert object keys.
            if (parentContext === 'steps' || parentContext === 'stages') {
                for (let i = lines.length - 1; i >= 0; i--) {
                    const l = lines[i];
                    if (!l.trim()) {
                        continue;
                    }
                    const indent = l.search(/\S|$/);
                    if (indent >= currentIndent) {
                        continue;
                    }
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
        triggerCharacters: ["\n", " ", ":", "-"],
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