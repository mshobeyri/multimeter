import React, { useState } from "react";
import { EnvVariable } from "./EnvironmentData";
import SettingsTable, { SettingsTableColumn, SettingsTableRow } from "../components/SettingsTable";

interface EnvironmentViewProps {
  vars: EnvVariable[];
  onClearCache?: () => void;
}

const EnvironmentView: React.FC<EnvironmentViewProps> = ({
  vars,
  onClearCache
}) => {
  const [localVars, setLocalVars] = useState<EnvVariable[]>(vars);

  // Update local vars when props change
  React.useEffect(() => {
    setLocalVars(vars);
  }, [vars]);

  const safeVars = Array.isArray(localVars) ? localVars : [];

  const handleClearCache = () => {
    // Clear local display immediately
    setLocalVars([]);

    // Call parent handler
    if (onClearCache) {
      onClearCache();
    }
  };

  const columns: SettingsTableColumn[] = [
    { key: "name", label: "Name", width: "30%", variant: "key" },
    { key: "label", label: "Label", width: "35%" },
    { key: "value", label: "Value", width: "35%", variant: "code" }
  ];

  const rows: SettingsTableRow[] = safeVars.map(v => ({
    key: v.name,
    cells: {
      name: v.name,
      label: v.label,
      value: String(v.value ?? "")
    }
  }));

  return (
    <div style={{ padding: 8, overflow: "hidden", width: "100%" }}>
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        marginBottom: "12px"
      }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {onClearCache && (
            <button onClick={handleClearCache} className="action-button">
              <span className="codicon codicon-clear-all" style={{ fontSize: "16px" }}></span>
              Clear environments
            </button>
          )}
        </div>
      </div>

      <SettingsTable
        columns={columns}
        rows={rows}
        emptyLabel="No environment variables saved in workspace."
      />
    </div>
  );
};

export default EnvironmentView;