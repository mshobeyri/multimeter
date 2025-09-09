import React from "react";
import TextEditor from "../text/TextEditor";
import { rootTestToJsfunc, setFileLoader } from "mmt-core/dist/JSer";
import {readFile} from "../vsAPI"

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

    return (
        <div style={{ height: "100%", width: "100%" }}>
            {error ? (
                <div style={{ color: "red", whiteSpace: "pre-wrap" }}>{error}</div>
            ) : (
                <TextEditor
                    content={jsCode}
                    setContent={() => { }}
                    language="javascript"
                />
            )}
        </div>
    );
};

export default TestCode;