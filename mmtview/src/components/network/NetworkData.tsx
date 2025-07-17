export interface Request {
  endpoint?: string;
  protocol?: "http" | "ws";
  format?: "json" | "xml";
  method?: string;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
}

export interface NetworkAPI {
  // Common
  send: () => Promise<void>;
  requestData?: Request;
  setRequestData: (data: Request) => void;
  responseBody?: any;
  loading: boolean;
  error: any;

  // HTTP
  responseHeaders?: Record<string, string>;
  responseCookies?: Record<string, string>;

  // WebSocket 
  connectWs: () => void;
  connecting: boolean;
  connected: boolean;
  closeWs: () => void;
  clearRespond: () => void;
}

