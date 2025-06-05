import React, { useState } from "react";

interface ComboTablePair {
  name: string;
  options: string[];
  value: string;
}

interface ComboTableProps {
  pairs: ComboTablePair[];
  onChange: (name: string, value: string) => void;
}

const ComboTable: React.FC<ComboTableProps> = ({ pairs, onChange }) => {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "8px" }}>Name</th>
          <th style={{ textAlign: "left", padding: "8px" }}>Value</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map(pair => (
          <tr key={pair.name}>
            <td style={{ padding: "8px" }}>{pair.name}</td>
            <td style={{ padding: "8px" }}>
              <select
                value={pair.value}
                onChange={e => onChange(pair.name, e.target.value)}
                style={{ width: "100%" }}
              >
                {pair.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

interface EnvironmentPanelProps {
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

const EnvironmentPanel: React.FC<EnvironmentPanelProps> = () => {
  const [pairs, setPairs] = useState<ComboTablePair[]>([
    { name: "test_type", options: ["smoke", "regression", "load"], value: "smoke" },
    { name: "endpoint", options: ["st", "et", "pr"], value: "st" },
    { name: "certificate", options: ["cert1", "cert2"], value: "cert1" }
  ]);

  const handlePairChange = (name: string, value: string) => {
    setPairs(prev =>
      prev.map(pair =>
        pair.name === name ? { ...pair, value } : pair
      )
    );
  };

  return <ComboTable pairs={pairs} onChange={handlePairChange} />;
};

export default EnvironmentPanel;