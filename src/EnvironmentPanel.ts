/* filepath: /Users/mehrdad/projects/multimeter/src/EnvironmentPanel.ts */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface EnvironmentVar {
  name: string;
  label: string;
  value: string|number|boolean;
  options: {label: string; value: string | number | boolean}[];
}

export default class EnvironmentPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multimeter.environment';
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      token: vscode.CancellationToken,
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview();


    // Refresh environment variables when the we open the view
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        setTimeout(() => {
          this.refreshEnvironmentVars();
        }, 100);
      }
    });
    
    // Refresh environment variables when reload window
    this.refreshEnvironmentVars();

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'multimeter.environment.set': {
          const environmentVars = this.getWorkspaceEnvironmentVars();
          const idx = environmentVars.findIndex(v => v.name === message.name);
          if (idx !== -1) {
            environmentVars[idx].value = message.value;
            environmentVars[idx].label = message.label;
            await this.context.workspaceState.update(
                'multimeter.environment.storage', environmentVars);
            await vscode.commands.executeCommand('multimeter.environment.refresh');
          }
        }
      }
    });
  }

  private getHtmlForWebview(): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'src', 'environment.html');
    const cssPath = path.join(this.context.extensionPath, 'src', 'common.css');

    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Inject CSS into HTML head
    html = html.replace('</head>', `<style>${css}</style></head>`);

    return html;
  }

  refreshEnvironmentVars() {
    console.log("refressssss");
    const environmentVars = this.getWorkspaceEnvironmentVars();
    this.view?.webview.postMessage({
      command: 'multimeter.environment.panel.refresh',
      data: environmentVars
    });
  }

  private getWorkspaceEnvironmentVars(): EnvironmentVar[] {
    try {
      // Get environment variables from workspace storage
      const storedVars = this.context.workspaceState.get<Record<string, any>>(
          'multimeter.environment.storage', {});

      // Convert stored variables to EnvironmentVar array
      const environmentVars: EnvironmentVar[] =
          Object.entries(storedVars).map(([name, value]) => {
            return value;
          });

      return environmentVars.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error(
          'Failed to load environment variables from workspace storage:',
          error);
      return [];
    }
  }

  async clearEnvironments() {
    try {
      const result = await vscode.window.showWarningMessage(
          'Are you sure you want to clear all environment variables?',
          {modal: true}, 'Clear All', 'Cancel');

      if (result === 'Clear All') {
        // Clear from workspace storage
        await this.context.workspaceState.update(
            'multimeter.environment.storage', {});

        vscode.window.showInformationMessage('Environment variables cleared');
        this.refreshEnvironmentVars();
      }
    } catch (error) {
      vscode.window.showErrorMessage(
          `Failed to clear environment variables: ${error}`);
    }
  }
}