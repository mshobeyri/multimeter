import { useRef, useState } from "react";
import { NetworkAPI, Request } from "./NetworkData";
import { NetworkNodeApi } from "./NetworkNodeApi";
import { pushHistory } from "../../vsAPI";

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

  const parseSetCookie = (setCookie: string[] | string | undefined): Record<string, string> => {
    if (!setCookie) return {};
    const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
    const cookies: Record<string, string> = {};
    arr.forEach(cookieStr => {
      const [cookiePair] = cookieStr.split(";");
      const [key, value] = cookiePair.split("=");
      if (key && value) cookies[key.trim()] = value.trim();
    });
    return cookies;
  };

  let lastSendTime: number | null = null;

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
      query = requestData.query,
    } = opts;

    // Save request to history
    pushHistory({
      type: "send",
      method: method.toUpperCase(),
      protocol,
      title: `${method.toUpperCase()} ${url}`,
      cookies: cookies || {},
      headers: headers || {},
      query: query || {},
      content: method === "GET" ? "" : JSON.stringify(body)
    });

    lastSendTime = Date.now();
    if (protocol === "http") {
      NetworkNodeApi.sendHttp({
        url: url ?? "",
        method: method.toUpperCase(),
        headers,
        body,
        cookies,
        query,
        onResponse: (res: any) => {
          const duration = lastSendTime ? Date.now() - lastSendTime : undefined;
          setResponseBody(res.body);
          setResponseHeaders(res.headers || {});
          setResponseCookies(parseSetCookie(res.headers?.["set-cookie"]));
          setLoading(false);

          // Save response to history
          pushHistory({
            type: "recv",
            method,
            protocol,
            title: `${method} ${url}`,
            cookies: parseSetCookie(res.headers?.["set-cookie"]),
            headers: res.headers || {},
            content: JSON.stringify(res, null, 2),
            duration,
            status: res.status || 200,
          });
          lastSendTime = null;
        },
        onError: (err: any, status?: number) => {
          const duration = lastSendTime ? Date.now() - lastSendTime : undefined;
          setResponseBody({ error: err?.message || err });
          setResponseHeaders({});
          setResponseCookies({});
          setError(err?.message || String(err));
          setLoading(false);

          // Save error to history
          pushHistory({
            type: "error",
            method,
            protocol,
            title: `${method} ${url} Error`,
            cookies: {}, // or parse from error if available
            headers: {}, // or parse from error if available
            content: JSON.stringify({ error: err?.message || err }, null, 2),
            duration,
            status
          });
        }
      });
    } else if (protocol === "ws") {
      if (!connected) {
        setError("WebSocket not connected");
        setLoading(false);
        return;
      }

      // Save WS send to history
      pushHistory({
        type: "send",
        method: "SEND",
        protocol,
        title: `SEND ${url}`,
        content: typeof body === "string" ? body : JSON.stringify(body)
      });

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

    // Save WS connect to history
    pushHistory({
      type: "send",
      method: "CONNECT",
      protocol,
      title: `CONNECT ${url}`
    });

    const websocketId = NetworkNodeApi.connectWs({
      url,
      onOpen: () => {
        setConnected(true);
        setConnecting(false);

        // Save WS connected to history
        pushHistory({
          type: "recv",
          method: "CONNECTED",
          protocol,
          title: `CONNECTED ${url}`,
          content: url
        });
      },
      onMessage: (data: string) => {
        setResponseBody(data);
        setLoading(false);

        // Save WS message to history
        pushHistory({
          type: "recv",
          method: "RECV",
          protocol,
          title: `RECV ${url}`,
          content: data
        });
      },
      onClose: () => {
        setConnected(false);
        setLoading(false);

        // Save WS close to history
        pushHistory({
          type: "recv",
          method: "CLOSED",
          protocol,
          title: `CLOSED ${url}`,
          content: url
        });
      },
      onError: (err: any) => {
        setError("WebSocket cannot connect");
        setLoading(false);

        // Save WS error to history
        pushHistory({
          type: "recv",
          method: "ERROR",
          protocol,
          title: `ERROR ${url}`,
          content: err?.message
        });
      }
    });
    setWsId(websocketId);
  };

  const closeWs = () => {
    pushHistory({
      type: "send",
      method: "CLOSE",
      protocol: requestData?.protocol || "ws",
      title: `CLOSE ${requestData?.url ?? ""}`
    });
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