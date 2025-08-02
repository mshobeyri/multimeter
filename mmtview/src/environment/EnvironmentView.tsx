import React, { useState } from "react";

export type EnvironmentViewVar = { name: string; label: string; value: string | number | boolean };

interface EnvironmentViewProps {
  vars: EnvironmentViewVar[];
  onClearCache?: () => void;
}

const EnvironmentView: React.FC<EnvironmentViewProps> = ({
  vars,
  onClearCache
}) => {
  const [localVars, setLocalVars] = useState<EnvironmentViewVar[]>(vars);
  
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

  return (
    <div style={{ padding: 8 }}>

      <div style={{
        display: "flex",
        justifyContent: "flex-end", // Changed from "space-between" to "flex-end"
        alignItems: "center",
        marginBottom: "12px"
      }}>
        <div style={{ display: "flex", gap: "8px" }}> {/* Removed "right: 0" */}
          {onClearCache && (
            <button onClick={handleClearCache} className="action-button">
              <span className="codicon codicon-clear-all" style={{ fontSize: "16px" }}></span>
              Clear environments
            </button>
          )}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: "#222", color: "#fff" }}>
            <th style={{ padding: 6, border: "1px solid #444" }}>Name</th>
            <th style={{ padding: 6, border: "1px solid #444" }}>Label</th>
            <th style={{ padding: 6, border: "1px solid #444" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {safeVars.length > 0 && safeVars.map((v, i) => (
            <tr key={i}>
              <td style={{ padding: 6, border: "1px solid #444" }}>{v.name}</td>
              <td style={{ padding: 6, border: "1px solid #444" }}>{v.label}</td>
              <td style={{ padding: 6, border: "1px solid #444" }}>{v.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {safeVars.length === 0 && (
        <div style={{ color: "#888", padding: 16, textAlign: "center" }}>
          No environment variables saved in workspace.
        </div>
      )}
    </div>
  );
};

export default EnvironmentView;