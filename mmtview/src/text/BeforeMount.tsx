import { validateYamlContent } from './Validate';
import { registerMmtYamlTokenizer } from './yamlTokenizer';
import { registerYamlAutocomplete } from './registerYamlAutocomplete';

const VALIDATION_DEBOUNCE_MS = 500;

/** Skip ephemeral DiffEditor models — they must not steal the editor's debounce. */
function shouldValidateYamlModel(model: any): boolean {
    if (!model || typeof model.getLanguageId !== 'function') {
        return false;
    }
    if (model.getLanguageId() !== 'yaml') {
        return false;
    }
    const uri = model.uri?.toString?.() ?? '';
    if (uri.includes('inmemory://mmt/unsaved-diff/')) {
        return false;
    }
    return true;
}

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

    // One registration per monaco instance (TextEditor / Diff remounts call beforeMount again).
    if (monaco.__mmtYamlValidationInstalled) {
        return;
    }
    monaco.__mmtYamlValidationInstalled = true;

    const timeouts = new WeakMap<object, ReturnType<typeof setTimeout>>();
    const listening = new WeakSet<object>();

    const runValidation = (model: any) => {
        if (!shouldValidateYamlModel(model)) {
            return;
        }
        const content = model.getValue();
        const markers = validateYamlContent(content);
        monaco.editor.setModelMarkers(model, 'mmt-validation', markers);
    };

    const scheduleValidation = (model: any) => {
        if (!shouldValidateYamlModel(model)) {
            return;
        }
        const prev = timeouts.get(model);
        if (prev !== undefined) {
            clearTimeout(prev);
        }
        // Drop stale squiggles immediately; replace after debounce with fresh markers.
        monaco.editor.setModelMarkers(model, 'mmt-validation', []);
        timeouts.set(
            model,
            setTimeout(() => {
                timeouts.delete(model);
                runValidation(model);
            }, VALIDATION_DEBOUNCE_MS),
        );
    };

    const attachModel = (model: any) => {
        if (!shouldValidateYamlModel(model) || listening.has(model)) {
            return;
        }
        listening.add(model);
        scheduleValidation(model);
        model.onDidChangeContent(() => scheduleValidation(model));
    };

    monaco.editor.onDidCreateModel((model: any) => {
        attachModel(model);
    });

    monaco.editor.getModels().forEach((model: any) => {
        attachModel(model);
    });
};
