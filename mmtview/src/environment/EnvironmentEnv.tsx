import React from "react";
import ComboTable, { ComboTablePair } from "../components/ComboTable";
import { saveEnvVariablesFromObject } from "../workspaceStorage";

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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "10px" }}>
            <div
                style={{
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "1px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: "6px",
                    padding: "16px",
                    minWidth: 200,
                }}
            >
                <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: "12px" }}>Variables</div>
                <ComboTable pairs={variables} onChange={handleVariablesChange} />
            </div>
            <div
                style={{
                    background: "var(--vscode-editorWidget-background, #232323)",
                    border: "1px solid var(--vscode-editorWidget-border, #333)",
                    borderRadius: "6px",
                    padding: "16px",
                    minWidth: 200,
                }}
            >
                <div style={{ fontWeight: "bold", fontSize: "1.1em", marginBottom: "12px" }}>Presets</div>
                <ComboTable pairs={presets} onChange={handlePresetsChange} showPlaceholder />
            </div>
        </div>
    );
};

export default EnvironmentEnv;