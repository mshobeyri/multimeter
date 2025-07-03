import React from "react";
import VariableEditor from "./VariableEditor";
import { VariablesData, Variable } from "./VariablesData";

interface VariablesEditorProps {
  variablesData: VariablesData;
  setVariablesData: (data: VariablesData) => void;
}

const VariablesEditor: React.FC<VariablesEditorProps> = ({ variablesData, setVariablesData }) => {
  // variablesData.variables is now an array of Variable
  const variablesArray: Variable[] = Array.isArray(variablesData.variables)
    ? variablesData.variables
    : [];

  const addVariable = () => {
    const newName = `var${variablesArray.length + 1}`;
    setVariablesData({
      ...variablesData,
      variables: [
        ...variablesArray,
        { name: newName, type: "" }
      ]
    });
  };

  const updateVariable = (idx: number, updatedVar: Variable) => {
    const newVariables = [...variablesArray];
    newVariables[idx] = updatedVar;
    setVariablesData({
      ...variablesData,
      variables: newVariables
    });
  };

  const removeVariable = (idx: number) => {
    const newVariables = variablesArray.slice();
    newVariables.splice(idx, 1);
    setVariablesData({
      ...variablesData,
      variables: newVariables
    });
  };

  return (
    <div
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
      <h2 style={{ marginTop: 0, marginBottom: 24 }}>Variables</h2>
      {variablesArray.map((variable, idx) => (
        <div key={idx} style={{ marginBottom: 24 }}>
          <VariableEditor
            variable={variable}
            variables={variablesArray.slice(0, idx)}
            onChange={updatedVar => updateVariable(idx, updatedVar)}
            onRemove={() => removeVariable(idx)}
          />
        </div>
      ))}
      <button
        onClick={addVariable}
        style={{
          background: "var(--vscode-button-background, #0e639c)",
          color: "var(--vscode-button-foreground, #fff)",
          border: "none",
          borderRadius: 4,
          padding: "8px 16px",
          cursor: "pointer",
          width: "100%",
        }}
      >
        Add Variable
      </button>
    </div>
  );
};

export default VariablesEditor;