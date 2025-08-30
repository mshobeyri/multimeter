import React from "react";
import ComboTable, { ComboTablePair } from "../components/ComboTable";
import { EnvVariable } from "./EnvironmentData";

interface EnvironmentEnvProps {
    variables: ComboTablePair[];
    presets: ComboTablePair[];
    handleVariablesChange: (variable: EnvVariable) => void;
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
            <div className="inner-box">
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px"
                }}>
                    <div style={{ fontSize: "1.1em" }}>Variables</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {onSaveToCache && (
                            <button onClick={onSaveToCache} className="action-button">
                                <span className="codicon codicon-checklist" style={{ fontSize: "16px" }}></span>
                                Reset environments
                            </button>
                        )}
                        {onClearCache && (
                            <button onClick={onClearCache} className="action-button">
                                <span className="codicon codicon-clear-all" style={{ fontSize: "16px" }}></span>
                                Clear environments
                            </button>
                        )}
                    </div>
                </div>
                <ComboTable
                    pairs={variables}
                    onChange={(name, label, value) => {
                        const variable = variables.find(v => v.name === name);
                        handleVariablesChange({
                            name,
                            label,
                            value,
                            options: variable?.options ?? [],
                        });
                    }}
                />
            </div>

            <div className="inner-box">
                <div style={{ fontSize: "1.1em", marginBottom: "12px" }}>Presets</div>
                <ComboTable pairs={presets} onChange={handlePresetsChange} showPlaceholder />
            </div>
        </div>
    );
};

export default EnvironmentEnv;