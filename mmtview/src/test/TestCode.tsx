import React from "react";
import TextEditor from "../text/TextEditor";
import { rootTestToJsfunc, setFileLoader } from "mmt-core/JSer";
import { logToOutput, readFile, runJSCode, showVSCodeMessage } from "../vsAPI";
import * as mmtHelper from "mmt-core/testHelper";

interface TestCodeProps {
    testData: any;
}

const TestCode: React.FC<TestCodeProps> = ({ testData }) => {
    const [jsCode, setJsCode] = React.useState<string>("");
    const [error, setError] = React.useState<string | null>(null);

    setFileLoader(readFile);

    React.useEffect(() => {
        const generateCode = async () => {
            try {
                const code = await rootTestToJsfunc({
                    name: testData?.title || "testFlow",
                    test: testData,
                    inputs: testData?.inputs || {},
                    envVars: testData?.envVars || {},
                });
                setJsCode(code);
                setError(null);
            } catch (e: any) {
                setError(e?.message || String(e));
                setJsCode("");
            }
        };
        generateCode();
    }, [testData]);

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
            runJSCode(jsCode, testData?.title || "");
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
                    Run
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