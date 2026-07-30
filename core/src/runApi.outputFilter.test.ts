import {generateApiJs} from './runApi';
import {extractOutputs} from './outputExtractor';
import {applyOmitToRequest_} from './testHelper';

describe('runApi output printing', () => {
  it('logs Outputs section in generated API JS', async () => {
    const js = await generateApiJs({
      api: {
        type: 'api',
        title: 'x',
        requests: [],
      } as any,
      name: 'test_api',
      envVars: {},
      inputs: {},
      fileLoader: async () => '',
    });

    expect(js).toContain("console.log(__mmt_formatSection('Outputs:', __outputLog))");
    // _ internal properties are auto-injected but filtered from the output log
    expect(js).toContain("delete copy['_']");
  });

  it('logs only explicit outputs and allows overriding body', async () => {
    const js = await generateApiJs({
      api: {
        type: 'api',
        title: 'Echo API',
        description: 'Posts a message and echoes it back',
        inputs: {
          message: 'hello world',
        },
        outputs: {
          echoed_message: 'body.body.message',
          body: 'body.body.message',
        },
        url: 'https://test.mmt.dev/echo',
        method: 'post',
        format: 'json',
        body: {
          message: 'i:message',
        },
      } as any,
      name: 'echo_api',
      envVars: {},
      inputs: {message: 'hello world'},
      fileLoader: async () => '',
    });
    const logs: string[] = [];
    const consoleMock = {
      debug: () => {},
      error: () => {},
      log: (message: string) => logs.push(String(message)),
      warn: () => {},
    };
    const send = async () => ({
      body: {body: {message: 'hello world'}},
      headers: {'content-type': 'application/json'},
      cookies: {session: 'abc'},
      status: 200,
      duration: 12,
    });
    const execute = new Function(
      'send_',
      'extractOutputs_',
      'console',
      'applyOmitToRequest_',
      `const protocolFromUrl_ = () => 'http';\n${js}`,
    );

    const result =
        await execute(send, extractOutputs, consoleMock, applyOmitToRequest_);
    const outputLog = logs.find(log => log.includes('Outputs:')) || '';

    expect(result.body).toBe('hello world');
    expect(result.echoed_message).toBe('hello world');
    expect(result.headers).toBeUndefined();
    expect(result._.body).toEqual({body: {message: 'hello world'}});
    expect(result._.status).toBe(200);
    expect(result._.headers).toEqual({'content-type': 'application/json'});
    expect(outputLog).toMatch(/echoed_message:\s+"hello world"/);
    expect(outputLog).toMatch(/body:\s+"hello world"/);
    expect(outputLog).not.toContain('headers:');
    expect(outputLog).not.toContain('cookies:');
    expect(outputLog).not.toContain('status:');
    expect(outputLog).not.toContain('duration:');
  });
});
