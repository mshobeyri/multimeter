import { use, useRef, useState } from "react";
import { NetworkAPI, Request } from "./NetworkData";
import { NetworkNodeApi, Error } from "./NetworkNodeApi";
import { pushHistory } from "../../vsAPI";

export function useNetwork(): NetworkAPI {
  const [connected, setConnected] = useState(false);
  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseCookies, setResponseCookies] = useState<Record<string, string>>({});
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const [requestData, setRequestData] = useState<Request>();

  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);

  const [lastDuration, setLastDuration] = useState<number>(-1);

  let lastRequestID = useRef<string | null>(null);

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

  // Helper function to handle body content
  const toContentString = (data: any): string => {
    if (data === null || data === undefined) return "";
    if (typeof data === 'string') return data;
    if (typeof data === 'object') return JSON.stringify(data, null, 2);
    return String(data);
  };

  let lastSendTime: number | null = null;

  const send = async () => {
    setError(null);
    if (loading) {
      return;
    }
    setLoading(true);
    if (!requestData) {
      setError({ message: "Request data is undefined", body: null, headers: {}, status: 400, code: "REQUEST_DATA_UNDEFINED" });
      setLoading(false);
      return;
    }
    const opts = requestData;
    const {
      url = requestData.url,
      method = requestData.method || "get",
      headers = requestData.headers,
      body = requestData.body,
      protocol = requestData.protocol || "http",
      cookies = requestData.cookies,
      query = requestData.query,
    } = opts;

    // Save request to history
    pushHistory({
      type: "send",
      method: method.toLowerCase(),
      protocol,
      title: `${method.toLowerCase()} ${url}`,
      cookies: cookies,
      headers: headers,
      query: query,
      content: method === "get" ? "" : toContentString(body),
    });

    lastSendTime = Date.now();
    if (protocol === "http") {
      lastRequestID.current = NetworkNodeApi.sendHttp({
        url: url ?? "",
        method: method.toLowerCase(),
        headers: headers || {},
        body,
        cookies: cookies || {},
        query: query || {},
        onResponse: (res: any) => {
          const duration = lastSendTime ? Date.now() - lastSendTime : -1;
          setLastDuration(duration);
          setResponseBody(res.body);
          setResponseHeaders(res.headers || {});
          setResponseCookies(parseSetCookie(res.headers?.["set-cookie"]));
          setLoading(false);
          setStatusCode(res.status || -1);
          pushHistory({
            type: "recv",
            method,
            protocol,
            title: `${method.toLowerCase()} ${url}`,
            cookies: parseSetCookie(res.headers?.["set-cookie"]),
            headers: res.headers || {},
            content: toContentString(res.body),
            duration: duration, // Use calculated duration
            status: res.status || -1,
          });
          lastSendTime = null;
        },
        onError: (error: Error) => {
          const duration = lastSendTime ? Date.now() - lastSendTime : -1;
          setLastDuration(duration);
          setResponseBody(error.body || null);
          setResponseHeaders(error.headers || {});
          setResponseCookies({});
          setError(error);
          setLoading(false);

          // Save error to history
          pushHistory({
            type: "error",
            method,
            protocol,
            title: `${method.toLowerCase()} ${url} Error`,
            cookies: {},
            headers: {},
            content: toContentString(error),
            duration: duration, // Use calculated duration
            status: error?.status ? error?.status : 500
          });
        }
      });
    } else if (protocol === "ws") {
      if (!connected) {
        setError({ message: "WebSocket not connected", body: null, headers: {}, status: 400, code: "WS_NOT_CONNECTED" });
        setLoading(false);
        return;
      }

      // Save WS send to history
      pushHistory({
        type: "send",
        method: "SEND",
        protocol,
        title: `SEND ${url}`,
        content: toContentString(body)
      });

      lastRequestID.current = NetworkNodeApi.sendWs({
        wsId: wsId || "",
        data: toContentString(body),
      });
    }
  };
  const cancel = async () => {
    await NetworkNodeApi.cancel(lastRequestID.current ?? "");
    setLoading(false);
    setResponseBody(null);
    setResponseHeaders({});
    setResponseCookies({});
    setStatusCode(null);
  };

  const connectWs = () => {
    setConnecting(true);
    const opts = requestData ?? {};
    const {
      url = "",
      protocol = "http",
    } = opts;

    if (protocol === "http") {
      setError({ message: "WebSocket protocol required for WebSocket connection", body: null, headers: {}, status: 400, code: "WS_PROTOCOL_REQUIRED" });
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
        setError({ message: "WebSocket cannot connect", body: null, headers: {}, status: 400, code: "WS_NOT_CONNECTED" });
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
    setLastDuration(-1);
    setResponseBody(null);
    setStatusCode(null);
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
    duration: lastDuration,
    cancel,
    responseHeaders,
    responseCookies,
    statusCode,
    connectWs,
    connecting,
    connected,
    closeWs,
    clearRespond,
  };
}