import React from "react";
import KSVEditor from "../components/KSVEditor";
import StableTextInput from "../components/StableTextInput";
import { APIData } from "mmt-core/APIData";

interface ApiSettingsEditorProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

function parseTimeoutInput(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Timeout and import — Settings gear tab. */
const ApiSettingsEditor: React.FC<ApiSettingsEditorProps> = ({ api, update }) => {
  return (
    <div className="panel-form">
      <div className="panel-form-row">
        <div className="label">Timeout (ms)</div>
        <StableTextInput
          type="number"
          min={0}
          step={100}
          value={api.timeout == null ? "" : String(api.timeout)}
          onChange={next => {
            const timeout = parseTimeoutInput(next);
            update({ timeout });
          }}
          placeholder="Default network timeout"
        />
      </div>

      <KSVEditor
        label="Import"
        value={api.import}
        onChange={kv => {
          update({ import: kv });
        }}
        keyPlaceholder="alias"
        valuePlaceholder="path"
        filePicker={true}
        filePickerFilters={[
          { name: "Data files", extensions: ["json", "yaml", "yml", "csv"] },
        ]}
      />
    </div>
  );
};

export default ApiSettingsEditor;
