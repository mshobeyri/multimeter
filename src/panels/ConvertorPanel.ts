import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as yaml from 'yaml';

import {APIData} from 'mmt-core/APIData';
import {postmanConvertor} from 'mmt-core';
import {openapiConvertor} from 'mmt-core';
import {apiParsePack} from 'mmt-core';

// Helper to extract key-value pairs from Postman format and convert to object
// (legacy local implementation removed; now using core convertors)

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
            apis = postmanConvertor.postmanToAPI(postmanJson);
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
            apis = openapiConvertor.openApiToAPI(openApiSpec);
          }

          const files = apis.map(api => {
            const safeName =
                (api.title || 'api').replace(/[\\/:*?"<>|]+/g, '_');
            return {
              name: safeName + '.mmt',
              content: apiParsePack.apiToYaml(api)
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
        // If the document is already open, replace its entire contents instead of inserting again.
        const existing = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        const edit = new vscode.WorkspaceEdit();
        if (existing) {
          const lastLine = existing.lineCount > 0 ? existing.lineCount - 1 : 0;
          const lastChar = existing.lineCount > 0 ? existing.lineAt(lastLine).text.length : 0;
          const fullRange = new vscode.Range(0, 0, lastLine, lastChar);
          edit.replace(uri, fullRange, msg.content);
        } else {
          edit.insert(uri, new vscode.Position(0, 0), msg.content);
        }
        await vscode.workspace.applyEdit(edit);
        // Reveal with custom editor
        await vscode.commands.executeCommand('vscode.openWith', uri, 'mmt.editor');
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
        path.join(this.context.extensionPath, 'res', 'convertor.html');
    let html = fs.readFileSync(htmlPath, 'utf8');


    // Replace placeholders with icon URIs
    html = html.replace(/__POSTMAN_ICON__/g, postmanIconUri)
               .replace(/__OPENAPI_ICON__/g, openApiIconUri)
               .replace(/__MULTIMETER_ICON__/g, multimeterIconUri);
    return html;
  }
}

export default ConvertorPanel;
