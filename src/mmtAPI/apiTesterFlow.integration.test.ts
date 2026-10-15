/**
 * End-to-end API run flows across webview → extension host → core → network:
 *
 * - API Tester Send: webview asks the host for git, mints r:/c:, posts
 *   runCurrentDocument with resolvedRequest; core sends that snapshot as is.
 * - Glyph run: host runs the file; core mints r:/c: with its lazy git provider.
 *
 * Real pieces: extension handlers (`run.ts`, `file.ts`), core runner and HTTP
 * stack, a temp git repo, a local echo server. Mocked: VS Code UI and the
 * History panel. The webview side is loaded in an isolated module registry so
 * its `mmt-core` globals (git snapshot, token caches) are separate from the
 * host's, as they are in separate JS contexts at runtime.
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
      getConfiguration: () => ({get: (_name: string, defaultValue: any) => defaultValue}),
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
}));
jest.mock('../keepEditor', () => ({
  keepMmtEditor: async () => {},
  keepMmtEditorSoon: () => {},
}));
jest.mock('../onboarding', () => ({getOnboarding: () => undefined}));
jest.mock('./mockRunner', () => ({startMockServerFromPath: jest.fn()}));
jest.mock('./network', () => {
  const {DEFAULT_NETWORK_CONFIG} = jest.requireActual('mmt-core/NetworkData');
  return {
    prepareNetworkConfigForFile: () => DEFAULT_NETWORK_CONFIG,
    parseEnvFileForRun: () => undefined,
    resolveWorkspaceEnvFilePath: () => undefined,
  };
});

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

import {closeAllHttpConnections} from '../../core/src/networkCore';
import type {HistoryItem} from '../historyManager';
import {handleLoadDocumentContent, handleRequestGitSnapshot} from './file';
import {handleRunCurrentDocument} from './run';

type EchoRecord = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: http.IncomingHttpHeaders;
  body: string;
};

type WebviewModules = {
  send: typeof import('../../mmtview/src/api/apiTesterSend');
  parse: typeof import('../../core/src/apiParsePack');
  bodyEdit: typeof import('../../core/src/apiBodyEdit');
  current: typeof import('../../core/src/Current');
};

const BRANCH = 'feature/flow-test';
/** `token_url` is filled once the echo server port is known. */
const ENV: Record<string, string> = {host_tag: 'from-env'};
const INPUTS = {user: 'alice'};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** postMessage is structured-clone; JSON is close enough for these payloads. */
function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function git(cwd: string, args: string[]): string {
  return execFileSync(
      'git',
      ['-c', 'user.name=mmt', '-c', 'user.email=mmt@example.com',
       '-c', 'commit.gpgsign=false', ...args],
      {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})
      .trim();
}

/** Fresh webview JS context: separate mmt-core module state from the host. */
function loadWebview(): WebviewModules {
  let mods!: WebviewModules;
  jest.isolateModules(() => {
    mods = {
      send: require('../../mmtview/src/api/apiTesterSend'),
      parse: require('mmt-core/apiParsePack'),
      bodyEdit: require('mmt-core/apiBodyEdit'),
      current: require('mmt-core/Current'),
    };
  });
  return mods;
}

describe('API run flows (webview → host → core → echo server)', () => {
  let server: http.Server;
  let baseUrl = '';
  let echoed: EchoRecord[] = [];
  let tokenHits: EchoRecord[] = [];
  let repoDir = '';
  let commit = '';

  /** VS Code fakes for one open editor. */
  function openEditor(yaml: string, fileName = 'api.mmt', dir = repoDir) {
    const fsPath = path.join(dir, fileName);
    fs.writeFileSync(fsPath, yaml, 'utf8');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '--allow-empty', '-m', `open ${fileName}`]);
    if (dir === repoDir) {
      commit = git(repoDir, ['rev-parse', 'HEAD']);
    }

    const posted: any[] = [];
    const history: HistoryItem[] = [];
    const document = {
      uri: {fsPath, toString: () => `file://${fsPath}`},
      getText: () => fs.readFileSync(fsPath, 'utf8'),
    };
    const listeners: Array<(msg: any) => void> = [];
    const panel = {
      webview: {
        postMessage: (msg: any) => {
          const copy = clone(msg);
          posted.push(copy);
          listeners.forEach((fn) => fn(copy));
          return Promise.resolve(true);
        },
      },
    };
    const mmtProvider = {
      context: {
        workspaceState: {
          get: (key: string, defaultValue: any) =>
              key === 'multimeter.environment.storage' ?
              Object.entries(ENV).map(([name, value]) => ({name, value})) :
              defaultValue,
        },
      },
      historyManager: {add: (item: HistoryItem) => history.push(clone(item))},
      getEditorConfigMessage: () => ({command: 'editorConfig'}),
    };

    /** Webview → host request/response (same as vsAPI.requestGitSnapshot). */
    const requestGitSnapshot = async () => {
      const requestId = `git-${posted.length}`;
      const reply = new Promise<any>((resolve) => {
        listeners.push((msg) => {
          if (msg.command === 'gitSnapshotResult' && msg.requestId === requestId) {
            resolve(msg.snapshot);
          }
        });
      });
      handleRequestGitSnapshot(
          clone({command: 'requestGitSnapshot', requestId}),
          panel as any, document as any);
      return reply;
    };

    const runCurrentDocument = (message: Record<string, unknown>) =>
        handleRunCurrentDocument(
            clone(message), panel as any, document as any, mmtProvider);

    const loadDocument = () =>
        handleLoadDocumentContent(panel as any, document as any, mmtProvider);

    const apiResult = () =>
        posted.filter((m) => m.command === 'multimeter.api.run.result').pop();

    return {
      posted,
      history,
      requestGitSnapshot,
      runCurrentDocument,
      loadDocument,
      apiResult,
    };
  }

  /** Open the doc in a fresh webview the way App.tsx does. */
  async function openInWebview(editor: ReturnType<typeof openEditor>) {
    const webview = loadWebview();
    await editor.loadDocument();
    const loaded = editor.posted.find((m) => m.command === 'viewDocumentContent');
    expect(loaded).toBeDefined();
    webview.send.applyViewDocumentGitSnapshot(loaded);
    return {webview, content: loaded.content as string};
  }

  /** API Tester Send exactly as `handleSend` does for HTTP. */
  async function apiTesterSend(
      editor: ReturnType<typeof openEditor>, webview: WebviewModules, yaml: string) {
    const api = webview.parse.yamlToAPI(yaml);
    const {resolved, sendRequest} = await webview.send.prepareApiTesterSend(
        api, INPUTS, ENV, editor.requestGitSnapshot);
    await editor.runCurrentDocument(webview.send.buildApiTesterRunMessage({
      api,
      forSend: true,
      manualInputs: INPUTS,
      resolvedRequest: sendRequest,
    }));
    return {api, resolved, sendRequest};
  }

  /** Run glyph in the YAML editor (`useRunGlyphs`). */
  async function glyphRun(editor: ReturnType<typeof openEditor>) {
    await editor.runCurrentDocument({command: 'runCurrentDocument', inputs: {exampleIndex: -1}});
  }

  beforeAll(async () => {
    repoDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-flow-')));
    git(repoDir, ['init', '-q']);
    git(repoDir, ['checkout', '-q', '-b', BRANCH]);
    git(repoDir, ['commit', '-q', '--allow-empty', '-m', 'init']);

    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const url = new URL(req.url || '/', 'http://localhost');
        const record: EchoRecord = {
          method: String(req.method),
          path: url.pathname,
          query: Object.fromEntries(url.searchParams.entries()),
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        };
        res.writeHead(200, {'Content-Type': 'application/json'});
        if (record.path === '/token') {
          tokenHits.push(record);
          res.end(JSON.stringify({access_token: 'tok-flow', token_type: 'Bearer'}));
          return;
        }
        echoed.push(record);
        res.end(JSON.stringify(record));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    ENV.token_url = `${baseUrl}/token`;
  });

  beforeEach(() => {
    echoed = [];
    tokenHits = [];
  });

  afterEach(() => {
    closeAllHttpConnections();
  });

  afterAll(async () => {
    closeAllHttpConnections();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (repoDir) {
      fs.rmSync(repoDir, {recursive: true, force: true});
    }
  });

  function tokenApiYaml(): string {
    return [
      'type: api',
      'title: Flow',
      `url: ${baseUrl}/echo/<<i:user>>`,
      'method: post',
      'format: json',
      'inputs:',
      '  user: bob',
      'query:',
      '  branch: c:git_branch',
      'headers:',
      '  X-Id: r:uuid',
      '  X-Branch: c:git_branch',
      '  X-Env: e:host_tag',
      'body:',
      '  id: r:uuid',
      '  branch: c:git_branch',
      '  commit: c:git_commit',
      '  dirty: c:git_dirty',
      '  user: i:user',
      '  env: e:host_tag',
      '',
    ].join('\n');
  }

  describe('API Tester Send', () => {
    it('resolves c:git_* added after open (file had no git tokens at open)', async () => {
      const editor = openEditor(
          ['type: api', 'title: Flow', `url: ${baseUrl}/echo`, 'method: get', ''].join('\n'));
      const {webview} = await openInWebview(editor);
      // Open did not inject git (no git tokens yet) → webview snapshot is empty.
      expect(webview.current.currentValueForToken('git_branch')).toBe('');

      await apiTesterSend(editor, webview, tokenApiYaml());

      expect(echoed).toHaveLength(1);
      const body = JSON.parse(echoed[0].body);
      expect(body.branch).toBe(BRANCH);
      expect(body.commit).toBe(commit.slice(0, 8));
      expect(echoed[0].headers['x-branch']).toBe(BRANCH);
      expect(echoed[0].query.branch).toBe(BRANCH);
    });

    it('sends exactly the minted snapshot (no second remint in core)', async () => {
      const editor = openEditor(tokenApiYaml());
      const {webview} = await openInWebview(editor);
      const {resolved, sendRequest} = await apiTesterSend(editor, webview, tokenApiYaml());

      expect(echoed).toHaveLength(1);
      const wire = echoed[0];
      const wireBody = JSON.parse(wire.body);
      const sentBody = typeof sendRequest.body === 'string' ?
          JSON.parse(sendRequest.body) :
          sendRequest.body;

      expect(wireBody).toEqual(sentBody);
      expect(wireBody).toEqual({
        id: expect.stringMatching(UUID_RE),
        branch: BRANCH,
        commit: commit.slice(0, 8),
        dirty: false,
        user: 'alice',
        env: 'from-env',
      });
      expect(wire.method).toBe('POST');
      expect(wire.path).toBe('/echo/alice');
      expect(wire.headers['x-id']).toBe((resolved.headers as any)['X-Id']);
      expect(wire.headers['x-id']).toMatch(UUID_RE);
      expect(wire.headers['x-env']).toBe('from-env');
      expect(String(wire.headers['content-type'])).toMatch(/application\/json/);
    });

    it('telescope preview shows the values that went on the wire', async () => {
      const editor = openEditor(tokenApiYaml());
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, tokenApiYaml());

      const {projectTokenFieldPreview, tokenFieldPreviewScope} = webview.bodyEdit;
      const ctx = {env: ENV, inputs: INPUTS};
      expect(projectTokenFieldPreview(
                 '{{r:uuid}}', ctx, tokenFieldPreviewScope('headers', 'X-Id')).text)
          .toBe(echoed[0].headers['x-id']);
      expect(projectTokenFieldPreview(
                 '{{c:git_branch}}', ctx, tokenFieldPreviewScope('headers', 'X-Branch')).text)
          .toBe(BRANCH);
    });

    it('records send + recv in History matching the wire', async () => {
      const editor = openEditor(tokenApiYaml());
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, tokenApiYaml());

      expect(editor.history.map((h) => h.type)).toEqual(['send', 'recv']);
      const [sent, recv] = editor.history;
      expect(sent.method).toBe('POST');
      expect(sent.title).toBe(`${baseUrl}/echo/alice`);
      expect(JSON.parse(String(sent.content))).toEqual(JSON.parse(echoed[0].body));
      expect(sent.headers?.['X-Branch']).toBe(BRANCH);
      expect(recv.status).toBe(200);
      expect(JSON.parse(String(recv.content)).body).toBe(echoed[0].body);
    });

    it('posts the echo response to the Response panel', async () => {
      const editor = openEditor(tokenApiYaml());
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, tokenApiYaml());

      const result = editor.apiResult();
      expect(result).toBeDefined();
      expect(result.cancelled).toBe(false);
      expect(result.response.status).toBe(200);
      const echoedBack = typeof result.response.body === 'string' ?
          JSON.parse(result.response.body) :
          result.response.body;
      expect(echoedBack.body).toBe(echoed[0].body);
    });

    it('remints r: on every Send', async () => {
      const editor = openEditor(tokenApiYaml());
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, tokenApiYaml());
      await apiTesterSend(editor, webview, tokenApiYaml());

      expect(echoed).toHaveLength(2);
      expect(JSON.parse(echoed[0].body).id).not.toBe(JSON.parse(echoed[1].body).id);
      expect(JSON.parse(echoed[1].body).branch).toBe(BRANCH);
    });

    it('keeps the previous git snapshot when the host does not answer', async () => {
      const webview = loadWebview();
      webview.current.setGitCurrentSnapshot({branch: 'cached'});
      const api = webview.parse.yamlToAPI(tokenApiYaml());
      const {resolved} = await webview.send.prepareApiTesterSend(
          api, INPUTS, ENV, async () => null);
      expect((resolved.body as any).branch).toBe('cached');
    });

    it('does not ask the host for git when no git token is used', async () => {
      const webview = loadWebview();
      const requester = jest.fn(async () => ({branch: 'x'}));
      const api = webview.parse.yamlToAPI(
          ['type: api', `url: ${baseUrl}/echo`, 'method: post', 'body:', '  id: r:uuid', ''].join('\n'));
      await webview.send.prepareApiTesterSend(api, {}, {}, requester);
      expect(requester).not.toHaveBeenCalled();
    });

    it('reports network errors to History and the Response panel', async () => {
      const editor = openEditor(tokenApiYaml());
      const {webview} = await openInWebview(editor);
      const closed = http.createServer();
      await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
      const port = (closed.address() as any).port;
      await new Promise<void>((resolve) => closed.close(() => resolve()));

      const yaml = tokenApiYaml().replace(baseUrl, `http://127.0.0.1:${port}`);
      await apiTesterSend(editor, webview, yaml);

      expect(editor.history.map((h) => h.type)).toEqual(['send', 'error']);
      const result = editor.apiResult();
      expect(result.response.status).toBeLessThan(0);
    });
  });

  describe('glyph run', () => {
    it('resolves c:git_* through the host provider and skips History', async () => {
      const editor = openEditor(tokenApiYaml());
      await glyphRun(editor);

      expect(echoed).toHaveLength(1);
      const body = JSON.parse(echoed[0].body);
      expect(body).toEqual({
        id: expect.stringMatching(UUID_RE),
        branch: BRANCH,
        commit: commit.slice(0, 8),
        dirty: false,
        user: 'bob',
        env: 'from-env',
      });
      expect(echoed[0].path).toBe('/echo/bob');
      expect(echoed[0].headers['x-branch']).toBe(BRANCH);
      expect(editor.history).toEqual([]);
      expect(editor.apiResult().response.status).toBe(200);
    });

    it('concurrent runs in two panels both reach their Response panel', async () => {
      const first = openEditor(tokenApiYaml(), 'first.mmt');
      const second = openEditor(tokenApiYaml(), 'second.mmt');
      await Promise.all([glyphRun(first), glyphRun(second)]);

      expect(echoed).toHaveLength(2);
      expect(first.apiResult()?.response?.status).toBe(200);
      expect(second.apiResult()?.response?.status).toBe(200);
    });

    // Known issue: the git provider / snapshot is process-global, so the last
    // installGitCurrentSnapshotProvider wins for every overlapping run.
    // Flip to `it` once git is scoped per run.
    it.failing('concurrent runs from two repos each get their own branch', async () => {
      const otherRepo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-flow-other-')));
      try {
        git(otherRepo, ['init', '-q']);
        git(otherRepo, ['checkout', '-q', '-b', 'feature/other-repo']);
        const mine = openEditor(tokenApiYaml(), 'mine.mmt');
        const theirs = openEditor(tokenApiYaml(), 'theirs.mmt', otherRepo);
        await Promise.all([glyphRun(mine), glyphRun(theirs)]);

        const branches = echoed.map((r) => JSON.parse(r.body).branch).sort();
        expect(branches).toEqual(['feature/flow-test', 'feature/other-repo']);
      } finally {
        fs.rmSync(otherRepo, {recursive: true, force: true});
      }
    });

    it('sees a new branch on the next run (no stale snapshot)', async () => {
      const editor = openEditor(tokenApiYaml());
      await glyphRun(editor);
      git(repoDir, ['checkout', '-q', '-b', 'feature/second']);
      try {
        await glyphRun(editor);
      } finally {
        git(repoDir, ['checkout', '-q', BRANCH]);
      }
      expect(JSON.parse(echoed[0].body).branch).toBe(BRANCH);
      expect(JSON.parse(echoed[1].body).branch).toBe('feature/second');
    });
  });

  /**
   * Send and glyph build the request with different code (webview resolve vs
   * generated JS). Deterministic tokens only, so the wire must be identical.
   */
  describe('Send vs glyph parity', () => {
    const cases: Array<{
      name: string;
      lines: string[];
      files?: Record<string, string>;
      /** Extra wire checks so both paths cannot agree on a wrong request. */
      check?: (wire: EchoRecord) => void;
    }> = [
      {
        name: 'json body',
        lines: [
          'format: json',
          'body:',
          '  branch: c:git_branch',
          '  user: i:user',
          '  env: e:host_tag',
          '  n: 3',
          '  flag: true',
          '  nested:',
          '    list: [1, c:git_dirty]',
        ],
      },
      {
        name: 'urlencoded body',
        lines: [
          'format: urlencoded',
          'body:',
          '  branch: c:git_branch',
          '  user: i:user',
          '  env: e:host_tag',
        ],
      },
      {
        name: 'text body with embedded tokens',
        lines: [
          'format: text',
          'body: "branch=<<c:git_branch>> user=<<i:user>> env=<<e:host_tag>>"',
        ],
      },
      {
        name: 'get with query and headers',
        lines: [
          'method: get',
          'query:',
          '  branch: c:git_branch',
          '  user: i:user',
          'headers:',
          '  X-Branch: c:git_branch',
          '  X-Env: e:host_tag',
        ],
      },
      {
        name: 'xml body',
        lines: [
          'format: xml',
          'body: "<req><branch><<c:git_branch>></branch><user><<i:user>></user></req>"',
        ],
      },
      {
        name: 'html body',
        lines: [
          'format: html',
          'body: "<p><<c:git_branch>></p>"',
        ],
      },
      {
        name: 'user Content-Type wins over format',
        lines: [
          'format: urlencoded',
          'headers:',
          '  Content-Type: application/vnd.custom+form',
          'body:',
          '  branch: c:git_branch',
        ],
      },
      {
        name: 'binary body from file',
        files: {'payload.bin': 'raw-bytes-on-branch'},
        lines: [
          'format: binary',
          'headers:',
          '  X-Branch: c:git_branch',
          'body: payload.bin',
        ],
        check: (wire) => {
          expect(wire.body).toBe('raw-bytes-on-branch');
        },
      },
      {
        name: 'multipart with text and file parts',
        files: {'upload.txt': 'file-part-content'},
        lines: [
          'format: multipart',
          'body:',
          '  - name: branch',
          '    value: c:git_branch',
          '  - name: file',
          '    file: ./upload.txt',
        ],
        check: (wire) => {
          expect(String(wire.headers['content-type'])).toMatch(/^multipart\/form-data; boundary=/);
          expect(wire.body).toContain(BRANCH);
          expect(wire.body).toContain('file-part-content');
        },
      },
      {
        name: 'oauth2 client credentials',
        lines: [
          'method: get',
          'auth:',
          '  type: oauth2',
          '  grant: client_credentials',
          '  token_url: <<e:token_url>>',
          '  client_id: cid',
          '  client_secret: secret',
          'headers:',
          '  X-Branch: c:git_branch',
        ],
        check: (wire) => {
          expect(wire.headers.authorization).toBe('Bearer tok-flow');
          expect(tokenHits).toHaveLength(2);
        },
      },
      {
        name: 'bearer auth',
        lines: [
          'auth:',
          '  type: bearer',
          '  token: <<e:host_tag>>-<<c:git_branch>>',
          'format: json',
          'body:',
          '  user: i:user',
        ],
      },
      {
        name: 'basic auth',
        lines: [
          'auth:',
          '  type: basic',
          '  username: i:user',
          '  password: e:host_tag',
          'format: json',
          'body:',
          '  branch: c:git_branch',
        ],
      },
      {
        name: 'api-key auth in query',
        lines: [
          'method: get',
          'auth:',
          '  type: api-key',
          '  query: key',
          '  value: c:git_branch',
        ],
      },
    ];

    /** Drop per-connection headers; multipart boundaries are random per send. */
    function normalize(record: EchoRecord) {
      const {host, connection, ...headers} = record.headers;
      const boundary = /boundary=([^;\s]+)/.exec(String(headers['content-type'] || ''))?.[1];
      if (!boundary) {
        return {...record, headers};
      }
      return {
        ...record,
        headers: {
          ...headers,
          'content-type': String(headers['content-type']).split(boundary).join('BOUNDARY'),
        },
        body: record.body.split(boundary).join('BOUNDARY'),
      };
    }

    it.each(cases)('$name', async ({lines, files, check}) => {
      for (const [name, content] of Object.entries(files || {})) {
        fs.writeFileSync(path.join(repoDir, name), content, 'utf8');
      }
      const hasMethod = lines.some((l) => l.startsWith('method:'));
      const yaml = [
        'type: api',
        'title: Parity',
        `url: ${baseUrl}/parity`,
        ...(hasMethod ? [] : ['method: post']),
        'inputs:',
        '  user: alice',
        ...lines,
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);

      await apiTesterSend(editor, webview, yaml);
      await glyphRun(editor);

      expect(echoed).toHaveLength(2);
      expect(normalize(echoed[0])).toEqual(normalize(echoed[1]));
      check?.(echoed[0]);
      const wireText = echoed[0].body + JSON.stringify(echoed[0].query) +
          JSON.stringify(echoed[0].headers);
      expect(decodeURIComponent(wireText) + Buffer.from(
                 String(echoed[0].headers.authorization || '').replace(/^Basic /, ''),
                 'base64').toString())
          .toMatch(new RegExp(`${BRANCH}|raw-bytes`));
    });
  });
});
