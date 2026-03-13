import {generateApiJs} from './runApi';

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
});
