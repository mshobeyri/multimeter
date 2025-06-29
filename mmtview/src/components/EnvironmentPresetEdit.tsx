import React, { useState } from "react";
import FieldWithRemove from "./FieldWithRemove";
import KVEditor from "./KVEditor";

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
    const updated = boards.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    // Convert boards back to presets object
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
    const updated = [
      ...boards,
      { name: "", values: [] }
    ];
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

  const handleEnvChange = (boardIdx: number, envIdx: number, patch: Partial<{ env: string; kv: Record<string, string> }>) => {
    const board = boards[boardIdx];
    const updatedValues = board.values.map((v, i) => (i === envIdx ? { ...v, ...patch } : v));
    handleBoardChange(boardIdx, { values: updatedValues });
  };

  const handleRemoveEnv = (boardIdx: number, envIdx: number) => {
    const board = boards[boardIdx];
    const updatedValues = board.values.filter((_, i) => i !== envIdx);
    handleBoardChange(boardIdx, { values: updatedValues });
  };

  const handleAddEnv = (boardIdx: number) => {
    const board = boards[boardIdx];
    const updatedValues = [...board.values, { env: "", kv: {} }];
    handleBoardChange(boardIdx, { values: updatedValues });
  };

  return (
    <div>
      {boards.map((board, boardIdx) => (
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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <FieldWithRemove
              value={board.name}
              onChange={v => handleBoardChange(boardIdx, { name: v })}
              onRemovePressed={() => handleRemoveBoard(boardIdx)}
              placeholder="Preset name (e.g. runner)"
            />
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <tbody>
              {board.values.map((v, envIdx) => (
                <tr key={envIdx}>
                  <td style={{ width: "25%", verticalAlign: "top" }}>
                    <FieldWithRemove
                      value={v.env}
                      onChange={envName => handleEnvChange(boardIdx, envIdx, { env: envName })}
                      onRemovePressed={() => handleRemoveEnv(boardIdx, envIdx)}
                      placeholder="Env (e.g. dev)"
                    />
                  </td>
                  <td style={{ width: "75%" }}>
                    <KVEditor
                      label=""
                      value={v.kv}
                      onChange={kv => handleEnvChange(boardIdx, envIdx, { kv })}
                      keyPlaceholder="key"
                      valuePlaceholder="value"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => handleAddEnv(boardIdx)}
            style={{
              marginTop: 8,
              padding: "4px 12px",
              background: "#222",
              color: "#fff",
              border: "1px solid #444",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            + Add Environment
          </button>
        </div>
      ))}
      <button
        onClick={handleAddBoard}
        style={{
          marginTop: 8,
          padding: "6px 18px",
          background: "#232323",
          color: "#fff",
          border: "1px solid #444",
          borderRadius: 4,
          cursor: "pointer"
        }}
      >
        + Add Preset
      </button>
    </div>
  );
};

export default EnvironmentPresetEdit;