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
    // details_ is no longer auto-added; only user-defined outputs are present
    expect(js).not.toContain("details_");
    expect(js).not.toContain("statusCode_");
  });
});
