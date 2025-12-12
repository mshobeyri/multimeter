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
        case 'refresh': {
          this.refreshEnvironmentVars();
          break;
        }
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
          break;
        }
        case 'multimeter.environment.applyPreset': {
          const presetName = typeof message.presetName === 'string' ? message.presetName : '';
          const envName = typeof message.envName === 'string' ? message.envName : '';
          if (!presetName || !envName) {
            break;
          }
          await this.applyPreset(presetName, envName);
          break;
        }
        case 'multimeter.environment.clear': {
          await this.clearEnvironments();
          await vscode.commands.executeCommand('multimeter.environment.refresh');
          break;
        }
      }
    });
  }

  private getHtmlForWebview(): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'environment.html');
    const cssPath = path.join(this.context.extensionPath, 'res', 'common.css');

    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Inject CSS into HTML head
    html = html.replace('</head>', `<style>${css}</style></head>`);

    return html;
  }

  refreshEnvironmentVars() {
    const environmentVars = this.getWorkspaceEnvironmentVars();
    const presets = this.getWorkspaceEnvironmentPresets();
    this.view?.webview.postMessage({
      command: 'multimeter.environment.panel.refresh',
      data: environmentVars,
      presets,
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

  private getWorkspaceEnvironmentPresets(): Record<string, any> {
    try {
      const presets = this.context.workspaceState.get<Record<string, any>>(
          'multimeter.environment.presets', {});
      return presets || {};
    } catch (error) {
      console.error(
          'Failed to load environment presets from workspace storage:',
          error);
      return {};
    }
  }

  private async applyPreset(presetName: string, envName: string) {
    const presets = this.getWorkspaceEnvironmentPresets();
    const presetGroup = presets?.[presetName];
    if (!presetGroup) {
      vscode.window.showWarningMessage(
          `Preset "${presetName}" was not found.`);
      return;
    }
    const mapping = presetGroup?.[envName];
    if (!mapping || typeof mapping !== 'object') {
      vscode.window.showWarningMessage(
          `Preset option "${envName}" was not found for ${presetName}.`);
      return;
    }

    const environmentVars = this.getWorkspaceEnvironmentVars();
    let updated = false;
    const normalizedMapping = mapping as Record<string, any>;
    for (const variable of environmentVars) {
      if (!Object.prototype.hasOwnProperty.call(normalizedMapping, variable.name)) {
        continue;
      }
      const desired = normalizedMapping[variable.name];
      const options = Array.isArray(variable.options) ? variable.options : [];
      const match = options.find(opt => {
        const label = typeof opt.label === 'string' ? opt.label : String(opt.label);
        const value =
            typeof opt.value === 'string' || typeof opt.value === 'number' ||
                typeof opt.value === 'boolean' ? opt.value : String(opt.value);
        if (typeof desired === 'string') {
          return label === desired || String(value) === desired;
        }
        return value === desired;
      });
      if (match) {
        if (variable.value !== match.value || variable.label !== match.label) {
          variable.value = match.value;
          variable.label = match.label;
          updated = true;
        }
      } else if (typeof desired !== 'undefined') {
        if (variable.value !== desired) {
          variable.value = desired;
          variable.label = String(desired);
          updated = true;
        }
      }
    }

    if (!updated) {
      return;
    }

    await this.context.workspaceState.update(
        'multimeter.environment.storage', environmentVars);
    await vscode.commands.executeCommand('multimeter.environment.refresh');
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
        await this.context.workspaceState.update(
            'multimeter.environment.presets', {});

        vscode.window.showInformationMessage('Environment variables cleared');
        this.refreshEnvironmentVars();
      }
    } catch (error) {
      vscode.window.showErrorMessage(
          `Failed to clear environment variables: ${error}`);
    }
  }
}