import axios from 'axios';
import * as vscode from 'vscode';
import WebSocket from 'ws';

export type NetworkMessage =|{
  command: 'network', action: 'sendHttp';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: any;
  cookies?: Record<string, string>
}
|{
  command: 'network', action: 'ws-connect';
  url: string;
  uuid: string
}
|{
  command: 'network', action: 'ws-send';
  uuid: string;
  data: string
}
|{
  command: 'network', action: 'ws-disconnect';
  uuid: string
};

export function handleNetworkMessage(
    message: NetworkMessage, webviewPanel: vscode.WebviewPanel,
    wsConnections: Record<string, WebSocket>) {
  switch (message.action) {
    case 'sendHttp':
      (async () => {
        try {
          const {url, method = 'GET', headers = {}, body, params, cookies} =
              message;
          let reqHeaders = {...headers};
          if (cookies && Object.keys(cookies).length > 0) {
            reqHeaders['Cookie'] =
                Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
          }
          const response = await axios.request({
            url,
            method,
            headers: reqHeaders,
            data: body,
            params,
            withCredentials: true,
          });
          webviewPanel.webview.postMessage({
            command: 'httpResponse',
            data: response.data,
            headers: response.headers,
            status: response.status,
          });
        } catch (err: any) {
          webviewPanel.webview.postMessage({
            command: 'httpError',
            error: err?.message || String(err),
          });
        }
      })();
      break;

    case 'ws-connect':
      try {
        const {url, uuid} = message;
        if (wsConnections[uuid]) {
          wsConnections[uuid].close();
          delete wsConnections[uuid];
        }
        const ws = new WebSocket(url);
        wsConnections[uuid] = ws;

        ws.on('open', () => {
          webviewPanel.webview.postMessage({command: 'ws-open', uuid});
        });
        ws.on('close', () => {
          webviewPanel.webview.postMessage({command: 'ws-close', uuid});
          delete wsConnections[uuid];
        });
        ws.on('error', (error) => {
          webviewPanel.webview.postMessage({
            command: 'ws-error',
            uuid,
            error: error?.message || String(error)
          });
        });
        ws.on('message', (data) => {
          webviewPanel.webview.postMessage(
              {command: 'ws-message', uuid, data: data.toString()});
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          command: 'ws-error',
          uuid: (message as any).uuid,
          error: err?.message || String(err)
        });
      }
      break;

    case 'ws-send': {
      const {uuid, data} = message;
      const ws = wsConnections[uuid];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      } else {
        webviewPanel.webview.postMessage(
            {command: 'ws-error', uuid, error: 'WebSocket not open'});
      }
    } break;

    case 'ws-disconnect': {
      const {uuid} = message;
      const ws = wsConnections[uuid];
      if (ws) {
        ws.close();
        delete wsConnections[uuid];
        webviewPanel.webview.postMessage({command: 'ws-close', uuid});
      }
    } break;
  }
}