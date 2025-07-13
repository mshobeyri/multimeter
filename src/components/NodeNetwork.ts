import axios from 'axios';
import * as vscode from 'vscode';
import WebSocket from 'ws';

export type NetworkMessage =|{
  command: 'network', action: 'http-send';
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: any;
  cookies?: Record<string, string>
  requestId: string;
}
|{
  command: 'network', action: 'ws-connect';
  endpoint: string;
  wsId: string
}
|{
  command: 'network', action: 'ws-send';
  wsId: string;
  data: string
}
|{
  command: 'network', action: 'ws-disconnect';
  wsId: string
};

export function handleNetworkMessage(
    message: NetworkMessage, webviewPanel: vscode.WebviewPanel,
    wsConnections: Record<string, WebSocket>) {
  switch (message.action) {
    case 'http-send':
      (async () => {

        try {
          const {endpoint, method = 'GET', headers = {}, body, params, cookies, requestId} =
              message;

          let reqHeaders = {...headers};
          if (cookies && Object.keys(cookies).length > 0) {
            reqHeaders['Cookie'] =
                Object.entries(cookies).map(([k, v]) =>
                `${k}=${v}`).join('; ');
          }

          let request = {
            url: endpoint,
            method,
            data: body,
            params,
            withCredentials: true,
            headers: reqHeaders,
          };
          const response = await axios.request(request);
          console.log("HTTP response received:", response);
          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'http-response',
            data:{
                body: response.data,
                headers: response.headers,
                status: response.status,
            },
            requestId,
          });
        } catch (err: any) {
          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'http-error',
            error: err?.message || String(err),
            requestId: message.requestId,
          });
        }
      })();
      break;

    case 'ws-connect':
      try {
        const {endpoint, wsId} = message;
        if (wsConnections[wsId]) {
          wsConnections[wsId].close();
          delete wsConnections[wsId];
        }
        const ws = new WebSocket(endpoint);
        wsConnections[wsId] = ws;

        ws.on('open', () => {
          webviewPanel.webview.postMessage(
              {command: 'network', action: 'ws-open', wsId});
        });
        ws.on('close', () => {
          webviewPanel.webview.postMessage(
              {command: 'network', action: 'ws-close', wsId});
          delete wsConnections[wsId];
        });
        ws.on('error', (error) => {
          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'ws-error',
            wsId,
            error: error?.message || String(error)
          });
        });

        ws.on('message', (data) => {
            console.log("WebSocket message received:", data);
          webviewPanel.webview.postMessage(
              {command: 'network', action: 'ws-message', wsId, data: data.toString()});
        });

      } catch (err: any) {
        webviewPanel.webview.postMessage({
          command: 'network',
          action: 'ws-error',
          wsId: (message as any).wsId,
          error: err?.message || String(err)
        });
      }
      break;

    case 'ws-send': {
      const {wsId, data} = message;
      const ws = wsConnections[wsId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      } else {
        webviewPanel.webview.postMessage(
            {command: 'network', action: 'ws-error', wsId, error: 'WebSocket not open'});
      }
    } break;

    case 'ws-disconnect': {
      const {wsId} = message;
      const ws = wsConnections[wsId];
      if (ws) {
        ws.close();
        delete wsConnections[wsId];
        webviewPanel.webview.postMessage({command: 'network', action: 'ws-close', wsId});
      }
    } break;
  }
}