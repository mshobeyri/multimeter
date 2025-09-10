import React from "react";
import TextEditor from "../text/TextEditor";
import { rootTestToJsfunc, setFileLoader } from "mmt-core/dist/JSer";
import { logToOutput, readFile, showVSCodeMessage } from "../vsAPI";
import * as mmt from "mmt-core/dist/testHelper"; 

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
        logToOutput("info", `Running test ${testData?.title || ""}...`);
        console.log = (...args: any[]) => {
            logToOutput("info", args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        };
        console.error = (...args: any[]) => {
            logToOutput("error", args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        };
        console.warn = (...args: any[]) => {
            logToOutput("warning", args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
        };
        try {
            const fn = new Function(jsCode);
            await fn(mmt);

            showVSCodeMessage("info", "Done");
            logToOutput("info", "Done");
        } catch (e: any) {
            showVSCodeMessage("error", "Error: " + (e?.message || String(e)));
            logToOutput("error", "Error: " + (e?.message || String(e)));
        } finally {
            logToOutput("info", `Finished running test ${testData?.title || ""}`);
        }
    };

    return (
        <div style={{ height: "100%", width: "100%" }}>
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
                <TextEditor
                    content={jsCode}
                    setContent={setJsCode}
                    language="javascript"
                />
            )}
        </div>
    );
};

export default TestCode;