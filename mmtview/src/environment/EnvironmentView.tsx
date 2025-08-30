import React, { useState } from "react";
import { EnvVariable } from "./EnvironmentData";


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

  const tableStyles = {
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      fontSize: 10,
      tableLayout: "fixed" as const, // Force fixed layout for consistent column widths
      maxWidth: "100%", // Ensure table doesn't exceed container
      overflow: "hidden" // Hide any content that might overflow
    },
    th: {
      padding: 6,
      border: "1px solid #444",
      wordWrap: "break-word" as const,
      wordBreak: "break-all" as const,
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    td: {
      padding: 6,
      border: "1px solid #444",
      wordWrap: "break-word" as const,
      wordBreak: "break-all" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: "0", // Allow flex shrinking
      whiteSpace: "pre-wrap" as const // Preserve line breaks but allow wrapping
    }
  };

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

      <div style={{
        width: "100%",
        overflowX: "auto", // Allow horizontal scrolling if absolutely necessary
        overflowY: "visible"
      }}>
        <table style={tableStyles.table}>
          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "50%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#222", color: "#fff" }}>
              <th style={tableStyles.th}>Name</th>
              <th style={tableStyles.th}>Label</th>
              <th style={tableStyles.th}>Value</th>
            </tr>
          </thead>
          <tbody>
            {safeVars.length > 0 && safeVars.map((v, i) => (
              <tr key={i}>
                <td style={tableStyles.td} title={String(v.name)}>
                  {v.name}
                </td>
                <td style={tableStyles.td} title={String(v.label)}>
                  {v.label}
                </td>
                <td style={tableStyles.td} title={String(v.value)}>
                  {String(v.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {safeVars.length === 0 && (
        <div style={{ color: "#888", padding: 16, textAlign: "center" }}>
          No environment variables saved in workspace.
        </div>
      )}
    </div>
  );
};

export default EnvironmentView;