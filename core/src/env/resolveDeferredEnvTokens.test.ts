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
  });
});
