import React from "react";
import { APIData } from "mmt-core/APIData";
import { JSONRecord } from "mmt-core/CommonData";
import {
  stringContainsFieldToken,
} from "mmt-core/apiBodyEdit";
import {
  stringFieldToYamlWithLiveTokens,
  yamlValueToInputBoxWithTokens,
} from "../components/convertor";
import StableTextInput from "../components/StableTextInput";
import TokenFieldInput from "../components/TokenFieldInput";
import { useEnvTokenValueContext } from "../components/useEnvTokenValueContext";
import type { RuntimeTokenValueContext } from "mmt-core/apiBodyEdit";

interface ApiAuthEditorProps {
  api: APIData;
  update: (patch: Partial<APIData>) => void;
}

const authTypeOptions = ["none", "bearer", "basic", "api-key", "oauth2"] as const;
const apiKeyPlacementOptions = ["header", "query"] as const;

function authSelectValue(auth: APIData["auth"]): string {
  if (!auth || auth === "none") {
    return "none";
  }
  return auth.type;
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
  const display = yamlValueToInputBoxWithTokens(value ?? "", true, true);
  const hasTokens = stringContainsFieldToken(display);
  if (password && !hasTokens) {
    return (
      <StableTextInput
        className={className}
        type="password"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={onCommit}
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
      onCommit={v => onCommit(stringFieldToYamlWithLiveTokens(v))}
      onDraftChange={v => onCommit(stringFieldToYamlWithLiveTokens(v))}
    />
  );
}

/** Auth type and credentials — Auth tab. */
const ApiAuthEditor: React.FC<ApiAuthEditorProps> = ({ api, update }) => {
  const valueContext = useEnvTokenValueContext(
    typeof api.inputs === "object" ? (api.inputs as JSONRecord) : {},
  );

  return (
    <div className="panel-form">
      <div className="panel-form-row">
        <select
          value={authSelectValue(api.auth)}
          onChange={e => {
            const val = e.target.value;
            if (val === "none") {
              // Default: omit auth from YAML entirely (do not write auth: none).
              update({ auth: undefined });
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
                value={api.auth.query != null && api.auth.header == null ? "query" : "header"}
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
              <StableTextInput
                className="field-grow"
                type="text"
                placeholder="Key name"
                value={api.auth.header ?? api.auth.query ?? ""}
                onChange={next => {
                  const current = api.auth as {
                    type: "api-key";
                    header?: string;
                    query?: string;
                    value: string;
                  };
                  if (current.query == null || current.header != null) {
                    update({ auth: { type: "api-key", header: next, value: current.value } });
                  } else {
                    update({ auth: { type: "api-key", query: next, value: current.value } });
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
    </div>
  );
};

export default ApiAuthEditor;
