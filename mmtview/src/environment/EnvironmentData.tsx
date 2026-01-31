
import { JSONValue } from "mmt-core/CommonData";

// Client certificate entry in env file (YAML uses snake_case)
export interface EnvClientCertificate {
  name: string;
  host: string;
  cert_path: string;
  key_path: string;
  passphrase_plain?: string;
  passphrase_env?: string;
}

// CA certificate in env file (YAML uses snake_case)
export interface EnvCaCertificate {
  paths: string[];  // Multiple CA cert file paths
}

// Certificate settings section in env file
// Note: Boolean flags are NOT stored in YAML - they go to localStorage
export interface EnvCertificates {
  ca?: EnvCaCertificate;
  clients?: EnvClientCertificate[];
}

// Certificate boolean settings stored in localStorage (not YAML)
export interface CertificateSettings {
  sslValidation: boolean;
  allowSelfSigned: boolean;
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