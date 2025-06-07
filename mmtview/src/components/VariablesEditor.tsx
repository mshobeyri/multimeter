import React, { useState } from "react";
import VariableEditor, {VariableField} from "./VariableEditor";

export type VariablesList = VariableField[][];

const VariablesVariable: React.FC = () => {
  const [variables, setVariables] = useState<VariablesList>([
    [] // Start with one empty variable variable
  ]);

  const addVariable = () => setVariables([...variables, []]);
  const removeVariable = (idx: number) =>
    setVariables(variables.filter((_, i) => i !== idx));
  return (
    <div>
      {variables.map((fields, idx) => (
        <div key={idx} style={{ marginBottom: 24 }}>
          <VariableEditor
            fields={fields}
            setFields={f =>
              setVariables(prev =>
                prev.map((v, i) => (i === idx ? f : v))
              )
            }
            onRemove={() => removeVariable(idx)} // <-- add this line
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

export default VariablesVariable;