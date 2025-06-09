import React from "react";
import EditableSelect from "./EditableSelect";
import { Parameter } from "./APIEditor"; // Or import from your new Parameter.ts

interface ParameterEditorProps {
  parameter: Parameter;
  onChange: (newParam: Parameter) => void;
  valueOptions?: string[];
}

const ParameterEditor: React.FC<ParameterEditorProps> = ({
  parameter,
  onChange,
  valueOptions = [],
}) => {
  const [key, value] = Object.entries(parameter)[0];

  return (
    <tr>
      <td style={{ padding: "8px", textAlign: "right", width: "40%" }}>
        <input
          value={key}
          onChange={e => onChange({ [e.target.value]: value })}
          style={{ width: "100%" }}
        />
      </td>
      <td style={{ padding: "8px", width: "60%" }}>
        <EditableSelect
          value={value}
          options={valueOptions}
          onChange={val => onChange({ [key]: val })}
        />
      </td>
    </tr>
  );
};

export default ParameterEditor;