import { validateYamlContent } from './Validate';
import { KeySuggestionsByParent } from './AutoComplete';
import { loadEnvVariables } from '../workspaceStorage';
import { JSONValue } from 'mmt-core/CommonData';

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

    // Store loaded environment variables
    let envVariables: { name: string; label: string; value: JSONValue }[] = [];

    // Load environment variables from workspace storage
    loadEnvVariables((variables) => {
        envVariables = variables;
    });

    // Function to get environment variables as suggestions
    const getEnvironmentVariableSuggestions = () => {
        return envVariables.map(envVar => ({
            label: envVar.name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: envVar.name,
            documentation: envVar.label || `Environment variable: ${envVar.name}`,
            detail: `Value: ${envVar.value || 'undefined'}`
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
    const getSuiteTestsItemSuggestions = async (indent: number): Promise<any[]> => {
        if (!window?.vscode) {
            return [];
        }
        const folder = '.';
        const cached = suiteTestsItemFoldersCache.get(folder);
        const files = cached ?? await listFiles(folder, true);
        if (!cached) {
            suiteTestsItemFoldersCache.set(folder, files);
        }

        const mkRangePrefix = ' '.repeat(indent);
        const makeInsert = (value: string) => `${mkRangePrefix}- ${value}`;
        const suggestions = [
            {
                label: 'then',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: makeInsert('then'),
                detail: 'Suite barrier',
                documentation: 'Barrier token. Splits suite tests into sequential groups.'
            },
            ...files
                .filter((p) => typeof p === 'string' && p.toLowerCase().endsWith('.mmt'))
                .sort((a, b) => a.localeCompare(b))
                .map((p) => ({
                    label: p,
                    kind: monaco.languages.CompletionItemKind.File,
                    insertText: makeInsert(p),
                    detail: 'MMT file',
                    documentation: `Run ${p} as part of the suite`,
                })),
        ];
        return deduplicateSuggestions(suggestions);
    };

    // Get suggestions for a specific key's value
    const getValueSuggestions = (key: string): any[] => {
        const suggestions: any[] = [];

        // Environment variable keys
        if (key === 'key' || key === 'name' || key === 'variable' || key === 'env') {
            suggestions.push(...getEnvironmentVariableSuggestions());
        }

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

            const firstLine = model.getLineContent(1).trim();
            const currentIndent = lineContent.search(/\S|$/);

            // Suite: suggest list items under tests:
            //   tests:
            //     - <here>
            const trimmed = lineContent.trim();
            const listPrefixLength = getListPrefixLength(lineContent, (model.getWordUntilPosition(position)?.startColumn ?? position.column));
            const inListItemLine = trimmed.startsWith('-') || trimmed === '';
            if (firstLine === 'type: suite' && inListItemLine) {
                const parent = getParentContext(lines, currentIndent, firstLine);
                if (parent === 'tests') {
                    const suggestionList = await getSuiteTestsItemSuggestions(currentIndent);
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

            // Handle key suggestions (for new lines or mid-line insertion)
            const parent = getParentContext(lines, currentIndent, firstLine);

            // Get parent-specific suggestions and deduplicate
            const parentSuggestions = keySuggestionsByParent[parent] || [];
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