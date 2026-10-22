import type {CertificateSettings as NetworkCertificateSettings} from 'mmt-core/data/NetworkData';
import type {EnvData} from 'mmt-core/data/EnvData';

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
} from 'mmt-core/data/EnvData';

/** UI document shape for the env editor. */
export type EnvironmentData = Omit<EnvData, 'type'> & {
  type: string;
};

/** Env-panel subset of NetworkData.CertificateSettings. */
export type CertificateSettings =
    Pick<NetworkCertificateSettings, 'caEnabled'|'clientsEnabled'>;
