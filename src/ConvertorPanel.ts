import * as vscode from 'vscode';
import { APIData, InterfaceData } from "../mmtview/src/api/APIData";
import * as yaml from 'yaml';

// Helper to extract key-value pairs from Postman format
function extractKeyValue(arr: any[] = []) {
  const obj: Record<string, string> = {};
  arr.forEach(item => {
    if (item.key && typeof item.value !== "undefined") {
      obj[item.key] = item.value;
    }
  });
  return obj;
}

export function postmanToAPI(postmanJson: any): APIData[] {
  if (!postmanJson || !postmanJson.item) {
    return [];
  }

  // Each collection becomes one APIData
  const api: APIData = {
    type: "api",
    title: postmanJson.info?.name || "",
    tags: [],
    description: postmanJson.info?.description || "",
    import: [],
    inputs: [],
    outputs: [],
    interfaces: [],
    examples: [],
  };

  // Flatten all requests (recursively for folders)
  function flattenItems(items: any[]): any[] {
    return items.flatMap(item =>
      item.item ? flattenItems(item.item) : [item]
    );
  }
  const requests = flattenItems(postmanJson.item);

  api.interfaces = requests.map((req: any) => {
    const request = req.request || {};
    const url = typeof request.url === "string"
      ? request.url
      : request.url?.raw || "";

    const headers = extractKeyValue(request.header);
    const query = extractKeyValue(request.url?.query);

    let body: string | object | undefined = undefined;
    if (request.body?.mode === "raw") {
      body = request.body.raw;
    } else if (request.body?.mode === "urlencoded") {
      body = extractKeyValue(request.body.urlencoded);
    } else if (request.body?.mode === "formdata") {
      body = extractKeyValue(request.body.formdata);
    }

    return {
      name: req.name || request.url?.raw || "",
      protocol: "http", // or infer from url
      format: "json",   // or infer from headers/body
      url,
      method: request.method?.toLowerCase() || "get",
      headers,
      query,
      body,
    } as InterfaceData;
  });

  return [api];
}


class ConvertorPanel implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'file') {
        try {
          const fileName = msg.name || '(unknown)';
          const fileContent = msg.text;
          let yamlResult = '';
          try {
            const postmanJson = JSON.parse(fileContent);
            const result = postmanToAPI(postmanJson);
            yamlResult = yaml.stringify(result);
          } catch (e) {
            yamlResult = 'Error converting to YAML: ' + (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e));
          }
          webviewView.webview.postMessage({
            type: 'result',
            text:
              `File: ${fileName}\n\n` +
              `Content:\n${fileContent}\n\n` +
              `Converted YAML:\n${yamlResult}`
          });
        } catch (e) {
          webviewView.webview.postMessage({
            type: 'result',
            text: 'Error: ' + (typeof e === 'object' && e && 'message' in e ? (e as any).message : String(e))
          });
        }
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
        <pre id="output" style="background:#222;color:#fff;padding:12px;min-height:120px;overflow:auto;"></pre>
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
            if (msg.type === 'result') {
              document.getElementById('output').textContent = msg.text;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}

export default ConvertorPanel;
