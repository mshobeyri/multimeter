import { validateYamlContent } from './Validate';
import { registerMmtYamlTokenizer } from './yamlTokenizer';
import { registerYamlAutocomplete } from './registerYamlAutocomplete';

export const handleBeforeMount = (monaco: any) => {
    registerMmtYamlTokenizer(monaco);
    registerYamlAutocomplete(monaco);

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

    monaco.editor.onDidCreateModel((model: any) => {
        if (model.getLanguageId() === "yaml") {
            validateModel(model);
            model.onDidChangeContent(() => validateModel(model));
        }
    });

    monaco.editor.getModels().forEach((model: any) => {
        if (model.getLanguageId() === "yaml") {
            validateModel(model);
            model.onDidChangeContent(() => validateModel(model));
        }
    });
};
