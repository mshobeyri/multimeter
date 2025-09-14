import React from "react";
import VariableEditor from "./VariableEditor";
import { VariablesData, Variable } from "./VariablesData";
import { safeList } from "mmt-core/safer";

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
    <div className="panel-box">
      <h2 style={{ marginTop: 0, marginBottom: 24 }}>Variables</h2>
      {safeList(variablesArray).map((variable, idx) => (
        <div key={idx}>
          <VariableEditor
            variable={variable}
            variables={variablesArray.slice(0, idx)}
            onChange={updatedVar => updateVariable(idx, updatedVar)}
            onRemove={() => removeVariable(idx)}
          />
        </div>
      ))}
      <button onClick={addVariable} className="add-button" >
        Add Variable
      </button>
    </div>
  );
};

export default VariablesEditor;