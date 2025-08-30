import { validateYamlContent } from './Validate';
import { KeySuggestionsByParent } from './AutoComplete';
import { loadEnvVariables } from '../workspaceStorage';
import { JSONValue } from '../CommonData';

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

    // Determine the parent context for suggestions
    const getParentContext = (lines: string[], currentIndent: number, firstLine: string): string => {
        // Check document type first
        if (currentIndent === 0) {
            if (firstLine === "type: api") return "api";
            if (firstLine === "type: env") return "env";
            if (firstLine === "type: var") return "var";
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
        provideCompletionItems: (model: any, position: any) => {
            // Only provide completions for YAML language
            if (model.getLanguageId() !== "yaml") {
                return { suggestions: [] };
            }

            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lines = model.getLinesContent().slice(0, lineNumber - 1);

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

            // Handle key suggestions (for new lines)
            const currentIndent = lineContent.search(/\S|$/);
            const firstLine = model.getLineContent(1).trim();
            const parent = getParentContext(lines, currentIndent, firstLine);

            // Get parent-specific suggestions and deduplicate
            const parentSuggestions = keySuggestionsByParent[parent] || [];
            const baseSuggestions = deduplicateSuggestions(parentSuggestions);

            const suggestions = baseSuggestions.map(item => ({
                ...item,
                documentation: item.documentation,
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: model.getLineFirstNonWhitespaceColumn(position.lineNumber) || 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                }
            }));

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