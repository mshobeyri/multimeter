import React from "react";

export type EnvironmentViewVar = { name: string; label: string; value: string };

const EnvironmentView: React.FC<{ vars: EnvironmentViewVar[] }> = ({ vars }) => {
  const safeVars = Array.isArray(vars) ? vars : [];
  return (
    <div style={{ padding: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: "#222", color: "#fff" }}>
            <th style={{ padding: 6, border: "1px solid #444" }}>Name</th>
            <th style={{ padding: 6, border: "1px solid #444" }}>Label</th>
            <th style={{ padding: 6, border: "1px solid #444" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {safeVars.length >0 && safeVars.map((v, i) => (
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