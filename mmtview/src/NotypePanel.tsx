import React from "react";
import parseYaml from "./markupConvertor";
import { typeOptions } from "./components/CommonData";

interface NotypePanelProps {
  content: string;
  setContent: (c: string) => void;
}

const NotypePanel: React.FC<NotypePanelProps> = ({ content, setContent }) => (
  <div style={{ padding: 32 }}>
    <label style={{ fontWeight: 500, marginRight: 8 }}>Select document type:</label>
    <select
      value=""
      onChange={e => {
        const type = e.target.value;
        if (!type) return;
        let parsed: any = {};
        try {
          parsed = parseYaml(content) || {};
        } catch {}
        parsed.type = type;
        const yamlStr =
          `type: ${type}\n` +
          Object.entries(parsed)
            .filter(([k]) => k !== "type")
            .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
            .join("\n");
        setContent(yamlStr);
      }}
      style={{ fontSize: 16, padding: 8 }}
    >
      <option value="">-- Select --</option>
      {typeOptions.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export default NotypePanel;