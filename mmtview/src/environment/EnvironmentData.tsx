
import { JSONValue } from "mmt-core/CommonData";

export interface EnvClientCertificate {
  name: string;
  host: string;
  cert?: string;
  key?: string;
  pfx?: string;
  passphrase_plain?: string;
  passphrase_env?: string;
}

// Server CA certificate in env file (YAML uses snake_case)
export interface EnvCaCertificate {
  path?: string;
  paths?: string[];  // Legacy multiple CA cert file paths
}

// Certificate settings section in env file
// Note: Boolean flags are NOT stored in YAML - they go to localStorage
export interface EnvCertificates {
  server_ca?: string | EnvCaCertificate;
  clients?: EnvClientCertificate[];
}

// Certificate boolean settings stored in localStorage (not YAML)
export interface CertificateSettings {
  caEnabled: boolean;
  clientsEnabled: Record<string, boolean>;  // keyed by client name+host
}

export type EnvironmentData = {
  type: string;
  variables: {
    [name: string]: | { [label: string]: string | undefined } | string[];
  };
  presets?: {
    [presetName: string]: {
      [envName: string]: {
        [variableName: string]: string;
      };
    };
  };
  certificates?: EnvCertificates;
};

export interface EnvOption {
  label: string;
  value: JSONValue;
}

export interface EnvVariable {
  name: string;
  label: string;
  value: JSONValue;
  options: EnvOption[];
}