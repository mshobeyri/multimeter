import { validateYamlContent } from './Validate';
import { KeySuggestionsByParent } from './AutoComplete';

export const handleBeforeMount = (monaco: any) => {
   const keySuggestionsByParent = KeySuggestionsByParent(monaco);

    monaco.languages.registerCompletionItemProvider("yaml", {
        provideCompletionItems: (model: any, position: any) => {
            // Only provide completions for YAML language
            const language = model.getLanguageId();
            if (language !== "yaml") {
                return { suggestions: [] };
            }

            const lineNumber = position.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const lines = model.getLinesContent().slice(0, lineNumber - 1);

            // Check if current line is like: key: <cursor> (maybe with spaces)
            const keyValueMatch = lineContent.match(/^(\s*)(\w+):\s*(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[2];
                const colonPosition = lineContent.indexOf(':');
                const valueStartColumn = colonPosition + 2;

                if (position.column >= valueStartColumn) {
                    if (key in keySuggestionsByParent) {
                        return {
                            suggestions: keySuggestionsByParent[key].map(item => ({
                                ...item,
                                documentation: `${item.documentation}`,
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

            // Check if we're in a list item context (after "- key: ")
            const listItemMatch = lineContent.match(/^(\s*):\s*(.*)$/);
            if (listItemMatch) {
                const indentation = listItemMatch[1];
                const key = listItemMatch[2];
                const colonPosition = lineContent.lastIndexOf(':');
                const valueStartColumn = colonPosition + 2;

                if (position.column >= valueStartColumn) {
                    // For list items, use the key as context
                    if (key in keySuggestionsByParent) {
                        return {
                            suggestions: keySuggestionsByParent[key].map(item => ({
                                ...item,
                                documentation: `${item.documentation}`,
                                range: {
                                    startLineNumber: position.lineNumber,
                                    startColumn: valueStartColumn,
                                    endLineNumber: position.lineNumber,
                                    endColumn: lineContent.length + 1
                                }
                            }))
                        };
                    }

                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i];
                        if (!line.trim()) continue;

                        const indent = line.search(/\S|$/);
                        if (indent < indentation.length) {
                            const match = line.trim().match(/^(\w+):/);
                            if (match && match[1] === "outputs") {
                                return {
                                    suggestions: keySuggestionsByParent.outputs.map(item => ({
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
                            break;
                        }
                    }

                    return { suggestions: [] };
                }
            }

            let parent = "root";
            const currentIndent = lineContent.search(/\S|$/);

            if (currentIndent === 0 && model.getLineContent(1).trim() === ("type: api")) {
                parent = "api";
            } else if (currentIndent === 0 && model.getLineContent(1).trim() === ("type: env")) {
                parent = "env";
            } else if (currentIndent === 0 && model.getLineContent(1).trim() === ("type: var")) {
                parent = "var";
            } else {
                // Look for parent context by indentation
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i];
                    if (!line.trim()) continue;

                    const indent = line.search(/\S|$/);
                    if (indent < currentIndent) {
                        const match = line.trim().match(/^\s*(\w+):/);
                        if (match) {
                            parent = match[1];
                            break;
                        }

                        if (line.trim().startsWith("- ")) {
                            for (let j = i - 1; j >= 0; j--) {
                                const upperLine = lines[j];
                                if (!upperLine.trim()) continue;
                                const upperMatch = upperLine.trim().match(/^\s*(\w+):/);
                                if (upperMatch) {
                                    parent = upperMatch[1];
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            const baseSuggestions = keySuggestionsByParent[parent] || [];

            const suggestions = baseSuggestions.map(item => ({
                ...item,
                documentation: item.documentation,
                range: {
                    startLineNumber: position.lineNumber,
                    startColumn: model.getLineFirstNonWhitespaceColumn(position.lineNumber) || position.lineNumber,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                }
            }));

            return { suggestions };
        },
        triggerCharacters: ["\n", " ", ":", "-"],
    });

    // Add validation provider with language filtering
    let validationTimeout: NodeJS.Timeout;

    const validateModel = (model: any) => {
        // Only validate YAML models
        const language = model.getLanguageId();
        if (language !== "yaml") {
            return;
        }

        clearTimeout(validationTimeout);

        // Debounce validation by 500ms
        validationTimeout = setTimeout(() => {
            const content = model.getValue();
            const markers = validateYamlContent(content);

            // Set markers on the model
            monaco.editor.setModelMarkers(model, 'mmt-validation', markers);
        }, 500);
    };

    // Register model change listener for validation
    monaco.editor.onDidCreateModel((model: any) => {
        // Only validate YAML models
        if (model.getLanguageId() === "yaml") {
            validateModel(model);

            // Validate when content changes
            model.onDidChangeContent(() => {
                validateModel(model);
            });
        }
    });

    // Also validate existing models (only YAML ones)
    const models = monaco.editor.getModels();
    models.forEach((model: any) => {
        if (model.getLanguageId() === "yaml") {
            validateModel(model);

            // Add listener if not already added
            model.onDidChangeContent(() => {
                validateModel(model);
            });
        }
    });
};