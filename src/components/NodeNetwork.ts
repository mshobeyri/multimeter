import axios from 'axios';
import * as vscode from 'vscode';
import WebSocket from 'ws';

export type NetworkMessage =|{
  command: 'network', action: 'http-send';
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
    case 'http-send':
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
            command: 'network',
            action: 'http-response',
            data: response.data,
            headers: response.headers,
            status: response.status,
          });
        } catch (err: any) {
          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'http-error',
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
          webviewPanel.webview.postMessage(
              {command: 'network', action: 'ws-open', uuid});
        });
        ws.on('close', () => {
          webviewPanel.webview.postMessage(
              {command: 'network', action: 'ws-close', uuid});
          delete wsConnections[uuid];
        });
        ws.on('error', (error) => {
          webviewPanel.webview.postMessage({
            command: 'network',
            action: 'ws-error',
            uuid,
            error: error?.message || String(error)
          });
        });
        ws.on('message', (data) => {
          webviewPanel.webview.postMessage(
              {action: 'ws-message', uuid, data: data.toString()});
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          action: 'ws-error',
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
            {action: 'ws-error', uuid, error: 'WebSocket not open'});
      }
    } break;

    case 'ws-disconnect': {
      const {uuid} = message;
      const ws = wsConnections[uuid];
      if (ws) {
        ws.close();
        delete wsConnections[uuid];
        webviewPanel.webview.postMessage({action: 'ws-close', uuid});
      }
    } break;
  }
}