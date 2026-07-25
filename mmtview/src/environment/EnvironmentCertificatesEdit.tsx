import React from "react";
import { EnvCertificates, EnvClientCertificate, EnvCaCertificate } from "./EnvironmentData";
import { safeList } from "mmt-core/safer";
import FieldWithRemove from "../components/FieldWithRemove";
import FilePickerInput from "../components/FilePickerInput";
import { FileContext } from "../fileContext";
import PrimaryButton from "../components/PrimaryButton";

interface EnvironmentCertificatesEditProps {
  certificates: EnvCertificates | undefined;
  onChange: (certificates: EnvCertificates) => void;
}

const EnvironmentCertificatesEdit: React.FC<EnvironmentCertificatesEditProps> = ({
  certificates,
  onChange,
}) => {
  const fileCtx = React.useContext(FileContext);
  const safeCerts: EnvCertificates = certificates || {};
  const clients = safeList(safeCerts.clients || []);
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

  const handleClientChange = (idx: number, patch: Partial<EnvClientCertificate>) => {
    const updated = clients.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...safeCerts, clients: updated });
  };

  const handleRemoveClient = (idx: number) => {
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
            filters={[{ name: "Certificate files", extensions: ["pem", "crt", "cer", "p12", "pfx"] }]}
          />
        </div>
      </div>

      {/* Client Certificates Section */}
      <div className="inner-box">
        <div className="label">Client Certificates</div>
        {safeList(clients).map((client, idx) => (
          <div key={idx} className="inner-box" style={{ margin: "5px" }}>
            <div className="label" style={{ marginBottom: "8px" }}>Client</div>
            <FieldWithRemove
              value={client.name}
              onChange={(v: string) => handleClientChange(idx, { name: v })}
              onRemovePressed={() => handleRemoveClient(idx)}
              placeholder="Certificate name"
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
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
            </div>

            <div style={{ marginTop: "8px" }}>
              <div className="label" style={{ fontSize: "12px" }}>CRT File</div>
              <FilePickerInput
                value={client.cert || ""}
                onChange={(v) => handleClientChange(idx, { cert: v || undefined })}
                onEnterPressed={(v) => handleClientChange(idx, { cert: v || undefined })}
                basePath={fileCtx?.mmtFilePath}
                showFilePicker
                filters={[{ name: 'Certificate files', extensions: ['pem', 'crt', 'cer'] }]}
              />
            </div>

            <div style={{ marginTop: "8px" }}>
              <div className="label" style={{ fontSize: "12px" }}>KEY File</div>
              <FilePickerInput
                value={client.key || ""}
                onChange={(v) => handleClientChange(idx, { key: v || undefined })}
                onEnterPressed={(v) => handleClientChange(idx, { key: v || undefined })}
                basePath={fileCtx?.mmtFilePath}
                showFilePicker
                filters={[{ name: 'Key files', extensions: ['key', 'pem'] }]}
              />
            </div>

            <div style={{ marginTop: "8px" }}>
              <div className="label" style={{ fontSize: "12px" }}>PFX File</div>
              <FilePickerInput
                value={client.pfx || ""}
                onChange={(v) => handleClientChange(idx, { pfx: v || undefined })}
                onEnterPressed={(v) => handleClientChange(idx, { pfx: v || undefined })}
                basePath={fileCtx?.mmtFilePath}
                showFilePicker
                filters={[{ name: 'PFX/P12 files', extensions: ['pfx', 'p12'] }]}
              />
            </div>

            <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <div className="label" style={{ fontSize: "12px" }}>Passphrase plain</div>
                <input
                  type="password"
                  className="input-field"
                  value={client.passphrase_plain || ""}
                  onChange={(e) => handleClientChange(idx, { passphrase_plain: e.target.value || undefined })}
                  placeholder="Leave empty if not encrypted"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <div className="label" style={{ fontSize: "12px" }}>Passphrase Env</div>
                <input
                  type="text"
                  className="input-field"
                  value={client.passphrase_env || ""}
                  onChange={(e) => handleClientChange(idx, { passphrase_env: e.target.value || undefined })}
                  placeholder="e.g., CERT_PASSPHRASE"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>
        ))}

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
