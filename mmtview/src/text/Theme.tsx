import { isErrorLikeRed, toMonacoHex } from './monacoColors';

export { isErrorLikeRed, toMonacoHex } from './monacoColors';

export const FIXED_BG_THEME = "fixed-bg-theme";

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
  anchor: string;
};

declare global {
  interface Window {
    __mmtTokenColors?: MmtTokenColors;
  }
}

const FALLBACK_DARK: MmtTokenColors = {
  key: "#9cdcfe",
  string: "#ce9178",
  number: "#b5cea8",
  keyword: "#569cd6",
  comment: "#6a9955",
  tag: "#569cd6",
  attribute: "#9cdcfe",
  punctuation: "#d4d4d4",
  foreground: "#d4d4d4",
  anchor: "#4ec9b0",
};

const FALLBACK_LIGHT: MmtTokenColors = {
  key: "#0451a5",
  string: "#a31515",
  number: "#098658",
  keyword: "#0000ff",
  comment: "#008000",
  tag: "#800000",
  attribute: "#0451a5",
  punctuation: "#000000",
  foreground: "#000000",
  anchor: "#267f99",
};

const cssVar = (name: string, fallback: string) =>
  toMonacoHex(
    getComputedStyle(document.documentElement).getPropertyValue(name),
    fallback,
  );

function selectionBackground(isLight: boolean): string {
  const fallback = isLight ? "#ADD6FF" : "#264F78";
  const hex = cssVar("--vscode-editor-selectionBackground", fallback);
  return isErrorLikeRed(hex) ? fallback : hex;
}

function inactiveSelectionBackground(isLight: boolean): string {
  const fallback = isLight ? "#E5EBF1" : "#3A3D41";
  const hex = cssVar("--vscode-editor-inactiveSelectionBackground", fallback);
  return isErrorLikeRed(hex) ? fallback : hex;
}

/** Current-line fill from the VS Code theme; never accept error-red parses. */
function lineHighlightBackground(isLight: boolean): string {
  const fallback = isLight ? "#EEEEEE" : "#2A2D2E";
  const hex = cssVar("--vscode-editor-lineHighlightBackground", fallback);
  return isErrorLikeRed(hex) ? fallback : hex;
}

const isDarkTheme = () => {
  const bgColor = cssVar("--vscode-editor-background", "#1e1e1e");
  const hex = bgColor.replace("#", "");
  if (hex.length < 6) {
    return true;
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
};

function stripHash(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

function withHash(color: string): string {
  if (!color) {
    return color;
  }
  return color.startsWith("#") ? color : `#${color}`;
}

/** Prefer host-resolved theme tokens; fall back to Dark+/Light+-like defaults. */
export function getActiveTokenColors(): MmtTokenColors {
  const fromHost = window.__mmtTokenColors;
  if (fromHost && fromHost.string && fromHost.key) {
    const base = isDarkTheme() ? FALLBACK_DARK : FALLBACK_LIGHT;
    return {
      key: withHash(fromHost.key),
      string: withHash(fromHost.string),
      number: withHash(fromHost.number),
      keyword: withHash(fromHost.keyword),
      comment: withHash(fromHost.comment),
      tag: withHash(fromHost.tag),
      attribute: withHash(fromHost.attribute),
      punctuation: withHash(fromHost.punctuation),
      foreground: withHash(fromHost.foreground),
      anchor: withHash(fromHost.anchor || base.anchor),
    };
  }
  return isDarkTheme() ? { ...FALLBACK_DARK } : { ...FALLBACK_LIGHT };
}

/** Publish token colors as CSS vars for HTML body highlighters (`.bh-*`). */
export function applyTokenColorCssVars(tokens: MmtTokenColors = getActiveTokenColors()) {
  const root = document.documentElement.style;
  root.setProperty("--mmt-token-key", withHash(tokens.key));
  root.setProperty("--mmt-token-string", withHash(tokens.string));
  root.setProperty("--mmt-token-number", withHash(tokens.number));
  root.setProperty("--mmt-token-keyword", withHash(tokens.keyword));
  root.setProperty("--mmt-token-comment", withHash(tokens.comment));
  root.setProperty("--mmt-token-tag", withHash(tokens.tag));
  root.setProperty("--mmt-token-attribute", withHash(tokens.attribute));
  root.setProperty("--mmt-token-punctuation", withHash(tokens.punctuation));
  root.setProperty("--mmt-token-foreground", withHash(tokens.foreground));
  root.setProperty("--mmt-expect-op-color", withHash(tokens.keyword));
  root.setProperty("--mmt-yaml-constant-color", withHash(tokens.keyword));
  // Dynamic tokens (e:/i:/r:/c:, ${...}) share the YAML &anchor / *alias color.
  root.setProperty("--mmt-token-variable", withHash(tokens.anchor));
  root.setProperty("--mmt-token-anchor", withHash(tokens.anchor));
}

export function storeTokenColorsFromHost(tokenColors: MmtTokenColors | undefined) {
  if (!tokenColors) {
    return;
  }
  window.__mmtTokenColors = tokenColors;
  applyTokenColorCssVars(getActiveTokenColors());
}

/** Last Monaco API instance — used to live-reload the theme without a full refresh. */
let monacoApi: any = null;
let themeMessageListenerInstalled = false;
/** Flip between two theme ids so Monaco always treats an update as a real theme switch. */
let themeFlip = false;
let currentMonacoThemeName = FIXED_BG_THEME + "-a";
let refreshTimer: number | null = null;

export function getMonacoThemeName(): string {
  return currentMonacoThemeName;
}

function buildThemeDefinition(monaco: any, themeName: string) {
  const isLight = !isDarkTheme();
  const tokens = getActiveTokenColors();
  applyTokenColorCssVars(tokens);

  const key = stripHash(tokens.key);
  const string = stripHash(tokens.string);
  const number = stripHash(tokens.number);
  const keyword = stripHash(tokens.keyword);
  const comment = stripHash(tokens.comment);
  const tag = stripHash(tokens.tag);
  const attribute = stripHash(tokens.attribute);
  const punct = stripHash(tokens.punctuation);
  const foreground = stripHash(tokens.foreground);
  const anchor = stripHash(tokens.anchor);

  monaco.editor.defineTheme(themeName, {
    base: isLight ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      // YAML tokens
      { token: "key", foreground: key },
      { token: "string", foreground: string },
      { token: "number", foreground: number },
      { token: "type", foreground: key },
      { token: "delimiter", foreground: punct },
      { token: "delimiter.yaml", foreground: punct },
      { token: "tag", foreground: keyword },
      { token: "mmt.operator", foreground: keyword },
      { token: "comment", foreground: comment },
      // YAML &anchor / *alias (monarch token from yamlTokenizer)
      { token: "namespace", foreground: anchor },
      { token: "namespace.yaml", foreground: anchor },

      // JSON tokens (match VS Code / Monaco scope names)
      { token: "string.key.json", foreground: key },
      { token: "string.value.json", foreground: string },
      { token: "number.json", foreground: number },
      { token: "keyword.json", foreground: keyword },
      { token: "delimiter.json", foreground: punct },

      // urlencoded form body (key=value&...)
      { token: "key.urlencoded", foreground: key },
      { token: "string.urlencoded", foreground: string },
      { token: "delimiter.urlencoded", foreground: punct },

      // XML tokens
      { token: "tag.xml", foreground: tag },
      { token: "attribute.name.xml", foreground: attribute },
      { token: "attribute.value.xml", foreground: string },
      { token: "string.xml", foreground: string },
      { token: "comment.xml", foreground: comment },
      { token: "delimiter.xml", foreground: punct },

      // Generic fallbacks
      { token: "", foreground: foreground },
    ],
    colors: {
      // Editor chrome — synced from VS Code workbench CSS vars
      "editor.background": cssVar("--vscode-editor-background", "#1e1e1e"),
      "editor.foreground": cssVar("--vscode-editor-foreground", `#${foreground}`),

      "editorLineNumber.foreground": cssVar("--vscode-editorLineNumber-foreground", "#858585"),
      "editorLineNumber.activeForeground": cssVar("--vscode-editorLineNumber-activeForeground", "#c6c6c6"),

      "editorCursor.foreground": cssVar("--vscode-editorCursor-foreground", "#aeafad"),

      // Selection must be Monaco-safe hex. Never set selectionForeground —
      // forcing it makes selections look broken, and bad CSS-var parses have
      // shown up as intermittent bright-red selections.
      "editor.selectionBackground": selectionBackground(isLight),
      "editor.inactiveSelectionBackground": inactiveSelectionBackground(isLight),
      // Current line from the active VS Code theme (hex-normalized). Keep the
      // border off — Monaco's lineHighlightBorder is what used to draw the
      // harsh red/colored box around the line.
      "editor.lineHighlightBackground": lineHighlightBackground(isLight),
      "editor.lineHighlightBorder": "#00000000",
      "editor.foldBackground": "#00000000",

      "editorWidget.background": cssVar("--vscode-editorWidget-background", "#232323"),
      "editorWidget.border": cssVar("--vscode-editorWidget-border", "#454545"),
      "editorHoverWidget.background": cssVar(
        "--vscode-editorHoverWidget-background",
        cssVar("--vscode-editorWidget-background", "#232323"),
      ),
      "editorHoverWidget.border": "transparent",
      "editorHoverWidget.foreground": cssVar(
        "--vscode-editorHoverWidget-foreground",
        cssVar("--vscode-editor-foreground", `#${foreground}`),
      ),
      "editorHoverWidget.statusBarBackground": cssVar(
        "--vscode-editorHoverWidget-statusBarBackground",
        cssVar("--vscode-editorWidget-background", "#232323"),
      ),
      "editorMarkerNavigation.background": cssVar("--vscode-editorWidget-background", "#232323"),
      "editorMarkerNavigation.border": "transparent",

      "editorSuggestWidget.background": cssVar("--vscode-editorSuggestWidget-background", "#252526"),
      "editorSuggestWidget.border": "transparent",
      "editorSuggestWidget.foreground": cssVar("--vscode-editorSuggestWidget-foreground", `#${foreground}`),
      "editorSuggestWidget.selectedForeground": cssVar(
        "--vscode-editorSuggestWidget-selectedForeground",
        `#${foreground}`,
      ),
      "editorSuggestWidget.selectedBackground": cssVar(
        "--vscode-editorSuggestWidget-selectedBackground",
        "#2c2c2c",
      ),

      "editorError.foreground": cssVar("--vscode-editorError-foreground", "#f48771"),
      "editorError.background": "#00000000",
      "editorError.border": "transparent",
      "editorWarning.foreground": cssVar("--vscode-editorWarning-foreground", "#cca700"),
      "editorWarning.background": "#00000000",
      "editorWarning.border": "transparent",
      "editorInfo.foreground": cssVar("--vscode-editorInfo-foreground", "#75beff"),
      "editorInfo.background": "#00000000",
      "editorInfo.border": "transparent",

      "diffEditor.insertedTextBackground": cssVar("--vscode-diffEditor-insertedTextBackground", "#00809b33"),
      "diffEditor.removedTextBackground": cssVar("--vscode-diffEditor-removedTextBackground", "#a3151533"),

      "editorOverviewRuler.errorForeground": cssVar("--vscode-editorError-foreground", "#f48771"),
      "editorOverviewRuler.warningForeground": cssVar("--vscode-editorWarning-foreground", "#cca700"),
      "editorOverviewRuler.infoForeground": cssVar("--vscode-editorInfo-foreground", "#75beff"),
    },
  });
}

export function refreshMonacoTheme() {
  applyTokenColorCssVars(getActiveTokenColors());
  if (!monacoApi?.editor) {
    return;
  }
  // Alternate theme ids so setTheme is never a no-op while already on the same name
  // (happens when flipping themes in the Color Theme quick pick).
  themeFlip = !themeFlip;
  currentMonacoThemeName = themeFlip ? `${FIXED_BG_THEME}-b` : `${FIXED_BG_THEME}-a`;
  buildThemeDefinition(monacoApi, currentMonacoThemeName);
  monacoApi.editor.setTheme(currentMonacoThemeName);
  window.dispatchEvent(
    new CustomEvent("vscode:changeColorTheme", {
      detail: {
        tokenColors: window.__mmtTokenColors,
        monacoTheme: currentMonacoThemeName,
      },
    }),
  );
}

function scheduleRefreshMonacoTheme() {
  if (refreshTimer != null) {
    window.clearTimeout(refreshTimer);
  }
  // Debounce rapid previews while the theme picker is open.
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    refreshMonacoTheme();
  }, 30);
}

function requestThemeTokensFromHost() {
  try {
    const themeId =
      document.body.getAttribute("data-vscode-theme-id") ||
      document.body.dataset?.vscodeThemeId ||
      undefined;
    window.vscode?.postMessage({ command: "requestThemeTokens", themeId });
  } catch {
    // ignore
  }
}

function installThemeMessageListener() {
  if (themeMessageListenerInstalled || typeof window === "undefined") {
    return;
  }
  themeMessageListenerInstalled = true;
  window.addEventListener("message", (event: MessageEvent) => {
    if (!event.data || event.data.type !== "vscode:changeColorTheme") {
      return;
    }
    storeTokenColorsFromHost(event.data.tokenColors);
    scheduleRefreshMonacoTheme();
  });
  // Ask the extension for current theme tokens (initial postMessage can race HTML load).
  requestThemeTokensFromHost();

  // When VS Code updates the webview theme id (picker preview), re-request tokens.
  try {
    let requestTimer: number | null = null;
    const observer = new MutationObserver(() => {
      if (requestTimer != null) {
        window.clearTimeout(requestTimer);
      }
      requestTimer = window.setTimeout(() => {
        requestTimer = null;
        requestThemeTokensFromHost();
      }, 40);
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-vscode-theme-id"],
    });
  } catch {
    // ignore
  }
}

/** Call once from App so theme messages are handled before Monaco mounts. */
export function ensureThemeSync() {
  installThemeMessageListener();
  applyTokenColorCssVars(getActiveTokenColors());
}

export const defineTheme = (monaco: any) => {
  installThemeMessageListener();
  monacoApi = monaco;
  buildThemeDefinition(monaco, currentMonacoThemeName);
  monaco.editor.setTheme(currentMonacoThemeName);
};
