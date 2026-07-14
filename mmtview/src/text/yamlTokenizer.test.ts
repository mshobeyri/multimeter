import { buildMmtTagHandleRules } from './yamlTokenizer';

function firstTagHandleToken(text: string): string | undefined {
  const rules = buildMmtTagHandleRules();
  for (const [pattern, token] of rules) {
    const match = text.match(pattern);
    if (match && match.index === 0) {
      return token;
    }
  }
  return undefined;
}

describe('buildMmtTagHandleRules', () => {
  it('treats MMT ! operators as operators, not YAML tags', () => {
    expect(firstTagHandleToken('!= 500')).toBe('mmt.operator');
    expect(firstTagHandleToken('!^ prefix')).toBe('mmt.operator');
    expect(firstTagHandleToken('!@ item')).toBe('mmt.operator');
    expect(firstTagHandleToken('!75% admin')).toBe('mmt.operator');
  });

  it('still treats real YAML tags as tags', () => {
    expect(firstTagHandleToken('!Foo')).toBe('tag');
    expect(firstTagHandleToken('!com.example/type')).toBe('tag');
  });
});
