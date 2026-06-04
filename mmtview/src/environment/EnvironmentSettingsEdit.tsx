import React from "react";
import { EnvSetting } from "./EnvironmentData";

interface EnvironmentSettingsEditProps {
  setting: EnvSetting | undefined;
  onChange: (setting: EnvSetting) => void;
}

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const EnvironmentSettingsEdit: React.FC<EnvironmentSettingsEditProps> = ({
  setting,
  onChange,
}) => {
  const http = setting?.http || {};

  const updateHttp = (patch: Partial<NonNullable<EnvSetting["http"]>>) => {
    const nextHttp = {
      ...http,
      ...patch,
    };
    for (const key of Object.keys(nextHttp) as Array<keyof typeof nextHttp>) {
      if (nextHttp[key] === undefined) {
        delete nextHttp[key];
      }
    }
    onChange({
      ...(setting || {}),
      http: nextHttp,
    });
  };

  return (
    <div>
      <div className="inner-box">
        <div className="label">HTTP Settings</div>
        <div style={{ padding: "5px", display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
          <div>
            <div className="label" style={{ fontSize: "12px" }}>HTTP Version</div>
            <select
              className="input-field"
              value={http.version ?? "auto"}
              onChange={(e) => updateHttp({ version: e.target.value || undefined })}
              style={{ width: "100%", boxSizing: "border-box" }}
            >
              <option value="auto">auto</option>
              <option value="1">1</option>
              <option value="1.1">1.1</option>
              <option value="2">2</option>
            </select>
          </div>
          <div>
            <div className="label" style={{ fontSize: "12px" }}>Timeout (ms)</div>
            <input
              type="number"
              min={0}
              className="input-field"
              value={http.timeout ?? ""}
              onChange={(e) => updateHttp({ timeout: parseNumberInput(e.target.value) })}
              placeholder="30000"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentSettingsEdit;
