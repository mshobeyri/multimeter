import { act } from "react";
import { showVSCodeMessage } from "../../vsAPI";
import { on } from "events";

type HttpOptions = {
    endpoint: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
    cookies?: Record<string, string>;
    onResponse?: (response: any) => void;
    onError?: (error: any) => void;
};

type WsOptions = {
    endpoint: string;
    onOpen?: () => void;
    onMessage?: (data: string) => void;
    onClose?: () => void;
    onError?: (error: any) => void;
};

type SendWsOptions = {
    wsId: string;
    data: string;
};

type DisconnectWsOptions = {
    wsId: string;
};

// Helper to generate a unique request id
function generateRequestId() {
    return Math.random().toString(36).slice(2) + Date.now();
}

// Store pending HTTP requests by requestId
const pendingHttp: Record<
    string,
    {
        onResponse?: (response: any) => void;
        onError?: (error: any) => void;
    }
> = {};

const openWebsockets: Record<
    string,
    {
        onOpen?: () => void;
        onMessage?: (data: string) => void;
        onClose?: () => void;
        onError?: (error: any) => void;
    }
> = {};

export const NetworkNodeApi = {
    sendHttp: (options: HttpOptions) => {
        const requestId = generateRequestId();
        pendingHttp[requestId] = {
            onResponse: options.onResponse,
            onError: options.onError,
        };
        window.vscode?.postMessage({
            command: "network",
            action: "http-send",
            endpoint: options.endpoint,
            method: options.method,
            headers: options.headers,
            body: options.body,
            params: options.params,
            cookies: options.cookies,
            requestId,
        });
    },

    connectWs: (options: WsOptions) => {
        const wsId = generateRequestId();
        window.vscode?.postMessage({
            command: "network",
            action: "ws-connect",
            endpoint: options.endpoint,
            wsId: wsId,
        });
        openWebsockets[wsId] = {
            onOpen: options.onOpen,
            onMessage: options.onMessage,
            onClose: options.onClose,
            onError: options.onError,
        };
        return wsId;
    },

    sendWs: (options: SendWsOptions) => {
        window.vscode?.postMessage({
            command: "network",
            action: "ws-send",
            wsId: options.wsId,
            data: options.data,
        });
    },

    disconnectWs: (options: DisconnectWsOptions) => {
        window.vscode?.postMessage({
            command: "network",
            action: "ws-disconnect",
            wsId: options.wsId,
        });
    },
};

// Listen for messages from node backend
window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || !msg.command || msg.command != "network") return;

    // HTTP response
    if (msg.action === "http-response" && typeof msg.data !== "undefined") {
        const cb = pendingHttp[msg.requestId];
        if (cb && typeof cb.onResponse === "function") cb.onResponse(msg.data);
        delete pendingHttp[msg.requestId];
    }
    if (msg.action === "http-error" && typeof msg.error !== "undefined") {
        const cb = pendingHttp[msg.requestId];
        if (cb && typeof cb.onError === "function") cb.onError(msg.error);
        delete pendingHttp[msg.requestId];
    }

    // WebSocket events
    if (msg.wsId && openWebsockets[msg.wsId]) {
        const wsListener = openWebsockets[msg.wsId];
        if (msg.action === "ws-open" && wsListener.onOpen) wsListener.onOpen();
        if (msg.action === "ws-message" && wsListener.onMessage) wsListener.onMessage(msg.data);
        if (msg.action === "ws-close" && wsListener.onClose) wsListener.onClose();
        if (msg.action === "ws-error" && wsListener.onError) wsListener.onError(msg.error);
    }
});