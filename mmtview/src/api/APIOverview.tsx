import React, { useState } from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KSVEditor from "../components/KSVEditor";
import KVEditor from "../components/KVEditor";
import { APIData } from "mmt-core/APIData";
import DescriptionEditor from "../components/DescriptionEditor";
import MdViewer from "../components/MdViewer";
import { safeList } from "mmt-core/safer";

interface APIOverviewProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

const authTypeOptions = ["none", "bearer", "basic", "api-key", "oauth2"] as const;
const apiKeyPlacementOptions = ["header", "query"] as const;

function parseTimeoutInput(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const APIOverview: React.FC<APIOverviewProps> = ({ api, update }) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="panel-form APIOverview">
      <div className="panel-form-row">
        <div className="label">Title</div>
        <input
          value={api.title || ""}
          onChange={e => update({ title: e.target.value })}
          placeholder="title"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Tags</div>
        <SearchableTagInput
          tags={safeList(api.tags)}
          onChange={tags => update({ tags })}
          suggestions={["security", "sessionless", "api", "user", "admin"]}
        />
      </div>

      <div className="panel-form-row">
        <div className="label label-row">
          <span>Description</span>
          <label className="label-action">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={e => setShowPreview(e.target.checked)}
            />
            Preview
          </label>
        </div>
        <DescriptionEditor
          value={api.description || ""}
          onChange={value => update({ description: value })}
        />
        {showPreview && api.description ? (
          <MdViewer
            description={api.description}
            inputs={api.inputs}
            outputs={api.outputs}
          />
        ) : null}
      </div>

      <div className="panel-form-row">
        <div className="label">Timeout (ms)</div>
        <input
          type="number"
          min={0}
          step={100}
          value={api.timeout ?? ""}
          onChange={e => {
            const timeout = parseTimeoutInput(e.target.value);
            update({ timeout });
          }}
          placeholder="Default network timeout"
        />
      </div>

      <div className="panel-form-row">
        <div className="label">Auth</div>
        <select
          value={!api.auth ? "" : api.auth === "none" ? "none" : api.auth.type}
          onChange={e => {
            const val = e.target.value;
            if (!val) {
              update({ auth: undefined });
            } else if (val === "none") {
              update({ auth: "none" });
            } else if (val === "bearer") {
              update({ auth: { type: "bearer", token: "" } });
            } else if (val === "basic") {
              update({ auth: { type: "basic", username: "", password: "" } });
            } else if (val === "api-key") {
              update({ auth: { type: "api-key", header: "", value: "" } });
            } else if (val === "oauth2") {
              update({
                auth: {
                  type: "oauth2",
                  grant: "client_credentials",
                  token_url: "",
                  client_id: "",
                  client_secret: "",
                },
              });
            }
          }}
        >
          <option value="">(none)</option>
          {authTypeOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {api.auth && api.auth !== "none" && api.auth.type === "bearer" && (
          <div className="field-stack">
            <input
              type="text"
              placeholder="Token"
              value={api.auth.token}
              onChange={e => update({ auth: { ...api.auth as any, token: e.target.value } })}
            />
          </div>
        )}

        {api.auth && api.auth !== "none" && api.auth.type === "basic" && (
          <div className="field-inline is-inset">
            <input
              className="field-grow"
              type="text"
              placeholder="Username"
              value={api.auth.username}
              onChange={e => update({ auth: { ...api.auth as any, username: e.target.value } })}
            />
            <input
              className="field-grow"
              type="password"
              placeholder="Password"
              value={api.auth.password}
              onChange={e => update({ auth: { ...api.auth as any, password: e.target.value } })}
            />
          </div>
        )}

        {api.auth && api.auth !== "none" && api.auth.type === "api-key" && (
          <div className="field-stack">
            <div className="field-inline">
              <select
                className="field-narrow"
                value={api.auth.header != null ? "header" : "query"}
                onChange={e => {
                  const placement = e.target.value as "header" | "query";
                  const current = api.auth as {
                    type: "api-key";
                    header?: string;
                    query?: string;
                    value: string;
                  };
                  const name = current.header ?? current.query ?? "";
                  if (placement === "header") {
                    update({ auth: { type: "api-key", header: name, value: current.value } });
                  } else {
                    update({ auth: { type: "api-key", query: name, value: current.value } });
                  }
                }}
              >
                {apiKeyPlacementOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <input
                className="field-grow"
                type="text"
                placeholder="Key name"
                value={api.auth.header ?? api.auth.query ?? ""}
                onChange={e => {
                  const current = api.auth as {
                    type: "api-key";
                    header?: string;
                    query?: string;
                    value: string;
                  };
                  if (current.header != null) {
                    update({ auth: { type: "api-key", header: e.target.value, value: current.value } });
                  } else {
                    update({ auth: { type: "api-key", query: e.target.value, value: current.value } });
                  }
                }}
              />
            </div>
            <input
              type="text"
              placeholder="Value"
              value={api.auth.value}
              onChange={e => update({ auth: { ...api.auth as any, value: e.target.value } })}
            />
          </div>
        )}

        {api.auth && api.auth !== "none" && api.auth.type === "oauth2" && (
          <div className="field-stack">
            <input
              type="text"
              placeholder="Token URL"
              value={api.auth.token_url}
              onChange={e => update({ auth: { ...api.auth as any, token_url: e.target.value } })}
            />
            <div className="field-inline">
              <input
                className="field-grow"
                type="text"
                placeholder="Client ID"
                value={api.auth.client_id}
                onChange={e => update({ auth: { ...api.auth as any, client_id: e.target.value } })}
              />
              <input
                className="field-grow"
                type="password"
                placeholder="Client Secret"
                value={api.auth.client_secret}
                onChange={e => update({ auth: { ...api.auth as any, client_secret: e.target.value } })}
              />
            </div>
            <input
              type="text"
              placeholder="Scope (optional)"
              value={api.auth.scope ?? ""}
              onChange={e => {
                const scope = e.target.value || undefined;
                update({ auth: { ...api.auth as any, scope } });
              }}
            />
          </div>
        )}
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
      <KVEditor
        label="Inputs"
        value={api.inputs}
        onChange={kv => {
          update({ inputs: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
      />
      <KSVEditor
        label="Outputs"
        value={api.outputs}
        onChange={kv => {
          update({ outputs: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="value"
      />
      <KSVEditor
        label="Setenv"
        value={api.setenv}
        onChange={kv => {
          update({ setenv: kv });
        }}
        keyPlaceholder="name"
        valuePlaceholder="body.path or regex"
      />
    </div>
  );
};

export default APIOverview;
