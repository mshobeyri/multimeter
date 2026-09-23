import React from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import KSVEditor from "../components/KSVEditor";
import { safeList } from "mmt-core/safer";
import PrimaryButton from "../components/PrimaryButton";
import type {EnvPresets} from "./EnvironmentData";

interface PresetBoard {
    name: string; // e.g. "runner"
    values: Array<{
        env: string; // e.g. "dev", "ci", "cd"
        kv: Record<string, string>;
    }>;
}

interface EnvironmentPresetEditProps {
    presets: EnvPresets;
    onChange: (presets: EnvPresets) => void;
}

const EnvironmentPresetEdit: React.FC<EnvironmentPresetEditProps> = ({ presets, onChange }) => {
    // Convert presets to boards for editing
    const boards: PresetBoard[] = Object.entries(presets || {}).map(([name, envs]) => ({
        name,
        values: Object.entries(envs || {}).map(([env, kv]) => ({
            env,
            kv: Object.fromEntries(
                Object.entries(kv || {}).map(([key, value]) => [key, value == null ? '' : String(value)]),
            ),
        }))
    }));

    const handleBoardChange = (idx: number, patch: Partial<PresetBoard>) => {
        const updated = safeList(boards).map((b, i) => (i === idx ? { ...b, ...patch } : b));
        // Convert boards back to presets object
        const newPresets: EnvPresets = {};
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
        const newPresets: EnvPresets = {};
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
                <div key={boardIdx} className="inner-box is-preset">
                    <span className="label">Preset</span>
                    <div className="field-pad">
                        <FieldWithRemove
                            value={board.name}
                            onChange={v => handleBoardChange(boardIdx, { name: v })}
                            onRemovePressed={() => handleRemoveBoard(boardIdx)}
                            placeholder="Preset name (e.g. runner)"
                        />
                    </div>
                    <div className="horizontal-line is-section" />
                    {safeList(board.values).map((v, envIdx) => (
                        <div key={envIdx} className="inner-box">
                            <div className="label">Name</div>
                            <div className="field-pad">
                                <FieldWithRemove
                                    value={v.env}
                                    onChange={envName => handleEnvChange(boardIdx, envIdx, { env: envName })}
                                    onRemovePressed={() => handleRemoveEnv(boardIdx, envIdx)}
                                    placeholder="Env (e.g. dev)"
                                />
                            </div>
                            <KSVEditor
                                label="Fields"
                                value={v.kv}
                                onChange={kv => handleEnvChange(boardIdx, envIdx, { kv })}
                                keyPlaceholder="key"
                                valuePlaceholder="value"
                            />
                        </div>
                    ))}
                    <PrimaryButton icon="add" onClick={() => handleAddEnv(boardIdx)}>
                        Add Label
                    </PrimaryButton>
                </div>
            ))}
            <PrimaryButton icon="add" onClick={handleAddBoard}>
                Add Preset
            </PrimaryButton>
        </div>
    );
};

export default EnvironmentPresetEdit;