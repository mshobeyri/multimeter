import {
  contrastingForeground,
  harmonizeAccent,
  isOutlineButtonTheme,
  methodProtocolAccent,
  mixOpaque,
  relativeLuminance,
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
    // No distinct button.border → border matches softFill (invisible ring).
    expect(chrome.border.toLowerCase()).toBe(chrome.softFill.toLowerCase());
    expect(chrome.onFill.toLowerCase()).toBe('#ffffff');
    expect(chrome.buttonForeground.toLowerCase()).toBe('#ffffff');
  });

  it('merges a distinct theme button.border when present', () => {
    const chrome = harmonizeAccent('#49cc90', {
      surfaces: {
        ...normalSurfaces,
        buttonBorder: '#1a1a1a',
      },
    });
    expect(chrome.border.toLowerCase()).not.toBe(chrome.softFill.toLowerCase());
    expect(chrome.border.toLowerCase()).not.toBe('#1a1a1a');
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
    // No button border: soft tint for identity, border matches fill.
    expect(chrome.border.toLowerCase()).toBe(chrome.softFill.toLowerCase());
    expect(chrome.softFill.toLowerCase()).not.toBe('#000000');
  });
});
