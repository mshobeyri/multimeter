import { useRef, useState } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

// --- HTTP REQUEST ---

export interface NetworkRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
  params?: Record<string, string>;
}

export async function sendHttpRequest(options: NetworkRequestOptions): Promise<AxiosResponse> {
  const {
    url,
    method = "GET",
    headers = {},
    body,
    cookies,
    params,
  } = options;

  let reqHeaders = { ...headers };
  if (cookies && Object.keys(cookies).length > 0) {
    reqHeaders["Cookie"] = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  const config: AxiosRequestConfig = {
    url,
    method,
    headers: reqHeaders,
    data: body,
    params,
    withCredentials: true,
  };

  return axios.request(config);
}

// --- WEBSOCKET REQUEST ---

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

export function openWebSocket(options: WebSocketRequestOptions): WebSocketWithSend {
  const { url, onOpen, onMessage, onClose, onError } = options;
  const ws = new window.WebSocket(url) as WebSocketWithSend;

  ws.sendMessage = (msg: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      return true;
    }
    return false;
  };

  if (onOpen) ws.onopen = () => onOpen(ws);
  if (onMessage) ws.onmessage = onMessage;
  if (onClose) ws.onclose = onClose;
  if (onError) ws.onerror = onError;

  return ws;
}

// --- NETWORK HOOK ---

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
  send: (options?: NetworkOptions) => Promise<void>;
  closeWs: () => void;
  ws: WebSocketWithSend | null;
  connected: boolean;
  response?: any;
  wsResponse?: string;
  requestData?: any;
  setRequestData: (data: any) => void;
  setResponse: (data: any) => void;
  setWsResponse: (msg: string) => void;
}

export function useNetwork(): NetworkApi {
  const [ws, setWs] = useState<WebSocketWithSend | null>(null);
  const wsRef = useRef<WebSocketWithSend | null>(null);
  const [connected, setConnected] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [wsResponse, setWsResponse] = useState<string | undefined>(undefined);

  // Request data state for editing and sending
  const [requestData, setRequestData] = useState<any>({});

  const send = async (options?: NetworkOptions) => {
    // Use options if provided, otherwise use requestData
    const opts = options || requestData;
    const {
      url = requestData.endpoint || requestData.url,
      method = requestData.method || "GET",
      headers = requestData.headers,
      body = requestData.body,
      protocol = requestData.protocol || "http",
      cookies = requestData.cookies,
      params = requestData.query || requestData.params,
      onResponse,
      onWsMessage,
      onWsOpen,
      onWsClose,
      onWsError,
    } = opts;

    if (protocol === "http") {
      try {
        const res = await sendHttpRequest({ url, method, headers, body, cookies, params });
        setResponse(res.data);
        onResponse?.(res.data);
      } catch (err: any) {
        setResponse({ error: err?.message || err });
        onResponse?.({ error: err?.message || err });
      }
    } else if (protocol === "ws") {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.sendMessage(typeof body === "string" ? body : JSON.stringify(body));
      } else {
        const newWs = openWebSocket({
          url,
          onOpen: socket => {
            wsRef.current = socket;
            setWs(socket);
            setConnected(true);
            onWsOpen?.();
            if (body) {
              socket.sendMessage(typeof body === "string" ? body : JSON.stringify(body));
            }
          },
          onMessage: msg => {
            setWsResponse(msg.data);
            onWsMessage?.(msg.data);
          },
          onClose: () => {
            wsRef.current = null;
            setWs(null);
            setConnected(false);
            onWsClose?.();
          },
          onError: err => {
            onWsError?.(err);
          },
        });
        wsRef.current = newWs;
        setWs(newWs);
      }
    }
  };

  const closeWs = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
      setConnected(false);
    }
  };

  return {
    send,
    closeWs,
    ws,
    connected,
    response,
    wsResponse,
    requestData,
    setRequestData,
    setResponse,
    setWsResponse,
  };
}