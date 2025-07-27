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
    webviewView.webview.options = {enableScripts: true};
    const iconPath =
        vscode.Uri.file(this.context.asAbsolutePath('res/icon.png'));
    const iconWebviewUri = webviewView.webview.asWebviewUri(iconPath);
    webviewView.webview.html = this.getHtml(iconWebviewUri.toString());

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

  getHtml(iconUri: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <link rel="stylesheet" href="https://microsoft.github.io/vscode-codicons/dist/codicon.css">
      </head>
      <body>
        <div id="drop-area" class="drop-area" style="border:2px dashed #888;padding:24px;text-align:center;margin:18px 0;font-size:12px;">
          <p style="margin:0 0 8px 0;">Drag & drop a Postman collection file here,<br>or click to select a file.</p>
          <input type="file" id="fileInput" style="display:none" />
        </div>
        <div id="frame" style="display:none; border: 1px solid #444; border-radius: 8px; background: var(--vscode-editor-background, #1e1e1e); padding: 10px 10px 18px 10px; margin-bottom: 16px;">
          <div id="file-actions" style="margin-bottom: 8px; display: flex; justify-content: flex-end; gap: 6px;">
            <button id="selectAllBtn" class="mmt-action-btn" title="Select All">
              <span class="codicon codicon-check-all"></span>
              <span style="margin-left:3px;font-size:11px;">Select All</span>
            </button>
            <button id="saveBtn" class="mmt-action-btn" disabled title="Save Selected...">
              <span class="codicon codicon-save"></span>
              <span style="margin-left:3px;font-size:11px;">Save Selected...</span>
            </button>
          </div>
          <hr style="border: none; border-top: 1px solid #444; margin: 0 0 8px 0;">
          <div id="file-list"></div>
        </div>
        <style>
          .drop-area {
            transition: border-color 0.2s, background 0.2s;
          }
          .drop-area.hover {
            border-color: #3399ff;
            background: rgba(51,153,255,0.08);
          }
          .mmt-file-list { list-style: none; padding: 0; margin: 0; }
          .mmt-file-list li {
            display: flex;
            align-items: center;
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.15s;
            font-family: var(--vscode-font-family, monospace);
            font-size: 11px;
          }
          .mmt-file-list li.selected {
            background: var(--vscode-list-activeSelectionBackground, #094771);
          }
          .mmt-file-list li:hover {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
          }
          .mmt-file-icon {
            width: 13px;
            height: 13px;
            margin-right: 6px;
            opacity: 0.9;
            vertical-align: middle;
          }
          .mmt-file-name {
            flex: 1;
            color: var(--vscode-list-foreground, #d4d4d4);
            text-decoration: none;
            line-height: 13px;
            display: flex;
            align-items: center;
            font-size: 11px;
            cursor: pointer;
          }
          .mmt-file-checkbox {
            margin-right: 6px;
            width: 11px;
            height: 11px;
            cursor: pointer;
          }
          .mmt-action-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 4px;
            transition: background 0.15s;
            color: var(--vscode-button-foreground, #d4d4d4);
            font-size: 12px;
            display: flex;
            align-items: center;
          }
          .mmt-action-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .mmt-action-btn:hover:enabled {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
          }
        </style>
        <script>
          const vscode = acquireVsCodeApi();
          const iconUri = "${iconUri}";
          let mmtFiles = [];
          let selected = [];

          const dropArea = document.getElementById('drop-area');
          const fileInput = document.getElementById('fileInput');
          const saveBtn = document.getElementById('saveBtn');
          const selectAllBtn = document.getElementById('selectAllBtn');
          const fileActions = document.getElementById('file-actions');
          const frame = document.getElementById('frame');

          dropArea.addEventListener('click', () => fileInput.click());
          dropArea.addEventListener('dragover', e => {
            e.preventDefault();
            dropArea.classList.add('hover');
          });
          dropArea.addEventListener('dragleave', e => {
            e.preventDefault();
            dropArea.classList.remove('hover');
          });
          dropArea.addEventListener('drop', e => {
            e.preventDefault();
            dropArea.classList.remove('hover');
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

          selectAllBtn.addEventListener('click', () => {
            selected = mmtFiles.map((_, i) => i);
            renderFileList();
            updateSaveBtn();
          });

          saveBtn.addEventListener('click', async () => {
            if (!selected.length) return;
            const filesToSave = selected.map(i => mmtFiles[i]);
            vscode.postMessage({ type: 'chooseSaveDir', files: filesToSave });
          });

          window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.type === 'fileList') {
              mmtFiles = msg.files;
              selected = [];
              renderFileList();
              updateSaveBtn();
              frame.style.display = mmtFiles.length ? '' : 'none';
            }
          });

          function renderFileList() {
            const fileListDiv = document.getElementById('file-list');
            fileListDiv.innerHTML = mmtFiles.length
              ? '<ul class="mmt-file-list">' +
              mmtFiles.map((f, i) =>
                \`<li class="\${selected.includes(i) ? 'selected' : ''}">
                  <input type="checkbox" class="mmt-file-checkbox" \${selected.includes(i) ? 'checked' : ''} onclick="toggleSelect(\${i}, event)" />
                  <span class="mmt-file-name" onclick="openFile(\${i}, event)">
                    <img src="\${iconUri}" class="mmt-file-icon" />
                    \${f.name}
                  </span>
                </li>\`
              ).join('') +
              '</ul>'
            : '';
          }

          function updateSaveBtn() {
            saveBtn.disabled = selected.length === 0;
          }

          window.toggleSelect = function(idx, event) {
            event.stopPropagation();
            if (selected.includes(idx)) {
              selected = selected.filter(i => i !== idx);
            } else {
              selected.push(idx);
            }
            renderFileList();
            updateSaveBtn();
          };

          window.openFile = function(idx, event) {
            event.stopPropagation();
            const file = mmtFiles[idx];
            vscode.postMessage({ type: 'openFile', name: file.name, content: file.content });
          };
        </script>
      </body>
      </html>
    `;
  }
}

export default ConvertorPanel;
