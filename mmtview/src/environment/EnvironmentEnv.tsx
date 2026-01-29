import React, { useMemo } from "react";
import ComboTable, { ComboTablePair } from "../components/ComboTable";
import { EnvVariable } from "./EnvironmentData";
import { safeList } from "mmt-core/safer";
import { JSONValue } from "mmt-core/CommonData";

interface EnvironmentEnvProps {
    variables: ComboTablePair[];
    currentVariables: EnvVariable[];
    presets: ComboTablePair[];
    handleVariablesChange: (variable: EnvVariable) => void;
    handlePresetsChange: (presetName: string, envName: string) => void;
    onClearCache?: () => void;
    onSaveToCache?: () => void;
    onEdit?: () => void;
}

const EnvironmentEnv: React.FC<EnvironmentEnvProps> = ({
    variables,
    currentVariables,
    presets,
    handleVariablesChange,
    handlePresetsChange,
    onClearCache,
    onSaveToCache,
    onEdit,
}) => {
    const currentMap = useMemo(() => {
        const map = new Map<string, EnvVariable>();
        safeList(currentVariables).forEach(variable => {
            if (variable && typeof variable.name === "string") {
                map.set(variable.name, variable);
            }
        });
        return map;
    }, [currentVariables]);

    const formatValue = (value: JSONValue | undefined): string => {
        if (value === null || typeof value === "undefined") {
            return "";
        }
        if (typeof value === "object") {
            try {
                return JSON.stringify(value);
            } catch (error) {
                return String(value);
            }
        }
        return String(value);
    };

    const handleSelectChange = (name: string, label: string) => {
        const variable = variables.find(v => v.name === name);
        if (!variable) {
            return;
        }
        const selected = safeList(variable.options).find(opt => opt.label === label);
        if (!selected) {
            return;
        }
        handleVariablesChange({
            name,
            label: selected.label,
            value: selected.value,
            options: variable.options || []
        });
    };

    const hasVariables = safeList(variables).length > 0;

    return (
        <div>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px"
            }}>
                <div className="label">Variables</div>
                <div style={{ display: "flex", gap: "8px" }}>
                    {onSaveToCache && (
                        <button onClick={onSaveToCache} className="action-button">
                            <span className="codicon codicon-checklist" style={{ fontSize: "16px" }}></span>
                            Reset
                        </button>
                    )}
                    {onClearCache && (
                        <button onClick={onClearCache} className="action-button">
                            <span className="codicon codicon-clear-all" style={{ fontSize: "16px" }}></span>
                            Clear
                        </button>
                    )}
                    {onEdit && (
                        <button onClick={onEdit} className="action-button api-edit-launcher" type="button">
                            <span className="codicon codicon-edit" aria-hidden />
                            <span className="api-edit-launcher-text">Edit Environment</span>
                        </button>
                    )}
                </div>
            </div>
            {hasVariables ? (
                <div className="environment-table-wrapper">
                    <table className="environment-table">
                        <thead>
                            <tr>
                                <th style={{ width: "25%" }}>Name</th>
                                <th style={{ width: "30%" }}>Label</th>
                                <th style={{ width: "25%" }}>Value</th>
                                <th style={{ width: "20%" }}>Current</th>
                            </tr>
                        </thead>
                        <tbody>
                            {safeList(variables).map(pair => {
                                const current = currentMap.get(pair.name);
                                const options = safeList(pair.options);
                                const selectValue = options.length > 0
                                    ? (pair.value?.label ?? options[0]?.label ?? "")
                                    : "";
                                return (
                                    <tr key={pair.name}>
                                        <td className="environment-table-name">{pair.name}</td>
                                        <td>
                                            <select
                                                className="flat-select"
                                                style={{ width: "100%" }}
                                                value={selectValue}
                                                onChange={event => handleSelectChange(pair.name, event.target.value)}
                                            >
                                                {options.length === 0 ? (
                                                    <option value="" disabled>
                                                        No options available
                                                    </option>
                                                ) : (
                                                    options.map(option => (
                                                        <option key={option.label} value={option.label}>
                                                            {option.label}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </td>
                                        <td className="environment-table-value">{formatValue(pair.value?.value)}</td>
                                        <td className="environment-table-value">{formatValue(current?.value)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="environment-table-empty">No variables defined.</div>
            )}

            <div className="label">Presets</div>
            <ComboTable pairs={presets} onChange={handlePresetsChange} showPlaceholder />
        </div>
    );
};

export default EnvironmentEnv;