import React from "react";

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
          {pairs.map(pair => {
            const isValid = pair.options.includes(pair.value);
            return (
              <tr key={pair.name}>
                <td style={{ padding: "8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pair.name}
                </td>
                <td style={{ padding: "8px" }}>
                  <select
                    value={showPlaceholder ? "" : pair.value}
                    onChange={e => onChange(pair.name, e.target.value)}
                    style={{
                      width: "100%",
                      color: isValid ? undefined : "red",
                      borderColor: isValid ? undefined : "red"
                    }}
                  >
                    {showPlaceholder && (
                      <option value="" disabled>
                        Select...
                      </option>
                    )}
                    {!isValid && pair.value && !showPlaceholder && (
                      <option value={pair.value} disabled style={{ color: "red" }}>
                        {pair.value} (invalid)
                      </option>
                    )}
                    {pair.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
);

export default ComboTable;
export type { ComboTablePair, ComboTableProps };