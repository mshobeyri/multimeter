import {generateApiJs} from './runApi';

describe('runApi output printing', () => {
  it('omits details_ from Outputs section', async () => {
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
    expect(js).toContain("hasOwnProperty.call(copy, 'details_')");
    expect(js).toContain("copy.details_ = __mmt_raw('{...}')");
  });
});
