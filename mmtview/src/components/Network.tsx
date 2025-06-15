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
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  responseCookies?: Record<string, string>;
  requestData?: any;
  setRequestData: (data: any) => void;
  setResponseBody: (data: any) => void;
  setResponseHeaders: (headers: Record<string, string>) => void;
  setResponseCookies: (cookies: Record<string, string>) => void;
}

export function useNetwork(): NetworkApi {
  const [ws, setWs] = useState<WebSocketWithSend | null>(null);
  const wsRef = useRef<WebSocketWithSend | null>(null);
  const [connected, setConnected] = useState(false);

  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseCookies, setResponseCookies] = useState<Record<string, string>>({});

  const [requestData, setRequestData] = useState<any>({});

  const parseSetCookie = (setCookie: string[] | undefined): Record<string, string> => {
    if (!setCookie) return {};
    const cookies: Record<string, string> = {};
    setCookie.forEach(cookieStr => {
      const [cookiePair] = cookieStr.split(";");
      const [key, value] = cookiePair.split("=");
      if (key && value) cookies[key.trim()] = value.trim();
    });
    return cookies;
  };

  const send = async (options?: NetworkOptions) => {
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
        setResponseBody(res.data);
        setResponseHeaders(
          Object.fromEntries(
            Object.entries(res.headers || {}).map(([k, v]) => [k, String(v)])
          )
        );
        setResponseCookies(parseSetCookie(res.headers?.["set-cookie"]));
        onResponse?.(res.data);
      } catch (err: any) {
        setResponseBody({ error: err?.message || err });
        setResponseHeaders({});
        setResponseCookies({});
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
            setResponseBody(msg.data); // <--- Use responseBody for ws as well
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
    responseBody,
    responseHeaders,
    responseCookies,
    requestData,
    setRequestData,
    setResponseBody,
    setResponseHeaders,
    setResponseCookies,
  };
}