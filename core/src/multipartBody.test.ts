import {buildMultipartBodyFromParts, buildMultipartBuffer, normalizeMultipartParts} from './multipartBody';
import {OMIT_SENTINEL, stripOmitFromBody} from './omitKeyword';

describe('multipartBody', () => {
  it('normalizes text and file parts', () => {
    expect(normalizeMultipartParts([
      {name: 'meta', value: 'hello'},
      {name: 'file', file: './upload.bin'},
    ])).toEqual([
      {name: 'meta', value: 'hello'},
      {name: 'file', file: './upload.bin', filename: 'upload.bin'},
    ]);
  });

  it('builds multipart/form-data with boundary and file part headers', () => {
    const built = buildMultipartBuffer([
      {name: 'meta', content: 'hello', contentType: 'text/plain; charset=utf-8'},
      {
        name: 'file',
        content: Buffer.from([1, 2, 3]),
        contentType: 'application/octet-stream',
        filename: 'upload.bin',
      },
    ], 'test-boundary');

    const text = Buffer.from(built.body).toString('utf8');
    expect(built.contentType).toBe('multipart/form-data; boundary=test-boundary');
    expect(text).toContain('Content-Disposition: form-data; name="meta"');
    expect(text).toContain('hello');
    expect(text).toContain('filename="upload.bin"');
    expect(text).toContain('Content-Type: application/octet-stream');
    expect(text.endsWith('--test-boundary--\r\n')).toBe(true);
  });

  it('loads file parts through the binary loader', async () => {
    const built = await buildMultipartBodyFromParts([
      {name: 'meta', value: 'x'},
      {name: 'file', file: './payload.bin'},
    ], async () => Buffer.from('abc'));

    const text = Buffer.from(built.body).toString('utf8');
    expect(text).toContain('name="meta"');
    expect(text).toContain('x');
    expect(text).toContain('filename="payload.bin"');
    expect(text).toContain('abc');
  });

  it('drops omitted multipart parts at runtime', () => {
    const cleaned = stripOmitFromBody([
      {name: 'keep', value: 'yes'},
      {name: 'drop', value: OMIT_SENTINEL},
      {name: 'drop-file', file: OMIT_SENTINEL},
    ], 'multipart');
    expect(cleaned).toEqual([{name: 'keep', value: 'yes'}]);
  });
});
