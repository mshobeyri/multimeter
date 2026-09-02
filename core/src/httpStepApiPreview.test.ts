import {
  buildApiPreviewFromHttpStep,
  collectInputsForHttpStep,
  findHttpStepAtPosition,
  httpStepApiPreviewYamlAtPosition,
  httpStepToApiPreviewYaml,
  pickExpectExampleValue,
  resolveOutputNameForExpectField,
  suggestHttpStepApiFilename,
} from './httpStepApiPreview';
import {yamlToAPI} from './apiParsePack';
import {TestFlowHttp} from './TestData';

describe('httpStepApiPreview', () => {
  test('maps http step fields into a type: api document', () => {
    const step: TestFlowHttp = {
      http: 'https://test.mmt.dev/echo',
      title: 'Send an echo request',
      method: 'post',
      headers: {'Content-Type': 'application/json'},
      body: {message: 'hello world'},
      expect: {
        status: 200,
        'body.body.message': 'hello world',
      },
    };

    const api = buildApiPreviewFromHttpStep(step);
    expect(api.type).toBe('api');
    expect(api.title).toBe('Send an echo request');
    expect(api.url).toBe('https://test.mmt.dev/echo');
    expect(api.method).toBe('post');
    expect(api.headers).toEqual({'Content-Type': 'application/json'});
    expect(api.body).toEqual({message: 'hello world'});
    expect(api.outputs).toEqual({
      status: 'status',
      'body.body.message': 'body.body.message',
    });
    expect(api.examples).toEqual([{
      name: 'Send an echo request',
      outputs: {
        status: 200,
        'body.body.message': 'hello world',
      },
    }]);
  });

  test('preserves operator expect values as example RHS (match both sides)', () => {
    const step: TestFlowHttp = {
      http: 'https://example.com/users/1',
      method: 'get',
      expect: {
        status: 200,
        'body.name': '!= null',
        'body.role': '=* /admin/',
      },
    };
    const api = buildApiPreviewFromHttpStep(step);
    expect(api.outputs).toEqual({
      status: 'status',
      'body.name': 'body.name',
      'body.role': 'body.role',
    });
    expect(api.examples?.[0].outputs).toEqual({
      status: 200,
      'body.name': '!= null',
      'body.role': '=* /admin/',
    });
  });

  test('reuses named step outputs for expect fields with matching paths', () => {
    const step: TestFlowHttp = {
      http: 'https://example.com/login',
      method: 'post',
      outputs: {
        token: 'body.token',
      },
      expect: {
        status: 200,
        'body.token': '*',
      },
    };
    const api = buildApiPreviewFromHttpStep(step);
    expect(api.outputs).toEqual({
      token: 'body.token',
      status: 'status',
    });
    expect(api.examples?.[0].outputs).toEqual({
      status: 200,
      token: '*',
    });
  });

  test('leaves e: tokens as-is and copies i: refs into inputs with defaults', () => {
    const step: TestFlowHttp = {
      http: '<<e:api_url>>/users/<<i:userId>>',
      method: 'get',
      headers: {
        Authorization: 'Bearer <<e:token>>',
        'X-User': 'i:userId',
      },
      body: {
        note: 'hello <<i:message>>',
      },
      expect: {status: 200},
    };
    const api = buildApiPreviewFromHttpStep(step, {
      testInputs: {
        userId: 'u-42',
        message: 'hi',
        unused: 'nope',
      },
    });
    expect(api.url).toBe('<<e:api_url>>/users/<<i:userId>>');
    expect(api.headers?.Authorization).toBe('Bearer <<e:token>>');
    expect(api.inputs).toEqual({
      userId: 'u-42',
      message: 'hi',
    });
    expect(api.examples?.[0].inputs).toEqual({
      userId: 'u-42',
      message: 'hi',
    });
  });

  test('declares empty string default when i: ref has no test input', () => {
    const step: TestFlowHttp = {
      http: 'https://example.com/<<i:missing>>',
      method: 'get',
    };
    expect(collectInputsForHttpStep(step, {})).toEqual({missing: ''});
  });

  test('defaults method to get when omitted and no body', () => {
    const api = buildApiPreviewFromHttpStep({
      http: 'https://example.com',
    });
    expect(api.method).toBe('get');
  });

  test('defaults method to post when body is present', () => {
    const api = buildApiPreviewFromHttpStep({
      http: 'https://example.com',
      body: {message: 'hello'},
    });
    expect(api.method).toBe('post');
  });

  test('omits examples when there is no expect map', () => {
    const api = buildApiPreviewFromHttpStep({
      http: 'https://example.com',
      method: 'get',
      outputs: {status: 'status'},
    });
    expect(api.outputs).toEqual({status: 'status'});
    expect(api.examples).toBeUndefined();
  });

  test('pickExpectExampleValue uses first array entry', () => {
    expect(pickExpectExampleValue(['!= 201', '!* 1.*'])).toBe('!= 201');
    expect(pickExpectExampleValue(200)).toBe(200);
  });

  test('resolveOutputNameForExpectField prefers matching named output', () => {
    expect(resolveOutputNameForExpectField(
               {msg: 'body.message', status: 'status'}, 'body.message'))
        .toBe('msg');
    expect(resolveOutputNameForExpectField({status: 'status'}, 'body.message'))
        .toBe('body.message');
  });

  test('httpStepToApiPreviewYaml round-trips through api parser', () => {
    const yaml = httpStepToApiPreviewYaml({
      http: 'https://test.mmt.dev/echo',
      title: 'Echo',
      method: 'post',
      body: {message: 'hello'},
      expect: {
        status: 200,
        'body.body.message': 'hello',
      },
    });
    expect(yaml).toContain('type: api');
    expect(yaml).toContain('url: https://test.mmt.dev/echo');
    expect(yaml).toContain('status: 200');
    const api = yamlToAPI(yaml);
    expect(api.method).toBe('post');
    expect(api.examples?.[0].outputs?.status).toBe(200);
  });

  test('suggestHttpStepApiFilename sanitizes id/title', () => {
    expect(suggestHttpStepApiFilename({http: 'x', id: 'Get User!'}))
        .toBe('get-user.mmt');
    expect(suggestHttpStepApiFilename({http: 'x'})).toBe('http-step.mmt');
  });

  test('findHttpStepAtPosition hits the http URL value', () => {
    const content = [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    method: post',
      '    expect:',
      '      status: 200',
    ].join('\n');
    const hit = findHttpStepAtPosition(content, 3, 12);
    expect(hit).not.toBeNull();
    expect(hit!.step.http).toBe('https://test.mmt.dev/echo');
    expect(hit!.step.method).toBe('post');
    expect(hit!.urlLine).toBe(3);
  });

  test('findHttpStepAtPosition returns null outside the URL', () => {
    const content = [
      'type: test',
      'steps:',
      '  - http: https://test.mmt.dev/echo',
      '    method: post',
    ].join('\n');
    expect(findHttpStepAtPosition(content, 4, 8)).toBeNull();
    expect(findHttpStepAtPosition(content, 1, 1)).toBeNull();
  });

  test('httpStepApiPreviewYamlAtPosition includes test input defaults for i:', () => {
    const content = [
      'type: test',
      'inputs:',
      '  userId: u-9',
      'steps:',
      '  - http: https://example.com/users/<<i:userId>>',
      '    method: get',
      '    headers:',
      '      Authorization: Bearer <<e:token>>',
      '    expect:',
      '      status: 200',
      '      body.name: != null',
    ].join('\n');
    const yaml = httpStepApiPreviewYamlAtPosition(content, 5, 20);
    expect(yaml).toBeTruthy();
    expect(yaml!).toContain('type: api');
    expect(yaml!).toContain('userId: u-9');
    expect(yaml!).toContain('<<e:token>>');
    expect(yaml!).toContain('<<i:userId>>');
    expect(yaml!).toContain('!= null');
    const api = yamlToAPI(yaml!);
    expect(api.inputs).toEqual({userId: 'u-9'});
    expect(api.examples?.[0].outputs?.['body.name']).toBe('!= null');
  });

  test('finds nested http steps under if/steps', () => {
    const content = [
      'type: test',
      'steps:',
      '  - if: "1 == 1"',
      '    steps:',
      '      - http: https://nested.example/ok',
      '        method: get',
    ].join('\n');
    const hit = findHttpStepAtPosition(content, 5, 18);
    expect(hit?.step.http).toBe('https://nested.example/ok');
  });
});
