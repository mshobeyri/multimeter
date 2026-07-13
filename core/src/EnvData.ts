export interface EnvClientCertificate {
  name: string;
  host: string;
  cert?: string;
  key?: string;
  pfx?: string;
  passphrase_plain?: string;
  passphrase_env?: string;
}

export interface EnvCaCertificate {
  path?: string;
  paths?: string[];
}

export interface EnvCertificates {
  server_ca?: string | EnvCaCertificate;
  clients?: EnvClientCertificate[];
}

export interface EnvHttpSettings {
  version?: string;
  timeout?: number;
}

export interface EnvSetting {
  http?: EnvHttpSettings;
}

export type EnvVariableValue =
  | {[label: string]: string | number | boolean | null | undefined}
  | Array<string | number | boolean | null>;

export interface EnvData {
  type: 'env';
  import?: Record<string, string>;
  variables?: Record<string, EnvVariableValue>;
  presets?: Record<string, Record<string, Record<string, string | number | boolean | null>>>;
  setting?: EnvSetting;
  certificates?: EnvCertificates;
  /** Unknown root keys preserved during round-trip formatting. */
  extra?: Record<string, unknown>;
}
