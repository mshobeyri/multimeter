export interface WebSocketWithSend extends WebSocket {
  sendMessage: (msg: string) => boolean;
}

export interface WebSocketRequestOptions {
  url: string;
  onOpen?: (ws: WebSocketWithSend) => void;
  onMessage?: (msg: MessageEvent) => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (err: Event) => void;
}

export interface HTTPRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
  params?: Record<string, string>;
}

export interface NetworkOptions {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  protocol?: "http" | "ws";
  cookies?: Record<string, string>;
  params?: Record<string, string>;
  onResponse?: (response: any) => void;
  onWsMessage?: (msg: string) => void;
  onWsOpen?: () => void;
  onWsClose?: () => void;
  onWsError?: (err: any) => void;
}

export interface NetworkApi {
  error: any;
  send: (options?: NetworkOptions) => Promise<void>;
  closeWs: () => void;
  ws: WebSocketWithSend | null;
  connected: boolean;
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  responseCookies?: Record<string, string>;
  requestData?: any;
  setRequestData: (data: any) => void;
  setResponseBody: (data: any) => void;
  setResponseHeaders: (headers: Record<string, string>) => void;
  setResponseCookies: (cookies: Record<string, string>) => void;
  loading: boolean;
}
