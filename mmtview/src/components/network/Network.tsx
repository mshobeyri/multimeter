import { useRef, useState } from "react";
import { NetworkAPI, Request, Response } from "./NetworkData";
import { NetworkNodeApi, Error } from "./NetworkNodeApi";
import { pushHistory } from "../../vsAPI";
import { beautifyWithContentType } from "mmt-core/dist/markupConvertor";

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

  const send = async (requestData: Request | undefined): Promise<Response | undefined> => {
    if (loading) {
      return undefined;
    }
    setLoading(true);
    if (!requestData) {
      setLoading(false);
      return {
        errorMessage: "Request data is undefined",
        status: 400,
        errorCode: "REQUEST_DATA_UNDEFINED",
        duration: -1
      };
    }

    if (requestData.protocol === "http") {
      return new Promise<Response | undefined>((resolve) => {
        const {
          url = requestData.url,
          method = requestData.method || "get",
          headers = requestData.headers,
          body = requestData.body,
          protocol = requestData.protocol || "http",
          cookies = requestData.cookies,
          query = requestData.query,
        } = requestData;
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
            resolve({
              body: res.body,
              headers: res.headers || {},
              cookies: parseSetCookie(res.headers?.["set-cookie"]),
              errorMessage: "",
              status: res.status || -1,
              errorCode: "",
              duration: res.duration || -1
            });
          },
          onError: (error: Error) => {
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

            resolve({
              body: error.body || null,
              headers: error.headers || {},
              errorMessage: error.message ?? "",
              status: error.status || 500,
              errorCode: error.code || "UNKNOWN_ERROR",
              duration: error.duration || -1
            });
          }
        });
      });
    } else if (requestData.protocol === "ws") {
      return new Promise<Response | undefined>((resolve) => {
        const opts = requestData;
        const {
          url = requestData.url,
          body = requestData.body,
          protocol = requestData.protocol || "http",
        } = opts;

        if (!connected) {
          setLoading(false);
          resolve({
            errorMessage: "WebSocket not connected",
            status: 400,
            errorCode: "WS_NOT_CONNECTED",
            duration: -1
          });
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
          data: toContentString(body)
        });
      });
    } else {
      return new Promise<Response | undefined>((resolve) => {
        setLoading(false);
        resolve({
          errorMessage: "Protocol not specified",
          status: 400,
          errorCode: "PROTOCOL_NOT_SPECIFIED",
          duration: -1
        });
      });
    }
  };

  const cancel = async () => {
    await NetworkNodeApi.cancel(lastRequestID.current ?? "");
    setLoading(false);
  };

  const connectWs = async (url: string): Promise<Response | undefined> => {
    setConnecting(true);
    pushHistory({
      type: "send",
      method: "CONNECT",
      protocol: "ws",
      title: `CONNECT ${url}`
    });

    return new Promise<Response | undefined>((resolve) => {
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

          resolve({
            errorMessage: "",
            status: 200,
            errorCode: "",
            duration: -1
          });
        },

        onMessage: (data: string) => {
          setLoading(false);
          pushHistory({
            type: "recv",
            method: "RECV",
            protocol: "ws",
            title: `RECV ${url}`,
            content: data
          });
          // Optionally resolve here if you want to return on first message
          resolve({
            body: data,
            errorMessage: "",
            status: -1,
            errorCode: "",
            duration: -1
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
          setLoading(false);
          // Save WS error to history
          pushHistory({
            type: "recv",
            method: "ERROR",
            protocol: "ws",
            title: `ERROR ${url}`,
            content: err?.message
          });
          resolve({
            errorMessage: "WebSocket cannot connect",
            status: 400,
            errorCode: "WS_NOT_CONNECTED",
            duration: -1
          });
        }
      });
      setWsId(websocketId);
    });
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