jest.mock('vscode', () => ({
  window: {activeColorTheme: {kind: 2}},
  ColorThemeKind: {Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4},
  workspace: {getConfiguration: () => ({get: () => ''})},
  extensions: {all: []},
}), {virtual: true});

import * as fs from 'fs';
import * as path from 'path';

import {
  DEFAULT_DARK,
  collectRules,
  findForeground,
  tokenColorsFromThemeFile,
} from './themeTokenColors';

describe('themeTokenColors', () => {
  it('follows include chains and prefers specific scopes', () => {
    const dir = fs.mkdtempSync(path.join(__dirname, '.theme-test-'));
    try {
      const basePath = path.join(dir, 'base.json');
      const themePath = path.join(dir, 'theme.json');
      fs.writeFileSync(basePath, JSON.stringify({
        tokenColors: [
          {scope: 'string', settings: {foreground: '#aa0000'}},
          {scope: 'constant.numeric', settings: {foreground: '#00aa00'}},
        ],
        colors: {'editor.foreground': '#cccccc'},
      }));
      fs.writeFileSync(themePath, JSON.stringify({
        include: './base.json',
        tokenColors: [
          {
            scope: 'support.type.property-name.json',
            settings: {foreground: '#0000aa'},
          },
          {scope: 'comment', settings: {foreground: '#888888'}},
        ],
      }));

      const {rules, colors} = collectRules(themePath);
      expect(colors['editor.foreground']).toBe('#cccccc');
      expect(findForeground(rules, ['string'], '#fff').toLowerCase()).toBe('#aa0000');

      const tokens = tokenColorsFromThemeFile(themePath, DEFAULT_DARK);
      expect(tokens.key.toLowerCase()).toBe('#0000aa');
      expect(tokens.string.toLowerCase()).toBe('#aa0000');
      expect(tokens.number.toLowerCase()).toBe('#00aa00');
      expect(tokens.comment.toLowerCase()).toBe('#888888');
      expect(tokens.foreground.toLowerCase()).toBe('#cccccc');
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  it('does not use regexp punctuation colors for body delimiters', () => {
    const dir = fs.mkdtempSync(path.join(__dirname, '.theme-test-'));
    try {
      const themePath = path.join(dir, 'theme.json');
      fs.writeFileSync(themePath, JSON.stringify({
        colors: {'editor.foreground': '#222222'},
        tokenColors: [
          {
            scope: 'punctuation.definition.character-class.regexp',
            settings: {foreground: '#d16969'},
          },
          {
            scope: 'punctuation.definition.group.regexp',
            settings: {foreground: '#d16969'},
          },
          {
            scope: 'punctuation.separator.dictionary.key-value.json',
            settings: {foreground: '#666666'},
          },
          {
            scope: 'support.type.property-name.json',
            settings: {foreground: '#0451a5'},
          },
          {scope: 'string', settings: {foreground: '#a31515'}},
        ],
      }));

      const tokens = tokenColorsFromThemeFile(themePath, DEFAULT_DARK);
      expect(tokens.punctuation.toLowerCase()).toBe('#666666');
      expect(tokens.punctuation.toLowerCase()).not.toBe('#d16969');
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  it('falls back to editor foreground when no JSON delimiter scopes exist', () => {
    const dir = fs.mkdtempSync(path.join(__dirname, '.theme-test-'));
    try {
      const themePath = path.join(dir, 'theme.json');
      fs.writeFileSync(themePath, JSON.stringify({
        colors: {'editor.foreground': '#101010'},
        tokenColors: [
          {
            scope: 'punctuation.definition.character-class.regexp',
            settings: {foreground: '#d16969'},
          },
          {
            scope: 'support.type.property-name.json',
            settings: {foreground: '#0451a5'},
          },
        ],
      }));

      const tokens = tokenColorsFromThemeFile(themePath, DEFAULT_DARK);
      expect(tokens.punctuation.toLowerCase()).toBe('#101010');
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
});
