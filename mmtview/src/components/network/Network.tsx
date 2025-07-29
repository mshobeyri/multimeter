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
      query = requestData.query,
    } = opts;

    // Save request to history
    pushHistory({
      type: "send",
      method,
      protocol,
      title: `${method} ${url}`,
      content: JSON.stringify({ url, method, headers, body, cookies, query }, null, 2)
    });

    if (protocol === "http") {
      NetworkNodeApi.sendHttp({
        url: url ?? "",
        method,
        headers,
        body,
        cookies,
        query,
        onResponse: (res: any) => {
          setResponseBody(res.body);
          setResponseHeaders(res.headers || {});
          setResponseCookies(parseSetCookie(res.headers?.["set-cookie"]));
          setLoading(false);

          // Save response to history
          pushHistory({
            type: "recv",
            method,
            protocol,
            title: `${method} ${url} Response`,
            content: JSON.stringify(res, null, 2)
          });
        },
        onError: (err: any) => {
          setResponseBody({ error: err?.message || err });
          setResponseHeaders({});
          setResponseCookies({});
          setError(err?.message || String(err));
          setLoading(false);

          // Save error to history
          pushHistory({
            type: "recv",
            method,
            protocol,
            title: `${method} ${url} Error`,
            content: JSON.stringify({ error: err?.message || err }, null, 2)
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
        title: `WS SEND ${url}`,
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
      title: `WS CONNECT ${url}`,
      content: url
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
          title: `WS CONNECTED ${url}`,
          content: url
        });
      },
      onMessage: (data: string) => {
        setResponseBody(data);
        setLoading(false);

        // Save WS message to history
        pushHistory({
          type: "recv",
          method: "MESSAGE",
          protocol,
          title: `WS MESSAGE ${url}`,
          content: data
        });
      },
      onClose: () => {
        setConnected(false);
        setLoading(false);

        // Save WS close to history
        pushHistory({
          type: "recv",
          method: "CLOSE",
          protocol,
          title: `WS CLOSED ${url}`,
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
          title: `WS ERROR ${url}`,
          content: err?.message || String(err)
        });
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