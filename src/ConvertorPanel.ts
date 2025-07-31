import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'yaml';

import {APIData, InterfaceData} from '../mmtview/src/api/APIData';

// Helper to extract key-value pairs from Postman format
function extractKeyValue(arr: any[] = []) {
  const obj: Record<string, string> = {};
  arr.forEach(item => {
    if (item.key && typeof item.value !== 'undefined') {
      obj[item.key] = item.value;
    }
  });
  return obj;
}

export function postmanToAPI(postmanJson: any): APIData[] {
  if (!postmanJson || !postmanJson.item) {
    return [];
  }
  function flattenItems(items: any[]): any[] {
    return items.flatMap(item => item.item ? flattenItems(item.item) : [item]);
  }
  const requests = flattenItems(postmanJson.item);

  return requests.map((req: any) => {
    const request = req.request || {};
    const url =
        typeof request.url === 'string' ? request.url : request.url?.raw || '';
    const headers = extractKeyValue(request.header);
    const query = extractKeyValue(request.url?.query);
    let body: string|object|undefined = undefined;
    if (request.body?.mode === 'raw') {
      body = request.body.raw;
    } else if (request.body?.mode === 'urlencoded') {
      body = extractKeyValue(request.body.urlencoded);
    } else if (request.body?.mode === 'formdata') {
      body = extractKeyValue(request.body.formdata);
    }

    let format = 'json';
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (typeof contentType === 'string' &&
        contentType.toLowerCase().includes('xml')) {
      format = 'xml';
    }
    if (typeof contentType === 'string' &&
        contentType.toLowerCase().includes('text')) {
      format = 'text';
    }

    let protocol = 'http';
    if (url.toLowerCase().startsWith('ws')) {
      protocol = 'ws';
    }

    return {
      type: 'api',
      title: req.name || request.url?.raw || '',
      tags: [],
      description: req.description || '',
      import: [],
      inputs: [],
      outputs: [],
      interfaces: [{
        name: req.name || request.url?.raw || '',
        protocol,
        format,
        url,
        method: request.method?.toUpperCase() || 'GET',
        headers,
        query,
        body,
      } as InterfaceData],
      examples: [],
    } as APIData;
  });
}

class ConvertorPanel implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken) {
    webviewView.webview.options = {enableScripts: true};
    const postmanIconPath =
        vscode.Uri.file(this.context.asAbsolutePath('res/postman.svg'));
    const postmanIconWebviewUri =
        webviewView.webview.asWebviewUri(postmanIconPath);

    const multimeterIconPath =
        vscode.Uri.file(this.context.asAbsolutePath('res/icon.png'));
    const multimeterIconWebviewUri =
        webviewView.webview.asWebviewUri(multimeterIconPath);

    webviewView.webview.html = this.getHtml(
        postmanIconWebviewUri.toString(), multimeterIconWebviewUri.toString());

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'chooseSaveDir') {
        const uri = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Select target folder for MMT files'
        });
        if (uri && uri[0]) {
          webviewView.webview.postMessage({type: 'saveDirSelected'});
          webviewView.webview.postMessage({type: 'saving'});
          // Save files
          for (const file of msg.files) {
            const fileUri = vscode.Uri.joinPath(uri[0], file.name);
            await vscode.workspace.fs.writeFile(
                fileUri, Buffer.from(file.content, 'utf8'));
          }
          vscode.window.showInformationMessage(
              `Saved ${msg.files.length} file(s) to ${uri[0].fsPath}`);
        }
      } else if (msg.type === 'file') {
        try {
          const fileContent = msg.text;
          const postmanJson = JSON.parse(fileContent);
          const apis = postmanToAPI(postmanJson);
          const files = apis.map(api => {
            const safeName =
                (api.title || 'api').replace(/[\\/:*?"<>|]+/g, '_');
            return {name: safeName + '.mmt', content: yaml.stringify(api)};
          });
          webviewView.webview.postMessage({type: 'fileList', files});
        } catch (e) {
          webviewView.webview.postMessage({
            type: 'fileList',
            files: [],
            error: 'Error: ' +
                (typeof e === 'object' && e && 'message' in e ?
                     (e as any).message :
                     String(e))
          });
        }
      } else if (msg.type === 'openFile') {
        const uri = vscode.Uri.parse(`untitled:${msg.name}`);
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, new vscode.Position(0, 0), msg.content);
        await vscode.workspace.applyEdit(edit);
        await vscode.commands.executeCommand(
            'vscode.openWith', uri, 'mmt.preview');
      } else if (msg.type === 'saveSelected') {
        // msg.files: [{name, content}], msg.targetDir: string
        for (const file of msg.files) {
          const fileUri =
              vscode.Uri.joinPath(vscode.Uri.file(msg.targetDir), file.name);
          await vscode.workspace.fs.writeFile(
              fileUri, Buffer.from(file.content, 'utf8'));
        }
        vscode.window.showInformationMessage(
            `Saved ${msg.files.length} file(s) to ${msg.targetDir}`);
      }
    });
  }

  getHtml(postmanIconUri: string, multimeterIconUri: string) {
    const htmlPath =
        path.join(this.context.extensionPath, 'src', 'convertor.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Replace placeholders with icon URIs
    html = html.replace(/__POSTMAN_ICON__/g, postmanIconUri)
               .replace(/__MULTIMETER_ICON__/g, multimeterIconUri);
    return html;
  }
}

export default ConvertorPanel;
