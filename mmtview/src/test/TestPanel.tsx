import React, { useState } from "react";

interface TestPanelProps {
    content: string;
    setContent: React.Dispatch<React.SetStateAction<string>>;
}

const TestPanel: React.FC<TestPanelProps> = ({ content }) => {
    const [tab, setTab] = useState<"overview" | "flow" | "examples">("overview");

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                padding: "1rem",
                backgroundColor: "var(--vscode-editor-background)",
                color: "var(--vscode-editor-foreground)",
                minWidth: 100,
                maxWidth: "80vw",
                overflow: "auto",
                height: "100%",
            }}
        >
            <div
                style={{
                    position: "relative",
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "1px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: "6px",
                    padding: "16px",
                    minWidth: 200,
                    marginBottom: "16px"
                }}
            >
                {/* Tab Bar */}
                <div style={{ display: "flex", borderBottom: "1px solid #444", marginBottom: 16 }}>
                    <button
                        onClick={() => setTab("overview")}
                        style={{
                            padding: "8px 24px",
                            border: "none",
                            borderBottom: tab === "overview" ? "2px solid #0e639c" : "2px solid transparent",
                            background: "none",
                            color: "inherit",
                            fontWeight: tab === "overview" ? "bold" : "normal",
                            cursor: "pointer"
                        }}
                    >
                        <span role="img" aria-label="overview">🔎</span> Overview
                    </button>
                    <button
                        onClick={() => setTab("flow")}
                        style={{
                            padding: "8px 24px",
                            border: "none",
                            borderBottom: tab === "flow" ? "2px solid #0e639c" : "2px solid transparent",
                            background: "none",
                            color: "inherit",
                            fontWeight: tab === "flow" ? "bold" : "normal",
                            cursor: "pointer"
                        }}
                    >
                        <span role="img" aria-label="flow">🛝</span> Flow
                    </button>
                    <button
                        onClick={() => setTab("examples")}
                        style={{
                            padding: "8px 24px",
                            border: "none",
                            borderBottom: tab === "examples" ? "2px solid #0e639c" : "2px solid transparent",
                            background: "none",
                            color: "inherit",
                            fontWeight: tab === "examples" ? "bold" : "normal",
                            cursor: "pointer"
                        }}
                    >
                        <span role="img" aria-label="examples">💡</span> Examples
                    </button>
                </div>
                {/* Tab Content */}
                {tab === "overview" && (
                    <div>
                        <h2>Overview</h2>
                        <pre>{content}</pre>
                    </div>
                )}
                {tab === "flow" && (
                    <div>
                        <h2>Flow</h2>
                        <pre>{content}</pre>
                    </div>
                )}
                {tab === "examples" && (
                    <div>
                        <h2>Examples</h2>
                        <pre>{content}</pre>
                    </div>
                )}
            </div>    </div>
    );
};

export default TestPanel;