import { useRef, useState } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { NetworkApi, NetworkOptions, NetworkRequestOptions, WebSocketRequestOptions, WebSocketWithSend } from "./NetworkData";

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

export function useNetwork(): NetworkApi {
  const [ws, setWs] = useState<WebSocketWithSend | null>(null);
  const wsRef = useRef<WebSocketWithSend | null>(null);
  const [connected, setConnected] = useState(false);

  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseCookies, setResponseCookies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [requestData, setRequestData] = useState<any>({});
  const [loading, setLoading] = useState(false); // <-- Add loading state

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
    setError(null); // Reset error on new request
    setLoading(true); // <-- Set loading true when request starts
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
        setError(err?.message || String(err));
        onResponse?.({ error: err?.message || err });
      } finally {
        setLoading(false); // <-- Set loading false after response/error
      }
    } else if (protocol === "ws") {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.sendMessage(typeof body === "string" ? body : JSON.stringify(body));
          setLoading(false); // <-- For sending message on open ws, loading is not needed
        } else {
          const newWs = openWebSocket({
            url,
            onOpen: socket => {
              wsRef.current = socket;
              setWs(socket);
              setConnected(true);
              setLoading(false); // <-- Set loading false when connected
              onWsOpen?.();
            },
            onMessage: msg => {
              setResponseBody(msg.data);
              setLoading(false); // <-- Set loading false on first message
              onWsMessage?.(msg.data);
            },
            onClose: () => {
              wsRef.current = null;
              setWs(null);
              setConnected(false);
              setLoading(false); // <-- Set loading false on close
              onWsClose?.();
            },
            onError: err => {
              setError("WebSocket cannot connect");
              setLoading(false); // <-- Set loading false on error
              onWsError?.(err);
            },
          });
          wsRef.current = newWs;
          setWs(newWs);
        }
      } catch (err: any) {
        setError(err?.message || String(err));
        setLoading(false); // <-- Set loading false on error
      }
    }
  };

  const closeWs = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
      setConnected(false);
      setLoading(false); // <-- Set loading false on close
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
    error,
    loading, // <-- Return loading
  };
}