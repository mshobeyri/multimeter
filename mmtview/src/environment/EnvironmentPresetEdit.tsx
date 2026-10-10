import React, { useEffect, useRef, useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import KSVEditor from "../components/KSVEditor";
import { safeList } from "mmt-core/safer";
import PrimaryButton from "../components/PrimaryButton";
import type { EnvPresets } from "./EnvironmentData";
import type { JSONRecord } from "mmt-core/CommonData";
import {
  boardsToPresets,
  envPresetsSignature,
  presetsToBoards,
  type EnvPresetBoard,
} from "./envPresetUi";
import { isIncompleteJsonLiteral } from "mmt-core/yamlValueConvert";

interface EnvironmentPresetEditProps {
  presets: EnvPresets;
  onChange: (presets: EnvPresets) => void;
}

const EnvironmentPresetEdit: React.FC<EnvironmentPresetEditProps> = ({
  presets,
  onChange,
}) => {
  const [boards, setBoards] = useState<EnvPresetBoard[]>(() =>
    presetsToBoards(presets),
  );
  const syncedSig = useRef(envPresetsSignature(presets));

  useEffect(() => {
    const sig = envPresetsSignature(presets);
    if (sig === syncedSig.current) {
      return;
    }
    syncedSig.current = sig;
    setBoards(presetsToBoards(presets));
  }, [presets]);

  const publish = (next: EnvPresetBoard[]) => {
    setBoards(next);
    const hasIncomplete = next.some((board) =>
      board.values.some((entry) =>
        Object.values(entry.kv || {}).some(
          (v) => typeof v === "string" && isIncompleteJsonLiteral(v),
        ),
      ),
    );
    if (hasIncomplete) {
      return;
    }
    const sanitized = boardsToPresets(next);
    syncedSig.current = envPresetsSignature(sanitized);
    onChange(sanitized);
  };

  const handleBoardChange = (idx: number, patch: Partial<EnvPresetBoard>) => {
    publish(safeList(boards).map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const handleRemoveBoard = (idx: number) => {
    publish(boards.filter((_, i) => i !== idx));
  };

  const handleAddBoard = () => {
    let newName = "preset";
    let i = 1;
    const names = new Set(boards.map(b => b.name));
    while (names.has(newName)) {
      newName = `preset${i++}`;
    }
    publish([...boards, { name: newName, values: [] }]);
  };

  const handleEnvChange = (
    boardIdx: number,
    envIdx: number,
    patch: Partial<{ env: string; kv: JSONRecord }>,
  ) => {
    const board = boards[boardIdx];
    const updatedValues = safeList(board.values).map((v, i) =>
      i === envIdx ? { ...v, ...patch } : v,
    );
    handleBoardChange(boardIdx, { values: updatedValues });
  };

  const handleRemoveEnv = (boardIdx: number, envIdx: number) => {
    const board = boards[boardIdx];
    handleBoardChange(boardIdx, {
      values: board.values.filter((_, i) => i !== envIdx),
    });
  };

  const handleAddEnv = (boardIdx: number) => {
    const board = boards[boardIdx];
    if (!board) {
      return;
    }
    const used = new Set(board.values.map(v => v.env));
    let newEnv = "env";
    let i = 1;
    while (used.has(newEnv)) {
      newEnv = `env${i++}`;
    }
    handleBoardChange(boardIdx, {
      values: [...board.values, { env: newEnv, kv: {} }],
    });
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
                  onChange={envName =>
                    handleEnvChange(boardIdx, envIdx, { env: envName })
                  }
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
                typedValues
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
