import { useRef, useState } from "react";
import { NetworkAPI , Request} from "./NetworkData";
import { NetworkNodeApi } from "./NetworkNodeApi";

export function useNetwork(): NetworkAPI {
  const [connected, setConnected] = useState(false);
  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseCookies, setResponseCookies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [requestData, setRequestData] = useState<Request>();
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);

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

  const send = async () => {
    setError(null);
    setLoading(true);
    if (!requestData) {
      setError("Request data is undefined");
      setLoading(false);
      return;
    }
    const opts = requestData;
    const {
      url = requestData.url,
      method = requestData.method || "GET",
      headers = requestData.headers,
      body = requestData.body,
      protocol = requestData.protocol || "http",
      cookies = requestData.cookies,
      params = requestData.params,
    } = opts;

    if (protocol === "http") {
      NetworkNodeApi.sendHttp({
        url: url ?? "",
        method,
        headers,
        body,
        cookies,
        params,
        onResponse: (res: any) => {
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
      if(!connected){
         setError("WebSocket not connected");
         setLoading(false);
         return;
      }

      NetworkNodeApi.sendWs({
        wsId: wsId || "",
        data: body,
      });
    }
  };

  const connectWs = () => {
    setConnecting(true);
    const opts = requestData ?? {};
    const {
      url = "",
      protocol = "http",
    } = opts;

    if (protocol === "http") {
      setError("WebSocket protocol required for WebSocket connection");
      return;
    }

    const websocketId = NetworkNodeApi.connectWs({
      url,
      onOpen: () => {
        setConnected(true);
        setConnecting(false);
      },
      onMessage: (data: string) => {
        setResponseBody(data);
        setLoading(false);
      },
      onClose: () => {
        setConnected(false);
        setLoading(false);
      },
      onError: (err: any) => {
        setError("WebSocket cannot connect");
        setLoading(false);
      }
    });
    setWsId(websocketId);
  };

  const closeWs = () => {
    NetworkNodeApi.disconnectWs({
      wsId: wsId || "",
    });
    setConnected(true);
    setLoading(true);
  };

  // Add this function to clear response headers, cookies, and body
  const clearRespond = () => {
    setResponseBody(null);
    setResponseHeaders({});
    setResponseCookies({});
  };

  return {
    send,
    requestData,
    setRequestData,
    responseBody,
    loading,
    error,
    responseHeaders,
    responseCookies,
    connectWs,
    connecting,
    connected,
    closeWs,
    clearRespond, // <-- expose here
  };
}