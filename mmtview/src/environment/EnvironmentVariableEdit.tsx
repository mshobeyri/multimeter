import React, { useEffect, useRef, useState } from "react";
import FieldWithRemove from "../components/FieldWithRemove";
import ValidatableSelect from "../components/ValidatableSelect";
import KSVEditor from "../components/KSVEditor";
import LEditor from "../components/LEditor";
import { EnvironmentData } from "./EnvironmentData";
import { safeList } from "mmt-core/util/safer";
import PrimaryButton from "../components/PrimaryButton";
import type { JSONRecord, JSONValue } from "mmt-core/data/CommonData";
import {
  boardsToVariables,
  envListValueToInputBox,
  envVariablesSignature,
  variablesToBoards,
  type EnvVariableBoard,
} from "./envVariableUi";
import { isIncompleteJsonLiteral } from "mmt-core/parse/yamlValueConvert";

const typeOptions = [
  { label: "List", value: "list" },
  { label: "Object", value: "object" },
  { label: "OS", value: "os" },
];

function boardHasIncompleteJson(boards: EnvVariableBoard[]): boolean {
  for (const board of boards) {
    if (board.type === "list" && Array.isArray(board.value)) {
      if (board.value.some(
        (v) => typeof v === "string" && isIncompleteJsonLiteral(v),
      )) {
        return true;
      }
    } else if (
      board.type === "object" &&
      board.value &&
      typeof board.value === "object" &&
      !Array.isArray(board.value)
    ) {
      if (Object.values(board.value).some(
        (v) => typeof v === "string" && isIncompleteJsonLiteral(v),
      )) {
        return true;
      }
    }
  }
  return false;
}

function emptyValueForType(type: EnvVariableBoard["type"]): EnvVariableBoard["value"] {
  if (type === "list") {
    return [];
  }
  if (type === "os") {
    return "";
  }
  return {};
}

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
    if (boardHasIncompleteJson(next)) {
      // Keep local draft while JSON object/list literals are mid-edit.
      return;
    }
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
                  type: val as "list" | "object" | "os",
                  value: emptyValueForType(val as EnvVariableBoard["type"]),
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
                (v: JSONValue) => envListValueToInputBox(v),
              )}
              onChange={v => handleBoardChange(idx, { value: v })}
              placeholder="Value"
            />
          ) : board.type === "os" ? (
            <>
              <div className="label">OS variable</div>
              <div className="field-pad">
                <input
                  type="text"
                  className="mmt-fill"
                  value={typeof board.value === "string" ? board.value : ""}
                  onChange={e =>
                    handleBoardChange(idx, { value: e.target.value })
                  }
                  placeholder="API_TOKEN"
                  spellCheck={false}
                  title="Process environment variable name (written as $NAME in YAML)"
                />
              </div>
            </>
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
