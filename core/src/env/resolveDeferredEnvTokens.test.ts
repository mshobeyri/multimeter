import {resolveDeferredEnvTokens} from './resolveDeferredEnvTokens';

describe('resolveDeferredEnvTokens', () => {
  const reader = async (name: string, accessor = '') => {
    const values: Record<string, any> = {
      session: 'uuid-1',
      host: 'https://api.local',
      user: {id: 7, name: 'a'},
    };
    let value = values[name];
    if (value === undefined) {
      return undefined;
    }
    if (accessor === '.id') {
      return value.id;
    }
    return value;
  };

  it('resolves whole-field plain, angle, and curly e: tokens', async () => {
    expect(await resolveDeferredEnvTokens('e:session', reader)).toBe('uuid-1');
    expect(await resolveDeferredEnvTokens('<<e:session>>', reader)).toBe('uuid-1');
    expect(await resolveDeferredEnvTokens('{{e:session}}', reader)).toBe('uuid-1');
  });

  it('resolves embedded tokens inside a JSON body string', async () => {
    const body = '{"session_api":"{{e:session}}","host":"<<e:host>>"}';
    expect(await resolveDeferredEnvTokens(body, reader)).toBe(
        '{"session_api":"uuid-1","host":"https://api.local"}');
  });

  it('resolves bare and entity-escaped e: tokens in an XML body string', async () => {
    // Same shape requestForSend(format: xml) emits for deferred live e:.
    const body =
        '<body><session_api>e:session</session_api>' +
        '<note>asda&lt;&lt;e:session&gt;&gt;</note></body>';
    expect(await resolveDeferredEnvTokens(body, reader)).toBe(
        '<body><session_api>uuid-1</session_api><note>asdauuid-1</note></body>');
  });

  it('resolves percent-encoded e: tokens in a urlencoded body string', async () => {
    const body =
        'session_api=e%3Asession&note=asda%3C%3Ce%3Asession%3E%3E';
    expect(await resolveDeferredEnvTokens(body, reader)).toBe(
        'session_api=uuid-1&note=asdauuid-1');
  });

  it('resolves bare e: inside a text body string', async () => {
    expect(await resolveDeferredEnvTokens(
               'token=e:session and <<e:host>>', reader))
        .toBe('token=uuid-1 and https://api.local');
  });

  it('walks objects and arrays', async () => {
    const req = {
      url: 'https://x/<<e:session>>',
      headers: {'X-Host': 'e:host'},
      body: {userId: 'e:user.id', nested: ['{{e:session}}']},
    };
    expect(await resolveDeferredEnvTokens(req, reader)).toEqual({
      url: 'https://x/uuid-1',
      headers: {'X-Host': 'https://api.local'},
      body: {userId: 7, nested: ['uuid-1']},
    });
  });

  it('keeps unknown e: tokens when lookup returns undefined', async () => {
    expect(await resolveDeferredEnvTokens('e:missing', reader))
        .toBeUndefined();
    expect(await resolveDeferredEnvTokens('keep {{e:missing}} here', reader))
        .toBe('keep {{e:missing}} here');
    expect(await resolveDeferredEnvTokens(
               '<x>e:missing</x>', reader))
        .toBe('<x>e:missing</x>');
  });

  it('whole-field missing curly e: is undefined; embedded keeps the token',
     async () => {
       expect(await resolveDeferredEnvTokens('{{e:missing}}', reader))
           .toBeUndefined();
       expect(await resolveDeferredEnvTokens('x{{e:missing}}y', reader))
           .toBe('x{{e:missing}}y');
     });
});
