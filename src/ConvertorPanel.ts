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

  // Flatten all requests (recursively for folders)
  function flattenItems(items: any[]): any[] {
    return items.flatMap(item => item.item ? flattenItems(item.item) : [item]);
  }
  const requests = flattenItems(postmanJson.item);

  // Each request becomes its own APIData with one interface
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
        protocol: 'http',
        format: 'json',
        url,
        method: request.method?.toLowerCase() || 'get',
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
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'file') {
        try {
          const fileContent = msg.text;
          const postmanJson = JSON.parse(fileContent);
          const apis = postmanToAPI(postmanJson);

          // Prepare files: each as { name, content }
          const files = apis.map(api => {
            // Use api.title or fallback to "api"
            const safeName =
                (api.title || 'api').replace(/[\\/:*?"<>|]+/g, '_');
            return {name: safeName + '.mmt', content: yaml.stringify(api)};
          });

          // Send file list to webview
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
        // Create the untitled document with content using a workspace edit
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, new vscode.Position(0, 0), msg.content);
        await vscode.workspace.applyEdit(edit);
        // Open with your custom editor (mmt.preview)
        await vscode.commands.executeCommand(
            'vscode.openWith', uri, 'mmt.preview');
      }
    });
  }

  getHtml() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <body>
        <h2>Postman to Multimeter API Converter</h2>
        <div id="drop-area" style="border:2px dashed #888;padding:32px;text-align:center;margin:24px 0;">
          <p>Drag & drop a Postman collection file here,<br>or click to select a file.</p>
          <input type="file" id="fileInput" style="display:none" />
        </div>
        <div id="file-list"></div>
        <script>
          const vscode = acquireVsCodeApi();
          const dropArea = document.getElementById('drop-area');
          const fileInput = document.getElementById('fileInput');
          dropArea.addEventListener('click', () => fileInput.click());
          dropArea.addEventListener('dragover', e => {
            e.preventDefault();
            dropArea.style.background = '#eee';
          });
          dropArea.addEventListener('dragleave', e => {
            e.preventDefault();
            dropArea.style.background = '';
          });
          dropArea.addEventListener('drop', e => {
            e.preventDefault();
            dropArea.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = function(evt) {
                vscode.postMessage({ type: 'file', name: file.name, text: evt.target.result });
              };
              reader.readAsText(file);
            }
          });
          fileInput.addEventListener('change', e => {
            const file = fileInput.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = function(evt) {
                vscode.postMessage({ type: 'file', name: file.name, text: evt.target.result });
              };
              reader.readAsText(file);
            }
          });

          window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'fileList') {
              const fileListDiv = document.getElementById('file-list');
              fileListDiv.innerHTML = '<h3>Converted MMT Files:</h3><ul style="padding-left:20px;">' +
                msg.files.map((f, i) =>
                  '<li><a href="#" onclick="openFile(' + i + ');return false;">' + f.name + '</a></li>'
                ).join('') +
                '</ul>';
              window.mmtFiles = msg.files;
            }
          });

          // Expose openFile globally
          window.openFile = function(idx) {
            const file = window.mmtFiles[idx];
            vscode.postMessage({ type: 'openFile', name: file.name, content: file.content });
          };
        </script>
      </body>
      </html>
    `;
  }
}

export default ConvertorPanel;
