
export interface Request {
  url?: string;
  protocol?: "http" | "ws" | undefined;
  format?: "json" | "xml" | "text" | undefined;
  method?: string;
  headers?: Record<string, string> | undefined;
  cookies?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  body?: any;
}

export interface Response {
  format?: "json" | "xml" | "text" | undefined;
  headers?: Record<string, string> | undefined;
  cookies?: Record<string, string> | undefined;
  query?: Record<string, string> | undefined;
  body?: any;
  status?: number | -1;
  duration?: number | -1;
  errorMessage: string | "";
  errorCode: string | "";
}

export interface NetworkAPI {
  // Common
  send: (requestData: Request | undefined) => Promise<Response | undefined>;
  loading: boolean;
  cancel: () => Promise<void>;

  // WebSocket
  connectWs: (url: string) => Promise<Response | undefined>;
  connecting: boolean;
  connected: boolean;
  closeWs: () => void;
}

export interface CaCertificate {
  enabled: boolean;
  certPaths?: string[];  // Multiple paths
  certData?: Buffer[];   // Multiple loaded certificates
}

export interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  cert_path?: string;
  key_path?: string;
  passphrase_plain?: string;
  passphrase_env?: string;
  certData?: Buffer;
  keyData?: Buffer;
  enabled: boolean;
}

// Certificate settings stored in env file (YAML format)
// Note: Boolean settings (ssl_validation, allow_self_signed, enabled flags) are NOT stored in YAML
// They are stored in localStorage/workspaceState with sensible defaults
export interface EnvCertificateSettings {
  ca?: {
    paths?: string[];  // Multiple CA cert file paths
  };
  clients?: Array<{
    name?: string;
    host?: string;
    cert_path?: string;
    key_path?: string;
    passphrase_plain?: string;
    passphrase_env?: string;
  }>;
}

export interface NetworkConfig {
  ca: CaCertificate;
  clients: ClientCertificate[];
  sslValidation: boolean;
  allowSelfSigned: boolean;
  timeout: number;
  autoFormat: boolean;
}

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface HttpResponse {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  duration: number;
  autoformat: boolean;
}