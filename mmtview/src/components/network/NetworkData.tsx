
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

export type ResponseCallback = (response: Response) => void;

export interface NetworkAPI {
  // Common
  send: (requestData: Request | undefined, setResponseData: ResponseCallback) => void;
  loading: boolean;
  cancel: () => Promise<void>;

  // WebSocket
  connectWs: (url: string, setResponseData: ResponseCallback) => void;
  connecting: boolean;
  connected: boolean;
  closeWs: () => void;
}

