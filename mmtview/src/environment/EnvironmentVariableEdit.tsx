import React from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import ValidatableSelect from "../components/ValidatableSelect";
import KVEditor from "../components/KVEditor";
import LEditor from "../components/LEditor"; // <-- Use LEditor instead of VEditor
import { EnvironmentData } from "./EnvironmentData";

// Only two types for this editor: "list" and "object"
const typeOptions = [
    { label: "List", value: "list" },
    { label: "Object", value: "object" }
];

interface VariableBoard {
    name: string;
    type: "list" | "object";
    value: string[] | { [k: string]: string };
}

interface EnvironmentVariableEditProps {
    variables: EnvironmentData["variables"];
    onChange: (variables: EnvironmentData["variables"]) => void;
}

const EnvironmentVariableEdit: React.FC<EnvironmentVariableEditProps> = ({ variables, onChange }) => {
    const safeVariables =
        variables && typeof variables === "object" && !Array.isArray(variables) ? variables : {};
    // Convert variables to boards for editing
    const boards: VariableBoard[] = Object.entries(safeVariables).map(([name, value]) =>
        Array.isArray(value)
            ? { name, type: "list", value }
            : {
                name,
                type: "object",
                value: Object.fromEntries(
                    Object.entries((value && typeof value === "object") ? value : {}).map(
                        ([k, v]) => [k, v ?? ""]
                    )
                ),
            }
    );

    const handleBoardChange = (idx: number, patch: Partial<VariableBoard>) => {
        const updated = boards.map((b, i) => (i === idx ? { ...b, ...patch } : b));
        // Convert boards back to variables object
        const newVars: EnvironmentData["variables"] = {};
        updated.forEach(b => {
            if (!b.name) return;
            newVars[b.name] = b.type === "list"
                ? Array.isArray(b.value) ? b.value : []
                : typeof b.value === "object" ? b.value : {};
        });
        onChange(newVars);
    };

    const handleRemove = (idx: number) => {
        const updated = boards.filter((_, i) => i !== idx);
        const newVars: EnvironmentData["variables"] = {};
        updated.forEach(b => {
            if (!b.name) return;
            newVars[b.name] = b.type === "list"
                ? Array.isArray(b.value) ? b.value : []
                : typeof b.value === "object" ? b.value : {};
        });
        onChange(newVars);
    };

    const handleAdd = () => {
        const newBoard: VariableBoard = { name: "", type: "list", value: [] };
        const updated = [...boards, newBoard];
        const newVars: EnvironmentData["variables"] = {};
        updated.forEach(b => {
            // Allow empty name for new variable so it appears in the UI
            newVars[b.name || ""] = b.type === "list"
                ? Array.isArray(b.value) ? b.value : []
                : typeof b.value === "object" ? b.value : {};
        });
        onChange(newVars);
    };

    return (
        <div>
            {boards.map((board, idx) => (
                <div className="inner-box">
                    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                        <colgroup>
                            <col style={{ width: "20%" }} />
                            <col style={{ width: "80%" }} />
                        </colgroup>
                        <tbody>
                            <tr>
                                <td className="label">name</td>
                                <td style={{ padding: "8px" }}>
                                    <FieldWithRemove
                                        value={board.name}
                                        onChange={v => handleBoardChange(idx, { name: v })}
                                        onRemovePressed={() => handleRemove(idx)}
                                        placeholder="name"
                                    />
                                </td>
                            </tr>
                            <tr>
                                <td className="label">type</td>
                                <td style={{ padding: "8px" }}>
                                    <ValidatableSelect
                                        value={board.type}
                                        options={typeOptions.map(opt => opt.value)}
                                        onChange={val =>
                                            handleBoardChange(idx, {
                                                type: val as "list" | "object",
                                                value: val === "list" ? [] : {}
                                            })
                                        }
                                        showPlaceholder={true}
                                        placeholder="Select type..."
                                    />
                                </td>
                            </tr>
                            {board.type === "list" ? (
                                <LEditor
                                    label="values"
                                    value={Array.isArray(board.value) ? board.value : []}
                                    onChange={v => handleBoardChange(idx, { value: v })}
                                    placeholder="Value"
                                />
                            ) : (
                                <KVEditor
                                    label="fields"
                                    value={typeof board.value === "object" && !Array.isArray(board.value) ? board.value : {}}
                                    onChange={v => handleBoardChange(idx, { value: v })}
                                    keyPlaceholder="Field"
                                    valuePlaceholder="Value"
                                />
                            )}
                        </tbody>
                    </table>
                </div>
            ))}
            <button onClick={handleAdd} className="add-button" >
                Add Variable
            </button>
        </div>
    );
};

export default EnvironmentVariableEdit;