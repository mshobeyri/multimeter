/**
 * Shared theme-accent helpers for webviews (history panel + API chrome).
 * Keep in sync with mmtview/src/shared/themeAccent.ts.
 *
 * Usage:
 *   MmtThemeAccent.resolveAccent('post' | 'green' | 'red' | 'blue' | '#hex')
 *   MmtThemeAccent.harmonizeAccent(accentHex, options?)
 *   MmtThemeAccent.accentChromeFor(key, options?)
 */
(function (global) {
  'use strict';

  var METHOD_PROTOCOL_COLORS = {
    get: '#61affe',
    post: '#49cc90',
    put: '#fca130',
    delete: '#f93e3e',
    patch: '#50e3c2',
    head: '#9012fe',
    options: '#0d5aa7',
    trace: '#888888',
    ws: '#9b59b6',
    graphql: '#e535ab',
    grpc: '#244c5a',
    http: '#61affe'
  };

  var SEMANTIC_COLORS = {
    green: '#49cc90',
    red: '#f93e3e',
    blue: '#61affe'
  };

  function toHex(color, fallback) {
    var fb = fallback || '#888888';
    if (!color || !String(color).trim()) {
      return fb;
    }
    var raw = String(color).trim();
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
      return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    }
    if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw)) {
      return raw.length > 9 ? raw.slice(0, 9) : raw;
    }
    try {
      if (typeof document === 'undefined') {
        return fb;
      }
      var el = document.createElement('span');
      el.style.color = raw;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      var resolved = getComputedStyle(el).color;
      document.body.removeChild(el);
      var m = String(resolved).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
      if (m) {
        return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
      }
    } catch (e) { /* ignore */ }
    return fb;
  }

  function hexToRgb(hex) {
    var h = toHex(hex, '').replace('#', '');
    if (h.length < 6) {
      return null;
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    function hx(n) {
      return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    }
    return '#' + hx(r) + hx(g) + hx(b);
  }

  function srgbToLinear(c) {
    var s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(c) {
    var s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, s)) * 255);
  }

  function rgbToOklab(r, g, b) {
    var lr = srgbToLinear(r);
    var lg = srgbToLinear(g);
    var lb = srgbToLinear(b);
    var l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    var m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    var s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
    var l_ = Math.cbrt(l);
    var m_ = Math.cbrt(m);
    var s_ = Math.cbrt(s);
    return {
      L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    };
  }

  function oklabToRgb(L, a, b) {
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;
    return {
      r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    };
  }

  function mixOpaque(accent, base, accentPercent, fallback) {
    var pct = Math.max(0, Math.min(100, accentPercent)) / 100;
    var aHex = toHex(accent, fallback || '#888888');
    var bHex = toHex(base, '#1e1e1e');
    var a = hexToRgb(aHex);
    var b = hexToRgb(bHex);
    if (!a || !b) {
      return aHex;
    }
    var oa = rgbToOklab(a.r, a.g, a.b);
    var ob = rgbToOklab(b.r, b.g, b.b);
    var rgb = oklabToRgb(
      oa.L * pct + ob.L * (1 - pct),
      oa.a * pct + ob.a * (1 - pct),
      oa.b * pct + ob.b * (1 - pct)
    );
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function colorsNearlyEqual(a, b, maxDelta) {
    var ar = hexToRgb(toHex(a, ''));
    var br = hexToRgb(toHex(b, ''));
    if (!ar || !br) {
      return false;
    }
    var d = maxDelta == null ? 10 : maxDelta;
    return Math.abs(ar.r - br.r) <= d &&
      Math.abs(ar.g - br.g) <= d &&
      Math.abs(ar.b - br.b) <= d;
  }

  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) {
      return 0;
    }
    function lin(c) {
      var s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }

  function contrastingForeground(backgroundHex, light, dark) {
    return relativeLuminance(backgroundHex) > 0.45
      ? (dark || '#1e1e1e')
      : (light || '#ffffff');
  }

  function readCssColor(name, fallback) {
    try {
      if (typeof document === 'undefined') {
        return fallback;
      }
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return toHex((v && v.trim()) || '', fallback);
    } catch (e) {
      return fallback;
    }
  }

  function readOptionalCssColor(name) {
    try {
      if (typeof document === 'undefined') {
        return null;
      }
      var raw = getComputedStyle(document.documentElement).getPropertyValue(name);
      if (!raw || !String(raw).trim()) {
        return null;
      }
      var hex = toHex(raw, '');
      return hex && hex.startsWith('#') ? hex : null;
    } catch (e) {
      return null;
    }
  }

  function readThemeSurfaces() {
    var background = readCssColor('--vscode-editor-background', '#1e1e1e');
    var surface = readCssColor(
      '--vscode-input-background',
      readCssColor('--vscode-sideBar-background', '#3c3c3c')
    );
    return {
      background: background,
      foreground: readCssColor('--vscode-editor-foreground', '#cccccc'),
      surface: surface,
      buttonBackground: readCssColor('--vscode-button-background', '#0e639c'),
      buttonForeground: readCssColor('--vscode-button-foreground', '#ffffff'),
      buttonBorder: readOptionalCssColor('--vscode-button-border'),
      inputBorder: readOptionalCssColor('--vscode-input-border')
    };
  }

  function isOutlineButtonTheme(surfaces) {
    return colorsNearlyEqual(surfaces.buttonBackground, surfaces.background) ||
      colorsNearlyEqual(surfaces.buttonBackground, surfaces.surface);
  }

  function harmonizeAccent(accent, options) {
    options = options || {};
    var surfaces = options.surfaces || readThemeSurfaces();
    var softAmount = options.softAmount != null ? options.softAmount : 36;
    var fillAmount = options.fillAmount != null ? options.fillAmount : 52;
    var textAmount = options.textAmount != null ? options.textAmount : 62;
    var outline = options.outline != null ? options.outline : isOutlineButtonTheme(surfaces);
    var raw = toHex(accent, '#888888');
    var buttonBase = surfaces.buttonBackground;
    var text = mixOpaque(raw, surfaces.foreground, textAmount, raw);
    var themeButtonBorder = surfaces.buttonBorder;
    var hasVisibleButtonBorder = Boolean(
      themeButtonBorder &&
      !colorsNearlyEqual(themeButtonBorder, buttonBase)
    );

    if (outline) {
      var softFillOutline = hasVisibleButtonBorder
        ? buttonBase
        : mixOpaque(raw, buttonBase, softAmount, buttonBase);
      var fillOutline = softFillOutline;
      var borderOutline = hasVisibleButtonBorder
        ? mixOpaque(raw, themeButtonBorder, Math.min(80, textAmount + 8), raw)
        : fillOutline;
      return {
        accent: raw,
        text: text,
        border: borderOutline,
        softFill: softFillOutline,
        fill: fillOutline,
        onFill: surfaces.buttonForeground,
        surface: surfaces.surface,
        outline: true,
        foreground: surfaces.foreground,
        buttonForeground: surfaces.buttonForeground,
        buttonBorder: hasVisibleButtonBorder ? borderOutline : null
      };
    }

    var softFill = mixOpaque(raw, buttonBase, softAmount, buttonBase);
    var fill = mixOpaque(raw, surfaces.background, fillAmount, raw);
    var border = hasVisibleButtonBorder
      ? mixOpaque(raw, themeButtonBorder, Math.min(80, textAmount + 8), raw)
      : fill;
    return {
      accent: raw,
      text: text,
      border: border,
      softFill: softFill,
      fill: fill,
      onFill: surfaces.buttonForeground,
      surface: surfaces.surface,
      outline: false,
      foreground: surfaces.foreground,
      buttonForeground: surfaces.buttonForeground,
      buttonBorder: hasVisibleButtonBorder ? border : null
    };
  }

  function methodProtocolAccent(key) {
    var k = String(key || '').toLowerCase();
    return METHOD_PROTOCOL_COLORS[k] || '#888888';
  }

  function resolveAccent(key) {
    var k = String(key || '').trim();
    if (!k) {
      return '#888888';
    }
    if (k.charAt(0) === '#') {
      return toHex(k, '#888888');
    }
    var lower = k.toLowerCase();
    if (lower === 'green' || lower === 'red' || lower === 'blue') {
      return SEMANTIC_COLORS[lower];
    }
    return methodProtocolAccent(lower);
  }

  function accentChromeFor(key, options) {
    return harmonizeAccent(resolveAccent(key), options);
  }

  function accentChromeCssVars(chrome) {
    return {
      '--mmt-accent': chrome.accent,
      '--mmt-accent-text': chrome.text,
      '--mmt-accent-border': chrome.border,
      '--mmt-accent-soft-fill': chrome.softFill,
      '--mmt-accent-fill': chrome.fill,
      '--mmt-accent-on-fill': chrome.onFill,
      '--mmt-accent-surface': chrome.surface,
      '--mmt-accent-foreground': chrome.foreground
    };
  }

  global.MmtThemeAccent = {
    METHOD_PROTOCOL_COLORS: METHOD_PROTOCOL_COLORS,
    SEMANTIC_COLORS: SEMANTIC_COLORS,
    mixOpaque: mixOpaque,
    colorsNearlyEqual: colorsNearlyEqual,
    relativeLuminance: relativeLuminance,
    contrastingForeground: contrastingForeground,
    readThemeSurfaces: readThemeSurfaces,
    isOutlineButtonTheme: isOutlineButtonTheme,
    harmonizeAccent: harmonizeAccent,
    methodProtocolAccent: methodProtocolAccent,
    resolveAccent: resolveAccent,
    accentChromeFor: accentChromeFor,
    accentChromeCssVars: accentChromeCssVars
  };
})(typeof window !== 'undefined' ? window : globalThis);
