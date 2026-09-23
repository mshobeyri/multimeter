import type {CertificateSettings as NetworkCertificateSettings} from 'mmt-core/NetworkData';
import type {EnvData} from 'mmt-core/EnvData';

export type {
  EnvCaCertificate,
  EnvCertificates,
  EnvClientCertificate,
  EnvHttpSettings,
  EnvOption,
  EnvPresetGroup,
  EnvPresetMapping,
  EnvPresets,
  EnvPresetValue,
  EnvSetting,
  EnvVariable,
  EnvVarSource,
} from 'mmt-core/EnvData';

/** UI document shape for the env editor. */
export type EnvironmentData = Omit<EnvData, 'type'|'variables'> & {
  type: string;
  variables: {
    [name: string]: {[label: string]: string|undefined}|string[];
  };
};

/** Env-panel subset of NetworkData.CertificateSettings. */
export type CertificateSettings =
    Pick<NetworkCertificateSettings, 'caEnabled'|'clientsEnabled'>;
