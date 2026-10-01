import type {JSONValue} from './CommonData';

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

export type EnvScalar = string | number | boolean | null;

/** Choice map or allowed-value list — values are scalars only (no nested object/list). */
export type EnvVariableValue =
  | {[label: string]: EnvScalar | undefined}
  | EnvScalar[];

/** Preset entries are choice keys or scalar literals. */
export type EnvPresetValue = EnvScalar;
export type EnvPresetMapping = Record<string, EnvPresetValue>;
export type EnvPresetGroup = Record<string, EnvPresetMapping>;
export type EnvPresets = Record<string, EnvPresetGroup>;

export interface EnvData {
  type: 'env';
  import?: Record<string, string>;
  variables?: Record<string, EnvVariableValue>;
  presets?: EnvPresets;
  setting?: EnvSetting;
  certificates?: EnvCertificates;
  /** Unknown root keys preserved during round-trip formatting. */
  extra?: Record<string, unknown>;
}

/** Where a workspace env value came from (file, typed, or setenv). */
export type EnvVarSource = 'file' | 'manual' | 'runtime';

export interface EnvOption {
  label: string;
  value: JSONValue;
}

/** Workspace / panel env variable (not the YAML `variables:` map). */
export interface EnvVariable {
  name: string;
  label: string;
  value: JSONValue;
  options: EnvOption[];
  source?: EnvVarSource;
  lastUpdate?: number;
}
