import React, { useEffect, useRef, useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import ValidatableSelect from "../components/ValidatableSelect";
import KSVEditor from "../components/KSVEditor";
import LEditor from "../components/LEditor";
import { EnvironmentData } from "./EnvironmentData";
import { safeList } from "mmt-core/safer";
import PrimaryButton from "../components/PrimaryButton";
import type { JSONRecord, JSONValue } from "mmt-core/CommonData";
import {
  boardsToVariables,
  envListValueToInputBox,
  envVariablesSignature,
  variablesToBoards,
  type EnvVariableBoard,
} from "./envVariableUi";

const typeOptions = [
  { label: "List", value: "list" },
  { label: "Object", value: "object" },
];

interface EnvironmentVariableEditProps {
  variables: EnvironmentData["variables"];
  onChange: (variables: EnvironmentData["variables"]) => void;
}

const EnvironmentVariableEdit: React.FC<EnvironmentVariableEditProps> = ({
  variables,
  onChange,
}) => {
  const [boards, setBoards] = useState<EnvVariableBoard[]>(() =>
    variablesToBoards(variables),
  );
  const syncedSig = useRef(envVariablesSignature(variables));

  useEffect(() => {
    const sig = envVariablesSignature(variables);
    if (sig === syncedSig.current) {
      return;
    }
    syncedSig.current = sig;
    setBoards(variablesToBoards(variables));
  }, [variables]);

  const publish = (next: EnvVariableBoard[]) => {
    setBoards(next);
    const sanitized = boardsToVariables(next);
    syncedSig.current = envVariablesSignature(sanitized);
    onChange(sanitized);
  };

  const handleBoardChange = (idx: number, patch: Partial<EnvVariableBoard>) => {
    publish(safeList(boards).map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const handleRemove = (idx: number) => {
    publish(boards.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    publish([...boards, { name: "", type: "list", value: [] }]);
  };

  return (
    <div>
      {safeList(boards).map((board, idx) => (
        <div key={idx} className="inner-box">
          <div className="label">Name</div>
          <div className="field-pad">
            <FieldWithRemove
              value={board.name}
              onChange={v => handleBoardChange(idx, { name: v })}
              onRemovePressed={() => handleRemove(idx)}
              placeholder="name"
            />
          </div>
          <div className="label">Type</div>
          <div className="field-pad">
            <ValidatableSelect
              value={board.type}
              options={safeList(typeOptions).map(opt => opt.value)}
              onChange={val =>
                handleBoardChange(idx, {
                  type: val as "list" | "object",
                  value: val === "list" ? [] : {},
                })
              }
              showPlaceholder={true}
              placeholder="Select type..."
            />
          </div>
          {board.type === "list" ? (
            <LEditor
              label="Values"
              value={(Array.isArray(board.value) ? board.value : []).map(
                (v: JSONValue) =>
                  typeof v === "string" ? v : envListValueToInputBox(v),
              )}
              onChange={v => handleBoardChange(idx, { value: v })}
              placeholder="Value"
            />
          ) : (
            <KSVEditor
              label="Fields"
              value={
                typeof board.value === "object" && !Array.isArray(board.value)
                  ? (board.value as JSONRecord)
                  : {}
              }
              onChange={v => handleBoardChange(idx, { value: v })}
              keyPlaceholder="Field"
              valuePlaceholder="Value"
              typedValues
            />
          )}
        </div>
      ))}
      <PrimaryButton icon="add" onClick={handleAdd}>
        Add Variable
      </PrimaryButton>
    </div>
  );
};

export default EnvironmentVariableEdit;
