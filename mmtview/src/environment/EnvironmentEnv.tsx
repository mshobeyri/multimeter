import React from "react";
import ComboTable, { ComboTablePair } from "../components/ComboTable";

interface EnvironmentEnvProps {
    variables: ComboTablePair[];
    presets: ComboTablePair[];
    handleVariablesChange: (name: string, label: string, value: string) => void;
    handlePresetsChange: (presetName: string, envName: string) => void;
    onClearCache?: () => void;
    onSaveToCache?: () => void;
}

const EnvironmentEnv: React.FC<EnvironmentEnvProps> = ({
    variables,
    presets,
    handleVariablesChange,
    handlePresetsChange,
    onClearCache,
    onSaveToCache,
}) => {
    return (
        <div>
            <div
                style={{
                    position: "relative",
                    padding: "16px",
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "2px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: 6,
                    color: "var(--vscode-editor-foreground, #fff)",
                    userSelect: "none"
                }}
            >
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px"
                }}>
                    <div style={{ fontSize: "1.1em" }}>Variables</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {onSaveToCache && (
                            <button
                                onClick={onSaveToCache}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "4px 10px",
                                    borderRadius: "4px",
                                    transition: "background 0.15s",
                                    color: "var(--vscode-button-foreground, #d4d4d4)",
                                    fontSize: "14px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontFamily: "var(--vscode-font-family)"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "var(--vscode-button-hoverBackground)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <span className="codicon codicon-checklist" style={{ fontSize: "16px" }}></span>
                                Reset environments
                            </button>
                        )}
                        {onClearCache && (
                            <button
                                onClick={onClearCache}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "4px 10px",
                                    borderRadius: "4px",
                                    transition: "background 0.15s",
                                    color: "var(--vscode-button-foreground, #d4d4d4)",
                                    fontSize: "14px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontFamily: "var(--vscode-font-family)"
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = "var(--vscode-button-hoverBackground)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <span className="codicon codicon-clear-all" style={{ fontSize: "16px" }}></span>
                                Clear environments
                            </button>
                        )}
                    </div>
                </div>
                <ComboTable pairs={variables} onChange={handleVariablesChange} />
            </div>

            <div
                style={{
                    position: "relative",
                    marginTop: "16px",
                    padding: "16px",
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "2px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: 6,
                    color: "var(--vscode-editor-foreground, #fff)",
                    userSelect: "none"
                }}
            >
                <div style={{ fontSize: "1.1em", marginBottom: "12px" }}>Presets</div>
                <ComboTable pairs={presets} onChange={handlePresetsChange} showPlaceholder />
            </div>
        </div>
    );
};

export default EnvironmentEnv;