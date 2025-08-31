import { useRef, useState } from "react";
import { NetworkAPI, Request } from "./NetworkData";
import { NetworkNodeApi, Error } from "./NetworkNodeApi";
import { pushHistory } from "../../vsAPI";
import { beautifyWithContentType } from "../../markupConvertor";

export function useNetwork(): NetworkAPI {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wsId, setWsId] = useState<string | null>(null);

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

  const send = async (requestData: Request | undefined, setResponseData: any) => {
    setResponseData(null);
    if (loading) {
      return;
    }
    setLoading(true);
    if (!requestData) {
      setResponseData({
        errorMessage: "Request data is undefined",
        status: 400,
        errorCode: "REQUEST_DATA_UNDEFINED",
        duration: -1
      });
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

    if (protocol === "http") {
      lastRequestID.current = NetworkNodeApi.sendHttp({
        url: url ?? "",
        method: method.toLowerCase(),
        headers: headers || {},
        body,
        cookies: cookies || {},
        query: query || {},
        onResponse: (res: any) => {
          if (res.autoformat) {
            res.body = beautifyWithContentType(res.headers["Content-Type"], res.body);
          }
          setResponseData({
            body: res.body,
            headers: res.headers || {},
            cookies: parseSetCookie(res.headers?.["set-cookie"]),
            errorMessage: "",
            status: res.status || -1,
            errorCode: "",
            duration: res.duration || -1
          });
          setLoading(false);
          pushHistory({
            type: "recv",
            method,
            protocol,
            title: `${method.toLowerCase()} ${url}`,
            cookies: parseSetCookie(res.headers?.["set-cookie"]),
            headers: res.headers || {},
            content: toContentString(res.body),
            duration: res.duration || -1,
            status: res.status || -1,
          });
        },
        onError: (error: Error) => {

          setResponseData({
            body: error.body || null,
            headers: error.headers || {},
            errorMessage: error.message,
            status: error.status || 500,
            errorCode: error.code || "UNKNOWN_ERROR",
            duration: error.duration || -1
          });
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
            duration: error.duration || -1,
            status: error?.status ? error?.status : 500
          });
        }
      });
    } else if (protocol === "ws") {
      if (!connected) {
        setResponseData({ errorMessage: "WebSocket not connected", status: 400, errorCode: "WS_NOT_CONNECTED", duration: -1 });
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
  };

  const connectWs = (url: string, setResponseData: any) => {
    setConnecting(true);

    // Save WS connect to history
    pushHistory({
      type: "send",
      method: "CONNECT",
      protocol: "ws",
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
          protocol: "ws",
          title: `CONNECTED ${url}`,
          content: url
        });
      },

      onMessage: (data: string) => {
        setResponseData({
          body: data,
          headers: undefined,
          status: null,
          message: null,
          code: null,
          duration: null
        } as unknown as Response);
        setLoading(false);

        // Save WS message to history
        pushHistory({
          type: "recv",
          method: "RECV",
          protocol: "ws",
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
          protocol: "ws",
          title: `CLOSED ${url}`,
          content: url
        });
      },
      onError: (err: any) => {
        setResponseData({
          errorMessage: "WebSocket cannot connect",
          status: 400,
          errorCode: "WS_NOT_CONNECTED",
          duration: -1
        } as unknown as Response);
        setLoading(false);

        // Save WS error to history
        pushHistory({
          type: "recv",
          method: "ERROR",
          protocol: "ws",
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
      protocol: "ws",
      title: `CLOSE`
    });
    NetworkNodeApi.disconnectWs({
      wsId: wsId || "",
    });
    setConnected(true);
    setLoading(true);
  };

  return {
    send,
    loading,
    cancel,
    connectWs,
    connecting,
    connected,
    closeWs,
  };
}