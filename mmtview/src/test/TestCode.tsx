import React, { useContext } from "react";
import TextEditor from "../text/TextEditor";
import { rootTestToJsfunc, setFileLoader } from "mmt-core/JSer";
import { logToOutput, readFile, runJSCode, showVSCodeMessage } from "../vsAPI";
import { TestData } from "mmt-core/TestData";
import { loadEnvVariables } from "../workspaceStorage";
import { FileContext } from "../fileContext";

interface TestCodeProps {
    testData: TestData;
}

setFileLoader(readFile);

const TestCode: React.FC<TestCodeProps> = ({ testData }) => {
    const { mmtFilePath } = useContext(FileContext);
    const [jsCode, setJsCode] = React.useState<string>("");
    const [error, setError] = React.useState<string | null>(null);
    const [envVars, setEnvVars] = React.useState<Record<string, any>>({});

    // Load env variables from VS Code workspace storage
    React.useEffect(() => {
        const cleanup = loadEnvVariables((variables) => {
            const map: Record<string, any> = Object.fromEntries(
                (variables || []).map(v => [v.name, v.value])
            );
            setEnvVars(map);
        });
        return () => { if (typeof cleanup === 'function') cleanup(); };
    }, []);

    // Allow external signal to refresh env variables from storage
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

    React.useEffect(() => {
        const generateCode = async () => {
            try {
                const code = await rootTestToJsfunc({
                    name: testData?.title || "testFlow",
                    test: testData,
                    inputs: testData?.inputs || {},
                    envVars: envVars
                });
                setJsCode(code);
                setError(null);
            } catch (e: any) {
                setError(e?.message || String(e));
                setJsCode("");
            }
        };
        const timeout = setTimeout(() => {
            generateCode();
        }, 1);
        return () => {
            clearTimeout(timeout);
        };
    }, [testData, envVars]);

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
            runJSCode(jsCode, runTitle);
        } catch (e: any) {
            showVSCodeMessage("error", "Error: " + (e?.message || String(e)));
        }
    };

    return (
        <div style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <div style={{
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8
            }}>
                <button
                    onClick={handleRun}
                    disabled={!jsCode || !!error}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 12px"
                    }}
                >
                    <span className="codicon codicon-run" style={{ fontSize: 18 }} />
                    Run test
                </button>
            </div>
            {error ? (
                <div style={{ color: "red", whiteSpace: "pre-wrap" }}>{error}</div>
            ) : (
                <div style={{ height: "calc(100vh - 140px)" }}>
                    <TextEditor
                        content={jsCode}
                        setContent={setJsCode}
                        language="javascript"
                    />
                </div>
            )}
        </div>
    );
};

export default TestCode;