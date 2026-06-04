jest.mock('axios/dist/node/axios.cjs', () => ({
  request: jest.fn(),
}));

import {DEFAULT_NETWORK_CONFIG} from './NetworkData';
import {sendHttpRequest} from './networkCore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios/dist/node/axios.cjs');

describe('networkCore request timeout', () => {
  const mockedAxios = axios as unknown as { request: jest.Mock };

  beforeEach(() => {
    mockedAxios.request.mockReset();
    mockedAxios.request.mockResolvedValue({
      data: '',
      headers: {},
      status: 200,
      statusText: 'OK',
    });
  });

  it('uses request timeout when provided', async () => {
    await sendHttpRequest(
        {url: 'http://example.com', method: 'get', timeout: 5000},
        {...DEFAULT_NETWORK_CONFIG, timeout: 30000},
    );

    expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({timeout: 5000}),
    );
  });

  it('falls back to network config timeout when request timeout is missing', async () => {
    await sendHttpRequest(
        {url: 'http://example.com', method: 'get'},
        {...DEFAULT_NETWORK_CONFIG, timeout: 30000},
    );

    expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({timeout: 30000}),
    );
  });
});
