import React, { useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import KVEditor from "../components/KVEditor";
import { safeList } from "../safer";

interface PresetBoard {
    name: string; // e.g. "runner"
    values: Array<{
        env: string; // e.g. "dev", "ci", "cd"
        kv: Record<string, string>;
    }>;
}

interface EnvironmentPresetEditProps {
    presets: Record<string, Record<string, Record<string, string>>>;
    onChange: (presets: Record<string, Record<string, Record<string, string>>>) => void;
}

const EnvironmentPresetEdit: React.FC<EnvironmentPresetEditProps> = ({ presets, onChange }) => {
    // Convert presets to boards for editing
    const boards: PresetBoard[] = Object.entries(presets || {}).map(([name, envs]) => ({
        name,
        values: Object.entries(envs || {}).map(([env, kv]) => ({
            env,
            kv: { ...kv }
        }))
    }));

    const handleBoardChange = (idx: number, patch: Partial<PresetBoard>) => {
        const updated = safeList(boards).map((b, i) => (i === idx ? { ...b, ...patch } : b));
        // Convert boards back to presets object
        const newPresets: Record<string, Record<string, Record<string, string>>> = {};
        updated.forEach(b => {
            if (!b.name) return;
            newPresets[b.name] = {};
            b.values.forEach((v: { env: string; kv: Record<string, string> }) => {
                if (!v.env) return;
                newPresets[b.name][v.env] = v.kv;
            });
        });
        onChange(newPresets);
    };

    const handleRemoveBoard = (idx: number) => {
        const updated = boards.filter((_, i) => i !== idx);
        const newPresets: Record<string, Record<string, Record<string, string>>> = {};
        updated.forEach(b => {
            if (!b.name) return;
            newPresets[b.name] = {};
            b.values.forEach(v => {
                if (!v.env) return;
                newPresets[b.name][v.env] = v.kv;
            });
        });
        onChange(newPresets);
    };

    const handleAddBoard = () => {
        // Always use the latest presets prop
        const newPresets = { ...presets };
        let newName = "preset";
        let i = 1;
        while (newPresets[newName]) {
            newName = `preset${i++}`;
        }
        newPresets[newName] = {};
        onChange(newPresets);
    };

    const handleEnvChange = (boardIdx: number, envIdx: number, patch: Partial<{ env: string; kv: Record<string, string> }>) => {
        const board = boards[boardIdx];
        const updatedValues = safeList(board.values).map((v, i) => (i === envIdx ? { ...v, ...patch } : v));
        handleBoardChange(boardIdx, { values: updatedValues });
    };

    const handleRemoveEnv = (boardIdx: number, envIdx: number) => {
        const board = boards[boardIdx];
        const updatedValues = board.values.filter((_, i) => i !== envIdx);
        handleBoardChange(boardIdx, { values: updatedValues });
    };

    const handleAddEnv = (boardIdx: number) => {
        // Find the board name from boards[boardIdx]
        const boardName = boards[boardIdx]?.name;
        if (!boardName) return;
        const newPresets = { ...presets };
        const envs = { ...(newPresets[boardName] || {}) };
        let newEnv = "env";
        let i = 1;
        while (envs[newEnv]) {
            newEnv = `env${i++}`;
        }
        envs[newEnv] = {};
        newPresets[boardName] = envs;
        onChange(newPresets);
    };

    return (
        <div>
            {safeList(boards).map((board, boardIdx) => (
                <div
                    key={boardIdx}
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
                    <span className="label">preset</span>
                    <div style={{ padding: "5px" }}>
                        <FieldWithRemove
                            value={board.name}
                            onChange={v => handleBoardChange(boardIdx, { name: v })}
                            onRemovePressed={() => handleRemoveBoard(boardIdx)}
                            placeholder="Preset name (e.g. runner)"
                        />
                    </div>
                    <hr style={{ border: 0, borderTop: "1px solid #444", margin: "12px 0" }} />
                    {safeList(board.values).map((v, envIdx) => (
                        <div className="inner-box">
                            <div className="label">name</div>
                            <div style={{ padding: "5px" }}>
                                <FieldWithRemove
                                    value={v.env}
                                    onChange={envName => handleEnvChange(boardIdx, envIdx, { env: envName })}
                                    onRemovePressed={() => handleRemoveEnv(boardIdx, envIdx)}
                                    placeholder="Env (e.g. dev)"
                                />
                            </div>
                            <KVEditor
                                label="fields"
                                value={v.kv}
                                onChange={kv => handleEnvChange(boardIdx, envIdx, { kv })}
                                keyPlaceholder="key"
                                valuePlaceholder="value"
                            />

                            <hr style={{ border: 0, borderTop: "1px solid #444", margin: "12px 0" }} />
                        </div>
                    ))}
                    <button onClick={() => handleAddEnv(boardIdx)} className="add-button" >
                        Add Label
                    </button>
                </div>
            ))}
            <button onClick={handleAddBoard} className="add-button" >
                Add Preset
            </button>
        </div>
    );
};

export default EnvironmentPresetEdit;