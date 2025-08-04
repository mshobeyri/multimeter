/* filepath: /Users/mehrdad/projects/multimeter/src/EnvironmentPanel.ts */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface EnvironmentVar {
  name: string;
  label: string;
  value: string|number|boolean;
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

    // Add visibility change listener to refresh data when panel becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // Small delay to ensure webview is fully rendered
        setTimeout(() => {
          this.refreshEnvironmentVars();
        }, 100);
      }
    });

    // Initial load
    this.refreshEnvironmentVars();
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
    const environmentVars = this.getWorkspaceEnvironmentVars();
    this.view?.webview.postMessage(
        {type: 'updateEnvironmentVars', data: environmentVars});
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

  public updateEnvironmentVars(vars: EnvironmentVar[]) {
    this.view?.webview.postMessage({type: 'updateEnvironmentVars', data: vars});
  }

  public addEnvironmentVar(envVar: EnvironmentVar) {
    const currentVars = this.getStoredEnvironmentVars();
    currentVars[envVar.name] = envVar.value;

    this.saveEnvironmentVars(currentVars);
  }

  public removeEnvironmentVar(name: string) {
    const currentVars = this.getStoredEnvironmentVars();
    delete currentVars[name];

    this.saveEnvironmentVars(currentVars);
  }

  private getStoredEnvironmentVars(): Record<string, any> {
    return this.context.workspaceState.get<Record<string, any>>(
        'multimeter.environment.storage', {});
  }

  private async saveEnvironmentVars(vars: Record<string, any>) {
    try {
      await this.context.workspaceState.update(
          'multimeter.environment.storage', vars);
      this.refreshEnvironmentVars();
    } catch (error) {
      vscode.window.showErrorMessage(
          `Failed to save environment variables: ${error}`);
    }
  }

  // Method to get all environment variables as a record (useful for other parts
  // of the extension)
  public getEnvironmentVariables(): Record<string, any> {
    return this.getStoredEnvironmentVars();
  }

  // Method to set a single environment variable
  public async setEnvironmentVariable(name: string, value: any) {
    const currentVars = this.getStoredEnvironmentVars();
    currentVars[name] = value;
    await this.saveEnvironmentVars(currentVars);
  }

  // Method to get a single environment variable
  public getEnvironmentVariable(name: string): any {
    const vars = this.getStoredEnvironmentVars();
    return vars[name];
  }
}