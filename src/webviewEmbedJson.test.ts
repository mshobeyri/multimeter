import {embedJsonInHtmlScript} from './webviewEmbedJson';

describe('embedJsonInHtmlScript', () => {
  it('keeps </script> from closing an HTML script tag', () => {
    const html = '<!DOCTYPE html><script>alert(1)</script>';
    const embedded = embedJsonInHtmlScript([{content: html}]);
    expect(embedded).not.toMatch(/<\/script>/i);
    expect(JSON.parse(embedded)).toEqual([{content: html}]);
  });
});
