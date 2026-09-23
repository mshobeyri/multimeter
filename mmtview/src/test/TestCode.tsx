import React, { useContext } from "react";
import TextEditor from "../text/TextEditor";
import { ImportCodeError, rootTestToJsfunc, setFileLoader } from "mmt-core/JSer";
import { logToOutput, openRelativeFile, readFile, runJSCode, showLogOutputChannel, showVSCodeMessage } from "../vsAPI";
import { TestData } from "mmt-core/TestData";
import { loadEnvVariables } from "../workspaceStorage";
import { FileContext } from "../fileContext";

interface TestCodeProps {
    testData: TestData;
}

interface CodeGenError {
    detail: string;
    path?: string;
}

let loaded = false;
const load = () => {
    setFileLoader(readFile);
    loaded = true;
};
load();

function fileNameFromPath(path: string): string {
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || path;
}

function toCodeGenError(error: unknown): CodeGenError {
    if (error instanceof ImportCodeError) {
        return { detail: error.detail, path: error.path };
    }
    const message = error instanceof Error ? error.message : String(error);
    const inFile = message.match(/^Import error in (.+?): /);
    if (inFile) {
        return { detail: message.slice(inFile[0].length), path: inFile[1] };
    }
    return { detail: message.replace(/^Import error:\s*/, '') };
}

const TestCode: React.FC<TestCodeProps> = ({ testData }) => {
    const { mmtFilePath, projectRoot } = useContext(FileContext);
    const [jsCode, setJsCode] = React.useState<string>("");
    const [error, setError] = React.useState<CodeGenError | null>(null);
    const [envVars, setEnvVars] = React.useState<Record<string, any>>({});

    React.useEffect(() => {
        const cleanup = loadEnvVariables((variables) => {
            const map: Record<string, any> = Object.fromEntries(
                (variables || []).map(v => [v.name, v.value])
            );
            setEnvVars(map);
        });
        return () => { if (typeof cleanup === 'function') cleanup(); };
    }, []);

    const refreshWorkspaceVars = React.useCallback(() => {
        try {
            (window as any).vscode?.postMessage({
                command: 'loadWorkspaceState',
                name: 'multimeter.environment.storage'
            });
        } catch {
            // ignore
        }
    }, []);

    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = (event as any).data;
            if (message && message.command === 'multimeter.environment.refresh') {
                refreshWorkspaceVars();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [refreshWorkspaceVars]);

    const generateCode = React.useCallback(async () => {
        try {
            const code = await rootTestToJsfunc({
                name: testData?.title || "testFlow",
                test: testData,
                inputs: testData?.inputs || {},
                envVars: envVars,
                filePath: mmtFilePath,
                projectRoot: projectRoot
            });
            setJsCode(code);
            setError(null);
        } catch (e: any) {
            setError(toCodeGenError(e));
        }
    }, [testData, envVars, mmtFilePath, projectRoot]);

    React.useEffect(() => {
        if (!loaded) {
            load();
        }
    }, []);

    React.useEffect(() => {
        if (!loaded) {
            return;
        }
        const timeout = setTimeout(() => {
            generateCode();
        }, 100);
        return () => {
            clearTimeout(timeout);
        };
    }, [generateCode]);

    const handleRun = async () => {
        console.log = (...args: any[]) => {
            logToOutput("info", args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        };
        console.error = (...args: any[]) => {
            logToOutput("error", args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        };
        console.warn = (...args: any[]) => {
            logToOutput("warn", args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        };
        try {
            const fileName = mmtFilePath ? mmtFilePath.split(/[/\\]/).pop() : '';
            const runTitle = testData?.title || fileName || 'test';
            showLogOutputChannel();
            runJSCode(jsCode, runTitle);

        } catch (e: any) {
            showVSCodeMessage("error", "Error: " + (e?.message || String(e)));
        }
    };

    const errorLine = error?.detail.match(/line\s+(\d+)/i)?.[1];

    return (
        <div className="test-code-panel">
            <div className="run-action-bar">
                <button
                    onClick={handleRun}
                    disabled={!jsCode || !!error}
                    className="button-icon"
                >
                    <span className="codicon codicon-run" />
                    Run code
                </button>
            </div>
            {error && (
                <div className="code-gen-error" role="alert">
                    <div className="code-gen-error-title">
                        <span className="codicon codicon-error" aria-hidden />
                        Import error
                    </div>
                    {error.path && (
                        <div className="code-gen-error-file-row">
                            <span className="code-gen-error-file-label">File</span>
                            <button
                                type="button"
                                className="code-gen-error-file"
                                title={error.path}
                                onClick={() => openRelativeFile(error.path as string)}
                            >
                                {fileNameFromPath(error.path)}
                            </button>
                            {errorLine && (
                                <span className="code-gen-error-line">Line {errorLine}</span>
                            )}
                        </div>
                    )}
                    <pre className="code-gen-error-detail">{error.detail}</pre>
                </div>
            )}
            <div className="test-code-editor">
                <TextEditor
                    content={jsCode}
                    setContent={setJsCode}
                    language="javascript"
                />
            </div>
        </div>
    );
};

export default TestCode;
