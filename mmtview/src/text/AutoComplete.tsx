export const handleBeforeMount = (monaco: any) => {
    const keySuggestionsByParent: Record<string, any[]> = {
        root: [
            {
                label: "type",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "type:",
            },

            {
                label: "tags",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "tags:",
            },
            {
                label: "description",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "description:",
            },
            {
                label: "import",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "import:",
            },
            {
                label: "inputs",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "inputs:",
            },
            {
                label: "outputs",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "outputs:",
            },
            {
                label: "interfaces",
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: "interfaces:",
            },
        ],
        interfaces: [
            { label: "name", kind: monaco.languages.CompletionItemKind.Property, insertText: "- name: " },
            { label: "protocol", kind: monaco.languages.CompletionItemKind.Property, insertText: "protocol: " },
            { label: "format", kind: monaco.languages.CompletionItemKind.Property, insertText: "format: " },
            { label: "endpoint", kind: monaco.languages.CompletionItemKind.Property, insertText: "endpoint: " },
            { label: "body", kind: monaco.languages.CompletionItemKind.Property, insertText: "body: " },
        ],
    };

    monaco.languages.registerCompletionItemProvider("yaml", {
        provideCompletionItems: (model: any, position: any) => {
            const lineNumber = position.lineNumber;
            const lines = model.getLinesContent().slice(0, lineNumber - 1);
            let parent = "root";
            // Find the nearest non-empty, less-indented line above
            const currentIndent = model.getLineContent(lineNumber).search(/\S|$/);
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (!line.trim()) continue;
                const indent = line.search(/\S|$/);
                if (indent < currentIndent) {
                    const match = line.trim().match(/^(\w+):/);
                    if (match) {
                        parent = match[1];
                    }
                    break;
                }
            }
            const suggestions = keySuggestionsByParent[parent] || keySuggestionsByParent.root;
            return { suggestions };
        },

        triggerCharacters: ["\n", " "], // Trigger on new line or space
    });
};