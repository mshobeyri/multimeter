import React from "react";
import ComboTable, { ComboTablePair } from "../components/ComboTable";

interface EnvironmentEnvProps {
    variables: ComboTablePair[];
    presets: ComboTablePair[];
    handleVariablesChange: (name: string, label: string, value: string) => void;
    handlePresetsChange: (presetName: string, envName: string) => void;
}

const EnvironmentEnv: React.FC<EnvironmentEnvProps> = ({
    variables,
    presets,
    handleVariablesChange,
    handlePresetsChange,
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
                <div style={{ fontSize: "1.1em", marginBottom: "12px" }}>Variables</div>
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