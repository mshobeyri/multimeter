import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Syntax token colors resolved from the active VS Code color theme. */
export type MmtTokenColors = {
  key: string;
  string: string;
  number: string;
  keyword: string;
  comment: string;
  tag: string;
  attribute: string;
  punctuation: string;
  foreground: string;
};

export const DEFAULT_DARK: MmtTokenColors = {
  key: '#9cdcfe',
  string: '#ce9178',
  number: '#b5cea8',
  keyword: '#569cd6',
  comment: '#6a9955',
  tag: '#569cd6',
  attribute: '#9cdcfe',
  punctuation: '#d4d4d4',
  foreground: '#d4d4d4',
};

export const DEFAULT_LIGHT: MmtTokenColors = {
  key: '#0451a5',
  string: '#a31515',
  number: '#098658',
  keyword: '#0000ff',
  comment: '#008000',
  tag: '#800000',
  attribute: '#ff0000',
  punctuation: '#000000',
  foreground: '#000000',
};

type ThemeJson = {
  include?: string;
  colors?: Record<string, string>;
  tokenColors?: Array<{
    scope?: string|string[];
    settings?: {foreground?: string; fontStyle?: string};
  }>|string;
};

export type ScopeRule = {scopes: string[]; foreground: string};

export function normalizeHex(color: string|undefined, fallback: string): string {
  if (!color || typeof color !== 'string') {
    return fallback;
  }
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed.length === 4 ?
        `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}` :
        trimmed.slice(0, 7);
  }
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return fallback;
}

function stripHash(hex: string): string {
  return hex.startsWith('#') ? hex.slice(1) : hex;
}

function readJsonFile(filePath: string): ThemeJson|null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    // Themes sometimes start with a BOM or // comments — strip simple // lines.
    const cleaned = raw.replace(/^\uFEFF/, '').replace(/^\s*\/\/.*$/gm, '');
    return JSON.parse(cleaned) as ThemeJson;
  } catch {
    return null;
  }
}

export function collectRules(themePath: string, depth = 0): {rules: ScopeRule[]; colors: Record<string, string>} {
  if (depth > 8) {
    return {rules: [], colors: {}};
  }
  const theme = readJsonFile(themePath);
  if (!theme) {
    return {rules: [], colors: {}};
  }

  let rules: ScopeRule[] = [];
  let colors: Record<string, string> = {};

  if (theme.include) {
    const includePath = path.resolve(path.dirname(themePath), theme.include);
    const parent = collectRules(includePath, depth + 1);
    rules = parent.rules;
    colors = {...parent.colors};
  }

  if (theme.colors) {
    colors = {...colors, ...theme.colors};
  }

  let tokenColors = theme.tokenColors;
  if (typeof tokenColors === 'string') {
    const tokenPath = path.resolve(path.dirname(themePath), tokenColors);
    const nested = readJsonFile(tokenPath);
    tokenColors = nested?.tokenColors;
  }
  if (Array.isArray(tokenColors)) {
    for (const entry of tokenColors) {
      const fg = entry?.settings?.foreground;
      if (!fg || !entry.scope) {
        continue;
      }
      const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
      rules.push({
        scopes: scopes.map((s) => String(s).trim()).filter(Boolean),
        foreground: fg,
      });
    }
  }

  return {rules, colors};
}

export function findForeground(rules: ScopeRule[], preferredScopes: string[], fallback: string): string {
  // Prefer exact scope match, then prefix match; later rules win (theme override order).
  let bestMatch: {score: number; color: string}|undefined;
  for (const preferred of preferredScopes) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      for (const scope of rule.scopes) {
        let matchScore = -1;
        if (scope === preferred) {
          matchScore = 1000 + preferred.length + i;
        } else if (preferred.startsWith(scope + '.') || preferred.startsWith(scope)) {
          matchScore = scope.length + i;
        } else if (scope.startsWith(preferred + '.') || scope.startsWith(preferred)) {
          matchScore = preferred.length + i;
        }
        if (matchScore >= 0 && (!bestMatch || matchScore >= bestMatch.score)) {
          bestMatch = {score: matchScore, color: rule.foreground};
        }
      }
    }
    if (bestMatch && bestMatch.score >= 1000) {
      break;
    }
  }
  return normalizeHex(bestMatch?.color, fallback);
}

function findThemePath(themeId: string): string|null {
  if (!themeId) {
    return null;
  }
  const normalized = themeId.trim().toLowerCase();
  for (const ext of vscode.extensions.all) {
    const themes = ext.packageJSON?.contributes?.themes as
        Array<{id?: string; label?: string; path?: string; uiTheme?: string}>|undefined;
    if (!Array.isArray(themes)) {
      continue;
    }
    for (const theme of themes) {
      if (!theme?.path) {
        continue;
      }
      const id = (theme.id || '').trim();
      const label = (theme.label || '').trim();
      if (id === themeId || label === themeId) {
        return path.join(ext.extensionPath, theme.path);
      }
      if (id.toLowerCase() === normalized || label.toLowerCase() === normalized) {
        return path.join(ext.extensionPath, theme.path);
      }
    }
  }
  return null;
}

function defaultsForKind(kind: vscode.ColorThemeKind): MmtTokenColors {
  return kind === vscode.ColorThemeKind.Light ||
          kind === vscode.ColorThemeKind.HighContrastLight ?
      {...DEFAULT_LIGHT} :
      {...DEFAULT_DARK};
}

/**
 * Resolve syntax colors from the active workbench color theme (TextMate scopes).
 * Falls back to Dark+/Light+-like defaults when the theme file cannot be read.
 */

export function tokenColorsFromThemeFile(
    themePath: string, fallback: MmtTokenColors): MmtTokenColors {
  const {rules, colors} = collectRules(themePath);
  const editorFg = normalizeHex(
      colors['editor.foreground'] || colors['foreground'], fallback.foreground);

  return {
    key: findForeground(
        rules,
        [
          'support.type.property-name.json',
          'support.type.property-name',
          'meta.object-literal.key',
          'string.key.json',
          'entity.name.tag.yaml',
        ],
        fallback.key),
    string: findForeground(
        rules,
        ['string.quoted.double.json', 'string.quoted', 'string'],
        fallback.string),
    number: findForeground(
        rules, ['constant.numeric.json', 'constant.numeric'], fallback.number),
    keyword: findForeground(
        rules,
        ['constant.language.json', 'constant.language', 'keyword'],
        fallback.keyword),
    comment: findForeground(
        rules, ['comment.line', 'comment.block', 'comment'], fallback.comment),
    tag: findForeground(
        rules,
        ['entity.name.tag.xml', 'entity.name.tag.html', 'entity.name.tag'],
        fallback.tag),
    attribute: findForeground(
        rules,
        [
          'entity.other.attribute-name.xml',
          'entity.other.attribute-name.html',
          'entity.other.attribute-name',
        ],
        fallback.attribute),
    punctuation: findForeground(
        rules,
        [
          'punctuation.separator',
          'punctuation.definition',
          'meta.brace',
          'punctuation',
        ],
        editorFg),
    foreground: editorFg,
  };
}

export function resolveActiveThemeTokenColors(preferredThemeId?: string): MmtTokenColors {
  const kind = vscode.window.activeColorTheme.kind;
  const fallback = defaultsForKind(kind);
  const themeId =
      preferredThemeId ||
      vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') ||
      '';
  const themePath = findThemePath(themeId);
  if (!themePath) {
    return fallback;
  }
  return tokenColorsFromThemeFile(themePath, fallback);
}

/** Monaco `rules` want hex without `#`. */
export function tokenColorsForMonaco(tokens: MmtTokenColors): Record<keyof MmtTokenColors, string> {
  const out = {} as Record<keyof MmtTokenColors, string>;
  (Object.keys(tokens) as Array<keyof MmtTokenColors>).forEach((key) => {
    out[key] = stripHash(tokens[key]);
  });
  return out;
}

export function buildThemeTokenMessage(preferredThemeId?: string) {
  return {
    type: 'vscode:changeColorTheme' as const,
    tokenColors: resolveActiveThemeTokenColors(preferredThemeId),
  };
}
