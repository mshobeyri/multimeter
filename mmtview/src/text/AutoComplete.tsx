import { APISchema } from "./Schema";

export const handleBeforeMount = (monaco: any) => {
    // Dynamically get root keys from APISchema
    const rootKeys = Object.keys(APISchema.properties || {});
    const rootSuggestions = rootKeys.map(key => ({
        label: key,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: key + ":",
    }));

    // Optionally, get nested keys for interfaces, etc.
    const interfacesProps = APISchema.properties?.interfaces?.items?.properties || {};
    const interfacesKeys = Object.keys(interfacesProps);
    const interfacesSuggestions = interfacesKeys.map(key => ({
        label: key,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: key === "name" ? "- name: " : key + ": ",
    }));

    const keySuggestionsByParent: Record<string, any[]> = {
        root: rootSuggestions,
        interfaces: interfacesSuggestions,
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