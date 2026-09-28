import React, { useState } from "react";
import SearchableTagInput from "../components/SearchableTagInput";
import KSVEditor from "../components/KSVEditor";
import KVEditor from "../components/KVEditor";
import { APIData } from "mmt-core/APIData";
import { JSONRecord } from "mmt-core/CommonData";
import DescriptionEditor from "../components/DescriptionEditor";
import MdViewer from "../components/MdViewer";
import { safeList } from "mmt-core/safer";
import {
  peerStringToDisplay,
  peerStringToYaml,
  stringContainsFieldToken,
} from "mmt-core/apiBodyEdit";
import TokenFieldInput from "../components/TokenFieldInput";
import { useEnvTokenValueContext } from "../components/useEnvTokenValueContext";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";

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

function AuthValueField({
  value,
  onCommit,
  valueContext,
  placeholder,
  password,
  className,
}: {
  value: string;
  onCommit: (yaml: string) => void;
  valueContext: RuntimeTokenValueContext;
  placeholder?: string;
  password?: boolean;
  className?: string;
}) {
  const display = peerStringToDisplay(value ?? "");
  const hasTokens = stringContainsFieldToken(display);
  if (password && !hasTokens) {
    return (
      <input
        className={className}
        type="password"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={e => onCommit(e.target.value)}
      />
    );
  }
  return (
    <TokenFieldInput
      className={className}
      value={display}
      canContainToken
      valueContext={valueContext}
      placeholder={placeholder}
      onCommit={v => onCommit(peerStringToYaml(v))}
      onDraftChange={v => onCommit(peerStringToYaml(v))}
    />
  );
}

const APIOverview: React.FC<APIOverviewProps> = ({ api, update }) => {
  const [showPreview, setShowPreview] = useState(false);
  const valueContext = useEnvTokenValueContext(
    typeof api.inputs === "object" ? (api.inputs as JSONRecord) : {},
  );

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
            <AuthValueField
              placeholder="Token"
              value={api.auth.token}
              valueContext={valueContext}
              onCommit={token => update({ auth: { ...api.auth as any, token } })}
            />
          </div>
        )}

        {api.auth && api.auth !== "none" && api.auth.type === "basic" && (
          <div className="field-inline is-inset">
            <AuthValueField
              className="field-grow"
              placeholder="Username"
              value={api.auth.username}
              valueContext={valueContext}
              onCommit={username => update({ auth: { ...api.auth as any, username } })}
            />
            <AuthValueField
              className="field-grow"
              placeholder="Password"
              password
              value={api.auth.password}
              valueContext={valueContext}
              onCommit={password => update({ auth: { ...api.auth as any, password } })}
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
            <AuthValueField
              placeholder="Value"
              value={api.auth.value}
              valueContext={valueContext}
              onCommit={value => update({ auth: { ...api.auth as any, value } })}
            />
          </div>
        )}

        {api.auth && api.auth !== "none" && api.auth.type === "oauth2" && (
          <div className="field-stack">
            <AuthValueField
              placeholder="Token URL"
              value={api.auth.token_url}
              valueContext={valueContext}
              onCommit={token_url => update({ auth: { ...api.auth as any, token_url } })}
            />
            <div className="field-inline">
              <AuthValueField
                className="field-grow"
                placeholder="Client ID"
                value={api.auth.client_id}
                valueContext={valueContext}
                onCommit={client_id => update({ auth: { ...api.auth as any, client_id } })}
              />
              <AuthValueField
                className="field-grow"
                placeholder="Client Secret"
                password
                value={api.auth.client_secret}
                valueContext={valueContext}
                onCommit={client_secret => update({ auth: { ...api.auth as any, client_secret } })}
              />
            </div>
            <AuthValueField
              placeholder="Scope (optional)"
              value={api.auth.scope ?? ""}
              valueContext={valueContext}
              onCommit={scopeRaw => {
                const scope = scopeRaw || undefined;
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
        canContainToken
        valueContext={valueContext}
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
