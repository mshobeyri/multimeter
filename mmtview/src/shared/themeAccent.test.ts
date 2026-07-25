import {
  contrastingForeground,
  harmonizeAccent,
  isOutlineButtonTheme,
  methodProtocolAccent,
  mixOpaque,
  relativeLuminance,
} from './themeAccent';

const normalSurfaces = {
  background: '#2b2118',
  foreground: '#e8dcc8',
  surface: '#3a2f24',
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

  it('returns opaque chrome roles for an accent', () => {
    const chrome = harmonizeAccent('#49cc90', { surfaces: normalSurfaces });
    expect(chrome.outline).toBe(false);
    expect(chrome.accent.toLowerCase()).toBe('#49cc90');
    expect(chrome.fill.startsWith('#')).toBe(true);
    expect(chrome.softFill.startsWith('#')).toBe(true);
    expect(chrome.border.startsWith('#')).toBe(true);
    expect(chrome.surface.toLowerCase()).toBe('#3a2f24');
    // Solid actions use VS Code button foreground.
    expect(chrome.onFill.toLowerCase()).toBe('#ffffff');
    expect(chrome.buttonForeground.toLowerCase()).toBe('#ffffff');
    expect(chrome.foreground.toLowerCase()).toBe('#e8dcc8');
    expect(chrome.buttonBorder).toBeNull();
    expect(chrome.fill.replace('#', '').length).toBe(6);
    expect(chrome.softFill.replace('#', '').length).toBe(6);
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
    expect(chrome.fill.toLowerCase()).toBe('#000000');
    expect(chrome.softFill.toLowerCase()).toBe('#000000');
    expect(chrome.border.toLowerCase()).not.toBe('#000000');
  });

  it('merges accent into both softFill and border', () => {
    const chrome = harmonizeAccent('#49cc90', { surfaces: normalSurfaces });
    expect(chrome.softFill.toLowerCase()).not.toBe(normalSurfaces.surface);
    expect(chrome.border.toLowerCase()).not.toBe('#555555');
    expect(chrome.border.toLowerCase()).not.toBe('#49cc90');
  });
});
