import React, { useState } from "react";
import VariableEditor, { VariableField } from "./VariableEditor";

export type VariablesList = VariableField[];

const VariablesEditor: React.FC = () => {
  const [variables, setVariables] = useState<VariablesList>([]);

  const addVariable = () =>
    setVariables([
      ...variables,
      { name: "", value: "", key: "", type: "" }
    ]);
  const removeVariable = (idx: number) =>
    setVariables(variables.filter((_, i) => i !== idx));

  return (
    <div>
      {variables.map((fields, idx) => (
        <div key={idx} style={{ marginBottom: 24 }}>
          <VariableEditor
            idx={idx}
            variables={variables}
            setVariables={setVariables}
            onRemove={() => removeVariable(idx)}
          />
          <button
            onClick={() => removeVariable(idx)}
            title="Remove field"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 28,
              height: 24,
              background: "none",
              color: "#c00",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              zIndex: 1
            }}
          >
            🗑️
          </button>
        </div>
      ))}
      <button
        onClick={addVariable}
        style={{
          marginTop: 16,
          background: "var(--vscode-button-background, #0e639c)",
          color: "var(--vscode-button-foreground, #fff)",
          border: "none",
          borderRadius: 4,
          padding: "8px 16px",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        Add Variable
      </button>
    </div>
  );
};

export default VariablesEditor;