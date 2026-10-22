/**
 * End-to-end API run flows across webview → extension host → core → network:
 *
 * - API Tester Send: webview asks the host for git, mints r:/c:, posts
 *   runCurrentDocument with resolvedRequest; core sends that snapshot as is.
 * - Glyph run: host runs the file; core mints r:/c: with its lazy git provider.
 *
 * Real pieces: extension handlers (`run.ts`, `file.ts`), core runner and HTTP
 * stack, a temp git repo, and in-process `https://local.mmt.dev` (no sockets).
 * Mocked: VS Code UI and the History panel. The webview side is loaded in an
 * isolated module registry so its `mmt-core` globals (git snapshot, token
 * caches) are separate from the host's, as they are in separate JS contexts
 * at runtime.
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
  const {DEFAULT_NETWORK_CONFIG} = jest.requireActual('mmt-core/data/NetworkData');
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

import {
  onLocalTestServerRequest,
} from '../../core/src/network/localTestServer';
import {closeAllHttpConnections} from '../../core/src/network/networkCore';
import type {HistoryItem} from '../historyManager';
import {handleLoadDocumentContent, handleRequestGitSnapshot} from './file';
import {handleRunCurrentDocument} from './run';

/** In-process test host — see core/src/network/localTestServer.ts. */
const BASE_URL = 'https://local.mmt.dev';

type EchoRecord = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string|string[]|undefined>;
  body: string;
};

type WebviewModules = {
  send: typeof import('../../mmtview/src/api/apiTesterSend');
  parse: typeof import('../../core/src/parse/apiParsePack');
  bodyEdit: typeof import('../../core/src/api-edit/apiBodyEdit');
  current: typeof import('../../core/src/tokens/Current');
};

const BRANCH = 'feature/flow-test';
const ENV: Record<string, string> = {
  host_tag: 'from-env',
  token_url: `${BASE_URL}/token`,
};
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
      parse: require('mmt-core/parse/apiParsePack'),
      bodyEdit: require('mmt-core/api-edit/apiBodyEdit'),
      current: require('mmt-core/tokens/Current'),
    };
  });
  return mods;
}

describe('API run flows (webview → host → core → local.mmt.dev)', () => {
  let baseUrl = BASE_URL;
  let echoed: EchoRecord[] = [];
  let tokenHits: EchoRecord[] = [];
  let repoDir = '';
  let commit = '';
  let stopObserving: (() => void)|undefined;

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
      editor: ReturnType<typeof openEditor>,
      webview: WebviewModules,
      yaml: string,
      manualInputs: Record<string, any> = INPUTS,
      ) {
    const api = webview.parse.yamlToAPI(yaml);
    // Match the tester: currentInputs starts as a clone of api.inputs (token
    // defaults like r:uuid stay literal until mint), then manual overlays win.
    const inputs: Record<string, any> = {...(api.inputs || {}), ...manualInputs};
    const {resolved, sendRequest} = await webview.send.prepareApiTesterSend(
        api, inputs, ENV, editor.requestGitSnapshot);
    await editor.runCurrentDocument(webview.send.buildApiTesterRunMessage({
      api,
      forSend: true,
      manualInputs: inputs,
      resolvedRequest: sendRequest,
    }));
    return {api, resolved, sendRequest, inputs};
  }

  /** Run glyph in the YAML editor (`useRunGlyphs`). */
  async function glyphRun(editor: ReturnType<typeof openEditor>) {
    await editor.runCurrentDocument({command: 'runCurrentDocument', inputs: {exampleIndex: -1}});
  }

  beforeAll(() => {
    repoDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-flow-')));
    git(repoDir, ['init', '-q']);
    git(repoDir, ['checkout', '-q', '-b', BRANCH]);
    git(repoDir, ['commit', '-q', '--allow-empty', '-m', 'init']);
  });

  beforeEach(() => {
    echoed = [];
    tokenHits = [];
    stopObserving = onLocalTestServerRequest((info) => {
      const record: EchoRecord = {
        method: info.method,
        path: info.path,
        query: info.query,
        headers: info.headers,
        body: info.body,
      };
      const bare = info.path.replace(/\/+$/, '') || '/';
      if (bare === '/token') {
        tokenHits.push(record);
        return;
      }
      echoed.push(record);
    });
  });

  afterEach(() => {
    stopObserving?.();
    stopObserving = undefined;
    closeAllHttpConnections();
  });

  afterAll(() => {
    closeAllHttpConnections();
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
      '  branch: c:branch',
      'headers:',
      '  X-Id: r:uuid',
      '  X-Branch: c:branch',
      '  X-Env: e:host_tag',
      'body:',
      '  id: r:uuid',
      '  branch: c:branch',
      '  commit: c:commit',
      '  dirty: c:git_dirty',
      '  user: i:user',
      '  env: e:host_tag',
      '',
    ].join('\n');
  }

  describe('API Tester Send', () => {
    it('resolves git c: tokens added after open (file had no git tokens at open)', async () => {
      const editor = openEditor(
          ['type: api', 'title: Flow', `url: ${baseUrl}/echo`, 'method: get', ''].join('\n'));
      const {webview} = await openInWebview(editor);
      // Open did not inject git (no git tokens yet) → webview snapshot is empty.
      expect(webview.current.currentValueForToken('branch')).toBe('');

      await apiTesterSend(editor, webview, tokenApiYaml());

      expect(echoed).toHaveLength(1);
      const body = JSON.parse(echoed[0].body);
      expect(body.branch).toBe(BRANCH);
      expect(body.commit).toBe(commit);
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
        commit: commit,
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
                 '{{c:branch}}', ctx, tokenFieldPreviewScope('headers', 'X-Branch')).text)
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
      expect(JSON.parse(String(recv.content)).body).toEqual(JSON.parse(echoed[0].body));
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
      expect(echoedBack.body).toEqual(JSON.parse(echoed[0].body));
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

  /**
   * History + Response panel should mirror the YAML → resolved request → wire
   * path for bodies, headers, query, cookies, and auth — not just a happy-path
   * smoke check on the default token API.
   */
  describe('History and Response from YAML shapes', () => {
    it('records query, cookies, headers, and JSON body on History send', async () => {
      const yaml = [
        'type: api',
        'title: History fields',
        `url: ${baseUrl}/echo`,
        'method: post',
        'format: json',
        'inputs:',
        '  user: alice',
        'query:',
        '  q: i:user',
        '  branch: c:branch',
        'cookies:',
        '  session: i:user',
        'headers:',
        '  X-User: i:user',
        '  X-Branch: c:branch',
        'body:',
        '  user: i:user',
        '  branch: c:branch',
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, yaml);

      expect(echoed).toHaveLength(1);
      expect(echoed[0].query).toEqual({q: 'alice', branch: BRANCH});
      expect(echoed[0].headers['x-user']).toBe('alice');
      expect(String(echoed[0].headers.cookie || '')).toMatch(/session=alice/);

      expect(editor.history.map((h) => h.type)).toEqual(['send', 'recv']);
      const [sent, recv] = editor.history;
      expect(sent.query).toEqual({q: 'alice', branch: BRANCH});
      expect(sent.cookies).toEqual({session: 'alice'});
      expect(sent.headers?.['X-User']).toBe('alice');
      expect(sent.headers?.['X-Branch']).toBe(BRANCH);
      expect(JSON.parse(String(sent.content))).toEqual({
        user: 'alice',
        branch: BRANCH,
      });
      expect(recv.status).toBe(200);
      expect(recv.headers?.['content-type'] || recv.headers?.['Content-Type'])
          .toMatch(/application\/json/i);
    });

    it('keeps GET History content empty while query still appears', async () => {
      const yaml = [
        'type: api',
        `url: ${baseUrl}/echo`,
        'method: get',
        'query:',
        '  branch: c:branch',
        'headers:',
        '  X-Branch: c:branch',
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, yaml);

      expect(echoed[0].method).toBe('GET');
      expect(echoed[0].query.branch).toBe(BRANCH);
      const [sent] = editor.history;
      expect(sent.method).toBe('GET');
      expect(sent.content).toBe('');
      expect(sent.query).toEqual({branch: BRANCH});
      expect(sent.headers?.['X-Branch']).toBe(BRANCH);
    });

    it('records urlencoded and xml bodies in History as sent on the wire', async () => {
      const urlencoded = [
        'type: api',
        `url: ${baseUrl}/echo`,
        'method: post',
        'format: urlencoded',
        'body:',
        '  branch: c:branch',
        '  user: i:user',
        '',
      ].join('\n');
      const xml = [
        'type: api',
        `url: ${baseUrl}/echo`,
        'method: post',
        'format: xml',
        'body: "<req><branch><<c:branch>></branch><user><<i:user>></user></req>"',
        '',
      ].join('\n');

      const formEditor = openEditor(urlencoded, 'form.mmt');
      const {webview: formWebview} = await openInWebview(formEditor);
      await apiTesterSend(formEditor, formWebview, urlencoded);
      expect(formEditor.history[0].content).toBe(echoed[0].body);
      expect(String(formEditor.history[0].content)).toContain(`branch=${encodeURIComponent(BRANCH)}`);

      const xmlEditor = openEditor(xml, 'xml.mmt');
      const {webview: xmlWebview} = await openInWebview(xmlEditor);
      await apiTesterSend(xmlEditor, xmlWebview, xml);
      expect(xmlEditor.history[0].content).toBe(echoed[1].body);
      expect(String(xmlEditor.history[0].content)).toContain(`<branch>${BRANCH}</branch>`);
      expect(String(xmlEditor.history[0].content)).toContain('<user>alice</user>');
    });

    it('keeps Authorization on History send for bearer auth (unmasked)', async () => {
      const yaml = [
        'type: api',
        `url: ${baseUrl}/echo`,
        'method: post',
        'auth:',
        '  type: bearer',
        '  token: <<e:host_tag>>-<<c:branch>>',
        'format: json',
        'body:',
        '  user: i:user',
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, yaml);

      const expected = `Bearer from-env-${BRANCH}`;
      expect(echoed[0].headers.authorization).toBe(expected);
      expect(editor.history[0].headers?.Authorization ||
             editor.history[0].headers?.authorization)
          .toBe(expected);
    });

    it('records only the primary request for oauth2 (token fetch not in History)', async () => {
      const yaml = [
        'type: api',
        `url: ${baseUrl}/echo`,
        'method: get',
        'auth:',
        '  type: oauth2',
        '  grant: client_credentials',
        '  token_url: <<e:token_url>>',
        '  client_id: cid',
        '  client_secret: secret',
        'headers:',
        '  X-Branch: c:branch',
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, yaml);

      expect(tokenHits).toHaveLength(1);
      expect(echoed).toHaveLength(1);
      expect(echoed[0].headers.authorization).toBe('Bearer tok-local');
      expect(editor.history.map((h) => h.type)).toEqual(['send', 'recv']);
      expect(editor.history[0].title).toBe(`${baseUrl}/echo`);
      expect(editor.history[0].headers?.Authorization ||
             editor.history[0].headers?.authorization)
          .toBe('Bearer tok-local');
    });

    it('surfaces response headers and Set-Cookie cookies in the Response panel', async () => {
      const yaml = [
        'type: api',
        `url: ${baseUrl}/with-cookie`,
        'method: get',
        'headers:',
        '  X-Branch: c:branch',
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, yaml);

      const result = editor.apiResult();
      expect(result.response.status).toBe(200);
      expect(result.response.headers['x-echo-method'] ||
             result.response.headers['X-Echo-Method'])
          .toBe('GET');
      // Parsed cookies come from Set-Cookie (first name=value per header entry).
      expect(result.response.cookies.session).toBe('flow-sid');
      const setCookie = result.response.headers['set-cookie'] ??
          result.response.headers['Set-Cookie'];
      expect(setCookie).toBeDefined();
      expect(JSON.stringify(setCookie)).toMatch(/theme=dark/);
      expect(editor.history[1].type).toBe('recv');
      expect(editor.history[1].headers?.['x-echo-method'] ||
             editor.history[1].headers?.['X-Echo-Method'])
          .toBe('GET');
    });

    it('glyph run still skips History while Response panel is filled', async () => {
      const yaml = [
        'type: api',
        `url: ${baseUrl}/echo`,
        'method: post',
        'format: json',
        'body:',
        '  branch: c:branch',
        '',
      ].join('\n');
      const editor = openEditor(yaml);
      await glyphRun(editor);

      expect(editor.history).toEqual([]);
      const result = editor.apiResult();
      expect(result.response.status).toBe(200);
      const echoedBack = typeof result.response.body === 'string' ?
          JSON.parse(result.response.body) :
          result.response.body;
      expect(echoedBack.body.branch).toBe(BRANCH);
    });
  });

  /**
   * Token matrix: direct r:/c:/e:, and inputs whose defaults are themselves
   * r:/c:/e: (referenced via i:). History + wire must agree field-by-field.
   */
  describe('token resolution on History and wire', () => {
    function tokenMatrixYaml(): string {
      return [
        'type: api',
        'title: Tokens',
        `url: ${baseUrl}/echo/<<i:user>>`,
        'method: post',
        'format: json',
        'inputs:',
        '  user: guest',
        '  req_id: r:uuid',
        '  branch: c:branch',
        '  host: e:host_tag',
        '  label: "<<i:host>>/<<i:user>>"',
        'query:',
        '  rid: i:req_id',
        '  branch: i:branch',
        '  env: e:host_tag',
        'headers:',
        '  X-Req: i:req_id',
        '  X-Branch: i:branch',
        '  X-Host: i:host',
        '  X-Label: i:label',
        '  X-Direct-R: r:uuid',
        '  X-Direct-C: c:branch',
        '  X-Direct-E: e:host_tag',
        'body:',
        '  req_id: i:req_id',
        '  branch: i:branch',
        '  host: i:host',
        '  label: i:label',
        '  user: i:user',
        '  direct_r: r:uuid',
        '  direct_c: c:commit',
        '  direct_e: e:host_tag',
        '  nested: "id=<<i:req_id>> env=<<e:host_tag>> branch=<<c:branch>>"',
        '',
      ].join('\n');
    }

    it('Send: e:/c: via i: stay consistent; r: via i: remints per reference', async () => {
      const yaml = tokenMatrixYaml();
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      // Overlay only `user` — leave r:/c:/e: input defaults literal like the UI.
      const {resolved} = await apiTesterSend(editor, webview, yaml, {user: 'alice'});

      expect(echoed).toHaveLength(1);
      const wire = echoed[0];
      const body = JSON.parse(wire.body);
      const sent = editor.history[0];
      const histBody = JSON.parse(String(sent.content));

      // Manual / plain input
      expect(wire.path).toBe('/echo/alice');
      expect(body.user).toBe('alice');

      // i: → e: and i: → c: resolve once to the same concrete value everywhere
      expect(body.host).toBe('from-env');
      expect(body.branch).toBe(BRANCH);
      expect(body.label).toBe('from-env/alice');
      expect(wire.headers['x-host']).toBe(body.host);
      expect(wire.headers['x-branch']).toBe(body.branch);
      expect(wire.headers['x-label']).toBe(body.label);
      expect(wire.query.env).toBe('from-env');
      expect(wire.query.branch).toBe(BRANCH);

      // Direct e:/c: match the i:-chained values
      expect(wire.headers['x-direct-e']).toBe('from-env');
      expect(wire.headers['x-direct-c']).toBe(BRANCH);
      expect(body.direct_e).toBe('from-env');
      expect(body.direct_c).toBe(commit);

      // i: → r: is reminted per reference on Send (r: is not cached). Each
      // occurrence is a UUID, but header/query/body need not match each other.
      expect(body.req_id).toMatch(UUID_RE);
      expect(wire.headers['x-req']).toMatch(UUID_RE);
      expect(wire.query.rid).toMatch(UUID_RE);
      expect(wire.headers['x-direct-r']).toMatch(UUID_RE);
      expect(body.direct_r).toMatch(UUID_RE);
      expect(body.nested).toMatch(
          new RegExp(`^id=${UUID_RE.source.slice(1, -1)} env=from-env branch=${BRANCH}$`));

      // Snapshot + History mirror the wire field-by-field
      expect(histBody).toEqual(body);
      expect(sent.query).toEqual(wire.query);
      expect(sent.headers?.['X-Host']).toBe('from-env');
      expect(sent.headers?.['X-Branch']).toBe(BRANCH);
      expect(sent.headers?.['X-Req']).toBe(wire.headers['x-req']);
      expect(sent.headers?.['X-Direct-R']).toBe(wire.headers['x-direct-r']);
      expect((resolved.body as any).req_id).toBe(body.req_id);
      expect((resolved.headers as any)['X-Req']).toBe(wire.headers['x-req']);

      // Telescope tips for reminted r:/c: (and env) match the wire snapshot.
      const {projectTokenFieldPreview, tokenFieldPreviewScope} = webview.bodyEdit;
      const ctx = {env: ENV, inputs: {user: 'alice', host: 'from-env', branch: BRANCH}};
      expect(projectTokenFieldPreview(
                 '{{c:branch}}', ctx,
                 tokenFieldPreviewScope('headers', 'X-Direct-C')).text)
          .toBe(BRANCH);
      expect(projectTokenFieldPreview(
                 '{{e:host_tag}}', ctx,
                 tokenFieldPreviewScope('headers', 'X-Direct-E')).text)
          .toBe('from-env');
      expect(projectTokenFieldPreview(
                 '{{r:uuid}}', ctx,
                 tokenFieldPreviewScope('headers', 'X-Direct-R')).text)
          .toBe(wire.headers['x-direct-r']);
      expect(projectTokenFieldPreview(
                 '{{i:host}}', ctx,
                 tokenFieldPreviewScope('headers', 'X-Host')).text)
          .toBe('from-env');
    });

    it('Send remints r: (direct and via i:) on every Send', async () => {
      const yaml = tokenMatrixYaml();
      const editor = openEditor(yaml);
      const {webview} = await openInWebview(editor);
      await apiTesterSend(editor, webview, yaml, {user: 'alice'});
      await apiTesterSend(editor, webview, yaml, {user: 'alice'});

      expect(echoed).toHaveLength(2);
      const first = JSON.parse(echoed[0].body);
      const second = JSON.parse(echoed[1].body);
      expect(first.req_id).not.toBe(second.req_id);
      expect(first.direct_r).not.toBe(second.direct_r);
      expect(echoed[0].headers['x-req']).not.toBe(echoed[1].headers['x-req']);
      // Stable tokens stay put across Send
      expect(second.branch).toBe(BRANCH);
      expect(second.host).toBe('from-env');
      expect(second.user).toBe('alice');
    });

    it('glyph materializes input r: once so every i:ref shares the same UUID', async () => {
      const yaml = tokenMatrixYaml();
      const editor = openEditor(yaml);
      await glyphRun(editor);

      expect(echoed).toHaveLength(1);
      const wire = echoed[0];
      const body = JSON.parse(wire.body);

      // Glyph uses file defaults (user: guest), not the Send manual overlay.
      expect(wire.path).toBe('/echo/guest');
      expect(body.user).toBe('guest');
      expect(body.host).toBe('from-env');
      expect(body.branch).toBe(BRANCH);
      expect(body.label).toBe('from-env/guest');

      // Core resolveInputsMap expands r:uuid once → all i:req_id agree.
      expect(body.req_id).toMatch(UUID_RE);
      expect(wire.headers['x-req']).toBe(body.req_id);
      expect(wire.query.rid).toBe(body.req_id);
      expect(body.nested.startsWith(`id=${body.req_id} `)).toBe(true);

      // Direct r: in the request is still a separate mint from the input default.
      expect(body.direct_r).toMatch(UUID_RE);
      expect(wire.headers['x-direct-r']).toMatch(UUID_RE);

      expect(editor.history).toEqual([]);
      expect(editor.apiResult().response.status).toBe(200);
    });
  });



  describe('glyph run', () => {
    it('resolves git c: tokens through the host provider and skips History', async () => {
      const editor = openEditor(tokenApiYaml());
      await glyphRun(editor);

      expect(echoed).toHaveLength(1);
      const body = JSON.parse(echoed[0].body);
      expect(body).toEqual({
        id: expect.stringMatching(UUID_RE),
        branch: BRANCH,
        commit: commit,
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
          '  branch: c:branch',
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
          '  branch: c:branch',
          '  user: i:user',
          '  env: e:host_tag',
        ],
      },
      {
        name: 'text body with embedded tokens',
        lines: [
          'format: text',
          'body: "branch=<<c:branch>> user=<<i:user>> env=<<e:host_tag>>"',
        ],
      },
      {
        name: 'get with query and headers',
        lines: [
          'method: get',
          'query:',
          '  branch: c:branch',
          '  user: i:user',
          'headers:',
          '  X-Branch: c:branch',
          '  X-Env: e:host_tag',
        ],
      },
      {
        name: 'xml body',
        lines: [
          'format: xml',
          'body: "<req><branch><<c:branch>></branch><user><<i:user>></user></req>"',
        ],
      },
      {
        name: 'html body',
        lines: [
          'format: html',
          'body: "<p><<c:branch>></p>"',
        ],
      },
      {
        name: 'user Content-Type wins over format',
        lines: [
          'format: urlencoded',
          'headers:',
          '  Content-Type: application/vnd.custom+form',
          'body:',
          '  branch: c:branch',
        ],
      },
      {
        name: 'binary body from file',
        files: {'payload.bin': 'raw-bytes-on-branch'},
        lines: [
          'format: binary',
          'headers:',
          '  X-Branch: c:branch',
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
          '    value: c:branch',
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
          '  X-Branch: c:branch',
        ],
        check: (wire) => {
          expect(wire.headers.authorization).toBe('Bearer tok-local');
          expect(tokenHits).toHaveLength(2);
        },
      },
      {
        name: 'bearer auth',
        lines: [
          'auth:',
          '  type: bearer',
          '  token: <<e:host_tag>>-<<c:branch>>',
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
          '  branch: c:branch',
        ],
      },
      {
        name: 'api-key auth in query',
        lines: [
          'method: get',
          'auth:',
          '  type: api-key',
          '  query: key',
          '  value: c:branch',
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
