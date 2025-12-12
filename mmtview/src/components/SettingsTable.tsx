import React from "react";
import "./SettingsTable.css";

export interface SettingsTableColumn {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  variant?: "default" | "code" | "key";
}

export interface SettingsTableRow {
  key?: React.Key;
  cells: Record<string, React.ReactNode>;
}

interface SettingsTableProps {
  columns: SettingsTableColumn[];
  rows: SettingsTableRow[];
  emptyLabel?: string;
}

const SettingsTable: React.FC<SettingsTableProps> = ({ columns, rows, emptyLabel }) => {
  return (
    <div className="settings-table-block">
      <div className="settings-table-wrapper">
        <table className="settings-table">
          <colgroup>
            {columns.map(col => (
              <col
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.key ?? rowIndex}>
                {columns.map(col => {
                  const value = row.cells[col.key];
                  const cellClassNames = [
                    "settings-table-cell",
                    col.variant === "code" ? "settings-table-cell-code" : undefined,
                    col.variant === "key" ? "settings-table-cell-key" : undefined
                  ].filter(Boolean).join(" ");
                  return (
                    <td
                      key={col.key}
                      className={cellClassNames}
                      style={col.align ? { textAlign: col.align } : undefined}
                    >
                      {value ?? <span className="settings-table-empty-cell">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="settings-table-empty">
          {emptyLabel || "No items available."}
        </div>
      )}
    </div>
  );
};

export default SettingsTable;
