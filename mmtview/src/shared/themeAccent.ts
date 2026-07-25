import { toMonacoHex } from '../text/monacoColors';

/** Canonical HTTP/protocol accent colors (brand hues before theme harmonization). */
export const METHOD_PROTOCOL_COLORS: Record<string, string> = {
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
  http: '#61affe',
};

export type ThemeSurfaces = {
  /** Panel / editor background */
  background: string;
  /** Default text color */
  foreground: string;
  /** Input / control surface (outline button background) */
  surface: string;
  /** VS Code primary button background (flat/HC detection) */
  buttonBackground: string;
  /** VS Code primary button label color (contrast on button bg) */
  buttonForeground: string;
  /**
   * Theme button border, if the theme defines one.
   * `null` when unset — callers should not invent a border.
   */
  buttonBorder: string|null;
  /** Theme input border, if defined (method-select edge base). */
  inputBorder: string|null;
};

/**
 * Opaque theme-aware roles derived from one accent.
 * Inspired by Material You / OKLab tinting: keep accent hue, pull lightness
 * toward the active theme so badges/buttons don't clash with brown/sepia/etc.
 *
 * - `text` / `border` + `surface`: outline chrome (bg stays surface; only ink/edge tint)
 * - `softFill`: light tinted chip / method-select / history badge (opaque)
 * - `fill` / `onFill`: solid primary actions (send); when `outline`, fill === surface
 */
export type AccentChrome = {
  accent: string;
  text: string;
  border: string;
  softFill: string;
  fill: string;
  onFill: string;
  surface: string;
  /**
   * Theme buttons share the palette background (high-contrast / flat themes).
   * Prefer outline roles: surface bg + text/border only.
   */
  outline: boolean;
  /** Theme editor/UI foreground. */
  foreground: string;
  /** Theme primary-button label color. */
  buttonForeground: string;
  /** Theme button border, or null when the theme defines none. */
  buttonBorder: string|null;
};

type DomDocument = {
  documentElement: { style?: unknown };
  createElement: (tag: string) => {
    style: { color: string; position: string; left: string };
  };
  body: {
    appendChild: (n: unknown) => void;
    removeChild: (n: unknown) => void;
  };
};

function getDomDocument(): DomDocument | undefined {
  return (globalThis as { document?: DomDocument }).document;
}

function getComputedStyleSafe(el: unknown): { getPropertyValue: (n: string) => string; color?: string } | null {
  const gcs = (globalThis as { getComputedStyle?: (e: unknown) => { getPropertyValue: (n: string) => string; color: string } })
      .getComputedStyle;
  if (!gcs) {
    return null;
  }
  try {
    return gcs(el);
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = toMonacoHex(hex, '').replace('#', '');
  if (h.length < 6) {
    return null;
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** True when two opaque hex colors are within maxDelta per channel. */
export function colorsNearlyEqual(
    a: string,
    b: string,
    maxDelta = 10,
): boolean {
  const ar = hexToRgb(toMonacoHex(a, ''));
  const br = hexToRgb(toMonacoHex(b, ''));
  if (!ar || !br) {
    return false;
  }
  return Math.abs(ar.r - br.r) <= maxDelta &&
      Math.abs(ar.g - br.g) <= maxDelta &&
      Math.abs(ar.b - br.b) <= maxDelta;
}

/**
 * Flat / high-contrast themes paint primary buttons with the same bg as the
 * editor or sidebar palette — solid accent fills would clash; use outline.
 */
export function isOutlineButtonTheme(surfaces: ThemeSurfaces): boolean {
  const btn = surfaces.buttonBackground;
  return colorsNearlyEqual(btn, surfaces.background) ||
      colorsNearlyEqual(btn, surfaces.surface);
}

export function readThemeSurfaces(): ThemeSurfaces {
  const doc = getDomDocument();
  const root = doc ? getComputedStyleSafe(doc.documentElement) : null;
  const read = (name: string, fallback: string) =>
      toMonacoHex(root?.getPropertyValue(name), fallback);
  const readOptional = (name: string): string|null => {
    const raw = root?.getPropertyValue(name);
    if (!raw || !String(raw).trim()) {
      return null;
    }
    const hex = toMonacoHex(raw, '');
    return hex && hex.startsWith('#') ? hex : null;
  };
  const background = read('--vscode-editor-background', '#1e1e1e');
  const surface = read(
      '--vscode-input-background',
      read('--vscode-sideBar-background', '#3c3c3c'));
  return {
    background,
    foreground: read('--vscode-editor-foreground', '#cccccc'),
    surface,
    // Fall back to a distinct blue so missing token ≠ false outline detection.
    buttonBackground: read('--vscode-button-background', '#0e639c'),
    buttonForeground: read('--vscode-button-foreground', '#ffffff'),
    buttonBorder: readOptional('--vscode-button-border'),
    inputBorder: readOptional('--vscode-input-border'),
  };
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, s)) * 255);
}

function rgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

function oklabToRgb(L: number, a: number, b: number): { r: number; g: number; b: number } {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Opaque OKLab mix in pure JS (no alpha, no browser color-mix).
 * `accentPercent` is how much of the accent to keep (0..100).
 */
export function mixOpaque(
    accent: string,
    base: string,
    accentPercent: number,
    fallback?: string,
): string {
  const pct = Math.max(0, Math.min(100, accentPercent)) / 100;
  const aHex = toMonacoHex(accent, fallback || '#888888');
  const bHex = toMonacoHex(base, '#1e1e1e');
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) {
    return aHex;
  }
  const oa = rgbToOklab(a.r, a.g, a.b);
  const ob = rgbToOklab(b.r, b.g, b.b);
  const L = oa.L * pct + ob.L * (1 - pct);
  const aa = oa.a * pct + ob.a * (1 - pct);
  const bb = oa.b * pct + ob.b * (1 - pct);
  const rgb = oklabToRgb(L, aa, bb);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/** Relative luminance 0..1 for a #RRGGBB(AA) color. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b);
}

export function contrastingForeground(
    backgroundHex: string,
    light = '#ffffff',
    dark = '#1e1e1e',
): string {
  return relativeLuminance(backgroundHex) > 0.45 ? dark : light;
}

/**
 * Resolve any CSS color (including color-mix()) to #RRGGBB via the browser.
 * Prefer mixOpaque for accent harmonization; this is a fallback helper.
 */
export function resolveCssColor(cssColor: string, fallback: string): string {
  const fallbackHex = toMonacoHex(fallback, '#888888');
  const doc = getDomDocument();
  if (!cssColor || !doc) {
    return fallbackHex;
  }
  try {
    const el = doc.createElement('span');
    el.style.color = cssColor;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    doc.body.appendChild(el);
    const resolved = getComputedStyleSafe(el)?.color;
    doc.body.removeChild(el);
    return toMonacoHex(resolved, fallbackHex);
  } catch {
    return fallbackHex;
  }
}

export type HarmonizeAccentOptions = {
  surfaces?: ThemeSurfaces;
  /** Accent amount in softFill (default 32). */
  softAmount?: number;
  /** Accent amount in solid fill (default 52). */
  fillAmount?: number;
  /** Accent amount in text/border (default 62). */
  textAmount?: number;
  /** Force outline / solid; default auto-detect from button vs palette bg. */
  outline?: boolean;
};

/**
 * Build theme-harmonized chrome for one accent color.
 *
 * Method select follows **button** tokens (not input/select):
 * - `softFill` = accent merged into `button.background`
 * - `border` = accent merged into `button.border` when the theme defines a
 *   distinct button border; otherwise `border === softFill` (no visible ring,
 *   matching themes whose buttons have no/matching border)
 * - label uses `buttonForeground`
 *
 * Solid primary actions (Send): `fill` + `onFill` (`buttonForeground`).
 */
export function harmonizeAccent(
    accent: string,
    options: HarmonizeAccentOptions = {},
): AccentChrome {
  const surfaces = options.surfaces || readThemeSurfaces();
  const softAmount = options.softAmount ?? 36;
  const fillAmount = options.fillAmount ?? 52;
  const textAmount = options.textAmount ?? 62;
  const outline = options.outline ?? isOutlineButtonTheme(surfaces);
  const raw = toMonacoHex(accent, '#888888');
  const buttonBase = surfaces.buttonBackground;

  // Accent-tinted ink for icons / optional emphasis.
  const text = mixOpaque(raw, surfaces.foreground, textAmount, raw);

  const themeButtonBorder = surfaces.buttonBorder;
  const hasVisibleButtonBorder = Boolean(
      themeButtonBorder &&
      !colorsNearlyEqual(themeButtonBorder, buttonBase));

  if (outline) {
    // Flat / HC: button bg matches palette.
    // With a real button border → flat bg + accent edge; otherwise soft tint, no ring.
    const softFill = hasVisibleButtonBorder ?
        buttonBase :
        mixOpaque(raw, buttonBase, softAmount, buttonBase);
    const border = hasVisibleButtonBorder ?
        mixOpaque(raw, themeButtonBorder!, Math.min(80, textAmount + 8), raw) :
        softFill;
    return {
      accent: raw,
      text,
      border,
      softFill,
      fill: buttonBase,
      onFill: surfaces.buttonForeground,
      surface: surfaces.surface,
      outline: true,
      foreground: surfaces.foreground,
      buttonForeground: surfaces.buttonForeground,
      buttonBorder: surfaces.buttonBorder,
    };
  }

  // Normal themes: tint button.background; border matches button border rules.
  const softFill = mixOpaque(raw, buttonBase, softAmount, buttonBase);
  const border = hasVisibleButtonBorder ?
      mixOpaque(raw, themeButtonBorder!, Math.min(80, textAmount + 8), raw) :
      softFill;
  const fill = mixOpaque(raw, surfaces.background, fillAmount, raw);

  return {
    accent: raw,
    text,
    border,
    softFill,
    fill,
    onFill: surfaces.buttonForeground,
    surface: surfaces.surface,
    outline: false,
    foreground: surfaces.foreground,
    buttonForeground: surfaces.buttonForeground,
    buttonBorder: surfaces.buttonBorder,
  };
}

/** CSS custom properties for an accent (set on an element style). */
export function accentChromeCssVars(chrome: AccentChrome): Record<string, string> {
  return {
    '--mmt-accent': chrome.accent,
    '--mmt-accent-text': chrome.text,
    '--mmt-accent-border': chrome.border,
    '--mmt-accent-soft-fill': chrome.softFill,
    '--mmt-accent-fill': chrome.fill,
    '--mmt-accent-on-fill': chrome.onFill,
    '--mmt-accent-surface': chrome.surface,
    '--mmt-accent-foreground': chrome.foreground,
  };
}

export function methodProtocolAccent(key: string): string {
  const k = String(key || '').toLowerCase();
  return METHOD_PROTOCOL_COLORS[k] || '#888888';
}

/** Theme-harmonized text/icon color for a method or protocol key. */
export function methodTextColor(method: string): string {
  return harmonizeAccent(methodProtocolAccent(method)).text;
}
