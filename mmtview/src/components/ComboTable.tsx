import React from "react";
import { safeList } from "mmt-core/safer";
import { JSONValue } from "mmt-core/CommonData";

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
  <div className="combo-table">
    <table>
      <colgroup>
        <col />
        <col />
      </colgroup>
      <tbody>
        {safeList(pairs).map(pair => (
          <tr key={pair.name}>
            <td className="combo-name">
              {pair.name}
            </td>
            <td className="combo-value">
              <select
                className="flat-select mmt-fill"
                value={pair.value?.label ?? ""}
                onChange={e => {
                  const label = e.target.value;
                  const found = safeList(pair.options).find(opt => opt.label === label);
                  if (found) {
                    onChange(pair.name, found.label, found.value);
                  }
                }}
              >
                {showPlaceholder && <option value="" disabled>{"Select..."}</option>}
                {safeList(pair.options).map(opt => (
                  <option key={opt.label} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ComboTable;
export type { ComboTablePair, ComboTableOption, ComboTableProps };
