import { useRef, useState } from "react";
import { NetworkAPI, Request, Response } from "mmt-core/NetworkData";
import { NetworkNodeApi, Error } from "./NetworkNodeApi";
import { pushHistory } from "../../vsAPI";
import { beautifyWithContentType } from "mmt-core/markupConvertor";
import { getEffectiveProtocol } from "mmt-core/protocolResolver";

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

    const effectiveProtocol = getEffectiveProtocol(requestData.protocol as any, requestData.url);

    if (effectiveProtocol === "http" || effectiveProtocol === "graphql") {
      return new Promise<Response | undefined>((resolve) => {
        let {
          url = requestData.url,
          method = requestData.method || "get",
          headers = requestData.headers,
          body = requestData.body,
          protocol = effectiveProtocol,
          cookies = requestData.cookies,
          query = requestData.query,
        } = requestData;

        // For GraphQL, build HTTP POST with GraphQL body
        if (effectiveProtocol === "graphql") {
          method = "post";
          headers = { ...headers, "Content-Type": "application/json" };
          const gql = requestData.graphql || (requestData as any).graphql;
          if (gql?.operation) {
            const gqlBody: any = { query: gql.operation };
            if (gql.variables) { gqlBody.variables = gql.variables; }
            if (gql.operationName) { gqlBody.operationName = gql.operationName; }
            body = JSON.stringify(gqlBody);
          }
        }
        // Save request to history
        pushHistory({
          type: "send",
          method: method.toUpperCase(),
          protocol,
          title: `${method.toUpperCase()} ${url}`,
          cookies: cookies,
          headers: headers,
          query: query,
          content: method === "get" ? "" : toContentString(body),
        });

        lastRequestID.current = NetworkNodeApi.sendHttp({
          url: url ?? "",
          method: method.toUpperCase(),
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
              title: `${method.toUpperCase()} ${url}`,
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
              errorMessage: res.statusText || "",
              status: res.status || -1,
              errorCode: res.errorCode || "",
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
              title: `${method.toUpperCase()} ${url} Error`,
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
    } else if (effectiveProtocol === "grpc") {
      return new Promise<Response | undefined>((resolve) => {
        const url = requestData.url ?? "";
        const grpc = requestData.grpc || (requestData as any).grpc;
        const service = grpc?.service || "";
        const method = grpc?.method || "";
        const metadata = requestData.headers || {};
        const message = grpc?.message;

        pushHistory({
          type: "send",
          method: `${service}/${method}`,
          protocol: "grpc",
          title: `gRPC ${service}/${method}`,
          headers: metadata,
          content: toContentString(message),
        });

        lastRequestID.current = NetworkNodeApi.sendGrpc({
          url,
          proto: grpc?.proto || "",
          service,
          method,
          metadata,
          message,
          stream: grpc?.stream,
          onResponse: (res: any) => {
            setLoading(false);
            pushHistory({
              type: "recv",
              method: `${service}/${method}`,
              protocol: "grpc",
              title: `gRPC ${service}/${method}`,
              headers: res.metadata || {},
              content: toContentString(res.body),
              duration: res.duration || -1,
              status: res.status || 0,
            });
            resolve({
              body: typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2),
              headers: res.metadata || {},
              errorMessage: res.statusText || "",
              status: res.status ?? 0,
              errorCode: "",
              duration: res.duration || -1,
            });
          },
          onError: (error: Error) => {
            setLoading(false);
            pushHistory({
              type: "error",
              method: `${service}/${method}`,
              protocol: "grpc",
              title: `gRPC ${service}/${method} Error`,
              content: toContentString(error),
              duration: error.duration || -1,
              status: error.status || -1,
            });
            resolve({
              body: error.body || null,
              headers: {},
              errorMessage: error.message ?? "",
              status: error.status || -1,
              errorCode: error.code || "GRPC_ERROR",
              duration: error.duration || -1,
            });
          },
        });
      });
    } else {
      return new Promise<Response | undefined>((resolve) => {
        const opts = requestData;
        const {
          url = requestData.url,
          body = requestData.body,
          protocol = effectiveProtocol,
        } = opts;

        if (!url) {
          setLoading(false);
          resolve({
            errorMessage: "WebSocket URL is missing",
            status: 400,
            errorCode: "WS_URL_MISSING",
            duration: -1
          });
          return;
        }

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
          method: "send",
          protocol,
          title: `send ${url}`,
          content: toContentString(body)
        });

        lastRequestID.current = NetworkNodeApi.sendWs({
          wsId: wsId || "",
          data: toContentString(body),
          onResponse: (res: any) => {
            setLoading(false);
            resolve({
              body: res,
              errorMessage: "",
              status: 204,
              errorCode: "WS_MESSAGE",
              duration: -1
            });
          },
          onError: (error: Error) => {
            setLoading(false);
            resolve({
              errorMessage: error.message || "",
              status: -1,
              errorCode: error.code || "UNKNOWN_ERROR",
              duration: error.duration || -1
            });
          }
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
      method: "connect",
      protocol: "ws",
      title: `connnect ${url}`
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
            method: "connected",
            protocol: "ws",
            title: `connected ${url}`,
            content: url
          });

          resolve({
            errorMessage: "",
            status: 101,
            errorCode: "",
            duration: -1
          });
        },

        onMessage: (data: string) => {
          setLoading(false);
          pushHistory({
            type: "recv",
            method: "recv",
            protocol: "ws",
            title: `recv ${url}`,
            content: data
          });
          // Optionally resolve here if you want to return on first message
          resolve({
            body: data,
            errorMessage: "",
            status: 204,
            errorCode: "WS_MESSAGE",
            duration: -1
          });
        },
        onClose: (info) => {
          setConnected(false);
          setLoading(false);

          const closeCode = typeof info?.code === 'number' ? info.code : 1000;
          const closeReason = info?.reason || '';

          // Save WS close to history
          pushHistory({
            type: "recv",
            method: "closed",
            protocol: "ws",
            title: `closed ${url}`,
            content: closeReason ? `${closeCode} ${closeReason}` : `${closeCode}`
          });

          resolve({
            errorMessage: closeReason,
            status: closeCode,
            errorCode: "WS_CLOSED",
            duration: -1
          });
        },
        onError: (err: any) => {
          setLoading(false);
          // Save WS error to history
          pushHistory({
            type: "recv",
            method: "error",
            protocol: "ws",
            title: `error ${url}`,
            content: err?.message || err?.error || String(err)
          });
          resolve({
            errorMessage: err?.message || String(err),
            status: -1,
            errorCode: err?.code || "WS_ERROR",
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
      method: "close",
      protocol: "ws",
      title: `close`
    });
    NetworkNodeApi.disconnectWs({
      wsId: wsId || "",
    });
    setConnected(false);
    setLoading(false);
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