import React from "react";
import { EnvCertificates, EnvClientCertificate, EnvCaCertificate } from "./EnvironmentData";
import { safeList } from "mmt-core/safer";

interface EnvironmentCertificatesEditProps {
  certificates: EnvCertificates | undefined;
  onChange: (certificates: EnvCertificates) => void;
}

const EnvironmentCertificatesEdit: React.FC<EnvironmentCertificatesEditProps> = ({
  certificates,
  onChange,
}) => {
  const safeCerts: EnvCertificates = certificates || {};
  const clients = safeList(safeCerts.clients || []);
  const ca: EnvCaCertificate = safeCerts.ca || { paths: [] };

  const handleCaPathsChange = (paths: string[]) => {
    onChange({
      ...safeCerts,
      ca: { paths },
    });
  };

  const handleAddCaPath = () => {
    const paths = [...(ca.paths || []), ""];
    handleCaPathsChange(paths);
  };

  const handleRemoveCaPath = (idx: number) => {
    const paths = (ca.paths || []).filter((_, i) => i !== idx);
    handleCaPathsChange(paths);
  };

  const handleCaPathChange = (idx: number, value: string) => {
    const paths = (ca.paths || []).map((p, i) => (i === idx ? value : p));
    handleCaPathsChange(paths);
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
      cert_path: "",
      key_path: "",
    };
    onChange({ ...safeCerts, clients: [...clients, newClient] });
  };

  return (
    <div style={{ padding: "10px 0" }}>
      {/* CA Certificate Paths Section */}
      <div className="inner-box">
        <div className="label">CA Certificate Paths</div>
        <div style={{ padding: "5px" }}>
          {safeList(ca.paths || []).map((p, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <input
                type="text"
                className="input-field"
                value={p}
                onChange={(e) => handleCaPathChange(idx, e.target.value)}
                placeholder="Path to CA certificate file (e.g., ./certs/ca.pem)"
                style={{ flex: 1, boxSizing: "border-box" }}
              />
              <button
                className="button-icon"
                onClick={() => handleRemoveCaPath(idx)}
                title="Remove"
              >
                <span className="codicon codicon-trash" aria-hidden />
              </button>
            </div>
          ))}
          <button onClick={handleAddCaPath} className="button-icon" style={{ marginTop: "4px" }}>
            <span className="codicon codicon-add" aria-hidden />
            Add CA Path
          </button>
        </div>
      </div>

      {/* Client Certificates Section */}
      <div className="inner-box">
        <div className="label">Client Certificates</div>
        {safeList(clients).map((client, idx) => (
          <div key={idx} className="inner-box" style={{ margin: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontWeight: "bold" }}>{client.name || "Unnamed Certificate"}</span>
              <button
                className="button-icon"
                onClick={() => handleRemoveClient(idx)}
                title="Remove"
              >
                <span className="codicon codicon-trash" aria-hidden />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <div className="label" style={{ fontSize: "12px" }}>Name</div>
                <input
                  type="text"
                  className="input-field"
                  value={client.name}
                  onChange={(e) => handleClientChange(idx, { name: e.target.value })}
                  placeholder="Certificate name"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
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
              <div className="label" style={{ fontSize: "12px" }}>Certificate Path (cert_path)</div>
              <input
                type="text"
                className="input-field"
                value={client.cert_path}
                onChange={(e) => handleClientChange(idx, { cert_path: e.target.value })}
                placeholder="Path to client certificate (e.g., ./certs/client.pem)"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginTop: "8px" }}>
              <div className="label" style={{ fontSize: "12px" }}>Key Path (key_path)</div>
              <input
                type="text"
                className="input-field"
                value={client.key_path}
                onChange={(e) => handleClientChange(idx, { key_path: e.target.value })}
                placeholder="Path to private key (e.g., ./certs/client.key)"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <div className="label" style={{ fontSize: "12px" }}>Passphrase (passphrase_plain)</div>
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
                <div className="label" style={{ fontSize: "12px" }}>Passphrase Env (passphrase_env)</div>
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

        <button onClick={handleAddClient} className="button-icon" style={{ margin: "5px" }}>
          <span className="codicon codicon-add" aria-hidden />
          Add Client Certificate
        </button>
      </div>
    </div>
  );
};

export default EnvironmentCertificatesEdit;
