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
    <div>
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