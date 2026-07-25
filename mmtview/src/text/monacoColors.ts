/**
 * Monaco theme `colors` only reliably accepts #RGB / #RRGGBB / #RRGGBBAA.
 * VS Code webviews often inject rgba()/color-mix()/currentColor — those
 * mis-parse and intermittently show up as loud red selection / highlights.
 */
export function toMonacoHex(color: string | undefined, fallback: string): string {
  const fallbackHex = /^#[0-9a-fA-F]{3,8}$/.test(fallback.trim())
    ? (fallback.trim().length === 4
        ? `#${fallback[1]}${fallback[1]}${fallback[2]}${fallback[2]}${fallback[3]}${fallback[3]}`
        : fallback.trim().slice(0, 9))
    : '#000000';
  if (!color || !String(color).trim()) {
    return fallbackHex;
  }
  const raw = String(color).trim();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw)) {
    return raw.length > 9 ? raw.slice(0, 9) : raw;
  }
  const doc = (globalThis as {document?: any}).document;
  if (!doc) {
    return fallbackHex;
  }
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return fallbackHex;
    }
    ctx.fillStyle = '#000000';
    ctx.fillStyle = raw;
    const resolved = String(ctx.fillStyle);
    if (/^#[0-9a-fA-F]{6}$/i.test(resolved)) {
      return resolved;
    }
    const m = resolved.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
    );
    if (!m) {
      return fallbackHex;
    }
    const r = Math.round(Number(m[1]));
    const g = Math.round(Number(m[2]));
    const b = Math.round(Number(m[3]));
    const a = m[4] !== undefined ?
        Math.round(Math.min(1, Math.max(0, Number(m[4]))) * 255) :
        255;
    const hex = (n: number) =>
        Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return a < 255 ? `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}` :
                     `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return fallbackHex;
  }
}

/** True when a color is a strong error-like red/pink (not a normal blue selection). */
export function isErrorLikeRed(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) {
    return false;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return false;
  }
  return r > 160 && r > g * 1.6 && r > b * 1.6;
}
