import { useRef, useState } from "react";
import { NetworkApi, NetworkOptions, HTTPRequestOptions, WebSocketRequestOptions, WebSocketWithSend } from "./NetworkData";
import { NetworkNodeApi } from "./NetworkNodeApi";

export function useNetwork(): NetworkApi {
  const [ws, setWs] = useState<WebSocketWithSend | null>(null);
  const wsRef = useRef<WebSocketWithSend | null>(null);
  const [connected, setConnected] = useState(false);

  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseCookies, setResponseCookies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [requestData, setRequestData] = useState<any>({});
  const [loading, setLoading] = useState(false);

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
    setError(null);
    setLoading(true);
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
      NetworkNodeApi.sendHttp({
        url,
        method,
        headers,
        body,
        cookies,
        params,
        onResponse: (res: any) => {
          console.log("HTTP response received2:", res);
          setResponseBody(res.body);
          setResponseHeaders(res.headers || {});
          setResponseCookies(parseSetCookie(res.headers?.["set-cookie"]));
          setLoading(false);
        },
        onError: (err: any) => {
          setResponseBody({ error: err?.message || err });
          setResponseHeaders({});
          setResponseCookies({});
          setError(err?.message || String(err));
          setLoading(false);
        }
      });
    } else if (protocol === "ws") {
      NetworkNodeApi.connectWs({
        url,
        uuid: url, // You may want to use a better uuid
        onOpen: () => {
          setConnected(true);
          setLoading(false);
          onWsOpen?.();
        },
        onMessage: (data: string) => {
          setResponseBody(data);
          setLoading(false);
          onWsMessage?.(data);
        },
        onClose: () => {
          setConnected(false);
          setLoading(false);
          onWsClose?.();
        },
        onError: (err: any) => {
          setError("WebSocket cannot connect");
          setLoading(false);
          onWsError?.(err);
        }
      });
    }
  };

  const closeWs = () => {
    if (wsRef.current) {
      NetworkNodeApi.disconnectWs({ uuid: wsRef.current.url });
      wsRef.current = null;
      setWs(null);
      setConnected(false);
      setLoading(false);
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
    loading,
  };
}