import React from "react";
import ValidatableSelect from "./ValidatableSelect";
import { safeList } from "../safer";
import { JSONValue } from "../CommonData";

interface ComboTableOption {
  label: string;
  value: JSONValue;
}

interface ComboTablePair {
  name: string;
  options: ComboTableOption[];
  value: ComboTableOption;
}

interface ComboTableProps {
  pairs: ComboTablePair[];
  onChange: (name: string, label: string, value: JSONValue) => void;
  showPlaceholder?: boolean;
}

const ComboTable: React.FC<ComboTableProps> = ({ pairs, onChange, showPlaceholder }) => (
  <div
    style={{
      background: "var(--vscode-editorWidget-background, #232323)",
      borderRadius: "6px",
      padding: "16px",
      minWidth: 200,
      marginBottom: "16px"
    }}
  >
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "40%" }} />
        <col style={{ width: "60%" }} />
      </colgroup>
      <tbody>
        {safeList(pairs).map(pair => (
          <tr key={pair.name}>
            <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {pair.name}
            </td>
            <td style={{ padding: "8px" }}>
              <ValidatableSelect
                value={pair.value.label}
                options={safeList(pair.options).map(opt => opt.label)}
                onChange={label => {
                  const found = safeList(pair.options).find(opt => opt.label === label);
                  if (found) {
                    onChange(pair.name, found.label, found.value);
                  }
                }}
                showPlaceholder={showPlaceholder}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ComboTable;
export type { ComboTablePair, ComboTableOption, ComboTableProps };