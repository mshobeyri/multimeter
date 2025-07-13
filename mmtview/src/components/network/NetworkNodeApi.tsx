import { act } from "react";
import { showVSCodeMessage } from "../../vsAPI";
import { on } from "events";

type HttpOptions = {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
    cookies?: Record<string, string>;
    onResponse?: (response: any) => void;
    onError?: (error: any) => void;
};

type WsOptions = {
    url: string;
    uuid: string;
    onOpen?: () => void;
    onMessage?: (data: string) => void;
    onClose?: () => void;
    onError?: (error: any) => void;
};

type SendWsOptions = {
    uuid: string;
    data: string;
};

type DisconnectWsOptions = {
    uuid: string;
};

export const NetworkNodeApi = {
    sendHttp: (options: HttpOptions) => {
        window.vscode?.postMessage({
            command: "network",
            action: "http-send",
            url: options.url,
            method: options.method,
            headers: options.headers,
            body: options.body,
            params: options.params,
            cookies: options.cookies
        });
    },

    connectWs: (options: WsOptions) => {
        window.vscode?.postMessage({
            command: "network",
            action: "ws-connect",
            url: options.url,
            uuid: options.uuid,
        });
        // Connection events handled in receiveMessage below
        listeners.ws[options.uuid] = {
            onOpen: options.onOpen,
            onMessage: options.onMessage,
            onClose: options.onClose,
            onError: options.onError,
        };
    },

    sendWs: (options: SendWsOptions) => {
        window.vscode?.postMessage({
            command: "network",
            action: "ws-send",
            uuid: options.uuid,
            data: options.data,
        });
    },

    disconnectWs: (options: DisconnectWsOptions) => {
        window.vscode?.postMessage({
            command: "network",
            action: "ws-disconnect",
            uuid: options.uuid,
        });
    },
};

// Internal listeners for websocket events
const listeners = {
    ws: {} as Record<
        string,
        {
            onOpen?: () => void;
            onMessage?: (data: string) => void;
            onClose?: () => void;
            onError?: (error: any) => void;
        }
    >,
};

// Listen for messages from node backend
window.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || !msg.command) return;

    // HTTP response
    if (msg.command === "network" && msg.action === "http-response" && typeof msg.data !== "undefined") {
        console.log("Received message from node backend:", event.data);
        if (typeof msg.onResponse === "function") msg.onResponse(msg.data);
    }
    if (msg.command === "network" && msg.action === "http-error" && typeof msg.error !== "undefined") {
        if (typeof msg.onError === "function") msg.onError(msg.error);
    }

    // WebSocket events
    if (msg.uuid && listeners.ws[msg.uuid]) {
        const wsListener = listeners.ws[msg.uuid];
        if (msg.command === "ws-open" && wsListener.onOpen) wsListener.onOpen();
        if (msg.command === "ws-message" && wsListener.onMessage) wsListener.onMessage(msg.data);
        if (msg.command === "ws-close" && wsListener.onClose) wsListener.onClose();
        if (msg.command === "ws-error" && wsListener.onError) wsListener.onError(msg.error);
    }
});