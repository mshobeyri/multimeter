import {APIData} from './APIData';
import {
  buildApiDetailsSummary,
  scaffoldTestFromApi,
  suggestAliasFromPath,
  suggestTestPath,
} from './testScaffold';
import {validateTestData} from './testParsePack';

const loginApi: APIData = {
  type: 'api',
  title: 'Login',
  description: 'Authenticates a user and returns a session token',
  inputs: {
    username: 'alice@example.com',
    password: 'secret123',
  },
  outputs: {
    token: 'body.body.token',
    user_id: 'body.body.user_id',
  },
  url: 'https://test.mmt.dev/echo',
  method: 'post',
  format: 'json',
  body: {
    username: 'i:username',
    password: 'i:password',
  },
};

describe('testScaffold', () => {
  it('suggests alias and test path from api file path', () => {
    expect(suggestAliasFromPath('apis/login.mmt')).toBe('login');
    expect(suggestTestPath('apis/login.mmt')).toBe('./tests/login-smoke.mmt');
  });

  it('builds api details summary with import path', () => {
    const summary = buildApiDetailsSummary('apis/login.mmt', loginApi);
    expect(summary.suggestedAlias).toBe('login');
    expect(summary.suggestedTestPath).toBe('./tests/login-smoke.mmt');
    expect(summary.suggestedImportPath).toBe('../apis/login.mmt');
    expect(summary.outputs?.token).toBe('body.body.token');
  });

  it('scaffolds a valid smoke test from api data', () => {
    const test = scaffoldTestFromApi(loginApi, {
      alias: 'login',
      importPath: '../apis/login.mmt',
    });
    expect(test.type).toBe('test');
    expect(test.import?.login).toBe('../apis/login.mmt');
    expect(test.steps?.[0]).toMatchObject({
      call: 'login',
      id: 'iLogin',
      inputs: {
        username: 'i:username',
        password: 'i:password',
      },
      expect: {
        status: 200,
        token: '!= null',
        user_id: '!= null',
      },
    });
    expect(validateTestData(test)).toEqual([]);
  });

  it('uses first example inputs when strategy is example', () => {
    const api: APIData = {
      ...loginApi,
      examples: [{
        name: 'Valid User',
        inputs: {
          username: 'john@example.com',
          password: 'secret',
        },
      }],
    };
    const test = scaffoldTestFromApi(api, {
      alias: 'login',
      importPath: '../apis/login.mmt',
      strategy: 'example',
    });
    expect(test.inputs).toEqual({
      username: 'john@example.com',
      password: 'secret',
    });
    expect(validateTestData(test)).toEqual([]);
  });
});
