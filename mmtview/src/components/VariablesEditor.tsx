import React from "react";
import VariableEditor, { VariableData } from "./VariableEditor";

export type VariablesList = VariableData[];

interface VariablesEditorProps {
  variables: VariablesList;
  setVariables: (vars: VariablesList) => void;
}

const VariablesEditor: React.FC<VariablesEditorProps> = ({ variables, setVariables }) => {
  const addVariable = () =>
    setVariables([
      ...variables,
      { name: "", value: "", key: "", type: "" }
    ]);
  const removeVariable = (idx: number) =>
    setVariables(variables.filter((_, i) => i !== idx));

  return (
    <div>
      {variables.map((variable, idx) => (
        <div key={idx} style={{ marginBottom: 24 }}>
          <VariableEditor
            variable={variable}
            variables={variables}
            onChange={updatedVar => {
              const newVars = [...variables];
              newVars[idx] = updatedVar;
              setVariables(newVars);
            }}
            onRemove={() => removeVariable(idx)}
          />
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