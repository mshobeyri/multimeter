import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'yaml';

import {APIData} from 'mmt-core/src/APIData';

// Helper to extract key-value pairs from Postman format and convert to object
function extractKeyValue(arr: any[] = []): Record<string, string> {
  const obj: Record<string, string> = {};
  if (Array.isArray(arr)) {
    arr.forEach(item => {
      if (item && item.key && typeof item.value !== 'undefined') {
        obj[item.key] = String(item.value);
      }
    });
  }
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

    // Convert Postman headers array to object
    const headers = extractKeyValue(request.header);

    // Convert Postman query array to object
    const query = extractKeyValue(request.url?.query);

    let body: string|object|undefined = undefined;
    if (request.body?.mode === 'raw') {
      body = request.body.raw;
    } else if (request.body?.mode === 'urlencoded') {
      body = extractKeyValue(request.body.urlencoded);
    } else if (request.body?.mode === 'formdata') {
      body = extractKeyValue(request.body.formdata);
    }

    // Determine format from content-type header
    let format = 'json';
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (typeof contentType === 'string') {
      if (contentType.toLowerCase().includes('xml')) {
        format = 'xml';
      } else if (contentType.toLowerCase().includes('text')) {
        format = 'text';
      }
    }

    // Determine protocol
    let protocol = 'http';
    if (url.toLowerCase().startsWith('ws')) {
      protocol = 'ws';
    }

    // Build the APIData object with new structure
    const apiData: APIData = {
      type: 'api',
      title: req.name || request.url?.raw || '',
      description: req.description || undefined,
      protocol: protocol as 'http' | 'ws',
      format: format as 'json' | 'xml' | 'text',
      url,
      method: request.method?.toLowerCase() as 'get' | 'post' | 'put' |
          'patch' | 'delete' | 'head' | 'options' | 'trace',
      headers,
      query,
      body,
    };

    // Remove undefined fields to keep the YAML clean
    if (!apiData.description) {
      delete apiData.description;
    }
    if (!apiData.headers || Object.keys(apiData.headers).length === 0) {
      delete apiData.headers;
    }
    if (!apiData.cookies || Object.keys(apiData.cookies).length === 0) {
      delete apiData.cookies;
    }
    if (!apiData.body) {
      delete apiData.body;
    }
    return apiData;
  });
}

export function openApiToAPI(openApiSpec: any): APIData[] {
  if (!openApiSpec || !openApiSpec.paths) {
    return [];
  }

  const apis: APIData[] = [];
  const baseUrl = openApiSpec.servers?.[0]?.url || '';

  // Iterate through all paths
  Object.entries(openApiSpec.paths).forEach(([path,
                                              pathItem]: [string, any]) => {
    // Iterate through all HTTP methods for this path
    Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
               .includes(method)) {
        return;  // Skip non-HTTP methods
      }

      const title = operation.summary || operation.operationId ||
          `${method.toUpperCase()} ${path}`;

      // Build headers from parameters
      const headers: Record<string, string> = {};
      const query: Record<string, string> = {};

      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          if (param.in === 'header') {
            headers[param.name] = param.example || param.schema?.example || '';
          } else if (param.in === 'query') {
            query[param.name] = param.example || param.schema?.example || '';
          }
        });
      }

      // Handle request body
      let body: string|object|undefined;
      let format: 'json'|'xml'|'text' = 'json';

      if (operation.requestBody?.content) {
        const contentTypes = Object.keys(operation.requestBody.content);
        const firstContentType = contentTypes[0];

        if (firstContentType) {
          if (firstContentType.includes('xml')) {
            format = 'xml';
          } else if (firstContentType.includes('text')) {
            format = 'text';
          }

          headers['Content-Type'] = firstContentType;

          const contentSpec = operation.requestBody.content[firstContentType];

          // Check for example at content level first (common for XML)
          if (contentSpec?.example) {
            body = contentSpec.example;
          }
          // Then check for example at schema level
          else if (contentSpec?.schema?.example) {
            body = typeof contentSpec.schema.example === 'string' ?
                contentSpec.schema.example :
                JSON.stringify(contentSpec.schema.example, null, 2);
          }
          // Generate example from schema properties
          else if (contentSpec?.schema?.properties) {
            const example: any = {};
            Object.entries(contentSpec.schema.properties)
                .forEach(([propName, propSchema]: [string, any]) => {
                  example[propName] = propSchema.example ||
                      propSchema.default ||
                      (propSchema.type === 'string'      ? 'string' :
                           propSchema.type === 'number'  ? 0 :
                           propSchema.type === 'boolean' ? false :
                                                           null);
                });
            body = format === 'xml' ? JSON.stringify(example, null, 2) :
                                      JSON.stringify(example, null, 2);
          }
          // For XML with string schema type, try to create a basic structure
          else if (format === 'xml' && contentSpec?.schema?.type === 'string') {
            body = '<root></root>';  // Fallback XML structure
          }
        }
      }

      // Build full URL - handle path parameters
      let processedPath = path;
      if (operation.parameters) {
        operation.parameters.forEach((param: any) => {
          if (param.in === 'path') {
            const example =
                param.example || param.schema?.example || `{${param.name}}`;
            processedPath =
                processedPath.replace(`{${param.name}}`, String(example));
          }
        });
      }

      const fullUrl = baseUrl + processedPath;

      const apiData: APIData = {
        type: 'api',
        title,
        description: operation.description,
        protocol: 'http' as const,
        format,
        url: fullUrl,
        method: method as 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' |
            'options' | 'trace',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        query: Object.keys(query).length > 0 ? query : undefined,
        body
      };

      // Clean up undefined fields
      if (!apiData.description) {
        delete apiData.description;
      }

      if (!apiData.headers || Object.keys(apiData.headers).length === 0) {
        delete apiData.headers;
      }
      if (!apiData.query || Object.keys(apiData.query).length === 0) {
        delete apiData.query;
      }
      if (!apiData.body) {
        delete apiData.body;
      }

      apis.push(apiData);
    });
  });

  return apis;
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

    const openApiIconPath =
        vscode.Uri.file(this.context.asAbsolutePath('res/openapi.svg'));
    const openApiIconWebviewUri =
        webviewView.webview.asWebviewUri(openApiIconPath);


    const multimeterIconPath =
        vscode.Uri.file(this.context.asAbsolutePath('res/icon.png'));
    const multimeterIconWebviewUri =
        webviewView.webview.asWebviewUri(multimeterIconPath);

    webviewView.webview.html = this.getHtml(
        postmanIconWebviewUri.toString(), openApiIconWebviewUri.toString(),
        multimeterIconWebviewUri.toString());

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
          let apis: APIData[] = [];

          if (msg.source === 'postman') {
            const postmanJson = JSON.parse(fileContent);
            apis = postmanToAPI(postmanJson);
          } else if (msg.source === 'openapi') {
            // Handle both JSON and YAML OpenAPI specs
            let openApiSpec: any;
            try {
              // Try parsing as JSON first
              openApiSpec = JSON.parse(fileContent);
            } catch {
              // If JSON parsing fails, try YAML
              openApiSpec = yaml.parse(fileContent);
            }
            apis = openApiToAPI(openApiSpec);
          }

          const files = apis.map(api => {
            const safeName =
                (api.title || 'api').replace(/[\\/:*?"<>|]+/g, '_');
            return {
              name: safeName + '.mmt',
              content: yaml.stringify(
                  api, {indent: 2, lineWidth: 0, minContentWidth: 0})
            };
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
            'vscode.openWith', uri, 'mmt.editor');
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

  getHtml(
      postmanIconUri: string, openApiIconUri: string,
      multimeterIconUri: string) {
    const htmlPath =
        path.join(this.context.extensionPath, 'src', 'panels', 'convertor.html');
    let html = fs.readFileSync(htmlPath, 'utf8');


    // Replace placeholders with icon URIs
    html = html.replace(/__POSTMAN_ICON__/g, postmanIconUri)
               .replace(/__OPENAPI_ICON__/g, openApiIconUri)
               .replace(/__MULTIMETER_ICON__/g, multimeterIconUri);
    return html;
  }
}

export default ConvertorPanel;
