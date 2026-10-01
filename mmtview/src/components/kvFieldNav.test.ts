import { kvFieldId } from './kvFieldNav';

describe('kvFieldNav', () => {
  it('builds key/value field ids', () => {
    expect(kvFieldId(0, 'key')).toBe('key-0');
    expect(kvFieldId(2, 'value')).toBe('value-2');
  });
});
