export type ClientCertMaterialMode = 'pem' | 'pfx';
export type ClientCertPassphraseMode = 'plain' | 'env';

export type ClientCertFieldName =
    'cert'|'key'|'pfx'|'passphrase_plain'|'passphrase_env';

export interface ClientCertFieldIssue {
  field: ClientCertFieldName;
  message: string;
}

type ClientCertFields = {
  cert?: unknown;
  key?: unknown;
  pfx?: unknown;
  passphrase_plain?: unknown;
  passphrase_env?: unknown;
};

export function isPresentCertPath(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

export function clientCertMaterialMode(client: ClientCertFields): ClientCertMaterialMode {
  if (isPresentCertPath(client.pfx)) {
    return 'pfx';
  }
  return 'pem';
}

export function clientCertPassphraseMode(client: ClientCertFields): ClientCertPassphraseMode {
  if (isPresentCertPath(client.passphrase_plain)) {
    return 'plain';
  }
  if (isPresentCertPath(client.passphrase_env)) {
    return 'env';
  }
  return 'env';
}

export function applyClientCertMaterialMode<T extends ClientCertFields>(
    client: T, mode: ClientCertMaterialMode): T {
  if (mode === 'pfx') {
    const next = {...client};
    delete next.cert;
    delete next.key;
    return next;
  }
  const next = {...client};
  delete next.pfx;
  return next;
}

export function applyClientCertPassphraseMode<T extends ClientCertFields>(
    client: T, mode: ClientCertPassphraseMode): T {
  if (mode === 'plain') {
    const next = {...client};
    delete next.passphrase_env;
    return next;
  }
  const next = {...client};
  delete next.passphrase_plain;
  return next;
}

export function clientCertFieldIssues(client: ClientCertFields): ClientCertFieldIssue[] {
  const hasCert = isPresentCertPath(client.cert);
  const hasKey = isPresentCertPath(client.key);
  const hasPfx = isPresentCertPath(client.pfx);
  const hasPassphrasePlain = isPresentCertPath(client.passphrase_plain);
  const hasPassphraseEnv = isPresentCertPath(client.passphrase_env);
  const issues: ClientCertFieldIssue[] = [];
  if (hasPfx && (hasCert || hasKey)) {
    issues.push({
      field: 'pfx',
      message: 'Use either pfx or cert+key, not both',
    });
  } else {
    if (hasCert && !hasKey) {
      issues.push({
        field: 'cert',
        message: 'key is required when cert is set',
      });
    }
    if (hasKey && !hasCert) {
      issues.push({
        field: 'key',
        message: 'cert is required when key is set',
      });
    }
  }
  if (hasPassphrasePlain && hasPassphraseEnv) {
    issues.push({
      field: 'passphrase_plain',
      message: 'Use either passphrase_plain or passphrase_env, not both',
    });
  }
  return issues;
}
