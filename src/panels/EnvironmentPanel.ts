import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export type EnvVarSource = 'file' | 'manual' | 'runtime';

export interface EnvironmentVar {
  name: string;
  label: string;
  value: string|number|boolean;
  options: {label: string; value: string | number | boolean}[];
  source?: EnvVarSource;
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


    this.refreshEnvironmentVars();

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        setTimeout(() => {
          this.refreshEnvironmentVars();
        }, 100);
      }
    });

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
            environmentVars[idx].source = parseEnvVarSource(message.source) ??
                environmentVars[idx].source ?? 'file';
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
          const scope = message.scope === 'runtime' || message.scope === 'manual' ||
                  message.scope === 'all' ?
              message.scope :
              'all';
          await this.clearEnvironments(scope);
          await vscode.commands.executeCommand('multimeter.environment.refresh');
          break;
        }
        case 'multimeter.environment.add': {
          const name = typeof message.name === 'string' ? message.name.trim() : '';
          if (!name) {
            break;
          }
          const environmentVars = this.getWorkspaceEnvironmentVars();
          const existing = environmentVars.find(v => v.name === name);
          if (existing) {
            vscode.window.showWarningMessage(
                `Environment variable "${name}" already exists.`);
            break;
          }
          const newVar: EnvironmentVar = {
            name,
            label: 'Manual',
            value: message.value ?? '',
            options: [],
            source: 'manual'
          };
          environmentVars.push(newVar);
          await this.context.workspaceState.update(
              'multimeter.environment.storage', environmentVars);
          await vscode.commands.executeCommand('multimeter.environment.refresh');
          this.refreshEnvironmentVars();
          break;
        }
        case 'multimeter.environment.delete': {
          const name = typeof message.name === 'string' ? message.name : '';
          if (!name) {
            break;
          }
          const environmentVars = this.getWorkspaceEnvironmentVars();
          const idx = environmentVars.findIndex(v => v.name === name);
          if (idx !== -1) {
            environmentVars.splice(idx, 1);
            await this.context.workspaceState.update(
                'multimeter.environment.storage', environmentVars);
            await vscode.commands.executeCommand('multimeter.environment.refresh');
            this.refreshEnvironmentVars();
          }
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

    html = html.replace('</head>', `<style>${css}</style></head>`);

    return html;
  }

  startAddVariable(): void {
    const send = () => {
      this.view?.webview.postMessage({
        command: 'multimeter.environment.startAdd',
      });
    };
    send();
    setTimeout(send, 200);
    setTimeout(send, 500);
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
      // Preserve storage order: env-file vars first (YAML order), then manual adds.
      const storedVars = this.context.workspaceState.get<EnvironmentVar[]|Record<string, any>>(
          'multimeter.environment.storage', []);

      const raw = Array.isArray(storedVars) ?
          storedVars :
          Object.values(storedVars || {});
      return raw.map(normalizeEnvironmentVar);
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

  async clearEnvironments(scope: 'runtime'|'manual'|'all' = 'all') {
    try {
      if (scope === 'all') {
        const result = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all environment variables?',
            {modal: true}, 'Clear All', 'Cancel');

        if (result !== 'Clear All') {
          return;
        }

        await this.context.workspaceState.update(
            'multimeter.environment.storage', {});
        await this.context.workspaceState.update(
            'multimeter.environment.presets', {});

        vscode.window.showInformationMessage('Environment variables cleared');
        this.refreshEnvironmentVars();
        return;
      }

      const label = scope === 'runtime' ? 'runtime' : 'manual';
      const confirmLabel = scope === 'runtime' ?
          'Clear runtime variables' :
          'Clear manual variable';
      const result = await vscode.window.showWarningMessage(
          `Are you sure you want to clear ${label} environment variables?`,
          {modal: true}, confirmLabel, 'Cancel');

      if (result !== confirmLabel) {
        return;
      }

      const environmentVars = this.getWorkspaceEnvironmentVars();
      const remaining = environmentVars.filter(
          v => resolveEnvVarSource(v) !== scope);
      await this.context.workspaceState.update(
          'multimeter.environment.storage', remaining);
      vscode.window.showInformationMessage(
          scope === 'runtime' ? 'Runtime variables cleared' :
                                'Manual variables cleared');
      this.refreshEnvironmentVars();
    } catch (error) {
      vscode.window.showErrorMessage(
          `Failed to clear environment variables: ${error}`);
    }
  }
}

function parseEnvVarSource(value: unknown): EnvVarSource|undefined {
  if (value === 'file' || value === 'manual' || value === 'runtime') {
    return value;
  }
  return undefined;
}

function normalizeEnvironmentVar(raw: any): EnvironmentVar {
  const source = parseEnvVarSource(raw?.source) ??
      (raw?.isManual === true ? 'manual' : undefined) ??
      inferLegacyEnvVarSource(raw);
  return {
    name: typeof raw?.name === 'string' ? raw.name : String(raw?.name ?? ''),
    label: typeof raw?.label === 'string' ? raw.label : String(raw?.label ?? ''),
    value: raw?.value,
    options: Array.isArray(raw?.options) ? raw.options : [],
    source,
  };
}

function inferLegacyEnvVarSource(envVar: any): EnvVarSource {
  const label = typeof envVar?.label === 'string' ? envVar.label : '';
  if ((!Array.isArray(envVar?.options) || envVar.options.length === 0) &&
      (label === 'api' || label === 'test' || label.startsWith('api - ') ||
       label.startsWith('test - '))) {
    return 'runtime';
  }
  return 'file';
}

function resolveEnvVarSource(envVar: EnvironmentVar): EnvVarSource {
  return parseEnvVarSource(envVar.source) ?? inferLegacyEnvVarSource(envVar);
}