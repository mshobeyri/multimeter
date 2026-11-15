import * as vscode from 'vscode';
import {TelemetryReporter} from '@vscode/extension-telemetry';

import {TELEMETRY_CONNECTION_STRING} from './connectionString';
import {
  analyzeMmtFeatures,
  boolString,
  type FeatureFlags,
  type TelemetryFileType,
  withRuntimeInputs,
} from './features';

let reporter: TelemetryReporter|undefined;
let enabledBySetting = true;

function isExtensionTelemetryEnabled(): boolean {
  if (!enabledBySetting) {
    return false;
  }
  try {
    return vscode.env.isTelemetryEnabled;
  } catch {
    return false;
  }
}

function canSend(): boolean {
  return !!reporter && isExtensionTelemetryEnabled();
}

export function initTelemetry(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('multimeter');
  enabledBySetting = config.get<boolean>('telemetry.enabled', true);

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('multimeter.telemetry.enabled')) {
      enabledBySetting =
          vscode.workspace.getConfiguration('multimeter')
              .get<boolean>('telemetry.enabled', true);
    }
  }));

  const connectionString = (TELEMETRY_CONNECTION_STRING || '').trim();
  if (!connectionString) {
    return;
  }

  try {
    reporter = new TelemetryReporter(connectionString);
    context.subscriptions.push(reporter);
  } catch {
    reporter = undefined;
  }

  sendEvent('extension.activate');
}

export function sendEvent(
    eventName: string,
    properties?: Record<string, string>,
    measurements?: Record<string, number>,
): void {
  if (!canSend() || !reporter) {
    return;
  }
  try {
    reporter.sendTelemetryEvent(eventName, properties, measurements);
  } catch {
    // Never let telemetry break the extension.
  }
}

export function sendError(
    area: 'run'|'parse'|'network'|'convert'|'mcp'|'editor',
    code: string,
): void {
  sendEvent('error', {area, code: String(code || 'unknown').slice(0, 64)});
}

export function trackEditorOpen(rawFile: string): void {
  const flags = analyzeMmtFeatures(rawFile);
  sendEvent('editor.open', {fileType: flags.fileType});
}

function commonRunProps(flags: FeatureFlags, success: boolean):
    Record<string, string> {
  return {
    success: boolString(success),
    hasInputs: boolString(flags.hasInputs),
    hasEnv: boolString(flags.hasEnv),
    hasOutputs: boolString(flags.hasOutputs),
    complexity: flags.complexity,
  };
}

export function trackRunApi(params: {
  rawFile: string;
  success: boolean;
  durationMs?: number;
  manualInputs?: Record<string, unknown>|null;
}): void {
  const flags = withRuntimeInputs(
      analyzeMmtFeatures(params.rawFile), params.manualInputs);
  sendEvent(
      'run.api',
      {
        ...commonRunProps(flags, params.success),
        protocol: flags.protocol,
        hasBody: boolString(flags.hasBody),
        hasHeaders: boolString(flags.hasHeaders),
        hasQuery: boolString(flags.hasQuery),
        authKind: flags.authKind,
        extractKind: flags.extractKind,
      },
      typeof params.durationMs === 'number' && Number.isFinite(params.durationMs) ?
          {durationMs: Math.max(0, Math.round(params.durationMs))} :
          undefined,
  );
}

export function trackRunTest(params: {
  rawFile: string;
  success: boolean;
  durationMs?: number;
  manualInputs?: Record<string, unknown>|null;
}): void {
  const flags = withRuntimeInputs(
      analyzeMmtFeatures(params.rawFile), params.manualInputs);
  sendEvent(
      'run.test',
      {
        ...commonRunProps(flags, params.success),
        usesExpect: boolString(flags.usesExpect),
        usesCheck: boolString(flags.usesCheck),
        usesRandom: boolString(flags.usesRandom),
        usesCurrent: boolString(flags.usesCurrent),
        usesCapture: boolString(flags.usesCapture),
        usesImport: boolString(flags.usesImport),
        extractKind: flags.extractKind,
        assertCountBucket: flags.assertCountBucket,
        stepCountBucket: flags.stepCountBucket,
      },
      typeof params.durationMs === 'number' && Number.isFinite(params.durationMs) ?
          {durationMs: Math.max(0, Math.round(params.durationMs))} :
          undefined,
  );
}

export function trackRunSuite(params: {
  rawFile: string;
  success: boolean;
  durationMs?: number;
  partial: boolean;
}): void {
  const flags = analyzeMmtFeatures(params.rawFile);
  sendEvent(
      'run.suite',
      {
        ...commonRunProps(flags, params.success),
        partial: boolString(params.partial),
        itemCountBucket: flags.itemCountBucket,
      },
      typeof params.durationMs === 'number' && Number.isFinite(params.durationMs) ?
          {durationMs: Math.max(0, Math.round(params.durationMs))} :
          undefined,
  );
}

export function trackConvert(params: {
  direction: 'from_postman'|'from_openapi'|'to_postman';
  success: boolean;
}): void {
  sendEvent(`convert.${params.direction}`, {
    success: boolString(params.success),
  });
}

export function trackMcpTool(toolName: string, success: boolean): void {
  const allowed = new Set([
    'read_documentation',
    'list_examples',
    'discover_api',
    'api_card',
    'scaffold_test',
    'suggest_assertions',
    'validate',
    'format',
    'run',
  ]);
  const name = allowed.has(toolName) ? toolName : 'other';
  sendEvent('mcp.tool', {
    toolName: name,
    success: boolString(success),
  });
}

export function fileTypeFromRaw(rawFile: string): TelemetryFileType {
  return analyzeMmtFeatures(rawFile).fileType;
}
