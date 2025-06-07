import React from "react";
import ValidatableSelect from "./ValidatableSelect";

interface ComboTablePair {
  name: string;
  options: string[];
  value: string;
}

interface ComboTableProps {
  pairs: ComboTablePair[];
  onChange: (name: string, value: string) => void;
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
          {pairs.map(pair => (
            <tr key={pair.name}>
              <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pair.name}
              </td>
              <td style={{ padding: "8px" }}>
                <ValidatableSelect
                  value={pair.value}
                  options={pair.options}
                  onChange={val => onChange(pair.name, val)}
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
export type { ComboTablePair, ComboTableProps };