import {
  applyViewDocumentGitSnapshot,
  buildApiTesterRunMessage,
  buildYamlRawFile,
  prepareApiTesterSend,
  refreshGitSnapshotFor,
} from './apiTesterSend';
import {
  getGitCurrentSnapshot,
  setGitCurrentSnapshot,
} from 'mmt-core/tokens/Current';
import type {APIData} from 'mmt-core/data/APIData';

describe('buildYamlRawFile', () => {
  it('infers POST when HTTP method is missing and body is present', () => {
    const yaml = buildYamlRawFile({
      type: 'api',
      url: 'https://local.mmt.dev/echo',
      format: 'json',
      body: {a: 1},
    } as APIData);
    expect(yaml).toMatch(/method:\s*post/i);
    expect(yaml).toContain('https://local.mmt.dev/echo');
  });

  it('keeps an explicit GET method', () => {
    const yaml = buildYamlRawFile({
      type: 'api',
      url: 'https://local.mmt.dev/echo',
      method: 'get',
    } as APIData);
    expect(yaml).toMatch(/method:\s*get/i);
  });
});

describe('buildApiTesterRunMessage', () => {
  const api = {
    type: 'api',
    url: 'https://local.mmt.dev/echo',
    method: 'get',
  } as APIData;

  it('sets history and resolvedRequest only for Send (forSend)', () => {
    const resolvedRequest = {
      url: 'https://local.mmt.dev/echo',
      method: 'get',
      protocol: 'http',
    };
    const sendMsg = buildApiTesterRunMessage({
      api,
      forSend: true,
      manualInputs: {user: 'alice'},
      resolvedRequest: resolvedRequest as any,
      exampleIndex: 2,
    });
    expect(sendMsg.command).toBe('runCurrentDocument');
    expect(sendMsg.history).toBe(true);
    expect(sendMsg.resolvedRequest).toEqual(resolvedRequest);
    expect(sendMsg.inputs).toEqual({
      exampleIndex: 2,
      manualInputs: {user: 'alice'},
    });
    expect(typeof sendMsg.rawFile).toBe('string');
    expect(String(sendMsg.rawFile)).toContain('local.mmt.dev');
  });

  it('omits history and resolvedRequest for glyph / Run in Core', () => {
    const glyphMsg = buildApiTesterRunMessage({
      api,
      forSend: false,
      manualInputs: {},
      resolvedRequest: {
        url: 'https://local.mmt.dev/echo',
        method: 'get',
      } as any,
    });
    expect(glyphMsg.history).toBe(false);
    expect(glyphMsg.resolvedRequest).toBeUndefined();
  });
});

describe('refreshGitSnapshotFor / applyViewDocumentGitSnapshot', () => {
  afterEach(() => {
    setGitCurrentSnapshot(undefined);
  });

  it('applyViewDocumentGitSnapshot sets or clears the cache', () => {
    applyViewDocumentGitSnapshot({
      gitSnapshot: {branch: 'main', commit: 'abcdef01'},
    });
    expect(getGitCurrentSnapshot()).toEqual({
      branch: 'main',
      commit: 'abcdef01',
    });

    applyViewDocumentGitSnapshot({});
    expect(getGitCurrentSnapshot()).toBeUndefined();
  });

  it('skips the host when YAML has no c:git_* tokens', async () => {
    const requester = jest.fn(async () => ({branch: 'x'}));
    await refreshGitSnapshotFor(
        {
          type: 'api',
          url: 'https://local.mmt.dev/echo',
          method: 'get',
          body: {id: 'r:uuid'},
        } as APIData,
        requester);
    expect(requester).not.toHaveBeenCalled();
  });

  it('asks the host when c:git_branch is present and applies the snapshot',
     async () => {
       const requester = jest.fn(async () => ({
         branch: 'feature/gate',
         commit: 'deadbeef',
       }));
       await refreshGitSnapshotFor(
           {
             type: 'api',
             url: 'https://local.mmt.dev/echo',
             method: 'get',
             headers: {'X-Branch': 'c:git_branch'},
           } as APIData,
           requester);
       expect(requester).toHaveBeenCalledTimes(1);
       expect(getGitCurrentSnapshot()?.branch).toBe('feature/gate');
     });

  it('keeps the previous snapshot when the host times out (null)', async () => {
    setGitCurrentSnapshot({branch: 'cached', commit: '11111111'});
    const requester = jest.fn(async () => null);
    await refreshGitSnapshotFor(
        {
          type: 'api',
          url: 'https://local.mmt.dev/echo',
          headers: {'X-Branch': 'c:git_branch'},
        } as APIData,
        requester);
    expect(getGitCurrentSnapshot()?.branch).toBe('cached');
  });
});

describe('prepareApiTesterSend', () => {
  afterEach(() => {
    setGitCurrentSnapshot(undefined);
  });

  it('refreshes git then mints a send request', async () => {
    setGitCurrentSnapshot({branch: 'prep', commit: 'abcdef12'});
    const {resolved, sendRequest} = await prepareApiTesterSend(
        {
          type: 'api',
          url: 'https://local.mmt.dev/echo',
          method: 'post',
          format: 'json',
          headers: {'X-Branch': 'c:git_branch'},
          body: {branch: 'c:git_branch'},
        } as APIData,
        {},
        {},
        async () => ({branch: 'prep', commit: 'abcdef12'}),
    );
    expect(sendRequest.url).toContain('local.mmt.dev');
    expect(String((resolved.headers as any)?.['X-Branch'] || '')).toBe('prep');
  });
});
