import React from "react";
import { EnvCertificates, EnvClientCertificate, EnvCaCertificate } from "./EnvironmentData";
import { safeList } from "mmt-core/safer";
import FieldWithRemove from "../components/FieldWithRemove";
import FilePickerInput from "../components/FilePickerInput";
import { FileContext } from "../fileContext";
import PrimaryButton from "../components/PrimaryButton";
import {
  applyClientCertMaterialMode,
  applyClientCertPassphraseMode,
  ClientCertMaterialMode,
  ClientCertPassphraseMode,
  clientCertMaterialMode,
  clientCertPassphraseMode,
} from "../text/clientCertificateFields";

interface EnvironmentCertificatesEditProps {
  certificates: EnvCertificates | undefined;
  onChange: (certificates: EnvCertificates) => void;
}

type ClientFieldModes = {
  material?: ClientCertMaterialMode;
  passphrase?: ClientCertPassphraseMode;
};

function shiftIndexRecord<T>(
    prev: Record<number, T>, removedIdx: number): Record<number, T> {
  const next: Record<number, T> = {};
  Object.keys(prev).forEach((key) => {
    const i = Number(key);
    if (i < removedIdx) {
      next[i] = prev[i];
    } else if (i > removedIdx) {
      next[i - 1] = prev[i];
    }
  });
  return next;
}

const EnvironmentCertificatesEdit: React.FC<EnvironmentCertificatesEditProps> = ({
  certificates,
  onChange,
}) => {
  const fileCtx = React.useContext(FileContext);
  const safeCerts: EnvCertificates = certificates || {};
  const clients = safeList(safeCerts.clients || []);
  const [fieldModesByIndex, setFieldModesByIndex] =
      React.useState<Record<number, ClientFieldModes>>({});
  const ca: EnvCaCertificate = typeof safeCerts.server_ca === "string"
    ? {path: safeCerts.server_ca}
    : safeCerts.server_ca || {};
  const caPath = ca.path || safeList(ca.paths || [])[0] || "";

  const handleCaPathChange = (path: string) => {
    onChange({
      ...safeCerts,
      server_ca: path || undefined,
    });
  };

  const patchFieldModes = (idx: number, patch: ClientFieldModes) => {
    setFieldModesByIndex((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], ...patch },
    }));
  };

  const handleClientChange = (idx: number, patch: Partial<EnvClientCertificate>) => {
    const updated = clients.map((c, i) => {
      if (i !== idx) {
        return c;
      }
      let merged: EnvClientCertificate = { ...c, ...patch };
      if ("pfx" in patch) {
        merged = applyClientCertMaterialMode(merged, "pfx");
      } else if ("cert" in patch || "key" in patch) {
        merged = applyClientCertMaterialMode(merged, "pem");
      }
      if ("passphrase_plain" in patch) {
        merged = applyClientCertPassphraseMode(merged, "plain");
      } else if ("passphrase_env" in patch) {
        merged = applyClientCertPassphraseMode(merged, "env");
      }
      return merged;
    });
    onChange({ ...safeCerts, clients: updated });
  };

  const handleClientMaterialMode = (idx: number, mode: ClientCertMaterialMode) => {
    patchFieldModes(idx, { material: mode });
    const updated = clients.map((c, i) => (
      i === idx ? applyClientCertMaterialMode(c, mode) : c
    ));
    onChange({ ...safeCerts, clients: updated });
  };

  const handleClientPassphraseMode = (idx: number, mode: ClientCertPassphraseMode) => {
    patchFieldModes(idx, { passphrase: mode });
    const updated = clients.map((c, i) => (
      i === idx ? applyClientCertPassphraseMode(c, mode) : c
    ));
    onChange({ ...safeCerts, clients: updated });
  };

  const handleRemoveClient = (idx: number) => {
    setFieldModesByIndex((prev) => shiftIndexRecord(prev, idx));
    const updated = clients.filter((_, i) => i !== idx);
    onChange({ ...safeCerts, clients: updated });
  };
  const handleAddClient = () => {
    const newClient: EnvClientCertificate = {
      name: "",
      host: "*",
    };
    onChange({ ...safeCerts, clients: [...clients, newClient] });
  };

  return (
    <div>
      <div className="inner-box">
        <div className="label">Server CA Certificate</div>
        <div style={{ padding: "5px" }}>
          <FilePickerInput
            value={caPath}
            onChange={(path) => handleCaPathChange(path)}
            onEnterPressed={(path) => handleCaPathChange(path)}
            basePath={fileCtx?.mmtFilePath}
            placeholder="Server CA cert path"
            showFilePicker
            filters={[{ name: "Certificate files", extensions: ["pem", "crt", "cer"] }]}
          />
        </div>
      </div>

      <div className="inner-box">
        <div className="label">Client Certificates</div>
        {safeList(clients).map((client, idx) => {
          const modes = fieldModesByIndex[idx] || {};
          const materialMode = modes.material ?? clientCertMaterialMode(client);
          const passphraseMode = modes.passphrase ?? clientCertPassphraseMode(client);
          const pemEnabled = materialMode === "pem";
          const pfxEnabled = materialMode === "pfx";
          const envEnabled = passphraseMode === "env";
          const plainEnabled = passphraseMode === "plain";
          return (
            <div key={idx} className="inner-box" style={{ margin: "5px" }}>
              <div className="label" style={{ marginBottom: "8px" }}>Client</div>
              <FieldWithRemove
                value={client.name}
                onChange={(v: string) => handleClientChange(idx, { name: v })}
                onRemovePressed={() => handleRemoveClient(idx)}
                placeholder="Certificate name"
              />

              <div style={{ marginTop: "8px" }}>
                <div className="label" style={{ fontSize: "12px" }}>Host Pattern</div>
                <input
                  type="text"
                  className="input-field"
                  value={client.host}
                  onChange={(e) => handleClientChange(idx, { host: e.target.value })}
                  placeholder="e.g., *.api.example.com"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className="label" style={{ fontSize: "12px" }}>Certificate</div>
                <select
                  className="input-field"
                  value={materialMode}
                  onChange={(e) => handleClientMaterialMode(idx, e.target.value as ClientCertMaterialMode)}
                  aria-label="Client certificate format"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="pem">Cert + Key</option>
                  <option value="pfx">PFX / P12</option>
                </select>
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className={pemEnabled ? "label" : "label label-disabled"} style={{ fontSize: "12px" }}>CRT File</div>
                <FilePickerInput
                  value={client.cert || ""}
                  onChange={(v) => handleClientChange(idx, { cert: v || undefined })}
                  onEnterPressed={(v) => handleClientChange(idx, { cert: v || undefined })}
                  basePath={fileCtx?.mmtFilePath}
                  showFilePicker
                  disabled={!pemEnabled}
                  filters={[{ name: 'Certificate files', extensions: ['pem', 'crt', 'cer'] }]}
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className={pemEnabled ? "label" : "label label-disabled"} style={{ fontSize: "12px" }}>KEY File</div>
                <FilePickerInput
                  value={client.key || ""}
                  onChange={(v) => handleClientChange(idx, { key: v || undefined })}
                  onEnterPressed={(v) => handleClientChange(idx, { key: v || undefined })}
                  basePath={fileCtx?.mmtFilePath}
                  showFilePicker
                  disabled={!pemEnabled}
                  filters={[{ name: 'Key files', extensions: ['key', 'pem'] }]}
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className={pfxEnabled ? "label" : "label label-disabled"} style={{ fontSize: "12px" }}>PFX / P12 File</div>
                <FilePickerInput
                  value={client.pfx || ""}
                  onChange={(v) => handleClientChange(idx, { pfx: v || undefined })}
                  onEnterPressed={(v) => handleClientChange(idx, { pfx: v || undefined })}
                  basePath={fileCtx?.mmtFilePath}
                  showFilePicker
                  disabled={!pfxEnabled}
                  filters={[{ name: 'PFX/P12 files', extensions: ['pfx', 'p12'] }]}
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className="label" style={{ fontSize: "12px" }}>Passphrase</div>
                <select
                  className="input-field"
                  value={passphraseMode}
                  onChange={(e) => handleClientPassphraseMode(idx, e.target.value as ClientCertPassphraseMode)}
                  aria-label="Passphrase source"
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  <option value="env">Env var</option>
                  <option value="plain">Plain</option>
                </select>
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className={envEnabled ? "label" : "label label-disabled"} style={{ fontSize: "12px" }}>Passphrase env</div>
                <input
                  type="text"
                  className="input-field"
                  value={client.passphrase_env || ""}
                  onChange={(e) => handleClientChange(idx, { passphrase_env: e.target.value || undefined })}
                  placeholder="e.g., CERT_PASSPHRASE"
                  disabled={!envEnabled}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginTop: "8px" }}>
                <div className={plainEnabled ? "label" : "label label-disabled"} style={{ fontSize: "12px" }}>Passphrase plain</div>
                <input
                  type="password"
                  className="input-field"
                  value={client.passphrase_plain || ""}
                  onChange={(e) => handleClientChange(idx, { passphrase_plain: e.target.value || undefined })}
                  placeholder="Leave empty if not encrypted"
                  disabled={!plainEnabled}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
            </div>
          );
        })}

        <PrimaryButton
          icon="add"
          onClick={handleAddClient}
          style={{ margin: "12px 5px 5px" }}
        >
          Add Client Certificate
        </PrimaryButton>
      </div>
    </div>
  );
};

export default EnvironmentCertificatesEdit;
