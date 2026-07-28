import {
  accentChromeFor,
  contrastingForeground,
  harmonizeAccent,
  isOutlineButtonTheme,
  methodProtocolAccent,
  mixOpaque,
  relativeLuminance,
  resolveAccent,
  SEMANTIC_COLORS,
} from './themeAccent';

const normalSurfaces = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  surface: '#3c3c3c',
  buttonBackground: '#0e639c',
  buttonForeground: '#ffffff',
  buttonBorder: null as string | null,
  inputBorder: '#555555',
};

describe('themeAccent', () => {
  it('picks contrasting foreground from luminance', () => {
    expect(relativeLuminance('#ffffff')).toBeGreaterThan(0.9);
    expect(relativeLuminance('#000000')).toBeLessThan(0.1);
    expect(contrastingForeground('#ffffff')).toBe('#1e1e1e');
    expect(contrastingForeground('#111111')).toBe('#ffffff');
  });

  it('resolves known method accents', () => {
    expect(methodProtocolAccent('POST')).toBe('#49cc90');
    expect(methodProtocolAccent('unknown')).toBe('#888888');
  });

  it('resolves semantic green/red/blue accents', () => {
    expect(resolveAccent('green')).toBe(SEMANTIC_COLORS.green);
    expect(resolveAccent('red')).toBe(SEMANTIC_COLORS.red);
    expect(resolveAccent('blue')).toBe(SEMANTIC_COLORS.blue);
    expect(resolveAccent('POST')).toBe(SEMANTIC_COLORS.green);
    expect(resolveAccent('#abcdef')).toBe('#abcdef');
  });

  it('mixes accent into theme base without alpha', () => {
    const mixed = mixOpaque('#49cc90', '#2b2118', 50);
    expect(mixed.startsWith('#')).toBe(true);
    expect(mixed.replace('#', '').length).toBe(6);
    expect(mixed.toLowerCase()).not.toBe('#49cc90');
    expect(mixed.toLowerCase()).not.toBe('#2b2118');
  });

  it('tints softFill from button.background and hides border when theme has none', () => {
    const chrome = harmonizeAccent('#49cc90', { surfaces: normalSurfaces });
    expect(chrome.outline).toBe(false);
    expect(chrome.softFill.toLowerCase()).not.toBe(normalSurfaces.buttonBackground.toLowerCase());
    // No distinct button.border → border matches fill (invisible ring on buttons).
    expect(chrome.border.toLowerCase()).toBe(chrome.fill.toLowerCase());
    expect(chrome.buttonBorder).toBeNull();
    expect(chrome.onFill.toLowerCase()).toBe('#ffffff');
    expect(chrome.buttonForeground.toLowerCase()).toBe('#ffffff');
  });

  it('uses the same fill for method select and send (accentChromeFor)', () => {
    const chrome = accentChromeFor('post', { surfaces: normalSurfaces });
    expect(chrome.fill.toLowerCase()).not.toBe(chrome.softFill.toLowerCase());
    expect(chrome.fill.toLowerCase()).not.toBe(normalSurfaces.background.toLowerCase());
  });

  it('merges a distinct theme button.border when present', () => {
    const chrome = harmonizeAccent('#49cc90', {
      surfaces: {
        ...normalSurfaces,
        buttonBorder: '#1a1a1a',
      },
    });
    expect(chrome.border.toLowerCase()).not.toBe(chrome.fill.toLowerCase());
    expect(chrome.border.toLowerCase()).not.toBe('#1a1a1a');
    expect(chrome.buttonBorder).toBe(chrome.border);
  });

  it('treats theme button.border matching button.background as no border', () => {
    const chrome = harmonizeAccent('#49cc90', {
      surfaces: {
        ...normalSurfaces,
        buttonBorder: normalSurfaces.buttonBackground,
      },
    });
    expect(chrome.border.toLowerCase()).toBe(chrome.fill.toLowerCase());
    expect(chrome.buttonBorder).toBeNull();
  });

  it('uses outline chrome when button bg matches palette bg', () => {
    const surfaces = {
      background: '#000000',
      foreground: '#ffffff',
      surface: '#000000',
      buttonBackground: '#000000',
      buttonForeground: '#ffffff',
      buttonBorder: null as string | null,
      inputBorder: null as string | null,
    };
    expect(isOutlineButtonTheme(surfaces)).toBe(true);
    const chrome = harmonizeAccent('#49cc90', { surfaces });
    expect(chrome.outline).toBe(true);
    // Outline: fill matches softFill so method select and Send stay identical.
    expect(chrome.fill.toLowerCase()).toBe(chrome.softFill.toLowerCase());
    expect(chrome.border.toLowerCase()).toBe(chrome.fill.toLowerCase());
    expect(chrome.buttonBorder).toBeNull();
    expect(chrome.softFill.toLowerCase()).not.toBe('#000000');
  });
});
