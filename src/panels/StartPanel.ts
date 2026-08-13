import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {OnboardingController, OnboardingTaskId} from '../onboarding';
import {MmtEditorProvider} from '../mmtEditorProvider';
import {openUntitledGalleryMmt, openUntitledMmtWithContent} from '../untitledGalleryMmt';

export const SIMPLE_POST_MMT = `type: api
title: Simple POST
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello
`;

export const CHANGED_POST_MMT = `type: api
title: Simple POST
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello again
`;

export const VARIABLE_POST_MMT = `type: api
title: Request with a variable
url: <<e:base_url>>/echo
method: post
format: json
body:
  message: hello again
`;

export async function openSimplePostRequest(): Promise<vscode.Uri> {
  return openUntitledMmtWithContent(SIMPLE_POST_MMT, {
    suggestedName: 'post.mmt',
  });
}

export async function openVariablePostRequest(): Promise<vscode.Uri> {
  return openUntitledMmtWithContent(VARIABLE_POST_MMT, {
    suggestedName: 'variable.mmt',
  });
}

export default class StartPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multimeter.start';
  private view?: vscode.WebviewView;

  constructor(
      private readonly context: vscode.ExtensionContext,
      private readonly onboarding: OnboardingController,
  ) {}

  public resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken,
  ) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === 'ready') {
        this.pushState();
        return;
      }
      if (message?.type === 'showHow') {
        await this.showHow(message.step);
        return;
      }
    });
    const sub = this.onboarding.onChange(() => {
      this.pushState();
    });
    webviewView.onDidDispose(() => {
      sub.dispose();
    });
    this.pushState();
  }

  private async showHow(step: OnboardingTaskId): Promise<void> {
    const editor = MmtEditorProvider.getInstance();
    if (step === 'welcome') {
      this.onboarding.mark('welcome');
      return;
    }
    if (step === 'createFile') {
      await openUntitledGalleryMmt();
      this.onboarding.mark('createFile');
      return;
    }
    if (step === 'typePost') {
      const uri = editor?.getLastOpenedUri();
      if (uri) {
        await editor?.waitForOpened(uri);
        await this.replaceDocument(uri, SIMPLE_POST_MMT);
        return;
      }
      await openSimplePostRequest();
      return;
    }
    if (step === 'sendFirst') {
      const uri = editor?.getLastOpenedUri() || await openSimplePostRequest();
      await editor?.runOpenedDocument(uri);
      return;
    }
    if (step === 'changeBody') {
      const uri = editor?.getLastOpenedUri() || await openSimplePostRequest();
      await this.replaceDocument(uri, CHANGED_POST_MMT);
      return;
    }
    if (step === 'sendAgain') {
      const uri = editor?.getLastOpenedUri() || await openSimplePostRequest();
      await editor?.runOpenedDocument(uri);
      return;
    }
    if (step === 'saveFile') {
      await vscode.commands.executeCommand('workbench.action.files.save');
      return;
    }
    if (step === 'openBottomPanel') {
      await this.onboarding.revealEnvAndHistory();
      this.onboarding.mark('openBottomPanel');
      return;
    }
    if (step === 'createEnv') {
      await this.onboarding.revealEnvAndHistory();
      await new Promise(resolve => setTimeout(resolve, 250));
      await vscode.commands.executeCommand('multimeter.environment.startAdd');
      return;
    }
    if (step === 'useInSample') {
      const uri = editor?.getLastOpenedUri();
      if (uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        const next = document.getText().replace(
            /url:\s*(?:https:\/\/test\.mmt\.dev(?:\/echo)?|e:base_url\/echo)/,
            'url: <<e:base_url>>/echo');
        await this.replaceDocument(
            uri, next.includes('<<e:base_url>>') ? next : VARIABLE_POST_MMT);
        return;
      }
      await openVariablePostRequest();
      return;
    }
    if (step === 'sendWithEnv') {
      const uri = editor?.getLastOpenedUri() || await openVariablePostRequest();
      await editor?.runOpenedDocument(uri);
    }
  }

  private async replaceDocument(uri: vscode.Uri, content: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = MmtEditorProvider.getInstance();
    if (editor) {
      await editor.updateTextDocument(document, content, 'host');
      await new Promise(resolve => setTimeout(resolve, 350));
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, content);
    await vscode.workspace.applyEdit(edit);
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  private pushState(): void {
    if (!this.view) {
      return;
    }
    const snapshot = this.onboarding.snapshot();
    this.view.webview.postMessage({
      type: 'setState',
      state: {
        ...snapshot,
        illustrationUri: this.illustrationUri(snapshot.illustration),
      },
    });
  }

  private illustrationUri(fileName: string): string {
    if (!this.view || !fileName) {
      return '';
    }
    return this.view.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'res', 'start', fileName))
        .toString();
  }

  private getHtml(): string {
    const htmlPath = path.join(this.context.extensionPath, 'res', 'start.html');
    const cssPath = path.join(this.context.extensionPath, 'res', 'common.css');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');
    return html.replace('</head>', `<style>${css}</style></head>`);
  }
}
