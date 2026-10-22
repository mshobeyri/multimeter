/**
 * Thin host contract: history / resolvedRequest gating and Response panel post.
 * Runner is mocked — real HTTP lives in core/src/runner/runApi.local.test.ts.
 */
jest.mock('vscode', () => {
  const channel = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    appendLine: () => {},
    show: () => {},
  };
  return {
    window: {
      createOutputChannel: () => channel,
      showErrorMessage: jest.fn(async () => undefined),
      showInformationMessage: jest.fn(async () => undefined),
      showWarningMessage: jest.fn(async () => undefined),
      activeColorTheme: {kind: 2},
    },
    workspace: {
      getConfiguration: () => ({get: (_n: string, d: any) => d}),
      workspaceFolders: [],
    },
    commands: {executeCommand: jest.fn(async () => undefined)},
    extensions: {all: []},
    ColorThemeKind: {Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4},
    ViewColumn: {Active: -1, Beside: -2},
    Uri: {
      file: (fsPath: string) => ({fsPath, toString: () => `file://${fsPath}`}),
    },
  };
}, {virtual: true});

jest.mock('../runStatusBar', () => ({
  onRunStarted: () => 'status-run',
  onRunFinished: () => {},
  setRunPaused: () => {},
}));
jest.mock('../keepEditor', () => ({
  keepMmtEditor: async () => {},
  keepMmtEditorSoon: () => {},
}));
jest.mock('../onboarding', () => ({getOnboarding: () => undefined}));
jest.mock('./mockRunner', () => ({startMockServerFromPath: jest.fn()}));
jest.mock('./network', () => {
  const {DEFAULT_NETWORK_CONFIG} = jest.requireActual('mmt-core/data/NetworkData');
  return {
    prepareNetworkConfigForFile: () => DEFAULT_NETWORK_CONFIG,
    parseEnvFileForRun: () => undefined,
    resolveWorkspaceEnvFilePath: () => undefined,
  };
});
jest.mock('./gitCommitShort', () => ({
  installGitCurrentSnapshotProvider: () => {},
}));

const mockRunJSCode = jest.fn();
jest.mock('mmt-core/runner/jsRunner', () => ({
  runJSCode: (...args: any[]) => mockRunJSCode(...args),
  setRunnerNetworkConfig: jest.fn(),
}));

const mockRunFile = jest.fn();
jest.mock('mmt-core', () => {
  const actual = jest.requireActual('mmt-core');
  return {
    ...actual,
    runner: {
      ...actual.runner,
      runFile: (...args: any[]) => mockRunFile(...args),
    },
  };
});

import {handleRunCurrentDocument} from './run';

const SAMPLE_OUTPUTS = {
  _: {
    status: 200,
    body: '{"ok":true}',
    headers: {'content-type': 'application/json'},
    details: JSON.stringify({
      request: {url: 'https://local.mmt.dev/echo', method: 'get'},
      response: {
        status: 200,
        statusText: 'OK',
        body: '{"ok":true}',
        headers: {'content-type': 'application/json'},
        duration: 7,
      },
    }),
  },
};

describe('handleRunCurrentDocument history / resolvedRequest gate', () => {
  const historyAdd = jest.fn();
  const posted: any[] = [];

  function fixtures(yaml = 'type: api\nurl: https://local.mmt.dev/echo\nmethod: get\n') {
    const document = {
      uri: {fsPath: '/tmp/gate.mmt', toString: () => 'file:///tmp/gate.mmt'},
      getText: () => yaml,
    };
    const panel = {
      webview: {
        postMessage: (msg: any) => {
          posted.push(JSON.parse(JSON.stringify(msg)));
          return Promise.resolve(true);
        },
      },
    };
    const mmtProvider = {
      context: {workspaceState: {get: (_k: string, d: any) => d}},
      historyManager: {add: historyAdd},
    };
    return {document, panel, mmtProvider};
  }

  beforeEach(() => {
    posted.length = 0;
    historyAdd.mockReset();
    mockRunJSCode.mockReset();
    mockRunFile.mockReset();

    mockRunJSCode.mockImplementation(async (ctx: any) => {
      // Surface override so assertions can read it from the last call.
      return SAMPLE_OUTPUTS;
    });

    mockRunFile.mockImplementation(async (opts: any) => {
      // Drive the host's jsRunner wrapper (captures requestOverride into runJSCode).
      const outputs = await opts.jsRunner({
        runId: 'gate-run',
        js: '/* unused */',
        title: 'Gate',
        logger: () => {},
      });
      opts.reporter?.({
        scope: 'network-request',
        request: {
          url: 'https://local.mmt.dev/echo',
          method: 'get',
          protocol: 'http',
        },
      });
      opts.reporter?.({
        scope: 'network-response',
        request: {
          url: 'https://local.mmt.dev/echo',
          method: 'get',
          protocol: 'http',
        },
        response: {
          status: 200,
          statusText: 'OK',
          body: '{"ok":true}',
          headers: {'content-type': 'application/json'},
          duration: 7,
        },
      });
      return {
        docType: 'api',
        displayName: 'Gate',
        result: {
          success: true,
          durationMs: 7,
          errors: [],
          logs: [],
          outputs,
        },
      };
    });
  });

  it('Send (history + resolvedRequest) passes requestOverride and records History',
     async () => {
       const {document, panel, mmtProvider} = fixtures();
       const resolvedRequest = {
         url: 'https://local.mmt.dev/echo',
         method: 'get',
         protocol: 'http',
         headers: {'X-Send': '1'},
       };

       await handleRunCurrentDocument(
           {
             command: 'runCurrentDocument',
             history: true,
             resolvedRequest,
             rawFile: document.getText(),
             inputs: {exampleIndex: -1, manualInputs: {}},
             report: {type: 'lifecycle'},
           },
           panel as any, document as any, mmtProvider);

       expect(mockRunJSCode).toHaveBeenCalled();
       const jsCtx = mockRunJSCode.mock.calls[0][0];
       expect(jsCtx.requestOverride).toEqual(resolvedRequest);

       expect(historyAdd).toHaveBeenCalled();
       expect(historyAdd.mock.calls.some(
                  (c) => c[0]?.type === 'send' || c[0]?.type === 'recv'))
           .toBe(true);

       const resultMsg =
           posted.find((m) => m.command === 'multimeter.api.run.result');
       expect(resultMsg).toBeDefined();
       expect(resultMsg.cancelled).toBe(false);
       expect(resultMsg.response.status).toBe(200);
       expect(resultMsg.response.body).toBe('{"ok":true}');
       expect(resultMsg.response.duration).toBe(7);
     });

  it('glyph (no history) skips History and does not pass requestOverride',
     async () => {
       const {document, panel, mmtProvider} = fixtures();

       await handleRunCurrentDocument(
           {
             command: 'runCurrentDocument',
             // glyph: no history flag, no resolvedRequest
             inputs: {exampleIndex: -1},
             report: {type: 'lifecycle'},
           },
           panel as any, document as any, mmtProvider);

       const jsCtx = mockRunJSCode.mock.calls[0][0];
       expect(jsCtx.requestOverride).toBeNull();
       expect(historyAdd).not.toHaveBeenCalled();

       const resultMsg =
           posted.find((m) => m.command === 'multimeter.api.run.result');
       expect(resultMsg).toBeDefined();
       expect(resultMsg.response.status).toBe(200);
     });

  it('history without resolvedRequest does not invent an override', async () => {
    const {document, panel, mmtProvider} = fixtures();

    await handleRunCurrentDocument(
        {
          command: 'runCurrentDocument',
          history: true,
          inputs: {exampleIndex: -1, manualInputs: {}},
          report: {type: 'lifecycle'},
        },
        panel as any, document as any, mmtProvider);

    expect(mockRunJSCode.mock.calls[0][0].requestOverride).toBeNull();
    expect(historyAdd).toHaveBeenCalled();
  });
});
