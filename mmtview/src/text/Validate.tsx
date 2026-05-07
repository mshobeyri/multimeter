import { APISchema, EnvSchema, TestSchema, SuiteSchema, LoadTestSchema, DocSchema, MockSchema, ReportSchema, GeneralSchema } from './Schema';
import YAML from 'yaml';
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, verbose: true });

const getLineNumberFromPath = (content: string, path: string): number => {
    const lines = content.split('\n');
    const pathParts = path.split('/').filter(part => part !== '');

    if (pathParts.length === 0) return 1;

    let currentLine = 1;
    for (const line of lines) {
        if (line.trim().startsWith(`${pathParts[0]}:`)) {
            return currentLine;
        }
        currentLine++;
    }

    return 1;
};

const findFirstOccurrence = (content: string, searchText: string): { line: number; column: number; found: boolean } => {
    if (!content || !searchText) {
        return { line: 1, column: 1, found: false };
    }

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const columnIndex = line.indexOf(searchText);

        if (columnIndex !== -1) {
            return {
                line: lineIndex + 1, // 1-based line number
                column: columnIndex + 1, // 1-based column number
                found: true
            };
        }
    }

    return { line: 1, column: 1, found: false };
};

export const validateYamlContent = (content: string): any[] => {
    const errors: any[] = [];

    try {
        // Parse YAML to JavaScript object using YAML library
        const parsedContent = YAML.parse(content);

        if (!parsedContent) {
            return errors;
        }

        // Validate against schema
        let validate = ajv.compile(GeneralSchema);
        if (parsedContent.type && parsedContent.type === 'api') {
            validate = ajv.compile(APISchema);
        } else if (parsedContent.type && parsedContent.type === 'env') {
            validate = ajv.compile(EnvSchema);
        } else if (parsedContent.type && parsedContent.type === 'test') {
            validate = ajv.compile(TestSchema);
        } else if (parsedContent.type && parsedContent.type === 'suite') {
            validate = ajv.compile(SuiteSchema);
        } else if (parsedContent.type && parsedContent.type === 'loadtest') {
            validate = ajv.compile(LoadTestSchema);
        } else if (parsedContent.type && parsedContent.type === 'doc') {
            validate = ajv.compile(DocSchema);
        } else if (parsedContent.type && parsedContent.type === 'server') {
            validate = ajv.compile(MockSchema);
        } else if (parsedContent.type && parsedContent.type === 'report') {
            validate = ajv.compile(ReportSchema);
        }
        const isValid = validate(parsedContent);

        if (!isValid && validate.errors) {
            validate.errors.forEach(error => {
                if (
                    error.keyword === "additionalProperties" &&
                    typeof (error.params as any).additionalProperty === "string"
                ) {
                    const { line, column } = findFirstOccurrence(content, (error.params as any).additionalProperty);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `Invalid property "${(error.params as any).additionalProperty}"`,
                        source: 'mmt-validation'
                    });
                } else if (error.keyword === "enum") {
                    const { line, column } = findFirstOccurrence(content, error.data);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: column,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `Invalid value for property "${error.dataPath}", expected one of: ${(error.params as any).allowedValues ? (error.params as any).allowedValues.join(', ') : (error.params as any).allowedValue}`,
                        source: 'mmt-validation'
                    });
                } else {
                    const path = (error as any).instancePath || (error as any).dataPath || '';
                    const line = getLineNumberFromPath(content, path);
                    errors.push({
                        severity: 8,
                        startLineNumber: line,
                        startColumn: 1,
                        endLineNumber: line,
                        endColumn: 100,
                        message: `${path}: ${error.message}`,
                        source: 'mmt-validation'
                    });
                }
            });
        }

        return errors;
    } catch (yamlError: any) {
        // YAML parsing error from YAML library
        const line = yamlError.linePos?.[0]?.line || yamlError.source?.start?.line || 1;
        const column = yamlError.linePos?.[0]?.col || yamlError.source?.start?.col || 1;

        errors.push({
            severity: 8,
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column + 10,
            message: `YAML Parse Error: ${yamlError.message}`,
            source: 'yaml-syntax'
        });

        return errors;
    }
};