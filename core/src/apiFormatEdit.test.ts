import {applyFormatSideEdit} from './apiFormatEdit';
import {normalizeFormat} from './CommonData';

describe('applyFormatSideEdit', () => {
  it('enters temp with an explicit object when changing response on scalar yaml', () => {
    const result = applyFormatSideEdit({
      side: 'response',
      value: 'json',
      yamlFormat: 'json',
      currentFormat: 'json',
      formatTouched: false,
    });
    expect(result.kind).toBe('stayTemp');
    if (result.kind !== 'stayTemp') {
      return;
    }
    // Scalar yaml means response:auto; picking json must stay explicit.
    expect(result.format).toEqual({request: 'json', response: 'json'});
    expect(normalizeFormat(result.format).response).toBe('json');
  });

  it('changes request without forcing response', () => {
    const result = applyFormatSideEdit({
      side: 'request',
      value: 'xml',
      yamlFormat: 'json',
      currentFormat: 'json',
      formatTouched: false,
    });
    expect(result).toEqual({
      kind: 'stayTemp',
      format: {request: 'xml', response: 'auto'},
    });
  });

  it('exits temp when both sides match the yaml baseline again', () => {
    const stayed = applyFormatSideEdit({
      side: 'response',
      value: 'xml',
      yamlFormat: 'json',
      currentFormat: 'json',
      formatTouched: false,
    });
    expect(stayed.kind).toBe('stayTemp');
    if (stayed.kind !== 'stayTemp') {
      return;
    }
    const exited = applyFormatSideEdit({
      side: 'response',
      value: 'auto',
      yamlFormat: 'json',
      currentFormat: stayed.format,
      formatTouched: true,
    });
    expect(exited).toEqual({kind: 'exitTemp', format: 'json'});
  });

  it('keeps sides independent across successive edits', () => {
    const req = applyFormatSideEdit({
      side: 'request',
      value: 'text',
      yamlFormat: {request: 'json', response: 'xml'},
      currentFormat: {request: 'json', response: 'xml'},
      formatTouched: false,
    });
    expect(req.kind).toBe('stayTemp');
    if (req.kind !== 'stayTemp') {
      return;
    }
    expect(req.format).toEqual({request: 'text', response: 'xml'});
    const res = applyFormatSideEdit({
      side: 'response',
      value: 'html',
      yamlFormat: {request: 'json', response: 'xml'},
      currentFormat: req.format,
      formatTouched: true,
    });
    expect(res).toEqual({
      kind: 'stayTemp',
      format: {request: 'text', response: 'html'},
    });
  });
});
