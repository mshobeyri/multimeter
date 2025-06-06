import React from "react";

interface ComboTablePair {
  name: string;
  options: string[];
  value: string;
}

interface ComboTableProps {
  pairs: ComboTablePair[];
  onChange: (name: string, value: string) => void;
}

const ComboTable: React.FC<ComboTableProps> = ({ pairs, onChange }) => (
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <tbody>
      {pairs.map(pair => {
        const isValid = pair.options.includes(pair.value);
        return (
          <tr key={pair.name}>
            <td style={{ padding: "8px" }}>{pair.name}</td>
            <td style={{ padding: "8px" }}>
              <select
                value={pair.value}
                onChange={e => onChange(pair.name, e.target.value)}
                style={{
                  width: "100%",
                  color: isValid ? undefined : "red",
                  borderColor: isValid ? undefined : "red"
                }}
              >
                {!isValid && pair.value && (
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
);

export default ComboTable;
export type { ComboTablePair, ComboTableProps };